# Barebase Studio OS · handoff kit (v2, 18 Oct 2026)

Everything Claude Code needs to build Barebase Studio OS in a new repository.

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Rules Claude Code reads at the start of every session |
| `docs/screens-and-journeys.md` | All 43 screens with routes and roles, and the 10 end-to-end journeys |
| `docs/product-spec.md` | What to build: modules, fields, rules, permissions, formulas, phases, open decisions |
| `docs/ui-ux-spec.md` | How it looks and behaves: tokens, shell, status machines, screen build notes |
| `docs/ui/screens/` | Full-page mock-up of every screen (PNG), from the design canvas of 18 Oct |
| `docs/ui/mockup-source/` | The mock-ups' source (`.dc.html`): exact copy, numbers and layout to copy from |
| `docs/ui/reference/`, `docs/ui/diagrams/` | Earlier reference images and flow diagrams |
| `docs/decisions.md` | Answers already given; they override the spec defaults |
| `docs/boq-builder/` | The imported BOQ Studio app's map, specs, user guide and old prototypes |
| `prompts/` | 00 set-up, one prompt per phase, plus "next task" and "review PR" |

## How to use it

This repo starts from the BOQ Studio code (imported with its history on 19 Oct 2026), so sign-in, Team, the rate
card, the BOQ builder, versions, the client link and PDFs already work. Studio OS grows from there.

### Before you start (Krishna)

1. **Neon:** create a new project "barebase-studio-os". Restore BOQ Studio's production database into it (Neon:
   create the project from a branch or point-in-time copy of BOQ Studio's database, or `pg_dump` / `pg_restore`).
   That is this app's production database. Then create a branch "staging" from it.
2. **Vercel:** import this repo as a new project. Production → the new production `DATABASE_URL`; Preview → the
   staging one. New `AUTH_SECRET`. Nothing shared with BOQ Studio's Vercel project.
3. **Resend** API key (studio@barebase.in) and a **Vercel Blob** token, when Phase 0 asks for them.

### Then

1. Start a Claude Code session with this repo only.
2. Paste the start prompt (`prompts/00-kickoff.md`). It gets everything BOQ Studio did working end to end inside
   the new Studio OS shell, adds every other screen as a placeholder, writes `docs/PLAN.md` and opens one PR.
3. Merge, then one phase per session: 01, 02a, 02b, 02c, 03a, 03b, 04, 05, 06, task by task with
   `prompts/next-task.md`. Review each PR with `prompts/review-pr.md` in a fresh session before merging.

BOQ Studio (barebase-boq-app) carries on separately for the team until go-live; just before switching, a final
fresh copy of its data is taken.

Where the phase prompts say "minERP", read "this repo". Proformas, the PO creator, Sent & due and Billing due
(product spec 11B, UI spec 5.12 to 5.15) belong to Phase 2; the screens added on 18 Oct are placed by phase in
`docs/screens-and-journeys.md`.
