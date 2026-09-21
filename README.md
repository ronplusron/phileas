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

| Term | Meaning |
|---|---|
| **Journey** | The top-level run. One or more Routes, one seed, one budget. |
| **Route** | One pass through the application. Executes as one test, with its own verdict. |
| **Fix** | Optional. A fixed sequence of Hops run at the start of every Route. |
| **Hop** | The atomic unit: one UI or API interaction. |
| **Journal** | The record a Route writes as it goes, one entry per Hop. |

Routes within a Journey are independent and know nothing of each other, so any
Route can be replayed on its own.

`docs/PRODUCT_REQUIREMENTS.md` defines these terms exactly, including what
separates a Fix from a Route and the three outcomes a Route can have.

## What it checks

Checks run after every Hop, and a Route stops at the first one that fails.
Some ship with the engine and assume nothing about the application: no
uncaught error, no console error, still responding, still showing something,
still where it started, every visible control carrying a name. An application
adds its own on top, and can supply answers worked out independently of the
code being tested, which is the only way the engine judges whether a value is
right rather than merely consistent.

A Route that runs out of moves before spending its budget is reported as
stranded, which is neither a pass nor a failure. Sometimes that is a dead end
or a trap, and sometimes it is a corner of the application with nothing more
to do in it.

`docs/PRODUCT_REQUIREMENTS.md` has all five ways a defect gets found, and what
each one can and cannot catch.

## Status

**Scaffold only.** There is no engine code. `package.json` declares no
dependencies, so `npm run typecheck` and `npm test` both have nothing to run,
and every source file named in `docs/PLAN.md` is planned rather than written.

## Building and testing

```
npm install
npm run typecheck
npm test
```

Neither script does anything yet, because `typescript` and `@playwright/test`
have not been added. Once they are, `npm test` runs Playwright against this
engine's own tests, not against a consuming application.

## Where things are

| Path | What it holds |
| --- | --- |
| `docs/PRODUCT_REQUIREMENTS.md` | What the product must do, apart from how it gets built. Read first. |
| `docs/PLAN.md` | Build order, and the reasoning behind the technical decisions. |
| `CLAUDE.md` | Standing commitments, so they do not get relitigated. |
| `ORIENTATION.md` | The brief for a session starting work. |
| `docs/OUTSTANDING.md` | What is open and is not a defect. |
| `docs/DEFECTS.md` | What is wrong, confirmed by reading the code. |
| `docs/HISTORY.md` | What has landed, with the measurements behind it. |
| `src/` | The engine. Its planned file layout is in `docs/PLAN.md`. |
| `src/invariants/` | The invariant runner and the universal tier. |
| `tests/` | This engine's own tests. |
| `examples/` | A reference adapter, and an app with planted bugs to point the bug-finder at. |
