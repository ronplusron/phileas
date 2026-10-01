#!/usr/bin/env node
// Prepares a copy of RStudio Desktop that Playwright can launch the ordinary
// way, as the trial's adapter expects.
//
//   node trial/rstudio/prepare-app.mjs [installed app] [copy to make]
//
// The installed release refuses Playwright's launch, because two of its
// Electron fuses are off: RunAsNode and the inspector arguments. This copies
// the application with `ditto`, leaving the installed one untouched, switches
// those two fuses on in the copy, and signs the copy ad hoc, which drops
// Posit's signature and the hardened runtime. docs/HISTORY.md, under
// 2026-09-28, has the measurement this repeats and why it was chosen.
//
// The fuse layout is Electron's, read from @electron/fuses 2.1.3 rather than
// recalled: a sentinel, a byte for the wire's version and one for its length,
// then one ASCII "0" or "1" per fuse, RunAsNode first and the inspector
// arguments fourth. A universal binary carries one wire per architecture.
//
// It refuses unless every wire reads exactly as the release measured on
// 2026-09-28 did, because that is the only one this was tried on; --any-wire
// accepts another reading, and says so.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SENTINEL = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
const WIRE_VERSION = 1;
const RUN_AS_NODE = 0;
const INSPECT_ARGUMENTS = 3;
const MEASURED_WIRE = '000000011';

/** @param {string} message */
function refuse(message) {
  console.error(`prepare-app: ${message}`);
  process.exit(1);
}

/** @param {string} app */
function versionOf(app) {
  const plist = path.join(app, 'Contents', 'Info.plist');
  return execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print CFBundleShortVersionString', plist], {
    encoding: 'utf8',
  }).trim();
}

/**
 * Every fuse wire in the framework binary, with where its fuses start.
 * @param {Buffer} binary
 */
function wiresIn(binary) {
  /** @type {{ at: number, version: number, fuses: string }[]} */
  const wires = [];
  for (let at = binary.indexOf(SENTINEL); at !== -1; at = binary.indexOf(SENTINEL, at + 1)) {
    const header = at + SENTINEL.length;
    const version = binary[header] ?? -1;
    const length = binary[header + 1] ?? 0;
    const start = header + 2;
    wires.push({ at: start, version, fuses: binary.subarray(start, start + length).toString('latin1') });
  }
  return wires;
}

const args = process.argv.slice(2);
const anyWire = args.includes('--any-wire');
const [source = '/Applications/RStudio.app', given] = args.filter((a) => a !== '--any-wire');

if (process.platform !== 'darwin') refuse('this prepares a macOS application, and this is not macOS.');
if (!fs.existsSync(path.join(source, 'Contents', 'Info.plist'))) refuse(`${source} is not an application.`);
const version = versionOf(source).replace(/\+.*$/, '');
const copy = given ?? path.join(os.homedir(), 'Applications', `RStudio-${version}-fuses.app`);
if (fs.existsSync(copy)) refuse(`${copy} already exists. Remove it first, or name another copy.`);

const framework = path.join(copy, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Electron Framework');

console.log(`Copying ${source} to ${copy}`);
fs.mkdirSync(path.dirname(copy), { recursive: true });
execFileSync('ditto', [source, copy], { stdio: 'inherit' });

const binary = fs.readFileSync(framework);
const wires = wiresIn(binary);
const readings = wires.map((w) => w.fuses).join(', ');
if (wires.length < 1 || wires.length > 2) {
  refuse(`found ${wires.length} fuse wires in ${framework}; one or two are expected. The copy is left as it is.`);
}
for (const wire of wires) {
  if (wire.version !== WIRE_VERSION) {
    refuse(`a fuse wire has version ${wire.version}, not ${WIRE_VERSION}. The copy is left unchanged.`);
  }
  if (wire.fuses.length <= INSPECT_ARGUMENTS || !/^[01r]+$/.test(wire.fuses)) {
    refuse(`a fuse wire reads ${JSON.stringify(wire.fuses)}, which is not a wire of fuses. The copy is left unchanged.`);
  }
}
if (!wires.every((w) => w.fuses === MEASURED_WIRE)) {
  if (!anyWire) {
    refuse(
      `the fuse wires read ${readings}, and this was only tried on ${MEASURED_WIRE}. ` +
        `The copy is left unchanged. --any-wire switches the two fuses anyway.`
    );
  }
  console.log(`The wires read ${readings}, not ${MEASURED_WIRE}; switching anyway, because of --any-wire.`);
}

for (const wire of wires) {
  binary[wire.at + RUN_AS_NODE] = '1'.charCodeAt(0);
  binary[wire.at + INSPECT_ARGUMENTS] = '1'.charCodeAt(0);
}
fs.writeFileSync(framework, binary);
const after = wiresIn(fs.readFileSync(framework)).map((w) => w.fuses).join(', ');
console.log(`Fuse wires: ${readings} before, ${after} after.`);

console.log('Signing the copy ad hoc.');
execFileSync('codesign', ['--force', '--deep', '--sign', '-', copy], { stdio: 'inherit' });
execFileSync('codesign', ['--verify', '--deep', '--strict', copy], { stdio: 'inherit' });
console.log(`Ready. Run the trial with PHILEAS_APP_DIR=${copy}`);
