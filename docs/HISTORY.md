# Phileas -- what has landed, and why

Work that is done, with the reasoning and the measurements behind each piece
of it.

**Nothing here needs reading to start work.** It is the record, not the brief.
`../ORIENTATION.md` is short on purpose and says what a session needs;
`OUTSTANDING.md` is what has not been settled; `DEFECTS.md` is what is wrong.

**What belongs here:** a change that shipped, a bug that was closed, a
measurement that settled an argument, and a decision taken with the reasoning
that produced it.

**What does not:** anything still open, which belongs in `OUTSTANDING.md`, and
anything a session needs in order to run the software, which belongs in
`../ORIENTATION.md`.

**An entry here should stand on its own.** `OUTSTANDING.md` is a moving
target: its items are renumbered when neighbors close and deleted outright
when they are settled. Name what the question was, not where it was filed.

**Most of what follows is reasoning rather than shipped code**, because almost
nothing is built. The design decisions below each cost a real argument, and
re-deriving them would cost it again.

---

## 2026-09-22: phase 2, and the first thing in this repository that runs

`testbed/buggy/` is a packaged Electron application with a list, a
count above it, a search box with a clear, two views, a native menu holding
Quit, an outbound link, and a total derived from a data file it ships. No
defects are planted yet. Six tests under `tests/` hold up the phase 2 boundary
and all pass in 1.8 seconds: it launches the packaged bundle, the staleness
guard runs and says so, it refuses a stale bundle naming the file that
differs, a broken readiness hook reports the application's own message rather
than timing out, no window reaches the screen, and the outbound-link stub
demonstrably took effect.

**The stale-bundle test carries its own positive control.** It edits a
packaged input, asserts the guard throws naming that file, restores it, and
asserts the guard passes again. Without the second half, a guard that always
threw would look identical to one that works.

**The guard then caught a real one, unprompted.** A pass renaming `examples`
to `testbed` changed a comment in `main.cjs`, and all six tests failed at once
naming that file. Nothing about the edit was meant to touch the application,
and the working tree and the bundle had genuinely diverged. That is better
evidence than the planted case, because nobody arranged it.

### The directory is `testbed/`, not `examples/`

The scaffold called it `examples/` from the start, and that was wrong in a way
nobody had noticed: `examples/` tells a reader the contents are optional
sample code, while `OUTSTANDING.md` says this application "is not an optional
extra and should not be treated as a late nicety" and is the only thing that
will ever show the engine finds bugs. The name pointed away from the most
important verification asset in the repository.

What settled it was working out what the directory eventually holds. Not one
application but several, each deliberately awkward in a different way: a build
with the Electron fuses disabled, a virtualized list that renders twelve of
forty rows, a canvas-backed surface with no roles to discover, a dismissed
widget that still takes keystrokes, a native dialog that blocks the main
process. None of those is an example of anything. They are apparatus.

`testbed` was taken over `testapps` for two reasons. Each entry holds more
than an application -- a `phileas/` directory of adapter, journeys and spec,
which is the consumer layout a real repository gets -- and `testapps` names
only half of that. And `app` is the word `../CLAUDE.md` already records as
having caused a real misreading against "the application".

Rejected along the way: `fixtures/`, which collides with `src/fixtures.ts`;
`controls/`, which collides with the UI controls these documents discuss
constantly; `checks/`, which collides with the invariants; and `coverage/`,
which names a stated non-goal.

### The application is `buggy`

Named for the one thing that distinguishes it from every sibling that will
join it. It is structurally ordinary: plain DOM, one window, every control
carrying an accessible name, a list that renders all of its rows. The ten
planted defects go into it, so the claim its tests make is that the engine
FINDS bugs.

The siblings coming later are the opposite shape. Most are correct
applications built awkwardly on purpose -- a virtualized list, a canvas
surface, disabled fuses, a splash window -- and the claim their tests make is
that the engine COPES without producing a wrong answer. A failure there means
the engine is wrong; a failure here means the engine missed something.

`Passepartout` was taken first and then dropped within the hour. The argument
for it was real: the fixture never ships, so the rule in `../CLAUDE.md` that
the theme is fully spent protects a legibility that was not at stake. What
killed it was the sibling list. Nine descriptive names and one character
reference reads as an accident, and the name said nothing about why this
application is the one holding the defects.

Also considered and rejected: `specimen` and `subjects`, which name what the
thing is rather than what was done to it; `defective`, which implies an
application that does not work, when this one runs correctly and merely
contains faults; and `seeded`, which collides with the seeding machinery in
every reproducibility requirement the product has.

### Two findings that outlast the phase

**A hop must not wait for navigation.** Clicking the outbound link with an
ordinary Playwright click hangs for the full thirty seconds. The link
schedules a navigation, the main process cancels it in `will-navigate`, and
the click waits forever for something already prevented. `PLAN.md` phase 4
carries it: one hop would otherwise consume a Route's whole time budget, and
the Route would report a timeout instead of what it found. It fires only on an
outbound link the exclusion list missed, which is the case nobody tests for.

**The `file:` dependency works, and the test is weaker than it looks.** The
example depends on the engine as `file:../..` and imports
`@drugstoresushi/phileas` by package name; npm symlinks it, and Playwright
resolves the TypeScript source through the link. That is the shape phase 9
gives a sibling repository. But the symlink here lands back inside this same
project, so it says nothing about whether Playwright transpiles a package
whose source sits outside the consumer's own tree, which is the real phase 9
question.

### The Electron binary, twice

`npm install` does not run Electron's postinstall in this environment, so the
types arrive and the binary does not, in both the engine and the example.
`node node_modules/electron/install.js` fetches it. Observed twice, and
recorded because the failure looks like a broken checkout and is not.

## 2026-09-22: phase 1, and the first engine code in this repository

The seven files were lifted from `trickster-tales` `e2e/kit/` byte-identical,
verified with `cmp`, in a commit of their own so the hardening reads as a
change against the original rather than being mixed into the move.
`AppUnderTest` went from 54 lines to an interface carrying the six missing
members, the exclusion list and R19's narrowing. `npm run typecheck` passes
over all of it.

### The lift found two bugs in `package.json`

**`electron` was missing entirely.** `menu.ts` uses the `Electron.MenuItem`
ambient namespace, which ships with the `electron` package, so the lifted code
could not compile. Phase 0 installed four dependencies and the plan scoped
`electron` to phase 2's example application, which was wrong: the engine needs
it in `src/` at compile time. The compiler was checked first, since a major
version nobody named had been installed, and it was not the cause: both
repositories are on TypeScript 7.0.2 and the same code compiles in the origin.

**Two runtime imports were filed as dev dependencies.** `bundle.ts` imports
`@electron/asar` and `fixtures.ts` imports `@playwright/test` as values.
Measured rather than assumed: a scratch consumer with a `file:` dependency on
this package installed `@drugstoresushi` and nothing else, so `bundle.ts` would
have failed at run time in phase 2, which is the phase that makes the example
the first such consumer.

`@electron/asar` moved to `dependencies`. `@playwright/test` and `electron`
became peer dependencies with dev dependencies alongside, because a second copy
of Playwright in the tree would hand a consumer fixtures from the wrong
instance, and because the consumer supplies the Electron binary.

### What the hardening decided

**An exclusion is a name or a predicate, and names stay first-class.** A
derived list can only ever be names, so keeping them primary preserves the
derive-and-check property that stops a hand-written list going stale. The
predicate is the exception, for the case a list cannot express: the shortcut
that closes an editor tab closes the application once no tabs remain.

**The fallback launch path is deferred and its reporting is not.** Neither
confirmed consumer needs the path, so building an untested one now would carry
dead code through six phases. But C1b was a stated constraint with no
mechanism, which is how a constraint quietly stops being true, so `LaunchedApp`
now records which path it took and `UNAVAILABLE_UNDER` says what each path
cannot check. The second implementation is then additive.

**The staleness guard returns a verdict rather than exiting quietly.** It had
two silent early exits, and a guard that did not run must never read like one
that passed. Both reasons now reach the caller: no sources to compare against,
which is C1a, and the switch that runs against a stale build deliberately.

**Source mode is gone rather than carried.** The lifted launch could run the
working tree instead of the bundle, and the guard does not apply to it, so a
green run in that mode says nothing about what ships. `resetApp` became
`reloadRenderer` and is no longer the per-Route reset, because main-process
state survives a reload and a Route starting that way inherits what the last
one left.

**The `E2E_` environment variables became `PHILEAS_`.** A consumer has an
end-to-end suite of its own, and a variable named for the category rather than
for the engine is one they cannot safely reason about.

### The install-timing measurement, and its control

The hazard recorded on 2026-09-21 would close at its source if the
external-link stub could be installed before the application's own main script
runs, because a handler that captured the function rather than the object would
then capture the recorder.

`NODE_OPTIONS=--require` does not reach a packaged Electron main process. A
preload that runs under plain `node` did not run under a packaged build
launched with the same variable, while the application launched normally. The
control ran the same preload and the same variable under plain `node`, and it
ran, which is what makes the absence a measurement rather than a clean zero.

**One route against one build, not every route.** So the net stays: the derived
exclusion list, the positive control in phase 2, and evidence in phase 5 that
does not come from the stub's own recorder.

### One thing phase 2 will hit immediately

`electron` installed its types but not its binary: `electron.d.ts` is present
and `dist/` is not, with no `ELECTRON_*` variable set to explain it. Phase 1
needs only the types, so nothing here is blocked. Phase 2 launches a real
Electron and will need the binary.

## 2026-09-21: the three questions gating phase 1, settled against real builds

All three were answered by measuring the two confirmed consumers and reading
the kit, rather than by reasoning from the documents. `OUTSTANDING.md` lost the
section that held them.

### How much `AppUnderTest` carries: all six members, every one optional

The plan had filed six missing members as the measure of what the two large
external candidates would additionally need. Measuring the confirmed consumers
moved two of them forward and added a seventh problem.

**Environment variables have a confirmed consumer today.** `editor`'s own
suite launches with `EDITOR_HEADLESS=1` and cannot run hermetically without
it. The interface has only `launchArgs`.

**Page selection is not an additive field.** It changes `waitForReady(page)`'s
contract, because the engine has to choose a page before it can call it.
Adding it later rewrites every adapter that exists by then, which is the
reason the whole set goes in now while no adapter exists at all. The other
four cost a few lines either way.

**`productName` is required and is wrong.** Its comment says it must match
`productName` in package.json. `editor` has no such field: the name lives in
`electron-builder.yml`. Its adapter would have to invent a value to feed two
derivations -- the dist directory and the executable name -- that are wrong
for it regardless. It stops being required and stops being the source for
either.

**Both bundle layouts were confirmed against built output**, not read from a
configuration file. `613-mitzvot` produces
`dist/613 Mitzvot-darwin-arm64/Mitzvot.app`, where the directory matches the
lifted default and the bundle does not, because `scripts/postbuild.sh` renames
it. `editor` produces `dist/mac-arm64/Bobolink Editor.app`, matching in
neither part. `bundleDir` is day one for both.

### Deployment shape: the second, and the guard's members group together

Default to adapters in a repository of your own, pointed at a checkout you
build. It is the only shape available for every candidate without anyone's
permission, and it keeps the staleness guard working. Approaching an external
project to accept a phileas directory is a conversation worth having after the
engine has found something.

The consequence for the interface came from reading what `repoRoot` actually
does, which is three separate jobs, two of them already being removed. It is
the base for the default bundle path, which `bundleDir` overrides on day one
for both consumers. It is the source-mode launch target, and source mode is
not carried over. And it is the base the staleness guard resolves
`packagedInputs` against, which is the only surviving job and is exactly what
C1a says is absent under the third shape.

So the three guard-only members become one optional object, named for the
checkout it points at. Absent means the guard cannot run and the run says so,
which turns C1a from a rule in prose into a property of the type and makes a
half-configured guard unrepresentable. Neither confirmed consumer has an
adapter yet, so the restructuring costs no migration.

### The three unplaced files are all engine, and one carries a hazard

`external.ts` and `menu.ts` were read rather than reasoned about: both import
nothing but Playwright's Electron types and hold no selector, view name or
other application knowledge. `menu.ts` earns its place on the argument already
in `../CLAUDE.md` -- the exclusion list exists for things like Quit, Quit is a
menu item, and an exclusion list naming one is meaningless unless traversal can
reach the menu. `editor`'s own suite reads `Menu.getApplicationMenu()` the same
way.

`fixtures.ts` is engine too, but "lifted, reshaped" understates it. Worker
launch becomes per-Route relaunch, the `page` fixture becomes the Route
fixture, `failOnPageError` dissolves into R19, and `freshApp` becomes the
default path. Almost every line changes, so phase 1's move-unchanged-first step
buys least there.

**Reading `external.ts` found a way for it to fail silently**, and `PLAN.md`
carries it as a hazard with the work that closes it scheduled across phases 1,
2 and 5. The stub reaches the application only because the application looks
`openExternal` up on the `shell` object at click time. An application that
captured the function at startup instead would keep Electron's real one, the
assignment would still succeed, a browser would open, and the recorder would
stay empty -- so "no navigation away" reports clean because its evidence went
somewhere else rather than because nothing left.

Measured before recording it: `trickster-tales:110`, `613-mitzvot/main.js:39`
and `editor/src/main/index.ts:55` all write `shell.openExternal(url)`. Three
of three are unaffected, so the technique is not broken. What is wrong is that
`external.ts` justifies itself by reading one `main.js`, and lifting it into a
framework carries that justification to applications nobody has read.

**The general rule it produced:** prevention and detection must not share
their evidence. The recorder was both the mechanism stopping a browser opening
and the only proof that none did. That is `../CLAUDE.md`'s oracle trap one
level down -- there a check must not share logic with what it judges, here it
must not share its evidence source.

## 2026-09-21: phase 0, and the first thing in this repository that runs

Four dependencies and one empty file. `npm run typecheck` passes, which
proves the toolchain exists and proves nothing about the product.

Resolved versions, recorded because none was chosen and one is a surprise:
`typescript` 7.0.2, `@playwright/test` 1.63.0, `@types/node` 26.6.2,
`@electron/asar` 4.3.0, on Node 25.9.0 against an `engines` floor of 20.
**TypeScript 7 is the one to notice.** It is a major version the plan never
named, taken simply because it is what the range resolved to, and an empty
file exercises none of it. The first real test of that choice is phase 1,
where 613 lines written against an earlier compiler arrive at once. If they
produce errors that look nothing like the code's own problems, check the
compiler before rewriting the code.

**`npm test` reports no tests found, and that is the correct state rather
than a broken checkout.** Recorded because it reads like a failure and will
keep reading like one until phase 3, which is the first phase with something
worth testing. A session that "fixes" it by adding a placeholder test has
added a test that asserts nothing and a green run that means nothing.

**Playwright downloaded no browsers, confirming what phase 0 predicted.**
The engine drives an Electron binary through Playwright's own Electron
support rather than one of the browsers Playwright ships. Checked by looking
for the browser cache rather than by reading the install output, and it does
not exist at all. This had already been measured in a scratch directory
before the plan was written; it is now true of this repository.

## 2026-09-21: a correction recorded as made, which was never made

The entry below on reading RStudio's suite closes by saying `../CLAUDE.md`
was corrected about what the third deployment shape loses. It was not. That
bullet has not been touched since the day it was written, which
`git log -L` on those five lines shows in one command, and
`PRODUCT_REQUIREMENTS.md` C1a carried the same uncorrected claim beside it.
Both say it now.

**Recording a correction as done is worse than leaving it open.** An open
item is visible in `OUTSTANDING.md` and gets picked up; a closed one reads as
handled and nobody looks again. Nothing distinguished the two from the
outside here, and the claim sat wrong for as long as it took somebody to
check a sentence that had no reason to be doubted.

**What found it was a review of `PLAN.md` against this file**, asking of each
research finding whether the plan reflects it. That review had a reason to
follow the pointer: the plan now sends a reader to `../CLAUDE.md` for the
shapes' limits, so a claim that had been decorative acquired a reader. A
correction nobody needs is also a correction nobody checks.

**And the claim being corrected was itself slightly wrong, which is why the
fix is not what the earlier entry asked for.** What costs the main process is
the application shipping hardened against automation, not the deployment
shape. The two coincide in the third shape, and only there, because it is the
one shape where how the build was made is somebody else's choice: under the
second you build the application yourself and decide. Writing the earlier
entry's wording into `../CLAUDE.md` verbatim would have made a true sentence
about one case into a false one about a category. The later entry narrowing
hardened builds to one in four narrowed how often this bites, not what it
attaches to.

The requirement gained a number rather than a clause, as C1b, because what it
asks for is behavior a finished build can be held up to: a run that cannot
see the process behind the screen says so, instead of reporting the checks
that watch it as passed. `PLAN.md` carries it in phase 1 and as a hazard.

## 2026-09-21: the lineage, and where the Fix came from

Recorded because it is the design's origin and existed nowhere in writing.

The predecessor was **Loki**: an engine about breaking things randomly,
chaos and discord. No anchoring, no checks, and in practice only the command
palette -- clicks, dialogs and buttons were never implemented. Late on came
the idea of anchoring the opening steps so the unpredictable part began
somewhere known. Those were **Anchors**. Loki could not take them, so the work
restarted from scratch, semirandom this time, and Anchors became the **Fix**.

The traversal module was called the **explorer** before it was the traveler,
and the travel framing is what produced the name: a trip that often knows its
starting point and never knows how it will go. That is Fogg, who knew his
departure and his deadline and nothing in between.

**Two things follow that the documents had wrong.** The Fix is not setup
ceremony imported from scripted testing; it is the correction that separated
the second attempt from the first. And "optional" was leading every definition
of it, which reads as peripheral -- a Journey without one is valid, but the
common case is that one is defined.

## 2026-09-21: RStudio's own test suite was read, and it moved several decisions

Four parallel readings of `e2e/rstudio/`, 256 files and 2.6 MB. Read for
design lessons; nothing was copied, and that repository is AGPL.

**Some of what follows came from the intent behind that code rather than the
code itself**, which is noted where it matters, because a reader who goes
looking for the evidence in the files will not always find it there.

### Attaching to a hardened Electron build

**A packaged Electron application may refuse automation entirely -- but that
is one application's choice, not the norm.** RStudio ships with the fuses
`EnableNodeCliInspectArguments` and `RunAsNode` disabled, which is Electron's
own recommended hardening. Playwright's `electron.launch()` attaches through
the Node inspector, so it hangs and times out. Measured against the installed
build, then confirmed against the documentation rather than inferred.

Four builds were checked in the end and RStudio is the outlier. Positron
carries no fuse configuration at all and leaves `RunAsNode` enabled, because
the editor it forks needs it for its own command line. Both confirmed
consumers have the fuses enabled. So the ordinary launch path works for three
of four, and the engine needs the debugging-port path as a fallback rather
than as its default.

The workaround works and was measured: spawn the binary with
`--remote-debugging-port`, poll until the endpoint answers, attach with
`connectOverCDP`. Four refinements from their implementation, each of which
exists because something went wrong:

- Dial `127.0.0.1` literally, never `localhost`. Electron binds IPv4 only, and
  `localhost` resolves to `::1` first on some Linux distributions, producing
  ECONNREFUSED against a perfectly healthy application.
- Derive the port deterministically from a hash of the checkout path plus the
  worker index. Random ports collide, and a per-launch "kill whatever owns
  this port" step then kills a sibling run.
- Reclaim the port matching LISTEN sockets only. An unqualified match also
  selects the client end of established connections, killing another run's
  worker process.
- Refuse to launch if the port will not free. A socket held by an inherited
  handle is attributed to a dead process, so killing by owner does nothing,
  and launching anyway produces an application that can never bind.

**CDP reaches the renderer, not the main process.** That costs four things
this design currently assumes: stubbing the handler that opens external links,
hiding windows so runs stay off-screen, checking the main process is alive,
and reaching native menus. So the third deployment shape loses considerably
more than the staleness guard, and `../CLAUDE.md` was corrected.

### Does discovery by accessibility role work on a GWT surface

This was the open risk that could have falsified the design, and it was
measured twice.

Directly, against the running application: 84 elements found by role on the
resting screen, 80 of them carrying a usable name -- "Save current document",
"Import Dataset", "Clear objects from the workspace". 5,468 DOM elements, 225
with a role attribute, 240 with an ARIA name. The names are machine-generated
from the command registry, where 403 of 670 commands carry a description that
becomes a title and then a label, so they are not patchy.

Indirectly, and more usefully, by counting what their own authors reach for
across 728 tests: **semantic locators are 9.5% of 1,772 element references,
and `getByRole` alone is 4%.** Their stated hierarchy puts stable product IDs
above roles.

The resting screen is a ceiling rather than a floor for that application:
role discovery reaches the chrome -- toolbars, menus, dialogs, panes -- and
stops at the console, the source tabs, the data grid and the visual editor. A
Route that hops into the editor finds a text area and has nowhere further to
go. That is not a defect in the engine; it is what stranded means.

Worth knowing: in one place their authors choose a role over an ID
deliberately, because the accessibility tree filters out ghost dialogs the DOM
retains. Role discovery works with the grain there rather than against it.

**A second census, on a different application, corrected the conclusion drawn
from the first.** A fork of a large editor, built on ordinary DOM rather than
a Java-to-JavaScript toolkit, came in at 30.3% semantic locators and 14.7%
`getByRole` -- roughly three and a half times the other, with a written policy
that ranks accessible roles *above* stable product IDs, inverting the first
application's hierarchy.

**So the boundary is rendering technique, not how interesting a surface is.**
Roles fail on canvas-backed and virtualized surfaces -- a code editor's text
layer, a terminal's canvas, a windowed list -- and work on ordinary DOM
however much behavior sits behind it. Those two categories coincide in an
integrated development environment, which is why one census read as though
every interesting surface were opaque. The clearest evidence is that
project's accessibility scanner configuration, which excludes exactly two
things: the editor's text layer and the terminal's canvas.

The practical consequence is better than the first reading suggested. The
mechanism is stronger than one application implied, and its real limit is
nameable in advance rather than diffuse.

### The settling question, reversed

The first reading suggested the answer was to have the application publish a
readiness signal, since RStudio exposes one through an automation bridge. The
later readings reversed it.

That bridge was inherited rather than built for testing. Their own authoring
guide warns the readiness flag is set before the workbench is finished
building, so it is the earliest usable signal rather than proof the state has
settled. And their antipattern audit asks for a layout-settle signal to be
built into the product, on the grounds that 21 blind sleeps in one file are
papering over real races -- **that signal was never built.**

**So Phileas cannot require adapters to supply a settle signal.** RStudio is
the most favourable case available: a bridge already existed, someone knew
exactly what was needed and wrote down why, and it still did not happen. The
engine needs a settling strategy that works with no application cooperation,
and an adapter-supplied signal is an optimization where one happens to exist.

This is harder here than for a scripted suite, not easier. A test can wait for
the one thing it is about to touch. An explorer does not know what it is about
to touch until it has surveyed, so whatever it does after a hop must be
generic.

### Three bugs, and how each was found

These are the argument for the product, and none was found by the scripted
suite.

- **A plot zoom window left open while quitting raises an uncaught exception
  in the main process.** Two ordinary actions in an order nobody would script.
  Found by accident, during a test looking at something else. It is the first
  universal check firing, and it is in the main process -- so under the
  binary-only deployment shape the engine would travel straight past it.
- **Dismissing the data viewer's summary and then paginating brings it back.**
  Found by hand, with no specification to check against. This is exactly a
  relation between two states: dismissed then paginated should stay dismissed.
  The person who found it initially wondered whether it was an annoying
  feature rather than a defect, which is the human oracle being genuinely
  unsure where a relation would not have been.
- **Refreshing the presentation preview crashes on a profile that has never
  opened that pane.** Nothing on screen, no dialog, nothing in the browser
  console, a client exception in the session log, and the command greys out
  afterwards. Silent failure on fresh state -- which is this engine's default
  condition, since every Route runs from a sandboxed profile with nothing
  seeded. Catching it requires the adapter to expose where the application
  writes its logs.

The third was found by Loki. Over several dozen runs it was the only thing
found, and `OUTSTANDING.md` records why that number may measure reachability
rather than randomness.

### What this changed in the interface

`AppUnderTest` is missing more than the exclusion list. Their fixtures need,
and this interface cannot express: environment variables (almost everything
RStudio needs to be hermetic arrives that way rather than as flags), which
page is the application rather than a splash, a pre-launch hook to seed
settings, an application-specific shutdown, where logs are written, and how to
recognize stray processes for cleanup. `PLAN.md` phase 1 carries these.

**And the exclusion list may need to be conditional rather than flat.** There
are six ways to quit RStudio, three of which are not buttons -- a console
command, a keyboard shortcut and menu paths. One of them is worse than a
static list can express: the shortcut that closes an editor tab closes the
*application* once no tabs remain. A control that is harmless many times and
fatal once cannot be excluded by name alone.

## 2026-09-21: a second suite read, and three claims narrowed

A focused reading of the other large candidate -- a fork of a large editor,
ordinary DOM rather than a generated interface -- set against the numbers from
the first. Its job was to confirm or refute two conclusions rather than
describe another codebase, and it did one of each.

**Held: the engine cannot require an adapter to supply a settle signal.** That
project ships a purpose-built driver injected at launch, with entries for
setting values, reading elements, typing into the editor, reading the terminal
buffer and executing any registered command by identifier. It still has no
"the application has settled" primitive. Its only lifecycle-wide signal fires
once per window and never again, and 47 blind waits remain in the test path
against roughly 280 retrying constructs. A mature suite with a bespoke bridge
still could not produce one, which is the same answer the first project gave
from the opposite direction.

**What both do instead is per-component readiness**, keyed to something the
product already renders: a prompt character, an idle badge, a progress
indicator, a busy attribute. `PLAN.md` carries that as an optimization an
adapter may offer, never as a requirement.

**Narrowed: role discovery does not stop at "surfaces with real behavior."**
That was drawn from one census and was too broad. The second came in at 30.3%
semantic locators against the first's 9.5%, and its written policy ranks
accessible roles above stable product identifiers -- the inverse of the first.
The real boundary is rendering technique: roles fail on canvas-backed and
virtualized surfaces and work on ordinary DOM regardless of how much behavior
sits behind it. In an integrated development environment those coincide, which
is why one census read as though every interesting surface were opaque.

**Narrowed: a hardened build is one application's choice, not the norm.** Four
builds were checked. Only the first has the fuses disabled. The second carries
no fuse configuration at all, and both confirmed consumers have them enabled.
The ordinary launch path works for three of four, so the debugging-port path
is a fallback rather than the default.

**Two hazards found that no amount of reasoning would have produced**, both
recorded in `PLAN.md`: a windowed list reports only its visible rows and a
survey under-counts it silently, and a dismissed widget can remain in the
document and still receive keystrokes, which for a Route choosing its own
moves means arbitrary input reaching the application.

**And a measurement from the two confirmed consumers**, taken locally rather
than read: neither packages into the layout the lifted launch code expects by
default. One names its directory for the product and its bundle something
shorter; the other declares no product name and uses a different packager
entirely. The override for this is a day-one requirement rather than an escape
hatch.

## 2026-09-21: the consumers were settled, and two of them were read

Two earlier records disagreed, one naming three sibling repositories and an
earlier one naming five. Neither was right.

**Confirmed consumers, both Electron:** `613-mitzvot`, on Electron 43, and
`editor`, on Electron 44 and already carrying `@playwright/test`. The second is
mid-migration and becomes a consumer once it has an interface to travel
through.

**Excluded, permanently: `drug-interaction-checker`.** It was offered as a
non-Electron consumer, and it is not a consumer at all. It is built on
`customtkinter` with a PySide6 prototype, and both are platform-native
interface toolkits, which `PRODUCT_REQUIREMENTS.md` already states as a
non-goal no adapter will change. Checked rather than assumed: Playwright
automates Chromium, Firefox and WebKit, plus Electron because Electron is
Chromium, and has no support for Qt, Tk, WinUI, AppKit or WPF and no extension
point that would add it. The exclusion follows from the choice of Playwright
and was accepted knowingly when that choice was made.

**Not a consumer yet: `movie-monolith`**, which has no interface. Read rather
than dismissed, and it is a better candidate than its lack of one suggests: it
carries a database layer and migrations, which is a source of truth a specified
oracle could read, and derived values which are the shape a structural check
needs. That is the hardest thing to retrofit into an application that lacks it.

**Two large external candidates, read on the same day.** Both are Electron and
both already drive themselves with Playwright, so adoption costs them no new
tooling. Their surfaces fail in opposite directions, which is the finding worth
keeping:

- One is an IDE whose interface is generated by a Java-to-JavaScript toolkit.
  That kind of output characteristically carries machine-generated class names
  and thin accessibility semantics, so discovery by role may find very little.
  This is the first candidate that could falsify the assumption the whole
  design rests on, and it argues for measuring discovery against a real
  application before the phase that builds it. It also ships a complete command
  registry: 672 commands, 91% carrying a label, plus the menu tree. That file
  can derive an exclusion list, supply a denominator for asking what a journey
  never reached, and give an expected set to measure discovery against. It is
  also exactly the per-application enumeration recorded as declined, and
  `../CLAUDE.md` carries the boundary that keeps the three legitimate uses
  legitimate.
- The other is a fork of a large editor, with good accessibility semantics and
  the opposite problem: far more candidates than a hop budget can visit, many
  of them virtualized and changing between one survey and the next. It also
  keeps four separate kinds of dialog and writes to the console in normal
  operation, which is why narrowing a built-in check is a precondition there
  rather than a convenience.

One of them targets both a desktop build and a browser-served one from the same
suite. That makes the seam kept capable of other targets a live requirement
rather than a hypothetical, which is worth knowing given the scope decision
recorded above deliberately did not promise one.

## 2026-09-21: a third Route outcome, stranded

A Route that runs out of available moves before spending its hop budget had
been reported as a failure. That was wrong, and the README said so outright:
"a Route that cannot finish its hop budget has found a dead end."

**It has not necessarily found anything.** A dead end, an inescapable dialog
and a trap all strand, and so does a perfectly reasonable corner of the
application with nothing further to do in it. Reporting all four as failures
asserts a defect the engine has not found, which is the same class of mistake
as a test that fails for the wrong reason: it costs trust in every other red
result.

It is not a pass either, because the Route did not do what was asked of it. So
a third outcome, reported apart from both, worth investigating and claiming
nothing.

The word was chosen to carry no verdict of its own. The requirements define it
with the terms, the plan leaves its encoding in Playwright's pass, fail and
skip undecided until the phase that needs it, and `../CLAUDE.md` carries the
rule that it is never folded into either neighbor.

## 2026-09-21: Passepartout dropped, and the verb settled

The naming entry further down, from the day before, records Passepartout as
reserved for the traversal module. That was true when written and is left
standing. This entry supersedes it.

**Passepartout was dropped, on the argument that the theme was already spent.**
Phileas names the product, Journey and Route and Hop are plain travel words,
and Fix earns its place by being an ordinary English word meaning what the
thing does. Passepartout has no second life in English, so a reader who does
not know the novel learns nothing from it, and a reader who does gets a
servant hierarchy the code does not have.

Two findings on the way outlast the decision. The literal meaning of
*passe-partout* is a master key, which would have been a precise name for
discovery by role -- the mechanism that opens every door without being told
which doors exist -- and a much weaker one for the sequencing loop it was
actually reserved for. And translating the whole vocabulary into conventional
terms, with the theme stripped out, produced an equivalent for every term
except that one. Everything else named a job; Passepartout named nothing. That
was the clearest evidence available that it was decoration.

**Kept, against expectation: oracle.** It was nearly replaced with a
travel-themed name before being checked. "Test oracle" is the standard term in
testing literature for the component that knows the expected answer, so
replacing it would have swapped a word every tester recognizes for one only
this project uses. That is the opposite of the trade the rest of the
vocabulary makes, where the theme costs nothing because the plain alternatives
are generic.

**The verb is "travels through".** Rejected: *traverses*, which in computing
implies systematic and complete coverage of a structure, while this engine
takes a bounded random sample and claims no coverage at all. *Walks* was the
most technically precise, since a random walk is exactly what this is, but
*travels* matches Journey, Route and Hop. The countable noun "a walk" was
dropped outright, because it was a synonym for Route.

**`traveler.ts` became `route.ts`, exporting `runRoute()`.** The old name
existed only as a placeholder for Passepartout, and it duplicated the
product's own role: Phileas Fogg is the traveler, so a traveler module was a
second traveler inside the first. The convention chosen for the layout is that
a file is named after its principal export, which is why the set mixes verbs
and nouns.

**Also settled: "the engine", not "the tool",** which the documents had been
using interchangeably at 28 to 14. And `PRODUCT_REQUIREMENTS.md` adopted the
word "journal", which it had never used despite describing the thing in two
requirements, while the other documents used it 21 times.

## 2026-09-21: the build plan was written, and corrected two documents

Writing the build order against the code that is to be lifted turned up two
things neither the requirements nor the open-items list had right.

**Two dependencies were missing from the list of what to install.**
`@types/node`, which the existing `tsconfig.json` already names, and
`@electron/asar`, which the staleness guard imports to read the packaged
archive. Nothing in this repository mentions the second one; it surfaces only
when the guard's own source arrives, which is why counting dependencies from
the current repository alone produced a short list.

**The staleness requirement described a weaker check than the code performs.**
It was written as refusing a build "older" than its sources and naming the file
that is "newer", which is a timestamp comparison. The lifted guard compares
content and names every file that differs, in either direction. The
requirement was corrected to match the stronger behavior rather than the code
being relaxed to match the requirement.

Both were found by reading the code that is being extracted, not by reasoning
about it. The build order could not be written without opening those files, and
opening them is what produced the corrections.

## 2026-09-21: scoped to Electron, with the door left open

Three options were weighed: Electron only, any application a browser-automation
tool can drive, or Electron named as the supported target while the seam stays
capable of more. The third was chosen.

**The deciding argument was about the built-in checks, not about effort.** The
tier that ships with the engine and assumes nothing about the application is
the product's whole value. Scoping to two kinds of target shrinks that tier to
what both share, or makes it conditional: checking that the application's main
process is alive has no equivalent in a browser. Weakening it to serve a target
nobody would run was the worse trade, given one team testing one application.

The cost accepted: the adapter seam gets its shape from one kind of target, and
the second adapter is what would discover where that shape is wrong.

Checked during the decision rather than assumed: a fork of a large Electron
editor is inside this scope, since it is an Electron application, and the
existing interface already carries an override for a different packaging
layout. What makes such an application hard is discovery on a virtualized,
custom-rendered surface, and that difficulty is identical under every scope
option. It also produces console errors in normal operation, which is the
origin of the requirement that an application be able to narrow a built-in
check and have the report say so.

## 2026-09-21: the eight-document set was created

The repository previously held one markdown file. The design state lived in a
session handoff document outside the repository, which is ephemeral by
construction and was about to be the only copy.

The structure is the eight-document pattern: three files in the root and five
under `docs/`, each stating its own role and pointing at the others rather
than summarizing them. `PRODUCT_REQUIREMENTS.md` was deliberately left as a
role-stating stub rather than drafted, because it is being worked through
directly rather than written ahead.

## 2026-09-21: measured what already exists to be lifted

A sibling Electron project's Playwright suite holds the launch and bundle
layer this engine needs, written to be extracted. Counted rather than
estimated:

| | Lines | Files |
| --- | --- | --- |
| The reusable kit, which becomes this repository's `src/` | 613 | 7 |

Its `app-under-test.ts` is 54 lines and already defines the `AppUnderTest`
interface, covering the product name, the repository root, the packaged
inputs that drive the staleness guard, a readiness hook, launch arguments and
whether an uncaught renderer exception fails the test. Its header comment
states outright that the directory is meant to be lifted into a shared package
that sibling apps consume, each supplying its own implementation.

**This corrected a plan to write that interface from scratch.** It had been
recorded as the highest-value next step on the understanding that nothing
existed. The work is extraction and hardening, and the existing interface has
nothing about the traversal exclusion list that the engine now requires.

What is not there: nothing in that kit travels through an application. No
traversal, no seeding, no journal, no invariant machinery. Those are genuinely
unwritten.

## 2026-09-21: the repository was published, private, after a full scan

`ronplusron/phileas`, private, matching the four sibling repositories. Squash
merging was switched off after creation, since `gh repo create` leaves it on
and it contradicts the rebase convention.

The pre-publication scan covered the working tree and all history under three
rulesets plus a dataflow tool, with a canary planted for each pass. Everything
returned zero across 8 tracked files and 1 commit, with commits-scanned
checked against the commit count so the zero could not come from an empty
range.

**One pass reported a false clean and was caught by its control.** A grep
sweep across the tracked files was written with an unquoted file list
containing newlines, so the shell handed the whole list to grep as a single
filename. Every category returned "none", which looked exactly like a clean
result. The positive control -- searching for a string known to be present --
also returned zero, which is what exposed it. Rerun with `git grep`, the
controls returned 2 hits and 1 hit and the sweep was genuinely clean. An
absence check without a positive control produces a zero that cannot be
distinguished from a broken search.

## 2026-09-20: the Route is the test, not the Journey

Claimed early in the design session that the Journey maps to a Playwright
test. That was wrong and was corrected after challenge.

The Route is the test. It is the unit that carries a verdict, a fixture scope,
a timeout boundary, a retry unit and a trace boundary. Under the wrong
mapping, ten traversals would share one verdict and one trace, and one failure
would take the other nine with it.

The rest follows: Journey is the run and holds the seed, the route count, the
hop budget and the deadline; Fix is `beforeEach`; Hop is `test.step`, so hops
nest in the trace without each becoming a separate pass or fail.

## 2026-09-20: per-Route seeds, derived and split in two

Two decisions, both about reproducibility, both expensive to retrofit.

**Derive each Route's seed from the Journey seed** as
`hash(journeySeed, routeIndex)` rather than drawing every Route from one
shared stream. A shared stream makes route 7 reproducible only by replaying
routes 1 through 6, which reintroduces exactly the inter-route dependence the
design removes -- and does it silently, because every route still passes.

**Split each Route's seed into a Fix stream and a traversal stream.** Sharing
one stream means editing a Fix later shifts every subsequent draw, so recorded
failing seeds stop reproducing. A recorded seed that no longer reproduces is
worse than no recording, because it reads as a bug that got fixed.

## 2026-09-20: the Fix runs per Route and is never cached

Decided explicitly against caching it for speed. Stated close to verbatim:
keep the fixes running per route, saving ten seconds is not worth losing the
functionality.

**The stronger argument arrived after the decision and is the one to keep.**
Running the Fix fresh is not merely a way to reach a clean state -- it IS the
independence guarantee. A cached Fix means route 5 begins from whatever route
4 left behind, every route still reports green, and the failures it hides are
precisely the state-leakage bugs the engine exists to find. Caching also
forecloses different Fixes per Route, which was raised as a wanted future
option.

Settled alongside it: a failed Fix reports as a distinct finding from a failed
Route. Ten Routes failing on one broken precondition is one bug, not ten.

## 2026-09-20: planner-assigned route bias was proposed and declined

Proposed as a way to spread coverage across a Journey, then dropped for two
reasons. The second is the stronger one.

**It is interference, not learning.** Nothing has run at the moment the bias
is assigned, so it is stratified sampling. It was described as adaptive
learning during the session, which was wrong and was named as interference.

**The problem it solves is negligible, measured rather than assumed.** With
eight buttons and ten routes, roughly four pairs collide on the first hop, and
each colliding pair diverges with probability 7/8 on the next. The duplicated
prefixes come to a handful of hops out of about 400.

Ten independent unbiased random walks is the decision, revisited only if
measurement later shows real clustering.

## 2026-09-20: the ceiling of metamorphic testing was conceded

Raised as a challenge against the design and accepted rather than argued
around. If a bug is consistent, every metamorphic relation passes: 42 before,
42 after, the round-trip holds, and the answer is still wrong.

Metamorphic testing buys self-consistency, not correctness. It catches state
leakage, incomplete resets, drift on repeat and stale caches. A uniformly
wrong implementation walks straight through it.

This is why accuracy checking needs an independent oracle, and why the oracle
must not share logic with what it judges. Sharing a data loader is acceptable.
Sharing the computation means the bug exists identically on both sides, both
agree, and the test passes while the screen lies.

Recorded as an honest limit rather than a defect, and belongs in
`PRODUCT_REQUIREMENTS.md` as a non-goal. `DEFECTS.md` explains why filing it
as a fault would be the wrong call.

## 2026-09-20: naming settled, and one name parked

**Phileas, not Fogg.** "Fog" reads as obscurity, which is wrong for a tool
built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

Names are taken from *Around the World in Eighty Days* only where one
genuinely fits. Fix is Detective Fix and was already in the original
specification by coincidence. Passepartout is reserved for the traveler
module, kept in mind rather than implemented. Journey, Route and Hop are plain
travel words and stay that way.

**Wager was parked rather than rejected**, on a request to hold on to it in
case it proves useful. It failed a use-it-in-a-sentence test: "a journey of 10
routes" reads, "a journey for which the wager was 10 routes" does not, and is
inaccurate besides.

## 2026-09-20: directory naming, after one reversal

`kit` and `app` were judged non-standard, and `app` actively harmful because
it collides with "the application" -- it caused a misreading during the
session itself.

Settled: the engine is a package, `@drugstoresushi/phileas`, consumed from
`node_modules`. A consuming repository gets one directory named for the tool,
following the `cypress/` and `.storybook/` precedent, holding `adapter/`,
`journeys/` and `journey.spec.ts`. The repository's own `tests/` keeps
Playwright's default meaning and stays the scripted suite.

**This was reversed once and then restored.** Naming the consumer directory
`phileas/` while the package is also phileas was presented in a tree that made
it look as though the adapter had moved inside the engine. The name was backed
away from on that basis, then reinstated once the `cypress/` precedent was
recognized as the standard it is. The presentation was the problem, not the
name.

## 2026-09-20: the scaffold was committed

Commit `e11a61c`, the root commit: `package.json`, `tsconfig.json`,
`.gitignore`, a README fixing the Journey/Route/Fix/Hop vocabulary, and empty
directories. No dependencies and no engine code.

`tsconfig.json` is strict with `noUncheckedIndexedAccess` on, which is not
tidiness: a traversal engine indexes into arrays of discovered elements
constantly, and that flag forces the empty-survey case to be handled rather
than crashing on a route that found nothing to do.
