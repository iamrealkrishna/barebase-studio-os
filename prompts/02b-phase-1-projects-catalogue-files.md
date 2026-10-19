# Prompt 02b · Phase 1b: Projects, Project Overview, catalogue and Files

Read `CLAUDE.md`, `docs/PLAN.md`, product spec sections 6, 7 and 9, and UI spec sections 5.1 to 5.3 with their build
notes.

Build:

1. **Project record and stages.** All fields from product spec section 6, project code `BB-YY-NNN`, team with project
   roles, automatic stages via the project-stage status machine (stage moves only through events, plus the manual On hold,
   Lost and Reopened with a reason), stage history.
2. **Projects list** (UI spec 5.2): stage tabs with counts, filters in the URL, table and card views, New project side
   sheet (only name, client, lead designer required).
3. **Project Overview** (UI spec 5.3): stage bar, money, progress and BOQ cards, "Needs attention" list, activity. Use
   placeholder values where later phases supply data (Finance, progress), clearly marked in code with `TODO(phase-2)`
   and so on.
4. **Item catalogue** (product spec 7): rename Rate to Selling rate and Price to Cost price; add GST %, HSN, default
   scope, image, active flag, item code; margin column for cost viewers; bulk rate change by %; CSV import with
   preview (new, changed, unchanged, errors) and export; rate history.
5. **Files** (product spec 9): default folders, upload with versions, Draft → Approved internally → Shared with
   client, design freeze linked to the current BOQ version, comments, signed download links.
6. **Home v1** (UI spec 5.1) with the cards whose data exists so far.

Done when: every acceptance check in product spec sections 6, 7 and 9 and every "Done when" row for these screens
passes in Playwright.
