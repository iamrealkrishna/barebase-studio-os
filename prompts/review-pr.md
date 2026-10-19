# Reusable prompt · Review a pull request against the spec

Review the current branch's changes against `docs/product-spec.md`, `docs/ui-ux-spec.md` and `CLAUDE.md`. Report, most
serious first:

1. Any break of a non-negotiable in `CLAUDE.md` (money as floats, cost data reaching a non-cost user or client,
   payment possible before approval, permission checked only in the UI, missing audit event, raw hex or font values).
2. Missing behaviour compared with the spec sections this PR claims to implement, including empty, loading and error
   states.
3. Missing or weak tests for the screen's "Done when" checks.
4. UI differences from the reference images at 1440 px and 375 px.
5. Copy that breaks the words table in UI spec section 7.

For each finding, give the file and line, what is wrong, and the fix. Do not change code unless asked.
