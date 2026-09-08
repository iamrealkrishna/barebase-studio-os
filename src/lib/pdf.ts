import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  computeQty,
  countSuffix,
  computeTotals,
  fmt,
  fmtPlain,
  sectionTotal,
  type BoqSnapshot,
} from "./boq";

export type Letterhead = {
  name: string;
  legalName: string;
  addressLine: string;
  pocName: string;
  pocPhone: string;
  pocEmail: string;
};

export type PdfMode = "client" | "internal";

/**
 * A jsPDF document with a Unicode-capable font registered.
 *
 * The built-in Helvetica is WinAnsi-encoded and has no ₹ — it rendered as a
 * stray superscript and, worse, miscounted string widths so right-aligned
 * subtotals ran off the page. The font module is imported dynamically so its
 * ~60 KB only loads when someone actually exports.
 */
export async function createPdfDoc(): Promise<jsPDF> {
  const { PDF_FONT_BOLD_BASE64, PDF_FONT_FAMILY, PDF_FONT_REGULAR_BASE64 } = await import("./pdf-font");
  const doc = new jsPDF("p", "pt", "a4");

  doc.addFileToVFS("DejaVuSans.ttf", PDF_FONT_REGULAR_BASE64);
  doc.addFont("DejaVuSans.ttf", PDF_FONT_FAMILY, "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", PDF_FONT_BOLD_BASE64);
  doc.addFont("DejaVuSans-Bold.ttf", PDF_FONT_FAMILY, "bold");
  // No oblique face in the subset — italic falls back to regular.
  doc.addFont("DejaVuSans.ttf", PDF_FONT_FAMILY, "italic");
  doc.setFont(PDF_FONT_FAMILY, "normal");

  return doc;
}

export const PDF_FONT = "DejaVuSans";

const INK: [number, number, number] = [33, 31, 26];
const INK_SOFT: [number, number, number] = [90, 85, 70];
const BRASS: [number, number, number] = [138, 107, 50];
const BRASS_DARK: [number, number, number] = [110, 83, 31];
const LINE: [number, number, number] = [214, 207, 187];
const CHIP: [number, number, number] = [239, 235, 224];
const GREEN: [number, number, number] = [70, 82, 65];

/** Page margin, and the gap kept between two columns sharing a baseline. */
const MARGIN = 40;
const GUTTER = 18;

/**
 * Trim a single line until it fits, with an ellipsis to show it was cut.
 *
 * The backstop behind `wrapLines`: a wrapper can only break on spaces, so one
 * unbroken token longer than the box — a pasted URL, a run-on address with no
 * spaces — comes back still too wide. Nothing downstream checks, so without
 * this it would just be drawn over whatever is next to it.
 */
function fitLine(doc: jsPDF, line: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (doc.getTextWidth(line) <= maxWidth) return line;
  let out = line;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** Wrap to a width, and guarantee every line returned actually fits it. */
function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines = doc.splitTextToSize(String(text ?? ""), maxWidth) as string[];
  return lines.map((line) => fitLine(doc, line, maxWidth));
}

/**
 * Draw a string inside a hard width limit and return the next free baseline.
 *
 * Every fixed-position string in this document goes through here. jsPDF's
 * `doc.text()` draws one line wherever it is told, however wide it turns out to
 * be, so any value the team can type — a client name, a property address — will
 * eventually run off the page or straight through whatever shares its baseline.
 * That is exactly how a long property address came to be printed on top of the
 * quote date. Passing a width is the whole point: there is no call here that
 * knows its content is short enough, because none of them do.
 */
function drawText(
  doc: jsPDF,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    align?: "left" | "right";
    lineHeight: number;
    maxLines?: number;
  },
): number {
  const { x, y, maxWidth, align = "left", lineHeight, maxLines } = opts;
  const value = String(text ?? "");
  if (!value.trim()) return y;

  let lines = wrapLines(doc, value, maxWidth);
  if (maxLines && lines.length > maxLines) {
    // Keep the header a header: an essay in the property field must not push
    // the table off the page.
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = fitLine(doc, `${lines[maxLines - 1]} …`, maxWidth);
  }

  let cursor = y;
  for (const line of lines) {
    doc.text(line, x, cursor, align === "right" ? { align: "right" } : undefined);
    cursor += lineHeight;
  }
  return cursor;
}

/**
 * One row of the totals block: label on the left, amount on the right, sharing a
 * baseline inside a fixed box.
 *
 * The amount is measured first and the label gets whatever is left. A big enough
 * figure — or a longer label in another language — would otherwise meet the
 * amount in the middle, which is the same collision the header used to have.
 */
function summaryRow(
  doc: jsPDF,
  label: string,
  amount: string,
  opts: { left: number; right: number; y: number },
): void {
  const { left, right, y } = opts;
  const amountWidth = doc.getTextWidth(amount);
  doc.text(fitLine(doc, label, right - left - amountWidth - 10), left, y);
  doc.text(amount, right, y, { align: "right" });
}

function header(doc: jsPDF, title: string, snapshot: BoqSnapshot, letterhead: Letterhead): number {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN * 2;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  let y = drawText(doc, letterhead.name.toUpperCase(), {
    x: MARGIN,
    y: 46,
    maxWidth: usable,
    lineHeight: 18,
    maxLines: 2,
  });

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_SOFT);
  if (letterhead.addressLine) {
    y = drawText(doc, letterhead.addressLine, { x: MARGIN, y: y + 0, maxWidth: usable, lineHeight: 12 });
  }
  const poc = [
    letterhead.pocName ? `POC: ${letterhead.pocName}` : "",
    letterhead.pocPhone,
    letterhead.pocEmail,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (poc) y = drawText(doc, poc, { x: MARGIN, y, maxWidth: usable, lineHeight: 12 });

  const ruleY = y + 2;
  doc.setDrawColor(...BRASS);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, ruleY, pageW - MARGIN, ruleY);

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...INK);
  const titleY = ruleY + 20;
  doc.text(fitLine(doc, title, usable), MARGIN, titleY);

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50, 48, 42);

  /**
   * Two independent columns rather than four strings on two shared baselines.
   *
   * The right column is measured first and only takes the width it needs, up to
   * a cap; the left column gets whatever is left. Either side can then wrap
   * downward on its own without ever reaching into the other — which is what
   * the fixed positions here used to allow.
   */
  const rightLines = [
    `Prepared by: ${snapshot.meta.preparedBy || "—"}`,
    `Date: ${snapshot.meta.date || "—"}`,
  ];
  const rightWidth = Math.min(
    usable * 0.45,
    Math.max(...rightLines.map((line) => doc.getTextWidth(line))),
  );
  const leftWidth = usable - rightWidth - GUTTER;

  const metaY = titleY + 16;
  let leftY = metaY;
  leftY = drawText(doc, `Client: ${snapshot.meta.client || "—"}`, {
    x: MARGIN,
    y: leftY,
    maxWidth: leftWidth,
    lineHeight: 12,
    maxLines: 2,
  });
  leftY = drawText(doc, `Property: ${snapshot.meta.property || "—"}`, {
    x: MARGIN,
    y: leftY,
    maxWidth: leftWidth,
    lineHeight: 12,
    maxLines: 3,
  });

  let rightY = metaY;
  for (const line of rightLines) {
    rightY = drawText(doc, line, {
      x: pageW - MARGIN,
      y: rightY,
      maxWidth: rightWidth,
      align: "right",
      lineHeight: 12,
      maxLines: 2,
    });
  }

  return Math.max(leftY, rightY) + 6;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 50) {
    doc.addPage();
    return 50;
  }
  return y;
}

/**
 * Client PDF: full line-item detail, no cost or margin anywhere, plus the
 * terms & exclusions block and a reference-image appendix.
 * Internal PDF: the same table with Cost and Margin columns and a margin
 * summary. Layout ported from the prototype so the output the team already
 * sends stays recognisable.
 */
export async function buildBoqPdf(
  snapshot: BoqSnapshot,
  letterhead: Letterhead,
  mode: PdfMode,
): Promise<jsPDF> {
  const doc = await createPdfDoc();
  const pageW = doc.internal.pageSize.getWidth();
  const cols = snapshot.meta.cols;
  const internal = mode === "internal";

  let y = header(doc, internal ? "INTERNAL COST SHEET" : "TENTATIVE ESTIMATE", snapshot, letterhead);
  let slNo = 1;
  const scopeNotes: { section: string; desc: string; text: string }[] = [];

  // Numbered over the sections that actually print, so an empty Wall Works
  // section doesn't leave the client reading "1." followed by "4.".
  let sectionNo = 0;

  snapshot.sections.forEach((section) => {
    if (section.items.length === 0) return;
    sectionNo++;

    y = ensureSpace(doc, y, 40);
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...BRASS_DARK);
    doc.text(`${sectionNo}. ${section.name.toUpperCase()}`, 40, y);
    y += 6;

    // Unit rides with Qty: "SQFT" on its own, with no quantity beside it, tells
    // a client nothing, so one toggle governs the pair.
    const head = [
      [
        "Sl",
        "Description",
        ...(cols.material ? ["Material"] : []),
        ...(cols.finish ? ["Finish"] : []),
        ...(cols.qty ? ["Unit", "Qty"] : []),
        ...(cols.rate ? ["Rate"] : []),
        ...(internal ? ["Cost"] : []),
        "Amount",
        ...(internal ? ["Margin"] : []),
      ],
    ];

    const body = section.items.map((item) => {
      const qty = computeQty(item);
      const amount = qty * (item.rate || 0);
      const margin = amount - qty * (item.cost || 0);
      if (item.description.trim()) {
        scopeNotes.push({
          section: section.name,
          desc: item.desc || "(custom item)",
          text: item.description.trim(),
        });
      }
      // The quantity column already carries the billed total, but "96 SQFT"
      // alone doesn't say it covers two wardrobes. There's no room for a column
      // of its own on a quote this wide, so it rides with the description —
      // which also means it survives the client having the Qty column hidden.
      return [
        String(slNo++),
        item.desc + countSuffix(item),
        ...(cols.material ? [item.material] : []),
        ...(cols.finish ? [item.finish] : []),
        ...(cols.qty ? [item.unit, String(qty || 0)] : []),
        ...(cols.rate ? [fmtPlain(item.rate || 0)] : []),
        ...(internal ? [fmtPlain(item.cost || 0)] : []),
        fmtPlain(amount),
        ...(internal ? [fmtPlain(margin)] : []),
      ];
    });

    // Right-align every numeric column; which index that is depends on which
    // optional columns the project has switched on.
    let index = 2;
    const numeric: number[] = [];
    if (cols.material) index++;
    if (cols.finish) index++;
    if (cols.qty) {
      index++; // Unit — left-aligned, like the other text columns.
      numeric.push(index++); // Qty
    }
    if (cols.rate) numeric.push(index++);
    if (internal) numeric.push(index++);
    numeric.push(index++);
    if (internal) numeric.push(index++);

    const columnStyles: Record<number, { cellWidth?: number; halign?: "right" }> = { 0: { cellWidth: 20 } };
    for (const i of numeric) columnStyles[i] = { halign: "right" };

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      styles: { font: PDF_FONT, fontSize: 8, cellPadding: 4, textColor: INK, lineColor: LINE },
      headStyles: { font: PDF_FONT, fillColor: CHIP, textColor: [90, 85, 74], fontStyle: "bold" },
      columnStyles,
      margin: { left: 40, right: 40 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont(PDF_FONT, "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_SOFT);
    doc.text(
      fitLine(doc, `${section.name} subtotal: ${fmt(sectionTotal(section))}`, pageW - MARGIN * 2),
      pageW - MARGIN,
      y,
      { align: "right" },
    );
    y += 18;
  });

  const totals = computeTotals(snapshot);
  y = ensureSpace(doc, y, 130);
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(pageW - 260, y, pageW - MARGIN, y);
  y += 16;

  const sumLeft = pageW - 260;
  const sumRight = pageW - MARGIN;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50, 48, 42);
  summaryRow(doc, "Subtotal", fmt(totals.subtotal), { left: sumLeft, right: sumRight, y });
  y += 15;

  if (totals.discountAmount > 0) {
    summaryRow(doc, "Discount", "−" + fmt(totals.discountAmount), { left: sumLeft, right: sumRight, y });
    y += 15;
  }
  if (totals.gstOn) {
    summaryRow(doc, `CGST @ ${totals.gstRate / 2}%`, fmt(totals.cgst), { left: sumLeft, right: sumRight, y });
    y += 15;
    summaryRow(doc, `SGST @ ${totals.gstRate / 2}%`, fmt(totals.sgst), { left: sumLeft, right: sumRight, y });
    y += 15;
  }

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(11.5);
  summaryRow(doc, "Grand total", fmt(totals.grand), { left: sumLeft, right: sumRight, y: y + 4 });
  y += 26;

  if (internal) {
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GREEN);
    summaryRow(doc, "Internal cost", fmt(totals.totalCost), { left: sumLeft, right: sumRight, y });
    y += 15;
    doc.setFont(PDF_FONT, "bold");
    summaryRow(
      doc,
      "Margin",
      `${fmt(totals.margin)}  (${Math.round(totals.marginPct * 10) / 10}%)`,
      { left: sumLeft, right: sumRight, y },
    );
    y += 26;
  } else {
    const terms = snapshot.meta.terms;
    if (terms.trim()) {
      y = ensureSpace(doc, y, 90);
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text("NOTES", 40, y);
      y += 14;
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 76, 66);
      for (const line of wrapLines(doc, terms, pageW - MARGIN * 2)) {
        y = ensureSpace(doc, y, 14);
        doc.text(line, 40, y);
        y += 12;
      }
      y += 24;
    }
    y = ensureSpace(doc, y, 50);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(
      fitLine(doc, `For ${letterhead.legalName || letterhead.name}`, pageW - MARGIN * 2),
      pageW - MARGIN,
      y,
      { align: "right" },
    );
    doc.text("Authorised Signatory", pageW - MARGIN, y + 34, { align: "right" });
  }

  if (scopeNotes.length > 0) {
    doc.addPage();
    let ny = 50;
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text("SCOPE NOTES", 40, ny);
    ny += 22;

    let lastSection: string | null = null;
    for (const note of scopeNotes) {
      ny = ensureSpace(doc, ny, 40);
      if (note.section !== lastSection) {
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(10);
        doc.setTextColor(...BRASS_DARK);
        ny = drawText(doc, note.section.toUpperCase(), {
          x: MARGIN,
          y: ny,
          maxWidth: pageW - MARGIN * 2,
          lineHeight: 14,
        });
        lastSection = note.section;
      }
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      ny = drawText(doc, note.desc, {
        x: MARGIN,
        y: ny,
        maxWidth: pageW - MARGIN * 2,
        lineHeight: 11,
      });
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 76, 66);
      for (const line of wrapLines(doc, note.text, pageW - MARGIN * 2)) {
        ny = ensureSpace(doc, ny, 12);
        doc.text(line, 40, ny);
        ny += 11;
      }
      ny += 8;
    }
  }

  const withImages = snapshot.sections.flatMap((section) =>
    section.items.filter((item) => item.image).map((item) => ({ section: section.name, item })),
  );

  if (withImages.length > 0) {
    doc.addPage();
    let iy = 50;
    doc.setFont(PDF_FONT, "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text("REFERENCE IMAGES", 40, iy);
    iy += 20;

    const imgW = 140;
    const imgH = 105;
    const gap = 16;
    const perRow = 3;
    let col = 0;

    for (const { item } of withImages) {
      if (iy + imgH + 30 > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        iy = 50;
        col = 0;
      }
      const x = 40 + col * (imgW + gap);
      try {
        doc.addImage(item.image as string, "JPEG", x, iy, imgW, imgH);
      } catch {
        // A corrupt data URL shouldn't take the whole export down.
      }
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(70, 68, 60);
      const caption = [item.desc, item.material, item.finish].filter(Boolean).join(" · ");
      doc.text(wrapLines(doc, caption, imgW).slice(0, 2), x, iy + imgH + 11);
      col++;
      if (col >= perRow) {
        col = 0;
        iy += imgH + 40;
      }
    }
  }

  return doc;
}

export function boqPdfFilename(snapshot: BoqSnapshot, mode: PdfMode): string {
  const base = (snapshot.meta.property || snapshot.meta.client || "BOQ").replace(/\s+/g, "_");
  return `${base}_${mode === "client" ? "Client_Estimate" : "Internal_Cost_Sheet"}.pdf`;
}

export async function downloadBoqPdf(
  snapshot: BoqSnapshot,
  letterhead: Letterhead,
  mode: PdfMode,
): Promise<void> {
  const doc = await buildBoqPdf(snapshot, letterhead, mode);
  doc.save(boqPdfFilename(snapshot, mode));
}
