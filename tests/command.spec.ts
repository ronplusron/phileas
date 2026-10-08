import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  defineJourney,
  finishJourney,
  overriddenInBooking,
  startJourney,
  FIX_OVERRIDE_VARIABLE,
  ALLOW_EXCLUDED_VARIABLE,
  OVERRIDE_VARIABLES,
  SEED_VARIABLE,
  RUN_VARIABLE,
  WINDOW_MODE_VARIABLE,
  HOP_DELAY_VARIABLE,
  TEMP_FOLDER_VARIABLE,
} from '../src/index';
import { parse } from '../bin/phileas.mjs';

/**
 * The phileas command, and the two engine functions it relies on.
 *
 * `phileas run` itself only reads flags and starts Playwright; every value is
 * checked by defineJourney or startJourney, before anything launches. So most
 * of this tests those two, with the variables set as the command sets them, and
 * one test runs the command for real.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = path.join(repo, 'bin', 'phileas.mjs');

const TOUCHED = [
  ...Object.values(OVERRIDE_VARIABLES),
  FIX_OVERRIDE_VARIABLE,
  ALLOW_EXCLUDED_VARIABLE,
  SEED_VARIABLE,
  RUN_VARIABLE,
  WINDOW_MODE_VARIABLE,
  HOP_DELAY_VARIABLE,
  TEMP_FOLDER_VARIABLE,
];

/** Run a body with some variables set, and put every one the command touches back afterwards. */
function withEnvironment<T>(values: Record<string, string>, body: () => T): T {
  const saved = Object.fromEntries(TOUCHED.map((name) => [name, process.env[name]]));
  try {
    for (const name of TOUCHED) delete process.env[name];
    Object.assign(process.env, values);
    return body();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('the command reads its flags, a config, and what goes to Playwright', () => {
  expect(parse(['run'])).toEqual({ command: 'run', config: 'phileas', settings: {}, passThrough: [] });
  expect(
    parse(['run', 'proving-ground/buggy/phileas', '--routes', '3', '--show=front', '--', '--grep', 'route 1$'])
  ).toEqual({
    command: 'run',
    config: 'proving-ground/buggy/phileas',
    settings: { PHILEAS_ROUTES: '3', PHILEAS_SHOW: 'front' },
    passThrough: ['--grep', 'route 1$'],
  });
  expect(parse(['run', '--fix', 'quarto'])).toMatchObject({ settings: { PHILEAS_FIX: 'quarto' } });
  expect(parse(['run', '--allow', 'new-windows'])).toMatchObject({ settings: { PHILEAS_ALLOW_EXCLUDED: 'new-windows' } });
  expect(parse(['replay', 'r.jsonl'])).toEqual({
    command: 'replay',
    journal: 'r.jsonl',
    config: 'phileas',
    whole: false,
    withCurrentFix: false,
    follow: false,
  });
  expect(parse(['replay', 'r.jsonl', 'c', '--whole', '--with-current-fix', '--follow'])).toMatchObject({
    config: 'c',
    whole: true,
    withCurrentFix: true,
    follow: true,
  });
  expect(() => parse(['replay'])).toThrow(/needs the journal/);
  expect(() => parse(['replay', 'r.jsonl', '--seed'])).toThrow(/takes --whole, --with-current-fix and --follow/);
});

test('the command refuses what it cannot read, by name', () => {
  expect(() => parse(['run', '--rotues', '3'])).toThrow(/unknown flag --rotues/);
  expect(() => parse(['run', '--routes'])).toThrow(/--routes needs a value/);
  expect(() => parse(['run', '--routes', '--show', 'front'])).toThrow(/--routes needs a value/);
  expect(() => parse(['run', '--routes', '3', '--routes', '4'])).toThrow(/given twice/);
  expect(() => parse(['run', 'a', 'b'])).toThrow(/second config/);
  expect(() => parse(['travel'])).toThrow(/unknown command travel/);
  expect(() => parse(['run', '--follow=yes'])).toThrow(/--follow takes no value/);
  expect(() => parse(['show', 'a', 'b'])).toThrow(/one thing to show/);
  expect(() => parse(['show', '--routes'])).toThrow(/show takes no flags/);
  expect(parse(['survey'])).toEqual({ command: 'survey', config: 'phileas' });
  expect(parse(['survey', 'proving-ground/buggy/phileas'])).toEqual({ command: 'survey', config: 'proving-ground/buggy/phileas' });
  expect(() => parse(['survey', '--routes', '3'])).toThrow(/survey takes one config|survey takes no flags/);
  // A flag Playwright knows is still refused here unless it comes after --, so
  // that nothing reaches Playwright by accident.
  expect(() => parse(['run', '--grep', 'x'])).toThrow(/unknown flag --grep/);
});

test('an override replaces the Journey file for this run, and is recorded as one', () => {
  withEnvironment({ PHILEAS_ROUTES: '3', PHILEAS_ROUTE_DEADLINE_MS: '60000' }, () => {
    const journey = defineJourney({ routes: 5, tripLength: 20 });
    expect(journey.routes).toBe(3);
    expect(journey.tripLength).toBe(20);
    expect(journey.routeDeadlineMs).toBe(60000);
    expect(overriddenInBooking(journey)).toEqual(['routes', 'routeDeadlineMs']);
  });

  // The positive control: with nothing set, the file stands and nothing is marked.
  withEnvironment({}, () => {
    const journey = defineJourney({ routes: 5, tripLength: 20 });
    expect(journey.routes).toBe(5);
    expect(overriddenInBooking(journey)).toEqual([]);
  });
});

test('a bad override is refused by the variable it came from', () => {
  withEnvironment({ PHILEAS_ROUTES: '0' }, () => {
    expect(() => defineJourney({ routes: 5, tripLength: 20 })).toThrow(
      /routes \(from PHILEAS_ROUTES\) must be a whole number of at least 1, got 0/
    );
  });
  for (const raw of ['2.5', '1e3', ' 3', '-1', 'three']) {
    withEnvironment({ PHILEAS_TRIP_LENGTH: raw }, () => {
      expect(() => defineJourney({ routes: 5, tripLength: 20 }), raw).toThrow(
        /PHILEAS_TRIP_LENGTH=.* is not a whole number/
      );
    });
  }
  withEnvironment({ PHILEAS_JOURNEY_DEADLINE_MS: '5' }, () => {
    expect(() => defineJourney({ routes: 5, tripLength: 20 })).toThrow(
      /journeyDeadlineMs \(from PHILEAS_JOURNEY_DEADLINE_MS\) must be/
    );
  });
});

test('startJourney refuses a bad window mode or hop delay before anything launches', () => {
  const journey = withEnvironment({}, () => defineJourney({ routes: 1, tripLength: 1 }));
  withEnvironment({ PHILEAS_SHOW: 'frnt' }, () => {
    expect(() => startJourney(journey, buggy)).toThrow(/PHILEAS_SHOW="frnt" is not a window mode/);
  });
  withEnvironment({ PHILEAS_HOP_DELAY_MS: 'soon' }, () => {
    expect(() => startJourney(journey, buggy)).toThrow(/PHILEAS_HOP_DELAY_MS="soon" is not a delay/);
  });
});

test("a Journey's Booking names the groups it lets in, and --allow replaces them for one run", () => {
  withEnvironment({}, () => {
    const journey = defineJourney({ routes: 1, tripLength: 1, allow: ['views', ' new-windows', 'views'] });
    expect(journey.allow).toEqual(['new-windows', 'views']);
    expect(overriddenInBooking(journey)).toEqual([]);
  });
  withEnvironment({ [ALLOW_EXCLUDED_VARIABLE]: 'outside' }, () => {
    const journey = defineJourney({ routes: 1, tripLength: 1, allow: ['views'] });
    expect(journey.allow).toEqual(['outside']);
    expect(overriddenInBooking(journey)).toEqual(['allow']);
  });
  // none lets no group in, over a Journey that lets some in, as --fix none does.
  withEnvironment({ [ALLOW_EXCLUDED_VARIABLE]: 'none' }, () => {
    expect(defineJourney({ routes: 1, tripLength: 1, allow: ['views'] }).allow).toEqual([]);
  });
  withEnvironment({}, () => {
    expect(() => defineJourney({ routes: 1, tripLength: 1, allow: [' '] })).toThrow(/allow names an exclusion group that is not a name/);
    expect(() => defineJourney({ routes: 1, tripLength: 1, allow: ['none'] })).toThrow(/allow names "none"/);
  });
});

test("startJourney refuses a group the adapter does not declare, naming where it came from, and hands the rest to every Route", () => {
  const declaring = { ...buggy, exclusions: { ...buggy.exclusions, groups: { views: { why: 'for the test', names: ['A view'] } } } };
  withEnvironment({}, () => {
    const journey = defineJourney({ routes: 1, tripLength: 1, allow: ['vews'] });
    expect(() => startJourney(journey, declaring)).toThrow(
      /the Journey's allow names "vews", which the adapter does not declare as an exclusion group\. It declares: views\./
    );
  });
  withEnvironment({ [ALLOW_EXCLUDED_VARIABLE]: 'vews' }, () => {
    const journey = defineJourney({ routes: 1, tripLength: 1, allow: ['views'] });
    expect(() => startJourney(journey, declaring)).toThrow(/PHILEAS_ALLOW_EXCLUDED names "vews"/);
  });

  // Let in from the file: the Routes read it from the environment, and the
  // printout says where it came from.
  const fromFile = withEnvironment({ PHILEAS_SEED: 'given' }, () => {
    const { settings } = startJourney(defineJourney({ routes: 1, tripLength: 1, allow: ['views'] }), declaring);
    const handedOn = process.env[ALLOW_EXCLUDED_VARIABLE];
    finishJourney();
    return { settings, handedOn };
  });
  expect(fromFile.handedOn).toBe('views');
  expect(fromFile.settings.find((l) => l.startsWith('Exclusion groups:'))).toMatch(/views let in\s+in the Journey file$/);

  // The control: none let in writes nothing, so the command to run it again
  // stays as short as the run was.
  const none = withEnvironment({ PHILEAS_SEED: 'given' }, () => {
    startJourney(defineJourney({ routes: 1, tripLength: 1 }), declaring);
    const handedOn = process.env[ALLOW_EXCLUDED_VARIABLE];
    finishJourney();
    return handedOn;
  });
  expect(none).toBeUndefined();
});

test('startJourney prints every setting, and marks each one set for this run', () => {
  const settings = withEnvironment(
    { PHILEAS_ROUTES: '2', PHILEAS_SEED: 'given', PHILEAS_SHOW: 'back', PHILEAS_HOP_DELAY_MS: '300' },
    () => {
      const { settings } = startJourney(defineJourney({ routes: 5, tripLength: 20 }), buggy);
      // Ended, so the Journey's own folder in the system temp folder is removed.
      finishJourney();
      return settings;
    }
  );
  const line = (name: string) => settings.find((l) => l.startsWith(`${name}:`)) ?? '';

  expect(line('Journey seed')).toMatch(/^Journey seed: given\s+set for this run$/);
  expect(line('Routes')).toMatch(/^Routes: 2\s+set for this run$/);
  // Taken from the file, so not marked: the marks are only worth reading if
  // they are absent where nothing changed.
  expect(line('Trip length')).toBe('Trip length: 20');
  expect(line('Route deadline')).toBe('Route deadline: none');
  expect(line('Window mode')).toBe('Window mode: back');
  expect(line('Hop delay')).toBe('Hop delay: 300 ms');
  expect(settings.map((l) => l.split(':')[0])).toEqual([
    'Journey seed',
    'Run',
    'Routes',
    'Trip length',
    'Fix',
    'Route deadline',
    'Journey deadline',
    'Window mode',
    'Hop delay',
    'Follow',
    'Exclusion groups',
    'Staleness guard',
    'Survey only',
    'Replay',
  ]);
  expect(line('Survey only')).toBe('Survey only: off');
  // buggy declares no exclusion groups.
  expect(line('Exclusion groups')).toBe('Exclusion groups: none declared');
  // buggy names its sources, so the guard is on.
  expect(line('Staleness guard')).toBe('Staleness guard: on');
});

test('an adapter with no sources is printed as a staleness guard that cannot run, not as on', () => {
  // As for an installed binary, such as RStudio's.
  const { staleness: _sources, ...noSources } = buggy;
  const settings = withEnvironment({ PHILEAS_SEED: 'given' }, () => {
    const { settings } = startJourney(defineJourney({ routes: 1, tripLength: 1 }), noSources);
    finishJourney();
    return settings;
  });
  expect(settings.find((l) => l.startsWith('Staleness guard:'))).toBe(
    'Staleness guard: cannot run: the adapter names no sources to compare the bundle against'
  );
});

test('the command runs a Journey with its settings changed, and the file unchanged', () => {
  const journeyFile = path.join(repo, 'proving-ground', 'buggy', 'phileas', 'journeys', 'exploration.ts');
  const before = fs.readFileSync(journeyFile, 'utf8');

  const env = { ...process.env };
  for (const name of TOUCHED) delete env[name];
  const result = spawnSync(
    process.execPath,
    [command, 'run', 'proving-ground/buggy/phileas', '--routes', '1', '--trip-length', '2', '--seed', 'cmd-seed'],
    { cwd: repo, env, encoding: 'utf8', timeout: 120_000 }
  );
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status, output).toBe(0);
  expect(output).toMatch(/Journey seed: cmd-seed\s+set for this run/);
  expect(output).toMatch(/Routes: 1\s+set for this run/);
  expect(output).toMatch(/Trip length: 2\s+set for this run/);
  // One Route registered rather than the file's five, which is the override
  // reaching the workers and not only the printout. Said by the engine's
  // reporter, which `phileas run` prints through, last.
  expect(output).toMatch(/^Journey cmd-seed, run \S+: 1 Route, 1 passed, 0 failed, 0 stranded; 2 of 2 Hops$/m);
  expect(output.trim().split('\n').at(-1)).toMatch(/^Run it again: phileas run proving-ground\/buggy\/phileas --seed cmd-seed --routes 1 --trip-length 2$/);
  expect(fs.readFileSync(journeyFile, 'utf8')).toBe(before);
});

test("the command says the engine's version, and an unknown command is told every command there is", () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')) as { version: string };
  const said = spawnSync(process.execPath, [command, '--version'], { cwd: repo, encoding: 'utf8', timeout: 30_000 });
  expect(said.status, said.stderr).toBe(0);
  expect(said.stdout.trim()).toBe(`phileas ${version}`);
  expect(() => parse(['--version', 'extra'])).toThrow(/--version takes nothing/);
  // Every command the command has, replay included, which this line once left out.
  expect(() => parse(['nope'])).toThrow(/the commands are run, show, survey, known and replay/);
});
