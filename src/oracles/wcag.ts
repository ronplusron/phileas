import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Frame } from '@playwright/test';
import type { AppCheck } from '../app-under-test.js';

/**
 * The optional `wcag-aa` check: axe-core's WCAG 2 A and AA rules, over the
 * page and every frame in it, after every Fix step and Hop of an application
 * whose adapter turns it on (`optionalChecks`).
 *
 * Built first inside RStudio's adapter on 2026-10-13 and moved here on
 * 2026-10-14, since nothing in it was RStudio's. What it asserts comes from a
 * published standard rather than from the application agreeing with itself,
 * which is what an adapter's own check is asked for; it shares the point of
 * that rule, since nothing in it is taken from the application's code.
 */

/** axe-core's source, read on the first check, so an engine that never runs it never reads it. */
let axeSource: string | undefined;

function axe(): string {
  axeSource ??= fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
  return axeSource;
}

/** Puts axe into a frame that lacks it, and says whether it is there now. */
async function load(frame: Frame): Promise<boolean> {
  const has = () => frame.evaluate(() => 'axe' in window).catch(() => false);
  if (await has()) return true;
  await frame.addScriptTag({ content: axe() }).catch(() => undefined);
  return has();
}

/**
 * A selector with each run of attribute tests in one order.
 *
 * axe-core names an element by the attributes it reads, in the order it
 * reads them, which follows how the element was made. RStudio's file
 * dialog's breadcrumb image was `[height="24"][width="25"]` opened from
 * Import Dataset and `[width="25"][height="24"]` from Load workspace, on
 * 2026-10-13 and 2026-10-14, so one fault was two findings.
 */
export function steadySelector(selector: string): string {
  return selector.replace(/(?:\[[^\]]*\])+/g, (run) => (run.match(/\[[^\]]*\]/g) ?? []).sort().join(''));
}

/**
 * One line per element axe faults, as the rule and the element's selector,
 * a frame's elements reached through it with ` >>> `.
 *
 * axe checks a frame only when it is loaded inside that frame too. Loaded
 * into the top document alone, it passed RStudio's data viewer while missing
 * 51 of its 57 violations, measured on 2026-10-13. So a frame it cannot be
 * put into makes the check say it did not run, rather than pass a screen it
 * never saw.
 */
export const wcagCheck: AppCheck = {
  name: 'wcag-aa',
  why: 'Every screen the application reaches should meet WCAG 2 at levels A and AA, as axe-core reads them.',
  async run({ page }) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      if (!(await load(frame))) return { notRun: `axe could not be put into the frame at ${frame.url() || 'about:blank'}` };
    }
    const found = await page.evaluate(async () => {
      const result = await (window as unknown as { axe: { run: (...args: unknown[]) => Promise<any> } }).axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      });
      return result.violations.flatMap((rule: { id: string; nodes: { target: string[] }[] }) =>
        rule.nodes.map((node) => ({ id: rule.id, target: node.target }))
      ) as { id: string; target: string[] }[];
    });
    return found.map(({ id, target }) => `${id}: ${target.map(steadySelector).join(' >>> ')}`);
  },
};
