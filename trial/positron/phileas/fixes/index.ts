import { defineFixes } from '@drugstoresushi/phileas';
import { dataExplorer } from './data-explorer';
import { notebook } from './notebook';
import { quarto } from './quarto';
import { session } from './session';

/**
 * The trial's Fixes, by the name a Journey or `phileas run --fix` chooses
 * them by: `session` starts an interpreter session, `notebook` and `quarto`
 * open a new notebook or Quarto document, and `data-explorer` shows a dataset
 * in the data explorer. `--fix none`, or no `--fix`, runs with no Fix,
 * starting wherever Positron starts.
 */
export const fixes = defineFixes({
  session,
  notebook,
  quarto,
  'data-explorer': dataExplorer,
});
