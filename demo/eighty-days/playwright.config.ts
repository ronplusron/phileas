import { defineConfig } from '@playwright/test';

/**
 * Eighty Days' scripted suite: the tests in `tests/`, which keep Playwright's
 * default meaning in a consuming repository. Not a Journey; that runs from
 * `phileas/`, with its own config, and never collects these.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  // Zero, as the engine's own suite has it: a play that differs and then
  // matches on a retry has found exactly what these tests look for.
  retries: 0,
  reporter: [['list']],
});
