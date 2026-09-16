// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Shared ESLint base config for all DentalOS workspace packages.
 *
 * Deliberately syntactic (no `parserOptions.project` / type-aware rules): type-aware linting is
 * powerful (catches floating promises, unsafe `any` flows, ...) but requires every linted file to
 * be covered by a package's `tsconfig.json`, which config files (vitest.config.ts, eslint config,
 * ...) usually aren't — a common source of "parserOptions.project" lint failures. Revisit this
 * once there's a CI loop to iterate against (tracked in ROADMAP.md, Phase 10 hardening).
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/coverage/**",
    ],
  },
);
