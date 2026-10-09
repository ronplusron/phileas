import { quarto } from '../phileas/fixes/quarto';
import { control, key, probeCases } from './steer';

/**
 * Whether inserting a code cell into a new Quarto document sets off
 * "[meta.pyrefly] provider FAILED" in the extension host log, finding
 * 471a1b2f. Met in 9 Routes of the quarto Journeys, each one or two Hops
 * after clicking Insert Code Cell, whatever came between; pyrefly ships in
 * Positron's own Python extension. The control leaves the click out.
 */
probeCases([
  { label: 'Quarto, Insert Code Cell', fix: quarto, wants: [control('button', 'Insert Code Cell'), key('Escape'), key('Escape')] },
  { label: 'Quarto, no cell inserted', fix: quarto, wants: [key('Escape'), key('Escape'), key('Escape')] },
  // Six Hops after the click rather than two, since the error arrives late:
  // one run in three of the case above ended before it came.
  {
    label: 'Quarto, Insert Code Cell, then a longer wait',
    fix: quarto,
    wants: [control('button', 'Insert Code Cell'), ...Array.from({ length: 6 }, () => key('Escape'))],
  },
]);
