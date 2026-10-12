import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createPackage } from '@electron/asar';
import { readBuild, readRunsWith, sourcesOf, topLevelStrings, type JournaledBuild } from '../src/build';
import { readJournal } from '../src/journal';
import { buildText, renderJournal } from '../src/report/render.mjs';
import { scratch, removeScratch } from './scratch';

/**
 * Which build a Route ran against, as its journal's opening line records it
 * (C1). On 2026-10-12 a triage with nothing recorded said RStudio was built
 * from a source checkout, when the trial runs a copy of the installed release.
 */

test.afterEach(removeScratch);

/** A bundle holding only an Info.plist, which is all `readBuild` reads. */
function bundleWith(plist: string | undefined): string {
  const bundle = path.join(scratch('build-'), 'Some.app');
  fs.mkdirSync(path.join(bundle, 'Contents'), { recursive: true });
  if (plist !== undefined) fs.writeFileSync(path.join(bundle, 'Contents', 'Info.plist'), plist);
  return bundle;
}

function plist(body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
    `<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n`
  );
}

// Shaped as RStudio 2026.10.0's is, read on 2026-10-12, with a document type
// ahead of the application's own keys, whose names the outer ones share.
const RSTUDIO_LIKE = plist(`
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key>
      <string>R Script</string>
      <key>CFBundleName</key>
      <string>Not the application</string>
    </dict>
  </array>
  <key>CFBundleName</key>
  <string>RStudio</string>
  <key>CFBundleShortVersionString</key>
  <string>2026.10.0+232</string>
  <key>CFBundleVersion</key>
  <string>2026.10.0+232</string>
  <key>LSRequiresNativeExecution</key>
  <true/>
  <key>CFBundleIdentifier</key>
  <string>com.rstudio.desktop</string>
  <key>NSAppTransportSecurity</key>
  <dict/>`);

test("a bundle's name, version and identifier are read from its Info.plist, and only from the outermost dictionary", () => {
  expect(readBuild(bundleWith(RSTUDIO_LIKE))).toEqual({
    name: 'RStudio',
    version: '2026.10.0+232',
    identifier: 'com.rstudio.desktop',
  });
});

test('a build number unlike the version is kept, a display name wins, and escaped text is read as written', () => {
  const read = readBuild(
    bundleWith(
      plist(`
  <key>CFBundleName</key><string>Short</string>
  <key>CFBundleDisplayName</key><string>Tom &amp; Jerry&#39;s</string>
  <key>CFBundleShortVersionString</key><string>1.2.3</string>
  <key>CFBundleVersion</key><string>456</string>`)
    )
  );
  expect(read).toEqual({ name: "Tom & Jerry's", version: '1.2.3', build: '456' });
});

test('a key followed by something other than a string is not paired with the next string', () => {
  // The control: the same string straight after the key is read.
  expect(topLevelStrings(plist('<key>CFBundleName</key><string>Paired</string>')).get('CFBundleName')).toBe('Paired');
  const strings = topLevelStrings(plist('<key>CFBundleName</key><true/><key>Other</key><string>Not the name</string>'));
  expect(strings.get('CFBundleName')).toBeUndefined();
  expect(strings.get('Other')).toBe('Not the name');
});

test('what could not be read is said, never left out', () => {
  expect(readBuild(bundleWith(plist('<key>CFBundleName</key><string>Nameless version</string>')))).toEqual({
    name: 'Nameless version',
    unread: 'Contents/Info.plist names no CFBundleShortVersionString',
  });
  expect(readBuild(bundleWith(plist('')))).toEqual({
    unread: 'Contents/Info.plist names no CFBundleDisplayName or CFBundleName and no CFBundleShortVersionString',
  });
  expect(readBuild(bundleWith(undefined)).unread).toMatch(/^Contents\/Info\.plist could not be read: ENOENT/);
});

test('a binary Info.plist is read through plutil', () => {
  test.skip(process.platform !== 'darwin', 'plutil is a macOS program');
  const bundle = bundleWith(RSTUDIO_LIKE);
  const file = path.join(bundle, 'Contents', 'Info.plist');
  execFileSync('plutil', ['-convert', 'binary1', file]);
  // The control: the file really is binary now, so the XML path cannot be what read it.
  expect(fs.readFileSync(file).subarray(0, 6).toString('latin1')).toBe('bplist');
  expect(readBuild(bundle)).toEqual({ name: 'RStudio', version: '2026.10.0+232', identifier: 'com.rstudio.desktop' });
});

test("the adapter's account of what the application runs with is kept, and a failure is said rather than thrown", async () => {
  const launch = { userDataDir: '/nowhere', env: { RSTUDIO_WHICH_R: '/some/R' } };
  expect(await readRunsWith({}, launch)).toEqual({});
  expect(await readRunsWith({ runsWith: ({ env }) => ({ 'R (RSTUDIO_WHICH_R)': env.RSTUDIO_WHICH_R ?? '' }) }, launch)).toEqual({
    runsWith: { 'R (RSTUDIO_WHICH_R)': '/some/R' },
  });
  expect(await readRunsWith({ runsWith: async () => ({ Python: '3.12.4' }) }, launch)).toEqual({ runsWith: { Python: '3.12.4' } });
  expect(
    await readRunsWith(
      {
        runsWith: () => {
          throw new Error('no Rscript beside it\nand more');
        },
      },
      launch
    )
  ).toEqual({ runsWithUnread: "the adapter's runsWith failed: no Rscript beside it" });
  expect(await readRunsWith({ runsWith: () => ({ R: 4.6 as unknown as string }) }, launch)).toEqual({
    runsWithUnread: "the adapter's runsWith gave values that are not text for R",
  });
});

test("the staleness guard's verdict is kept without its prose", () => {
  expect(sourcesOf({ ran: true, filesCompared: 412 })).toEqual({ compared: 412 });
  expect(sourcesOf({ ran: false, reason: 'no-sources', detail: 'prose' })).toEqual({ notCompared: 'no-sources' });
  expect(sourcesOf({ ran: false, reason: 'skipped-by-switch', detail: 'prose' })).toEqual({ notCompared: 'skipped-by-switch' });
});

test('the opening line names the build, the release where the bundle calls it otherwise, and what was not read', () => {
  const positron: JournaledBuild = {
    name: 'Positron',
    version: '1.130.0',
    identifier: 'co.posit.positron',
    release: '2026.09.1',
    runsWith: { 'R (PATH)': '4.6.0', 'Python (PATH python3)': '3.12.4' },
    sources: { notCompared: 'no-sources' },
  };
  expect(buildText(positron)).toBe(
    'Positron 2026.09.1 (bundle 1.130.0); with R (PATH) 4.6.0, Python (PATH python3) 3.12.4; no sources to check it against'
  );
  expect(buildText({ name: 'Buggy', version: '0.0.0', build: '7', sources: { compared: 12 } })).toBe(
    'Buggy 0.0.0 build 7; checked against its sources, 12 files'
  );
  expect(buildText({ name: 'Buggy', version: '0.0.0', release: '0.0.0', sources: { notCompared: 'skipped-by-switch' } })).toBe(
    'Buggy 0.0.0; not checked against its sources, by PHILEAS_ALLOW_STALE'
  );
  expect(buildText({ unread: 'Contents/Info.plist could not be read: ENOENT', runsWithUnread: 'it threw' })).toBe(
    'a build whose name and version were not read; not all read: Contents/Info.plist could not be read: ENOENT; ' +
      'what it runs with unread: it threw'
  );
  expect(buildText(undefined)).toBe('build not recorded');
});

test('a journal from before builds were recorded still reads, and says so', () => {
  const file = path.join(scratch('build-journal-'), 'route-001-r.jsonl');
  const opening = { kind: 'route', journeySeed: 'j', routeSeed: 'r', routeNumber: 1, tripLength: 1, settleQuietMs: 400, startedAt: '' };
  fs.writeFileSync(file, `${JSON.stringify(opening)}\n`);
  const [first] = readJournal(file);
  expect(first).toEqual(opening);
  expect(renderJournal(fs.readFileSync(file, 'utf8'))[0]).toBe(
    'route 1  seed r, from Journey seed j, Trip of 1 hops, build not recorded'
  );
});

test('off macOS the packaged package.json is read, from the archive where there is one, and what is missing is said', async () => {
  const install = scratch('build-other-');
  const app = path.join(install, 'resources', 'app');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'rstudio', productName: 'RStudio', version: '2026.10.0+232' }));
  for (const platform of ['linux', 'win32'] as const) {
    expect(readBuild(install, platform)).toEqual({ name: 'RStudio', version: '2026.10.0+232' });
  }

  // An archive wins over a folder beside it, since it is what Electron loads.
  const packed = scratch('build-asar-src-');
  fs.writeFileSync(path.join(packed, 'package.json'), JSON.stringify({ name: 'buggy', version: '0.0.0' }));
  await createPackage(packed, path.join(install, 'resources', 'app.asar'));
  expect(readBuild(install, 'linux')).toEqual({ name: 'buggy', version: '0.0.0' });

  fs.rmSync(path.join(install, 'resources', 'app.asar'));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'nameless-version' }));
  expect(readBuild(install, 'linux')).toEqual({ name: 'nameless-version', unread: 'resources/app/package.json names no version' });
  fs.writeFileSync(path.join(app, 'package.json'), 'not json');
  expect(readBuild(install, 'linux').unread).toMatch(/^resources\/app\/package\.json is not JSON: /);
  expect(readBuild(scratch('build-empty-'), 'win32').unread).toMatch(/^resources\/app\/package\.json could not be read: ENOENT/);
});
