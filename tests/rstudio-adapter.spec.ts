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

test("ODBC's settings files are in the Route's home, since HOME does not move them", () => {
  // Measured 2026-09-29: without these, installing odbc from New Connection
  // left an empty .odbc.ini in the real home folder.
  const env = typeof rstudio.env === 'function' ? rstudio.env(profile) : rstudio.env ?? {};
  expect(env).toMatchObject({
    ODBCINI: path.join(profile, 'home', '.odbc.ini'),
    ODBCINSTINI: path.join(profile, 'home', '.odbcinst.ini'),
  });
});

test('anything that prints is excluded, in the menu or the page, and a word merely containing print is not', async () => {
  // File -> Print... opened macOS's print dialog, which the stub does not reach.
  expect(await excluded({ source: 'menu', role: 'menuitem', name: 'Pr&int...', menuPath: ['&File', 'Pr&int...'] })).toBe(true);
  expect(await excluded({ source: 'page', role: 'button', name: 'Print the current file' })).toBe(true);
  expect(await excluded({ source: 'page', role: 'button', name: 'Blueprint' })).toBe(false);
});

test('screen reader support is excluded, since turning it on restarts RStudio outside the engine', async () => {
  expect(await excluded({ source: 'menu', role: 'menuitem', name: 'Screen Reader Support (disabled)', menuPath: ['&Help', '&Accessibility', 'Screen Reader Support (disabled)'] })).toBe(true);
  expect(await excluded({ source: 'page', role: 'checkbox', name: 'Screen reader support' })).toBe(true);
  // Its neighbors in the same menu stay.
  expect(await excluded({ source: 'menu', role: 'menuitem', name: 'Accessibility &Options...', menuPath: ['&Help', '&Accessibility', 'Accessibility &Options...'] })).toBe(false);
});

test("the file dialog's parent-folder row is excluded, since it climbs out of the home as the links do", async () => {
  // Excluded by name, which the survey applies, rather than by the predicate.
  expect(rstudio.exclusions.names).toContain('Folder ..');
  // A folder inside the home stays.
  expect(rstudio.exclusions.names).not.toContain('Folder R');
  expect(await excluded({ source: 'page', role: 'option', name: 'Folder R' })).toBe(false);
});

test('every way into a new session stays reachable, since the engine stubs the second RStudio it starts', async () => {
  expect(rstudio.exclusions.names).not.toContain('Open Project in New Session...');
  expect(rstudio.exclusions.names).not.toContain('Open in new session');
  expect(rstudio.exclusions.menuPaths).not.toContainEqual(['&File', 'Open Project in Ne&w Session...']);
  expect(rstudio.exclusions.menuPaths).not.toContainEqual(['&Session', '&New Session']);
  expect(await excluded({ source: 'page', role: 'menuitem', name: 'Open Project in New Session...' })).toBe(false);
  expect(await excluded({ source: 'page', role: 'checkbox', name: 'Open in new session' })).toBe(false);
});

test('the command palette is excluded, since the exclusions do not reach its copies of commands', () => {
  expect(rstudio.exclusions.menuPaths).toContainEqual(['&Tools', 'Show &Command Palette']);
});

test("the console errors R's restart makes are accepted, and only those", () => {
  const accept = (message: string) => {
    const narrowed = rstudio.narrowedChecks?.['console-error'];
    return narrowed?.kind === 'narrowed' && narrowed.accept(message);
  };
  expect(accept('Failed to load resource: net::ERR_EMPTY_RESPONSE')).toBe(true);
  expect(accept('Failed to load resource: net::ERR_CONNECTION_REFUSED')).toBe(true);
  // Any other network error, or anything after the message, still counts.
  expect(accept('Failed to load resource: net::ERR_NAME_NOT_RESOLVED')).toBe(false);
  expect(accept('Failed to load resource: net::ERR_EMPTY_RESPONSE and then something')).toBe(false);
});

test("a client exception keeps its message and first frame, without the build's line numbers and versions", async () => {
  const { signatureOf } = await import('../src/index');
  const logged = (line: number, version: string) =>
    signatureOf(
      'log-error',
      `rsession-ann.log: [rsession-ann] ERROR CLIENT EXCEPTION (rsession-ann): (TypeError) : Cannot set properties of null (setting 'resultsCount');` +
        `|||org/rstudio/studio/client/workbench/views/output/find/FindOutputPresenter.java#${line}::findInFilesBeginFind` +
        `|||org/rstudio/core/client/command/CommandEvent.java#40::dispatch` +
        `|||Client-ID: 5b1f0c8e-2d47-4a93-b6e1-9c3a7f0d2e84|||User-Agent: Mozilla/5.0 RStudio/${version} Chrome/148.0.7778.280`,
      'ann',
      rstudio.varyingInSignatures
    );
  expect(logged(537, '2026.09.1+183')).toBe(
    "log-error: rsession-<user>.log: [rsession-<user>] ERROR CLIENT EXCEPTION (rsession-<user>): (TypeError) : Cannot set properties of null (setting 'resultsCount'); " +
      'org/rstudio/studio/client/workbench/views/output/find/FindOutputPresenter.java::findInFilesBeginFind'
  );
  // The next release: the frame moved and the versions changed, and it is the same finding.
  expect(logged(541, '2026.12.0+50')).toBe(logged(537, '2026.09.1+183'));
});
