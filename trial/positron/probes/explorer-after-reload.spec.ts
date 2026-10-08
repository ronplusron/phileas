import { dataExplorer } from '../phileas/fixes/data-explorer';
import { session } from '../phileas/fixes/session';
import { control, key, menu, probeCases, type Want } from './steer';

/**
 * Whether "Cannot show Console" and "Cannot show Variables: ... became active,
 * but a ... instance for it is not running", findings 3266fe2f and 0b9a5ca7,
 * come from a data explorer that outlived a window reload. Route 4 of step 6's
 * data-explorer Journey, 879e429c55ca, met both on 2026-10-07 and again on its
 * replay the same day: it added a folder at hops 2 and 4, which reloads the
 * window into an untitled workspace, and the data explorer then showed its
 * session closed; hop 19 chose the explorer in Switch Window, and hop 20's
 * File > New Text File came with both findings.
 *
 * The control: the same steps with no folder added, so no reload.
 */
const MTCARS: Want = (c) => c.source === 'page' && c.role === 'option' && c.name.startsWith('Data: mtcars');
const LATER = [key('Escape'), key('Escape')];
const RELOAD = [control('button', 'add a folder'), control('button', 'Add'), ...LATER];
const MENU_RELOAD = [menu('File > Add Folder to Workspace...'), control('button', 'Add'), ...LATER];
const FOCUS_THEN_NEW = [menu('Window > Switch Window...'), MTCARS, menu('File > New Text File'), ...LATER];

probeCases([
  { label: 'data explorer, a folder added, explorer chosen, New Text File', fix: dataExplorer, wants: [...RELOAD, ...FOCUS_THEN_NEW] },
  { label: 'data explorer, a folder added, New Text File', fix: dataExplorer, wants: [...RELOAD, menu('File > New Text File'), ...LATER] },
  { label: 'data explorer, no folder added, explorer chosen, New Text File', fix: dataExplorer, wants: FOCUS_THEN_NEW },
  // Whether the data explorer is needed at all, or R running is enough. The
  // session Fix leaves the Explorer's "add a folder" off screen, so the
  // folder is added from the menu, which opens the same dialog; the data
  // explorer is run that way too, so the two differ only in the explorer.
  { label: 'R running, a folder added from the menu, New Text File', fix: session, wants: [...MENU_RELOAD, menu('File > New Text File'), ...LATER] },
  { label: 'data explorer, a folder added from the menu, New Text File', fix: dataExplorer, wants: [...MENU_RELOAD, menu('File > New Text File'), ...LATER] },
]);
