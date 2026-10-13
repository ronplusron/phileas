import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { keepRouteOutput, OUTPUT_FOLDER } from '../src/index';

/**
 * A Journey's end copies each Route's Playwright output into the run's own
 * folder, since Playwright empties its output folder at the start of every
 * run and a later run deleted the traces of the one before. Measured on
 * RStudio on 2026-10-13, when a probe run removed an accessibility
 * Journey's three traces minutes after it ended.
 */

let root: string;
test.beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-output-'));
});
test.afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A run folder holding one journal whose opening names `outputDir`, or none. */
function runWith(name: string, outputDir?: string): string {
  const run = path.join(root, 'journals', 'seed', 'run');
  fs.mkdirSync(run, { recursive: true });
  const opening = { kind: 'route', routeNumber: 1, ...(outputDir === undefined ? {} : { outputDir }) };
  fs.writeFileSync(path.join(run, `${name}.jsonl`), `${JSON.stringify(opening)}\n{"kind":"outcome"}\n`);
  return run;
}

test("a Route's output is copied into the run folder, under its journal's name, and left where it was", () => {
  const output = path.join(root, 'test-results', 'journey-route-1');
  fs.mkdirSync(path.join(output, 'attachments'), { recursive: true });
  fs.writeFileSync(path.join(output, 'attachments', 'trace.zip'), 'trace');
  fs.writeFileSync(path.join(output, 'error-context.md'), 'context');
  const run = runWith('route-001-abc', path.relative(path.join(root, 'journals', 'seed', 'run'), output));

  const kept = keepRouteOutput(run);

  expect(kept).toEqual({ folder: path.join(run, OUTPUT_FOLDER), kept: 1, empty: 0 });
  const copy = path.join(run, OUTPUT_FOLDER, 'route-001-abc');
  expect(fs.readFileSync(path.join(copy, 'attachments', 'trace.zip'), 'utf8')).toBe('trace');
  expect(fs.readFileSync(path.join(copy, 'error-context.md'), 'utf8')).toBe('context');
  expect(fs.existsSync(path.join(output, 'attachments', 'trace.zip'))).toBe(true);
});

test('a later run emptying the output folder leaves the copy, which is the case this exists for', () => {
  const output = path.join(root, 'test-results', 'journey-route-1');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'window.png'), 'shot');
  const run = runWith('route-001-abc', path.relative(path.join(root, 'journals', 'seed', 'run'), output));
  keepRouteOutput(run);

  fs.rmSync(path.join(root, 'test-results'), { recursive: true });

  expect(fs.readFileSync(path.join(run, OUTPUT_FOLDER, 'route-001-abc', 'window.png'), 'utf8')).toBe('shot');
});

test('a Route that wrote no output is counted, and makes no folder', () => {
  const run = runWith('route-001-abc', '../../../test-results/journey-route-1');
  expect(keepRouteOutput(run)).toEqual({ folder: path.join(run, OUTPUT_FOLDER), kept: 0, empty: 1 });
  expect(fs.existsSync(path.join(run, OUTPUT_FOLDER))).toBe(false);
});

test('an empty output folder, as a passing Route leaves, counts as none written', () => {
  const output = path.join(root, 'test-results', 'journey-route-1');
  fs.mkdirSync(output, { recursive: true });
  const run = runWith('route-001-abc', path.relative(path.join(root, 'journals', 'seed', 'run'), output));
  expect(keepRouteOutput(run)).toEqual({ folder: path.join(run, OUTPUT_FOLDER), kept: 0, empty: 1 });
  expect(fs.existsSync(path.join(run, OUTPUT_FOLDER))).toBe(false);
});

test('a journal from before output was recorded is passed over', () => {
  const run = runWith('route-001-abc');
  expect(keepRouteOutput(run)).toEqual({ folder: path.join(run, OUTPUT_FOLDER), kept: 0, empty: 0 });
});
