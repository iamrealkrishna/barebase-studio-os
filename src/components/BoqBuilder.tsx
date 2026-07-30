"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { loadBoq, saveBoq, saveVersion } from "@/actions/projects";
import EntryForm, { CUSTOM_CATEGORY, freshDraft } from "@/components/EntryForm";
import ImportFromProject from "@/components/ImportFromProject";
import InlineItemRow from "@/components/InlineItemRow";
import { PdfButton } from "@/components/PdfButtons";
import ProjectBar from "@/components/ProjectBar";
import SummaryPanel from "@/components/SummaryPanel";
import { Toast, useToast } from "@/components/Toast";
import {
  CLIENT_VISIBLE_FIELDS,
  computeQty,
  diffSnapshots,
  fmt,
  PRESET_ROOMS,
  sectionTotal,
  type BoqItem,
  type BoqMeta,
  type BoqSnapshot,
} from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";
import { categoryList, type RateEntry } from "@/lib/rate-card";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

function remapIds(snapshot: BoqSnapshot, idMap: Record<string, string>): BoqSnapshot {
  return {
    ...snapshot,
    sections: snapshot.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => (idMap[item.id] ? { ...item, id: idMap[item.id] } : item)),
    })),
  };
}

export default function BoqBuilder({
  projectId,
  initialSnapshot,
  initialUpdatedAt,
  rateEntries,
  letterhead,
  approvedSnapshot,
  approvedVersionNumber,
}: {
  projectId: string;
  initialSnapshot: BoqSnapshot;
  initialUpdatedAt: string;
  rateEntries: RateEntry[];
  letterhead: Letterhead;
  approvedSnapshot: BoqSnapshot | null;
  approvedVersionNumber: number | null;
}) {
  const router = useRouter();
  const { message, toast } = useToast();

  const [snapshot, setSnapshot] = useState<BoqSnapshot>(initialSnapshot);
  const [activeSection, setActiveSection] = useState<string | null>(initialSnapshot.sections[0]?.name ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<BoqItem | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [visibleSection, setVisibleSection] = useState<string>("__all__");
  const [customSectionOpen, setCustomSectionOpen] = useState(false);
  const [customSectionName, setCustomSectionName] = useState("");
  const [sending, setSending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  /**
   * Rows opened for inline editing, keyed by item id.
   *
   * Deliberately kept out of `snapshot` so autosave can't pick them up: edits
   * stay pending until "Save changes" commits every open row at once, and
   * "Cancel" drops the lot.
   */
  const [pendingEdits, setPendingEdits] = useState<Record<string, BoqItem>>({});
  const editCount = Object.keys(pendingEdits).length;

  const categories = useMemo(() => categoryList(rateEntries), [rateEntries]);

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
  // this tab until "Save changes" is pressed.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current || editCount > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editCount]);

  // What's moved since the client last approved — surfaced inline so nobody
  // edits approved scope without noticing it raises a change order.
  const diff = useMemo(
    () => diffSnapshots(snapshot, approvedSnapshot, CLIENT_VISIBLE_FIELDS),
    [snapshot, approvedSnapshot],
  );

  const setMeta = (changes: Partial<BoqMeta>) =>
    update((prev) => ({ ...prev, meta: { ...prev.meta, ...changes } }));

  const openForm = (sectionName: string) => {
    setActiveSection(sectionName);
    setFormOpen(true);
    setDraft(freshDraft(rateEntries, categories));
  };

  const closeForm = () => {
    setFormOpen(false);
    setDraft(null);
  };

  /** The entry form only ever adds; existing rows are edited in place below. */
  const confirmEntry = () => {
    if (!draft || !activeSection) return;
    if (!draft.desc.trim()) {
      toast("Add a description before saving this item");
      return;
    }
    const item: BoqItem = { ...draft, qty: computeQty(draft) };

    update((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.name === activeSection ? { ...section, items: [...section.items, item] } : section,
      ),
    }));

    toast("Item added");
    // Straight back to a blank form so the next item can be typed immediately.
    setDraft(freshDraft(rateEntries, categories));
  };

  // ------------------------------------------------------- inline row edits

  const startEdit = (item: BoqItem) => {
    setPendingEdits((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: structuredClone(item) }));
  };

  const changeEdit = (id: string, next: BoqItem) => {
    setPendingEdits((prev) => ({ ...prev, [id]: next }));
  };

  const discardEdit = (id: string) => {
    setPendingEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cancelAllEdits = () => {
    setPendingEdits({});
    toast("Edits discarded");
  };

  /** Commit a set of pending rows into the snapshot, which autosave then picks up. */
  const commitEdits = (ids: string[]) => {
    const committing = new Set(ids);
    if (committing.size === 0) return;

    update((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => ({
        ...section,
        items: section.items.map((row) => {
          if (!committing.has(row.id)) return row;
          const edited = pendingEdits[row.id];
          return edited ? { ...edited, qty: computeQty(edited) } : row;
        }),
      })),
    }));

    setPendingEdits((prev) => {
      const next = { ...prev };
      for (const id of committing) delete next[id];
      return next;
    });
  };

  const saveRowEdit = (id: string) => {
    commitEdits([id]);
    toast("Row saved");
  };

  const saveAllEdits = () => {
    if (editCount === 0) return;
    commitEdits(Object.keys(pendingEdits));
    toast(`${editCount} row${editCount === 1 ? "" : "s"} saved`);
  };

  const removeItem = (sectionName: string, id: string) => {
    update((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.name === sectionName ? { ...section, items: section.items.filter((r) => r.id !== id) } : section,
      ),
    }));
    discardEdit(id);
    toast("Item removed");
  };

  /**
   * Merge picked items from another project. Each one is re-keyed so it's a
   * copy, not a link — editing it here can never touch the source project.
   * Sections whose names already exist merge in; the rest are appended.
   */
  const importItems = (picked: { section: string; items: BoqItem[] }[]) => {
    let imported = 0;
    update((prev) => {
      const sections = prev.sections.map((section) => ({ ...section, items: [...section.items] }));

      for (const entry of picked) {
        const copies = entry.items.map((item) => ({
          ...structuredClone(item),
          id: `new:${Math.random().toString(36).slice(2, 11)}`,
        }));
        imported += copies.length;

        const existing = sections.find((section) => section.name === entry.section);
        if (existing) existing.items.push(...copies);
        else sections.push({ name: entry.section, items: copies });
      }

      return { ...prev, sections };
    });

    setImportOpen(false);
    setVisibleSection("__all__");
    toast(`Imported ${imported} item${imported === 1 ? "" : "s"}`);
  };

  const addSection = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (snapshot.sections.some((s) => s.name === clean)) {
      setActiveSection(clean);
      setVisibleSection("__all__");
      toast(`${clean} is already in this BOQ`);
      return;
    }
    update((prev) => ({ ...prev, sections: [...prev.sections, { name: clean, items: [] }] }));
    setActiveSection(clean);
    setVisibleSection("__all__");
    setFormOpen(true);
    setDraft(freshDraft(rateEntries, categories));
    toast("Section added");
  };

  const removeSection = (name: string) => {
    const section = snapshot.sections.find((s) => s.name === name);
    if (!section) return;
    if (section.items.length > 0 && !window.confirm(`Remove “${name}” and its ${section.items.length} item(s)?`)) {
      return;
    }
    update((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.name !== name) }));
    if (activeSection === name) {
      setActiveSection(snapshot.sections[0]?.name ?? null);
      closeForm();
    }
    toast("Section removed");
  };

  const sendToClient = async () => {
    setSending(true);
    try {
      await flush();
      const result = await saveVersion(projectId, "SENT_TO_CLIENT");
      if (!result.ok) {
        toast(result.error ?? "Could not save that version");
        return;
      }
      // Versioning bumps updatedAt server-side; adopt it or the next autosave
      // would see its own change as somebody else's.
      if (result.updatedAt) baseUpdatedAt.current = result.updatedAt;
      toast(`Saved as V${result.number} — sent to client`);
      router.push(`/projects/${projectId}/client-view`);
    } finally {
      setSending(false);
    }
  };

  const availableRooms = PRESET_ROOMS.filter((room) => !snapshot.sections.some((s) => s.name === room));

  const saveChip = {
    saved: "All changes saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Save failed — retrying",
    conflict: "Out of date — reload",
  }[saveState];

  return (
    <>
      <ProjectBar
        projectId={projectId}
        projectName={snapshot.meta.property || "Untitled project"}
        active="build"
        right={
          <>
            <span className={`saving-chip${saveState === "saved" ? "" : " dirty"}`}>{saveChip}</span>
            <label className="cost-toggle">
              <input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} /> Cost &amp;
              margin
            </label>
            <PdfButton
              snapshot={snapshot}
              letterhead={letterhead}
              mode="internal"
              label="Internal PDF"
              onError={toast}
            />
            <PdfButton
              snapshot={snapshot}
              letterhead={letterhead}
              mode="client"
              label="Client PDF"
              className="btn primary"
              onError={toast}
            />
          </>
        }
      />

      {saveState === "conflict" ? (
        <div className="conflict-banner">
          <span>
            <b>This page is out of date.</b> This BOQ has changed somewhere else — another tab, a teammate, or a
            restored version — so saving has stopped rather than overwrite it. Reload to pick up the current BOQ.
            {editCount > 0 ? " Your open row edits will be lost." : ""}
          </span>
          <button className="btn primary small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      ) : null}

      <div className={`layout${editCount > 0 ? " has-edit-bar" : ""}`}>
        <div className="main">
          <div className="build-context">
            <div className="bc-field">
              <label>Client</label>
              <input
                type="text"
                value={snapshot.meta.client}
                placeholder="Client name"
                onChange={(e) => setMeta({ client: e.target.value })}
              />
            </div>
            <div className="bc-field">
              <label>Property / project</label>
              <input
                type="text"
                value={snapshot.meta.property}
                placeholder="e.g. Heritage Firefly, 3BHK"
                onChange={(e) => setMeta({ property: e.target.value })}
              />
            </div>
            <div className="bc-field">
              <label>Prepared by</label>
              <input
                type="text"
                value={snapshot.meta.preparedBy}
                placeholder="e.g. Ridhi Bhinde"
                onChange={(e) => setMeta({ preparedBy: e.target.value })}
              />
            </div>
            <div className="bc-field" style={{ flex: "0 0 150px" }}>
              <label>Date</label>
              <input type="date" value={snapshot.meta.date} onChange={(e) => setMeta({ date: e.target.value })} />
            </div>
          </div>

          {/* A dropdown, not a tab strip — a 15-room project would overflow one
              (BOQ_BUILDER_V2_SPEC §6). */}
          <div className="section-jump">
            <select value={visibleSection} onChange={(e) => setVisibleSection(e.target.value)}>
              <option value="__all__">All sections ({snapshot.sections.length})</option>
              {snapshot.sections.map((section) => (
                <option key={section.name} value={section.name}>
                  {section.name} — {section.items.length} item{section.items.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <button className="btn light small" onClick={() => setImportOpen(true)}>
              ↧ Import from project
            </button>
            <span className="hint">
              {visibleSection === "__all__" ? "Showing every section" : "Showing one section — switch back any time"}
            </span>
            {approvedVersionNumber && (diff.added > 0 || diff.changed > 0 || diff.removed.length > 0) ? (
              <span className="co-flag" style={{ marginLeft: "auto" }}>
                {diff.added + diff.changed + diff.removed.length} change{diff.added + diff.changed + diff.removed.length === 1 ? "" : "s"} vs approved V
                {approvedVersionNumber}
              </span>
            ) : null}
          </div>

          <div>
            {snapshot.sections.map((section) => {
              const hidden = visibleSection !== "__all__" && visibleSection !== section.name;
              if (hidden) return null;
              const isOpen = formOpen && section.name === activeSection;

              return (
                <div className="sec-block" key={section.name}>
                  <div className="sec-head">
                    <span className="sec-name">{section.name}</span>
                    <span className="sec-count">
                      {section.items.length} item{section.items.length === 1 ? "" : "s"}
                    </span>
                    <span className="sec-total tabular">{fmt(sectionTotal(section))}</span>
                    <button
                      className={`btn ${isOpen ? "light" : "primary"} small`}
                      onClick={() => (isOpen ? closeForm() : openForm(section.name))}
                    >
                      {isOpen ? "✕ Close" : "＋ Add item"}
                    </button>
                    <button
                      className="icon-btn danger"
                      title={`Remove ${section.name}`}
                      onClick={() => removeSection(section.name)}
                    >
                      ✕
                    </button>
                  </div>

                  {isOpen && draft ? (
                    <EntryForm
                      draft={draft}
                      onChange={setDraft}
                      onConfirm={confirmEntry}
                      onCancel={closeForm}
                      sectionName={section.name}
                      entries={rateEntries}
                      categories={categories}
                      showCost={showCost}
                      onError={toast}
                    />
                  ) : null}

                  {section.items.length === 0 ? (
                    isOpen ? null : <div className="empty-sec">No items yet — click ＋ Add item.</div>
                  ) : (
                    <div className="compact-list">
                      <div className="compact-head">
                        <span className="cr-num" />
                        <span style={{ flex: 2 }}>Item</span>
                        <span style={{ flex: "0 0 160px", textAlign: "right" }}>Qty @ rate</span>
                        <span style={{ flex: "0 0 100px", textAlign: "right" }}>Amount</span>
                        <span style={{ flex: "0 0 56px" }} />
                      </div>

                      {section.items.map((item, index) => {
                        const entry = approvedSnapshot ? diff.byItem.get(item.id) : undefined;

                        return (
                          <InlineItemRow
                            key={item.id}
                            item={item}
                            draft={pendingEdits[item.id] ?? null}
                            index={index}
                            entries={rateEntries}
                            categories={categories}
                            showCost={showCost}
                            diffKind={entry?.kind ?? "unchanged"}
                            diffChanges={entry?.changes ?? []}
                            onStartEdit={() => startEdit(item)}
                            onChange={(next) => changeEdit(item.id, next)}
                            onSave={() => saveRowEdit(item.id)}
                            onDiscard={() => discardEdit(item.id)}
                            onRemove={() => removeItem(section.name, item.id)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="add-section-bar">
            <select
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                if (value === CUSTOM_CATEGORY) {
                  setCustomSectionOpen(true);
                  return;
                }
                setCustomSectionOpen(false);
                addSection(value);
              }}
            >
              <option value="">＋ Add section…</option>
              {availableRooms.length > 0 ? (
                <optgroup label="Rooms">
                  {availableRooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value={CUSTOM_CATEGORY}>Custom section…</option>
            </select>

            {customSectionOpen ? (
              <div className="custom-section-row show">
                <input
                  type="text"
                  autoFocus
                  placeholder="Section name"
                  value={customSectionName}
                  onChange={(e) => setCustomSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSection(customSectionName);
                      setCustomSectionName("");
                      setCustomSectionOpen(false);
                    }
                  }}
                />
                <button
                  className="btn light small"
                  onClick={() => {
                    addSection(customSectionName);
                    setCustomSectionName("");
                    setCustomSectionOpen(false);
                  }}
                >
                  Add
                </button>
              </div>
            ) : null}
          </div>

          <div className="continue-bar">
            <button
              className="btn primary"
              style={{ background: "var(--ink)", borderColor: "var(--ink)" }}
              onClick={() => void sendToClient()}
              disabled={sending}
            >
              {sending ? "Saving…" : "Save version & continue to Client View →"}
            </button>
          </div>
        </div>


        <SummaryPanel
          snapshot={snapshot}
          activeSection={activeSection}
          showCost={showCost}
          onMetaChange={setMeta}
          footer={
            <div className="pdf-buttons">
              <PdfButton
                snapshot={snapshot}
                letterhead={letterhead}
                mode="internal"
                label="Internal PDF"
                onError={toast}
              />
              <PdfButton
                snapshot={snapshot}
                letterhead={letterhead}
                mode="client"
                label="Client PDF"
                style={{
                  background: "var(--brass-bright)",
                  borderColor: "var(--brass-bright)",
                  color: "var(--ink)",
                  fontWeight: 600,
                }}
                onError={toast}
              />
            </div>
          }
        />
      </div>

      {/* Outside .layout on purpose: as a grid child spanning both columns it
          pushed the Summary panel out of its column and onto its own row. */}
      {editCount > 0 ? (
        <div className="edit-bar">
          <span className="edit-bar-count">
            {editCount} row{editCount === 1 ? "" : "s"} open for editing — not saved yet
          </span>
          <button className="btn light small" onClick={cancelAllEdits}>
            Discard all
          </button>
          <button className="btn primary small" onClick={saveAllEdits}>
            Save {editCount === 1 ? "row" : `all ${editCount} rows`}
          </button>
        </div>
      ) : null}

      {importOpen ? (
        <ImportFromProject
          currentProjectId={projectId}
          existingSections={snapshot.sections.map((section) => section.name)}
          onImport={importItems}
          onClose={() => setImportOpen(false)}
        />
      ) : null}

      <Toast message={message} />
    </>
  );
}
