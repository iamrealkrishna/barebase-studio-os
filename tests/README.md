# End-to-end tests

Playwright, driving the real app in a real browser. Nothing is mocked: each
test signs in, clicks through the UI, and checks what the database gave back.

83 tests across thirteen areas — auth, Team admin, BOQ building, the rate card
CSV round-trip, duplicate/import, Client View (14 of them), GST on the Client
PDF, PDF layout, line-item counts, role restrictions, a mixed BOQ through both
PDFs, pre-count version compatibility, and diff accuracy.

## Running it

```bash
npm install
npx playwright install chromium     # once, if you've never run Playwright here
npm run test:e2e
```

That points at `http://localhost:3000`, so start the app first
(`npm run build && npm run start`, or `npm run dev`).

Useful variants:

```bash
npm run test:e2e -- tests/06-client-view.spec.ts   # one file
npm run test:e2e -- --headed                       # watch it happen
npm run test:e2e -- --debug                        # step through
npx playwright show-report                         # after a run
```

## Running it against production

```bash
E2E_BASE_URL="https://your-deployment.vercel.app" \
E2E_EMAIL="you@barebase.in" \
E2E_PASSWORD="<your real password>" \
npm run test:e2e
```

Then clean up (see below). Read the rest of this section first.

**It writes to the live database.** Everything it creates is named
`PLAYWRIGHT TEST …` so you can find it, and the cleanup script removes it, but
the records are real while they exist. In particular:

- **~25 projects** are created, with sections, line items and versions.
- **One team member** is created, promoted, demoted and left **deactivated**
  (so an interrupted run can't leave a working login behind). The cleanup
  script deletes them.
- **One client contact** with a live share link is created. Deleting the project
  removes it.
- **The rate card is never written to.** The CSV spec exports, uploads a
  modified copy, asserts the preview describes the right changes, then
  cancels — and the last test in that file re-exports to prove the card is
  byte-for-byte unchanged. Previewing is the step worth testing anyway.
- **Your own admin account is only read.** Nothing changes its password, role or
  details.

Run it against a preview deployment first if you'd rather not have test rows in
production at all.

## Cleaning up afterwards

A standalone script, not an in-app feature — the app has no delete-a-user
function and shouldn't grow one for this. It needs the database directly:

```bash
# See what would go, change nothing:
DATABASE_URL="<the app's DATABASE_URL>" npx tsx tests/cleanup.ts --dry-run

# Actually delete:
DATABASE_URL="<the app's DATABASE_URL>" npx tsx tests/cleanup.ts
```

On Vercel the connection string is under Project → Settings → Environment
Variables → `DATABASE_URL`.

What it removes:

| | Matched on |
|---|---|
| Projects | name **or client name** starts with `PLAYWRIGHT TEST` |
| Team members | name starts with `PLAYWRIGHT TEST`, or email starts with `playwright-test-` |
| Rate card items | category or description starts with `PLAYWRIGHT TEST` |

Deleting a project cascades to its sections, line items, versions, client
contacts, approvals, change orders and audit entries, so there's no second
pass. Nothing outside those three patterns is touched.

The client name is matched as well as the project name for a reason: some specs
edit "Property / project", which **renames the project** and drops the prefix
from its name. A name-only sweep left those rows behind. Any new spec that
renames a project must keep the prefix on one of the two fields.

One guard worth knowing: if a `PLAYWRIGHT TEST` user somehow authored a real
project or version, the script **skips** them and says so rather than deleting
and tearing a hole in the audit trail. Deactivate them on `/team` instead.

## How it's put together

| File | Covers |
|---|---|
| `helpers.ts` | Login, project/item creation, the `PLAYWRIGHT TEST` naming, and a dependency-free PDF text extractor |
| `01-auth.spec.ts` | Redirects for signed-out visitors, sign-in, session persistence, sign-out |
| `02-team.spec.ts` | Add / promote / demote / deactivate / restore, each verified from the affected user's own session |
| `03-boq.spec.ts` | Sections, dimension-driven quantities, arithmetic, inline multi-row editing, category switching |
| `04-rate-card-csv.spec.ts` | Export, ID-matched preview, blank-ID preview, bad rows, and proof that cancelling changed nothing |
| `05-project-actions.spec.ts` | Duplicate a project, import lines from another, and confirm both are copies rather than links |
| `06-client-view.spec.ts` | The client's own path end to end — see below |
| `07-gst-pdf.spec.ts` | CGST/SGST on the Client PDF, checked as arithmetic against the line items |
| `08-pdf-layout.spec.ts` | That nothing in either PDF is printed on top of anything else — see below |
| `09-item-count.spec.ts` | Two of the same item on one line: the count multiplies the quantity everywhere it appears |
| `10-roles.spec.ts` | Every page as both an Admin and a Team Member, with cost checked against the page source rather than what's visible |
| `11-mixed-boq-pdf.spec.ts` | One BOQ with every shape of line at once — counted, uncounted, piece-priced, custom — through both PDFs |
| `12-legacy-version.spec.ts` | A version snapshot written before counts existed, read back and restored |
| `13-lifecycle-diff.spec.ts` | The lifecycle end to end, with the diff checked for accuracy rather than presence |

### A note on the Client View tests

A client is not a user account. They reach the estimate through a per-contact
share link, and opening it asks for the email address the link was issued to.
So those tests run in **their own browser context with no Barebase session**,
going through the real gate — never the admin's preview of the same page, which
would prove nothing about what a client can actually see.

Two assertions are deliberately stricter than they look:

- **Column visibility** is checked against `page.content()`, so a value that was
  merely hidden with CSS would still fail. The same strings are then checked
  against both PDF exports.
- **PDF contents** are read by extracting text from the file. The exports embed
  a subsetted DejaVu Sans, so the content streams hold glyph ids rather than
  characters; `pdfText()` decodes them through the `/ToUnicode` map each
  embedded font carries. If a future font change made two faces disagree about
  a glyph, it throws rather than quietly decoding to the wrong text.

### A note on the PDF layout tests

Checking a PDF's *text* cannot catch a collision: two strings printed on top of
each other read back as two perfectly good strings. That is how a property
address printed straight across the quote date got past a suite that already
asserted on PDF contents.

So `08-pdf-layout.spec.ts` checks geometry instead. `pdfLayout()` reconstructs
where every string was actually drawn — the text matrix gives the position, and
the embedded font's `/W` array gives the advance width of each glyph, so a run's
extent is exact rather than estimated. `findOverlaps()` then reports any two
strings sharing a baseline that occupy the same space, and `findOutsideMargins()`
any string drawn outside the printable box.

Widths are read **per font and never merged across fonts**. Each embedded subset
numbers its glyphs from scratch, so glyph 19 in one face is a different character
at a different width in the next; merging them mismeasures every run and produces
false failures on right-aligned text.

The inputs are deliberately long — a real 114-character property address, a
double-barrelled client name, a 400-character scope note with no spaces in it to
wrap on. Short values fit whatever the layout does and prove nothing.

### A note on the pre-count version test

`12-legacy-version.spec.ts` writes a version snapshot in the genuine old shape —
no `count` key anywhere — straight into the database, then reads it back through
the running app: the Versions page total, a client opening their share link, and
a restore into the live BOQ. It needs `DATABASE_URL` and skips without one.

Its item ids are scoped to the run. Restoring a version deliberately reuses the
snapshot's ids so history stays continuous, and `LineItem.id` is a global
primary key, so fixed ids would collide with rows left by the previous run.

### Why it runs serially

One worker, `fullyParallel: false`. The rate card is a single shared record and
the app guards concurrent BOQ edits with an optimistic-concurrency check, so
parallel workers would fight each other and produce flakes that say nothing
about the app. Against production it also keeps the blast radius to one thing at
a time. The whole suite takes about two and a half minutes.

## Environment variables

| Variable | Default | Used for |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | Which deployment to drive |
| `E2E_EMAIL` | `krishna@barebase.in` | Admin sign-in |
| `E2E_PASSWORD` | `barebase123` | Admin sign-in |
| `E2E_RUN_ID` | last 6 digits of the timestamp | Suffix on created records, so re-runs don't collide |
| `DATABASE_URL` | — | Cleanup script only |
