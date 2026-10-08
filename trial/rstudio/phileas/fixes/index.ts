import { defineFixes } from '@drugstoresushi/phileas';
import { dataViewer } from './data-viewer';
import { script } from './script';
import { rMarkdown } from './r-markdown';
import { rMarkdownFurther } from './r-markdown-further';
import { sessionData } from './session-data';
import { zoomedPlots } from './zoomed-plots';

/**
 * RStudio's Fixes, by the name a Journey or `phileas run --fix` chooses them
 * by. `script` opens a new R script with code in it. `session-data` runs code
 * in the console that leaves objects, history and a plot. `r-markdown` opens
 * the dialog for creating an R Markdown document, and `r-markdown-further`
 * creates the document and adds text and an R chunk at its end.
 * `zoomed-plots` zooms the Plots pane, hiding the others. `data-viewer` shows
 * `mtcars` in the data viewer. `--fix none`, or no `--fix`, starts wherever
 * RStudio starts.
 */
export const fixes = defineFixes({
  script,
  'session-data': sessionData,
  'r-markdown': rMarkdown,
  'r-markdown-further': rMarkdownFurther,
  'zoomed-plots': zoomedPlots,
  'data-viewer': dataViewer,
});
