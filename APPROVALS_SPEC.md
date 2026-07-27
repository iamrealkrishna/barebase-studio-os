# Client Approvals Module — Spec

## Why this, why now
This is the module right after BOQ in the "golden journey" every construction/
interiors platform (RDash included) is built around: **Recce → Design → BOQ →
Approvals/Orders → Progress → Snags → Finance**. BOQ is done. This is next.

Core idea, straight from how the category leader (RDash) does it, but simpler:
keep approvals at the **line-item level** of the BOQ itself, not a separate
sign-off document that drifts out of sync with the real scope.

## Who uses it
- **Barebase team** (internal): builds/edits the BOQ as today, then sends it
  for client review.
- **Client** (external, no Barebase login): gets a link to a read-only,
  client-friendly view of the BOQ and approves/rejects/comments — no account
  creation friction, ideally just an email-verified magic link per project.

## Core features

1. **Per-line-item approval status**
   Each BOQ line gets a status: `Pending Review → Approved → Rejected →
   Revision Requested`. Category and project-level rollups show % approved.

2. **Client review view**
   A simplified, branded (Barebase letterhead) read-only version of the
   Client PDF, but interactive in-browser: client can approve the whole BOQ
   in one click, or go line-by-line and approve/reject/comment individually.

3. **Change orders**
   When an *already-approved* line item changes (rate, qty, material, or a
   new item is added after approval), the system automatically creates a
   **Change Order** record: old value → new value, reason/note, and it
   resets that line to `Pending Review` — never silently overwrite an
   approved scope.

4. **Audit trail**
   Every approval, rejection, comment, and change order is timestamped and
   attributed (which client contact, which Barebase team member). Exportable
   as a PDF audit log — this is the thing that prevents "but I never agreed
   to that" disputes.

5. **Notifications**
   - Client gets notified (email) when a BOQ/change order is ready for their
     review.
   - Barebase team gets notified when a client approves, rejects, or
     comments.

## Data model implications (for the product-later path)
Since this may become multi-tenant later, build these concepts in now rather
than hardcoding Barebase:
- **Organization** (e.g. "Barebase") — owns rate cards, projects, team members.
- **Project** — belongs to an org, has one BOQ, one or more client contacts.
- **Client contact** — scoped to a single project, no access to anything
  else in the org (rate card, other projects, internal cost/margin data).
- **Roles within an org**: Admin (full access, rate card editing), Team
  Member (build BOQs, can't edit rate card), Client (read + approve only,
  scoped to their project, never sees Internal Cost/Margin view).

## What NOT to build yet
Don't build procurement, site progress, or finance modules now — those come
after approvals, once this is proven out. Keep this scoped to: BOQ →
client-facing approval flow → change orders → audit trail.

## Relationship to existing files
- Builds on the Next.js app already being built from `barebase-boq-tool.html`
  + `HANDOFF.md` in this repo.
- Reuses the existing rate card / BOQ data model — approvals are a layer on
  top of BOQ line items, not a separate document.
