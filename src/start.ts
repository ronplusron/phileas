import { overriddenTerms, requireRun, requireSeed, resolveRun, resolveSeed, SEED_VARIABLE, type Journey } from './journey';
import path from 'node:path';
import { journalFolder } from './journal';
import { recordJourneyFindings, renderJourneyFindings, type JourneyFindings } from './known.mjs';
import { windowMode } from './launch';
import { followFromEnvironment, hopDelayFromEnvironment } from './route';

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
  ];
  const width = Math.max(...rows.map(([name, value]) => `${name}: ${value}`.length));
  const settings = rows.map(([name, value, note]) =>
    note ? `${`${name}: ${value}`.padEnd(width)}   ${note}` : `${name}: ${value}`
  );

  for (const line of settings) console.log(line);
  return { seed, run, settings };
}

/**
 * End a Journey: add what it found to the known findings, and say what was
 * seen, what is still unfiled and what was not seen. For a consumer's global
 * setup to return, so that Playwright runs it once every Route has ended,
 * whether they passed or not.
 *
 * Here and nowhere else, so that every Route of a Journey read the same known
 * findings. A Route that carried on past a bug only because an earlier Route
 * in the same Journey had found it would end differently replayed alone,
 * which is the dependence between Routes the design rules out.
 */
export function finishJourney(options: { journalsRoot: string; knownFindings: string }): JourneyFindings {
  const run = journalFolder(options.journalsRoot, requireSeed(), requireRun());
  const findings = recordJourneyFindings(run, options.knownFindings);
  console.log('');
  // Named from where the run was started, so a summary names no home folder.
  const shown = path.relative(process.cwd(), options.knownFindings) || options.knownFindings;
  for (const line of renderJourneyFindings(findings, shown)) console.log(line);
  return findings;
}
