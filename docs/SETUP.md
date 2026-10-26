# Setting up Studio OS's accounts

A step-by-step guide for Krishna. It creates everything Studio OS needs outside the code: its own database (a copy of
BOQ Studio's), a staging copy for testing, the Vercel project, email, file storage and error tracking.

**Two rules for the whole guide:**

- **BOQ Studio is only ever read, never changed.** Nothing below edits BOQ Studio's database, its Neon project or
  its Vercel project. Where a step touches BOQ Studio at all, it only copies a value or reads data.
- **Keys stay out of the repo.** Every key and password goes into Vercel's environment variables (or your own
  `.env`, which git ignores). Never paste one into GitHub, a pull request, a chat with Claude or a screenshot. If
  one leaks, make a new one and delete the old one.

Keep a private note (a password manager is best) as you go. You'll collect:

| What | From step |
| --- | --- |
| Production database connection string, and its host name | A |
| Staging database connection string | B |
| The app's address (`https://<name>.vercel.app`) | C |
| Two `AUTH_SECRET` values (production and staging) | D |
| Resend API key | E |
| Sentry DSN and auth token | F |

Screens in Neon, Vercel, Resend and Sentry change from time to time. If a button has moved, the docs linked in each
step say where it is now.

---

## A. Create the new Neon project from a copy of BOQ Studio's data

This makes Studio OS's own production database. BOQ Studio keeps its database exactly as it is.

### A1. Find BOQ Studio's connection string (read only)

1. Sign in to [Vercel](https://vercel.com) and open **BOQ Studio's** project.
2. Go to **Settings → Environment Variables**. Find `DATABASE_URL` (or, if the Neon integration made it,
   `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`). Click the eye icon and copy the value for **Production**.
   Don't edit or save anything on this page.
3. You need the **direct** (unpooled) string: its host name does **not** contain `-pooler`. If yours does, open
   BOQ Studio's project in the [Neon console](https://console.neon.tech), click **Connect**, turn **Connection
   pooling** off, and copy that string instead. Again, change nothing there.
4. Note BOQ Studio's **Postgres version**: its Neon project's dashboard shows it (for example 16 or 17).

Keep this string private: it can read and write BOQ Studio's live data. You only use it once, in A2.

### A2. Make the new project and copy the data in

The easy way is Neon's **Import Data Assistant** (for databases under 10 GB, which BOQ Studio's is). It reads from
BOQ Studio's database and writes only into the new project.

1. In the [Neon console](https://console.neon.tech), go to **Projects → New project**.
   - Name: `barebase-studio-os`
   - Postgres version: **the same as BOQ Studio's** (A1, step 4), or newer
   - Region: **AWS Asia Pacific (Singapore)** if offered (closest to Bengaluru), otherwise the same region as
     BOQ Studio's project
2. If Neon says you've reached your plan's project limit, **stop**. Don't delete or change BOQ Studio's project to
   make room. Upgrade the Neon plan instead (or ask me for the dump-and-restore route below).
3. In the new project, use **Import data** (from the Getting started panel or the Projects page) and paste BOQ
   Studio's **direct** connection string from A1. Follow the prompts. The data lands in a branch of the new project.
4. When it finishes, open **Branches**. Make sure the branch holding the data is the **default** branch (use
   **Set as default** if it isn't) and rename it `production`.
5. Check the copy: open **Tables** in the new project and compare a few counts with BOQ Studio, for example how many
   rows `Project`, `Version` and `User` have. They should match. (Krishna can also run
   `npx tsx scripts/project-totals.ts` against both later; P0-1 does this properly.)

Neon's guide: [Import Data Assistant](https://neon.com/docs/import/import-data-assistant).

<details>
<summary>The other way: pg_dump and pg_restore (if the assistant isn't available)</summary>

You need the PostgreSQL command-line tools at the same major version as BOQ Studio's database (on Windows on ARM,
running them through Docker is easiest).

1. Create the new project as in A2 step 1, then copy its **direct** connection string (Connect → pooling off).
2. In a terminal, with both strings kept in variables so they don't land in your shell history file:

   ```bash
   pg_dump -Fc -v -d "$BOQ_STUDIO_DIRECT_URL" -f boq-studio.dump
   pg_restore -v --no-owner --no-acl -d "$STUDIO_OS_DIRECT_URL" boq-studio.dump
   ```

   `pg_dump` only reads. Delete `boq-studio.dump` afterwards: it holds all of BOQ Studio's data.

Neon's guide: [Import data from another Neon project](https://neon.com/docs/import/import-from-neon).

</details>

### A3. Write down production's connection string and host

1. In the new project, click **Connect**, choose the `production` branch, turn **Connection pooling off**, and copy
   the string. This is Studio OS's **production `DATABASE_URL`**. (Use the direct string: the build runs database
   migrations, which need it.)
2. From that string, copy just the host name: the part after `@` and before the next `/`, for example
   `ep-quiet-sky-a1b2c3d4.ap-southeast-1.aws.neon.tech`. This is **`PRODUCTION_DATABASE_HOST`**. It lets the build
   and the tests recognise production and refuse to touch it from anywhere else.

---

## B. Add the staging branch

Staging is a copy of production for testing. Preview deployments and the tests use it, never production.

1. In the `barebase-studio-os` Neon project, open **Branches → New branch**.
   - Name: `staging`
   - Parent: `production`
   - Data: **Current data** (a full copy, not schema only)
2. Click **Connect**, choose the `staging` branch, turn **Connection pooling off**, and copy the string. This is the
   **staging `DATABASE_URL`**.
3. Check its host name is **different** from `PRODUCTION_DATABASE_HOST`. It should be: every Neon branch has its own.

To refresh staging with production's latest data later: **Branches → staging → Reset from parent**. That replaces
everything on staging (fine, it's only test data) and keeps the same connection string.

Neon's guide: [Branching](https://neon.com/docs/introduction/branching).

---

## C. Create the Vercel project

A **new** Vercel project for Studio OS. Nothing is shared with BOQ Studio's Vercel project.

1. In [Vercel](https://vercel.com), click **Add New → Project** and import the GitHub repo
   `iamrealkrishna/barebase-studio-os`.
2. On the setup screen:
   - Framework: **Next.js** (detected)
   - Build command: leave the default (`npm run build`). It runs `scripts/migrate-on-deploy.mjs`, which migrates
     the database only on Vercel and refuses a Preview pointed at production.
   - Root directory: the repo root
3. **Before clicking Deploy**, open **Environment Variables** and add the ones marked "Now" in step D. (If you
   deploy first, the build stops with a clear message about the missing variables, which does no harm. Add them
   and redeploy.)
4. Deploy. When it's live, note the address Vercel gives it, for example `https://barebase-studio-os.vercel.app`
   (decision 24). Then set `APP_URL` (step D) to that address and **Redeploy**.
5. **Settings → Build and Deployment → Node.js Version**: choose **22.x**.
6. **Settings → Git**: check **Production Branch** is `main`. Every pull request then gets a Preview deployment on
   the staging database, and merging to `main` deploys production.
7. Leave **Deployment Protection** as it is: preview links stay private to your Vercel team.

How the environments map:

| Vercel environment | Built from | Database |
| --- | --- | --- |
| Production | `main` | Neon `production` branch |
| Preview | every pull request and branch | Neon `staging` branch |
| Development (`vercel env pull`, your laptop) | — | Neon `staging` branch, or your own local Postgres |

---

## D. Environment variables

Set these in Vercel under **Project → Settings → Environment Variables**. For each one, tick only the environments
shown. Where Production and Preview take **different values**, add the variable twice, once per environment.

| Variable | When | Production | Preview | Development | What it is |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Now | production direct string (A3) | staging direct string (B2) | staging direct string | The database |
| `PRODUCTION_DATABASE_HOST` | Now | host from A3 | **same** host from A3 | same | Lets the build and tests recognise production and refuse it outside Production |
| `AUTH_SECRET` | Now | a new random value | a **different** new random value | the Preview one | Signs sign-in cookies. Never reuse BOQ Studio's |
| `APP_URL` | After the first deploy | `https://<name>.vercel.app` (C4) | leave unset | `http://localhost:3000` | Base of client links. Change it when you pick a domain (decision 24) |
| `PRODUCTION_APP_URL` | Now | `https://<name>.vercel.app` | same | same | The tests refuse to run against this address |
| `RESEND_API_KEY` | P0-7 | key from E3 | leave unset until P0-7 adds the staging guard | — | Sends invite, reset and notification emails |
| `EMAIL_FROM` | P0-7 | `Barebase Studio <studio@barebase.in>` | same | — | The sender |
| `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`) | P0-12 | added by Vercel (F1) | added by Vercel | added by Vercel | File storage. You don't type this one |
| `NEXT_PUBLIC_SENTRY_DSN` | P0-1 | DSN from F2 | same | — | Where errors are reported |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | P0-1 | from F2 | same | — | Lets the build upload source maps, so errors point at the right line |

Make each `AUTH_SECRET` with this command in any terminal with Node installed, and paste the output straight into
Vercel:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Not in Vercel:** `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` and `SEED_ORG_NAME` are only for
`npm run db:seed` on a laptop against an empty local database. Production already has every account from BOQ
Studio's data, so it is never seeded. A seed password needs at least 10 characters (decision 27).

**On your laptop:** copy `.env.example` to `.env` and fill it in with a local database, or with the **staging**
string. Never put the production string in `.env`.

**Preview client links:** with `APP_URL` unset, a Preview deployment builds client links from the production address.
Don't send real clients links from a Preview; P0-1 points Preview links at the Preview's own address.

After changing variables, **Deployments → ⋯ → Redeploy** so they take effect.

---

## E. Resend: email from studio@barebase.in

Needed for P0-7 (invites, password reset, sign-in links). Resend's records go on a `send.` sub-domain and a
`resend._domainkey` name, so they **don't touch barebase.in's existing email** (Google Workspace or whoever hosts
your inbox).

### E1. Add the domain

1. Sign in at [resend.com](https://resend.com) (create the account with krishna@barebase.in).
2. **Domains → Add domain**: `barebase.in`. Region: **Tokyo (ap-northeast-1)**, the closest to India.
3. Resend shows three records. Keep that page open.

### E2. Add the DNS records

Sign in where barebase.in's DNS is managed (the company you bought the domain from, or Cloudflare if it's there).
Add exactly the records Resend shows. They look like this, but **copy the values from Resend**, especially the
long DKIM key and the region in the MX value:

| Type | Name / Host | Value | Priority |
| --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey` | `p=MIGfMA0G...` (the long key from Resend) | — |

Tips:

- Type only `send` and `resend._domainkey` as the name. Most DNS panels add `.barebase.in` themselves; typing it too
  gives `send.barebase.in.barebase.in`, which never verifies.
- If priority 10 is already used on `send`, use 20.
- **Don't** change the MX records on `barebase.in` itself: those deliver your normal email.
- Optional but recommended: if barebase.in has no DMARC record yet, add TXT `_dmarc` with `v=DMARC1; p=none;`. If one
  exists already, leave it.

Back in Resend, click **Verify DNS records**. It can take from a few minutes to a few hours. If it doesn't verify,
see Resend's [domain not verifying](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying).

### E3. Make the API key

1. **API Keys → Create API key**. Name: `studio-os-production`. Permission: **Sending access**. Domain: `barebase.in`.
2. Copy it once (Resend won't show it again) into Vercel as `RESEND_API_KEY` for **Production** only.

Staging holds a copy of real client and team email addresses, so it must not send email until P0-7 adds a guard
that only lets staging email `@barebase.in` addresses. Leave `RESEND_API_KEY` out of Preview until then.

---

## F. Vercel Blob and Sentry

### F1. Vercel Blob (file storage)

Needed for P0-12 (line photos and the Files tab). Two stores, so test files never mix with real ones.

1. In the Studio OS Vercel project, open **Storage → Create → Blob**.
2. Name: `studio-files-production`. Access: **Private** (files are only reachable through the app's signed links).
   Connect it to **Production** only.
3. Repeat with `studio-files-staging`, connected to **Preview** and **Development**.
4. Vercel adds the store's variables to each environment by itself (`BLOB_READ_WRITE_TOKEN`, or `BLOB_STORE_ID` for a
   private store). Don't copy the token anywhere else.

Vercel's guide: [Vercel Blob](https://vercel.com/docs/vercel-blob) and
[private storage](https://vercel.com/docs/vercel-blob/private-storage).

### F2. Sentry (error tracking, decision 22)

Needed for P0-1.

1. Create a free account at [sentry.io](https://sentry.io) with krishna@barebase.in and an organisation called
   `barebase`.
2. **Projects → Create project**. Platform: **Next.js**. Name: `barebase-studio-os`. Alerts: email on every new
   issue (to you).
3. The easiest way to get the variables into Vercel: in Sentry, **Settings → Integrations → Vercel → Install**, and
   link `barebase-studio-os` (Sentry) to `barebase-studio-os` (Vercel). It adds `NEXT_PUBLIC_SENTRY_DSN`,
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` itself.
4. Without the integration: copy the DSN from **Project Settings → Client Keys (DSN)**, and make a token under
   **Settings → Developer Settings → Organization Tokens**. Add the four variables in Vercel as in step D.

The code side (installing Sentry's SDK, tagging production and staging separately) is P0-1; nothing reports errors
until that's merged.

Sentry's guide: [Vercel integration](https://docs.sentry.io/organization/integrations/deployment/vercel/).

---

## When you're done

Tell me (in the session, without pasting any key):

- [ ] Neon project `barebase-studio-os` with `production` (copy of BOQ Studio) and `staging` branches
- [ ] Vercel project deployed on `main`, with its address
- [ ] `DATABASE_URL`, `PRODUCTION_DATABASE_HOST`, `AUTH_SECRET`, `APP_URL` and `PRODUCTION_APP_URL` set (step D)
- [ ] Resend domain verified and key in Vercel Production
- [ ] Blob stores created and connected
- [ ] Sentry project linked to Vercel

Then Phase 0 starts with P0-1, which checks the copied data's totals against BOQ Studio before anything else.
