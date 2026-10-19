# Screens and journeys

Every screen in Barebase Studio OS, with its route, who uses it and what it does, plus the ten end-to-end journeys that join them.
Each screen has a full-page mock-up in `docs/ui/screens/<Name>.png` and its source in `docs/ui/mockup-source/<Name>.dc.html` (read-only reference for layout, copy and sample data; it needs the design-canvas runtime to render, so use the PNG to look at it).

Sample data across all mock-ups is the same world: project **Villa Prakruthi** (client R. Iyengar, contract ₹8,34,675 excl. GST, BOQ v3), plus Hebbal Business Loft, Ashvin Court and Terrace Residency. Seed data should match it so screenshots can be compared with the mock-ups.

Where this file and the product or UI spec disagree, the specs win for fields, rules and permissions; this file wins for which screens exist and how they connect. "Phase" is the build phase from product spec section 22.

## Sign in and global

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Sign in** | `/login` | Everyone | Email and password, "email me a sign-in link", forgot password, link for clients to their portal. 5 wrong tries locks 15 min. | PS 21 | 0 | [Login.png](ui/screens/Login.png) |
| **Home** | `/` | Everyone (content by role) | Greeting, stat cards, recent projects, leads pipeline, finance snapshot, team load, activity, "Waiting on you". New lead / New project. | PS 16 · UI 5.1 | 5 | [Main.png](ui/screens/Main.png) |
| **Insights** | `/insights` | Admin, COO, Finance | Company summary: contract value, collected, billed-unpaid, unbilled, vendor payables, gross margin; cash in vs out by month; billed-unpaid by age; who owes us and whom we owe; project health table. | PS 16 (new screen) | 5 | [Insights.png](ui/screens/Insights.png) |
| **Notifications** | `/notifications` | Everyone | Same list as the bell, grouped Today / This week; every row opens the exact item. Overdue items also go by email at 9 am. | PS 16 | 5 | [Notifications.png](ui/screens/Notifications.png) |
| **Approvals inbox** | `/approvals` | Approvers | Waiting items list + detail with PO/budget/paid/after/budget-left, approval path, Approve / Hold / Reject (Hold and Reject need a note). Reached from "n to approve" in the top bar, not the sidebar. | PS 12 · UI 5.6 | 2 | [Approvals.png](ui/screens/Approvals.png) |
| **Approvals (phone)** | `/approvals (phone layout)` | Approvers on the move | Card per item with Approve / Send back. Opened from a WhatsApp link, no app. | PS 12 | 2 | [PhoneApprovals.png](ui/screens/PhoneApprovals.png) |

## Leads

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Leads board** | `/leads` | Pre-sales | Kanban New → Contacted → Site visit booked → Proposal sent → Won / Lost. Response timers amber at 30 min, red at 2 h. Every card opens the lead. | PS 15 | 4 | [Leads.png](ui/screens/Leads.png) |
| **Lead detail** | `/leads/[id]` | Pre-sales | Stage stepper, details, owner, activity log, Log call, Book site visit, Start BOQ, Mark won → Create project. | PS 15 | 4 | [LeadDetail.png](ui/screens/LeadDetail.png) |
| **New project from a won lead** | `/projects/new?lead=[id]` | Pre-sales, Design lead | 3 steps: client and site (prefilled), team, money and payment stages (template: 4-stage standard or 5-stage milestone billing, stages linked to milestones). Creates BB-26-0xx. | PS 6, 15 | 1 | [NewProject.png](ui/screens/NewProject.png) |

## Projects

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Projects list** | `/projects` | Everyone (own projects unless Admin) | All projects with stage, progress, money health. New project. | PS 6 · UI 5.2 | 1 | [Projects.png](ui/screens/Projects.png) |
| **Project overview** | `/projects/[id]` | Project team | Header with client and stage, key numbers, links into every tab. "Client view" opens what the client sees. | PS 6 · UI 5.3 | 1 | [ProjectOverview.png](ui/screens/ProjectOverview.png) |
| **Files** | `/projects/[id]/files` | Project team | Folders (2D, 3D, client-facing, vendor-facing, production drawings, site photos, handover). Same file name stacks as a new version; older versions read-only. Freeze design. | PS 9 | 1 | [Files.png](ui/screens/Files.png) |
| **BOQ builder** | `/projects/[id]/boq` | Designers, Design lead | Reuse BOQ Studio's builder. Room sections, items, cost and margin toggle (permission), client and internal PDFs, Send to client. | PS 8 · UI 5.4 | 1 | [BOQ.png](ui/screens/BOQ.png) |
| **Send BOQ to client** | `/projects/[id]/boq/send` | Design lead | What changed since last version (shown to client too), message, WhatsApp + email, server-checked "no cost in client version", Send locks the version and tracks it in Sent & due with a review date. | PS 8, 11B | 1 | [BOQSend.png](ui/screens/BOQSend.png) |
| **Client approves estimate (phone)** | `/c/[token]/estimate` | Client | Total, changes since last version, rooms, ask a question on any line, Approve. | PS 8, 16 | 4 | [ClientBOQ.png](ui/screens/ClientBOQ.png) |

## Project money

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Project finance · summary** | `/projects/[id]/finance` | Design lead, Finance | Sold / received / paid / margin, alerts, room-by-room cost-to-complete, client payment schedule with a Create proforma button on each milestone-linked stage, vendor payments in progress. | PS 11 · UI 5.5 | 2 | [Finance.png](ui/screens/Finance.png) |
| **Vendors and bills** | `/projects/[id]/finance/vendors` | Design lead, Finance | Vendor table (ordered, billed, paid, due), selected vendor's POs and bills, Record bill, New PO, export ledger. | PS 10, 11 · UI 5.8 | 2 | [Vendors.png](ui/screens/Vendors.png) |
| **Client payments** | `/projects/[id]/finance/payments` | Finance | Receipts table, outstanding (incl. GST), Record a payment against a proforma → closes it in Sent & due, receipt to client, ledger entry. | PS 11 | 2 | [ClientPayments.png](ui/screens/ClientPayments.png) |
| **Project expenses** | `/projects/[id]/finance/expenses` | Design lead, Site | Small site spends vs the site-expense budget, status per item, added from phone. | PS 11 | 2 | [Expenses.png](ui/screens/Expenses.png) |
| **New proforma invoice** | `/projects/[id]/finance/proforma/new` | Finance, Design lead | Pick stage / change order, due terms, recipient; live letterhead preview with CGST/SGST, amount in words; Send. | PS 11B · UI 5.12 | 2 | [ProformaCreator.png](ui/screens/ProformaCreator.png) |
| **New purchase order** | `/projects/[id]/finance/po/new` | Design lead | Vendor, BOQ lines with checkboxes, order vs selling rate and margin, room budget left, over-budget warning, terms, submit for approval. | PS 10, 11B · UI 5.13 | 2 | [POCreator.png](ui/screens/POCreator.png) |
| **Home budget · plan vs actual** | `/projects/[id]/home-budget` | Designers | Whole-home budget incl. things the client buys directly; plan vs selected by category; contingency excluded from forecast. | PS 11A · UI 5.9 | 3 | [HomeBudget.png](ui/screens/HomeBudget.png) |
| **Home budget · client purchases** | `/projects/[id]/home-budget/purchases` | Designers | Timeline of client-bought items against Barebase milestones, dependencies, overdue decisions. | PS 11A · UI 5.10 | 3 | [ClientPurchases.png](ui/screens/ClientPurchases.png) |

## Site work

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Milestones · Gantt chart** | `/projects/[id]/milestones` | Design lead, Site | Gantt with milestones and sub-tasks, status legend, planned vs forecast finish, next milestone, overdue tasks, client billing per milestone. Sub-nav: Gantt chart · Daily reports · Progress by BOQ line. | PS 13 | 3 | [Milestones.png](ui/screens/Milestones.png) |
| **Daily reports (DPR)** | `/projects/[id]/milestones/dpr` | Design lead, Site | Month stats (filed, photos, crew, blockers), timeline of reports with weather, crew, materials, blockers raised. | PS 13 | 3 | [DPR.png](ui/screens/DPR.png) |
| **Progress by BOQ line** | `/projects/[id]/milestones/progress` | Design lead, Site | Value-weighted progress, planned-by-today, each BOQ line with actual vs planned, status and last DPR. | PS 13 | 3 | [BOQProgress.png](ui/screens/BOQProgress.png) |
| **Daily report (phone)** | `/site/[projectId]/dpr` | Site supervisor | Progress auto-added, photos, work done, crew steppers prefilled, blockers; Submit. | PS 13 · UI 5.7 | 3 | [PhoneDPR.png](ui/screens/PhoneDPR.png) |
| **Snags** | `/projects/[id]/snags` | Design lead, Site | Open / fixed-to-verify / closed, severity, assignee, fix-by. A snag closes only with an after photo and the lead designer's check. Handover checklist, Raise snag. | PS 14 | 3 | [Snags.png](ui/screens/Snags.png) |
| **Raise snag (phone)** | `/site/[projectId]/snag/new` | Site supervisor | Photo with circle mark-up, room, what's wrong, fix-by vendor (notified on WhatsApp), due, severity. | PS 14 | 3 | [PhoneSnag.png](ui/screens/PhoneSnag.png) |
| **Handover checklist** | `/projects/[id]/handover` | Design lead | Snags closed, JMR signed, final proforma sent, vendor bills settled, warranties uploaded, walk-through booked → handover pack to the client portal, warranty clock starts. | PS 14 | 3 | [Handover.png](ui/screens/Handover.png) |

## Company finance

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Finance · dashboard** | `/finance` | Admin, COO, Finance | Cash in/out, owed to team, client dues overdue, monthly bars, claims list. Tabs: Dashboard · Billing due · Sent & due · My claims · Pending reimbursements · All transactions · GST and TDS. | PS 11 | 2 | [OrgFinance.png](ui/screens/OrgFinance.png) |
| **Finance · Billing due** | `/finance/billing` | Finance | Proformas drafted from milestones (3 days before due, or on completion). Send proforma per row, preview, Edit before sending, Send all ready, Create now for stages not due yet. Nothing goes out without a person pressing Send. | PS 11B · UI 5.15 | 2 | [BillingDue.png](ui/screens/BillingDue.png) |
| **Finance · Sent & due** | `/finance/sent` | Finance, Design lead | Every proforma, PO and BOQ sent; status, due, flag (overdue / due soon / on track / closed); one follow-up button per row. | PS 11B · UI 5.14 | 2 | [SentTracker.png](ui/screens/SentTracker.png) |
| **Finance · My claims** | `/finance/claims` | Everyone | New claim with receipt read automatically, list of own claims and status. Approved claims paid Friday. | PS 11 | 2 | [MyClaims.png](ui/screens/MyClaims.png) |
| **Expense claim (phone)** | `/finance/claims/new (phone)` | Everyone | Photograph receipt → amount, project, what for, paid from. Routed to approver by slab. | PS 11, 12 | 2 | [PhoneClaim.png](ui/screens/PhoneClaim.png) |
| **Finance · Pending reimbursements** | `/finance/reimbursements` | Finance | Approved claims to pay, select, Mark paid and download bank file; people notified; ledger entries. | PS 11 | 2 | [Reimbursements.png](ui/screens/Reimbursements.png) |
| **Finance · All transactions** | `/finance/transactions` | Finance, Admin | One ledger of every rupee in and out; created only by the action that caused it; reversing entries for corrections; Tally CSV export. | PS 11, 17 | 2 | [Transactions.png](ui/screens/Transactions.png) |
| **Finance · GST and TDS** | `/finance/tax` | Finance | Output GST, input credit, net to pay, TDS; returns calendar; problems to fix before filing (missing GSTIN, mismatches, IGST check). Exports for the CA. | PS 11, 19 | 2 | [GstTds.png](ui/screens/GstTds.png) |

## Admin

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Team** | `/team` | Admin | People, role, projects, load, active / invited; what each role can do; Invite person. | PS 4, 18, 21 | 0 | [Team.png](ui/screens/Team.png) |
| **Org Settings** | `/settings` | Admin | Tabs: Company and letterhead (GSTIN, PAN, SAC, terms, preview) · Roles and permissions matrix · Approval slabs · Billing and numbering (milestone billing rule, number formats) · Rate card. | PS 12, 18, 23 | 0 | [OrgSettings.png](ui/screens/OrgSettings.png) |
| **Rate card** | `/settings/rate-card` | Admin, Design lead | Items with Selling rate and Cost price (locked for roles without cost), margin, low-margin filter, import from Excel. Changing a rate never changes a BOQ already sent. | PS 7 | 1 | [Catalogue.png](ui/screens/Catalogue.png) |

## Client portal (phone)

| Screen | Route | Used by | What it does | Spec | Phase | Mock-up |
|---|---|---|---|---|---|---|
| **Client portal** | `/c/[token]` | Client | Tabs: Progress · Budget · Estimate · Payments · Docs. Links to approve the estimate and pay a proforma. | PS 16 · UI 5.7, 5.11 | 4 | [ClientPortal.png](ui/screens/ClientPortal.png) |
| **Client pays a proforma** | `/c/[token]/pay/[proformaId]` | Client | Balance due, bank and UPI details, proforma PDF, "I've paid · add reference" → Finance confirms in Client payments. | PS 11B, 16 | 4 | [ClientPay.png](ui/screens/ClientPay.png) |

## Journeys

Each journey must work end to end on staging before its phase is called done. Write one Playwright test per journey that walks the steps with the seed data.

### 1. Lead to project
*Pre-sales → Design lead*

`Leads` → `LeadDetail` → `BOQ` → `BOQSend` → `ClientBOQ` → `NewProject` → `ProjectOverview`

### 2. Buying for the site
*Design lead → Approver → Finance*

`Finance` → `POCreator` → Approvals / PhoneApprovals → `SentTracker` → `Vendors` → `Transactions`

### 3. A day on site
*Site supervisor → Design lead*

`PhoneDPR` → `Milestones` → `DPR` → `BOQProgress`

### 4. Billing the client
*Finance · Design lead*

Milestones / Finance (Create proforma) → `BillingDue` → `ProformaCreator` → `SentTracker` → `ClientPay` → `ClientPayments`

### 5. Expense claims
*Anyone → Approver → Finance*

`PhoneClaim` → `MyClaims` → `Approvals` → `Reimbursements` → `Expenses` → `Transactions`

### 6. The client's home budget
*Designer ↔ Client*

`HomeBudget` → `ClientPurchases` → ClientPortal (Budget)

### 7. Snags and handover
*Site → Design lead → Client*

`PhoneSnag` → `Snags` → `Handover` → BillingDue (final stage) → `Files`

### 8. Month-end money
*Finance · Admin*

`Insights` → `OrgFinance` → `BillingDue` → `SentTracker` → `Transactions` → `GstTds`

### 9. Running the studio
*Admin*

`Login` → `Main` → `Notifications` → `Team` → `OrgSettings` → `Catalogue`

### 10. The client's side
*Client*

`ClientPortal` → `ClientBOQ` → `ClientPay`

## Rules that cut across screens

- **Nothing reaches a client without a person pressing Send.** Automatic drafts (proformas from milestones) wait in Billing due.
- **Every rupee is tracked from the action that caused it.** Approve-and-pay, recording a receipt and paying a claim create ledger entries; nobody types into the ledger.
- **Sent documents are tracked.** Proformas, POs and BOQ versions land in Sent & due with a due date and a daily 9 am flag check.
- **Phone screens are first-class.** DPR, snag, claim, approvals and the client portal are designed at 390 px first.
- **The top bar carries "n to approve" and the bell.** Approvals is not in the sidebar.
- **Sidebar (global):** Home · Insights · Leads · Projects · Finance · Team, with Org Settings at the bottom. **Sidebar (project):** Overview · Files · BOQ · Finance · Home budget · Milestones & DPR (sub-nav: Gantt chart, Daily reports, Progress by BOQ line) · Snags.
