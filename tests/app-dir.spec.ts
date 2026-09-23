import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { requireAppDir, APP_DIR_VARIABLE } from '../src/index';

/**
 * Where an adapter outside the application finds the application's checkout.
 *
 * Every case but the last is a refusal, because the failure this guards against
 * is an adapter building a path out of nothing and the run failing later, in a
 * place that says nothing about why. R24 asks for the missing thing to be named.
 */

function withAppDir<T>(value: string | undefined, body: () => T): T {
  const before = process.env[APP_DIR_VARIABLE];
  if (value === undefined) delete process.env[APP_DIR_VARIABLE];
  else process.env[APP_DIR_VARIABLE] = value;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env[APP_DIR_VARIABLE];
    else process.env[APP_DIR_VARIABLE] = before;
  }
}

test('unset or blank is refused, and the refusal names the variable', () => {
  for (const value of [undefined, '', '   ']) {
    expect(() => withAppDir(value, requireAppDir)).toThrow(/PHILEAS_APP_DIR is not set/);
  }
});

test('a path that does not exist is refused, and the refusal quotes it', () => {
  const missing = path.join(os.tmpdir(), 'phileas-no-such-checkout-9f2c');
  expect(() => withAppDir(missing, requireAppDir)).toThrow(/is not a folder/);
  expect(() => withAppDir(missing, requireAppDir)).toThrow(missing);
});

test('a file is refused, since a checkout is a folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-app-dir-'));
  const file = path.join(dir, 'package.json');
  fs.writeFileSync(file, '{}');
  expect(() => withAppDir(file, requireAppDir)).toThrow(/is not a folder/);
});

test('a real folder is returned as an absolute path', () => {
  // The positive control for the refusals above: a check that refused
  // everything would pass all three of them.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-app-dir-'));
  expect(withAppDir(dir, requireAppDir)).toBe(dir);

  // A relative path is resolved against where the run was started.
  const relative = path.relative(process.cwd(), dir);
  expect(withAppDir(relative, requireAppDir)).toBe(path.resolve(relative));
});
