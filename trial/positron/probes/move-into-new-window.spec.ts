import { key, menu, probeCases, type Want } from './steer';

/**
 * Whether moving the Welcome page into a new window sets off "Invalid model
 * for label change, rebuilding", finding 3705d320. Met twice on 2026-10-06 in
 * step 6's no-Fix Journey, 4e4d35901181, routes 16 and 29, each at a click
 * on an editor's "Move into new window" with the Welcome page or a
 * walkthrough open; route 29 clicked the second of two such buttons. That
 * button is in the new-windows exclusion group, so this runs with
 * PHILEAS_ALLOW_EXCLUDED=new-windows. The control opens Welcome and moves
 * nothing.
 */
const moveIntoNewWindow = (nth: number): Want => (c) =>
  c.source === 'page' && c.role === 'button' && c.name === 'Move into new window' && ((c as { nth?: number }).nth ?? 0) === nth;

probeCases([
  { label: 'Welcome, move the first into a new window', wants: [menu('Help > Welcome'), moveIntoNewWindow(0), key('Escape')] },
  { label: 'Welcome, move the second into a new window', wants: [menu('Help > Welcome'), moveIntoNewWindow(1), key('Escape')] },
  { label: 'Welcome, moved nowhere', wants: [menu('Help > Welcome'), key('Escape'), key('Escape')] },
]);
