import { FlatCompat } from "@eslint/eslintrc";
import { baseConfig } from "@dentalos/config/eslint.base.mjs";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals"),
  ...baseConfig,
  {
    ignores: [".next/**"],
  },
];
