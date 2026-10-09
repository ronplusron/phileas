import { notebook } from '../phileas/fixes/notebook';
import { control, key, probeCases } from './steer';

/**
 * Whether running a new notebook's empty cell sets off "Could not find a
 * notebook editor for session 'python-notebook-<id>'", finding ea8d959d. Met
 * on route 74 of step 6's notebook Journey, a1725d030547, recorded on
 * 2026-10-06 and met again by its rerun on 2026-10-07: ⌘J, then Run Cell,
 * then Enter, the error arriving in the third Hop. The control leaves Run
 * Cell out; a third case leaves ⌘J out, to say whether it matters.
 */
probeCases([
  { label: 'notebook, ⌘J, Run Cell, Enter', fix: notebook, wants: [key('⌘J'), control('button', 'Run Cell'), key('Enter')] },
  { label: 'notebook, ⌘J, Escape, Enter', fix: notebook, wants: [key('⌘J'), key('Escape'), key('Enter')] },
  { label: 'notebook, Run Cell, Enter, Escape', fix: notebook, wants: [control('button', 'Run Cell'), key('Enter'), key('Escape')] },
]);
