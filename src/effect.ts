/**
 * What a Hop did to the screen (R31).
 *
 * Worked out from two readings of the accessibility tree that are already
 * taken: the one the survey read before the Hop, and the last one the settle
 * wait read after it. So the effect costs nothing extra to measure.
 *
 * **Headings, and a separate flag.** A reader wants to know what the screen
 * became, and a screen's headings say that: going from a tale to its Compare
 * view reads as one heading appearing and three going away. But headings can
 * miss a change entirely, as a filter that leaves every heading in place does,
 * so whether anything at all changed is recorded apart from them.
 *
 * **Only what changed, never the whole list.** An application's title and a
 * sidebar heading sit on every screen, and a list view can repeat dozens of
 * titles; listing every heading on every Hop buries the difference. Headings
 * are compared as a multiset, so a title that appears twice and then once
 * counts as one going away.
 */

/** How many headings are listed each way before the rest are only counted. */
export const EFFECT_HEADINGS_LISTED = 5;

/** What one Hop did to the screen, as the journal records it. */
export type HopEffect =
  | {
      readonly readable: true;
      /** Whether anything in the accessibility tree differs. */
      readonly changed: boolean;
      /** Headings that appeared, up to `EFFECT_HEADINGS_LISTED`. */
      readonly appeared: readonly string[];
      /** How many more appeared than are listed. */
      readonly appearedMore: number;
      /** Headings that went away, up to `EFFECT_HEADINGS_LISTED`. */
      readonly wentAway: readonly string[];
      /** How many more went away than are listed. */
      readonly wentAwayMore: number;
    }
  | {
      /**
       * The effect could not be read, which is never recorded as "nothing
       * changed". A page that stopped answering and a Hop that did nothing
       * would otherwise leave the same record, and only the first is a finding.
       */
      readonly readable: false;
      readonly reason: string;
    };

interface AriaNode {
  role?: string;
  name?: string;
  text?: string;
  children?: (AriaNode | string)[];
}

/** The text of every heading in a snapshot, in document order. */
export function headingsIn(tree: unknown): string[] {
  const found: string[] = [];
  const textOf = (node: AriaNode | string): string =>
    typeof node === 'string'
      ? node
      : [node.name, node.text, ...(node.children ?? []).map(textOf)].filter(Boolean).join(' ');
  const walk = (node: AriaNode | string): void => {
    if (typeof node === 'string') return;
    if (node.role === 'heading') {
      const text = (node.name || textOf(node)).trim();
      if (text) found.push(text);
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of Array.isArray(tree) ? tree : [tree]) {
    if (node && typeof node === 'object') walk(node as AriaNode);
  }
  return found;
}

/** Items in `a` beyond as many as `b` holds, keeping `a`'s order. */
function beyond(a: readonly string[], b: readonly string[]): string[] {
  const left = new Map<string, number>();
  for (const item of b) left.set(item, (left.get(item) ?? 0) + 1);
  const extra: string[] = [];
  for (const item of a) {
    const n = left.get(item) ?? 0;
    if (n > 0) left.set(item, n - 1);
    else extra.push(item);
  }
  return extra;
}

/**
 * The effect of a Hop, from the readings before and after it.
 *
 * `after` is undefined when no reading could be taken after the Hop, which is
 * recorded as unreadable with `reason`, never as a Hop that changed nothing.
 */
export function effectOf(before: unknown, after: unknown, reason?: string): HopEffect {
  if (before === undefined || after === undefined) {
    return {
      readable: false,
      reason: reason ?? 'No reading of the page could be taken on one side of the Hop.',
    };
  }
  const was = headingsIn(before);
  const now = headingsIn(after);
  const appeared = beyond(now, was);
  const wentAway = beyond(was, now);
  return {
    readable: true,
    changed: JSON.stringify(before) !== JSON.stringify(after),
    appeared: appeared.slice(0, EFFECT_HEADINGS_LISTED),
    appearedMore: Math.max(0, appeared.length - EFFECT_HEADINGS_LISTED),
    wentAway: wentAway.slice(0, EFFECT_HEADINGS_LISTED),
    wentAwayMore: Math.max(0, wentAway.length - EFFECT_HEADINGS_LISTED),
  };
}
