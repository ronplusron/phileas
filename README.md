# Phileas

An exploratory testing engine for Electron apps. It travels through an
application without a script, checking invariants at every step, and reports
what it found and exactly how it got there.

TypeScript and Playwright. It ships as a package and is consumed by the
application it tests, running alongside that application's scripted suite
rather than in place of it.

Copyright © 2026 Ron Blum. All rights reserved.

## Why

A scripted end-to-end suite only ever checks the paths someone thought to
write down. Phileas covers the rest, within a fixed budget, and every run is
seeded so any failure replays exactly.

`docs/PRODUCT_REQUIREMENTS.md` states the problem properly, along with who has
it and what they do today.

## Vocabulary

A **Journey** is one run, made of **Routes**. Each Route follows a **Fix**, a
fixed opening, and then takes a **Trip** of **Hops** drawn from a seed, writing
a **Journal** as it goes. Routes within a Journey are independent and know
nothing of each other, so any Route can be replayed on its own.

`docs/GLOSSARY.md` defines every term, and is the one place they are defined.

## What it checks

Checks run after every Hop, and a Route stops at the first one that fails.
Some ship with the engine and assume nothing about the application: no
uncaught error, no console error, still responding, still showing something,
still where it started, every visible control carrying a name. An application
adds its own on top, and can supply answers worked out independently of the
code being tested. That is the only way the engine judges whether a value is
right rather than merely consistent, as opposed to self-consistent.

A Route that runs out of moves before completing its Trip is reported as
stranded, which is neither a pass nor a failure. Sometimes that is a dead end
or a trap, and sometimes it is a corner of the application with nothing more
to do in it. The journal keeps it apart; until phase 5 gives Playwright a way
to show it, a stranded Route's test fails, with the reason.

`docs/PRODUCT_REQUIREMENTS.md` has all five ways a defect gets found, and what
each one can and cannot catch.

## Status

**It travels, it writes down where it went, and it judges some of it.** `src/`
can launch a packaged Electron build, refuse a stale one, keep its windows off
the screen, reach its native menu and stub its outbound links, all through the
`AppUnderTest` interface an application implements. It states the terms of a
Journey and derives each Route's seeds from them. And it now travels: a Route
finds what the screen offers by accessibility role, draws its next move from
its seed, acts, waits for the page to stop moving, and writes a journal entry
per Hop. `testbed/buggy/` is a packaged application built to be traveled
through, and one hundred and ninety-eight tests run against it.

Six checks run after every Hop: uncaught errors, console errors, still
responding, the window still showing something, no unexpected dialog, and an
error in a log the adapter names. A Route that fails one ends there and says
which. The rest of the checks, and every check an application declares for
itself, are unwritten; `docs/PLAN.md` names the files and the phase each one
arrives in.

## Building and testing

```
npm install
npm run typecheck
npm test
```

`npm test` needs the testbed application packaged first:

```
cd testbed/buggy
npm install
npm run package
```

Then `npm test` from the root runs Playwright against that bundle, and
`npm run journey` runs the Journey from the application's own config. The tests
show the launch layer and the Route behave as written, and that one seed
retraces one Route hop for hop. **They are not evidence that the engine finds
bugs**, and cannot be until `testbed/` holds deliberately planted defects and a
Journey is shown finding each one.

## Where things are

| Path | What it holds |
| --- | --- |
| `docs/PRODUCT_REQUIREMENTS.md` | What the product must do, apart from how it gets built. Read first. |
| `docs/GLOSSARY.md` | Every term, defined once. |
| `docs/PLAN.md` | Build order, and the reasoning behind the technical decisions. |
| `CLAUDE.md` | Standing commitments, so they do not get relitigated. |
| `ORIENTATION.md` | The brief for a session starting work. |
| `docs/OUTSTANDING.md` | What is open and is not a defect. |
| `docs/DEFECTS.md` | What is wrong, confirmed by reading the code. |
| `docs/HISTORY.md` | What has landed, with the measurements behind it. |
| `docs/research/` | Studies of whether the engine suits a particular application, measured against that application's real bugs. |
| `src/` | The engine. Its planned file layout is in `docs/PLAN.md`. |
| `src/oracles/` | The check runner and the implicit tier. |
| `tests/` | This engine's own tests. |
| `testbed/` | Applications built to be tested, each broken in one chosen way, with the adapter each needs. |
| `trial/` | The adapter and Journeys for a measured trial against a real application, Positron first. `docs/PLAN.md` has the trial. |
| `demo/` | Applications built to show Phileas at work, apart from `testbed/`. `docs/DEMO_PLAN_TRAIN.md` plans the first; `npm run demo:train` runs it, and `npm run demo:present` presents it. |
