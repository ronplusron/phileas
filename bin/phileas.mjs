#!/usr/bin/env node
// The phileas command.
//
//   phileas run [config] [flags] [-- extra Playwright arguments]
//   phileas show [run folder, seed folder, journal file or seed]
//   phileas survey [config]
//
// `run` runs a Journey with its settings changed for one run. Real flags need
// a command of their own, because Playwright refuses any it does not know
// (`playwright test --routes 5`: unknown option). So it checks the flags, hands
// each value to the run as an environment variable, which is the only channel
// that reaches Playwright's workers, and starts Playwright itself.
//
// `show` prints a finished run's journals, one readable line per Hop, through
// the same renderer `run --follow` uses.
//
// `survey` launches the application and prints what the engine sees at the
// start, then runs the Fix and prints what it sees after it, in the form a
// Fix's hop() takes, so a Fix is written by copying lines rather than by
// reading the application's code.
//
// docs/HISTORY.md has the reasoning for both.
//
// Plain JavaScript on purpose, with its types in comments that the compiler
// checks. The engine is TypeScript imported without file extensions, which
// Node cannot load, and Node will not erase types from a file inside
// node_modules either, so this imports only the renderer, which is plain
// JavaScript for that reason. It checks that each flag is known and has a
// value; whether the value is good is checked by the engine, in defineJourney
// and startJourney, before anything launches, so the rules live in one place.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJournal } from '../src/report/render.mjs';

/** Flags that take a value, and the variable each travels in. */
const FLAGS = /** @type {Record<string, string>} */ ({
  '--seed': 'PHILEAS_SEED',
  '--routes': 'PHILEAS_ROUTES',
  '--trip-length': 'PHILEAS_TRIP_LENGTH',
  '--route-deadline-ms': 'PHILEAS_ROUTE_DEADLINE_MS',
  '--journey-deadline-ms': 'PHILEAS_JOURNEY_DEADLINE_MS',
  '--show': 'PHILEAS_SHOW',
  '--hop-delay-ms': 'PHILEAS_HOP_DELAY_MS',
});

/** Flags that take no value, and the variable each sets to 1. */
const SWITCHES = /** @type {Record<string, string>} */ ({
  '--follow': 'PHILEAS_FOLLOW',
});

// The folder every consuming repository keeps its Journey in, so that
// `phileas run --routes 3` needs no path there, and where its journals go.
const DEFAULT_CONFIG = 'phileas';
const DEFAULT_JOURNALS = path.join(DEFAULT_CONFIG, '.phileas-journals');

const USAGE = `Usage:
  phileas run [config] [flags] [-- extra Playwright arguments]
  phileas show [what]
  phileas survey [config]

run: run a Journey, with its settings changed for this run only.
  config    A Playwright config file, or a folder holding playwright.config.ts.
            Defaults to ${DEFAULT_CONFIG}/.

  The Journey file is not edited. A bad value is refused by the name of the
  variable it travels in, shown here.
${Object.entries(FLAGS)
  .map(([flag, variable]) => `  ${`${flag} <value>`.padEnd(32)}${variable}`)
  .join('\n')}
  ${'--follow'.padEnd(32)}PHILEAS_FOLLOW   print each Hop as it happens

  Anything after -- is handed to Playwright, such as -- --grep "route 1$".

show: print a finished run, one line per Hop.
  what      A run folder, a seed's folder or a journals folder (its latest run),
            one journal file, or a seed's name under ${DEFAULT_JOURNALS}/.
            Defaults to the latest run under ${DEFAULT_JOURNALS}/.

survey: print what the engine sees when the application starts, one line per
  control, each in the form a Fix's hop() takes. Then, if there is a Fix, run
  it, printing each step, and print what the engine sees after it, where the
  Trip would begin. Nothing travels and no journal is written.
  config    As for run. Defaults to ${DEFAULT_CONFIG}/.`;

/**
 * @param {string} message
 * @returns {never}
 */
function refuse(message) {
  console.error(`phileas: ${message}\n\n${USAGE}`);
  process.exit(2);
}

/**
 * @typedef {{ command: 'help' }
 *   | { command: 'run', config: string, settings: Record<string, string>, passThrough: string[] }
 *   | { command: 'show', what: string | undefined }
 *   | { command: 'survey', config: string }} Parsed
 */

/**
 * The command line, read into what to do.
 * @param {string[]} args
 * @returns {Parsed}
 */
export function parse(args) {
  const [command, ...rest] = args;
  // Help asked for anywhere before --, since what follows -- is Playwright's.
  const beforeSeparator = rest.includes('--') ? rest.slice(0, rest.indexOf('--')) : rest;
  if (command === '--help' || command === '-h' || beforeSeparator.some((a) => a === '--help' || a === '-h')) {
    return { command: 'help' };
  }
  if (command === 'show') {
    if (rest.length > 1) throw new Error(`show takes one thing to show, and was given ${rest.length}`);
    const [what] = rest;
    if (what?.startsWith('-')) throw new Error(`show takes no flags, and was given ${what}`);
    return { command: 'show', what };
  }
  if (command === 'survey') {
    if (rest.length > 1) throw new Error(`survey takes one config, and was given ${rest.length}`);
    const [config] = rest;
    if (config?.startsWith('-')) throw new Error(`survey takes no flags, and was given ${config}`);
    return { command: 'survey', config: config ?? DEFAULT_CONFIG };
  }
  if (command !== 'run') {
    throw new Error(
      command ? `unknown command ${command}; the commands are run, show and survey` : 'no command given'
    );
  }

  const separator = rest.indexOf('--');
  const own = separator === -1 ? rest : rest.slice(0, separator);
  const passThrough = separator === -1 ? [] : rest.slice(separator + 1);

  /** @type {string | undefined} */
  let config;
  /** @type {Record<string, string>} */
  const settings = {};
  for (let i = 0; i < own.length; i += 1) {
    const arg = /** @type {string} */ (own[i]);
    if (!arg.startsWith('-')) {
      if (config !== undefined) throw new Error(`a second config was given, ${arg}; give one`);
      config = arg;
      continue;
    }
    const [flag = '', inline] = arg.split(/=(.*)/s);
    const switched = SWITCHES[flag];
    if (switched) {
      if (inline !== undefined) throw new Error(`${flag} takes no value`);
      if (switched in settings) throw new Error(`${flag} was given twice`);
      settings[switched] = '1';
      continue;
    }
    const variable = FLAGS[flag];
    if (!variable) throw new Error(`unknown flag ${flag}`);
    if (variable in settings) throw new Error(`${flag} was given twice`);
    const value = inline ?? own[i + 1];
    if (inline === undefined) i += 1;
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new Error(`${flag} needs a value`);
    }
    settings[variable] = value;
  }

  return { command: 'run', config: config ?? DEFAULT_CONFIG, settings, passThrough };
}

/**
 * Playwright's command-line entry, found from where the config lives, as the
 * consumer installed it.
 * @param {string} configPath
 * @returns {string}
 */
function playwrightCli(configPath) {
  const from = fs.statSync(configPath).isDirectory() ? configPath : path.dirname(configPath);
  const require = createRequire(path.join(path.resolve(from), 'resolve-from-here.js'));
  return path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
}

/**
 * @param {string} config
 * @param {Record<string, string>} settings
 * @param {string[]} passThrough
 */
function run(config, settings, passThrough) {
  if (!fs.existsSync(config)) {
    refuse(
      config === DEFAULT_CONFIG
        ? `there is no ${DEFAULT_CONFIG}/ folder here; give the Playwright config to run`
        : `${config} does not exist`
    );
  }

  /** @type {string} */
  let cli;
  try {
    cli = playwrightCli(config);
  } catch {
    refuse(`@playwright/test is not installed where ${config} can reach it`);
  }

  const child = spawn(process.execPath, [cli, 'test', '-c', config, ...passThrough], {
    stdio: 'inherit',
    env: { ...process.env, ...settings },
  });
  // Ctrl-C reaches the whole process group, so Playwright stops on its own;
  // this only has to report how it ended.
  const waitForPlaywright = () => {};
  process.on('SIGINT', waitForPlaywright);
  child.on('close', (code, signal) => {
    process.off('SIGINT', waitForPlaywright);
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

/**
 * @param {string} folder
 * @returns {string[]}
 */
function subfolders(folder) {
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(folder, entry.name));
}

/**
 * @param {string} folder
 * @returns {string[]}
 */
function journalsIn(folder) {
  return fs
    .readdirSync(folder)
    .filter((name) => /^route-\d+-.*\.jsonl$/.test(name))
    .sort()
    .map((name) => path.join(folder, name));
}

/**
 * The latest run among run folders. A run is named for when it started, in UTC,
 * so the names sort in the order the runs happened.
 * @param {string[]} runs
 * @returns {string | undefined}
 */
function latest(runs) {
  return [...runs].sort((a, b) => path.basename(a).localeCompare(path.basename(b))).at(-1);
}

/**
 * The journal files a `show` target names, and the folder they came from.
 *
 * A journals folder holds seed folders, which hold run folders, which hold one
 * journal per Route, so a folder is recognized by what is inside it.
 * @param {string | undefined} what
 * @returns {{ from: string, files: string[] }}
 */
export function journalsFor(what) {
  const target = what ?? DEFAULT_JOURNALS;
  if (!fs.existsSync(target)) {
    if (what !== undefined && !what.includes(path.sep) && fs.existsSync(path.join(DEFAULT_JOURNALS, what))) {
      return journalsFor(path.join(DEFAULT_JOURNALS, what));
    }
    throw new Error(
      what === undefined
        ? `there is no ${DEFAULT_JOURNALS}/ folder here; name a run folder, or a seed's folder`
        : `${what} is neither a folder nor a seed under ${DEFAULT_JOURNALS}/`
    );
  }
  if (fs.statSync(target).isFile()) return { from: target, files: [target] };

  const own = journalsIn(target);
  if (own.length) return { from: target, files: own };

  const runs = subfolders(target).filter((folder) => journalsIn(folder).length);
  const deeper = subfolders(target).flatMap((seed) =>
    subfolders(seed).filter((folder) => journalsIn(folder).length)
  );
  const run = latest(runs.length ? runs : deeper);
  if (!run) throw new Error(`${target} holds no journals`);
  return { from: run, files: journalsIn(run) };
}

/** @param {string | undefined} what */
function show(what) {
  /** @type {{ from: string, files: string[] }} */
  let found;
  try {
    found = journalsFor(what);
  } catch (error) {
    refuse(/** @type {Error} */ (error).message);
  }
  console.log(`Journals in ${found.from}\n`);
  for (const file of found.files) {
    for (const line of renderJournal(fs.readFileSync(file, 'utf8'))) console.log(line);
    console.log('');
  }
}

function main() {
  /** @type {Parsed} */
  let parsed;
  try {
    parsed = parse(process.argv.slice(2));
  } catch (error) {
    refuse(/** @type {Error} */ (error).message);
  }
  if (parsed.command === 'help') console.log(USAGE);
  else if (parsed.command === 'show') show(parsed.what);
  // One Route is enough to see the start, since every Route starts the same way.
  else if (parsed.command === 'survey') run(parsed.config, { PHILEAS_SURVEY: '1', PHILEAS_ROUTES: '1' }, []);
  else run(parsed.config, parsed.settings, parsed.passThrough);
}

// Run only when invoked, not when a test imports parse. Compared as file
// paths rather than URLs, since a URL percent-encodes the spaces this
// repository's own path contains, and through realpath, since npm installs the
// command as a link.
const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
