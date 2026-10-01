import path from 'node:path';
import type { GuardedApplication } from '@drugstoresushi/phileas';

/** Positron, for the engine's home folder guard, measured 2026-09-26. */
export const POSITRON: GuardedApplication = {
  name: 'Positron',
  knownRoots: [
    '.positron',
    '.positron-shared',
    '.posit',
    '.copilot',
    path.join('Library', 'Application Support', 'Positron'),
  ],
  executable: '/Contents/MacOS/Positron',
  routeMarker: 'phileas-positron-',
};
