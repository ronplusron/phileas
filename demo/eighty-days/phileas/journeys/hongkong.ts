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
export const toHongKong: Fix = async ({ hop }) => {
  await hop('button "Accept the wager"');
  await hop('button "Take the mail train to Brindisi"');
  await hop('button "Book (⌘B)"');
  await hop('button "Sail on the Mongolia for Suez"');
  await hop('button "Book (⌘B)"');
  await hop('tab "Consulate"');
  await hop('button "Send Passepartout with the passport"');
  await hop('button "Rejoin the Mongolia for Aden"');
  await hop('button "Rejoin the Mongolia for Bombay"');
  await hop('tab "Malabar Hill"');
  await hop('button "Let Passepartout visit Malabar Hill"');
  await hop('button "Take the eight o\'clock train for Calcutta"');
  await hop('button "Book (⌘B)"');
  await hop('button "Raise the offer"');
  await hop('button "Raise the offer"');
  await hop('button "Raise the offer"');
  await hop('button "Raise the offer"');
  await hop('switch "Hire the Parsee guide (£100)"');
  await hop('button "Buy Kiouni"');
  await hop('button "Ride Kiouni into the forest"');
  await hop('button "Rescue the widow"');
  await hop('button "Ride Kiouni on to Allahabad"');
  await hop('button "Take the midday train to Calcutta"');
  await hop('button "Book (⌘B)"');
  await hop('button "Sail on the Rangoon for Hong Kong"');
  await hop('button "Book (⌘B)"');
  await hop('button "Rejoin the Rangoon for Hong Kong"');
};
