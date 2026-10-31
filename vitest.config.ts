/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior — Cart operations and Purchase Cap clamping, Product
 * Data integrity, message-catalog parity across Locales, Site Config
 * normalization and fallback."
 *
 * Vitest runs the unit suite (`npm run test`) in a Node environment over
 * `tests/unit`. The `@` alias mirrors `tsconfig.json` paths so tests import
 * the same modules the app uses.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
