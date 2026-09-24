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

**The early entries are reasoning rather than shipped code**, because for the
first few days almost nothing was built. Those decisions each cost a real
argument, and re-deriving them would cost it again.

---

## 2026-09-24: a `phileas` command, and a Node floor of 24

**The command.** Raised while running the train demo, where changing the
number of Routes for one run meant editing the Journey file and editing it
back. `phileas run [config] [flags] [-- Playwright arguments]` takes `--seed`,
`--routes`, `--trip-length`, `--route-deadline-ms`, `--journey-deadline-ms`,
`--show` and `--hop-delay-ms`, and overrides the Journey for that run only.
Its own command because Playwright refuses flags it does not know: measured on
1.63, `playwright test --routes 5` fails with "unknown option". The config
defaults to `phileas/`, the consumer layout's folder, so `phileas run --routes
3` is enough in a consuming repository; that default was asked for when
offered.

**How a flag reaches the run.** The command refuses an unknown flag or a
missing value, puts each value in an environment variable, and starts
Playwright's own command-line entry, found from the config's folder. Those
variables are the only channel Playwright's workers take. The Journey file is
loaded separately by the config, global setup and each worker, and all of them
pass through `defineJourney`, so that is where the overrides are applied, and
checked by the same rules as the file's own terms. A refusal names the
variable, and the command's help lists each flag's variable. The command is
plain JavaScript and checks no values itself, so the rules live in one place:
Node cannot load the engine's TypeScript, whose imports carry no file
extensions.

**Two changes to what was there, both agreed with the design.** A seed in the
environment now wins over one pinned in the Journey file, where it used to
lose, which would have ignored `--seed` without a word. And `startJourney`
takes the whole Journey rather than its seed, lives in `src/start.ts` since it
reads settings from three files, and prints every setting in force, marking
each one set for this run; consumers' global setup no longer prints the seed
itself. It also reads the window mode and hop delay, which were first read
after Electron had launched, so `--show frnt` is now refused before anything
starts. Measured through the command: `--routes 0`, `--routes 2.5`, `--show
frnt`, `--hop-delay-ms soon` and `--route-deadline-ms 5` were each refused by
name before any launch.

**Tested.** Seven tests: the flag parser and its refusals, overrides applied
and recorded, bad overrides refused by variable, the early refusal, the
printout, and the command run for real against `buggy` with one Route of two
hops, checking one test registered and the Journey file unchanged. Positive
controls: with `defineJourney` ignoring the variables, the four tests that
depend on it failed and the real run registered all five Routes; with
`startJourney` not reading the window mode, the early refusal failed.

**The Node floor went from 20 to 24.** Asked why it was 20: no reason is
recorded, it arrived with the first commit, and it was already unreachable,
since `electron` 44 declares `node >= 22.12.0`. From Node's release schedule
as of this day: 20 ended 2026-04-30; 22 is in maintenance to 2027-04-30; 24 is
active LTS, in maintenance from 2026-10-20 to 2028-04-30; 25, an odd release
that never becomes LTS, ended 2026-06-01; 26 is current and becomes LTS on
2026-10-28. 24 was recommended and chosen as the oldest release still in
active LTS; 25 was ruled out as already ended, and 26 as needed by nothing and
not yet LTS. The engine has only ever run on Node 25.9.0, which is past its end
of life, so 24 is a stated floor rather than a tested one.

## 2026-09-24: a menu hop hands its handler the Route's window, in every mode

**How it surfaced.** Watching the train demo in `front` mode, menu hops
stopped partway through each Route, after a note that menu candidates were
withheld because no window held focus. The journals showed that once focus
went, it never came back for the rest of the Route, and that nothing in the
application preceded its going. A rerun with a positive control settled the cause:
Finder was brought forward during Route 1, and menus were withheld from the
next survey, 0.6 seconds later. Undisturbed Routes kept them for all 50 hops.
One Route lost focus 2.5 seconds in with no known cause, and the demo's
replay of it did not retrace: the runs differed at hop 4.

**The finding that mattered more.** A menu item was added at run time whose
handler recorded the window it received. Clicked the way `clickMenuItem`
clicked, `item.click()` with no arguments, it received no window with the
application hidden, and equally with it shown, frontmost and focused. Passed
the window through `click(event, focusedWindow, focusedWebContents)`, the
signature Electron documents, it received the window in both. So focus was
never what a menu hop was missing. The entry below from 2026-09-22 read it
that way because its positive control, `buggy`'s View menu, falls back to the
first window when handed none; so does the train demo's. Two consequences had
been standing:

- In a shown run, a menu hop whose handler uses its window with no fallback
  did nothing and was journaled as done, which is the failure the focus rule
  was written to prevent.
- What a Route could draw depended on whatever else on the machine held
  focus, so a seed stopped reproducing when someone clicked elsewhere.

**The fix.** `clickMenuItem` takes the Route's page and hands the handler that
page's window and web contents, with the event a mouse click produces. The
focus check is gone, so the menu is offered in every window mode, hidden
included. A test adds a handler with no fallback and asserts it receives the
Route's window; restoring the bare `item.click()` made it fail, receiving
`null`. One case stays out of reach: a handler that ignores its arguments and
asks `BrowserWindow.getFocusedWindow()` itself gets nothing while hidden,
which phase 5's check that a hop changed something is what sees. Chosen from
three options on a recommendation; the other two were reclaiming focus in the
shown modes, and only reporting focus changes.

**Menu entries no longer keep a Route from stranding.** Offered in every mode,
the menu made the two stranding tests report passed: a Route facing a trap
dialog clicked `View > Show Summary` behind it for all five hops. The menu bar
is on offer on every screen, the same reason the common keys were ruled out
earlier the same day, so the same rule now covers both: they stay in the
draw, and only what the page offers keeps a Route going. The cost is a page
whose only way onward is a menu entry, which strands. Agreed on a
recommendation. Counting the menu again made both stranding tests fail.

**The keys and the menu each get an eighth of the draw.** Drawn evenly with the
page, the menu took a share set by how sparse the screen was: 19% of hops on
the rail demo, 48% on `buggy`, 45% on trickster-tales' Library screen, whose
15 entries changed the screen in none of the 44 menu hops its journals hold.
Adding a menu eighth to the keys' quarter was then questioned as too much,
since 3/8 of hops would go to something other than a page control, and the
rail demo's journals put the cost on the keys: 138 key hops changed the screen
6 times, against 199 of 306 page hops, 21 of 44 menu hops, and 19 of 45
printed shortcuts. Three splits were offered and an eighth each was chosen,
the recommended one, leaving the page three quarters. A chosen side with
nothing on it falls back to the page. Both shares are provisional until an
IDE's menu is measured: the IDE probes went over the debugging port, which
reaches no menu. Revisiting them at the IDEs' turn was asked for, and so was
making them configurable: an adapter sets `keyShare` and `menuShare`, as it
sets `settleQuietMs`, chosen over the Journey file on a recommendation because
the right share depends on the application. Shares that cannot be drawn with
are refused by name, and the shares used go on each Route's opening journal
line, since a different share takes a different Route.

## 2026-09-24: a native modal hides what is behind it, and a train demo

**The defect, found by building the demo.** Rail Itinerary's ticket purchase
dialog is opened with `showModal()`, and the browser reported it modal. With it
open, the survey still offered the eight controls behind it beside the
dialog's own nine, because the accessibility snapshot of the whole page still
held them. None could be clicked: tried on the demo, a click behind it timed
out after three seconds and left the dialog open. So while a dialog was open
about half of every Hop was wasted and journaled as abandoned, and a dialog
with no way out could never strand, which phase 5's planted trap depends on.

**The fix.** While a native modal dialog is open, `survey` reads only that
dialog, and scopes each candidate's locator to it, so a "Cancel" behind it is
never mistaken for the dialog's own. A Hop's effect is still read from the
whole page, so the page is read once more while a modal is open. Two tests: a
modal hides what is behind it, with the closed dialog as the control, and a
no-way-out modal strands the Route. With the fix switched off both failed,
the trapped Route reporting "passed". Dialogs built any other way are not
recognized, and `OUTSTANDING.md` 1.11 has what that leaves open.

**The demo, stage one.** `demo/rail-itinerary/`, planned in
`DEMO_PLAN_TRAIN.md`: a train travel planner that uses none of Phileas's own
terms, packaged with its own adapter. `npm run demo:train` runs three Routes
of fifty Hops with the window forward and a 300 ms pause per Hop, prints a plain
line per Hop from its journal as it is written, and replays Route 0 to show it
retraces; on the default seed, at twenty Hops a Route, it did, all twenty. 114 tests pass.

## 2026-09-24: the engine owns where journals go

**Why.** After journals moved to a folder per run, each consumer still built
the path itself and handed `runRoute` a finished `journalDir`. So the layout
lived in every consumer, and the engine enforced it without applying it: when
the trickster-tales demo adapter was brought up to date, its old one-folder
layout meant a rerun of any seed would fail on a journal refusing to
overwrite. Every future consumer would have had to copy the layout correctly.

**What changed.** `runRoute` takes `journalsRoot` in place of `journalDir`,
and writes each Route's journal to `<root>/<journey seed>/<run>/` itself,
through `journalFolder`. A consumer chooses the root and nothing under it,
decided at the time: the layout and the run's name stay the engine's, because
phase 7's report and replay find journals by them. `startJourney` settles the
seed and names the run in one call, so a consumer's global setup cannot do one
and forget the other. `buggy` now makes that one call and names only its root.

**What checks it.** A new test runs a Route under a scratch root and asserts
the file lands at exactly `<root>/<seed>/<run>/route-...jsonl`, with nothing
else under the root. The route tests read journals through the same layout.
Two real Journeys of one seed wrote two run folders of five journals each.
112 tests pass.

## 2026-09-24: the keyboard, and the end of the work before phase 5

**Before this, no Hop pressed a key.** Text went in by `fill`, which sets a
value at once and fires no keystrokes, so a defect in a key handler was out of
every Route's reach, and nothing reached what only a key does, such as a
console bringing back its last line on Up.

**What a Route can do now.**

- **Type.** A text field is emptied, then given one keystroke per character,
  recorded as `type`. The emptying is not keystrokes, so the field ends up
  holding the drawn value as it did before.
- **Press a common key.** Enter, Escape, Tab and the four arrows are offered
  on every Hop, one candidate each, pressed on whatever has focus, recorded as
  `press`.
- **Press a printed shortcut.** A shortcut shown in a control's accessible
  name, such as "Save current document (⌘S)", is offered as the key it names.
  Two controls printing one key make one candidate. Native menu accelerators
  are not offered; the entry below has the measurement.

**How they are drawn.** Seven equal key candidates took 7 Hops in 8 on a
screen with one control, so the draw now takes two steps: a share draw gives
the common keys a quarter of Hops whenever anything else is on offer, and a
second draw picks within the winning side. Printed shortcuts are drawn with
the controls, since each belongs to one. The share draw is taken on every Hop,
so the stream advances the same way whatever the screen offered, and both
draws are journaled, so a journal can still be checked against itself. A
quarter was chosen because it presses Up about one Hop in 28 on any screen.
Per-key weights were considered and left as an assessment for after Journeys
on a real IDE, in `OUTSTANDING.md`.

**Three rails, each for a reason found while building.**

- **The common keys alone never keep a Route going.** They are always on
  offer, so counting them would mean no Route ever stranded, and a dead end or
  a trap would read as passed. A screen with nothing but the keys strands.
- **A printed shortcut is excluded whenever its control is,** so a rail that
  names Quit cannot be walked past on the keyboard.
- **The common keys are withheld while an excluded control has focus.** Enter
  on a focused outbound link follows it, so a Tab that landed there would
  otherwise hand the next Enter a way past the rail. This was not decided
  beforehand; it was found while building, and closes a gap the keys opened.

The exclusion predicate is now also handed key candidates, with `source`
'key' and the key, so an adapter can exclude one the names cannot express.

**What checks it.** Four new tests. Shortcuts are read from names in the
glyph forms both IDEs print, and ordinary parentheses are not read as one. A
shortcut disappears when its control is excluded, with the unexcluded case as
the control. The common keys disappear while an excluded link has focus, with
focus elsewhere as the control; with the rule switched off, that test failed.
And typing arrives as one keystroke per character, counted by a listener on
the search box against the journal's typed values; with `fill` put back, that
test failed. Existing tests were updated for the larger pool and the two-step
draw, including the check that every target is the entry its draws point at.
Two runs of one seed matched line for line, and 26 of their 100 Hops pressed a
key. 111 tests pass.

**Every seed recorded before this no longer replays,** since the pool and the
draw both changed.

This closes the work `PLAN.md` put before phase 5: a review of what the two
IDEs need, then the clipboard, journals and settle fixes, R31, and this.

## 2026-09-24: which keys a Route can press, measured

Three measurements before the keyboard work, each changing an answer the
review had already given.

**A native menu accelerator cannot be pressed through Playwright.** On
`buggy`, View > Show Summary was given an accelerator at run time and the key
pressed through `page.keyboard`. The page received the key, as a listener
added for the purpose showed, and the Summary view never appeared, with
windows hidden and with them shown and focused. The control was clicking the
same menu entry, which showed Summary in both modes. So the review's answers
that menu accelerators are a source of keys, and that an accelerator and its
entry are two candidates excluded together, were withdrawn: a pressed
accelerator would be a Hop that did nothing, journaled as one that did.

**Shortcuts the page handles itself can be pressed.** In RStudio and Positron,
a file opened in the editor, a line typed into it, and Cmd-S pressed through
`page.keyboard` saved it to disk in both. Both handle the key in the renderer:
RStudio stopped the event in the page, and Positron marked it handled. The
first Positron run read as not saving, and it had not typed into the editor at
all, so there was nothing to save; the rerun typed first and saved.

**Neither IDE declares its shortcuts, and both print them.** Neither has a
single element carrying `aria-keyshortcuts`. Both put shortcuts in accessible
names, such as "Save current document (⌘S)": 4 on RStudio's resting screen
and 12 on Positron's. So the agreed sources would never have pressed a
shortcut on either IDE, and shortcuts printed in names were added as a
source, read from what the survey already reads.

`OUTSTANDING.md` 1.6 holds the answers as they now stand.

## 2026-09-24: R31, what each Hop did to the screen

**Why.** A journal was read that said a Hop clicked "Compare" and nothing about
what followed. The only trace of an effect was the next Hop drawing from a
different pool, which no reader can turn back into a screen. R31 was agreed as
a Must on 2026-09-23, and designed in conversation against trickster-tales.

**What it records.** Every Trip hop and every Fix step now carries an
`effect`: whether anything in the accessibility tree changed, and which
headings appeared and went away, up to five each with a count of the rest.
`src/effect.ts` works it out from two readings already taken, the survey's
before the Hop and the settle wait's last after it, so it costs nothing extra.
A Fix step gets a full settle wait before its reading, as decided at the
review, and its "before" is the previous step's reading, so the whole Fix
costs one extra read. An effect that could not be read, because the page
stopped answering, is recorded as unreadable, never as nothing changing.

The design choices it carries, each for a reason found on a real application:

- **`changed` is kept apart from the headings,** because a filter on
  trickster-tales changed the screen and left every heading in place.
- **Only the headings that differ are listed,** because an application's
  title and a sidebar heading sit on every screen, and a list view can repeat
  dozens of titles. They are compared as a multiset, so one of two identical
  titles going away is seen.
- **The pool after a Hop is not recorded,** because it is always the next
  Hop's pool, and computing it separately would mean a second full survey.

**The limit to know:** headings describe a screen, not every change on it. A
number changing in a plain paragraph shows only as `changed`. If that matters,
the next step is recording the changed text itself, which costs more.

**What checks it.** Seven tests of `effectOf` over snapshots shaped as
Playwright gives them, covering appearing and going away, a change that moves
no heading, no change at all, an unreadable effect, repeated headings and the
listing limit. One Route test against `buggy`: a Fix step opening the summary
records "Total weight" appearing, and its positive control, a step that does
nothing, records no change, so a comparison that always said "changed" would
fail. On a real Journey the lines read as intended, for instance
`select Clothing` with "5 items" appearing and "12 items" going away, and two
runs of one seed still matched line for line, effects included. 107 tests
pass. On an IDE, resource monitors would mark every Hop as changed; that is
recorded among the IDEs' needs in `OUTSTANDING.md`.

## 2026-09-24: a quiet window for the settle wait

**The defect.** The settle wait read the accessibility tree, waited one frame,
read it again, and called the page settled when the two agreed. On RStudio and
Positron, a console printing a line every 200 ms changed the tree at every one
of twelve samples and still read as settled every time: two reads a frame
apart fall between changes. So a survey could be taken mid-change, and R31
would have read an effect half finished.

**The fix,** chosen at the review: the page counts as settled only once it has
stayed unchanged for a quiet window. The window is an engine default that an
adapter can override with `settleQuietMs`, both chosen after the review
answered that the length varies too much between applications for one value
to suit them all. Every journal's opening line records the window its Route
used.

**How the default's length was chosen: 400 ms, by measurement.** Each
action's effect was timed by reading the tree every frame for several seconds
afterwards and recording every change.

- `buggy`: every effect a single change, finished within 46 ms.
- RStudio: the longest pause inside one effect was 173 ms, among tab clicks,
  and effects of console commands finished within about 700 ms.
- Positron: the longest pause inside one effect was 337 ms, Help drawing a
  page at 466 ms after changes at 45 and 129.

Both IDEs also changed about a second after most actions, and that turned out
not to be the actions' effect at all: it was resource monitors, RStudio's
memory readings and Positron's CPU and memory readings, ticking roughly once a
second. They leave gaps well over 400 ms between ticks, so they do not stop a
400 ms window from settling. Their other consequences, for R31 and for replay
on RStudio, are recorded in `OUTSTANDING.md` among the IDEs' needs. A
`Sys.sleep(1)` in the console produced a real change after about 1.2 seconds,
which is computation; no window should be expected to wait it out, and the
wait's two-second limit returns unsettled instead.

**What it costs.** About 0.4 seconds per Hop, against about 35 ms before.
`buggy`'s five-Route Journey went from about 6 seconds to 46, and the test
suite from 24 seconds to 45.

**What checks it.** A new test gives a page a button renamed every 200 ms and
asserts it is not settled; its positive control, in the same test, runs the
old rule of no window and asserts that the same page does read as settled.
A second new test asserts a quiet page settles no sooner than the window.
Two Journeys of one seed matched line for line once timings were ignored,
with all 100 Hops settled at a median of 414 ms. 99 tests pass.

## 2026-09-24: a folder per run, for journals

**The defect.** A run wrote each Route's journal into
`.phileas-journals/<journey seed>/` and never cleared it, so a rerun of a seed
rewrote only the files it wrote. A rerun with fewer Routes left the earlier
run's extra files beside its own, under the same seed, with nothing to tell
them apart: in one folder, Route 0 had been written by a one-Route run and
Routes 1 to 4 by an earlier five-Route run.

**The fix,** chosen at the review over clearing the seed's folder: each run
writes to a folder of its own under its seed, named for when it started, in
UTC to the millisecond, so folders sort in the order the runs happened and
every run of a seed is kept for a replay to compare against. The name is
settled once in global setup by `resolveRun()` and read inside each Route by
`requireRun()`, through `PHILEAS_RUN`, for the same reason the seed is: a
worker that named its own run would write into a folder no other worker
shares. `resolveRun()` always makes a fresh name and replaces one left in the
environment, since a leftover name would put a second run into the first
one's folder.

**And a journal now refuses to overwrite.** `Journal.open` creates its file
with `wx` rather than `w`, so a journal already at its path is refused with an
error naming it, and the earlier record is kept. With a folder per run that
should never happen; if two runs are ever handed one folder, it fails there
rather than being discovered later.

**What checks it.** Three new tests: a run gets a fresh name even with one
left in the environment, and the names sort and hold nothing a file name
cannot; a missing run name is an error; and an existing journal is refused,
its contents unchanged. The last one's positive control: with `w` put back,
it failed. Two Journeys of one seed, run with a stale `PHILEAS_RUN` set, wrote
two folders of five journals each, and the two sets matched line for line
once timings were ignored, so replay still retraces. 97 tests pass. How long
run folders are kept is still the open question it was.

## 2026-09-24: the clipboard fix

**The defect.** With windows shown, the menu source is offered, and `buggy`'s
adapter excluded only Quit, so its Journeys hopped to Edit > Cut, Copy and
Paste: counted from journals on disk, one Journey hopped Cut 9 times, Copy 10
and Paste 6. That did three things, none visible from the record. It
overwrote whatever the person running the Journey had copied. It could carry
that content into evidence, since Paste puts it into the page and from there
into any failure screenshot or trace. And it broke replay, since what a Paste
inserts is state from outside the seed and the journal does not record it. A
hidden run was unaffected, because it withholds the menu.

**The fix** is `buggy`'s adapter excluding `Edit > Cut`, `Edit > Copy` and
`Edit > Paste` by menu path, the paths read from journals of real shown runs
rather than assumed. The engine excluding the standard menu entries by default
is agreed separately and not built, and this fix did not wait for it.

**What checks it.** A new baseline test reads the Edit menu from the running
application and fails if any entry beginning Cut, Copy or Paste is not
excluded, so an entry added later, such as Paste and Match Style, fails there
rather than being reached. Its positive control: with Paste taken out of the
list, it failed, naming `Edit > Paste`. The existing test that every excluded
menu path still names a real item covers the three new paths too. A shown
Journey of five Routes afterwards offered no clipboard entry in any pool,
while `Edit > Select All`, from the same menu, appeared 19 times, which shows
the menu was being offered. 94 tests pass.

## 2026-09-24: the review before phase 5, and what it settled

The work before phase 5 opened with a review of what the two IDEs need, so
that its order would be settled with those needs in view. The open questions
were pooled into one section of `OUTSTANDING.md` on 2026-09-23, grouped by
area, and each was answered by choosing among options put to the user, most
of them with a recommendation marked. What was chosen, and where it now
lives:

- **The schedule for the IDE items** was approved as proposed: three measured
  before phase 5, two designed before phase 9, two in phase 5, and the
  debugging-port launch at RStudio's turn. The measuring became the probe in
  the entry below.
- **Reading inside frames** goes at the IDEs' turn, after phase 9, since
  nothing earlier is known to need it.
- **The order of the work before phase 5:** the clipboard fix, then the
  journals fix, then the settle fix, then R31, then the keyboard. `PLAN.md`
  has it, with a reason for each place.
- **The clipboard fix** is `buggy`'s adapter exclusion alone. Default
  exclusions for the standard menu entries were agreed separately: by role,
  written in the journal, and allowed back by an adapter.
- **Journals** go to a folder per run rather than clearing the seed's folder,
  so earlier runs stay available for replay.
- **The settle fix** is a quiet window, its length set by measurement.
- **Fix hops** get a full settle wait before R31 reads their effect.
- **Text goes in by typing**, always, recorded as `type`.
- **A menu entry and its accelerator** are two candidates, excluded together.
- **Keys to press** come from menu accelerators, `aria-keyshortcuts`, and a
  fixed set of ordinary keys pressed on whatever has focus.

`OUTSTANDING.md` and `DEFECTS.md` carry each answer where its area is
recorded, and the section that pooled the questions is gone.

## 2026-09-24: a probe of RStudio and Positron, and a flaw in the settle wait

The review before phase 5 scheduled three of the IDE items to be measured
first, by one probe of RStudio: frames and webviews, the cost on a large
application, and a page that never stops moving. The probe ran against the
installed release, 2026.09.1, over the debugging port, since that release is
hardened. It was a throwaway script outside the repository, carrying copies of
`surveyPage` and `settle` as they stood at `2397b44`, because the engine's
TypeScript does not run under plain `node`. Every result below was read against
a control.

**Frames are a real gap.** Help, the Viewer and the data viewer each render in
an iframe, and the survey reads none of them: the page's accessibility snapshot
held no iframe nodes, and text rendered in the Viewer was absent from it. The
control was the same string test finding "Console" and "Environment" in the
page. The data viewer's frame alone held 57 named controls the survey cannot
see, and the data viewer is where the second of RStudio's recorded bugs sits.
The first run of the probe got this wrong: the Viewer text it looked for was
also echoed by the console, so it was found in the page for the wrong reason.
The rerun built the text in R, so the echo could not match.

**Cost is small at this size.** A survey took 10 to 20 ms, found at most 62
candidates and produced at most 38 KB of snapshot, including with the data
viewer open and 40 objects in the environment. Over the debugging port there
is no menu source, so menu entries are not in those numbers.

**A blinking cursor does not register.** Sampled every 250 ms for three
seconds, idle and with the console focused, the tree was the same all twelve
times. The cursor is not in the accessibility tree.

**The settle wait can call a moving page settled.** With the console printing
a line every 200 ms, all twelve samples differed, and the control confirmed
the printed lines were in the tree. The settle wait still returned settled
every time, in about 35 ms over two reads: its two reads are one frame apart,
so they fall between updates and agree. With a line every 5 ms it did the
opposite, spending its whole two-second limit on four tries of five. The
first is the worse of the two, since it is silent, and `DEFECTS.md` carries
it.

**The debugging port needs its own Electron profile.** Pointing `HOME` at a
throwaway folder kept RStudio's own configuration and R's out of the real
ones, and did not move Electron's: the first run wrote caches, cookies and
local and session storage into the machine's real profile. Adding
`--user-data-dir` moved all of it into the throwaway folder, and a checksum
comparison of the real profile showed no change.

**Positron was probed the same way the same day**, version 1.130.0, over the
debugging port with its own `--user-data-dir` and `--extensions-dir`, and an R
4.6.0 session started from its picker. The same controls passed.

- **Frames:** Help and the Viewer are webviews, each a nested iframe, and the
  survey reads neither; the Viewer's text was found in one of the frames and
  not in the page. The data explorer is different: it is drawn in the page
  itself, and opening it raised the survey's count from 57 to 72.
- **Cost:** a survey took 7 to 66 ms over at most 72 candidates and 34 KB,
  slower than RStudio with webviews open and still small.
- **Settling:** the cursor again did not register. With a line every 200 ms,
  all twelve samples differed and every settle returned settled. With a line
  every 5 ms, every settle also returned settled, in 47 to 85 ms, where
  RStudio's ran out its limit: Positron appears to batch console output, so
  even a fast stream reads as still between batches. The flaw in `DEFECTS.md`
  is therefore not one application's.
- **A profile folder's path has to be short.** Positron refused to start with
  its profile in a deep folder: its IPC socket lives inside the profile, and a
  socket path over 103 characters fails to bind. A per-Route profile folder
  needs a short path for that reason.

## 2026-09-23: everything open written down before any of it is built

Asked what was still only in the conversation, and the answer was a lot: an
agreed requirement, R31, existed only in a branch's plan, and neither the order
of the work before phase 5 nor several defects and measurements had been
written anywhere. The instruction: "Make sure everything is recorded. We
can't keep information only in a session and lose it." So before any of that
work starts: R31 is in the requirements with
its design in `OUTSTANDING.md` 1.9, the keyboard work is one entry, 1.6, the
two IDEs' unmet needs are 1.10, two defects are in `DEFECTS.md`, default
exclusions for Electron's standard menu entries are an open question, and the
order is in `PLAN.md` under "Before phase 5".

Two decisions made in passing and recorded here. **"Stream" stays** for the Fix
and Trip's seeded sequences, over "sequence": the Fix is already defined as a
sequence of fix hops, and the collision would be inside the project's own
vocabulary, where Node's meaning of "stream" is outside it and unused by the
journal. **The `PHILEAS_` prefix stays,** and so does the name
`PHILEAS_HOP_DELAY_MS`: asked whether the prefix was too long, and after the
weighing, the answer was that it is not the problem.

One correction made on the way: `ORIENTATION.md` said a rerun of a seed
rewrites its journal folder. It overwrites only the files it writes, which is
one of the two defects.

## 2026-09-23: four targets, and whether the engine is useful on the large two

The docs had called Positron and RStudio "external candidates", and in
conversation RStudio was described as only having been studied. Both were
wrong:
the engine is for four applications, `613-mitzvot` and `editor` first and
Positron and RStudio eventually, and `OUTSTANDING.md` 1.8 now records what
each will need.

The question that produced it was a fair one: the engine looked useful for
small applications, somewhat useful for Positron, and useless for RStudio. The
answer, from what was already recorded rather than new measurement, was that
RStudio's three recorded bugs all sit in the part discovery reaches and were
all missed by its scripted suite; that its real obstacle, the hardened release,
is a build choice, since it is open source; and that Positron's difficulty is
breadth, which is the problem the Fix was invented for. Two concrete cases were
worked through -- asterisks saved as underscores, and console history -- and
they are recorded there as what the engine has to be able to reach. Both need
key presses, which were recorded and unscheduled, and which are now next after
the hop-effect work, ahead of phase 5.

What stays true: until phase 5 adds checks, the engine has shown it can
travel and replay, not that it finds anything.

## 2026-09-23: one name for where the application is

The trickster-tales demo adapter read its checkout's location from
`TRICKSTER_TALES_DIR`, a name made up for that one adapter. Asked why an
adapter would choose its own: there was no reason. Left to each adapter, every
application would come with its own variable to find and document, and the
command to run a Journey would look different for each.

The deployment shape settled earlier -- adapters in a repository of their own,
pointed at a checkout someone built -- has exactly one fact that differs from
machine to machine, which is where that checkout sits. So the engine names it
once, `PHILEAS_APP_DIR`, and `requireAppDir()` reads it. A run tests one
application at a time, so one variable is enough. It refuses by name when the
variable is unset or is not a folder, for R24, rather than letting an adapter
build a path out of nothing and fail later somewhere that says nothing about
why. An adapter inside the application's own repository, as `buggy`'s is, does
not need it.

## 2026-09-23: choosing from a native dropdown

Found by pointing the engine at trickster-tales for a demo, the first real
application it has traveled through. Every one of the fourteen abandoned Hops
across three Routes was an option in a native `<select>`, its two Compare
pickers. Playwright cannot click an `<option>`, so each Hop that drew one spent
its whole time limit failing, and no dropdown's value could ever change. The
feature list had said dropdowns were opened but not chosen from "on purpose",
which was wrong: they were never chosen from at all.

It is a gap in the engine rather than a limit of the platform. Measured on
trickster-tales: clicking an option timed out; choosing it through its
dropdown with `selectOption` set the value; with both pickers set the
application responded, since it listens for the change event that
`selectOption` fires. It works with windows hidden, because it never opens the
native list.

So there is a `select` action. An option is chosen through its dropdown, by
its position there rather than by its label, which can repeat. Whether an
option belongs to a native dropdown is asked of the page, and only for
options: the accessibility tree calls both kinds an option, and an option in a
list built from ordinary elements is still clicked. `buggy` gained a category
dropdown so a test can prove it; the test was shown to fail with `select`
removed. Like `fill`, it sets the choice without the keyboard, which
`OUTSTANDING.md` records beside `fill`.

**The dropdown itself is focused, not clicked, and the reason was found by
the dropdown `buggy` gained.** The first Journey after it took a minute rather
than seven seconds. Every hop was fast; the time was going into closing the
application. Measured six times each: a close took about 40ms on `main`'s
bundle, on this branch, and after a `select`, and 0.7 to 10.4 seconds after a
click on the dropdown. Clicking a native `<select>` opens the operating
system's popup list, in the main process even with windows hidden, and until
it is dismissed the application is slow to close. The engine has always
clicked dropdowns; `buggy` simply had none until now, and on trickster-tales
it went unnoticed.

Two answers were weighed: focus the dropdown, or stop offering native
dropdowns at all. Focus was chosen as the option that tests dropdowns most
fully: it keeps every control the accessibility tree reports reachable, so a
recorded pool still matches the screen, and focus is a real event an
application can mishandle and the place a keyboard would act on a dropdown
once keys exist. After it, a
close took 33 to 47ms and three Journeys took about six and a half seconds
each, with no Hop abandoned.

## 2026-09-23: a journal a person can read, as R30

Asked whether a person should be able to read one Route's journal, and when.
Nothing numbered said so: R9's "readable" meant the file survives and parses,
and the one sentence that meant a person was an edge case in section 9. R12
covers the report, not the journal.

Three ways were weighed: a requirement and a reader now, the view as part of
the phase 7 report, or no view at all. A reader built now needed either a
transpiler dependency or a change to how the engine's code is written, since
plain `node` would not run the one started, and it risked a second renderer
beside the report's. Dropping it left the requirements' own triager, who
"often did not run the journey", reading raw JSON.

**Decided: the requirement now, the view in phase 7.** R30 costs nothing to
write and settles what "readable" means; building it inside the report means
one renderer and no new dependency. Reading journals through phases 5 and 6
stays a matter of `jq`, which pools made tolerable. If that hurts, the
renderer moves forward rather than being built twice.

Recorded alongside it: `fill` sets a value without pressing a key, so a
defect in a key handler is out of every Route's reach. It is in
`OUTSTANDING.md` as undecided.

## 2026-09-23: a map, allowed and never required

A per-application list of controls had been recorded as declined since the
project began, on the grounds that an adapter listing every control would be
more precise and would stop this being a framework. **That reasoning holds
only for a map that is required**, and it had been applied to any map at all.
Reopened on 2026-09-23, in these terms: discovery relies on nothing handed to
it and stays the ordinary case, and someone who knows the application may give
the engine a map, full or partial, with discovery covering whatever it leaves
out. It is R29, a Could.

It is phase 10, after the current last phase, and both reasons are about
evidence. Phase 8 has to show that discovery alone finds every planted
defect, which a map present by then would blur. Phase 9 is the first real
application, and where discovery actually fails there should decide what a
map entry does. So the design is recorded as open rather than guessed: what
an entry does, what happens to one that is stale, where a map comes from, and
how a journal marks what a map supplied.

The two routes by which the old decline said a map would sneak back in -- read
from the application's source, or from its automation bridge -- are now
legitimate ways to build one, beforehand. What `CLAUDE.md` still rules out is
discovery coming to depend on either: the engine reads no source at run time,
and `survey` does not read a bridge.

## 2026-09-23: optional deadlines, and one glossary

**Both deadlines are optional, and leaving one out means no limit.** A Journey
used to require a deadline, and each Route's time limit was calculated in the
consumer's Playwright configuration as three seconds per hop plus thirty. The
common case turned out to be neither: a Journey takes as long as its Routes
take, which is still bounded by the number of Routes and their Trip length, and
every Trip hop already has its own time limits. The part a Route deadline
guards is the Fix, which is the Journey's author's own code.

So a Journey states `journeyDeadlineMs` and `routeDeadlineMs` if it wants them,
named as a pair, and the calculated Route timeout is gone, because how long a
Hop takes depends on the application and the formula guessed. Both reach
Playwright through `playwrightTimeouts`, which exists for one trap: leaving
Playwright's per-test `timeout` unset does not mean no limit, it means thirty
seconds, so an unset Route deadline has to arrive as an explicit zero. Zero is
refused in a Journey's definition for the same reason in reverse, so that no
limit is only ever said by leaving the deadline out.

**`docs/GLOSSARY.md` became the one place terms are defined.** The README had
a vocabulary table and the requirements a list of terms, each a second copy of
the other and of the glossary. Both now point at the glossary, following the
convention that nothing is summarized across documents. Assembling it surfaced
several definitions that had drifted or were wrong: the Fix described in terms
of steps rather than hops, a Trip hop defined without the Trip, a separate
"budget" term that only renamed the Journey's settings, and a class name,
`PageUnreachable`, listed as though it were a term.

## 2026-09-23: Trip length

The setting that bounds a Route was called `hopsPerRoute` in a Journey's terms
and `hopBudget` in the journal, two names for one number, and both were wrong
about its scope. It counts Trip hops only: the Fix runs first on its own
counter, so a Route with a three-step Fix and a length of 20 takes 23 hops.
R1 said "a maximum number of hops per route", which the code never did.

It is now `tripLength` everywhere, and R1 says "the length of each route's
trip in hops". Chosen from ten alternatives for the amount. The list itself
had favored "budget" and "allowance", on the grounds that the number is meant
to be reached, and `tripLength` was picked over them. Its catch, that
"length" could mean time, is covered by the documented unit.

"Budget" now means only the whole run's bound, the routes, Trip length and
deadline together, as the requirements already used it, and a settle wait's
time allowance. The journal's definition in the requirements and README also
stopped saying "one entry per hop", since it holds pools, notes and the
opening and closing lines too.

## 2026-09-23: the journal format, and the Trip

Every line a Route writes changed shape, decided one member at a time by
reading real journals rather than by designing in the abstract.

**The unpredictable part of a Route has a name: the Trip.** "Traversal" was
used throughout phase 4 and is wrong for this engine, because traversal in
computer science means systematic coverage and a seeded draw over whatever
the screen offers is not that; `../CLAUDE.md` already said the engine travels
rather than traverses. The noun it left missing is Trip, chosen over "trek".
Trek had been weighed as fixing Trip's two catches while sounding larger than
the Route it sits inside; the choice itself came with no reason given. The
catch accepted with it: "trip" is also a verb for a check that
fires, so the project avoids that use.

**The rename changed every seed.** A stream's name is hashed into its seed, so
renaming 'traversal' to 'trip' moved every draw of every Route, and every seed
recorded before it stopped reproducing. Done deliberately while no recorded
seed mattered. The known-answer test pinning that stream was not updated by
copying what the engine produced afterwards, which is the oracle drift
`../CLAUDE.md` warns about. A separate implementation of the generator in
another language, sharing no code with `src/random.ts`, first reproduced every
value pinned before the change, and then computed the new ones.

**What a journal line holds now**, each change from reading one:

- `kind` is `fix-hop` or `trip-hop`. The separate `phase` member is gone: it
  was a classification, not a period of time, and its value was the
  forbidden word.
- A Fix hop has its own shape. The old one reused a Trip hop's and three
  members were fictions on it: a role invented as `fix-step`, a `chosen` that
  nothing chose, and an always-empty candidate list. It holds only what is
  true of a Fix step, and a step that fails now gets its own line with the
  error on it; before, R11's "which step broke" survived only as a sentence
  inside the outcome's reason.
- `chosen` became `target`, which stays true when the action failed and makes
  no claim about how the thing was selected.
- `action` records `click`, `fill` or `menu-click`. It used to be inferred
  from the role by a rule that lives only in the source. `fill` is not typing:
  it sets the value without pressing keys.
- Hop numbers count from 1, because a person reads them, and the Fix and the
  Trip are numbered separately, so editing the Fix does not renumber the Trip.
- Candidate lists are written once, as `pool` lines keyed by a digest of the
  list in order, and each hop names its pool. Twenty hops over eleven
  candidates had been several hundred lines of mostly the same menu. A pool is
  always flushed before the first hop that names it, so a file cut off
  mid-write never holds a hop pointing at a missing list.
- Each Trip hop records its `draw`, the generator's raw 32-bit integer. A
  replay then names the hop where the seeded sequence broke even when the
  broken draw lands on the same target by chance, about one time in eleven
  over eleven candidates. It also makes the file checkable with nothing
  launched: the target must be the pool entry the draw points at.
  `tests/route.spec.ts` checks exactly that, and was shown to fail on a
  mutated chooser that acted on the first candidate while reporting its draw.

**Decided here for phase 5**, recorded in `PLAN.md`: checks run after Fix hops
too, and one that fails there is a Fix failure.

**Also fixed on the way:** `FixFailure`'s documentation had been separated
from its class when `PageUnreachable` was inserted between them in phase 4,
and the test counts quoted in `../ORIENTATION.md` and `../README.md` had not
been updated when the window modes merged.

## 2026-09-23: a run that can be watched

`PHILEAS_SHOW` became four modes: `hidden`, `back`, `front` and `top`. A person
running with the old `PHILEAS_SHOW=1` saw nothing, and every reading from
inside the process said the window was fine: visible, not minimized, fully
opaque, 900 by 640 in the middle of the display. **Showing a window does not
activate the application.** A process launched from a terminal does not
become frontmost on macOS, so the window was drawn behind whatever the viewer
was looking at. Confirmed by a person watching the screen, which is the only
evidence available here, since the tests can observe visibility and
always-on-top but not activation.

`back` keeps the old behavior on purpose and is what `1` still means, because
a run that does not take the screen away is the useful default for watching.
`top` exists because it costs one line, and is the mode that was measured by
trapping a viewer who could not switch away from it.

`PHILEAS_HOP_DELAY_MS` pauses after each hop, because a Route spends twenty
hops in about a second and a visible blur is not watchable. It consumes no
draw and stays out of the recorded hop cost: a Route watched at a 1000ms delay
recorded a median hop of 27ms.

**A literal NUL character sat in `src/survey.ts` from phase 4**, where an
escape was meant. `grep` treats such a file as binary and skips it in silence,
so every search against it returned a clean zero for a whole session. A
positive control is what caught it: a search for a string known to be in the
file came back empty. `random.ts` had already documented this hazard and
avoided it. `tests/no-control-characters.spec.ts` now fails on any control
character in the source, and was checked by planting one.

## 2026-09-22: phase 4, the first code that travels

`survey.ts`, `route.ts` and `journal.ts`. A Route now surveys the running
application, draws a candidate from its seed, acts on it, waits for the page to
stop moving, and writes down what it did and what else it could have done.
Engine tests went from 46 to 67.

**The phase boundary was met and is worth stating as a measurement.** Two runs
of the seed `deadbeef1234`, five Routes of twenty Hops each, produced journals
identical file to file once timestamps and durations were stripped. The
positive control for that comparison was Route 0 against Route 1 of the same
run, which differ from hop 0 onward, so the comparison can tell journals apart
and the identical result means something.

### Discovery by role, and the handle that was rejected

Three mechanisms were measured against the testbed on Playwright 1.63 and
Electron 44. `element.computedRole` and `computedName` do not exist in that
renderer. `page.accessibility.snapshot()` no longer exists in that Playwright.
What works is `locator.ariaSnapshotJSON()`, which returns roles, accessible
names and state in document order with anything invisible already filtered out.

That snapshot also offers an opaque per-element handle under a `mode: 'ai'`
option, resolvable as `page.locator('aria-ref=e6')`, and clicking one was
measured to work. **It was rejected anyway, for two reasons that are
independent of each other.**

It is not stable API: it appears zero times in `playwright-core`'s published
types, where the same search finds `data-testid` nine times and `aria-label`
thirteen; it is absent from the documented selector engines; and it resolves
only against the single most recent snapshot in that frame, so any other
snapshot taken in between silently invalidates every handle. Playwright is a
peer dependency here, so the consumer picks the version and the engine cannot
pin around a break.

The second reason decides it on its own. **A journal needs an identifier that
means something when it is read later.** `button "Summary" #0` can be found by
a person retracing a Route a week afterwards; `e6` cannot, so the handle could
never have replaced what the record has to carry regardless. So the triple of
role, accessible name and position among controls sharing both is used for
both jobs, and the action goes through Playwright's own documented
`getByRole(...).nth()`. Verified against two buttons sharing one name, planted
for the test because the testbed has no duplicate: `nth: 0` and `nth: 1`
reached the two different buttons.

### The menu-hop defect closed by detection, after a repair was tried and failed

`DEFECTS.md` carried it from 2026-09-22: Electron hands a menu item's click
handler the focused window, an automated run has no focused window because the
engine hides them on purpose, and `clickMenuItem` reports success either way.

**A repair was attempted first, and measured not to work.** The engine already
intrudes into the main process to hide windows, so replacing
`BrowserWindow.getFocusedWindow` there to return the first window is the same
kind of intrusion and would have repaired the exact consequence the first
intrusion causes. It has no effect: Electron resolves the focused window for a
menu click natively rather than through that binding. Calling `focus()` on a
hidden window does not give it focus either.

The positive control matters here, because "clicked and nothing happened" is
also what a broken test harness produces. The testbed's own `Show Summary`,
whose handler falls back to the first window, toggled the view under exactly
the same conditions, and `Show Inventory` toggled it back. So the menu walk is
sound and the focus is genuinely what is missing.

So the cheap form in `DEFECTS.md` is what shipped: `survey` asks whether any
window holds focus, and withholds menu candidates with a stated reason when
none does. **The cost is real and is not hidden.** Under an ordinary run the
menu source is unavailable, so `menuPaths` exclusions never fire either; the
journal records the withholding once per Route so that it cannot be mistaken
for an application with no menu. `PHILEAS_SHOW=1` brings both back. The fuller
answer, whether a hop changed anything at all, is phase 5's and is worth more
than a menu-specific one.

### Settling, decided by measurement

`PLAN.md` named three candidates and no favorite, and said the engine cannot
require an application to tell it when it has settled. The wait is bounded and
so is every snapshot inside it, for the reason the section below gives. What shipped is the
first of the three: read the accessibility tree twice with a frame between, and
stop when two consecutive reads agree. It measures the thing the traversal
actually depends on, which is the survey being stable, rather than a proxy for
it.

Measured over 100 Hops against the testbed: median 17ms, minimum 8, maximum 23,
1.67 seconds in total, and no Hop failed to settle. The wait is bounded and
returns unsettled rather than throwing, because a page that keeps moving is a
finding for the checks to make rather than a reason to abandon a Hop. **The
verdict is written into the journal**, which it was not in the first draft:
computing it and dropping it would have left an application that never settles
invisible, which is the prevention-and-detection shape this project keeps
finding in its own work.

### The navigation hazard is bigger than the plan recorded, and was measured

`PLAN.md` carried it as "a hop must not wait for navigation to finish, or a
single outbound link costs a Route its whole budget", measured in phase 2 from
a click that hung for a full default timeout. Bounding the click was the
obvious fix and it is not sufficient, which a test written for the measured
case is what found.

**Every Playwright locator call waits for any pending navigation to finish.**
An application that routes external links through `will-navigate` and calls
`preventDefault` leaves a navigation that never finishes. Measured against the
testbed on 2026-09-22: after a click abandoned at 705ms, snapshots were still
blocked at 8.8 seconds with no sign of clearing, while `page.evaluate` answered
in 7ms throughout. So the page is alive and the barrier is Playwright's, and a
Route that reaches an outbound link is poisoned for every hop after it rather
than for one.

What shipped: every snapshot the traversal takes is bounded, in `survey` and in
`settle` both, and a survey that cannot be taken after a Hop ends the Route as
`PageUnreachable`, naming the hop and what it acted on. It is deliberately not
stranded, because moves were available and the traversal took one; stranded
would assert a dead end in an application that has none. The exclusion list
remains the first defense and this is the second, for the entries a list
missed.

### Two items from the review, closed

The determinism control for the `exclude` predicate ended up in `survey` rather
than in the choosing seam where `OUTSTANDING.md` expected it. The reason is
that exclusions are applied before the draw, so that the draw is over what may
actually be hopped to, which means `survey` is where the predicate is
consulted. It runs the predicate twice for one candidate per Hop, rotating by
hop index so a Route of twenty covers twenty different candidates rather than
one candidate twenty times, and throws when the two answers differ.

The never-matched counter for exclusion names is per Route and lands in the
journal's closing entry, because Routes are independent and may run in separate
processes; rolling it up across a Journey is the report's job in phase 7. It
already earned itself on the first run: `menuPaths: Buggy > Quit Buggy` matched
nothing, correctly, because the menu source was withheld.

### One test was written, found to be a fake, and replaced

A test named for the value stream advancing on every Hop compared one generator
against itself. It would have passed against exactly the conditional draw it
was written to rule out, which is the same trap the previous session's review
found twice in `journey.spec.ts`. The replacement drives a real Route with a
chooser that never picks a control accepting typed input, and asserts a value
was generated on every Hop regardless. **A test that cannot fail is worse than
no test, because it reads as coverage.**

## 2026-09-22: a full review, and what reading alone could not find

Eight agent reports over the whole repository, in two rounds. About 106
findings against roughly 1,500 lines of source, which is a high rate and mostly
reflects a codebase that states its intentions in prose: a claim can be checked
against the code beside it, so most findings are a comment or a document being
falsified rather than a style opinion.

**Three agents found the same defect by three different routes**, which is the
strongest signal the review produced. The reference adapter could not deliver
R24: `index.html` shipped its readiness marker already reading "ready", so
`waitForReady` sampled it once, read success, and fell through to a ten-second
wait on a list a failed boot never renders. Reading comments against code,
hunting evidence that depends on its own guard, and asking what a string type
can represent all arrived at it.

**Two findings existed only because an agent broke the code and watched the
suite stay green.** Changing the generator's warm-up count and digest length
left all fourteen seed tests passing, and replacing `requireSeed`'s return with
a freshly generated seed left every test and every Route green while each Route
reported a seed that retraced nothing. Neither was reachable by reading. That
mutation testing was not asked for and happened on a clean working tree, which
is worth recording alongside what it found: the reviewing session had put
"do not modify anything" into only one of six agent prompts, and another agent
overwrote the repository's own `package.json` by running `asar extract-file`
from the repository root, then reported the overwrite as a mystery it had ruled
itself out of.

**Two agents were given a narrower scope than the user had asked for**, through
habit rather than reasoning: "focus on src/" and "focus on the four spec
files", against a request for the whole repository. Re-running those two with
the real scope produced twenty-three further findings, including the largest
one in the review.

**That largest finding was an absence.** `buggy` had no recorded baseline.
Phases 5, 6 and 8 plant defects into it and assert a Journey finds each one,
and nothing said what it does when it is working -- so a failing Route could
not have been attributed to a planted defect rather than an accidental one, and
the first success measure in `PRODUCT_REQUIREMENTS.md` section 10 was not a
claim anyone could check.

**Writing that baseline found a defect no agent found.** Electron hands a menu
click the focused window; an automated run has no focused window, because the
application is not frontmost and this engine hides its windows on purpose. So
`buggy`'s View menu clicked successfully and did nothing. `DEFECTS.md` carries
it, because `clickMenuItem` reports success either way and phase 4 makes menu
items a candidate source.

**One fix was proven not to work before it was believed.** The rewritten R24
test passed against the old broken adapter as well as the new one, because the
injected failure arrived before anything looked at the marker. The defect is a
race, and a test built on an instant failure cannot see it. The fault switch
now takes 750ms, and reverting the adapter confirms the test fails against the
old logic and passes against the new.

**What the review cost to act on**: six commits, 46 engine tests where there
were 22, and five new spec files. What it did not cover: the eight markdown
documents, 3,200 lines, which every agent was told to read as reference rather
than as a subject.

## 2026-09-22: phase 3, the reproducibility mechanism

`src/random.ts` and `src/journey.ts` landed, with fifteen unit tests that need
no Electron. The engine can now state the terms of a Journey and derive a
Route's seeds from them. Nothing travels yet.

**The generator is written in the repository rather than taken as a
dependency.** It has to produce the same sequence across machines and Node
versions, and a dependency's algorithm can change under a version bump. That
would be R13's failure arriving from outside the code: recorded seeds quietly
ceasing to reproduce, while every run still passes. It is sfc32, four lines of
integer arithmetic, chosen for being short enough to check by eye, since the
whole reproducibility guarantee rests on it. The derivation uses Node's
SHA-256, which is stable by definition.

**The unit tests assert the three properties that cannot be seen later.** The
same seed gives the same sequence; route 3's stream is identical whether or not
routes 0 through 2 drew first; and consuming thirty-seven draws from the Fix
stream leaves the traversal stream exactly where it was. Each failure they
catch is invisible in a run: the Journey passes, the report names a seed, and
the seed retraces nothing.

**`Math.random` is now checked for rather than merely forbidden**, by a test
that scans `src/`. It carries two positive controls, because the scan has two
ways to report a false zero: the pattern is shown to match a real call, and the
file walk is shown to reach real files. A clean zero from an untested search is
worth nothing, and this one could not be proven the direct way, since deleting
a temporary file inside `src/` is not available in this environment.

**The seed is settled in global setup, not in a spec file's top level.**
Playwright's workers are separate processes, so top-level code runs once per
worker and would hand each one a different seed: every Route would report a
seed that retraces nothing and every Route would still pass. `resolveSeed`
settles it once and puts it in the environment; `requireSeed` reads it inside a
Route's body and throws rather than inventing one. A seed pinned in a journey
definition wins over both, which is how a replay is asked for.

**`testbed/buggy/phileas/` now holds the whole consumer layout**: `adapter/`,
`journeys/`, `journey.spec.ts`, a `global-setup.ts` and a Playwright config of
its own. The config lives with the application rather than in the engine's
root, because that is the shape a real consumer ends up with. `npm run journey`
from the root runs it, which is a convenience for developing the engine and not
part of what a consumer copies.

**The spec file is a for-loop and nothing else.** It reads the Route count,
registers one test per Route, and reads the seed inside each body. Anything
else appearing in it is the planner growing back, which is the one thing that
file is watched for.

**Phase 3's boundary is bookkeeping and says so.** Twenty-one tests pass,
and not one of them shows the engine finds a defect. They show that a seed
reproduces, which is the thing every later finding depends on and the thing no
later phase would reveal on its own.

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

**The `file:` dependency works, and the test is weaker than it looks.**
`testbed/buggy` depends on the engine as `file:../..` and imports
`@drugstoresushi/phileas` by package name; npm symlinks it, and Playwright
resolves the TypeScript source through the link. That is the shape phase 9
gives a sibling repository. But the symlink here lands back inside this same
project, so it says nothing about whether Playwright transpiles a package
whose source sits outside the consumer's own tree, which is the real phase 9
question.

### The Electron binary, twice

`npm install` does not run Electron's postinstall in this environment, so the
types arrive and the binary does not, in both the engine and `buggy`. `node
node_modules/electron/install.js` fetches it. Observed twice, and recorded
because the failure looks like a broken checkout and is not.

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
