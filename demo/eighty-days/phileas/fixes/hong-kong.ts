import { type Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that plays the book's own choices from London to Hong Kong, so every
 * Route's Trip starts where the book's Fogg stood on the quay on the 6th of
 * November, with Aouda rescued, Kiouni given to the guide at Allahabad, and the court at
 * Calcutta behind him. From there the three Routes of a Journey go three
 * ways: a known start, and an unpredictable continuation.
 *
 * Every line is a control as `phileas survey` prints it, one step at a time.
 * Twenty-seven steps, which is the book's opening and no more. The Trip's own
 * choices begin at the tavern: whether Passepartout drinks with the stranger
 * decides whether the Carnatic is there to be taken.
 */
export const toHongKong: Fix = async ({ step }) => {
  await step({ kind: 'act', target: 'button "Accept the wager"' });
  await step({ kind: 'act', target: 'button "Take the mail train to Brindisi"' });
  await step({ kind: 'act', target: 'button "Book (⌘B)"' });
  await step({ kind: 'act', target: 'button "Sail on the Mongolia for Suez"' });
  await step({ kind: 'act', target: 'button "Book (⌘B)"' });
  await step({ kind: 'act', target: 'tab "Consulate"' });
  await step({ kind: 'act', target: 'button "Send Passepartout with the passport"' });
  await step({ kind: 'act', target: 'button "Rejoin the Mongolia for Aden"' });
  await step({ kind: 'act', target: 'button "Rejoin the Mongolia for Bombay"' });
  await step({ kind: 'act', target: 'tab "Malabar Hill"' });
  await step({ kind: 'act', target: 'button "Let Passepartout visit Malabar Hill"' });
  await step({ kind: 'act', target: 'button "Take the eight o\'clock train for Calcutta"' });
  await step({ kind: 'act', target: 'button "Book (⌘B)"' });
  await step({ kind: 'act', target: 'button "Raise the offer"' });
  await step({ kind: 'act', target: 'button "Raise the offer"' });
  await step({ kind: 'act', target: 'button "Raise the offer"' });
  await step({ kind: 'act', target: 'button "Raise the offer"' });
  await step({ kind: 'act', target: 'switch "Hire the Parsee guide (£100)"' });
  await step({ kind: 'act', target: 'button "Buy Kiouni"' });
  await step({ kind: 'act', target: 'button "Ride Kiouni into the forest"' });
  await step({ kind: 'act', target: 'button "Rescue the widow"' });
  await step({ kind: 'act', target: 'button "Ride Kiouni on to Allahabad"' });
  await step({ kind: 'act', target: 'button "Take the midday train to Calcutta"' });
  await step({ kind: 'act', target: 'button "Book (⌘B)"' });
  await step({ kind: 'act', target: 'button "Sail on the Rangoon for Hong Kong"' });
  await step({ kind: 'act', target: 'button "Book (⌘B)"' });
  await step({ kind: 'act', target: 'button "Rejoin the Rangoon for Hong Kong"' });
};
