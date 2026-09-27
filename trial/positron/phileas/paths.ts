import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where this trial's Routes write their journals, and where its known
 * findings are kept. One place, read by the spec that writes them and the
 * global setup that reads them back: if the two drifted apart, the Journey's
 * end would find no run to read.
 */
export const journalsRoot = path.join(here, '.phileas-journals');
export const knownFindings = path.join(here, 'known-findings.json');
