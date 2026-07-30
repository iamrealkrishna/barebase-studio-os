"use client";

import { useEffect, useState, useTransition } from "react";

import { getProjectForImport, listImportableProjects, type ImportableProject } from "@/actions/project-copy";
import { computeQty, dimSummary, fmt, fmtDate, type BoqItem, type BoqSnapshot } from "@/lib/boq";

/**
 * Pull sections or individual lines out of another project.
 *
 * Everything selected is copied — the caller re-keys each item before merging —
 * so the two projects stay completely independent afterwards.
 */
export default function ImportFromProject({
  currentProjectId,
  existingSections,
  onImport,
  onClose,
}: {
  currentProjectId: string;
  existingSections: string[];
  onImport: (picked: { section: string; items: BoqItem[] }[]) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<ImportableProject[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [snapshot, setSnapshot] = useState<BoqSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        setProjects(await listImportableProjects(currentProjectId));
      } catch {
        setError("Could not load your other projects.");
        setProjects([]);
      }
    });
  }, [currentProjectId]);

  const loadSource = (id: string) => {
    setSourceId(id);
    setSnapshot(null);
    setSelected(new Set());
    if (!id) return;
    startTransition(async () => {
      try {
        const loaded = await getProjectForImport(id);
        setSnapshot(loaded);
        // Default to everything ticked — importing the lot is the common case.
        const all = new Set<string>();
        loaded?.sections.forEach((section) => section.items.forEach((item) => all.add(item.id)));
        setSelected(all);
      } catch {
        setError("Could not open that project.");
      }
    });
  };

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (sectionName: string) => {
    const section = snapshot?.sections.find((s) => s.name === sectionName);
    if (!section) return;
    const ids = section.items.map((item) => item.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const setAll = (on: boolean) => {
    if (!snapshot) return;
    if (!on) {
      setSelected(new Set());
      return;
    }
    const all = new Set<string>();
    snapshot.sections.forEach((section) => section.items.forEach((item) => all.add(item.id)));
    setSelected(all);
  };

  const doImport = () => {
    if (!snapshot) return;
    const picked = snapshot.sections
      .map((section) => ({
        section: section.name,
        items: section.items.filter((item) => selected.has(item.id)),
      }))
      .filter((entry) => entry.items.length > 0);
    onImport(picked);
  };

  const selectedCount = selected.size;
  const sourceProject = projects?.find((p) => p.id === sourceId);

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <h3>Import from another project</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error ? <div className="flash err">{error}</div> : null}

          <div className="item-field" style={{ marginBottom: 14 }}>
            <label>Project</label>
            <select value={sourceId} onChange={(e) => loadSource(e.target.value)} disabled={pending && !projects}>
              <option value="">
                {projects === null ? "Loading…" : projects.length === 0 ? "No other projects yet" : "Choose a project…"}
              </option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.clientName ? ` — ${project.clientName}` : ""} · {project.itemCount} item
                  {project.itemCount === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>

          {sourceProject ? (
            <p className="hint-text" style={{ marginTop: 0 }}>
              {sourceProject.sectionCount} section{sourceProject.sectionCount === 1 ? "" : "s"} ·{" "}
              <span className="tabular">{fmt(sourceProject.total)}</span> · last saved {fmtDate(sourceProject.updatedAt)}
            </p>
          ) : null}

          {pending && sourceId && !snapshot ? <div className="mini-empty">Loading that project…</div> : null}

          {snapshot ? (
            <>
              <div className="cat-filter" style={{ marginBottom: 8 }}>
                <button className="cv-mini-btn" onClick={() => setAll(true)}>
                  Select all
                </button>
                <button className="cv-mini-btn" onClick={() => setAll(false)}>
                  Clear
                </button>
                <span className="hint-text" style={{ marginTop: 0 }}>
                  {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
                </span>
              </div>

              {snapshot.sections.filter((s) => s.items.length > 0).length === 0 ? (
                <div className="mini-empty">That project has no line items yet.</div>
              ) : (
                snapshot.sections
                  .filter((section) => section.items.length > 0)
                  .map((section) => {
                    const ids = section.items.map((item) => item.id);
                    const allOn = ids.every((id) => selected.has(id));
                    const someOn = !allOn && ids.some((id) => selected.has(id));
                    const merges = existingSections.includes(section.name);

                    return (
                      <div className="import-section" key={section.name}>
                        <label className="import-section-head">
                          <input
                            type="checkbox"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = someOn;
                            }}
                            onChange={() => toggleSection(section.name)}
                          />
                          <span className="sec-name">{section.name}</span>
                          <span className="sec-count">
                            {section.items.length} item{section.items.length === 1 ? "" : "s"}
                          </span>
                          <span className="import-merge-note">
                            {merges ? "merges into your existing section" : "will be added as a new section"}
                          </span>
                        </label>

                        {section.items.map((item) => {
                          const qty = computeQty(item);
                          const dimText = dimSummary(item);
                          return (
                            <label className="import-item" key={item.id}>
                              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleItem(item.id)} />
                              <span className="import-item-desc">
                                <b>{item.desc || "(untitled item)"}</b>
                                <span className="sub-line">
                                  {[item.material, item.finish, dimText].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <span className="import-item-qty tabular">
                                {qty || 0} {item.unit}
                              </span>
                              <span className="import-item-amt tabular">{fmt(qty * (item.rate || 0))}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })
              )}
            </>
          ) : null}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn light small" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary small" disabled={selectedCount === 0} onClick={doImport}>
            Import {selectedCount} item{selectedCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
