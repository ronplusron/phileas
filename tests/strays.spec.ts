import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { endStrayProcesses } from '../src/index';

/**
 * The sweep after a Route's application closes, against processes made for
 * the test: one running in the profile folder, as a relaunched RStudio did,
 * one naming the profile only in its environment, and one elsewhere, which
 * must be left alone.
 */

let scratch: string;
const started: ChildProcess[] = [];

const running = (child: ChildProcess) => child.exitCode === null && child.signalCode === null;

/**
 * A process that waits, run by Node itself rather than `sleep`: macOS does not
 * show the environment of its own system programs, measured on 2026-09-28,
 * so `/bin/sleep` could never be found by what it carries.
 */
function sleeper(cwd: string, env: NodeJS.ProcessEnv = {}): ChildProcess {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { cwd, env: { ...process.env, ...env }, stdio: 'ignore' });
  started.push(child);
  return child;
}

test.beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'strays-test-'));
});

test.afterEach(() => {
  for (const child of started.splice(0)) if (running(child)) child.kill('SIGKILL');
  fs.rmSync(scratch, { recursive: true, force: true });
});

test("a process in the profile folder, or naming it in its environment, is ended; one elsewhere is not", async () => {
  const profile = fs.mkdtempSync(path.join(scratch, 'profile-'));
  const elsewhere = fs.mkdtempSync(path.join(scratch, 'elsewhere-'));
  const inProfile = sleeper(profile);
  const namesIt = sleeper(elsewhere, { HOME: path.join(profile, 'home') });
  const control = sleeper(elsewhere);
  // Long enough for each to be running under its own name.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const report = await endStrayProcesses(profile, 1_000);
  expect(report.couldNotLook).toBeUndefined();
  expect(report.ended).toHaveLength(2);
  expect(report.ended.join('\n')).toMatch(/setTimeout/);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(running(inProfile)).toBe(false);
  expect(running(namesIt)).toBe(false);
  expect(running(control)).toBe(true);
});

test('with nothing left behind, nothing is ended', async () => {
  const profile = fs.mkdtempSync(path.join(scratch, 'profile-'));
  expect(await endStrayProcesses(profile, 200)).toEqual({ ended: [] });
});
