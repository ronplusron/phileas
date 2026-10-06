import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where a probe's journals go, apart from the Journey's. */
export const probeJournals = path.join(here, '.phileas-journals');
