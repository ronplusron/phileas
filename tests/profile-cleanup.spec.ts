import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import { makeUserDataDir, removeProfile } from '../src/index';

/**
 * Deleting a Route's profile folder, in the two ways a single delete failed.
 *
 * Each test first shows the plain delete the fixture used to make failing on
 * the same folder, so a pass says the case was real and not that the folder
 * was easy to remove.
 */

test('a profile with a read-only part is removed', async () => {
  const dir = await makeUserDataDir(buggy);
  const locked = path.join(dir, 'User');
  fs.mkdirSync(locked);
  fs.writeFileSync(path.join(locked, 'settings.json'), '{}');
  fs.chmodSync(locked, 0o500);

  try {
    await expect(fs.promises.rm(dir, { recursive: true, force: true })).rejects.toThrow(/EACCES/);

    await removeProfile(dir);
    expect(fs.existsSync(dir)).toBe(false);
  } finally {
    // Whatever happened above, so a failing run leaves nothing behind.
    if (fs.existsSync(locked)) fs.chmodSync(locked, 0o700);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('a profile still being written into while it is deleted is removed', async () => {
  // Another process keeps adding files for a moment, as an application's
  // children did on Positron while they exited.
  const dir = await makeUserDataDir(buggy);
  const busy = path.join(dir, 'busy');
  fs.mkdirSync(busy);
  // The exit is captured when the writer starts, since it can finish before
  // anything waits on it.
  const writing = (ms: number): Promise<unknown> => {
    const child = spawn(
      process.execPath,
      [
        '-e',
        // Writing without pause, so no delete finds a moment between files.
        `const fs=require('fs');const p=require('path');const until=Date.now()+${ms};let n=0;` +
          `while(Date.now()<until){try{fs.mkdirSync(${JSON.stringify(busy)},{recursive:true});` +
          `fs.writeFileSync(p.join(${JSON.stringify(busy)},'f'+(n++)),'x')}catch{}}`,
      ],
      { stdio: 'ignore' }
    );
    return new Promise((resolve) => child.once('exit', resolve));
  };

  // Node takes around a tenth of a second to start, so wait for the writer's
  // own files rather than for a fixed time, or the delete can run first.
  const writerStarted = async () => {
    const started = Date.now();
    while (fs.readdirSync(busy).length < 3) {
      if (Date.now() - started > 5_000) throw new Error('the writer never started writing');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  try {
    const plain = writing(600);
    await writerStarted();
    await expect(fs.promises.rm(dir, { recursive: true, force: true })).rejects.toThrow(/ENOTEMPTY/);
    await plain;

    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(busy, { recursive: true });
    const retried = writing(600);
    await writerStarted();
    await removeProfile(dir);
    await retried;
    // The writer may have recreated it after the delete finished; what matters is
    // that the delete itself succeeded while the writer ran, and nothing is left
    // once it has stopped.
    await removeProfile(dir);
    expect(fs.existsSync(dir)).toBe(false);
  } finally {
    // Once no writer can still be running, so nothing is left however it ended.
    await new Promise((resolve) => setTimeout(resolve, 700));
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

/** A process that writes into `dir` once, `afterMs` from now, and exits. */
function lateWriter(dir: string, afterMs: number): Promise<unknown> {
  const file = path.join(dir, 'home', '.copilot', 'logs', 'late.log');
  const child = spawn(
    process.execPath,
    [
      '-e',
      `setTimeout(()=>{const fs=require('fs');fs.mkdirSync(${JSON.stringify(path.dirname(file))},{recursive:true});` +
        `fs.writeFileSync(${JSON.stringify(file)},'late')},${afterMs})`,
    ],
    { stdio: 'ignore' }
  );
  return new Promise((resolve) => child.once('exit', resolve));
}

test('a profile recreated just after it was deleted is deleted again', async () => {
  // Measured on Positron: a helper started as the application closed and
  // wrote its log after the profile was gone, bringing the folder back.
  const dir = await makeUserDataDir(buggy);
  try {
    // The control: with no watch, the delete returns before the late write
    // and the folder comes back.
    const unwatched = lateWriter(dir, 300);
    await removeProfile(dir, 0);
    await unwatched;
    expect(fs.existsSync(dir)).toBe(true);

    const watched = lateWriter(dir, 300);
    await removeProfile(dir, 1_000);
    await watched;
    expect(fs.existsSync(dir)).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('a profile that keeps coming back is reported, not left in silence', async () => {
  const dir = await makeUserDataDir(buggy);
  const logs = path.join(dir, 'home', 'logs');
  const child = spawn(
    process.execPath,
    [
      '-e',
      `const fs=require('fs');const until=Date.now()+3000;let n=0;` +
        `const t=setInterval(()=>{try{fs.mkdirSync(${JSON.stringify(logs)},{recursive:true});` +
        `fs.writeFileSync(require('path').join(${JSON.stringify(logs)},'f'+(n++)),'x')}catch{}` +
        `if(Date.now()>=until)clearInterval(t)},20)`,
    ],
    { stdio: 'ignore' }
  );
  const exited = new Promise((resolve) => child.once('exit', resolve));
  try {
    await expect(removeProfile(dir, 100)).rejects.toThrow(/kept coming back after it was deleted/);
  } finally {
    await exited;
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
