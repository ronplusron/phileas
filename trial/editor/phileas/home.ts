import path from 'node:path';
import type { GuardedApplication } from '@drugstoresushi/phileas';

/**
 * Bobolink Editor, for the engine's home folder guard, read from its source
 * on 2026-09-30 rather than measured: `src/main/index.ts` sets its settings
 * folder from `EDITOR_USER_DATA`, and without it uses `Bobolink Editor
 * (Electron)` in Application Support, named in `src/shared/identity.ts`. That
 * folder is the one it would write if the variable stopped taking effect.
 * `Bobolink Editor` is deliberately not listed: it is the Swift app's folder,
 * and its writes would be blamed on the run. The cost is that Electron's own
 * default, should the app's override ever go, lands there unseen.
 */
export const EDITOR: GuardedApplication = {
  name: 'Bobolink Editor',
  knownRoots: [path.join('Library', 'Application Support', 'Bobolink Editor (Electron)')],
  executable: '/Contents/MacOS/Bobolink Editor',
  routeMarker: 'phileas-bobolink-editor-',
};
