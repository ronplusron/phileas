# Phileas -- orientation for a new session

## 1. What it is

An exploratory testing engine. It travels through an Electron application
without a script, picks its own next move from what the screen actually offers,
checks a
set of invariants after every move, and reports what it found along with the
exact route it took to get there. It complements a scripted suite rather than
replacing one: the scripted suite covers the paths someone thought to write
down, and this covers the rest.

**The framework is the deliverable, not any one application's test coverage.**
Decisions that look like over-engineering for a single app are correct when
the engine is the product. That reading settles arguments: an adapter
enumerating every control in one application would be more precise and would
stop this being a framework, so generic discovery wins even where it costs
accuracy. `CLAUDE.md` records the commitments this produced.

`docs/PRODUCT_REQUIREMENTS.md` says what the product must do, apart from how
it gets built, and is the one to read first. Standing commitments live in
`CLAUDE.md` and the build order in `docs/PLAN.md`. None of the three is
summarized here -- read them.

## 2. Current state

**A launch layer, and nothing that travels.** `src/` holds the seven files
lifted from `trickster-tales` and hardened: launching a packaged build,
refusing a stale one, keeping windows off the screen, reaching the native menu,
stubbing outbound links, and the `AppUnderTest` interface the whole thing talks
through. `src/oracles/`, `tests/` and `examples/` still contain nothing but
`.gitkeep`.

**What is genuinely absent is everything that makes this an explorer.** No
traversal, no seeding, no journal, no checks. `npm run typecheck` passes over
what is there, which proves it compiles and nothing else: none of it has been
run against an application from inside this repository, because there is
nothing here to launch until phase 2 builds one.

**Phases 0 and 1 are done.** `npm test` reports no tests found, correctly,
since the first of this engine's own tests arrives in phase 3.

The remote is `ronplusron/phileas`, private, created 2026-09-21 and scanned
before first publication.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

`docs/PLAN.md` is written: ten phases, three of whose boundaries are real
verification points rather than bookkeeping.

**Phase 2 is the next thing to do, and it is the first real boundary.** It
builds a small Electron application under `examples/`, packaged, with an
adapter beside it in the consumer layout. That is the first time anything in
this repository runs end to end, and it is what turns the paragraph above from
"it compiles" into "it launches a build, refuses a stale one, and stays off the
screen".

**One thing it will hit in its first minutes:** `electron` installed its types
but not its binary, which phase 1 did not need and phase 2 does.
`docs/HISTORY.md` has what was observed.

`docs/OUTSTANDING.md` holds what is open, and nothing in it now waits on an
opinion.

**Two research readings are recorded in `docs/HISTORY.md` and worth knowing
before designing anything.** Discovery by accessibility role was measured
against a real application and works, with its limit set by rendering
technique rather than by how interesting a surface is. And the engine cannot
require an application to tell it when it has settled: two mature suites were
examined and neither has such a signal, so the strategy has to work without
cooperation.

## 3. The launch layer was lifted, not designed here

`src/` did not start from nothing. The launch and bundle layer was written
inside a sibling Electron project's Playwright suite, deliberately structured
to be lifted out, and `e2e/kit/` in `trickster-tales` is still where it came
from. It arrived on 2026-09-22 byte-identical in one commit, with the hardening
in the next, so the difference between what was inherited and what was decided
here is readable in the history rather than only in prose.

**Read the origin before redesigning any of it**, because its comments explain
why several things are the shape they are, and those reasons did not all travel
into this repository. Two things it never had are worth knowing: nothing that
travels through an application, and no exclusion list.

**Its justifications are about one application, and that is the trap.**
`external.ts` explains why stubbing `shell.openExternal` works by describing
what that project's own `main.js` does. Lifting the file into a framework
carries the explanation along as an assumption about every application.
`docs/PLAN.md` holds it as a hazard, and it is the reason two later phases
carry work nobody would otherwise schedule.

Nothing else from that project is this product's concern. Its adapter, its
scripted specs and its application-specific expectations stay where they are.

## 4. How to build, test, and run

```
npm install
npm run typecheck
npm test
```

`npm run typecheck` passes over the launch layer. **That is not evidence about
the product**, only that it compiles: none of it has been run against an
application from inside this repository. `npm test` reports no tests found,
which is correct rather than broken: there is nothing to test until phase 3.

`@electron/asar` is a dependency; `@playwright/test` and `electron` are peer
dependencies with dev dependencies alongside. The peers are deliberate: a
consumer supplies the Electron binary, and a second copy of Playwright in the
tree would hand that consumer fixtures from the wrong instance.

Playwright's downloaded browsers are not needed and installing did not fetch
any. The engine drives an Electron binary through Playwright's own Electron
support, never one of those browsers.

`PHILEAS_SHOW=1` puts the application's windows back on the screen, which is
useful when working out why something failed. `PHILEAS_ALLOW_STALE=1` runs
against a stale build, and the run says so rather than passing quietly.

`tsconfig.json` is `noEmit` with `strict` and `noUncheckedIndexedAccess` on.
`noUncheckedIndexedAccess` is not tidiness: a traversal engine indexes into
arrays of discovered elements constantly, and that flag is what forces the
empty-survey case to be handled rather than crashing on a route that found
nothing to do.

## 5. Verification, and its limits

**Nothing has been verified by running it.** The launch layer compiles and its
origin was exercised inside another project, which says nothing about whether
it works here: it has never launched an application from this repository,
because there is nothing here to launch until phase 2. Treat every claim about
it as inherited rather than checked.

**The limit worth knowing before writing any of it:** a bug-finder that passes
its own tests has demonstrated nothing about whether it finds bugs. Its own
suite can only show that its parts behave as written. The real evidence is an
application with deliberately planted bugs, pointed at the engine, asserting
that each one is found -- which is what `examples/` is for and why it is not
an optional extra.

A second limit is inherent rather than a gap to close. Metamorphic checks buy
self-consistency, not correctness: a bug that is consistently wrong passes
every round-trip, idempotence and commutativity relation there is. Catching
that class needs a test oracle computing the expected answer from a source of
truth, and `CLAUDE.md` records the trap that makes oracles fail silently.
