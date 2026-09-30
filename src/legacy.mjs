// Journal lines written in an earlier shape, read as today's.
//
// A journal is evidence, and one written before a rename has to go on reading.
// Every reader of a journal file passes each parsed line through `currentEntry`,
// so nothing past this file needs to know the older shapes existed.

/** @typedef {import('./journal').JournalEntry} JournalEntry */

/**
 * An entry in today's shape.
 *
 * A Fix step was written as `fix-hop`, numbered in `hop` and labeled in `name`,
 * until 2026-09-29, when a Fix became a script of steps and a Hop a Trip's jump
 * only. It is read as `fix-step`, with `step` and `label`.
 * @param {any} entry A parsed journal line.
 * @returns {JournalEntry}
 */
export function currentEntry(entry) {
  if (entry?.kind !== 'fix-hop') return entry;
  const { kind: _kind, hop, name, ...rest } = entry;
  return { kind: 'fix-step', step: hop, label: name, ...rest };
}
