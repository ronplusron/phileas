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

**It travels, it writes down where it went, and since 2026-09-26 it judges
some of it.** `src/`
holds the seven files lifted from `trickster-tales` and hardened: launching a
packaged build, refusing a stale one, keeping windows off the screen, reaching
the native menu, stubbing outbound links, and the `AppUnderTest` interface the
whole thing talks through. `journey.ts` and `random.ts` joined them in phase 3.
`survey.ts`, `route.ts` and `journal.ts` joined them in phase 4: discovery by
accessibility role, one Route's Fix and Trip with the choosing and value seams,
and the per-Hop record. `effect.ts` joined them before phase 5, for what each
Hop did to the screen. `src/oracles/` joined them for the Positron trial:
six checks run after every Hop and every Fix step, uncaught errors in either
process, console errors, still responding, the window still showing
something, no unexpected dialog, and an error in a log the adapter names. The
first failure ends the Route. An application that crashes, quits or closes
its window fails still-responding rather than going unnoticed. Since
2026-09-27 an adapter can declare checks of its own, run after those and
judged the same way: `buggy`'s declares one, and Positron's one.
`docs/PLAN.md` has where what such a check asserts must come from.

**Two checks are absent, and every Hop says so.** No navigation away and named
controls are not built yet, and each Hop's journal line records them as not
run. So is the log check wherever the adapter names no log. The open defect
in `docs/DEFECTS.md` stays open until the foreign-process half of no
navigation away exists.

**Phases 0 through 4 are done, and the first real boundary is passed.**
`proving-ground/buggy/` is a packaged Electron application built to be traveled
through, and `npm test` runs four hundred and five tests, after a
typecheck. Seven launch it,
refuse a stale bundle, report a bad boot in the application's own words, keep every
window off the screen, and prove the outbound-link stub took effect rather than
assuming it. Twenty-five prove the reproducibility mechanism and a Journey's
terms without launching anything, including known-answer vectors that pin the
generator's output. Twelve record what `buggy` correctly does, so a defect
planted later can be told apart from an accidental one. Seven assert that a
guard refuses rather than answering when it has no evidence. Seven work out
what a Hop did to the screen from two readings, without launching anything.
Thirty-six travel through the application, and ten cover the journal, including
one cut off mid-write and one refusing to overwrite an earlier run. Fourteen
cover the window modes, the hop delay and the application's checkout, and two keep every source file searchable. Seven cover the `phileas`
command and the overrides it carries, one of them running it for real, and eight
cover reading a journal, following a run and showing one. Eight cover writing a
Fix from `phileas survey`'s lines, two of them the hop delay's pause in a Fix
and a survey. The last three cover the
fixture layer and the types, the type ones being compile-time assertions that
`npm run typecheck` enforces. Thirteen make each check fire on a defect planted
in `buggy` behind its own launch flag, and show nothing firing on `buggy`
launched without one. Fifteen came with the Positron adapter: launch
arguments, the environment and logs named from a Route's profile folder, a
bundle with no archive, the application running from its profile folder, a
close that ends in a forced kill, proved against a planted hang that never
ends, and the trial's home folder guard. Two hold the settle wait to its
budget against a page that keeps changing, and to reporting one that gives no
answer, one keeps a window created already shown off the screen, and two
remove a profile that is read-only in part or still being written into, and
one reports an application that opens no window in its own words. Two delete
a profile again when something recreates it, and report one that keeps
coming back. Twenty-one cover known findings: signatures in either temp folder layout, the file, what a
Journey's end adds, the command, and a Route carrying on past one. Eight
keep a Journey to its own temp folder: failing one that leaves a profile in
it, even when another end-of-Journey check fails first, never failing on
another run's folder, refusing a profile with no folder, and putting back
the folder in force before. Thirty-four came with the fixes
from the whole-codebase review of 2026-09-27: a crash and a quit firing the
checks, one verdict per renderer error, a known hang still ending a Route,
bounded survey and Fix calls, the surveyed and all-abandoned outcomes, the
staleness guard's branches and its strict switch, whole-line log reads, the
known-findings refusals, and the guarantees in `tests/guarantees.spec.ts`: a
pinned draw order, the Fix's own stream, a fresh process per Route, a flush
per Hop, and replay across launches. Three retry the first call into an
application's main process, whose answer Positron 2024.11 drops on most
launches, and two more, since 2026-10-06, retry every call the launch makes
and hide the windows only once, since Positron 2025.02 dropped later ones. Five came with checks an adapter declares: `buggy`'s own firing on
a planted miscount, a declaration refused by name, a check that hangs or
throws, and one matched against a known finding. Two came from the first
step-6 run on Positron: a shortcut printed as an arrow, and a text box that
is not an input. Three keep a hidden run off the screen: a window asked to go
full screen, one brought forward with moveTop, and a native dialog.
Twenty-three came with RStudio: its R library guard, what its adapter excludes
from a file dialog and sets before launch, the shared home guard's new
readings, a username kept out of signatures, an adapter's own signature
patterns, a log created on its first write, a staleness guard printed
as unable to run, nothing that prints, a screenshot that never returns
given up on, a lost connection told apart from a closed window, a
stray process a Route left behind found and ended, screen reader
support excluded, a file dialog's parent-folder row excluded, R's restart
narrowed out of the console check, and opening a file or folder stubbed.
Two came with Bobolink Editor: a dialog marked `aria-modal` surveyed alone,
as a native modal is, and one with no way out stranding the Route.
Fifteen place a finding by when it arrived rather than by the Hop the
checks ran after: ten on the placement and the failure's text, without
launching anything, four with errors planted in `buggy` to arrive late or at
once, and one on RStudio's reader of its session log's times. Three more
say on each Hop's own line when its finding arrived and when each stubbed
call came.
Six came with covered controls: one left out and recorded with what covers
it, a cover that lets clicks through and controls scrolled out of sight
kept, a covered text box left out while its neighbor's shortcut stays, what
took an abandoned click journaled, a page all covered stranding, and a seed
retracing its Route with a control covered. Four came with hidden controls
(R32): one in a pane with no area left out and recorded with that pane,
while the same pane with room keeps it, a page whose html has no area
hiding nothing, a page all hidden stranding, and a hidden control on the
pool's line. Three came with fixing the covered test on RStudio: a covered
control found when the html has no area, a text box under a layer of its
own widget kept and recorded while one under anything else is covered, and
such a text box on the pool's line. One more holds a control hidden at
the window's edge, with nothing under the pixel that shows, out of the draw. Two hold the settle wait to `aria-busy`: a page
marked busy is not settled until it clears, and one whose busy region is
hidden settles as a quiet page does. Seven came with RStudio Routes seeing
the person's own R library: each value of `PHILEAS_R_PERSONAL_LIBRARY`,
what is refused, the Route's library staying first, and the R library guard
watching a library given by path. Twelve came with the run's ending: nine
on the reporter, from a Route that failed on checks, on an error, stranded,
passed, followed, cut off and never opened, to the summary and `phileas run`
choosing it, and three on known findings counted rather than listed, the
list with when each was last met, and the hand-over to the reporter. Three more came with
controls that have no area of their own: one reached through its label
and recorded with it, its label covered or absent, and a test that
passed with no journal reported as passed. One more holds a covered
control's printed shortcut out of the draw when a dialog covers it, and
in when a control in plain view prints it too. One more holds the
summary's Route alone to the lowest-numbered Route that did not pass. Two
more came with each Fix step's line saying what the step was: an `act`
step's target and value and a `code` step's source recorded, and the kind
printed. Two more came with exclusion groups: a group kept out unless a run
lets it in, and a group the adapter does not declare refused. Three more
came with the log check's wider rule: a line naming an error class or a
plain word for failure, the same through a Route, and a log's own pattern.
One more came with `back` handing the screen back, read from outside the
process with `lsappinfo`, against `front` as its control. Two more came with the menu drawn a level at a time: a menu Hop's draws
pinned, and each top menu drawn alike with a deep entry rare. One more
holds the console check to setting aside the line the engine's own trace
makes in a sandboxed frame, and nothing else. One more runs a `known`
command from inside `phileas/` and from a folder with no known findings,
which it refuses in one line. One more holds the engine's claim of focus
for a Route's window, which stays hidden. Three came with replaying a
Route from its journal: Hop for Hop in a fresh launch under another seed,
a renamed control stopping the replay at its Hop, and a target matched
only exactly. Three more came with `phileas replay`: a finding reproduced
and, fixed, not reproduced; a `code` step refused and the current Fix
checked against the recording; and a replay offered again as a replay.
Two more came with a logged error's stack read as part of it: each shape of
frame measured in real logs never failing alone, while a message written
onto a frame's line still does, and a stack through a Route making one
finding rather than one per frame. Two more came with a replay skipping a
Hop recorded as abandoned: in a launch, with the same Hop not abandoned as
its control, and the values typed after it unshifted. Two more came with
`RSTUDIO_WHICH_R`: the Rscript beside the R it names, and the library guard
reading R 4.4.3's library under it and another without it. One more came
with `phileas --version`, which also holds an unknown command's refusal to
naming every command. Three more came with the phase 8 baseline:
`BUGGY_PLANT` becoming launch flags, every plant's button checked against
`buggy`'s renderer with a renamed one as its control, and a finding put down
to the plant whose check it is, a late one included. Two more came with
the Booking: a Journey file naming the exclusion groups it lets in, which
`--allow` replaces and `--allow none` empties, and `startJourney` refusing
an undeclared group by where it came from and handing the rest to every
Route. One more holds a survey with many covered controls that never
answer their own test to about one timeout, against the same controls
answering as its control. Two more came with a blank window having to
last: a window blank for a moment passing, recorded with how long it took
to come back, against `buggy`'s lasting blank still failing, and the
summary counting brief blanks by Route. One more holds a source file's
line out of a signature, so a release that moves code keeps its findings.

The remote is `ronplusron/phileas`, created 2026-09-21 and scanned before
first publication. It is public for now and will be private again;
`docs/OUTSTANDING.md` 2.2 has the measurement and the words.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

`docs/PLAN.md` is written: eleven phases, three of whose boundaries are real
verification points rather than bookkeeping.

**Bobolink Editor's adapter lives in the editor's own repository,** in
`phileas/` there, since 2026-10-01: the first consumer outside this
repository, installing the engine from GitHub. The editor's `ORIENTATION.md`
says how to run a Journey, and its `docs/DEFECTS.md` holds what Journeys
found in it. The adapter declares no checks of its own yet, and no Fix.
`docs/HISTORY.md` has why it moved and how, and the adapter that was in
`trial/editor/` from 2026-09-30 is in this repository's history.

**What comes next was reordered on 2026-10-05,** to answer sooner whether
the engine finds bugs on its own: the replay proof under R 4.4.3; the log
check reading a stack as part of its error; one Journey finding `buggy`'s
planted defects unsteered, as a baseline; the Positron trial resumed;
weighting the draw; the rest of replay; then the rest of phase 5, with the
stranded encoding first. `docs/PLAN.md` has the order under "The order from
2026-10-05", and `docs/HISTORY.md` has why. The order before it, from
2026-10-03, landed all but the rest of replay. Its first four steps are
done, the Positron trial last, on 2026-10-07. An RStudio batch of 600
Routes on its current release was placed before weighting the draw on
2026-10-08, and reading inside frames after the batch, also before
weighting; `docs/PLAN.md` has both under that order.

**RStudio Desktop was the next thing to do,** decided 2026-09-28 in place of
carrying on with the Positron trial below, which stopped where it stood
until it was resumed on 2026-10-05.
The adapter is in `trial/rstudio/`, pointed at a copy of the installed
release with two fuses switched back on, since the installed release refuses
the ordinary launch: for example
`PHILEAS_APP_DIR=~/Applications/RStudio-2026.10.0-fuses.app phileas run trial/rstudio/phileas`,
the current release since 2026-10-08; the 2026.09.1 copy is still there.
**On a machine without that copy,** `node trial/rstudio/prepare-app.mjs`
makes one from `/Applications/RStudio.app` and prints where it put it; the
machine needs R, with `Rscript` on the PATH, for the trial's R library guard.
About two hundred Routes have run through it, and three new RStudio bugs
came from them, each an error logged with nothing wrong on screen: closing
a terminal, filed as RStudio's issue 18976, which its developers have since
submitted a fix for; refreshing an empty Find in Files pane,
`ronplusron/phileas` issue 62; and installing the odbc package from New
Connection, issue 64. A fourth it met, opening a project from the web
dialog, RStudio already knew of as its issue 14985; issue 65 was filed for
it and says so. The full batch, 20 Routes of 40 Hops from each start, ran
on 2026-09-29, once two escapes were closed: a Route climbing out of its
home through the file dialog's "Folder .." row, and "Open Project in New
Session..." starting a second RStudio, which the engine now stubs. The
command palette is excluded, for now. 79 of the batch's 80 Routes passed,
and the one failure was issue 64. **A batch of 600 on 2026.10.0** followed
on 2026-10-08, 100 Routes of 20 Hops from each of six starts, two at a
time: 594 passed, and its one new RStudio bug, detaching utils breaking the
package vulnerability check, is `ronplusron/phileas` issue 97.
`docs/HISTORY.md` has it, and the engine repairs it led to. Every entry in
its `known-findings.json` is settled: seven entries filed against five
issues, issue 97's one error being three entries, and one dismissed as a
false alarm.
`phileas run --fix <name>` chooses one of its Fixes: `script`, a new
R script with code in it; `session-data`, code run in the console;
`r-markdown`, the dialog for a new R Markdown document;
`r-markdown-further`, that document created, with text and an R chunk
added at its end; `zoomed-plots`, the Plots pane zoomed so the other
panes are hidden; or `data-viewer`, `mtcars` shown in the data viewer,
whose grid a Trip cannot reach until frames are read. Its Journey fails the run when the machine's R libraries
changed. Its Routes see the person's own R library after their own, so an
install still lands in the Route's; `PHILEAS_R_PERSONAL_LIBRARY=0` leaves
it out, a folder's path names another, and the Journey's start says which.
`RSTUDIO_WHICH_R` chooses the R that RStudio starts, and the library guard
and the personal library follow it. `docs/PLAN.md` has the decision, what the adapter does and why, and what is
not decided, under "Stepping away from the trial".

**A measured trial on Positron was the thing to do before that,** decided
2026-09-26: part of phase 5's checks, a Positron adapter, and runs against old
releases carrying known bugs, judged against a bar set in advance.
`docs/PLAN.md` has it under "Before the rest of phase 5", and the rest of
phase 5 waits for its answer. Its first two steps, the checks and the
adapter, are done: the adapter is in `trial/positron/`, three Routes of
twenty Hops each passed through it on the current release, and one Route on
each old release. Thirteen Positron bug candidates have been found and
filed, `ronplusron/phileas` issues 44, 46, 53, 54, 87, 88, and 90 to 96
from step 6.
Only 87, Remote Explorer's Configure failing when the home folder has no
`.ssh` folder, has been followed by hand and read in the code; 88, the
Profiles editor logging a file it could not find when MCP Servers is opened
to the side in a profile with no `mcp.json`, was reproduced by a probe,
and then in VS Code, so the bug is VS Code's.
`trial/positron/phileas/known-findings.json` holds their signatures.
`docs/PLAN.md` has everything measured and decided for it.
The three old releases and the current one are installed as
`Positron-2024.11.app`, `Positron-2025.01.app`, `Positron-2025.02.app` and
`Positron.app`, and `PHILEAS_APP_DIR` names which one a run uses, for example
`PHILEAS_APP_DIR=/Applications/Positron.app phileas run trial/positron/phileas`.
`phileas run --fix <name>` chooses the Fix, from those
`trial/positron/phileas/fixes/index.ts` lists: none by default, `session`,
which starts an R session, `notebook` and `quarto`, which open a new notebook
or Quarto document, and `data-explorer`, which starts R and shows `mtcars`. The trial's Routes run two at a time, set in its
`playwright.config.ts`; five put the load at 26.9 on 8 cores. **The old releases need R 4.4.3,** installed beside 4.6 with rig,
since R 4.6.0 crashes as it starts on 2025.01 and 2025.02; the session Fix
refuses by name without it. The adapter has one check of its own,
`no-error-notification`, run on the current release only: studying each
release for checks was stopped on 2026-09-27, and `docs/PLAN.md` has why
and what the first step-6 run found. Steps 3 and 4 are done as far as they
go.
**On the old releases, context menus are native whatever the adapter
sets,** since none of them has `window.menuStyle`. With windows hidden,
opening one froze nothing in twelve launches; with windows shown, that is
unmeasured. **The trial finished on 2026-10-07:** step 5 found 0 of its 3
known bugs, and step 6 ran 500 Routes on the current release and filed seven
candidates, none yet followed by hand. `docs/HISTORY.md` has the reading
against the bar. Step-6 probes, each steering a Route straight to a
candidate's steps against a control, are in `trial/positron/probes/`, run
with `npx playwright test -c probes <name>` from `trial/positron`.

**A bug already found no longer ends a Route,** since 2026-09-27. A consumer
keeps `known-findings.json` beside its spec; a Route that meets a finding in
it records which and carries on. A Journey adds what it found to that file,
unfiled, when it ends, and prints each with its id, and `phileas known add
<id> --issue <issue>` files one. Since 2026-09-29, `phileas known dismiss
<id> --reason <why>` marks one a false alarm, which Routes keep carrying
past and a Journey never adds back, and `phileas known remove <id>` takes
one out, for a bug since fixed or a finding the engine itself caused. A
Journey's end lists only those it met and counts the rest; `phileas known
list` prints every one, with when it was last met in the journals kept. A narrowing is only for what is normal for
an application. `docs/GLOSSARY.md` defines the terms. The same end of a
Journey fails the run on a profile it left in its own folder in the system
temp folder, for every consumer whose global setup returns `finishJourney`.
`startJourney(journey, adapter)` makes that folder, named for the
application, and hands it to every Route in `PHILEAS_TEMP_FOLDER`.

**Phase 5 was next until then.** Running the engine against real
applications for a demo found gaps phase 5 would otherwise have built on, and
all of them closed on 2026-09-24, the last being a `phileas` command for a
Journey's settings on the command line. Phase 5 is the universal tier of
checks, and the point where a Route can fail for a reason rather than only for
not finishing. `journal.ts` already carries an empty `checks` field on every
Hop for it to fill.

**Read `docs/DEFECTS.md` before writing any of it.** Eighteen defects are
open, five of them deferred from the review of 2026-09-27, two found tuning
the Eighty Days demo, one a determinism test that failed once for a
reason not yet known, one a settle test that failed once the same way, one the Hop a Route ends on depending on when a
late finding arrives, one a Fix's fingerprint missing what the Fix
does not itself contain, one an application in `back` mode bringing
itself forward partway through a Route, one a Positron Route saving
outside its home folder, one a known finding with nothing particular
in it matching every finding of its check, and one the log check keeping
only the lines of an error that look like errors. That file holds what is wrong, confirmed by reading the
code wherever a cause is known, and nothing here restates it.

**Two demos live in `demo/`, apart from `proving-ground/`.** Rail Itinerary is the
short first look, planned in `docs/DEMO_PLAN_TRAIN.md`: `npm run demo:train`
watches it and `npm run demo:train:present` presents both its stages, through
the runner both guided demos share, `demo/presenting.mjs`. Three bugs are
planted in it, each switched on through `RAIL_DEMO_PLANT`, with a seed for
each in `demo/rail-itinerary/seeds.mjs`; the rest of its planned bugs wait
for their checks. Eighty Days is the longer
one, a deterministic game after the novel, planned in
`docs/DEMO_PLAN_EIGHTY_DAYS.md`: `npm run demo:eighty-days` watches it and
`npm run demo:eighty-days:present` presents both stages: exploring, then
planted bugs found, replayed, filed and traveled past. Eight bugs are
planted in it, each switched on through `EIGHTY_DAYS_PLANT`, and
`EIGHTY_DAYS_LAYOUT=screens` restores its original layout; its build order
is done but for the four plants waiting on checks. Its default Journey starts every Trip
at Hong Kong, `demo/eighty-days/seeds.mjs` holds the seed whose three Routes
win, lose and wander and a seed for each plant, and
`demo/eighty-days/measure.mjs` reads a run's journals for the balance
numbers. Any change to the game or the draw moves what those seeds do, so
they are searched for again after one. **The demo must not flatter the engine**: two tunings once changed
the game to hide weaknesses in Phileas, and the plan's settled decisions say
how that is being undone.

**Two things phase 5 must not undo**, both measured earlier and carried in
`docs/PLAN.md`. A hop must not wait for navigation to finish, or a single
outbound link costs a Route its whole timeout; `route.ts` bounds every action
for that reason. And `buggy`'s outbound-link test is the positive control for
the `external.ts` hazard: keep it, because without it an empty recorder and a
stub that never took read identically.

**The menu bar is offered in every window mode, hidden included,** since
2026-09-24. A menu hop hands its handler the Route's own window, so focus
decides nothing; `docs/HISTORY.md` has the measurement that overturned the
earlier reading. So an unattended run reaches the menu, and since 2026-09-26
the engine skips every standard entry Electron builds from a role -- Quit,
the clipboard, Undo, the Zoom entries and the rest -- unless an adapter allows
a role back with `allowStandardMenuRoles`. Only the entries an application's
own authors wrote are drawn from by default. Since 2026-10-03 the engine also
claims focus for each Route's window, so an application whose menu depends
on focus, as Positron's does, offers the same menu on every launch, and the
menu is drawn a level at a time, as a person opens it.

**If `npm test` cannot find Electron:** `npm install` does not run Electron's
postinstall in this environment, so the types arrive and the binary does not.
`node node_modules/electron/install.js` fetches it, in the engine and in
`proving-ground/buggy/` separately. It looks like a broken checkout and is not.

`docs/OUTSTANDING.md` holds what is open, and nothing in it now waits on an
opinion. `docs/DEFECTS.md` holds what is wrong.

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

**The engine is compiled, and runs from `dist/`.** `npm install` builds it,
and `npm test`, `npm run journey` and the demo scripts build it again first.
Anything else that loads the engine by name, such as a trial run through the
`phileas` command, runs the last build: after editing `src/`, run
`npm run build`, or the compiled engine refuses to load and names the newer
files. `PHILEAS_ALLOW_STALE_BUILD=1` runs it anyway for one run, and says so.

`npm test` typechecks, then runs the engine's own four hundred and five tests against `proving-ground/buggy/`.
It gives the run its own `phileas-suite-*` folder in the system temp folder,
makes every profile and scratch folder inside it, and fails if anything is
left there. A Journey keeps to a folder of its own the same way, so two runs
at once never see each other's folders; `PHILEAS_ALLOW_TEMP_LEFTOVERS=1`
skips the check for one run, and the run says it did.
`npm run journey` runs the Journey from the consumer's own config at
`proving-ground/buggy/phileas/playwright.config.ts`, which registers one test per
Route and now travels inside them, through the `phileas` command. It prints
every setting in force, marking those set for this run.

**The `phileas` command changes a Journey's settings for one run** without
editing its file: `phileas run [config] --routes 3 --trip-length 50 --seed
abc --show back --hop-delay-ms 300`, and `--route-deadline-ms` and
`--journey-deadline-ms`. `--allow new-windows` lets one of the adapter's
exclusion groups back in for the run, such as Positron's new windows,
replacing those the Journey file's `allow` lets in, and `--allow none` lets
none in. What a Journey is defined by is its Booking, named so on
2026-10-08; `docs/GLOSSARY.md` has what it holds. The config defaults to `phileas/`, the consumer
layout's folder, and anything after `--` goes to Playwright. From this
repository, `npm run journey -- --routes 1` passes flags through. A replay
needs the seed, and enough of the rest to reach what it is retracing: the Route
count only has to include the Route, since no Route's seed depends on it, and
a longer Trip retraces a shorter one's Hops and then carries on, measured on
2026-09-25. The printout says what a run used. `phileas --help` lists each flag with the
environment variable it travels in, which is what a refusal names, and
`phileas --version` prints the engine's version.

Each Route writes a journal to
`proving-ground/buggy/phileas/.phileas-journals/<journey seed>/<run>/`, one JSON
Lines file per Route, flushed per Hop. The run is named for when it started,
in UTC, and the run prints its name beside the seed. The layout under
`.phileas-journals/` is the engine's; a consumer chooses only that root. So every run of a seed is
kept, in folders that sort in the order the runs happened, and comparing two
runs means comparing two folders. A journal never overwrites another: one
already at its path is refused. Nothing yet clears old runs away.

**Replaying a Route from its journal (R12)** is `phileas replay <journal
file> [config]`, since 2026-10-04: it runs the Route's Journey with the
journal's seed and Route, acts on each recorded target by name in place of
drawing, and says whether the finding came back. It replays to the Hop the
finding came on and 3 more, or every Hop with `--whole`. A Fix with `code`
steps needs `--with-current-fix`, which runs the current Fix checked step by
step against what was recorded. `--follow` prints each Hop as it happens,
as for a run. A Hop recorded as abandoned whose target is not on offer is
skipped in its place. **It is proved under another R:** on 2026-10-05 an
RStudio finding recorded under R 4.6 reproduced under R 4.4.3, chosen with
`RSTUDIO_WHICH_R`. `docs/OUTSTANDING.md` 1.18 has what is left.

**Reading a journal (R30)** goes through one renderer, `src/report/render.mjs`,
moved forward from phase 7. `phileas run --follow` prints each Route's lines
as its journal is written, one per Hop: what it acted on and how, the value
typed, and what appeared and went away. `phileas show` prints a finished run
the same way: with no argument the latest run under `phileas/.phileas-journals/`,
or a seed's name, a seed's folder, a run folder or one journal file. A journal
cut off mid-write reads up to the cut and says the Route did not finish.
`jq . route-001-*.jsonl` still prints every line in full.

**`phileas run` prints through the engine's reporter,** `src/report/reporter.mjs`,
since 2026-10-02: each Route's ending, read from its journal, with what each
failed check saw once and the trace by path; an error that is not a check's
finding printed whole, stack and all; and a summary last, with the Routes by
outcome, stranded apart, the known findings, and the command to run it again.
Following, a failed Hop's line names each check and finding without what it
saw, since the ending says it. A `--reporter` given after `--` replaces it, and
the run then prints as it did before.

**Writing a Fix starts from `phileas survey`,** which launches the application
and prints what the engine sees at the start, one control per line in the
engine's own form: `button "Open Alps by rail"`, `menu View > Show Timetable`.
Where a Fix exists it then runs it, printing each step, and prints what the
engine sees after it, so a Fix of several steps is written one at a time.
An `act` step takes a line as it is: `({ step }) => step({ kind: 'act',
target: 'button "Open Alps by rail"' })`, with a `value` for text to type. It
waits up to the hop timeout for its target to appear; a target still not on
screen then fails the Fix and lists what is, and the exclusion list applies to
a Fix too. A `code` step, `{ kind: 'code', label, action }`, runs Playwright
code for anything else.

**A replay used to need the same window mode as the run it retraces,** because
a shown run offered menu entries a hidden one withheld. Since 2026-09-24 every
mode offers the same menu, but a replay across modes has not been measured, so
match the mode until it is. The hop delay changes nothing.

**None of it is evidence that the engine finds bugs.** Each check is shown to
fire on a planted defect that a test steers a Route straight to, which proves
the check and not the search. They show the launch layer, the Route and the
checks behave as written and that a seed reproduces.

The proving-ground application builds itself:

```
cd proving-ground/buggy
npm install
npm run package
```

`npm test` from the repository root then runs against the bundle that
produces. Edit the application without repackaging and the staleness guard
refuses to run, naming the file that differs, which is the behavior rather
than a fault.

`@electron/asar` is a dependency; `@playwright/test` is a peer dependency with
a dev dependency alongside, because a second copy of Playwright in the tree
would hand a consumer fixtures from the wrong instance. `electron` is a dev
dependency only: the engine launches the application's own Electron and
imports nothing from the package, so a consumer is never asked for one.

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
measured rather than assumed: under `back` the window is drawn correctly and
sits behind what you are looking at, and does not appear at all if that is
full-screen in its own Space. Every reading from inside the process says the
window is fine. **But on macOS 26 showing a window does activate it,**
measured on 2026-10-04, so `back` now hands the screen back: the application
comes forward for a fraction of a second at launch, and the engine then asks
whatever was frontmost before to activate again, touching nothing in the
application. Once per launch; an application that brings itself forward
later stays in front, and `docs/DEFECTS.md` has the one such path found.

`PHILEAS_HOP_DELAY_MS` pauses that many milliseconds after each Hop, Fix steps
included, and after each listing `phileas survey` prints, so a run can be
watched at all: a Route otherwise travels twenty Hops in about a second,
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

`tsconfig.json` is `noEmit` with `strict` and `noUncheckedIndexedAccess` on;
`tsconfig.build.json` extends it to compile `src/` into `dist/`, which is
what the package points at. A relative import names its file with `.js`, the
name it has once compiled.
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

**It says nothing about whether the engine finds bugs.** The planted defects
are reached by a chooser that picks them, not by traveling, so a green run
here shows the checks work and not that a Journey would find anything. That
stays true until the Positron trial measures it against real bugs, and phase 8
points one seeded Journey at every planted defect and asserts each is found.

**The limit worth knowing before writing any of it:** a bug-finder that passes
its own tests has demonstrated nothing about whether it finds bugs. Its own
suite can only show that its parts behave as written. The real evidence is an
application with deliberately planted bugs, pointed at the engine, asserting
that each one is found -- which is what `proving-ground/` is for and why it is not
an optional extra.

A second limit is inherent rather than a gap to close. Metamorphic checks buy
self-consistency, not correctness: a bug that is consistently wrong passes
every round-trip, idempotence and commutativity relation there is. Catching
that class needs a test oracle computing the expected answer from a source of
truth, and `CLAUDE.md` records the trap that makes oracles fail silently.
