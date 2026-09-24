import type { ElectronApplication, Locator, Page } from '@playwright/test';
import type { Candidate, Exclusions } from './app-under-test';
import { hasFocusedWindow, menuEntries } from './menu';

/**
 * What a Route could act on next, found from the running application.
 *
 * **Discovery is by role, and needs nothing handed to it.** An engine that
 * required a list of every control would be more precise and would stop being
 * a framework, which is the trade the project exists to make. A map, full or
 * partial, may be given in phase 10 and is never required, so this has to keep
 * working exactly as it does with none; docs/OUTSTANDING.md has what is open
 * about it. What an adapter supplies today is the exclusion list, which says
 * what must never be touched and never says what may be.
 *
 * **The risk that discovery by role finds too little was measured and
 * retired.** docs/HISTORY.md has the two censuses. The limit is rendering
 * technique rather than how much behavior sits behind a surface: roles work on
 * ordinary DOM and fail on canvas-backed and virtualized surfaces. A Route that
 * hops into a code editor's text layer finds one text area and has nowhere
 * further to go, and that is stranded working correctly rather than a fault
 * here.
 */

/**
 * The roles a Hop can act on.
 *
 * A fixed list, and role names rather than tag names or anything belonging to
 * one application. It is deliberately short: every entry is something a person
 * can click or type into, and a role that only groups or labels other things is
 * left out because hopping to it would do nothing.
 *
 * Roles absent from here are not errors and are not reported as findings. They
 * are simply not moves.
 */
export const HOPPABLE_ROLES = [
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem',
] as const;

/** Roles a Hop types a generated value into rather than clicking. */
const TEXT_ENTRY_ROLES = new Set<string>(['searchbox', 'spinbutton', 'textbox']);

/** Whether acting on this candidate means typing into it. */
export function takesTypedValue(candidate: SurveyedCandidate): boolean {
  return candidate.source === 'page' && TEXT_ENTRY_ROLES.has(candidate.role);
}

/**
 * A page candidate, with what a Hop needs in order to act on it.
 *
 * Identified by role, accessible name and position among the controls sharing
 * both, in document order. That triple is used for two things at once and is
 * the right shape for both: it is how the Hop reaches the element, through
 * Playwright's own documented `getByRole(...).nth()`, and it is what the
 * journal records. A reader retracing a Route a week later can find
 * `button "Summary" #0`, which is the whole point of writing a journal down.
 *
 * Playwright's snapshot also offers an opaque per-element handle, and it was
 * rejected on 2026-09-22 for both halves of that. It is undocumented, absent
 * from the published types and not among the documented selector engines, while
 * Playwright is a peer dependency whose version the consumer picks; and it
 * means nothing in a journal read later, so it could not have replaced the
 * triple anyway.
 */
export interface PageCandidate {
  readonly source: 'page';
  readonly role: string;
  readonly name: string;
  /** Which of the controls sharing this role and name, in document order. */
  readonly nth: number;
  /** Whether the control is disabled. Kept, because it is still a finding. */
  readonly disabled: boolean;
  readonly locator: Locator;
}

/** A menu entry, reached by walking the menu by label. */
export interface MenuCandidate {
  readonly source: 'menu';
  readonly role: 'menuitem';
  readonly name: string;
  readonly menuPath: readonly string[];
}

/**
 * A key to press on whatever has focus.
 *
 * Two kinds. The common keys -- Enter, Escape, Tab and the arrows -- are always
 * offered, one candidate each, because they reach what no control shows: a
 * console bringing back its last line on Up is the case they are for. And a
 * shortcut printed in a control's accessible name, such as "Save current
 * document (⌘S)", is offered as the key it names, read from what the survey
 * already reads and never from source.
 *
 * Native menu accelerators are not offered. Measured on 2026-09-24, a key
 * pressed through Playwright reaches the page and never a native accelerator,
 * so pressing one would be a Hop that did nothing, journaled as one that did.
 * The menu entry itself stays reachable by clicking it.
 */
export interface KeyCandidate {
  readonly source: 'key';
  readonly role: 'key' | 'shortcut';
  readonly name: string;
  /** The key as Playwright presses it. */
  readonly key: string;
  /**
   * For a shortcut, every control whose name shows it. The shortcut is
   * excluded whenever any of them is, so a key cannot slip past a rail that
   * names the control it belongs to.
   */
  readonly controls: readonly PageCandidate[];
}

export type SurveyedCandidate = PageCandidate | MenuCandidate | KeyCandidate;

/** The shape an exclusion predicate is handed, without the locator. */
export function toCandidate(candidate: SurveyedCandidate): Candidate {
  if (candidate.source === 'menu') {
    return { source: 'menu', role: candidate.role, name: candidate.name, menuPath: candidate.menuPath };
  }
  if (candidate.source === 'key') {
    return { source: 'key', role: candidate.role, name: candidate.name, key: candidate.key };
  }
  return { source: 'page', role: candidate.role, name: candidate.name };
}

/** The common keys, offered on every Hop, one candidate each, in this order. */
export const COMMON_KEYS = [
  'Enter',
  'Escape',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
] as const;

/** macOS modifier glyphs, as applications print them, and what Playwright calls them. */
const MODIFIER_GLYPHS: Readonly<Record<string, string>> = {
  '⌃': 'Control',
  '⌥': 'Alt',
  '⇧': 'Shift',
  '⌘': 'Meta',
};

/**
 * The shortcut a control's name prints, if it prints one.
 *
 * Matches the macOS convention both IDEs use: modifier glyphs and one key in
 * parentheses, such as "(⌘S)" or "(⌥⌘S)". A name printing its shortcut any
 * other way is not read, and that shortcut waits for the optional map.
 */
export function printedShortcut(name: string): { label: string; key: string } | undefined {
  const match = /\(([⌃⌥⇧⌘]+)([^\s)])\)/.exec(name);
  if (!match) return undefined;
  const [, glyphs = '', char = ''] = match;
  const modifiers = [...glyphs].map((glyph) => MODIFIER_GLYPHS[glyph]).filter(Boolean);
  return { label: `${glyphs}${char}`, key: [...modifiers, char.toLowerCase()].join('+') };
}

/** The keys a survey offers, shortcuts first in document order, then the common keys. */
function keyCandidates(pageCandidates: readonly PageCandidate[]): KeyCandidate[] {
  const shortcuts = new Map<string, { label: string; controls: PageCandidate[] }>();
  for (const control of pageCandidates) {
    const printed = printedShortcut(control.name);
    if (!printed) continue;
    const existing = shortcuts.get(printed.key);
    if (existing) existing.controls.push(control);
    else shortcuts.set(printed.key, { label: printed.label, controls: [control] });
  }
  return [
    ...[...shortcuts].map(([key, { label, controls }]) => ({
      source: 'key' as const,
      role: 'shortcut' as const,
      name: label,
      key,
      controls,
    })),
    ...COMMON_KEYS.map((key) => ({
      source: 'key' as const,
      role: 'key' as const,
      name: key,
      key,
      controls: [],
    })),
  ];
}

/**
 * An element carrying a hoppable role and no accessible name.
 *
 * Reported rather than offered. This does double duty, which is why it is
 * collected here in phase 4 before any check exists to read it: an element with
 * no accessible name is an accessibility fault, and it is also something the
 * Route cannot reliably hop to, since there is nothing to name it by in a
 * journal or in a replay.
 */
export interface UnnamedElement {
  readonly role: string;
  /** Its text content, where it has any, as the only clue to which one it is. */
  readonly text?: string;
}

/** A candidate the exclusion list kept out of the draw, and which rule did it. */
export interface ExcludedCandidate {
  readonly candidate: Candidate;
  readonly rule: string;
}

/**
 * Whether menu entries were offered, and why not when they were not.
 *
 * A verdict rather than an absence, in the shape UNAVAILABLE_UNDER already uses
 * for a launch path that cannot collect some evidence. A source that quietly
 * offered nothing would be indistinguishable from an application with no menu,
 * and the Route's journal would read the same either way.
 */
export type MenuSourceVerdict =
  | { readonly offered: true; readonly count: number }
  | { readonly offered: false; readonly reason: string };

export interface SurveyResult {
  /** What may be hopped to, after exclusions. The draw is over exactly this. */
  readonly candidates: readonly SurveyedCandidate[];
  readonly excluded: readonly ExcludedCandidate[];
  readonly unnamed: readonly UnnamedElement[];
  readonly menuSource: MenuSourceVerdict;
  /**
   * The accessibility tree this survey read, which is the "before" half of the
   * Hop's effect (R31). Handed back rather than read again, so the effect costs
   * nothing extra.
   */
  readonly tree: unknown;
}

/**
 * How often each exclusion entry matched, for one Route.
 *
 * An exclusion list is pure input otherwise, so the engine has nowhere to say
 * that an entry matched nothing all Route. An entry that never matched is
 * almost certainly stale: the control it named was renamed or removed, and the
 * rail it was meant to be has quietly stopped existing. The cost is one counter
 * per entry.
 */
export interface ExclusionTally {
  readonly names: Map<string, number>;
  readonly menuPaths: Map<string, number>;
  predicate: number;
}

export function createExclusionTally(exclusions: Exclusions): ExclusionTally {
  return {
    names: new Map((exclusions.names ?? []).map((name) => [name, 0])),
    menuPaths: new Map((exclusions.menuPaths ?? []).map((path) => [path.join(' > '), 0])),
    predicate: 0,
  };
}

/** The exclusion entries that matched nothing, named as the list wrote them. */
export function neverMatched(tally: ExclusionTally): string[] {
  const stale: string[] = [];
  for (const [name, count] of tally.names) if (count === 0) stale.push(`names: ${name}`);
  for (const [path, count] of tally.menuPaths) if (count === 0) stale.push(`menuPaths: ${path}`);
  return stale;
}

/**
 * Thrown when the exclusion predicate answers differently about one candidate
 * within a single survey.
 *
 * The interface requires the predicate to be deterministic and nothing checked
 * it, and the failure is silent by construction: the exclusion list is an input
 * to the seeded draw, so a predicate that answered differently on a replay
 * sends every hop after it somewhere else while every Route still reports a
 * seed. This cannot be a compile-time guarantee, so it gets a positive control
 * instead.
 */
export class NondeterministicExclusion extends Error {
  constructor(readonly candidate: Candidate) {
    super(
      `The exclusion predicate gave two different answers about ${candidate.role} ` +
        `"${candidate.name}" within one survey. It is an input to the seeded draw, so a ` +
        `predicate that answers differently on a replay sends every later hop somewhere ` +
        `else while the run still reports a seed that retraces nothing.`
    );
    this.name = 'NondeterministicExclusion';
  }
}

export interface SurveyOptions {
  readonly page: Page;
  readonly app: ElectronApplication;
  readonly exclusions: Exclusions;
  /**
   * The Hop this survey is for, counting from zero.
   *
   * Used only to rotate which candidate the predicate determinism control is
   * run against, so that a Route of twenty Hops checks twenty different
   * candidates rather than the same one twenty times.
   */
  readonly hopIndex: number;
  readonly tally: ExclusionTally;
  /**
   * How long the accessibility snapshot may take.
   *
   * Bounded rather than left at Playwright's default, and this is not
   * housekeeping. Every locator call waits for any pending navigation to
   * finish, and a navigation that an application prevents in `will-navigate`
   * never finishes: measured against the testbed on 2026-09-22, a snapshot was
   * still blocked 8.8 seconds after such a click, with no sign of clearing.
   * Unbounded, one hop onto an outbound link costs the rest of the Route one
   * full default timeout at a time.
   */
  readonly timeoutMs?: number;
}

/**
 * What a Route may act on right now.
 *
 * The exclusion list is applied BEFORE the result is returned, so the draw a
 * caller makes is over what may actually be hopped to. Filtering afterwards
 * would mean a drawn candidate could be rejected and a second draw taken, which
 * changes the stream position and breaks the replay R8 asks for.
 */
export async function survey(options: SurveyOptions): Promise<SurveyResult> {
  const { page, app, exclusions, hopIndex, tally, timeoutMs } = options;

  const { candidates: pageCandidates, unnamed, tree } = await surveyPage(page, timeoutMs);
  const { menuCandidates, menuSource } = await surveyMenu(app);

  const found: SurveyedCandidate[] = [
    ...pageCandidates,
    ...menuCandidates,
    ...keyCandidates(pageCandidates),
  ];

  // One candidate per survey gets the predicate run twice, rotating by hop so
  // that a Route covers a different one each time. Every candidate would be a
  // truer control and would double the cost of user code that may touch the
  // page, on every hop, against a Trip of tens.
  const control = found.length ? found[hopIndex % found.length] : undefined;

  const candidates: SurveyedCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];
  const excludedControls = new Map<PageCandidate, string>();
  let focusOnExcluded: string | undefined;

  for (const candidate of found) {
    let rule: string | undefined;

    if (candidate.source === 'key') {
      // Page and menu candidates come first in `found`, so every control's
      // verdict is known by the time its shortcut is reached.
      const blocked = candidate.controls.find((c) => excludedControls.has(c));
      if (blocked) rule = `control: ${blocked.name} (${excludedControls.get(blocked)})`;

      // A common key acts on whatever has focus. Enter on a focused outbound
      // link follows it, so a Tab that moved focus onto an excluded control
      // would otherwise hand the next Enter a way past the rail.
      if (!rule && candidate.role === 'key') {
        focusOnExcluded ??= await focusedExcluded(excludedControls, timeoutMs);
        if (focusOnExcluded) rule = `focus: ${focusOnExcluded}`;
      }
    }

    rule ??= await excludedBy(candidate, { exclusions, page, tally, control });
    if (rule) {
      excluded.push({ candidate: toCandidate(candidate), rule });
      if (candidate.source === 'page') excludedControls.set(candidate, rule);
    } else candidates.push(candidate);
  }

  return {
    candidates,
    excluded,
    unnamed,
    // Counted after exclusions rather than before, because the number that
    // matters is how many menu entries the draw could actually reach. Reporting
    // the number found would say the menu source offered eleven entries in a
    // Journey where the exclusion list kept every one of them out.
    menuSource: menuSource.offered
      ? { offered: true, count: candidates.filter((c) => c.source === 'menu').length }
      : menuSource,
    tree,
  };
}

/**
 * The name of the excluded control that has focus, if one does.
 *
 * An empty string, not undefined, when none does, so a survey asks the page
 * once however many keys it reaches.
 */
async function focusedExcluded(
  excludedControls: ReadonlyMap<PageCandidate, string>,
  timeoutMs: number | undefined
): Promise<string> {
  for (const control of excludedControls.keys()) {
    const focused = await control.locator
      .evaluate(
        (element) => element.contains(document.activeElement),
        undefined,
        timeoutMs === undefined ? {} : { timeout: timeoutMs }
      )
      .catch(() => false);
    if (focused) return control.name;
  }
  return '';
}

/** Which exclusion rule keeps this candidate out of the draw, if any. */
async function excludedBy(
  candidate: SurveyedCandidate,
  context: {
    exclusions: Exclusions;
    page: Page;
    tally: ExclusionTally;
    control: SurveyedCandidate | undefined;
  }
): Promise<string | undefined> {
  const { exclusions, page, tally, control } = context;

  // Defaults to true, matching how a list of names reads. An application with a
  // page control and a menu entry sharing a label, where only one should be
  // excluded, sets it false and uses menuPaths for the other.
  const namesCoverMenus = exclusions.namesCoverMenuEntries ?? true;
  const nameApplies = candidate.source !== 'menu' || namesCoverMenus;

  if (nameApplies && tally.names.has(candidate.name)) {
    tally.names.set(candidate.name, (tally.names.get(candidate.name) ?? 0) + 1);
    return `names: ${candidate.name}`;
  }

  if (candidate.source === 'menu') {
    const key = candidate.menuPath.join(' > ');
    if (tally.menuPaths.has(key)) {
      tally.menuPaths.set(key, (tally.menuPaths.get(key) ?? 0) + 1);
      return `menuPaths: ${key}`;
    }
  }

  if (!exclusions.exclude) return undefined;

  const plain = toCandidate(candidate);
  const verdict = await exclusions.exclude(plain, page);

  if (candidate === control) {
    const again = await exclusions.exclude(plain, page);
    if (again !== verdict) throw new NondeterministicExclusion(plain);
  }

  if (!verdict) return undefined;
  tally.predicate += 1;
  return 'exclude()';
}

/**
 * A node in Playwright's accessibility snapshot.
 *
 * Declared here rather than imported: ariaSnapshotJSON is typed as a free-form
 * object, so this states what is actually read out of it. Every field is
 * optional because a node carrying none of them is a plain text fragment.
 */
interface AriaNode {
  role?: string;
  name?: string;
  text?: string;
  disabled?: boolean;
  children?: (AriaNode | string)[];
}

/**
 * Candidates from the page, in document order.
 *
 * The snapshot is Playwright's own accessibility tree: it computes the role and
 * the accessible name the way a screen reader would, and it leaves out anything
 * not visible. That last part is not a convenience. A dismissed widget can stay
 * in the DOM and still take input, and in one real application a keypress aimed
 * at a closed picker landed in a console and was executed as code. For a Route
 * choosing its own moves that is an arbitrary command run against the
 * application under test, and filtering on visibility is what prevents it.
 *
 * **What this cannot see is a windowed list.** A virtualized container renders
 * only the rows currently on screen, so a survey enumerates twelve of forty and
 * reports no error whatever. The Route then believes it explored a list it
 * barely touched, and the journal faithfully records the twelve. There is no
 * general way to ask a container whether it is windowed; docs/PLAN.md carries
 * it as a hazard and the testbed sibling built for it is in
 * docs/OUTSTANDING.md.
 */
async function surveyPage(
  page: Page,
  timeoutMs: number | undefined
): Promise<{ candidates: PageCandidate[]; unnamed: UnnamedElement[]; tree: unknown }> {
  const snapshot = (await page
    .locator('body')
    .ariaSnapshotJSON(timeoutMs === undefined ? {} : { timeout: timeoutMs })) as
    | AriaNode
    | AriaNode[];

  const candidates: PageCandidate[] = [];
  const unnamed: UnnamedElement[] = [];
  const hoppable = new Set<string>(HOPPABLE_ROLES);

  // Counted per role and name, so that two controls sharing both are told apart
  // by their position in document order, which is what getByRole().nth() takes.
  const seen = new Map<string, number>();

  const walk = (node: AriaNode | string): void => {
    if (typeof node === 'string') return;

    if (node.role && hoppable.has(node.role)) {
      if (node.name) {
        const key = `${node.role}\u0000${node.name}`;
        const nth = seen.get(key) ?? 0;
        seen.set(key, nth + 1);
        candidates.push({
          source: 'page',
          role: node.role,
          name: node.name,
          nth,
          disabled: node.disabled === true,
          locator: page.getByRole(node.role as Parameters<Page['getByRole']>[0], {
            name: node.name,
            exact: true,
          }).nth(nth),
        });
      } else {
        unnamed.push(node.text ? { role: node.role, text: node.text } : { role: node.role });
      }
    }

    for (const child of node.children ?? []) walk(child);
  };

  for (const node of Array.isArray(snapshot) ? snapshot : [snapshot]) walk(node);

  // Disabled controls are found and then dropped from the draw. Hopping to one
  // does nothing, which would be journaled as a Hop that happened; the check
  // that cares about them is the accessibility one, not the Route.
  return {
    candidates: candidates.filter((candidate) => !candidate.disabled),
    unnamed,
    tree: snapshot,
  };
}

/** Candidates from the native menu, or the reason there are none. */
async function surveyMenu(
  app: ElectronApplication
): Promise<{ menuCandidates: MenuCandidate[]; menuSource: MenuSourceVerdict }> {
  // Asked before the menu is read, not after. See hasFocusedWindow: with no
  // focused window an ordinary menu handler does nothing at all, while the
  // click reports success, and the engine causes that condition itself by
  // keeping windows off the screen.
  if (!(await hasFocusedWindow(app))) {
    return {
      menuCandidates: [],
      menuSource: {
        offered: false,
        reason:
          'No application window holds focus, so a menu click would reach a handler with no ' +
          'window and do nothing, while reporting success. Menu candidates are withheld ' +
          'rather than journaled as hops that did nothing. Run with PHILEAS_SHOW=1 to put ' +
          'the windows back on the screen and get the menu source back.',
      },
    };
  }

  const entries = await menuEntries(app);
  const menuCandidates: MenuCandidate[] = entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      source: 'menu',
      role: 'menuitem',
      name: entry.label,
      menuPath: entry.path,
    }));

  return { menuCandidates, menuSource: { offered: true, count: menuCandidates.length } };
}
