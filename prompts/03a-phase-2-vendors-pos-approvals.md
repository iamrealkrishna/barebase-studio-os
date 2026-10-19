# Prompt 03a · Phase 2a: Vendors, purchase orders and the approval engine

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 10, 12 and 19, UI spec section 4 (payment status machine) and
5.6 with its build notes.

Build:

1. **Vendor master** with PAN, GSTIN (state from its first two digits), encrypted bank details visible to Admin and
   Finance only, TDS section, status, documents, and the vendor ledger tab.
2. **Approval engine:** `ApprovalRule` with amount slabs and levels per item type (Settings › Approvals), `ApprovalStep`
   records, the rules in product spec section 12 (no self-approval, edit restarts at level 1, no bypass, no
   auto-approval), idempotent actions, daily reminder for items waiting over 48 hours.
3. **Approvals inbox** (UI spec 5.6): two panes, amount in words, money context, approval path, comments,
   keyboard shortcuts, next item opens after acting.
4. **Purchase orders** raised from main-version BOQ lines: order rate beside selling rate and margin for cost viewers,
   quantity and rate warnings, approval by slab, PO PDF (never shows selling rate or margin), revisions after first
   payment.

Done when: every acceptance check in product spec sections 10 and 12 passes, including through direct API calls.
