import fs from 'node:fs';
import path from 'node:path';
import { createTest } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';

/**
 * Which pyrefly a Route's profile holds after a minute: the 1.2.0 bundled in
 * the app, or a newer one fetched by extension auto-update. Measured on
 * 2026-10-09, before the adapter turned auto-update off, as 1.3.2, fetched.
 * Each case launches Positron as a Route does, waits, and lists the profile's
 * extensions; the browser console is read for js-debug's refused update.
 */
const test = createTest(positron);

for (const n of [1, 2]) {
  test(`extensions a minute after launch, ${n}`, async ({ page, userDataDir }) => {
    const refused: string[] = [];
    page.on('console', (message) => {
      if (/not allowed to be updated/.test(message.text())) refused.push(message.text().slice(0, 120));
    });
    await page.waitForTimeout(60_000);
    const pyrefly = fs.readdirSync(path.join(userDataDir, 'extensions')).filter((name) => name.startsWith('meta.pyrefly'));
    process.stdout.write(`probe extensions ${n}: ${pyrefly.join(', ') || 'no pyrefly'}; refused updates: ${refused.length}\n`);
  });
}
