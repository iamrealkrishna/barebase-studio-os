# Barebase Studio OS: build plan

Written 19 Oct 2026 by the set-up session (`prompts/00-kickoff.md`). It covers the scaffold, the target schema, the route
map, the phase task lists, journeys and risks. Answers already given are in `docs/decisions.md`. Tick tasks here as their
PRs merge, and note anything deferred.

**Status:** set-up PR open (scaffold, tokens, formatters, shells, every route as a placeholder, this plan). Phase 0 starts
after it merges.

---

## Questions for Krishna

Only things that block Phase 0 or Phase 1 and aren't already answered in `docs/decisions.md`. Until you answer, the
default shown is what gets built.

1. **Does the Design lead see cost price and margin?** Product spec decision 2 defaults to *No*, but the Team mock-up's
   "What each role can do" says the Lead designer "sees cost" (and that an Approver "sees cost and margin"). This
   decides what Phase 0's cost serializer strips for Mansi, and what the BOQ builder and Rate card show her in Phase 1.
   *Default:* No, as in the spec.
2. **Default file folders.** Product spec 9 lists six (2D drawings · 3D renders · Client documents · Contracts and POs ·
   Site photos · Handover). The Files mock-up has nine (2D Layout / Adaptation · 2D Raw Files · 3D Layout / Adaptation ·
   3D Raw Files · Client Facing Documents · Vendor Facing Documents · Production Drawings · Site Photos · Handover).
   *Default:* the nine from the mock-up, since Admins can rename them in Settings anyway.
3. **Error tracking.** The spec asks for error tracking such as Sentry (PS 21), and Phase 0 sets it up. Is a Sentry
   account fine, and who should get the alerts? *Default:* Sentry's free plan, alerts to krishna@barebase.in; until a
   DSN exists, errors go to the Vercel logs only.
4. **First Admin.** Nobody can sign up, so the first account has to be created by a one-off command. *Default:* the
   bootstrap command creates Krishna (krishna@barebase.in) as Admin and emails an invite; everyone else in decision 5 is
   invited from the Team screen. Tell me if Harish should be bootstrapped too, and his email.
5. **Production address.** Invite, reset and client links need the app's public address. *Default:* the Vercel
   `*.vercel.app` address until you pick a domain (for example `studio.barebase.in`). Changing it later only changes
   `APP_URL`, but links already emailed keep the old address.

Mock-up versus spec points that don't block Phase 0 or 1 are listed under Risks, with the default each one follows.

---

## 1. What the set-up PR contains

| Area | Where | Notes |
| --- | --- | --- |
| App | `package.json`, `next.config.ts`, `tsconfig.json` | Next.js 16.4 App Router, React 19.2, TypeScript 5.9, Prisma 6.19, Lucide. Plain CSS modules on the tokens (no Tailwind, no component library) |
| Tokens | `src/styles/tokens.css` | UI spec section 2 exactly, plus seven layout sizes the shell needs (marked "Added during setup") |
| Formatters | `src/lib/format.ts` + `format.test.ts` | `formatINR`, `formatDate`, `formatTime`, `formatRelative`, `amountInWords`. Every UI spec 7 case passes. Money stays a string throughout; no float maths |
| Calculations | `src/lib/calc.ts` | Empty on purpose; P0-3 fills it |
| Shells | `src/components/shell/` | AppShell (global or project sidebar, top bar, phone bottom bar), AuthShell, ClientShell, SiteShell. Sidebars exactly as the last section of `screens-and-journeys.md`; Approvals in the top bar, not the sidebar |
| Routes | `src/app/` | Every route in `screens-and-journeys.md` (plus a few the UI spec needs, see section 3) renders a placeholder with its title, purpose, spec sections and mock-up link. Old UI-spec URLs redirect |
| Screen list | `src/lib/screens.ts` | One record per route; drives the placeholders and the navigation test |
| Safety | `scripts/migrate-on-deploy.mjs`, `playwright.config.ts` | Builds migrate only on Vercel, and refuse when Preview points at the production host; Playwright refuses production and any remote URL without `E2E_TARGET=staging` (decision 3) |
| Tokens lint | `scripts/check-tokens.mjs` | Part of `npm run lint`: fails on a hex colour, font size or px/rem spacing outside `tokens.css` |
| Tests | `src/lib/format.test.ts`, `tests/e2e/navigation.spec.ts` | Vitest: 29 formatter cases. Playwright: every route at 1440 and 375 px renders its title with no sideways scroll, sidebar and bottom-bar navigation, redirects |
| CI | `.github/workflows/ci.yml` | lint, typecheck, unit, build, Playwright on every PR. No database or secrets in CI |
| Database | `prisma/schema.prisma` | Datasource and generator only. Tables arrive migration by migration from P0-5 |

---

## 2. Target schema

The end state after Phase 5: product spec section 17 plus the 11A and 11B tables, plus technical tables the specs imply
(marked "technical"). It passes `prisma validate` and is in the appendix at the end of this file. Each task below adds
only the tables it needs, through a migration.

Decisions taken in the schema, beyond what section 17 spells out:

- **Every table** has `orgId`, `createdAt`, `updatedAt`; rows people create have `createdById`. Money is
  `Decimal(14,2)`, quantities `Decimal(14,3)`, percentages `Decimal(5,2)`. Anything touching money, BOQs or clients has
  `deletedAt`.
- **One approval engine:** `ApprovalRequest` (technical) holds the path copied from `ApprovalRule` at submit time, the
  current level and status, so editing slabs never moves a request already in flight. `ApprovalStep` logs every action.
  Vendor payment requests, POs and claims all go through it.
- **Bills, receipts, expenses and claims are `LedgerEntry` rows** (kinds from section 17). A bill is a `VENDOR_BILL`
  entry with `billNo`; a payment request's `billId` points at it. Corrections are `REVERSAL` rows (`reversesId`).
- **Versions store their computed totals** next to the snapshot, so a sent version always shows what was sent.
- **Codes** (BB-26-014, PO-03, SNG-007, VEN-042, PR-26-0001, PI-26-0048) come from a `Sequence` table and are never
  reused. A proforma's number is reserved only when it is sent (11B).
- **Client links** store only a hash of the token; the 6-digit code and the 30-day device live in `ClientDevice`.
  Invite, reset and sign-in links (`AuthToken`) are hashed the same way.
- **Milestones** have `parentId` for the Gantt chart's sub-tasks (kit v2 question 4), and exist from Phase 2 so
  payment stages can link to them (kit v2 question 2).
- **Loose references** (no foreign key) where the spec wants history to outlive the row: `LineReview.lineId`,
  `ChangeOrder.lineId`, `Line.itemId`.

---

## 3. Route map

Routes follow `docs/screens-and-journeys.md` (decisions.md, kit v2 question 1). Every route below exists as a
placeholder in the set-up PR. "Shell" is the frame: App (global sidebar), Project (project sidebar), Site (phone
header), Client (letterhead and tabs), Auth.

| Route | Screen | Shell | Phase | Mock-up |
| --- | --- | --- | --- | --- |
| `/login` | Sign in | Auth | 0 | Login |
| `/invite/[token]`, `/reset/[token]` | Accept invite, reset password | Auth | 0 | (Login) |
| `/` | Home | App | 1 (v1), 5 | Main |
| `/insights` | Insights | App | 5 | Insights |
| `/notifications` | Notifications | App | 5 | Notifications |
| `/approvals` | Approvals inbox (desktop and phone) | App | 2 | Approvals, PhoneApprovals |
| `/leads`, `/leads/[id]` | Leads board, lead detail | App | 4 | Leads, LeadDetail |
| `/projects` | Projects list | App | 1 | Projects |
| `/projects/new` (`?lead=`) | New project | App | 1 | NewProject |
| `/projects/[id]` | Overview | Project | 1 | ProjectOverview |
| `/projects/[id]/files` | Files | Project | 1 | Files |
| `/projects/[id]/boq` (+ `/client-view`, `/review`, `/versions`) | BOQ builder and its sub-pages | Project | 1 | BOQ |
| `/projects/[id]/boq/send` | Send BOQ to client | Project | 1 | BOQSend |
| `/projects/[id]/finance` | Finance summary | Project | 2 | Finance |
| `/projects/[id]/finance/vendors` | Vendors and bills | Project | 2 | Vendors |
| `/projects/[id]/finance/payments` | Client payments | Project | 2 | ClientPayments |
| `/projects/[id]/finance/expenses` | Project expenses | Project | 2 | Expenses |
| `/projects/[id]/finance/proforma/new` | New proforma invoice | Project | 2 | ProformaCreator |
| `/projects/[id]/finance/po/new` | New purchase order | Project | 2 | POCreator |
| `/projects/[id]/home-budget` (+ `/purchases`) | Home budget, client purchases | Project | 3 | HomeBudget, ClientPurchases |
| `/projects/[id]/milestones` (+ `/dpr`, `/progress`) | Gantt chart, daily reports, progress by BOQ line | Project | 3 | Milestones, DPR, BOQProgress |
| `/projects/[id]/snags` | Snags | Project | 3 | Snags |
| `/projects/[id]/handover` | Handover checklist | Project (project menu) | 3 | Handover |
| `/projects/[id]/history` | History | Project (project menu) | 1 | none |
| `/site/[projectId]/dpr` | Daily report (phone) | Site | 3 | PhoneDPR |
| `/site/[projectId]/snag/new` | Raise a snag (phone) | Site | 3 | PhoneSnag |
| `/finance` | Finance dashboard | App | 2 | OrgFinance |
| `/finance/billing`, `/finance/sent` | Billing due, Sent & due | App | 2 | BillingDue, SentTracker |
| `/finance/claims`, `/finance/claims/new` | My claims, new expense (phone) | App | 2 | MyClaims, PhoneClaim |
| `/finance/reimbursements`, `/finance/transactions`, `/finance/tax` | Reimbursements, all transactions, GST and TDS | App | 2 | Reimbursements, Transactions, GstTds |
| `/team` | Team | App | 0 | Team |
| `/profile` | Profile (change password, sign out) | App | 0 | none |
| `/settings` | Org Settings | App | 0 | OrgSettings |
| `/settings/rate-card` | Rate card | App | 1 | Catalogue |
| `/c/[token]` (Progress), `/budget`, `/estimate`, `/payments`, `/documents`, `/snags`, `/handover` | Client portal tabs | Client | 3 (Budget), 4 | ClientPortal, ClientBOQ, reference 11 |
| `/c/[token]/pay/[proformaId]` | Client pays a proforma | Client | 4 | ClientPay |

**Routes in the UI spec but not yet placeholders,** added by the task that needs them: `/approvals/[id]` (P2-4),
`/projects/[id]/finance/billing` and `/finance/sent` filtered per project (P2-15, P2-16), `/settings/vendors` and the
vendor page (P2-1; there is no mock-up for the vendor master), `/dev/ui` (P1-3), `/api/leads/inbound` (P4-1),
`/api/files/[id]` (P0-12).

**Permanent redirects** (in `next.config.ts`) from the UI spec's URLs: `/projects/[id]/budget` → `/home-budget`,
`/finance/client` → `/finance/payments`, `/finance/vendor` → `/finance/vendors`, `/milestones/dpr/new` →
`/site/[id]/dpr`, `/snags/walk` → `/site/[id]/snag/new`, `/finance/gst` → `/finance/tax`, `/settings/catalogue` →
`/settings/rate-card`, `/settings/organisation` → `/settings`, `/c/[token]/progress` → `/c/[token]`.

---

## 4. Phase task lists

Each task is one PR of 1 to 3 days, in build order. "AC" lists the acceptance checks the PR proves (Playwright unless
it says unit). Spec references: PS = product spec, UI = UI spec, S&J = `screens-and-journeys.md`. Every PR also meets
UI spec section 8 (definition of done) and adds its routes to the client-safety and cost-safety tests where relevant.

### Phase 0: Foundation (prompt 01 · PS 3, 4, 18, 21 · UI 2, 3, 9)

The minERP "bugs to fix" in PS 3 don't apply to a new app; P0 builds those things correctly from the start (India
time, validation, item picker labels in P1-16, editable project name in P1-6).

- [x] **P0-0 Set-up** (this PR): scaffold, tokens, formatters, empty calc, shells, every route as a placeholder, CI,
  migration guard, Playwright production guard, this plan.
- [ ] **P0-1 Environments.** Neon production and the `staging` branch wired to Vercel Production and Preview; first
  deploys of both; Sentry (question 3) with separate environments. AC: a Preview build pointed at staging migrates
  staging; pointed at the production host it fails before migrating; a test error reaches Sentry from staging only.
- [ ] **P0-2 Status map.** `src/lib/status.ts` (UI 2, every status from UI 4 added up front) and a `StatusChip`
  that reads only from it. AC (unit): every status in the four status machines has a label and tone.
- [ ] **P0-3 `calc.ts` core.** decimal.js; every PS 19 formula with worked examples: line quantity (L, L×B, L×B×H,
  override, count, 8'6" input), amount, totals, discount spread by GST band, CGST/SGST vs IGST, round-off line,
  margin, inclusive/exclusive GST, TDS, progress, project finance, home-budget forecast. AC (unit): ₹1,18,000
  inclusive at 18% → ₹1,00,000 + ₹18,000; ₹83,467 stage → CGST ₹7,512, SGST ₹7,512, total ₹98,491; ₹8,34,675 at 18% →
  GST ₹1,50,242; one ₹1,00,000 line at 50% in a ₹10,00,000 BOQ → 5 points; the Villa Prakruthi home budget → forecast
  ₹16,25,175, ₹25,175 over after contingency.
- [ ] **P0-4 Validators.** `src/lib/validate.ts`: 10-digit Indian mobile, email, GSTIN (with state from the first two
  digits), PAN, IFSC, with the error wording from UI 7 ("Phone should be 10 digits"). AC (unit): good and bad cases
  for each.
- [ ] **P0-5 People schema, audit and soft delete.** First migration: `Organization`, `User` (seven `OrgRole`s),
  `AuthToken`, `RateLimitHit`, `IdempotencyKey`, `Sequence`, `AuditEvent`. `recordAudit(before, after)` helper,
  `softDelete` helper, bootstrap command for the first Admin (question 4), seed for staging with the people in
  decision 5 plus a site supervisor and a Finance user. AC: migration runs on staging; every write helper records an
  audit event; seed is repeatable.
- [ ] **P0-6 Sign in and sessions** (`/login`, Login.png). Email and password (bcrypt, minimum 10), httpOnly signed
  cookie (jose) checked against `User.active` on every request, sign out, 5 wrong tries locks 15 minutes (kit v2
  question 8), the "Are you a client?" link. Every staff route redirects to `/login` without a session. AC: no public
  sign-up exists; a deactivated user's open session stops on the next request; the sixth wrong password is refused
  with the time left.
- [ ] **P0-7 Email, invites, reset, sign-in link.** Resend from `studio@barebase.in`; `/invite/[token]` (7 days),
  `/reset/[token]` (30 minutes), "Email me a sign-in link" (15 minutes), each single use; change password on
  `/profile`. AC: a used or expired link is refused; reset invalidates the old password.
- [ ] **P0-8 Permissions.** `can(user, action, resource)` with the PS 18 matrix (and the 11A rows) as data;
  `requireUser`, `requireCan`; a membership-filter helper for queries; refusals return 404. Decisions 1, 2 and 17
  applied (question 1). AC (unit): every cell of the matrix for every role.
- [ ] **P0-9 Cost serializer and safety tests.** One `stripCost(user, data)` used by every page, action and route
  that returns cost-bearing data (cost price, margin, budget, order rates, internal notes). A Playwright suite that
  signs in as a Designer and requests every route and action, failing if any cost key appears; a matching suite for
  `/c/[token]` that grows each phase. AC: PS 22 exit check "a Designer's API responses contain no cost data".
- [ ] **P0-10 Team** (`/team`, Team.png, S&J). People, role, projects, load, active or invited; Invite person; change
  role; deactivate (kills the session at once); "What each role can do". Admin only. AC: an Admin invites, changes a
  role and deactivates from this screen; a non-Admin gets 404.
- [ ] **P0-11 Org Settings shell and Profile** (`/settings`, OrgSettings.png). Company and letterhead (GSTIN, PAN,
  SAC, default terms, preview, validated), Roles and permissions (the P0-8 matrix, read-only), and the Rate card tab
  linking to `/settings/rate-card`. Approval slabs and Billing and numbering tabs arrive in P2-3 and P2-13. AC: Admin
  only; GSTIN and PAN errors say how to fix them.
- [ ] **P0-12 File storage.** Vercel Blob upload helper, `File`/`Attachment` plumbing, downloads only through
  `/api/files/[id]`, which checks `can()` and redirects to a short-lived URL (10 minutes, PS 9; see risk 4). AC: a
  file can't be fetched without permission or after the link expires.
- [ ] **P0-13 Rate limiting and security headers.** The `RateLimitHit` limiter on sign-in, reset, sign-in link and
  (later) client code entry and the leads webhook; security headers; secrets only from env. AC: limits enforced per
  bucket; no secret in the repo (CI secret scan).

**Exit check (PS 22):** no public sign-up · every user signs in with their own account · a Designer's API responses
contain no cost data · History and every time shown in India time · staging and production databases separate ·
formatter tests pass.

### Phase 1: Projects and BOQ (prompts 02a, 02b, 02c · PS 6 to 9, 19 · UI 2, 3, 5.1 to 5.4, 6)

UI system and shells (02a):

- [ ] **P1-1 Primitives:** Button, text/select/date/textarea inputs, MoneyInput (Indian commas as you type, words,
  confirm above ₹1,00,000), Avatar, ProgressBar, with the five states. AC: each state renders; MoneyInput never holds a
  float.
- [ ] **P1-2 Composites:** DataTable (sticky header, 50 per page, column picker, pinned first column on phones),
  SideSheet (`?sheet=`), Dialog, Toast with Undo, EmptyState, StatCard, PageHeader. AC: Esc closes sheets; Back closes a
  sheet before leaving the page.
- [ ] **P1-3 FileDrop, PhotoCapture and the component gallery** at `/dev/ui` (staging only). PhotoCapture compresses
  to 1600 px at JPEG 0.8. **Stop for Krishna's review of the gallery.** AC: axe reports no serious issues; 1440 and
  375 px visual snapshots committed.
- [ ] **P1-4 Shells on real data:** signed-in user in the sidebar and avatar, hidden items via `can()`, badge counts
  endpoint (refresh every 60 s), "/" focuses search, sidebar collapse remembered, stage bar in ProjectShell. Note:
  prompt 02a's sidebar list predates the screens file; the screens file's sidebar wins (Insights in, Settings at the
  bottom, Approvals in the top bar). AC: shells match the mock-ups at 1440 and 375 px.

Projects, catalogue and files (02b):

- [ ] **P1-5 Project schema and stages.** `Client`, `Project`, `ProjectMember`, project codes BB-YY-NNN,
  `transitionProjectStage` (events only, plus On hold, Lost and Reopened with a reason; moving back needs a reason),
  stage history in audit. AC (PS 6): code unique and sequential within the year; a non-member Designer gets 404 by URL.
- [ ] **P1-6 New project** (`/projects/new`, NewProject.png, S&J): three steps (client and site · team · money and
  payment stages from the 4-stage or 5-stage template, saving `PaymentStage` rows), plus the quick New project side
  sheet with only name, client and lead designer. Project name editable later. AC: a project with only the three
  required fields is created in under 30 seconds; stages total 100%.
- [ ] **P1-7 Projects list** (`/projects`, Projects.png, UI 5.2): stage tabs with counts, filters and view in the
  URL, table and cards, empty states, membership filter in the query. AC: UI 5.2 Done when; 200 projects page at 50.
- [ ] **P1-8 Project Overview** (`/projects/[id]`, ProjectOverview.png, UI 5.3): header, stage bar, BOQ value,
  progress and next milestone (`TODO(phase-3)`), open snags (`TODO(phase-3)`), jump-into cards, milestone timeline,
  activity, team, recent files, "Client view" link. AC: numbers match the BOQ tab; attention items link to the record.
- [ ] **P1-9 Home v1** (`/`, Main.png, UI 5.1) with the cards whose data exists (projects, activity); the rest land in
  Phase 5. AC: every card is a link; stacks to one column at 375 px.
- [ ] **P1-10 Catalogue schema and Rate card** (`/settings/rate-card`, Catalogue.png, PS 7): Category, Material,
  Finish, Unit (with dimensions), Item with code, selling rate, cost price, GST %, HSN, default scope, image, active;
  50 per page, filters, margin column for cost viewers with the low-margin filter (decision 8, see risk 6), inline
  edit, bulk % change, rate history. AC (PS 7): a Designer gets no cost data in any response; changing a rate leaves
  sent BOQs unchanged.
- [ ] **P1-11 Rate card CSV import and export** by item code, with the preview (new, changed old → new, unchanged,
  errors) before saving. AC: a 253-item CSV previews correctly and saves only after confirmation.
- [ ] **P1-12 Files** (`/projects/[id]/files`, Files.png, PS 9): folders (question 2), upload with versions (same
  name stacks V2, V3), Draft → Approved internally → Shared with client, comments with @mentions, signed downloads.
  AC: a 50 MB PDF uploads from a laptop; a 10 MB photo from a phone.
- [ ] **P1-13 History** (`/projects/[id]/history`): every audit event for the project in India time, Client badge,
  filters. AC: times shown in Asia/Kolkata.

BOQ (02c):

- [ ] **P1-14 BOQ schema.** `Boq`, `Room`, `Line`, `Version`, `LineReview`, `ChangeOrder`; every amount through
  `calc.ts`. AC (unit): totals for the Villa Prakruthi seed BOQ match PS 19 to the paisa.
- [ ] **P1-15 BOQ builder, part 1** (`/projects/[id]/boq`, BOQ.png, UI 5.4): rooms with subtotals, inline lines,
  measurements (inches as 8'6"), quantity override marker, count, selling rate override marker, scope, internal note,
  summary panel (subtotal, discount, taxable, CGST/SGST or IGST per band, grand total, words; cost and margin for cost
  viewers, stripped on the server), client-column toggles, autosave per line (600 ms) with the saved indicator.
- [ ] **P1-16 BOQ builder, part 2:** item picker (Name · Material · Finish · Unit · ₹rate, Ctrl/Cmd+K), custom
  lines, keyboard (Tab, Enter on the last cell adds a line), drag to reorder, move to another room, duplicate, delete
  with 10-second Undo, line photo to Blob. AC (PS 8): a 60-line, 8-room BOQ is built without leaving the screen and
  edits without lag.
- [ ] **P1-17 Edit lock:** lock row renewed every 30 s, expires after 10 minutes idle, "Mansi is editing this BOQ"
  banner and read-only view for the second person.
- [ ] **P1-18 Versions and change orders:** `transitionBoqVersion` (draft → sent → approved / partly approved →
  superseded), immutable snapshots with their totals, compare two versions, main version, change orders with a
  required reason and ₹ impact. AC (PS 8): a sent version can't be edited by anyone, including through the API;
  changing an approved line without a reason is blocked.
- [ ] **P1-19 PDFs:** client PDF and internal PDF (PS 8, layout as the mock-ups), generated from the same data and
  `calc.ts`. AC: the client PDF's text contains no cost or note data; a 200-line PDF in under 5 s.
- [ ] **P1-20 Send BOQ to client** (`/projects/[id]/boq/send`, BOQSend.png, S&J): what changed since the last version,
  message, email and a WhatsApp `wa.me` link (kit v2 question 6), server check that nothing cost-related reaches the
  client version, review-by date; client contacts with hashed link tokens; revoke and reissue. Sending moves the stage
  to Quotation the first time. AC (PS 6): first send moves the stage with nobody touching it.
- [ ] **P1-21 Client review, client side:** `/c/[token]/estimate` with the 6-digit email code on first open per
  device (30 days), per-line Approve / Request change / Reject with comments, Approve all, Submit review. Phase 4
  (P4-7) reworks it to the phone design in ClientBOQ.png. AC (PS 16): a client link can't open another project by
  changing any id; every response passes the client-safety test.
- [ ] **P1-22 Client review, team side:** Client Review (`/boq/review`) with inline editing beside the client's
  verdicts; Client View preview (`/boq/client-view`); saving creates the next draft, and sending it shows the client
  only what changed.
- [ ] **P1-23 Design freeze, import and duplicate:** design freeze on Files linked to the approved BOQ version, logged
  in History; import lines from another project; duplicate a project's BOQ. AC (PS 9): design freeze records the
  version and date in History.

**Exit check:** five real projects built end to end by the design team · client PDF totals match a hand check to the
paisa · one BOQ sent, reviewed and revised through the client link.

### Phase 2: Money (prompts 03a, 03b · PS 10, 11, 11B, 12, 19 · UI 4, 5.5, 5.6, 5.8, 5.12 to 5.15)

Engine and vendors (03a):

- [ ] **P2-1 Vendor master** (`/settings/vendors`, no mock-up): code VEN-NNN, trade tags, phone, PAN, GSTIN with
  state, encrypted bank details (Admin and Finance only), TDS section, status (blacklisted gets no new POs), documents;
  vendor page with Details · POs · Bills · Payments · Ledger.
- [ ] **P2-2 Notifications:** `Notification` created in the same transaction as its event, grouped within 10 minutes,
  bell polling every 60 s, email for important events with per-type opt-out.
- [ ] **P2-3 Approval engine and slabs:** `ApprovalRule`, `ApprovalRequest`, `ApprovalStep`; the Org Settings ›
  Approval slabs tab; no self-approval (goes up a level, or to an Admin), editing the amount resets to level 1, no
  bypass, idempotent actions, daily reminder past 48 hours. AC (PS 12, through the API): a ₹3,00,000 vendor payment
  needs COO then Founder; editing a half-approved request resets it; the requester never sees Approve.
- [ ] **P2-4 Approvals inbox** (`/approvals`, `/approvals/[id]`, Approvals.png, UI 5.6): two panes, figures and words,
  money context, path, comments, keyboard (arrows, A, H, R), next item after acting. AC: UI 5.6 Done when; a double
  click records one approval.
- [ ] **P2-5 Approvals on phone** (PhoneApprovals.png): one card per item with Approve and Send back, at 390 px,
  opened from a shared link after sign-in. AC: same rules as P2-4.
- [ ] **P2-6 Purchase orders and the PO creator** (`/projects/[id]/finance/po/new`, POCreator.png, UI 5.13): ticked
  main-version lines with order rate, selling rate and margin (cost viewers), quantity and rate warnings, room budget
  left with the over-budget reason, terms templates, approver hint, submit for approval, PO PDF emailed after
  approval. AC (PS 10, 11B): a 12-line PO in under two minutes; the PO PDF text has no selling rate or margin.
- [ ] **P2-7 PO status machine and revisions:** Sent, Partly billed, Fully billed, Closed, Cancelled until the first
  payment; any change after a payment is a revision with re-approval. AC (PS 10): a PO with a payment can only be revised.

Finance (03b):

- [ ] **P2-8 Ledger:** `LedgerEntry` for every money movement, created only by the action that caused it; approved
  entries locked; corrections as reversing entries. AC (unit): reversal nets to zero; no update path on approved rows.
- [ ] **P2-9 Vendor bills and payment requests:** bills against a PO or "no PO", GST and TDS (decision 6), a bill over
  the PO's remaining value needs a reason, payment requests through the engine, Record payment only once fully
  approved (no button before). AC (PS 11): a payment request can't reach Paid without every level, through the API.
- [ ] **P2-10 Vendors & bills ledger query:** per vendor on the project (trade, POs, ordered, billed, paid, due, TDS),
  plus "Direct labour and site expenses (no PO)"; bank details never selected; design lead sees it (decision 17).
  AC (unit): column totals equal the Summary's ordered and paid.
- [ ] **P2-11 Vendors & bills tab** (`/projects/[id]/finance/vendors?vendor=`, Vendors.png, UI 5.8): stat cards, vendor
  table with totals, POs and bills panel (side sheet on phones), Record bill, New PO, export ledger. AC: UI 5.8 Done
  when; every bill links to its approval or payment.
- [ ] **P2-12 Minimal milestones and payment schedule:** `Milestone` (name, planned dates, complete), linking stages to
  milestones (kit v2 question 2), stage becomes Due when its milestone completes and Finance is notified. AC (PS 13):
  completing a linked milestone marks the stage Due.
- [ ] **P2-13 Proformas:** model, PI-YY-NNNN reserved on send, CGST/SGST or IGST by place of supply, SAC, words;
  proforma creator (`/finance/proforma/new`, ProformaCreator.png, UI 5.12) with the shared DocumentPreview and PDF;
  Org Settings › Billing and numbering tab. AC (11B): ₹83,467 → ₹7,512 + ₹7,512 = ₹98,491 with matching words; preview
  and PDF identical; IGST for an out-of-state client.
- [ ] **P2-14 Client payments** (`/finance/payments`, ClientPayments.png): receipts (partial allowed) against a
  proforma, outstanding incl. GST, receipt to the client, ledger entry, closes the proforma in Sent & due.
- [ ] **P2-15 Billing due** (`/finance/billing` and per project, BillingDue.png, UI 5.15): 6 am job drafting by the
  billing rule, recalculation when a date or the contract value changes, notifications, Send proforma, Edit before
  sending, Send all ready (one confirm), Create now; Create proforma on the project payment schedule. AC (11B): a
  milestone due 21 Oct shows a ready draft on 18 Oct; no proforma reaches a client without a person pressing Send.
- [ ] **P2-16 Sent & due** (`/finance/sent` and per project, SentTracker.png, UI 5.14): `SentDocument` for proformas,
  POs and BOQ versions (including those sent since P1-20), 9 am flag job with overdue notifications, filters in the
  URL, one-click follow-ups logged as `Reminder`s (email, portal or `wa.me`). AC (11B): unpaid past due shows Overdue
  next morning; a reminder is logged once on a double click.
- [ ] **P2-17 Project expenses** (`/finance/expenses`, Expenses.png): site spends against the site-expense budget,
  through approvals, added from a phone.
- [ ] **P2-18 Project Finance summary** (`/projects/[id]/finance`, Finance.png, UI 5.5): sold, received, paid, margin
  (three ways), alerts, room-by-room cost-to-complete from one query, payment schedule, vendor payments in progress,
  drill-down side sheet. AC: UI 5.5 Done when; cost columns removed server-side for non-cost viewers.
- [ ] **P2-19 Claims:** the entry form (inclusive or exclusive GST, categories, bill photo above ₹500, fuel by km,
  duplicate warning, words and confirmation above ₹1,00,000), My claims (`/finance/claims`, MyClaims.png), New expense
  on phone (`/finance/claims/new`, PhoneClaim.png) with the amount typed in (kit v2 question 5). AC (PS 11): ₹1,18,000
  inclusive at 18% fills ₹1,00,000 and ₹18,000; a Designer sees only their own claims and entries.
- [ ] **P2-20 Pending reimbursements** (`/finance/reimbursements`, Reimbursements.png): approved claims by person,
  select, Mark paid, bank file as CSV (kit v2 question 9, see risk 7), notifications, ledger entries.
- [ ] **P2-21 All transactions** (`/finance/transactions`, Transactions.png): one ledger, filters, New entry (own
  entries only for non-admins), Tally CSV export.
- [ ] **P2-22 Finance dashboard** (`/finance`, OrgFinance.png): cash in and out, owed to team, client dues overdue,
  bars by day, month, quarter and year (native charts). AC (PS 11): a month's totals equal that month's approved
  ledger entries.
- [ ] **P2-23 GST and TDS** (`/finance/tax`, GstTds.png): output GST, input credit, net to pay, TDS, returns calendar,
  problems before filing, CA exports. AC (PS 11): the month's export opens in Excel with one row per entry and correct
  CGST, SGST and IGST.
- [ ] **P2-24 Scheduled jobs:** Vercel Cron for the 6 am drafting, 9 am flags, 48-hour approval reminders and the
  overdue 9 am email, each idempotent and logged.

**Exit check:** one month of real vendor payments and claims through approvals in parallel with RDash, totals
matching · no payment recorded without full approval · the CA accepts the GST export · journeys 2 and 5 pass, and
journeys 4 and 8 in their Phase 2 form (kit v2 question 3).

### Phase 3: Site and close-out (prompt 04 · PS 11A, 13, 14 · UI 4, 5.7, 5.9 to 5.11)

- [ ] **P3-1 Milestones Gantt chart** (`/projects/[id]/milestones`, Milestones.png): milestones from a template,
  sub-tasks (`parentId`), BOQ lines assigned (one milestone per line), planned vs forecast finish, automatic Delayed,
  status legend, Client billing banner linking to Billing due. No dependencies or critical path (kit v2 question 4).
- [ ] **P3-2 Progress by BOQ line** (`/milestones/progress`, BOQProgress.png): slider, typed % or quantity, photos,
  history; value-weighted progress for lines, rooms, milestones and project; planned by today. AC (PS 13): one
  ₹1,00,000 line at 50% in a ₹10,00,000 BOQ moves the project exactly 5 points.
- [ ] **P3-3 Tasks:** board (Open, In progress, In review, On hold, Completed, Cancelled), milestone link, priority,
  checklist, attachments, comments with @mentions, New task from the Gantt chart, My tasks for Home.
- [ ] **P3-4 Daily report on phone** (`/site/[projectId]/dpr`, PhoneDPR.png): today's progress pulled in, photos (up
  to 20, compressed), work done, crew prefilled from yesterday, blockers (notify the lead designer), tomorrow, share
  with client, offline draft queue. AC (PS 13): a DPR with 6 photos files on 4G in under 60 s; one per project per day.
- [ ] **P3-5 Daily reports list** (`/milestones/dpr`, DPR.png): month stats, timeline, calendar of filed days, DPR PDF
  and weekly summary PDF.
- [ ] **P3-6 Snags** (`/projects/[id]/snags`, Snags.png): SNG-NNN, filters, % closed, `transitionSnag` (Open → Fixed
  with after photo → Verified → Closed; Won't fix with reason and Design lead approval), overdue on Overview. AC (PS
  14): a snag can't close without an after photo.
- [ ] **P3-7 Raise a snag on phone** (`/site/[projectId]/snag/new`, PhoneSnag.png): photo first with circle mark-up,
  room chips, what's wrong, who fixes it (vendor gets a `wa.me` link), due, severity Minor / Major / Critical (see
  risk 8); snag walk keeps the room. AC (UI 5.7): 10 snags in one room in under 3 minutes.
- [ ] **P3-8 JMR:** measured quantities for selected lines, client confirmation (portal or signed photo), a change order
  per changed line. AC (PS 14): three changed quantities make three change orders with the right ₹ impact.
- [ ] **P3-9 Handover** (`/projects/[id]/handover`, Handover.png): checklist from the template with automatic items
  (snags closed, JMR signed, final proforma sent, vendor bills settled, payment received), files, handover pack PDF,
  client sign-off in the portal (moves the stage to Handover), warranty start and 12 months (decision 14),
  warranty-tagged snags. AC (PS 14): can't complete while any snag is open.
- [ ] **P3-10 Home budget model and maths:** `BudgetPlan` (baselines with date and reason), `BudgetCategory`,
  `ClientPurchase`; forecast, differences, over-budget after contingency and dependency status in `calc.ts`. AC
  (11A, unit): the seed project's forecast equals selected plus unselected plans; over-budget appears only after the
  contingency is used up.
- [ ] **P3-11 Plan vs actual** (`/projects/[id]/home-budget`, HomeBudget.png, UI 5.9): stat cards, alert, category
  table with PlanBar, Edit plan side sheet (re-baselining needs a reason and keeps the earlier one), default categories
  and 3% contingency (decision 19). AC: UI 5.9 Done when.
- [ ] **P3-12 Client purchases** (`/home-budget/purchases`, ClientPurchases.png, UI 5.10): timeline (milestone bars,
  delivery diamonds, decisions, Today line), table with status and dependency chips and sentences, side-sheet form.
  Client purchases never create POs, ledger entries or approvals.
- [ ] **P3-13 Dependency job and attention items:** daily On track / At risk / Overdue, notify the lead designer, list
  on Project Overview. AC (11A): an item past its needed-by date without an order is Overdue the next day and on
  Overview.
- [ ] **P3-14 Client portal Budget tab** (`/c/[token]/budget`, reference 11): forecast, "We need from you", category
  cards; the client marks purchases ordered or delivered (decision 18). AC (11A): the response has no cost, margin,
  vendor names or vendor amounts.

**Exit check:** two live projects tracked with daily DPRs for two weeks · one project snagged and handed over with
client sign-off · journeys 3, 6 and 7 pass.

### Phase 4: Leads and client portal (prompt 05 · PS 15, 16)

- [ ] **P4-1 Leads webhook** `POST /api/leads/inbound`: secret header, rate limited, payload per PS 15, duplicate
  phone becomes an enquiry; `docs/leads-webhook.md` with the exact JSON for Make.com. AC (PS 15): a test lead is on the
  board within 5 s; the same phone twice makes one lead with two enquiries.
- [ ] **P4-2 Leads board** (`/leads`, Leads.png): columns, drag, timers (amber 30 min, red 2 h, notify the assignee),
  filters, manual New lead.
- [ ] **P4-3 Lead detail** (`/leads/[id]`, LeadDetail.png): stage stepper, details, owner, activity, Log call, Open
  WhatsApp, Book site visit, required next follow-up, lost reasons.
- [ ] **P4-4 One quote path:** Start BOQ creates a draft project and BOQ; Mark won opens the New project wizard
  prefilled (`?lead=`) and converts it with nothing retyped. AC (PS 15): winning a lead with a draft BOQ creates the
  project with the BOQ attached.
- [ ] **P4-5 Lead reports:** by source and campaign, stage conversion, time to first contact, won value by month, lost
  reasons.
- [ ] **P4-6 Client portal tabs** (`/c/[token]`, ClientPortal.png): Progress (default), Payments, Docs (Shared files
  only), Snags (raise new), Handover (pack, sign-off) at 390 px; revoke and reissue. AC (PS 9, 16): a Draft file is
  never exposed even if its URL is guessed.
- [ ] **P4-7 Client approves estimate on phone** (`/c/[token]/estimate`, ClientBOQ.png): rework P1-21 to the phone
  design (total, changes since last version, rooms, ask a question on any line, Approve).
- [ ] **P4-8 Client pays a proforma** (`/c/[token]/pay/[proformaId]`, ClientPay.png): balance, bank and UPI details,
  proforma PDF, "I've paid · add reference" notifying Finance to confirm in Client payments.
- [ ] **P4-9 Client-safety sweep:** the automated test requests every `/c/[token]` page and action and fails on any
  cost, margin, note, manpower, blocker or vendor rate field; tries every id swap. AC (PS 16).

**Exit check:** all Meta and WhatsApp leads land on the board for two weeks with no misses · one client uses the
portal for progress and payments · journeys 1, 4 and 10 pass.

### Phase 5: Home and insight (prompt 06 · PS 16 · UI 5.1)

- [ ] **P5-1 Role-based Home** (`/`, Main.png): the PS 16 cards per role, each streamed with its own skeleton,
  "Waiting on you". AC (PS 16): the COO's Home shows every pending approval without opening a project.
- [ ] **P5-2 Insights** (`/insights`, Insights.png): contract value, collected, billed-unpaid, unbilled, vendor
  payables, gross margin, cash in vs out, billed-unpaid by age, who owes us and whom we owe, project health, lead
  pipeline.
- [ ] **P5-3 Notifications page** (`/notifications`, Notifications.png) and the 9 am overdue email, grouped Today /
  This week, Mark all read, settings.
- [ ] **P5-4 Global search** (press /): projects, clients, leads, vendors as you type.
- [ ] **P5-5 Company dashboards:** projects by stage, profit by project and month, overdue client payments, projects
  over budget, lead source and conversion (native charts).
- [ ] **P5-6 Performance and user guide:** PS 21 targets measured on staging (1.5 s pages, 200-line BOQ in 2 s, PDF
  in 5 s); a user guide per module.

**Exit check:** the COO runs the weekly review from Home and dashboards alone · journeys 8 and 9 pass.

---

## 5. Journeys

One Playwright test per journey, walking it with the seed data on staging. A journey is done in the phase that
builds its last screen.

| # | Journey | Screens | Completes in | Note |
| --- | --- | --- | --- | --- |
| 1 | Lead to project | Leads → LeadDetail → BOQ → BOQSend → ClientBOQ → NewProject → ProjectOverview | Phase 4 | Leads and the phone estimate are Phase 4 |
| 2 | Buying for the site | Finance → POCreator → Approvals / PhoneApprovals → SentTracker → Vendors → Transactions | Phase 2 | |
| 3 | A day on site | PhoneDPR → Milestones → DPR → BOQProgress | Phase 3 | |
| 4 | Billing the client | Milestones / Finance → BillingDue → ProformaCreator → SentTracker → ClientPay → ClientPayments | Phase 4 | Passes in Phase 2 with Finance recording the receipt; Client pays added in Phase 4 (kit v2 question 3) |
| 5 | Expense claims | PhoneClaim → MyClaims → Approvals → Reimbursements → Expenses → Transactions | Phase 2 | |
| 6 | The client's home budget | HomeBudget → ClientPurchases → ClientPortal (Budget) | Phase 3 | The portal Budget tab is built with Home budget (P3-14) |
| 7 | Snags and handover | PhoneSnag → Snags → Handover → BillingDue (final stage) → Files | Phase 3 | |
| 8 | Month-end money | Insights → OrgFinance → BillingDue → SentTracker → Transactions → GstTds | Phase 5 | Passes in Phase 2 from the Finance dashboard on; Insights added in Phase 5 (kit v2 question 3) |
| 9 | Running the studio | Login → Main → Notifications → Team → OrgSettings → Catalogue | Phase 5 | Home and Notifications are Phase 5 |
| 10 | The client's side | ClientPortal → ClientBOQ → ClientPay | Phase 4 | |

---

## 6. Risks

1. **Vercel Blob has no true private files.** Blob URLs are public but unguessable. PS 9 wants signed links that expire
   in 10 minutes and a client can never reach a Draft file. Plan (P0-12): never hand out a Blob URL directly; every
   download goes through `/api/files/[id]`, which checks `can()` and the file state, then redirects to the Blob with a
   short-lived signed URL, or streams it if Vercel's private-blob support isn't available on the plan. Revisit if
   Krishna prefers R2 (true signed URLs).
2. **Prisma 6 audit warning.** `npm audit` reports `deepmerge-ts` (stack exhaustion on recursive objects) through the
   Prisma 6 CLI's config loader; the fix is Prisma 7, a breaking change. It runs only at build time on our own schema,
   so it's not reachable by users. Stay on Prisma 6 (CLAUDE.md) and upgrade in a separate PR when Prisma 7 is settled.
3. **Mock-up sample numbers disagree with each other** (Villa Prakruthi is ₹8,34,675 on its BOQ but ₹21,74,268 on the
   Projects list; progress 62% vs 68%). The seed follows the BOQ, Finance and Home budget mock-ups (₹8,34,675 excl. GST,
   v3); screenshots of other screens will differ in their sample figures.
4. **Mock-ups show older BOQ maths.** BOQ.png has "Add GST" unticked and one 18% rate for the whole BOQ. Decision 6 and
   PS 8 win: GST on by default, per-line rates, CGST/SGST or IGST by client state.
5. **Prompt 02a's sidebar** (Home, Leads, Projects, Finance, Team, Settings) predates the screens file. The screens file
   wins (Insights added, Org Settings at the bottom, Approvals in the top bar); the set-up PR already follows it.
6. **Low-margin colour.** The Rate card mock-up shows margins of 31% in red, while decision 8 defaults the warning to
   15%. P1-10 uses 15% unless Krishna says otherwise.
7. **Reimbursement bank details.** The Reimbursements mock-up shows each person's bank account ("HDFC ··4471"), which the
   spec's `User` doesn't have. The schema adds encrypted `User.bankDetails`, set by Admin or Finance, needed by P2-20.
8. **Snag severity.** PhoneSnag.png offers "Normal"; PS 14 has Minor / Major / Critical. The spec wins (fields); the
   phone screen gets the three chips as in reference 07.
9. **Files without mock-ups:** vendor master (`/settings/vendors`), Profile, History, the BOQ sub-pages. They follow UI
   spec section 6 patterns and get a screenshot in their PR for review.
10. **Phone screens offline** (DPR, snags) need a service worker and an upload queue; it's the riskiest front-end piece
    in Phase 3 and may need its own PR (P3-4 may split).
11. **Cron on Vercel:** the 6 am and 9 am jobs (P2-24) need Vercel Cron; the free plan's limits may not fit four daily
    jobs. Check the plan before Phase 2.
12. **Cost leaks are easiest in new endpoints.** The P0-9 safety suites must be extended in every PR that adds a route
    or action; `prompts/review-pr.md` checks for it.

---

## Appendix: target Prisma schema

Validated with `prisma validate` (Prisma 6.19). Applied migration by migration as the tasks above say; not applied in
the set-up PR.

```prisma
// Target schema for Barebase Studio OS: product spec section 17, plus the 11A
// (home budget) and 11B (proformas, Sent & due) tables, plus the technical tables
// the specs imply (marked "technical"). Built up migration by migration, phase by
// phase; this is the end state, not the first migration.
//
// Conventions (PS 17): every table has id (cuid), createdAt, updatedAt and orgId;
// rows a person creates carry createdById. Money is Decimal(14,2), quantities
// Decimal(14,3), percentages Decimal(5,2); never Float. Anything touching money,
// BOQs or clients is soft-deleted (deletedAt). Snapshots and loose references are
// noted where they're deliberate.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================== people

model Organization {
  id                          String         @id @default(cuid())
  name                        String // brand, "Barebase"
  legalName                   String // "Kanchan Integrated Property Development Co."
  address                     String         @default("")
  gstin                       String?
  pan                         String?
  stateCode                   String         @default("29") // Karnataka; decides CGST+SGST vs IGST
  sacCode                     String?
  letterheadKey               String? // Vercel Blob key
  defaultTerms                String         @default("")
  bankDetails                 String? // encrypted JSON: account name, number, IFSC, UPI id (shown on proformas)
  billingTrigger              BillingTrigger @default(BEFORE_DUE_3D) // PS 11B
  leadDesignerCanSendProforma Boolean        @default(false) // PS 11B permissions
  createdAt                   DateTime       @default(now())
  updatedAt                   DateTime       @updatedAt
}

enum OrgRole {
  ADMIN
  COO
  FINANCE
  DESIGN_LEAD
  DESIGNER
  PRE_SALES
  SITE_SUPERVISOR
}

model User {
  id            String    @id @default(cuid())
  orgId         String
  name          String
  email         String    @unique
  phone         String?
  title         String? // "Founder", "Director · Strategy, Tech & Marketing" (Team screen)
  orgRole       OrgRole
  passwordHash  String? // null until the invite is accepted
  active        Boolean   @default(true)
  deactivatedAt DateTime?
  googleLinked  Boolean   @default(false) // after Phase 1 (decision 7)
  bankDetails   String? // encrypted JSON, for reimbursement bank files (Phase 2, see risks)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdById   String?

  memberships ProjectMember[]

  @@index([orgId])
}

model ProjectMember {
  id          String   @id @default(cuid())
  orgId       String
  projectId   String
  userId      String
  projectRole String // free label: "Lead designer", "Designer", "Site supervisor"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  project Project @relation(fields: [projectId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
  @@index([userId])
}

// technical: invite, reset and sign-in links (PS 21). Only a hash of the token is stored.
model AuthToken {
  id        String        @id @default(cuid())
  orgId     String
  userId    String
  kind      AuthTokenKind
  tokenHash String        @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([userId, kind])
}

enum AuthTokenKind {
  INVITE // 7 days
  RESET // 30 minutes
  SIGN_IN_LINK // 15 minutes (kit v2 question 8)
}

// technical: rate limiting for sign-in, reset, client code entry and the leads webhook (PS 21).
model RateLimitHit {
  id        String   @id @default(cuid())
  bucket    String // "login:<email>", "client-code:<contactId>", "leads-webhook:<ip>"
  createdAt DateTime @default(now())

  @@index([bucket, createdAt])
}

// technical: one row per create or approval request, so a double click records once (UI spec 6).
model IdempotencyKey {
  key       String   @id
  orgId     String
  userId    String
  result    Json?
  createdAt DateTime @default(now())
}

// technical: codes that are never reused (PS 19): BB-26-014, PO-03, SNG-007, VEN-042, PR-26-0001, PI-26-0048.
model Sequence {
  id        String   @id @default(cuid())
  orgId     String
  kind      String // "project:2026", "po:<projectId>", "snag:<projectId>", "vendor", "payment-request:2026", "proforma:2026"
  next      Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, kind])
}

// =============================================================== leads (PS 15)

enum LeadStage {
  NEW
  CONTACTED
  QUALIFIED
  SITE_VISIT_BOOKED
  PROPOSAL_SENT
  NEGOTIATION
  WON
  LOST
}

model Lead {
  id             String    @id @default(cuid())
  orgId          String
  name           String
  phone          String // validated 10-digit mobile; duplicate check key
  email          String?
  city           String?
  locality       String?
  source         String // Meta form, website, WhatsApp, referral, walk-in
  campaign       String?
  propertyType   String?
  spaceType      String?
  budgetRange    String?
  newOrReno      String?
  possession     String?
  formAnswers    Json?
  watiContactId  String?
  stage          LeadStage @default(NEW)
  assignedToId   String?
  nextFollowUp   DateTime?
  firstContactAt DateTime?
  lostReason     String?
  notes          String    @default("")
  projectId      String?   @unique
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdById    String?
  deletedAt      DateTime?

  activities LeadActivity[]
  enquiries  LeadEnquiry[]
  project    Project?       @relation(fields: [projectId], references: [id])

  @@index([orgId, stage])
  @@index([orgId, phone])
}

// technical: a repeat lead from the webhook becomes an enquiry on the existing lead (PS 15).
model LeadEnquiry {
  id        String   @id @default(cuid())
  orgId     String
  leadId    String
  source    String
  campaign  String?
  payload   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lead Lead @relation(fields: [leadId], references: [id])
}

enum LeadActivityType {
  CALL
  WHATSAPP
  NOTE
  VISIT
  STAGE
  SYSTEM
}

model LeadActivity {
  id          String           @id @default(cuid())
  orgId       String
  leadId      String
  type        LeadActivityType
  text        String
  at          DateTime         @default(now())
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  createdById String?

  lead Lead @relation(fields: [leadId], references: [id])

  @@index([leadId, at])
}

// =============================================================== clients

model Client {
  id             String    @id @default(cuid())
  orgId          String
  name           String
  phone          String?
  email          String?
  billingAddress String    @default("")
  stateCode      String? // from billing address or GSTIN; decides IGST
  gstin          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdById    String?
  deletedAt      DateTime?

  projects Project[]
  contacts ClientContact[]

  @@index([orgId])
}

model ClientContact {
  id          String    @id @default(cuid())
  orgId       String
  clientId    String
  projectId   String
  name        String
  email       String
  phone       String?
  tokenHash   String    @unique // the link token is shown once; only its hash is stored
  revoked     Boolean   @default(false)
  lastSeenAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdById String?
  deletedAt   DateTime?

  client  Client         @relation(fields: [clientId], references: [id])
  project Project        @relation(fields: [projectId], references: [id])
  devices ClientDevice[]
  reviews LineReview[]

  @@index([projectId])
}

// technical: the 6-digit email code and the 30-day remembered device (PS 16).
model ClientDevice {
  id          String    @id @default(cuid())
  orgId       String
  contactId   String
  codeHash    String?
  codeExpires DateTime?
  verifiedAt  DateTime?
  expiresAt   DateTime? // 30 days after verification
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  contact ClientContact @relation(fields: [contactId], references: [id])
}

// =============================================================== projects (PS 6)

enum ProjectStage {
  DESIGN
  QUOTATION
  APPROVED
  EXECUTION
  SNAGGING
  HANDOVER
  CLOSED
}

enum SideState {
  ON_HOLD
  LOST
  REOPENED
}

model Project {
  id                String       @id @default(cuid())
  orgId             String
  code              String       @unique // BB-26-014
  name              String
  clientId          String
  leadDesignerId    String
  siteAddress       String?
  mapsUrl           String?
  type              String? // Residential, Commercial
  scope             String[] // Design, Interiors, Civil, Turnkey
  areaSqft          Decimal?     @db.Decimal(10, 2)
  estimatedValue    Decimal?     @db.Decimal(14, 2)
  siteExpenseBudget Decimal?     @db.Decimal(14, 2) // Expenses screen
  stage             ProjectStage @default(DESIGN)
  sideState         SideState?
  keyDates          Json? // site visit, design freeze target, execution start, handover target
  designFrozenAt    DateTime?
  warrantyStart     DateTime?
  warrantyMonths    Int          @default(12) // decision 14
  notes             String       @default("")
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  createdById       String?
  deletedAt         DateTime?

  client   Client          @relation(fields: [clientId], references: [id])
  lead     Lead?
  members  ProjectMember[]
  contacts ClientContact[]
  boq      Boq?

  @@index([orgId, stage])
}

// =============================================================== catalogue (PS 7)

enum UnitDims {
  NONE
  L
  LB
  LBH
}

model Category {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  code        String // "WD" for item codes like WD-014
  position    Int      @default(0)
  addToNewBoq Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([orgId, name])
}

model Material {
  id        String   @id @default(cuid())
  orgId     String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, name])
}

model Finish {
  id        String   @id @default(cuid())
  orgId     String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, name])
}

model Unit {
  id         String   @id @default(cuid())
  orgId      String
  name       String // "sq ft", "rft", "cu ft", "Nos", "lumpsum"
  dimensions UnitDims
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([orgId, name])
}

model Item {
  id           String    @id @default(cuid())
  orgId        String
  code         String // WD-014; CSV import matches on this
  name         String
  categoryId   String
  materialId   String?
  finishId     String?
  unitId       String
  sellingRate  Decimal   @db.Decimal(14, 2)
  costPrice    Decimal?  @db.Decimal(14, 2) // cost viewers only, stripped on the server
  gstRate      Decimal   @default(18) @db.Decimal(5, 2)
  hsn          String?
  defaultScope String    @default("")
  imageKey     String?
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  createdById  String?
  deletedAt    DateTime?

  @@unique([orgId, code])
  @@index([orgId, categoryId])
}

// =============================================================== BOQ (PS 8)

enum DiscountType {
  PERCENT
  AMOUNT
}

model Boq {
  id            String       @id @default(cuid())
  orgId         String
  projectId     String       @unique
  name          String       @default("BOQ")
  mainVersionId String?      @unique
  discountType  DiscountType @default(PERCENT)
  discountValue Decimal      @default(0) @db.Decimal(14, 2)
  gstOn         Boolean      @default(true)
  clientColumns Json // { material, finish, measurements, quantity, rate }
  terms         String       @default("")
  lockedById    String?
  lockedAt      DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  createdById   String?
  deletedAt     DateTime?

  project      Project       @relation(fields: [projectId], references: [id])
  rooms        Room[]
  versions     Version[]     @relation("BoqVersions")
  mainVersion  Version?      @relation("MainVersion", fields: [mainVersionId], references: [id])
  changeOrders ChangeOrder[]
}

model Room {
  id          String    @id @default(cuid())
  orgId       String
  boqId       String
  name        String
  note        String    @default("")
  position    Int
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdById String?
  deletedAt   DateTime?

  boq   Boq    @relation(fields: [boqId], references: [id])
  lines Line[]

  @@index([boqId, position])
}

// The live draft's lines. Rates and scope are copied from Item when added, never read live (PS 17 notes).
model Line {
  id           String    @id @default(cuid())
  orgId        String
  roomId       String
  itemId       String? // loose: the catalogue item it was copied from
  isCustom     Boolean   @default(false)
  name         String
  categoryId   String?
  material     String    @default("")
  finish       String    @default("")
  unit         String
  dims         UnitDims  @default(NONE)
  dimL         Decimal?  @db.Decimal(14, 3)
  dimB         Decimal?  @db.Decimal(14, 3)
  dimH         Decimal?  @db.Decimal(14, 3)
  qty          Decimal   @default(0) @db.Decimal(14, 3)
  qtyOverride  Boolean   @default(false)
  count        Int       @default(1)
  sellingRate  Decimal   @db.Decimal(14, 2)
  rateOverride Boolean   @default(false)
  costPrice    Decimal?  @db.Decimal(14, 2) // cost viewers only
  gstRate      Decimal   @default(18) @db.Decimal(5, 2)
  scope        String    @default("")
  note         String    @default("") // internal; never sent to a client
  photoKey     String?
  position     Int
  milestoneId  String?
  progressPct  Decimal   @default(0) @db.Decimal(5, 2)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  createdById  String?
  deletedAt    DateTime? // 10-second undo (UI spec 6)

  room      Room       @relation(fields: [roomId], references: [id])
  milestone Milestone? @relation(fields: [milestoneId], references: [id])

  @@index([roomId, position])
}

enum VersionStatus {
  DRAFT
  SENT
  APPROVED
  PARTLY_APPROVED
  SUPERSEDED
}

// A frozen snapshot of every room and line (PS 8). Sent and approved versions are never updated.
model Version {
  id          String        @id @default(cuid())
  orgId       String
  boqId       String
  number      Int
  status      VersionStatus @default(DRAFT)
  snapshot    Json // rooms, lines and settings as they were; totals computed by calc.ts and stored alongside
  totals      Json // subtotal, discount, taxable, GST per band, grand total, cost (stripped for non-cost viewers)
  reviewBy    DateTime? // default 7 days after sending (PS 11B)
  sentAt      DateTime?
  sentById    String?
  approvedAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  createdById String?

  boq          Boq           @relation("BoqVersions", fields: [boqId], references: [id])
  mainOf       Boq?          @relation("MainVersion")
  reviews      LineReview[]
  changeOrders ChangeOrder[]

  @@unique([boqId, number])
}

enum Verdict {
  APPROVED
  CHANGE
  REJECTED
}

model LineReview {
  id          String    @id @default(cuid())
  orgId       String
  versionId   String
  contactId   String
  lineId      String // loose reference, no foreign key: the verdict outlives the line (PS 17 notes)
  verdict     Verdict?
  comment     String?
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  version Version       @relation(fields: [versionId], references: [id])
  contact ClientContact @relation(fields: [contactId], references: [id])

  @@unique([versionId, contactId, lineId])
}

enum ChangeKind {
  ADDED
  REMOVED
  MODIFIED
}

enum ChangeSource {
  EDIT
  JMR
}

model ChangeOrder {
  id                 String       @id @default(cuid())
  orgId              String
  code               String // CO-02
  boqId              String
  versionId          String?
  lineId             String // loose reference
  roomName           String
  lineName           String
  kind               ChangeKind
  changes            Json // [{ field, from, to }]
  amountImpact       Decimal      @db.Decimal(14, 2)
  reason             String
  source             ChangeSource @default(EDIT)
  approvedByClientAt DateTime?
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  createdById        String?

  boq     Boq      @relation(fields: [boqId], references: [id])
  version Version? @relation(fields: [versionId], references: [id])
}

// =============================================================== files (PS 9)

enum FileState {
  DRAFT
  APPROVED
  SHARED
}

model Folder {
  id        String   @id @default(cuid())
  orgId     String
  projectId String
  name      String // defaults from Settings; see question 2
  position  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  files File[]

  @@unique([projectId, name])
}

model File {
  id           String    @id @default(cuid())
  orgId        String
  projectId    String
  folderId     String
  name         String
  key          String // Vercel Blob key; downloads are signed and expire after 10 minutes
  size         Int
  mime         String
  version      Int       @default(1)
  parentFileId String? // V1 of a stack of versions
  state        FileState @default(DRAFT)
  afterFreeze  Boolean   @default(false)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  createdById  String?
  deletedAt    DateTime?

  folder Folder @relation(fields: [folderId], references: [id])

  @@index([projectId, folderId])
}

// Bills, proofs, receipts, PO attachments, DPR and snag photos.
model Attachment {
  id          String   @id @default(cuid())
  orgId       String
  ownerType   String // "ledger_entry", "purchase_order", "dpr", "snag", "client_purchase"
  ownerId     String
  fileKey     String
  caption     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  @@index([ownerType, ownerId])
}

// technical: comments with @mentions on files, tasks and approvals (PS 9, 12, 13).
model Comment {
  id          String    @id @default(cuid())
  orgId       String
  entityType  String
  entityId    String
  body        String
  mentions    String[] // user ids
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  createdById String
  deletedAt   DateTime?

  @@index([entityType, entityId])
}

// =============================================================== vendors and POs (PS 10)

enum VendorStatus {
  ACTIVE
  INACTIVE
  BLACKLISTED
}

model Vendor {
  id            String       @id @default(cuid())
  orgId         String
  code          String // VEN-042
  name          String
  tags          String[] // Carpentry, Civil, Electrical, Plumbing, Painting, Fabrication, Supplier, Labour, Other
  contactPerson String?
  phone         String
  email         String?
  pan           String?
  gstin         String?
  stateCode     String?
  bank          String? // encrypted JSON; Admin and Finance only
  address       String?
  tdsSection    String?
  isCompany     Boolean      @default(false) // 194C: 1% individual, 2% company
  status        VendorStatus @default(ACTIVE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  createdById   String?
  deletedAt     DateTime?

  purchaseOrders PurchaseOrder[]

  @@unique([orgId, code])
}

enum PoStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT
  PARTLY_BILLED
  FULLY_BILLED
  CLOSED
  CANCELLED
  REJECTED
  ON_HOLD
}

model PurchaseOrder {
  id               String    @id @default(cuid())
  orgId            String
  projectId        String
  vendorId         String
  number           String // BB-26-014/PO-03
  revision         Int       @default(0)
  supersedesId     String? // the revision this replaces
  status           PoStatus  @default(DRAFT)
  date             DateTime
  dueDate          DateTime? // work or delivery date (Sent & due)
  siteAddress      String?
  terms            String    @default("")
  notes            String    @default("")
  overBudgetReason String?
  taxable          Decimal   @db.Decimal(14, 2)
  cgst             Decimal   @default(0) @db.Decimal(14, 2)
  sgst             Decimal   @default(0) @db.Decimal(14, 2)
  igst             Decimal   @default(0) @db.Decimal(14, 2)
  total            Decimal   @db.Decimal(14, 2)
  pdfKey           String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  createdById      String?
  deletedAt        DateTime?

  vendor Vendor   @relation(fields: [vendorId], references: [id])
  lines  PoLine[]

  @@unique([orgId, number, revision])
  @@index([projectId])
}

model PoLine {
  id            String   @id @default(cuid())
  orgId         String
  poId          String
  lineId        String? // the BOQ line (main version); null for free lines like a labour lot
  description   String
  qty           Decimal  @db.Decimal(14, 3)
  unit          String
  orderRate     Decimal  @db.Decimal(14, 2) // order rate: cost data, stripped for non-cost viewers
  gstRate       Decimal  @db.Decimal(5, 2)
  amount        Decimal  @db.Decimal(14, 2)
  overQtyReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  po PurchaseOrder @relation(fields: [poId], references: [id])
}

// =============================================================== money (PS 11, 11B, 19)

enum LedgerKind {
  CLIENT_RECEIPT
  VENDOR_BILL
  VENDOR_PAYMENT
  EXPENSE
  REIMBURSEMENT
  REVERSAL
}

enum PriceMode {
  INCLUSIVE
  EXCLUSIVE
}

enum LedgerStatus {
  PENDING_APPROVAL
  ON_HOLD
  REJECTED
  APPROVED
  PAID
  RECORDED // receipts and bills, which need no payout
}

// The single source for every finance report (PS 17 notes). Rows are created only by the action
// that caused them; corrections are REVERSAL rows, never edits (screens-and-journeys rules).
model LedgerEntry {
  id               String       @id @default(cuid())
  orgId            String
  projectId        String? // null = office / no project
  kind             LedgerKind
  category         String?
  description      String       @default("")
  vendorId         String?
  poId             String?
  proformaId       String? // receipts against a proforma
  paymentRequestId String?
  billNo           String? // vendor bills
  payeeUserId      String? // reimbursements
  priceMode        PriceMode    @default(EXCLUSIVE)
  taxable          Decimal      @db.Decimal(14, 2)
  gstRate          Decimal      @db.Decimal(5, 2)
  cgst             Decimal      @default(0) @db.Decimal(14, 2)
  sgst             Decimal      @default(0) @db.Decimal(14, 2)
  igst             Decimal      @default(0) @db.Decimal(14, 2)
  tds              Decimal      @default(0) @db.Decimal(14, 2)
  total            Decimal      @db.Decimal(14, 2)
  date             DateTime
  mode             String? // UPI, NEFT/RTGS, cheque, cash
  reference        String? // UTR or cheque number
  status           LedgerStatus
  paidAt           DateTime?
  reversesId       String?      @unique
  kmCount          Decimal?     @db.Decimal(10, 2) // fuel claims
  ratePerKm        Decimal?     @db.Decimal(10, 2)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  createdById      String

  @@index([orgId, date])
  @@index([projectId, kind])
}

enum PaymentStageStatus {
  UPCOMING
  DUE
  REQUESTED
  RECEIVED
}

enum BillingState {
  WAITING
  DRAFTED
  SENT
  PAID
}

model PaymentStage {
  id                String             @id @default(cuid())
  orgId             String
  projectId         String
  name              String // "Stage 3 · Carpentry 40%"
  position          Int
  pct               Decimal            @db.Decimal(5, 2)
  amount            Decimal            @db.Decimal(14, 2)
  milestoneId       String?
  status            PaymentStageStatus @default(UPCOMING)
  billingState      BillingState       @default(WAITING) // PS 11B
  draftedProformaId String?            @unique
  draftedAt         DateTime?
  cancelledAt       DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  createdById       String?

  milestone Milestone? @relation(fields: [milestoneId], references: [id])

  @@index([projectId, position])
}

enum PaymentDirection {
  CLIENT
  VENDOR
}

enum PaymentRequestStatus {
  DRAFT
  PENDING_APPROVAL
  ON_HOLD
  REJECTED
  APPROVED
  PARTLY_PAID
  PAID
}

model PaymentRequest {
  id          String               @id @default(cuid())
  orgId       String
  code        String // PR-26-0001
  projectId   String
  direction   PaymentDirection
  stageId     String?
  poId        String?
  billId      String? // the VENDOR_BILL ledger entry
  amount      Decimal              @db.Decimal(14, 2)
  dueDate     DateTime?
  note        String               @default("")
  status      PaymentRequestStatus @default(DRAFT)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  createdById String
  deletedAt   DateTime?

  @@unique([orgId, code])
}

enum ProformaStatus {
  DRAFT
  SENT
  PART_PAID
  PAID
  CANCELLED
}

model Proforma {
  id             String         @id @default(cuid())
  orgId          String
  projectId      String
  number         String? // PI-26-0048, reserved only when sent (PS 11B)
  paymentStageId String?
  changeOrderId  String?
  description    String
  sac            String?
  taxable        Decimal        @db.Decimal(14, 2)
  cgst           Decimal        @default(0) @db.Decimal(14, 2)
  sgst           Decimal        @default(0) @db.Decimal(14, 2)
  igst           Decimal        @default(0) @db.Decimal(14, 2)
  total          Decimal        @db.Decimal(14, 2)
  dueDate        DateTime
  status         ProformaStatus @default(DRAFT)
  pdfKey         String?
  updatedReason  String? // "Updated after change order CO-02"
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  createdById    String?
  deletedAt      DateTime?

  @@unique([orgId, number])
  @@index([projectId, status])
}

enum SentDocType {
  PROFORMA
  PO
  BOQ_VERSION
  TAX_INVOICE
}

enum DueKind {
  PAYMENT
  DELIVERY
  REVIEW
}

enum SentFlag {
  ON_TRACK
  DUE_SOON
  OVERDUE
  CLOSED
}

model SentDocument {
  id             String      @id @default(cuid())
  orgId          String
  docType        SentDocType
  docId          String
  projectId      String
  recipientType  String // client_contact, vendor
  recipientId    String
  sentAt         DateTime
  sentById       String
  channel        String // email, portal, whatsapp_link
  openedAt       DateTime?
  acknowledgedAt DateTime?
  dueAt          DateTime
  dueKind        DueKind
  status         String // sent, opened, acknowledged, part_paid, paid, work_done, billed, reviewed
  flag           SentFlag    @default(ON_TRACK) // recalculated daily at 9 am
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  reminders Reminder[]

  @@unique([docType, docId])
  @@index([orgId, flag])
}

model Reminder {
  id             String   @id @default(cuid())
  orgId          String
  sentDocumentId String
  sentAt         DateTime @default(now())
  sentById       String
  channel        String
  message        String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  sentDocument SentDocument @relation(fields: [sentDocumentId], references: [id])
}

// =============================================================== approvals (PS 12)

enum ApprovalItemType {
  VENDOR_PAYMENT
  PURCHASE_ORDER
  EXPENSE_CLAIM
  COMPANY_EXPENSE
  CLIENT_DISCOUNT
}

model ApprovalRule {
  id        String           @id @default(cuid())
  orgId     String
  itemType  ApprovalItemType
  minAmount Decimal          @db.Decimal(14, 2)
  maxAmount Decimal?         @db.Decimal(14, 2) // null = no upper limit
  levels    Json // [[userId, ...], [userId, ...]]: any one user at a level approves it
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([orgId, itemType])
}

// technical: one engine for every money item. The path is copied from the rule when the
// request is submitted, so changing slabs never moves a request already in flight.
model ApprovalRequest {
  id           String           @id @default(cuid())
  orgId        String
  itemType     ApprovalItemType
  itemId       String // PaymentRequest, PurchaseOrder or LedgerEntry id
  projectId    String?
  requesterId  String
  amount       Decimal          @db.Decimal(14, 2)
  path         Json // levels at submit time
  currentLevel Int              @default(1)
  status       String // pending_approval, on_hold, rejected, approved
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  steps ApprovalStep[]

  @@unique([itemType, itemId])
  @@index([orgId, status])
}

enum ApprovalDecision {
  SUBMITTED
  APPROVED
  REJECTED
  HELD
  RESUMED
  RESUBMITTED
  RESET // amount edited: back to level 1
  PAID
}

model ApprovalStep {
  id         String           @id @default(cuid())
  orgId      String
  requestId  String
  itemType   ApprovalItemType
  itemId     String
  level      Int
  approverId String?
  decision   ApprovalDecision
  note       String?
  at         DateTime         @default(now())
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  request ApprovalRequest @relation(fields: [requestId], references: [id])

  @@index([itemType, itemId])
}

// =============================================================== execution (PS 13)

enum MilestoneStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETE
  DELAYED
}

model Milestone {
  id           String          @id @default(cuid())
  orgId        String
  projectId    String
  parentId     String? // sub-tasks on the Gantt chart (kit v2 question 4)
  name         String
  position     Int
  plannedStart DateTime
  plannedEnd   DateTime
  forecastEnd  DateTime?
  status       MilestoneStatus @default(NOT_STARTED)
  completedAt  DateTime?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  createdById  String?

  lines           Line[]
  stages          PaymentStage[]
  clientPurchases ClientPurchase[]

  @@index([projectId, position])
}

model ProgressUpdate {
  id        String   @id @default(cuid())
  orgId     String
  lineId    String
  fromPct   Decimal  @db.Decimal(5, 2)
  toPct     Decimal  @db.Decimal(5, 2)
  qtyDone   Decimal? @db.Decimal(14, 3)
  photoKeys String[]
  byId      String
  at        DateTime @default(now())
  dprId     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lineId, at])
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  IN_REVIEW
  ON_HOLD
  COMPLETED
  CANCELLED
}

model Task {
  id           String     @id @default(cuid())
  orgId        String
  projectId    String
  milestoneId  String?
  title        String
  description  String     @default("")
  status       TaskStatus @default(OPEN)
  highPriority Boolean    @default(false)
  assigneeId   String?
  start        DateTime?
  due          DateTime?
  checklist    Json?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  createdById  String?
  deletedAt    DateTime?

  @@index([projectId, status])
}

model Dpr {
  id              String   @id @default(cuid())
  orgId           String
  projectId       String
  date            DateTime @db.Date // India date; one per project per day
  byId            String
  workDone        String
  manpower        Json // { carpenters: 4, helpers: 2, ... }
  materials       String?
  blockers        String? // internal; never shown to the client
  tomorrow        String?
  weather         String?
  shareWithClient Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([projectId, date])
}

// =============================================================== close-out (PS 14)

enum SnagStatus {
  OPEN
  FIXED
  VERIFIED
  CLOSED
  WONT_FIX
}

enum SnagSeverity {
  MINOR
  MAJOR
  CRITICAL
}

model Snag {
  id               String       @id @default(cuid())
  orgId            String
  projectId        String
  code             String // SNG-007
  roomId           String?
  lineId           String?
  title            String
  category         String // Carpentry, Civil, Electrical, Plumbing, Painting, Finish, Other
  severity         SnagSeverity @default(MINOR)
  assigneeUserId   String?
  assigneeVendorId String?
  committedDate    DateTime?
  status           SnagStatus   @default(OPEN)
  beforePhotoKey   String
  markup           Json? // circle mark-up on the photo (PhoneSnag)
  afterPhotoKey    String?
  wontFixReason    String?
  raisedByClient   Boolean      @default(false)
  warranty         Boolean      @default(false)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  createdById      String?
  deletedAt        DateTime?

  @@unique([projectId, code])
}

model Jmr {
  id             String    @id @default(cuid())
  orgId          String
  projectId      String
  confirmedAt    DateTime?
  confirmedBy    String? // client contact id, or "photo" when a signed copy is uploaded
  signedPhotoKey String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdById    String?

  lines JmrLine[]
}

model JmrLine {
  id          String   @id @default(cuid())
  orgId       String
  jmrId       String
  lineId      String
  boqQty      Decimal  @db.Decimal(14, 3)
  measuredQty Decimal  @db.Decimal(14, 3)
  dims        Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  jmr Jmr @relation(fields: [jmrId], references: [id])
}

model HandoverItem {
  id        String    @id @default(cuid())
  orgId     String
  projectId String
  label     String
  auto      Boolean   @default(false) // ticked by the tool: snags closed, payment received
  done      Boolean   @default(false)
  doneById  String?
  doneAt    DateTime?
  fileKey   String?
  position  Int
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([projectId, position])
}

model HandoverSignOff {
  id         String   @id @default(cuid())
  orgId      String
  projectId  String   @unique
  contactId  String
  signedName String
  signedAt   DateTime
  packKey    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// =============================================================== home budget (PS 11A)

enum BudgetOwner {
  BAREBASE
  CLIENT
  RESERVE
}

model BudgetPlan {
  id           String   @id @default(cuid())
  orgId        String
  projectId    String
  baselineDate DateTime
  reason       String? // required when re-baselining
  isCurrent    Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdById  String?

  categories BudgetCategory[]

  @@index([projectId, isCurrent])
}

model BudgetCategory {
  id            String      @id @default(cuid())
  orgId         String
  planId        String
  name          String
  owner         BudgetOwner
  plannedAmount Decimal     @db.Decimal(14, 2)
  position      Int
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  plan      BudgetPlan       @relation(fields: [planId], references: [id])
  purchases ClientPurchase[]
}

enum PurchaseStatus {
  NOT_STARTED
  SELECTING
  SELECTED
  ORDERED
  DELIVERED
  INSTALLED
}

enum DependencyType {
  NEEDS
  BLOCKS
}

model ClientPurchase {
  id               String          @id @default(cuid())
  orgId            String
  projectId        String
  categoryId       String
  name             String
  roomIds          String[]
  supplierText     String          @default("")
  price            Decimal         @db.Decimal(14, 2)
  priceIsSelected  Boolean         @default(false)
  status           PurchaseStatus  @default(NOT_STARTED)
  expectedDelivery DateTime?
  neededBy         DateTime?
  milestoneId      String?
  dependencyType   DependencyType?
  paidByClient     Decimal?        @db.Decimal(14, 2)
  notes            String          @default("")
  photoKey         String?
  link             String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  createdById      String?
  deletedAt        DateTime?

  category  BudgetCategory @relation(fields: [categoryId], references: [id])
  milestone Milestone?     @relation(fields: [milestoneId], references: [id])

  @@index([projectId])
}

// =============================================================== settings (technical)

// Templates from Settings: payment schedule, milestones, handover checklist, payment terms, file folders.
model Template {
  id        String   @id @default(cuid())
  orgId     String
  kind      String // payment_schedule, milestones, handover, payment_terms, folders
  name      String
  body      Json
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId, kind])
}

// Lists an Admin can edit: expense categories, TDS sections and rates (PS 11, 19).
model SettingList {
  id        String   @id @default(cuid())
  orgId     String
  kind      String // expense_category, tds_section
  value     String
  meta      Json? // { individualRate: "1.00", companyRate: "2.00" } for TDS
  position  Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orgId, kind, value])
}

// =============================================================== system

enum ActorType {
  TEAM
  CLIENT
  SYSTEM
}

model AuditEvent {
  id         String    @id @default(cuid())
  orgId      String
  projectId  String?
  entityType String
  entityId   String
  action     String
  actorType  ActorType
  actorId    String?
  actorName  String // kept so the log reads the same after a user is renamed or removed
  before     Json?
  after      Json?
  at         DateTime  @default(now())

  @@index([orgId, at])
  @@index([projectId, at])
  @@index([entityType, entityId])
}

model Notification {
  id         String    @id @default(cuid())
  orgId      String
  userId     String
  type       String
  entityType String
  entityId   String
  title      String
  body       String?
  count      Int       @default(1) // grouped: "3 comments on Villa 33 BOQ" (PS 16)
  read       Boolean   @default(false)
  emailedAt  DateTime?
  at         DateTime  @default(now())
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId, read, at])
}

model NotificationPreference {
  id        String   @id @default(cuid())
  orgId     String
  userId    String
  type      String
  email     Boolean  @default(true) // in-app is always on
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, type])
}

enum BillingTrigger {
  BEFORE_DUE_3D
  ON_COMPLETE
}
```
