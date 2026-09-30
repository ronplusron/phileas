import type { Fix } from '@drugstoresushi/phileas';
import { session } from './session';

/**
 * A Fix that shows a dataset in the data explorer, so every Route's Trip
 * begins with one open: an R session first, then `View(mtcars)`, a dataset
 * that ships with R, typed into the console.
 *
 * The console's input is not something the survey can name, so that step is
 * Playwright code.
 */
export const dataExplorer: Fix = async (context) => {
  await session(context);
  const { page, step } = context;
  await step({
    kind: 'code',
    label: 'show mtcars in the data explorer',
    action: async () => {
      await page.getByRole('tabpanel').getByRole('textbox').visible().last().focus();
      await page.keyboard.type('View(mtcars)');
      await page.keyboard.press('Enter');
      await page.getByRole('tab', { name: /mtcars/ }).first().waitFor({ timeout: 30_000 });
    },
  });
};
