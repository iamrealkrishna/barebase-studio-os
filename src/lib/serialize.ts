import type { LineItem, Project, Section } from "@prisma/client";

import type { BoqItem, BoqSnapshot } from "./boq";

export type ProjectWithBoq = Project & {
  sections: (Section & { items: LineItem[] })[];
};

function dimString(value: number | null): string {
  return value === null || value === undefined ? "" : String(value);
}

export function toBoqItem(row: LineItem): BoqItem {
  return {
    id: row.id,
    category: row.category,
    custom: row.isCustom,
    desc: row.name,
    material: row.material,
    finish: row.finish,
    unit: row.unit,
    rate: row.rate,
    cost: row.cost,
    dims: { l: dimString(row.dimL), b: dimString(row.dimB), h: dimString(row.dimH) },
    qty: row.qty,
    qtyOverride: row.qtyOverride,
    description: row.scope,
    note: row.note,
    image: row.image,
  };
}

/** Live project rows -> the canonical snapshot shape used everywhere else. */
export function toSnapshot(project: ProjectWithBoq): BoqSnapshot {
  return {
    meta: {
      client: project.clientName,
      property: project.name,
      preparedBy: project.preparedBy,
      date: project.quoteDate,
      terms: project.terms,
      discountType: project.discountType === "amt" ? "amt" : "pct",
      discountValue: project.discountValue,
      gstOn: project.gstOn,
      gstRate: project.gstRate,
      cols: {
        material: project.colMaterial,
        finish: project.colFinish,
        qty: project.colQty,
        rate: project.colRate,
      },
    },
    sections: [...project.sections]
      .sort((a, b) => a.position - b.position)
      .map((section) => ({
        name: section.name,
        items: [...section.items].sort((a, b) => a.position - b.position).map(toBoqItem),
      })),
  };
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function optionalNum(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

/** Shape a client-submitted item into the columns LineItem expects. */
export function toLineItemData(item: BoqItem, position: number) {
  return {
    category: str(item.category),
    isCustom: Boolean(item.custom),
    name: str(item.desc),
    material: str(item.material),
    finish: str(item.finish),
    unit: str(item.unit),
    rate: num(item.rate),
    cost: num(item.cost),
    dimL: optionalNum(item.dims?.l),
    dimB: optionalNum(item.dims?.b),
    dimH: optionalNum(item.dims?.h),
    qty: num(item.qty),
    qtyOverride: Boolean(item.qtyOverride),
    scope: str(item.description),
    note: str(item.note),
    image: item.image ? str(item.image) : null,
    position,
  };
}

/**
 * Snapshots are stored as JSON, so anything read back is `unknown` as far as
 * TypeScript is concerned. Normalise it into a real BoqSnapshot, filling in
 * defaults for fields added after a snapshot was written.
 */
export function parseSnapshot(value: unknown): BoqSnapshot {
  const raw = (value ?? {}) as Record<string, unknown>;
  const meta = (raw.meta ?? {}) as Record<string, unknown>;
  const cols = (meta.cols ?? {}) as Record<string, unknown>;
  const sections = Array.isArray(raw.sections) ? raw.sections : [];

  return {
    meta: {
      client: str(meta.client),
      property: str(meta.property),
      preparedBy: str(meta.preparedBy),
      date: str(meta.date),
      terms: str(meta.terms),
      discountType: meta.discountType === "amt" ? "amt" : "pct",
      discountValue: num(meta.discountValue),
      gstOn: Boolean(meta.gstOn),
      gstRate: meta.gstRate === undefined ? 18 : num(meta.gstRate),
      cols: {
        material: cols.material !== false,
        finish: cols.finish !== false,
        // Snapshots written before this toggle became "qty" stored it as
        // "unit"; fall back so old versions still render as they were saved.
        qty: cols.qty !== undefined ? cols.qty !== false : cols.unit !== false,
        rate: cols.rate !== false,
      },
    },
    sections: sections.map((section) => {
      const sec = (section ?? {}) as Record<string, unknown>;
      const items = Array.isArray(sec.items) ? sec.items : [];
      return {
        name: str(sec.name),
        items: items.map((entry) => {
          const it = (entry ?? {}) as Record<string, unknown>;
          const dims = (it.dims ?? {}) as Record<string, unknown>;
          return {
            id: str(it.id),
            category: str(it.category),
            custom: Boolean(it.custom),
            desc: str(it.desc),
            material: str(it.material),
            finish: str(it.finish),
            unit: str(it.unit),
            rate: num(it.rate),
            cost: num(it.cost),
            dims: { l: str(dims.l), b: str(dims.b), h: str(dims.h) },
            qty: num(it.qty),
            qtyOverride: Boolean(it.qtyOverride),
            description: str(it.description),
            note: str(it.note),
            image: it.image ? str(it.image) : null,
          } satisfies BoqItem;
        }),
      };
    }),
  };
}
