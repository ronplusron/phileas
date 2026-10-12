---
name: journey
description: Book and run a Phileas Journey against the application under test, then report what it found. Use when asked to run a Journey, run Phileas, explore the application, start a batch of Routes, or rerun a seed, in a repository with a phileas/ folder or the @drugstoresushi/phileas package.
---

# Running a Journey

Phileas travels through an Electron application one Hop at a time, drawing
each move from a seed, and checks it after every Hop. A Journey is one run;
each Route in it is one Playwright test with its own verdict. The terms are
defined in the package's `docs/GLOSSARY.md`, and nowhere else.

## Before running

1. Find the Journey's folder: `phileas/` in the repository, or the folder the
   person names. It holds `playwright.config.ts`, `journeys/` with the
   Booking, and `fixes/`.
2. Read the Booking in `journeys/` and say what it books: Routes, Trip
   length, Fix, deadlines. Change it for one run with flags, never by editing
   the file, unless asked to change the Booking itself.
3. Say the command before running it, and what it will cost in time when the
   Booking is large. A Journey launches the application once per Route.

## Running

```
npx phileas run [config] [--routes N] [--trip-length N] [--seed S] [--fix NAME] [--follow]
```

- Pass `--follow`, so each Hop prints as it happens and the person can watch.
- Run it where the person can see the output, unfiltered. Never pipe a
  Journey through `tail` or `grep`: the summary is the last thing printed and
  a Route's failure is in the middle.
- A long Journey runs in the background, and is read when it ends.
- `npx phileas run --help` lists every flag.

## Reading what it printed

The reporter prints each Route's ending, then a summary: Routes passed,
failed and **stranded**, the known findings met, any new ones added as
known but unfiled, and the command that runs it again.

- **Stranded is neither a pass nor a failure.** The Route ran out of moves.
  Report it as stranded, never folded into either.
- A Route that failed on a check names each finding by id. A Route that
  failed on an error in the engine or the setup prints the error whole; that
  is a fault to report, not a finding.
- `npx phileas show [run]` prints a finished run, one line per Hop, and
  `npx phileas show --json [run]` prints it as one object.

## Afterwards

- **Journals are not in git.** They sit in `.phileas-journals/` beside the
  config. In a worktree that is about to be removed, copy them out first, or
  they go with it.
- Offer to triage the run (the `triage` skill) or reproduce its new findings
  (the `reproduce` skill). Do neither unasked.
