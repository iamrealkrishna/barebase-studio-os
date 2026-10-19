# What the imported BOQ Studio code already does

Written 15 Oct 2026 by the BOQ Studio planning session, for the code imported into this repo on 19 Oct 2026. Paths are the same here. Use it to see what already works, what the gaps are against the specs, and how the schema has to move.

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
| PaymentStage (early) | — | **Add** in Phase 1 for the New project wizard's payment schedule (name, %, amount, `milestoneId?`). Phase 2 adds `billingState`, `draftedProformaId`, `draftedAt` (PS §11B) |
| Milestone (minimal) | — | **Add** in Phase 2 (question 2): name, planned dates, complete. Phase 3 extends it |
| Proforma, SentDocument, Reminder | — | **Add** in Phase 2 (PS §11B). Org setting `billingTrigger` |
| BudgetPlan, BudgetCategory, ClientPurchase | — | **Add** in Phase 3 (PS §11A). Plans are baselines: a re-baseline adds a new plan with a reason and keeps the old one |

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

