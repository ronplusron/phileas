import type { AppCheck } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/**
 * A document marked unsaved has Save enabled, and one not marked has it
 * disabled, read on the document the Source pane has selected. Two places on
 * screen stating one fact (R18), from docs/OUTSTANDING.md 2.30's second
 * candidate.
 *
 * **Measured on RStudio 2026.10.0, not taken from its code,** by
 * `trial/rstudio/probes/intent-candidates.spec.ts` and `save-follows.spec.ts`
 * on 2026-10-15 and 2026-10-16:
 * - A tab marked unsaved shows its name with " *" after it, and the main
 *   toolbar's Save is enabled; saving clears both, typing brings both back.
 * - The main Save follows the selected tab alone: a data viewer selected has
 *   no mark and Save disabled, even with an unsaved script behind it, and
 *   Help shown or the console focused changes nothing.
 * - **A never-saved document is the exception:** a new `Untitled1` with
 *   nothing typed has no mark and Save enabled, since it can always be saved
 *   to choose its name. So for one named `Untitled` and a number, only a mark
 *   means Save enabled. Agreed on 2026-10-16 in the words "the check holds
 *   both ways on the selected document, except a never-saved Untitled
 *   document, where only the unsaved mark means Save enabled."
 * - **Only the text that shows tells a mark.** A tab's `textContent` holds a
 *   hidden " *" on every tab, unsaved or not, so it is read with `innerText`.
 *
 * It applies wherever the Source pane has a document selected, and reads the
 * live page at the moment the checks run, as the probes did.
 */
const SAVE = 'Save current document (⌘S)';

/** A tab's name as it shows, with a mark of " *" at its end when unsaved. */
const MARKED = /\s\*$/;

/** A document RStudio names until it is first saved. */
const NEVER_SAVED = /^Untitled\d+$/;

const selectedTab = (page: Page) =>
  page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { selected: true }).first();

export const unsavedMarkMatchesSave: AppCheck = {
  name: 'unsaved-mark-matches-save',
  why:
    "The Source pane's selected document is marked unsaved exactly when the main toolbar's Save is " +
    'enabled, except a never-saved Untitled document, which can always be saved. Measured on ' +
    'RStudio 2026.10.0 on 2026-10-16.',

  appliesWhen: async ({ page }) => (await selectedTab(page).count()) > 0,

  async run({ page }) {
    const tab = selectedTab(page);
    const shown = (await tab.innerText()).replace(/\s+/g, ' ').trim();
    const save = page.getByRole('toolbar', { name: 'Main' }).getByRole('button', { name: SAVE, exact: true });
    if ((await save.count()) === 0) return { notRun: "the main toolbar has no Save button to compare the tab's mark with" };
    const enabled = !(await save.first().isDisabled());
    const marked = MARKED.test(shown);
    const name = shown.replace(MARKED, '');
    if (marked && !enabled) {
      return [`the selected tab "${shown}" is marked unsaved, and the main toolbar's Save is disabled`];
    }
    if (!marked && enabled && !NEVER_SAVED.test(name)) {
      return [`the selected tab "${shown}" is not marked unsaved, and the main toolbar's Save is enabled`];
    }
    return [];
  },
};
