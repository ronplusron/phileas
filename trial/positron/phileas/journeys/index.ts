import { defineJourney, type Fix, type Journey } from '@drugstoresushi/phileas';
import { dataExplorer } from './data-explorer';
import { notebook } from './notebook';
import { quarto } from './quarto';
import { session } from './session';

/**
 * The trial's Journeys through Positron, chosen by `POSITRON_JOURNEY`.
 *
 * Unset, or `no-fix`, runs with no Fix, starting wherever Positron starts;
 * `session` runs with a Fix that starts an interpreter session first, and
 * `notebook` and `quarto` with one that opens a new notebook or Quarto
 * document, and `data-explorer` with one that shows a dataset in the data
 * explorer. Anything else is
 * refused by name rather than read as the default. This is the trial's own
 * switch, not the engine's.
 *
 * No seed and no deadlines, for the reasons buggy's Journey gives.
 */
const terms = defineJourney({
  routes: 1,
  tripLength: 20,
});

const journeys: Record<string, { journey: Journey; fix?: Fix }> = {
  'no-fix': { journey: terms },
  session: { journey: terms, fix: session },
  notebook: { journey: terms, fix: notebook },
  quarto: { journey: terms, fix: quarto },
  'data-explorer': { journey: terms, fix: dataExplorer },
};

const chosen = process.env.POSITRON_JOURNEY || 'no-fix';
const entry = journeys[chosen];
if (!entry) {
  throw new Error(
    `POSITRON_JOURNEY is "${chosen}", which names no Journey. ` +
      `It takes ${Object.keys(journeys).join(' or ')}.`
  );
}

export const { journey, fix } = entry;
