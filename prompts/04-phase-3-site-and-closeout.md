# Prompt 04 · Phase 3: Milestones, progress, DPR, snags, JMR and handover

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 13 and 14, UI spec section 4 (DPR and snag flows, snag status
machine), 5.7 and section 7 (mobile). Match `docs/ui/reference/07-phone-dpr-snag-portal.png`. These screens are
phone-first.

Build:

1. **Milestones** from a template, each covering BOQ lines; value-weighted progress for milestones and the project;
   automatic Delayed; link to client payment stages (completion marks the stage Due and notifies Finance).
2. **Progress updates** per line (slider, typed %, or quantity) with photos and history.
3. **Tasks:** keep minERP's board; add milestone link, priority, checklist, attachments, comments, My tasks on Home.
4. **DPR** on the phone: auto-pulled progress, photos, work done, manpower prefilled, blockers (notify lead designer),
   tomorrow's plan, share with client; offline draft queue; DPR PDF and weekly summary PDF; calendar of filed days.
5. **Snags:** raise with photo, assign with a fix-by date, Open → Fixed (after photo required) → Verified → Closed,
   won't fix with approval, snag walk mode, client-raised snags.
6. **JMR:** measured quantities for selected lines, client confirmation, automatic change orders with ₹ impact.
7. **Handover:** checklist template with automatic items, handover pack PDF, client sign-off (moves stage to
   Handover), warranty period and warranty-tagged snags.
8. **Home budget** (product spec 11A, UI spec 5.9 to 5.11): whole-home plan with baselines, categories, plan vs selected vs paid, forecast with contingency; client purchases with status, needed-by and Needs/Blocks dependencies on milestones, the timeline, attention items on Project Overview; the client portal Budget tab with the client-safety test.

Done when: every acceptance check in product spec sections 13 and 14 passes; a DPR with 6 photos files on a phone on 4G in
under 60 seconds.
