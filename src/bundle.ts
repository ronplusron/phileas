import fs from 'node:fs';
import path from 'node:path';
import { extractFile, listPackage, statFile } from '@electron/asar';
import type { AppUnderTest } from './app-under-test.js';

export interface ResolvedBundle {
  appDir: string;
  executable: string;
  /**
   * The packaged archive, which only the staleness guard reads.
   *
   * Absent where the bundle has none and no guard is configured. An installed
   * application can ship its code unpacked, as Positron does in
   * `Contents/Resources/app`, and requiring an archive nothing was going to
   * read refused to launch it at all.
   */
  asarPath: string | undefined;
}

/**
 * What the staleness guard did, so the report can say it.
 *
 * A guard that did not run must never read like one that passed. There are two
 * legitimate ways for it not to run -- no sources to compare against (C1a), and
 * the switch that runs against a stale build deliberately -- and both have to
 * reach the report, which is why this is returned rather than being a silent
 * early exit.
 */
export type GuardVerdict =
  | { ran: true; filesCompared: number }
  | { ran: false; reason: 'no-sources' | 'skipped-by-switch'; detail: string };

/**
 * Find the executable inside a macOS application bundle.
 *
 * Read rather than derived. The lifted code assumed the executable was named
 * after productName, which held for the one application it was written inside
 * and holds for neither confirmed consumer: one renames the bundle after
 * packaging, and the other declares no product name at all.
 *
 * Contents/MacOS holds exactly one executable in an ordinary bundle. More than
 * one means a layout this does not understand, and guessing which to launch is
 * how a run ends up testing a helper process.
 */
function findExecutable(appDir: string): string {
  const macOsDir = path.join(appDir, 'Contents', 'MacOS');
  if (!fs.existsSync(macOsDir)) {
    throw new Error(
      `No packaged app found at\n  ${appDir}\n\n` +
        `Expected a macOS bundle with Contents/MacOS inside it.\n` +
        `A Journey runs against the packaged build, never the source directory.`
    );
  }
  const entries = fs.readdirSync(macOsDir).filter((name) => !name.startsWith('.'));
  const [only] = entries;
  if (entries.length !== 1 || only === undefined) {
    throw new Error(
      `Cannot tell which executable to launch in\n  ${macOsDir}\n\n` +
        `Found ${entries.length}: ${entries.join(', ') || '(none)'}\n` +
        `An ordinary bundle holds exactly one.`
    );
  }
  return path.join(macOsDir, only);
}

export function resolveBundle(cfg: AppUnderTest): ResolvedBundle {
  const appDir = cfg.bundleDir;
  const executable = findExecutable(appDir);
  const asarPath = path.join(appDir, 'Contents', 'Resources', 'app.asar');

  if (!fs.existsSync(executable)) {
    throw new Error(
      `No packaged app found at\n  ${appDir}\n\n` +
        `A Journey runs against the packaged build, never the source directory.`
    );
  }
  if (!fs.existsSync(asarPath)) {
    // Only the guard reads the archive, so only a configured guard needs one.
    // With no sources the guard cannot run anyway (C1a), and says so.
    if (cfg.staleness === undefined) return { appDir, executable, asarPath: undefined };
    throw new Error(
      `The bundle at ${appDir} has no app.asar.\n` +
        `The staleness guard only understands the asar layout; --no-asar builds are not supported.`
    );
  }
  return { appDir, executable, asarPath };
}

function* walkFiles(root: string, relative: string): Generator<string> {
  const absolute = path.join(root, relative);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    yield relative;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const name of fs.readdirSync(absolute).sort()) {
    yield* walkFiles(root, path.join(relative, name));
  }
}

/** The variable that runs against a stale build, which the run then says. */
export const ALLOW_STALE_VARIABLE = 'PHILEAS_ALLOW_STALE';

/**
 * Whether the staleness guard is switched off for this run, refusing anything
 * but 1 or 0. It used to count any value as on, so PHILEAS_ALLOW_STALE=0 --
 * which reads as "don't" -- skipped the single most important guard there is.
 */
export function allowStaleFromEnvironment(): boolean {
  const raw = (process.env[ALLOW_STALE_VARIABLE] ?? '').trim();
  if (raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new RangeError(`${ALLOW_STALE_VARIABLE}=${JSON.stringify(raw)} is not on or off. Use 1 or 0.`);
}

/**
 * Compare one packaged file against its copy on disk.
 *
 * Byte equality for everything except package.json, which the packager rewrites
 * rather than copies: it keeps a subset chosen by the packager and drops
 * scripts and devDependencies. The exact subset is the packager's behavior and
 * will drift, so it is not enumerated here -- an enumeration that went stale
 * would read as "the packager drops that field" when it does not. So the
 * bundled copy is a subset by design, and a byte comparison on it can never
 * pass.
 *
 * Comparing the keys the bundle kept is the honest check. A field the packager
 * drops cannot go stale in the running app, because the running app never sees
 * it. A field it keeps -- `main` above all -- absolutely can.
 */
function compareOne(relative: string, onDisk: Buffer, inBundle: Buffer): true | string {
  if (onDisk.equals(inBundle)) return true;

  if (relative === 'package.json') {
    let bundled: Record<string, unknown>;
    let disk: Record<string, unknown>;
    try {
      bundled = JSON.parse(inBundle.toString('utf8')) as Record<string, unknown>;
      disk = JSON.parse(onDisk.toString('utf8')) as Record<string, unknown>;
    } catch {
      return `${relative}: could not be parsed as JSON on one side`;
    }
    const changed = Object.keys(bundled).filter(
      (key) => JSON.stringify(bundled[key]) !== JSON.stringify(disk[key])
    );
    if (changed.length === 0) return true;
    return `${relative}: ${changed.join(', ')} changed since the bundle was built`;
  }

  return `${relative}: differs from the copy in the bundle`;
}

/**
 * Returns a verdict saying whether the guard ran, and throws when it ran and
 * found a difference. It does not run when there are no sources to compare
 * against, or when the skip switch is set, and package.json is compared by the
 * keys the bundle kept rather than byte for byte, for the reason above.
 *
 * This is the single most important piece of the engine. Testing a stale bundle
 * is worse than having no tests: it reports green for code nobody is running
 * any more, and it does so silently.
 *
 * Content comparison rather than timestamps or git, because both of those lie
 * in ordinary use. An mtime changes on a checkout that restored identical
 * content, and git cannot see dist/ at all since it is ignored, nor can it see
 * uncommitted edits as anything but "dirty".
 */
export function assertBundleFresh(cfg: AppUnderTest, asarPath: string | undefined): GuardVerdict {
  if (cfg.staleness === undefined) {
    return {
      ran: false,
      reason: 'no-sources',
      detail:
        'No sources to compare the bundle against, so staleness was not checked. ' +
        'This is the shape where the engine is pointed at an installed binary (C1a).',
    };
  }
  if (allowStaleFromEnvironment()) {
    return {
      ran: false,
      reason: 'skipped-by-switch',
      detail:
        'PHILEAS_ALLOW_STALE is set, so staleness was not checked. ' +
        'Findings from this run may describe code nobody is running.',
    };
  }

  const { sourceRoot } = cfg.staleness;
  // Normalized once, for both directions, so './data', 'data/' and '/data'
  // all name the bundle's 'data'. Written raw, './data' made the reverse
  // direction's root '/./data', which no bundle path starts with, so it
  // checked nothing for that input and said nothing.
  const packagedInputs = cfg.staleness.packagedInputs.map((input) =>
    path.posix.normalize(input).replace(/^(?:\.\/|\/)+/, '').replace(/\/+$/, '')
  );

  // A guard that compared nothing returned the same affirmative verdict as one
  // that compared four hundred files. Two ways to reach it, both measured
  // against a real bundle: an empty packagedInputs, and an ignoreInput broader
  // than its author meant, which is applied in both directions and so can
  // switch the whole guard off. Refusing here is what keeps ran:true meaning
  // something.
  if (packagedInputs.length === 0) {
    throw new Error(
      'staleness.packagedInputs is empty, so the guard would compare nothing and ' +
        'report that it ran. Name the files and directories that go into the bundle, ' +
        'or leave staleness out entirely to say there are no sources to compare against.'
    );
  }
  // resolveBundle refuses a guarded bundle with no archive, so this is reached
  // only by a caller that skipped it. Refused rather than read as nothing to
  // compare, which would report a guard that compared nothing as one that ran.
  if (asarPath === undefined) {
    throw new Error(
      'The staleness guard is configured but no app.asar was given to compare against. ' +
        'Pass the path resolveBundle returned.'
    );
  }
  const ignore = cfg.staleness.ignoreInput ?? (() => false);
  const problems: string[] = [];
  let filesCompared = 0;
  const seenInBundlePaths = new Set<string>();

  for (const input of packagedInputs) {
    const inputAbsolute = path.join(sourceRoot, input);
    if (!fs.existsSync(inputAbsolute)) {
      problems.push(`${input}: listed as a packaged input but missing from the working tree`);
      continue;
    }
    for (const relative of walkFiles(sourceRoot, input)) {
      if (ignore(relative)) continue;
      seenInBundlePaths.add('/' + relative);

      const onDisk = fs.readFileSync(path.join(sourceRoot, relative));
      let inBundle: Buffer;
      try {
        inBundle = extractFile(asarPath, relative);
      } catch {
        problems.push(`${relative}: on disk but not in the bundle`);
        continue;
      }
      filesCompared += 1;
      const verdict = compareOne(relative, onDisk, inBundle);
      if (verdict !== true) problems.push(verdict);
    }
  }

  // The other direction: something the bundle still carries that is gone from
  // disk, such as a deleted text record. Without this the guard would pass on a
  // bundle that serves content the corpus no longer has.
  const inputRoots = packagedInputs.map((p) => '/' + p);
  for (const bundlePath of listPackage(asarPath, { isPack: false })) {
    const underAnInput = inputRoots.some((r) => bundlePath === r || bundlePath.startsWith(r + '/'));
    if (!underAnInput) continue;
    if (seenInBundlePaths.has(bundlePath)) continue;
    const relative = bundlePath.slice(1);
    if (ignore(relative)) continue;
    // listPackage returns directories too, told apart by the archive's own
    // header rather than by an extraction failing, which would pass over a
    // file that failed to extract for any other reason as though it were one.
    if ('files' in statFile(asarPath, relative)) continue;
    problems.push(`${relative}: in the bundle but gone from the working tree`);
  }

  if (filesCompared === 0) {
    throw new Error(
      'The staleness guard compared no files, so it can say nothing about whether the ' +
        'bundle is current. Either every packaged input is missing from the working ' +
        'tree, or ignoreInput is excluding all of them. Both are configuration faults ' +
        'rather than a clean bundle.'
    );
  }

  if (problems.length === 0) return { ran: true, filesCompared };

  const shown = problems.slice(0, 20).map((p) => `  ${p}`).join('\n');
  const more = problems.length > 20 ? `\n  ...and ${problems.length - 20} more` : '';
  throw new Error(
    `The packaged bundle is STALE relative to the sources it was built from.\n` +
      `Running a Journey against it would test code nobody is running any more.\n\n` +
      shown +
      more +
      `\n\nRepackage the application, then run again.\n` +
      `To run against it anyway, set PHILEAS_ALLOW_STALE=1; the run's settings say so.`
  );
}
