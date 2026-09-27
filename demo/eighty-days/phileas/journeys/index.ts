import type { Fix, Journey } from '@drugstoresushi/phileas';
import { accept, demo } from './demo';

/**
 * Which of the demo's Journeys runs, chosen by `EIGHTY_DAYS_JOURNEY`.
 *
 * `no-fix` starts every Route in the Reform Club with the wager not yet
 * taken; `accept` starts it on the road. Anything else is refused by name
 * rather than read as the default. The plan's `hong-kong` Journey joins these
 * once its Fix is written. This is the demo's own switch, not the engine's.
 */
const journeys: Record<string, { journey: Journey; fix?: Fix }> = {
  accept: { journey: demo, fix: accept },
  'no-fix': { journey: demo },
};

const chosen = process.env.EIGHTY_DAYS_JOURNEY || 'accept';
const entry = journeys[chosen];
if (!entry) {
  throw new Error(
    `EIGHTY_DAYS_JOURNEY is "${chosen}", which names no Journey. ` +
      `It takes ${Object.keys(journeys).join(' or ')}.`
  );
}

export const { journey, fix } = entry;
