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
the engine is the product. That reading settles arguments: an engine that
required every application to list its controls would be more precise and
would stop being a framework, so discovery comes first even where it costs
accuracy. A map is allowed from phase 10, and never required. `CLAUDE.md` records the commitments this produced.

`docs/GLOSSARY.md` defines every term, once. `docs/PRODUCT_REQUIREMENTS.md`
says what the product must do, apart from how
it gets built, and is the one to read first. Standing commitments live in
`CLAUDE.md` and the build order in `docs/PLAN.md`. None of the three is
summarized here -- read them.

## 2. Current state

**It travels, it writes down where it went, and it judges nothing.** `src/`
holds the seven files lifted from `trickster-tales` and hardened: launching a
packaged build, refusing a stale one, keeping windows off the screen, reaching
the native menu, stubbing outbound links, and the `AppUnderTest` interface the
whole thing talks through. `journey.ts` and `random.ts` joined them in phase 3.
`survey.ts`, `route.ts` and `journal.ts` joined them in phase 4: discovery by
accessibility role, one Route's Fix and Trip with the choosing and value seams,
and the per-Hop record. `effect.ts` joined them before phase 5, for what each
Hop did to the screen. `src/oracles/` still contains nothing but `.gitkeep`.

**What is genuinely absent is every check.** Nothing yet decides whether
anything a Route walked past is wrong, so a green Journey today is consistent
with an engine that checks nothing at all.

**Phases 0 through 4 are done, and the first real boundary is passed.**
`testbed/buggy/` is a packaged Electron application built to be traveled
through, and `npm test` runs one hundred and fourteen tests. Seven launch it,
refuse a stale bundle, report a bad boot in the application's own words, keep every
window off the screen, and prove the outbound-link stub took effect rather than
assuming it. Twenty-five prove the reproducibility mechanism and a Journey's
terms without launching anything, including known-answer vectors that pin the
generator's output. Twelve record what `buggy` correctly does, so a defect
planted later can be told apart from an accidental one. Seven assert that a
guard refuses rather than answering when it has no evidence. Seven work out
what a Hop did to the screen from two readings, without launching anything.
Twenty-seven travel through the application, and ten cover the journal, including
one cut off mid-write and one refusing to overwrite an earlier run. Fourteen
cover the window modes, the hop delay and the application's checkout, and two keep every source file searchable. The last three cover the
fixture layer and the types, the type ones being compile-time assertions that
`npm run typecheck` enforces.

The remote is `ronplusron/phileas`, private, created 2026-09-21 and scanned
before first publication.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

`docs/PLAN.md` is written: eleven phases, three of whose boundaries are real
verification points rather than bookkeeping.

**Phase 5 is the next thing to do.** Running the engine against real
applications for a demo found gaps phase 5 would otherwise have built on, and
all of them closed before it on 2026-09-24; `docs/PLAN.md` lists them under
"Before phase 5". Phase 5 itself is the universal tier of checks, and the point
where a Route can fail for a reason rather than only for not finishing. `journal.ts` already
carries an empty `checks` field on every Hop for it to fill.

**Read `docs/DEFECTS.md` before writing any of it.** One defect is open, and
phase 5 closes it: the external-link stub can install successfully and do
nothing, and it stays open until a second source
of evidence exists that does not depend on the stub having worked. That file
holds what is wrong, confirmed by reading the code, and nothing here restates
it.

**Two things phase 5 must not undo**, both measured earlier and carried in
`docs/PLAN.md`. A hop must not wait for navigation to finish, or a single
outbound link costs a Route its whole timeout; `route.ts` bounds every action
for that reason. And `buggy`'s outbound-link test is the positive control for
the `external.ts` hazard: keep it, because without it an empty recorder and a
stub that never took read identically.

**One thing phase 4 left standing, deliberately.** The menu source is
unavailable under an ordinary run, because a menu click with no focused window
reaches a handler with no window and does nothing while reporting success. That
is detection rather than repair, a repair was measured and does not exist, and
`docs/HISTORY.md` has both. The consequence is that `menuPaths` exclusions do
not fire either. Any `PHILEAS_SHOW` mode but `hidden` brings the menu source
back, because it is a focused window that the menu needs.

**If `npm test` cannot find Electron:** `npm install` does not run Electron's
postinstall in this environment, so the types arrive and the binary does not.
`node node_modules/electron/install.js` fetches it, in the engine and in
`testbed/buggy/` separately. It looks like a broken checkout and is not.

`docs/OUTSTANDING.md` holds what is open, and nothing in it now waits on an
opinion. `docs/DEFECTS.md` holds what is wrong, and phase 5 closes its one
entry.

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

`npm test` runs the engine's own one hundred and fourteen tests against `testbed/buggy/`.
`npm run journey` runs the Journey from the consumer's own config at
`testbed/buggy/phileas/playwright.config.ts`, which registers one test per
Route and now travels inside them. It prints the Journey seed; set
`PHILEAS_SEED` to replay one.

Each Route writes a journal to
`testbed/buggy/phileas/.phileas-journals/<journey seed>/<run>/`, one JSON
Lines file per Route, flushed per Hop. The run is named for when it started,
in UTC, and the run prints its name beside the seed. The layout under
`.phileas-journals/` is the engine's; a consumer chooses only that root. So every run of a seed is
kept, in folders that sort in the order the runs happened, and comparing two
runs means comparing two folders. A journal never overwrites another: one
already at its path is refused. Nothing yet clears old runs away.

**Reading a journal, until phase 7's report renders one (R30),** is a matter of
`jq`. One line per Hop:

```
jq -r 'if .kind=="trip-hop" then "hop \(.hop)  \(.action)  \(.target.name)  +\(.effect.appeared // []) -\(.effect.wentAway // [])" elif .kind=="outcome" then "\(.outcome) after \(.hops) hops" else empty end' route-000-*.jsonl
```

`jq . route-000-*.jsonl` prints every line in full.

**A replay needs the same window mode as the run it retraces.** A shown run
offers menu entries a hidden one withholds, so the same seed takes a different
route: measured on `buggy`, seed `demo1` started Summary, Inventory, Clear
search hidden, and Clear search, Clear search, Show Inventory shown. The hop
delay changes nothing.

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

`PHILEAS_SHOW` decides what the run does with the application's windows, and
has four values. `hidden`, `0`, or leaving it unset keeps them off the screen,
which is the default and what an unattended Journey uses. `back`, or `1`, puts
them on the screen behind whatever is frontmost, which is the useful setting
for watching because the run does not take the screen away from you. `front`
also activates the application so it comes forward, and `top` additionally
keeps it above every other window, which is genuinely hard to get away from.
Anything else is refused by name rather than read as hidden.

**Showing a window is not the same as activating the application**, which was
measured rather than assumed: a process launched from a terminal does not
become frontmost on macOS, so under `back` the window is drawn correctly and
sits behind what you are looking at, and does not appear at all if that is
full-screen in its own Space. Every reading from inside the process says the
window is fine.

`PHILEAS_HOP_DELAY_MS` pauses that many milliseconds after each Hop, so a run
can be watched at all: a Route otherwise travels twenty Hops in about a second,
and showing windows is pointless if what they show is a blur. It changes no
draw and no verdict, so a seed retraces the same Route with any delay, but it
does land inside the Route deadline and the Journey deadline, where either is
set. `PHILEAS_ALLOW_STALE=1` runs against a stale build, and the run says so
rather than passing quietly.

`PHILEAS_APP_DIR` names the application's checkout, for an adapter that lives
outside the application, and `requireAppDir()` is how such an adapter reads it:
it refuses by name when the variable is unset or is not a folder. `buggy`
does not use it, since its adapter sits inside its repository and finds it
from there.

`tsconfig.json` is `noEmit` with `strict` and `noUncheckedIndexedAccess` on.
`noUncheckedIndexedAccess` is not tidiness: an engine that travels indexes into
arrays of discovered elements constantly, and that flag is what forces the
empty-survey case to be handled rather than crashing on a route that found
nothing to do.

## 5. Verification, and its limits

**The launch layer and the Route are verified; the product is not.** Tests
launch a real packaged application, refuse a stale bundle, prove the
outbound-link stub took effect, travel through the application, and show that
one seed retraces one Route hop for hop. That is genuinely checked rather than
inherited.

**It says nothing about whether the engine finds bugs.** Nothing is planted in
the application and nothing yet checks anything, so a green run here is
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
