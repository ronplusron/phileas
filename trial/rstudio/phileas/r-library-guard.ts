import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Whether a Journey changed the machine's R package libraries.
 *
 * The adapter's R_LIBS_USER is the prevention: it puts a library of the
 * Route's own first, so an install lands in the profile. This is the
 * detection, and it reads the machine's libraries themselves rather than
 * trusting the variable, so a redirect that stopped taking effect is caught
 * rather than reported as clean. Measured on 2026-09-28: the machine's
 * library is writable by the user running the Journey, with no prompt.
 *
 * It compares each package's folder and its DESCRIPTION, never the library
 * folder's own time: every RStudio launch moves that, within two seconds and
 * before any Hop, while no package in it changes (measured 2026-09-28).
 */

/** The variable that runs a Journey without the guard, which then says so. */
export const ALLOW_R_LIBRARY_WRITES_VARIABLE = 'PHILEAS_TRIAL_ALLOW_R_LIBRARY_WRITES';

/** Each library's entries, by name, with what would change if one were written. */
export type LibrarySnapshot = ReadonlyMap<string, ReadonlyMap<string, string>>;

/**
 * The machine's R libraries, as R itself lists them for the person running
 * the Journey: the same HOME and startup files RStudio would read without the
 * adapter's redirect. Throws when R cannot say, since a guard with nothing to
 * watch must not read as one that watched.
 */
export function machineLibraries(): string[] {
  let listed: string;
  try {
    listed = execFileSync('Rscript', ['-e', 'cat(.libPaths(), sep = "\\n")'], {
      encoding: 'utf8',
      env: { ...process.env, R_LIBS_USER: '' },
    });
  } catch (error) {
    throw new Error(
      `The R library guard could not ask R for its libraries: ${(error as Error).message.split('\n')[0]}. ` +
        `Set ${ALLOW_R_LIBRARY_WRITES_VARIABLE}=1 to run without the guard.`
    );
  }
  const libraries = listed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (libraries.length === 0) throw new Error('The R library guard found R listing no libraries at all.');
  return libraries;
}

/** A time for a path, or 'missing'. */
function modified(file: string): string {
  try {
    return String(fs.lstatSync(file).mtimeMs);
  } catch {
    return 'missing';
  }
}

/**
 * Every entry of each library, with its folder's time and its DESCRIPTION's.
 * A library that cannot be read is refused rather than read as empty: an
 * empty reading would make every package look removed, or, taken at the
 * start, make nothing look changed.
 */
export function snapshotLibraries(libraries: readonly string[]): LibrarySnapshot {
  const snapshot = new Map<string, Map<string, string>>();
  for (const library of libraries) {
    const entries = new Map<string, string>();
    for (const name of fs.readdirSync(library)) {
      const entry = path.join(library, name);
      entries.set(name, `${modified(entry)} ${modified(path.join(entry, 'DESCRIPTION'))}`);
    }
    snapshot.set(library, entries);
  }
  return snapshot;
}

/** What was added, removed or changed in any library since the snapshot. */
export function changesSince(before: LibrarySnapshot): string[] {
  const changes: string[] = [];
  const after = snapshotLibraries([...before.keys()]);
  for (const [library, then] of before) {
    const now = after.get(library) ?? new Map<string, string>();
    for (const [name, stamp] of now) {
      const was = then.get(name);
      if (was === undefined) changes.push(`added: ${path.join(library, name)}`);
      else if (was !== stamp) changes.push(`changed: ${path.join(library, name)}`);
    }
    for (const name of then.keys()) {
      if (!now.has(name)) changes.push(`removed: ${path.join(library, name)}`);
    }
  }
  return changes.sort();
}

/**
 * The machine's libraries and the person's own library a Route sees, each
 * once. R lists the default personal library among the machine's whenever
 * it exists, so only one given by path adds anything.
 */
export function librariesToGuard(machine: readonly string[], personal: readonly string[]): string[] {
  return [...new Set([...machine, ...personal])];
}

/**
 * Start watching the libraries, and return what checks them when the Journey
 * ends. Throws when anything changed, listing it, unless the override is set,
 * in which case it says the guard did not run. Says how much it read when it
 * passes, so a guard that looked at nothing cannot read as clean.
 */
export function guardRLibraries(libraries: readonly string[] = machineLibraries()): () => void {
  const raw = (process.env[ALLOW_R_LIBRARY_WRITES_VARIABLE] ?? '').trim();
  if (raw !== '' && raw !== '0' && raw !== '1') {
    throw new RangeError(`${ALLOW_R_LIBRARY_WRITES_VARIABLE}=${JSON.stringify(raw)} is not on or off. Use 1 or 0.`);
  }
  if (raw === '1') {
    console.log(`R library guard: skipped, because ${ALLOW_R_LIBRARY_WRITES_VARIABLE} is set.`);
    return () => undefined;
  }

  const snapshot = snapshotLibraries(libraries);
  const read = [...snapshot.values()].reduce((sum, entries) => sum + entries.size, 0);

  return () => {
    const changes = changesSince(snapshot);
    if (changes.length === 0) {
      console.log(
        `R library guard: nothing added, removed or changed among ${read} entries in ` +
          `${[...snapshot.keys()].join(', ')}.`
      );
      return;
    }
    throw new Error(
      `The Journey ran, and ${changes.length} package(s) in the machine's R libraries changed:\n\n` +
        changes.map((change) => `  ${change}`).join('\n') +
        `\n\nThe adapter's R_LIBS_USER should have sent any install to the Route's own library. ` +
        `An R running outside the Journey can also change them, and cannot be told apart. ` +
        `Set ${ALLOW_R_LIBRARY_WRITES_VARIABLE}=1 to run without this guard.`
    );
  };
}
