import fs from 'node:fs';
import path from 'node:path';
import { requireAppDir } from '@drugstoresushi/phileas';

/**
 * Which Positron release the trial is pointed at, read from PHILEAS_APP_DIR
 * and the release's own product.json.
 *
 * Its own module so the adapter and the adapter's checks can both read it:
 * the adapter imports its checks, so a check importing the adapter would make
 * a cycle, and one side would read the other before it was set.
 */
export const bundleDir = requireAppDir();

/**
 * The installed application's own product.json, read once and before
 * anything launches: under the bundle's Contents/Resources on macOS, and
 * under resources/ elsewhere, as for any Code OSS build (unmeasured off
 * macOS).
 */
const product = (() => {
  const file =
    process.platform === 'darwin'
      ? path.join(bundleDir, 'Contents', 'Resources', 'app', 'product.json')
      : path.join(bundleDir, 'resources', 'app', 'product.json');
  return { file, json: JSON.parse(fs.readFileSync(file, 'utf8')) as { positronVersion?: unknown; positronBuildNumber?: unknown } };
})();

/** The release being run, from product.json. */
export const positronVersion: string = (() => {
  const version = product.json.positronVersion;
  if (typeof version !== 'string') throw new Error(`${product.file} names no positronVersion.`);
  return version;
})();

/**
 * The release with its build number, as Positron's About names it,
 * `2026.09.1+2`, for the journal's opening line. The version alone where
 * product.json names no build.
 */
export const positronRelease =
  typeof product.json.positronBuildNumber === 'number' || typeof product.json.positronBuildNumber === 'string'
    ? `${positronVersion}+${product.json.positronBuildNumber}`
    : positronVersion;

/**
 * Which releases draw their sessions the same way, by release measured.
 *
 * The releases of 2024.11 to 2025.02 start sessions from a Start Interpreter
 * button and list interpreters as buttons in a dialog; the current release
 * starts them from Start New Console Session and lists them as options,
 * measured 2026-09-27. A release not listed here has no family: its session
 * steps and checks refuse or say they did not run, rather than guessing.
 */
const FAMILIES: Record<string, 'early' | 'current'> = {
  '2024.11.0': 'early',
  '2025.01.0': 'early',
  '2025.02.0': 'early',
  '2026.09.1': 'current',
};
export const positronFamily: 'early' | 'current' | undefined = FAMILIES[positronVersion];

/**
 * The adapter's own checks read markings studied on the current release
 * only. Studying each release for them was stopped on 2026-09-27, since it
 * made the checks the work of whoever studied the releases rather than of
 * the engine; docs/PLAN.md has the decision. On any other release they say
 * so and do not run, rather than reading markings that are not there and
 * passing while checking nothing.
 */
export const notStudiedHere =
  positronFamily === 'current'
    ? undefined
    : {
        notRun:
          `its markings were studied on the current release only, not on Positron ${positronVersion}`,
      };
