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

`DEFECTS.md` is what is wrong: one entry, which phase 5 closes.

## 1. Agreed, not built

### 1.1 The engine

Everything in `PLAN.md` from phase 5 on, after the work `PLAN.md` lists as
coming before phase 5. Phases 0 through 4 are done and
`HISTORY.md` records them: the toolchain, the launch layer lifted and
hardened, a packaged application it can launch, the seeds that make a run
reproducible, and the Routes that travel through it and write down where
they went. What is unwritten is every check: nothing yet judges whether anything
a Route found is wrong.

### 1.2 Planted defects, and the applications still to build

`testbed/buggy` exists and is structurally ordinary on purpose. **No defects
are planted in it yet**, and until they are, nothing here shows the engine
finds anything. `PLAN.md` plants them across phases 5, 6 and 8.

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
and why. Two things stayed open.

**An assessment to make: different likelihoods per common key.** Up, Escape
and Enter could be drawn more often than Tab or the other arrows. Fixed
weights would keep replay intact, being part of the seeded draw. Not done yet,
because nothing measured says one key finds more than another, and weights
chosen without that are guesses about where bugs are. Assess it once Journeys
on a real IDE have run: if a key-only behavior, such as console history on
Up, is being reached too rarely, the journals are the evidence to weight from.

**Moving through a native dropdown by keyboard is unmeasured.** `select`
chooses an option directly and never opens the list. The arrows are now
pressed on whatever has focus, including a focused dropdown, and whether they
change its choice on macOS has not been checked.

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
  shortcut shown nowhere on screen, which the keyboard work leaves to a map. It
  could
  annotate candidates discovery already found. Or it could steer the draw,
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

**RStudio.**

- **Launch:** the release build ships hardened, so the engine gets in only over
  the debugging port, which reaches no main process: no link stub, no hidden
  windows, no menus, no main-process checks. The first of its three recorded
  bugs is a main-process exception that path would travel straight past. The
  remedy is building it from source without the hardening, the second
  deployment shape. It is heavy, and it is a cost rather than a wall. Its
  source is AGPL: build it and test it, and copy nothing from it.
- **Discovery** reaches its toolbars, menus, dialogs and panes, which are well
  named: 80 of the 84 elements found by role on the resting screen carry a
  usable name. It stops at the console, the
  source editor, the data grid and the visual editor.
- **All three of its recorded bugs sit in the reachable part** -- a plot window
  left open while quitting, a dismissed summary returning on pagination, a
  preview that fails silently on a fresh profile -- and its scripted suite
  missed all three. That is the case for it.
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
- **In phase 5, where `PLAN.md` already has them:** native dialogs, and bugs
  that happen on quitting.
- **At RStudio's turn, after phase 9:** the debugging-port launch, or a build
  from source.

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
  engine's types and has never been built. For RStudio the chosen remedy is a
  build without the hardening instead, and how hard that build is has not been
  measured. Whichever way in, each Route needs its own Electron profile,
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

### 1.10 Default exclusions for the menu entries every Electron application has

Raised 2026-09-23. Writing an adapter for trickster-tales meant excluding, by
hand, the standard menu entries Electron gives every application: Quit, Hide,
Hide Others and Services; Reload and Force Reload; Toggle Developer Tools and
Toggle Full Screen; Minimize; Show Substitutions; Start and Stop Speaking; and
Cut, Copy, Paste and Paste and Match Style, for the reasons `HISTORY.md` gives
under the clipboard fix. Every adapter for every application would otherwise
write the same list, and one that forgot an entry would find out from a Route
that quit, reloaded, spoke aloud or read the clipboard.

**Agreed 2026-09-24, and not yet scheduled:** the engine excludes these by
default, and an adapter can allow any of them back. Two things the agreement
carries with it. A menu candidate carries its label path and not the role
Electron built it from, and labels include the application's name (`Quit
Trickster Tales`), so the default matches by role, which the menu source will
have to read. And a default the engine applies is an input to the seeded draw,
so every default exclusion is written in the journal the way the adapter's own
are, never applied silently. `buggy`'s adapter excludes its own clipboard
entries in the meantime.

### 1.11 Dialogs that are not native modals

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

Undecided, including how a Route would be given its Fix. The constraint is the
one `../CLAUDE.md` puts on the planner: it may decide how many Routes there
are, and never what they explore, so whatever assigns a Fix must not become a
judgment about where a Route should go. Several Journeys, each with its own
Fix, already give a coarser version of the same thing, which 1.8 relies on
for Positron.

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
