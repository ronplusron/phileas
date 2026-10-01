import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Refusing a compiled engine that is older than its source.
 *
 * The package points at `dist/`, so everything here that imports the engine by
 * name, the proving ground, the demos and the trials, runs whatever was last
 * built. Edit `src/` without building and they would test the old engine and
 * pass, which is the worst way for this to fail. So the compiled engine checks
 * its own age when it loads, and refuses rather than running stale.
 *
 * It checks only inside a source checkout: the compiled file is in `dist/` and
 * `src/index.ts` sits beside it. An installed copy ships no TypeScript source,
 * and the engine's own tests import `src/` directly, so neither is checked.
 *
 * It goes by modification time, which a checkout of other files, an edit and a
 * copy all move forward. A copy that keeps the old times would get past it.
 */

/** Set to 1 to load a compiled engine older than its source, for one run. */
export const ALLOW_STALE_BUILD_VARIABLE = 'PHILEAS_ALLOW_STALE_BUILD';

/**
 * The source files newer than the compiled engine in `distFolder`, or nothing
 * when there is no source checkout beside it to compare with.
 */
export function staleSources(distFolder: string): string[] {
  const src = path.join(distFolder, '..', 'src');
  const built = path.join(distFolder, 'index.js');
  if (!fs.existsSync(path.join(src, 'index.ts')) || !fs.existsSync(built)) return [];
  const builtAt = fs.statSync(built).mtimeMs;
  return fs
    .readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(ts|mjs)$/.test(file))
    .filter((file) => fs.statSync(path.join(src, file)).mtimeMs > builtAt)
    .sort();
}

/** Throws when the compiled engine in `distFolder` is older than its source. */
export function requireFreshBuild(distFolder: string): void {
  const stale = staleSources(distFolder);
  if (stale.length === 0) return;
  const root = path.dirname(distFolder);
  if (process.env[ALLOW_STALE_BUILD_VARIABLE] === '1') {
    console.warn(
      `phileas: running a compiled engine older than ${stale.length} source file(s), ` +
        `because ${ALLOW_STALE_BUILD_VARIABLE}=1.`
    );
    return;
  }
  const named = stale.slice(0, 3).join(', ') + (stale.length > 3 ? `, and ${stale.length - 3} more` : '');
  throw new Error(
    `The compiled engine in ${distFolder} is older than its source: ${named}. ` +
      `Run \`npm run build\` in ${root}, or set ${ALLOW_STALE_BUILD_VARIABLE}=1 to run it anyway.`
  );
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (path.basename(here) === 'dist') requireFreshBuild(here);
