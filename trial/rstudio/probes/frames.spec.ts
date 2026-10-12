import type { Frame, Page } from '@playwright/test';
import { createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What RStudio's frames look like to Playwright, before the survey is taught
 * to read inside them (docs/OUTSTANDING.md 1.9). Written on 2026-10-09.
 *
 * Opens the data viewer on `mtcars`, as the `data-viewer` Fix does, and the
 * Help pane on `mean`, then prints for every frame: where it sits in the frame
 * tree, what its iframe element carries, whether script runs in it, what the
 * accessibility snapshot finds inside it, and whether a box read inside it is
 * the frame's own or the page's. The main page is read the same way, as the
 * control.
 */
const test = createTest(rstudio);

const HOPPABLE = new Set([
  'button', 'checkbox', 'combobox', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem',
]);

interface Node {
  role?: string;
  name?: string;
  box?: { x: number; y: number; width: number; height: number };
  children?: (Node | string)[];
  [key: string]: unknown;
}

function say(line: string): void {
  process.stdout.write(`probe frames: ${line}\n`);
}

function named(snapshot: unknown): Node[] {
  const out: Node[] = [];
  const walk = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (node.role && HOPPABLE.has(node.role) && node.name) out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of (Array.isArray(snapshot) ? snapshot : [snapshot]) as Node[]) walk(node);
  return out;
}

function frameNodes(snapshot: unknown): Node[] {
  const out: Node[] = [];
  const walk = (node: Node | string) => {
    if (typeof node === 'string') return;
    if (node.role === 'iframe') out.push({ ...node, children: undefined });
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of (Array.isArray(snapshot) ? snapshot : [snapshot]) as Node[]) walk(node);
  return out;
}

function depth(frame: Frame): number {
  let n = 0;
  for (let up = frame.parentFrame(); up; up = up.parentFrame()) n += 1;
  return n;
}

async function report(page: Page, label: string): Promise<void> {
  say(`--- ${label}: ${page.frames().length} frame(s)`);
  for (const frame of page.frames()) {
    const at = `frame d${depth(frame)} name=${JSON.stringify(frame.name())} url=${frame.url().slice(0, 120)}`;
    const element = await frame.frameElement().catch(() => null);
    if (element) {
      const attributes = await element
        .evaluate((node) =>
          Object.fromEntries(
            ['id', 'name', 'title', 'src', 'sandbox', 'role', 'aria-label', 'class', 'tabindex'].map((key) => [key, (node as Element).getAttribute(key)])
          )
        )
        .catch((error: Error) => ({ unreadable: error.message.split('\n')[0] }));
      say(`${at} element=${JSON.stringify(attributes)} pageBox=${JSON.stringify(await element.boundingBox().catch(() => 'unreadable'))}`);
    } else say(`${at} (main frame)`);

    const script = await frame
      .evaluate(() => ({ origin: location.origin, framed: window.frameElement !== null, inner: [innerWidth, innerHeight] }))
      .catch((error: Error) => `does not run: ${error.message.split('\n')[0]}`);
    say(`  script: ${JSON.stringify(script)}`);

    const started = Date.now();
    const snapshot = await frame.locator('body').ariaSnapshotJSON({ boxes: true, timeout: 5_000 }).catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
    if (typeof snapshot === 'string') {
      say(`  snapshot: ${snapshot}`);
      continue;
    }
    const controls = named(snapshot);
    const roles = new Map<string, number>();
    for (const control of controls) roles.set(control.role ?? '', (roles.get(control.role ?? '') ?? 0) + 1);
    say(`  snapshot in ${Date.now() - started} ms: ${controls.length} named hoppable, by role ${JSON.stringify(Object.fromEntries(roles))}`);
    say(`  iframe nodes in it: ${JSON.stringify(frameNodes(snapshot))}`);
    // Every control inside a frame, the first 8 of the page's own.
    for (const control of frame === page.mainFrame() ? controls.slice(0, 8) : controls) say(`    ${control.role} ${JSON.stringify(control.name)} box=${JSON.stringify(control.box)}`);

    // Whose box: the frame's viewport or the page's. Compared with Playwright's
    // own boundingBox, which is always the main frame's.
    const first = controls.find((control) => control.box && control.box.width >= 1);
    if (first?.role && first.name) {
      const locator = frame.getByRole(first.role as Parameters<Page['getByRole']>[0], { name: first.name, exact: true }).first();
      const pageBox = await locator.boundingBox().catch(() => null);
      say(`  box check on ${first.role} ${JSON.stringify(first.name)}: snapshot ${JSON.stringify(first.box)} page ${JSON.stringify(pageBox)}`);
      // What the main page has on top at that control's center, in page coordinates.
      if (pageBox && frame !== page.mainFrame()) {
        const onTop = await page
          .evaluate(([x, y]) => {
            const top = document.elementFromPoint(x, y);
            return top ? `<${top.tagName.toLowerCase()} id="${top.id}" class="${String(top.getAttribute('class')).slice(0, 60)}">` : null;
          }, [pageBox.x + pageBox.width / 2, pageBox.y + pageBox.height / 2] as const)
          .catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
        say(`  on top in the main page at its center: ${onTop}`);
      }
    }
  }

  const ai = await page.locator('body').ariaSnapshotJSON({ mode: 'ai', timeout: 10_000 }).catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
  if (typeof ai !== 'string') {
    say(`ai-mode snapshot of the main page: ${named(ai).length} named hoppable, against default-mode main frame above; iframe nodes ${JSON.stringify(frameNodes(ai))}`);
  } else say(`ai-mode snapshot: ${ai}`);
}

test('the frames of the data viewer and Help', async ({ page }) => {
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await report(page, 'at start, the control');

  await prompt.click();
  await page.keyboard.type('View(mtcars)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /mtcars/ }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await report(page, 'data viewer on mtcars');

  await prompt.click();
  await page.keyboard.type('?mean');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3_000);
  await report(page, 'Help on mean, data viewer still open');
});
