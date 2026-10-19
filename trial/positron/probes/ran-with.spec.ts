import fs from 'node:fs';
import path from 'node:path';
import {
  createTest,
  deriveRouteStreams,
  expect,
  readJournal,
  requireRun,
  runRoute,
  type Fix,
} from '@drugstoresushi/phileas';
import { positron, positronFamily } from '../phileas/adapter';
import { session } from '../phileas/fixes/console/session';
import { probeJournals } from './paths';

/**
 * Whether the journal names the R or Python a Route's Positron actually
 * started, read from the Route's own renderer log, and `none` where it started
 * neither. Written on 2026-10-12, when what ran was first recorded.
 *
 * Three cases: no Fix, which starts nothing on a fresh profile (measured
 * 2026-09-27) and is the control for the other two; the trial's `session`
 * Fix, which starts the PATH's R; and a Python session, started here the way
 * `session` starts R. No prompt Positron puts up is answered.
 */
const test = createTest(positron);

/** A Python console session, as `session` starts R: filtered in the list, then Enter. */
const python: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'button "Start New Console Session"' });
  await step({
    kind: 'code',
    label: 'choose Python in the interpreter list',
    action: async () => {
      await page.getByRole('option', { name: /^Python \d/ }).first().waitFor({ timeout: 30_000 });
      await page.keyboard.type('Python ');
      await page.getByRole('option').first().filter({ hasText: /^Python \d/ }).waitFor({ timeout: 10_000 });
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: 'wait for Python to start',
    action: () => page.getByText(/Python \d+\.\d+\.\d+.* started\./).first().waitFor({ timeout: 60_000 }),
  });
};

function entriesOf(seed: string) {
  const folder = path.join(probeJournals, seed, requireRun());
  const [file] = fs.readdirSync(folder);
  return readJournal(path.join(folder, file ?? ''));
}

for (const [label, fix, check] of [
  ['no Fix', undefined, (ranWith: unknown) => expect(ranWith).toBe('none')],
  ['the session Fix', session, (ranWith: unknown) => expect(ranWith).toMatchObject({ R: [expect.stringMatching(/^\d+\.\d+\.\d+$/)] })],
  ['a Python session', python, (ranWith: unknown) => expect(ranWith).toMatchObject({ Python: [expect.stringMatching(/^3\.\d+\.\d+/)] })],
] as const) {
  test(`the journal names what Positron started: ${label}`, async ({ page, app, userDataDir }) => {
    test.skip(positronFamily !== 'current', 'measured on the current release only');
    const seed = `ran-with-${label.replace(/\W+/g, '-')}`;
    const outcome = await runRoute({
      page,
      app,
      cfg: positron,
      streams: deriveRouteStreams(seed, 1),
      journeySeed: seed,
      routeNumber: 1,
      tripLength: 1,
      ...(fix ? { fix } : {}),
      journalsRoot: probeJournals,
      userDataDir,
    }).catch((error: unknown) => ({ kind: 'threw', error: String(error).split('\n')[0] }));
    const entries = entriesOf(seed);
    const first = entries[0];
    const last = entries.at(-1);
    const log = path.join(userDataDir, 'logs', 'window1', 'renderer.log');
    const started = fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').split('\n').filter((line) => line.includes('Starting session for'))
      : ['(no renderer.log)'];
    console.log(
      JSON.stringify(
        {
          label,
          outcome,
          build: first?.kind === 'route' ? first.build : undefined,
          notes: entries.filter((entry) => entry.kind === 'note' && entry.ranWith),
          ranWith: last?.kind === 'outcome' ? [last.ranWith, last.ranWithUnread] : 'no outcome',
          rendererLines: started.map((line) => line.replace(/^\S+ \S+ /, '')),
        },
        null,
        2
      )
    );

    expect(first?.kind === 'route' && first.build).toMatchObject({ name: 'Positron', release: expect.stringMatching(/^\d{4}\.\d+\.\d+/) });
    check(last?.kind === 'outcome' ? last.ranWith : undefined);
  });
}
