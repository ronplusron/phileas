import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** macOS's own python3, a stub until the Command Line Tools are installed. */
const STUB_PYTHON = '/usr/bin/python3';

/** The first file by this name on a PATH, or undefined where there is none. */
function onPath(program: string, env: Readonly<Record<string, string>>): string | undefined {
  for (const folder of (env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(folder, program);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Why the PATH's python3 must not be run, where it must not: it is macOS's
 * stub and the Command Line Tools are not installed, so running it opens a
 * dialog offering to install them, at every Route's launch. Undefined where
 * it is safe to run.
 */
function stubWithoutTools(python: string | undefined): string | undefined {
  if (python !== STUB_PYTHON) return undefined;
  try {
    execFileSync('xcode-select', ['-p'], { stdio: 'ignore', timeout: 5_000 });
    return undefined;
  } catch {
    return `unread: ${STUB_PYTHON} is macOS's stub and the Command Line Tools are not installed, so it was not run`;
  }
}

/**
 * What one program says its version is, run with the environment Positron is
 * about to be given, or why it could not say. Each value is read on its own,
 * so one that cannot be read leaves the others standing.
 */
function versionOf(program: string, args: readonly string[], env: Readonly<Record<string, string>>): string {
  try {
    // Python 2 and some 3.x builds print their version to standard error.
    const said = execFileSync(program, [...args], { encoding: 'utf8', env, timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] });
    return said.trim().replace(/^Python\s+/, '');
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim() ?? '';
    const python = /^Python\s+(\S+)/.exec(stderr)?.[1];
    return python ?? `unread: ${(error as Error).message.split('\n')[0]}`;
  }
}

/**
 * The R and Python a Route's Positron is offered, for the journal's opening
 * line, each named by where it came from: the PATH's `Rscript` and `python3`,
 * and for the early releases the R handed over in `positron.r.customBinaries`.
 *
 * The adapter's account, not what a Route started: Positron discovers
 * interpreters for itself, may start none in a Route, and lets a Route choose
 * among them. `AppUnderTest.runsWith` says why that is recorded later or not
 * at all.
 */
export function positronRunsWith(env: Readonly<Record<string, string>>, customR: string | undefined): Record<string, string> {
  const rVersion = ['--vanilla', '-e', 'cat(format(getRversion()))'];
  return {
    'R (PATH)': versionOf('Rscript', rVersion, env),
    ...(customR ? { 'R (positron.r.customBinaries)': versionOf(path.join(path.dirname(customR), 'Rscript'), rVersion, env) } : {}),
    'Python (PATH python3)': (() => {
      const python = onPath('python3', env);
      if (python === undefined) return 'unread: no python3 on the PATH';
      return stubWithoutTools(python) ?? versionOf(python, ['--version'], env);
    })(),
  };
}
