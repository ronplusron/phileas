import { overriddenInBooking, requireRun, requireSeed, resolveRun, resolveSeed, SEED_VARIABLE, type Journey } from './journey.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { journalFolder } from './journal.js';
import { recordJourneyFindings, renderJourneyFindings, type JourneyFindings } from './known.mjs';
import { JOURNEY_END, reporterPresent } from './report/render.mjs';
import { folderName, TEMP_FOLDER_VARIABLE, windowMode } from './launch.js';
import type { AppUnderTest } from './app-under-test.js';
import { fixFor, type Fixes } from './fixes.js';
import { allowStaleFromEnvironment } from './bundle.js';
import { followFromEnvironment, hopDelayFromEnvironment, surveyFromEnvironment } from './route.js';
import { ALLOW_EXCLUDED_VARIABLE } from './survey.js';
import { replayFromEnvironment } from './replay.js';

/**
 * Settle the seed, name the run, check the run's settings and print them. The
 * one call a consumer's global setup makes, so none of it can be left out.
 *
 * Its own file because it reads settings from three others, one of which
 * already imports `journey.ts`.
 *
 * **The window mode, the hop delay and following are read here, not only where
 * they are used.** All three are otherwise first read after the application has launched, so
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
 *
 * **The application is a required argument,** because the run's own folder in
 * the system temp folder is named for it, and a required argument is one the
 * compiler checks for every consumer, however many there come to be. The
 * folder is made last, once every setting has been accepted, so a refused run
 * makes nothing.
 */
export function startJourney(
  journey: Journey,
  application: AppUnderTest,
  fixes?: Fixes
): {
  seed: string;
  run: string;
  settings: string[];
  tempFolder: string;
} {
  const seedGiven = Boolean(process.env[SEED_VARIABLE]);
  const seed = resolveSeed(journey.seed);
  const run = resolveRun();
  const mode = windowMode();
  const hopDelayMs = hopDelayFromEnvironment();
  const follow = followFromEnvironment();
  const surveyOnly = surveyFromEnvironment();
  const allowStale = allowStaleFromEnvironment();
  // The groups the Booking lets in, after any --allow, checked against the
  // adapter here so a group it does not declare is refused before anything
  // launches, naming where it came from. Groups the Journey file lets in are
  // handed to every Route in the one channel that reaches Playwright's
  // workers, the environment, which a run's --allow already uses; so the
  // command to run it again repeats them, which retraces the same Routes
  // even if the file changes. Nothing is written when nothing is let in, so
  // that command stays as short as the run was.
  const allowedGroups = allowedGroupsOf(journey, application);
  if (allowedGroups.length && !overriddenInBooking(journey).includes('allow')) {
    process.env[ALLOW_EXCLUDED_VARIABLE] = allowedGroups.join(',');
  }
  const groups = Object.keys(application.exclusions.groups ?? {});
  // Read here too, so a journal that cannot be replayed, such as one whose
  // Fix has code steps, is refused before anything launches.
  const replay = replayFromEnvironment();
  // Looked up here as well as by each Route, so a Fix name that is not one of
  // the consumer's is refused before anything launches, not once per Route.
  fixFor(journey, fixes);

  const forThisRun = new Set<string>(overriddenInBooking(journey));
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
    ['Fix', journey.fix ?? 'none', mark('fix')],
    ['Route deadline', deadline(journey.routeDeadlineMs), mark('routeDeadlineMs')],
    ['Journey deadline', deadline(journey.journeyDeadlineMs), mark('journeyDeadlineMs')],
    ['Window mode', mode, ''],
    ['Hop delay', hopDelayMs ? `${hopDelayMs} ms` : 'none', ''],
    ['Follow', follow ? 'on' : 'off', ''],
    [
      'Exclusion groups',
      !groups.length
        ? 'none declared'
        : groups.map((group) => `${group} ${allowedGroups.includes(group) ? 'let in' : 'excluded'}`).join(', '),
      mark('allow') || (allowedGroups.length ? 'in the Journey file' : ''),
    ],
    // Printed, so a PHILEAS_SURVEY left set in the shell is seen at the top of
    // a run that would otherwise travel nowhere.
    // Printed, so a run against a stale build says so where it is read, not
    // only in an attachment that a passing test's report never shows.
    [
      'Staleness guard',
      // An adapter pointed at an installed binary has no sources, so the
      // guard cannot run whatever the switch says: printed as on, the top of
      // every RStudio run contradicted each Route's attachment.
      !application.staleness
        ? 'cannot run: the adapter names no sources to compare the bundle against'
        : allowStale
          ? 'OFF: a stale build will run, and findings may describe code nobody runs'
          : 'on',
      '',
    ],
    ['Survey only', surveyOnly ? 'on: nothing is traveled, and every Route is skipped' : 'off', ''],
    [
      'Replay',
      replay
        ? `${path.relative(process.cwd(), replay.recorded.file) || replay.recorded.file}, ${replay.count} of ` +
          `${replay.recorded.hops.length} Trip hops, the Fix from ${replay.withCurrentFix ? 'the current Fix, checked' : 'the journal'}` +
          (replay.setAside.length ? `, its finding set aside from the known findings` : '')
        : 'off',
      replay ? 'set for this run' : '',
    ],
  ];
  const width = Math.max(...rows.map(([name, value]) => `${name}: ${value}`.length));
  const settings = rows.map(([name, value, note]) =>
    note ? `${`${name}: ${value}`.padEnd(width)}   ${note}` : `${name}: ${value}`
  );

  for (const line of settings) console.log(line);
  const started = startTempFolder(
    folderName(application),
    'Journey',
    'Each is a profile that should have been removed. Something in the application may still be ' +
      'writing into it after its Route ended.'
  );
  leftoverCheck = started.check;
  return { seed, run, settings, tempFolder: started.folder };
}

/** The variable that skips the leftover check, for a Journey and for `npm test` alike. */
export const ALLOW_TEMP_LEFTOVERS_VARIABLE = 'PHILEAS_ALLOW_TEMP_LEFTOVERS';

/**
 * Make the run's own folder in the system temp folder, hand it to everything
 * the run starts through `PHILEAS_TEMP_FOLDER`, and return it with the check
 * for its end. The check fails, naming each one, on anything still inside the
 * folder, and removes the folder when it is empty. `PHILEAS_ALLOW_TEMP_LEFTOVERS=1`
 * skips the failure, says what was left, and leaves the folder where it is.
 *
 * **Only this run's folder is read.** The check once read the whole system
 * temp folder, so two runs at once failed each other: measured on 2026-09-27,
 * when the Eighty Days demo failed on a profile the Positron trial had made
 * while both ran. Each run now owns one folder, named
 * `phileas-<name>-<random>`, and sees nothing outside it.
 *
 * Made once, where the run starts, rather than at a first launch: a name worked
 * out again later could differ, and the check would then read the wrong folder
 * and pass. The check puts back whatever `PHILEAS_TEMP_FOLDER` was before, so
 * a Journey started inside another run, as the engine's own tests do, leaves
 * that run's folder in force.
 *
 * One mechanism for a Journey and for a scripted suite, so the two cannot
 * drift apart. `what` names the run in the message, and `hint` says what most
 * likely left a folder there.
 */
export function startTempFolder(name: string, what: string, hint: string): { folder: string; check: () => void } {
  const previous = process.env[TEMP_FOLDER_VARIABLE];
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), `phileas-${name}-`));
  process.env[TEMP_FOLDER_VARIABLE] = folder;

  const check = () => {
    if (previous === undefined) delete process.env[TEMP_FOLDER_VARIABLE];
    else process.env[TEMP_FOLDER_VARIABLE] = previous;

    // Read failing is reported, never taken for an empty folder: a check that
    // could not look must not read like one that looked.
    const inside = () => fs.readdirSync(folder).sort();
    let left = inside();
    if (left.length === 0) {
      try {
        fs.rmdirSync(folder);
        return;
      } catch (error) {
        // Something wrote into it between the read and the removal.
        left = inside();
        if (left.length === 0) throw error;
      }
    }

    const listing = left.map((entry) => `  ${entry}`).join('\n');
    if (process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE] === '1') {
      console.warn(
        `${ALLOW_TEMP_LEFTOVERS_VARIABLE}=1, so the leftover check is skipped. This ${what} left ` +
          `${left.length} folder(s) in ${folder}:\n${listing}`
      );
      return;
    }
    throw new Error(
      `This ${what} left ${left.length} folder(s) in ${folder}:\n${listing}\n\n${hint} ` +
        `Set ${ALLOW_TEMP_LEFTOVERS_VARIABLE}=1 to skip this check.`
    );
  };
  return { folder, check };
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
 * after a Journey. So anything still in the Journey's own folder fails the
 * run, by name, unless
 * `PHILEAS_ALLOW_TEMP_LEFTOVERS=1`, which is announced.
 */
export function finishJourney(
  options: {
    journalsRoot?: string;
    knownFindings?: string;
    /** The adapter's signature patterns, so entries are re-signed under the rules its Routes used. */
    varying?: readonly (readonly [RegExp, string])[];
  } = {}
): JourneyFindings | undefined {
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
    findings = recordJourneyFindings(run, options.knownFindings, undefined, options.varying ?? []);
    // Named from where the run was started, so a summary names no home folder.
    const shown = path.relative(process.cwd(), options.knownFindings) || options.knownFindings;
    // Handed to the engine's reporter, which prints them last, in its summary,
    // so they are never above Playwright's own report. The reporter runs in
    // this process, as global setup and what it returns do.
    if (reporterPresent()) {
      (globalThis as Record<symbol, unknown>)[JOURNEY_END] = { findings, file: shown };
      return;
    }
    console.log('');
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

/**
 * The exclusion groups a Journey's Booking lets in, after any `--allow`,
 * each one checked against the groups the adapter declares.
 *
 * A name the adapter does not declare is refused, naming the groups it does
 * and where the name came from: a mistyped group would otherwise be let in by
 * nobody and the run would read as having allowed it.
 */
export function allowedGroupsOf(journey: Journey, application: AppUnderTest): readonly string[] {
  const asked = journey.allow ?? [];
  const declared = Object.keys(application.exclusions.groups ?? {});
  const unknown = asked.filter((name) => !declared.includes(name));
  if (unknown.length) {
    const from = overriddenInBooking(journey).includes('allow') ? ALLOW_EXCLUDED_VARIABLE : "the Journey's allow";
    throw new Error(
      `${from} names ${unknown.map((name) => JSON.stringify(name)).join(', ')}, ` +
        `which the adapter does not declare as an exclusion group. ` +
        (declared.length ? `It declares: ${declared.join(', ')}.` : 'It declares none.')
    );
  }
  return asked;
}
