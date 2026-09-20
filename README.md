# Phileas

An exploratory testing engine for Electron apps. It walks an application
without a script, checking invariants at every step, and reports what it found
and exactly how it got there.

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
| **Fix** | The baseline state every Route starts from, established by setup Hops. |
| **Hop** | The atomic unit: one UI or API interaction. |

Routes within a Journey are independent. They share a Fix and know nothing of
each other, so any Route can be replayed on its own.

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

Early. Nothing here is stable and there is no published package.

## Layout

```
src/
  app-under-test.ts   the interface each application implements
  launch.ts           launching and resetting the app
  bundle.ts           resolving the build, and refusing to run against a stale one
  seed.ts             deriving per-Route seeds from the Journey seed
  traveler.ts         survey, choose, execute
  journal.ts          the per-Hop record written as the walk happens
  invariants/         the runner and the universal tier
tests/                this engine's own tests
examples/             a reference adapter, and an app with planted bugs
```
