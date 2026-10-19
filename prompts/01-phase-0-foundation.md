# Prompt 01 · Phase 0: Foundation and fixes

Read `CLAUDE.md` and `docs/PLAN.md`. Build Phase 0 from product spec sections 3, 4, 18 and 21 and UI spec sections 2, 3
and 9. Update the Phase 0 task list in `docs/PLAN.md` first, then work through it one PR per task.

Scope:

1. **Close open registration.** Remove public sign-up and `/register`. Accounts are created by an Admin only, by
   invite email with a set-password link (`/invite/[token]`, valid 7 days). Add password reset by email
   (`/reset/[token]`, valid 30 minutes) and change-password on Profile. Restrict Google sign-in to `@barebase.in`
   accounts that already exist.
2. **Roles and permissions.** Implement the org roles (Admin, COO, Finance, Design lead, Designer, Pre-sales, Site
   supervisor), project membership with project roles, and the single `can(user, action, resource)` helper with the
   matrix from product spec section 18. Add a central serializer that strips cost fields for users without
   the "see cost" permission. Write tests proving a Designer's responses contain no cost data.
3. **Bug fixes from the audit:** show History times in Asia/Kolkata; validate phone (10-digit Indian mobile), email,
   GSTIN and PAN; show Name · Material · Finish · Unit · Rate in item pickers; make property name editable; remove the
   stuck "Active" status (stages come in Phase 1).
4. **Foundations:** `styles/tokens.css` (or Tailwind theme) exactly as UI spec section 2; `lib/format.ts` and
   `lib/status.ts` with the test cases in UI spec section 7; `lib/calc.ts` skeleton; the audit event helper; soft delete
   pattern; object storage for files (Vercel Blob or R2) with signed, expiring download URLs.
5. **Environments:** separate staging and production databases; seed script with the sample project; error tracking.
6. **Rate limiting** on login, reset and (later) the leads webhook.

Exit check (all must pass before Phase 0 is done): no public sign-up; every user signs in with their own account; a
Designer's API responses contain no cost data; History shows India time; staging and production databases are
separate; all formatter tests pass.
