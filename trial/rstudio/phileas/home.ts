import path from 'node:path';
import type { GuardedApplication } from '@drugstoresushi/phileas';

/**
 * RStudio, for the engine's home folder guard, from what a launch wrote into
 * a Route's own home on 2026-09-28: its configuration, its state and R's
 * history. Its Electron profile follows `--user-data-dir`, so Application
 * Support is the one it would write if that stopped taking effect.
 */
export const RSTUDIO: GuardedApplication = {
  name: 'RStudio',
  knownRoots: [
    path.join('.config', 'rstudio'),
    path.join('.local', 'share', 'rstudio'),
    '.Rhistory',
    '.RData',
    path.join('Library', 'Application Support', 'RStudio'),
  ],
  executable: '/Contents/MacOS/RStudio',
  routeMarker: 'phileas-rstudio-',
};
