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
 * How a target names a frame it sits inside: the label of the frame's
 * element, its `title`, else its `name`, else its `id`, else empty, and which
 * of the frames in the same document sharing that label it is, in document
 * order, counting from 1.
 *
 * The accessibility snapshot names no frame, whatever its title, so the
 * element's own attributes are what is left. Measured on RStudio on
 * 2026-10-09: its data viewer's frame is titled "Data Browser" and Help's
 * "Help Pane", and a position alone would shift as one opens before the
 * other in the page.
 */
export interface FrameName {
  readonly label: string;
  readonly nth: number;
}

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
  | {
      readonly source: 'page';
      /**
       * The frames it sits inside, outermost first, for a control drawn in a
       * frame; absent for one in the window's own page. See `FrameName`.
       */
      readonly frame?: readonly FrameName[];
    }
  | {
      readonly source: 'menu';
      /**
       * The label path from the application menu root.
       *
       * Required for a menu entry rather than optional across both. The rail
       * that keeps a Route off Quit is `Exclusions.menuPaths`, and it can only
       * match against this: a menu candidate produced without one escaped that
       * rail silently, which is the worst direction for a guard to fail.
       */
      readonly menuPath: readonly string[];
    }
  | {
      /**
       * A key to press on whatever has focus. `role` is 'key' for one of the
       * common keys, or 'shortcut' for one printed in a control's accessible
       * name, and `name` is how it is written there, such as '⌘S'.
       */
      readonly source: 'key';
      /** The key as Playwright presses it, such as 'Meta+s' or 'ArrowUp'. */
      readonly key: string;
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
   * Standard menu entries to offer after all, named by their Electron role in
   * lower case, such as `['undo', 'redo']`.
   *
   * Every menu entry Electron builds from a standard role is skipped by
   * default: Quit, Hide, Reload, the clipboard, Undo and Redo, the Zoom
   * entries, Substitutions, Speech, Minimize and the rest. Entries the
   * application's own authors wrote carry no role and are always offered.
   * Measured on three applications on 2026-09-26: every standard entry
   * carried a role, and none of the applications' own did. Decided the same
   * day, over skipping only the risky ones, because a run on trickster-tales
   * spent Hops on Redo, Delete, the Zoom entries and Bring All to Front, and
   * each changed nothing.
   *
   * The default is an input to the seeded draw like any exclusion, so the
   * roles allowed back are written on each Route's opening journal line, and
   * one that is never on offer is reported as stale.
   */
  allowStandardMenuRoles?: string[];

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

  /**
   * Exclusions a run can let back in, each group named, such as
   * `{ 'new-windows': { why: 'a Route surveys one window', menuPaths: [['File',
   * 'New Window']] } }`.
   *
   * Excluded by default, like `names` and `menuPaths`. `phileas run --allow
   * new-windows`, which travels as `PHILEAS_ALLOW_EXCLUDED`, lets a group back
   * in for that run, and a name the adapter does not declare is refused.
   * Asked for on 2026-10-03, when Positron's whole menu was reviewed, in the
   * words "What if I want to run a few tests, say, with newwindows?" An entry
   * in `names` or `menuPaths` stays out whatever a run allows, so what must
   * never be reached, such as Quit, stays apart from what a run usually
   * leaves out.
   *
   * Like every exclusion, a group is an input to the seeded draw, so the
   * groups a run let in are written on each Route's opening journal line.
   */
  groups?: Readonly<Record<string, ExclusionGroup>>;
}

/** One named group of exclusions a run can let back in. See `Exclusions.groups`. */
export interface ExclusionGroup {
  /** Why the group is left out by default, which a run letting it in sets aside. */
  why: string;
  names?: string[];
  menuPaths?: string[][];
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
 * The checks that ship with the engine and assume nothing about any
 * application, in the order every Hop's line lists them. R17 in
 * docs/PRODUCT_REQUIREMENTS.md names them.
 *
 * `log-error` was placed in this tier on 2026-09-26: it assumes nothing about
 * an application beyond where its logs are, and it does not run unless the
 * adapter names one in `logPaths`, which the journal says on every Hop.
 *
 * **The type is derived from this list, not written beside it.** A check added
 * to a separate type and left out of the list compiled, never ran, and never
 * appeared on a Hop's line, which reads as passed.
 */
export const UNIVERSAL_CHECKS = [
  'uncaught-error',
  'console-error',
  'still-responding',
  'window-showing-content',
  'no-unexpected-dialog',
  'log-error',
  'no-navigation-away',
  'named-controls',
] as const;

/** A check that ships with the engine; see `UNIVERSAL_CHECKS`. */
export type UniversalCheck = (typeof UNIVERSAL_CHECKS)[number];

/**
 * Checks that ship with the engine and are off for every application unless
 * its adapter has them on by default (`checksByDefault`) or a Journey or a run
 * includes them. Each assumes nothing about the
 * application, as the universal ones do, but costs enough, or finds enough
 * on its first run, that turning it on is the adapter's decision. Decided on
 * 2026-10-14: "Think of optional checks as an opt-in availability to
 * adapters."
 *
 * - `wcag-aa`: axe-core's WCAG 2 A and AA rules, over the page and every
 *   frame in it. On RStudio its first Journey found five faults on the
 *   opening screen, which ended every Route there until they were known,
 *   and each scan took 0.1 to 0.6 s.
 */
export const OPTIONAL_CHECKS = ['wcag-aa'] as const;

/** A check the engine offers and an adapter turns on; see `OPTIONAL_CHECKS`. */
export type OptionalCheck = (typeof OPTIONAL_CHECKS)[number];

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

/**
 * A check the adapter declares for its own application, run after every Hop,
 * Fix steps included, after the built-in ones (R18).
 *
 * **What it asserts comes from the application agreeing with itself,** such
 * as two places on screen stating the same fact, never from a bug report and
 * never from the application's own code. A check written by knowing a bug
 * finds that bug and proves nothing else, and one copied from the code passes
 * whatever the code does. docs/PLAN.md has the decision, and ../CLAUDE.md the
 * trap.
 *
 * Judged exactly as a built-in check is: each violation by its signature, a
 * known finding carried past, and any other violation ending the Route.
 */
export interface AppCheck {
  /**
   * Lower-case words joined by hyphens, unique, and not the name of a
   * built-in check. It begins every signature this check produces, so
   * renaming it turns each of its known findings into a new one.
   */
  readonly name: string;

  /** What should be true, and why it should: the report's reason for the check. */
  readonly why: string;

  /**
   * Whether this check has anything to look at on the screen as it stands,
   * read from the same settled tree `run` is handed. A check that does not
   * apply is left off the step's line entirely, so a hundred checks do not
   * fill every line with ones that had nothing to look at; agreed on
   * 2026-10-16, docs/HISTORY.md, 2026-10-16. Absent, the check applies on every
   * step.
   *
   * **The same rules as `run`:** it reads and never acts, it answers the same
   * on a replay, and it is bounded by the responsive wait. One that does not
   * answer in time is recorded as not run; one that throws is a broken check.
   * A test should show it true on the screen it is written for, since one
   * that never answers yes reads on a run exactly like a screen never reached.
   */
  appliesWhen?(context: AppCheckContext): Promise<boolean> | boolean;

  /**
   * What is wrong right now: an empty list when nothing is, or why the check
   * could not look.
   *
   * **It reads and never acts.** A check that clicked, typed or waited for
   * something to change would change what the next Hop surveys, and a
   * replay would go somewhere else. It must also be deterministic, for the
   * reason `Narrowing.accept` gives. The engine bounds it by the responsive
   * wait, and a check that does not answer in time is recorded as not run.
   */
  run(context: AppCheckContext): Promise<AppCheckVerdict> | AppCheckVerdict;
}

/** What an adapter's check is handed. */
export interface AppCheckContext {
  readonly page: Page;
  readonly app: ElectronApplication;
  /** The page's settled accessibility tree, as the survey read it, or undefined when the page did not answer. */
  readonly tree: unknown;
}

/** Each violation as one observation, or why the check could not look. */
export type AppCheckVerdict = readonly string[] | { readonly notRun: string };

/**
 * A relation the adapter declares for its own application: the application
 * agreeing with itself over time (R20), such as a sort cycled back to
 * unsorted restoring the order it had. A Hop whose target `when` names
 * starts it; the engine reads a value before the Hop acts, takes the
 * relation's Detour, reads again, and compares the two. Its Detour takes no
 * draw, so the Trip's stream is unchanged, and its steps do not count toward
 * the Trip length.
 *
 * **What it asserts comes from the application agreeing with itself,** as an
 * `AppCheck`'s does: never from a bug report or the application's own code.
 * docs/HISTORY.md, 2026-10-19, has the decisions, taken on 2026-10-15 and
 * 2026-10-19.
 *
 * Judged as a check is, by the signature of each violation, so a known
 * finding is carried past. Only the first relation that applies to a Hop
 * takes its Detour; the others are recorded as not taken.
 */
export interface AppRelation {
  /** As `AppCheck.name`, and unique among the adapter's checks and relations together. */
  readonly name: string;

  /** What should hold, and why it should: the report's reason for the relation. */
  readonly why: string;

  /**
   * The Hop's target that starts it, matched against the target as the
   * journal and `phileas survey` write it, such as `button "Clear search"`
   * or `frame "Data Browser" > button "Sort column mpg ascending"`. What it
   * captures is handed to `steps` and `back`.
   */
  readonly when: RegExp;

  /**
   * Whether the relation has anything to compare on the screen as it stands,
   * before the Hop acts, as `AppCheck.appliesWhen` is asked after one. Absent,
   * a Hop `when` matches always starts it. It reads and never acts.
   */
  appliesWhen?(context: RelationContext): Promise<boolean> | boolean;

  /**
   * The value compared, read before the Hop acts and again after the Detour.
   * It reads and never acts, and is bounded by the responsive wait. It goes
   * on the journal's line whole, so keep it small: the rows in view, not a
   * frame's every row.
   */
  read(context: RelationContext): Promise<RelationReading> | RelationReading;

  /**
   * The Detour's steps, taken after the Hop, each a target as a Fix's `act`
   * step names one, with a value for text to type. Named targets rather than
   * code, so a journal holds each step whole. A first step not on offer means
   * the relation does not apply; a later one not on offer is a finding,
   * unless something covers or hides it.
   */
  steps(hop: DetourHop): readonly DetourStep[];

  /** What is wrong, comparing the reading before the Hop with the one after the Detour: an empty list when nothing is. */
  expect(before: RelationReading, after: RelationReading): readonly string[];

  /**
   * The way back to where the Hop left the screen, taken after the
   * comparison, so the next Hop draws from the screen the seed's own Hop
   * made. Absent, the Route continues from where the Detour ended, and the
   * journal says so.
   */
  back?(hop: DetourHop): readonly DetourStep[];
}

/** The Hop a relation starts from: its target as written, what `when` captured, how it acted, and any value typed. */
export interface DetourHop {
  readonly target: string;
  readonly match: readonly string[];
  readonly action: string;
  readonly value?: string;
}

/** One step of a Detour: a target as a Fix's `act` step takes one, and text to type where it takes typing. */
export interface DetourStep {
  readonly target: string;
  readonly value?: string;
}

/** What a relation's `appliesWhen` and `read` are handed: what a check is, and the Hop. */
export interface RelationContext extends AppCheckContext {
  readonly hop: DetourHop;
}

/** A value a relation reads, plain data so a journal holds it. */
export type RelationReading =
  | string
  | number
  | boolean
  | null
  | readonly RelationReading[]
  | { readonly [key: string]: RelationReading };

/**
 * A log for the log check: its absolute path, or the path marked as a log the
 * application creates only when it first writes to it.
 *
 * A named log that does not exist makes the check say it did not run, since
 * read as nothing a mistyped path would pass on every Hop while checking
 * nothing. Some logs do not exist on a healthy run: RStudio creates its
 * session log only when the session first logs something, measured on
 * 2026-09-28, and every Hop of a healthy Route said the check did not run.
 * Marked, such a log counts as clean until it appears, and is read from its
 * start when it does. Mark only a log measured to appear this way; an
 * unmarked one keeps a mistyped path loud.
 *
 * `timeOf` reads a line's own time, in milliseconds since the epoch, or
 * returns undefined for a line with none. Without it, a line is known only to
 * have been written between two reads, which can be several Hops apart. The
 * zone is the adapter's to supply: a time written with none, parsed as if
 * local, lands hours off. A time outside the reads around the line is not
 * trusted, and the failure says so.
 *
 * `failsOn` is a pattern for a failure line this log writes in its own words,
 * matched as well as the engine's own rule, `LOG_FAILURE`, never instead of
 * it. Asked for on 2026-10-03 for Bobolink Inbox, whose log writes a failure
 * as "failed: <kind>" and one sign-in failure with no error name at all.
 */
export type LogPath =
  | string
  | {
      readonly path: string;
      readonly createdOnFirstWrite?: true;
      readonly timeOf?: (line: string) => number | undefined;
      readonly failsOn?: RegExp;
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
   * The application's own name for the release being run, where the bundle's
   * version is not it, for the journal's opening line beside the version the
   * bundle gives (C1).
   *
   * Optional, since the bundle's own version is usually right. Positron's is
   * not: its bundle calls 2026.09.1 by the version of the editor it is built
   * on, 1.130.0, measured 2026-10-12, and only its `product.json` names the
   * release. Read it from the bundle in the adapter rather than writing it
   * down, or it goes stale on the next install.
   */
  release?: string;

  /**
   * What the application runs with that its bundle cannot say, as short named
   * values, for the journal's opening line beside the build (C1): which R
   * RStudio starts, say, or which R and Python Positron is offered. Each name
   * should say where its value came from, as `R (RSTUDIO_WHICH_R)`, since the
   * same fact can come from more than one place.
   *
   * Called at every launch, before the application starts, with the
   * environment it is about to be given. So it is the adapter's account of
   * the setup, not anything the engine saw the application use: RStudio on
   * Windows, for one, can be told another R in its own settings. A value read
   * from the running application belongs on a later line.
   *
   * Should not throw, and is not trusted not to: a throw is recorded as
   * `runsWithUnread`, with its message, and the launch goes on.
   */
  runsWith?(launch: {
    readonly userDataDir: string;
    readonly env: Readonly<Record<string, string>>;
  }): Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;

  /**
   * Addresses whose responses the engine keeps, for `ranWith` to read, on the
   * application's whole browser context from the moment the launch returns,
   * since what an application says about itself at start, as RStudio's
   * `/rpc/client_init` does, is said once. Only the latest few for each
   * pattern are kept.
   *
   * **Not from before the first window loads,** which nothing in Playwright
   * reaches: measured on 2026-10-12, `buggy`'s own page had loaded by then
   * and was not caught, while RStudio's `client_init`, which comes seconds
   * later, was caught on every launch. So a `ranWith` reading a response its
   * application must have sent should say it is missing, never read its
   * absence as nothing having started.
   */
  captureResponses?: readonly RegExp[];

  /**
   * What the running application was seen to run with, as short named
   * values, such as `{ R: '4.6.0' }`: read from the application itself, not
   * from its setup, which is `runsWith`'s.
   *
   * Asked after launch, after the Fix and after every Hop, so return
   * everything seen so far each time; the engine journals each new value on
   * a note line where it was first seen, and rolls them up on the Route's
   * outcome, as `none` where nothing was ever seen. Read the responses
   * `captureResponses` kept through `responses`, or the Route's own logs.
   * A value not yet known is left out, never guessed.
   *
   * Should not throw, and is not trusted not to: a throw is recorded as
   * `ranWithUnread` and the Route goes on. Given five seconds.
   */
  ranWith?(context: {
    readonly app: ElectronApplication;
    readonly page: Page;
    readonly userDataDir: string | undefined;
    readonly responses: (pattern: RegExp) => readonly string[];
  }): Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;

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

  /**
   * Extra command-line arguments added to every launch.
   *
   * A list, or a function handed the launch's own profile folder, for an
   * argument that has to name a fresh folder each Route. The case this exists
   * for is Positron's `--extensions-dir`: a fixed one would be shared by every
   * Route, which is the inherited state R3 forbids, and left out it is the
   * machine's real one. Kept deterministic, since the arguments decide what the
   * application offers and so what a seed draws.
   */
  launchArgs?: string[] | ((userDataDir: string) => string[]);

  /**
   * Environment variables for every launch.
   *
   * Almost everything an application needs in order to run hermetically
   * arrives this way rather than as a flag, and one confirmed consumer cannot
   * launch without one.
   *
   * A record, or a function handed the launch's own profile folder, for a
   * variable that has to name a fresh folder each Route. The case this exists
   * for is HOME on Positron: its in-page file dialogs start in the home
   * folder, and a Route must not read or write the real one.
   */
  env?: Record<string, string> | ((userDataDir: string) => Record<string, string>);

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
   *
   * A list, or a function handed the Route's own profile folder, for an
   * application whose logs live inside it. Measured on Positron on 2026-09-26:
   * it writes no log at all unless launched with `--logsPath`, and a fresh
   * folder per Route has to sit inside that Route's profile. The function form
   * needs `runRoute` to be given the folder, and refuses to start without it.
   */
  logPaths?: LogPath[] | ((userDataDir: string) => LogPath[]);

  /**
   * Recognize a process belonging to this application.
   *
   * **Nothing reads it yet.** It is reserved for the foreign-process half of
   * the no-navigation-away check, which is not built: a foreign process
   * appearing after a hop is evidence that a Route left the application, and
   * that evidence does not depend on the external-link stub having taken
   * effect. docs/PLAN.md says why a second source is not redundant with the
   * stub's own recorder. Declaring it today changes nothing.
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
   * Whether each check runs for this application when neither the Journey nor
   * the run includes or excludes it, by name: any built-in check, any of the
   * engine's optional ones, or this adapter's own. A check left out keeps the
   * engine's default: on for a built-in check and the adapter's own, off for
   * an optional one (`OPTIONAL_CHECKS`).
   *
   * Separate from what the adapter defines for a check to work well on its
   * application, such as patterns in `varyingInSignatures`, which apply
   * whether or not the check runs by default. A check this switches off is
   * recorded as off on each Route's opening line, and a Journey or a run can
   * still include it; one that cannot run at all belongs in `narrowedChecks`
   * instead.
   */
  checksByDefault?: Readonly<Record<string, 'on' | 'off'>>;

  /**
   * Checks of this application's own, run after the built-in ones on every
   * Hop, in this order. See `AppCheck` for where what they assert must come
   * from.
   */
  checks?: readonly AppCheck[];

  /**
   * Relations of this application's own (R20), each started by a Hop it
   * names and taking a Detour of its own after it. See `AppRelation`. Turned
   * on and off by name as checks are, and named on each Route's opening line
   * among the checks in force.
   */
  relations?: readonly AppRelation[];

  /**
   * What varies from run to run in this application's own messages, taken out
   * of a finding's signature before what the engine takes out itself: each a
   * pattern with the `g` flag and what to put in its place.
   *
   * A known finding matches by signature, so an id the application makes
   * fresh each time gives the same bug a new signature on every Route, and it
   * never matches again once filed. Which ids an application prints cannot be
   * known in advance, which is why it is the adapter's to say. The case this
   * exists for is RStudio naming a terminal by a new handle each time,
   * `Unknown handle: "3968F855"`. Written in every journal, since the patterns
   * decide which findings are known and so where a Route ends.
   */
  varyingInSignatures?: readonly (readonly [RegExp, string])[];

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

  /**
   * How long the application's main process and page each have to answer the
   * engine, in milliseconds, before it counts as not answering. Leave it out
   * for the engine's default, `DEFAULT_RESPONSIVE_TIMEOUT_MS`, 5000.
   *
   * The still-responding check's round trip uses it, and so does the reading
   * of what the stubs caught after each Hop, which gives up and says so rather
   * than wait on an application that has stopped answering. For an application
   * slow enough to answer that the default reports hangs it does not have. The
   * length used is written in every journal, since it decides where a Route
   * ends.
   */
  responsiveTimeoutMs?: number;

  /**
   * How long to watch a Route's profile folder after deleting it, in
   * milliseconds, and delete it again if something recreated it. Leave it out
   * for the engine's default of 250 ms.
   *
   * For an application whose helpers write into the profile after it has
   * closed. Measured on Positron on 2026-09-26: a Copilot helper started as
   * the application closed, and wrote its log after the profile was deleted,
   * recreating the folder. Waited on at every Route's teardown, so it costs
   * that much per Route.
   */
  profileWatchMs?: number;

  /**
   * The share of Hops drawn from the common keys, as a fraction from 0 up to
   * but not including 1. Leave it out for the engine's default, an eighth.
   *
   * For an application where the keys reach more than a screen shows, such as
   * a console's history, or less. The share is an input to the seeded draw, so
   * it is written in every journal: a replay under a different share takes a
   * different Route.
   */
  keyShare?: number;

  /**
   * The share of Hops drawn from the menu bar, on the same terms as `keyShare`.
   * Leave it out for the engine's default, an eighth.
   *
   * For an application whose menu is far larger or smaller than its screens,
   * which is why it is the adapter's to set. The two shares together must
   * leave the page something, so they sum to less than 1.
   */
  menuShare?: number;
}
