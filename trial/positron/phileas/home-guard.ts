import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Whether a Journey wrote into the real home folder.
 *
 * Measured on 2026-09-26: Positron writes into the home folder whatever
 * `--user-data-dir` says, and runs before the adapter gave each Route a home of
 * its own left sixteen files in `~/.copilot`. The adapter's HOME is the
 * prevention. This is the detection, and it reads the real folder rather than
 * trusting the variable, so a HOME that stopped taking effect is caught rather
 * than reported as clean.
 *
 * Two readings, because a list of Positron's folders goes stale the day it
 * writes somewhere new: every file under the folders it is known to use, and
 * any new entry at the top of the home folder or of Application Support.
 */

/** Folders under the home folder Positron was measured writing into. */
export const KNOWN_ROOTS = [
  '.positron',
  '.positron-shared',
  '.posit',
  '.copilot',
  path.join('Library', 'Application Support', 'Positron'),
];

/** Folders whose new entries count, wherever they point. */
const WATCHED_TOPS = ['.', path.join('Library', 'Application Support')];

/** The variable that runs a Journey without the guard, which then says so. */
export const ALLOW_HOME_WRITES_VARIABLE = 'PHILEAS_TRIAL_ALLOW_HOME_WRITES';

export interface HomeSnapshot {
  readonly home: string;
  readonly startedMs: number;
  readonly tops: ReadonlyMap<string, ReadonlySet<string>>;
  readonly journeyFolder?: JourneyFolder;
  readonly journeyEntries: ReadonlySet<string>;
}

/**
 * The folder the Journey runs from, whose new entries count too, apart from
 * those the run itself makes there. A bundled Positron extension left a log in
 * it on 2026-09-26, before the engine launched applications from the profile.
 */
export interface JourneyFolder {
  readonly dir: string;
  /** Entries the run itself writes, such as its journals and test results. */
  readonly ownEntries: readonly string[];
}

function entries(dir: string): Set<string> {
  try {
    return new Set(fs.readdirSync(dir));
  } catch {
    return new Set();
  }
}

export function snapshotHome(home: string, startedMs = Date.now(), journeyFolder?: JourneyFolder): HomeSnapshot {
  const tops = new Map<string, Set<string>>();
  for (const top of WATCHED_TOPS) tops.set(top, entries(path.join(home, top)));
  const journeyEntries = journeyFolder ? entries(journeyFolder.dir) : new Set<string>();
  return { home, startedMs, tops, journeyFolder, journeyEntries };
}

function* filesUnder(dir: string): Generator<string> {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const full = path.join(dir, name);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) yield* filesUnder(full);
    else yield full;
  }
}

/**
 * Everything written into the home folder since the snapshot, as `~/` paths,
 * and every new entry in the Journey's folder, as absolute ones.
 */
export function writesSince(snapshot: HomeSnapshot): string[] {
  const found = new Set<string>();

  const journey = snapshot.journeyFolder;
  if (journey) {
    for (const name of entries(journey.dir)) {
      if (!snapshot.journeyEntries.has(name) && !journey.ownEntries.includes(name)) {
        found.add(path.join(journey.dir, name));
      }
    }
  }

  for (const [top, before] of snapshot.tops) {
    for (const name of entries(path.join(snapshot.home, top))) {
      if (!before.has(name)) found.add(`~/${path.join(top, name)}`);
    }
  }

  for (const root of KNOWN_ROOTS) {
    for (const file of filesUnder(path.join(snapshot.home, root))) {
      let modifiedMs: number;
      try {
        modifiedMs = fs.lstatSync(file).mtimeMs;
      } catch {
        continue;
      }
      if (modifiedMs >= snapshot.startedMs) found.add(`~/${path.relative(snapshot.home, file)}`);
    }
  }

  return [...found].sort();
}

/**
 * Positron processes that are not a Route's, such as one the person running
 * the Journey has open. Their writes cannot be told apart from a run's, so the
 * guard names them rather than blaming the run silently or excusing it.
 */
export function outsidePositrons(): number {
  let listing = '';
  try {
    listing = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' });
  } catch {
    return 0;
  }
  return listing
    .split('\n')
    .filter((line) => line.includes('/Contents/MacOS/Positron') && !line.includes('phileas-positron-')).length;
}

/**
 * Start watching the home folder, and return what checks it when the Journey
 * ends. Throws when anything was written there, listing it, unless the
 * override is set, in which case it says the guard did not run.
 */
export function guardHome(home: string, journeyFolder?: JourneyFolder): () => void {
  // 1 or 0 and nothing else, as every switch in the engine is: counted as on
  // for any value, =0 switched the guard off.
  const raw = (process.env[ALLOW_HOME_WRITES_VARIABLE] ?? '').trim();
  if (raw !== '' && raw !== '0' && raw !== '1') {
    throw new RangeError(`${ALLOW_HOME_WRITES_VARIABLE}=${JSON.stringify(raw)} is not on or off. Use 1 or 0.`);
  }
  if (raw === '1') {
    console.log(`Home folder guard: skipped, because ${ALLOW_HOME_WRITES_VARIABLE} is set.`);
    return () => undefined;
  }

  const snapshot = snapshotHome(home, Date.now(), journeyFolder);
  const outsideAtStart = outsidePositrons();

  return () => {
    const written = writesSince(snapshot);
    if (written.length === 0) {
      console.log(
        `Home folder guard: nothing written under ${KNOWN_ROOTS.join(', ')}, and no new entry ` +
          `in the home folder or Application Support` +
          (journeyFolder ? `, or in the Journey's folder beyond its own.` : '.')
      );
      return;
    }

    const outside = Math.max(outsideAtStart, outsidePositrons());
    throw new Error(
      `The Journey ran, and ${written.length} file(s) were written into the real home folder ` +
        `or the Journey's folder:\n\n` +
        written.map((file) => `  ${file}`).join('\n') +
        '\n\n' +
        (outside > 0
          ? `A Positron that is not a Route's was running (${outside} seen), and its writes ` +
            `cannot be told apart from the run's. Close it and run again to know which.\n\n`
          : `No other Positron was running, so these came from the run: the adapter's HOME, ` +
            `or the engine launching from the profile folder, did not take effect.\n\n`) +
        `Set ${ALLOW_HOME_WRITES_VARIABLE}=1 to run without this guard.`
    );
  };
}
