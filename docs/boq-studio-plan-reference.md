# Barebase Studio OS: build plan

Written 15 Oct 2026 from the kickoff prompt (`prompts/00-kickoff.md`), then updated the same day with Krishna's
answers. No app code has changed yet.

**Read this first.** The kit was written for the minERP codebase (erp.fabrum.org). By Krishna's choice on
15 Oct 2026, it is being built in **this repo (barebase-boq-app, "BOQ Studio")** instead. Krishna confirmed this
(decision 1): minERP is retired as it stands. That flips the product spec's starting point. The spec says
"keep minERP's catalogue, task board, members and history, and port BOQ Studio's commercial features". Here
it's the other way round: the commercial BOQ features already exist, and the minERP parts have to be built.
Section 1 maps what exists.

Paths: this repo keeps code under `src/` with the `@/` alias. Where the specs say `lib/calc.ts`, read
`src/lib/calc.ts`, and `styles/tokens.css` becomes `src/styles/tokens.css`.

---

## Decisions from Krishna (15 Oct 2026)

These answer the kickoff questions and override the defaults that were listed there.

| # | Question | Answer |
| --- | --- | --- |
| 1 | Base codebase | **BOQ Studio (this repo) is the base.** minERP is retired as it stands. No data import for now; its catalogue may come later as a CSV |
| 2 | Live data | **Migrate in place**, with a full rehearsal on the staging database first |
| 3 | Staging | Neon branch **"staging"** created from production. Vercel Production → production `DATABASE_URL`; Vercel Preview → staging. Preview builds must never migrate production, and tests must never run against production (task P0-0c) |
| 4 | Email | **Resend**, sending from `studio@barebase.in`. Krishna adds the DNS records |
| 5 | Roles | Krishna Admin · Harish Admin · Ridhi COO · Mansi Design lead · Keertan Designer · Anamika Pre-sales · Ananya Pre-sales. Krishna adds the Finance users himself |
| 6 | Old BOQ maths | **Agreed.** Sent and approved versions keep their current maths. Only new drafts use the spec's maths |
| 7 | Google sign-in | **After Phase 1** |
| 8 | File storage | **Vercel Blob** |

Product spec section 23 decisions still use their defaults. Decisions 1, 2, 8, 9, 10 and 16 are needed in
Phase 1. Decision 16 is answered by decision 1: there's no minERP import, and live BOQ Studio projects
migrate in place.

**Still waiting on:** the updated kit (product spec 11A Home budget and client purchases, product spec 11
Vendors & bills, UI spec 5.8 to 5.11). The current `docs/` files are the 8 Oct versions. The Phase 2 and
Phase 3 tasks for the new sections below are placeholders until those files arrive.

---

## 1. Current state

A single Next.js 16 App Router app (React 19, TypeScript) on Vercel, using Postgres through Prisma 6. Auth is
email and password (bcrypt) with a JWT in an httpOnly cookie, and the user's `active` flag is checked on every
request. Styles are plain CSS in `src/app/globals.css` (Warm Ledger look, no Tailwind). PDFs come from
jsPDF, client-side, with a DejaVu font. Tests are 52 Playwright end-to-end tests in `tests/` with no unit
tests. There's no lint, no CI and no error tracking.

### The gap table (product spec §3), corrected for this codebase

| Area | Spec says (minERP) | This codebase today | Action here |
| --- | --- | --- | --- |
| Sign-up | Open registration | **No sign-up exists.** Users are created on `/team` (`src/actions/team.ts`) | Replace admin-typed passwords with invite email; add reset (§21) |
| Roles | 5 roles | `Role` enum: `ADMIN`, `MEMBER`. Checks are scattered (`requireAdmin`, `user.role === "ADMIN"`) | Seven org roles, `ProjectMember`, one `can()` helper (§18) |
| Passwords | No reset or change | Change exists (`/account`, `changeOwnPassword`). No reset. Admin types a starting password. Minimum is 8, not 10 | Invite and reset links; minimum 10 |
| Projects | Status stuck on Active | `Project` is the BOQ itself (name, client name as text, BOQ settings, `status` = BOQ status). No code, client record, lead designer, dates or stages | Full project record and automatic stages (§6) |
| Catalogue | Separate lists, units with dimensions | `RateItem`: category, name, material and finish **as free text**, unit (dimensions inferred from SQFT/RFT/CFT), `rate`, `cost`, `defaultScope`. CSV import and export with preview exist (`src/actions/rate-card-import.ts`) | Add item code, GST %, HSN, image, active, unit table with dimensions; rename rate → selling rate, cost → cost price (§7) |
| BOQ | Versions, category sections | **Most of §8 exists**: room sections, custom items, typed-over quantity, count, discount, GST, cost and margin, scope, note, photo, client columns, client and internal PDFs, import from project, duplicate project, autosave with a conflict check (`saveBoq` `expectedUpdatedAt`) | Gaps: Decimal money, per-line GST and IGST, GST-band discount, rate-override marker, versions that can't be edited, Partly approved and Superseded, main version, compare, edit lock, item picker |
| Client review | Password link | Per-contact token link with an email check (not a code), a 30-day device pass, per-line Approve / Request change / Reject, "Done" submit, diff against what was last approved, Client Review screen (`/projects/[id]/review`) | Add the 6-digit email code, revoke on reissue (exists), notifications |
| Change orders | — | Created automatically when a version is saved after an approval (`src/lib/versions.ts`). **No reason captured** | Reason required, ₹ impact, shown on the client view (§8) |
| Tasks | Board | **None** | Build (§13) |
| History | Shown in UTC | `AuditEvent` per project (actor type and name, action, JSON detail), with a PDF export. **The UTC bug exists here too**: `toLocaleTimeString` has no `timeZone` in `src/app/(app)/projects/[id]/page.tsx:113,330`, `AuditLogButton.tsx`, `ClientPortal.tsx`, and `fmtDate` in `src/lib/boq.ts` | Fix in Phase 0. Give audit events entity, actor id and before/after |
| Vendors, finance, DPR, snags, files, leads | None | None | Build (§9 to §15) |
| Money storage | — | **`Float` everywhere** (`rate`, `cost`, `qty`, `discountValue`, `gstRate`) | Decimal(14,2) with `src/lib/calc.ts` (CLAUDE.md non-negotiable) |
| Files | — | Line photos stored as **compressed data URLs in the database** (`LineItem.image`) and inside version snapshots | Object storage with signed URLs |
| Deletes | — | **`deleteProject` hard-deletes** and cascades versions, approvals, change orders and audit. Any signed-in user can call it (`src/actions/projects.ts:49`) | Soft delete plus permission check: Phase 0, top priority |
| Status changes | — | `setVersionStatus` lets any team member set any version to Draft, Sent or **Approved** by hand (`src/actions/approvals.ts:100`) | Replace with the BOQ version status machine (UI spec §4) |
| Speed | 2.5 to 9.3 s | Not measured | Measure on staging in Phase 0 |
| Data checks | 9-digit phones accepted | Only email format is checked | `src/lib/validate.ts` for phone, email, GSTIN, PAN and IFSC |

### What maps cleanly onto the spec already

- **Cost is private:** already enforced on the server for non-admins. `loadBoq`, rate card and import payloads
  zero `cost`, and `saveBoq` never writes cost from a non-admin (`resolveCost`). It's ad hoc, though, so Phase 0
  centralises it.
- **Client links:** a contact is scoped to one project (`src/lib/client-access.ts`), and the estimate is only
  fetched after the check (`src/actions/client-portal.ts`, `toClientSnapshot` strips cost and note).
- **Snapshots:** `Version.snapshot` already holds the whole BOQ as JSON, and `parseSnapshot` reads old shapes.
  This is the spec's "frozen snapshot" model.
- **Loose line reference:** `ItemApproval.lineItemId` already has no foreign key, matching the spec's
  `LineReview` note.
- **Warm Ledger look:** the reference images were drawn from this app's look, so tokens are mostly a refactor.

---

## 2. Data model migration plan

Approach: **keep the physical tables and rename models in Prisma with `@@map` / `@map`** where only the name
changes. That keeps the migrations to added columns and lets old snapshots keep reading. Every migration runs
on a staging copy of production first (CLAUDE.md). Each data migration below gives its steps and rollback.

### Keep, rename, add

| Spec table | Today | Plan |
| --- | --- | --- |
| Organization | `Organization` | **Keep.** Add `gstin`, `pan`, `state` (default Karnataka 29), `letterheadKey`. Rename `terms` → `defaultTerms` (map) |
| User | `User` | **Keep.** `role` → `orgRole` (new 7-value enum). Add `phone`, `googleLinked`, `passwordHash` nullable (invited, not yet set) |
| ProjectMember | — | **Add.** `projectId`, `userId`, `projectRole` |
| Invite, PasswordReset | — | **Add** (technical): hashed token, `expiresAt`, `usedAt` |
| Client | — | **Add.** Backfill one Client per distinct `Project.clientName` |
| ClientContact | `ClientContact` | **Keep.** Add `clientId`, `phone`, `lastSeenAt` (rename `lastViewedAt`), plus `ClientDeviceCode` for the 6-digit code |
| Project | `Project` (also holds the BOQ) | **Keep, split.** Add `code`, `clientId`, `leadDesignerId`, `siteAddress`, `type`, `scope[]`, `area`, `estimatedValue`, `stage`, `sideState`, `keyDates`, `leadId`, `deletedAt`. BOQ columns move to `Boq` |
| Boq | — | **Add.** One per project, holding the columns moved from Project: discount, GST, client columns, terms, prepared by, quote date, `mainVersionId`, `lockedById`/`lockedAt` |
| Category, Material, Finish, Unit | free text on `RateItem` | **Add** the lists. Backfill from distinct values. Unit gets `dimensions` (NONE, L, LB, LBH) from today's `dimsForUnit` |
| Item | `RateItem` | **Rename** (`@@map("RateItem")`). `rate` → `sellingRate`, `cost` → `costPrice` as Decimal. Add `code`, `gstRate` (18), `hsn`, `imageKey`, `active`, and foreign keys to the lists (text columns kept for one release) |
| Room | `Section` | **Rename** (`@@map("Section")`). `projectId` → `boqId`. Add `note` |
| Line | `LineItem` | **Rename** (`@@map("LineItem")`). Money to Decimal. Add `itemId?`, `rateOverride`, `gstRate`, `photoKey`, `milestoneId?`, `progressPct`, `deletedAt`. `image` is kept read-only until the photo migration is done |
| Version | `Version` | **Keep.** Status enum gains `PARTLY_APPROVED` and `SUPERSEDED`; `SENT_TO_CLIENT` becomes `sent`. Add `boqId`, `sentAt`, `calcVersion` (decision 6) |
| LineReview | `ItemApproval` | **Rename** (`@@map("ItemApproval")`). Status maps to verdict (approved, change, rejected). Pending is "no row" |
| ChangeOrder | `ChangeOrder` | **Keep.** Add `boqId`, `amountImpact` Decimal, `source` (edit, JMR). Make `reason` required for new rows |
| AuditEvent | `AuditEvent` | **Keep, widen.** Add `orgId`, `entityType`, `entityId`, `actorId`, `before`, `after`. Make `projectId` optional. `actorName` stays for old rows |
| File, Attachment | — | **Add** (Phase 0 storage, Phase 1 Files tab) |
| Vendor, PurchaseOrder, PoLine, LedgerEntry, PaymentStage, PaymentRequest, ApprovalRule, ApprovalStep | — | **Add** in Phase 2 |
| Milestone, ProgressUpdate, Task, Dpr | — | **Add** in Phase 3 (Task can come earlier if minERP's board is needed sooner) |
| Snag, Jmr, JmrLine, HandoverItem | — | **Add** in Phase 3 |
| Lead, LeadActivity | — | **Add** in Phase 4 |
| Notification | — | **Add** in Phase 2 (approvals need it first) |
| Sequence (technical) | — | **Add** in Phase 1: per-org, per-kind, per-year counters so codes are never reused |

### Data migrations

| # | Migration | Steps | Rollback |
| --- | --- | --- | --- |
| M1 | Roles | Add the `OrgRole` enum and an `orgRole` column. Set each person's role from decision 5 (Krishna and Harish Admin, Ridhi COO, Mansi Design lead, Keertan Designer, Anamika and Ananya Pre-sales). Anyone else: ADMIN → ADMIN, MEMBER → DESIGNER. Keep `role` for one release | Drop `orgRole`. `role` is untouched |
| M2 | Money to Decimal | For each Float money column, add a `*_dec` Decimal(14,2) column (quantities Decimal(14,3)), copy with `ROUND(x::numeric, 2)`, verify the sums match per project, then swap names in a second migration | Before the swap: drop the new columns. After: the old columns stay renamed `*_float` for one release |
| M3 | Boq split | Create one Boq per Project, copy the BOQ columns, point Section and Version at `boqId` | Columns stay on Project until M3 is verified, so rolling back means dropping Boq and `boqId` |
| M4 | Clients | One Client per distinct trimmed `clientName` in the org. Set `Project.clientId` | Clear `clientId` and drop Client. `clientName` is kept |
| M5 | Project codes | Number existing projects BB-YY-NNN by `createdAt` within each year. Seed the Sequence table | Clear `code` |
| M6 | Catalogue lists | Distinct category, material, finish and unit values → list rows. Set foreign keys. Assign item codes by category and position | Drop the foreign keys and lists. The text columns are kept |
| M7 | Photos to storage | Script, not SQL: upload each `LineItem.image` data URL, set `photoKey`, keep `image` until verified. Snapshots: leave their data URLs (old versions must open exactly as sent) and render both forms | `photoKey` is ignored and `image` still holds the data |
| M8 | Version statuses | Older sent versions with a newer sent version → SUPERSEDED. Sent versions with mixed verdicts → PARTLY_APPROVED | Status map reversed by a script that keeps the old status in `detail` |
| M9 | Audit widen | Backfill `orgId` from the project. `entityType` = project | Drop the columns |

---

## 3. Route plan

| Today | Target (UI spec §3) | Notes |
| --- | --- | --- |
| `/login` | `/login` in `(auth)` | Plus `/invite/[token]` and `/reset/[token]` |
| `/` → redirects to `/projects` | `/` Home | Phase 1 placeholder (my projects), full Home in Phase 5 |
| `/projects` | `/projects` | Add filters, stage tabs, cards or table |
| `/projects/[id]` (versions, client access, audit) | `/projects/[id]` Overview | Versions content moves to `/boq/versions`. Client access moves to the BOQ send dialog and `/boq/versions`. Audit moves to `/history` |
| `/projects/[id]/build` | `/projects/[id]/boq` | Permanent redirect |
| `/projects/[id]/client-view` | `/projects/[id]/boq/client-view` | Permanent redirect |
| `/projects/[id]/review` | `/projects/[id]/boq/review` | Permanent redirect |
| — | `/projects/[id]/boq/versions`, `/files`, `/finance/*`, `/milestones/*`, `/snags/*`, `/handover`, `/history` | New, built in their phases |
| `/settings` (rate card and organisation) | `/settings/catalogue`, `/settings/organisation` | `/settings` redirects to `/settings/catalogue` |
| `/team` | `/team` | Same route, invite flow |
| `/account` | Profile (user menu) | Keep `/account` |
| `/c/[token]` (estimate) | `/c/[token]` plus `/estimate`, `/progress`, `/payments`, `/documents`, `/snags`, `/handover` | Estimate first; the other tabs come in Phase 4 |
| — | `/approvals`, `/finance/*`, `/leads/*`, `/settings/vendors`, `/settings/approvals`, `/settings/templates` | New |

Live client links (`/c/[token]`) keep working unchanged. minERP's `/share/boq/[id]` and `/org/*` redirects
don't apply here.

---

## 4. Phase task lists

Each task is one pull request of 1 to 3 days. "AC" lists its acceptance checks. Section references are the
product spec (PS) and UI spec (UI). Tick tasks off here as they merge.

### Phase 0: Foundation and fixes (PS §3, §4, §18, §21; UI §2, §3, §9)

**First, before anything else.** These fix problems in the live app today. Each is its own small PR, and they
merge in this order.

- [ ] **P0-0a Deleting a project loses nothing.** `deleteProject` becomes a soft delete (`Project.deletedAt`,
  `deletedById`). Only an Admin can delete; the check is on the server, not only by hiding the button. Every
  project query (list, project pages, client link resolution, import, duplicate) filters out deleted projects,
  and a deleted project's client links stop opening. Versions, approvals, change orders and audit events are
  never removed. The delete writes an audit event. Admin-only "Restore" is included, so a mistake is undoable.
  AC: after a delete, the versions, approvals and history rows are still in the database. A Team member calling
  the action directly gets refused. A deleted project returns 404 to staff and to its client link.
- [ ] **P0-0b Only a client can approve a BOQ version.** Remove "Approved" as a manual choice in
  `setVersionStatus` (`src/actions/approvals.ts:100`) and from the Versions page. The server refuses
  `APPROVED` from any staff action. The client approval path (`settleVersionApproval`) is the only way a version
  becomes Approved. Moving a version back to Draft or Sent stays possible for now and is audited; the full status
  machine comes in P1-13. AC: a direct call to the action with status `APPROVED` is refused and changes nothing.
  The existing client-approval Playwright tests still pass.
- [ ] **P0-0c Preview builds never migrate production; tests never run against production.** The `build` script
  runs `prisma migrate deploy` only when `VERCEL_ENV` is `production`, or `preview` with a database that isn't
  production. A guard compares `DATABASE_URL`'s host and branch with a `PRODUCTION_DATABASE_HOST` env var set
  only in Vercel Production. If they match outside Production, the build fails loudly. Playwright refuses to
  start when `E2E_BASE_URL` is the production URL (`PRODUCTION_APP_URL`). `tests/cleanup.ts` refuses to run
  against the production database. `tests/README.md` is rewritten to say tests run against local or staging
  only, and the "Running it against production" section is removed. AC: a Preview build pointed at the production
  URL fails before migrating. `npm run test:e2e` with the production URL exits with an error.

Then the rest of Phase 0:

- [ ] **P0-2 Tooling and CI.** Vitest, ESLint (Next config plus a rule banning hex colours and px values outside
  tokens), a GitHub Action that runs typecheck, lint and unit tests on every PR, and Sentry. Fill in CLAUDE.md
  Commands. AC: CI runs and passes on a PR.
- [ ] **P0-3 Environments.** Staging is the Neon branch "staging". Vercel Preview env vars point at it; P0-0c already guards the build. Seed
  with Villa Prakruthi (client R. Iyengar) and a user per role. Sentry gets separate staging and production environments. AC: staging and production
  databases separate. Seed is repeatable.
- [ ] **P0-4 Formatters and India time.** `src/lib/format.ts` (`formatINR`, `formatDate`, `formatTime`, relative
  time, `amountInWords`) with every test case in UI §7. Replace `fmt`, `fmtDate` and every `toLocale*` call, with
  times in Asia/Kolkata. AC: History shows India time. All formatter tests pass.
- [ ] **P0-5 Tokens and status map.** `src/styles/tokens.css` exactly as UI §2. Move `globals.css` onto
  variables with no visual change. `src/lib/status.ts`. AC: lint finds no hex outside tokens. Screenshots
  unchanged.
- [ ] **P0-6 `calc.ts` and golden fixtures.** A decimal library (decimal.js) and `src/lib/calc.ts` porting
  `src/lib/boq.ts` maths. Fixtures are captured from the current code (decision 6) and unit tests are written
  for every PS §19 formula. AC: the calc tests reproduce today's totals to the paisa.
- [ ] **P0-7 Money to Decimal (M2).** Schema and data migration. Money travels as strings. The builder uses
  `calc.ts`. AC: every project total is identical before and after on a staging copy.
- [ ] **P0-8 Validators.** `src/lib/validate.ts` (10-digit Indian mobile, email, GSTIN with its state code, PAN,
  IFSC) with tests. Wire them into the organisation settings and client contact forms. AC: a 9-digit phone is
  rejected with "Phone should be 10 digits".
- [ ] **P0-9 Email transport.** Resend wrapper, sending from `studio@barebase.in` once Krishna has added the DNS records and plain templates. AC: test mail reaches an
  inbox from staging.
- [ ] **P0-10 Invites, reset and minimum 10 characters.** `/invite/[token]` (7 days) and `/reset/[token]`
  (30 minutes, single use). The Team page sends invites instead of setting passwords. AC: a new user signs in
  only through their own invite, and a used or expired link is refused.
- [ ] **P0-11 Roles and `can()`.** `OrgRole` (M1, with the roles from decision 5), `ProjectMember`, `src/lib/permissions.ts` with
  `can(user, action, resource)` and the PS §18 matrix as data, plus membership filters in queries. Non-members
  get a 404. Team page role picker. AC: a Designer who isn't a member gets 404 on the project URL and on its
  server actions.
- [ ] **P0-12 Central cost serializer.** One `stripCost(user, payload)` used by every page and action that
  returns BOQ or catalogue data. Replace the ad hoc zeroing. Playwright API test: a Designer's responses contain
  no `cost`, `costPrice` or `margin` values. AC: PS §7 "no cost data in any API response".
- [ ] **P0-13 Audit helper and soft delete pattern.** Widen `AuditEvent` (M9). `recordAudit` takes entity,
  before and after. A `softDelete` helper. AC: every write in existing actions records before and after.
- [ ] **P0-14 Object storage.** Vercel Blob, `File` table, signed URLs that expire after 10 minutes,
  and line photos write to storage. M7 script for old photos. AC: no new data URLs in the database. Old
  versions still show their photos.
- [ ] **P0-15 Rate limiting.** A Postgres-backed limiter on login, reset and the client email gate (later the
  leads webhook). AC: the 11th failed login in 10 minutes is refused.

Exit check (PS §22): P0-0a to P0-0c merged · no public sign-up · every user on their own login · Designer responses contain no cost
data · History in India time · staging and production separate · formatter tests pass.

### Phase 1: Projects and BOQ (PS §6 to §9; UI §2 components, §3 shell, §5.1 to §5.4)

UI system and shells (prompt 02a):
- [ ] **P1-1 Primitive components:** Button, inputs, MoneyInput (words, confirm above ₹1,00,000), StatusChip,
  Avatar, ProgressBar. Lucide icons. AC: every state renders in the gallery.
- [ ] **P1-2 Composite components:** DataTable (sticky, 50 per page, pinned first column on phone), Tabs (route
  based), SideSheet (`?sheet=`), Dialog, Toast with Undo, EmptyState, StatCard, FileDrop, PhotoCapture.
- [ ] **P1-3 Component gallery** at `/dev/ui`, staging only. Krishna reviews it before screens start.
- [ ] **P1-4 Shells:** AuthShell, AppShell (sidebar, top bar, bottom bar on phone), ProjectShell (project
  sidebar, breadcrumb, stage bar), ClientShell. Placeholder pages and redirects from section 3. AC: every route
  in UI §3 resolves, and hidden tabs follow `can()`.

Projects, catalogue and files (prompt 02b):
- [ ] **P1-5 Project record, Client and codes** (M3, M4, M5, Sequence). New project side sheet with three
  required fields. AC: created in under 30 seconds, codes unique and sequential per year.
- [ ] **P1-6 Projects list** with filters in the URL, stage tabs and cards or table. AC: UI §5.2 Done when.
- [ ] **P1-7 Stages status machine** (`transitionProjectStage`), side states, move back with a reason. AC:
  sending the first version moves the project to Quotation by itself.
- [ ] **P1-8 Project Overview:** money (BOQ part), progress placeholder, BOQ card, attention list, activity.
  AC: numbers match the BOQ tab.
- [ ] **P1-9 Catalogue model** (M6): lists, Unit dimensions, item code, GST %, HSN, image, active, renames.
  `/settings/catalogue` table with 50 rows per page, filters, margin column (red below 15%), bulk edit by %.
  AC: rate change history is logged, and changing a rate leaves sent BOQs unchanged.
- [ ] **P1-10 CSV import and export by item code**, adapting the existing preview flow. AC: 253-item import
  preview, saved only on confirm.
- [ ] **P1-11 Files tab:** folders, versions by name, Draft → Approved internally → Shared, design freeze linked
  to the BOQ version, comments. AC: PS §9 checks, and a Draft file is never reachable by a client.
- [ ] **P1-12 Task board** (minERP parity, decision 1): Open, In progress, In review, On hold, Completed,
  Cancelled, with assignee, due date and priority. Milestone links come in Phase 3.

BOQ (prompt 02c):
- [ ] **P1-13 Boq split and version status machine** (M3, M8): `transitionBoqVersion`, versions that can't be
  edited, Superseded, Partly approved, edit-from-sent creates a draft, main version. Replaces `setVersionStatus`
  and `restoreVersion`. AC: a sent version can't be edited, even through the API.
- [ ] **P1-14 Per-line GST, IGST and discount spread** in `calc.ts`, with `calcVersion` on snapshots, the round-off
  line and tax per band in the summary. AC: PS §19 worked examples. Old versions keep their totals.
- [ ] **P1-15 Builder rework to the reference (UI §5.4):** room list with subtotals and drag, edit in place,
  Tab/Enter, combobox item picker (Name · Material · Finish · Unit · ₹rate), Ctrl/Cmd+K, rate-override marker,
  delete with Undo, save indicator. AC: a 60-line, 8-room BOQ edits without lag.
- [ ] **P1-16 Edit lock** (`lockedById`, 30-second heartbeat, 10-minute idle). AC: a second editor sees the
  banner and a read-only view.
- [ ] **P1-17 Change orders with reason and ₹ impact**, shown on the BOQ, in History and on the client view. AC:
  changing an approved line without a reason is blocked.
- [ ] **P1-18 Send to client dialog** with contacts, email preview and a 6-digit email code on first open per
  device. AC: a client link can't open another project.
- [ ] **P1-19 Versions page** with compare (added, removed, changed). Client PDF and Internal PDF updated to the
  new maths, overrides and custom lines. AC: the client PDF text contains no cost or note data.
- [ ] **P1-20 History tab** (`/projects/[id]/history`) with filters and a Client badge.

Exit check: five real projects built end to end · the client PDF matches the BOQ Studio fixtures to the paisa ·
one BOQ sent, reviewed and revised through the client link.

### Phase 2: Money (PS §10 to §12; UI §4 payment machine, §5.5, §5.6)

- [ ] **P2-1 Notifications** table and bell (polls every 60 seconds), plus email for important events, with
  grouping. Created in the same transaction as the event.
- [ ] **P2-2 Vendor master** with encrypted bank details (Admin and Finance only), GSTIN state, TDS section,
  documents.
- [ ] **P2-3 Approval engine:** `ApprovalRule` slabs per type, `ApprovalStep`, no self-approval, editing restarts
  at level 1, idempotency keys, daily reminder for anything waiting more than 48 hours. Unit tests through the API.
- [ ] **P2-4 Approvals inbox** (UI §5.6) with keyboard shortcuts and auto-advance.
- [ ] **P2-5 Purchase orders** from main-version lines, with warnings, approval by slab and a PO PDF without the
  selling rate.
- [ ] **P2-6 PO revisions** after the first payment.
- [ ] **P2-7 Ledger** (`LedgerEntry`) with reversing entries and no edits after approval.
- [ ] **P2-8 Vendor bills and payment requests**, with "Record payment" only after full approval.
- [ ] **P2-9 Client payment schedule, requests and receipts.**
- [ ] **P2-10 Project Finance Summary** (cost-to-complete) from one query.
- [ ] **P2-11 Org Finance:** entry form (inclusive and exclusive GST), claims, reimbursements, transactions.
- [ ] **P2-12 Finance dashboard and GST & TDS CSV export.**
- [ ] **P2-13 Vendors & bills tab** (PS §11, UI §5.8). *Placeholder:* tasks get split and acceptance checks
  added once the updated kit is in `docs/`.

Exit check: one month of real payments and claims run in parallel with RDash · no payment recorded without
full approval · the CA accepts the GST export.

### Phase 3: Site and close-out (PS §13, §14; UI §5.7)

- [ ] **P3-1 Milestones**, templates and line assignment. **P3-2 Progress screen** (value-weighted).
  **P3-3 Tasks linked to milestones**, checklist and @mentions. **P3-4 DPR on phone** with offline draft.
  **P3-5 DPR list, calendar and PDFs.** **P3-6 Snags and snag walk.** **P3-7 JMR** creating change orders.
  **P3-8 Handover checklist, pack PDF and client sign-off.** **P3-9 Warranty tagging.**
- [ ] **P3-10 Home budget and client purchases** (PS §11A, UI §5.9 to §5.11). *Placeholder:* tasks get split and
  acceptance checks added once the updated kit is in `docs/`.

### Phase 4: Leads and client portal (PS §15, §16)

- [ ] **P4-1 Leads webhook** and `docs/leads-webhook.md`. **P4-2 Leads board** and timers. **P4-3 Start BOQ
  from a lead and Won conversion.** **P4-4 Lead reports.** **P4-5 Client portal tabs:** Progress, Payments,
  Documents, Snags, Handover. **P4-6 Client-safety test over every `/c/[token]` response.**

### Phase 5: Home and insight (PS §16; UI §5.1)

- [ ] **P5-1 Role-based Home** with streamed cards. **P5-2 Global search** (`/`). **P5-3 COO weekly
  dashboards.** **P5-4 Performance pass** to meet the PS §21 targets.

---

## 5. Risks and conflicts

1. **Base switch (decision 1).** The spec's estimates assume minERP's catalogue, members, tasks and history
   exist. Here they don't, so Phase 1 is larger (P1-9, P1-11, P1-12, P1-20). In return, most of the BOQ work
   in Phase 1 is already done.
2. **Live data in production.** Every structural migration (M2 to M8) touches projects clients have approved.
   Each one gets a staging rehearsal on a production copy, totals compared before and after, and a written
   rollback. M2 and M3 are the riskiest.
3. **Snapshots are JSON in the old shape.** `parseSnapshot` must keep reading every past shape, including data-URL
   photos and Float numbers. New snapshots record `calcVersion` so maths changes never move an old total.
4. **Migrations run on build.** `npm run build` runs `prisma migrate deploy`. A bad migration on a preview build
   could hit production until P0-0c lands. P0-0c is the first PR after this plan, before any schema change.
5. **E2E tests run against production.** `tests/README.md` documents running against production with cleanup.
   Spec §21 says test data never enters production. P0-0c blocks it and rewrites the guide.
6. **The client gate isn't authentication yet.** Today it checks the email the link was issued to (as the README
   says). The spec's 6-digit code needs email (Resend, P0-9). Until then, links stay as they are.
7. **`saveBoq` deletes and rewrites rows.** It saves the whole BOQ and deletes lines the payload omits, guarded
   by `expectedUpdatedAt`. The spec wants per-line autosave with a 600 ms debounce, an edit lock and soft-deleted
   lines with Undo. P1-15 and P1-16 move to per-line writes. Until then, change orders depend on stable ids,
   which `saveBoq` preserves.
8. **One GST rate per BOQ today** versus per-line rates in the spec (decision 6).
9. **No component library and Lucide only**: fine, since the app already uses plain CSS.
10. **The spec's 1.5 s page target** hasn't been measured on this app. Measure on staging in Phase 0 before
    promising it.
