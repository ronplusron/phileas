import { spawn } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { prepareFirstLine } from '../src/first-line';

/**
 * The first-line install, on a plain Node process rather than an application:
 * the pause and the inspector are Node's, so what holds here holds under
 * Electron's main process, and each case costs a fraction of a launch.
 */

/** Run `program` under a first-line install of `script`, and hand back what it printed. */
async function underFirstLine(script: string, program: string) {
  const firstLine = await prepareFirstLine(script, 10_000);
  const child = spawn(process.execPath, [firstLine.launchArg, '-e', program], { stdio: ['ignore', 'pipe', 'pipe'] });
  let printed = '';
  child.stdout.on('data', (chunk) => (printed += String(chunk)));
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
  const installed = await firstLine.run().then(
    () => undefined,
    (error: unknown) => error
  );
  return { installed, code: await exited, printed: printed.trim() };
}

test('the script runs before the program, which then goes on as it would have', async () => {
  const { installed, code, printed } = await underFirstLine(
    `globalThis.putThereFirst = 'before the first line'`,
    `console.log(globalThis.putThereFirst ?? 'nothing was there')`
  );
  expect(installed).toBeUndefined();
  expect(code).toBe(0);
  expect(printed).toBe('before the first line');
});

test('a script that throws is reported, and the program is still let go on', async () => {
  // Left paused, the program would hold the launch until its timeout, and the
  // failure would read as a launch that timed out.
  const { installed, code, printed } = await underFirstLine(`(() => { throw new Error('planted') })()`, `console.log('went on')`);
  expect(String(installed)).toMatch(/The first-line script threw in the application's main process: Error: planted/);
  expect(code).toBe(0);
  expect(printed).toBe('went on');
});
