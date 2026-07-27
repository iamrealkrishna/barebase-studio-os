"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { saveBoq, saveVersion } from "@/actions/projects";
import EntryForm, { CUSTOM_CATEGORY, freshDraft } from "@/components/EntryForm";
import { PdfButton } from "@/components/PdfButtons";
import ProjectBar from "@/components/ProjectBar";
import SummaryPanel from "@/components/SummaryPanel";
import { Toast, useToast } from "@/components/Toast";
import {
  CLIENT_VISIBLE_FIELDS,
  computeQty,
  diffSnapshots,
  dimSummary,
  fieldLabel,
  fmt,
  fmtPlain,
  PRESET_ROOMS,
  sectionTotal,
  type BoqItem,
  type BoqMeta,
  type BoqSnapshot,
} from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";
import { categoryList, type RateEntry } from "@/lib/rate-card";

type SaveState = "saved" | "dirty" | "saving" | "error";

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
  rateEntries,
  letterhead,
  approvedSnapshot,
  approvedVersionNumber,
}: {
  projectId: string;
  initialSnapshot: BoqSnapshot;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [visibleSection, setVisibleSection] = useState<string>("__all__");
  const [customSectionOpen, setCustomSectionOpen] = useState(false);
  const [customSectionName, setCustomSectionName] = useState("");
  const [sending, setSending] = useState(false);

  const categories = useMemo(() => categoryList(rateEntries), [rateEntries]);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const inFlight = useRef(false);
  const queued = useRef(false);

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
      const result = await saveBoq({ projectId, meta: current.meta, sections: current.sections });
      if (!result.ok) throw new Error("save rejected");
      savedRevision.current = at;
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

  // Debounced autosave. Typing a rate shouldn't cost a round trip per keystroke.
  // A failed save backs off and tries again rather than sitting there dead —
  // losing a section of typed items to a dropped connection is not acceptable.
  useEffect(() => {
    if (saveState !== "dirty" && saveState !== "error") return;
    const timer = setTimeout(() => void flush(), saveState === "error" ? 5000 : 900);
    return () => clearTimeout(timer);
  }, [saveState, snapshot, flush]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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
    setEditingId(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setDraft(null);
    setEditingId(null);
  };

  const confirmEntry = () => {
    if (!draft || !activeSection) return;
    if (!draft.desc.trim()) {
      toast("Add a description before saving this item");
      return;
    }
    const item: BoqItem = { ...draft, qty: computeQty(draft) };

    update((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => {
        if (section.name !== activeSection) return section;
        if (editingId) {
          return { ...section, items: section.items.map((row) => (row.id === editingId ? item : row)) };
        }
        return { ...section, items: [...section.items, item] };
      }),
    }));

    toast(editingId ? "Item updated" : "Item added");
    // Straight back to a blank form so the next item can be typed immediately.
    setDraft(freshDraft(rateEntries, categories));
    setEditingId(null);
  };

  const editItem = (sectionName: string, id: string) => {
    const item = snapshot.sections.find((s) => s.name === sectionName)?.items.find((r) => r.id === id);
    if (!item) return;
    setActiveSection(sectionName);
    setFormOpen(true);
    setDraft(structuredClone(item));
    setEditingId(id);
  };

  const removeItem = (sectionName: string, id: string) => {
    update((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.name === sectionName ? { ...section, items: section.items.filter((r) => r.id !== id) } : section,
      ),
    }));
    if (editingId === id) {
      setEditingId(null);
      setDraft(freshDraft(rateEntries, categories));
    }
    toast("Item removed");
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
    setEditingId(null);
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

      <div className="layout">
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
                      onCancel={editingId ? () => { setEditingId(null); setDraft(freshDraft(rateEntries, categories)); } : closeForm}
                      editing={Boolean(editingId)}
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
                        const qty = computeQty(item);
                        const amount = qty * (item.rate || 0);
                        const spec = [item.material, item.finish].filter(Boolean).join(" · ");
                        const dimText = dimSummary(item);
                        const entry = approvedSnapshot ? diff.byItem.get(item.id) : undefined;
                        const kind = entry?.kind ?? "unchanged";

                        return (
                          <div
                            className={`compact-row${kind === "new" ? " is-new" : kind === "changed" ? " is-changed" : ""}`}
                            key={item.id}
                          >
                            <span className="cr-num">{String(index + 1).padStart(2, "0")}</span>
                            <div className="cr-desc">
                              <div className="main-line">
                                {item.desc || "(untitled item)"}
                                {item.image ? <span className="photo-chip">photo</span> : null}
                                {kind === "new" ? <span className="co-flag">New since approval</span> : null}
                                {kind === "changed" ? (
                                  <span
                                    className="co-flag"
                                    title={entry?.changes
                                      .map((c) => `${fieldLabel(c.field)}: ${c.from || "—"} → ${c.to || "—"}`)
                                      .join("\n")}
                                  >
                                    Change order
                                  </span>
                                ) : null}
                              </div>
                              <div className="sub-line">
                                {[spec, dimText].filter(Boolean).join(" · ")}
                                {item.note ? ` · note: ${item.note}` : ""}
                              </div>
                            </div>
                            <div className="cr-qty">
                              {qty || 0} {item.unit} @ {fmtPlain(item.rate || 0)}
                            </div>
                            <div className="cr-amt">{fmt(amount)}</div>
                            <div className="cr-actions">
                              <button
                                className="icon-btn"
                                title="Edit"
                                onClick={() => editItem(section.name, item.id)}
                              >
                                ✎
                              </button>
                              <button
                                className="icon-btn danger"
                                title="Remove"
                                onClick={() => removeItem(section.name, item.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
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

      <Toast message={message} />
    </>
  );
}
