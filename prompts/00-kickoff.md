# Prompt 00 · Set up the app and plan the build

You are starting **Barebase Studio OS**, a new standalone application, in this repository. Read `CLAUDE.md` first,
then `docs/decisions.md`, `docs/screens-and-journeys.md`, `docs/product-spec.md` and `docs/ui-ux-spec.md` in full,
and look at every image in `docs/ui/screens/`, `docs/ui/reference/` and `docs/ui/diagrams/`. Don't look at or use any
other repository.

Do these, in this order, and stop:

1. **Scaffold the app** (Next.js 16 App Router, TypeScript, Prisma 6, the stack in `CLAUDE.md`). It must install,
   build, lint and typecheck cleanly, with Vitest and Playwright wired up and one passing test each.
2. **Foundations only:** `src/styles/tokens.css` from UI spec section 2, `src/lib/format.ts` with the formatter tests
   from UI spec section 7, an empty `src/lib/calc.ts`, and the two shells (global sidebar and project sidebar exactly
   as the last section of `docs/screens-and-journeys.md` describes, with the top bar).
3. **Every route as a placeholder page** from `docs/screens-and-journeys.md`, inside the right shell, each showing its
   title and a link to its mock-up image, so the whole navigation can be clicked through. No business logic yet.
4. **`docs/PLAN.md`** with: the target Prisma schema (product spec section 17 plus the 11A and 11B tables); the route
   map; phase task lists for Phases 0 to 5, PR-sized (1 to 3 days each), in build order, each linked to its spec
   section, screens and acceptance checks, with each of the 10 journeys assigned to the phase that completes it;
   risks; and "Questions for Krishna" at the top, only things that block Phase 0 or 1 and aren't already answered in
   `docs/decisions.md`.
5. **`CLAUDE.md`:** fill in the Commands section.

The kit (CLAUDE.md, docs/, prompts/) is already on `main`. Do all of the work above on a branch
`setup/foundations-and-plan` and open one PR titled "Setup: scaffold, shells, routes and build plan". Then stop
and tell Krishna what you need from him (Neon database URLs, Vercel project, Resend key, Blob token) as a short
checklist.
