import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    // Unused values named with a leading underscore are deliberate (e.g. dropping a key with a rest spread).
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    // BOQ Studio's autosave and rate card editor keep the latest props in refs during render, which the
    // React Compiler rules flag. They work and are covered by tests 03, 14 and 20; the refactor is
    // Phase 0 task P0-16 (docs/PLAN.md). Don't add files to this list.
    files: ["src/lib/use-boq-editor.ts", "src/components/RateCardEditor.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "docs/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];

export default config;
