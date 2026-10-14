import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame } from '@playwright/test';

const source = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/** Puts axe into a frame that lacks it, and says whether it is there now. */
async function load(frame: Frame): Promise<boolean> {
  const has = () => frame.evaluate(() => 'axe' in window).catch(() => false);
  if (await has()) return true;
  await frame.addScriptTag({ content: source }).catch(() => undefined);
  return has();
}

/**
 * axe-core's WCAG 2 A and AA rules, over the page and every frame in it.
 *
 * axe checks a frame only when it is loaded inside that frame too. Loaded
 * into the top document alone, it passed RStudio's data viewer while missing
 * 51 of its 57 violations, measured on 2026-10-13 with
 * `probes/axe.spec.ts`. So a frame it cannot be put into makes the check say
 * it did not run, rather than pass a screen it never saw.
 */
export const wcag: AppCheck = {
  name: 'wcag-aa',
  why: 'Every screen RStudio reaches should meet WCAG 2 at levels A and AA, as axe-core reads them.',
  async run({ page }) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      if (!(await load(frame))) return { notRun: `axe could not be put into the frame at ${frame.url() || 'about:blank'}` };
    }
    const lines = await page.evaluate(async () => {
      const result = await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      return result.violations.flatMap((rule: any) =>
        rule.nodes.map((node: any) => `${rule.id}: ${node.target.join(' >>> ')}`)
      ) as string[];
    });
    return lines;
  },
};
