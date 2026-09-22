import fs from 'node:fs';
import path from 'node:path';
import { extractFile, listPackage } from '@electron/asar';
import type { AppUnderTest } from './app-under-test';

export interface ResolvedBundle {
  appDir: string;
  executable: string;
  asarPath: string;
}

export function resolveBundle(cfg: AppUnderTest): ResolvedBundle {
  const appDir =
    cfg.bundleDir ??
    path.join(cfg.repoRoot, 'dist', `${cfg.productName}-darwin-arm64`, `${cfg.productName}.app`);
  const executable = path.join(appDir, 'Contents', 'MacOS', cfg.productName);
  const asarPath = path.join(appDir, 'Contents', 'Resources', 'app.asar');

  if (!fs.existsSync(executable)) {
    throw new Error(
      `No packaged app found at\n  ${appDir}\n\n` +
        `This suite tests the packaged bundle, not the source directory.\n` +
        `Run \`npm run package\` first, or \`npm run verify\` to do both.`
    );
  }
  if (!fs.existsSync(asarPath)) {
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

/**
 * Compare one packaged file against its copy on disk.
 *
 * Byte equality for everything except package.json, which the packager rewrites
 * rather than copies: it keeps only the fields the runtime needs (name,
 * productName, version, description, main, author) and drops scripts and
 * devDependencies. So the bundled copy is a subset by design, and a byte
 * comparison on it can never pass.
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
 * Throws unless every packaged input on disk is byte-identical to its copy
 * inside app.asar.
 *
 * This is the single most important piece of the suite. Testing a stale bundle
 * is worse than having no tests: it reports green for code nobody is running
 * any more, and it does so silently.
 *
 * Content comparison rather than timestamps or git, because both of those lie
 * in ordinary use. An mtime changes on a checkout that restored identical
 * content, and git cannot see dist/ at all since it is ignored, nor can it see
 * uncommitted edits as anything but "dirty".
 */
export function assertBundleFresh(cfg: AppUnderTest, asarPath: string): void {
  if (process.env.E2E_ALLOW_STALE) return;

  const ignore = cfg.ignoreInput ?? (() => false);
  const problems: string[] = [];
  const seenInBundlePaths = new Set<string>();

  for (const input of cfg.packagedInputs) {
    const inputAbsolute = path.join(cfg.repoRoot, input);
    if (!fs.existsSync(inputAbsolute)) {
      problems.push(`${input}: listed as a packaged input but missing from the working tree`);
      continue;
    }
    for (const relative of walkFiles(cfg.repoRoot, input)) {
      if (ignore(relative)) continue;
      seenInBundlePaths.add('/' + relative);

      const onDisk = fs.readFileSync(path.join(cfg.repoRoot, relative));
      let inBundle: Buffer;
      try {
        inBundle = extractFile(asarPath, relative);
      } catch {
        problems.push(`${relative}: on disk but not in the bundle`);
        continue;
      }
      const verdict = compareOne(relative, onDisk, inBundle);
      if (verdict !== true) problems.push(verdict);
    }
  }

  // The other direction: something the bundle still carries that is gone from
  // disk, such as a deleted text record. Without this the guard would pass on a
  // bundle that serves content the corpus no longer has.
  const inputRoots = cfg.packagedInputs.map((p) => '/' + p.replace(/\/+$/, ''));
  for (const bundlePath of listPackage(asarPath, { isPack: false })) {
    const underAnInput = inputRoots.some((r) => bundlePath === r || bundlePath.startsWith(r + '/'));
    if (!underAnInput) continue;
    if (seenInBundlePaths.has(bundlePath)) continue;
    const relative = bundlePath.slice(1);
    if (ignore(relative)) continue;
    // listPackage returns directories too; only files can be extracted.
    try {
      extractFile(asarPath, relative);
    } catch {
      continue;
    }
    problems.push(`${relative}: in the bundle but gone from the working tree`);
  }

  if (problems.length === 0) return;

  const shown = problems.slice(0, 20).map((p) => `  ${p}`).join('\n');
  const more = problems.length > 20 ? `\n  ...and ${problems.length - 20} more` : '';
  throw new Error(
    `The packaged bundle is STALE relative to the working tree.\n` +
      `Running the suite against it would test code you are no longer editing.\n\n` +
      shown +
      more +
      `\n\nRun \`npm run package\` (or \`npm run verify\`).\n` +
      `To run against it anyway, set E2E_ALLOW_STALE=1; the run will say so loudly.`
  );
}
