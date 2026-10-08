import { session } from '../phileas/fixes/session';
import { control, key, menu, probeCases } from './steer';

/**
 * Whether "Unable to resolve resource output:tasks", finding 201bb0fc, needs
 * R at all. The triage probe of 2026-10-07 set it off 3 of 3 times with R
 * running, the kernel's output channel shown, and a folder opened, which
 * reloads the window; with R running and no output shown, 0 of 2. Its stack
 * is the Output view restoring itself after the reload. These cases show the
 * Output view with nothing running, and repeat the kernel case beside them.
 */
const OPEN_FOLDER = [menu('File > Open Folder...'), key('Enter'), key('Escape'), key('Escape'), key('Escape')];

probeCases([
  { label: 'nothing running, View > Output, a folder opened', wants: [menu('View > Output'), ...OPEN_FOLDER] },
  {
    label: "R running, the kernel's output shown, a folder opened",
    fix: session,
    wants: [control('button', 'Console Information'), control('button', 'Show Kernel Output Channel'), ...OPEN_FOLDER],
  },
]);
