import { overriddenTerms, requireRun, requireSeed, resolveRun, resolveSeed, SEED_VARIABLE, type Journey } from './journey';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { journalFolder } from './journal';
import { recordJourneyFindings, renderJourneyFindings, type JourneyFindings } from './known.mjs';
import { windowMode } from './launch';
import { allowStaleFromEnvironment } from './bundle';
import { followFromEnvironment, hopDelayFromEnvironment, surveyFromEnvironment } from './route';

/**
 * Settle the seed, name the run, check the run's settings and print them. The
 * one call a consumer's global setup makes, so none of it can be left out.
 *
 * Its own file because it reads settings from three others, one of which
 * already imports `journey.ts`.
 *
 * **The window mode, the hop delay and following are read here, not only where
 * they are used.** Both are otherwise first read after the application has launched, so
 * a mistyped mode got as far as starting Electron before being refused, once per
 * Route. Read here, it is refused before anything launches.
 *
 * **Every setting is printed, and each one set for this run is marked.**
 * Overriding the Route count or the Trip length changes how much of a seed a
 * run covers: which Routes run, and how far each travels. It never changes a
 * Hop any Route takes on the way, since no Route's seed depends on the count
 * and every Hop draws the same whatever the Trip length. Still, a changed run
 * must never be mistaken for the default. The engine prints them rather than the consumer, so that no
 * consumer prints half of them.
 */
export function startJourney(journey: Journey): {
  seed: string;
  run: string;
  settings: string[];
} {
  const seedGiven = Boolean(process.env[SEED_VARIABLE]);
  const seed = resolveSeed(journey.seed);
  const run = resolveRun();
  const mode = windowMode();
  const hopDelayMs = hopDelayFromEnvironment();
  const follow = followFromEnvironment();
  const surveyOnly = surveyFromEnvironment();
  const allowStale = allowStaleFromEnvironment();

  const forThisRun = new Set<string>(overriddenTerms(journey));
  const mark = (term: string) => (forThisRun.has(term) ? 'set for this run' : '');
  const deadline = (ms: number | undefined) => (ms === undefined ? 'none' : `${ms} ms`);

  const rows: [string, string, string][] = [
    [
      'Journey seed',
      seed,
      seedGiven ? 'set for this run' : journey.seed ? 'pinned in the Journey file' : 'generated',
    ],
    ['Run', run, ''],
    ['Routes', String(journey.routes), mark('routes')],
    ['Trip length', String(journey.tripLength), mark('tripLength')],
    ['Route deadline', deadline(journey.routeDeadlineMs), mark('routeDeadlineMs')],
    ['Journey deadline', deadline(journey.journeyDeadlineMs), mark('journeyDeadlineMs')],
    ['Window mode', mode, ''],
    ['Hop delay', hopDelayMs ? `${hopDelayMs} ms` : 'none', ''],
    ['Follow', follow ? 'on' : 'off', ''],
    // Printed, so a PHILEAS_SURVEY left set in the shell is seen at the top of
    // a run that would otherwise travel nowhere.
    // Printed, so a run against a stale build says so where it is read, not
    // only in an attachment that a passing test's report never shows.
    ['Staleness guard', allowStale ? 'OFF: a stale build will run, and findings may describe code nobody runs' : 'on', ''],
    ['Survey only', surveyOnly ? 'on: nothing is traveled, and every Route is skipped' : 'off', ''],
  ];
  const width = Math.max(...rows.map(([name, value]) => `${name}: ${value}`.length));
  const settings = rows.map(([name, value, note]) =>
    note ? `${`${name}: ${value}`.padEnd(width)}   ${note}` : `${name}: ${value}`
  );

  for (const line of settings) console.log(line);
  leftoverCheck = watchTempFolder(
    'Journey',
    'Each is a profile, or another engine folder, that should have been removed. Something in the ' +
      'application may still be writing into it after its Route ended.'
  );
  return { seed, run, settings };
}

/** The variable that skips the leftover check, for a Journey and for `npm test` alike. */
export const ALLOW_TEMP_LEFTOVERS_VARIABLE = 'PHILEAS_ALLOW_TEMP_LEFTOVERS';

/** The engine's folders in the system temp folder: every Route's profile is one. */
function phileasFolders(): Set<string> {
  return new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('phileas-')));
}

/**
 * Note the engine's folders in the system temp folder now, and return the
 * check that fails, naming each one, on a folder that appeared since and is
 * still there. Names are compared rather than counts, so folders from earlier
 * runs do not count. `PHILEAS_ALLOW_TEMP_LEFTOVERS=1` skips the check, and it
 * says what was left.
 *
 * One check for a Journey's end and for the engine's own suite, so the two
 * cannot drift apart. `what` names the run in the message, and `hint` says
 * what most likely left a folder there. Another run making `phileas-` folders
 * at the same time shows up too, and the message says so.
 */
export function watchTempFolder(what: string, hint: string): () => void {
  const before = phileasFolders();
  return () => {
    const left = [...phileasFolders()].filter((name) => !before.has(name)).sort();
    if (left.length === 0) return;

    const listing = left.map((name) => `  ${name}`).join('\n');
    if (process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE] === '1') {
      console.warn(
        `${ALLOW_TEMP_LEFTOVERS_VARIABLE}=1, so the leftover check is skipped. This ${what} left ` +
          `${left.length} folder(s) in ${os.tmpdir()}:\n${listing}`
      );
      return;
    }
    throw new Error(
      `This ${what} left ${left.length} folder(s) in ${os.tmpdir()}:\n${listing}\n\n${hint} ` +
        `If another run was making phileas-* folders at the same time, ` +
        `set ${ALLOW_TEMP_LEFTOVERS_VARIABLE}=1 to skip this check.`
    );
  };
}

/**
 * Run every check, then fail once with every failure. For the end of a
 * Journey, where one check throwing would otherwise stop the rest from
 * running, and a guard that never ran reads exactly like one that passed.
 */
export function runEveryCheck(checks: readonly (() => void)[]): void {
  const failures: unknown[] = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    const messages = failures.map((failure) => (failure instanceof Error ? failure.message : String(failure)));
    throw new Error(`${failures.length} checks failed at the end of the Journey:\n\n${messages.join('\n\n')}`);
  }
}

/**
 * The leftover check `startJourney` set up, for `finishJourney` to run. Global
 * setup and what it returns run in the same process, so this is shared
 * between the two.
 */
let leftoverCheck: (() => void) | undefined;

/**
 * End a Journey: add what it found to the known findings, say what was seen,
 * what is still unfiled and what was not seen, and fail the run if it left a
 * profile folder behind. For a consumer's global setup to return, so that
 * Playwright runs it once every Route has ended, whether they passed or not.
 * Both parts run even when the other fails.
 *
 * The known findings are written here and nowhere else, so that every Route
 * of a Journey read the same ones. A Route that carried on past a bug only
 * because an earlier Route in the same Journey had found it would end
 * differently replayed alone, which is the dependence between Routes the
 * design rules out.
 *
 * **The leftover check is the other half of deleting profiles.** A helper
 * that writes into a profile later than the engine watches for recreates it,
 * measured on Positron on 2026-09-27, and nothing looked at the temp folder
 * after a Journey. So any `phileas-` folder that appeared during the Journey
 * and is still there fails the run, by name, unless
 * `PHILEAS_ALLOW_TEMP_LEFTOVERS=1`, which is announced.
 */
export function finishJourney(options: { journalsRoot?: string; knownFindings?: string } = {}): JourneyFindings | undefined {
  let findings: JourneyFindings | undefined;
  const recordFindings = () => {
    if (options.knownFindings === undefined) return;
    // A survey travels nowhere and writes no journal, so reading one would
    // report every known finding as not seen, "possibly fixed".
    if (surveyFromEnvironment()) return;
    if (options.journalsRoot === undefined) {
      throw new Error('finishJourney needs journalsRoot to read what the Journey found for its known findings.');
    }
    const run = journalFolder(options.journalsRoot, requireSeed(), requireRun());
    findings = recordJourneyFindings(run, options.knownFindings);
    console.log('');
    // Named from where the run was started, so a summary names no home folder.
    const shown = path.relative(process.cwd(), options.knownFindings) || options.knownFindings;
    for (const line of renderJourneyFindings(findings, shown)) console.log(line);
  };
  const checkLeftovers = () => {
    if (leftoverCheck === undefined) {
      throw new Error('finishJourney was called without startJourney, so what the Journey left behind cannot be told.');
    }
    leftoverCheck();
  };
  runEveryCheck([recordFindings, checkLeftovers]);
  return findings;
}
