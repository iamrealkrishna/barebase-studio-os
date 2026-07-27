# Barebase BOQ Builder

An internal tool for generating Bills of Quantities (BOQs) for Barebase
projects — pulls from a shared rate card, calculates line-item and category
totals, and exports both client-facing and internal cost-sheet PDFs.

## Status

🚧 **Design finalized, moving into the real build.** The visual/UX design
is done (Claude Design, "Warm Ledger" direction). Claude Code is building
this out as a real deployed Next.js app — see `HANDOFF.md`,
`APPROVALS_SPEC.md`, and `BOQ_BUILDER_V2_SPEC.md` for what's being built
and why.

## What it does

- Rate card of ~260 items across 17 categories (False Ceiling, Electrical,
  Plumbing, Civil & Infra, Demolition, Kitchen/Living Room/Dining/
  Bathroom/Bedroom/Wardrobe/Foyer/Puja/Utility furniture, Wall Paneling,
  Décor & Styling), with **Description → Material → Finish** cascading
  selection and **dimension-driven quantity** (Length×Breadth for SQFT,
  single length for RFT, etc.) so nobody's typing area calculations by
  hand.
- BOQs are organized by **section**: fixed sections first (Electrical
  Work, Wall Works, Other), then rooms (Living Room, Kitchen, etc.),
  added via a single dropdown with a Custom option for anything
  project-specific.
- A single reusable **entry form** — fill it in, hit Enter, it collapses
  into a compact row — instead of a page full of always-expanded item
  cards.
- **Version history** per project (Draft → Sent to Client → Approved),
  internal-only, with the ability to reopen any past version.
- A **Client View**: a clean, read-only page for the client with no cost/
  margin data and no version history — but items new or changed since
  the client's last Approved version are visually flagged, so they can
  see exactly what's different without digging through anything.
- Photo attachment per line item, editable per-project discount and GST
  (5/12/18/28/custom, split CGST/SGST), and a **Client PDF** / **Internal
  PDF** export — the client version omits cost/margin and adds a terms &
  exclusions page plus a reference-images appendix; the internal version
  adds full cost/margin breakdown.

Planned next (see `APPROVALS_SPEC.md` and `BOQ_BUILDER_V2_SPEC.md`):
client-facing approvals with change orders, and a passive "Compare Quote"
feature that lets the team see how Barebase's pricing stacks up against
competitor quotes clients share, at a line-item level.

## Files

| File | Purpose |
|---|---|
| `Barebase BOQ.dc.html` | Finished visual design (Claude Design, "Warm Ledger" direction) — the reference for the app's final look and feel. |
| `BOQ Redesign Directions.dc.html` | The three visual directions explored before landing on Warm Ledger — kept for reference. |
| `barebase-boq-tool.html` | Earlier working prototype — reference implementation for interaction logic (cascading dropdowns, rate card, PDF export, versioning, Client View diffing). |
| `HANDOFF.md` | What's built, what's missing, and the plan for the real deployed version (persistence, auth, PDF libs as npm deps). |
| `APPROVALS_SPEC.md` | Client approvals module spec — line-item approval status, change orders, audit trail. |
| `BOQ_BUILDER_V2_SPEC.md` | Full product spec from the structure/versioning/Compare Quote brainstorm — supersedes parts of the approvals spec with the section/room structure and versioning model. |
| `support.js` | Claude Design export support file. |
| `uploads/` | Supporting assets from the Claude Design export. |

## Using the design reference

`Barebase BOQ.dc.html` and `barebase-boq-tool.html` can both be opened
directly in a browser — no build step needed. Note: the working
prototype's shared rate card/project storage relies on Claude's artifact
storage, so it only persists when opened through a Claude artifact, not
as a standalone file. The Next.js rebuild replaces this with a real
backend, per `HANDOFF.md`.

## Roadmap

Real backend persistence and auth, org/project/client-contact data model,
status-driven internal versioning with client-relevant diff highlighting,
client approvals with change orders, Compare Quote, deployed to Vercel.
See the three spec docs for full detail.
