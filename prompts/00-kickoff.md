# Prompt 00 · Get the app running end to end, add the Studio OS shell, plan the build

This repo is **Barebase Studio OS**. It starts from the BOQ Studio code, imported with its full history. Read
`CLAUDE.md`, `docs/decisions.md`, `docs/boq-builder/existing-app-map.md`, `docs/screens-and-journeys.md`,
`docs/product-spec.md` and `docs/ui-ux-spec.md`, and look at every image in `docs/ui/screens/`.

Never touch the BOQ Studio repo (`barebase-boq-app`) or its database.

Do these in order, on one branch `setup/end-to-end-base`, and stop:

1. **Run it end to end.** Install, typecheck, build, and run the app against the staging database Krishna gives you
   (a copy of BOQ Studio's production data, see decision 2). Then prove, with Playwright, that everything BOQ
   Studio does still works here, as a journey test: sign in · forgot and change password · Team (add, deactivate) ·
   rate card (edit, CSV import preview and export) · create a project · build a BOQ (rooms, items, custom item,
   dimensions, count, discount, GST, scope, notes, photos) · cost and margin hidden from non-admins on the server ·
   save a version · client and internal PDFs · client link with email check · client approves and requests changes
   line by line · change orders appear · client review screen · history and audit export. Fix anything broken.
   Every project already in the copied data must open and show the same totals as in BOQ Studio.
2. **The Studio OS shell around it.** Global sidebar (Home · Insights · Leads · Projects · Finance · Team, Org
   Settings at the bottom), project sidebar (Overview · Files · BOQ · Finance · Home budget · Milestones & DPR with
   its three sub-pages · Snags), the top bar with "n to approve" and the bell, all in the tokens of UI spec section 2.
   The existing BOQ, Team, rate card, client review and history screens move inside this shell, still working.
3. **Every other screen as a placeholder** from `docs/screens-and-journeys.md`, at its route, inside the right shell,
   showing its title and its mock-up image, so the whole product can be clicked through from sign-in.
4. **`docs/PLAN.md`:** the schema migration plan from the imported schema to product spec section 17 (plus 11A and
   11B), with data migrations for the existing projects and rollbacks; the route map with redirects from the old
   routes; Phases 0 to 5 as PR-sized tasks (1 to 3 days) in build order, each linked to its spec section, screens
   and acceptance checks, with the 10 journeys assigned to the phase that finishes them; the go-live plan (final copy
   of BOQ Studio's data, switch-over day, BOQ Studio made read-only); risks; and "Questions for Krishna" at the top,
   only things that block Phase 0 or 1 and aren't answered in `docs/decisions.md`.
5. **`CLAUDE.md`:** correct the Commands section if anything changed.

Open one PR titled "Setup: end-to-end base, Studio OS shell and build plan", with screenshots at 1440 px and 375 px.
Then stop and give Krishna a short checklist of what you need (see the README's "Before you start").
