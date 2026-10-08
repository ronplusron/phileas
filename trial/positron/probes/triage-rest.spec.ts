import { quarto } from '../phileas/fixes/quarto';
import { session } from '../phileas/fixes/session';
import { control, key, menu, probeCases } from './steer';

/**
 * The rest of step 6's single sightings, written on 2026-10-07 from what each
 * Route did just before its finding; none is yet shown to matter. Each case
 * is followed by Escapes so the checks run again for a finding that arrives
 * late.
 *
 * I, 394a41c4, the renderer not answering: route 89 of the session rerun,
 * cb0e45cbca68, with R running, pressed Enter in Open Folder, which reloads
 * the window. Control: the same with nothing running.
 *
 * G, 201bb0fc, "Unable to resolve resource output:tasks": route 44 of the
 * same Journey showed the kernel's output channel, then opened a folder.
 * Control: a folder opened with R running and no output channel shown.
 *
 * F, b557285f and a6d6a45f, "DisposableStore is missing" and positron-r's
 * "provider FAILED": route 81 of the first session Journey, 365dbfb533b9,
 * clicked Console Information with R running, its secondary side bar hidden.
 * Cases with and without the side bar hidden.
 *
 * E, 0f31d456, a TypeError reading 'id' in ViewDescriptorService: route 43 of
 * the quarto Journey, 4a630dab6903, chose Customize Layout... and then the
 * Assistant Layout. Control: the Notebook Layout.
 */
const LATER = [key('Escape'), key('Escape'), key('Escape')];
const OPEN_FOLDER = [menu('File > Open Folder...'), key('Enter')];
const layout = (name: string) => [control('button', 'Customize Layout...'), control('option', name), ...LATER];

probeCases([
  { label: 'I: R running, a folder opened', fix: session, wants: [...OPEN_FOLDER, ...LATER] },
  { label: 'I: nothing running, a folder opened', wants: [...OPEN_FOLDER, ...LATER] },
  {
    label: "G: R running, the kernel's output shown, a folder opened",
    fix: session,
    wants: [control('button', 'Console Information'), control('button', 'Show Kernel Output Channel'), ...OPEN_FOLDER, ...LATER],
  },
  { label: 'F: R running, Console Information', fix: session, wants: [control('button', 'Console Information'), ...LATER] },
  {
    label: 'F: R running, side bar hidden, Console Information',
    fix: session,
    wants: [control('button', 'Hide Secondary Side Bar (⌥⌘B)'), control('button', 'Console Information'), ...LATER],
  },
  { label: 'E: the quarto Fix, the Assistant Layout', fix: quarto, wants: layout('positron-assistant-layout Assistant Layout') },
  { label: 'E: no Fix, the Assistant Layout', wants: layout('positron-assistant-layout Assistant Layout') },
  { label: 'E: no Fix, the Notebook Layout', wants: layout('positron-notebook-layout Notebook Layout') },
]);
