import type { Frame, Locator, Page } from '@playwright/test';
import type { FrameName } from './app-under-test.js';
import type { Box } from './survey.js';

/**
 * Reading the page with what its frames hold, each in its frame's place.
 *
 * **Why.** Playwright's accessibility snapshot stops at a frame: it shows the
 * frame as one node, with no name and nothing inside it. Measured on RStudio
 * on 2026-10-09: its data viewer's grid, 69 named buttons, and its Help pane
 * are each a frame, and none of their controls reached the survey, so a Route
 * could open the data viewer and never act inside it, and a click inside a
 * frame would have been journaled as changing nothing (R31). docs/PLAN.md has
 * the measurement and the decisions, taken on 2026-10-09.
 *
 * **How.** Each document is read on its own, and every frame node in its
 * snapshot is given the document of the frame drawn there, as its children.
 * Playwright's `ai` mode reads inside frames in one call, but it adds
 * references and changes what it returns, so it is not used. The snapshot
 * gives a frame node nothing to tell it by but its box, so a node is paired
 * with the child frame whose element has that box. A frame the snapshot
 * leaves out, as one hidden or kept off the screen, is never read, and one
 * with no area adds nothing: no person could see what it holds.
 *
 * **Every frame is read,** whatever its origin, decided on 2026-10-09, so an
 * application's webviews drawn as frames come in with the rest. A frame that
 * cannot be read, such as one sandboxed so that no script runs in it, is
 * recorded as unread with the reason, never left out in silence; see
 * `SANDBOXED` for that one.
 */

/** A node of Playwright's accessibility snapshot, with what this module adds to a frame's node. */
export interface AriaNode {
  role?: string;
  name?: string;
  text?: string;
  disabled?: boolean;
  /** Where the element is drawn, in its own document's viewport, asked for with `boxes`. */
  box?: Box;
  children?: (AriaNode | string)[];
  /** On a frame's node: how a target names the frame, once its document is read in. */
  frame?: FrameName;
  /** On a frame's node: why its document could not be read. */
  frameUnread?: string;
}

/** One document read: the window's own page, or a frame's. */
export interface ReadFrame {
  readonly frame: Frame;
  /** How a target names it, outermost frame first; empty for the window's own page. */
  readonly path: readonly FrameName[];
  /** What its snapshot was taken from: its body, or a modal dialog open in it. */
  readonly root: Locator;
}

/** A frame drawn with area whose document could not be read, and why. */
export interface UnreadFrame {
  readonly path: readonly FrameName[];
  readonly reason: string;
}

export interface FramedRead {
  /** The snapshot exactly as Playwright returned it, boxes included, each frame's document read into its node. */
  readonly snapshot: unknown;
  /** Every document read, the window's own page first, then each frame in document order. */
  readonly frames: readonly ReadFrame[];
  readonly unread: readonly UnreadFrame[];
}

/**
 * The least time any one read is given, as the settle wait gives its own:
 * a read handed a few milliseconds near the end of a budget times out and
 * reads as a page that stopped answering.
 */
const MIN_READ_MS = 250;

/** What a document's snapshot is taken from, when nothing else is asked for: its body. */
const BODY = async (frame: Frame): Promise<Locator> => frame.locator('body');

/**
 * Read the page and every frame drawn in it.
 *
 * `rootOf` says what each document's snapshot is taken from; the survey
 * takes a modal dialog open in it, as it always has for the window's page.
 * A failure to read the window's own page is thrown, as a snapshot's always
 * was. A frame that fails is recorded as unread and the rest go on, each
 * given at least `MIN_READ_MS` of what is left.
 */
export async function readFramed(
  page: Page,
  options: { timeoutMs?: number; rootOf?: (frame: Frame) => Promise<Locator> } = {}
): Promise<FramedRead> {
  const { timeoutMs, rootOf = BODY } = options;
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  const left = (): number | undefined => (deadline === undefined ? undefined : Math.max(MIN_READ_MS, deadline - Date.now()));
  const frames: ReadFrame[] = [];
  const unread: UnreadFrame[] = [];

  const readDocument = async (frame: Frame, path: readonly FrameName[]): Promise<unknown> => {
    const root = await rootOf(frame);
    const timeout = left();
    const snapshot: unknown = await root.ariaSnapshotJSON({ boxes: true, ...(timeout === undefined ? {} : { timeout }) });
    frames.push({ frame, path, root });
    const slots = frameNodes(snapshot);
    if (!slots.length) return snapshot;

    const children = await childrenOf(frame, left());
    const used = new Set<Child>();
    const counts = new Map<string, number>();
    for (const slot of slots) {
      if (!slot.box || !hasArea(slot.box)) continue;
      const child = children.find((candidate) => !used.has(candidate) && sameBox(candidate.box, slot.box as Box));
      if (!child) {
        // Drawn with area and no frame of the page found there: recorded,
        // so a frame whose controls never arrive says so.
        const reason = 'no frame of the page was found where the snapshot shows one';
        slot.frameUnread = reason;
        unread.push({ path: [...path, { label: '', nth: 0 }], reason });
        continue;
      }
      used.add(child);
      const nth = (counts.get(child.label) ?? 0) + 1;
      counts.set(child.label, nth);
      const name: FrameName = { label: child.label, nth };
      slot.frame = name;
      if (child.sandboxed) {
        slot.frameUnread = SANDBOXED;
        unread.push({ path: [...path, name], reason: SANDBOXED });
        continue;
      }
      try {
        const inner = await readDocument(child.frame, [...path, name]);
        slot.children = [...(slot.children ?? []), ...(Array.isArray(inner) ? inner : [inner])];
      } catch (error) {
        const reason = error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error);
        slot.frameUnread = reason;
        unread.push({ path: [...path, name], reason });
      }
    }
    return snapshot;
  };

  const snapshot = await readDocument(page.mainFrame(), []);
  return { snapshot, frames, unread };
}

/**
 * The page's accessibility tree with every frame's read into its place and no
 * boxes, which is what the settle wait compares, a Hop's effect is read from
 * (R31) and the checks are handed. Throws as a snapshot of the body does when
 * the page does not answer.
 */
export async function readTree(page: Page, timeoutMs?: number): Promise<{ tree: unknown; frames: readonly ReadFrame[] }> {
  const read = await readFramed(page, timeoutMs === undefined ? {} : { timeoutMs });
  return { tree: withoutBoxes(read.snapshot), frames: read.frames };
}

/**
 * The tree without the boxes, for the Hop's effect and an adapter's checks.
 *
 * A Hop's effect compares two trees as text (src/effect.ts), and a box moves
 * whenever anything scrolls or resizes, so leaving them in would report every
 * Hop as a change. The checks were handed a tree without them before boxes
 * were read, and still are.
 */
export function withoutBoxes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutBoxes);
  if (node === null || typeof node !== 'object') return node;
  const { box: _box, children, ...rest } = node as AriaNode;
  return children === undefined ? rest : { ...rest, children: children.map(withoutBoxes) };
}

/** Every frame's node in a snapshot, in document order, not looking inside one already read in. */
function frameNodes(snapshot: unknown): AriaNode[] {
  const found: AriaNode[] = [];
  const walk = (node: AriaNode | string): void => {
    if (typeof node === 'string') return;
    if (node.role === 'iframe') {
      found.push(node);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of (Array.isArray(snapshot) ? snapshot : [snapshot]) as (AriaNode | string)[]) walk(node);
  return found;
}

interface Child {
  readonly frame: Frame;
  /** Its element's box, in its parent document's viewport, as the snapshot gives a node's. */
  readonly box: Box;
  readonly label: string;
  /** Sandboxed without `allow-scripts`, so no script runs in it; see `SANDBOXED`. */
  readonly sandboxed: boolean;
  /** Its element's place among the frames of its document, or -1 where the query cannot find it. */
  readonly order: number;
}

/**
 * Why a frame sandboxed without `allow-scripts` is not read. The engine's
 * reads inside a frame run script there, to test what covers a control, to
 * ask whether the page is busy and to read a link's address, and in such a
 * frame Chromium refuses each one and logs that it did as a console error,
 * so the console check would fail a Hop on what the engine itself did.
 * Measured on 2026-10-09 on the frame `checks.spec.ts` lays down after
 * Bobolink Inbox's message reader. Nothing in such a frame runs script, so
 * nothing in it reacts as an application does, though its links still go
 * somewhere.
 */
const SANDBOXED = 'sandboxed without allow-scripts, so the engine cannot read inside it without Chromium refusing and logging each read';

/**
 * The frames inside `frame`, each with its element's box and label. One that
 * is gone, or whose element does not answer in time, is left out: its node
 * then pairs with nothing and is recorded as unread.
 */
async function childrenOf(frame: Frame, timeoutMs: number | undefined): Promise<Child[]> {
  const found = await Promise.all(
    frame
      .childFrames()
      .filter((child) => !child.isDetached())
      .map((child) =>
        within(
          (async (): Promise<Child> => {
            const element = await child.frameElement();
            try {
              const read = await element.evaluate((handle) => {
                const node = handle as Element;
                const rect = node.getBoundingClientRect();
                const frames = [...node.ownerDocument.querySelectorAll('iframe, frame')];
                return {
                  order: frames.indexOf(node),
                  box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                  label: node.getAttribute('title') || node.getAttribute('name') || node.id || '',
                  sandboxed: node instanceof HTMLIFrameElement && node.hasAttribute('sandbox') && !node.sandbox.contains('allow-scripts'),
                };
              });
              return { frame: child, ...read, label: steadyLabel(read.label) };
            } finally {
              await element.dispose().catch(() => undefined);
            }
          })(),
          timeoutMs
        ).catch(() => undefined)
      )
  );
  // In document order, so two frames drawn at one box pair with their nodes,
  // which the snapshot lists in document order, the right way round.
  // Playwright lists frames in the order they were made, measured on
  // 2026-10-12, and a frame made later can sit earlier in the document. One
  // the document query cannot place, as inside a shadow root, goes last.
  const place = (child: Child): number => (child.order < 0 ? Number.MAX_SAFE_INTEGER : child.order);
  return found.filter((child): child is Child => child !== undefined).sort((a, b) => place(a) - place(b));
}

/**
 * A frame's label with any id made fresh each launch written as `<id>`: a
 * UUID, or eight or more hexadecimal digits standing alone, the two shapes
 * a finding's signature takes out for the same reason (src/known.mjs).
 * Measured on Positron on 2026-10-09: a webview's outer frame has no title,
 * and its name is a UUID that changed between two launches, so a target in
 * it would never have replayed. Two such frames in one document are then
 * told apart by their position.
 */
function steadyLabel(label: string): string {
  return label
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/(?<![0-9A-Za-z])[0-9A-Fa-f]{8,}(?![0-9A-Za-z])/g, '<id>');
}

/** A call given up after `timeoutMs`, for the element calls that take no timeout of their own. */
async function within<T>(call: Promise<T>, timeoutMs: number | undefined): Promise<T> {
  if (timeoutMs === undefined) return call;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      call,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function sameBox(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

function hasArea(box: Box): boolean {
  return box.width >= 1 && box.height >= 1;
}

/**
 * The scheme and host of an address, which is what tells a link that stays
 * in the application from one that leaves it. Compared as text rather than
 * as `URL.origin`, which is "null" for every scheme a browser does not know,
 * so `mailto:` and a webview's own scheme would otherwise read as the same.
 */
export function originKey(address: string): string {
  try {
    const url = new URL(address);
    return `${url.protocol}//${url.host}`;
  } catch {
    return address;
  }
}
