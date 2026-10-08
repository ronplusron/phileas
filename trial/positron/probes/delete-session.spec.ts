import { session } from '../phileas/fixes/session';
import { control, key, probeCases } from './steer';

/**
 * Whether deleting a running R session sets off "Session R ... is not
 * active", findings 9ae31df5 under R 4.4.3 and 68834758 under R 4.6.0. Met
 * on 2026-10-06 and 07 by step 6's session and data-explorer Journeys, on
 * Routes that clicked the console's Delete Session, at hop 1 on several, so
 * the session Fix and that click were all they shared. The control is the
 * same session left running.
 */
probeCases([
  { label: 'R running, Delete Session', fix: session, wants: [control('button', 'Delete Session'), key('Escape'), key('Escape')] },
  { label: 'R running, left running', fix: session, wants: [key('Escape'), key('Escape'), key('Escape')] },
]);
