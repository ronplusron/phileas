import type { ElectronApplication, Page } from '@playwright/test';

/**
 * The whole contract between the engine and one particular application.
 *
 * Everything else in src/ depends only on this interface and Playwright.
 * Nothing in here knows a selector, a view name, or anything about what the
 * application is for. That is deliberate: an engine that required an adapter to
 * list the application's controls would be more precise and would stop being a
 * framework, which is the trade the project exists to make. An optional map,
 * full or partial, is agreed for phase 10 and is never required;
 * docs/OUTSTANDING.md has what is open about it, and ../CLAUDE.md carries the
 * commitment.
 */

/**
 * One thing a Route could act on next.
 *
 * Minimal on purpose. survey() is what produces these, and it may add to this
 * shape; what is here is only what an exclusion predicate needs in order to
 * decide.
 */
export type Candidate = {
  /** The accessibility role, or 'menuitem' for an entry in the native menu. */
  readonly role: string;

  /**
   * The accessible name. Never empty: an element without one is reported as a
   * finding rather than offered as a candidate, because it cannot be reliably
   * hopped to.
   */
  readonly name: string;
} & (
  | { readonly source: 'page' }
  | {
      readonly source: 'menu';
      /**
       * The label path from the application menu root.
       *
       * Required for a menu entry rather than optional across both. The rail
       * that keeps a Route off Quit is `Exclusions.menuPaths`, and it can only
       * match against this: a menu candidate produced without one escaped that
       * rail silently, which is the worst direction for a guard to fail. Fixed
       * while `survey` does not exist yet and it costs nothing.
       */
      readonly menuPath: readonly string[];
    }
);

/**
 * What must never be hopped to.
 *
 * Two forms, because they are not interchangeable. A list of names can be
 * DERIVED from the application's source and checked against it, which is what
 * keeps it from going stale the day upstream adds another way out of the
 * application. A predicate cannot be derived, so it is the exception rather
 * than the shape.
 *
 * This is a safety rail, not a map. It says what a Route may not touch. It
 * never says what a Route may touch, which is survey()'s job, and in phase 10
 * a map's as well where one is given.
 */
export interface Exclusions {
  /** Accessible names that must never be hopped to, however they are reached. */
  names?: string[];

  /** Menu label paths that must never be clicked, such as ['File', 'Quit']. */
  menuPaths?: string[][];

  /**
   * For an exclusion a list of names cannot express.
   *
   * The case this exists for, measured on a real application: the keyboard
   * shortcut that closes an editor tab closes the whole application once no
   * tabs remain. A control that is harmless many times and fatal once cannot
   * be excluded by name.
   *
   * Must be deterministic given the page it is handed. The exclusion list is
   * an input to the seeded draw, so a predicate that answered differently on a
   * replay would send every hop after it somewhere else.
   */
  exclude?(candidate: Candidate, page: Page): boolean | Promise<boolean>;

  /**
   * Whether `names` also excludes menu entries, or only page elements.
   *
   * Stated rather than left to be inferred. A menu entry carries a `name` like
   * any other candidate, so a list naming "Quit Buggy" already covers it and a
   * `menuPaths` entry for the same item adds nothing -- which is what the
   * reference adapter used to demonstrate, leaving a copier unable to tell
   * which of the two was doing the work.
   *
   * Defaults to true, matching how `names` reads. Set false where an
   * application has a page control and a menu entry with the same label and
   * only one of them should be excluded.
   */
  namesCoverMenuEntries?: boolean;
}

/**
 * What the staleness guard needs, which exists only where the sources the
 * build came from do.
 *
 * Grouped rather than left as three loose fields because they arrive and
 * depart together. Absent means there are no sources to compare against: the
 * guard cannot run, and the run says so rather than reporting it as passed.
 * That is constraint C1a, written here so that a half-configured guard cannot
 * be expressed in the first place.
 */
export interface StalenessGuard {
  /**
   * Absolute path to the checkout the packaged build was made from.
   *
   * Named for what it points at rather than for a repository root, because
   * under the common deployment shape it is a checkout of somebody else's
   * application that you built yourself, not your own tree.
   */
  sourceRoot: string;

  /**
   * Paths under sourceRoot that the packager copies into app.asar and the
   * application actually loads. This drives the comparison, so anything
   * omitted here can drift out of date without the guard noticing. Keep it in
   * step with whatever the package script excludes.
   */
  packagedInputs: string[];

  /** Return true to skip a path under packagedInputs (caches, .DS_Store). */
  ignoreInput?(relativePath: string): boolean;
}

/**
 * A check that ships with the engine and assumes nothing about any
 * application. R17 in docs/PRODUCT_REQUIREMENTS.md names the set.
 */
export type UniversalCheck =
  | 'uncaught-error'
  | 'console-error'
  | 'still-responding'
  | 'window-showing-content'
  | 'no-navigation-away'
  | 'no-unexpected-dialog'
  | 'named-controls';

/**
 * Switching off or narrowing a built-in check, with the reason recorded.
 *
 * R19 exists because an application that writes to the console in normal
 * operation is otherwise unusable with this engine, and weakening the check
 * for everyone is the wrong answer. The reason is required rather than
 * optional, because the report states what was narrowed and "narrowed" with no
 * reason tells a reader nothing they can act on.
 *
 * This replaces the lifted failOnPageError flag. A private switch for one
 * check is what R19 generalizes, and keeping both invites the two to disagree
 * about the same check.
 */
export type Narrowing =
  | {
      /** The check does not run for this application at all. */
      readonly kind: 'off';
      /** Why this application cannot run the check as it ships. */
      readonly reason: string;
    }
  | {
      /** The check runs, and this application accepts some of what it sees. */
      readonly kind: 'narrowed';
      /** Why this application cannot run the check as it ships. */
      readonly reason: string;

      /**
       * Return true for an observation this application considers acceptable.
       *
       * Must be deterministic. A Route ends at the first violation, so a
       * verdict that cannot be reproduced would end Routes at random and make a
       * red result not worth reading.
       */
      accept(observation: string): boolean;
    };

export interface AppUnderTest {
  /**
   * A readable name for the application, for reports and for naming temporary
   * directories.
   *
   * Optional, and deliberately carries nothing. The lifted interface required
   * it and derived both the dist directory and the executable name from it.
   * One confirmed consumer declares no product name anywhere in package.json,
   * so its adapter would have been inventing a value to feed two derivations
   * that were wrong for it regardless.
   */
  productName?: string;

  /**
   * Absolute path to the packaged application bundle.
   *
   * Required, and not an escape hatch. Two confirmed consumers package into
   * two different layouts and neither matches what the lifted code assumed, so
   * there is no default worth keeping. The executable inside is read from the
   * bundle rather than assumed from a product name.
   */
  bundleDir: string;

  /**
   * The sources the bundle was built from, for the staleness guard (R23).
   *
   * Absent where there are none, which is the shape where the engine is
   * pointed at an installed binary. The guard then cannot run at all, and the
   * run reports that rather than passing quietly.
   */
  staleness?: StalenessGuard;

  /** What a Route must never act on. */
  exclusions: Exclusions;

  /**
   * Resolve once the application is usable.
   *
   * Must THROW, with the application's own message, when it booted into an
   * error state. An implementation that only waits for a success marker turns
   * a clear failure into a timeout, which reports as "did not appear" and says
   * nothing about why. That is R24, and it is the reason a future implementer
   * would otherwise remove this comment.
   */
  waitForReady(page: Page): Promise<void>;

  /**
   * Choose which page is the application.
   *
   * waitForReady(page) presumes the engine already picked the right one, and
   * an application with a splash window has more than one. Defaults to the
   * first window.
   */
  selectPage?(app: ElectronApplication): Promise<Page>;

  /** Extra command-line arguments added to every launch. */
  launchArgs?: string[];

  /**
   * Environment variables for every launch.
   *
   * Almost everything an application needs in order to run hermetically
   * arrives this way rather than as a flag, and one confirmed consumer cannot
   * launch without one.
   */
  env?: Record<string, string>;

  /**
   * Run before each launch, to seed settings on disk.
   *
   * Several settings decide whether automation is possible at all, and they
   * have to be in place before the process starts rather than after it.
   */
  beforeLaunch?(userDataDir: string): Promise<void>;

  /**
   * Shut the application down, where closing the connection is not enough.
   *
   * Closing a debugging connection does not terminate the process. This
   * matters more than it first looks: a Route relaunches rather than
   * reloading, so a shutdown that leaks costs one stray process per Route.
   */
  shutdown?(app: ElectronApplication): Promise<void>;

  /**
   * Absolute paths to logs the application writes.
   *
   * A failure can be invisible on screen, raise no dialog, write nothing to
   * the renderer console, and leave an exception in a log. An adapter naming
   * none gets no log check, and the report says so rather than leaving the
   * absence to be inferred from silence.
   */
  logPaths?: string[];

  /**
   * Recognize a process belonging to this application.
   *
   * Two readers. Cleanup, which is what it was found for. And the check that
   * nothing else launched: a foreign process appearing after a hop is evidence
   * that a Route left the application, and that evidence does not depend
   * on the external-link stub having taken effect. docs/PLAN.md says why a
   * second source is not redundant with the stub's own recorder.
   */
  isOwnProcess?(command: string): boolean;

  /**
   * Built-in checks this application cannot run as they ship (R19).
   *
   * Every entry appears in the report. A check narrowed quietly is
   * indistinguishable from one that passed.
   */
  narrowedChecks?: Partial<Record<UniversalCheck, Narrowing>>;

  /**
   * How long the page must stay unchanged after a Hop to count as settled, in
   * milliseconds. Leave it out for the engine's default.
   *
   * For an application whose effects pause longer than the default partway
   * through, so that the settle wait would otherwise stop mid-change. The
   * length used is written in every journal, because it decides when a Hop's
   * effect is read and so what a replay compares against.
   */
  settleQuietMs?: number;
}
