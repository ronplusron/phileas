import type { Fix, Journey } from '@drugstoresushi/phileas';
import { demo, openAlps } from './demo';
import { tickets, addLegThenBuy } from './tickets';

/**
 * Which of the demo's Journeys runs, chosen by `RAIL_DEMO_JOURNEY`.
 *
 * Unset, or `open-alps`, runs the one-step Fix; `tickets` runs the Fix of
 * several steps, which ends in the ticket purchase dialog; `no-fix` runs with
 * no Fix at all, starting wherever the application starts. Anything else is
 * refused by name rather than read as the default. This is the demo's own
 * switch, not the engine's: a consuming repository with several Journeys
 * chooses among them however suits it.
 */
const journeys: Record<string, { journey: Journey; fix?: Fix }> = {
  'open-alps': { journey: demo, fix: openAlps },
  tickets: { journey: tickets, fix: addLegThenBuy },
  'no-fix': { journey: demo },
};

const chosen = process.env.RAIL_DEMO_JOURNEY || 'open-alps';
const entry = journeys[chosen];
if (!entry) {
  throw new Error(
    `RAIL_DEMO_JOURNEY is "${chosen}", which names no Journey. ` +
      `It takes ${Object.keys(journeys).join(' or ')}.`
  );
}

export const { journey, fix } = entry;
