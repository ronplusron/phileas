# Phileas: the plan

Build order, sequencing, and the reasoning behind the technical decisions.

`PRODUCT_REQUIREMENTS.md` is what the product must do, apart from how it gets
built, and is the one to read first. The stack choices are settled in
`../CLAUDE.md` and are not re-argued here. What is open is in
`OUTSTANDING.md`; **an item described below as open says what was true when
the passage was written.**

Requirement numbers (R1 and so on) are those of `PRODUCT_REQUIREMENTS.md`.
They are stable and meant to be cited. Nothing else is cited by number, because
`OUTSTANDING.md` renumbers.

---

## Context

Written 2026-09-21, when nothing was built and no dependency was installed.
**This document is the plan, not a status report.** A phase described below in
the future tense may already be done: phases 0 through 4 are, and where one of
them recorded a measurement the passage says so. `../ORIENTATION.md` is the
current state and is the file to check rather than this one.

What is known and decided:

- The product is scoped to Electron applications, with the adapter seam kept
  capable of other targets later. `HISTORY.md` has the decision and its
  reasoning; this plan builds one target and does not reopen it.
- Part of the engine exists in a sibling repository, written to be lifted out.
  `HISTORY.md` records what was measured: 613 lines across 7 files, including
  an `AppUnderTest` interface of 54 lines. Counted again for this document and
  the total matches. The seven are `app-under-test.ts`, `bundle.ts`,
  `external.ts`, `fixtures.ts`, `index.ts`, `launch.ts` and `menu.ts`.
  Extraction, not design from scratch.
- Nothing in that code travels through an application. Traversal, seeding, the
  journal and every invariant tier are genuinely unwritten.
- Dependencies come first, since `npm run typecheck` and `npm test` are inert
  without them and nothing later can be verified at all.
- `testbed/`, an application with planted bugs, is the only checkpoint that
  shows the assembled engine does its job. `OUTSTANDING.md` says why it is not
  a late nicety.

The scaffold that exists: `package.json` naming the package
`@drugstoresushi/phileas`, with `main` and `exports` pointing at
`src/index.ts`; a strict `tsconfig.json` that includes `src/`, `tests/` and
`testbed/`; and empty directories.

### The planned layout of `src/`

Other documents point here for the file layout, so it is stated once. Files
marked lifted come from the kit; the rest are new.

```
src/
  index.ts             the package surface (lifted, then extended)
  app-under-test.ts    the AppUnderTest interface (lifted, then hardened)
  launch.ts            launch, hide windows, reset, close (lifted)
  bundle.ts            find the packaged build; the staleness guard (lifted)
  external.ts          stub shell.openExternal, record what was opened (lifted)
  menu.ts              reach the application menu by label path (lifted)
  fixtures.ts          Route as the test, Fix as beforeEach (lifted, reshaped)
  journey.ts           the terms of a Journey, and per-Route seed derivation
  random.ts            the seedable generator and the hash; the only source of randomness
  survey.ts            discovery by role, with the exclusion list applied
  route.ts             one Route: Fix, hops, stop rules, stranded; exports runRoute()
  journal.ts           the per-hop record, appended and flushed per hop
  effect.ts            what a Hop did to the screen, from two readings (R31)
  oracles/
    index.ts           the runner: whole set after every Hop, first violation ends the Route
    implicit/          the tier that assumes nothing about the application (R17)
    structural.ts      the shape of an app-declared same-moment check (R18)
    metamorphic.ts     the shape of a relation between two states (R20)
    specified.ts       the shape of an independently computed answer (R21)
  report/              the Journey summary, with stranded kept apart from failed
tests/                 the engine's own tests
testbed/buggy/   a small Electron application, packaged, with planted defects
testbed/buggy/phileas/  adapter/, journeys/, journey.spec.ts, global setup and
                        a Playwright config: the whole consumer layout
```

Each file is named after its principal export, which is why the set mixes
verbs and nouns: `launch.ts` exports `launch()`, `survey.ts` exports
`survey()`, and `route.ts` exports `runRoute()` alongside the Route's own
shape.

The testbed applications are named for the one thing each is awkward about,
so a directory listing says what a reader is looking at. `buggy` is the
structurally ordinary one that holds the planted defects; the siblings that
join it are named for their pathology, and `HISTORY.md` has the shape of the
set and why the two kinds of application make different claims.

## Build order

Eleven phases, numbered from zero. **Three phase boundaries are real
verification points; the other eight are bookkeeping.** The real ones close phases 2, 5 and
8. A bookkeeping boundary is where one piece of work ends and the next begins;
stopping there leaves nothing new that can be shown to work. A real point is
one where a claim about the product can be demonstrated, so a reader who has
to stop can stop with something.

Why this order: every later phase needs something to verify with (phase 0) and
something to launch (phase 2). Seeds come before traveling because the seed
split is what `../CLAUDE.md` warns is painful to retrofit. The journal lands
with the first route rather than after it, because R9 is about the record
surviving what the first route will do to the application. App-declared checks
come after the universal tier because they need a traveling engine to hang off.
Each planted defect is planted in the phase where its detection path lands,
and the assembled measure, every defect found by one Journey, is the last real
point. The optional map comes after all of it, for the reason phase 10 gives.
Recording a Fix sits between phases 5 and 6 without a number of its own, so
that the phases other documents cite keep theirs.

### Phase 0: dependencies, and a package that typechecks

Add `typescript` and `@playwright/test`, and two more that the lifted code
needs: `@electron/asar`, which `bundle.ts` imports to read the packaged
archive, and `@types/node`, because `tsconfig.json` names the `node` types and
the compiler reports that missing before it reports anything else. Add an
empty `src/index.ts` so the typecheck has a file.

**Playwright's downloaded browsers are probably not needed, and this is worth
confirming on the first install rather than assuming.** The engine drives
Electron through Playwright's own Electron support, which runs an Electron
binary rather than one of the browsers Playwright downloads. The lifted
fixtures override the `page` fixture for the same reason: the stock one would
try to launch a Chromium that was never installed.

**Confirmed 2026-09-21.** Installing `@playwright/test` in a scratch
directory and driving a packaged Electron application through it needed no
browser download. This was a reasoned expectation until then; it is now a
measurement.

Boundary: bookkeeping. A passing typecheck on an empty package proves the
toolchain exists and nothing else. It is still the gate every later phase
depends on.

### Phase 1: lift the kit into `src/`

Move the seven files under `src/` unchanged first, so the diff against their
origin is a rename and every later change is visible as a change. Then three
placements and one hardening pass.

Three of the seven had no recorded home. **All three are engine, accepted
2026-09-21 after reading them rather than reasoning about them.** `external.ts`
and `menu.ts` import nothing but Playwright's Electron types and hold no
selector, view name or other application knowledge.

- `external.ts` stubs Electron's own `shell.openExternal` in the main process
  and records what would have opened. It makes an outbound link safe to hop
  and detectable when hopped, which serves R17's "no navigation away" from the
  main-process side, alongside the exclusion list. **It also carries a way to
  fail silently, which the hazards below state and which three items in this
  phase, phase 2 and phase 5 exist to close.**
- `menu.ts` becomes a second candidate source for `survey`. The reason is
  `../CLAUDE.md`'s own example: the exclusion list exists for things like Quit,
  and Quit is a menu item. An exclusion list naming a menu item only makes
  sense if a Route can reach the menu. Menu items live in the main
  process and never appear in the page's accessibility tree, so `survey` by
  role alone would never see them. `editor`'s own suite reads the menu the
  same way, through `Menu.getApplicationMenu()`.
- `fixtures.ts` changes shape most, and "lifted, reshaped" understates it:
  worker-scoped launch becomes per-Route relaunch, the `page` fixture becomes
  the Route fixture, `failOnPageError` dissolves into R19, and `freshApp`
  becomes the default path. Almost every line changes, so the move-unchanged
  step above buys least here. Under the Route-is-the-test mapping it carries
  Fix as `beforeEach` and the Route's own verdict, trace and timeout.

**How much the interface has to carry was settled on 2026-09-21: all six
members below, every one of them optional.** `HISTORY.md` records the decision
and what was measured to reach it. The hardening is where that becomes
permanent, and every later phase builds on it.

Two of the six carried the decision on their own. Environment variables have a
confirmed consumer today rather than only the external pair: `editor`'s own
suite cannot launch hermetically without one. And page selection changes
`waitForReady(page)`'s contract rather than adding a field, since the engine
must choose a page before it can call it, so retrofitting it rewrites every
adapter that exists by then. The other four are cheap either way, and shutdown
and stray-process cleanup both carry more once phase 5 makes relaunch-per-Route
the default.

Hardening `AppUnderTest`:

- Add the exclusion list. R22 names it and `HISTORY.md` records that the
  lifted interface has nothing for it. Where the application's source is
  available, prefer deriving the list from it and checking it, rather than
  writing it out by hand: a hand-written list goes stale the day upstream adds
  another way out of the application, and does so silently. **Outbound links
  are part of what it derives, not only ways to quit.** The exclusion list is
  the primary defense against a Route leaving the application; the
  `external.ts` stub is the net under it, and the hazards below say why a net
  is not enough on its own.
- Fold the per-application flag for whether an uncaught renderer exception
  fails the test into R19's general narrowing. A special-case field for one
  check is what R19 generalizes, and keeping both invites them to disagree.
- The staleness guard compares content, not timestamps, and names each file
  that differs, in both directions, which is R23 exactly. R23 was reworded to
  match it: it previously said "older" and "newer", which described a weaker
  timestamp check than the lifted code actually performs. The guard has a skip
  switch for running against a stale build anyway, which the run announces.
  Keep the switch and keep the announcement.
- The readiness hook's contract, that it must throw with the application's own
  message rather than wait for a success marker, is R24 already written down.
  Keep the comment; it is the reason a future implementer would otherwise
  remove.
- **Add the six members the interface cannot express, all optional.** Found by
  reading a real fixture for a real application, and `HISTORY.md` records where
  they came from. Environment variables, because almost everything an
  application needs to run hermetically arrives that way rather than as flags,
  and the interface has only `launchArgs`. Page *selection*, because
  `waitForReady(page)` presumes the engine already picked the right one and an
  application with a splash has more than one. A pre-launch hook to seed
  settings, since several settings decide whether automation is possible at
  all. An application-specific shutdown, because closing a debugging connection
  does not terminate the process. Where the application writes its logs, since
  a failure can be invisible on screen and present in a log. And how to
  recognize the application's own stray processes for cleanup, which phase 5
  reads a second time for evidence the `external.ts` stub cannot supply.
- **`productName` stops being the source for both derivations, and stops being
  required.** The lifted field is required, and its comment says it must match
  `productName` in package.json. `editor` has no such field: its name lives in
  `electron-builder.yml`, so its adapter would be inventing a value to feed two
  derivations that are wrong for it anyway. The bundle path comes from
  `bundleDir` and the executable name is read from the bundle rather than
  assumed from a product name.
- **`bundleDir` is needed on day one, not as an escape hatch.** The lifted
  default expects `dist/<productName>-darwin-arm64/<productName>.app`. Neither
  confirmed consumer matches it, confirmed against both built bundles on
  2026-09-21: `613-mitzvot` packages to
  `dist/613 Mitzvot-darwin-arm64/Mitzvot.app`, where the directory matches and
  the bundle does not, and `editor` packages to
  `dist/mac-arm64/Bobolink Editor.app`, which matches in neither part. Two
  consumers, two layouts, neither the default. Treat the default as a
  convenience for one packager rather than as the shape.
- **The exclusion list may have to be conditional rather than flat.** A real
  application had six ways to quit, three of which are not buttons, and one
  that is harmless many times and fatal once: the shortcut closing an editor
  tab closes the application when no tabs remain. A list of names cannot
  express that. Decide here whether an exclusion is a name or a predicate.
- **`repoRoot` goes, and the staleness guard's three members become one
  optional object.** Settled 2026-09-21, with the second deployment shape as
  the default: it is the only one available for every candidate without
  anyone's permission and it keeps the guard working. `HISTORY.md` has the
  reasoning and `../CLAUDE.md` records all three shapes.

  The field did three jobs in the lifted code and two of them are already
  being removed. It was the base for the default bundle path, which dies the
  moment `bundleDir` is set, and `bundleDir` is now day one for both consumers.
  It was the source-mode launch target, and source mode is not carried over.
  What survives is the guard resolving `packagedInputs` against a checkout,
  which is exactly what C1a says is absent under the third shape.

  So the three guard-only members -- the checkout path, `packagedInputs` and
  `ignoreInput` -- move into one optional object, and the checkout path is
  named for what it points at rather than for a repository root. Absent means
  no sources, which means the guard cannot run and the run says so. That makes
  C1a a property of the type rather than a rule in prose, and it makes a
  half-configured guard unrepresentable. Neither confirmed consumer has an
  adapter yet, so this costs no migration.

**`launch.ts` needs a second way in, and it is a fallback rather than the
default.** `HISTORY.md` records that one build in four refuses Playwright's own
Electron launch outright, because the fuses its attach path depends on are
disabled; it records the measured workaround, a debugging port polled until it
answers and attached to over CDP; and it records the four refinements that
make that survive parallel workers, each of which exists because something
went wrong. It also records what that path cannot reach, which is the main
process. Under it `external.ts`, `menu.ts`, keeping windows off the screen and
the main-process half of "still responding" are all unavailable. So the launch
layer states which path it took, and the report names what was consequently
not checked, through the same mechanism R19 uses for a narrowed check rather
than a second one beside it, which is C1b. Decide here whether the fallback
lands in this phase or waits for the first consumer that needs it; if it
lands here, the testbed application in phase 2 needs a second variant with
the fuses disabled, so the path can be verified in this repository rather
than against somebody else's build.

**Measured 2026-09-22: the `external.ts` stub cannot be installed before the
application's main script runs, by the obvious route.** The lifted code
installs it after Playwright's launch resolves, which is after the application
has already wired up its own handlers. Installing earlier would close the
hazard below at its source rather than netting it, because a handler that
captured the function rather than the object would capture the recorder.

`NODE_OPTIONS=--require` was the candidate, and it does not reach a packaged
Electron main process. A preload that runs under plain `node` did not run under
a packaged build launched with the same variable, while the application itself
launched normally. The control is what makes that readable rather than a clean
zero: the same preload and the same variable under plain `node`, and it ran.

**That rules out one route against one build, not every route.** So the net is
what remains, and it is the three items already scheduled rather than anything
further. `HISTORY.md` records the measurement so nobody re-runs it expecting a
different answer.

Boundary: bookkeeping. The typecheck passes; nothing can run, because there is
nothing to launch.

### Phase 2: the testbed application, unbroken

A small Electron application under `testbed/`, packaged anywhere its adapter
points `bundleDir` at, since phase 1 removed the default layout and made that
field required. An adapter sits beside it in the consumer layout; `journeys/`
and `journey.spec.ts` join it in phase 3, when there is a Journey to register.
No planted defects yet.

Its jobs at this point: give the launch layer something to launch, give the
engine's own tests something to run against, and be the first consumer of the
package through a `file:` dependency, which is the shape a sibling repository
gets in phase 9.

Keep it small but not trivial. Its surface is chosen against the five detection
paths in `PRODUCT_REQUIREMENTS.md`, because each is where a defect gets
planted later: a few named controls, a list with a count above it, a search box
with a clear, a view to navigate away from and back, a menu with Quit, an
outbound link, and a displayed value derived from a data file the application
ships. That last one is what gives the specified oracle in phase 6 a source of
truth to compute its own answer from, and `HISTORY.md` records, of a candidate
that lacks one, that it is the hardest thing to retrofit into an application
later.

**The outbound link earns a positive control here, not just a planted defect
in phase 5.** Hop it deliberately and assert two things: that the recorder
caught the URL, and that no browser process appeared. That proves the
`external.ts` technique against an application other than the one it was
written inside, which is the whole of the hazard below. An absence check needs
a positive control, and until this test exists an empty recorder is
indistinguishable from a stub that never took.

The testbed application has `electron` and `@electron/packager` as its own dev
dependencies. The packager was chosen 2026-09-22 for being the smallest thing
that produces a real bundle: one command, no configuration file, and an
`app.asar` by default, which the guard requires because it reads the archive
and does not understand unpacked builds. Layout no longer constrains the
choice, since phase 1 made `bundleDir` required and the adapter simply points
at whatever comes out.

Boundary: **real.** This is the first time anything runs end to end. It
launches a packaged build (C1), refuses a stale one (R23), waits for ready and
reports what is missing when it is not (R24), and stays off the screen (C5).
Stopping here leaves a working launch layer as a package, which is what the
kit was in its origin and is now consumable.

### Phase 3: the terms of a Journey, and seeds

`journey.ts` holds what defines a Journey under R1: seed, routes, Trip length,
and the optional Journey and Route deadlines. `random.ts` holds a small
seedable generator and the per-Route derivation
`routeSeed = hash(journeySeed, routeNumber)`, split into a Fix stream and a Trip
stream, exactly as `../CLAUDE.md` decides.

**Write the generator in the repository rather than taking a dependency.** It
has to reproduce across machines and Node versions, and a dependency's
algorithm can change under a version bump. That would be the R13 failure,
recorded seeds silently ceasing to reproduce, arriving from outside the code.
Use Node's own hashing for the derivation, which is stable by definition.
`Math.random` never appears in the engine; a mechanical check for it is cheap
and belongs in this phase.

`journey.spec.ts` in `buggy` is the for-loop: one registered test per Route,
from the route count. It reads the Journey seed inside each test body, never
at the file's top level. The seed hazard below says why.

Boundary: bookkeeping, with unit tests worth keeping: the same seed gives the
same sequence; route k's stream is unaffected by whether the routes before it
ran; consuming from the Fix stream leaves the Trip stream unchanged. Pure
functions, no Electron needed. They prove the reproducibility mechanism and
nothing about traveling.

### Phase 4: survey, hop, and the journal

`survey.ts` finds candidates by role: visible, enabled, carrying an accessible
name, with menu items as a second source, which phase 1 accepted on 2026-09-21
along with `menu.ts` being engine at all. The exclusion
list is applied before the draw, so the draw is over what may actually be
hopped to. Candidate order comes from the accessibility tree and is
deterministic; the hazards below say what breaks otherwise.

**The risk that discovery by role finds too little has been measured and
retired, and this phase should not be built as though it were still open.**
`HISTORY.md` has the two censuses and the numbers. What they settled is that
the limit is rendering technique rather than how much behavior sits behind a
surface: roles work on ordinary DOM and fail on canvas-backed and virtualized
ones. So a Route that hops into a code editor's text layer or a terminal
finds one text area and has nowhere further to go, and that is stranded
working correctly rather than a defect in `survey`. What remains genuinely
unmeasured is the opposite failure, which is an application offering more
candidates than a Trip can visit.

A hop chooses a candidate, acts on it, and waits for the page to settle.

**A hop must not wait for navigation to finish, and this was measured rather
than reasoned about.** Clicking the testbed application's outbound link with
an ordinary Playwright click hangs for the full thirty-second timeout. The
link schedules a navigation, the main process cancels it in `will-navigate`,
and from the renderer's side that navigation never resolves, so the click
waits forever for something that was already prevented. Every application that
routes external links this way behaves identically, which is all three that
have been read.

The cost if this is missed: one hop consumes a Route's entire time budget and
the Route reports a timeout rather than whatever it had found. The exclusion
list is what should keep a Route off an outbound link in the first place, so
this fires on the ones a list missed, which is exactly the case nobody tests
for.

**Phase 4 measured this to be larger than the paragraph above, and bounding the
click alone does not fix it.** Every locator call waits for a pending
navigation, so the blocking outlives the hop that caused it: snapshots were
still blocked 8.8 seconds after an abandoned click, with `page.evaluate` still
answering in 7ms. A Route that reaches an outbound link is poisoned for every
hop after it. `HISTORY.md` has the measurement and what the engine does about
it.

**Settling was decided in this phase, by measurement, and what shipped is the
first candidate below:** read the accessibility tree twice with a frame
between, and stop when two consecutive reads agree. `HISTORY.md` has the
numbers, including what it costs per Hop. The reasoning that chose it is left
standing below, because it is what a later change to the strategy has to
answer to. **Changed on 2026-09-24:** two reads a frame apart were measured
calling a still-changing IDE console settled, so the wait now requires the
tree to stay unchanged for a quiet window, 400 ms by default. `HISTORY.md` has
that measurement too.

**Settling is the second difficulty of the project, after `survey`, and the
engine cannot delegate it.** The obvious design is for the adapter to supply a
signal meaning the application has stopped moving. `HISTORY.md` records why
that cannot be *required*: in the most favorable real case available -- an
application that already shipped an automation bridge, with someone who knew
exactly what signal was wanted and wrote down why -- it was still never built.
So the engine needs a strategy that works with no cooperation at all, and an
adapter-supplied signal is an optimization where one happens to exist.

Harder for an explorer than for a scripted test, not easier. A test waits for
the one thing it is about to touch. A Route does not know what it is about to
touch until it has surveyed, so whatever it waits for after a hop is generic
by necessity. Candidates worth measuring rather than assuming: the survey
result unchanged across two consecutive reads, no animations in flight, and a
bounded round trip returning. Record what the chosen one costs, because it
runs after every hop and multiplies by the Trip length.

**What mature suites do instead is worth knowing, even though the engine
cannot require it.** Neither application examined has a global settle signal.
Both express readiness per component, against something the product already
renders: a console's prompt character, a data grid's idle badge, a pane's
progress indicator, a busy attribute on a group. An adapter can name those
where they exist, and they make excellent checks. They are an optimization on
top of the generic strategy, never a replacement for it, because an explorer
arriving somewhere unexpected has no idea which component it is in.

**Choosing is a named seam rather than a line in the loop**, taking the
candidate list and a source of randomness and returning one candidate; the only
implementation here draws an index from the Trip stream. `../CLAUDE.md`
says why the seam exists and `OUTSTANDING.md` says what is expected to use it
later. Generating a value to type is a second seam, separate from choosing
which control to act on. `route.ts` exports `runRoute()`, which runs one Route:
the Fix from the fix stream, then hops until the Trip is complete, the survey
comes back empty (stranded, R5, naming the hop), or, from phase 5, a check
fails.

`journal.ts` lands here rather than with the checks, because a route that
leaves no trace can only be observed by watching a visible window, and a phase
whose output is a person watching is a phase nobody can verify. It writes one
file per Route, one entry per hop, appended and flushed at each hop before the
next hop starts: the hop's position, what was chosen, and what could have been
chosen (R9, R10). The field for check results is written empty until phase 5
fills it.

**It is written independently of Playwright's attachments and trace**, which
are produced at test end and are therefore absent in exactly the endings R9
lists.

Boundary: bookkeeping, but not unobservable. A route over `buggy` leaves a
readable journal on disk, and the journals of two runs from the same seed can
be compared file to file. That is the first evidence that seeding and
traveling work together, and it is what R13 is later built on. What is still
missing is any notion of something being wrong.

### Before phase 5: work the demos found

Phase 4 ended, and running the engine against real applications for a demo
found gaps that phase 5 would otherwise have built on top of. Decided on
2026-09-23 that these come first and that phase 5 starts only once they are
done. As of 2026-09-24 all of it is done: a review of what the two IDEs need,
then the clipboard, journals and settle fixes, R31 and the keyboard, in the
order that review settled, and last a `phileas` command for a Journey's
settings on the command line, added the same day because phase 5 runs Journeys
many times over. Added after it the same day, and done: `phileas survey` and
Fix steps that name a control as the engine prints it, because writing a Fix
meant reading the application's code to find what the engine already finds.
`HISTORY.md` records each. Phase 5 is next.

### Before the rest of phase 5: a measured trial on Positron

**Decided 2026-09-26, in the words it was put:** "Instead of all of phase 5 at
once, we'll do the above." The above was the list below, proposed as what it
would take to see whether Phileas is effective on Positron. It came from two
studies of real bug reports, `research/rstudio-effectiveness.md` and
`research/positron-effectiveness.md`, which found about five bugs in a
hundred within reach on either IDE, and could not count the bugs nobody
reported. A run is the measurement those studies could not make.

The rest of phase 5 waits until the trial has an answer. Phase 5's own text
below is unchanged, and what the trial builds is the first part of it.

1. **Part of phase 5's checks:** uncaught error in the renderer and the main
   process, console error, still responding, window gone blank, and
   unexpected dialog, each written into the journal. **Each ships with a
   planted defect in `buggy` that makes it fire**, as phase 5 already
   requires. Narrowing for the console-error check is built here, since
   Positron writes to the console in normal operation. Named controls and the
   foreign-process check wait.

   **Decided 2026-09-26, before building it, each from a proposal made with
   the question:**
   - **The log check is included**, since step 2 names a log for it. It sits
     in the universal tier and does nothing unless the adapter names a log.
   - **A check that could not run says so on every Hop.** Each Hop's journal
     line carries every check's result as passed, failed, or not run with the
     reason, so an absent check is never read as a passing one. This settles
     what a report says about the foreign-process check off macOS too.
   - **Each planted defect is switched on by its own launch flag,** the way
     `--buggy-fail-items` already is, so `buggy` stays the unbroken baseline
     and no recorded seed moves.
   - **A test reaches its planted control through the choosing seam:** it
     hands `runRoute` a chooser that picks that control. The alternatives
     were a Trip long enough to get there, or a seed recorded as reaching it,
     and both fail whenever the draw shifts, for reasons that say nothing about
     the check. Phase 8 keeps the seeded measure, one Journey finding every
     defect.
2. **A Positron adapter against the installed application.** Its own profile
   and its own extensions folder, both on short paths, since Positron fails to
   start when its profile's path pushes a socket past 103 characters.
   Telemetry, update checks, the welcome page and the workspace trust prompt
   turned off before launch. R and Python installed on the machine running
   it. Quit, sign-in and outbound links excluded. The extension host log named
   for the log check. The staleness guard cannot run, since there are no
   sources.
3. **Three rules written for Positron**, from what the study found within
   reach: Positron's error notification never appears, narrowed for the ones
   that are expected; the Variables pane lists exactly the running sessions;
   a data explorer whose session ended says so.
4. **Journeys with different Fixes:** none, a notebook open, the data explorer
   showing a dataset, and a Quarto document open.
5. **Known bugs in old releases, as positive controls.** Three bugs from the
   study, each run against a release that still has it: 5460, a notebook
   kernel restart that times out, on 2024.11.0-140; 6029, stale sessions in
   the Variables pane, on 2025.01.0-159; 6480, a data explorer that does not
   show its session ended, on 2025.02.0-171. Each release's macOS build is
   attached to its GitHub release. **Confirm by hand that each bug reproduces
   in its release before the run**: a bug that is not there makes a miss mean
   nothing. The two bugs the universal checks would find, 7776 and 7098, were
   the first choice and cannot be used: both were fixed during the pre-releases
   of March to June 2025, whose macOS builds exist only on Positron's download
   server under `dailies/`, and every one checked on 2026-09-26 returned 403.
   Releases up to 2025.02 carry their builds on GitHub, and official releases
   from 2025.07.0 on still download, checked the same day. Building one from
   source is the way back to them.
6. **The current release, for 500 Routes**, every finding triaged as a new
   real bug, a known one, or a false alarm.

**The bar, set before the run and agreed 2026-09-26:** the trial finds at
least 2 of the 3 known bugs, and at least one new real bug in the current
release, with false alarms few enough to triage in minutes rather than hours.
Missing it is an answer too, and is recorded as one. The bar was agreed
while the known bugs were still 7776, 7098 and 5460, and confirmed on
2026-09-26 for the three above: "2 of 3 is correct."

### Phase 5: the universal tier, and the Route as a test

The journal already exists from phase 4; this phase fills in its check-results
field and nothing else about it changes.

**The checks run after every Fix hop as well as every Trip hop**, decided
2026-09-23. Skipping them would save almost nothing, since a Fix is usually a
handful of steps against a Trip of tens, and it would leave a Fix that breaks
the application to be noticed by whichever Trip hop happens to hit it first. And
**a check that fails after a Fix hop is reported as a Fix failure**, not as a
failed Route, for R11's reason: ten Routes failing on one broken step is one
problem, and the Fix hop's own line is where it belongs.

`oracles/implicit/` is R17, one check per item, each with its evidence:

- Uncaught error and console error: the listeners the lifted `launch.ts`
  already attaches, read and drained after every hop instead of at test end.
  **Read what it actually attaches before assuming this one is free.** It
  collects renderer page errors and renderer console errors, and separately
  it collects the main process's standard error stream, which nothing acts
  on. R17 says "no uncaught error" without qualifying which process, and the
  first of the three real bugs in `HISTORY.md` is an uncaught exception in
  the main process raised while quitting. So this phase decides what in that
  stream counts as an uncaught error, and the check is not finished while it
  watches the renderer alone. The lifted `failOnPageError` named the renderer
  in its own field name, which is part of why the gap was easy to miss; phase
  1 replaced it with R19's narrowing, which is neutral about which process
  raised the error.
- Still responding: a bounded round trip to the renderer and one to the main
  process. A hang is a failure of the route after a stated wait, never a run
  that hangs.
- Window still showing content: needs a definition, and the definition is a
  hazard below.
- No navigation away: the page's URL is still the application's, and
  `external.ts` recorded nothing. **That second half needs evidence of its
  own, and this is where it gets it.** The recorder is both the mechanism that
  stops a browser opening and the only proof that none did, so one silent
  failure takes out the prevention and the detection together. Add a second
  source that does not depend on the stub having worked: no foreign
  application process appeared since the last hop, read through the
  stray-process member phase 1 adds to the interface. It runs after every hop,
  so measure what it costs before adopting it, and expect it to be
  macOS-shaped work first. Do not delete it later as redundant with the
  recorder; the hazards below say why it is not. The hop loop already ends a
  Route with `PageUnreachable` when a prevented navigation leaves the page
  unable to answer; that ending belongs here, as this check's finding rather
  than an error thrown from the hop loop.
- No unexpected dialog: renderer dialogs through Playwright's dialog event.
  Native main-process dialogs are a hazard below.
- A readable name on every visible control: this comes from the survey itself.
  An element with a role and no name is reported by the survey that found it
  and could not hop to it. **Expect this one to need narrowing on a real
  application on its first day.** The census in `HISTORY.md` found 80 of 84
  elements named on one application's resting screen, and a Route ends at the
  first violation, so if any of those four is a visible control every Route
  there ends at hop one. Whether they are has not been checked and is worth
  checking before pointing a Journey at that application rather than after.

**A log that grew an error is the seventh check, and which tier it belongs to
is decided in this phase.** It is what the interface's log-location member,
added in phase 1, exists to feed: an adapter names where the application
writes its logs and the check reads what was appended since the last hop.
`HISTORY.md` records the bug that makes it necessary, which showed nothing on
screen, raised no dialog, wrote nothing to the browser console, and left a
client exception in the session log. Nothing else here would have caught it.
What is undecided is where it sits, because it does not fit the tier it is
most useful in: the universal tier assumes nothing about the application, and
this check does nothing at all unless an adapter names a log. Decide whether
it is a universal check that is inert by default, or a tier of its own. An
adapter that names no log gets no check either way, and the report says so
rather than leaving its absence to be inferred from silence.

**Every check in this tier has to be tested against a broken application, not
just a working one.** The rule comes from a team that learned it on a real
suite: pick the signal by asking what a broken build does. A check that reads
the same on a healthy and a broken application is worse than no check, because
a Route that ends at the first violation will never end. Each of the checks
above needs a planted defect that makes it fire, which is what phase 5's
planting step is for, and any that cannot be made to fire does not ship.

The runner executes the whole set after every hop (R15) and ends the Route on
the first violation (R16). R19 narrowing is declared in the adapter and the
report says what was narrowed.

`fixtures.ts` is reshaped here: the Route is the test; the Fix runs in
`beforeEach` and a failure there carries its own error class and annotation so
the report keeps it apart (R11); each hop is a `test.step`; the Journey
deadline is Playwright's global timeout (R4); retries are zero, for the reason
in the hazards.

**Reset per Route is decided here, and the plan's default is a relaunch.** The
lifted reset is a renderer reload, and main-process state survives a reload.
A Route starting with main-process state left by the previous Route is exactly
the inherited state R3 forbids, and a leak there would be reported against the
wrong Route. The lifted code already has the fixture that launches a process
per test; that becomes the Route's default. The lifted comments record reuse
as saving roughly half a second per test; `../CLAUDE.md` has already ruled on
that trade for the Fix, and the same reasoning applies. Reload stays available
as an optimization to measure, for an application that can show a reload
reaches its initial state.

Stranded needs a third outcome, and Playwright has pass, fail and skip. The
encoding is undecided and is decided in this phase. The constraint is R5 and
R6: stranded never reads as a pass and is never counted among the failures.

Plant the first defects in `buggy`, one per check: a control that throws, a
control that logs an error, a control that blanks the window, a control that
leaves the application, a control with no name, a control that fails silently
on screen and writes the error only to the log, and a dialog with no way out,
which strands. Add the tests asserting a Journey finds each.

**This is the largest phase, and it ends at a real point, so there is no safe
place to stop inside it.** Take the parts in the order given: the checks, then
the fixtures reshape, then the reset decision, then the stranded encoding, then
the planted defects. Each earlier part is verifiable on its own even though the
boundary is not reached until the last, and a slip is then a slip with
something working rather than nothing.

Boundary: **real.** A Journey with a small budget travels through `buggy` and
reports, which is the last step of the wiring flow in
`PRODUCT_REQUIREMENTS.md`. R1 through R11, R15 through R17, and R22 through
R24 can each be held up and answered. Two of those are answered by Playwright
rather than by anything built here: R6 and R7 hold at this boundary only
because each Route is a test carrying its own outcome and its seed as an
annotation, which is enough to tell stranded from failed and to name the seed
that reproduces a failure. The summary that states them deliberately, across a
whole Journey, is phase 7's, and phase 7 is where they stop depending on how a
test runner happens to print things. A reader who stops here has an
exploratory tester that finds the R17 class and strands on traps: the product
with its shallowest tier only.

### Between phases 5 and 6: recording a Fix

Raised 2026-09-25 and asked to be considered high priority. Writing a Fix
today alternates `phileas survey` with editing the journey file, one step per
round, and the person writing it never sees the application, so every step
depends on already knowing a control's name. That is slow, and blind.

**Placed here on 2026-09-25, chosen from three places offered:** before phase
5, right after it, or before phase 9. Right after it, because phase 5 has no
safe place to stop inside it and had only just been cleared to start, and
because a recorder can then use phase 5's naming check to say when a click
landed on a control with no name. The investigation waits too: "investigate
after phase 5 is done."

**Investigate three options first, then build one:**

- **A `phileas record` command.** It launches the application with its window
  shown and the person uses it. After each click or typed entry it surveys,
  matches what was acted on to a candidate, and prints that candidate's line;
  on stopping it writes the Fix as ordinary `hop()` lines, so replay is
  unchanged. A click on a control with no accessible name cannot become a
  line, and it says so.
- **An interactive survey.** It shows the window, numbers the controls, takes
  a number, hops there and lists again, and prints the whole Fix at the end.
  Cheaper, but the person still picks from a list rather than clicking.
- **Playwright's own recorder.** It writes Playwright code, not the engine's
  control names, and whether it works against Electron is unchecked.

**Whatever is built has to meet `OUTSTANDING.md` 2.7 first.** A recorder
that clicks the second of two controls sharing a name writes a line that
replays onto the first.

Boundary: bookkeeping. It adds a way of writing a Fix and changes nothing a
Route does.

### Phase 6: app-declared checks

`structural.ts` (R18) is a predicate over the page, declared by the adapter and
run after every hop like the universal tier.

`metamorphic.ts` (R20) is not a per-hop invariant, and treating it as one is
the easy mistake. A relation compares two states, so the engine has to take
moves of its own: when a hop has just performed the operation a relation names,
the engine performs the counterpart, compares, and records those hops in the
journal marked as probe hops. Whether probe hops count toward the Trip length
is undecided and is decided here.

`specified.ts` (R21) takes an expected value the adapter computed from a
source of truth and compares it to the screen. `../CLAUDE.md` records the
trap: a specified oracle must not share logic with what it judges. Make that
mechanical in this phase with a check that the adapter's oracle module imports
nothing from the application's source. Prose alone will not hold it.

**Be honest in the document and in the check's own message about what that
check does not cover.** It catches sharing by import, which is the easy and
common case. An oracle that reimplements the same algorithm by hand, or that
was written by copying it, passes the check and breaks the rule, and it fails
in the way that matters: both sides carry the same mistake, they agree, and the
test passes while the screen lies. A check reported as enforcing the rule, when
it enforces the reachable half of it, is worse than no check, because it stops
anyone looking. The remaining half is caught by review, or not at all.

Plant one defect per path: a count that disagrees with its rows (R18), a clear
that does not clear (R20), and a value that is wrong the same way every time,
which only the oracle catches (R21).

Boundary: bookkeeping. Each tier is verified by its planted defect as it
lands, but nothing new about the assembled engine is shown until phase 8.

### Phase 7: reporting, replay, and fitting in

`report/` builds the Journey summary from the journals on disk, not from
in-memory state: routes run, passed, failed and stranded (apart), hops traveled,
checks run and which were narrowed, and the seed. The nothing-found case
reports what it traveled through, so a green result can be told from a run
that did nothing. Every failure names its route and seed (R7), and the summary
is enough to reproduce from (R12).

**The report also renders a single Route for a person to read (R30)**, from
its journal alone, including one cut off mid-write. It is the same renderer
pointed at one Route rather than a second one: the journal stays a format made
for the engine and for replay, and reading it is this phase's job rather than
the format's. Decided 2026-09-23, over building a reader earlier. If reading
journals during phases 5 and 6 turns out to hurt, this piece moves forward as
the first part of `report/` rather than being built twice. **It moved forward on
2026-09-24**, before phase 5, as `src/report/render.mjs`, behind `phileas run
--follow` and `phileas show`; the Journey summary here builds on it.

**R27 lands here too, and it asks for more than the nothing-found case.** A
run where the application never launched, where every Route stranded at its
first hop, or where zero Routes ran at all is reported as degraded rather than
green, and a Journey setting turns degraded into failed, for the scheduled
runs where an absence of findings is meant to mean something. The stranding
case is the one to watch: each Route individually reports stranded, which is
an honest outcome and not a failure, and only the summary can see that every
Route did it at hop one.

R13 gets its design from R10: replay a reported seed and compare each hop's
survey against the recorded one. The first divergence is where the seed
stopped reproducing, and the report says so instead of passing. The same
comparison answers R14, which is why that requirement costs nothing extra
here: where the recorded candidates differ from what is available now, the
application changed, and where they match and only the outcome differs, the
outcome did.

Journeys become their own Playwright project in the consumer's configuration.
That puts their results in the same run as the scripted suite (R25) and makes
the project selectable on its own for on-demand and scheduled runs (R26, R28).
R26 is a convention on the consumer's side; the plan's part is making the
journey project trivial to leave out of any push gate.

Boundary: bookkeeping.

### Phase 8: every planted defect found by one Journey

One Journey over the testbed application, with a budget it can find them in,
and a test asserting that each planted defect is found. Then the triage flow
from `PRODUCT_REQUIREMENTS.md`, done cold: a second session reproduces a
finding from the report alone.

Boundary: **real, and the only one that shows the engine does its job.** The
engine's own tests up to here show that its parts behave as written. This is
the success measure, and `../ORIENTATION.md` says why nothing short of it
counts.

### Phase 9: wiring a sibling repository

A `file:` dependency, an adapter, journeys, a spec and a project entry in that
repository's Playwright configuration, following `buggy`'s consumer layout
exactly. This phase repeats a shape phase 2 already proved.

The repository is the confirmed consumer that already has an interface to
travel through; the second follows once its own migration gives it one.
`HISTORY.md` names both, and records the deployment shape settled for them.
Nothing about consumers is open by the time this phase runs: the interface was
hardened in phase 1, which is where that question did its real work.

After the two confirmed consumers come Positron and RStudio. They are targets
rather than candidates, and `OUTSTANDING.md` 1.8 records what each will need.
At their turn, revisit the provisional draw shares for the keys and the menu,
`OUTSTANDING.md` 1.11, once a Journey has run against either.

What the first real adapter discovers about the seam goes back into
`AppUnderTest`. `HISTORY.md` records that the second adapter is what finds
where the seam's shape is wrong, so expect this phase to produce interface
changes rather than only configuration.

Boundary: bookkeeping for this repository. The consumer's first Journey is a
real point, and it belongs to that repository.

### Phase 10: an optional map

A map, full or partial, that someone who knows the application can hand the
engine (R29). **Never required**: an application with no map is explored exactly as
before, and that stays the ordinary case. Recorded as declined until
2026-09-23, on reasoning that held only for a map that was required.

**It comes last on purpose, and both reasons are about evidence.** Phase 8 has
to show that discovery alone finds every planted defect; a map present by then
would blur whether discovery or the map found them. Phase 9 points the engine
at a real application for the first time, and the places discovery actually
fails there -- a canvas surface, a virtualized list, a keyboard shortcut -- are
what should decide what a map entry does, rather than a guess made now.

The design questions are open and are in `OUTSTANDING.md`: what an entry does,
what happens to one that is stale, where a map comes from, and how a journal
marks what a map supplied so that replay can tell a map edit from an
application change. Whatever builds a map runs before the Journey; the engine
still reads no source at run time.

Boundary: bookkeeping, until the design is settled.

## Hazards known in advance

None of these is caught by the compiler. Each is listed with what it breaks
and what the plan does about it.

**A seed generated where the spec file is loaded.** Playwright's workers are
separate OS processes with no channel between them, so a spec file's top-level
code runs once per worker. A seed produced there is a different seed in every
worker, and every Route reports a seed that reproduces nothing, while every
Route passes. Checked against Playwright's documentation on 2026-09-21: global
setup runs once, and values it sets as environment variables are available
inside `test()` only, not at the file's top level. So the seed is chosen or
generated once in global setup, written to disk before any Route runs, and
read inside each Route's body. The top-level loop needs only the route count.

**A survey that is not deterministic.** R8 rests on the candidate list being
identical hop for hop. Order must come from the accessibility tree, never from
object identity or the iteration order of a map. The survey must be taken from
a settled page, and Electron offers no network-idle signal to lean on; an
animation mid-flight changes what is visible. The mechanism is undecided and
phase 4 says what is known about choosing one: it has to work without the
application's help. Any drift here shows as R13 firing on a replay against an
application with no bug, which is how it will be noticed.

**A virtualized list under-counts silently.** A windowed list renders only
the rows currently visible, positioned by a transform, with the true position
in a data attribute rather than in the document order. A survey enumerating
candidates sees twelve of forty and reports no error at all. The Route then
believes it explored a list it barely touched, and the journal faithfully
records the twelve it could see. This is worse than a dead end, because a dead
end is visible and this is not. Any survey needs to know whether a container
is windowed, and there is no general way to ask.

**A dismissed widget can stay in the DOM and still take input.** In one real
application a closed picker is hidden rather than removed, so an unfiltered
query returns the stale one, and a keypress aimed at it lands in the console
and is executed as code. For a scripted test that is a wrong assertion. For a
Route choosing its own moves it is an arbitrary command run against the
application under test. Filtering candidates on visibility is what prevents
it, which is already required, but the consequence of getting it wrong is
worth stating.

**Attachments and traces are not the journal.** Playwright writes both at test
end. A run killed mid-route writes neither. The journal is its own file,
appended and flushed per hop.

**Retries.** They must be zero. A seeded Route that fails and then passes on
retry has found nondeterminism, which is a finding. Retries turn it into
"flaky" and bury it.

**A reload is not a relaunch.** Main-process state survives a renderer reload.
Phase 5 says what the plan does.

**Native dialogs.** Playwright's dialog event covers dialogs the renderer
raises. Electron's main-process dialogs block the main process, and to the
engine they look like a hang: the check that fires says "stopped responding"
when the truth is "a dialog is open". Stubbing the dialog module the way
`external.ts` stubs `shell.openExternal` is the likely answer and is not
decided.

**What "blank" means.** A window with no visible text and no drawn boxes is
one definition, and a legitimately empty state sets it off. Define it narrowly,
tune it against `buggy` and then against the first real consumer rather than
against imagined cases, and remember this is one of the checks R19 exists for.

**The Route deadline.** Playwright's default per-test timeout is thirty
seconds. A Route with a Trip length of forty against a slow application will
exceed it and be reported as a timeout rather than as whatever it found. The
Route deadline is whatever the Journey states, or no limit when it states none,
and reaches Playwright through `playwrightTimeouts`, never as the default.
Deriving it from the Trip length was tried and dropped on 2026-09-23: how long
a Hop takes depends on the application, and the formula guessed.

**Editing a Fix or the exclusion list changes recorded routes.** Both are inputs
to the draw. The seed split keeps a Fix edit from touching the Trip stream,
but an exclusion-list edit changes what the Trip draws over. The
journal's record of what could have been chosen is what lets R13 say a seed
stopped reproducing rather than letting it pass.

**The planner growing back.** `../CLAUDE.md` says what it is and what it must
not become. The check is simple: `journey.spec.ts` derives seeds and registers
tests, and anything else in it is the planner returning.

**The bundle layer has one platform's shape.** Phase 1 removed the default
layout, so `bundleDir` now says where the bundle is, but what is inside it is
still assumed to be a macOS application: the executable is read from
`Contents/MacOS` and the archive from `Contents/Resources/app.asar`. A Linux
or Windows runner needs different structure entirely, plus a display server,
and running unattended there is unverified.
Windows are kept off the screen by replacing the window's `show` method in the
main process, which the lifted comment calls a real intrusion into the
application under test; it is measured there that Electron accepts a headless
flag and ignores it. The visible-window switch stays for debugging.

**The fallback launch path reaches the renderer and not the main process.**
Everything the engine does in the main process is absent under it, and absent
without saying so: the external-link stub records nothing, the menu source
offers nothing, windows cannot be kept off the screen, and the main-process
half of "still responding" cannot run. Every one of those reads as a check
that found nothing wrong. `HISTORY.md` records what is lost and phase 1 says
what the launch layer and the report have to state about it.

**The external-link stub can install successfully and do nothing.** It
replaces `shell.openExternal` on the object Electron exports. That reaches the
application only because the application looks the function up on that object
at click time, which is what `trickster-tales` does: `main.js:1` destructures
`shell` out of the module, and `main.js:110` calls `shell.openExternal(url)`
inside the helper both its link handlers go through. Had that helper captured
the function instead -- `const { openExternal } = shell` at startup, then
`openExternal(url)` -- the assignment would still succeed, the handler would
still call Electron's real one, and a browser would open on the machine
running the Journey. The recorder stays empty, so "no navigation away" reports
clean: not because nothing navigated, but because the evidence went somewhere
else. On an unattended run that breaks C5 silently, with every route green and
a browser window per hop left on the machine.

Measured on 2026-09-21: `trickster-tales:110`, `613-mitzvot/main.js:39` and
`editor/src/main/index.ts:55` all write `shell.openExternal(url)`, so three
applications out of three are unaffected today. The hazard is not that the
technique is broken. It is that `external.ts` justifies itself by reading one
`main.js`, and lifting the file into a framework carries that justification to
applications nobody has read. Four items were scheduled against it: the
derived exclusion list and the install-timing measurement in phase 1, the
positive control in phase 2, and the independent evidence in phase 5. Only the
last of those closes it, decided 2026-09-22 and recorded in `DEFECTS.md`. The
other three are each worth doing and each leave the hazard standing.

**Source mode bypassed the staleness guard, and was removed in phase 1 rather
than kept.** The lifted launch could run the working tree instead of the
packaged build, for an inner loop where repackaging was too slow. The guard
does not apply to it, so a green run in that mode said nothing about what
ships, which is what C1 exists to prevent. Kept here because the reason is what
stops it being reintroduced the first time repackaging feels slow: the saving
is real, and it buys a run whose result cannot be trusted.

**The oracle sharing logic with what it judges.** `../CLAUDE.md` records the
failure. Phase 6 makes it mechanical.

## Verification

What each layer of verification proves, from weakest to strongest:

- `npm run typecheck` proves types. With `noUncheckedIndexedAccess` on, it also
  proves the empty-survey case is handled; `HISTORY.md` records why that flag
  is not tidiness.
- Unit tests for `random.ts` and `journey.ts` prove the reproducibility
  mechanism: same seed, same sequence, routes independent, streams separate.
- The engine's own tests against the testbed application prove that the parts
  behave as written: launch, refuse a stale build, travel, record, stop on a
  violation, strand.
- The planted defects prove that the engine finds bugs. **This is the only
  layer that says anything about the product**, and it is the reason phases 2,
  5 and 8 are the real points. A green Journey against an application with no
  planted defects is not evidence of anything.

What cannot be verified by any of the above: the ceiling on relationship
checks. A result that is wrong the same way every time passes every one of
them. `PRODUCT_REQUIREMENTS.md` states it as a non-goal, `HISTORY.md` records
the concession, and the oracle is the remedy, not more tests.

Definitions that depend on real behavior, such as what counts as blank and
what counts as settled, are tuned against the testbed application and then
against the first real consumer, never against imagined cases. The testbed
application is the real data until a consumer exists.

On the machine this is developed on, the launch layer keeps windows off the
screen, and screenshots go through the compositor over the debugging protocol,
so verification needs no screen access and asks for none. Set the
visible-window switch to watch a run when working out why something fails.

## Deliberately not carried over

From the lifted kit, all four settled in phase 1, with the reason each stays
behind:

- **Process reuse across tests as the default.** The kit launched once per
  worker and reset by reload. R3 outranks the half second it saved, and a
  reload leaves main-process state untouched. `resetApp` became
  `reloadRenderer` and is explicitly not the per-Route reset; it stays for the
  application that can show a reload reaches its initial state.
- **The per-application flag for uncaught renderer exceptions.** Replaced by
  R19's general narrowing, so one check has no private switch the report does
  not know about.
- **End-of-test attachments as the record.** Kept as attachments on failure,
  which are useful; not kept as the journal, which they cannot be.
- **Source mode, entirely.** Not narrowed to an inner loop, removed. A Journey
  runs against the packaged build (C1), and the hazard above says why the
  saving is not worth what it costs.

From earlier design records, each already recorded where it belongs and named
here only so nobody reintroduces it through this document:

- The Journey as the Playwright test. `../CLAUDE.md` has the correction.
- Planner-assigned route bias. Declined, in `OUTSTANDING.md`; the measurement
  is in `HISTORY.md`.
- The 60-30-10 ratio as a scheduler input. `../CLAUDE.md`.
- Writing `AppUnderTest` from scratch. `HISTORY.md` records the correction.
- `kit` and `app` as directory names. Declined, in `OUTSTANDING.md`.
