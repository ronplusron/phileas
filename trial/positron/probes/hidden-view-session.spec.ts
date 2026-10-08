import { control, key, probeCases, type Want } from './steer';

/**
 * Whether a session starting while its view is hidden sets off "Cannot show
 * Console" or "Cannot show Variables: ... became active, but a ... instance
 * for it is not running": findings f8b9b486, 3266fe2f, 07b43a23 and 0b9a5ca7,
 * met by step 6's notebook, quarto and data-explorer Journeys on 2026-10-06
 * and 07, with R and with Python. What the Routes shared, read from their
 * journals and not yet shown to matter: route 73 of quarto hid the Variables
 * view and then started Python, and route 74 of notebook toggled the
 * secondary side bar, where Variables sits, just before its error.
 *
 * Each case starts R 4.6.0 from Start New Console Session, as a Route can,
 * then presses Escape so the checks run while R comes up. The control starts
 * it with nothing hidden.
 */
const R = (c: Parameters<Want>[0]) => c.source === 'page' && c.role === 'option' && c.name.startsWith('R 4.6.0,');
const START_R = [control('button', 'Start New Console Session'), R, key('Escape'), key('Escape'), key('Escape'), key('Escape')];

probeCases([
  { label: 'secondary side bar hidden, then R started', wants: [control('button', 'Hide Secondary Side Bar (⌥⌘B)'), ...START_R] },
  { label: 'panel hidden, then R started', wants: [control('button', 'Hide Panel (⌘J)'), ...START_R] },
  { label: 'nothing hidden, R started', wants: START_R },
]);
