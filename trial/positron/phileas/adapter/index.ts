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

/**
 * The message of a notification Positron marks as an error, by the error icon
 * it draws on it. Measured on the current release on 2026-09-27 with a
 * settings file that is not valid JSON; on 2024.11 the same file raised no
 * notification, so how that release draws one is not yet measured.
 */
const ERROR_NOTIFICATION = '.notification-list-item:has(.codicon-error) .notification-list-item-message';

const bundleDir = requireAppDir();

/**
 * The release being run, from the installed application's own product.json,
 * read once and before anything launches.
 */
export const positronVersion: string = (() => {
  const product = path.join(bundleDir, 'Contents', 'Resources', 'app', 'product.json');
  const version = (JSON.parse(fs.readFileSync(product, 'utf8')) as { positronVersion?: unknown }).positronVersion;
  if (typeof version !== 'string') throw new Error(`${product} names no positronVersion.`);
  return version;
})();

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
 * The R the early releases run. R 4.6.0 crashes as it starts on 2025.01 and
 * 2025.02, measured 2026-09-27, and R 4.4.3, from the same month as 2025.02,
 * starts on all three. It is installed beside 4.6 with rig; these releases
 * find only the machine's current R by themselves, so they are handed this
 * one in `positron.r.customBinaries`.
 */
export const EARLY_R_BINARY = '/Library/Frameworks/R.framework/Versions/4.4-arm64/Resources/bin/R';

/**
 * The adapter's own checks read markings studied on the current release
 * only. Studying each release for them was stopped on 2026-09-27, since it
 * made the checks the work of whoever studied the releases rather than of
 * the engine; docs/PLAN.md has the decision. On any other release they say
 * so and do not run, rather than reading markings that are not there and
 * passing while checking nothing.
 */
const notStudiedHere =
  positronFamily === 'current'
    ? undefined
    : {
        notRun:
          `its markings were studied on the current release only, not on Positron ${positronVersion}`,
      };

export const positron: AppUnderTest = {
  productName: 'Positron',
  bundleDir,

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
          // Zen Mode goes full screen by default, and did, over the screen of
          // whoever ran the Journey on 2026-09-27. The engine blocks full
          // screen too; this keeps Zen Mode itself explorable.
          'zenMode.fullScreen': false,
          // Only for the early releases, which cannot run the machine's R.
          ...(positronFamily === 'early' ? { 'positron.r.customBinaries': [EARLY_R_BINARY] } : {}),
        },
        null,
        2
      )
    );
  },

  exclusions: {
    // A link to the VS Code documentation on the Welcome view, which opens a
    // page outside the application; a Route clicked it on 2026-09-27.
    names: ['read the VS Code docs'],
    // Positron wrote its own Quit, with no Electron role, so the engine's skip
    // of standard entries does not reach it. Out for good: no run lets it in.
    menuPaths: [['Positron', 'Quit Positron']],
    // Left out unless a run lets a group in with `phileas run --allow`. The
    // whole menu was listed on 2026-10-03, with focus faked so all of it was
    // enabled, and reviewed against these; the groups were chosen the same day.
    groups: {
      'new-windows': {
        why: 'Each opens a window a Route does not survey, or closes the only one it does.',
        menuPaths: [
          ['File', 'New Window'],
          ['File', 'Duplicate Workspace'],
          // The only window: a Route would read as the application stopping.
          ['File', 'Close Window'],
          ['View', 'Editor Layout', 'Move Editor into New Window'],
          // Positron writes a two-part shortcut into the label itself.
          ['View', 'Editor Layout', 'Copy Editor into New Window [⌘K O]'],
          ['Terminal', 'New Terminal Window'],
          ['Help', 'Open Process Explorer'],
          ['Help', 'Toggle Developer Tools'],
        ],
        // In the Profiles editor. A Route of the 5x500 Journey clicked it twice,
        // two Hops before the page stopped answering, finding a06c57c5.
        names: ['Open New Window with this Profile'],
      },
      outside: {
        why: 'Each opens a page outside the application, or reaches the network.',
        menuPaths: [
          ['Help', 'Report Issue'],
          ['Help', 'View License'],
          ['Help', 'Show Release Notes'],
          ['Help', 'Positron Documentation'],
          ['Help', 'Sign Up for Positron Updates'],
          ['Run', 'Install Additional Debuggers...'],
          ['File', 'New Folder from Git...'],
          ['File', 'Share', 'Export Profile (Default)...'],
        ],
      },
      'command-palette': {
        why:
          'The palette offers nearly every command again, and menu exclusions do not reach it, ' +
          "as RStudio's adapter found of its own.",
        menuPaths: [
          ['View', 'Command Palette...'],
          ['Help', 'Show All Commands'],
        ],
      },
      // A Route of Journey 56fe37294277 installed "Python Snippets 3" on
      // 2026-10-05, trusting its publisher and taking its pre-release, and
      // failed on that extension's own manifest error, not Positron's. Every
      // Install button in Positron's journals that day was in the Extensions
      // view. Browsing the Marketplace still reaches the network; only
      // installing from it is left out. "Install Python via uv", which
      // downloads Python rather than an extension, stays allowed, asked for in
      // the words "Allow Python via uv".
      marketplace: {
        why:
          'Each installs an extension from the Marketplace: it downloads third-party code and runs ' +
          'it in the Route, and the Marketplace changes daily, so no Route through it replays.',
        names: ['Install', 'Install Pre-Release', 'Trust Publisher & Install', 'Install Specific Version...'],
      },
      'native-dialog': {
        why:
          'Raises a confirmation from the main process with showMessageBox, a native dialog ' +
          'window.dialogStyle does not reach. It blocked both processes on two Routes of two on 2026-09-26.',
        menuPaths: [['File', 'Open Recent', 'Clear Recently Opened...']],
      },
    },
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

  checks: [
    {
      // From Positron's own marking of a notification's severity, not from a
      // bug report: docs/PLAN.md has why the trial's checks are written that
      // way, and why this is not a built-in check. Only notifications on
      // screen count; the notification list keeps old ones hidden.
      name: 'no-error-notification',
      why:
        'Positron shows a notification marked as an error only when something it tried failed, ' +
        'so one appearing after a Hop is a failure the Hop reached.',
      async run({ page }) {
        if (notStudiedHere) return notStudiedHere;
        const said = await page.locator(ERROR_NOTIFICATION).visible().allTextContents();
        return said.map((text) => `error notification: ${text.trim()}`);
      },
    },
  ],

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

    const errors = page.locator(ERROR_NOTIFICATION);
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
