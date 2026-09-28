import { defineFixes } from '@drugstoresushi/phileas';
import { addLegThenBuy } from './add-leg-then-buy';
import { openAlps } from './open-alps';

/**
 * The demo's Fixes, by the name the Journey or `phileas run --fix` chooses
 * them by: `open-alps`, the Journey's own, opens an itinerary in one step, and
 * `add-leg-then-buy` ends in the ticket purchase dialog after several.
 * `--fix none` runs with no Fix, starting wherever the application starts.
 */
export const fixes = defineFixes({
  'open-alps': openAlps,
  'add-leg-then-buy': addLegThenBuy,
});
