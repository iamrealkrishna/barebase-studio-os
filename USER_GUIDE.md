# Barebase BOQ Studio — User Guide

Everything you need to run a project through the app, start to finish. You
shouldn't need to ask anyone.

---

## Contents

**Getting started**
- [What this is and why we built it](#what-this-is-and-why-we-built-it)
- [Signing in](#signing-in)
- [Who can do what](#who-can-do-what)
- [Your account](#your-account)

**The flow, in order**
1. [Projects — starting one](#1-projects)
2. [Build BOQ — the main screen](#2-build-boq)
3. [Rate Card & Settings](#3-rate-card--settings)
4. [Client View — checking what they'll see](#4-client-view)
5. [Sending it to the client](#5-sending-it-to-the-client)
6. [What the client does](#6-what-the-client-does)
7. [Client Review — acting on their answers](#7-client-review)
8. [Versions, change orders and the audit trail](#8-versions-change-orders-and-the-audit-trail)

**Features by name**
- [Adding items: the cascade](#adding-items-the-cascade)
- [Custom items](#custom-items)
- [Quantity from dimensions](#quantity-from-dimensions)
- [Typing a quantity over the calculation](#typing-a-quantity-over-the-calculation)
- [The entry form and the compact list](#the-entry-form-and-the-compact-list)
- [Editing rows inline](#editing-rows-inline)
- [Sections](#sections)
- [Scope of work, internal notes and photos](#scope-of-work-internal-notes-and-photos)
- [Default scope notes on rate card items](#default-scope-notes-on-rate-card-items)
- [Discount and GST](#discount-and-gst)
- [Cost & margin](#cost--margin)
- [What the client is allowed to see](#what-the-client-is-allowed-to-see)
- [Client PDF vs Internal PDF](#client-pdf-vs-internal-pdf)
- [Import from another project](#import-from-another-project)
- [Duplicating a whole project](#duplicating-a-whole-project)
- [Bulk rate card edit in Excel](#bulk-rate-card-edit-in-excel)
- [Team management](#team-management)

**Reference**
- [What isn't built yet](#what-isnt-built-yet)
- [Common questions](#common-questions)

---

## What this is and why we built it

BOQ Studio is where Barebase builds Bills of Quantities and gets them approved
by clients.

**The problem it replaces.** BOQs used to live in Excel. That meant: the rate
card was a separate sheet somebody had to remember to copy from, so quotes went
out with last quarter's rates. Two people editing the same file overwrote each
other. Every estimate was a fresh save-as of the last one, so a mistake
propagated for months. Sending it to a client meant exporting a PDF by hand and
hoping the internal cost columns had been deleted. And when a client said "I
never agreed to that oak finish", there was no record of what they'd seen or
when.

**What the app does instead.** One shared rate card the whole team pulls from.
One live BOQ per project that saves as you type. A client-facing view with cost
and margin structurally removed rather than manually deleted. And a record of
every version, every client decision and every change made after approval.

**The rule to remember:** clients never see cost or margin. Not because someone
remembers to hide it — the client's page is built from data that doesn't contain
those numbers at all.

---

## Signing in

Go to the app URL and sign in with your Barebase email and password. An admin
sets your password for you the first time and passes it on directly; there's no
email invite yet.

The password box has an **eye icon** on the right — click it to check what
you've typed. Every password field in the app has one.

Signing in lasts 30 days on that device.

**Clients never sign in.** They get a link that opens their estimate directly.

---

## Who can do what

Three roles.

| | Admin | Team Member | Client Contact |
|---|---|---|---|
| Build and edit BOQs | ✅ | ✅ | — |
| Send a BOQ to a client, manage their links | ✅ | ✅ | — |
| Duplicate a project, import from another | ✅ | ✅ | — |
| Export the Client PDF | ✅ | ✅ | ✅ (their own) |
| **See internal cost and margin** | ✅ | ❌ | ❌ |
| **Export the Internal PDF** | ✅ | ❌ | ❌ |
| **Edit the rate card** (incl. Excel import) | ✅ | ❌ | ❌ |
| **Change letterhead and default terms** | ✅ | ❌ | ❌ |
| **Add team members, change roles** | ✅ | ❌ | ❌ |
| Approve / reject line items | — | — | ✅ |

**Team Members genuinely cannot see cost or margin.** The toggle isn't hidden
from them — the numbers are never sent to their browser in the first place, so
there's nothing to find. They can still build and edit freely; the app fills in
the internal cost behind the scenes from the rate card, so nothing is lost by
them touching a BOQ.

One thing a Team Member can't do: set an internal cost on a **bespoke** item
that isn't on the rate card. That stays at zero until an admin fills it in.

**Client Contacts** aren't user accounts. Each one is a person on one project,
with their own link. They see that project's estimate and nothing else — no
other projects, no rate card, no cost, no internal notes, no version history.

You can always check your own permissions: **your name, top right → Your
account → What your role can do**.

---

## Your account

Click your name in the **top right corner** of any screen.

- **Your details** — your name and email. Your name is what gets stamped on
  versions and the audit trail, so keep it real. Your email is also your
  sign-in, so changing it changes what you log in with next time.
- **Your password** — change it here. You'll need your current one.
- **What your role can do** — the table above, filled in for you.
- **Your projects** — the five you started most recently.
- **Sign out**.

---

# The flow, in order

## 1. Projects

**Where:** *Projects* in the top nav — the screen you land on after signing in.

Every project in the studio, newest activity first, with its client, how many
versions it's had, its current value, and its status.

**To start one:**
1. Click **＋ Add project**.
2. Fill in **Property / project** (e.g. "Heritage Firefly, 3BHK") and **Client
   name**.
3. Click **Create project** — it opens straight into Build BOQ with three empty
   sections ready.

Click any row to open it. Each row also has a **Duplicate** button — see
[Duplicating a whole project](#duplicating-a-whole-project).

---

## 2. Build BOQ

**Where:** click a project from the Projects list.

This is where you'll spend your time. Four tabs run across the top of every
project: **Build BOQ**, **Client View**, **Client Review**, **Versions &
Approvals**.

The screen has three parts:

- **The top strip** — client, property, prepared by, date. Edit any of them
  here.
- **The middle** — your sections and their line items.
- **The Summary panel on the right** — running totals per section, discount,
  GST, grand total, and the client-visibility toggles.

**It saves as you type.** There's no Save button for the BOQ itself. The chip in
the top right says *All changes saved* / *Unsaved changes* / *Saving…* so you
always know where you stand.

> **If you ever see "Out of date — reload"**, it means this BOQ has changed
> somewhere else — another tab, a colleague, or a restored version. The app has
> stopped saving rather than overwrite their work. Reload the page and redo your
> last edit. Nobody loses anything, but there's no automatic merge.

The rest of this section covers each feature; jump to whichever you need.

---

## 3. Rate Card & Settings

**Where:** *Rate Card & Settings* in the top nav. **Admins only** for editing;
Team Members can look but not change, and don't see the Cost column.

Three blocks:

**Letterhead & default terms** — your studio name, legal entity for the
signature block, address, and POC name/phone/email. These print on every PDF and
show at the top of the client's page. The **default terms & exclusions** you set
here get copied into every *new* project, where they can be edited per project.

**Rate card** — the shared price list, ~253 items across 17 categories. Every
row has a Category, Description, Material, Finish, Unit, Rate and internal Cost.

To edit it:
1. Pick a category from the dropdown (it opens on the first one rather than
   loading all 250 rows at once), or search.
2. Edit any cell in place.
3. Click **Save rate card** — it's shared with the whole team immediately.

- **＋ Add rate item** adds a row to the category you're filtered to.
- **Unit** is a dropdown that tells you what each unit does: "SQFT — length ×
  breadth", "Nos. — typed quantity". Pick **Custom unit…** to type one that
  isn't listed; it then appears in every other row's dropdown.
- **Reset to defaults** wipes your edits back to the shipped rate card. It asks
  first.

**Bulk edit** — see [Bulk rate card edit in Excel](#bulk-rate-card-edit-in-excel).

---

## 4. Client View

**Where:** the *Client View* tab inside a project.

Exactly what your client will see, on the real page they'll get. Cost, margin
and internal notes aren't in it.

Use it as your last check before sending. Two things you can do from here:

- **What the client can see** — the column toggles, right at the top, so you can
  flip one and watch the effect immediately. See
  [What the client is allowed to see](#what-the-client-is-allowed-to-see).
- **Client links** — the share link for each contact, with a Copy button.

---

## 5. Sending it to the client

Two things have to happen: the client needs a link, and the BOQ needs to be
saved as a version.

**Give the client a link** (once per person):
1. Go to **Versions & Approvals**.
2. Under **Client access**, enter their name and email.
3. Click **Create review link**.
4. Copy the link and send it however you normally would — WhatsApp, email,
   whatever. **The app does not send it for you.**

**Get the email right.** Opening the link asks for the email address you entered
before it shows anything, so a typo there means the client can't get in. See
[The link access check](#the-link-access-check).

Each contact gets their own link. If more than one person on the client side
needs to review, give each of them their own — the app then records who said
what.

**Send the BOQ:**

From **Build BOQ**, click **Save version & continue to Client View →** at the
bottom. That snapshots the BOQ as a new version, marks it *Sent to Client*, and
takes you to the Client View.

Or from **Versions & Approvals**, use **Save & mark Sent to Client**.

> A client's link always shows the **newest version marked Sent to Client or
> Approved** — never your live working copy. So you can keep editing after
> sending without the client seeing half-finished changes. They only see the new
> state when you save another version.

**To revoke someone's access**, click the ✕ next to their link on Versions &
Approvals. It stops working immediately.

**If a link has been forwarded further than it should have been**, click
**Revoke & reissue** instead. That swaps in a brand-new URL in one action: the
old one dies, every device that had passed the email check has to pass it again,
and the contact keeps their approval history. Send them the new link.

---

## 6. What the client does

They open the link and are asked for the email address you sent it to. Once
they've entered it, that browser remembers them for 30 days. Then they see a
branded, read-only version
of the estimate: your letterhead, the line items, section subtotals, discount,
GST, grand total, your terms, and any scope notes and reference photos you
added. No cost. No margin. No internal notes. No version history.

They can:

- **Approve the whole estimate** — a large green button at the **top** of the
  page. It asks for confirmation first, naming how many of their own flagged
  lines it would clear, because it overrides every line including ones they
  rejected.
- **Go line by line.** Each line has **Approve**, **Reject**, **Request change**,
  and **Add a note**.

**Every line-level click saves immediately** — there's no separate save step. A
green **✓ Approved / ✓ Rejected / ✓ Change requested** and a **"saved at 4:12
pm"** timestamp appear next to the line the moment it lands, and the timestamp
stays there, so a client is never left wondering whether their click registered.

**At the bottom is "Done — send my review".** It doesn't save anything (that
already happened) and it isn't a second approve-all. It's the end of their
journey: a running summary of what they've answered, and a button that tells you
they've finished. It stays disabled until they've responded to at least one
line, and afterwards shows a confirmation with the time — they can still change
any line and press Done again.

**Why that matters to you:** it's the difference between a client who hasn't got
to it yet and one who is finished and waiting on you. You can see it two places
— on **Client Review** in the header line, and as a **Finished** column on
Client access.

A few behaviours worth knowing so you can explain them:

- **Rejecting opens the note box automatically** and asks what's wrong. A
  rejection with no reason gives you nothing to act on, so the app pushes for
  one.
- **A note isn't a verdict.** They can approve a line *and* flag something
  ("fine, but use the lighter shade") and it stays approved. A note on a line
  they haven't decided on leaves it Pending.
- **If they've flagged lines**, the app tells them that approving everything
  would clear those flags — so they don't wipe their own feedback by accident.
- **If they reject a line on a version they'd already approved**, that version
  stops being Approved and goes back to Sent to Client. You can't end up with an
  "Approved" version that has a rejection sitting inside it.

They can also download their own copy of the Client PDF from that page.

---

### The link access check

Opening a client link asks for the email address the link was issued to — the
one in the **Email** column on Client access. If it doesn't match, they get a
flat *"This link isn't valid for that email"* — the same answer a dead link
gives, so the page never confirms to a stranger that a given link is real.

Once they've entered it, that browser remembers them for 30 days and they go
straight in on later visits.

**Be clear with yourself about what this is: a basic access check, not a login.**
It stops a link forwarded on WhatsApp from simply opening for whoever receives
it. Anyone holding *both* the link and the right email address still gets in.
Proper protection is a one-time code emailed to the contact each time — that
needs email sending, which isn't built. It's on the list.

Two things worth knowing:
- **Reissuing a link invalidates every remembered device**, because the memory is
  tied to the specific link.
- Failed attempts are recorded in the project's audit trail, so you can see if
  someone's been probing a link.

## 7. Client Review

**Where:** the *Client Review* tab inside a project.

This is where you deal with what the client said. It's laid out **like the BOQ**
— same sections, same rows — not as a separate list of complaints, so you read a
rejection next to the work it belongs to.

At the top: which version they reviewed, when it was sent, who has opened it,
and a count — approved / rejected / changes asked / pending / with notes.

Every line shows the client's verdict, who gave it and when, and their comment
inline. Colour-coded the same way the Client View highlights new and changed
lines:

- **Red** — rejected
- **Amber** — change requested
- **A quiet grey rule** — approved, but they left a note

It opens filtered to **Needs attention** — anything rejected, queried or
commented on. **Every line** shows the lot.

**The point of the screen is that you fix things here.** Every row opens with
the same inline editor as Build BOQ, with the client's words still on screen
while you change the finish or drop the quantity.

**To act on feedback:**
1. Click the **✎** on a flagged row.
2. Change whatever they asked for — the client's comment stays visible above the
   editor.
3. Click **✓ Save**. It saves to the live BOQ.
4. When you've worked through everything, click **Save version & send back →**.
   That snapshots the reworked BOQ as a new version, marks it Sent to Client and
   takes you to Client View so you can send the link again.

The **Client Review tab carries a badge** with the number of lines still needing
attention, visible from anywhere in the project.

Two things this screen deliberately doesn't do:

- **No delete button.** Removing a line the client has commented on is a scope
  decision — do it on Build BOQ where the whole estimate is in view.
- **Lines the client reviewed that you've since deleted** are listed separately
  at the bottom rather than vanishing, so their feedback isn't silently lost.

---

## 8. Versions, change orders and the audit trail

**Where:** the *Versions & Approvals* tab inside a project.

**Versions** are snapshots, and they're driven by status rather than by you
remembering to save. One clear status per BOQ:

**Draft → Sent to Client → Approved**

Each version records its number, status, date, who saved it, the item count, the
total, and how many lines the client has approved. You can:

- **Set** — change a version's status by hand from the dropdown.
- **Open** — pull an old version back into the live BOQ. It replaces what's
  currently there, so save a version first if the current state matters.

**Change orders** are the safety net. Once a version has been approved, any
later edit to an approved line raises a Change Order automatically — recording
old value → new value, the field that changed, and who changed it. Added and
removed lines are recorded too. You don't do anything to trigger this; it
happens when you save the next version.

This is what stops approved scope being quietly overwritten, and it's the record
that settles "but I never agreed to that".

**Audit trail** — every action by either side, timestamped and attributed:
versions saved, links created and revoked, every client approval, rejection and
comment, and every change order. **Export audit log PDF** gives you the whole
thing as a document.

---

# Features by name

## Adding items: the cascade

Line items are built by narrowing down four dropdowns, each one filtering the
next:

**Category → Description → Material → Finish**

Pick "Civil & Infra Works", and Description offers only what that category
contains. Pick "Painting", and Material offers only the materials Painting comes
in. And so on.

When you land on a real rate card row, the app fills in **Unit**, **Rate** and
the internal **Cost** for you. Change any level and everything downstream
re-drives — including if you change the Category on an item you've already
added.

---

## Custom items

Anything the rate card doesn't cover.

Pick **Other (custom item)** at the Category level, or **Custom item…** at the
Description level. The dropdowns become free-text boxes and you type the
description, material, finish, unit and rate yourself.

Custom items behave like any other line — they show, total, print and get
approved the same way. They just don't pull from the rate card.

> Team Members can add custom items, but can't set an internal cost on them (see
> [Who can do what](#who-can-do-what)).

---

## Quantity from dimensions

The **unit** decides which measurement boxes appear, so you enter the dimensions
you actually measured rather than doing arithmetic first:

| Unit | You enter | Quantity is |
|---|---|---|
| **SQFT** | Length × Breadth | L × B |
| **RFT** | Length | L |
| **CFT** | Length × Breadth × Height | L × B × H |
| **Nos., Set, Lumpsum, Day, Person, Kg, Litre…** | Quantity | what you typed |

The Amount updates live as you type.

---

## Typing a quantity over the calculation

Sometimes you already know the total — an oddly shaped area, a number off a site
measurement — and multiplying L × B would be wrong.

**Just type into the Qty box.** It takes your number and stops recalculating
from the dimensions. The label shows a small **"typed"** flag so it's obvious
this line isn't following its dimensions, and the dimension summary is dropped
from the row (it would contradict the quantity beside it).

**To go back to automatic:** clear the Qty box, or edit any dimension. Either
one hands control back to L × B.

---

## The entry form and the compact list

Designed for adding many items quickly.

1. Click **＋ Add item** on a section.
2. The entry form opens. Work across it: Category, Description, Material,
   Finish, dimensions, rate.
3. **Press Enter in any field** (or click **Add item ↵**). The item drops into
   the list as a compact one-line row, and the form resets — ready for the next
   one.
4. When you're done adding, click **Close**.

The compact row shows: number, description, the category/material/finish/
dimension summary, quantity @ rate, and the amount.

---

## Editing rows inline

**Click the ✎** on any compact row. It expands in place into the full editor —
the whole cascade including Category, dimensions, quantity, rate, plus **Scope &
notes**.

- **Several rows can be open at once.** Open as many as you need.
- Each row has its own **✓ Save** and **Cancel**, right where you're working.
- A bar appears at the bottom of the screen offering **Save all N rows** and
  **Discard all** when more than one is open.
- **Cancel** discards that row's changes; it doesn't touch the others.

Open rows are *not* autosaved — they stay pending until you save them. That's
deliberate: a half-typed row shouldn't reach the BOQ.

Click **✕** on a row to delete the item.

---

## Sections

Sections mirror how Barebase's sheets are actually organised.

- **Fixed sections come first, always:** Electrical Work, Wall Works, Other.
  Every new project starts with these three.
- **Rooms after that:** Living Room, Dining, Kitchen, Bedroom, Puja Room,
  Utility and so on, from the dropdown.
- **Custom** for anything project-specific — a Terrace, a Study.

**To add one:** the **＋ Add section…** dropdown below the last section. Pick a
room, or **Custom section…** and type a name.

**To focus on one section:** the section-jump dropdown at the top filters the
view to it. Everything else is hidden until you switch back. (A dropdown rather
than tabs — a 15-room project would overflow a tab strip.)

**To remove one:** the **✕** on the section header. If it has items in it, it
asks first.

---

## Scope of work, internal notes and photos

Three fields per line item, behind **Scope & notes** in the row editor (the
button shows a **•** when there's something in there).

- **Scope of work** — the long-form paragraph the client reads to understand
  what they're getting. "Supply and installation of…". Prints in the Client PDF
  as a Scope Notes appendix and shows on the client's page under the line.
- **Internal note** — short asides for the team: "changed on site", "awaiting
  client confirmation". **Never shown to the client**, never in the Client PDF.
- **Reference photo** — click **＋** to attach one. It's compressed
  automatically. Photos appear in a reference appendix at the back of the Client
  PDF, and as a thumbnail on the client's page.

---

## Default scope notes on rate card items

Stops the same scope-of-work paragraph being retyped on every BOQ.

**Where:** the **Default scope note** column on each rate card row, next to Rate
and Cost. **Admins only** (it's part of the rate card). It's also a column in the
bulk CSV export and import.

**How it works:** when anyone adds that item to a BOQ, its **Scope of work** is
pre-filled with the default. From there it behaves like the Rate — a starting
point, editable or clearable on that line without affecting anything else.

Two rules that keep it safe:
- **Typing your own wording wins.** If you've edited the scope on a line, changing
  the item's Category or Description won't overwrite what you wrote. Only text
  that's still untouched boilerplate gets replaced.
- **Changing the default never rewrites existing BOQs.** Lines already saved —
  including ones a client has read and approved — keep exactly the scope text
  they were saved with. Only items added *after* the change pick up the new
  wording.

## Discount and GST

Both live in the **Summary panel** on the right of Build BOQ.

**Discount** — type a number and pick **%** or **₹**. It applies to the whole
BOQ and shows as its own line in the summary and on every PDF.

**GST** — tick **Add GST** and pick a rate: 5%, 12%, 18%, 28% or Custom. It
splits into CGST and SGST at half each, matching Barebase's invoice format.

Both flow through to the client's page and both PDFs automatically.

---

## Cost & margin

**Admins only.**

The **Cost & margin** checkbox sits in the top bar of Build BOQ and Client
Review. It's **off by default** every time you load the page — so you don't
demo a BOQ to a client with your margin on screen.

Switch it on and you get:

- A **Cost** box on each line, next to Rate.
- A **margin** figure on the entry form as you type.
- A **Cost & margin — internal** block in the Summary panel: internal cost,
  margin in rupees, margin as a percentage.

None of it ever reaches a client. Team Members don't see the toggle at all.

---

## What the client is allowed to see

Four per-project toggles control which details appear on the client's line
items:

- **Material**
- **Finish**
- **Qty** — the quantity, its unit and the dimension summary together (a bare
  "SQFT" with no number beside it tells a client nothing)
- **Rate per unit**

**Where:** the Summary panel on Build BOQ, *and* at the top of Client View. Same
setting in both places — set it wherever you happen to be.

Turn Rate off and it disappears from the client's page, the Client PDF **and**
the Internal PDF alike. The description and the line amount always show.

---

## Client PDF vs Internal PDF

Both are generated from whatever's on screen, so they're always current. Both
are in the top bar of Build BOQ and in the Summary panel.

**Client PDF** — what you send.
- Letterhead, client, property, prepared by, date
- Line items with section subtotals
- Discount, GST split into CGST/SGST, grand total
- Terms & exclusions
- Scope Notes appendix (the long-form scope per item)
- Reference Images appendix
- Signature block
- **No cost. No margin. No internal notes.**

**Internal PDF** — **admins only**. Everything above, plus:
- A **Cost** column and a **Margin** column per line
- A margin summary: total internal cost, margin, margin %

Filenames come out as `Project_Name_Client_Estimate.pdf` and
`Project_Name_Internal_Cost_Sheet.pdf`, so they're hard to mix up.

> Rupee amounts print correctly — ₹ symbols and right-aligned totals both.

---

## Import from another project

Pull sections or individual lines out of any other project in the studio.

**Where:** **↧ Import from project** at the top of Build BOQ.

1. Click it. You get every other project with its item count and value.
2. Pick one. You see its sections, each with its item count and a note on what
   will happen — *"merges into your existing section"* or *"will be added as a
   new section"*.
3. Take whole sections, or expand one and tick individual lines.
4. Click **Import N items**.

**Imported items are copies, not links.** Editing one afterwards can never touch
the original project. Sections whose names you already have merge in; the rest
are added.

---

## Duplicating a whole project

Cloning last month's 3BHK to start this month's.

**Where:** the **Duplicate** button on any row of the Projects list.

1. Click **Duplicate**.
2. Give the copy a name and a client — or tick **Keep the original client**.
3. Confirm. It opens the new project.

You get all the sections, all the items, the terms, the discount and the GST
settings. You **don't** get the original's versions, client links, approvals or
change orders — the copy starts as a fresh Draft, which is what you want. The
two projects share nothing.

---

## Bulk rate card edit in Excel

**Admins only.** For repricing in bulk rather than one cell at a time.

**Where:** the **Bulk edit** block at the bottom of Rate Card & Settings.

**To export:** click **↓ Download Rate Card**. You get a CSV that opens straight
in Excel, with columns: Item ID, Category, Description, Material, Finish, Unit,
Rate, Cost.

**To import it back:**
1. Edit in Excel. Keep the header row and keep the **Item ID** column.
2. Click **↑ Upload Rate Card** and pick your file.
3. **You get a preview — nothing is saved yet.** It shows every item that will
   be updated with old → new per field, every new item, and every row it
   couldn't read with the reason why.
4. Check it, then click **Confirm**. Only now is anything written.

**About the Item ID column.** It's what lets you reword a Description in Excel
without the app losing track of the item. Rows that still carry their ID are
matched on it, and any field can be changed.

**Adding new rows? Leave Item ID blank** — as many as you like. A blank ID means
"this is new"; the app generates a permanent one on import, which appears the
next time you download. Don't invent your own IDs — a blank cell is the correct
way to say "new".

Blank-ID rows are matched on Category + Description + Material + Finish first,
so if one happens to match something you already have, it's treated as an edit
rather than a duplicate.

**Copied a row and forgot to clear its ID?** That's fine. If the copy describes
something different from the row it came from, it's added as a new item and the
original is left alone — the preview says so on that row. Only a genuinely
identical duplicate is skipped.

**Two things that will bite you if you don't know them:**

- **Save your on-screen edits first.** The download reflects what's on screen,
  but an upload is compared against what's actually stored. The app warns you if
  you have unsaved changes.
- **53 rows share a match key with another row.** There are five different
  "Accessories · Brand - EBCO/HETTICH" products, Loft at two heights, and so on
  — Category + Description + Material + Finish doesn't tell them apart. **Keep
  the Item ID column** and they're matched exactly. Delete it and those rows are
  reported as ambiguous and skipped rather than guessed at.

Bad rows never block good ones — they're listed with a reason and skipped, and
the rest import. And if a colleague changed a value between your preview and
your confirm, that row is left alone and reported rather than silently
overwritten.

---

## Team management

**Admins only.** Team Members can't reach this page even by typing the URL.

**Where:** *Team* in the top nav.

Everyone in the studio with their role, when they were added, and how many
projects and versions they've authored.

**To add someone:**
1. **＋ Add team member**.
2. Name, email, an initial password (min 8 characters), and Admin or Team
   Member.
3. **Add member**.
4. Pass them the password directly — **there's no email invite yet**. The
   password box is masked; use the eye to read it back. They can change it
   themselves on their account page once they're in.

**Other actions per person:**
- **Promote / Demote** between Admin and Team Member.
- **Reset password** — set a new one for them.
- **Deactivate** — blocks sign-in immediately, *including any session they
  already have open*, while keeping every project, version and audit entry they
  authored. Use this instead of deleting; deleting would tear holes in the audit
  trail.
- **Restore access** on anyone deactivated.

Two guardrails: **the last active Admin can't be demoted or deactivated** (so
nobody can lock everyone out), and you can't deactivate yourself.

---

# Reference

## What isn't built yet

Straight answers on the gaps, so nobody goes looking.

**No email, anywhere.** This is the big one. Share links are copied and sent by
hand. Clients aren't notified when an estimate is ready. You aren't notified
when a client approves, rejects or comments — you have to open the project and
look (the badge on the Client Review tab is there to help). New team members are
given their password directly rather than invited.

**Client links are protected by an email check, not a login.** Opening one asks
for the address it was issued to, which stops a forwarded link opening for
whoever receives it. It is not authentication: anyone with both the link and the
address gets in. The proper fix — a one-time code emailed to the contact — needs
email sending, so it's blocked behind the item above.

**No BOQ import from Excel.** You can import a *rate card* from CSV, and you can
import line items *from another project in the app*. There is no way to import a
BOQ from an external Excel file — those items have to be entered in the app.

**Bulk rate card edit is CSV, not .xlsx.** CSV opens and saves natively in Excel
and needs no extra step, but it's not a true Excel workbook — no formulas, no
multiple sheets.

**Compare Quote isn't built.** Uploading a competitor's PDF quote and comparing
it against a Barebase BOQ (`BOQ_BUILDER_V2_SPEC.md` §5) hasn't been started.

**Concurrent editing is guarded, not merged.** If two people edit the same BOQ
at once, the second one to save is stopped with a *"This page is out of date"*
banner and has to reload and redo that edit. Nobody's work is overwritten, but
the app won't merge the two for you.

**Rate card gaps carried over from the source sheets.** Deliberately not
silently patched:
- Several Wardrobe finish variants (duco/PU/membrane/glass on "with loft", and
  all "Hinged wardrobe" variants) have no rate in the source sheet and are
  absent from the rate card.
- Beds, Puja back-panels and Dining table/chair carry their full spec text in
  the **Finish** column with **Material** blank, because the source data doesn't
  split them cleanly.

Add or fix any of these on Rate Card & Settings whenever you have the numbers.

**Reference photos are stored in the database**, downscaled. Fine at current
volumes; if projects get very photo-heavy that'll need moving to proper file
storage.

---

### Things listed as missing in the old handover that are now done

If you're reading `HANDOFF.md` or the spec documents, these are out of date —
all of the following are built and live:

- Real backend, real database, real logins — no more artifact storage
- Role-based access (Admin / Team Member / Client Contact), enforced on the
  server, not just hidden in the interface
- Configurable letterhead — studio name, legal entity, address and POC are all
  editable on Rate Card & Settings
- PDF export as a proper part of the app, with ₹ rendering correctly
- Sections and rooms, dimension-driven quantities, long-form scope of work
- Both the internal note *and* the scope-of-work field — the open question in
  `BOQ_BUILDER_V2_SPEC.md` about whether to keep a short internal note alongside
  the long description was resolved by keeping both
- Client approvals line by line, change orders, and the audit trail

---

## Common questions

**Do I need to save the BOQ?**
No. Build BOQ saves as you type. The only thing you save by hand is a *version*,
which is a deliberate snapshot for sending to a client.

**I edited the BOQ after sending it. Can the client see my changes?**
No. Their link shows the newest version you saved as Sent to Client or Approved,
not your live working copy. They see changes when you save another version.

**Why can't I see the Cost column?**
Cost and margin are admin-only. Check **your name → Your account → What your
role can do**; ask an admin if you need the change.

**The client says they never got the link.**
The app doesn't send anything — links are copied and sent by hand. Go to
Versions & Approvals → Client access, copy theirs, and send it again.

**A client approved, then asked for a change. What happens?**
Their rejection un-approves that version and it goes back to Sent to Client.
Their comment appears on your Client Review tab. Fix the line there, then **Save
version & send back**. Because a version had been approved, your edit is also
recorded as a Change Order.

**I deleted a line by mistake.**
If you've saved a version since, open Versions & Approvals and use **Open** on
the last good version to pull it back. There's no undo on the live BOQ itself.

**Can two of us work on the same BOQ at once?**
You can both have it open, but you'll get an *"Out of date — reload"* banner if
you both edit. It's safe — nothing gets overwritten — but decide who's driving.

**How do I change the terms & exclusions?**
Per project: Versions & Approvals → Project details. For all *new* projects:
Rate Card & Settings → Letterhead & default terms (admin only).

**Someone's left Barebase.**
Team → **Deactivate**. Don't delete — deactivating blocks their sign-in
immediately while keeping everything they authored intact in the record.
