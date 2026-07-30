"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  commitRateCardImport,
  previewRateCardImport,
  type CommitResult,
  type ImportPlan,
} from "@/actions/rate-card-import";
import { Toast, useToast } from "@/components/Toast";
import { parseRateCardCsv, toRateCardCsv } from "@/lib/rate-card-csv";
import type { RateEntry } from "@/lib/rate-card";

const FIELD_LABEL: Record<string, string> = {
  category: "Category",
  name: "Description",
  material: "Material",
  finish: "Finish",
  unit: "Unit",
  rate: "Rate",
  cost: "Cost",
};

export default function RateCardBulkEdit({
  entries,
  orgName,
  dirty,
}: {
  entries: RateEntry[];
  orgName: string;
  dirty: boolean;
}) {
  const router = useRouter();
  const { message, toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<CommitResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const download = () => {
    const csv = toRateCardCsv(
      entries.map((entry) => ({
        // A row the admin hasn't saved yet has no real id — leave it blank so
        // re-importing treats it as new rather than pointing at nothing.
        id: entry.id.startsWith("new:") ? "" : entry.id,
        category: entry.category,
        name: entry.name,
        material: entry.material,
        finish: entry.finish,
        unit: entry.unit,
        rate: entry.rate,
        cost: entry.cost,
      })),
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${orgName.replace(/\s+/g, "_")}_Rate_Card_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("Rate card downloaded");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setParseError(null);
    setFileName(file.name);

    const text = await file.text();
    const parsed = parseRateCardCsv(text);
    if (!parsed.ok) {
      setParseError(parsed.error);
      setPlan(null);
      return;
    }
    if (parsed.rows.length === 0) {
      setParseError("That file has a header row but no data rows.");
      setPlan(null);
      return;
    }

    startTransition(async () => {
      try {
        setPlan(await previewRateCardImport(parsed.rows));
      } catch {
        setParseError("Could not read that file — check it's the downloaded format.");
        setPlan(null);
      }
    });
  };

  const confirm = () => {
    if (!plan) return;
    startTransition(async () => {
      const outcome = await commitRateCardImport(plan);
      setResult(outcome);
      setPlan(null);
      setFileName("");
      if (outcome.ok) {
        toast(`Applied — ${outcome.updated} updated, ${outcome.inserted} added`);
        router.refresh();
      } else {
        toast(outcome.error ?? "Import failed");
      }
    });
  };

  const cancel = () => {
    setPlan(null);
    setFileName("");
    setParseError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const nothingToDo = plan !== null && plan.updates.length === 0 && plan.inserts.length === 0;

  return (
    <div className="settings-section">
      <h3>
        Bulk edit <span className="note">— download the rate card, edit it in Excel, upload it back</span>
      </h3>

      <div className="cat-filter" style={{ marginBottom: 10 }}>
        <button className="btn light small" onClick={download} disabled={pending}>
          ↓ Download Rate Card
        </button>
        <button className="btn light small" onClick={() => fileInput.current?.click()} disabled={pending}>
          ↑ Upload Rate Card
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {pending ? <span className="hint-text" style={{ marginTop: 0 }}>Working…</span> : null}
      </div>

      {dirty ? (
        <div className="flash err">
          You have unsaved changes in the table above. Save them first — the download reflects what&apos;s on screen, but
          an upload is compared against what&apos;s actually stored.
        </div>
      ) : null}

      <p className="hint-text" style={{ marginTop: 0 }}>
        CSV, opens directly in Excel. Keep the header row — and keep the <b>Item ID</b> column, which is what lets
        you reword a Description without the importer losing track of the item. Rows carrying an ID are matched on
        it and can have any field edited; rows without one fall back to matching on{" "}
        <b>Category + Description + Material + Finish</b> and are treated as new if nothing matches. Nothing is
        written until you review and confirm the preview.
      </p>

      {parseError ? <div className="flash err">{parseError}</div> : null}

      {result ? (
        <div className={result.ok ? "flash ok" : "flash err"}>
          {result.ok ? (
            <>
              Import applied — <b>{result.updated}</b> item{result.updated === 1 ? "" : "s"} updated,{" "}
              <b>{result.inserted}</b> added.
              {result.conflicts.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <b>
                    {result.conflicts.length} row{result.conflicts.length === 1 ? "" : "s"} skipped
                  </b>{" "}
                  because the stored value had changed since the preview:
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {result.conflicts.map((conflict, i) => (
                      <li key={i}>
                        <b>{conflict.label}</b> — {conflict.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            result.error
          )}
        </div>
      ) : null}

      {plan ? (
        <div style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 6, padding: "16px 18px", background: "var(--card-soft)" }}>
          <h4 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif), serif", fontSize: 17, fontWeight: 400 }}>
            Preview — nothing has been saved yet
          </h4>
          <p className="hint-text" style={{ marginTop: 0, marginBottom: 14 }}>
            {fileName} · {plan.totalRows} data row{plan.totalRows === 1 ? "" : "s"} read ·{" "}
            <b>{plan.updates.length}</b> to update · <b>{plan.inserts.length}</b> to add · {plan.unchanged} unchanged ·{" "}
            <b>{plan.rejected.length}</b> skipped
          </p>

          {plan.updates.length > 0 ? (
            <>
              <div className="entry-form-label" style={{ color: "var(--brass-dark)" }}>
                {plan.updates.length} item{plan.updates.length === 1 ? "" : "s"} will be updated
              </div>
              <table className="mini-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>Line</th>
                    <th>Item</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.updates.map((update) => (
                    <tr key={`${update.itemId}-${update.line}`}>
                      <td className="tabular" style={{ color: "var(--muted)" }}>
                        {update.line}
                      </td>
                      <td>
                        <b>{update.name}</b>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {[update.category, update.material, update.finish].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td>
                        {update.changes.map((change) => (
                          <div className="co-change" key={change.field}>
                            <b>{FIELD_LABEL[change.field]}:</b> <span className="from">{change.from}</span> →{" "}
                            <span className="to">{change.to}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {plan.inserts.length > 0 ? (
            <>
              <div className="entry-form-label" style={{ color: "var(--green)" }}>
                {plan.inserts.length} new item{plan.inserts.length === 1 ? "" : "s"} will be added
              </div>
              <table className="mini-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>Line</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Material</th>
                    <th>Finish</th>
                    <th>Unit</th>
                    <th className="num">Rate</th>
                    <th className="num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.inserts.map((insert) => (
                    <tr key={insert.line}>
                      <td className="tabular" style={{ color: "var(--muted)" }}>
                        {insert.line}
                      </td>
                      <td>{insert.category}</td>
                      <td>
                        <b>{insert.name}</b>
                      </td>
                      <td>{insert.material || "—"}</td>
                      <td>{insert.finish || "—"}</td>
                      <td>{insert.unit || "—"}</td>
                      <td className="num">{insert.rate}</td>
                      <td className="num">{insert.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {plan.rejected.length > 0 ? (
            <>
              <div className="entry-form-label" style={{ color: "var(--danger)" }}>
                {plan.rejected.length} row{plan.rejected.length === 1 ? "" : "s"} skipped — the rest still import
              </div>
              <table className="mini-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={{ width: 46 }}>Line</th>
                    <th>Row</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rejected.map((row) => (
                    <tr key={`${row.line}-${row.reason}`}>
                      <td className="tabular" style={{ color: "var(--muted)" }}>
                        {row.line}
                      </td>
                      <td>{row.label}</td>
                      <td style={{ color: "var(--danger)" }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {nothingToDo ? (
            <div className="flash ok" style={{ marginBottom: 12 }}>
              Nothing to apply — everything in that file already matches the stored rate card.
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary small" onClick={confirm} disabled={pending || nothingToDo}>
              {pending
                ? "Applying…"
                : `Confirm — apply ${plan.updates.length} update${plan.updates.length === 1 ? "" : "s"} and ${plan.inserts.length} addition${plan.inserts.length === 1 ? "" : "s"}`}
            </button>
            <button className="btn light small" onClick={cancel} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <Toast message={message} />
    </div>
  );
}
