import { defineFixes } from '@drugstoresushi/phileas';
import { dataViewer } from './data-viewer/data-viewer';
import { dataViewerPaged } from './data-viewer/data-viewer-paged';
import { dataViewerWide } from './data-viewer/data-viewer-wide';
import { script } from './source/script';
import { rMarkdown } from './source/r-markdown';
import { rMarkdownFurther } from './source/r-markdown-further';
import { sessionData } from './console/session-data';
import { zoomedPlots } from './plots/zoomed-plots';

/**
 * RStudio's Fixes, by the name a Journey or `phileas run --fix` chooses them
 * by. `script` opens a new R script with code in it. `session-data` runs code
 * in the console that leaves objects, history and a plot. `r-markdown` opens
 * the dialog for creating an R Markdown document, and `r-markdown-further`
 * creates the document and adds text and an R chunk at its end.
 * `zoomed-plots` zooms the Plots pane, hiding the others. `data-viewer` shows
 * `mtcars` in the data viewer, `data-viewer-paged` a frame of 1,000 rows
 * by 120 columns, `paged`, which the Environment pane lists too, and
 * `data-viewer-wide` one of 1,000 rows by 450, `wide`, past the ~200 columns
 * where the footer starts counting the columns in view. `--fix none`, or no
 * `--fix`, starts wherever RStudio starts.
 */
export const fixes = defineFixes({
  script,
  'session-data': sessionData,
  'r-markdown': rMarkdown,
  'r-markdown-further': rMarkdownFurther,
  'zoomed-plots': zoomedPlots,
  'data-viewer': dataViewer,
  'data-viewer-paged': dataViewerPaged,
  'data-viewer-wide': dataViewerWide,
});
