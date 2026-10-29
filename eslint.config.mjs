import ts from "@typescript-eslint/parser";
import next from "@next/eslint-plugin-next";

export default [
  { ignores: ["node_modules/**", ".next/**", ".neuroplast/**", "next-env.d.ts", "src/ui/easyui/**"] },
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: ts, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } }, plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules } },
  // The domain model stays independent of UI, persistence, and app composition.
  { files: ["src/features/*/core/**/*.{ts,tsx}"], rules: { "no-restricted-imports": ["error", { patterns: ["next", "next/*", "react", "node:*", "!node:crypto", "**/server/*", "**/ui/*", "@/app-shell/*"] }] } },
];
