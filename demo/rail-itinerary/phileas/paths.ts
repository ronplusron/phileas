import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where the Journey's journals are written, one folder per seed and run. */
export const journalsRoot = path.join(here, '.phileas-journals');

/**
 * The known findings file. Beside the journals, which are ignored, and never
 * committed: every Journey that finds a planted bug adds to it, so a committed
 * file would change on every run with a plant on. `RAIL_DEMO_KNOWN` points it
 * elsewhere, which is how the guided demo keeps a scratch copy it controls.
 */
export const knownFindings = process.env.RAIL_DEMO_KNOWN || path.join(journalsRoot, 'known-findings.json');
