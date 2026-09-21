# Phileas

An exploratory testing engine for Electron apps. It walks an application
without a script, checking invariants at every step, and reports what it found
and exactly how it got there.

TypeScript and Playwright. It ships as a package and is consumed by the
application it tests, running alongside that application's scripted suite
rather than in place of it.

Copyright © 2026 Ron Blum. All rights reserved.

## Why

A scripted end-to-end suite only ever checks the paths someone thought to
write down. Phileas covers the rest: it selects its own route through the
application in real time, within a fixed budget, and verifies at every stop
that the app still holds together.

Every run is seeded, so any failure replays exactly.

## Vocabulary

| Term | Meaning |
|---|---|
| **Journey** | The top-level run. One or more Routes, one seed, one budget. |
| **Route** | A single traversal. Executes as one test, with its own verdict. |
| **Fix** | An optional fixed sequence of Hops, run at the start of every Route to reach a known state. |
| **Hop** | The atomic unit: one UI or API interaction. |

A Fix is made of Hops like a Route is, but its Hops are chosen in advance and
are the same every time. That is the whole difference: the Fix is fixed, the
Route is not.

Routes within a Journey are independent. They share a Fix, where one is
defined, and know nothing of each other, so any Route can be replayed on its
own.

## What it checks

Three tiers, running after every Hop:

- **Universal** ship with the engine and assume nothing about the app under
  test: no uncaught exception, no hang, no white screen, no console error,
  every visible control reachable by name.
- **Structural** are declared per app: one view active at a time, a selected
  row matching the detail beside it, displayed counts matching the source.
- **Metamorphic** assert relationships rather than values, which is how a
  traversal with no expected answer still catches wrong behavior. Search then
  clear returns the original list. Navigating away and back returns the same
  state. A filter applied twice equals a filter applied once.

Completing the Journey is itself an assertion. A Route that cannot finish its
hop budget has found a dead end, and no separate check was needed to notice.

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
