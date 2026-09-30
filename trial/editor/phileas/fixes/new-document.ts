import type { Fix } from '@drugstoresushi/phileas';

/**
 * What the new document holds: headings for the Table of Contents and Jump
 * to Heading to list, every kind of list the Format menu makes, emphasis,
 * a code block and a table, and a link within the document. No link leads
 * out of the application; the preview sends those to the browser, which the
 * engine's stub catches but a Route learns nothing from.
 */
const MARKDOWN = [
  '# Weekend plans',
  '',
  'A few *ideas* for **Saturday**, and one ~~cancelled~~ one.',
  '',
  '## Errands',
  '',
  '- Hardware store',
  '- Library returns',
  '  - Two novels',
  '',
  '## Cooking',
  '',
  '1. Soak the beans',
  '2. Bake the bread',
  '3. Make the soup',
  '',
  '- [x] Buy flour',
  '- [ ] Buy leeks',
  '',
  '> Keep the oven at 220 for the first twenty minutes.',
  '',
  '```js',
  'const loaves = 2',
  '```',
  '',
  '| Day | Plan |',
  '| --- | --- |',
  '| Sat | Errands |',
  '| Sun | Cooking |',
  '',
  '[Back to the errands](#errands)',
  '',
].join('\n');

/**
 * A Fix that opens a second document, beside the welcome note a first run
 * shows, and fills it with markdown, so every Route's Trip begins with two
 * documents to move between and one with something in it for each menu.
 *
 * Written one step at a time from `phileas survey`, on 2026-09-30. The text
 * goes in with `insertText` rather than typed key by key: the editor
 * continues a list on Enter, so typing the lists would double their markers.
 * A new document does not take the focus from the menu that made it, measured
 * that day, so a step clicks into it first: named by its window, since both
 * documents' editors are a textbox called "Source", and the welcome note is
 * the first, so this one is always Untitled 2. The last step waits for the
 * first heading to be drawn, which also shows that the text landed.
 */
export const newDocument: Fix = async ({ page, hop, step }) => {
  await hop('menuitem "File"');
  await hop('menuitem "New"');
  await step('click into the new document', () =>
    page.getByRole('group', { name: 'Untitled 2' }).getByRole('textbox', { name: 'Source' }).click()
  );
  await step('put the markdown into the new document', () => page.keyboard.insertText(MARKDOWN));
  await step('wait for the text to be drawn in the source', () =>
    page.locator('.cm-content').getByText('# Weekend plans').first().waitFor({ timeout: 10_000 })
  );
};
