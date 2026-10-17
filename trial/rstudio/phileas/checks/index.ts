import type { AppCheck } from '@drugstoresushi/phileas';
import { unsavedMarkMatchesSave } from './source/unsaved-mark-matches-save';

/**
 * RStudio's own checks, run after the engine's on each step where each
 * applies, in this order. Each lives in a subfolder for the area of RStudio
 * it reads, as ../../../../CLAUDE.md lays out; its name is the one it
 * declares, never its file's path.
 */
export const checks: readonly AppCheck[] = [unsavedMarkMatchesSave];
