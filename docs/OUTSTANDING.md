# Phileas -- what is outstanding

Everything not settled that is not itself a defect: what is agreed and
unbuilt, what nobody has decided, and what was declined.

**Nothing currently waits on an opinion**, so there is no section for it. When
something does, it gets a section of its own, first and unnumbered, so that
adding or emptying it never renumbers the items other documents cite. The
last one held the review before phase 5 and emptied on 2026-09-24;
`HISTORY.md` records its answers.

**An item leaves this file when it closes.** It is not marked done and it is
not kept for the record, because `HISTORY.md` is the record. A file that only
accumulates is how a section grows until nobody reads it.

**These headings are judgments.** Placing an item is a decision about what
kind of thing it is, and worth making deliberately.

`DEFECTS.md` is what is wrong.

## 1. Agreed, not built

### 1.1 The engine

Everything in `PLAN.md` from phase 5 on, after the work `PLAN.md` lists as
coming before phase 5, which since 2026-09-26 includes a measured trial on
Positron. Phases 0 through 4 are done and
`HISTORY.md` records them: the toolchain, the launch layer lifted and
hardened, a packaged application it can launch, the seeds that make a run
reproducible, and the Routes that travel through it and write down where
they went. Six of the universal checks landed on 2026-09-26 for the Positron
trial, and on 2026-09-27 an adapter's own checks of two things on screen
agreeing (R18), pulled forward from phase 6. What is unwritten is the rest:
no navigation away, named controls, and the rest of phase 6.

### 1.2 Planted defects, and the applications still to build

`testbed/buggy` exists and is structurally ordinary on purpose. **Twelve
defects are planted in it**, each behind its own launch flag: eleven make the
universal checks fire, and one makes the check `buggy`'s adapter declares
fire. A test steers a Route straight to each, which proves the
check and not the search, so nothing here yet shows a Journey finds anything.
`PLAN.md` plants the rest across phases 5, 6 and 8, and phase 8 is where one
Journey has to find them all.

The siblings are also unbuilt, and each makes a different claim: a build with
the Electron fuses disabled, a virtualized list, a canvas-backed surface, a
dismissed widget that still takes keystrokes, a native dialog that blocks the
main process, a splash window, an application noisy on the console, and one
that fails only into a log. Those test that the engine copes rather than that
it finds.

**This is not an optional extra and should not be treated as a late nicety.**
Every other test in this repository can only show that the parts behave as
written. This is the only thing that shows the assembled engine does its job,
and the right way to test a bug-finder is to point it at known bugs.

### 1.3 Wiring a consuming repository in another checkout

`testbed/buggy` already consumes the engine as a `file:` dependency and
imports it by package name, so the shape is proved. **What is not proved is
the case that matters**, because that symlink lands back inside this
repository: whether Playwright transpiles a package whose TypeScript source
sits outside the consumer's own tree. Phase 9 is where that is found out, and
the answer decides whether the engine must be built before it can be
consumed.

**The consumers here do not declare `@playwright/test`, on purpose.** The
review of 2026-09-27 asked for it, since each imports Playwright directly and
finds it only through this repository's own `node_modules`. Declared, each
would install a second copy beside the one the engine resolves through its
symlink, and two copies hand a consumer fixtures from the wrong instance. A
consumer in its own checkout, installing the engine from a registry, should
declare it, and the peer range dedupes it to one copy. Phase 9 is where that
layout exists to check.

### 1.4 Three things the review scheduled rather than fixed

Each was found by the review on 2026-09-22, each is agreed, and each was
deliberately not done then because the phase that gives it its shape has not
arrived. `HISTORY.md` records the review itself. Two more stood here and closed
in phase 4.

**An application that throws on purpose, and an adapter that narrows it**, in
phase 5. The R19 narrowing branch in `fixtures.ts` has three paths and only the
"no narrowing" one is exercised, because nothing in the testbed throws and no
adapter declares a narrowing. `fixtures.ts` is reshaped in phase 5 anyway, and
a second deliberately awkward application is the cheapest way to cover it.

**Branded seed strings**, in phase 7. A journey seed, a route seed and a stream
seed are all bare `string`, so `deriveRouteStreams(streams.routeSeed, 0)`
compiles and produces a plausible, wrong stream. Real, and currently
theoretical: the seams still move, and phase 7 is when seeds start crossing
into a report and back out of one.

**Per-check observation types for `Narrowing.accept`**, in phase 6. Every check
shares one `accept(observation: string)`, but a `console-error` observation is
message text and a `named-controls` observation is not. An adapter author
writes a predicate against a string whose shape the interface never states.
The right shape is only knowable once app-declared checks exist.

### 1.5 The testbed's own contract, unchecked by anything

`tsconfig.json` compiles only TypeScript, so `main.cjs`, `preload.cjs` and
`renderer/renderer.js` are outside every static check. Two channel names and
two payload shapes are written out three times across those files with nothing
relating them, and `window.buggy` is untyped in the renderer.

It matters more than a testbed usually would. That directory is what a
consuming repository copies, and phase 2's whole job is to be the unbroken
version against which planted defects are measured -- a channel rename or a
payload change is a defect nobody planted, and the engine finding its own
testbed's accidental bugs is not the measurement anyone wants.

A `channels.d.ts` declaring the channel-to-payload map, referenced from all
three sides, expresses it without changing any runtime shape. Left as its own
change rather than folded into the review fixes, because turning on `checkJs`
will surface more than it fixes.

### 1.6 The keyboard: what it left open

The keyboard work landed on 2026-09-24, and `HISTORY.md` records what it does
and why. Two things stayed open, and one is left: how the arrows move
through a native dropdown was measured on 2026-09-28, and `HISTORY.md` has
it.

**An assessment to make: different likelihoods per common key.** Up, Escape
and Enter could be drawn more often than Tab or the other arrows. Fixed
weights would keep replay intact, being part of the seeded draw. Not done yet,
because nothing measured says one key finds more than another, and weights
chosen without that are guesses about where bugs are. Assess it once Journeys
on a real IDE have run: if a key-only behavior, such as console history on
Up, is being reached too rarely, the journals are the evidence to weight from.

### 1.7 An optional map, in phase 10

**Reversed on 2026-09-23.** A per-application list of controls was recorded as
declined, on the grounds that an adapter listing every control would stop this
being a framework. That reasoning holds for a map that is *required*, and it
was wrongly applied to one that is merely allowed. What is agreed now:

- **Discovery stays primary, and a map is never required (R29).** An application
  with no map is explored exactly as today, and that remains the ordinary case.
- **A map may be full or partial.** Someone who knows the application can hand
  the engine what they know, and leave the rest to discovery.
- **It lands in phase 10, after the current last phase.** Phase 8 has to show
  that discovery alone finds every planted defect, and a map present by then
  would blur what found them. Phase 9 points the engine at a real application
  for the first time, and the places discovery actually fails there are the
  evidence the design below should be settled from.

Four questions are open, and are recorded rather than answered because phase 9
is what answers them:

- **What a map entry does.** It could add candidates discovery cannot find --
  a canvas surface, the rows a virtualized list is not rendering, a keyboard
  shortcut shown nowhere on screen, which the keyboard work leaves to a map.
  It could annotate candidates discovery already found. Or it could steer the draw,
  which would be a new chooser behind the choosing seam rather than a change
  to the hop loop. The third needs care: steering is what planner-assigned
  route bias, 3.1, was declined for.
- **What happens to a stale entry.** A map entry that is not on the page could
  be skipped in silence or reported, the way an exclusion that matched nothing
  is. A map, like a hand-written exclusion list, goes stale the day the
  application changes.
- **Where a map comes from.** Written by hand, derived from the source
  beforehand, or read from an application's own automation bridge. The engine
  still reads no source at run time; whatever builds a map runs before the
  Journey and hands over the result.
- **How replay stays honest.** A map is an input to the draw, like the
  exclusion list, so editing one changes where Routes go. The journal should
  mark candidates a map supplied, so that R14 can tell a map edit from an
  application change.

### 1.8 The four applications the engine is for, and what each will need

Recorded 2026-09-23. Four applications, reached in this order:

- **`613-mitzvot` and `editor`**, the confirmed consumers `HISTORY.md` names.
  Small applications, and both launch the ordinary way, with their fuses
  enabled. The most direct fit, and phase 9's work.
- **Positron and RStudio, eventually.** Targets, not candidates to be weighed:
  both are to be tested, after the engine has proven itself on the first two.
  Positron is the stronger of the two, for measured reasons below.
  **Changed twice since:** a trial on Positron came first, on 2026-09-26, and
  on 2026-09-28 RStudio Desktop was chosen over carrying the trial on.
  `PLAN.md` has both.

trickster-tales is not one of the four. It served on 2026-09-23 as a demo, the
first real application the engine traveled through, and its dropdowns found a
gap `HISTORY.md` records. It is also the clearest worked example of where a
specified check's expected results come from: its own test suite already reads
its corpus independently, in `e2e/app/corpus.ts`, and derives expectations
from it. Checks phase 6 could write for it include the number of tale cards
against the tales in the data, a tale's listed motifs against its motifs in
the data, the count beside a facet value against the tales carrying that tag,
and a search against the tales whose text matches.

**Positron.** Everything below except the last bullet is from the suite reading
`HISTORY.md` records.

- **Launch:** the ordinary path works. It carries no fuse configuration and
  leaves `RunAsNode` enabled, so the main process, menus and link stub are all
  in reach.
- **Discovery:** ordinary DOM, and its own tests reach for accessible
  locators 30.3% of the time, under a written policy ranking roles above
  identifiers. The limit is the editor's text layer and the terminal's canvas,
  which are exactly what its own accessibility scanner excludes.
- **Breadth is the hard part:** more candidates than a Trip can visit, many of
  them virtualized and changing between one survey and the next. The Fix is
  the answer. A Fix that opens a notebook or the data explorer keeps a Trip
  inside one area with its own well-named controls, and several Journeys with
  different Fixes cover several areas.
- **Its driver** types into the editor, reads the terminal buffer, sets values,
  reads elements and runs registered commands. Checks may read it and the
  survey may not, which `../CLAUDE.md` settles; it is how a check reaches what
  discovery cannot.
- **Before its Journeys mean anything:** it writes to the console in normal
  operation, so the console-error check needs narrowing (R19), and it keeps
  four separate kinds of dialog.
- **How much of its bug stream is in reach** was measured on 2026-09-26, on a
  random sample of 100, and it is no better than RStudio's:
  `research/positron-effectiveness.md`.

**RStudio.**

- **Launch:** the release build ships hardened, so as installed the engine
  gets in only over the debugging port, which reaches no main process: no
  link stub, no hidden windows, no menus, no main-process checks. The first
  of its three recorded bugs is a main-process exception that path would
  travel straight past. **The remedy, since 2026-09-28, is a copy of the
  installed release with RunAsNode and the inspector arguments switched back
  on and re-signed for local use,** which launches the ordinary way;
  `HISTORY.md` has the measurement. The release leaves asar integrity
  checking off, and whether that matters has not been tried. A build from
  source without the hardening, the
  remedy recorded before, stays the way to older releases. Its source is
  AGPL: build it and test it, and copy nothing from it.
- **Discovery** reaches its toolbars, menus, dialogs and panes, which are well
  named: 80 of the 84 elements found by role on the resting screen carry a
  usable name. It stops at the console, the
  source editor, the data grid and the visual editor.
- **All three of its recorded bugs sit in the reachable part** -- a plot window
  left open while quitting, a dismissed summary returning on pagination, a
  preview that fails silently on a fresh profile -- and its scripted suite
  missed all three. That is the case for it. **How common such bugs are was
  measured on 2026-09-26, on a random sample of 100**, and the answer is far
  fewer than three of three suggests: `research/rstudio-effectiveness.md`.
- **Its expected results come from R and the file system**, never from its own
  code or its automation bridge. A separate R process running the same code
  gives the values the Environment pane and the data viewer should show; the
  file system gives what the Files pane should list and what a saved file
  should contain. The separate R has to match RStudio's -- the same version,
  packages and working directory -- or a mismatch belongs to the test's setup
  rather than to RStudio. Its bridge reports RStudio's own view of itself, so
  comparing the screen with it catches display bugs only.
- **Its readiness flag is not a settle signal:** its own guide warns it is set
  before the workbench is finished.

**Two cases these capabilities have to reach**, raised as tests of whether the
engine is useful on either application:

- **Asterisks saved as underscores in the visual editor.** A Fix types
  `*text*`: a Fix is the Journey author's own code and may use Playwright
  directly, so the unreachable editor does not stop it. The Trip then hops
  through the reachable controls that switch views and save. A check compares
  the saved file's text with what was typed. It has to compare text, not
  rendered output, since `*text*` and `_text_` both render as italics. Needs
  phase 6, and real typing, now built, if the editor converts only on
  keystrokes.
- **Console history:** submit a line, press Up, and the line comes back. Needs
  key presses, now built, a console input discovery can reach, which is unmeasured
  on both applications, and a relation check (R20, phase 6). The value is not
  repeating the sequence a scripted test already covers, but checking the
  relation still holds after whatever arbitrary hops came before it.

**Where the limit actually is.** Discovery by role stops where the
accessibility tree does: an editor's text layer, a canvas, a windowed list.
That is neither Playwright's limit nor a permanent one. Playwright can type
into and read those surfaces through the page, and the ways past it are key
presses, the optional map (1.7), and checks written for the application
that read contents, files or a driver. What is beyond Playwright is narrower:
the operating system's own popups and dialogs, and anything drawn on a canvas,
which offers pixels and no text.

### 1.9 What the two IDEs need that nothing supplies yet

Recorded 2026-09-23, and scheduled the same day at the review before phase 5,
by approving a proposal made at the end of the session that recorded them:

- **Measured before phase 5, by one probe of RStudio:** frames and webviews,
  the cost on a large application, and a page that never stops moving.
  Measured 2026-09-24, on Positron as well; `HISTORY.md` has the results.
- **Designed before phase 9:** other windows, and more kinds of action.
- **At the IDEs' turn, after phase 9 and before the engine meets either:**
  reading inside frames and webviews, decided 2026-09-24 once the probes
  showed the need. Nothing earlier is known to need it, though whether the
  testbed's siblings or the two first consumers use frames is unmeasured.
- **At the IDEs' turn, asked for 2026-09-24:** revisit the draw shares for
  the keys and the menu, 1.11, once a Journey has run against either IDE.
- **In phase 5, where `PLAN.md` already has them:** native dialogs, and bugs
  that happen on quitting.
- **At RStudio's turn, after phase 9:** the debugging-port launch, or a build
  from source. **Settled on 2026-09-28, and brought forward:** neither, a
  copy of the release with two fuses switched back on, below.

A reading, not a reason given with the approval: the three measured items
bear on what phase 5 and R31 build on, since both rest on the survey and the
settle wait, and the rest matter only once the engine meets a real IDE.

Where an item is already recorded elsewhere, this points there rather than
repeating it.

- **More kinds of action:** scrolling, right-click, double-click, dragging and
  hovering. A Hop today can click, type, press a key, select, focus and click a
  menu entry.
  Virtualized lists and long panes need scrolling before their contents exist
  to be found. How much either IDE puts in context menus is unmeasured.
- **Other windows.** A Route surveys one window, the page the adapter selects.
  The first of RStudio's recorded bugs starts in a second one, its plot zoom
  window. How many others either IDE opens is unmeasured.
- **Frames and webviews.** The survey does not read inside a frame, measured
  on both IDEs. RStudio's Help, Viewer and data viewer are each an iframe, and
  none of their controls reach the survey, 57 of them in the data viewer
  alone, which is where one of RStudio's recorded bugs sits. Positron's Help
  and Viewer are webviews and equally out of reach; its data explorer is drawn
  in the page and is reachable. Scheduled above, at the IDEs' turn.
- **The debugging-port launch** that a hardened release needs is named in the
  engine's types and has never been built. RStudio no longer needs it: since
  2026-09-28 a copy of its release with two fuses switched back on launches
  the ordinary way, as 1.8 says, and how hard a build from source would be is
  still unmeasured. Whether the same works on a release that checks its
  asar's integrity has not been tried. Whichever way in, each Route needs its own Electron profile,
  through `--user-data-dir`: measured on RStudio, the profile ignores `HOME`,
  so without it every Route shares one profile's cookies and storage, which is
  the inherited state R3 forbids. The folder needs a short path: Positron
  fails to start when its profile's path pushes a socket inside it past 103
  characters.
- **Native dialogs,** such as Open and Save, which file work in either IDE
  reaches. `PLAN.md` carries them as a hazard with the answer undecided.
- **Cost on a large application** is small on both IDEs, measured: a survey
  takes 7 to 66 ms over at most 72 candidates, so neither the per-Hop reads
  nor the journal's pools need work.
- **A page that never stops moving** turned out to be two findings, the same
  on both IDEs. A blinking cursor is not in the accessibility tree, so it does
  not register at all. A live console does, and the settle wait used to return
  settled while it was still changing; it now waits for a quiet window, and
  `HISTORY.md` has the fix.
- **Resource monitors that tick,** at the IDEs' turn, agreed 2026-09-24. Both
  IDEs show memory or CPU readings that change about once a second: RStudio's
  "Memory in use" image and its "KiB used by R session" button, Positron's
  resource monitor and memory meter. Two things follow. R31 would record every
  IDE Hop as having changed the screen. And RStudio's reading is a button, so
  it is a candidate whose name differs from one run to the next, which sends a
  replay's draw somewhere else. The remedy agreed is an adapter naming such
  elements for the engine to leave out of pools, settling and effects. `buggy`
  has none, so nothing breaks before the engine meets an IDE.
- **Bugs that happen on quitting.** Quit is excluded, so no Hop reaches it, but
  every Route already ends by closing the application. A main-process error
  check watching that close could catch RStudio's first recorded bug without a
  Route ever hopping to Quit. Phase 5 decides the main-process check.

Already built: key presses and typing. Recorded and scheduled: main-process
errors, log checks and narrowing (phase 5), and expected results from files,
R or a driver (phase 6).

### 1.10 Dialogs that are not native modals

Raised 2026-09-24. A native modal dialog, opened with `showModal()`, is now
handled: the survey reads only the dialog, and `HISTORY.md` has the
measurement and the fix. A dialog built any other way is still surveyed as
part of the whole page, and two gaps remain, both recorded and not yet
scheduled.

**When nothing behind the dialog is reachable, but the tree still lists it.**
An application can block the background in three ways. With `aria-hidden`,
the background leaves the accessibility tree and the survey offers only the
dialog, which is correct. With `inert`, it should leave the tree the same way
in Chromium, but whether Playwright's snapshot leaves it out is unmeasured.
With only an overlay that catches clicks, the background stays in the tree:
every Hop drawn to it times out and is journaled as abandoned, and a dialog
with no way out cannot strand, which is the waste the native-modal fix
removed. Recognizing an overlay without reading the application's code is
undecided.

**When things behind the dialog are also reachable, and should not be.** The
survey offers them and a Hop really clicks them, recorded as an ordinary
click. If the dialog was meant to block the background, that is a real bug
Phileas walks into and cannot recognize, since no check says what should be
unreachable. Two ways a check could, both undecided: an adapter declaring
that nothing behind a named dialog may be reached, which is a structural
check (R18, phase 6); or a pattern of abandoned Hops whose clicks were
intercepted, as evidence of an overlay.

### 1.11 The draw shares for the keys and the menu, provisional

Chosen 2026-09-24: the common keys and the menu bar each get an eighth of the
share draw, and the page three quarters. Those are the defaults; an adapter
can set its own as `keyShare` and `menuShare`, asked for the same day, and the
shares used are written on each Route's opening journal line. `HISTORY.md` has the counts they were
chosen from, which come from three small applications. **Neither share has
been measured on an IDE**, the case where both matter most: the IDE probes
went over the debugging port, which reaches no menu, and an IDE's menu bar
runs to a hundred entries or more.

**What reopens it.** Once a Journey has run against an IDE with the menu
offered, count from its journals how often each side changed the screen, the
way the rail demo's were counted. Adjust either share if the page is being
crowded out or a key-only behavior, such as console history on Up, is being
reached too rarely. A changed share changes what every seed produces, so it
lands as its own change and says so.

### 1.13 Deferred from the whole-codebase review of 2026-09-27

Agreed as worth doing and not done with the review's fixes, because each is
a refactor or a feature rather than a fault. The faults it deferred are in
`DEFECTS.md`.

- **Public API tidying, before any publish.** `src/index.ts` exports about
  110 names, many only so the tests can reach them: `sideCandidates`,
  `keepsRouteGoing`, `seededChooser`, `reloadRenderer`, the exclusion tally.
  Two of them let a caller fail open: `survey` takes both `exclusions` and a
  tally and applies the tally's rules, and `runRoute` journals the adapter's
  shares whatever chooser it is handed. Meanwhile `CloseVerdict` and
  `STALLED` are missing. An internal entry point for the tests, and one rail
  object that carries rules and counts together, settle all of it.
- **Strict journal types for writing.** The written types have every field
  optional, so a menu target without a path or a stranded outcome without a
  reason typechecks. Strict unions for writing and a tolerant type for reading
  old journals.
- **Toolchain versions on the opening line.** A journal records no engine,
  Playwright or Electron version, so a seed that stops reproducing cannot be
  told apart from a toolchain change (R13, R14).
- **An adapter constructor.** `AppUnderTest` is checked piecemeal where each
  field is used, and `settleQuietMs` and `profileWatchMs` not at all. A
  `defineAdapter()` beside `defineJourney()` would check it once.
- **Say where the engine runs.** macOS on arm64 only, which neither
  `package.json` nor the README says. Also: `electron` could be an optional
  peer for installed-binary consumers, and `@types/node` is a major ahead of
  `engines.node`.
- **Tests still missing** after the review's own were added: the renderer's
  `failedText` and `knownText` lines, a nonexistent menu label refusing,
  disabled and unnamed controls in the survey, `markFiled`'s ambiguous-prefix
  refusal, the Positron narrowings against sample observations, and every
  `phileas` flag reaching its variable.
- **Simplification.** The review listed about thirty, none changing behavior:
  one launch-and-clean-up helper for the tests, one environment helper, the
  demo's copied journal reader, and duplicated expressions in `route.ts`,
  `fixtures.ts` and `bin/phileas.mjs`.

### 1.14 Weighting the draw toward new targets and away from the last one

Raised 2026-09-24 as something to note and not to decide, when it held only
the first half below. The idea then, close to how it was put: at hop 1 every
available target is known, and one is chosen. At hop 2 some targets may be
new, say because hop 1 landed on a dialog, and the Route could weight those
above the rest.

**Extended on 2026-09-27,** close to how it was put: targets have an average
weight; new targets are weighted highest; the target just used is weighted
below average; and as Hops go on, each weight moves back toward average
until it reaches it. "The idea is that Phileas would favor new things, and
avoid doing the same thing over and over again. And hopefully make it out of
London."

**Placed the same day,** asked for in the words "Let's do it sooner": right
after the Positron trial, before the rest of phase 5, chosen over building
it before the trial's remaining steps and over placing it beside recording a
Fix. `PLAN.md` has it in the build order.

**Notes, a reading and not a decision:**

- **Replay survives it.** Each weight is a function of the pools and choices
  the journal already records, so a weighted draw is still a seeded draw and
  a replay makes the same choice. It would be a chooser behind the choosing
  seam, which `../CLAUDE.md` keeps a named interface for exactly this kind of
  addition, and the journal would need to say which weighting drew each Hop.
- **It is not the declined route bias, 3.1.** That assigned directions before
  anything had run. This reacts to what the Route actually did, which is the
  thing 3.1 called missing.
- **Which target is "the same" across Hops needs deciding first.** A target is
  its role, name and `nth`; `nth` shifts when a matching control appears
  earlier on the page, and a name can change while a Route runs, as
  Positron's Accounts did. A wrong match makes an old control look new.
- **The numbers are guesses until measured:** how high a new target starts,
  how far the last one drops, and how many Hops the return takes. The Eighty
  Days demo can measure getting out of London with and without it, sooner
  than phase 8's planted defects can; the same caution 1.6 gives for
  weighting the keys applies.

**Baselines under the seeded draw,** reported on 2026-09-27 by the session
building the Eighty Days demo, not measured here, all with windows hidden.
From London, 3 Routes of 60 Hops reached no places before a layout fix, and
6 Routes of 150 reached 4 to 7 after it. From the demo's Hong Kong Fix, 6
Routes of 200 reached 12 to 20 places: 1 lost, 5 still going, 5 distinct
sequences of places. A passage costs about 20 Hops, and 30% of Hops go to the
game's reference panels. `demo/eighty-days/measure.mjs`, on that demo's
branch and unmerged when this was written, prints these from a run's
journals. **They go stale when that branch merges:** it adds "1" and "2" to
the values a Route types, so every seed that types anything travels
differently from then on. Measure the baselines again, on the same values
as the weighted runs, before comparing. **The game itself changed too,** on
main at e0e274e, reported by the second Eighty Days session: a place with no
departure left now loses the game, three invented departures were retimed,
and the default Trip went from 200 Hops to 150. Every baseline above was
taken before it, and the demo's pinned seeds will be searched for again once
a weighted chooser lands.

### 1.15 Weighting the draw by a control's role

Raised 2026-09-28, close to how it was put: the kinds of control are few,
such as button and option, and they could be weighted, so that Phileas
would draw a button more often than an option. Recorded as an idea to
measure before any weight is chosen, asked for with "yes" to that proposal;
nothing else is decided.

**Notes, a reading and not a decision:**

- **Replay survives it.** Fixed weights per role are part of the seeded
  draw, the way 1.6 says of weights per key. It would be a chooser behind the
  choosing seam, like 1.14's, and the two could combine.
- **Its strongest case is crowding.** One open listbox can put dozens of
  options into a pool beside a handful of buttons, so a uniform draw spends
  most Hops among the options. A weight per role, or a share per group of
  options, would answer that without judging which control matters.
- **Weights chosen without measurement are guesses about where bugs are,**
  1.6's caution. The journals already record every pool and each target's
  role, so the Positron runs can say, before any number is picked, which
  roles changed the screen when drawn and how often each crowded a pool.

## 2. Undecided

Product questions that are still open -- what fault injection covers, how long
journals are kept, what happens when one defect is found on several
routes -- are in `PRODUCT_REQUIREMENTS.md` under Open questions, and are not
repeated here.

### 2.1 A language model, deferred rather than undecided

Not in this version, and wanted eventually. `PRODUCT_REQUIREMENTS.md` states it
as a non-goal of this version. This entry exists to keep the seams honest in
the meantime, because the cost of adding one later is decided now, not then.

Four places it could go, and they are not equally risky:

- **Summarizing a finding from a route's journal.** Runs after everything,
  reads the journal, changes nothing about detection. Addable at any point
  without touching the engine.
- **Helping write an application's own checks.** A tool for whoever wires the
  application up, not something present at run time.
- **Generating input values.** The control being hopped to stays a seeded
  draw; only what gets typed into it varies, and the journal records it.
  Probably the most valuable of the four, since hostile input is where fault
  injection lives anyway.
- **Choosing the next hop.** The one that costs seeded replay, and the only
  one needing anything designed for it in advance.

**What keeps the last one cheap is already built for another reason.** The
journal records what was chosen and what else could have been chosen, at every
hop, which was decided so that a record survives a crash. It is also exactly
what a run that cannot replay from its seed needs in order to replay at all.

**What it rests on, and when to revisit:** nothing changes while every move is
a seeded draw. Revisit when either a real appetite for it appears, or the
choice of the next Hop starts needing judgment that a rule cannot express.
Revisit sooner if
anyone proposes inlining the choice of the next candidate into the hop loop,
which is the change that would make this expensive. `../CLAUDE.md` holds that
as a commitment.

**Not deferred, and not wanted later either: a model inside the checks.** A
route ends at the first violation, so a judgment nobody can reproduce would end
routes at random and a red result would stop being worth reading. If a model
ever judges, it is a separate tier with its own reporting, never mixed with the
deterministic ones.

**Asked 2026-09-27, and not decided:** "could Phileas go through journeys and
feed them to an LLM to analyze?" A reading, not a decision: two uses fit the
places above. It could point a person at Hops that look wrong, as
suggestions that never end a Route. Or it could read many journals for two
places on screen stating the same fact, and propose structural checks for a
person to accept, which is helping write an application's own checks. Either
sends journals to the model, and C3 says nothing a run produces is sent
anywhere, so a hosted model needs that constraint changed or a model run on
the same machine.

### 2.2 Publishing, deferred with an expiry that nothing currently watches

Private for now, and publishing is wanted eventually.
`PRODUCT_REQUIREMENTS.md` carries this as a constraint and marks it inferred
rather than stated, and a goal there rests on it. Nothing tracked the decision
itself until this entry, which is why it is here: a constraint with an expiry
and no watcher expires quietly.

**What it rests on:** that every consumer is a repository under the same
ownership, reachable by a `file:` dependency, so nothing outside can be broken
by a change. That holds today.

**When to revisit:** when a consumer appears that cannot use a `file:`
dependency, or when anyone outside would be asked to write an adapter. Both
turn interface stability and adapter ergonomics from preferences into
requirements, which is a larger change to this document set than to the code.

**One deployment shape forces the question immediately.** If an external
application's maintainers accept a phileas directory in their own repository,
that repository becomes a consumer and cannot reach a `file:` dependency on a
private package, so the engine would have to be published before the offer
could be taken up. The other two shapes keep every consumer under your own
ownership and leave this deferred. So the answer is downstream of a question
nobody has asked yet, rather than of a date.

**What is not deferred:** the engine is already named
`@drugstoresushi/phileas` and versioned, so the decision is about whether to
publish rather than about how the package would be identified.

### 2.3 Wager, as a name for the terms of a Journey

Proposed, then parked rather than rejected, on an explicit request to hold on
to it in case it proves useful. It failed a use-it-in-a-sentence test: "a
journey of 10 routes" reads, "a journey for which the wager was 10 routes"
does not, and is inaccurate besides.

Kept here rather than under Declined because parking it was deliberate. If
the terms of a Journey ever need a collective noun, this is the candidate
already considered.

### 2.4 Different Fixes for different Routes of one Journey

`../CLAUDE.md` names this as a wanted option, raised when the Fix was
designed, and it was not tracked here until 2026-09-23. A Journey has one Fix
today, applied fresh to every Route. Wanted: Routes of one Journey starting
from different Fixes.

Since 2026-09-28 the Journey's terms name its Fix, from the consumer's
`fixes/index.ts`, and each Route's journal records which Fix it opened with.
So a Route given a different Fix would already say so; what remains is how it
would be given one.

Undecided, including how a Route would be given its Fix. The constraint is the
one `../CLAUDE.md` puts on the planner: it may decide how many Routes there
are, and never what they explore, so whatever assigns a Fix must not become a
judgment about where a Route should go. Several Journeys, each with its own
Fix, already give a coarser version of the same thing, which 1.8 relies on
for Positron.

### 2.5 Whether the `phileas` command's variables are for people too

The command hands each flag to the run as an environment variable, because
that is the only channel Playwright's workers take: `PHILEAS_ROUTES`,
`PHILEAS_TRIP_LENGTH`, `PHILEAS_ROUTE_DEADLINE_MS` and
`PHILEAS_JOURNEY_DEADLINE_MS`, beside the older `PHILEAS_SEED`,
`PHILEAS_SHOW` and `PHILEAS_HOP_DELAY_MS`. Set by hand, they work the same way
and are marked in the printout the same way. Left open when the command was
agreed on 2026-09-24: whether they are a documented way to set a run, or
plumbing a person should reach only through the command.

### 2.7 A Fix step naming a control that two controls share

Noticed 2026-09-24 and recorded unraised; nothing is decided. A Fix's
`hop('button "X"')` acts on the first control whose survey line matches, in
survey order, and says nothing when a second one matches too. `phileas survey`
prints one identical line for each, so the person writing the Fix cannot tell
from the listing which one a step will reach, and there is no way to name the
second.

A replay is unaffected, since survey order is the same each time. What is at
risk is the Fix doing something other than what its author meant, silently,
which is a latent hazard rather than a cosmetic one. Open: whether a step
naming more than one control should be refused, like one naming none, or
whether the line should be able to say which.

**Recording a Fix makes this sharper**, noted 2026-09-25. A person writing
from the listing at least sees two identical lines. A recorder that watches a
click on the second control would write a line that replays onto the first,
and nobody would see two of anything. `PLAN.md` has recording after phase 5
and says this has to be met first.

**The rail demo meets it,** since 2026-09-25: its add-a-leg Fix cannot name the
To dropdown's stations, which repeat the From dropdown's, so that one step is
Playwright code. A real case to design against.

### 2.8 Playwright's own output around `phileas survey`

Noticed 2026-09-24 and recorded unraised; nothing is decided. `phileas survey`
runs through Playwright, so its listing arrives between Playwright's block of
settings and a closing "1 passed". Neither says anything about what the
engine sees, and "1 passed" reads as a verdict on a command that judges
nothing. Open: whether it is worth quieting, and how, without hiding a real
failure to launch.

### 2.9 Shortening a failing Route to the steps that matter

Raised 2026-09-26 by the first Positron bug the trial found. A Route failed
at hop 8, and the engine's part ended there: it named the Route, the Hop, the
log lines and all eight Hops. Everything after was done by hand in the
session, not by the engine: guessing that only hops 1 and 8 mattered,
replaying those two by script to confirm it, reading Positron's code to judge
the finding real, and writing the steps for the issue. The trial's bar asks
that triage take minutes, and this took far longer. The journal could only
support the shortening indirectly, since it records controls by name: that
the OK clicked at hop 8 belonged to the dialog hop 1 opened is an inference
from one OK appearing after hop 1 and staying on offer.

Two things were asked for, in the words they were put:

- **Choosing how many Hops a failure is reported with.** "When there's a
  problem, we should be able to control how many hops should be included,
  e.g. the last five."
- **A language model doing the shortening and the write-up.** "Phileas
  identifies the route, LLM take it and figures out the minimal steps. And
  writes the issue."

**Notes, a reading and not a decision:**

- **The last few Hops may not stand alone.** Hops before them set up the
  state they act in: here the Open Folder dialog at hop 1 was what the OK at
  hop 8 confirmed, and the last five Hops without it would not reproduce.
  Replaying a tail needs the state its first Hop started from, or a check
  that the shortened replay still fails.
- **Dropping a Hop shifts every draw after it.** A seeded replay retraces the
  whole Route; a shortened one has to act from the recorded targets instead,
  which the journal already holds, the way 2.1 says a run that cannot replay
  from its seed would.
- **The model sits after the run, which is the safe place for one.** 2.1
  lists summarizing a finding from a journal as the first of the four places
  a model could go, since it changes nothing about detection. Shortening
  goes one step further, because it replays the application, but the
  verdict on each shortened replay would still come from the engine's
  checks rather than from the model. That keeps the rule in 2.1 that a model
  never judges inside the checks.
- **Its write-up needs the same care a hand-written one did.** The first
  draft of the issue for this bug said the error happened "each time these
  steps were run" after one scripted run, and the plan said "reproduced by
  hand" when it was not. Whatever writes the issue has to report what was
  actually run, and how many times.

### 2.10 Checking that an application replays, as part of the engine

Raised 2026-09-27, and asked to be noted in the words "Note it."; nothing is
decided. Building the Eighty Days demo produced a test that plays one seed
twice, in two launches and at two hop delays, and compares the whole
accessibility tree before every Trip Hop. It lives in the demo's own suite,
`demo/eighty-days/tests/determinism.spec.ts`, built from the engine's public
API, with a shared part in `determinism.ts` beside it.

Nothing in it is about that game. Every application a Journey runs against
depends on the same property: a failing seed is worth recording only if it
retraces, and an application that draws from its own randomness or moves on
a timer makes a recorded seed retrace somewhere else. The engine already
treats a Route that fails and then passes as a finding, which is why its own
suite runs with no retries; this would be the same stance, checked directly
rather than noticed by chance.

**Notes, a reading and not a decision:**

- **It costs a Route's time twice**, so it is not something to run on every
  Journey. A command of its own, or an option on `phileas run`, would fit
  better than a check after every Hop.
- **Some applications are not deterministic, and legitimately.** A clock on
  screen, a greeting by time of day, or a real network would all differ
  between plays. The comparison would need a way to leave a named part of
  the screen out, and that list has the same pitfall as a narrowing: it can
  quietly grow to cover the thing it should catch.
- **It already has a positive control to carry over.** The demo's tests
  plant a note before one Hop of one play and require the comparison to
  find it there, and that belongs with it wherever it goes.

### 2.11 A Fix step written from the survey's data rather than its text

Raised 2026-09-27; nothing is decided. A Fix's `hop()` takes a line as
`phileas survey` printed it and matches it against how each control on the
page would print. The text is a rendering of a target the journal already
records exactly, as `{ source, role, name, nth }`. Asked, in the words it was
put: "I wonder if it should somehow come from the JSON, which is the source
of truth." And then: "survey results are numbered, so controls/targets have
an ID. They're shown as human-legible display, but when adding a Fix, the fix
is created by providing those number."

What raised it was measured the same day on Positron 2024.11: its buttons
for starting and listing interpreters are named by one icon-font character
each, U+F259 or U+F25A, with the readable words on an element inside. The
journal holds the names exactly, and Playwright's own snapshot of the page
agrees. A survey line for one of them can only be copied by copying a
character from Unicode's private-use range, and the two Start the
interpreter buttons print identical lines.

**Notes, a reading and not a decision:**

- **The number would be a handle, not what the Fix keeps.** It is a
  position in one listing, and the listing changes whenever the application
  does. So a number given when writing a step would be turned into the target
  it names, and the target written into the Fix.
- **The target carries `nth`,** so a step can name the second of two controls
  sharing a name, which is 2.7.
- **It is close to an option `PLAN.md` already lists** for recording a Fix:
  an interactive survey that numbers the controls and takes a number.
- **The text line need not go.** It is what a person reads, and what a Fix
  written by hand uses; a target could be accepted beside it.

## 3. Declined

### 3.1 Planner-assigned route bias

Declined 2026-09-20, for two reasons. It is interference rather than learning,
since nothing has run when the bias is assigned, which makes it stratified
sampling. And the problem it solves is negligible, which was measured rather
than assumed.

`HISTORY.md` has the reasoning and the measurement. Reopen only on measurement
showing real clustering, not on the intuition that ten random walks must
overlap.

**The related guard is a standing commitment rather than a declined item:** the
planner stays a for-loop. If it starts deciding what gets explored rather than
how many Routes there are, this decision has been reversed under another name.

### 3.2 The name Fogg

Declined 2026-09-20 in favor of Phileas. "Fog" reads as obscurity, wrong for a
tool built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

### 3.3 The directory names `kit` and `app`

Declined 2026-09-20. Both non-standard, and `app` actively harmful because it
collides with "the application" -- it caused a real misreading during the
session that chose against it. Replaced by `src/` here and `phileas/adapter/`
in a consuming repository.

### 3.4 Stubbing printing in the engine

Declined on 2026-09-28, in the words "Leave printing to the exclusions".
RStudio's File -> Print... had opened macOS's print dialog on the screen of
a hidden run, and nothing in the engine answers printing the way its stub
answers file and message dialogs.

**Measured before deciding, the same day:** a stub on `webContents.print`
in RStudio's main process caught a direct call to it, the control, and
did not catch File -> Print..., after which the page stopped answering
because the dialog opened. So that stub would take effect and do nothing,
the flaw the outbound-link stub already carries. RStudio most likely
prints from the page, with the browser's own print on a hidden frame; a
stub injected into the page was not tried.

**What made declining acceptable:** since the teardown stopped waiting on
a screenshot forever, a print path an adapter misses costs one Route and
about 20 seconds of dialog, not a stuck Journey. Each adapter excludes its
own ways into printing, as RStudio's does. Reopen if a missed path turns
up on a real run, and try the page-side stub first.
