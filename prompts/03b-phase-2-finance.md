# Prompt 03b · Phase 2b: Project Finance and Org Finance

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 11 and 19, and UI spec 5.5 with its build notes. Match
`docs/ui/reference/05-project-finance.png`.

Build:

1. **Ledger:** one `LedgerEntry` table for every money movement (product spec 17); corrections only by reversing
   entries; approved entries locked.
2. **Vendor bills and payments:** bills against POs (or no PO) with GST and TDS; payment requests through the approval
   engine; payment entries only after the last approval.
3. **Client payments:** payment schedule from a template, stages linked to milestones, payment requests to the client,
   receipts (partial allowed).
4. **Expenses and claims:** the entry form with GST-inclusive and GST-exclusive modes, categories, bill photo above
   the threshold, fuel by km, duplicate warning, amount-in-words confirmation above ₹1,00,000.
5. **Project Finance tab:** Summary (cost-to-complete by room, three margins, alerts, drill-down to transactions),
   Client payments, Vendor payments, Expenses.
6. **Org Finance:** Submit claim, My claims, New entry (own entries only for non-admins), Pending reimbursements by
   person, All transactions, Dashboard by day, month, quarter and year, GST and TDS monthly export for the CA.
7. **Vendors & bills sub-tab** (product spec 11, UI spec 5.8): per-vendor ledger for the project with POs and bills, reconciling with the Summary tab.

Done when: every acceptance check in product spec section 11 passes; dashboard totals equal the ledger; the GST export
opens in Excel with correct CGST, SGST and IGST columns. After this phase, new projects
can start here while RDash finishes jobs already running.

**Also in this phase (added 18 Oct):** product spec 11B and UI spec 5.12 to 5.15: proforma creator, PO creator,
Sent & due tracker, and Billing due (proformas drafted from milestones, Create proforma on every milestone-linked
stage, never sent without a person pressing Send). Plus the company Finance tabs and project Finance tabs listed in
`docs/screens-and-journeys.md` (My claims, Pending reimbursements, All transactions, GST and TDS, Client payments,
Expenses) and the phone claim and phone approvals screens. Journeys 2, 4, 5 and 8 must pass end to end.
