import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Whether a Route's R sees the R library of the person running the Journey.
 *
 * Asked for on 2026-10-02: someone with thirty packages installed, running a
 * Journey locally, wants a Route to see them, and decided the same day that
 * it is included by default. A Route's fresh home folder and the adapter's own
 * R_LIBS_USER otherwise hide it, since R finds that library from HOME.
 *
 * It joins each Route's library list after the Route's own, so an install
 * still lands in the Route's library: R lists every folder of R_LIBS_USER in
 * order, drops one that does not exist, and installs into the first. Measured
 * with Rscript on 2026-10-02.
 *
 * PHILEAS_R_PERSONAL_LIBRARY decides it: unset or 1 includes R's own default
 * for the person, 0 leaves it out, and an absolute path to a folder includes
 * that folder instead. Anything else is refused. It belongs to this trial,
 * not to the engine, and is named without TRIAL since the engine reserves
 * nothing under PHILEAS_.
 */
export const PERSONAL_LIBRARY_VARIABLE = 'PHILEAS_R_PERSONAL_LIBRARY';

/**
 * What a Route gets: the folders it adds to the Route's library list, and how
 * they were chosen. `named` is what R gives as the default, which may not
 * exist, so the Journey's start can say what it looked for.
 */
export type PersonalLibrary =
  | { kind: 'default'; folders: string[]; named: string[] }
  | { kind: 'given'; folders: [string] }
  | { kind: 'off'; folders: [] };

/**
 * R's own default personal library for the person running the Journey: what
 * R makes of R_LIBS_USER under the real home folder and its startup files,
 * with any value in this process's environment set aside, as the R library
 * guard reads it. Throws when R cannot say.
 */
export function rDefaultPersonalLibrary(): string[] {
  let said: string;
  try {
    said = execFileSync('Rscript', ['-e', 'cat(path.expand(Sys.getenv("R_LIBS_USER")))'], {
      encoding: 'utf8',
      env: { ...process.env, R_LIBS_USER: '' },
    });
  } catch (error) {
    throw new Error(
      `${PERSONAL_LIBRARY_VARIABLE}: could not ask R where the personal R library is: ` +
        `${(error as Error).message.split('\n')[0]}. Set ${PERSONAL_LIBRARY_VARIABLE}=0 to leave it out.`
    );
  }
  return said.split(':').map((folder) => folder.trim()).filter(Boolean);
}

const isFolder = (folder: string) => {
  try {
    return fs.statSync(folder).isDirectory();
  } catch {
    return false;
  }
};

/**
 * The personal library a Route gets, from the variable's value. `readDefault`
 * is asked only when the default is wanted.
 */
export function resolvePersonalLibrary(
  raw: string | undefined,
  readDefault: () => string[] = rDefaultPersonalLibrary
): PersonalLibrary {
  const value = (raw ?? '').trim();
  if (value === '' || value === '1') {
    const named = readDefault();
    return { kind: 'default', folders: named.filter(isFolder), named };
  }
  if (value === '0') return { kind: 'off', folders: [] };

  const refuse = (why: string) =>
    new RangeError(
      `${PERSONAL_LIBRARY_VARIABLE}=${JSON.stringify(value)} ${why}. It belongs to the RStudio trial, and takes ` +
        `1 or nothing to include your own R library, 0 to leave it out, or the absolute path of a folder ` +
        `to include instead.`
    );
  if (!path.isAbsolute(value)) throw refuse('is not 1, 0 or an absolute path');
  if (value.includes(':')) throw refuse('holds a colon, which R reads as two folders');
  if (!isFolder(value)) throw refuse('names no folder');
  return { kind: 'given', folders: [value] };
}

/**
 * The personal library for this run, from the variable as it stands. Read
 * on every call, once at the Journey's start and once per Route, rather than
 * kept, so nothing set earlier in a process can answer for a later setting.
 */
export function personalLibrary(): PersonalLibrary {
  return resolvePersonalLibrary(process.env[PERSONAL_LIBRARY_VARIABLE]);
}

/** R_LIBS_USER for a Route: its own library first, so an install lands there. */
export function libraryList(routeLibrary: string, personal: PersonalLibrary): string {
  return [routeLibrary, ...personal.folders].join(':');
}

/** How many packages a library holds: folders with a DESCRIPTION. */
export function packageCount(folder: string): number {
  return fs
    .readdirSync(folder)
    .filter((name) => fs.existsSync(path.join(folder, name, 'DESCRIPTION'))).length;
}

/** The Journey's opening line about it, so a run says what its Routes could see. */
export function describePersonalLibrary(personal: PersonalLibrary): string {
  const tilde = (folder: string) =>
    folder.startsWith(os.homedir() + path.sep) ? `~${folder.slice(os.homedir().length)}` : folder;
  const held = (folder: string) => {
    const count = packageCount(folder);
    return `${tilde(folder)}, ${count} package${count === 1 ? '' : 's'}`;
  };
  switch (personal.kind) {
    case 'off':
      return `R personal library: left out, by ${PERSONAL_LIBRARY_VARIABLE}=0`;
    case 'given':
      return `R personal library: included, ${held(personal.folders[0])}, given by ${PERSONAL_LIBRARY_VARIABLE}`;
    case 'default':
      return personal.folders.length > 0
        ? `R personal library: included, ${personal.folders.map(held).join('; ')}`
        : `R personal library: none, R's default ${personal.named.map(tilde).join(', ') || '(none named)'} does not exist`;
  }
}
