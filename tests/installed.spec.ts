import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { scratch, removeScratch } from './scratch';

/**
 * The engine loading as an installed package, in a repository that is not
 * this one.
 *
 * Every other consumer here sits inside this repository, where a link to the
 * engine lands back in this checkout and Playwright compiles its TypeScript.
 * An installed copy sits in a consumer's node_modules, where neither Node nor
 * Playwright compiles anything, and that is how the engine was found unable
 * to load anywhere else. So this packs the engine as npm would and loads it
 * from a consumer's node_modules, outside this repository.
 */

test.afterEach(removeScratch);

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Links a package from this repository's node_modules into the consumer's. */
function linkFromRepo(consumer: string, name: string): void {
  const target = fs.realpathSync(path.join(repo, 'node_modules', name));
  const link = path.join(consumer, 'node_modules', name);
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link);
}

test('the packed engine loads from a consumer node_modules outside this repository', () => {
  test.setTimeout(120_000);
  // npm test builds first; packing here reads what that built.
  expect(fs.existsSync(path.join(repo, 'dist', 'index.js')), 'dist/index.js, from npm run build').toBe(true);

  const root = scratch('installed-');
  const tarball = execFileSync('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', root], {
    cwd: repo,
    encoding: 'utf8',
  }).trim();

  const consumer = path.join(root, 'consumer');
  const scope = path.join(consumer, 'node_modules', '@drugstoresushi');
  fs.mkdirSync(scope, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(root, tarball), '-C', scope]);
  fs.renameSync(path.join(scope, 'package'), path.join(scope, 'phileas'));
  const installed = path.join(scope, 'phileas');

  // A real copy with no TypeScript in it, or a pass below would not show
  // that compiled JavaScript loaded.
  expect(fs.lstatSync(installed).isSymbolicLink()).toBe(false);
  const shipped = fs.readdirSync(installed, { recursive: true, encoding: 'utf8' });
  expect(shipped.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))).toEqual([]);
  expect(shipped).toContain(path.join('dist', 'index.d.ts'));

  // One Playwright, the consumer's, as a consumer declaring it would have.
  linkFromRepo(consumer, '@playwright/test');
  linkFromRepo(consumer, '@electron/asar');
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ type: 'module' }));
  fs.writeFileSync(path.join(consumer, 'playwright.config.ts'), "export default { testDir: '.' };\n");
  fs.writeFileSync(
    path.join(consumer, 'probe.spec.ts'),
    [
      "import { test, expect } from '@playwright/test';",
      "import { createTest, defineFixes, UNIVERSAL_CHECKS } from '@drugstoresushi/phileas';",
      "test('the engine loads', () => {",
      "  expect(typeof createTest).toBe('function');",
      "  expect(typeof defineFixes).toBe('function');",
      '  expect(UNIVERSAL_CHECKS).toBeTruthy();',
      '});',
      '',
    ].join('\n')
  );

  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('PHILEAS_')) delete env[name];
  const cli = path.join(consumer, 'node_modules', '@playwright', 'test', 'cli.js');
  const result = spawnSync(process.execPath, [cli, 'test', '--reporter=line'], {
    cwd: consumer,
    env,
    encoding: 'utf8',
    timeout: 90_000,
  });
  const output = `${result.stdout}${result.stderr}`;
  expect(result.status, output).toBe(0);
  expect(output).toMatch(/1 passed/);
});
