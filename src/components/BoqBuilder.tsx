"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { saveVersion } from "@/actions/projects";
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
  type BoqSnapshot,
} from "@/lib/boq";
import type { Letterhead } from "@/lib/pdf";
import { categoryList, type RateEntry } from "@/lib/rate-card";
import { useBoqEditor } from "@/lib/use-boq-editor";

export default function BoqBuilder({
  projectId,
  initialSnapshot,
  initialUpdatedAt,
  rateEntries,
  letterhead,
  approvedSnapshot,
  approvedVersionNumber,
  canSeeCost,
  reviewFlag,
}: {
  projectId: string;
  initialSnapshot: BoqSnapshot;
  initialUpdatedAt: string;
  rateEntries: RateEntry[];
  letterhead: Letterhead;
  approvedSnapshot: BoqSnapshot | null;
  approvedVersionNumber: number | null;
  /**
   * Admins only. Internal cost and margin — and the Internal PDF that prints
   * them — are hidden from team members. The server does the real enforcing:
   * a member's snapshot and rate card arrive with cost zeroed, and `saveBoq`
   * ignores whatever cost a member's browser sends back.
   */
  canSeeCost: boolean;
  /** Lines the client flagged — badges the Client Review tab. */
  reviewFlag: number;
}) {
  const router = useRouter();
  const { message, toast } = useToast();

  const [activeSection, setActiveSection] = useState<string | null>(initialSnapshot.sections[0]?.name ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<BoqItem | null>(null);
  const [costOn, setCostOn] = useState(false);
  const showCost = canSeeCost && costOn;
  const [visibleSection, setVisibleSection] = useState<string>("__all__");
  const [customSectionOpen, setCustomSectionOpen] = useState(false);
  const [customSectionName, setCustomSectionName] = useState("");
  const [sending, setSending] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const categories = useMemo(() => categoryList(rateEntries), [rateEntries]);

  // Snapshot, autosave and inline row editing all live in the shared hook, so
  // the Client Review screen edits this same BOQ through the same path.
  const {
    snapshot,
    update,
    setMeta,
    flush,
    saveState,
    saveChip,
    adoptUpdatedAt,
    pendingEdits,
    editCount,
    startEdit,
    changeEdit,
    discardEdit,
    cancelAllEdits,
    saveRowEdit,
    saveAllEdits,
    removeItem,
  } = useBoqEditor({ projectId, initialSnapshot, initialUpdatedAt });

  // What's moved since the client last approved — surfaced inline so nobody
  // edits approved scope without noticing it raises a change order.
  const diff = useMemo(
    () => diffSnapshots(snapshot, approvedSnapshot, CLIENT_VISIBLE_FIELDS),
    [snapshot, approvedSnapshot],
  );

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

  // Inline row edits come from the hook; these add the screen's own feedback.
  const discardAll = () => {
    cancelAllEdits();
    toast("Edits discarded");
  };

  const saveRow = (id: string) => {
    saveRowEdit(id);
    toast("Row saved");
  };

  const saveAll = () => {
    if (editCount === 0) return;
    saveAllEdits();
    toast(`${editCount} row${editCount === 1 ? "" : "s"} saved`);
  };

  const deleteItem = (sectionName: string, id: string) => {
    removeItem(sectionName, id);
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
      if (result.updatedAt) adoptUpdatedAt(result.updatedAt);
      toast(`Saved as V${result.number} — sent to client`);
      router.push(`/projects/${projectId}/client-view`);
    } finally {
      setSending(false);
    }
  };

  const availableRooms = PRESET_ROOMS.filter((room) => !snapshot.sections.some((s) => s.name === room));

  return (
    <>
      <ProjectBar
        projectId={projectId}
        projectName={snapshot.meta.property || "Untitled project"}
        active="build"
        reviewFlag={reviewFlag}
        right={
          <>
            <span className={`saving-chip${saveState === "saved" ? "" : " dirty"}`}>{saveChip}</span>
            {/* Cost, margin and the Internal PDF that prints them are admin-only.
                A member never gets the numbers, so there's nothing to toggle. */}
            {canSeeCost ? (
              <>
                <label className="cost-toggle">
                  <input type="checkbox" checked={costOn} onChange={(e) => setCostOn(e.target.checked)} /> Cost &amp;
                  margin
                </label>
                <PdfButton
                  snapshot={snapshot}
                  letterhead={letterhead}
                  mode="internal"
                  label="Internal PDF"
                  onError={toast}
                />
              </>
            ) : null}
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
                            onSave={() => saveRow(item.id)}
                            onDiscard={() => discardEdit(item.id)}
                            onRemove={() => deleteItem(section.name, item.id)}
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
              {canSeeCost ? (
                <PdfButton
                  snapshot={snapshot}
                  letterhead={letterhead}
                  mode="internal"
                  label="Internal PDF"
                  onError={toast}
                />
              ) : null}
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
          <button className="btn light small" onClick={discardAll}>
            Discard all
          </button>
          <button className="btn primary small" onClick={saveAll}>
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
