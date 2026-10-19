# Prompt 02c · Phase 1c: BOQ builder, versions, client review and PDFs

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 8 and 19, UI spec sections 4 (BOQ flow and status machine) and
5.4 with its build notes. Match `docs/ui/reference/04-boq-builder.png` closely.

BOQ Studio (github.com/iamrealkrishna/barebase-boq-app) already implements much of this behaviour and has been used
by the team. If you have access, read its `src/lib/boq.ts`, `src/lib/pdf.ts`, `src/lib/versions.ts`,
`src/actions/approvals.ts` and `APPROVALS_SPEC.md`, and port the logic rather than reinventing it. Totals must match BOQ
Studio to the paisa for the same inputs.

Build, one PR per item:

1. **Data model migration** to Boq → Room → Line → Version (product spec 17), migrating existing minERP BOQs
   (categories become default room names). Include a rollback.
2. **Build screen:** room sections, inline line editing with keyboard support, item picker, custom lines, rate
   override marker, quantity from dimensions with override, count, scope text, internal note, photo, autosave with the
   saved indicator, sticky summary panel, discount, GST with CGST/SGST or IGST by client state, cost and margin for
   cost viewers, client-visible column toggles, editing lock.
3. **Versions:** status machine (draft → sent → approved / partly approved → superseded), immutable snapshots,
   compare two versions, main version.
4. **Send and client review:** send dialog, client link with emailed 6-digit code, per-line approve / request
   change / reject with comments, submit review, Client Review screen with inline editing, next version shows only
   changes.
5. **Change orders:** automatic on any change to an approved line, reason required, ₹ impact.
6. **PDFs:** client PDF and internal PDF as product spec section 8 describes (port BOQ Studio's layout).
7. **Import lines from another project; duplicate a project's BOQ.**

Done when: every acceptance check in product spec section 8 passes; the client PDF text contains no cost or note
data; a 60-line, 8-room BOQ edits without lag.
