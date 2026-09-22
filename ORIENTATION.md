# Phileas -- orientation for a new session

## 1. What it is

An exploratory testing engine. It travels through an Electron application
without a script, picks its own next move from what the screen actually
offers, checks a set of invariants after every move, and reports what it found
along with the exact route it took to get there. It complements a scripted
suite rather than replacing one: the scripted suite covers the paths someone
thought to write down, and this covers the rest.

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

**A launch layer that runs, a seed that reproduces, and nothing that
travels.** `src/` holds the seven files lifted from `trickster-tales` and
hardened: launching a packaged build, refusing a stale one, keeping windows off
the screen, reaching the native menu, stubbing outbound links, and the
`AppUnderTest` interface the whole thing talks through. `journey.ts` and
`random.ts` joined them in phase 3: the four terms of a Journey, a seedable
generator, and the per-Route seed derivation. `src/oracles/` still contains
nothing but `.gitkeep`.

**What is genuinely absent is everything that makes this an explorer.** No
traversal, no journal, no checks.

**Phases 0 through 3 are done, and the first real boundary is passed.**
`testbed/buggy/` is a packaged Electron application built to be traveled
through, and `npm test` runs twenty-one tests: six launch it, refuse a stale
bundle, report a bad boot in the application's own words, keep every window off
the screen, and prove the outbound-link stub took effect rather than assuming
it; fifteen more prove the reproducibility mechanism without launching
anything.

The remote is `ronplusron/phileas`, private, created 2026-09-21 and scanned
before first publication.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

`docs/PLAN.md` is written: ten phases, three of whose boundaries are real
verification points rather than bookkeeping.

**Phase 4 is the next thing to do**: `survey.ts`, `route.ts` and `journal.ts`,
which is the first code that travels. `testbed/buggy/phileas/` already holds
the whole consumer layout for it, and `journey.spec.ts` already registers one
test per Route; phase 4 puts the traversal inside those bodies.

**Two things phase 4 must not rediscover**, both measured in phase 2 and
carried in `docs/PLAN.md`. A hop must not wait for navigation to finish, or a
single outbound link costs a Route its whole budget. And `buggy`'s outbound-
link test is the positive control for the `external.ts` hazard: keep it,
because without it an empty recorder and a stub that never took read
identically.

**If `npm test` cannot find Electron:** `npm install` does not run Electron's
postinstall in this environment, so the types arrive and the binary does not.
`node node_modules/electron/install.js` fetches it, in the engine and in
`testbed/buggy/` separately. It looks like a broken checkout and is not.

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
npm run journey
```

`npm test` runs the engine's own twenty-one tests against `testbed/buggy/`.
`npm run journey` runs the Journey from the consumer's own config at
`testbed/buggy/phileas/playwright.config.ts`, which registers one test per
Route and, until phase 4, does nothing inside them but derive seeds. It prints
the Journey seed; set `PHILEAS_SEED` to replay one.

**None of it is evidence that the engine finds bugs**, because nothing is
planted in `buggy` yet and nothing travels through it. They show the launch
layer behaves as written and that a seed reproduces.

The testbed application builds itself:

```
cd testbed/buggy
npm install
npm run package
```

`npm test` from the repository root then runs against the bundle that
produces. Edit the application without repackaging and the staleness guard
refuses to run, naming the file that differs, which is the behavior rather
than a fault.

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

**The launch layer is verified; the product is not.** Six tests launch a real
packaged application, refuse a stale bundle, and prove the outbound-link stub
took effect. That is genuinely checked rather than inherited.

**It says nothing about whether the engine finds bugs.** Nothing travels
through the application and nothing is planted in it, so a green run here is
consistent with an engine that checks nothing at all. That stays true until
phase 8 points one Journey at planted defects and asserts each is found.

**The limit worth knowing before writing any of it:** a bug-finder that passes
its own tests has demonstrated nothing about whether it finds bugs. Its own
suite can only show that its parts behave as written. The real evidence is an
application with deliberately planted bugs, pointed at the engine, asserting
that each one is found -- which is what `testbed/` is for and why it is not
an optional extra.

A second limit is inherent rather than a gap to close. Metamorphic checks buy
self-consistency, not correctness: a bug that is consistently wrong passes
every round-trip, idempotence and commutativity relation there is. Catching
that class needs a test oracle computing the expected answer from a source of
truth, and `CLAUDE.md` records the trap that makes oracles fail silently.
