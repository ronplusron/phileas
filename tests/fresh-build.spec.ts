import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { staleSources, requireFreshBuild, ALLOW_STALE_BUILD_VARIABLE } from '../src/index';
import { scratch, removeScratch } from './scratch';

/**
 * The compiled engine refusing to load when its source is newer.
 *
 * Everything in this repository that imports the engine by name runs the
 * compiled copy, so a stale one would quietly test the old engine. Each case
 * builds a source checkout of its own, with times set by hand.
 */

test.afterEach(removeScratch);

/** A checkout with `src/` files and a `dist/index.js`, built at `builtAt`. */
function checkout(sources: Record<string, number>, builtAt: number | undefined): string {
  const root = scratch('fresh-build-');
  for (const [file, at] of Object.entries(sources)) {
    const full = path.join(root, 'src', file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
    fs.utimesSync(full, at, at);
  }
  fs.mkdirSync(path.join(root, 'dist'));
  if (builtAt !== undefined) {
    const built = path.join(root, 'dist', 'index.js');
    fs.writeFileSync(built, '');
    fs.utimesSync(built, builtAt, builtAt);
  }
  return path.join(root, 'dist');
}

function withAllowStale<T>(value: string | undefined, body: () => T): T {
  const before = process.env[ALLOW_STALE_BUILD_VARIABLE];
  if (value === undefined) delete process.env[ALLOW_STALE_BUILD_VARIABLE];
  else process.env[ALLOW_STALE_BUILD_VARIABLE] = value;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env[ALLOW_STALE_BUILD_VARIABLE];
    else process.env[ALLOW_STALE_BUILD_VARIABLE] = before;
  }
}

test('a build newer than every source file loads', () => {
  const dist = checkout({ 'index.ts': 100, 'route.ts': 200, 'known.mjs': 300 }, 400);
  expect(staleSources(dist)).toEqual([]);
  withAllowStale(undefined, () => expect(() => requireFreshBuild(dist)).not.toThrow());
});

test('a source file newer than the build is refused, and named', () => {
  const dist = checkout({ 'index.ts': 100, 'route.ts': 500, 'report/render.mjs': 600 }, 400);
  expect(staleSources(dist)).toEqual([path.join('report', 'render.mjs'), 'route.ts']);
  withAllowStale(undefined, () =>
    expect(() => requireFreshBuild(dist)).toThrow(/older than its source: report.render\.mjs, route\.ts\. Run `npm run build`/)
  );
});

test('a stale build loads when the variable allows it for the run', () => {
  const dist = checkout({ 'index.ts': 500 }, 400);
  withAllowStale('1', () => expect(() => requireFreshBuild(dist)).not.toThrow());
});

test('an installed copy, with no TypeScript source beside it, is not checked', () => {
  // A package ships its `.mjs` source and no `index.ts`, so this is the shape
  // of an installed engine: nothing to compare against, whatever the times.
  const dist = checkout({ 'known.mjs': 500 }, 400);
  expect(staleSources(dist)).toEqual([]);
});

test('a checkout that was never built is not checked here', () => {
  // Nothing is loaded from a dist/ with no index.js, so there is no stale
  // engine to refuse; the import itself fails, and says what is missing.
  const dist = checkout({ 'index.ts': 500 }, undefined);
  expect(staleSources(dist)).toEqual([]);
});
