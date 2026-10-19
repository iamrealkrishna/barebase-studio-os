# Prompt 02a · Phase 1a: UI system, shells and component gallery

Read `CLAUDE.md`, `docs/PLAN.md` and UI spec sections 2, 3, 6, 7 and 9. Look at every image in `docs/ui/reference/`.
The HTML mock-ups in `docs/ui/mockups/` (with `base.css`) show exact markup and measurements for the component sheet,
app shell, Finance, Approvals and phone screens. Use them as a visual reference, not as code to paste.

Build, in this order, one PR per group:

1. **Primitive components** in `components/ui`: Button, inputs (text, select, date, textarea), MoneyInput (Indian
   commas as you type, amount in words, confirm above ₹1,00,000), StatusChip, Avatar, ProgressBar. Each with the
   props and the five states in the UI spec's Component API table.
2. **Composite components:** DataTable, Tabs (route-based), SideSheet (state in the URL `?sheet=`), Dialog, Toast with
   Undo, EmptyState, StatCard, PageHeader, FileDrop, PhotoCapture (compress to 1600 px long edge, JPEG 0.8).
3. **Component gallery** at `/dev/ui` (staging only): every component in every state. Stop and ask Krishna to review the
   gallery before step 4.
4. **Shells:** AuthShell, AppShell (sidebar with Home, Leads, Projects, Finance, Team, Settings; top bar with search,
   approvals count, notifications, profile; collapses to icons below 1280 px; bottom bar on phones), ProjectShell
   (project sidebar, breadcrumb, stage bar), ClientShell. Wire up the full route map from UI spec section 3 with
   placeholder pages (some may already exist from the set-up PR).

Done when: the gallery and shells match the reference images at 1440 px and 375 px; visual snapshots are committed; axe reports
no serious issues; there are no raw hex values outside the tokens file.
