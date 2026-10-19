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
const allowed = new Set([path.join(root, "styles", "tokens.css")]);

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
  lines.forEach((line, i) => {
    const where = `${path.relative(process.cwd(), file)}:${i + 1}`;
    if (hex.test(line)) problems.push(`${where}  hex colour: use a --bb-* colour token`);
    const isCss = file.endsWith(".css");
    for (const m of line.matchAll(isCss ? cssProp : jsProp)) {
      const value = m[2];
      if (rawLength.test(value) || (!isCss && /^\d/.test(value.trim()) && value.trim() !== "0")) {
        problems.push(`${where}  ${m[1]}: ${value.trim()}  use a --bb-* token`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Tokens only: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("Tokens only: no raw colours, font sizes or spacing outside tokens.css.");
