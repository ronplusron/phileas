import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
  readonly source: 'page' | 'menu';
  readonly role: string;
  readonly name: string;
  /** Which of the controls sharing this role and name, in document order. */
  readonly nth?: number;
  /** The label path from the menu root, for a menu entry. */
  readonly menuPath?: readonly string[];
}

/**
 * The result of one check after one Hop.
 *
 * Written empty by phase 4 and filled by phase 5. The field exists now because
 * R10 names it as part of a hop's record, and adding it later would leave every
 * journal written before that point silently different in shape from every one
 * written after.
 */
export interface JournaledCheck {
  readonly check: string;
  readonly passed: boolean;
  readonly observation?: string;
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
 */
export type HopAction = 'click' | 'fill' | 'menu-click';

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
  /**
   * Empty until phase 5, which runs the checks after Fix hops too. A check
   * failing here is a Fix failure, for the same reason as `error`.
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
   * The target should always be the pool entry at floor(draw / 2^32 x pool
   * size), which a reader can check from the file alone. On a replay, a draw
   * that differs names the hop where the sequence broke, even when the broken
   * draw lands on the same target by chance. Absent for a chooser that does not
   * draw.
   */
  readonly draw?: number;
  /** What was filled in, where the action was `fill`. */
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
  /** Empty until phase 5. */
  readonly checks: readonly JournaledCheck[];
}

/** What the Route was, written before it does anything. */
export interface OpeningEntry {
  readonly kind: 'route';
  readonly journeySeed: string;
  readonly routeSeed: string;
  readonly routeIndex: number;
  readonly hopBudget: number;
  readonly startedAt: string;
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
  /** Trip hops completed, which is not the budget unless the Route spent it. */
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
 * Where a Route's journal is written.
 *
 * One file per Route, named by index and seed. The seed is in the name as well
 * as in the opening entry so that a directory listing is enough to find the
 * journal for a seed named in a report, without opening anything.
 */
export function journalPath(directory: string, routeIndex: number, routeSeed: string): string {
  return path.join(directory, `route-${String(routeIndex).padStart(3, '0')}-${routeSeed}.jsonl`);
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

  private constructor(readonly file: string) {}

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
    opening: Omit<OpeningEntry, 'kind' | 'startedAt'>
  ): Journal {
    fs.mkdirSync(directory, { recursive: true });
    const journal = new Journal(
      journalPath(directory, opening.routeIndex, opening.routeSeed)
    );
    // 'w', not 'a'. One Journal instance owns the file for the whole Route, and
    // appending would mean a re-run of a seed silently glued a second Route's
    // entries onto the first. Every write after this one goes to the same open
    // descriptor, so the file is still built one flushed entry at a time.
    journal.fd = fs.openSync(journal.file, 'w');
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
    // cost is one flush per hop against a budget of tens, which is why it is
    // affordable here and would not be per candidate.
    fs.fsyncSync(this.fd);
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
