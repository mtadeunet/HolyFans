/**
 * Implements ADR 00-007: Quality Tooling and CI - "End-to-end tests run
 * against the production-built application and verify the public
 * contracts."
 *
 * The suite expects a prior `npm run build` and starts two `next start`
 * servers off the same build:
 *
 * - port 3100 — the default environment: `PURCHASE_SURFACE_ENABLED` unset,
 *   so the purchase surface is gated off (ADR 00-004 / plan M0). All
 *   contract specs run here.
 * - port 3101 — the same server with `PURCHASE_SURFACE_ENABLED=true`, used
 *   only by `purchase-surface-enabled.spec.ts` to prove the flag restores
 *   the surface in a non-production environment.
 */
import { defineConfig } from '@playwright/test';

const GATED_PORT = 3100;
const ENABLED_PORT = 3101;
const gatedBaseURL = `http://127.0.0.1:${GATED_PORT}`;
const enabledBaseURL = `http://127.0.0.1:${ENABLED_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: [
    {
      name: 'storefront',
      use: { baseURL: gatedBaseURL },
      testIgnore: /purchase-surface-enabled\.spec\.ts/,
    },
    {
      name: 'purchase-enabled',
      use: { baseURL: enabledBaseURL },
      testMatch: /purchase-surface-enabled\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: `npx next start -p ${GATED_PORT}`,
      url: gatedBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${ENABLED_PORT}`,
      url: enabledBaseURL,
      env: { PURCHASE_SURFACE_ENABLED: 'true' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
