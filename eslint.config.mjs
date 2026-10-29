import ts from "@typescript-eslint/parser";
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["node_modules/**", ".next/**", ".neuroplast/**", ".claude/**", "next-env.d.ts", "src/ui/easyui/**"] },
  { files: ["**/*.{ts,tsx}"], languageOptions: { parser: ts, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } }, plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["**/*.{ts,tsx}"] })),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // `_name` marks a deliberately unused binding; `{ drop, ...rest }` omits a key.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Closures declared before the value is assigned (e.g. a stop() that clears a later interval) stay `let`.
      "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
    },
  },
  // The domain model stays independent of UI, persistence, and app composition.
  { files: ["src/features/*/core/**/*.{ts,tsx}"], rules: { "no-restricted-imports": ["error", { patterns: ["next", "next/*", "react", "node:*", "!node:crypto", "**/server/*", "**/ui/*", "@/app-shell/*"] }] } },
];
