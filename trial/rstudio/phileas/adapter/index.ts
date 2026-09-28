import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requireAppDir, type AppUnderTest } from '@drugstoresushi/phileas';
import type { ElectronApplication, Page } from '@playwright/test';

/**
 * The adapter for RStudio Desktop, pointed at a copy of the installed release
 * with two fuses switched back on.
 *
 * The installed release refuses Playwright's ordinary launch, so
 * PHILEAS_APP_DIR names the copy, and an unset variable is refused by name.
 * There are no sources, so the staleness guard cannot run, and the run says
 * so. docs/PLAN.md has the decision and docs/HISTORY.md the measurement.
 */
const homeIn = (userDataDir: string) => path.join(userDataDir, 'home');
const libraryIn = (userDataDir: string) => path.join(homeIn(userDataDir), 'R', 'library');

const bundleDir = requireAppDir();

/** How long to wait for the workbench window to appear at all. */
const WORKBENCH_WINDOW_TIMEOUT_MS = 60_000;

/**
 * The workbench is served by RStudio's own session on the loopback address.
 * The splash is a file inside the bundle.
 */
const isWorkbench = (page: Page) => /^http:\/\/127\.0\.0\.1:\d+\//.test(page.url());

/** The folders of the system temp path, as RStudio shows them, fixed for this machine. */
const TEMP_PATH_FOLDERS = new Set(fs.realpathSync(os.tmpdir()).split('/').filter(Boolean));

/**
 * Whether a link in RStudio's in-page file dialog names a folder above the
 * Route's home. The dialog opens in the home and shows one link per folder of
 * its path, up to `/`, measured on 2026-09-28. Two reasons to keep a Route
 * below: from the root a Route could save a file anywhere the user running
 * the Journey can write, and two of those folders are the run's own and the
 * Route's own, named at random, so a replay's pool would differ from the run's
 * and its draws would go elsewhere.
 *
 * The run's folder comes from PHILEAS_TEMP_FOLDER and every profile in it is a
 * Route's, this one's included. The engine refuses a Route without that
 * variable, so this refuses too rather than letting those links through.
 * What a Route can type holds no `/`, `..` or `~`, so the dialog's File name
 * and Go to directory boxes cannot name a folder outside the home either; a
 * slash added to the engine's typed values would undo that.
 */
function isAboveHome(name: string): boolean {
  if (name === '/' || TEMP_PATH_FOLDERS.has(name)) return true;
  const run = process.env.PHILEAS_TEMP_FOLDER;
  if (!run) throw new Error('PHILEAS_TEMP_FOLDER is unset, so the folders above the Route\'s home are unknown.');
  return name === path.basename(run) || fs.readdirSync(run).includes(name);
}

export const rstudio: AppUnderTest = {
  productName: 'RStudio',
  bundleDir,

  env: (userDataDir) => ({
    // A home folder of the Route's own. RStudio's configuration and R's follow
    // HOME, and Electron's profile follows only --user-data-dir, which the
    // engine supplies; measured on 2026-09-24.
    HOME: homeIn(userDataDir),
    // The What's New screen masks the IDE. Any value but empty disables it,
    // read in the release's main process on 2026-09-28.
    RSTUDIO_DISABLE_WHATS_NEW: '1',
    // No splash window. Any value turns it off, read in the release's main
    // process on 2026-09-28; selectPage below still passes over one, should
    // a later release bring it back under another switch.
    RS_NO_SPLASH: '1',
    // A package library of the Route's own, created before launch, so a
    // package a Route installs lands in its profile and not in the machine's
    // R. R puts an existing R_LIBS_USER first in .libPaths() and installs into
    // the first; without it, the machine's library was the only one. Measured
    // in RStudio's own console on 2026-09-28, and the Install Packages dialog
    // then defaulted to this library. r-library-guard.ts checks it held.
    R_LIBS_USER: libraryIn(userDataDir),
  }),

  /**
   * RStudio's logs, under the Route's own home. A healthy launch writes
   * `rdesktop.log`, empty, and no session log at all, measured 2026-09-28: the
   * session log is created when the session first logs something. It is the
   * one that matters most, since it is where a client exception that showed
   * nothing on screen was left, docs/HISTORY.md 2026-09-21. So it is marked
   * as created on its first write: until it appears it counts as clean,
   * where before every Hop of a healthy Route said the check did not run.
   *
   * RStudio backs the session log up as it grows, to `rsession-<user>.1.log`,
   * `.2.log` and on. Only the current one is named: a backup holds lines
   * already read, and would report them again. A Route's home starts with
   * none, so a backup mid-Route needs the log to grow that far within one
   * Route, and the lines written between the last read and the backup would
   * then go unread. The engine reads a log that shrank from its start.
   */
  logPaths: (userDataDir) => {
    const logs = path.join(homeIn(userDataDir), '.local', 'share', 'rstudio', 'log');
    return [
      path.join(logs, 'rdesktop.log'),
      { path: path.join(logs, `rsession-${os.userInfo().username}.log`), createdOnFirstWrite: true },
    ];
  },

  // A terminal's handle, made fresh for each terminal: eight upper-case hex
  // digits on all five launches that logged it on 2026-09-28, such as
  // 3968F855. Without this, closing a terminal, ronplusron/phileas issue 61,
  // had a new signature each time and could never match as known.
  varyingInSignatures: [[/Unknown handle: "[0-9A-F]{8}"/g, 'Unknown handle: "<handle>"']],

  async beforeLaunch(userDataDir: string): Promise<void> {
    // The library inside the home, which makes the home too. R skips an
    // R_LIBS_USER that does not exist.
    await fs.promises.mkdir(libraryIn(userDataDir), { recursive: true });

    // File and message dialogs drawn in the page, where a Route can see and
    // use them. RStudio's native ones are drawn by macOS, which Phileas cannot
    // reach, so the engine's stub answers each as cancelled and nothing inside
    // one is explored. Raised on 2026-09-28; with it off, Open File and Load
    // Workspace each opened in the page and the stub recorded nothing. The
    // stub stays, for any native dialog this does not reach.
    const config = path.join(homeIn(userDataDir), '.config', 'rstudio');
    await fs.promises.mkdir(config, { recursive: true });
    await fs.promises.writeFile(
      path.join(config, 'rstudio-prefs.json'),
      JSON.stringify({ native_file_dialogs: false }, null, 2)
    );
  },

  // Menu paths are written as the engine reads them, with RStudio's `&`
  // mnemonic markers in place. An entry that matches nothing is reported, so
  // one that stops matching after an upgrade does not go quiet.
  exclusions: {
    // Posit Assistant, excluded on 2026-09-28 from two options offered: it
    // needs a sign-in, and a model's answers cannot be replayed from a seed.
    // RStudio is tested without its AI features, and its findings say so.
    names: [
      'Posit Assistant',
      // Global Options' page for the AI assistants, whose Install button
      // installs one. Excluded as a page rather than by that button's name,
      // since the Install Packages dialog's own button is also just Install.
      'Assistant',
      // The Packages pane's way into the dialog excluded from the Tools menu
      // below, surveyed on 2026-09-28.
      'Check for package updates',
      // The Global Options setting that would bring native dialogs back
      // mid-Route, undoing what beforeLaunch sets.
      'Use native file and message dialog boxes',
    ],
    menuPaths: [
      ['&View', 'Show Pos&it Assistant'],
      ['&Help', '&Check for Posit Assistant Updates...'],
      ['&Help', 'Dia&gnostics', 'Uninsta&ll Posit Assistant...'],
      // RStudio's own Quit, apart from the standard Quit the engine already
      // skips; and a second RStudio window, which a Route does not survey.
      ['&Session', '&Quit Session...'],
      // The same command in the File menu, missed at first: a Route chose it
      // on 2026-09-28 and RStudio quit.
      ['&File', '&Quit Session...'],
      ['&Session', '&New Session'],
      // A crash on purpose, which is RStudio's own diagnostic, not a bug.
      ['&Help', 'Dia&gnostics', 'Crash RStudio Desktop (DA&NGER)'],
      // Updates, which R by default installs into whichever library already
      // holds the package, the machine's. What RStudio's own update does is
      // not measured. Installing is allowed: it goes to the Route's library,
      // and asks CRAN over the network for the package typed.
      ['&Tools', 'Check for Package &Updates...'],
      // Over the network to Posit.
      ['&Help', 'Check for RStudio &Updates'],
      // Pages outside the application, judged from their names on 2026-09-28
      // and not measured; the outbound-link stub records any that were missed.
      ['&Help', 'RStudio &Docs'],
      ['&Help', 'RStudio Community &Forum'],
      ['&Help', 'R&elease Notes'],
      ['&Debug', 'Debugging &Help'],
      ['&Profile', 'Profiling &Help'],
      ['&Help', '&Cheat Sheets', '&RStudio IDE Cheat Sheet'],
      ['&Help', '&Cheat Sheets', 'Data Transformation with &dplyr'],
      ['&Help', '&Cheat Sheets', 'Data Visualization with &ggplot2'],
      ['&Help', '&Cheat Sheets', 'List manipulation with &purrr'],
      ['&Help', '&Cheat Sheets', 'Package De&velopment with devtools'],
      ['&Help', '&Cheat Sheets', 'Web Applications with &shiny'],
      ['&Help', '&Cheat Sheets', 'Interfacing Spar&k with sparklyr'],
      ['&Help', '&Cheat Sheets', 'R &Markdown Cheat Sheet'],
      ['&Help', '&Cheat Sheets', 'R Markdo&wn Reference Guide'],
      ['&Help', '&Cheat Sheets', '&Browse Cheat Sheets...'],
    ],
    // The R session's memory reading, whose name carries a number that
    // changes about once a second, so a replay would draw a different pool:
    // "121,920 KiB used by R session" on one launch and "122,288 KiB" on the
    // next, 2026-09-28. Decided by the name alone, so it answers the same on
    // a replay. It still ticks in the page, which the settle wait and each
    // Hop's effect both see; docs/OUTSTANDING.md 1.9 has the remedy agreed.
    //
    // And anything naming Copilot, excluded on 2026-09-28 with Posit Assistant
    // and for the same reasons. None showed on the startup survey: Copilot is
    // off by default, `copilot_enabled` in RStudio's preferences, and its
    // controls are in Global Options. A predicate rather than names, since
    // those were not surveyed; `&` is taken out so a menu label's mnemonic
    // cannot split the word.
    //
    // And a choice of the machine's R library. The Install Packages dialog's
    // "Install to Library:" offers it beside the Route's own, surveyed on
    // 2026-09-28, and an option is chosen as a candidate of its own.
    //
    // And a file dialog's path links above the Route's home; isAboveHome says
    // why.
    //
    // And anything that prints. File -> Print... opens macOS's print dialog,
    // which the engine's stub does not reach: on 2026-09-28 it blocked
    // RStudio's page, failed a Route, and held the Journey until it was
    // closed by hand. Print entries appear only once a document is open, so
    // by name rather than by path; `&` is taken out so "Pr&int..." matches.
    exclude: (candidate) =>
      (candidate.source === 'page' && / used by R session\b/.test(candidate.name)) ||
      /copilot/i.test(candidate.name.replace(/&/g, '')) ||
      (candidate.source === 'page' && candidate.role === 'option' && /\/R\.framework\//.test(candidate.name)) ||
      (candidate.source === 'page' && candidate.role === 'link' && isAboveHome(candidate.name)) ||
      /\bprint\b/i.test(candidate.name.replace(/&/g, '')),
  },

  /**
   * The workbench window, never the splash. Without RS_NO_SPLASH, RStudio
   * opens a splash from a file in its bundle and the workbench beside it, and
   * closes the splash about 2.5 seconds later: measured on three launches on
   * 2026-09-28. The first window is either one, and a survey that took the
   * splash failed when it closed.
   */
  async selectPage(app: ElectronApplication): Promise<Page> {
    const deadline = Date.now() + WORKBENCH_WINDOW_TIMEOUT_MS;
    for (;;) {
      const found = app.windows().find(isWorkbench);
      if (found) return found;
      const left = deadline - Date.now();
      if (left <= 0) {
        const seen = app.windows().map((page) => page.url());
        throw new Error(
          `RStudio opened no workbench window in ${WORKBENCH_WINDOW_TIMEOUT_MS} ms; ` +
            `its windows: ${seen.length ? seen.join(', ') : 'none'}`
        );
      }
      await app.waitForEvent('window', { timeout: Math.min(left, 1_000) }).catch(() => undefined);
    }
  },

  /**
   * Ready once the main toolbar shows, and refused, in RStudio's own words,
   * when a dialog is up before it does (R24). What RStudio shows when it boots
   * into an error is not yet measured, so a dialog is the first reading of it
   * rather than a studied one.
   */
  async waitForReady(page: Page): Promise<void> {
    const toolbar = page.getByRole('toolbar', { name: 'Main' });
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
    await toolbar.or(dialog).first().waitFor({ state: 'visible', timeout: 60_000 });
    if (!(await toolbar.isVisible()) && (await dialog.first().isVisible())) {
      const said = (await dialog.first().innerText()).trim().replace(/\s+/g, ' ');
      throw new Error(`RStudio showed a dialog before its workbench: ${said}`);
    }
  },
};

export default rstudio;
