import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTest,
  deriveRouteStreams,
  expect,
  readJournal,
  requireRun,
  runRoute,
  type AppUnderTest,
} from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Whether the journal names the R that RStudio actually started, read from
 * its own `client_init` answer, and the build from its bundle. Written on
 * 2026-10-12, when what ran was first recorded.
 *
 * Two cases: the PATH's R, and R 4.4.3 named by RSTUDIO_WHICH_R. The second is
 * the control: a reading that came from the setup rather than from RStudio
 * would name the same R in both, and only the answer RStudio gives can tell
 * them apart.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const R_443 = '/Library/Frameworks/R.framework/Versions/4.4-arm64/Resources/bin/R';

function opening(journals: string, seed: string) {
  const folder = path.join(journals, seed, requireRun());
  const [file] = fs.readdirSync(folder);
  return readJournal(path.join(folder, file ?? ''));
}

for (const [label, cfg, expected] of [
  ['the PATH R', rstudio, /^4\.6\./],
  [
    'R 4.4.3 by RSTUDIO_WHICH_R',
    {
      ...rstudio,
      env: (userDataDir: string) => ({
        ...(typeof rstudio.env === 'function' ? rstudio.env(userDataDir) : rstudio.env),
        RSTUDIO_WHICH_R: R_443,
      }),
    },
    /^4\.4\.3$/,
  ],
] as const satisfies readonly (readonly [string, AppUnderTest, RegExp])[]) {
  const test = createTest(cfg);
  test(`the journal names the R RStudio started: ${label}`, async ({ page, app, userDataDir }) => {
    test.skip(cfg !== rstudio && !fs.existsSync(R_443), `R 4.4.3 is not at ${R_443}`);
    const seed = `ran-with-${label.replace(/\W+/g, '-')}`;
    const journals = path.join(here, '.phileas-journals');
    const outcome = await runRoute({
      page,
      app,
      cfg,
      streams: deriveRouteStreams(seed, 1),
      journeySeed: seed,
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: journals,
      userDataDir,
    }).catch((error: unknown) => ({ kind: 'threw', error: String(error) }));
    const entries = opening(journals, seed);
    const first = entries[0];
    const notes = entries.filter((entry) => entry.kind === 'note' && entry.ranWith);
    const last = entries.at(-1);
    console.log(JSON.stringify({ label, outcome, build: first?.kind === 'route' ? first.build : undefined, notes, last }, null, 2));

    expect(first?.kind === 'route' && first.build).toMatchObject({ name: 'RStudio', version: expect.stringMatching(/^\d{4}\.\d+\.\d+/) });
    expect(notes[0]?.kind === 'note' && notes[0].ranWith?.R).toMatch(expected);
    expect(last?.kind === 'outcome' && last.ranWith !== 'none' && last.ranWith?.R?.[0]).toMatch(expected);
  });
}
