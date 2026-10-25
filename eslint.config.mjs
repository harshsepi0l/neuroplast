import ts from "@typescript-eslint/parser";
import next from "@next/eslint-plugin-next";

export default [
  { ignores: ["node_modules/**", ".next/**", ".neuroplast/**", "next-env.d.ts", "src/shared/ui/easyui/**"] },
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: ts, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } }, plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules } },
  // The domain model stays independent of UI, persistence, and app composition.
  // Context internals may retain their working application/adapter arrangements.
  { files: ["src/domains/*/domain/**/*.{ts,tsx}"], rules: { "no-restricted-imports": ["error", { patterns: ["next", "next/*", "react", "node:*", "!node:crypto", "**/infrastructure/*", "**/application/*", "@/platform/*"] }] } },
];
