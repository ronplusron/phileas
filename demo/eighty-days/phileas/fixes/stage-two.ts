import { type Fix } from '@drugstoresushi/phileas';
import { toHongKong } from './hong-kong';

/**
 * The Fixes stage two's sections start from, one for each place a planted bug
 * sits late in the game, so a section's Trip begins near its bug rather than
 * needing a seed that wanders there from London.
 *
 * **No plant sits on any of these paths.** A Fix that walked through a planted
 * bug would fail inside the Fix on every Route, which is one Fix failure and
 * never reaches the Trip. So these go to Hong Kong by the book, on by the
 * Tankadere rather than the Carnatic, whose booking is `carnatic-log-error`;
 * cross the prairie with the sail down, since hoisting it is
 * `sail-console-error`; and take coal on the Henrietta, since burning her
 * woodwork is `coal-hang`. `docs/DEMO_PLAN_EIGHTY_DAYS.md` has the plants.
 *
 * **Two stop one step short, and say so.** A Trip reaches a plant by chance,
 * and two of them sit behind a step that is rarely drawn before the Route
 * moves on. At Kholby the offer is raised three times of the four the owner
 * holds out for, so one raise is left to the Trip; at Fort Kearney the
 * sledge's own tab is opened, so hoisting the sail is left to it. Neither is
 * the planted step itself.
 *
 * Every line is a control as `phileas survey` prints it.
 */

/** London to Kholby by the book, and the offer for Kiouni raised to £1,800. */
export const toKholby: Fix = async ({ hop }) => {
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
};

/** Hong Kong to Fort Kearney by the book's own way after the Carnatic is missed. */
const onToFortKearney: Fix = async (steps) => {
  const { hop } = steps;
  await toHongKong(steps);
  await hop('button "Charter the Tankadere to Shanghai"');
  await hop('button "Board the American steamer for Yokohama"');
  await hop('button "Book (⌘B)"');
  await hop('button "Sail on the General Grant for San Francisco"');
  await hop('button "Book (⌘B)"');
  await hop('button "Take the Pacific Railroad for New York"');
  await hop('button "Book (⌘B)"');
  await hop('button "Rejoin the train eastward"');
};

/** On the prairie at Fort Kearney, with the sledge's own tab open. */
export const toFortKearney: Fix = async (steps) => {
  await onToFortKearney(steps);
  await steps.hop('tab "Sledge"');
};

/** On to New York by the sledge with its sail down, and the train. */
export const toNewYork: Fix = async (steps) => {
  const { hop } = steps;
  await onToFortKearney(steps);
  await hop('button "Sail by sledge to Omaha"');
  await hop('button "Take the train for Chicago and New York"');
  await hop('button "Book (⌘B)"');
};

/** On to London by the Henrietta, with coal taken, and the special from Liverpool. */
export const toLondon: Fix = async (steps) => {
  const { hop } = steps;
  await toNewYork(steps);
  await hop('button "Take passage on the Henrietta"');
  await hop('checkbox "Take coal (£600)"');
  await hop('button "Book (⌘B)"');
  await hop('button "Take the mail train and the boat to Liverpool"');
  await hop('button "Take a special train to London"');
};

/** Into the Reform Club, and the wager won. */
export const toReformClub: Fix = async (steps) => {
  await toLondon(steps);
  await steps.hop('button "Go to the Reform Club"');
};
