# Barebase Studio OS

Barebase's one internal platform: leads, projects, BOQs, vendors and money, site work (milestones, DPR, snags),
handover and a client portal. Barebase is an architecture, interiors and construction studio in Bengaluru.

**This is a new, standalone application, built from scratch.** The BOQ builder is one feature of it, built from the
specs like every other module. It has no connection to any other Barebase app or repository: don't read, copy from or
change any other repo, and don't plan any data import. The specs were first written for an older tool called minERP;
wherever they say "keep minERP's X" or "minERP today", read it as "build X here".

## Read before any work

1. `docs/screens-and-journeys.md`: every screen (43), its route, who uses it, and the 10 journeys that join them.
2. `docs/product-spec.md`: fields, business rules, permissions, formulas, phases (section 22), open decisions (23).
3. `docs/ui-ux-spec.md`: tokens, shell, status machines, per-screen build notes, definition of done.
4. `docs/ui/screens/*.png`: the full-page mock-up of every screen. Layout, copy and sample data come from here.
5. `docs/decisions.md`: answers Krishna has already given (they override spec defaults).
6. `docs/PLAN.md`: the build plan and progress. Keep it updated as you work.

Order of authority: product spec for fields and rules, UI spec for look and behaviour, mock-ups for layout,
`screens-and-journeys.md` for which screens exist and how they connect. If two disagree, or something that changes
money, permissions or anything a client sees is unclear, stop and ask Krishna. Do not guess.

## Non-negotiables

These rules are never relaxed, even temporarily, even behind a flag.

- **Money is exact.** Store money as `Decimal(14,2)`. Never use JS floats for maths on money. Every calculation lives in
  `lib/calc.ts`, shared by server and client, with unit tests. Display money only through `lib/format.ts` (Indian
  grouping, ₹).
- **Cost is private.** Cost price, margin, budget, order rates and internal notes are removed **on the server** for
  any user without the "see cost" permission, and from every client-portal response. Hiding a column in the UI is
  never enough. An automated test checks every `/c/[token]` response.
- **No payment before approval.** A payment can only be recorded once every approval level is complete. There is no
  setting, flag or admin bypass for this. Nobody approves their own request. Editing the amount restarts approval at
  level 1.
- **Permissions on the server.** Every page, server action and route handler checks permission through one helper,
  `can(user, action, resource)`. Membership filters go in the database query. Records a user may not see return 404.
- **Status changes through status machines only.** Each object (BOQ version, payment request, snag, project stage) has one
  server function that validates the transition, the actor and the side effects (UI spec, section 4).
- **Nothing is lost.** Soft-delete anything touching money, BOQs or clients. Every change writes an audit event
  (who, when, before, after). Sent and approved BOQ versions are immutable snapshots.
- **India time.** Store UTC, display in Asia/Kolkata. Dates as `08 Oct 2026`.
- **Tokens only.** No hex colours, font sizes or spacing values outside `styles/tokens.css` (or the Tailwind theme).
  Every status chip comes from `lib/status.ts`.
- **No secrets in the repo.** Use environment variables. Never print secrets in logs, tests or screenshots.

## How to work

- Start each phase by reading its prompt in `prompts/`, then update `docs/PLAN.md` with the task list for that
  phase before writing code.
- One branch and one pull request per feature (`feat/boq-room-sections`, `fix/history-timezone`). Never commit to
  `main`; Krishna reviews and merges every PR himself.
- Fill the PR using the template in the UI spec, section 8: what, screenshots at 1440 px and 375 px, how to test, and the
  checklist.
- Database changes go through migrations, never `db push` on shared databases. Every migration must run cleanly on a
  copy of production data (staging) before the PR is opened. Data migrations are reversible or have a written
  rollback.
- Write the tests in the same PR as the feature: unit tests for calculations and formatters; Playwright for the
  screen's "Done when" checks; axe accessibility check; the client-safety test where relevant.
- Prefer small, reviewable PRs (under about 600 changed lines excluding tests and migrations).
- When you finish a task, tick it in `docs/PLAN.md` and note anything deferred or any decision you made.
- When the spec lists something as **Decision needed**, use the default in the product spec, section 23, and
  say so in the PR.

## Stack (decided)

- Next.js 16 App Router, React 19, TypeScript, on Vercel. Server actions for mutations.
- Postgres on Neon, through Prisma 6. Two databases: `production` and a `staging` branch. Vercel Production uses
  production; Vercel Preview uses staging. Tests and preview builds never touch production.
- Auth: email and password (bcrypt, minimum 10 characters) with a signed httpOnly cookie (jose), invite and reset
  links by email. Accounts are created by an Admin only.
- Email: Resend, from `studio@barebase.in`. Files: Vercel Blob with signed, expiring URLs (never data URLs in the DB).
- Styling: Tailwind with the tokens from UI spec section 2 (or plain CSS variables in `src/styles/tokens.css`). No
  component library (no MUI, Ant, Chakra, shadcn). Icons: Lucide only.
- Tests: Vitest for `src/lib/calc.ts` and `src/lib/format.ts`; Playwright for each screen's "Done when" and one test per
  journey in `docs/screens-and-journeys.md`; axe for accessibility.
- Code lives under `src/` with the `@/` alias (`src/lib/calc.ts`, `src/styles/tokens.css`).

## Commands

Node 22. Copy `.env.example` to `.env` for local work (never commit it).

- Install: `npm install` (its postinstall runs `prisma generate`)
- Dev: `npm run dev` (http://localhost:3000)
- Unit tests: `npm test` (Vitest; `npm run test:watch` while working)
- E2E: `npm run test:e2e` (Playwright at 1440 and 375 px; starts its own server on port 3100). Locally it reuses a
  running `next dev` on that port; in CI it runs `next start` after `npm run build`. Against staging only:
  `E2E_BASE_URL=<staging url> E2E_TARGET=staging npm run test:e2e`. It refuses production.
- Lint and typecheck: `npm run lint` (ESLint plus the "tokens only" check in `scripts/check-tokens.mjs`) and
  `npm run typecheck`
- Build: `npm run build` (`prisma generate`, then `scripts/migrate-on-deploy.mjs`, then `next build`). The migration step
  runs only on Vercel: Production migrates production, Preview migrates staging, and a Preview pointed at the production
  host fails. Local and CI builds never migrate.
- Migrations: `npm run db:migrate:dev -- --name <change>` against a local or throwaway database; `npm run db:migrate`
  applies them. Never `prisma db push` on a shared database.
- Seed: not yet; P0-5 adds `npm run db:seed` (the mock-up world: Villa Prakruthi for R. Iyengar, contract
  ₹8,34,675 excl. GST, BOQ v3; plus Hebbal Business Loft, Ashvin Court, Terrace Residency)

## People (for seed data and roles)

Krishna (Admin) · Harish (Founder, Admin) · Ridhi (COO, approver) · Mansi (Design lead) · Keertan (Designer) ·
Anamika and Ananya (Pre-sales) · a Site supervisor · Finance users added by Krishna.

## Local environment notes

- On Windows on ARM (Krishna's laptop), Prisma may fail to load its engine. Set
  `PRISMA_CLIENT_ENGINE_TYPE=binary` and `PRISMA_CLI_QUERY_ENGINE_TYPE=binary` before `prisma generate`.

## Glossary

BOQ: bill of quantities. Line: one BOQ row. Selling rate: what the client pays. Cost price: what it costs Barebase
(internal). Version: frozen BOQ snapshot. Change order: recorded change to an approved line. PO: purchase order.
DPR: daily progress report. Snag: defect to fix before handover. JMR: joint measurement record. Slab: amount
range deciding who approves.
