"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadBoq, saveBoq } from "@/actions/projects";
import { perUnitQty, type BoqItem, type BoqMeta, type BoqSnapshot } from "@/lib/boq";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const SAVE_CHIP: Record<SaveState, string> = {
  saved: "All changes saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed — retrying",
  conflict: "Out of date — reload",
};

function remapIds(snapshot: BoqSnapshot, idMap: Record<string, string>): BoqSnapshot {
  return {
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => (idMap[item.id] ? { ...item, id: idMap[item.id] } : item)),
    })),
  };
}

/**
 * The live BOQ, its autosave, and inline row editing — everything a screen needs
 * to edit line items in place.
 *
 * Extracted from BoqBuilder so the Client Review screen can edit the same BOQ
 * through exactly the same path rather than growing a second, subtly different
 * copy of it. The parts worth not duplicating are the careful ones: optimistic
 * concurrency against `updatedAt`, the mount-time freshness check that stops a
 * replayed router-cache payload from autosaving over real work, and holding
 * pending row edits outside the snapshot so autosave can't pick up a half-typed
 * row.
 */
export function useBoqEditor({
  projectId,
  initialSnapshot,
  initialUpdatedAt,
}: {
  projectId: string;
  initialSnapshot: BoqSnapshot;
  initialUpdatedAt: string;
}) {
  const [snapshot, setSnapshot] = useState<BoqSnapshot>(initialSnapshot);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  /**
   * Rows opened for inline editing, keyed by item id.
   *
   * Deliberately kept out of `snapshot` so autosave can't pick them up: edits
   * stay pending until they're saved, and cancelling drops them.
   */
  const [pendingEdits, setPendingEdits] = useState<Record<string, BoqItem>>({});
  const editCount = Object.keys(pendingEdits).length;

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef(false);

  /** project.updatedAt this tab is working from; every save checks it. */
  const baseUpdatedAt = useRef(initialUpdatedAt);
  /** Autosave stays parked until the props have been checked against the DB. */
  const [synced, setSynced] = useState(false);

  /** Every user-driven mutation goes through here so autosave knows to fire. */
  const update = useCallback((fn: (prev: BoqSnapshot) => BoqSnapshot) => {
    revision.current += 1;
    setSaveState("dirty");
    setSnapshot(fn);
  }, []);

  const flush = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    const at = revision.current;
    if (at === savedRevision.current) return;

    inFlight.current = true;
    setSaveState("saving");
    try {
      const current = snapshotRef.current;
      const result = await saveBoq({
        projectId,
        expectedUpdatedAt: baseUpdatedAt.current,
        meta: current.meta,
        sections: current.sections,
      });

      if (result.conflict) {
        // Someone (or some other tab) has moved this BOQ on. Stop writing —
        // retrying would overwrite whatever they did.
        setSaveState("conflict");
        return;
      }
      if (!result.ok) throw new Error(result.error ?? "save rejected");

      savedRevision.current = at;
      if (result.updatedAt) baseUpdatedAt.current = result.updatedAt;
      if (Object.keys(result.idMap).length > 0) {
        setSnapshot((prev) => remapIds(prev, result.idMap));
      }
      setSaveState(revision.current === at ? "saved" : "dirty");
    } catch {
      setSaveState("error");
    } finally {
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        void flush();
      }
    }
  }, [projectId]);

  /**
   * Confirm the server-rendered props are current before touching anything.
   *
   * A back/forward navigation can replay a cached RSC payload from before items
   * were added; mounting on that and autosaving would delete them.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fresh = await loadBoq(projectId);
        if (cancelled || !fresh) return;
        if (fresh.updatedAt !== baseUpdatedAt.current) {
          if (revision.current === savedRevision.current) {
            // Nothing typed yet — quietly adopt the real state.
            setSnapshot(fresh.snapshot);
            baseUpdatedAt.current = fresh.updatedAt;
          } else {
            setSaveState("conflict");
          }
        }
      } catch {
        // Offline or the action failed; the save-time check still protects us.
      } finally {
        if (!cancelled) setSynced(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Debounced autosave. Typing a rate shouldn't cost a round trip per keystroke.
  // A failed save backs off and tries again rather than sitting there dead —
  // losing a section of typed items to a dropped connection is not acceptable.
  useEffect(() => {
    if (!synced) return;
    if (saveState !== "dirty" && saveState !== "error") return;
    const timer = setTimeout(() => void flush(), saveState === "error" ? 5000 : 900);
    return () => clearTimeout(timer);
  }, [synced, saveState, snapshot, flush]);

  // Uncommitted inline edits count as unsaved work too — they only exist in
  // this tab until they're saved.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current || editCount > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editCount]);

  const setMeta = useCallback(
    (changes: Partial<BoqMeta>) => update((prev) => ({ ...prev, meta: { ...prev.meta, ...changes } })),
    [update],
  );

  // ------------------------------------------------------- inline row edits

  const startEdit = useCallback((item: BoqItem) => {
    setPendingEdits((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: structuredClone(item) }));
  }, []);

  const changeEdit = useCallback((id: string, next: BoqItem) => {
    setPendingEdits((prev) => ({ ...prev, [id]: next }));
  }, []);

  const discardEdit = useCallback((id: string) => {
    setPendingEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const cancelAllEdits = useCallback(() => setPendingEdits({}), []);

  /** Commit a set of pending rows into the snapshot, which autosave then picks up. */
  const commitEdits = useCallback(
    (ids: string[]) => {
      const committing = new Set(ids);
      if (committing.size === 0) return;

      update((prev) => ({
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          items: section.items.map((row) => {
            if (!committing.has(row.id)) return row;
            const edited = pendingEdits[row.id];
            // perUnitQty: `qty` is one unit's worth, multiplied by the count
            // on read. Storing the billed total would compound it each save.
            return edited ? { ...edited, qty: perUnitQty(edited) } : row;
          }),
        })),
      }));

      setPendingEdits((prev) => {
        const next = { ...prev };
        for (const id of committing) delete next[id];
        return next;
      });
    },
    [pendingEdits, update],
  );

  const saveRowEdit = useCallback((id: string) => commitEdits([id]), [commitEdits]);
  const saveAllEdits = useCallback(
    () => commitEdits(Object.keys(pendingEdits)),
    [commitEdits, pendingEdits],
  );

  const removeItem = useCallback(
    (sectionName: string, id: string) => {
      update((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.name === sectionName ? { ...section, items: section.items.filter((r) => r.id !== id) } : section,
        ),
      }));
      discardEdit(id);
    },
    [discardEdit, update],
  );

  const saveChip = useMemo(() => SAVE_CHIP[saveState], [saveState]);

  return {
    snapshot,
    setSnapshot,
    update,
    setMeta,
    flush,
    saveState,
    saveChip,
    /** Adopt a new updatedAt after something else bumped it (e.g. versioning). */
    adoptUpdatedAt: (value: string) => {
      baseUpdatedAt.current = value;
    },
    pendingEdits,
    editCount,
    startEdit,
    changeEdit,
    discardEdit,
    cancelAllEdits,
    commitEdits,
    saveRowEdit,
    saveAllEdits,
    removeItem,
  };
}
