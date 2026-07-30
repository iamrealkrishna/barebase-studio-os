# Barebase BOQ Studio

An internal tool for building Bills of Quantities for Barebase projects — pulls
from a shared rate card, calculates line-item and section totals, exports
client-facing and internal cost-sheet PDFs, and hands the client a link they can
approve line by line.

Built as a real Next.js app with Postgres persistence and team auth, replacing
the single-file prototype that relied on Claude's artifact storage.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Database | PostgreSQL via Prisma |
| Auth | Email + password, bcrypt hashes, signed JWT in an httpOnly cookie (`jose`) |
| PDFs | `jspdf` + `jspdf-autotable` as npm dependencies, generated client-side |
| Styling | Plain CSS ported from the "Warm Ledger" design, no framework |
| Hosting | Vercel |

## What's in it

**Build BOQ** (`/projects/[id]/build`)
- Cascading **Category → Description → Material → Finish** dropdowns off the
  shared rate card, auto-filling rate, internal cost and unit. "Custom item"
  fallback at every level for anything the rate card doesn't cover.
- **Dimension-driven quantity**: the unit decides which inputs appear — SQFT
  gives Length × Breadth, RFT a single length, CFT Length × Breadth × Height,
  and Nos./Lumpsum/Day/Person a plain typed quantity.
- One reusable **entry form** for adding: fill it, hit Enter in any field, it
  collapses into a compact row and resets for the next item.
- **Inline editing** of existing rows: the pencil opens that row in place with
  the full cascade — including **Category**, which re-drives Description,
  Material, Finish and the rate exactly as it does for a new item. Several rows
  can be open at once; one **Save changes** commits them all and **Cancel**
  discards the lot.
- **Import from project**: pull sections or individual lines out of any other
  project in the org, all at once or cherry-picked from a checklist. Items are
  copied, never linked, so editing one afterwards can't touch the original.
  Matching section names merge; the rest are added as new sections.
- **Sections**: fixed ones first (Electrical Work, Wall Works, Other), then
  rooms added from a dropdown with a Custom option. A section-jump dropdown
  filters to one section — no tab strip that overflows at 7 rooms.
- Long-form client-facing **scope of work** per item, plus a separate
  internal-only note, plus a reference photo (compressed client-side).
- Discount (₹ or %), GST toggle with 5/12/18/28/custom split into CGST/SGST,
  and a **Cost & margin** toggle that's off by default and never leaves the org.
- **Client-facing column toggles** (Material / Finish / Unit / Rate) in the
  Summary panel. Per-project, and honoured identically by the Client View page,
  the Client PDF and the Internal PDF — switch Rate off and it's gone from all
  three.
- Autosaves as you work.

**PDF export** — Client PDF (line-item detail, section subtotals, discount/GST,
terms & exclusions, scope notes, reference-image appendix, signature block; no
cost or margin anywhere) and Internal PDF (the same plus Cost, Margin and a
margin summary).

**Projects list** — every project with its client, version count, current value
and status, plus **Duplicate** to clone one whole project (sections, items,
terms, discount and GST) as a fresh Draft. The copy shares no rows with the
original, and carries none of its versions, client links or approvals.

**Versions** (`/projects/[id]`) — status-driven, not manual snapshots. One
status per BOQ: **Draft → Sent to Client → Approved**. Full history with
per-version totals, the ability to reopen any past version into the live BOQ,
and an exportable audit log. Internal-only; the client never sees it.

**Client View** — a read-only branded page. Items that are new or changed
*since the version that client last approved* are highlighted; nothing else
about the revision history is exposed.

**Approvals & change orders** — each project gets client contacts with their
own share link (no account, no login). A client can approve the whole estimate
in one click or go line by line with approve / request change / reject /
comment. Once an approved version exists, any later edit to an approved line
automatically raises a **Change Order** recording old → new, and every action by
either side lands in the audit trail.

**Rate Card & Settings** (`/settings`) — the 253-item default rate card across
17 categories, editable in-place and shared team-wide (admin only), with
letterhead, default terms and your own password.

**Bulk rate card edit** (admin only) — download the whole rate card as CSV, edit
it in Excel, upload it back. Rows are matched on **Item ID** when the exported
column is still there, and on **Category + Description + Material + Finish**
otherwise. Nothing is written on upload: you get a preview first showing every
update as old → new per field, every new item, and every row that couldn't be
read — bad rows are listed with a reason and skipped, they don't block the rest.
Only after you confirm is anything saved, and each update is re-checked against
the value the preview was built from, so a colleague's edit made in the meantime
is left alone and reported rather than silently overwritten.

**Team** (`/team`, admin only) — list everyone with their role, add a member by
setting their initial password directly, promote/demote between Admin and Team
Member, reset a password, and deactivate or restore access. Deactivating blocks
sign-in immediately (including any session already open) while keeping every
project, version and audit entry that person authored. The last active Admin
can't be demoted or deactivated, and you can't deactivate yourself.

### Roles

| Role | Can do |
|---|---|
| Admin | Everything, including the rate card, bulk import, organisation settings and the Team page |
| Team member | Build and version BOQs, manage client contacts; can't edit the rate card and can't reach `/team` |
| Client contact | Read + approve, scoped to one project. Never sees cost, margin, internal notes or version history. |

Role checks run server-side on every entry point — hiding a nav link is never
the thing keeping someone out.

## Running it locally

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate            # apply migrations
npm run db:seed               # create the org, first admin and default rate card
npm run dev
```

`npm run db:seed` reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from the
environment. It's safe to re-run: the org and admin are upserted, and the rate
card is only written when the org has none, so team edits are never stomped.

### Windows on ARM

Prisma has no Windows ARM64 engine — `windows` is its only Windows binary
target, and it's x64. On an ARM64-native Node install that engine can't be
loaded in-process, which surfaces as **"not a valid Win32 application"**.
Adding `windows-arm64` to `binaryTargets` does not fix this: it isn't a target
Prisma recognises, and `prisma generate` fails outright with *"Unknown binary
target"* — which would break `npm install` (it runs in `postinstall`) and the
Vercel build along with it.

Pick whichever of these fits, in rough order of least friction:

1. **Run the seed somewhere else.** It's a one-off against the production
   database — any x64 machine, WSL2, or a CI shell will do. Nothing about the
   deployed app cares which machine seeded it.
2. **Use WSL2 for local dev.** Prisma ships proper `linux-arm64` engines, so
   everything runs natively with no emulation.
3. **Install the x64 build of Node.js** (via nvm-windows, or the x64 installer).
   The x64 engine then matches the process loading it, and Windows emulates the
   lot.
4. **Switch to the binary engine**, which spawns the x64 engine as a separate
   emulated process instead of loading it into Node. Put this in your local
   `.env` — which is gitignored, so production keeps the faster library engine:

   ```
   PRISMA_CLIENT_ENGINE_TYPE=binary
   PRISMA_CLI_QUERY_ENGINE_TYPE=binary
   ```

## Deploying to Vercel

1. Import the repo in Vercel. Framework preset: **Next.js** (auto-detected).
2. Attach a Postgres database — the Neon or Vercel Postgres integration sets
   `DATABASE_URL` for you. Any Postgres works.
3. Set the remaining environment variables (Production and Preview):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Postgres connection string |
   | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `APP_URL` | Your deployment URL, e.g. `https://boq.barebase.in`. Optional — falls back to Vercel's own URL. Used to build client share links. |

4. Deploy. The build script runs `prisma migrate deploy` before `next build`, so
   the schema is applied automatically.
5. Seed the first admin once, from your machine against the production database:

   ```bash
   DATABASE_URL="<production url>" \
   SEED_ADMIN_EMAIL="you@barebase.in" \
   SEED_ADMIN_PASSWORD="<a real password>" \
   SEED_ADMIN_NAME="Your Name" \
   npm run db:seed
   ```

   Then sign in and add the rest of the team under Rate Card & Settings.

Set `APP_URL` to a stable domain before sending clients links — share links are
absolute and built from it.

## Known limitations

- **Concurrent editing is guarded, not merged.** Every autosave carries the
  `updatedAt` the tab was opened with; if the BOQ has moved on — another tab, a
  teammate, a restored version — the save is refused and the tab shows a reload
  banner rather than overwriting. Nobody loses work, but there's no merge: the
  second person reloads and redoes their edit.
- **No email yet.** Share links are copied and sent by hand, approvals don't
  notify anyone, and new team members are given their password directly by an
  admin rather than invited. `APPROVALS_SPEC.md` §5 wants email on both sides —
  the audit events are already recorded, so this is a delivery layer on top.
- **Bulk edit is CSV, not `.xlsx`.** CSV opens and saves natively in Excel and
  needs no parsing dependency; a real `.xlsx` reader would.
- **53 rate card rows share a match key with another row.** Category +
  Description + Material + Finish doesn't tell them apart — there are five
  distinct "Accessories · Brand - EBCO/HETTICH" products, Loft at two heights,
  and so on, all from the source sheets. Keep the Item ID column and the
  importer matches them exactly; drop it and those rows are reported as
  ambiguous and skipped rather than guessed at.
- **Compare Quote is not built** (`BOQ_BUILDER_V2_SPEC.md` §5).
- **Reference photos are stored as data URLs in Postgres**, downscaled to 480px
  JPEG. Fine at this volume; move to blob storage if projects get photo-heavy.
- **Rate-card gaps from the source sheets are carried over as-is**, not silently
  patched (per `HANDOFF.md` §3): several Wardrobe finish variants have no rate
  and are absent; Beds, Puja back-panels and Dining carry their full spec text
  in "Finish" with "Material" blank.

## Reference material

| File | Purpose |
|---|---|
| `Barebase BOQ.dc.html` | Finished visual design (Claude Design, "Warm Ledger") — the reference for look and feel. |
| `BOQ Redesign Directions.dc.html` | The three directions explored before Warm Ledger. |
| `barebase-boq-tool.html` | Earlier working prototype — reference for interaction logic. |
| `HANDOFF.md` | What the prototype did and the gaps this build closes. |
| `APPROVALS_SPEC.md` | Client approvals spec — line-item status, change orders, audit trail. |
| `BOQ_BUILDER_V2_SPEC.md` | Section/room restructure, versioning model, Compare Quote. |
| `PDF_FONT_LICENSE.txt` | License for the DejaVu Sans subset embedded in PDFs. |

### A note on the PDF font

jsPDF's built-in Helvetica is WinAnsi-encoded and has no glyph for ₹ — the
prototype's PDFs rendered it as a stray superscript and, because the width
calculation was wrong, right-aligned subtotals ran off the page edge. This build
embeds a subsetted DejaVu Sans (~22 KB per face, dynamically imported so it only
loads on export) so amounts print correctly.
