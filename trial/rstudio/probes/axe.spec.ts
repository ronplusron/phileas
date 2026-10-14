import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Frame, Page } from '@playwright/test';
import { createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What axe-core reports on RStudio's opening screen and its data viewer, and
 * how long it takes. Written on 2026-10-13 to size an accessibility check
 * before any is written; `phileas/adapter/wcag.ts` is the check it sized.
 * Each fault prints with its element and axe's reason.
 *
 * In each state axe runs twice before it is put into any new frame, then
 * twice after, so the output shows what a check loaded only into the top
 * document misses, and whether two scans of one screen agree.
 */
const test = createTest(rstudio);
const AXE_PATH = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const TAGS = ['wcag2a', 'wcag2aa'];

function say(line: string): void {
  process.stdout.write(`probe axe: ${line}\n`);
}

async function load(frame: Frame, source: string): Promise<string> {
  if (await frame.evaluate(() => 'axe' in window).catch(() => false)) return 'already';
  await frame.addScriptTag({ content: source }).catch(() => undefined);
  if (await frame.evaluate(() => 'axe' in window).catch(() => false)) return 'script tag';
  await frame.evaluate(source).catch(() => undefined);
  return (await frame.evaluate(() => 'axe' in window).catch(() => false)) ? 'evaluate' : 'failed';
}

type Found = { id: string; impact: string; targets: string[] }[];

async function scan(page: Page, label: string): Promise<Set<string>> {
  const started = Date.now();
  const result = await page
    .evaluate(async (tags) => {
      const r = await (window as any).axe.run(document, { runOnly: { type: 'tag', values: tags } });
      const pick = (list: any[]): Found =>
        list.map((v) => ({
          id: v.id,
          impact: String(v.impact),
          targets: v.nodes.map((n: any) => `${n.target.join(' >>> ')}\n      ${n.html.slice(0, 200)}\n      ${String(n.failureSummary).replace(/\n/g, ' / ')}`),
        }));
      return { violations: pick(r.violations), incomplete: pick(r.incomplete) };
    }, TAGS)
    .catch((error: Error) => ({ error: error.message.split('\n')[0] }));
  const ms = Date.now() - started;
  if ('error' in result) {
    say(`${label}: failed after ${ms} ms: ${result.error}`);
    return new Set();
  }
  const nodes = result.violations.reduce((sum, v) => sum + v.targets.length, 0);
  say(`${label}: ${ms} ms, ${result.violations.length} rules violated, ${nodes} nodes`);
  for (const v of result.violations) {
    say(`  ${v.id} (${v.impact}): ${v.targets.length} nodes; ${v.targets.slice(0, 4).join(' | ')}`);
  }
  for (const v of result.incomplete) say(`  needs review, ${v.id}: ${v.targets.length} nodes`);
  return new Set(result.violations.flatMap((v) => v.targets.map((t) => `${v.id}: ${t}`)));
}

function compare(a: Set<string>, b: Set<string>, label: string): void {
  const onlyA = [...a].filter((x) => !b.has(x));
  const onlyB = [...b].filter((x) => !a.has(x));
  say(`${label}: ${onlyA.length || onlyB.length ? `DIFFER, ${onlyA.length} only first, ${onlyB.length} only second` : 'same'}`);
  for (const x of [...onlyA, ...onlyB].slice(0, 6)) say(`  ${x}`);
}

async function measure(page: Page, source: string, label: string): Promise<void> {
  say(`--- ${label}`);
  say(`frames: ${page.frames().length}; ${page.frames().map((f) => f.url().slice(0, 70) || '(blank)').join(' | ')}`);
  say(`top document: ${await load(page.mainFrame(), source)}`);
  const a = await scan(page, 'top only, first');
  const b = await scan(page, 'top only, second');
  compare(a, b, 'top only, two scans');
  for (const frame of page.frames().slice(1)) say(`frame ${frame.url().slice(0, 70) || '(blank)'}: ${await load(frame, source)}`);
  const c = await scan(page, 'every frame, first');
  const d = await scan(page, 'every frame, second');
  compare(c, d, 'every frame, two scans');
  compare(b, c, 'top only against every frame');
}

test('axe on the opening screen and the data viewer', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const source = fs.readFileSync(AXE_PATH, 'utf8');
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await measure(page, source, 'opening screen');

  await prompt.click();
  await page.keyboard.type('View(mtcars)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /mtcars/ }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await measure(page, source, 'data viewer');
});
