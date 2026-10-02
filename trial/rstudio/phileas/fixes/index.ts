import { defineFixes } from '@drugstoresushi/phileas';
import { script } from './script';
import { rMarkdown } from './r-markdown';
import { sessionData } from './session-data';
import { zoomedPlots } from './zoomed-plots';

/**
 * RStudio's Fixes, by the name a Journey or `phileas run --fix` chooses them
 * by. `script` opens a new R script with code in it. `session-data` runs code
 * in the console that leaves objects, history and a plot. `r-markdown` opens
 * the dialog for creating an R Markdown document. `zoomed-plots` zooms the
 * Plots pane, hiding the others. `--fix none`, or no `--fix`, starts
 * wherever RStudio starts.
 */
export const fixes = defineFixes({
  script,
  'session-data': sessionData,
  'r-markdown': rMarkdown,
  'zoomed-plots': zoomedPlots,
});
