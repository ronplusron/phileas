import type { Fix, Journey } from '@drugstoresushi/phileas';
import { accept, demo } from './demo';
import { toHongKong } from './hongkong';

/**
 * Which of the demo's Journeys runs, chosen by `EIGHTY_DAYS_JOURNEY`.
 *
 * `hong-kong`, the default, starts every Route's Trip on the quay at Hong
 * Kong, after the book's own opening; `accept` starts it on the road in
 * London; `no-fix` starts it in the Reform Club with the wager not yet taken.
 * Anything else is refused by name rather than read as the default. This is
 * the demo's own switch, not the engine's.
 */
const journeys: Record<string, { journey: Journey; fix?: Fix }> = {
  'hong-kong': { journey: demo, fix: toHongKong },
  accept: { journey: demo, fix: accept },
  'no-fix': { journey: demo },
};

const chosen = process.env.EIGHTY_DAYS_JOURNEY || 'hong-kong';
const entry = journeys[chosen];
if (!entry) {
  throw new Error(
    `EIGHTY_DAYS_JOURNEY is "${chosen}", which names no Journey. ` +
      `It takes ${Object.keys(journeys).join(' or ')}.`
  );
}

export const { journey, fix } = entry;
