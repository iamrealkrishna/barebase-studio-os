# Barebase BOQ Builder

An internal tool for generating Bills of Quantities (BOQs) for Barebase
projects — pulls from a shared rate card, calculates line-item and category
totals, and exports both client-facing and internal cost-sheet PDFs.

## Status

🚧 **Prototype stage.** `barebase-boq-tool.html` is a working single-file
version (built as a Claude artifact) that demonstrates the full feature set.
It's being rebuilt as a proper deployed Next.js app — see `HANDOFF.md` for
the plan and known gaps.

## What it does

- Rate card organized by category (False Ceiling, Electrical, Plumbing,
  Civil & Infra, Demolition, Kitchen/Living Room/Dining/Bathroom/Bedroom/
  Wardrobe/Foyer/Puja/Utility furniture, Wall Paneling, Décor & Styling).
- Cascading **Description → Material → Finish** dropdowns per line item,
  auto-filling rate (and an internal cost, toggleable) from the rate card.
- Custom line items for anything outside the rate card.
- Discount (₹ or %) and GST (5/12/18/28/custom, split CGST/SGST).
- Save/load named projects; editable rate card shared across the team.
- Two PDF exports:
  - **Client PDF** — full line-item detail, category subtotals, discount/
    GST breakdown, standard terms & exclusions, signature line. No cost
    or margin data.
  - **Internal PDF** — same, plus cost and margin columns for internal use.

## Files

| File | Purpose |
|---|---|
| `barebase-boq-tool.html` | Working prototype — open directly in a browser. Reference implementation for all behavior. |
| `HANDOFF.md` | What's built, what's missing, and the plan for the real deployed version (persistence, auth, PDF libs as npm deps). |

## Using the prototype

Just open `barebase-boq-tool.html` in a browser — no build step needed.
Note: shared rate card/project storage in this version relies on Claude's
artifact storage, so it only persists when opened through a Claude
artifact, not as a standalone file. The Next.js rebuild replaces this with
a real backend.

## Roadmap

See `HANDOFF.md` for the full list. Short version: real backend
persistence, auth on rate-card editing, PDF generation via npm packages
instead of a CDN, deployed to Vercel.
