import fs from 'node:fs';
import path from 'node:path';

/**
 * The record one Route writes as it goes.
 *
 * It lands in phase 4 with the first traversal rather than later with the
 * checks, because a Route that leaves no trace can only be observed by watching
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
 * Deliberately plain data rather than anything the traversal can act on. A
 * journal is read long after the run, often by someone who did not make it, so
 * every field here has to mean something on its own. `nth` is what separates
 * two controls that share a role and a name, and it is the same triple the
 * traversal uses to act, so a reader retracing a Route by hand is following
 * what actually happened rather than an approximation of it.
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

/** What one Hop did, and what it could have done instead (R10). */
export interface HopEntry {
  readonly kind: 'hop';
  /** Position in the Route, counting from zero. */
  readonly hop: number;
  /** Whether this Hop was part of the Fix or part of the traversal (R11). */
  readonly phase: 'fix' | 'traversal';
  readonly chosen: JournaledCandidate;
  /**
   * Every candidate the draw was made over, this one included.
   *
   * R10 asks for what else could have been chosen, and R14 is what makes it
   * more than bookkeeping: comparing this against what is available now is the
   * only way to answer whether a seed stopped reproducing because the
   * application changed or because the outcome did.
   */
  readonly candidates: readonly JournaledCandidate[];
  /** What was typed, where the Hop generated a value. */
  readonly value?: string;
  /**
   * Why the action was given up on, where it did not complete in time.
   *
   * The Hop still happened and is still recorded: something was chosen and
   * acted on, and the Route went on to its next Hop. Dropping it from the
   * record would leave a gap that reads like a Hop that never occurred, and a
   * replay comparing journals would diverge at it for no visible reason.
   */
  readonly abandoned?: string;
  readonly startedAt: string;
  readonly durationMs: number;
  /**
   * Whether the page stopped moving within the settle budget after this Hop.
   *
   * Recorded rather than only acted on. The settle wait computes this verdict
   * and it would otherwise be dropped on the floor, which would leave an
   * application that never settles invisible: every Hop would look ordinary,
   * and the survey it produced would be taken from a page still in motion.
   * R8 rests on the candidate list being identical hop for hop, so an unsettled
   * Hop is the first place a seed stops reproducing.
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
  readonly hop: number;
  readonly note: string;
  readonly at: string;
}

/** How the Route ended. Absent from the file when the run died first. */
export interface ClosingEntry {
  readonly kind: 'outcome';
  readonly outcome: 'passed' | 'stranded' | 'failed';
  /** Hops completed, which is not the budget unless the Route spent it. */
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

export type JournalEntry = OpeningEntry | HopEntry | NoteEntry | ClosingEntry;

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
