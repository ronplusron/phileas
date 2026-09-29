import { defineConfig } from '@playwright/test';

/**
 * Rail Itinerary's scripted suite: the tests in `tests/`, which keep
 * Playwright's default meaning in a consuming repository. Not a Journey; that
 * runs from `phileas/`, with its own config, and never collects these.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/temp-folder.ts',
  fullyParallel: false,
  workers: 1,
  // Zero, as the engine's own suite has it: a plant that fires and then
  // passes on a retry would be a finding of its own.
  retries: 0,
  reporter: [['list']],
});
