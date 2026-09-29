import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

/**
 * Processes a Route's application left behind, found and ended once the
 * application is closed and before its profile is deleted.
 *
 * The engine closes the process it launched, and on 2026-09-28 that was not
 * all there was. A Route turned on RStudio's screen reader support and agreed
 * to restart, and RStudio relaunched itself: the new copy was nobody's child,
 * carried none of the engine's arguments, so it was not hidden and used the
 * real Electron profile in Application Support, and it outlived the Route,
 * writing into that profile, until it was quit by hand. It still carried the
 * Route's environment and ran in the Route's profile folder, which the
 * engine launches every application from. So a process whose working folder
 * or environment points into this Route's profile is the Route's, whoever
 * started it.
 */

/** What the sweep found, or why it could not look. */
export interface StrayReport {
  /** Each process ended, as its id and command line. */
  readonly ended: readonly string[];
  /** Set when the process list could not be read, so nothing was checked. */
  readonly couldNotLook?: string;
}

const LIST_TIMEOUT_MS = 10_000;
const GRACE_MS = 2_000;

/** A command's output, even when it exits non-zero, as lsof does when some process is unreadable. */
function output(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: LIST_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) reject(error);
      else resolve(stdout);
    });
  });
}

/** Both spellings of a folder under the system temp folder: as given, and resolved. */
function spellings(folder: string): string[] {
  const forms = new Set([folder.replace(/\/+$/, '')]);
  try {
    forms.add(fs.realpathSync(folder));
  } catch {
    // Already gone: the spelling given is the one a process would carry.
  }
  if (folder.startsWith('/var/')) forms.add(`/private${folder}`);
  if (folder.startsWith('/private/var/')) forms.add(folder.slice('/private'.length));
  return [...forms];
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Find every process of this user whose working folder is inside `profile`,
 * or whose environment names it, end each with SIGTERM, then SIGKILL any
 * still there after a grace period, and say what was ended. Never touches the
 * process running this, or its parent.
 */
export async function endStrayProcesses(profile: string, graceMs = GRACE_MS): Promise<StrayReport> {
  const forms = spellings(profile);
  const inside = (text: string) => forms.some((form) => text === form || text.includes(`${form}/`) || text.endsWith(form));
  const user = os.userInfo().username;
  const found = new Map<number, string>();

  let cwds: string;
  let commands: string;
  try {
    [cwds, commands] = await Promise.all([
      output('lsof', ['-a', '-u', user, '-d', 'cwd', '-Fpn']),
      // `e` appends each process's environment to its command line.
      output('ps', ['eww', '-U', user, '-o', 'pid=,command=']),
    ]);
  } catch (error) {
    return { ended: [], couldNotLook: `the process list could not be read: ${(error as Error).message.split('\n')[0]}` };
  }

  let pid = 0;
  for (const line of cwds.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid && inside(line.slice(1))) found.set(pid, '');
  }
  for (const line of commands.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (match && inside(match[2] ?? '')) found.set(Number(match[1]), '');
  }
  found.delete(process.pid);
  found.delete(process.ppid);
  if (found.size === 0) return { ended: [] };

  // Named by command line alone, without the environment, for the report.
  const names = await output('ps', ['-o', 'pid=,command=', '-p', [...found.keys()].join(',')]).catch(() => '');
  for (const line of names.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (match && found.has(Number(match[1]))) found.set(Number(match[1]), (match[2] ?? '').slice(0, 200));
  }

  for (const id of found.keys()) {
    try {
      process.kill(id, 'SIGTERM');
    } catch {
      // Gone between the listing and now.
    }
  }
  const until = Date.now() + graceMs;
  while ([...found.keys()].some(alive) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 100));
  for (const id of found.keys()) {
    if (alive(id)) {
      try {
        process.kill(id, 'SIGKILL');
      } catch {
        // Gone.
      }
    }
  }
  return { ended: [...found].map(([id, command]) => `${id} ${command || '(exited before it could be named)'}`) };
}
