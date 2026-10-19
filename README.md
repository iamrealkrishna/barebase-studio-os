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
| `prompts/` | 00 set-up, one prompt per phase, plus "next task" and "review PR" |

## How to use it

1. Start a Claude Code session with this repo, `barebase-studio-os`, only.
2. Paste: "Read CLAUDE.md, then follow prompts/00-kickoff.md exactly." It scaffolds the app and every route,
   writes `docs/PLAN.md`, opens one PR and stops.
3. Answer its questions, give it the Neon, Vercel, Resend and Blob details, and merge.
4. Then one phase per session: 01, 02a, 02b, 02c, 03a, 03b, 04, 05, 06, moving task by task with
   `prompts/next-task.md`. Review each PR with `prompts/review-pr.md` in a fresh session before merging.

Where the phase prompts say "minERP", read "this repo". Proformas, the PO creator, Sent & due and Billing due
(product spec 11B, UI spec 5.12 to 5.15) belong to Phase 2; the screens added on 18 Oct are placed by phase in
`docs/screens-and-journeys.md`.
