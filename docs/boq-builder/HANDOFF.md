# Barebase BOQ Builder — Handoff to Claude Code

## What this is
A working prototype (single HTML file, `barebase-boq-tool.html`) of a BOQ
automation tool for Barebase. Built and iterated in Claude chat as an
artifact. It's functional today, but "shared" persistence currently rides
on the claude.ai artifact `window.storage` API, which only works inside
that artifact viewer — not as a real, standalone, team-shareable app.

**Goal for this handoff:** turn it into a real deployed web app (Vercel,
matching how Krishna's other internal tools — e.g. the prompt generator —
have been deployed) with a proper backend, so the whole team can use it
from a normal URL without going through Claude chat.

## Current feature set (all working in the artifact today)
- Rate card organized by category: False Ceiling, Electrical Works,
  Plumbing Works, Civil & Infra Works, Demolition Work, Kitchen Furniture,
  Living Room Furniture, Dining Furniture, Bathroom Furniture, Beds,
  Wardrobes, Foyer Furniture, Puja Furniture, Utility Furniture,
  Other Furniture, Wall Paneling, Décor & Styling.
- Cascading Description → Material → Finish dropdowns per line item,
  auto-filling Rate (and an optional internal Cost) from the rate card.
- "Custom item" fallback for anything not in the rate card.
- Editable rate card in-app (add/edit/delete items and categories),
  meant to be shared team-wide.
- Discount (₹ or %), GST toggle with selectable rate (5/12/18/28/custom),
  split into CGST/SGST to match Barebase's invoice format.
- "Show cost & margin" toggle for an internal profitability view,
  hidden by default and never exposed to clients.
- Save/load named projects.
- Two PDF exports (via jsPDF + jspdf-autotable, loaded from cdnjs):
  - **Client PDF** — full line-item detail (desc/material/finish/qty/
    rate/amount), category subtotals, discount/GST breakdown, a standard
    terms & exclusions block (editable per project), signature line.
    No cost or margin data.
  - **Internal PDF** — same, plus Cost and Margin columns and a margin
    summary.

## Known limitations to fix in the real build
1. **Persistence**: `window.storage` (shared: true) is artifact-only.
   Needs a real backend — e.g. Vercel + a proper DB (Postgres/Supabase,
   or even a simple KV store) — so rate card + saved projects persist
   outside the Claude chat UI and support real concurrent multi-user
   editing (current shared storage is last-write-wins, no auth).
2. **No auth**: anyone with the link can edit the rate card today. The
   real app should gate editing (at minimum a shared team login; ideally
   role-based — e.g. only Ridhi/Mansi can approve BOQs per the existing
   approval hierarchy noted in team practice).
3. **Data-entry gaps from the source rate sheets** (carry these into the
   new rate card, don't silently fix them):
   - Wardrobes: several finish variants (duco/PU/membrane/glass on
     "with loft", and all "Hinged wardrobe" variants) have no rate in
     the source sheet — currently just omitted from the tool.
   - Beds, Puja back-panels, Dining table/chair: material and finish
     don't split cleanly in the source data, so these show the full
     spec text as "Finish" with "Material" blank.
4. **PDF export** currently loads jsPDF from a CDN at runtime — fine for
   an artifact, but for a real deployed app, install `jspdf` and
   `jspdf-autotable` as proper npm dependencies instead.
5. No image/branding upload — the Barebase letterhead (address, POC)
   is hardcoded in the PDF generator; consider making it configurable.

## Suggested stack (matching prior Barebase deployments)
- Next.js app, deployed to Vercel.
- Simple backend for rate card + projects: Vercel KV, Supabase, or
  even a Google Sheet as the source of truth if the team prefers
  staying spreadsheet-native (there's precedent — the rate card
  currently *is* sourced from Google Sheets).
- Keep the PDF generation client-side with jsPDF/jspdf-autotable as
  real npm packages.

## Files
- `barebase-boq-tool.html` — the current working prototype. Treat this
  as the reference implementation for behavior, not as code to deploy
  as-is; it's a single-file artifact, not a real app structure.
