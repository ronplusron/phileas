import { execFileSync } from 'node:child_process';
import { closeApp, createTest, expect, nativeDialogs } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Whether RStudio's R session outlives RStudio, or only outlives the stray
 * sweep's first look. Written on 2026-10-08: in the RStudio batch of that day
 * the sweep ended an R session left running after 31 of the 32 `session-data`
 * Routes it could be counted on, and 3 of the last 39 with no Fix. The sweep
 * looks as soon as the close returns, so an R session still shutting down
 * reads the same as one left behind.
 *
 * Each case closes RStudio as the engine does, with `closeApp`, then watches
 * the R session for a minute and touches nothing. With code run, as
 * `session-data` runs it; with nothing run, the control.
 */
const test = createTest(rstudio);

const CODE = [
  'df <- data.frame(id = 1:5, score = c(3.2, 4.1, 2.8, 5.0, 3.9), group = c("a", "b", "a", "b", "a"))',
  'm <- lm(score ~ id, data = df)',
  'plot(df$id, df$score)',
];
const WATCH_MS = 60_000;

function rsessionsUnder(pid: number): number[] {
  try {
    return execFileSync('pgrep', ['-P', String(pid), 'rsession'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Why the close with code run was forced, measured the same day: each one
 * waited out the engine's 10 s and was killed. Asked to close, does RStudio
 * put up a question in its page? Nothing is answered; the fixture's own close
 * then ends it.
 */
test('code run, then the window asked to close: what RStudio shows', async ({ page, app }) => {
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await prompt.click();
  for (const line of CODE) {
    await page.keyboard.type(line);
    await page.keyboard.press('Enter');
  }
  await page.getByText('5 obs. of 3 variables').first().waitFor({ timeout: 15_000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await page.waitForTimeout(3_000);
  const dialogs = await page.getByRole('dialog').allInnerTexts().catch(() => ['(the page did not answer)']);
  process.stdout.write(`probe close asked: ${dialogs.length} dialog(s) in the page: ${JSON.stringify(dialogs.map((text) => text.replace(/\s+/g, ' ').slice(0, 200)))}\n`);
  // A native message box is answered by the engine's stub, as Escape would.
  const native = await nativeDialogs(app).catch((error: Error) => [{ kind: `unreadable: ${error.message}` }]);
  process.stdout.write(`probe close asked: native dialogs the stub answered: ${JSON.stringify(native)}\n`);
  const open = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length).catch(() => -1);
  process.stdout.write(`probe close asked: windows still open: ${open}\n`);
  const saveText = await page.getByText(/save workspace/i).count().catch(() => -1);
  process.stdout.write(`probe close asked: elements naming "save workspace": ${saveText}\n`);
  if (process.env.PROBE_SCREENSHOT) await page.screenshot({ path: process.env.PROBE_SCREENSHOT, timeout: 5_000 }).catch(() => undefined);
});

for (const withCode of [true, false]) {
  for (const n of [1, 2, 3]) {
    test(`${withCode ? 'code run' : 'nothing run'}, ${n}`, async ({ page, launched }) => {
      const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
      await prompt.waitFor({ timeout: 30_000 });
      if (withCode) {
        await prompt.click();
        for (const line of CODE) {
          await page.keyboard.type(line);
          await page.keyboard.press('Enter');
        }
        await page.getByText('5 obs. of 3 variables').first().waitFor({ timeout: 15_000 });
      }

      // The positive control for the watch: an R session is there to watch.
      const main = launched.app.process().pid ?? 0;
      const sessions = rsessionsUnder(main);
      expect(sessions, `no rsession under RStudio's main process ${main}`).toHaveLength(1);
      const session = sessions[0] ?? 0;

      const verdict = await closeApp(rstudio, launched);
      const closedAt = Date.now();
      let gone: number | undefined;
      while (Date.now() - closedAt < WATCH_MS) {
        if (!alive(session)) {
          gone = Date.now() - closedAt;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const how = verdict.forced ? 'forced' : 'orderly';
      process.stdout.write(
        `probe ${withCode ? 'code run' : 'nothing run'} ${n}: close ${how}; rsession ${session} ` +
          (gone === undefined ? `still running ${WATCH_MS} ms after the close\n` : `exited ${gone} ms after the close\n`)
      );
    });
  }
}
