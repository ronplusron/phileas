import fs from 'node:fs';
import path from 'node:path';
import { requireAppDir, type AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/**
 * The adapter for Positron, pointed at an installed release.
 *
 * Which release comes from PHILEAS_APP_DIR, set to the `.app`, and an unset
 * variable is refused by name: the trial runs four releases side by side, and
 * a default would test the wrong one whenever the variable was forgotten.
 *
 * There are no sources, so the staleness guard cannot run, and the run says so.
 * docs/PLAN.md has what was measured and decided for each setting below.
 */
const homeIn = (userDataDir: string) => path.join(userDataDir, 'home');

/** How long readiness watches for an error notification after the status bar. */
const BOOT_ERROR_WATCH_MS = 1_000;

export const positron: AppUnderTest = {
  productName: 'Positron',
  bundleDir: requireAppDir(),

  launchArgs: (userDataDir) => [
    // Inside the Route's own profile, so no Route sees another's extensions or
    // the machine's real ones.
    `--extensions-dir=${path.join(userDataDir, 'extensions')}`,
    // Positron writes no log at all without this, measured 2026-09-26.
    `--logsPath=${path.join(userDataDir, 'logs')}`,
    // It fails its GitHub sign-in at every launch and was most of the errors
    // logged while idle. Sign-in is excluded, and the trial tests Positron
    // without this extension, which its findings say.
    '--disable-extension',
    'GitHub.copilot-chat',
    // A throwaway keychain in place of the real one. Positron's secret storage
    // reads its key from the keychain at every launch, and in a fresh profile
    // that raised a keychain prompt which blocked the main process until
    // someone answered it, measured 2026-09-26. Nothing here signs in, so the
    // secrets it guards do not exist.
    '--use-mock-keychain',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-telemetry',
    '--disable-updates',
    '--disable-workspace-trust',
    '--disable-crash-reporter',
  ],

  // A Copilot helper starts as Positron closes and writes its log into the
  // Route's home folder after the profile was deleted, recreating it. One
  // second is far longer than the 6 ms it lived, measured 2026-09-26.
  profileWatchMs: 1_000,

  logPaths: (userDataDir) => [path.join(userDataDir, 'logs', 'window1', 'exthost', 'exthost.log')],

  // A home folder of the Route's own. The in-page file dialogs set below start
  // in the home folder, and a Route must not read or write the real one.
  env: (userDataDir) => ({ HOME: homeIn(userDataDir) }),

  async beforeLaunch(userDataDir: string): Promise<void> {
    await fs.promises.mkdir(homeIn(userDataDir), { recursive: true });
    const user = path.join(userDataDir, 'User');
    await fs.promises.mkdir(user, { recursive: true });
    await fs.promises.writeFile(
      path.join(user, 'settings.json'),
      JSON.stringify(
        {
          // A fresh profile otherwise opens by asking to import Visual Studio
          // Code's settings.
          'positron.importSettings.enable': false,
          // Context menus, dialogs and file dialogs drawn in the page, where a
          // Route can survey and leave them. Native ones block the main process
          // and read as a hang: a native context menu did exactly that on
          // 2026-09-26. The trial tests these, not the macOS defaults.
          'window.menuStyle': 'custom',
          'window.dialogStyle': 'custom',
          'files.simpleDialog.enable': true,
        },
        null,
        2
      )
    );
  },

  exclusions: {
    // Ways out of the application, and into what a Route cannot follow.
    menuPaths: [
      // Positron wrote its own Quit, with no Electron role, so the engine's
      // skip of standard entries does not reach it.
      ['Positron', 'Quit Positron'],
      // Both open a page outside the application.
      ['Help', 'Report Issue'],
      ['Help', 'View License'],
      // A second window, which a Route does not survey.
      ['File', 'New Window'],
      // Raises a confirmation from the main process with showMessageBox, a
      // native dialog that window.dialogStyle does not reach. It blocked both
      // processes on two Routes out of two on 2026-09-26.
      ['File', 'Open Recent', 'Clear Recently Opened...'],
    ],
    // Sign-in. A predicate rather than a name, because the name changes while
    // a Route runs: "Accounts" became "Accounts - Sign in requested" on
    // 2026-09-26 and a name missed it. Decided by the name alone, so it answers
    // the same on a replay.
    exclude: (candidate) => candidate.source === 'page' && candidate.name.startsWith('Accounts'),
  },

  narrowedChecks: {
    'uncaught-error': {
      kind: 'narrowed',
      reason:
        "Positron cancels promises as ordinary control flow, and its own main-process handler " +
        "drops a rejection whose error is named and worded 'Canceled' (isCancellationError in " +
        'out/main.js, read 2026-09-26). The engine listens beside that handler and would ' +
        'report each one; opening the Extensions view raised dozens.',
      // Exactly Positron's own test: name and message both 'Canceled', which is
      // the first line of the stack. In the main process only.
      accept: (observation) =>
        /^main process: unhandled rejection: Canceled: Canceled(\n|$)/.test(observation),
    },
    'console-error': {
      kind: 'narrowed',
      reason:
        "Positron's extension host prints Node's deprecation warnings to the console as errors " +
        'at every launch; measured on 2026-09-26 as the only console errors while idle.',
      // Only Node's own deprecation warnings, raised in the extension host.
      // Known bugs are not narrowed here: they are known findings, in
      // known-findings.json beside this folder's spec.
      accept: (message) => /\[Extension Host\].*\(node:\d+\) \[DEP\d+\] DeprecationWarning:/.test(message),
    },
  },

  /**
   * Ready once the status bar shows, and refused, in Positron's own words,
   * when it booted into an error it announced (R24).
   *
   * An error at boot shows as an error notification rather than as a missing
   * workbench: measured on 2026-09-26 with a settings file that is not valid
   * JSON, where the status bar appeared and "Unable to write into user
   * settings" followed 21 to 24 ms later on three launches. So readiness
   * watches for one second after the status bar, about forty times that, and
   * healthy launches showed no error notification in fifteen seconds.
   */
  async waitForReady(page: Page): Promise<void> {
    await page.locator('.monaco-workbench .part.statusbar').waitFor({ state: 'visible', timeout: 60_000 });

    const errors = page.locator('.notification-list-item:has(.codicon-error) .notification-list-item-message');
    const until = Date.now() + BOOT_ERROR_WATCH_MS;
    while (Date.now() < until) {
      const said = await errors.allTextContents();
      if (said.length) {
        throw new Error(`Positron booted into an error state: ${said.join(' | ')}`);
      }
      await page.waitForTimeout(100);
    }
  },
};

export default positron;
