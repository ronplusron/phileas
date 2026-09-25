import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The demo's Journey with a Fix of several steps.
 *
 * Its terms match the first Journey's, so the only difference between the two
 * is where each Route's Trip begins.
 */
export const tickets = defineJourney({
  routes: 3,
  tripLength: 50,
});

/**
 * A Fix of several steps: open an itinerary, add a leg from Geneva to Zurich,
 * and open the ticket purchase dialog. So every Route's Trip starts inside that
 * dialog, which is what makes the Fix easy to see at work: every Route's first
 * Hops are in a window nothing else in the application opens.
 *
 * Every `hop()` line was copied from `phileas survey`, one step at a time: run
 * the survey, copy the line for the next control, add it here, and run the
 * survey again to see what the screen offers after it. A line for a text field
 * takes the text to type as its second argument.
 *
 * One step could not be written that way, and it is kept on purpose. The From
 * and To dropdowns list the same stations, so the survey prints `option
 * "Zurich"` twice and `hop()` always takes the first, which is in From.
 * docs/OUTSTANDING.md 2.7 records that. So the destination is chosen with
 * `step()` and ordinary Playwright code, which a Fix can use for anything the
 * survey's names cannot say.
 */
export const addLegThenBuy: Fix = async ({ page, hop, step }) => {
  await hop('button "Open Alps by rail"');
  await hop('button "Add a leg"');
  await hop('option "Geneva"');
  await step('choose Zurich in To', () =>
    page.getByRole('combobox', { name: 'To' }).selectOption('Zurich').then(() => undefined)
  );
  await hop('textbox "Date"', '2026-10-01');
  await hop('textbox "Time"', '09:30');
  await hop('option "First"');
  await hop('button "Save (⌘S)"');
  await hop('button "Buy tickets"');
};
