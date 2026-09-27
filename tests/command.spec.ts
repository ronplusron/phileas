import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  defineJourney,
  overriddenTerms,
  startJourney,
  OVERRIDE_VARIABLES,
  SEED_VARIABLE,
  RUN_VARIABLE,
  WINDOW_MODE_VARIABLE,
  HOP_DELAY_VARIABLE,
} from '../src/index';
import { parse } from '../bin/phileas.mjs';

/**
 * The phileas command, and the two engine functions it relies on.
 *
 * The command itself only reads flags and starts Playwright; every value is
 * checked by defineJourney or startJourney, before anything launches. So most
 * of this tests those two, with the variables set as the command sets them, and
 * one test runs the command for real.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = path.join(repo, 'bin', 'phileas.mjs');

const TOUCHED = [
  ...Object.values(OVERRIDE_VARIABLES),
  SEED_VARIABLE,
  RUN_VARIABLE,
  WINDOW_MODE_VARIABLE,
  HOP_DELAY_VARIABLE,
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
    parse(['run', 'testbed/buggy/phileas', '--routes', '3', '--show=front', '--', '--grep', 'route 1$'])
  ).toEqual({
    command: 'run',
    config: 'testbed/buggy/phileas',
    settings: { PHILEAS_ROUTES: '3', PHILEAS_SHOW: 'front' },
    passThrough: ['--grep', 'route 1$'],
  });
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
  expect(parse(['survey', 'testbed/buggy/phileas'])).toEqual({ command: 'survey', config: 'testbed/buggy/phileas' });
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
    expect(overriddenTerms(journey)).toEqual(['routes', 'routeDeadlineMs']);
  });

  // The positive control: with nothing set, the file stands and nothing is marked.
  withEnvironment({}, () => {
    const journey = defineJourney({ routes: 5, tripLength: 20 });
    expect(journey.routes).toBe(5);
    expect(overriddenTerms(journey)).toEqual([]);
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
    expect(() => startJourney(journey)).toThrow(/PHILEAS_SHOW="frnt" is not a window mode/);
  });
  withEnvironment({ PHILEAS_HOP_DELAY_MS: 'soon' }, () => {
    expect(() => startJourney(journey)).toThrow(/PHILEAS_HOP_DELAY_MS="soon" is not a delay/);
  });
});

test('startJourney prints every setting, and marks each one set for this run', () => {
  const settings = withEnvironment(
    { PHILEAS_ROUTES: '2', PHILEAS_SEED: 'given', PHILEAS_SHOW: 'back', PHILEAS_HOP_DELAY_MS: '300' },
    () => startJourney(defineJourney({ routes: 5, tripLength: 20 })).settings
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
    'Route deadline',
    'Journey deadline',
    'Window mode',
    'Hop delay',
    'Follow',
    'Survey only',
  ]);
  expect(line('Survey only')).toBe('Survey only: off');
});

test('the command runs a Journey with its settings changed, and the file unchanged', () => {
  const journeyFile = path.join(repo, 'testbed', 'buggy', 'phileas', 'journeys', 'exploration.ts');
  const before = fs.readFileSync(journeyFile, 'utf8');

  const env = { ...process.env };
  for (const name of TOUCHED) delete env[name];
  const result = spawnSync(
    process.execPath,
    [command, 'run', 'testbed/buggy/phileas', '--routes', '1', '--trip-length', '2', '--seed', 'cmd-seed'],
    { cwd: repo, env, encoding: 'utf8', timeout: 120_000 }
  );
  const output = `${result.stdout}${result.stderr}`;

  expect(result.status, output).toBe(0);
  expect(output).toMatch(/Journey seed: cmd-seed\s+set for this run/);
  expect(output).toMatch(/Routes: 1\s+set for this run/);
  expect(output).toMatch(/Trip length: 2\s+set for this run/);
  // One Route registered rather than the file's five, which is the override
  // reaching the workers and not only the printout.
  expect(output).toMatch(/1 passed/);
  expect(fs.readFileSync(journeyFile, 'utf8')).toBe(before);
});
