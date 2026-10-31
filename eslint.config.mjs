/**
 * Implements ADR 00-007: Quality Tooling and CI - "ESLint — with the
 * framework's recommended configuration, wired directly rather than through
 * deprecated wrapper commands — and Prettier define a single enforced
 * style."
 *
 * ESLint 9 flat config: `eslint-config-next` flat entries (core-web-vitals
 * + typescript) invoked via `eslint .` — the deprecated `next lint` wrapper
 * is not used. `eslint-config-prettier` comes last to disable rules that
 * would conflict with Prettier's formatting decisions.
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  eslintConfigPrettier,
  // Generated/vendored dirs — keep in sync with the ignore lists in
  // .gitignore, .prettierignore and .gitleaks.toml.
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'blob-report/**',
    '.venv/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
