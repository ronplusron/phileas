import type { AppCheck, AppRelation } from '@drugstoresushi/phileas';
import { dataViewerCountsMatchEnvironment } from './data-viewer/data-viewer-counts-match-environment';
import { dataViewerFooterColumnsInView } from './data-viewer/data-viewer-footer-columns-in-view';
import { dataViewerFooterRowsInView } from './data-viewer/data-viewer-footer-rows-in-view';
import { dataViewerSortCycleRestoresOrder } from './data-viewer/data-viewer-sort-cycle-restores-order';
import { dataViewerSortedColumnInOrder } from './data-viewer/data-viewer-sorted-column-in-order';
import { unsavedMarkMatchesSave } from './source/unsaved-mark-matches-save';

/**
 * RStudio's own checks, run after the engine's on each step where each
 * applies, in this order. Each lives in a subfolder for the area of RStudio
 * it reads, as ../../../../CLAUDE.md lays out; its name is the one it
 * declares, never its file's path.
 */
export const checks: readonly AppCheck[] = [
  unsavedMarkMatchesSave,
  dataViewerCountsMatchEnvironment,
  dataViewerSortedColumnInOrder,
  dataViewerFooterRowsInView,
  dataViewerFooterColumnsInView,
];

/**
 * RStudio's own relations, each started by a Hop it names, with a Detour of
 * its own after it, kept in the same area folders as the checks.
 */
export const relations: readonly AppRelation[] = [dataViewerSortCycleRestoresOrder];
