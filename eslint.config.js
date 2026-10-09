// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/src/generated/**",
      "**/*.min.js",
      "apps/e2e/playwright-report/**",
      "apps/e2e/test-results/**",
    ],
  },

  // Base recommended rules for all TypeScript files
  ...tseslint.configs.recommended,

  // Project-wide settings
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    rules: {
      // Allow explicit `any` in a few integration-boundary spots but flag implicit any
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars: error for vars, warn for args starting with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Prefer `const` where possible
      "prefer-const": "error",
      // No floating promises in async code
      "@typescript-eslint/no-floating-promises": "error",
      // Consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  // Looser rules for test files
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.integration.test.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Plain JS / MJS files (scripts, config files)
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  }
);
