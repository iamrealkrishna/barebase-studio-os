/**
 * Core BOQ domain logic.
 *
 * Deliberately dependency-free so the exact same maths runs in the builder UI,
 * the client-facing view, the PDF generator and on the server when a version
 * snapshot is written. The rules here are ported 1:1 from the prototype
 * ("barebase-boq-tool.html" / "Barebase BOQ.dc.html") — changing any of them
 * changes what the team quotes.
 */

export type Dim = "L" | "B" | "H";

export type BoqItem = {
  id: string;
  category: string;
  /** True when the item was typed in by hand instead of picked off the rate card. */
  custom: boolean;
  /** Short item name — "Description" in the cascading dropdowns. */
  desc: string;
  material: string;
  finish: string;
  unit: string;
  rate: number;
  /** Internal cost. Stripped before anything reaches a client. */
  cost: number;
  dims: { l: string; b: string; h: string };
  /** The quantity. Derived from dims unless `qtyOverride` is set. */
  qty: number;
  /**
   * True when someone typed a quantity over a dimension-driven unit. Dimensions
   * stop driving the total until they clear it or touch a dimension again.
   */
  qtyOverride: boolean;
  /** Long-form, client-facing scope of work. */
  description: string;
  /** Short internal aside. Never client-visible. */
  note: string;
  /** Compressed data URL. */
  image: string | null;
};

export type BoqSection = {
  name: string;
  items: BoqItem[];
};

export type BoqMeta = {
  client: string;
  property: string;
  preparedBy: string;
  date: string;
  terms: string;
  discountType: "pct" | "amt";
  discountValue: number;
  gstOn: boolean;
  gstRate: number;
  /** Which per-line details a client is allowed to see. `qty` covers the
   *  quantity and its unit together — a unit with no quantity says nothing. */
  cols: { material: boolean; finish: boolean; qty: boolean; rate: boolean };
};

/** Everything needed to render a BOQ, and exactly what a Version stores. */
export type BoqSnapshot = {
  meta: BoqMeta;
  sections: BoqSection[];
};

/** Category value stored for items typed in by hand rather than picked off the rate card. */
export const CUSTOM_CATEGORY = "__custom__";

/** Never show the raw sentinel in the UI. */
export function categoryLabel(category: string): string {
  return category === CUSTOM_CATEGORY ? "Custom item" : category;
}

export const FIXED_SECTIONS = ["Electrical Work", "Wall Works", "Other"];

export const PRESET_ROOMS = [
  "Living Room",
  "Dining",
  "Kitchen",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Kids Room",
  "Puja Room",
  "Foyer",
  "Utility",
  "Bathroom",
  "Balcony",
  "Study",
  "Terrace",
];

export const DEFAULT_TERMS =
  "Estimate consists of only the scope of work mentioned above. 3D renders and reference images may include decor elements used purely to illustrate design intent — only the items listed in this BOQ are part of the deliverable scope.\n\n" +
  "Not included: loose furniture, soft furnishings, kitchen appliances, organisers & accessories, decorative lighting not specified above, and any item not explicitly listed.\n\n" +
  "GST as applicable, extra.";

/**
 * The unit on the rate-card item decides which dimension inputs appear
 * (BOQ_BUILDER_V2_SPEC §1). Anything else — Nos., Lumpsum, Day, Person — takes
 * a plain typed quantity.
 */
export function dimsForUnit(unit: string | undefined): Dim[] {
  const u = (unit || "").trim().toUpperCase();
  if (u === "SQFT") return ["L", "B"];
  if (u === "RFT") return ["L"];
  if (u === "CFT") return ["L", "B", "H"];
  return [];
}

export function computeQty(item: Pick<BoqItem, "unit" | "dims" | "qty"> & { qtyOverride?: boolean }): number {
  // A typed quantity wins over the dimensions until it's cleared.
  if (item.qtyOverride) return item.qty || 0;
  const dims = dimsForUnit(item.unit);
  if (dims.length === 0) return item.qty || 0;
  const l = parseFloat(item.dims?.l ?? "") || 0;
  const b = parseFloat(item.dims?.b ?? "") || 0;
  const h = parseFloat(item.dims?.h ?? "") || 0;
  if (dims.length === 1) return l;
  if (dims.length === 2) return round2(l * b);
  return round2(l * b * h);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply a typed quantity.
 *
 * Clearing the box hands control back to the dimensions; typing anything else
 * pins the quantity until a dimension is edited (see `setDimension`).
 */
export function setTypedQty<T extends BoqItem>(item: T, raw: string): T {
  if (raw.trim() === "") {
    return { ...item, qty: 0, qtyOverride: false };
  }
  return { ...item, qty: parseFloat(raw) || 0, qtyOverride: dimsForUnit(item.unit).length > 0 };
}

/** Editing any dimension resumes L×B driving the quantity. */
export function setDimension<T extends BoqItem>(item: T, axis: "l" | "b" | "h", value: string): T {
  return { ...item, dims: { ...item.dims, [axis]: value }, qtyOverride: false };
}

export function itemAmount(item: BoqItem): number {
  return computeQty(item) * (item.rate || 0);
}

export function itemCost(item: BoqItem): number {
  return computeQty(item) * (item.cost || 0);
}

export function sectionTotal(section: BoqSection): number {
  return section.items.reduce((sum, r) => sum + itemAmount(r), 0);
}

export function sectionCost(section: BoqSection): number {
  return section.items.reduce((sum, r) => sum + itemCost(r), 0);
}

export type Totals = {
  subtotal: number;
  totalCost: number;
  discountAmount: number;
  afterDiscount: number;
  gstOn: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  gst: number;
  grand: number;
  margin: number;
  marginPct: number;
};

export function computeTotals(snapshot: BoqSnapshot): Totals {
  let subtotal = 0;
  let totalCost = 0;
  for (const sec of snapshot.sections) {
    subtotal += sectionTotal(sec);
    totalCost += sectionCost(sec);
  }
  const { discountType, discountValue, gstOn, gstRate } = snapshot.meta;
  const discountAmount =
    discountType === "pct" ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  // Split into CGST/SGST to match Barebase's invoice format.
  const cgst = gstOn ? (afterDiscount * ((gstRate || 0) / 2)) / 100 : 0;
  const sgst = cgst;
  const gst = cgst + sgst;
  const grand = afterDiscount + gst;
  const margin = afterDiscount - totalCost;
  const marginPct = afterDiscount > 0 ? (margin / afterDiscount) * 100 : 0;
  return {
    subtotal,
    totalCost,
    discountAmount,
    afterDiscount,
    gstOn,
    gstRate,
    cgst,
    sgst,
    gst,
    grand,
    margin,
    marginPct,
  };
}

export function countItems(snapshot: BoqSnapshot): number {
  return snapshot.sections.reduce((n, s) => n + s.items.length, 0);
}

// ------------------------------------------------------------------ formatting

export function fmt(n: number): string {
  return "₹" + (Math.round((n || 0) * 100) / 100).toLocaleString("en-IN");
}

/** Amount without the currency symbol — for PDF table cells. */
export function fmtPlain(n: number): string {
  return (Math.round((n || 0) * 100) / 100).toLocaleString("en-IN");
}

export function fmtSigned(n: number): string {
  return (n < 0 ? "−" : "") + fmt(Math.abs(n));
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function dimSummary(item: BoqItem): string {
  // With a typed quantity the dimensions no longer describe it, so showing
  // "10 × 12 ft · 150 SQFT" would just be a contradiction on the page.
  if (item.qtyOverride) return "";
  const dims = dimsForUnit(item.unit);
  if (dims.length === 3 && (item.dims.l || item.dims.b || item.dims.h)) {
    return `${item.dims.l || 0} × ${item.dims.b || 0} × ${item.dims.h || 0} ft`;
  }
  if (dims.length === 2 && (item.dims.l || item.dims.b)) {
    return `${item.dims.l || 0} × ${item.dims.b || 0} ft`;
  }
  if (dims.length === 1 && item.dims.l) return `${item.dims.l} ft`;
  return "";
}

// --------------------------------------------------------------------- diffing

export type DiffKind = "new" | "changed" | "unchanged";

/** Fields a client would care about — what drives the highlight in their view. */
export const CLIENT_VISIBLE_FIELDS = [
  "desc",
  "material",
  "finish",
  "unit",
  "rate",
  "qty",
  "description",
] as const;

export type FieldChange = { field: string; from: string; to: string };

const FIELD_LABELS: Record<string, string> = {
  desc: "Description",
  material: "Material",
  finish: "Finish",
  unit: "Unit",
  rate: "Rate",
  qty: "Quantity",
  description: "Scope of work",
  cost: "Internal cost",
  note: "Internal note",
  section: "Section",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

function comparableValue(item: BoqItem, field: string): string {
  if (field === "qty") return String(computeQty(item));
  if (field === "rate") return String(item.rate ?? 0);
  if (field === "cost") return String(item.cost ?? 0);
  return String((item as unknown as Record<string, unknown>)[field] ?? "");
}

export function diffFields(a: BoqItem, b: BoqItem, fields: readonly string[]): FieldChange[] {
  const out: FieldChange[] = [];
  for (const field of fields) {
    const from = comparableValue(a, field);
    const to = comparableValue(b, field);
    if (from !== to) out.push({ field, from, to });
  }
  return out;
}

export function indexItems(snapshot: BoqSnapshot | null | undefined): Map<string, { item: BoqItem; section: string }> {
  const map = new Map<string, { item: BoqItem; section: string }>();
  if (!snapshot) return map;
  for (const sec of snapshot.sections) {
    for (const item of sec.items) map.set(item.id, { item, section: sec.name });
  }
  return map;
}

export type SnapshotDiff = {
  /** id -> what changed, for items present in `current`. */
  byItem: Map<string, { kind: DiffKind; changes: FieldChange[] }>;
  /** Items that were in `base` but are gone from `current`. */
  removed: { item: BoqItem; section: string }[];
  added: number;
  changed: number;
};

/**
 * Diff `current` against `base`.
 *
 * For the client-facing view `base` is always the version *that client last
 * approved*, never simply the previous version — the team may revise something
 * internally several times before the client sees it again
 * (BOQ_BUILDER_V2_SPEC §3).
 */
export function diffSnapshots(
  current: BoqSnapshot,
  base: BoqSnapshot | null | undefined,
  fields: readonly string[] = CLIENT_VISIBLE_FIELDS,
): SnapshotDiff {
  const byItem = new Map<string, { kind: DiffKind; changes: FieldChange[] }>();
  const removed: { item: BoqItem; section: string }[] = [];
  let added = 0;
  let changed = 0;

  if (!base) {
    for (const sec of current.sections) {
      for (const item of sec.items) byItem.set(item.id, { kind: "unchanged", changes: [] });
    }
    return { byItem, removed, added, changed };
  }

  const baseIndex = indexItems(base);
  const seen = new Set<string>();

  for (const sec of current.sections) {
    for (const item of sec.items) {
      seen.add(item.id);
      const prev = baseIndex.get(item.id);
      if (!prev) {
        byItem.set(item.id, { kind: "new", changes: [] });
        added++;
        continue;
      }
      const changes = diffFields(prev.item, item, fields);
      if (prev.section !== sec.name) changes.push({ field: "section", from: prev.section, to: sec.name });
      if (changes.length > 0) {
        byItem.set(item.id, { kind: "changed", changes });
        changed++;
      } else {
        byItem.set(item.id, { kind: "unchanged", changes: [] });
      }
    }
  }

  for (const [id, entry] of baseIndex) {
    if (!seen.has(id)) removed.push(entry);
  }

  return { byItem, removed, added, changed };
}

// ------------------------------------------------------------ snapshot helpers

export function emptySnapshot(overrides: Partial<BoqMeta> = {}): BoqSnapshot {
  return {
    meta: {
      client: "",
      property: "",
      preparedBy: "",
      date: "",
      terms: DEFAULT_TERMS,
      discountType: "pct",
      discountValue: 0,
      gstOn: false,
      gstRate: 18,
      cols: { material: true, finish: true, qty: true, rate: true },
      ...overrides,
    },
    sections: FIXED_SECTIONS.map((name) => ({ name, items: [] })),
  };
}

/** Drop every internal-only field. Applied before a snapshot leaves for a client. */
export function toClientSnapshot(snapshot: BoqSnapshot): BoqSnapshot {
  return {
    meta: { ...snapshot.meta, cols: { ...snapshot.meta.cols } },
    sections: snapshot.sections.map((sec) => ({
      name: sec.name,
      items: sec.items.map((item) => ({ ...item, cost: 0, note: "" })),
    })),
  };
}

export function statusLabel(status: string): string {
  if (status === "SENT_TO_CLIENT") return "Sent to Client";
  if (status === "APPROVED") return "Approved";
  return "Draft";
}

export function statusClass(status: string): string {
  if (status === "APPROVED") return "approved";
  if (status === "SENT_TO_CLIENT") return "sent";
  return "draft";
}

export function approvalLabel(status: string): string {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "REVISION_REQUESTED") return "Revision requested";
  return "Pending review";
}
