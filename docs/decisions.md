# Decisions

Answers Krishna has given so far. They override the defaults in product spec section 23. Copied from the BOQ Studio plan (PR #13, 19 Oct 2026); decisions 1 and 2 were changed when the build moved to this repo. The "Questions for Krishna (kit v2)" below were all accepted with their defaults on 19 Oct; treat them as decisions 9 to 18.

## Decisions from Krishna (15 Oct 2026)

These answer the kickoff questions and override the defaults that were listed there.

| # | Question | Answer |
| --- | --- | --- |
| 1 | Base codebase | **Superseded 19 Oct: build in this new repo (barebase-studio-os).** BOQ Studio stays live until cutover; port its BOQ code; minERP is retired |
| 2 | Live data | **Superseded 19 Oct:** BOQ Studio projects and rate card are imported into this app at cutover, with a full rehearsal on staging first |
| 3 | Staging | Neon branch **"staging"** created from production. Vercel Production → production `DATABASE_URL`; Vercel Preview → staging. Preview builds must never migrate production, and tests must never run against production (task P0-0c) |
| 4 | Email | **Resend**, sending from `studio@barebase.in`. Krishna adds the DNS records |
| 5 | Roles | Krishna Admin · Harish Admin · Ridhi COO · Mansi Design lead · Keertan Designer · Anamika Pre-sales · Ananya Pre-sales. Krishna adds the Finance users himself |
| 6 | Old BOQ maths | **Agreed.** Sent and approved versions keep their current maths. Only new drafts use the spec's maths |
| 7 | Google sign-in | **After Phase 1** |
| 8 | File storage | **Vercel Blob** |

Product spec section 23 decisions still use their defaults. Decisions 1, 2, 8, 9, 10 and 16 are needed in
Phase 1. Decision 16 is answered by decision 1: there's no minERP import, and live BOQ Studio projects
migrate in place.

Decisions 17 to 19 (added with Home budget) also use their defaults: the design lead sees the project vendor
ledger without bank details · the client can mark their purchases ordered or delivered from the portal · seven
default client categories with 3% contingency.

---

## Questions for Krishna (kit v2, 19 Oct 2026)

Kit v2 brings `docs/screens-and-journeys.md`, which disagrees with the specs in a few places or adds things
that need a decision. Until you answer, the plan below builds the default shown.

1. **Routes.** The screens file and UI spec §3 give different URLs for the same screens:

   | Screen | Screens file | UI spec |
   | --- | --- | --- |
   | Home budget | `/projects/[id]/home-budget` | `/projects/[id]/budget` |
   | Client payments | `/projects/[id]/finance/payments` | `/projects/[id]/finance/client` |
   | Vendors & bills | `/projects/[id]/finance/vendors` | `/projects/[id]/finance/vendor` (§3) and `/vendors` (§5.8) |
   | GST and TDS | `/finance/tax` | `/finance/gst` |
   | Rate card | `/settings/rate-card` | `/settings/catalogue` |
   | Phone DPR, phone snag | `/site/[projectId]/dpr`, `/site/[projectId]/snag/new` | `/projects/[id]/milestones/dpr/new`, `/snags/walk` |
   | Phone claim | `/finance/claims/new` | `/finance/claims/new` (same) |

   *Default:* use the screens file's routes, since it's newer (18 Oct) and decides "which screens exist and how
   they connect". The UI spec's routes become permanent redirects.
2. **Billing due needs milestones in Phase 2.** Proformas drafted from milestones (11B) are Phase 2, but
   milestones are Phase 3. *Default:* Phase 2 adds a minimal `Milestone` table (name, planned start and end,
   complete). Payment stages can link to it, and Finance can mark a milestone complete. Phase 3 builds the Gantt
   chart, progress and DPRs on the same table.
3. **Journeys 4 and 8 in Phase 2.** `prompts/03b-phase-2-finance.md` says journeys 2, 4, 5 and 8 must pass in
   Phase 2. Journey 4 ends with Client pays (a portal screen, Phase 4), and journey 8 starts at Insights
   (Phase 5). *Default:* in Phase 2, journey 4 passes with Finance recording the receipt in Client payments, and
   journey 8 passes from the Finance dashboard onwards. The Client pays step is added in Phase 4 and Insights in
   Phase 5, which is where those journeys finish (section 4).
4. **Gantt chart.** Product spec §13 says milestones are "a simple list ... no dependencies or critical path",
   but the Milestones screen is a Gantt chart with sub-tasks and planned vs forecast finish. *Default:* build
   the Gantt chart as drawn, still without dependencies or critical path.
5. **"Receipt read automatically" on claims** (My claims, phone claim) needs a text-reading service (OCR or a
   model), which the spec doesn't mention. *Default:* Phase 2 ships claims with the amount typed in. Reading
   receipts automatically becomes its own task (P2-28) once you pick the service.
6. **WhatsApp.** The screens send by WhatsApp in places (Send BOQ, approvals opened from a WhatsApp link, snag
   vendor notified on WhatsApp), while decision 12 defaults to in-app and email only. *Default:* a WhatsApp
   button opens a `wa.me` link from the person's own phone with the message filled in. There's no WATI
   integration and nothing is sent automatically.
7. **Client portal tabs.** The screens file shows Progress · Budget · Estimate · Payments · Docs. Product spec §16
   also has Snags and Handover. *Default:* build all seven, with Snags and Handover in Phase 4.
8. **Sign in.** The Sign in screen adds "email me a sign-in link" and a 15-minute lock after 5 wrong tries.
   *Default:* both are in Phase 0 (P0-10 and P0-15), with the link valid for 15 minutes and single use.
9. **Bank file and Tally export.** Pending reimbursements downloads a "bank file", and All transactions exports
   to Tally. *Default:* plain CSV for both until you send a sample of your bank's bulk-payment format and your
   CA's Tally import format. Needed in Phase 2.
10. **Kit v2 README** says to build in a new repo, `barebase-studio-os`. This plan keeps building here
    (decision 1, and your 19 Oct instruction). The README and `docs/boq-studio-plan-reference.md` weren't copied.

---

