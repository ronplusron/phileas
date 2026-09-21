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

Written 2026-09-21. **Nothing is built and no dependency is installed.**
Everything below is work that has not started, and nothing in it is a report
that something works. `../ORIENTATION.md` is the current state and is the file
to check rather than this one.

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
- `examples/`, an application with planted bugs, is the only checkpoint that
  shows the assembled engine does its job. `OUTSTANDING.md` says why it is not
  a late nicety.

The scaffold that exists: `package.json` naming the package
`@drugstoresushi/phileas`, with `main` and `exports` pointing at
`src/index.ts`; a strict `tsconfig.json` that includes `src/`, `tests/` and
`examples/`; and empty directories.

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
  invariants/
    index.ts           the runner: whole set after every Hop, first violation ends the Route
    universal/         the tier that assumes nothing about the application (R16)
    structural.ts      the shape of an app-declared same-moment check (R17)
    metamorphic.ts     the shape of a relation between two states (R19)
    oracle.ts          the shape of an independently computed answer (R20)
  report/              the Journey summary, with stranded kept apart from failed
tests/                 the engine's own tests
examples/<app>/        a small Electron application, packaged, with planted defects
examples/<app>/phileas/  adapter/, journeys/, journey.spec.ts: the consumer layout
```

Each file is named after its principal export, which is why the set mixes
verbs and nouns: `launch.ts` exports `launch()`, `survey.ts` exports
`survey()`, and `route.ts` exports `runRoute()` alongside the Route's own
shape. The example application has no name yet.

## Build order

Ten phases, numbered from zero. **Three phase boundaries are real verification
points; the other seven are bookkeeping.** The real ones close phases 2, 5 and
8. A bookkeeping boundary is where one piece of work ends and the next begins;
stopping there leaves nothing new that can be shown to work. A real point is
one where a claim about the product can be demonstrated, so a reader who has
to stop can stop with something.

Why this order: every later phase needs something to verify with (phase 0) and
something to launch (phase 2). Seeds come before traversal because the seed
split is what `../CLAUDE.md` warns is painful to retrofit. The journal lands
with the first route rather than after it, because R9 is about the record
surviving what the first route will do to the application. App-declared checks
come after the universal tier because they need a traveling engine to hang off.
Each planted defect is planted in the phase where its detection path lands,
and the assembled measure, every defect found by one Journey, is the last real
point.

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

Checked against Playwright's documentation on 2026-09-21. It states that
Electron launches an Electron executable, and that traces can be opened without
the downloaded browsers, including through a hosted viewer. **It nowhere states
outright that the browser install can be skipped**, so treat this as a reasoned
expectation rather than a documented guarantee. The first install settles it in
a minute, and the cost of being wrong is one confusing failure that looks like
a missing browser rather than anything to do with this engine.

Boundary: bookkeeping. A passing typecheck on an empty package proves the
toolchain exists and nothing else. It is still the gate every later phase
depends on.

### Phase 1: lift the kit into `src/`

Move the seven files under `src/` unchanged first, so the diff against their
origin is a rename and every later change is visible as a change. Then three
placements and one hardening pass.

Three of the seven have no recorded home; `OUTSTANDING.md` holds the question.
**These are the plan's positions, with reasons, and the question stays open
there until they are accepted:**

- `external.ts` is engine. It stubs Electron's own `shell.openExternal` in the
  main process and records what would have opened. Nothing in it knows the
  application. It makes an outbound link safe to hop and detectable when
  hopped, which serves R16's "no navigation away" from the main-process side,
  alongside the exclusion list.
- `menu.ts` is engine, and becomes a second candidate source for `survey`. The
  reason is `../CLAUDE.md`'s own example: the exclusion list exists for things
  like Quit, and Quit is a menu item. An exclusion list naming a menu item only
  makes sense if the traversal can reach the menu. Menu items live in the main
  process and never appear in the page's accessibility tree, so `survey` by
  role alone would never see them.
- `fixtures.ts` is engine and is the file that changes shape most. Today it
  launches once per worker and resets before each test. Under the
  Route-is-the-test mapping it becomes the Route fixture: Fix as `beforeEach`,
  the Route's own verdict, trace and timeout. Its existing fixture that gives a
  test a process of its own is the per-Route relaunch path used in phase 5.

**This phase has an unanswered question in front of it, and it is the one that
decides how much the interface has to carry.** `OUTSTANDING.md` records that
two earlier records disagree about which repositories are actually intended as
consumers, one naming three and an earlier one naming five, and says the answer
belongs before this interface is hardened rather than after. One consumer
justifies far less abstraction than five, and the difference lands here, in
`AppUnderTest`, not in the phase that eventually wires a second repository up.

Answering it is cheap. Hardening the interface against a guess is not: the
hardening below is where the guess becomes permanent, and every later phase
builds on it. If the answer is not available when this phase starts, harden for
the consumer that exists, write down that it was a guess, and expect the first
real adapter to find where the shape is wrong.

Hardening `AppUnderTest`:

- Add the exclusion list. R21 names it and `HISTORY.md` records that the
  lifted interface has nothing for it.
- Fold the per-application flag for whether an uncaught renderer exception
  fails the test into R18's general narrowing. A special-case field for one
  check is what R18 generalizes, and keeping both invites them to disagree.
- The staleness guard compares content, not timestamps, and names each file
  that differs, in both directions, which is R22 exactly. R22 was reworded to
  match it: it previously said "older" and "newer", which described a weaker
  timestamp check than the lifted code actually performs. The guard has a skip
  switch for running against a stale build anyway, which the run announces.
  Keep the switch and keep the announcement.
- The readiness hook's contract, that it must throw with the application's own
  message rather than wait for a success marker, is R23 already written down.
  Keep the comment; it is the reason a future implementer would otherwise
  remove.

Boundary: bookkeeping. The typecheck passes; nothing can run, because there is
nothing to launch.

### Phase 2: an example application, unbroken

A small Electron application under `examples/`, packaged into the layout the
lifted `bundle.ts` expects by default (or an adapter setting `bundleDir`), with
an adapter in the consumer layout beside it. No planted defects yet.

Its jobs at this point: give the launch layer something to launch, give the
engine's own tests something to run against, and be the first consumer of the
package through a `file:` dependency, which is the shape a sibling repository
gets in phase 9.

Keep it small but not trivial. Its surface is chosen against the five detection
paths in `PRODUCT_REQUIREMENTS.md`, because each is where a defect gets
planted later: a few named controls, a list with a count above it, a search box
with a clear, a view to navigate away from and back, a menu with Quit, and an
outbound link.

The example needs `electron` and a packager as its own dev dependencies. Which
packager is not decided. The constraints on it: the output must match the
lifted default layout or the adapter must point at it, and it must produce an
`app.asar`, because the lifted guard reads the archive and states that
unpacked builds are not supported.

Boundary: **real.** This is the first time anything runs end to end. It
launches a packaged build (C1), refuses a stale one (R22), waits for ready and
reports what is missing when it is not (R23), and stays off the screen (C5).
Stopping here leaves a working launch layer as a package, which is what the
kit was in its origin and is now consumable.

### Phase 3: the terms of a Journey, and seeds

`journey.ts` holds the four terms of R1: seed, routes, hops per route,
deadline. `random.ts` holds a small seedable generator and the per-Route
derivation `routeSeed = hash(journeySeed, routeIndex)`, split into a Fix stream
and a traversal stream, exactly as `../CLAUDE.md` decides.

**Write the generator in the repository rather than taking a dependency.** It
has to reproduce across machines and Node versions, and a dependency's
algorithm can change under a version bump. That would be the R13 failure,
recorded seeds silently ceasing to reproduce, arriving from outside the code.
Use Node's own hashing for the derivation, which is stable by definition.
`Math.random` never appears in the engine; a mechanical check for it is cheap
and belongs in this phase.

`journey.spec.ts` in the example is the for-loop: one registered test per
Route, from the route count. It reads the Journey seed inside each test body,
never at the file's top level. The seed hazard below says why.

Boundary: bookkeeping, with unit tests worth keeping: the same seed gives the
same sequence; route k's stream is unaffected by whether the routes before it
ran; consuming from the Fix stream leaves the traversal stream unchanged. Pure
functions, no Electron needed. They prove the reproducibility mechanism and
nothing about traveling.

### Phase 4: survey, hop, and the journal

`survey.ts` finds candidates by role: visible, enabled, carrying an accessible
name, with menu items as a second source. The exclusion list is applied before
the draw, so the draw is over what may actually be hopped to. Candidate order
comes from the accessibility tree and is deterministic; the hazards below say
what breaks otherwise.

A hop chooses a candidate, acts on it, and waits for the page to settle.
**Choosing is a named seam rather than a line in the loop**, taking the
candidate list and a source of randomness and returning one candidate; the only
implementation here draws an index from the traversal stream. `../CLAUDE.md`
says why the seam exists and `OUTSTANDING.md` says what is expected to use it
later. Generating a value to type is a second seam, separate from choosing
which control to act on. `route.ts` exports `runRoute()`, which runs one Route:
the Fix from the fix stream, then hops until the budget is reached, the survey
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

Boundary: bookkeeping, but not unobservable. A route over the example
application leaves a readable journal on disk, and the journals of two runs
from the same seed can be compared file to file. That is the first evidence
that seeding and traveling work together, and it is what R13 is later built on.
What is still missing is any notion of something being wrong.

### Phase 5: the universal tier, and the Route as a test

The journal already exists from phase 4; this phase fills in its check-results
field and nothing else about it changes.

`invariants/universal/` is R16, one check per item, each with its evidence:

- Uncaught error and console error: the listeners the lifted `launch.ts`
  already attaches, read and drained after every hop instead of at test end.
- Still responding: a bounded round trip to the renderer and one to the main
  process. A hang is a failure of the route after a stated wait, never a run
  that hangs.
- Window still showing content: needs a definition, and the definition is a
  hazard below.
- No navigation away: the page's URL is still the application's, and
  `external.ts` recorded nothing.
- No unexpected dialog: renderer dialogs through Playwright's dialog event.
  Native main-process dialogs are a hazard below.
- A readable name on every visible control: this comes from the survey itself.
  An element with a role and no name is reported by the survey that found it
  and could not hop to it.

The runner executes the whole set after every hop (R14) and ends the Route on
the first violation (R15). R18 narrowing is declared in the adapter and the
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

Plant the first defects in the example, one per R16 item: a control that
throws, a control that logs an error, a control that blanks the window, a
control that leaves the application, a control with no name, and a dialog with
no way out, which strands. Add the tests asserting a Journey finds each.

**This is the largest phase, and it ends at a real point, so there is no safe
place to stop inside it.** Take the parts in the order given: the checks, then
the fixtures reshape, then the reset decision, then the stranded encoding, then
the planted defects. Each earlier part is verifiable on its own even though the
boundary is not reached until the last, and a slip is then a slip with
something working rather than nothing.

Boundary: **real.** A Journey with a small budget travels through the example
application and reports, which is the last step of the wiring flow in
`PRODUCT_REQUIREMENTS.md`. R1 through R11, R14 through R16, and R21 through
R23 can each be held up and answered. A reader who stops here has an
exploratory tester that finds the R16 class and strands on traps: the product
with its shallowest tier only.

### Phase 6: app-declared checks

`structural.ts` (R17) is a predicate over the page, declared by the adapter and
run after every hop like the universal tier.

`metamorphic.ts` (R19) is not a per-hop invariant, and treating it as one is
the easy mistake. A relation compares two states, so the engine has to take
moves of its own: when a hop has just performed the operation a relation names,
the engine performs the counterpart, compares, and records those hops in the
journal marked as probe hops. Whether probe hops count against the hop budget
is undecided and is decided here.

`oracle.ts` (R20) takes an expected value the adapter computed from a source of
truth and compares it to the screen. `../CLAUDE.md` records the trap: the
oracle must not share logic with what it judges. Make that mechanical in this
phase with a check that the adapter's oracle module imports nothing from the
application's source. Prose alone will not hold it.

**Be honest in the document and in the check's own message about what that
check does not cover.** It catches sharing by import, which is the easy and
common case. An oracle that reimplements the same algorithm by hand, or that
was written by copying it, passes the check and breaks the rule, and it fails
in the way that matters: both sides carry the same mistake, they agree, and the
test passes while the screen lies. A check reported as enforcing the rule, when
it enforces the reachable half of it, is worse than no check, because it stops
anyone looking. The remaining half is caught by review, or not at all.

Plant one defect per path: a count that disagrees with its rows (R17), a clear
that does not clear (R19), and a value that is wrong the same way every time,
which only the oracle catches (R20).

Boundary: bookkeeping. Each tier is verified by its planted defect as it
lands, but nothing new about the assembled engine is shown until phase 8.

### Phase 7: reporting, replay, and fitting in

`report/` builds the Journey summary from the journals on disk, not from
in-memory state: routes run, passed, failed and stranded (apart), hops traveled,
checks run and which were narrowed, and the seed. The nothing-found case
reports what it traveled through, so a green result can be told from a run
that did nothing. Every failure names its route and seed (R7), and the summary
is enough to reproduce from (R12).

R13 gets its design from R10: replay a reported seed and compare each hop's
survey against the recorded one. The first divergence is where the seed
stopped reproducing, and the report says so instead of passing.

Journeys become their own Playwright project in the consumer's configuration.
That puts their results in the same run as the scripted suite (R24) and makes
the project selectable on its own for on-demand and scheduled runs (R25, R26).
R25 is a convention on the consumer's side; the plan's part is making the
journey project trivial to leave out of any push gate.

Boundary: bookkeeping.

### Phase 8: every planted defect found by one Journey

One Journey over the example application, with a budget it can find them in,
and a test asserting that each planted defect is found. Then the triage flow
from `PRODUCT_REQUIREMENTS.md`, done cold: a second session reproduces a
finding from the report alone.

Boundary: **real, and the only one that shows the engine does its job.** The
engine's own tests up to here show that its parts behave as written. This is
the success measure, and `../ORIENTATION.md` says why nothing short of it
counts.

### Phase 9: wiring a sibling repository

A `file:` dependency, an adapter, journeys, a spec and a project entry in that
repository's Playwright configuration, following the example's consumer layout
exactly. This phase repeats a shape phase 2 already proved.

It needs a named repository to wire up, which `OUTSTANDING.md` is still holding
a question about. That question does its real damage much earlier, in phase 1,
and is stated there; by the time this phase runs, the interface it affects has
already been hardened one way or the other.

What the first real adapter discovers about the seam goes back into
`AppUnderTest`. `HISTORY.md` records that the second adapter is what finds
where the seam's shape is wrong, so expect this phase to produce interface
changes rather than only configuration.

Boundary: bookkeeping for this repository. The consumer's first Journey is a
real point, and it belongs to that repository.

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
animation mid-flight changes what is visible. The settling mechanism is
undecided. Any drift here shows as R13 firing on a replay against an
application with no bug, which is how it will be noticed.

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
one definition, and a legitimately empty state trips it. Define it narrowly,
tune it against the example and then against the first real consumer rather
than against imagined cases, and remember this is one of the checks R18 exists
for.

**The Route timeout.** Playwright's default per-test timeout is thirty
seconds. A Route with a hop budget of forty against a slow application will
exceed it and be reported as a timeout rather than as whatever it found. The
Route timeout is set from the budget and the settle wait, never left at the
default.

**Editing a Fix or the exclusion list changes recorded routes.** Both are inputs
to the draw. The seed split keeps a Fix edit from touching the traversal
stream, but an exclusion-list edit changes what the traversal draws over. The
journal's record of what could have been chosen is what lets R13 say a seed
stopped reproducing rather than letting it pass.

**The planner growing back.** `../CLAUDE.md` says what it is and what it must
not become. The check is simple: `journey.spec.ts` derives seeds and registers
tests, and anything else in it is the planner returning.

**The lifted bundle layer has one platform's shape.** Its default layout is a
macOS application bundle for one architecture, and its executable path is
inside `Contents/MacOS`. A Linux runner needs a different layout through
`bundleDir` and a display server, and running unattended there is unverified.
Windows are kept off the screen by replacing the window's `show` method in the
main process, which the lifted comment calls a real intrusion into the
application under test; it is measured there that Electron accepts a headless
flag and ignores it. The visible-window switch stays for debugging.

**Source mode bypasses the staleness guard.** The lifted launch can run the
working tree instead of the packaged build, for an inner loop where
repackaging is too slow. The guard does not apply to it, so a green run in
that mode says nothing about what ships, which is what C1 exists to prevent. It
is never a Journey option; if it survives at all it is for the engine's own
inner loop and the report says so.

**The oracle sharing logic with what it judges.** `../CLAUDE.md` records the
failure. Phase 6 makes it mechanical.

## Verification

What each layer of verification proves, from weakest to strongest:

- `npm run typecheck` proves types. With `noUncheckedIndexedAccess` on, it also
  proves the empty-survey case is handled; `HISTORY.md` records why that flag
  is not tidiness.
- Unit tests for `random.ts` and `journey.ts` prove the reproducibility
  mechanism: same seed, same sequence, routes independent, streams separate.
- The engine's own tests against the example application prove that the parts
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
what counts as settled, are tuned against the example application and then
against the first real consumer, never against imagined cases. The example is
the real data until a consumer exists.

On the machine this is developed on, the launch layer keeps windows off the
screen, and screenshots go through the compositor over the debugging protocol,
so verification needs no screen access and asks for none. Set the
visible-window switch to watch a run when working out why something fails.

## Deliberately not carried over

From the lifted kit, with the reason each stays behind:

- **Process reuse across tests as the default.** The kit launches once per
  worker and resets by reload. R3 outranks the half second it saves, and phase
  5 says why a reload is not enough. It stays available as an optimization to
  measure, not as the default.
- **The per-application flag for uncaught renderer exceptions.** Replaced by
  R18's general narrowing, so one check has no private switch that the report
  does not know about.
- **End-of-test attachments as the record.** Kept as attachments on failure,
  which are useful; not kept as the journal, which they cannot be.
- **Source mode as a Journey option.** A Journey runs against the packaged
  build (C1). The hazards say what remains of it, if anything.

From earlier design records, each already recorded where it belongs and named
here only so nobody reintroduces it through this document:

- The Journey as the Playwright test. `../CLAUDE.md` has the correction.
- Planner-assigned route bias. Declined, in `OUTSTANDING.md`; the measurement
  is in `HISTORY.md`.
- The 60-30-10 ratio as a scheduler input. `../CLAUDE.md`.
- Writing `AppUnderTest` from scratch. `HISTORY.md` records the correction.
- `kit` and `app` as directory names. Declined, in `OUTSTANDING.md`.
