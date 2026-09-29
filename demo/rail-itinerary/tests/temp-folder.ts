import { startTempFolder } from '@drugstoresushi/phileas';

/**
 * Gives the scripted suite its own folder in the system temp folder, where
 * each test makes its launch's profile, and fails the run if anything is left
 * in it. A profile is never made outside a run's own folder, so that a
 * Journey or another suite running at the same time never counts it.
 */
export default function globalSetup() {
  return startTempFolder('rail-itinerary-suite', 'run', 'Each is a profile a test should have removed.').check;
}
