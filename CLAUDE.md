# Barebase Studio OS

Barebase's one internal platform: leads, projects, BOQs, vendors and money, site work (milestones, DPR, snags),
handover and a client portal. Barebase is an architecture, interiors and construction studio in Bengaluru.

**Where the code comes from.** This app starts from the BOQ Studio code, imported on 19 Oct 2026 with its full
commit history. Sign-in, the team page, the rate card, projects, the BOQ builder, versions and change orders, the
client review link, PDFs and the audit log already work, and they must keep working end to end at every step.
Studio OS grows from this code towards the specs. `docs/boq-builder/existing-app-map.md` maps what exists, with file
paths and gaps; `docs/boq-builder/` also holds that app's own specs and user guide.

BOQ Studio itself (`iamrealkrishna/barebase-boq-app`) carries on as a separate app the team uses every day until this
one replaces it. Never read from, push to or change that repo or its database.

The specs were first written for an older tool called minERP; wherever they say "keep minERP's X", read it as "build
X here, or keep it if the imported code already has it".

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

- Install: `npm install` (Node 22+; its postinstall runs `prisma generate`). Playwright's browser once:
  `npx playwright install chromium`
- Dev: `npm run dev` (needs `DATABASE_URL`, `AUTH_SECRET` and `APP_URL` in `.env`; see `.env.example`)
- Unit tests: `npm test` (Vitest over `src/**/*.test.ts`, plus `tests/unit-rate-card-identity.ts`)
- E2E: `npm run test:e2e`, against a running app at `E2E_BASE_URL` (default `http://localhost:3000`; sign in with
  `E2E_EMAIL`/`E2E_PASSWORD`). Local or staging only: a remote URL needs `E2E_TARGET=staging`, and production is
  refused. Then `npx tsx tests/cleanup.ts` against the same database. See `tests/README.md`
- Lint and typecheck: `npm run lint` (ESLint, then the "tokens only" check) and `npm run typecheck`
- Build: `npm run build` is the Vercel build: it runs `scripts/migrate-on-deploy.mjs`, which migrates only on
  Vercel and refuses a Preview pointed at `PRODUCTION_DATABASE_HOST`. Locally use `npm run build:local`, then
  `npm run start`
- Migrations: create with `npm run db:migrate:dev -- --name <change>` against a local database; apply with
  `npm run db:migrate` (`prisma migrate deploy`). Never `prisma db push` on a shared database. Before and after a
  data migration on staging, compare `npx tsx scripts/project-totals.ts` output
- Seed: `npm run db:seed` (reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ORG_NAME`;
  upserts the org, the first Admin and the default rate card). The mock-up world (Villa Prakruthi for R. Iyengar,
  contract ₹8,34,675 excl. GST, BOQ v3; plus Hebbal Business Loft, Ashvin Court, Terrace Residency) comes in P0-5

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
