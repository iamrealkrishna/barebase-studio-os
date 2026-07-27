# BOQ Builder v2 — Product Spec

This supersedes/extends `APPROVALS_SPEC.md` with a full session of product
decisions. Goal stated by Krishna: **build this fully for internal Barebase
use first**, validate it works end to end on real projects, and only then
consider it as a product for other studios.

Reference material reviewed while writing this spec:
- Barebase's actual production BOQ format (Google Sheet: room-based
  sections, L×H-driven quantities, Expected/True Cost columns).
- RDash's project → BOQ → proposal → approval flow (screenshots reviewed
  for what to borrow and what to do differently — not to be cloned).

---

## 1. BOQ structure (rebuild of the current flat-category tool)

**Move to a dedicated "Build BOQ" page**, separate from rate card
management and other settings. The current single-screen-does-everything
layout is the thing being fixed here.

**Section hierarchy**, matching Barebase's real sheet:
- Fixed sections always appear first, in order: **Electrical Work, Wall
  Works, Other**.
- After that, **room/space sections**: Living Room, Dining, Kitchen,
  Bedroom, Puja Room, Utility, etc.
- **"Add Section" is a dropdown**: predefined sections (fixed + common
  rooms) plus a **Custom** option where the user types a new section name
  for project-specific needs (e.g. a Terrace or Study that doesn't come
  up often).
- Within a section, items still use the existing cascading
  Description → Material → Finish → Rate/Cost logic (already built,
  keep as-is).

**Quantity by dimensions, not a flat number:**
- The unit (SQFT, RFT, Nos., Lumpsum, etc.) already on each rate-card item
  determines what dimension inputs appear:
  - **SQFT** → Length × Breadth
  - **RFT** → a single length dimension
  - Any **volume-based** unit → Length × Breadth × Height
  - **Nos. / Lumpsum** → no dimension inputs, just a plain quantity (as
    today)
- The dimension fields should adapt per-item based on its unit — this
  needs to be dynamic, not a fixed set of fields shown for everything.

**Description field** (replaces "Remarks"):
- Long-form, free-text scope-of-work description per line item — what
  Barebase's real sheet has as full paragraphs (e.g. "Supply and
  installation of 2.5sqm wire... looping to existing points..."). This is
  what a client reads to understand what they're getting, not an internal
  note.
- (The internal-note use case "Remarks" served — quick asides like
  "changed on site," "awaiting client confirmation" — should still have
  somewhere to live; consider keeping a short separate internal-only note
  field if that's needed. Confirm with Krishna before dropping it
  entirely — this session renamed rather than explicitly removed that
  use case.)

---

## 2. Client-facing web view

A shareable link (in addition to the existing PDF export) showing the
client their project's current scope and pricing, interactively, without
needing an account. This is the same underlying feature as the Approvals
module below — one implementation serves both "let the client review" and
"send them something to look at."

---

## 3. Client Approvals & Change Orders

(Extends `APPROVALS_SPEC.md` — read that file too for the original data
model: Organization / Project / Client Contact / roles.)

- Per-line-item approval status: `Pending Review → Approved → Rejected →
  Revision Requested`.
- Client reviews via the web view above — approve the whole BOQ or go
  line-by-line, with comments possible per line item.
- **When the Barebase team edits anything already approved, that edit
  becomes a new version** (see Versioning below) and gets pushed to the
  client for approval as the new current version.
- **Full audit trail (every version, every status transition, every
  change-order diff) is internal-only.** The client never sees version
  history or a change log.
- **What the client DOES see**: when a new version is sent to them for
  approval, the lines that differ from **the version that specific
  client last approved** are visually highlighted (added / removed /
  changed rate or finish, etc.) — so they see exactly what's new without
  needing the full history. This diff reference point must always be
  "vs. what this client last said yes to," not just "vs. the
  chronologically previous version" (the team may revise something
  internally more than once before it's ever shown to the client again).

---

## 4. Versioning (internal-only)

- **Status-driven, not manual snapshots.** A new version is created when
  the BOQ's status changes, not on every edit (avoids version-spam from
  minor internal tweaks).
- **One clear status per BOQ** — avoid RDash's pattern of two parallel
  status badges (Project Status + BOQ Status) sitting next to each other,
  which is confusing about which one governs what.
- States: **Draft → Sent to Client → Approved**, with any post-approval
  edit to an approved line auto-flagging a **Change Order** and creating
  a new pending version.
- Full history and **diff view between any two versions** — internal
  team can see exactly what changed, when, and by whom. This is
  genuinely useful for internal review even outside the client-facing
  diff highlighting in section 3.
- Client-facing visibility is intentionally limited to what's described
  in section 3 — this section (full history, diffs, audit trail) is
  Barebase-team-only.

---

## 5. Compare Quote (competitive intelligence)

- **Purpose**: passive, ongoing visibility into how Barebase's pricing
  compares to competitors' — not a live sales-pitch tool.
- **Flow**: a client (or team member on their behalf) uploads a
  competitor's PDF quote against a specific Barebase project/BOQ.
- **Matching**: auto-match first — read the competitor PDF and attempt to
  pair each of their line items to the corresponding Barebase BOQ line
  item, comparing price only (not scope).
  - Where auto-match can confidently pair a competitor line to one
    specific Barebase line → **line-item comparison**.
  - Where it can't (e.g. competitor bundles "Modular Kitchen —
    ₹3,50,000" as one line against Barebase's six separate kitchen line
    items) → **falls back to room/section-level comparison** (their
    Kitchen total vs. Barebase's Kitchen total), and this must be
    **flagged as a rollup**, not presented as if it were a clean
    line-item match.
  - Manual-assist as a fallback path if auto-match confidence is too low
    to trust even at the rollup level.
- **Output**: a **browsable log** for the internal Barebase team —
  individual comparisons they can look through. No automated
  trend-spotting/dashboarding in v1 (not enough data yet to make trends
  meaningful) — worth revisiting once enough comparisons have
  accumulated.
- **Audience**: Barebase team only, never client-facing.

---

## 6. UI/UX principles (lessons from reviewing RDash, to do better — not clone)

- **Room/section switcher should be a searchable dropdown or slide-out
  list, not a tab strip** — RDash's tab strip already needs overflow
  arrows at ~7 rooms; this doesn't scale to a project with 15+ rooms.
- **Avoid a search box on every single column** — too much visual noise
  for a form used daily by the team.
- **Default view should show individual line prices without extra
  clicks** — RDash requires expanding section → item-type → variant
  (three levels) before any price is visible. Consider collapsed-by-room
  but expanded-by-item-type as the default, so subtotals AND line prices
  are both visible without drilling in.
- **Comments on individual line items** (not just whole-BOQ comments) is
  a good pattern worth keeping — lets a client or teammate question one
  specific line without escalating to a full change order.
- **Different views for different audiences on the same underlying
  data** (client view vs. internal view) should be a first-class concept
  in the data model, not just "two PDF export buttons."

---

## Open item to confirm with Krishna before building
Whether a short **internal-only note** field is still needed alongside
the new long-form Description field, since "Remarks" (quick asides like
"changed on site," "alteration charges added") served a different purpose
than scope-of-work description and this session renamed rather than
explicitly resolved that.

## Relationship to existing files
- Builds on `barebase-boq-tool.html` (reference implementation for the
  cascading dropdown, rate card, PDF export logic already built) and
  `HANDOFF.md` (backend/auth/deployment gaps).
- Extends `APPROVALS_SPEC.md` — read both together; this file adds the
  section/room restructure, versioning model, and Compare Quote, and
  clarifies that all audit/version detail is internal-only.
