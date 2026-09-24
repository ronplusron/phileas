import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchApp, type AppUnderTest, type LaunchedApp } from '../src/index';

/**
 * Temporary folders for a test, removed once the test is over.
 *
 * Each spec that calls `scratch` registers `test.afterEach(removeScratch)`,
 * which runs whether the test passed or failed. Registered per file rather
 * than from here, because a hook declared while this module is first imported
 * would attach to whichever spec happened to import it first and to no other.
 *
 * `tests/leftover-temp.ts` is what notices when a folder escapes this.
 */

const made = new Set<string>();

export function scratch(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.add(dir);
  return dir;
}

export async function removeScratch(): Promise<void> {
  for (const dir of made) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    made.delete(dir);
  }
}

/**
 * `launchApp`, removing the user data folder if the launch itself throws.
 *
 * Callers create the folder, launch, then close and remove it in a `finally`.
 * The launch sits before that `try`, so a launch that failed used to leave its
 * folder behind. Everything after a successful launch is still the caller's.
 */
export async function launchOrRemove(cfg: AppUnderTest, dir: string): Promise<LaunchedApp> {
  try {
    return await launchApp(cfg, dir);
  } catch (error) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    throw error;
  }
}
