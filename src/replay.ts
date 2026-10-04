import { readJournal, type JournaledCandidate, type JournalEntry, type TripHopEntry } from './journal.js';
import { targetText } from './report/render.mjs';
import type { Chooser, ValueGenerator } from './route.js';
import type { SurveyedCandidate } from './survey.js';

/**
 * Replaying a Route from its journal rather than from its seed (R12).
 *
 * A seed replays only an unchanged application: a Hop's draw picks a position
 * in the pool, so anything that changes the pool sends it elsewhere. The
 * journal records each Hop's target by role, name and position, menu path or
 * key, and a replay acts on those by name instead of drawing, so a different
 * pool no longer sends it somewhere else as long as the control is there.
 * `docs/OUTSTANDING.md` 1.18 has the decisions, taken on 2026-10-02 and
 * 2026-10-04.
 *
 * **It is a chooser, not a runner of its own,** chosen on 2026-10-04: the
 * choosing seam was kept a named interface for exactly this, so the hop loop,
 * its checks and its journal are the ones every Route uses.
 */

/** What a replay needs from one journal: the Route it opened as, and its Trip hops in order. */
export interface Recorded {
  readonly file: string;
  readonly opening: Extract<JournalEntry, { kind: 'route' }>;
  readonly hops: readonly TripHopEntry[];
}

/** Read a journal for replaying, refusing one with no opening line, since it names no Route. */
export function readRecorded(file: string): Recorded {
  const entries = readJournal(file);
  const opening = entries.find((entry): entry is Extract<JournalEntry, { kind: 'route' }> => entry.kind === 'route');
  if (!opening) throw new Error(`${file} has no opening line, so it names no Route to replay.`);
  return { file, opening, hops: entries.filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop') };
}

/**
 * A replay that could not go on: the recorded target is not among what the
 * screen offers now. Never a pass, and never a finding about the application:
 * the replay proves nothing past this Hop (R13, R14).
 */
export class CouldNotReplay extends Error {
  constructor(
    readonly hop: number,
    readonly wanted: JournaledCandidate,
    readonly offered: readonly JournaledCandidate[]
  ) {
    super(
      `Could not replay hop ${hop}: ${targetText(wanted)} is not on offer now. What is: ` +
        `${offered.map((candidate) => targetText(candidate)).join('; ') || 'nothing'}.`
    );
    this.name = 'CouldNotReplay';
  }
}

/**
 * Whether a candidate on offer is the recorded target, exactly: its role, name
 * and position, its menu path or its key, as the journal writes them. Exact
 * first, decided 2026-10-02; the rule loosens only where a real replay shows
 * the need.
 */
export function sameTarget(offered: JournaledCandidate, recorded: JournaledCandidate): boolean {
  return JSON.stringify(offered) === JSON.stringify(recorded);
}

/**
 * The chooser and the value generator that replay `hops`, in order, the first
 * `count` of them. `journaled` turns a surveyed candidate into the form the
 * journal writes, so the comparison is with what was recorded and not with
 * how a candidate prints.
 *
 * One pair per Route: each keeps its own count of Hops, since the seams are
 * handed no Hop number.
 */
export function replayOf(
  hops: readonly TripHopEntry[],
  journaled: (candidate: SurveyedCandidate) => JournaledCandidate,
  count = hops.length
): { chooser: Chooser; values: ValueGenerator } {
  let chosen = 0;
  let valued = 0;
  const chooser: Chooser = {
    choose: (candidates) => {
      const recorded = hops[chosen];
      chosen += 1;
      if (!recorded || chosen > count) {
        throw new Error(`The replay was asked for hop ${chosen}, and replays ${Math.min(count, hops.length)}.`);
      }
      const match = candidates.find((candidate) => sameTarget(journaled(candidate), recorded.target));
      if (!match) throw new CouldNotReplay(recorded.hop, recorded.target, candidates.map(journaled));
      return { target: match };
    },
  };
  const values: ValueGenerator = {
    generate: () => {
      const recorded = hops[valued];
      valued += 1;
      return recorded?.value ?? '';
    },
  };
  return { chooser, values };
}
