import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix of several steps: open an itinerary, add a leg from Geneva to Zurich,
 * and open the ticket purchase dialog. So every Route's Trip starts inside that
 * dialog, which is what makes the Fix easy to see at work: every Route's first
 * Hops are in a window nothing else in the application opens.
 *
 * Every `act` step's target was copied from `phileas survey`, one step at a
 * time: run the survey, copy the line for the next control, add it here, and
 * run the survey again to see what the screen offers after it. A step for a
 * text field takes the text to type as its `value`.
 *
 * One step could not be written that way, and it is kept on purpose. The From
 * and To dropdowns list the same stations, so the survey prints `option
 * "Zurich"` twice and an `act` step always takes the first, which is in From.
 * docs/OUTSTANDING.md 2.7 records that. So the destination is chosen with a
 * `code` step and ordinary Playwright code, which a Fix can use for anything
 * the survey's names cannot say.
 */
export const addLegThenBuy: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'button "Open Alps by rail"' });
  await step({ kind: 'act', target: 'button "Add a leg"' });
  await step({ kind: 'act', target: 'option "Geneva"' });
  await step({
    kind: 'code',
    label: 'choose Zurich in To',
    action: () =>
      page.getByRole('combobox', { name: 'To' }).selectOption('Zurich').then(() => undefined),
  });
  await step({ kind: 'act', target: 'textbox "Date"', value: '2026-10-01' });
  await step({ kind: 'act', target: 'textbox "Time"', value: '09:30' });
  await step({ kind: 'act', target: 'option "First"' });
  await step({ kind: 'act', target: 'button "Save (⌘S)"' });
  await step({ kind: 'act', target: 'button "Buy tickets"' });
};
