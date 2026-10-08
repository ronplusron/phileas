import { notebook } from '../phileas/fixes/notebook';
import { quarto } from '../phileas/fixes/quarto';
import { key, menu, probeCases } from './steer';

/**
 * Whether Go > Go to Symbol in Workspace... with a new Quarto document open
 * sets off findings bf494c2e, 7e4dd35a, 7d4e1759 and ae542218, "Request
 * workspace/symbol failed with message: Cannot read properties of undefined
 * (reading 'scheme')", with quarto's d528d1ec, "provider FAILED". Met on
 * routes 13 and 26 of step 6's quarto Journey, 4a630dab6903, on 2026-10-07,
 * each at that menu entry and after nothing else the two shared. The
 * controls: the same entry with nothing open, and with a new notebook open.
 * Two Escapes after it let the checks run again, for a finding that arrives
 * late.
 */
const SYMBOL = [menu('Go > Go to Symbol in Workspace...'), key('Escape'), key('Escape')];

probeCases([
  { label: 'the quarto Fix, Go to Symbol in Workspace', fix: quarto, wants: SYMBOL },
  { label: 'no Fix, Go to Symbol in Workspace', wants: SYMBOL },
  { label: 'the notebook Fix, Go to Symbol in Workspace', fix: notebook, wants: SYMBOL },
]);
