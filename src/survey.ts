import type { ElectronApplication, Locator, Page } from '@playwright/test';
import type { Candidate, Exclusions } from './app-under-test.js';
import { menuEntries } from './menu.js';

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
 * `button "Summary" #1`, which is the whole point of writing a journal down.
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
  /** Which of the controls sharing this role and name, in document order, counting from 1. */
  readonly nth: number;
  /**
   * Whether the control is disabled. Read so it can be dropped from the draw:
   * hopping to a disabled control does nothing but would be journaled as a
   * Hop. Not reported anywhere yet.
   */
  readonly disabled: boolean;
  /** Where it was drawn when surveyed, for the test for a covered control. */
  readonly box?: Box;
  /**
   * The nearest candidate it sits inside in the tree, such as the dropdown an
   * option belongs to. A control with no box of its own, as an option in a
   * closed native dropdown has none, is covered when this one is.
   */
  readonly within?: PageCandidate;
  readonly locator: Locator;
}

/** A menu entry, reached by walking the menu by label. */
export interface MenuCandidate {
  readonly source: 'menu';
  readonly role: 'menuitem';
  readonly name: string;
  readonly menuPath: readonly string[];
  /** The Electron role it was built from, for a standard entry. See `MenuEntry.electronRole`. */
  readonly electronRole?: string;
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
 * Key glyphs printed in place of a character, and what Playwright calls them.
 * Only the arrows, which Positron prints, as "↓" on 2026-09-27.
 */
const KEY_GLYPHS: Readonly<Record<string, string>> = {
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '←': 'ArrowLeft',
  '→': 'ArrowRight',
};

/**
 * The shortcut a control's name prints, if it prints one.
 *
 * Matches the macOS convention both IDEs use: modifier glyphs and one key in
 * parentheses, such as "(⌘S)" or "(⌥⌘S)". A name printing its shortcut any
 * other way is not read, and that shortcut waits for the optional map.
 *
 * **A key Playwright cannot press is not offered.** The key is a printable
 * ASCII character or a glyph in `KEY_GLYPHS`; anything else is left out rather
 * than handed on. Handed on, "↓" ended a Route on Positron with Playwright's
 * "Unknown key", which reads as the engine breaking rather than as a finding.
 */
export function printedShortcut(name: string): { label: string; key: string } | undefined {
  const match = /\(([⌃⌥⇧⌘]+)([^\s)])\)/u.exec(name);
  if (!match) return undefined;
  const [, glyphs = '', char = ''] = match;
  const key = KEY_GLYPHS[char] ?? (/^[\x21-\x7e]$/.test(char) ? char.toLowerCase() : undefined);
  if (key === undefined) return undefined;
  const modifiers = [...glyphs].map((glyph) => MODIFIER_GLYPHS[glyph]).filter(Boolean);
  return { label: `${glyphs}${char}`, key: [...modifiers, key].join('+') };
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
 * A page control left out of the draw because something else is drawn over
 * it, and what that is.
 *
 * Recorded rather than dropped quietly: a control that stays covered, under a
 * menu that will not close, is itself worth seeing, and before this the only
 * sign of one was a Hop abandoned on its click.
 */
export interface CoveredCandidate {
  readonly candidate: PageCandidate;
  /** What is on top at its click point, described as Playwright describes an element. */
  readonly by: string;
}

/**
 * A page control left out of the draw because the application has hidden it
 * inside a container with no area, and what that container is (R32).
 *
 * Recorded for the reason a covered one is. Measured on RStudio on
 * 2026-10-01: zooming one pane leaves the others zero pixels wide, and every
 * control in them was offered as though scrolled out of sight.
 */
export interface HiddenCandidate {
  readonly candidate: PageCandidate;
  /** The container that clips it and has no area, described as a covering element is. */
  readonly by: string;
}

/**
 * A text box kept in the draw although something lies on top of it, because
 * that something sits inside the text box's own parent, and what it is.
 *
 * Recorded because keeping it rests on how the page is built rather than on
 * what a click would reach: measured on RStudio on 2026-10-02, whose code
 * editor keeps its real text box under its own content layer, and a wrong
 * reading would otherwise pass without a sign.
 */
export interface LayeredCandidate {
  readonly candidate: PageCandidate;
  /** What lies on top at its click point, described as a covering element is. */
  readonly by: string;
}

/**
 * Whether menu entries were offered, and why not when they were not.
 *
 * A verdict rather than an absence, in the shape UNAVAILABLE_UNDER already uses
 * for a launch path that cannot collect some evidence. A source that quietly
 * offered nothing would be indistinguishable from an application with no menu,
 * and the Route's journal would read the same either way.
 *
 * The electron launch path always offers the menu. The debugging-port path,
 * once it exists, reaches no main process and so no menu, and that is the case
 * the second arm is kept for.
 */
export type MenuSourceVerdict =
  | { readonly offered: true; readonly count: number }
  | { readonly offered: false; readonly reason: string };

export interface SurveyResult {
  /** What may be hopped to, after exclusions. The draw is over exactly this. */
  readonly candidates: readonly SurveyedCandidate[];
  readonly excluded: readonly ExcludedCandidate[];
  /** Page controls left out because something covers them; see `outOfReachAmong`. */
  readonly covered: readonly CoveredCandidate[];
  /** Page controls left out because the application has hidden them; see `outOfReachAmong`. */
  readonly hidden: readonly HiddenCandidate[];
  /** Text boxes kept under a layer of their own widget; see `outOfReachAmong`. They are among `candidates`. */
  readonly layered: readonly LayeredCandidate[];
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
  /**
   * How often each standard role the adapter allowed back was on offer. A role
   * allowed back that never appears is as stale as an exclusion that never
   * matches, and is most likely misspelled.
   */
  readonly allowedStandardRoles: Map<string, number>;
  predicate: number;
}

export function createExclusionTally(exclusions: Exclusions): ExclusionTally {
  return {
    names: new Map((exclusions.names ?? []).map((name) => [name, 0])),
    menuPaths: new Map((exclusions.menuPaths ?? []).map((path) => [path.join(' > '), 0])),
    allowedStandardRoles: new Map(
      (exclusions.allowStandardMenuRoles ?? []).map((role) => [role.toLowerCase(), 0])
    ),
    predicate: 0,
  };
}

/** The exclusion entries that matched nothing, named as the list wrote them. */
export function neverMatched(tally: ExclusionTally): string[] {
  const stale: string[] = [];
  for (const [name, count] of tally.names) if (count === 0) stale.push(`names: ${name}`);
  for (const [path, count] of tally.menuPaths) if (count === 0) stale.push(`menuPaths: ${path}`);
  for (const [role, count] of tally.allowedStandardRoles) {
    if (count === 0) stale.push(`allowStandardMenuRoles: ${role}`);
  }
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
   * never finishes: measured against the proving ground on 2026-09-22, a snapshot was
   * still blocked 8.8 seconds after such a click, with no sign of clearing.
   * Unbounded, one hop onto an outbound link costs the rest of the Route one
   * full default timeout at a time.
   */
  readonly timeoutMs?: number;
}

/**
 * The application did not answer one of the survey's own reads in time.
 *
 * Its own class so a Route can say so plainly, rather than blaming a
 * navigation or the exclusion list for what is a hung application.
 */
export class ApplicationStoppedAnswering extends Error {
  constructor(readonly what: string, readonly timeoutMs: number) {
    super(`${what} did not answer within ${timeoutMs} ms: the application stopped answering`);
    this.name = 'ApplicationStoppedAnswering';
  }
}

/**
 * A read that gives up after `timeoutMs`, for the calls that take no timeout
 * of their own. The main process serves the debugging connection every call
 * goes through, so a main process blocked by a native dialog, measured on
 * Positron, holds such a call forever. Unbounded when no timeout is given.
 */
export async function answered<T>(what: string, call: Promise<T>, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined) return call;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ApplicationStoppedAnswering(what, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
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
  const { menuCandidates, menuSource } = await surveyMenu(app, timeoutMs);

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
  let focusOnDropdown: string | undefined;

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

      // On a focused native dropdown, these open its list, which the operating
      // system draws outside the window and so on the real screen, whatever the
      // window mode: measured on macOS on 2026-09-28, where they opened it and
      // never changed the choice. The dropdown stays reachable by `select`.
      if (!rule && candidate.role === 'key' && OPEN_A_DROPDOWN.has(candidate.key)) {
        focusOnDropdown ??= await focusedDropdown(page, timeoutMs);
        if (focusOnDropdown) rule = `focus: native dropdown ${focusOnDropdown}`;
      }
    }

    rule ??= await excludedBy(candidate, { exclusions, page, tally, control });
    if (rule) {
      excluded.push({ candidate: toCandidate(candidate), rule });
      if (candidate.source === 'page') excludedControls.set(candidate, rule);
    } else candidates.push(candidate);
  }

  // After the exclusions, so a control both excluded and covered is reported
  // by the rail that names it, and only what would otherwise be drawn is
  // tested. Before the draw, for the reason this function's comment gives.
  // Shortcuts were built from every control, covered or not: a key press
  // needs no clear spot to land on.
  const { covered, hidden, layered } = await outOfReachAmong(
    page,
    candidates.filter((c): c is PageCandidate => c.source === 'page'),
    timeoutMs
  );
  if (covered.length || hidden.length) {
    const out = new Set<SurveyedCandidate>([...covered, ...hidden].map((entry) => entry.candidate));
    candidates.splice(0, candidates.length, ...candidates.filter((c) => !out.has(c)));
  }

  return {
    candidates,
    excluded,
    covered,
    hidden,
    layered,
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
 * The controls something else is drawn over, at the point a click would land,
 * and those the application has hidden inside a container with no area.
 *
 * **Why.** The accessibility tree lists a control under another window or an
 * open menu as readily as one in plain view. A Hop drawn to one was refused by
 * Playwright, which found something else would take the click, and abandoned
 * after the click timeout. Measured on 2026-09-30: all 16 abandoned Hops in
 * five of Bobolink Editor's Routes were this, 12 under another of its
 * overlapping document windows and 4 under an open menu, and RStudio's batch
 * abandoned 270 of 3,192 Trip Hops, some under a popup menu.
 *
 * **What counts as covered** is what Playwright's click checks: the element on
 * top at the center of the control's box, inside the viewport, is neither the
 * control nor inside it, nor inside a label for it. Typed fields are tested
 * too, though typing needs no click: a field no pointer can reach should not
 * be typed into, or a finding could come from somewhere no person gets to.
 * Decided on 2026-09-30, docs/OUTSTANDING.md. **Except** a text box whose
 * cover sits inside the text box's own parent, a layer of its own widget,
 * as RStudio's code editor lays its content over its real text box: a click
 * there reaches it, so it is kept, and recorded as layered. Decided on
 * 2026-10-02 over not testing text boxes at all, and over each adapter naming
 * such layers.
 *
 * **What counts as hidden** is a control inside a container that clips what
 * it holds and has no area: nothing inside it can show, however anything
 * scrolls, so no person can see the control (R32). Measured on RStudio on
 * 2026-10-01: View > Panes > Zoom Plots leaves the Source and Console panes
 * zero pixels wide inside containers that clip, and 21 of their controls
 * were offered, as scrolled out of sight, until this. Not counted: a control
 * placed outside such a container by `position: fixed`, which escapes the
 * clip; unmeasured on any application, and it errs toward hiding.
 *
 * **What is kept untested:** a control with no box, unless it sits inside a
 * covered or hidden one, one wholly out of view or out of sight inside a
 * container that scrolls, since the click scrolls it in first, and one the
 * test cannot answer for. Each errs toward offering the control, which at
 * worst costs a timeout and a journaled reason, never a silently missing
 * control.
 *
 * Two passes. One call tests every control by its box, which cannot know the
 * element, so it asks whether an element around the one on top has the
 * control's box. Only those it finds covered, and those wholly outside the
 * window, are then tested again against the element itself, one call each;
 * that pass decides. So the common case, everything in the window and
 * nothing covered, costs one call per survey.
 */
async function outOfReachAmong(
  page: Page,
  controls: readonly PageCandidate[],
  timeoutMs: number | undefined
): Promise<{ covered: CoveredCandidate[]; hidden: HiddenCandidate[]; layered: LayeredCandidate[] }> {
  const tested = controls.filter((control) => control.box !== undefined);
  if (!tested.length) return { covered: [], hidden: [], layered: [] };

  const suspects = await answered(
    'the page, asked what is on top of each control,',
    page.evaluate((boxes) => {
      const describe = (element: Element): string => {
        const attributes = ['role', 'aria-label', 'id', 'class']
          .map((name) => [name, element.getAttribute(name)] as const)
          .filter(([, value]) => value)
          .map(([name, value]) => ` ${name}="${String(value).slice(0, 60)}"`)
          .join('');
        const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `<${element.tagName.toLowerCase()}${attributes}>${text}`;
      };
      return boxes.map((box) => {
        if (box.width < 1 || box.height < 1) return null;
        const x0 = Math.max(0, box.x);
        const y0 = Math.max(0, box.y);
        const x1 = Math.min(window.innerWidth, box.x + box.width);
        const y1 = Math.min(window.innerHeight, box.y + box.height);
        // Wholly outside the window: scrolled away, or hidden somewhere with
        // no area, which only the element itself can say.
        if (x1 - x0 < 1 || y1 - y0 < 1) return 'outside the window';
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;
        let top = document.elementFromPoint(x, y);
        while (top?.shadowRoot) {
          const inner = top.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === top) break;
          top = inner;
        }
        if (!top) return null;
        for (let node: Element | null = top; node; ) {
          const rect = node.getBoundingClientRect();
          if (
            Math.abs(rect.x - box.x) < 1 &&
            Math.abs(rect.y - box.y) < 1 &&
            Math.abs(rect.width - box.width) < 1 &&
            Math.abs(rect.height - box.height) < 1
          ) {
            return null;
          }
          const root = node.getRootNode();
          node = node.assignedSlot ?? node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
        }
        return describe(top);
      });
    }, tested.map((control) => control.box as Box)),
    timeoutMs
  );

  const covered: CoveredCandidate[] = [];
  const hidden: HiddenCandidate[] = [];
  const layered: LayeredCandidate[] = [];
  for (const [index, suspect] of suspects.entries()) {
    const control = tested[index];
    if (!suspect || !control) continue;
    // Tested against the element itself, and at the center of the part of it
    // that shows: inside the window and inside every container that clips
    // it. A container that clips and has no area hides it, R32. Otherwise
    // none showing means it is scrolled out of sight inside one of them,
    // not covered, since the click scrolls it into view first; measured on
    // Bobolink Editor on 2026-09-30, where a link in a preview pane read as
    // covered by whatever was drawn where it would have been. A control this
    // cannot reach, or a page that does not answer in time, stays in the draw.
    const verdict = await control.locator
      .evaluate(
        (element, typed): { hidden: string } | { layered: string } | { covered: string } | null => {
          const up = (node: Element): Element | null => {
            const root = node.getRootNode();
            return node.assignedSlot ?? node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
          };
          const describe = (node: Element): string => {
            const attributes = ['role', 'aria-label', 'id', 'class']
              .map((name) => [name, node.getAttribute(name)] as const)
              .filter(([, value]) => value)
              .map(([name, value]) => ` ${name}="${String(value).slice(0, 60)}"`)
              .join('');
            const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
            return `<${node.tagName.toLowerCase()}${attributes}>${text}`;
          };
          const own = element.getBoundingClientRect();
          let [x0, y0, x1, y1] = [
            Math.max(0, own.left),
            Math.max(0, own.top),
            Math.min(window.innerWidth, own.right),
            Math.min(window.innerHeight, own.bottom),
          ];
          // The root's overflow, and the body's when the root's is visible and
          // it passes up, applies to the window, which is already the starting
          // box, rather than to the element's own box. RStudio's html is 1200
          // by 0 with overflow hidden: read as a container, it trimmed every
          // control there to nothing, so none could be found covered, and it
          // hid four working Console controls on the first try at R32.
          // Measured on 2026-10-02.
          const rootStyle = getComputedStyle(document.documentElement);
          const bodyPassesUp = rootStyle.overflowX === 'visible' && rootStyle.overflowY === 'visible';
          for (let node = up(element); node; node = up(node)) {
            if (node === document.documentElement || (node === document.body && bodyPassesUp)) continue;
            const style = getComputedStyle(node);
            if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
            const clip = node.getBoundingClientRect();
            if (clip.width < 1 || clip.height < 1) return { hidden: describe(node) };
            [x0, y0, x1, y1] = [Math.max(x0, clip.left), Math.max(y0, clip.top), Math.min(x1, clip.right), Math.min(y1, clip.bottom)];
          }
          if (x1 - x0 < 1 || y1 - y0 < 1) return null;
          const [x, y] = [(x0 + x1) / 2, (y0 + y1) / 2];

          let top = document.elementFromPoint(x, y);
          while (top?.shadowRoot) {
            const inner = top.shadowRoot.elementFromPoint(x, y);
            if (!inner || inner === top) break;
            top = inner;
          }
          if (!top) return null;
          for (let node: Element | null = top; node; node = up(node)) {
            if (node === element) return null;
            if (node instanceof HTMLLabelElement && node.control === element) return null;
          }
          // A text box under a layer of its own widget: what is on top sits
          // inside the text box's parent. Measured on RStudio on 2026-10-02:
          // its code editor, Ace, keeps the real text box under its content
          // layer, and a click there focuses it, as a person typing does.
          // Kept, and recorded, since it rests on how the page is built.
          const parent = up(element);
          if (typed && parent && parent.contains(top)) return { layered: describe(top) };
          return { covered: describe(top) };
        },
        takesTypedValue(control),
        timeoutMs === undefined ? {} : { timeout: timeoutMs }
      )
      .catch(() => null);
    if (verdict && 'hidden' in verdict) hidden.push({ candidate: control, by: verdict.hidden });
    else if (verdict && 'layered' in verdict) layered.push({ candidate: control, by: verdict.layered });
    else if (verdict) covered.push({ candidate: control, by: verdict.covered });
  }

  // A control with no box cannot be tested itself, and is kept, except inside
  // one that is covered or hidden: an option in a closed native dropdown has
  // no box, and choosing it needs no click, so it would otherwise reach a
  // dropdown no pointer can. Measured on buggy's Category dropdown on
  // 2026-09-30.
  const coveredBy = new Map<PageCandidate, string>(covered.map((entry) => [entry.candidate, entry.by]));
  const hiddenBy = new Map<PageCandidate, string>(hidden.map((entry) => [entry.candidate, entry.by]));
  for (const control of controls) {
    if (control.box !== undefined && hasArea(control.box)) continue;
    for (let outer = control.within; outer; outer = outer.within) {
      const under = coveredBy.get(outer);
      if (under !== undefined) {
        covered.push({ candidate: control, by: under });
        break;
      }
      const inside = hiddenBy.get(outer);
      if (inside !== undefined) {
        hidden.push({ candidate: control, by: inside });
        break;
      }
    }
  }
  return { covered, hidden, layered };
}

/** Whether a box has any area at all, before it is placed against the viewport. */
function hasArea(box: Box): boolean {
  return box.width >= 1 && box.height >= 1;
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
      // **Fails closed.** A focus that could not be read might be on the
      // excluded control, and reading "not focused" would leave Enter in the
      // draw on a focused outbound link: the way past the rail this closes.
      .catch((error: unknown) => `unknown (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`);
    if (typeof focused === 'string') return `${control.name}, ${focused}`;
    if (focused) return control.name;
  }
  return '';
}

/** The common keys that open a focused native dropdown's list. */
const OPEN_A_DROPDOWN: ReadonlySet<string> = new Set(['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Which native dropdown has focus, named by its label, if one does: a
 * `<select>` showing one choice at a time, whose list the operating system
 * draws. A `<select multiple>`, or one with a `size`, is a list drawn in the
 * page, and the arrows move through it there.
 *
 * An empty string when none does, so a survey asks the page once however many
 * keys it reaches.
 */
async function focusedDropdown(page: Page, timeoutMs: number | undefined): Promise<string> {
  return (
    page
      .locator('body')
      .evaluate(
        () => {
          const element = document.activeElement;
          if (!(element instanceof HTMLSelectElement) || element.multiple || element.size > 1) return '';
          const label = element.labels?.[0]?.textContent?.trim() || element.getAttribute('aria-label') || element.id;
          return label ? `"${label}"` : 'with no label';
        },
        undefined,
        timeoutMs === undefined ? {} : { timeout: timeoutMs }
      )
      // **Fails closed,** as for an excluded control: a focus that could not be
      // read might be on a dropdown, and the list would then open on the screen.
      .catch((error: unknown) => `unknown (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`)
  );
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

    // After the adapter's own rules, so that an entry it names is counted
    // against the rule that names it. A standard entry is skipped unless the
    // adapter allowed its role back; see Exclusions.allowStandardMenuRoles.
    const role = candidate.electronRole;
    if (role !== undefined) {
      if (!tally.allowedStandardRoles.has(role)) return `standard menu entry: ${role}`;
      tally.allowedStandardRoles.set(role, (tally.allowedStandardRoles.get(role) ?? 0) + 1);
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
  /** Where the element is drawn, asked for with `boxes`. */
  box?: Box;
  children?: (AriaNode | string)[];
}

/** An element's bounding box, in the page's own pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The tree without the boxes, for the Hop's effect and an adapter's checks.
 *
 * A Hop's effect compares two trees as text (src/effect.ts), and a box moves
 * whenever anything scrolls or resizes, so leaving them in would report every
 * Hop as a change. The checks were handed a tree without them before boxes
 * were read, and still are.
 */
function withoutBoxes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutBoxes);
  if (node === null || typeof node !== 'object') return node;
  const { box: _box, children, ...rest } = node as AriaNode;
  return children === undefined ? rest : { ...rest, children: children.map(withoutBoxes) };
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
 * it as a hazard and the proving-ground sibling built for it is in
 * docs/OUTSTANDING.md.
 */
async function surveyPage(
  page: Page,
  timeoutMs: number | undefined
): Promise<{ candidates: PageCandidate[]; unnamed: UnnamedElement[]; tree: unknown }> {
  const bounded = timeoutMs === undefined ? {} : { timeout: timeoutMs };

  // **While a modal dialog is open, only the dialog is surveyed.** Measured on
  // 2026-09-24 with the demo's ticket dialog, opened with showModal(): the
  // browser reported it modal, and the accessibility snapshot of the body still
  // held the eight controls behind it beside the dialog's own nine. None could
  // be clicked -- each timed out and was journaled as abandoned -- so about
  // half of every Hop was wasted while a dialog was open, and a dialog with no
  // way out could never strand. The candidates' locators are scoped to the
  // dialog too, so a "Cancel" behind it is never mistaken for the dialog's own.
  //
  // **A dialog marked aria-modal counts too,** since 2026-09-30: the page
  // telling a screen reader that nothing behind the dialog is reachable.
  // Measured on Bobolink Editor, whose dialogs are a role="dialog" with
  // aria-modal over a backdrop that catches clicks: 149 of 400 Hops were
  // abandoned, most of them behind one. Only a visible one counts, so a
  // dialog kept in the page hidden takes nothing out of the draw, and the
  // last in document order is taken as the one on top, as the newest.
  // A native modal wins over one, since the browser always draws it above.
  //
  // Trusting the attribute has a cost. An application that marks a dialog
  // modal and leaves the page behind it reachable has a bug a Route will now
  // never walk into. A dialog blocked only by an overlay, with no aria-modal,
  // is still surveyed with the whole page; docs/OUTSTANDING.md has both.
  const native = page.locator('dialog:modal');
  const marked = page
    .locator(':is([role="dialog"], [role="alertdialog"], dialog)[aria-modal="true"]')
    .filter({ visible: true });
  // Bounded by hand: a count takes no timeout of its own.
  const [nativeOpen, markedOpen] = await answered(
    'the page, asked for an open dialog,',
    Promise.all([native.count(), marked.count()]),
    timeoutMs
  );
  const modalOpen = nativeOpen > 0 || markedOpen > 0;
  const root = nativeOpen > 0 ? native.last() : markedOpen > 0 ? marked.last() : page.locator('body');
  // With each element's box, which is where the test for a covered control
  // looks; see `outOfReachAmong`. Read in the same call, so it costs nothing extra.
  const snapshot = (await root.ariaSnapshotJSON({ ...bounded, boxes: true })) as AriaNode | AriaNode[];

  // The whole page is still what a Hop's effect is read from (R31), since the
  // settle wait that reads "after" reads the whole page too. So with a modal
  // open, the page is read once more.
  const tree =
    modalOpen ? await page.locator('body').ariaSnapshotJSON(bounded) : withoutBoxes(snapshot);

  const candidates: PageCandidate[] = [];
  const unnamed: UnnamedElement[] = [];
  const hoppable = new Set<string>(HOPPABLE_ROLES);

  // Counted per role and name, so that two controls sharing both are told apart
  // by their position in document order. Counted from 1, as a person counts
  // them; getByRole().nth() counts from 0, and the conversion happens there
  // and nowhere else.
  const seen = new Map<string, number>();

  const walk = (node: AriaNode | string, within: PageCandidate | undefined): void => {
    if (typeof node === 'string') return;

    let self: PageCandidate | undefined;
    if (node.role && hoppable.has(node.role)) {
      if (node.name) {
        const key = `${node.role}\u0000${node.name}`;
        const nth = (seen.get(key) ?? 0) + 1;
        seen.set(key, nth);
        self = {
          source: 'page',
          role: node.role,
          name: node.name,
          nth,
          disabled: node.disabled === true,
          ...(node.box ? { box: node.box } : {}),
          ...(within ? { within } : {}),
          locator: root.getByRole(node.role as Parameters<Page['getByRole']>[0], {
            name: node.name,
            exact: true,
          }).nth(nth - 1),
        };
        candidates.push(self);
      } else {
        unnamed.push(node.text ? { role: node.role, text: node.text } : { role: node.role });
      }
    }

    for (const child of node.children ?? []) walk(child, self ?? within);
  };

  for (const node of Array.isArray(snapshot) ? snapshot : [snapshot]) walk(node, undefined);

  // Disabled controls are found and then dropped from the draw. Hopping to one
  // does nothing, which would be journaled as a Hop that happened. Nothing
  // reports them yet.
  return {
    candidates: candidates.filter((candidate) => !candidate.disabled),
    unnamed,
    tree,
  };
}

/** Candidates from the native menu, or the reason there are none. */
async function surveyMenu(
  app: ElectronApplication,
  timeoutMs: number | undefined
): Promise<{ menuCandidates: MenuCandidate[]; menuSource: MenuSourceVerdict }> {
  // Offered whether or not a window holds focus. Menus used to be withheld
  // without focus, which made what a Route could draw depend on whatever else
  // on the machine took focus, and broke a replay on 2026-09-24. clickMenuItem
  // hands the handler the Route's window itself, so focus decides nothing.
  const entries = await answered('the main process, asked for its menu,', menuEntries(app), timeoutMs);
  const menuCandidates: MenuCandidate[] = entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      source: 'menu',
      role: 'menuitem',
      name: entry.label,
      menuPath: entry.path,
      ...(entry.electronRole ? { electronRole: entry.electronRole } : {}),
    }));

  return { menuCandidates, menuSource: { offered: true, count: menuCandidates.length } };
}
