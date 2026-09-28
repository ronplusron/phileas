import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Whether a Journey wrote into the real home folder, shared by the trials.
 *
 * Measured on Positron on 2026-09-26: it writes into the home folder whatever
 * `--user-data-dir` says, and runs before its adapter gave each Route a home of
 * its own left sixteen files in `~/.copilot`. Each adapter's HOME is the
 * prevention. This is the detection, and it reads the real folder rather than
 * trusting the variable, so a HOME that stopped taking effect is caught rather
 * than reported as clean.
 *
 * Two readings, because a list of an application's folders goes stale the day
 * it writes somewhere new: every file under the folders it is known to use,
 * and any new entry at the top of the home folder or of Application Support.
 */

/** What the guard needs to know about one application. */
export interface GuardedApplication {
  /** Its name, for what the guard prints. */
  readonly name: string;
  /**
   * Files and folders under the home folder it was measured writing into,
   * relative to the home. A folder is read to the bottom; a file is itself.
   */
  readonly knownRoots: readonly string[];
  /** What its executable's path ends with, as `ps` lists it. */
  readonly executable: string;
  /** What only a Route's own launches carry on their command line. */
  readonly routeMarker: string;
}

/** Positron, measured 2026-09-26. */
export const POSITRON: GuardedApplication = {
  name: 'Positron',
  knownRoots: [
    '.positron',
    '.positron-shared',
    '.posit',
    '.copilot',
    path.join('Library', 'Application Support', 'Positron'),
  ],
  executable: '/Contents/MacOS/Positron',
  routeMarker: 'phileas-positron-',
};

/**
 * RStudio, from what a launch wrote into a Route's own home on 2026-09-28:
 * its configuration, its state and R's history. Its Electron profile follows
 * `--user-data-dir`, so Application Support is the one it would write if that
 * stopped taking effect.
 */
export const RSTUDIO: GuardedApplication = {
  name: 'RStudio',
  knownRoots: [
    path.join('.config', 'rstudio'),
    path.join('.local', 'share', 'rstudio'),
    '.Rhistory',
    '.RData',
    path.join('Library', 'Application Support', 'RStudio'),
  ],
  executable: '/Contents/MacOS/RStudio',
  routeMarker: 'phileas-rstudio-',
};

/** Folders whose new entries count, wherever they point. */
const WATCHED_TOPS = ['.', path.join('Library', 'Application Support')];

/** The variable that runs a Journey without the guard, which then says so. */
export const ALLOW_HOME_WRITES_VARIABLE = 'PHILEAS_TRIAL_ALLOW_HOME_WRITES';

export interface HomeSnapshot {
  readonly home: string;
  readonly application: GuardedApplication;
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

/**
 * A folder's entries. Refuses one that cannot be read: read as empty, a
 * folder the guard could not look into made every later entry look new, or
 * made nothing look new, and the guard printed clean either way.
 */
function entries(dir: string): Set<string> {
  return new Set(fs.readdirSync(dir));
}

export function snapshotHome(
  home: string,
  application: GuardedApplication,
  startedMs = Date.now(),
  journeyFolder?: JourneyFolder
): HomeSnapshot {
  const tops = new Map<string, Set<string>>();
  for (const top of WATCHED_TOPS) tops.set(top, entries(path.join(home, top)));
  const journeyEntries = journeyFolder ? entries(journeyFolder.dir) : new Set<string>();
  return { home, application, startedMs, tops, journeyFolder, journeyEntries };
}

/** Every file at or under a path; nothing where it does not exist. */
function* filesAt(target: string): Generator<string> {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    // Not written yet is the ordinary case for a known root. Anything else
    // means the guard could not look, and says so.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!stat.isDirectory()) {
    yield target;
    return;
  }
  for (const name of fs.readdirSync(target)) yield* filesAt(path.join(target, name));
}

/** What the guard read, so a clean result can say how much it covered. */
export interface HomeReading {
  readonly written: string[];
  readonly filesRead: number;
  readonly entriesRead: number;
}

/**
 * Everything written into the home folder since the snapshot, as `~/` paths,
 * and every new entry in the Journey's folder, as absolute ones, with how much
 * was read to find them.
 */
export function readHome(snapshot: HomeSnapshot): HomeReading {
  const found = new Set<string>();
  let entriesRead = 0;
  let filesRead = 0;

  const journey = snapshot.journeyFolder;
  if (journey) {
    for (const name of entries(journey.dir)) {
      entriesRead++;
      if (!snapshot.journeyEntries.has(name) && !journey.ownEntries.includes(name)) {
        found.add(path.join(journey.dir, name));
      }
    }
  }

  for (const [top, before] of snapshot.tops) {
    for (const name of entries(path.join(snapshot.home, top))) {
      entriesRead++;
      if (!before.has(name)) found.add(`~/${path.join(top, name)}`);
    }
  }

  for (const root of snapshot.application.knownRoots) {
    for (const file of filesAt(path.join(snapshot.home, root))) {
      filesRead++;
      if (fs.lstatSync(file).mtimeMs >= snapshot.startedMs) found.add(`~/${path.relative(snapshot.home, file)}`);
    }
  }

  return { written: [...found].sort(), filesRead, entriesRead };
}

/** Everything written, as `readHome` finds it. */
export function writesSince(snapshot: HomeSnapshot): string[] {
  return readHome(snapshot).written;
}

/**
 * Copies of the application running that are not a Route's, such as one the
 * person running the Journey has open. Their writes cannot be told apart from
 * a run's, so the guard names them rather than blaming the run silently or
 * excusing it. Undefined when `ps` could not be read: unknown, not none.
 */
export function outsideCopies(application: GuardedApplication): number | undefined {
  let listing: string;
  try {
    listing = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' });
  } catch {
    return undefined;
  }
  return listing
    .split('\n')
    .filter((line) => line.includes(application.executable) && !line.includes(application.routeMarker)).length;
}

/**
 * Start watching the home folder, and return what checks it when the Journey
 * ends. Throws when anything was written there, listing it, unless the
 * override is set, in which case it says the guard did not run. Says how much
 * it read when it passes, so a guard that looked at nothing cannot read clean.
 */
export function guardHome(home: string, application: GuardedApplication, journeyFolder?: JourneyFolder): () => void {
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

  const snapshot = snapshotHome(home, application, Date.now(), journeyFolder);
  const outsideAtStart = outsideCopies(application);

  return () => {
    const { written, filesRead, entriesRead } = readHome(snapshot);
    if (written.length === 0) {
      console.log(
        `Home folder guard: nothing written among ${filesRead} files under ` +
          `${application.knownRoots.join(', ')}, and no new entry among ${entriesRead} ` +
          `in the home folder and Application Support` +
          (journeyFolder ? `, or in the Journey's folder beyond its own.` : '.')
      );
      return;
    }

    const atEnd = outsideCopies(application);
    const outside =
      outsideAtStart === undefined || atEnd === undefined ? undefined : Math.max(outsideAtStart, atEnd);
    throw new Error(
      `The Journey ran, and ${written.length} file(s) were written into the real home folder ` +
        `or the Journey's folder:\n\n` +
        written.map((file) => `  ${file}`).join('\n') +
        '\n\n' +
        (outside === undefined
          ? `Whether another ${application.name} was running is unknown, since the process list ` +
            `could not be read, so these may or may not have come from the run.\n\n`
          : outside > 0
            ? `${application.name} that is not a Route's was running (${outside} seen), and its writes ` +
              `cannot be told apart from the run's. Close it and run again to know which.\n\n`
            : `No other ${application.name} was running, so these came from the run: the adapter's HOME, ` +
              `or the engine launching from the profile folder, did not take effect.\n\n`) +
        `Set ${ALLOW_HOME_WRITES_VARIABLE}=1 to run without this guard.`
    );
  };
}
