import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { HopEffect } from './effect';
import { renderEntry } from './report/render.mjs';

/**
 * The record one Route writes as it goes.
 *
 * It landed in phase 4 with the first code that travels rather than later with
 * the checks, because a Route that leaves no trace can only be observed by watching
 * a window, and a phase whose output is a person watching is a phase nobody can
 * verify.
 *
 * **It is written independently of Playwright's attachments and trace.** Both
 * of those are produced when a test ends, which is exactly what does not happen
 * in the endings R9 lists: the application crashing, the application hanging
 * and being given up on, the run being stopped by hand or by its deadline, and
 * the machine running it dying. Several of those endings are themselves the
 * finding, so the record of them cannot depend on a clean exit.
 */

/**
 * One candidate, as the record names it.
 *
 * Deliberately plain data rather than anything a Route can act on. A journal is
 * read long after the run, often by someone who did not make it, so every field
 * here has to mean something on its own. `nth` is what separates two controls
 * that share a role and a name, and it is the same triple a Hop uses to act, so
 * a reader retracing a Route by hand is following what actually happened
 * rather than an approximation of it.
 */
export interface JournaledCandidate {
  readonly source: 'page' | 'menu' | 'key';
  readonly role: string;
  readonly name: string;
  /** Which of the controls sharing this role and name, in document order, counting from 1. */
  readonly nth?: number;
  /** The label path from the menu root, for a menu entry. */
  readonly menuPath?: readonly string[];
  /** The key as pressed, for a key. */
  readonly key?: string;
  /** For a shortcut, the names of the controls that print it. */
  readonly controls?: readonly string[];
}

/**
 * The result of one check after one Hop.
 *
 * Written empty by phase 4, and filled since 2026-09-26. **Every check is
 * written on every Hop, including one that did not run**, with the reason it
 * did not. A check left out of the line would read exactly like one that
 * passed, which is a clean result claiming evidence nobody gathered.
 */
export interface JournaledCheck {
  readonly check: string;
  readonly result: 'passed' | 'failed' | 'not-run';
  /**
   * What the check saw: the violation for a failure, why it did not run, or
   * what a narrowing accepted on a pass.
   */
  readonly observation?: string;
  /** The adapter's reason, where it narrowed or switched off this check (R19). */
  readonly narrowed?: string;
  /**
   * Each violation this check saw, by its signature, and whether it was a
   * known finding, which lets the Route carry on. Read at a Journey's end to
   * add what it found to the known findings. Absent in journals written
   * before 2026-09-27, and where the check saw nothing.
   */
  readonly findings?: readonly {
    readonly id: string;
    readonly signature: string;
    readonly known: boolean;
    readonly issue?: string;
  }[];
}

/**
 * What a Trip hop did to its target.
 *
 * Recorded rather than left to be inferred from the role. The rule that turns a
 * role into an action lives in the engine's source, and a journal read after
 * that rule changes would be silently misread. `fill` in particular is not
 * typing: it sets the whole value at once and presses no keys, so a defect in a
 * key handler is out of its reach, and a reader seeing a typed value would
 * otherwise assume keystrokes.
 *
 * `select` chooses an option inside a native dropdown, through the dropdown.
 * Clicking the option itself never works: Playwright cannot click an `<option>`,
 * so before this existed every such Hop timed out and was abandoned, and no
 * dropdown's value could ever change. Like `fill`, it sets the choice directly
 * and never opens the list, so moving through the list by keyboard is not
 * exercised.
 *
 * `focus` is what a Hop does to a native dropdown itself. Clicking one opens the
 * operating system's popup list, which the engine cannot see or use, and which
 * holds the application open: measured, a close took 0.7 to 10.4 seconds after
 * one, against about 40ms otherwise. Focusing reaches the dropdown the way
 * tabbing to it would, without the list.
 *
 * `type` empties a field and then presses one key per character, so a defect
 * in a key handler is in reach. It replaced `fill` on 2026-09-24; `fill` stays
 * in this type only so that journals written before then still read.
 *
 * `press` presses one key on whatever has focus: a common key, or a shortcut
 * printed in a control's name.
 */
export type HopAction = 'click' | 'fill' | 'type' | 'press' | 'select' | 'focus' | 'menu-click';

/**
 * A candidate list, written once and referred to by id.
 *
 * R10 asks what else could have been chosen at every Hop, and R14 needs that
 * exact list, in its order, to say whether a seed stopped reproducing because
 * the application changed. Writing the whole list on every line satisfied both
 * and made the file unreadable: twenty Hops over eleven candidates, most of them
 * a menu that never changed. A list changes only when the screen does, so it is
 * written the first time it appears and every Hop drawn over it names its id.
 *
 * **It is always written before the first Hop that names it.** A file cut off
 * mid-write then never holds a Hop pointing at a list that is not there, which
 * is the ending R9 is about.
 */
export interface PoolEntry {
  readonly kind: 'pool';
  /** Derived from the contents, so the same list always has the same id. */
  readonly id: string;
  readonly candidates: readonly JournaledCandidate[];
}

/**
 * One step of the Fix.
 *
 * Its own shape rather than a Trip hop's with fields bent to fit. A Fix is
 * fixed: nothing is drawn, there is no list it was drawn from, and the step is
 * a piece of the Journey author's code rather than something discovered on the
 * screen, so it has no role. Every field below is true of a Fix step, which is
 * the test the earlier shape failed on three counts.
 */
export interface FixHopEntry {
  readonly kind: 'fix-hop';
  /** Position within the Fix, counting from 1. */
  readonly hop: number;
  /** The label the Journey's author gave this step, not an accessible name. */
  readonly name: string;
  /**
   * Why the step failed, on the step that did.
   *
   * R11 wants a broken Fix told apart from a failed Route, and that means
   * saying which step broke. It used to survive only as a sentence inside the
   * outcome's reason, with no line of its own.
   */
  readonly error?: string;
  readonly startedAt: string;
  readonly durationMs: number;
  /** What the step did to the screen (R31), read after a full settle wait. */
  readonly effect: HopEffect;
  /**
   * Every check's result after this step, since the checks run after Fix
   * steps too. A check failing here is a Fix failure, for the same reason as
   * `error`. Empty in journals written before 2026-09-26, and for a survey.
   */
  readonly checks: readonly JournaledCheck[];
}

/** What one Trip hop did, and what it could have done instead (R10). */
export interface TripHopEntry {
  readonly kind: 'trip-hop';
  /**
   * Position within the Trip, counting from 1.
   *
   * From 1 because a person reads it: "stranded at hop 12 of 20" has to mean the
   * twelfth. Counted separately from the Fix, so that editing the Fix does not
   * renumber every Trip hop recorded before the edit.
   */
  readonly hop: number;
  /** What the Hop acted on, or tried to. */
  readonly target: JournaledCandidate;
  readonly action: HopAction;
  /** The id of the pool the target was drawn from. Its line comes earlier. */
  readonly pool: string;
  /**
   * The raw 32-bit draw that selected the target, where a seeded draw did.
   *
   * The target should always be the entry at floor(draw / 2^32 x side size)
   * of the side `shareDraw` chose, in pool order, after any fallback, which a
   * reader can check from the file alone. On a replay, a draw
   * that differs names the hop where the sequence broke, even when the broken
   * draw lands on the same target by chance. Absent for a chooser that does not
   * draw.
   */
  readonly draw?: number;
  /**
   * The raw 32-bit draw that decided which side of the pool the Hop was drawn
   * from, taken before `draw`. As a fraction of 2^32: below the opening
   * line's `keyShare` it chose the common keys; below `keyShare` plus
   * `menuShare`, the menu bar entries; otherwise the page, meaning
   * everything else, printed shortcuts included. `draw` then points into that
   * side, in pool order. A chosen side with nothing on it falls back to the
   * page, and an empty page to the keys and then the menu.
   *
   * Journals written earlier on 2026-09-24 split only keys from the rest, with
   * the keys below a quarter; before that day this is absent and `draw` points
   * into the whole pool.
   */
  readonly shareDraw?: number;
  /** What was typed, where the action was `type`, or filled, for `fill`. */
  readonly value?: string;
  /**
   * Why the action was given up on, where it did not complete in time.
   *
   * The Hop still happened and is still recorded: something was chosen and
   * acted on. Dropping it from the record would leave a gap that reads like a
   * Hop that never occurred, and a replay comparing journals would diverge at
   * it for no visible reason.
   */
  readonly abandoned?: string;
  readonly startedAt: string;
  readonly durationMs: number;
  /**
   * Whether the page stopped moving within the settle budget after this Hop.
   *
   * Recorded rather than only acted on. An application that never settles would
   * otherwise be invisible: every Hop would look ordinary, and the survey it
   * produced would be taken from a page still in motion. R8 rests on the
   * candidate list being identical hop for hop, so an unsettled Hop is the first
   * place a seed stops reproducing.
   */
  readonly settled: boolean;
  /** How long the settle wait took, which is the cost paid on every Hop. */
  readonly settleMs: number;
  /**
   * What the Hop did to the screen (R31): whether anything changed, and which
   * headings appeared and went away. See `effectOf`.
   */
  readonly effect: HopEffect;
  /** Every check's result after this Hop. Empty in journals written before 2026-09-26. */
  readonly checks: readonly JournaledCheck[];
}

/** What the Route was, written before it does anything. */
export interface OpeningEntry {
  readonly kind: 'route';
  readonly journeySeed: string;
  readonly routeSeed: string;
  /** Which Route of the Journey this is, counting from 1. */
  readonly routeNumber: number;
  readonly tripLength: number;
  /** The quiet window the settle wait used for this Route. See `settle`. */
  readonly settleQuietMs: number;
  /**
   * The shares the share draw was read with, the adapter's or the defaults.
   * Absent in journals written before 2026-09-24's configurable shares.
   */
  readonly keyShare?: number;
  readonly menuShare?: number;
  /**
   * The standard menu roles the adapter allowed back, empty when every
   * standard entry was skipped, which is the default. Written because the
   * default is an input to the draw, and a replay under a different setting
   * would send the Route somewhere else. Absent in journals written before
   * 2026-09-26, when standard entries were still offered.
   */
  readonly allowStandardMenuRoles?: readonly string[];
  /**
   * Which known findings the Route ran with: the file's version and how many
   * it held. Written because the file decides where a Route ends, though not
   * what it draws, and a replay under a newer file would otherwise look like a
   * different application. Absent where no known findings were given, and in
   * journals written before 2026-09-27.
   */
  readonly knownFindings?: { readonly version: string; readonly entries: number };
  /**
   * The adapter's own patterns for what a signature takes out, each as its
   * source text and its replacement. Written for the known findings' reason:
   * they decide which findings match a known one, and so where a Route ends.
   * Absent where the adapter gives none, and in journals written before
   * 2026-09-28.
   */
  readonly varyingInSignatures?: readonly (readonly [string, string])[];
  /**
   * Which Fix the Route opened with: its name in `fixes/index.ts`, or the
   * function's own name where it has one, and a fingerprint of its source. Written because a Fix is part of what a seed
   * reproduces, and a replay after the Fix was edited would otherwise look like
   * a changed application or a changed outcome (R14). The fingerprint is of the
   * Fix function's own source, so it catches an edit to that function and not
   * one to a function it calls, such as a Fix that begins by running another;
   * the `fix-hop` lines, which name every step in order, cover that case.
   * Absent for a Route with no Fix, and in journals written before 2026-09-28.
   */
  readonly fix?: { readonly name?: string; readonly fingerprint: string };
  readonly startedAt: string;
}

/** A Fix's fingerprint: the first twelve hex digits of a hash of its source. */
export function fixFingerprint(fix: (...args: never[]) => unknown): string {
  return createHash('sha256').update(fix.toString()).digest('hex').slice(0, 12);
}

/**
 * Anything the Route recorded that is not a Hop.
 *
 * The menu source being unavailable is the case this exists for: a Route that
 * never hopped to a menu because none was offered looks, in a journal with no
 * such entry, exactly like a Route that was offered menus and drew elsewhere
 * every time.
 */
export interface NoteEntry {
  readonly kind: 'note';
  /** The Trip hop about to be taken when this was noted, counting from 1. */
  readonly hop: number;
  readonly note: string;
  readonly at: string;
}

/** How the Route ended. Absent from the file when the run died first. */
export interface ClosingEntry {
  readonly kind: 'outcome';
  readonly outcome: 'passed' | 'stranded' | 'failed';
  /** Trip hops completed, which is short of the Trip length unless the Route finished. */
  readonly hops: number;
  /** Why, for stranded and failed. */
  readonly reason?: string;
  /**
   * Exclusion entries that matched nothing for the whole Route.
   *
   * An entry that never matched is almost certainly stale, and an exclusion
   * list is pure input otherwise, so the engine has nowhere else to say it.
   * Per Route rather than per Journey because Routes are independent and may
   * run in separate processes; rolling these up across a Journey is the
   * report's job in phase 7.
   */
  readonly exclusionsNeverMatched?: readonly string[];
  readonly endedAt: string;
}

export type JournalEntry =
  | OpeningEntry
  | PoolEntry
  | FixHopEntry
  | TripHopEntry
  | NoteEntry
  | ClosingEntry;

/**
 * The folder one run's journals go in: `<root>/<journey seed>/<run>/`.
 *
 * The engine's, not the consumer's, decided 2026-09-24. A consumer chooses the
 * root and nothing under it. Under the seed first, so the journals for a seed
 * named in a report are found by looking for that seed; then a folder per run,
 * so a rerun of a seed never lands beside or on top of an earlier run's files.
 * Phase 7's report and any replay comparison find journals by this layout, so
 * a consumer that laid them out its own way would break both, and before this
 * lived here each consumer had to copy it correctly.
 */
export function journalFolder(root: string, journeySeed: string, run: string): string {
  return path.join(root, journeySeed, run);
}

/**
 * Where a Route's journal is written.
 *
 * One file per Route, named by its number and seed, so Route 1's journal is
 * `route-001-...`. The seed is in the name as well as in the opening entry so that a directory
 * listing is enough to find the journal for a seed named in a report, without
 * opening anything.
 */
export function journalPath(directory: string, routeNumber: number, routeSeed: string): string {
  return path.join(directory, `route-${String(routeNumber).padStart(3, '0')}-${routeSeed}.jsonl`);
}

/**
 * A Route's journal, appended and flushed one entry at a time.
 *
 * **JSON Lines rather than a JSON array**, because an array is only valid once
 * its closing bracket is written. A run killed at hop 13 would leave a file no
 * parser accepts, which is the exact case R9 is about. One object per line
 * means every completed hop is readable and only the partial last line is lost.
 */
export class Journal {
  private fd: number | undefined;

  /** The pools already in this file, so each is written exactly once. */
  private readonly pools = new Set<string>();

  private constructor(
    readonly file: string,
    private readonly routeNumber: number,
    private readonly follow: boolean
  ) {}

  /**
   * Open the journal and record what the Route is.
   *
   * The opening entry is written and flushed before the Route does anything, so
   * that a Route which dies during its Fix still leaves a file naming the seed
   * that produced it. A journal created only on the first successful hop would
   * be absent for exactly the failures worth reading about.
   */
  static open(
    directory: string,
    opening: Omit<OpeningEntry, 'kind' | 'startedAt'>,
    { follow = false }: { follow?: boolean } = {}
  ): Journal {
    fs.mkdirSync(directory, { recursive: true });
    const journal = new Journal(
      journalPath(directory, opening.routeNumber, opening.routeSeed),
      opening.routeNumber,
      follow
    );
    // 'wx': create, and refuse if the file already exists. Appending would glue
    // a second Route's entries onto the first, and overwriting would destroy an
    // earlier run's record, which a replay wants to compare against. Each run
    // writes to a folder of its own, so an existing file means two runs were
    // given one folder, and that is refused here rather than discovered later.
    // Every write after this one goes to the same open descriptor, so the file
    // is still built one flushed entry at a time.
    try {
      journal.fd = fs.openSync(journal.file, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      throw new Error(
        `A journal already exists at ${journal.file}. Each run writes to a folder of ` +
          `its own, so two runs were given the same folder; the earlier record is ` +
          `kept rather than overwritten.`
      );
    }
    journal.write({ kind: 'route', ...opening, startedAt: new Date().toISOString() });
    return journal;
  }

  /** Append one entry and put it on disk before returning. */
  write(entry: JournalEntry): void {
    if (this.fd === undefined) {
      throw new Error(
        `The journal at ${this.file} is closed, and something tried to write to it. ` +
          `A Route writes its outcome last; anything after that is a mistake in the caller.`
      );
    }

    fs.writeSync(this.fd, `${JSON.stringify(entry)}\n`);

    // fsync, not just write. A synchronous write survives this process dying,
    // which covers the application crashing and the run being stopped by hand.
    // It does not survive the machine dying, and R9 names that ending too. The
    // cost is one flush per hop against a Trip of tens, which is why it is
    // affordable here and would not be per candidate.
    fs.fsyncSync(this.fd);

    // Printed after the entry is on disk, never before, so what a person sees
    // following a run is never ahead of the record. See `phileas run --follow`.
    if (this.follow) {
      const line = renderEntry(entry, this.routeNumber);
      if (line) console.log(line);
    }
  }

  /**
   * The id for a candidate list, writing the list first if this file has not
   * seen it.
   *
   * Called before the Hop line that names the id, which is what keeps a file
   * cut off mid-write from ever holding a Hop that points at a missing pool.
   * The id is a digest of the list in order, because order is part of what a
   * replay compares: a list that merely reordered sends the same draw to a
   * different position.
   */
  pool(candidates: readonly JournaledCandidate[]): string {
    const id = createHash('sha256').update(JSON.stringify(candidates)).digest('hex').slice(0, 12);
    if (!this.pools.has(id)) {
      this.write({ kind: 'pool', id, candidates });
      this.pools.add(id);
    }
    return id;
  }

  /** Record how the Route ended, and close. */
  close(closing: Omit<ClosingEntry, 'kind' | 'endedAt'>): void {
    this.write({ kind: 'outcome', ...closing, endedAt: new Date().toISOString() });
    if (this.fd !== undefined) {
      fs.closeSync(this.fd);
      this.fd = undefined;
    }
  }

  /**
   * Close without an outcome, for a Route whose ending nothing caught.
   *
   * Deliberately leaves the file without a closing entry rather than inventing
   * one. A journal with no outcome line says the Route did not finish, which is
   * true and is worth knowing; a guessed outcome would be a record of something
   * that did not happen.
   */
  abandon(): void {
    if (this.fd !== undefined) {
      fs.closeSync(this.fd);
      this.fd = undefined;
    }
  }
}

/**
 * Read a journal back.
 *
 * Tolerates a truncated final line, which is the whole reason for the format:
 * a file cut off mid-write is expected rather than exceptional, and refusing to
 * read one would throw away every hop before the cut.
 */
export function readJournal(file: string): JournalEntry[] {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const entries: JournalEntry[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue;
    try {
      entries.push(JSON.parse(line) as JournalEntry);
    } catch {
      // Only the last line may be partial. Anything earlier means the file was
      // corrupted rather than truncated, and silently skipping it would hide
      // that: a journal is evidence, and evidence that quietly drops what it
      // cannot parse is worth less than one that says so.
      if (index !== lines.length - 1 && lines.slice(index + 1).some((rest) => rest.trim() !== '')) {
        throw new Error(
          `${file} has an unparseable line at ${index + 1}, with content after it. ` +
            `A truncated last line is expected; a broken line in the middle is not.`
        );
      }
    }
  }
  return entries;
}
