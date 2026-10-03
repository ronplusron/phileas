// The engine's own Playwright reporter, which `phileas run` prints through.
//
// Asked for on 2026-10-02, after one Positron Route failed at hop 56 on a new
// finding and the run ended, in the words it was put, looking like "Phileas
// threw and error. In this case, a ton of errors." A failed check reaches
// Playwright as a thrown error, so Playwright reported it as one: the whole
// failure again, a code frame and a stack in the engine, and every
// attachment printed out, last on the screen. And the Journey's own summary
// printed above all that, from its end, before Playwright's report.
//
// So this prints each Route's ending from its journal: what each failed check
// saw, once, the journal and the trace by path, and nothing of a stack unless
// the Route ended on an error in the engine or the setup, which still prints
// in full, so the two stay told apart. Then a summary, last: the Routes by
// outcome, what the Journey's end did to the known findings, and the command
// that runs the Journey again. Part of phase 7's Journey summary, moved
// forward as the journal's renderer was.
//
// Stranded is shown as stranded. Playwright still counts its test as failed,
// since a test has only pass, fail and skip, until phase 5 settles how to show
// it; docs/PLAN.md has that.
//
// Plain JavaScript for the renderer's reason, so `phileas run` can name it
// whether or not the engine is built.

import fs from 'node:fs';
import path from 'node:path';
import { renderJourneyFindings } from '../known.mjs';
import { currentEntry } from '../legacy.mjs';
import { JOURNEY_END, REPORTER_PRESENT, firstSentence, routeLabel, targetText } from './render.mjs';

/** @typedef {import('../journal').JournalEntry} JournalEntry */
/** @typedef {import('../known.mjs').JourneyFindings} JourneyFindings */

/** The annotation runRoute names a Route's journal with, in route.ts. */
const JOURNAL_ANNOTATION = 'phileas-journal';

/**
 * A Route's journal, read for its ending: the opening line, the last Fix step
 * or Hop, and the outcome line where the Route wrote one. A line cut off
 * mid-write, by a Route that died, is skipped.
 * @param {string} file
 * @returns {{ opening?: Extract<JournalEntry, { kind: 'route' }>, last?: Extract<JournalEntry, { kind: 'trip-hop' | 'fix-step' }>, outcome?: Extract<JournalEntry, { kind: 'outcome' }>, hops: number }}
 */
export function readEnding(file) {
  /** @type {ReturnType<typeof readEnding>} */
  const ending = { hops: 0 };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return ending;
  }
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    /** @type {JournalEntry} */
    let entry;
    try {
      entry = currentEntry(JSON.parse(raw));
    } catch {
      continue;
    }
    if (entry.kind === 'route') ending.opening = entry;
    else if (entry.kind === 'trip-hop' || entry.kind === 'fix-step') {
      ending.last = entry;
      if (entry.kind === 'trip-hop') ending.hops = entry.hop;
    } else if (entry.kind === 'outcome') {
      ending.outcome = entry;
      ending.hops = entry.hops;
    }
  }
  return ending;
}

/**
 * A path as a person running from here would type it.
 * @param {string} file
 * @param {string} cwd
 */
function shown(file, cwd) {
  const relative = path.relative(cwd, file);
  return relative && !relative.startsWith('..') ? relative : file;
}

/**
 * Text kept to one line of a width a terminal shows, for an observation that
 * the journal keeps whole.
 * @param {string} text
 * @param {number} limit
 */
function oneLine(text, limit) {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > limit ? `${line.slice(0, limit - 3)}...` : line;
}

/**
 * What a Route that failed on a check saw, one line per failed check, with the
 * finding's id, which `phileas known add` takes.
 * @param {Extract<JournalEntry, { kind: 'trip-hop' | 'fix-step' }>} last
 * @returns {string[]}
 */
function failedCheckLines(last) {
  const failed = last.checks.filter((check) => check.result === 'failed');
  const width = Math.max(...failed.map((check) => check.check.length));
  return failed.map((check) => {
    const ids = [...new Set((check.findings ?? []).filter((finding) => !finding.known).map((finding) => finding.id))];
    return `    ${check.check.padEnd(width)}  ${(ids.join(', ') || '-').padEnd(8)}  ${oneLine(check.observation ?? '', 160)}`;
  });
}

/**
 * One Playwright test, as the reporter is handed it.
 * @typedef {{
 *   title: string,
 *   status: string,
 *   annotations: readonly { type: string, description?: string }[],
 *   errors: readonly { message?: string, stack?: string }[],
 *   attachments: readonly { name: string, path?: string }[],
 * }} RouteResult
 */

/**
 * A Route's ending, as lines. The Route's own line is left out when the run
 * follows each Hop, since the journal printed it as it was written, unless
 * the Route ended without writing one.
 * @param {RouteResult} result
 * @param {{ follow: boolean, cwd: string }} options
 * @returns {{ lines: string[], outcome: 'passed' | 'failed' | 'stranded' | 'skipped' | 'unfinished', routeNumber?: number, hops: number, tripLength?: number, journal?: string }}
 */
export function routeLines(result, { follow, cwd }) {
  const journal = result.annotations.find((note) => note.type === JOURNAL_ANNOTATION)?.description;
  const ending = journal ? readEnding(journal) : { hops: 0 };
  const routeNumber = ending.opening?.routeNumber ?? Number(/route (\d+)/.exec(result.title)?.[1] ?? 0);
  // A test that is not a Route, such as a probe a person runs through the
  // same config, has no number, and is named by its title.
  const route = routeNumber >= 1 ? routeLabel(routeNumber) : `"${result.title}"`;
  const tripLength = ending.opening?.tripLength;
  /** @type {string[]} */
  const lines = [];
  let journalNamed = false;

  if (result.status === 'skipped') {
    const why = result.annotations.find((note) => note.type === 'skip')?.description;
    return { lines: [`${route}  skipped${why ? `: ${why}` : ''}`], outcome: 'skipped', routeNumber, hops: 0, tripLength, journal };
  }

  const outcome = ending.outcome;
  if (!outcome && result.status === 'passed') {
    // Passed with no outcome line: a test that wrote no journal, since a Route
    // that passes always closes one. Said as passed, never as failed, which
    // is what this said before 2026-10-02 of a probe that passed.
    return { lines: [`${route}  passed${journal ? '' : ', with no journal'}`], outcome: 'passed', routeNumber, hops: ending.hops, tripLength, journal };
  }
  if (!outcome) {
    // No outcome line: cut off by its deadline, stopped, or failed before its
    // journal opened. Playwright's error says which, and it is printed whole.
    const how =
      result.status === 'timedOut'
        ? `cut off by its deadline after ${ending.hops} hops`
        : !journal
          ? 'failed before its journal was opened'
          : result.status === 'interrupted'
            ? `stopped after ${ending.hops} hops`
            : `ended after ${ending.hops} hops without finishing its journal`;
    lines.push(`${route}  ${how}`);
    lines.push(...errorLines(result));
  } else {
    if (!follow) {
      const reason = outcome.reason && outcome.outcome === 'failed' ? firstSentence(outcome.reason) : outcome.reason;
      lines.push(`${route}  ${outcome.outcome} after ${outcome.hops} hops${reason ? `: ${reason}` : ''}`);
    }
    if (outcome.outcome === 'failed') {
      const last = ending.last;
      if (last && last.checks.some((check) => check.result === 'failed')) {
        const where =
          last.kind === 'trip-hop' ? `hop ${last.hop}, ${last.action} ${targetText(last.target)}` : `Fix step ${last.step}, ${last.label}`;
        lines.push(`    failed checks after ${where}:`);
        lines.push(...failedCheckLines(last));
        lines.push(`    when each arrived, and the steps before it: phileas show ${quoted(shown(journal ?? '', cwd))}`);
        journalNamed = true;
      } else {
        // Not a check: an error in the engine, the adapter or the setup.
        lines.push(...errorLines(result));
      }
    }
  }

  // Named for a Route that did not pass; the summary names the run's folder
  // once, so a long Journey that passed is not a line per Route longer.
  if (journal && outcome?.outcome !== 'passed' && !journalNamed) lines.push(`    journal  ${shown(journal, cwd)}`);
  if (result.status !== 'passed' && result.status !== 'skipped') lines.push(...attachmentLines(result, cwd));
  /** @type {'passed' | 'failed' | 'stranded' | 'unfinished'} */
  const kind = outcome ? outcome.outcome : 'unfinished';
  return { lines, outcome: kind, routeNumber, hops: ending.hops, tripLength, journal };
}

/** @param {string} text */
function quoted(text) {
  return /\s/.test(text) ? `"${text}"` : text;
}

/**
 * An error printed whole, message and stack, indented under its Route: one
 * that was not a check's finding is a fault somewhere, and a fault is read in
 * full.
 * @param {RouteResult} result
 * @returns {string[]}
 */
function errorLines(result) {
  return result.errors.flatMap((error) => {
    const text = error.stack && error.message && error.stack.includes(error.message) ? error.stack : [error.message, error.stack].filter(Boolean).join('\n');
    return (text ?? '').split('\n').map((line) => `    ${line}`);
  });
}

/**
 * A failed Route's attachments by path: the trace first, which is the one
 * most worth opening, then the rest named in one line.
 * @param {RouteResult} result
 * @param {string} cwd
 * @returns {string[]}
 */
function attachmentLines(result, cwd) {
  const files = result.attachments.filter((attachment) => attachment.path);
  if (!files.length) return [];
  const trace = files.find((attachment) => attachment.name === 'trace');
  const rest = files.filter((attachment) => attachment !== trace);
  /** @type {string[]} */
  const lines = [];
  if (trace?.path) lines.push(`    trace    ${shown(trace.path, cwd)}`);
  if (rest.length) {
    const folder = path.dirname(/** @type {string} */ (rest[0]?.path));
    lines.push(`    also     ${rest.map((attachment) => attachment.name).join(', ')}, in ${shown(folder, cwd)}`);
  }
  return lines;
}

/**
 * The settings `phileas run` was given that change what a rerun travels, as
 * the flags that give them again.
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function rerunFlags(env) {
  /** @type {[string, string][]} */
  const flags = [
    ['PHILEAS_ROUTES', '--routes'],
    ['PHILEAS_TRIP_LENGTH', '--trip-length'],
    ['PHILEAS_FIX', '--fix'],
  ];
  return flags.flatMap(([variable, flag]) => (env[variable] ? [`${flag} ${quoted(env[variable] ?? '')}`] : []));
}

/**
 * The summary printed last: the Routes by outcome, what the Journey's end did
 * to the known findings, any failure at the Journey's end, and the commands
 * to run it again.
 * @param {{
 *   routes: { outcome: string, routeNumber?: number, hops: number, tripLength?: number, journal?: string }[],
 *   journeyEnd?: { findings: JourneyFindings, file: string },
 *   endErrors: readonly { message?: string }[],
 *   config: string,
 *   env: NodeJS.ProcessEnv,
 *   cwd?: string,
 * }} run
 * @returns {string[]}
 */
export function summaryLines({ routes, journeyEnd, endErrors, config, env, cwd = process.cwd() }) {
  const count = (/** @type {string} */ kind) => routes.filter((route) => route.outcome === kind).length;
  const hops = routes.reduce((sum, route) => sum + route.hops, 0);
  const planned = routes.reduce((sum, route) => sum + (route.outcome === 'skipped' ? 0 : route.tripLength ?? 0), 0);
  const parts = [`${count('passed')} passed`, `${count('failed')} failed`, `${count('stranded')} stranded`];
  if (count('unfinished')) parts.push(`${count('unfinished')} did not finish`);
  if (count('skipped')) parts.push(`${count('skipped')} skipped`);
  const seed = env.PHILEAS_SEED;
  /** @type {string[]} */
  const lines = [
    '',
    `Journey ${seed ?? '(no seed)'}${env.PHILEAS_RUN ? `, run ${env.PHILEAS_RUN}` : ''}: ` +
      `${routes.length} Route${routes.length === 1 ? '' : 's'}, ${parts.join(', ')}; ` +
      `${hops}${planned ? ` of ${planned}` : ''} Hops`,
  ];

  const journal = routes.find((route) => route.journal)?.journal;
  if (journal) lines.push(`Journals: ${shown(path.dirname(journal), cwd)}`);

  if (journeyEnd) lines.push(...renderJourneyFindings(journeyEnd.findings, journeyEnd.file));

  if (endErrors.length) {
    lines.push("The Journey's end failed:");
    for (const error of endErrors) {
      lines.push(...(error.message ?? String(error)).split('\n').map((line) => `  ${line}`));
    }
  }

  if (seed) {
    const base = ['phileas run', quoted(config), '--seed', seed, ...rerunFlags(env)].join(' ');
    const first = routes.find((route) => route.outcome !== 'passed' && route.outcome !== 'skipped' && route.routeNumber);
    lines.push(`Run it again: ${base}`);
    if (first?.routeNumber && routes.length > 1) {
      const only = ['phileas run', quoted(config), '--seed', seed, '--routes', String(first.routeNumber)]
        .concat(rerunFlags(env).filter((flag) => !flag.startsWith('--routes')))
        .join(' ');
      // Routes 1 to k run with --routes k, so only a later one needs the rest left out.
      lines.push(`Route ${first.routeNumber} alone: ${only}${first.routeNumber > 1 ? ` -- --grep "route ${first.routeNumber}$"` : ''}`);
    }
  }
  return lines;
}

/** The reporter `phileas run` hands Playwright as its --reporter. */
export default class PhileasReporter {
  constructor() {
    /** @type {ReturnType<typeof routeLines>[]} */
    this.routes = [];
    /** @type {{ message?: string }[]} */
    this.endErrors = [];
    this.config = '';
    this.cwd = process.cwd();
    // Made before the Journey's end runs, in the same process, which then
    // hands its findings here rather than printing them above the summary.
    /** @type {Record<symbol, unknown>} */ (globalThis)[REPORTER_PRESENT] = true;
  }

  printsToStdio() {
    return true;
  }

  /** @param {import('@playwright/test/reporter').FullConfig} config */
  onBegin(config) {
    const file = config.configFile ?? '';
    const folder = /^playwright\.config\.[cm]?[jt]s$/.test(path.basename(file)) ? path.dirname(file) : file;
    this.config = shown(folder, this.cwd) || '.';
  }

  /** @param {string | Buffer} chunk */
  onStdOut(chunk) {
    process.stdout.write(chunk);
  }

  /** @param {string | Buffer} chunk */
  onStdErr(chunk) {
    process.stderr.write(chunk);
  }

  /**
   * @param {import('@playwright/test/reporter').TestCase} test
   * @param {import('@playwright/test/reporter').TestResult} result
   */
  onTestEnd(test, result) {
    const ended = routeLines(
      {
        title: test.title,
        status: result.status,
        annotations: [...test.annotations, ...(result.annotations ?? [])],
        errors: result.errors,
        attachments: result.attachments,
      },
      { follow: process.env.PHILEAS_FOLLOW === '1', cwd: this.cwd }
    );
    this.routes.push(ended);
    for (const line of ended.lines) console.log(line);
  }

  /** @param {import('@playwright/test/reporter').TestError} error */
  onError(error) {
    this.endErrors.push(error);
  }

  onEnd() {
    const journeyEnd = /** @type {{ findings: JourneyFindings, file: string } | undefined} */ (
      /** @type {Record<symbol, unknown>} */ (globalThis)[JOURNEY_END]
    );
    const lines = summaryLines({
      routes: this.routes,
      journeyEnd,
      endErrors: this.endErrors,
      config: this.config,
      env: process.env,
      cwd: this.cwd,
    });
    for (const line of lines) console.log(line);
  }
}

