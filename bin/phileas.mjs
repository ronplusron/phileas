#!/usr/bin/env node
// The phileas command.
//
//   phileas run [config] [flags] [-- extra Playwright arguments]
//   phileas show [run folder, seed folder, journal file or seed]
//   phileas survey [config]
//   phileas known add <id> --issue <issue> [file]
//   phileas known dismiss <id> --reason <why> [file]
//   phileas known remove <id> [file]
//   phileas known list [file]
//   phileas replay <journal> [config] [--whole] [--with-current-fix] [--follow]
//   phileas reproduce [what] [--config <config>] [--with-current-fix]
//   phileas triage [what] [--config <config>] [--send] [--model <model>] [--budget <usd>]
//   phileas unattended [config] [run flags] [--send] [--model <model>] [--budget <usd>]
//   phileas view [config] [--port <port>]
//   phileas claude [-- arguments for claude]
//   phileas --version
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
// Fix's act step takes, so a Fix is written by copying lines rather than by
// reading the application's code.
//
// `known add` marks a finding filed with its issue. A Journey adds what it found
// to the known findings by itself when it ends, unfiled; this records the issue
// once somebody has filed it. `known dismiss` marks one a false alarm, with the
// reason, so Routes keep carrying past it and it is never added back; `known
// remove` takes one out, so the next time it is seen it is reported as new.
// `known list` prints every one, with when it was last met in the journals
// kept beside the file, since a run's end lists only those it met.
//
// `run` prints through the engine's own reporter, src/report/reporter.mjs,
// unless a reporter is given after --: each Route's ending, what its failed
// checks saw, and a summary last, rather than Playwright's report of a
// thrown error and its attachments.
//
// `reproduce`, `triage`, `unattended`, `view` and `claude` are the work done
// after a run, asked for on 2026-10-12: replaying each new finding, handing a
// run to an assistant, all of that unattended, a page to do it from, and a
// session with the assistant's skills loaded. None of them is inside the
// engine; docs/PLAN.md has them under "After the run".
//
// docs/HISTORY.md has the reasoning for each.
//
// Plain JavaScript on purpose, with its types in comments that the compiler
// checks. The engine is TypeScript, which Node runs only once it is compiled
// into dist/, so this imports only the renderer and known.mjs, both plain
// JavaScript and shipped as source, and runs whether or not anything has been
// built. It checks that each flag is known and has a
// value; whether the value is good is checked by the engine, in defineJourney
// and startJourney, before anything launches, so the rules live in one place.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJournal } from '../src/report/render.mjs';
import { DEFAULT_KNOWN_FINDINGS, dismissFinding, journalsBeside, listKnownFindings, markFiled, removeFinding } from '../src/known.mjs';
import { REPORTER_VARIABLE } from '../src/report/render.mjs';
import { journalsInFolder, listRuns, summarizeRoute, summarizeRun } from '../src/report/summary.mjs';
import { DEFAULT_BUDGET_USD, PLUGIN_DIR, prepareTriage, runTriage, sendNotice, writeTriage } from '../src/assistant/triage.mjs';
import { serve } from '../src/view/server.mjs';

/** Flags that take a value, and the variable each travels in. */
const FLAGS = /** @type {Record<string, string>} */ ({
  '--seed': 'PHILEAS_SEED',
  '--routes': 'PHILEAS_ROUTES',
  '--trip-length': 'PHILEAS_TRIP_LENGTH',
  '--route-deadline-ms': 'PHILEAS_ROUTE_DEADLINE_MS',
  '--journey-deadline-ms': 'PHILEAS_JOURNEY_DEADLINE_MS',
  '--show': 'PHILEAS_SHOW',
  '--hop-delay-ms': 'PHILEAS_HOP_DELAY_MS',
  '--fix': 'PHILEAS_FIX',
  '--allow': 'PHILEAS_ALLOW_EXCLUDED',
});

/** Flags that take no value, and the variable each sets to 1. */
const SWITCHES = /** @type {Record<string, string>} */ ({
  '--follow': 'PHILEAS_FOLLOW',
});

// The folder every consuming repository keeps its Journey in, so that
// `phileas run --routes 3` needs no path there, and where its journals go.
const DEFAULT_CONFIG = 'phileas';
const DEFAULT_JOURNALS = path.join(DEFAULT_CONFIG, '.phileas-journals');
const DEFAULT_KNOWN = DEFAULT_KNOWN_FINDINGS;

// The engine's reporter, shipped as source beside the renderer it uses.
const REPORTER = fileURLToPath(new URL('../src/report/reporter.mjs', import.meta.url));

const USAGE = `Usage:
  phileas run [config] [flags] [-- extra Playwright arguments]
  phileas show [what]
  phileas survey [config]
  phileas known add <id> --issue <issue> [file]
  phileas known dismiss <id> --reason <why> [file]
  phileas known remove <id> [file]
  phileas known list [file]
  phileas replay <journal> [config] [--whole] [--with-current-fix] [--follow]
  phileas reproduce [what] [--config <config>] [--with-current-fix]
  phileas triage [what] [--config <config>] [--send] [--model <model>] [--budget <usd>]
  phileas unattended [config] [run flags] [--send] [--model <model>] [--budget <usd>]
  phileas view [config] [--port <port>]
  phileas claude [-- arguments for claude]
  phileas --version

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
  The run prints through the engine's reporter: each Route's ending, what a
  failed check saw, and a summary last. A --reporter after -- replaces it.

show: print a finished run, one line per Hop.
  what      A run folder, a seed's folder or a journals folder (its latest run),
            one journal file, or a seed's name under ${DEFAULT_JOURNALS}/.
            Defaults to the latest run under ${DEFAULT_JOURNALS}/.
  --json    Print the run as one object instead: each Route's outcome, failed
            checks, findings and replays, read as the reporter reads them.

survey: print what the engine sees when the application starts, one line per
  candidate, each in the form a Fix's act step takes. Then, if there is a Fix, run
  it, printing each step, and print what the engine sees after it, where the
  Trip would begin. Nothing travels and no journal is written.
  config    As for run. Defaults to ${DEFAULT_CONFIG}/.

known add: mark a known finding as filed. A Journey adds each finding it
  meets to the known findings, unfiled, when it ends, and prints its id.
  id        The finding's id, or enough of its start to name one.
  --issue   Where it was filed, such as ronplusron/phileas#44.
  file      The known findings. Defaults to ${DEFAULT_KNOWN}, or to
            known-findings.json here when run from inside phileas/.

known dismiss: mark a known finding a false alarm: Routes keep carrying past
  it, a Journey's summary counts it apart from bugs, and it is never added
  back. A filed finding is refused.
  id        As for add.
  --reason  Why it is not a bug.
  file      As for add.

known remove: take a known finding out, so the next time it is seen it is
  reported as new: for a bug since fixed, a finding the engine itself caused,
  or one left by a deliberate test.
  id        As for add.
  file      As for add.

replay: replay one Route from its journal, acting on each recorded target by
  name in place of drawing, so a changed application or another machine does
  not send it elsewhere. It runs the Route's Journey with the journal's seed
  and Route, and says whether the finding came back.
  journal   One Route's journal file.
  config    As for run. Defaults to ${DEFAULT_CONFIG}/.
  --whole   Replay every recorded Hop, not only to the finding and 3 after.
  --with-current-fix
            Run the current Fix's code steps, checked against those recorded,
            for a Fix with code steps, which a journal cannot hold.
  --follow  As for run: print each Hop as it happens.

known list: print every known finding: unfiled, filed and false alarms, each
  with when it was last met in the journals kept beside the file.
  file      As for add.

reproduce: replay, one at a time, one Route for each finding of a run not yet
  known and not yet replayed, then say what each replay showed.
  what      As for show.
  --config  As for run. Defaults to ${DEFAULT_CONFIG}/.
  --with-current-fix
            As for replay.

triage: hand a run to Claude Code, which writes a report of it and a draft
  issue for each new finding into the run's triage/ folder. Nothing is filed.
  It sends the run's summary and journals to Anthropic, so it says what it
  would send and stops unless --send is given.
  what      As for show.
  --config  The Journey's folder, where filing.json says where findings are
            filed. Defaults to ${DEFAULT_CONFIG}/.
  --send    Send them.
  --model   The model Claude Code uses, as its --model takes it.
  --budget  The most to spend, in US dollars, as its --max-budget-usd.
            Defaults to ${DEFAULT_BUDGET_USD}.

unattended: run a Journey, reproduce what it found, then triage it, for a
  schedule. Without --send it stops before the triage and says so.
  config, run flags   As for run.
  --send, --model, --budget   As for triage.

view: serve a page for working with Journeys on this machine, at an address
  holding a token that every request must carry.
  config    As for run. Defaults to ${DEFAULT_CONFIG}/.
  --port    The port, 0 for any free one. Defaults to 0.

claude: start Claude Code with the engine's skills loaded: booking and running
  a Journey, triaging a run, reproducing a finding and filing one.`;

/**
 * @param {string} message
 * @returns {never}
 */
function refuse(message) {
  console.error(`phileas: ${message}\n\n${USAGE}`);
  process.exit(2);
}

/**
 * Refuse with the reason alone, for a command that was understood and names
 * a file or folder that is not there. The usage text after it buried the one
 * line that said what was missing: reported on 2026-10-03 by the session
 * building Bobolink Inbox's adapter, as `known dismiss` printing "the general
 * usage text" and changing nothing.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`phileas: ${message}`);
  process.exit(2);
}

/**
 * The known findings a `known` command reads: the one named, or by default
 * `phileas/known-findings.json`, or `known-findings.json` in the folder the
 * command runs from where only that one exists, since that folder is then the
 * consumer's `phileas/` itself. Reported on 2026-10-03 from inside Bobolink
 * Inbox's `phileas/`, where the default could not be found.
 * @param {string} file
 * @param {string} [dir]
 * @returns {string}
 */
export function knownFileIn(file, dir = process.cwd()) {
  if (file !== DEFAULT_KNOWN || fs.existsSync(path.join(dir, DEFAULT_KNOWN))) return file;
  return fs.existsSync(path.join(dir, path.basename(DEFAULT_KNOWN))) ? path.basename(DEFAULT_KNOWN) : file;
}

/**
 * @typedef {{ command: 'help' }
 *   | { command: 'version' }
 *   | { command: 'run', config: string, settings: Record<string, string>, passThrough: string[] }
 *   | { command: 'show', what: string | undefined, json: boolean }
 *   | { command: 'reproduce', what: string | undefined, config: string, withCurrentFix: boolean }
 *   | { command: 'triage', what: string | undefined, config: string, send: boolean, model?: string, budget?: string }
 *   | { command: 'unattended', config: string, settings: Record<string, string>, passThrough: string[], send: boolean, model?: string, budget?: string }
 *   | { command: 'view', config: string, port: number }
 *   | { command: 'claude', passThrough: string[] }
 *   | { command: 'survey', config: string }
 *   | { command: 'known-add', id: string, issue: string, file: string }
 *   | { command: 'known-dismiss', id: string, reason: string, file: string }
 *   | { command: 'known-remove', id: string, file: string }
 *   | { command: 'known-list', file: string }
 *   | { command: 'replay', journal: string, config: string, whole: boolean, withCurrentFix: boolean, follow: boolean }} Parsed
 */

/**
 * A command's own arguments, read against the flags it takes: those taking a
 * value, as `--name value` or `--name=value`, and those taking none. Anything
 * else starting with - is refused, and the rest are positional, in order.
 * @param {string} command
 * @param {string[]} args
 * @param {{ values?: string[], switches?: string[] }} takes
 * @returns {{ positional: string[], values: Record<string, string>, switches: Set<string> }}
 */
function readFlags(command, args, { values = [], switches = [] }) {
  /** @type {string[]} */
  const positional = [];
  /** @type {Record<string, string>} */
  const found = {};
  /** @type {Set<string>} */
  const on = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const arg = /** @type {string} */ (args[i]);
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }
    const [flag = '', inline] = arg.split(/=(.*)/s);
    if (switches.includes(flag)) {
      if (inline !== undefined) throw new Error(`${flag} takes no value`);
      if (on.has(flag)) throw new Error(`${flag} was given twice`);
      on.add(flag);
    } else if (values.includes(flag)) {
      if (flag in found) throw new Error(`${flag} was given twice`);
      const value = inline ?? args[(i += 1)];
      if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      found[flag] = value;
    } else {
      const takes = [...values, ...switches];
      throw new Error(`${command} takes ${takes.length ? takes.join(', ') : 'no flags'}, and was given ${flag}`);
    }
  }
  return { positional, values: found, switches: on };
}

/**
 * A port as the page takes it: a whole number from 0, which means any free
 * one, to 65535.
 * @param {string | undefined} text
 * @returns {number}
 */
function portOf(text) {
  if (text === undefined) return 0;
  const port = Number(text);
  if (!/^\d+$/.test(text) || port > 65535) throw new Error(`--port takes a port from 0 to 65535, and was given ${text}`);
  return port;
}

/**
 * A spending limit as Claude Code takes it: a positive number of dollars.
 * @param {string | undefined} text
 * @returns {string | undefined}
 */
function budgetOf(text) {
  if (text === undefined) return undefined;
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) <= 0) throw new Error(`--budget takes a number of US dollars, and was given ${text}`);
  return text;
}

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
  if (command === '--version') {
    if (rest.length) throw new Error(`--version takes nothing, and was given ${rest.join(' ')}`);
    return { command: 'version' };
  }
  if (command === 'claude') {
    // Everything for claude comes after --, so a flag of its own is never
    // read as one of this command's.
    const separator = rest.indexOf('--');
    const own = separator === -1 ? rest : rest.slice(0, separator);
    if (own.length) throw new Error(`claude takes its own arguments after --, and was given ${own.join(' ')}`);
    return { command: 'claude', passThrough: separator === -1 ? [] : rest.slice(separator + 1) };
  }
  if (command === 'show') {
    const { positional, switches } = readFlags('show', rest, { switches: ['--json'] });
    if (positional.length > 1) throw new Error(`show takes one thing to show, and was given ${positional.length}`);
    return { command: 'show', what: positional[0], json: switches.has('--json') };
  }
  if (command === 'reproduce') {
    const { positional, values, switches } = readFlags('reproduce', rest, { values: ['--config'], switches: ['--with-current-fix'] });
    if (positional.length > 1) throw new Error(`reproduce takes one run, and was given ${positional.length}`);
    return {
      command: 'reproduce',
      what: positional[0],
      config: values['--config'] ?? DEFAULT_CONFIG,
      withCurrentFix: switches.has('--with-current-fix'),
    };
  }
  if (command === 'triage') {
    const { positional, values, switches } = readFlags('triage', rest, { values: ['--config', '--model', '--budget'], switches: ['--send'] });
    if (positional.length > 1) throw new Error(`triage takes one run, and was given ${positional.length}`);
    const budget = budgetOf(values['--budget']);
    return {
      command: 'triage',
      what: positional[0],
      config: values['--config'] ?? DEFAULT_CONFIG,
      send: switches.has('--send'),
      ...(values['--model'] ? { model: values['--model'] } : {}),
      ...(budget ? { budget } : {}),
    };
  }
  if (command === 'view') {
    const { positional, values } = readFlags('view', rest, { values: ['--port'] });
    if (positional.length > 1) throw new Error(`view takes one config, and was given ${positional.length}`);
    return { command: 'view', config: positional[0] ?? DEFAULT_CONFIG, port: portOf(values['--port']) };
  }
  if (command === 'unattended') {
    // A Journey's flags as run reads them, with triage's taken out first.
    const separator = rest.indexOf('--');
    const own = separator === -1 ? rest : rest.slice(0, separator);
    /** @type {string[]} */
    const forRun = [];
    /** @type {Record<string, string>} */
    const triage = {};
    let send = false;
    for (let i = 0; i < own.length; i += 1) {
      const arg = /** @type {string} */ (own[i]);
      const [flag = '', inline] = arg.split(/=(.*)/s);
      if (flag === '--send') {
        if (inline !== undefined) throw new Error('--send takes no value');
        send = true;
      } else if (flag === '--model' || flag === '--budget') {
        const value = inline ?? own[(i += 1)];
        if (value === undefined || value === '' || value.startsWith('--')) throw new Error(`${flag} needs a value`);
        triage[flag] = value;
      } else forRun.push(arg);
    }
    const run = parse(['run', ...forRun, ...(separator === -1 ? [] : rest.slice(separator))]);
    if (run.command !== 'run') throw new Error('unattended could not read its Journey flags');
    const budget = budgetOf(triage['--budget']);
    return {
      command: 'unattended',
      config: run.config,
      settings: run.settings,
      passThrough: run.passThrough,
      send,
      ...(triage['--model'] ? { model: triage['--model'] } : {}),
      ...(budget ? { budget } : {}),
    };
  }
  if (command === 'survey') {
    if (rest.length > 1) throw new Error(`survey takes one config, and was given ${rest.length}`);
    const [config] = rest;
    if (config?.startsWith('-')) throw new Error(`survey takes no flags, and was given ${config}`);
    return { command: 'survey', config: config ?? DEFAULT_CONFIG };
  }
  if (command === 'replay') {
    const flags = rest.filter((arg) => arg.startsWith('-'));
    const unknown = flags.find((flag) => !['--whole', '--with-current-fix', '--follow'].includes(flag));
    if (unknown) throw new Error(`replay takes --whole, --with-current-fix and --follow, and was given ${unknown}`);
    const [journal, config, ...more] = rest.filter((arg) => !arg.startsWith('-'));
    if (!journal) throw new Error('replay needs the journal of the Route to replay');
    if (more.length) throw new Error(`replay takes a journal and a config, and was given ${more.join(' ')} as well`);
    return {
      command: 'replay',
      journal,
      config: config ?? DEFAULT_CONFIG,
      whole: flags.includes('--whole'),
      withCurrentFix: flags.includes('--with-current-fix'),
      follow: flags.includes('--follow'),
    };
  }
  if (command === 'known') {
    const [sub, ...args] = rest;
    if (sub === 'list') {
      if (args.length > 1) throw new Error(`known list takes one file, and was given ${args.length}`);
      const [file] = args;
      if (file?.startsWith('-')) throw new Error(`known list takes no flags, and was given ${file}`);
      return { command: 'known-list', file: file ?? DEFAULT_KNOWN };
    }
    if (sub !== 'add' && sub !== 'dismiss' && sub !== 'remove') {
      throw new Error(`known takes add, dismiss, remove or list, and was given ${sub ?? 'nothing'}`);
    }
    // The one flag each takes: add its issue, dismiss its reason, remove none.
    const flag = sub === 'add' ? '--issue' : sub === 'dismiss' ? '--reason' : undefined;
    /** @type {string | undefined} */ let id;
    /** @type {string | undefined} */ let value;
    /** @type {string | undefined} */ let file;
    for (let i = 0; i < args.length; i += 1) {
      const arg = /** @type {string} */ (args[i]);
      if (flag && (arg === flag || arg.startsWith(`${flag}=`))) {
        if (value !== undefined) throw new Error(`${flag} was given twice`);
        value = arg.includes('=') ? arg.slice(`${flag}=`.length) : args[(i += 1)];
        if (!value || value.startsWith('-')) throw new Error(`${flag} needs a value`);
      } else if (arg.startsWith('-')) {
        throw new Error(`unknown flag ${arg}`);
      } else if (id === undefined) id = arg;
      else if (file === undefined) file = arg;
      else throw new Error(`known ${sub} takes an id and a file, and was given ${arg} as well`);
    }
    if (!id) throw new Error(`known ${sub} needs the id of a finding`);
    if (sub === 'add') {
      if (!value) throw new Error('known add needs --issue, saying where the finding was filed');
      return { command: 'known-add', id, issue: value, file: file ?? DEFAULT_KNOWN };
    }
    if (sub === 'dismiss') {
      if (!value) throw new Error('known dismiss needs --reason, saying why it is not a bug');
      return { command: 'known-dismiss', id, reason: value, file: file ?? DEFAULT_KNOWN };
    }
    return { command: 'known-remove', id, file: file ?? DEFAULT_KNOWN };
  }
  if (command !== 'run') {
    throw new Error(
      command
        ? `unknown command ${command}; the commands are run, show, survey, known, replay, reproduce, triage, unattended, view and claude`
        : 'no command given'
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
 * Whether Playwright's own arguments name a reporter, which then replaces the
 * engine's, and the run prints as it did before the engine had one.
 * @param {string[]} passThrough
 * @returns {boolean}
 */
export function ownReporter(passThrough) {
  return passThrough.some((arg) => arg === '--reporter' || arg.startsWith('--reporter='));
}

/**
 * Playwright's arguments, with the engine's reporter unless they name one.
 * @param {string[]} passThrough
 * @returns {string[]}
 */
export function runReporter(passThrough) {
  return ownReporter(passThrough) ? passThrough : [`--reporter=${REPORTER}`, ...passThrough];
}

/**
 * Start Playwright on a config, and settle with how it ended. Refuses, by
 * throwing, a config that is not there or that cannot reach Playwright.
 * @param {string} config
 * @param {Record<string, string>} settings
 * @param {string[]} passThrough
 * @param {{ reporter?: boolean }} [options] false for a survey, which judges
 *   nothing and keeps the config's own reporter
 * @returns {Promise<{ code: number | null, signal: NodeJS.Signals | null }>}
 */
export function startPlaywright(config, settings, passThrough, { reporter = true } = {}) {
  if (!fs.existsSync(config)) {
    throw new Error(
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
    throw new Error(`@playwright/test is not installed where ${config} can reach it`);
  }

  const engineReports = reporter && !ownReporter(passThrough);
  const child = spawn(process.execPath, [cli, 'test', '-c', config, ...(engineReports ? runReporter(passThrough) : passThrough)], {
    stdio: 'inherit',
    // Set either way, so one left in the shell never says the reporter is
    // printing a run it is not.
    env: { ...process.env, ...settings, [REPORTER_VARIABLE]: engineReports ? '1' : '0' },
  });
  // Ctrl-C reaches the whole process group, so Playwright stops on its own;
  // this only has to report how it ended.
  const waitForPlaywright = () => {};
  process.on('SIGINT', waitForPlaywright);
  return new Promise((resolve) => {
    child.on('close', (code, signal) => {
      process.off('SIGINT', waitForPlaywright);
      resolve({ code, signal });
    });
  });
}

/**
 * Run Playwright and leave as it left.
 * @param {string} config
 * @param {Record<string, string>} settings
 * @param {string[]} passThrough
 * @param {{ reporter?: boolean }} [options]
 */
async function run(config, settings, passThrough, options) {
  /** @type {{ code: number | null, signal: NodeJS.Signals | null }} */
  let ended;
  try {
    ended = await startPlaywright(config, settings, passThrough, options);
  } catch (error) {
    fail(/** @type {Error} */ (error).message);
  }
  if (ended.signal) process.kill(process.pid, ended.signal);
  else process.exit(ended.code ?? 1);
}

/**
 * The folder a config's journals are kept in: `.phileas-journals` beside its
 * Playwright config, which is where every consumer here writes them.
 * @param {string} config
 * @returns {string}
 */
export function journalsOf(config) {
  return path.join(folderOf(config), '.phileas-journals');
}

/**
 * The folder a config lives in, which holds its known findings and filing.json.
 * @param {string} config
 * @returns {string}
 */
function folderOf(config) {
  return fs.existsSync(config) && fs.statSync(config).isFile() ? path.dirname(config) : config;
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

/** The Route journals in a folder, in Route order. */
const journalsIn = journalsInFolder;

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
 * @param {string} [root] where a seed's name is looked for, and what is shown
 *   when nothing is named
 * @returns {{ from: string, files: string[] }}
 */
export function journalsFor(what, root = DEFAULT_JOURNALS) {
  const target = what ?? root;
  if (!fs.existsSync(target)) {
    if (what !== undefined && !what.includes(path.sep) && fs.existsSync(path.join(root, what))) {
      return journalsFor(path.join(root, what), root);
    }
    throw new Error(
      what === undefined
        ? `there is no ${root}/ folder here; name a run folder, or a seed's folder`
        : `${what} is neither a folder nor a seed under ${root}/`
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

/**
 * What replaying one Route from its journal runs: its Journey with the
 * journal's seed and Route, and the variables a Route reads its replay from.
 * Whether each Fix step can be replayed is checked by the engine before
 * anything launches. Refuses, by throwing, a file that names no Route.
 * @param {{ journal: string, whole: boolean, withCurrentFix: boolean, follow: boolean }} asked
 * @returns {{ settings: Record<string, string>, passThrough: string[] }}
 */
export function replayRun({ journal, whole, withCurrentFix, follow }) {
  if (!fs.existsSync(journal) || !fs.statSync(journal).isFile()) throw new Error(`${journal} is not a journal file`);
  /** @type {{ journeySeed?: string, routeNumber?: number, tripLength?: number, fix?: { name?: string } } | undefined} */
  let opening;
  for (const line of fs.readFileSync(journal, 'utf8').split('\n')) {
    try {
      const entry = JSON.parse(line);
      if (entry.kind === 'route') {
        opening = entry;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!opening?.journeySeed || !opening.routeNumber) throw new Error(`${journal} has no opening line, so it names no Route to replay`);
  if (withCurrentFix && opening.fix && !opening.fix.name) {
    throw new Error(`${journal} recorded a Fix with no name, so there is no current Fix to run in its place`);
  }
  const route = opening.routeNumber;
  return {
    settings: {
      PHILEAS_SEED: opening.journeySeed,
      PHILEAS_ROUTES: String(route),
      PHILEAS_TRIP_LENGTH: String(opening.tripLength ?? 1),
      PHILEAS_FIX: withCurrentFix && opening.fix?.name ? opening.fix.name : 'none',
      PHILEAS_REPLAY: path.resolve(journal),
      ...(whole ? { PHILEAS_REPLAY_WHOLE: '1' } : {}),
      ...(withCurrentFix ? { PHILEAS_REPLAY_CURRENT_FIX: '1' } : {}),
      ...(follow ? { PHILEAS_FOLLOW: '1' } : {}),
    },
    passThrough: route > 1 ? ['--grep', `route ${route}$`] : [],
  };
}

/**
 * Replay one Route from its journal.
 * @param {{ journal: string, config: string, whole: boolean, withCurrentFix: boolean, follow: boolean }} asked
 */
function replay(asked) {
  /** @type {ReturnType<typeof replayRun>} */
  let replaying;
  try {
    replaying = replayRun(asked);
  } catch (error) {
    fail(/** @type {Error} */ (error).message);
  }
  run(asked.config, replaying.settings, replaying.passThrough);
}

/**
 * @param {string | undefined} what
 * @param {boolean} [json] the run as one object rather than one line per Hop
 */
function show(what, json = false) {
  /** @type {{ from: string, files: string[] }} */
  let found;
  try {
    found = journalsFor(what);
  } catch (error) {
    // Every way this fails names what is not there, so the reason stands alone.
    fail(/** @type {Error} */ (error).message);
  }
  if (json) {
    const isFile = fs.statSync(found.from).isFile();
    console.log(JSON.stringify(isFile ? summarizeRoute(found.from) : summarizeRun(found.from), null, 2));
    return;
  }
  console.log(`Journals in ${found.from}\n`);
  for (const file of found.files) {
    for (const line of renderJournal(fs.readFileSync(file, 'utf8'))) console.log(line);
    console.log('');
  }
}

/**
 * The run folder a command after the run works on: the one named, or the
 * latest under the config's journals. A single journal is refused, since
 * these work on a whole run.
 * @param {string | undefined} what
 * @param {string} config
 * @returns {string}
 */
function runFolderFor(what, config) {
  /** @type {{ from: string, files: string[] }} */
  let found;
  try {
    found = journalsFor(what, journalsOf(config));
  } catch (error) {
    fail(/** @type {Error} */ (error).message);
  }
  if (fs.statSync(found.from).isFile()) fail(`${found.from} is one journal; name the run folder it is in`);
  return found.from;
}

/**
 * The Routes of a run to replay: for each finding not known when the run was
 * made, and neither filed nor dismissed since, the first Route that ended on
 * it, unless a Route that ended on it has been replayed already. One per finding, since a batch of hundreds often meets one finding
 * on dozens of Routes, and each replay launches the application.
 * @param {import('../src/report/summary.mjs').RunSummary} summary
 */
export function toReproduce(summary) {
  // A finding filed or dismissed since the run needs no replay to decide it.
  const settled = new Set(
    summary.newFindings.filter((finding) => finding.now.standing === 'filed' || finding.now.standing === 'false alarm').map((finding) => finding.id)
  );
  const ended = summary.routes
    .map((route) => ({ ...route, newFindings: route.newFindings.filter((id) => !settled.has(id)) }))
    .filter((route) => route.outcome !== 'passed' && route.newFindings.length);
  const covered = new Set(ended.filter((route) => route.replayedBy.length).flatMap((route) => route.newFindings));
  /** @type {typeof ended} */
  const chosen = [];
  for (const route of ended) {
    if (route.newFindings.every((id) => covered.has(id))) continue;
    chosen.push(route);
    for (const id of route.newFindings) covered.add(id);
  }
  return chosen;
}

/**
 * Replay, one at a time, every Route of a run that failed on a new finding,
 * then say what each replay showed. Replaying is code, not the assistant, so
 * the verdict stays the engine's.
 * @param {string} folder
 * @param {string} config
 * @param {boolean} withCurrentFix
 */
async function reproduceRun(folder, config, withCurrentFix) {
  const pending = toReproduce(summarizeRun(folder));
  if (!pending.length) {
    console.log(`Nothing to reproduce in ${folder}: no Route ended on a new finding that has not been replayed.`);
    return;
  }
  console.log(`Replaying ${pending.length} Route(s) of ${folder}, one at a time.`);
  for (const route of pending) {
    console.log(`\nReplaying route ${route.routeNumber}, for finding ${route.newFindings.join(', ')}`);
    try {
      const { settings, passThrough } = replayRun({ journal: route.journal, whole: false, withCurrentFix, follow: false });
      await startPlaywright(config, settings, passThrough);
    } catch (error) {
      console.log(`route ${route.routeNumber} could not be replayed: ${/** @type {Error} */ (error).message}`);
    }
  }
  const after = summarizeRun(folder);
  console.log(`\nWhat each replay showed, in ${folder}:`);
  for (const route of pending) {
    const now = after.routes.find((each) => each.journal === route.journal);
    const verdict = now?.replayedBy.at(-1)?.verdict ?? 'no replay was recorded';
    console.log(`  route ${route.routeNumber}  ${route.newFindings.join(', ')}  ${verdict}`);
  }
}

/**
 * Hand a run to the assistant, once the person or the schedule has said to
 * send it. Without that, says what would be sent and stops.
 * @param {string} folder
 * @param {string} config
 * @param {{ send: boolean, model?: string, budget?: string }} options
 * @returns {Promise<boolean>} whether it ended as asked: a triage written, or
 *   none needed
 */
async function triageRun(folder, config, { send, model, budget }) {
  // Nothing to sort when everything passed, so nothing is sent to sort it.
  if (summarizeRun(folder).routes.every((route) => route.outcome === 'passed')) {
    console.log(`Every Route in ${folder} passed, so there is nothing to triage, and nothing was sent.`);
    return true;
  }
  const prepared = prepareTriage(folder, folderOf(config));
  console.log(sendNotice(prepared, budget));
  if (!send) {
    console.log('Nothing was sent. Give --send to send them.');
    return false;
  }
  try {
    const result = await runTriage(prepared, { model, budget });
    const written = writeTriage(prepared, result);
    console.log(`Triage written: ${written.report}`);
    if (result.costUsd !== undefined) console.log(`  cost   $${result.costUsd.toFixed(2)}`);
    for (const refused of result.refused) console.log(`  refused, outside the run: ${refused}`);
    for (const draft of written.drafts) console.log(`  draft  ${draft}`);
    if (!written.drafts.length) console.log('  no drafts: nothing in this run was judged worth filing');
    return true;
  } catch (error) {
    console.error(`phileas: the triage did not finish: ${/** @type {Error} */ (error).message}`);
    return false;
  }
}

/**
 * A Journey, then a replay of each new finding, then a triage, for a schedule.
 * Leaves as the Journey left, so a schedule sees what the run found, and never
 * as a triage left, which says nothing about the application.
 * @param {Extract<Parsed, { command: 'unattended' }>} asked
 */
async function unattended(asked) {
  const root = journalsOf(asked.config);
  const before = new Set(listRuns(root).map((each) => each.folder));
  /** @type {{ code: number | null, signal: NodeJS.Signals | null }} */
  let ended;
  try {
    ended = await startPlaywright(asked.config, asked.settings, asked.passThrough);
  } catch (error) {
    fail(/** @type {Error} */ (error).message);
  }
  if (ended.signal) process.kill(process.pid, ended.signal);
  const runs = listRuns(root).filter((each) => !before.has(each.folder));
  if (!runs.length) {
    console.error(`phileas: the Journey wrote no journals under ${root}, so there is nothing to reproduce or triage.`);
    process.exit(ended.code || 1);
  }
  for (const each of runs) {
    await reproduceRun(each.folder, asked.config, false);
    console.log('');
    await triageRun(each.folder, asked.config, asked);
  }
  process.exit(ended.code ?? 1);
}

/**
 * Claude Code, with the engine's plugin loaded for this session only.
 * @param {string[]} passThrough
 */
function claude(passThrough) {
  const child = spawn('claude', ['--plugin-dir', PLUGIN_DIR, ...passThrough], { stdio: 'inherit' });
  child.on('error', (error) => {
    fail(
      /** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT'
        ? 'Claude Code is not installed: there is no claude command to start'
        : error.message
    );
  });
  child.on('close', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

/**
 * @param {string} id
 * @param {string} issue
 * @param {string} file
 */
function knownAdd(id, issue, file) {
  if (!fs.existsSync(file)) {
    fail(`there is no ${file}; a Journey writes it when it ends, or give the file`);
  }
  try {
    const filed = markFiled(file, id, issue);
    console.log(`${filed.id} is filed as ${issue}: ${filed.signature}`);
  } catch (error) {
    console.error(`phileas: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
}

/**
 * Dismiss or remove a known finding, saying what was done.
 * @param {'dismiss' | 'remove'} action
 * @param {string} id
 * @param {string} file
 * @param {string} [reason]
 */
function knownChange(action, id, file, reason) {
  if (!fs.existsSync(file)) {
    fail(`there is no ${file}; a Journey writes it when it ends, or give the file`);
  }
  try {
    if (action === 'dismiss') {
      const dismissed = dismissFinding(file, id, reason ?? '');
      console.log(`${dismissed.id} is marked a false alarm (${dismissed.falseAlarm}): ${dismissed.signature}`);
    } else {
      const removed = removeFinding(file, id);
      console.log(`${removed.id} is removed, and will be reported as new if it is seen again: ${removed.signature}`);
    }
  } catch (error) {
    console.error(`phileas: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
}

/** @param {string} file */
function knownList(file) {
  if (!fs.existsSync(file)) {
    fail(`there is no ${file}; a Journey writes it when it ends, or give the file`);
  }
  try {
    for (const line of listKnownFindings(file, journalsBeside(file))) console.log(line);
  } catch (error) {
    console.error(`phileas: ${/** @type {Error} */ (error).message}`);
    process.exit(2);
  }
}

/**
 * The engine's version, from its own package.json beside this command, so a
 * journal or a finding can be matched to the engine that made it.
 * @returns {string}
 */
export function version() {
  return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
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
  else if (parsed.command === 'version') console.log(`phileas ${version()}`);
  else if (parsed.command === 'show') show(parsed.what, parsed.json);
  // One Route is enough to see the start, since every Route starts the same way.
  else if (parsed.command === 'survey') run(parsed.config, { PHILEAS_SURVEY: '1', PHILEAS_ROUTES: '1' }, [], { reporter: false });
  else if (parsed.command === 'known-add') knownAdd(parsed.id, parsed.issue, knownFileIn(parsed.file));
  else if (parsed.command === 'known-dismiss') knownChange('dismiss', parsed.id, knownFileIn(parsed.file), parsed.reason);
  else if (parsed.command === 'known-remove') knownChange('remove', parsed.id, knownFileIn(parsed.file));
  else if (parsed.command === 'known-list') knownList(knownFileIn(parsed.file));
  else if (parsed.command === 'replay') replay(parsed);
  else if (parsed.command === 'reproduce') reproduceRun(runFolderFor(parsed.what, parsed.config), parsed.config, parsed.withCurrentFix);
  else if (parsed.command === 'triage') {
    triageRun(runFolderFor(parsed.what, parsed.config), parsed.config, parsed).then((written) => process.exit(written ? 0 : 2));
  } else if (parsed.command === 'unattended') unattended(parsed);
  else if (parsed.command === 'view') serve({ config: parsed.config, port: parsed.port, journals: journalsOf(parsed.config), phileas: fileURLToPath(import.meta.url) });
  else if (parsed.command === 'claude') claude(parsed.passThrough);
  else run(parsed.config, parsed.settings, parsed.passThrough);
}

// Run only when invoked, not when a test imports parse. Compared as file
// paths rather than URLs, since a URL percent-encodes the spaces this
// repository's own path contains, and through realpath, since npm installs the
// command as a link.
const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) main();
