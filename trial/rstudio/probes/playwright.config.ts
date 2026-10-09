import { defineConfig } from '@playwright/test';

/**
 * Probes of what RStudio does, apart from the Journey so `phileas run` never
 * collects them, as Positron's trial keeps its own. Started on 2026-10-08 to
 * triage what the RStudio batch of that day saw.
 */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 300_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
