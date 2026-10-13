import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { journalsInFolder } from './report/summary.mjs';

/**
 * Where a run keeps each Route's Playwright output, inside its own folder:
 * `<run>/output/<the journal's name without .jsonl>/`.
 */
export const OUTPUT_FOLDER = 'output';

/**
 * The folder Playwright writes this Route's output into, its trace,
 * screenshot, page and every attachment, as a path from the journal's own
 * folder. Undefined for a Route run outside a test, which has none.
 *
 * Relative so that a journal names no home folder, and still finds the output
 * when the consumer's folder is moved whole.
 */
export function routeOutputDir(journalDirectory: string): string | undefined {
  let info: ReturnType<typeof test.info>;
  try {
    info = test.info();
  } catch {
    return undefined;
  }
  return path.relative(journalDirectory, info.outputDir);
}

/** What keeping a run's output did. */
export interface KeptOutput {
  /** Where the output now is, one folder per Route that had any. */
  readonly folder: string;
  readonly kept: number;
  /** Routes whose journal names an output folder that is missing or empty, since nothing was saved. */
  readonly empty: number;
}

/**
 * Copy each Route's Playwright output into the run's own folder.
 *
 * **Playwright empties its output folder at the start of every run,** before
 * global setup, and offers no setting to stop it. Every run of a consumer
 * shares that folder, so the next Journey, probe or replay deleted the last
 * one's traces, and a finding whose replay did not retrace could no longer be
 * read at all: Positron's `81072f59`, seen 2026-10-04, and RStudio's first
 * accessibility Journey on 2026-10-13, whose traces a probe run minutes later
 * removed. The run folder is never reused, so a copy there outlives them.
 *
 * Copied rather than moved, so the paths Playwright's report printed during
 * the run still open until the next run empties them.
 */
export function keepRouteOutput(runFolder: string): KeptOutput {
  const folder = path.join(runFolder, OUTPUT_FOLDER);
  let kept = 0;
  let empty = 0;
  for (const journal of journalsInFolder(runFolder)) {
    const opening = JSON.parse(fs.readFileSync(journal, 'utf8').split('\n', 1)[0] ?? '{}') as { outputDir?: string };
    if (opening.outputDir === undefined) continue;
    const from = path.resolve(path.dirname(journal), opening.outputDir);
    // Playwright makes a test's folder before the test runs, so a Route that
    // saved nothing still has one, empty.
    if (!fs.existsSync(from) || fs.readdirSync(from).length === 0) {
      empty++;
      continue;
    }
    fs.cpSync(from, path.join(folder, path.basename(journal, '.jsonl')), { recursive: true });
    kept++;
  }
  return { folder, kept, empty };
}
