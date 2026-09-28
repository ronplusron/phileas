import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { AppUnderTest, Candidate } from '../src/index';

/**
 * What the RStudio adapter keeps a Route away from in RStudio's in-page file
 * dialog, and what it sets before launch, without launching RStudio. The
 * dialog shows one link per folder of the path, and a Route must not climb
 * above its own home.
 */

let scratch: string;
let run: string;
let profile: string;
let rstudio: AppUnderTest;
const saved = { app: process.env.PHILEAS_APP_DIR, temp: process.env.PHILEAS_TEMP_FOLDER };

test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rstudio-adapter-test-'));
  // The adapter reads which application from PHILEAS_APP_DIR as it loads.
  process.env.PHILEAS_APP_DIR = scratch;
  ({ rstudio } = await import('../trial/rstudio/phileas/adapter/index'));
});

test.beforeEach(() => {
  run = fs.mkdtempSync(path.join(scratch, 'phileas-rstudio-'));
  profile = fs.mkdtempSync(path.join(run, 'r'));
  process.env.PHILEAS_TEMP_FOLDER = run;
});

test.afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
  if (saved.app === undefined) delete process.env.PHILEAS_APP_DIR;
  else process.env.PHILEAS_APP_DIR = saved.app;
  if (saved.temp === undefined) delete process.env.PHILEAS_TEMP_FOLDER;
  else process.env.PHILEAS_TEMP_FOLDER = saved.temp;
});

const link = (name: string): Candidate => ({ source: 'page', role: 'link', name });
const excluded = (candidate: Candidate) => rstudio.exclusions.exclude?.(candidate, undefined as never);

test("every folder above the Route's home is excluded, and the home and below are not", async () => {
  const above = ['/', ...fs.realpathSync(os.tmpdir()).split('/').filter(Boolean), path.basename(run), path.basename(profile)];
  for (const name of above) expect(await excluded(link(name)), name).toBe(true);
  for (const name of ['home', 'R', 'travel', 'Untitled1.R']) expect(await excluded(link(name)), name).toBe(false);
  // Only links: a button that happens to share a folder's name stays.
  expect(await excluded({ source: 'page', role: 'button', name: 'T' })).toBe(false);
});

test("without the run's folder the predicate refuses rather than letting those links through", async () => {
  delete process.env.PHILEAS_TEMP_FOLDER;
  expect(() => excluded(link('home'))).toThrow(/PHILEAS_TEMP_FOLDER is unset/);
});

test('before launch, native dialogs are switched off and the package library exists', async () => {
  await rstudio.beforeLaunch?.(profile);
  const prefs = JSON.parse(fs.readFileSync(path.join(profile, 'home', '.config', 'rstudio', 'rstudio-prefs.json'), 'utf8'));
  expect(prefs).toEqual({ native_file_dialogs: false });
  expect(fs.statSync(path.join(profile, 'home', 'R', 'library')).isDirectory()).toBe(true);
});
