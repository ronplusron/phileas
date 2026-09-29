import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
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
  const writer = (ms: number) => {
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
    const exited = new Promise((resolve) => child.once('exit', resolve));
    return { exited, stop: () => (child.kill(), exited) };
  };
  const writing = (ms: number): Promise<unknown> => writer(ms).exited;

  // Node takes around a tenth of a second to start, so wait for the writer's
  // own files rather than for a fixed time, or the delete can run first.
  const writerStarted = async () => {
    const started = Date.now();
    // Missing counts as empty: a delete that won is followed by the writer
    // making the folder again.
    while ((fs.existsSync(busy) ? fs.readdirSync(busy).length : 0) < 3) {
      if (Date.now() - started > 5_000) throw new Error('the writer never started writing');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  try {
    // The control: a plain delete loses to the writer. The writer runs until
    // stopped, and the delete gets several tries, because under load one try
    // could start after a timed writer had finished, or find the writer off
    // the CPU for its whole walk, and succeed. That once failed `npm test` on
    // 2026-09-28 while passing 8 of 8 alone. After a delete that wins, the
    // writer makes the folder again, so each try waits for its files first.
    const plain = writer(30_000);
    let refused = false;
    try {
      for (let attempt = 0; attempt < 20 && !refused; attempt += 1) {
        await writerStarted();
        refused = await fs.promises.rm(dir, { recursive: true, force: true }).then(
          () => false,
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOTEMPTY') throw error;
            return true;
          }
        );
      }
    } finally {
      await plain.stop();
    }
    expect(refused).toBe(true);

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
