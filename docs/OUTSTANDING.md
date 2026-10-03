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

`proving-ground/buggy` exists and is structurally ordinary on purpose. **Fourteen
defects are planted in it**, each behind its own launch flag: thirteen make the
universal checks fire, two of them 1,500 ms after their click so the error
arrives during a later Hop, and one makes the check `buggy`'s adapter declares
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

### 1.4 Three things the review scheduled rather than fixed

Each was found by the review on 2026-09-22, each is agreed, and each was
deliberately not done then because the phase that gives it its shape has not
arrived. `HISTORY.md` records the review itself. Two more stood here and closed
in phase 4.

**An application that throws on purpose, and an adapter that narrows it**, in
phase 5. The R19 narrowing branch in `fixtures.ts` has three paths and only the
"no narrowing" one is exercised, because nothing in the proving ground throws and no
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

### 1.5 The proving ground's own contract, unchecked by anything

`tsconfig.json` compiles only TypeScript, so `main.cjs`, `preload.cjs` and
`renderer/renderer.js` are outside every static check. Two channel names and
two payload shapes are written out three times across those files with nothing
relating them, and `window.buggy` is untyped in the renderer.

It matters more than a proving ground usually would. That directory is what a
consuming repository copies, and phase 2's whole job is to be the unbroken
version against which planted defects are measured -- a channel rename or a
payload change is a defect nobody planted, and the engine finding its own
proving ground's accidental bugs is not the measurement anyone wants.

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
- **Designed before phase 9:** other windows, now 1.21, and more kinds of
  action.
- **At the IDEs' turn, after phase 9 and before the engine meets either:**
  reading inside frames and webviews, decided 2026-09-24 once the probes
  showed the need. Nothing earlier is known to need it, though whether the
  proving ground's siblings or the two first consumers use frames is unmeasured.
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
- **Other windows.** Now a requirement, R33, and an item of its own, 1.21.
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

Raised 2026-09-24. A native modal dialog, opened with `showModal()`, is
handled: the survey reads only the dialog. So, since 2026-09-30, is a
visible dialog marked `aria-modal`, measured on Bobolink Editor, and the
same day an overlay that catches clicks stopped mattering too: the controls
behind it are covered, so the survey leaves them out, and a dialog with no
way out strands, naming the overlay. `HISTORY.md` has all three. One gap is
left on each side, both recorded and not yet scheduled.

**Whether `inert` takes the background out of the tree.** With
`aria-hidden`, the background leaves the accessibility tree and the survey
offers only the dialog, which is correct. With `inert`, it should leave the
tree the same way in Chromium, but whether Playwright's snapshot leaves it
out is unmeasured. An inert background under an overlay is covered either
way; one under nothing is unmeasured too, and a click there may do nothing
and be journaled as a Hop that did.

**When things behind the dialog are also reachable, and should not be.** The
survey offers them and a Hop really clicks them, recorded as an ordinary
click. If the dialog was meant to block the background, that is a real bug
Phileas walks into and cannot recognize, since no check says what should be
unreachable. **Trusting `aria-modal` made this wider:** a dialog marked
modal whose background still takes clicks is now never clicked behind, so
that bug is never met. Two ways a check could catch it, both undecided: an
adapter declaring that nothing behind a named dialog may be reached, which is
a structural check (R18, phase 6); or the same cover recorded over many
Hops, from the pools' covered controls, as evidence of a dialog that will
not go away.

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
  `package.json` nor the README says. Also, `@types/node` is a major ahead of
  `engines.node`. What the engine asks of a consumer's Electron and
  Playwright is 1.16.
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

**Two places the uniform draw spends Hops, measured on Bobolink Editor** on
2026-10-01, one Journey of 3 Routes of 30 Hops, seed `4fd8b50f91d1`, no
Fix, windows hidden. Asked to be recorded the same day; what to do about
either is not decided.

- **Controls that do nothing.** The editor draws its own window frame in
  the page, and each resize handle is a button with a name, "Resize top
  edge" and the like, so the survey offers it. Clicked without a drag, a
  handle does nothing: 9 of the 90 Hops went to them, and 7 of those 9
  reported no change. The editor's adapter could exclude them by name; a
  weighting that lowers a target each time it changes nothing would cover
  any application with controls like these.
- **A modal dialog with many choices.** Settings is marked `aria-modal`, so
  while it is open the survey offers only its controls, as it should, and
  it holds a dozen dropdowns and closes only through Escape or Close. Once
  in, most draws stay in. Counting from the Hop that opened it to the one
  that closed it, route 1 spent all of hops 10 to 27 there, 18 Hops,
  closing it at hop 20 and opening it again at hop 21; routes 2 and 3 spent
  8 and 11. Weighting away from the controls just used, as above, is the
  remedy this item already describes.

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

### 1.16 What the engine asks of a consumer's Playwright

Asked on 2026-09-29 to be followed up, together with the same question for
Electron, after reading what RStudio's end-to-end test package would meet if
it took the engine. Electron's half closed on 2026-10-01, when the peer was
removed; `HISTORY.md` has it.

**Playwright.** The engine asks for `@playwright/test` at `~1.63.0`, and
RStudio's test package pins `1.61.1`. The engine calls Playwright's API at
run time, so an open range is not safe: which features it uses that 1.61
lacks, if any, is unmeasured. Either the range widens to what is measured
to work, or a consumer upgrades.

### 1.17 Bringing the command palette back

Tools > Show Command Palette is excluded for now, on 2026-09-29, and was
agreed to be revisited rather than left out for good. The palette offers
nearly every command again as an option, and exclusions written against
menu paths and control names do not reach those copies. When a Route opened
it, Crash RStudio Desktop, Quit, screen reader support, a new session and
the setting that brings native dialogs back were all in it.

Bringing it back needs the exclusions to reach its options. One way is a
predicate matching an option to the menu command it copies, so that one list
still covers both. The palette appends a command's shortcut to its name, as
in "Quit the Current R Session CtrlQ", so a match on the exact name would
not work.

### 1.18 A finding that reproduces on another machine, and after a change

Asked on 2026-09-30, after asking whether one seed takes the same Hops on
two machines with the RStudio adapter, close to how it was put: "We want
this to reproduce. Most likely users will have different versions of R,
etc. even if they use the same version of RStudio. Also, if a product
change is made, like a bug fix, we'd want to reproduce the steps." The
same day it became a requirement, `PRODUCT_REQUIREMENTS.md` R12, a Must,
which also records that the seed is deprecated as the way a finding is
reproduced if something else does it. How is not decided.

**A seed cannot do it, and `PRODUCT_REQUIREMENTS.md` R8 says so:** a seed
is only meaningful against the build it was recorded on, and the journal is
the durable record. A Hop's draw picks a position in the pool, so anything
that changes the pool sends it to a different control, and every Hop after
diverges. On RStudio, what can differ between two machines running the same
release:

- **R and its packages.** The Packages pane lists the machine's R library,
  and its checkboxes are in the pools: the batch of 2026-09-29 drew
  `yaml`, `stringr` and `splines` among others. The Route's own library,
  `R_LIBS_USER`, adds to the machine's rather than replacing it, and since
  2026-10-02 the person's own library joins it by default, so whatever each
  person has installed is in the pools too.
- **The fused copy,** which each person makes from their own install.
- **The engine, the adapter and the Fix,** any of which changes what is
  offered; the journal records the Fix's fingerprint and 1.13 lists
  recording the versions.
- **Timing.** Whether an action lands or is abandoned depends on the
  machine's speed, and so does which Hop a background error is charged to,
  which `DEFECTS.md` carries.

On one machine replay has held: a replay of `68b1f1210035` retraced its
Route to hop 18, and one of `d6062ec45fa3` failed on the same line at the
same Hop. Across two machines it has never been measured.

**Notes, a reading and not a decision:**

- **Replaying from the journal is the proposed answer to both cases.** Each
  Hop's line records its target as role, name and `nth`, a menu path or a
  key, with the value typed. A replay could act on those by name, the way a
  Fix's `act` step does, instead of drawing, so a different pool no longer
  sends it elsewhere as long as the control is there. Where a control is
  missing, renamed or disabled, the replay stops and names the Hop, which is
  R14's comparison of what was recorded with what is on screen now.
- **After a fix, it is how the fix is checked.** Replaying the failing
  Route's journal on the fixed build runs the same checks on the same steps;
  the finding gone, with every Hop landing, says the fix holds on that path.
  A Hop that did not land says the replay proves nothing, and must say so
  rather than read as a pass, which is R13.
- **2.9 needs the same thing,** since a shortened Route cannot come from the
  seed either, and the language-model mode `PRODUCT_REQUIREMENTS.md`
  section 4 describes would replay this way too.
- **What it inherits:** `nth` shifts when a matching control appears earlier
  on the page, and a name can change while a Route runs, both noted in
  1.14. A finding that arrived late is no longer charged to the Hop the
  checks ran after, since 2026-09-30: the failure lists the steps before
  it, and those, not the Hop the Route ended on, are what a replay or a
  shortening has to cover.
- **The seed can still be made to travel further,** separately: giving each
  Route an R library of fixed contents in place of the machine's, and
  recording R's and the packages' versions on the opening line, would make
  more of a seed's pools match. Whether RStudio can be pointed at such a
  library is unmeasured.

**Decided on 2026-10-02: replay from the journal,** built as `phileas replay
<journal file>`, with the seed kept for rerunning within one testing
session, in the words that came with it: seed "_is_ useful for rerunning
during testing sessions." Proposed with four questions, each answered from
the options offered:

- **A replay runs the Fix, then acts on each recorded Hop in order**, by its
  target, with the checks after each as usual. It ends in one of three
  outcomes, never a plain pass: reproduced, the finding came back; not
  reproduced, every Hop landed and it did not, which is how a fix is checked
  on that path; and could not replay, a target was not on screen, where it
  stops and names the Hop and what was there instead (R14). The finding being
  replayed is set aside from the known findings, or a replay of a filed one
  would carry straight past it. These were proposed and not questioned;
  the four below were asked.
- **Matching: exact first.** A target's role, name and position must match.
  A mismatch is a could-not-replay naming the Hop, and the rule loosens only
  where a real replay shows the need. Chosen over falling back to the name
  when the position is off, and over fuzzy matching.
- **The Fix: its steps are recorded in the journal,** so a replay needs the
  journal and not the consumer's current Fix. Chosen over running the
  consumer's current Fix with a warning when its fingerprint differs, and
  over refusing.
- **Code steps, decided the same day** by taking, in the words it was put,
  "the agent's recommendation": a review of the options by a second model,
  ranked, after a `code` step was found to be Playwright code that a journal
  cannot hold. Four of RStudio's five Fixes, two of Positron's four and
  one of the rail demo's two have code steps: 16 written, 9 in RStudio's,
  6 in Positron's and 1 in the rail demo's, counted from the source on
  2026-10-02.
  - **New step kinds, so that most of what code does today is data the
    journal holds whole:** `wait`, for text or a target, with a timeout;
    `press`, any key, where an `act` step reaches only the keys a survey
    offers; and `insert` or `type`, text into whatever has focus. And an
    `act` step may name its target as data, role and name or a pattern and
    position, which answers 2.7 and 2.11. RStudio's 9 code steps run as
    11, since `session-data` runs one for each of three lines, and the
    review found all 11 expressible this way: waits, keys and typed text.
    Some of Positron's, which click inside a dialog through chained
    locators, stay code.
    A kind is added only where a Trip Hop could in principle do the same and
    a person could by hand.
  - **A replay acts from the journal only.** A `code` step it reaches is
    refused by default, by name. `--with-current-fix` runs the consumer's
    code step of the same number and label; the replay then says how many
    steps ran from the current Fix, refuses a step whose recorded source
    text differs from today's, and stops as could not replay where a step
    changes the screen differently from its recording (R31's effect). That
    last is evidence that does not rest on the Fix's fingerprint, which the
    review found weaker than it looks: it hashes the Fix function's own
    source, `fixFingerprint` in `src/journal.ts`, so a constant outside it,
    such as the text `r-markdown-further` inserts, or a branch on the
    application's version, as Positron's `session` Fix takes, changes what
    runs and leaves the fingerprint the same.
  - **Built first, whatever else lands:** each `fix-step` line records its
    kind, an `act` step's target as data and any value beside its label,
    and a `code` step's source text with a hash of it; and `phileas show`
    prints the kind. Today a journal cannot tell an `act` step from a
    `code` one, so no replay could tell which lines it may act on.
- **How far: a flag decides.** By default to the step where the finding
  arrived, plus a few Hops for one that arrives late; `--whole` replays every
  recorded Hop.
- **Proved first with another R on this machine:** a recorded RStudio finding
  replayed under R 4.4.3, installed with rig, in place of 4.6, which is the
  case R12 names without a second machine.

### 1.21 Surveying every window the application opens

Made a requirement on 2026-10-02, `PRODUCT_REQUIREMENTS.md` R33, a Must, in
the words "floating windows should be surveyed". It was a line of 1.9 until
then.

**What a Route does today.** It surveys one window, the page the adapter
selects, and clicks inside that page only. Playwright sends a click straight
into a page whatever the operating system has stacked over it, so another
window never counts as covering anything. Measured on RStudio the same day,
seed `898df070194f` with the `r-markdown-further` Fix, a Route of 10 Hops
run with windows shown: hop 5 chose Show in new window, which floated the
document in a window of its own over the main one, and hops 6 to 10 clicked
controls behind it. Those clicks are legitimate under R32 as widened that
day, since a person reaches them by moving the floating window aside or by
clicking the main window, which brings it to the front. What is missing is
the other side: nothing in the floating window was ever offered.

The first of RStudio's recorded bugs starts in a second window too, its plot
zoom window. How many windows either IDE opens is unmeasured.

**To decide when it is designed:** how a Route learns that a window opened
and closed; whether one pool spans every window or a Hop first draws a
window; how the journal names which window a target was in, so replay finds
it again; and what the checks read in a second window.

**Giving a new window priority, wanted later and not decided.** In the words
it was put, "at some point, I'd even say given priority (another thing
related to weighting)". That would weight the draw toward a window that has
just opened, which belongs with weighting the draw toward new targets, 1.14.

### 1.23 The menu bar: chance, flat, and uncontained

Raised on 2026-10-03, after measuring Positron's menu bar, in the words "I
think we need to do something about menubars", and agreed to be recorded
with the proposal below. The order of its parts is not decided.

**What was measured, on Positron 2026.09.1.** Its application menu holds
226 entries a person sees in the menu bar, at every level. With the Route's
window hidden it has no focus, and only 18 are enabled, which leaves 6 on
offer after the standard entries and the adapter's exclusions: 8 of 9
recent Routes were offered 6. One Route of the 5×500 Journey, seed
`d5665b418361`, Route 2, was offered 157 at its first Hop, rising to 186:
its window had focus, from outside the engine. Its replay was offered 6.
`DEFECTS.md` has that as a defect. A probe that made `getFocusedWindow` and
`isFocused` answer for the hidden window and sent it its `focus` event
enabled 195, and View > Run, disabled before, then ran; the window stayed
hidden.

**Three problems, from that:**

- **Which menu a Route gets is chance,** as above, so it decides where a
  seed goes on one Hop in eight.
- **The full menu is flat.** 157 to 195 entries share the menu's eighth of
  the draw evenly, so View > Appearance > Render Whitespace > Set Render
  Whitespace to Selection is as likely as File > Save. 75 of the 157 sit
  inside submenus, 52 three levels down and 23 four. View alone holds 70.
  Of Route 2's 64 menu Hops, 13 changed the screen.
- **The containment never met it.** Route 2 drew Help > Toggle Developer
  Tools, View > Editor Layout > Move Editor into New Window, Help > Show
  Release Notes, Help > Positron Documentation, File > Save As... and Save
  Workspace As..., none of which Positron's exclusions had seen, since none
  is among the 6.

**Proposed, the parts agreed to be recorded, not yet ordered:**

- **A. The engine claims focus for each Route's window,** in every window
  mode, so the menu is the same on every launch. It lands only with B and
  C, since alone it makes the other two problems every Route's.
- **B. Positron's full menu is reviewed against its exclusions** first, from
  one listing of every entry: new windows, developer tools, the network,
  quitting and restarting.
- **C. The menu is drawn as a person opens it:** a top menu first, then an
  entry within it, a level at a time, so each top menu has an equal chance
  and a fourth-level entry is rare. A chooser behind the choosing seam, and
  still a seeded draw; 1.11's shares are the related question.

**An option, not proposed:** D, offering the menu bar only to an
application that asks for it, for one whose menu mostly repeats its page,
as Positron's View > Explorer repeats the Explorer tab.

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

**The trigger to revisit fired on 2026-10-01**, when the editor's adapter was
decided to move into the editor's own repository, installing the engine as
a git dependency rather than by `file:`. A reading, not confirmed: it does
not force publishing, because a git dependency reaches the engine from any
repository under the same ownership, so what this rests on becomes that
every consumer can reach this repository by git.

**The repository itself is public, which is separate from publishing the
package.** GitHub reports it public, and its event log puts the change at
the second it was created, 2026-09-21. Said on 2026-10-01: "It's public
temporarily, it'll be back to private soon." A git dependency still
installs once it is private, over the machine's own GitHub access; the
measurement on 2026-10-01 already went through SSH.

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

Noticed 2026-09-24 and recorded unraised; nothing is decided. A Fix's `act`
step on `button "X"` acts on the first control whose survey line matches, in
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
- **The last Hop is not always where the cause is.** Since 2026-09-30 a
  failure says when its finding arrived and lists the steps before it: the
  measured case arrived five Hops after the click that caused it. The last
  few Hops before the arrival, not before the Route's end, are the ones to
  keep.
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

Raised 2026-09-27; nothing is decided. A Fix's `act` step takes a line as
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

### 2.12 A change RStudio could make so its second copy stays in the sandbox

Noted on 2026-09-29, when asked to "make a note" of it; whether to raise it
with RStudio's developers, and how, is not decided. RStudio Desktop starts a
new session by launching a second copy of itself, in `launchRStudio` in
`src/node/desktop/src/main/application-launch.ts`. The copy is given the
environment but an empty command line in a release build, so a
`--user-data-dir` the first copy was started with does not reach it, and
Electron's data folder can be set no other way. The copy then writes into the
real `~/Library/Application Support/RStudio`.

The change would be for `launchRStudio` to pass its own `--user-data-dir` on
to the copy when it was given one. Nobody starts RStudio with that switch in
ordinary use, so nothing changes for a user. It matters to anything that
points RStudio elsewhere: RStudio's own end-to-end sandbox has the same gap,
unseen only because no scripted test opens a new session. The engine does not
need it, since `stubSelfLaunch` starts no copy at all; it would matter if
the second session's startup were ever to be tested rather than stubbed.

### 2.13 Working in a repository shared with other people

Asked on 2026-09-30: "What to do if the RStudio adapter and Phileas are in a
shared repo with other people. How would we coordinate things like known
findings and new Fixes?" Recorded as open on request; nothing is decided, and
what follows is a proposal made in answer, not agreed.

**Known findings rewrite a committed file by themselves.** Every Journey's end
adds its new findings to `known-findings.json` as unfiled and re-signs the
entries already there. With one person that is bookkeeping; seen on
2026-09-29, every run from the main checkout changed the committed copy. With
several, every local run is a diff, and two people's diffs to one JSON array
conflict. Proposed, in this order:

- **A Journey writes only to a local, ignored pending file.** The committed
  file changes only through `phileas known add`, `dismiss` and `remove`, in a
  change someone reviews. The queue of unfiled findings could then live in
  the issue tracker, which reviews by design. This is the one to build first.
- **One file per finding**, such as `known-findings/<id>.json`, so two people
  recording different findings never conflict.
- **Re-signing that merges two entries is reviewed,** since signatures strip
  what differs between machines, `<user>`, `<profile>` and ids among it, and a
  merge is only right when the two were the same finding.

**Editing a Fix moves everyone's seeds.** A seed replays only against the Fix
it ran with; the journal records a fingerprint of the Fix's source, so an edit
shows, but a recorded failing seed someone else relies on stops reproducing.
The adapter's exclusions do the same, since they change what is on offer.
Proposed:

- **Treat a Fix as a public function:** add a new named Fix rather than edit
  one that has pinned seeds, and review Fix changes as code.
- **Pin the seeds that matter as tests,** as the guided demos check theirs, so
  an edit that moves one fails instead of passing quietly.
- **Record the engine's and the adapter's version on each journal's opening
  line,** which 1.13 already lists as toolchain versions; shared, it stops
  being optional.

**Around both:** a finding needs everything that reproduces it, the seed, the
Fix, both versions, the application's version, and the fused copy each person
makes; and Journeys do not gate pushes, so someone has to own triage or the
queue only grows.

### 2.14 Two things RStudio did in the batch, not explained

Seen in the RStudio batch of 2026-09-29; neither is measured.

- **A native Open File dialog, with web dialogs on.** The no-Fix Journey's
  Route 1 pressed ⌘O at hop 28, the shortcut printed in "Open an existing
  file (⌘O)", and the native-dialog stub caught a `showOpenDialog` titled
  Open File. The stub answered it, so nothing reached the screen. Why the
  shortcut goes to the native dialog while the adapter keeps web dialogs on
  is not known. It matters because a finding on that path would not be one
  a person reaching Open File from the menu meets. **It does not happen
  every time:** on 2026-09-30, seed `5ffa0a79c44c`, Route 1 pressed the
  same printed ⌘O at hop 43 and got the web Open dialog. The stub caught
  nothing, and hops 44 to 49 acted inside it, its File name box, folders,
  Open and Cancel all in their pools. What differed between the two
  presses is not known; which control had focus is one candidate, and
  unmeasured.
- **R sessions left running after a close.** In 5 of one Journey's 20
  Routes, RStudio left `rsession` and a terminal's `bash` running after it
  closed, and the stray sweep ended them. The sweep's printout was not kept
  and the journal does not record it, so this rests on the run's output as
  read at the time. Whether they would have exited by themselves, as
  `HISTORY.md`'s entry of 2026-09-28 already asked of one R session, is
  unmeasured.

### 2.15 Printing one Hop's whole pool

Raised on 2026-09-29 while reading the batch's journals; nothing is decided.
`phileas show` prints what each Hop acted on, and not what else it could
have acted on. The journal holds that: each Hop names its pool, and each
distinct pool is written once. So an option to print one Hop's whole pool
needs nothing new recorded. Until then, `jq` on the journal reaches it.

### 2.16 Reading journals for what no check asks

Raised 2026-09-30, from the Bobolink Editor bug `HISTORY.md` records the
same day: a Route passed, no check fired, and a person reading its journal
saw a second dialog open over an unanswered question. Asked to be kept as
"a way of checking Phileas, beyond pre-determined checks like error
messages."

What it would be, and what is open. A check knows in advance what to look
for; a reading of the journal can notice what nobody wrote a check for,
such as a sequence of dialogs, a heading that never goes away, or a control
that stays covered. Nothing is decided: who or what reads (a person, a
model, or a set of rules over the journal's lines), when, and how a reading
becomes a finding someone can file and a Route can later carry past.

**One constraint, an inference and not confirmed:** a reading cannot be a
check inside a Route. `../CLAUDE.md` requires a check's verdict to be
reproducible from the seed, since the first violation ends the Route, and a
reading by a person or a model is not. So it would run over a Journey's
journals after the Journey, beside the checks rather than among them. A
pattern that a reading finds more than once could then be written up as a
check of the adapter's own, where it can be made deterministic.

### 2.17 Typing into a document editor empties the whole document

Seen 2026-09-30 on Bobolink Editor, in a 100-Hop Route. A `type` Hop empties
its field and then presses one key per character, and in a document editor
the field is the whole document: at hop 15 the welcome note's entire text
was replaced by `2`, and every Hop after it explored an almost empty page.
A person can do the same, by selecting all and typing, so it is not wrong;
it is a costly move to make at random, and it happens every time a Route
types into the editor. Nothing is decided. Ways on: typing at the caret
without emptying, in a large text area or always; or an adapter saying
which fields to type into without emptying.

### 2.18 Routes reach the real clipboard

Seen 2026-09-30 on Bobolink Editor, in a 100-Hop Route: at hop 22 it chose
Export's Copy, which writes the document to the system clipboard from the
editor's main process. The engine skips the menu bar's standard Cut, Copy
and Paste, and nothing else: any control an application wires to the
clipboard itself reaches the clipboard of whoever runs the Journey, in
every window mode. Bobolink Editor's own Edit menu, drawn in the page, has
Cut, Copy and Paste that do. Copy and Cut overwrite what that person
copied, and Paste puts it into the application, which is state from outside
the seed that a replay cannot reproduce.

**To be solved in the engine, not per application,** in the words it was
settled with: "don't create a one-off Editor version of this." An exclusion
list in each adapter would need every application's names in advance and
would give up exploring copying and pasting at all.

The shape proposed, not decided: a clipboard of each Route's own, put in
place the way outbound links and native dialogs already are, so copying
and pasting are still explored, the real clipboard is never touched, and a
Paste only ever returns what that Route copied, which keeps replay exact.
That reaches the main process's `clipboard` module, which is what Bobolink
Editor uses. The page's own ways to the clipboard, `navigator.clipboard`
and the editing commands, are separate and not measured.

### 2.19 Checks of Bobolink Editor's own

Raised 2026-09-30, when the editor's adapter declared no checks and every
defect found in it came from reading journals (2.16) and one trace.

**One exists since 2026-10-01**, in the editor's own adapter:
`one-dialog-at-a-time`, which fails a Route when two modal dialogs are open
at once. It caught the dialog opened over an unanswered question on a
replay, and the editor's `docs/HISTORY.md` has why it is the editor's rule
rather than the engine's.

Candidates still open, none chosen, each from the application agreeing with
itself rather than from its code, as `AppCheck` requires: the Table of
Contents listing the same headings as the document, and a window's own
frame buttons never covered by the page's own furniture, such as the notice
line over a collapsed window.

### 2.20 RStudio runs menu commands behind its own in-page dialog

Seen on 2026-09-30, seed `5ffa0a79c44c`, one RStudio Route of 100 Hops with
no Fix; nothing is decided. Three times, a Hop chose a native menu command
while RStudio's in-page Save or Open dialog was open: hop 49, Help >
Accessibility > Focus > Move Focus to Terminal, and hops 80 and 99, Help >
Diagnostics > Write Diagnostics Report. The dialog was open each time, since its File name box,
folders and Save or Open and Cancel buttons were in that Hop's pool. At
least one command really ran: hop 80's report opened its folder, which the
stub caught 0.6 s after hop 80's line was written, on hop 81's.

**A reading, not confirmed:** RStudio executes native menu commands while
one of its own modal dialogs is up. A person can do the same, since the
native menu stays usable, so it may be intended; if it is not, commands
acting behind a dialog are a class of RStudio bug the engine reaches and
has no check for. The engine cannot tell which. Nothing stops the menu
source being drawn while a dialog is open either, which 1.10 covers for the
page and which is the same question for the menu. Open: whether the menu
should be withheld while an in-page modal is up, as the survey reads only a
native modal dialog, and whether RStudio's behavior is worth asking its
developers about.

**Whether a person meets it, a reading and not measured,** added on
2026-10-02. The trial turns RStudio's native dialogs off, which is what
puts an in-page dialog beside a live native menu bar. On RStudio Desktop a
person meets that only with Global Options' "Use native file and message
dialog boxes" turned off, which is uncommon; the trial turns it off only
so that Playwright can reach the dialogs, and in the words it was put,
"Otherwise I'd leave it on." RStudio Server has only web dialogs, so it may
be a real path there, but its menu bar is drawn in the page too, and
whether that menu can be reached while a dialog is open has not been
measured.

**Positron, and whether to treat a dialog not marked `aria-modal` as one,**
added on 2026-10-03. A Positron Route, seed `d072060d2415`, spent its last 43
Hops in New Folder from Template, a `role="dialog"` not marked `aria-modal`,
so the survey read the whole page: the controls behind it were covered and
left out, but their printed shortcuts were offered, and all 27 drawn changed
nothing. Those shortcuts now leave the draw under a dialog, and `HISTORY.md`
has it. Two menu Hops drawn there changed nothing either, File > New Text
File at hop 62 and About Positron at hop 98, where RStudio's menu commands
have run behind its in-page dialogs. Not decided: surveying a visible
`role="dialog"` alone, as a native or `aria-modal` one is, which would also
withhold the menu bar and everything behind it. Two measurements would
decide it, asked to come first on 2026-10-03:

- **Whether menu commands act behind such a dialog,** on each application:
  menu Hops drawn while a dialog covered the page, and whether each changed
  the screen or set off a stub. Most of it is in the journals already, as a
  pool whose covered controls are under a dialog.
- **Whether any application uses `role="dialog"` for something that leaves
  the rest of the page usable,** a panel beside the work rather than over
  it. One such case rules out treating the role as modal by default. Needs
  a probe per application, or the pool recording that a dialog was showing.

### 2.21 This repository's history keeps the editor's adapter and findings

Raised 2026-10-01, when the editor's adapter was decided to move into the
editor's own repository. Moving the folder leaves everything already
committed here in this repository's history: the adapter, and the defects
found in the editor, which `HISTORY.md` and `../ORIENTATION.md` describe.
The editor's repository is private, and this one is public for now.

**A rewrite would not finish the job.** Pull requests 72 and 77 changed
files in `trial/editor/`, and almost every pull request since 2026-09-30
touches `HISTORY.md` or `../ORIENTATION.md`. GitHub keeps each pull
request's commits under references a force-push does not touch, so the old
commits stay visible through those pull requests until GitHub Support
removes them. Measured the same day: no forks, and 238 clones from 103
sources in the previous 14 days, whose owners GitHub does not say.

Said on 2026-10-01: "let's not worry about this cleanup for now." Whether
to clean it up later is open.

### 2.22 More than one Fix in a Route

Raised on 2026-10-02, while writing RStudio's `zoomed-plots` Fix, as "Could
we adapt the engine to have multiple Fixes in one Route?", and asked to be
kept as something to consider, in both of the meanings below. Nothing is
decided. Different Fixes for different Routes of one Journey is a separate
question, 2.4.

What works today: a Fix is a function, so one Fix can run another before
its own steps, and each step is journaled; the journal's fingerprint covers
only the outer Fix's own source.

**Several Fixes one after another, before the Trip.** For example `--fix
script,zoomed-plots`, a script opened and then the Plots pane zoomed. A
reading, not a decision: a small change in the engine. The Fixes run in
order as one opening, the journal records each one's name and fingerprint,
and a failure names the Fix that broke, so R11 still holds. The Trip keeps
its own stream, so a seed's Trip is unaffected by which Fixes ran before it,
though what the Trip finds on screen is not.

**Fixes partway through a Route**, a Fix, then travel, then another Fix,
then travel again. A reading, not a decision: a larger change, to what a
Route is. A later Fix would run after unpredictable travel, so its failure
is no longer a clean finding that the setup broke, which is what R11 rests
on; it might be a bug the travel reached. And the Trip's stream would need a
split per stretch of travel, or editing one Fix would move every draw after
it, the hazard `../CLAUDE.md` gives for splitting each Route's seed in two.

### 2.23 One error seen by several checks counts as several findings

Raised on 2026-10-02 by a Positron Route of 100 Hops, seed
`64156c12293c`, which failed at hop 56 on a new finding, asked as "there
were three possible new errors?", and asked to be recorded. Nothing is
decided.

One click on Remote Explorer's Configure failed once. The extension printed
the error to the console, wrote it to its log, and Positron showed it as an
error notification, so the console, log and notification checks each made a
finding of it, with a signature and id of its own: `643cb31a`, `c1b4b0ef`
and `fb1bc714`. The run reported three new findings, and filing them took
three `phileas known add` calls against one issue, ronplusron/phileas
issue 87.

**Notes, a reading and not a decision:**

- **What would group them.** They arrived within half a second of each other
  on the same Hop, and two carry the same message text. Neither is safe
  alone: two real bugs can arrive on one Hop, and the log line words the
  error differently from the console.
- **Grouping is for reporting, not for matching.** Each check still needs
  its own signature, since a later run may see only one of the three, and
  that one should still be recognized as known.
- **It is not the open question of one defect on several Routes,** in
  `PRODUCT_REQUIREMENTS.md` section 11. That is one bug met many times;
  this is one meeting seen many ways.

### 2.24 What else of the person's R setup an RStudio Route sees

Left open when RStudio Routes were given the person's own R library on
2026-10-02, which `HISTORY.md` records. Nothing is decided.

- **Recording the library on each journal's opening line,** with how many
  packages it held, so a journal says what its Route could see. It needs
  the engine, and waits on recording versions there, 1.13.
- **Whether `~/.Rprofile` and `~/.Renviron` come in too.** A Route reads
  neither, since its home folder is its own. They can change anything R
  does, so bringing them in would make a Route depend on the person running
  it in ways a library list does not.

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
