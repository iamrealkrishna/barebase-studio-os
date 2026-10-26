// "Tokens only" check (CLAUDE.md, UI spec section 8): no hex colours, font sizes or
// spacing values outside src/styles/tokens.css. Runs as part of `npm run lint`.
//
// Flags, in any file under src/ other than tokens.css:
//   - a hex colour (#abc, #aabbcc, #aabbccdd)
//   - font-size, padding, margin, gap or inset values written in px or rem instead of var(--bb-*)
//   - React inline styles that set those properties to a number or px string

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "src");
const allowed = new Set([
  path.join(root, "styles", "tokens.css"),
  // PDF sizes are jsPDF points on paper, not screen styles.
  path.join(root, "lib", "pdf.ts"),
]);

// Screens imported from BOQ Studio on 19 Oct 2026, still on their own Warm Ledger CSS.
// They move onto the tokens in Phase 0 (docs/PLAN.md, P0-15) and come off this list one
// by one. This list only ever shrinks: new files must use tokens from the start.
const legacy = new Set(
  [
    "app/globals.css",
    "app/(project)/projects/[id]/boq/versions/page.tsx",
    "components/AuditLogButton.tsx",
    "components/ClientBoqView.tsx",
    "components/ClientGate.tsx",
    "components/ClientPortal.tsx",
    "components/ClientViewPreview.tsx",
    "components/DuplicateProjectButton.tsx",
    "components/EntryForm.tsx",
    "components/ImportFromProject.tsx",
    "components/LoginForm.tsx",
    "components/NewProjectForm.tsx",
    "components/OrgSettingsForm.tsx",
    "components/ProjectBar.tsx",
    "components/ProjectDetailsForm.tsx",
    "components/RateCardBulkEdit.tsx",
    "components/RateCardEditor.tsx",
    "components/ReviewBoard.tsx",
    "components/SummaryPanel.tsx",
    "components/TeamManager.tsx",
  ].map((file) => path.join(root, file)),
);
let legacyProblems = 0;

const hex = /(^|[^&\w])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const cssProp = /(?<![-\w])(font-size|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|gap|row-gap|column-gap|inset|top|right|bottom|left)\s*:\s*([^;{}]+)/g;
const jsProp = /(?<![-\w])(fontSize|padding\w*|margin\w*|gap|rowGap|columnGap)\s*:\s*(['"`]?[^,}\n]+)/g;
const rawLength = /(^|[\s(,'"`-])\d*\.?\d+(px|rem|em)\b/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const problems = [];

for (const file of walk(root)) {
  if (allowed.has(file) || !/\.(css|tsx?|mjs)$/.test(file) || file.endsWith(".test.ts")) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  const report = legacy.has(file) ? () => legacyProblems++ : (problem) => problems.push(problem);
  lines.forEach((line, i) => {
    const where = `${path.relative(process.cwd(), file)}:${i + 1}`;
    if (hex.test(line)) report(`${where}  hex colour: use a --bb-* colour token`);
    const isCss = file.endsWith(".css");
    for (const m of line.matchAll(isCss ? cssProp : jsProp)) {
      const value = m[2];
      if (rawLength.test(value) || (!isCss && /^\d/.test(value.trim()) && value.trim() !== "0")) {
        report(`${where}  ${m[1]}: ${value.trim()}  use a --bb-* token`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Tokens only: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `Tokens only: no raw colours, font sizes or spacing outside tokens.css` +
    ` (${legacyProblems} still in ${legacy.size} legacy BOQ Studio files, moving to tokens in Phase 0).`,
);
