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

## 2026-09-28: a log created on its first write, and a staleness guard printed as unable to run

**The log check said it did not run on every Hop of a healthy RStudio
Route,** because RStudio creates its session log only when the session
first logs something, and a named log that does not exist makes the check
not run. That rule stays, since read as nothing a mistyped path would pass
while checking nothing. Chosen from two offered, with a recommendation: an
adapter can now mark a log as created on its first write. A marked log
that does not exist counts as clean, and is read from its start when it
appears; an unmarked one still says the check did not run. RStudio's
adapter marks its session log, and a Route afterwards recorded the log
check as passed on all 20 Hops. A test makes a marked log appear with an
error on the second Hop and fail it.

**The settings printout said `Staleness guard: on` for an adapter with no
sources,** where the guard cannot run, contradicting each Route's
attachment on every RStudio run. It now says the guard cannot run when the
adapter names no sources, and a test covers both cases.

## 2026-09-28: an adapter says what varies in its own messages, and RStudio's terminal finding becomes known

**The engine takes an adapter's own patterns out of a signature,** after
its own, through `varyingInSignatures`: each a pattern with the `g` flag and
what to put in its place. A pattern without the flag is refused by name,
since it would take out only the first of two ids and the finding would
still never match. Each Route's opening journal line records the patterns,
because they decide which findings are known and so where a Route ends.

**RStudio's adapter takes out a terminal's handle,** eight upper-case hex
digits on all five launches that logged one. Replaying the seed that first
found issue 61 then gave its four log lines one signature, `451feaf9`,
where each run before had given a new one. Filed with `phileas known add`
as issue 61, the next replay recorded it as known at hop 18 and carried on,
passing after 20 Hops.

**That replay parted from the earlier ones at hop 15,** Load workspace,
which now opened the in-page dialog where the stub had answered it before.
Every pool after it differed, so the seed took a different Route from
there, as it should once the adapter changes what the application offers;
the terminal close at hop 18 was drawn again by chance. The journal's
pools show the difference, which is what R14 will read.

## 2026-09-28: RStudio's dialogs drawn in the page, and one home guard for both trials

**Native dialogs.** RStudio's native Open and Save dialogs are drawn by
macOS, which Phileas cannot see or act in, so the engine's stub answers
each as cancelled; measured the same day, "Open an existing file" and
"Load workspace" each reached the stub, titled Open File and Load
Workspace. RStudio has a setting to draw them in the page instead,
`native_file_dialogs`, raised as "Use native file and message dialog
boxes". With it off, both opened in the page with a File name box, Open
and Cancel, and the stub recorded nothing. The adapter now writes it off
before every launch, excludes the Global Options checkbox that would turn
it back on, and keeps the stub for anything it misses.

**The in-page dialog shows one link per folder of its path, up to `/`.**
From there a Route could have saved a file anywhere the user can write,
and two of the links are named for the run's and the Route's own random
temp folders, so a replay's pool would have differed from the run's. The
adapter excludes every folder link above the Route's home; asked where
things could then be saved, the answer was only inside that home, since
the values a Route types hold no `/`, `..` or `~`. Checked through the
engine with a temporary Fix that opened the dialog: all nine links above
the home were excluded, and the home, File name, Open and Cancel stayed.
The survey also offered the whole workbench behind the dialog, the gap
`OUTSTANDING.md` 1.10 records for dialogs that are not native modals.

**The home guard is shared,** in `trial/home-guard.ts`, as a trial states
its application: the folders it was measured writing, its executable, and
what its Routes carry on their command line. RStudio's are its
configuration, its state, `.Rhistory`, `.RData` and its Application
Support folder, from what a launch wrote into a Route's home; a known root
may now be a file. Moving it closed its own defect, a guard that read an
unreadable folder as empty and a failed `ps` as no other copy running: it
now refuses a folder it cannot read, says unknown for a failed `ps`, and
prints how much it read when clean. A Route through RStudio afterwards
ended with nothing written among 1,603 files and 250 entries, and the R
library guard's 110 entries unchanged.

## 2026-09-28: an RStudio adapter, its first finding, and a username kept out of signatures

**The adapter** is in `trial/rstudio/`, pointed at the fuse-flipped copy in
the entry below. What each setting rests on, all measured this day with
windows hidden unless said:

- **A splash window.** Three launches each opened a splash from a file in
  the bundle beside the workbench, and closed it about 2.5 seconds later.
  The engine takes the first window by default, which was sometimes the
  splash: one survey failed when it closed. `RS_NO_SPLASH=1`, raised the
  same day, left only the workbench on the next launch, and the adapter
  also picks the workbench page by its loopback address.
- **Logs.** A healthy launch into a fresh home wrote `rdesktop.log`, empty,
  and no session log; `rsession-<user>.log` appears once the session logs
  something. The engine's log check then says it did not run on every Hop,
  which `DEFECTS.md` now carries.
- **Exclusions.** The startup survey offered about 60 page controls and
  over 200 menu entries, with RStudio's `&` mnemonic markers left in the
  menu labels, so an exclusion has to spell them the same way. All 26
  exclusions in the first set matched something. Copilot shows nowhere at
  startup: it is off by default, and its one control found is the "GitHub
  Copilot" option in Global Options' Assistant page. The R memory reading
  changed its name between launches, 121,920 KiB against 122,288 KiB.
- **Packages reach the machine's R.** The machine's R library is writable by
  the user running the Journey, with no prompt. With HOME a fresh folder,
  R's only library was the machine's. With `R_LIBS_USER` naming an existing
  folder inside that home, RStudio's own console listed it first, and the
  Install Packages dialog defaulted to it; the dialog still offers the
  machine's library as a choice. The Packages pane has its own Install and
  Update buttons beside the Tools menu's entries. Every RStudio launch moved
  the machine library folder's own time within two seconds, before any Hop,
  while no package in it changed. Four tests make the guard fire on a change
  and stay quiet on that folder time.

**Four Routes of 20 Hops ran, one at a time.** Two passed. One failed at
hop 18, when "Close current terminal session" left an error in
the session log: `system error 57 (Socket is not connected)` for an
unknown handle. The fourth was its replay, from the same seed: it retraced
all 18 Hops and failed at the same Hop with the same error. A script taking only two steps, opening the
Terminal tab and closing its session, reproduced it on 3 of 3 launches,
and opening without closing logged nothing. It also answered why the Hop
recorded the line twice: RStudio writes each line twice, with the same
timestamp, so the engine was not reading it twice. Filed as
ronplusron/phileas issue 61. No run wrote into the real home, and the R
library guard reported no change after each.

**The first finding's signature carried the username** of whoever ran it,
since RStudio names its session log and each of its lines for the user,
and the Journey's end wrote that into `known-findings.json`, which a
consumer commits. Caught before anything was committed. Signatures now
replace the running user's name, as a whole word, with `<user>`, so a
finding also matches across machines; a test covers it. The same
signature keeps the terminal's handle, a new id each time, which
`DEFECTS.md` carries.

## 2026-09-28: RStudio Desktop launched the ordinary way, from a copy with two fuses switched back on

**The question was which way into RStudio Desktop,** once testing it was
chosen over carrying on with the Positron trial. `PLAN.md` has that
decision. The installed release, 2026.09.1+183, refuses Playwright's
ordinary launch, recorded on 2026-09-21, and the remedy then recorded was a
build from source without the hardening.

**Its fuses, read from the installed application.** The Electron framework
is a universal binary and carries one fuse wire per architecture, both
reading `000000011`. Against the fuse order in `electron/fuses`, fetched the
same day rather than recalled, that is RunAsNode, cookie encryption, the
`NODE_OPTIONS` variable, the inspector arguments, asar integrity checking,
loading only from the asar and the browser-process snapshot all off, and
extra file-protocol privileges and WebAssembly trap handlers on. With asar
integrity checking off, switching fuses in a copy looked likely to work
without disturbing anything else, which is why it was offered; whether it
would also work with that check on was not tried.

**Three ways in were offered:** switching the two fuses Playwright needs back
on in a copy, building from source, and the debugging-port launch against
the release as shipped. Chosen with "Let's flip." after a table of
tradeoffs and a recommendation. The reasons given with the recommendation:
it takes minutes rather than a build, it runs the release's own compiled
code, and it keeps the main process, so hidden windows, the menu, the link
stub and the main-process checks all work. A build from source stays the way
to older releases, as positive controls.

**What was done.** The application was copied with `ditto` to
`~/Applications/RStudio-2026.09.1-fuses.app`, outside `/Applications` and
leaving the installed one untouched. RunAsNode and the inspector arguments
were switched on in both wires, found by the fuse sentinel, with the script
refusing unless there were exactly two wires each reading `000000011`
first. The copy was re-signed ad hoc, which drops Posit's signature and the
hardened runtime, and `codesign --verify --deep --strict` passed.

**Measured with one launch,** through Playwright's own Electron launch as
`launch.ts` makes it, with `--user-data-dir` and `HOME` both pointed at a
throwaway folder, and windows shown since the script did not use the
engine's hidden mode. The launch returned in 9.2 seconds. A call into the
main process answered with the version, one window, and the native menu's
thirteen top-level entries, RStudio through Help. The page's accessibility
snapshot held about 58 named controls: the main toolbar, the panes and their
tab sets.

**Nothing was written outside the throwaway folder,** checked against the
real `~/.config/rstudio`, `~/.local/share/rstudio`, Application Support,
caches, preferences, `.Rhistory` and `.RData`. The control was the
throwaway home, which held RStudio's `.Rhistory`, configuration and
preferences written during the run. The first comparison was wrong and was
redone: `ditto` keeps modification times, so the copy's own files dated
from the original install and matched everything since. No RStudio or R
process outlived the close.

**What it does not settle.** One launch, not a Route. The What's New screen
was not switched off, so whether it was in that snapshot is unknown. And the
copy is not the artifact a user installs: two fuse bytes and the signature
differ, and a finding from it says so.

## 2026-09-28: Eighty Days chooses its Fix with --fix, shows it before its Trip, and a leak in the guided runner

**Found rehearsing the guided demo with the window shown.**

**The switch was misnamed, and the engine had no name for a Fix.**
`EIGHTY_DAYS_JOURNEY` chose a Fix, not a Journey: all eight of its values
shared one set of Journey terms and differed only in where each Trip
started. Reading how the engine met a Fix explained why: `defineJourney`
took none, a consumer's spec passed one to `runRoute`, and nothing recorded
which, so the demo had invented a name. Renaming it `EIGHTY_DAYS_FIX` was
agreed as "a good idea, add it", and the missing link was sent to the
session working on the engine, which made named Fixes part of it the same
day. Asked whether to merge the rename first or hold it, the answer was
"Hold and fold", so `EIGHTY_DAYS_FIX` never reached `main`. Eighty Days now
follows the engine's layout, as the rail demo does: its Journey names
`hong-kong` as its own Fix, `phileas/fixes/index.ts` lists all seven by
name, and `phileas run --fix` or `PHILEAS_FIX` chooses another. The five
stage-two Fixes stay in one file, since each builds on the one before it.
`EIGHTY_DAYS_JOURNEY` is refused by name, pointing at `--fix`, since a shell
that still set it would otherwise run the default Fix without saying so.

**The seeds held.** The same engine change withholds the arrows and Enter
while a native dropdown has focus, which changes pools and could have moved
every seed. None moved: each plant's seed met its bug at the same Trip hop,
`mudge` found the same two bugs on the same five Routes, and `passepartout`
played the same three games, since no Route had a dropdown focused before
the Hop that mattered. Every Route's journal now records its Fix, as
`hong-kong` with fingerprint `9a2d0e7e4d65`, for one.

**The dropdown probe is gone from the demo's suite.** Run with the rest of
the suite, it opened a window and the native list on the screen, which is
what it was written to show, and it did so on every run of the suite. It
tested the engine rather than the game, which a demo's suite is not for,
and since the engine now withholds the keys it pressed, it guarded nothing.
Its measurements are in the entry below, and the test itself in commit
acc837e.

**The rail demo's guided script pointed at files that had gone.** The
engine's conversion of the rail demo moved its Fixes to `phileas/fixes/`,
and its sections 5 to 7 still read `journeys/demo.ts` and
`journeys/tickets.ts`, so they would have stopped the demo. They read the
new files now, and its `PRESENTING.md` names them.

**Stage two's sections printed only the Trip.** They left out each Route's
Fix steps, so a Route seemed to begin at Kholby when it had played its way
there from the Reform Club. Asked for in the words "show the Fix lines too",
sections 8 to 11 now print each Route's Fix steps before its Trip Hops.

**The shared runner leaked a listener at every pause.** Waiting for Enter
added a close listener to its reader and never took it off, so past ten
pauses Node printed a warning of a possible leak in the middle of stage
two; the rail demo pauses fewer times and never showed it. The listener now
comes off when the wait ends. Fifteen pauses fed one Enter at a time drew
the warning from the old runner and not from the new; fed all at once, the
input ended and neither warned, which is why the first attempt at that
check proved nothing and was not kept.

## 2026-09-28: what the arrows do to a native dropdown, and the Eighty Days seeds on the new engine

**Why.** Watching the Eighty Days demo, a small list of three items, "an
hour", "a night" and something else, was seen to pop up every so often, a
choice made and the list gone. It was the Hotel's Stay dropdown. How the
engine's keys move through a native dropdown had been recorded as
unmeasured since the keyboard work.

**Measured**, with `demo/eighty-days/tests/dropdown.spec.ts`, which does
what a Hop does, focus through the locator and keys through the page's
keyboard, and reads the dropdown's value after each, once hidden and once
shown behind other windows. On macOS an arrow key on a focused native
dropdown opens its list and leaves the choice as it was; ArrowDown twice,
Enter, ArrowUp and Escape left "an hour" chosen throughout, and the next
key closes the list. With the list opened, a Hop's click on another tab
returned at once and landed. All of it was the same hidden and shown, so it
does not split a seed's replay between window modes, and the test requires
that. **But the list reaches the screen in a hidden run.** It is drawn by
the operating system, outside the window the engine keeps off the screen:
watched by eye while the probe ran hidden and no game window appeared, the
three-item list was seen on screen. That breaks C5, that nothing takes over
the screen, for any application with a native dropdown. It was sent to the
session working on the engine to file and fix, since the fix changes which
keys are offered and so moves recorded seeds.

**The seeds held.** `main` gained the engine's temp folder per run and a
change to the printed shortcuts a survey offers. Every Eighty Days seed was
run again on it: each plant's seed met its bug at the same Trip hop as
recorded, `bradshaw-trap` stranded after the same eight, `mudge` found the
same two bugs on the same five Routes, and `passepartout` played the same
three games. The demo's suite passed, 26 of 26 with the probe.

## 2026-09-28: a Journey names its Fix, and every run records the one it used

**Why.** Reported by the Eighty Days demo's session from reading the code:
nothing in the engine linked a Journey to its Fix, and no run recorded which
Fix it used. Each consumer's spec handed both to `runRoute`, so three
consumers had grown three variables, `POSITRON_JOURNEY`, `RAIL_DEMO_JOURNEY`
and `EIGHTY_DAYS_JOURNEY`, each named as if it chose a Journey and each in
fact choosing a Fix: the Rail Itinerary demo's two "Journeys" had identical
terms and differed only in their Fix. The Fixes themselves sat in each
consumer's `journeys/` folder beside Journey terms, in files nothing marked
as Fixes. And a replay after a Fix was edited could not tell that from a
changed application or a changed outcome (R14).

**Decided, in the order it was asked:** a Fix's name and a fingerprint of its
source on each Route's journal line, taken over filing it for R13 and R14
or linking Journey and Fix first; the name then read by the engine itself
rather than passed by each consumer, which was asked as "Shouldn't this be
Phileas-level?"; Fixes in a folder of their own, once it was plain the files
gave no sign of being Fixes; and choosing a run's Fix as an engine setting
rather than a variable each consumer invents: "This should be an
engine-level field." Different Fixes for different Routes stays open,
`OUTSTANDING.md` 2.4.

**What landed.** A Journey's terms take `fix`, a name, and left out means no
Fix. `defineFixes` in `src/fixes.ts` lists a consumer's Fixes by name, from
`phileas/fixes/index.ts`, and refuses a name `--fix` could not take.
`phileas run --fix <name>`, which travels as `PHILEAS_FIX`, chooses another
for one run, and `--fix none` none; `fixFor` looks the name up and refuses
one not listed, naming those that are, and `startJourney` does it before
anything launches. The printed settings show `Fix:`, marked when set for the
run. Each Route's opening journal line records the Fix's name and the first
twelve hex digits of a hash of its source, which catches an edit to the Fix
and not to a function it calls; its `fix-hop` lines cover that. The Positron
trial and Rail Itinerary moved their Fixes into `fixes/`; Rail Itinerary's
two Journeys became one Journey and two Fixes. Their old variables are
refused by name, with the `--fix` that replaces them. Eighty Days keeps
`EIGHTY_DAYS_JOURNEY` until its session moves it.

**Tested.** A Journey opens with the Fix its terms name, or none; `--fix`
overrides it and `none` turns it off; an unlisted name is refused by
`fixFor` and by `startJourney` before anything launches, naming the listed
ones; the printed line reads the Fix in force; a name `--fix` cannot take is
refused; and the opening journal line records the listed name, or a Fix's
own constant name, with fingerprints that differ between two Fixes doing the
same. 260 tests in all.

## 2026-09-28: a hidden run no longer flashes windows or opens dropdown lists on the screen

**Why.** Hidden mode promises nothing takes over the screen (C5), and two
things broke it. Every launch flashed a window: one created shown, as
Positron's is, was hidden on its `show` event, which left it on the screen
first, and the person running the engine saw windows flicker all day. And
a Hop's arrow key on a focused native dropdown opened its list, which the
operating system draws outside the window; reported by the Eighty Days
demo's session with a probe, `demo/eighty-days/tests/dropdown.spec.ts`,
and seen on the screen during a hidden-only run.

**Measured, the flash.** By polling macOS's list of on-screen windows,
which needs no screen recording: with today's hiding, a window was on the
screen at full opacity for 318 ms on `buggy`, about 290 ms on the current
Positron and about 300 ms on 2024.11, most of it macOS fading the hidden
window out. Electron shows a window created with `show: true` just after
'browser-window-created', from native code, with no call a replaced method
could catch: a trace of every window method on the current Positron found
none before the window was visible.

**What was tried first.** A Fable agent found the way in:
`--inspect-brk=<port>` beside Playwright's `--inspect=0` pauses a packaged
app on the first line of its main script, before any window exists, and
Playwright's launch waits until a second inspector client lets it go on.
Its fix at that pause, handing `require('electron')` a `BrowserWindow` that
is always created hidden, removed the flash on `buggy`, and reached no
window at all on the current Positron, which loads Electron with `import`.
The agent was stopped with the approach proven and not yet built.

**What landed.** `src/first-line.ts`, from the agent: a small inspector
client that runs a script in the main process at that pause and then lets
the app go on, whatever happened, so a failure is reported rather than
turning into a launch that timed out. In hidden mode `launchApp` uses it to
make every window fully transparent as it is created, which the window-
created event reaches however the app loads Electron. Windows are still put
on the screen and hidden, invisibly. For dropdowns, `survey` withholds the
arrows and Enter while a native `<select>` showing one choice has focus,
reported as `focus: native dropdown "<label>"`, and fails closed when focus
cannot be read; the dropdown stays reachable by `select`. Decided, over
never focusing a select, which would also have dropped the keys that do not
open the list. What is given up: an app's own arrow handlers on a native
select, and elsewhere than macOS, arrows that change the value directly.
The pools change, so recorded seeds move, Eighty Days' included.

**Measured, the fix.** Opacity 0 at every sample on all three apps, where
the controls reached 1.0; and a Route on the current Positron through the
engine passed with its window on the screen for 8 samples, all at opacity
0. On 2024.11, a known defect, a dropped answer to a later call, failed 1
Route in 6 both with the fix and with its script doing nothing;
`DEFECTS.md` has it.

**Tested.** `buggy` records from its own main process each moment its
window is visible and not transparent, so the evidence does not rest on the
engine's hiding: with today's hiding alone the record fills, and through
the engine it stays empty, and it fills again with the script disabled.
The first-line client runs a script before a program's first line, and a
script that throws is reported with the program still let go on. The
dropdown keys are withheld only while the dropdown has focus, and the test
fails with the rule disabled. 254 tests in all.

## 2026-09-28: a Fix step waits for its target to appear

**Why.** A Fix's `hop` surveyed once and failed if its target was not in
that survey. On 2026-09-27, `quarto`'s Fix failed on 1 of 7 Routes at its
last step: the Quarto Document option in the list New File opens had not
filled in yet, though the step before had settled, and the other six
Routes reached it. A Fix failure ends a Route before it travels, so over
the trial's 500 Routes this would have thrown Routes away one at a time.

**Decided,** chosen over a wait written into each adapter's Fix: the wait
goes in the engine's `hop`, so every Fix has it, as Playwright's locators
do.

**What landed.** `hop(target)` in `src/route.ts` surveys again every 250 ms
until the target appears, within the hop timeout of 3 seconds, and fails
as before if it never does, now saying how long it waited. An excluded
target still fails at once, since waiting cannot change a rule. A survey
takes no draw, so nothing a replay depends on changes. The Fix failure's
message still says to expect every Route to report the same, which a
failure that remains after the wait more nearly deserves.

**Tested.** A Fix step whose button arrives 1.5 seconds after the step
before it passes, and fails with the wait set to zero. The misspelled name
still fails, after waiting, and the excluded control still fails at once.
Not yet measured on Positron, where the failure came at 1 in 7. 250
tests in all.

## 2026-09-28: a baseline for Eighty Days' original layout, before a better chooser

**Why.** The plan's settled decision keeps the game's first layout behind
`EIGHTY_DAYS_LAYOUT=screens` so that a chooser weighted toward new targets
can be measured against it, and makes that layout the default again once a
chooser gets Routes out of London in it. That needs a "before", taken with
today's uniform draw, which had not been measured in the restored layout.

**Measured.** Six Routes of 150 Hops from the `accept` Fix, which sets out
from London, with seed `layout-baseline`, once in each layout, the window
hidden and nothing planted:

| | `screens`, the first layout | `panel`, the default |
| --- | --- | --- |
| Places reached beyond London, per Route | 0, 1, 3, 1, 1, 1 | 3, 3, 1, 3, 3, 2 |
| Median | 1 | 3 |
| Furthest | Aden, one Route | Aden, four Routes |
| Outcomes | 1 lost, 5 still going | 3 lost, 3 still going |
| Page candidates a Hop, median | 9 | 13 |

So the uniform draw still gets few Routes far from London when a screen
replaces the place. As first built, three Routes of sixty Hops in this
layout reached no other place; these got a little further, and the two
measurements differ in Trip length and in everything the game has gained
since, so they do not say which. A chooser has done what the plan
asks of it when the first column moves toward the second, measured the same
way with the same seed. Neither layout wins from London in 150 Hops, which
is why the demo's default Journey starts at Hong Kong.

## 2026-09-28: Eighty Days stage two, a planted bug found, replayed, filed and traveled past

**What landed.** Build step 8 of `DEMO_PLAN_EIGHTY_DAYS.md`, the last: six
sections added to the guided demo, and to `PRESENTING.md`. A bug found, with
the failed check naming the Hop and the finding's id; a trap that strands,
with its own known findings file so its summary shows nothing found; the
same Route replayed against the file as it was, back to the same Hop; the
finding filed with `phileas known add` and the Route traveling past it; and
four bugs planted at once, with each finding listed once and how often it
was seen. The shared runner can now show a run that is meant to fail: it no
longer stops the demo on that run's exit, and the section decides from the
run's own journals whether the failure was the bug it was showing, and
stops the demo with the whole output when it was not. So a seed that no
longer reaches its bug says so, from the run just made, instead of carrying
on.

**Measured.** Run end to end, hidden: found at Trip hop 11 as finding
`8ddb8f32`; stranded after Trip hop 8 with nothing found; the replay
retraced all 11 Hops; filed, the Route passed its 40 Hops with the Hop
marked known; and several at once, from seed `mudge`, found Export the
ledger's error four times and the Carnatic's log error once, as measured.
Of five seeds tried for that section, three found two bugs and two found
only the export, because Game > Export the ledger is on offer at every Hop
and a Route ends at its first unknown bug. Two of those Routes went 150
Hops without drawing it, with it on offer at every menu Hop they took,
which is less likely than chance suggests and too few Routes to call a
bias.

## 2026-09-28: every run keeps to a temp folder of its own, and a renderer error loses its second prefix

**Why.** The leftover check read the whole system temp folder and failed a
run on any new `phileas-*` folder, whoever made it. So two runs at once, a
demo, the Positron trial, `buggy` or `npm test`, failed each other whenever
one had a Route mid-flight as the other ended. Seen on 2026-09-27: the
Eighty Days guided demo's section 3 failed on a profile the trial had made.
`PHILEAS_ALLOW_TEMP_LEFTOVERS=1` was the only way past it, and it skipped
the check for everything else too.

**Decided before building, in the words it was agreed in where quoted:**

- A parent folder per run, `phileas-<application>-<random>/<random>`. Asked
  which approach: "Parent folder."
- Made once, in global setup at the Journey's start, and handed to every
  Route in `PHILEAS_TEMP_FOLDER`, like the run's name. Not made at the first
  launch, since a name worked out again later would let the check read the
  wrong folder and pass. The end check reads only that folder.
- The application is a required argument, `startJourney(journey, adapter)`,
  so the compiler enforces it for every consumer, raised as "what happens
  when we add a fifth, and sixth, and seventh". A profile asked for with no
  run folder is refused by name, never made in the shared temp folder.
  Agreed: "Got it. Let's do it this way."
- The engine's own suite gets a folder of its own the same way, chosen over
  Journeys only, which would have left a Journey beside `npm test` failing it.

**What landed.** `startTempFolder` in `src/start.ts` makes the folder, sets
the variable, and returns the check, which fails on anything left inside,
removes the folder when it is empty, and puts back the variable's earlier
value. `startJourney` calls it last, after every setting is accepted, so a
refused run makes nothing. `makeUserDataDir` makes each profile inside it.
Every consumer's global setup passes its adapter. `tests/leftover-temp.ts`
and a new `demo/eighty-days/tests/temp-folder.ts` give the two scripted
suites their own folders, and the engine suite's scratch folders go inside
its folder. `VARYING` in `src/known.mjs` reads a profile in either layout as
`<profile>`, so findings filed before keep matching.

**Measured.** The profile's socket path on Positron is 94 characters, where
the limit is 103 and the old path was 87, and a Route of 5 Hops on the
current release launched and passed with it.

**Found on the way, and fixed with it:**

- **Eighty Days' determinism tests leaked a profile whenever a launch
  threw,** since the profile was made before the `try` that removes it. The
  suite's new check caught five at once, from launches refused because the
  worktree had no packaged build. The profile is now removed when the launch
  throws.
- **`tests/profile-cleanup.spec.ts` failed `npm test` once** and passed 8 of
  8 alone. Its control, a plain delete that should lose to a writer, won:
  the writer stopped on a timer, and under load the delete could start after
  it. The writer now runs until stopped, and the control gets 20 tries to
  lose. 24 of 24 passed six at a time.
- **An uncaught renderer error read "renderer: renderer: Error: ...",**
  reported by the Eighty Days demo's session on its `kiouni-throw` plant.
  `rendererObservation` adds the prefix and the uncaught-error check added
  it again, which also handed a narrowing a different form in the check
  than in the fixture. Every renderer finding's id changes with the fix;
  the Positron trial's known findings hold none, checked by the same search
  finding its 25 console errors.

**Tested.** Journey-end tests for another run's folder not failing a
Journey, with this Journey's own leftover as the control, for a refused
profile, and for the earlier folder put back; a signature test across both
layouts. Two tests now demand exactly one `renderer: `, and both failed with
the second prefix put back. 249 tests in all.

## 2026-09-27: eight bugs planted in Eighty Days, each found by a seeded Route

**What landed.** Build step 7 of `DEMO_PLAN_EIGHTY_DAYS.md`: the eight plants
whose checks exist, each behind its own `--plant` flag, which the adapter
takes from `EIGHTY_DAYS_PLANT`; a `coin-flip` plant for the determinism
tests; and `EIGHTY_DAYS_LAYOUT=screens`, which restores the game's first
layout, with screens that replace the place and the ways on as one venue
tab, as the settled decisions asked. One list, `plants.cjs`, is read by the
game and the adapter, so the adapter refuses a misspelt name before anything
launches. The game refuses one too, exiting rather than throwing: an
uncaught error that early raised no words the engine could collect, which
is the defect about output before a launch returns, and waited thirty
seconds for a window. Five Fixes start stage two's sections near their
plants, each keeping off every plant's path.

**Proved, apart from any seed.** `tests/plants.spec.ts` steers from each
plant's Fix straight to its control and requires the named check to fire,
and the same moves with the plant off to pass: sixteen tests, all passing.
`bradshaw-trap` strands the Route, as planned. A third determinism test
plays the game twice with `coin-flip` on and finds the difference before
the first Trip Hop.

**Seeds, searched for and not steered.** For each plant, seeds were tried
until Route 1 of its Journey met the plant by its own draws, one plant on
and the window hidden: the first seed tried for four plants, the second for
two, the third for one, and the ninth for `sail-console-error`, whose
hoisting sits behind a tab a Trip keeps leaving. Each was replayed once with
the window shown and a 300 ms pause, and every one met its plant at the same
Trip hop, from the first Hop to the eleventh. `demo/eighty-days/seeds.mjs`
holds them. The default seed `passepartout` still plays the same three games
with every plant off.

## 2026-09-27: Eighty Days watched and presented, and a game that held Routes at Omaha

**What landed.** Build step 6 of `DEMO_PLAN_EIGHTY_DAYS.md`: `npm run
demo:eighty-days` watches the default Journey, prints each Route's fate from
its journals and replays one Route; `npm run demo:eighty-days:present` is
stage one of the guided demo, in six sections, with
`demo/eighty-days/PRESENTING.md` as its script. The rail demo's watcher
became `demo/watching.mjs` and its replay reading `demo/journals.mjs`, both
shared, so the two demos keep one copy of each; the rail demo's own
`watch.mjs` now only names its folder and seed. The guided demo keeps its
known findings in a file of its own, emptied when it starts, so the summary
it points at begins from nothing.

**Measured, and what it found.** Choosing a default seed meant finding one
whose three Routes won, lost and were still going. Six seeds of three Routes
at 200 Hops, the Trip length set before, won nothing: two lost and four were
still going, and three of those four were at Omaha, where every train east
had left. **That was a fault in the game, not balance.** A place whose
timetabled departures have all gone offered nothing to leave by, and the game
held Fogg there with the tabs still on offer, so nothing ended and nothing
stranded. The plan promises a way on from every screen. Such a place now
ends the game, lost, as an empty carpet-bag already did, and a rules test
shows it does and that the same place with a train still to come does not;
the test failed with the rule taken out.

**Retuned, and asked for.** With that fixed, a rough model of random play
through `renderer/game.js`, a scratch script as before, put wins at about one
Route in ten, and most losses on a few departures that could never win.
Asked whether to search more seeds, settle for losses and wanderers, or
retune, the answer was "Retune". Three departures the game invented were
retimed, each note in `data/departures.json` saying why: the Pacific charter
from 400 hours to 360, so it rescues a Route that waited the week at Hong
Kong, as its note always meant; the special train east from 110 hours to 80;
and the next Cunard steamer a day earlier, winnable only if the Detective's
warrant is short, so the telegrams sent since Suez decide it. The book's own
departures, including the week's wait at Hong Kong, were left alone. The
Trip length went from 200 to 150, which the model said balanced the three
fates best and which shortens the watched run. **Measured on the real game:**
eight seeds of three Routes ended six won, eleven lost and seven still going,
four of the eight showed all three fates in one Journey, and every Journey's
three Routes took three different sequences of places, with a median of 13
page candidates a Hop. The default seed is `passepartout`, whose Route 1 wins
at Trip hop 72, and whose three Routes, watched at 300 ms a Hop and shown
behind other windows, played the same games as hidden and took 6.8 minutes;
Route 1 then retraced all 150 Hops exactly.

## 2026-09-27: "1" and "2" join the typed values, and every seed types differently from today

**What changed.** `VALUE_CORPUS` in `src/route.ts` gained "1" and "2", so a
field that asks for a count can be filled. **From this change on, a recorded
seed may not retrace.** The numbers drawn, and the order they are drawn in,
are untouched, but the value a Hop types comes from a list of nine rather
than seven, so the same draw picks a different entry; and a different value
typed can change what the screen offers next, so a Route that typed into a
field can go elsewhere from that Hop on. A Route that never typed retraces
as before. Baselines taken before the change, such as the Positron trial's
seeded-draw baselines for weighting, are to be taken again. The pinned
draws in `tests/guarantees.spec.ts` were updated on purpose, and only their
typed values moved; the rest of the engine's suite passed unchanged,
`buggy`'s recorded baselines included.

**Why.** "0" was the only digit, so a field that refuses anything outside a
range until it is retyped was a dead end no chooser could get past. It was
met in the Eighty Days demo, whose ticket office was briefly changed to
correct bad counts, which suited the engine rather than the game. That was
raised as "It feels like we cheated--we adjusted the demo so that Phileas
would do better", and of three remedies proposed, fixing the engine where it
is cheap, keeping the harder game available, and letting the default follow
the engine, the answer was "Do all three."

**What was tried first, and reverted.** A generator that read a spin
button's declared range from the page at the Hop. It was reverted, unmerged,
for resting on the demo alone and for a latent hazard to replay, and the
Positron trial's session, asked for its view, agreed and proposed the fixed
values instead. `DEFECTS.md` has the reasons and the design to use if the
idea returns.

**Measured.** With the ticket office strict again and the new values, six
Routes of 200 Hops from Hong Kong reached 14 to 23 places, four lost and two
still going, with six distinct sequences, as far as they went with the
correcting clerk. Berths was typed "2" six times and "1" three times, and of
26 presses of Book, 13 booked and 13 were refused until retyped. A party of
three still needs a 3, which only the arrow keys reach, so `DEFECTS.md`
keeps what remains of the gap.

## 2026-09-27: Eighty Days playable, and tuned until Routes travel, partly by working around the engine

**What landed.** Build step 3 of `DEMO_PLAN_EIGHTY_DAYS.md`, less the
engravings: the game's data in `demo/eighty-days/data/`, each fact from the
novel tagged with its chapter and each invention marked as one; pure rules in
`renderer/game.js`; the page, the chart, the ticket office, the menu and the
ship's log; the adapter, three Journeys and the spec, wired for known
findings. The facts were read from the Towle translation, Project Gutenberg
eBook 103. Two memories were wrong and corrected: the itinerary table is the
Daily Telegraph's, not the Morning Chronicle's, and Kiouni's price climbs by
the book's own ladder, £1,000, £1,200, £1,500, £1,800 and £2,000. The
translation contradicts itself on when the Carnatic sailed, and the data
says which it took and why.

**Tested.** `tests/rules.spec.ts` plays the book's own choices through the
rules without a window: Fogg reaches the Reform Club at 8.50 p.m. on the 21st
by his diary, believes he is five minutes late, and has won, since it is
Friday the 20th by London's calendar. With the date-line correction set to
nothing, the test failed, which is its control. The two determinism tests
written first now pass on the game.

**Tuned, by measurement.** Built first, the game let no Route leave London:
three Routes of sixty Hops from the `accept` Fix reached no other place,
because the Circuit, Ledger, Bradshaw and About screens replaced the place,
and the departures sat on one venue tab among several. Opening those four as
a panel beside the place, and keeping the ways on above the tabs, took six
Routes of 150 Hops to between 4 and 7 places each. The `hong-kong` Fix, 27
steps of the book's own choices, then started every Trip on the Hong Kong
quay: six Routes of 200 Hops reached 12 to 20 places, one lost and none won.
Counting where 1,200 Hops went found 30% in the panels, 3% taking a
departure, and a trap: the ticket office refused a typed berth count until
it was retyped, and no value a Trip types is one, so the clerk now corrects
it and books. A third or fourth way on at each place from Hong Kong onward,
as the plan prescribes for a corridor, brought endings: four lost and two
still going. A rough model of random play through the rules, for finding
causes and not a measurement, then put the losses at a median of five hours
late, from invented alternatives a week behind the book: retimed to a day
behind, a real batch ended one won, three lost and two still going, with
six distinct sequences of places, and the Trip length was set to 200.
`demo/eighty-days/measure.mjs` reads any run's journals for these numbers.

**Two of those changes worked around the engine, and were questioned in
those terms.** Asked once the tuning was done: "It feels like we cheated--we
adjusted the demo so that Phileas would do better." Partly, and it should
have been said at the time. The panel in place of replacing screens, and the
clerk who corrects a bad berth count, each changed the game to suit a
weakness in Phileas: a uniform draw that is swallowed by screens that replace
the view, and typed values that never include a number a validated field
accepts. Both are ordinary in real applications, both are now in
`DEFECTS.md` with their measurements, and the demo no longer shows either.
The other three changes are the game's own and were kept on their merits:
retiming invented departures sets the game's difficulty, and winning the
wager is a fate for an audience rather than a measure of the engine, whose
work is to explore and find bugs; the Hong Kong Fix is what a Fix is for;
and more ways on is the branching that was asked for. Whether the demo keeps
the harder game available, for measuring a better chooser against it, is
open in the plan.

## 2026-09-27: step 6 finished for data-explorer and quarto, and read against the bar

**Why.** The longer run below was stopped during `quarto` before
`data-explorer` ran, so step 6 had no reading for either. Asked for as the
first of what remained: finish the measurement, then judge it against the
trial's bar.

**Measured.** 20 Routes of 100 Hops for `data-explorer`, then 7 for
`quarto` to make up the Routes the stopped run did not finish, two at a
time: 17 of 20 and 6 of 7 passed. The load peaked near 6 on 8 cores, and
free memory fell to about 190 MB twice with no hang. No Positron process
and no new temp folder was left behind.

**Triaged, four failures and no new finding.** Three are one console error,
a session that "is not active" after a Hop clicked Delete Session, each
recorded as a new finding only because the session id in it changes: the
defect "A signature keeps ids that change on every Route" in `DEFECTS.md`.
The fourth is `quarto`'s Fix failing on its last step, the Quarto Document
option not on screen yet, while the other six Fixes reached it;
`DEFECTS.md` has that one too.

**Against the bar, not met and not yet judgeable.** The false-alarm clause
holds: the four failures took minutes to triage. The new-bug clause rests on
issues 44, 53 and 54, none yet followed by hand. The known-bug clause is
step 5, not run. Step 6 has had about 160 of its 500 Routes on the current
release, at Trip lengths of 20 and 100.

## 2026-09-27: a hidden run kept off the screen, and a longer step-6 run

**Why.** During the longer run, the person running it saw Positron reach
their screen: native Open dialogs that stayed up, second windows that
stayed up, and once a window that went full screen, taking over the display
until the Route ended. C5 says nothing takes over the screen.

**Measured.**
- Zen Mode, reached twice by a Route, takes a window full screen, which is
  Positron's default for it; on macOS that is a Space of its own.
- A second window, an editor moved into its own, was revealed by `moveTop`
  alone: it was the only window call made, and the window stayed visible.
  Replacing `moveTop` kept it hidden for the whole of the same sequence.
- The native menu's File > Open entries were drawn from dozens of times a
  Route, the likely source of the native dialogs.
- Five Routes at a time put the load average at 26.9 on 8 cores and left
  114 MB of memory free; two at a time peaked at 11.8, as Positron gathered
  extension hosts over 100-Hop Routes, three or four a Route, each with its
  own Python locator.

**What landed.** In hidden mode, `setFullScreen`, `setSimpleFullScreen`,
`setKiosk` and `moveTop` do nothing, and a window that enters full screen
anyway is taken out and hidden. `src/dialogs.ts` answers every Electron
dialog as cancelled, a message box by its own cancel, and records each call,
read with `nativeDialogs`. The Positron adapter writes `zenMode.fullScreen:
false`, and the trial runs two Routes at a time. Four defects filed: a stop
sent to the `phileas` command alone, stack lines read as errors, ids in
signatures, and the flicker a window created shown still makes.

**The longer run.** 20 Routes of 100 Hops for each Journey, two at a time,
stopped during `quarto` when the full screen appeared: `no-fix` 16 of 20,
`session` 16 of 20, `notebook` 16 of 20, `quarto` 9 of 15 with 2 cut off.
Its 30 findings were triaged by reading: three are the stack-line defect,
eight are routine editor cancellations, six are sign-in or an assistant with
no model, one is an extension's provider failing, and seven are Positron
candidates with no recipe yet. Three are Positron's window closing mid-Route,
not yet looked into, and two are hangs that ran at a load near 11 and are
not judged.

**Tested.** Three new tests, 245 in all, each through a `buggy` plant: full
screen asked for, a second window brought forward, and a native dialog.
None was run with its fix removed, since the first two would put a window
over the screen of whoever runs the suite; the dialog's is its own evidence,
since a real dialog would not have returned.

## 2026-09-27: the first step-6 run on Positron, and two engine bugs it found

**Why.** The trial's question is whether the engine finds bugs in Positron
often enough to be worth it, and most of the day had gone into making
Positron runnable. A run of 50 Routes was chosen over the full 500 as the
cheapest real reading.

**Measured.** 10 Routes of 20 Hops for each of five Journeys on the
current release; 32 of 50 passed.
- One new Positron bug candidate: opening a new notebook logs "Element
  already has context attribute: positron-cell-editor-monaco-widget", the
  message of posit-dev/positron issue 10022, closed as fixed in 2025.11.0.
  It fired during the notebook Fix on all ten Routes. Filed as
  ronplusron/phileas issue 53, and filed in the known findings.
- Issues 44 and 46 were seen and carried past, as known findings are.
- Two Routes ended on engine errors, below.
- Seven failures were false alarms from the adapter's `session-state-agrees`,
  which took an Extensions view's Restart button for the console's.

**What landed.**
- A shortcut printed with an arrow, such as "(⌥↓)", is pressed as the arrow
  key; any other character Playwright cannot name is not offered. "↓" had
  been handed on and ended a Route with "Unknown key".
- `type` still types into an element marked as a text box that is not an
  input, where emptying it first threw and ended the Route.
- The notebook, Quarto and data explorer Fixes, to the plan's wording and no
  further. The data explorer's types `View(mtcars)` into the R console.
- Both session checks dropped, asked for as "fix it or dump it"; their two
  false entries left the known findings.

**The notebook Journey again,** once issue 53 was known: 7 of 10 passed.
The other three ended on "Aborted onWillSaveTextDocument-event after N ms",
logged two to four seconds after a new notebook opened, each after a
different action. Nine launches that did nothing, pressed Cmd-W, or clicked
Run Cell after opening one found it once, with nothing done. Filed as
ronplusron/phileas issue 54.

**Tested.** Two new tests, 242 in all. The arrow's cannot pass without its
fix, which produced "Alt+↓". The text box's failed with the fix removed,
with the error Positron's Route met, and a first version of it did not
reproduce that error at all until the planted box was given a size, since
Playwright waits for a box to show before refusing it.

## 2026-09-27: a session on every release, and studying releases for checks stopped

**Why.** The session Fix and checks were written against the current
release, and the trial's positive controls run on three old ones.

**Measured.**
- The old releases start a session from a Start Interpreter button, and
  their dialog lists one interpreter per language; a row's first button
  expands it to the others. Their console shows a disabled Restart console
  button with no session, and their Variables pane names the session.
- R 4.6.0 starts on 2024.11 and crashes as it starts on 2025.01 and 2025.02
  (SIGSEGV). R 4.4.3, installed beside it with rig, is found only when named
  in `positron.r.customBinaries`, and then starts on all three in under two
  seconds.
- Python on the old releases asks to install ipykernel. On 2025.01 the
  install went into the Route's own home folder, 54 MB, and Python started
  13 seconds after it; the machine's own Python folders were unchanged. On
  2025.02, whose only Python is Homebrew's 3.14.2, the install failed.
- On the current release, `session-state-agrees` fired while a session was
  starting, the top bar catching up after the console and the Variables
  pane. A false alarm, and it was taken back out of the known findings.
- A link to the VS Code docs on the Welcome view was clicked by a Route.

**What landed.** The adapter reads `positronVersion` from the installed
application and maps the four measured releases to two families; a release
with neither has no session steps and says so. The Fix, renamed `session`,
starts R on the current release and R 4.4.3 on the early ones, refusing by
name when 4.4.3 is not installed. `session-state-agrees` holds off while a
session starts. The docs link is excluded. The adapter's three checks run
on the current release only, and record on any other that they did not run:
studying each release for them was stopped, and `PLAN.md` has why.

**Tested.** A Route of the `session` Journey passed on each of the four
releases, and four more on the current release filed nothing new. A planted
contradiction still fired `session-state-agrees` once R was up. On 2025.01
each adapter check recorded not run, with the reason, on every Hop.

## 2026-09-27: Positron's session checks, and a Fix that starts an R session

**Why.** Trial step 3, with its checks written from Positron agreeing with
itself rather than from the bugs step 5 looks for. The current release's
screen was studied with no session, with R, with R and Python, and after
deleting a session, to find facts it states in more than one place.

**Measured.** Whether a session runs is stated three times: the top bar's
button reads Select Session or Start New Console Session, the console shows
a Restart button or says no session is running, and the Variables pane shows
its toolbar or not. With several sessions, the console shows a tab per
session and its Restart button names the selected one's language. The
Variables pane names no session on the current release. A fresh profile
started no session in 20 seconds, where a note from the day before says one
started by itself. The interpreter list names this machine's interpreters
with their paths, and its order changed between two launches. With a session
running, every Hop's effect reads as changed, including one abandoned Hop,
which fits the resource monitor's reading ticking, as `OUTSTANDING.md`
predicted; settling was unaffected, at 0.4 to 1.4 seconds a Hop.

**What landed.** Two checks in Positron's adapter, `session-state-agrees` and
`active-session-agrees`; and `POSITRON_JOURNEY`, choosing `no-fix` or
`r-session`, whose Fix was written from `phileas survey` one step at a time
and starts R, naming it by pattern, then waits for it to start. The first
version of `active-session-agrees` read the tab's text, which is the name cut
short followed by its CPU and memory readings, and fired on a healthy screen;
it reads the tab's label now.

**Tested,** against the current release, not in `npm test`: each check
stayed quiet with no session, R, and R and Python, and fired when the page
was made to contradict itself on purpose. A Route of five Hops with the
`r-session` Fix passed. Deleting one of two sessions, and every old release,
are not measured.

## 2026-09-27: checks an adapter declares, and the trial's checks no longer written from its bugs

**Why.** The trial's third step was to write three checks for Positron, and
all three had been chosen by reading the bugs its fifth step then looks for,
so finding those bugs would have shown only that Routes reach them. Raised
as "The bigger gap is that Phileas is reliant on previous bugs". Checks now
come from the application agreeing with itself and from its own markings,
and the bugs only test them; `PLAN.md` has the decision. Either way the
engine had no way to take a check from an adapter, which is phase 6's
structural tier (R18), so that part of phase 6 came forward.

**What landed.**
- `AppUnderTest.checks`: each has a name, the reason it should hold, and a
  `run` handed the page, the application and the settled tree, returning its
  violations or why it could not look. It runs after every Hop and every Fix
  step, after the built-in checks, and is judged exactly as they are: by
  signature, a known finding carried past, anything else ending the Route.
- A declaration is refused at a Route's start when a name is not lower-case
  words joined by hyphens, is used twice or is a built-in check's, or when no
  reason is given. A check that does not answer within the responsive wait is
  recorded as not run; one that throws ends the Route as an
  `AdapterCheckError`, a broken check rather than a finding.
- `buggy`'s adapter declares `count-matches-list`, the heading above the item
  list against the rows beneath it, and `--buggy-plant=miscount` puts the
  heading one out.
- Positron's adapter declares `no-error-notification`, from the icon
  Positron draws on a notification of error severity.

**Measured.** A built-in alert check was the first plan for the error
notification and was dropped: on the current release a settings file that
is not valid JSON raised a notification exposed as a `dialog` whose name
begins "Error:", and its text went to an off-screen region marked `alert`
that the accessibility snapshot shows empty; a healthy launch has the same
regions, empty. On 2024.11 the same file raised no notification at all, so
how that release draws one is still unmeasured. Against the current release,
`no-error-notification` returned the notification's text on the broken launch
and nothing on a healthy one.

**Tested.** Five new tests, 240 in all: the miscount firing buggy's check and
the healthy run listing it after the built-in ones, the refused declarations
with well-formed ones as the control, a check that never answers, one that
throws, and one whose violation is a known finding. Also fixed in passing:
the Journey's-end tests read the leftover override from the shell that ran
the suite, so a suite run with it set failed the test expecting the check to
fire; they now clear it for each test and put it back. Run with the override
set, that test failed before and passes after.

## 2026-09-27: the three old Positron releases through the adapter, and a launch that retries its first call

**Why.** The trial's positive controls run known bugs on Positron 2024.11,
2025.01 and 2025.02, and the adapter had only been measured on the current
release. Each launch flag, the log it names, the in-page menu and dialog
settings, and the Copilot extension it disables needed checking on each.

**Measured.**
- Every flag the adapter passes is in all three, read from each release's
  code; a first search missed them in 2024.11, whose code writes them without
  quote marks, and a search for `--user-data-dir` as a control showed why.
  `--use-mock-keychain` is in each release's Electron.
- The extension host log is where the adapter names it: the log check ran on
  every Hop of every release, where a missing log reports not run, and it
  caught the first finding below.
- None of the three bundles the Copilot chat extension, and disabling one that
  is absent did no harm. In-page file dialogs worked on all three.
- **`window.menuStyle` does not exist in any of them,** so their context menus
  are native on macOS whatever the adapter sets, read in each release's
  workbench code. Clicking Manage, which froze the current release while its
  menus were native, froze nothing in twelve launches across the three with
  windows hidden. With windows shown it is unmeasured.
- One Route of twenty Hops passed on each release, 2025.01 on its second
  Journey, with the home guard clean every time.
- **Found, not triaged:** 2024.11 and 2025.01 log a failure to start
  `python-env-tools/bin/pet`, which neither release ships and 2025.02 does;
  and on 2024.11, starting the R 4.6.0 interpreter was followed by its
  language server failing to connect, which may be a release from 2024
  meeting a newer R. Both were added to known findings, unfiled.

**What landed.** `reachMainProcess` in `src/launch.ts`: before anything that
changes the application, the launch makes a call into its main process that
changes nothing, and retries it only when Playwright reports "Resulting
promise was garbage collected", up to five times. Positron 2024.11, on
Electron 30.4, dropped the answer to the first call on 6 launches in 8, and
the second succeeded on all 6, about 28 ms later; 2025.01 and 2025.02 dropped
none in 10. The first call had been the one hiding windows, so the launch
failed. A call with no effect makes the retry safe whether a dropped attempt
ran or not.

**Tested.** Three new tests, 235 in all, against a stand-in main process: a
dropped answer is retried, any other failure is thrown at once, and one that
keeps dropping is given up on by name. The first and third failed with the
retry removed. A Journey of eight Routes on 2024.11 then launched every one.

## 2026-09-27: a second demo planned, a shared presenting runner, and determinism tests first

**Why.** A demo more comprehensive than the rail demo was asked for, with
"ships, trains, elephants, and a wind-powered sledge". It became a plan,
`DEMO_PLAN_EIGHTY_DAYS.md`, for a deterministic game after the novel, with
every decision quoted there in the words it was taken. The plan was reviewed
twice before anything was built, once by a second model and once afresh, and
twenty-nine problems were fixed in it; its two review sections list the ones
that would have broken the demo.

**What landed, build steps 1 and 2.** The rail demo's guided runner moved
into `demo/presenting.mjs`, so the second demo's guided demo does not copy
it, and `demo/rail-itinerary/present.mjs` now holds only its sections. The
variables no run inherits became a list of prefixes, `PHILEAS_`,
`RAIL_DEMO_` and `EIGHTY_DAYS_`, so a bug switch left in a presenter's shell
cannot change a section silently. `npm run demo:present` became
`npm run demo:train:present`, decided in the words "rename", so each script
names its demo. `demo/eighty-days/` began with its package and
`tests/determinism.spec.ts`: two tests that play one seed twice, in two
launches and at two hop delays, and compare every screen's accessibility
tree before each Trip Hop.

**Measured.** The rail guided demo, played through hidden before and after
the lift, printed the same 550 lines, differing only in one Hop's duration,
431 against 433 ms, with its replay checks passing both times. After the
branch was rebased onto the whole-codebase review below, which moved the
rail demo's replay reading into its own `journals.mjs`, the same comparison
against the review's own runner printed the same 574 lines, differing only
in one journal line's start time. The two tests of the game fail today, naming the missing adapter, as step 2 of the
plan has them. Two tests of the comparison pass against the rail demo: two
launches differ nowhere, and a note planted before hop 4 of one play is
found before hop 4. The second is what makes the others worth believing,
since a comparison that could not fail would pass every game.

## 2026-09-27: fixes from a whole-codebase review

**Why.** Seven read-only review agents read every code and test file, and
one of them every document but this one. Two findings were critical as rated
after checking them against the code: a crashed application passed every
check, and a Route's last Hop could report it passed; and the page fixture
judged renderer errors a second time, ignoring known findings, so a known
renderer error failed the test from the second Journey on. Four decisions
were taken with the user: a known hang still ends a Route, a Route whose
every Hop was abandoned strands, survey mode gets its own outcome, and the
temp path committed in a test is replaced in the files only. What was
deferred is in `DEFECTS.md` and `OUTSTANDING.md` 1.13.

**What landed.**
- A crash, a quit or a closed window fails still-responding, and a round
  trip rejected because the target is gone is a failure, not an answer.
- Each renderer error has one judge: the watch notes what it saw, and the
  fixture judges only the rest, handing a narrowing the same text the check
  does.
- The survey's dialog count and menu read, and a Fix's `hop()`, are bounded;
  the fixture's end-of-test diagnostics are too.
- `surveyed` is an outcome, printed in the settings, and consumer specs mark
  it skipped; a Trip of only abandoned Hops strands; an action's catch takes
  only what an action can meet; `PageUnreachable` names its cause.
- `PHILEAS_ALLOW_STALE` and the home guard's override are 1 or 0 only, and
  the staleness guard's state is printed; packaged inputs are normalized, so
  `./data` is checked in both directions.
- The focus rail fails closed; the log check reads whole lines and says when
  a named log does not exist.
- `closeApp` kills after a shutdown that threw, and `launchApp` closes an
  application whose setup threw.
- Known findings are validated field by field, keep their source when filed,
  and a Journey's end refuses a run it cannot read.
- `CHECK_ORDER` is the list the check type is derived from; a chooser's
  result must be in the pool; `top` pins a window created already shown.
- `npm test` typechecks first; peer ranges are capped at what was tested.

**Declined from the review, with the reason.** Declaring `@playwright/test`
in each consumer here would install a second copy beside the engine's;
`OUTSTANDING.md` 1.3 has it.

**Tested.** Thirty-four new tests, 232 in all. Six were run with their fix
undone and failed: the two crash plants, the known hang, the shutdown that
threw, `top` on a window created shown, and the split log line. The `./data`
guard test failed before its fix. The all-abandoned, Fix-stream and
unwatched-renderer-error tests carry their control as a test of their own.
The rest were not run against an undone fix.

## 2026-09-27: a Journey fails on a profile it left in the temp folder

**Why.** The engine watches a deleted profile and deletes it again if a late
helper recreates it, but a writer later than the watch still leaked one, and
nothing looked at the temp folder after a Journey. `npm test` already failed
on its own leftovers; a Journey did not.

**What landed.** `startJourney` notes which `phileas-` folders are in the
system temp folder, and `finishJourney` fails the run on any that appeared
during the Journey and are still there, by name. It takes the same override
as `npm test`'s check, `PHILEAS_ALLOW_TEMP_LEFTOVERS=1`, and says what it
skipped. The check is one function, `watchTempFolder`, which `npm test`'s
global setup now calls too, so the two cannot drift apart. The end of a
Journey runs every check through `runEveryCheck` and then fails once with
all of them, so a known findings file that cannot be written, or the trial's
home folder guard, never hides a profile left behind, or the other way
round. Known findings became optional in `finishJourney`, so every
consumer can return it: `buggy`'s and the rail demo's global setups now do,
as the trial's already did. This closes the late-writer entry in `DEFECTS.md`,
whose own terms were that it leaves once a Journey reports a profile it left
behind.

**Tested.** Five new tests, 198 in all: a leftover fails the run naming it,
nothing left passes, the override skips with a warning naming it, every end
check runs when an earlier one fails, and a known findings failure still
reports a leftover. The last two failed with `runEveryCheck` made to stop at
the first failure. A one-Route `buggy` Journey exited 0, and exited 1 naming
the folder when one was planted in the temp folder after it started.

## 2026-09-27: known findings, so a filed bug stops needing an adapter change

**Why.** A failed check ends the Route, so a bug on a common path ended most
Routes, and the only way past one was a narrowing in the adapter, written by
hand per bug. Asked for as high priority: "constantly updating the adapter
manually whenever a bug is discovered is untenable." The design, each part
decided with a proposal, is in `PLAN.md` under "Before the rest of the trial:
known findings".

**What landed.** `src/known.mjs`, plain JavaScript so the `phileas` command
can load it. Each violation a check sees gets a signature, the observation
with what varies from run to run taken out, and a short id; every Hop's line
lists its checks' findings. A consumer passes `knownFindings` to `runRoute`,
read once at the Route's start and named by version on its opening line, and
a finding it holds no longer fails the check. `finishJourney`, which a
global setup returns, adds a Journey's new findings to the file unfiled when
it ends and prints what was seen, what is unfiled and what was not seen.
`phileas known add <id> --issue <issue>` files one. The renderer shows known
findings on a Hop's line and a failed check's finding id.

**The signature rules were measured, not guessed.** Every failed-check line
in the trial's journals was read first: log lines vary in their profile path
and timestamp, hangs in their Hop number and durations, deprecation warnings
in their process id, and stacks in their frame positions. Two runs of issue
44 on different days share id `baa530b2`.

**The trial moved onto it.** Issues 44 and 46 left the adapter's narrowings
for `trial/positron/phileas/known-findings.json`, and a Route that opens a
folder on Positron travels past the reload on them alone, all three
messages recorded as known. A three-Route Journey reported all three as not
seen, since none opened a folder, which is the report working.

**Tested.** Eleven new tests, 193 in all: signatures of real lines, the file
refused when unreadable, filing by id, what a Journey's end adds and says,
the command's parsing, and a real Route over `buggy` carrying on past a known
log error, with its control ending there and naming the finding.

**A partial answer to an open question.** `PRODUCT_REQUIREMENTS.md` section 11
asks what a Journey does with one defect found on several Routes. The
summary now lists each finding once, with how often it was seen; the
question stays open there until it is taken up as a requirement.

## 2026-09-27: Routes travel past a window reload, and known findings are asked for

**The measurement.** Opening a folder reloads Positron's window, and every
reload ended the Route twice over: Positron logged "[lifecycle]: Error during
will-shutdown phase in default joiners (error: Canceled)" as a console error
on three reloads of three, and issue 44's deactivation error reached the
extension host log each time. A Route that opened a folder never got further.

**What landed.** Two narrowings in the adapter, each matching one exact
message and giving its issue as the reason: the cancellation, filed as a
possible Positron bug, issue 46, and issue 44's two log lines. The first of
those names the extension; the second does not, so it is matched by its
exact text and would accept the same fault from another extension. A Route
that opens a folder now travels past the reload, with both messages
journaled as accepted.

**Why it is not the answer.** A narrowing is meant for what is normal for an
application, and each bug found this way would need another hand-written
rule. Asked for on 2026-09-27, in the words it was put, as high priority:
"constantly updating the adapter manually whenever a bug is discovered is
untenable." `OUTSTANDING.md` 1.13 records known findings as the feature that
replaces these rules.

## 2026-09-27: Positron's readiness refuses a boot into an error

**The measurement.** A Positron boot into an error still showed its status
bar, so readiness passed it. With a settings file that is not valid JSON,
Positron booted and showed an error notification, "Unable to write into user
settings", 21 to 24 ms after the status bar on three launches; healthy
launches showed none in fifteen seconds.

**What landed.** The adapter's readiness watches for an error notification
for one second after the status bar, about forty times the delay measured,
and throws with its text, which is R24: a bad boot reported in Positron's own
words rather than passed or timed out. It costs a second per Route. A broken
boot now fails with that message and a healthy one passes, and three Routes
of twenty Hops passed with it.

## 2026-09-27: a profile recreated after its delete is deleted again

**The measurement.** With profiles deleted reliably, three still turned up in
the system temp folder after an evening's Positron probes, each holding one
Copilot log. A Copilot helper started as Positron closed, even with the
Copilot chat extension disabled, lived 6 ms, and wrote its log into the
Route's home folder after the delete had finished.

**What landed.** `removeProfile` watches a deleted profile and deletes it
again if it comes back, up to three times, then fails the teardown by name.
How long it watches is an adapter's `profileWatchMs`, 250 ms by default,
chosen over one second for every application, which would have added about
three minutes to the engine's own suite, and over no watch by default, which
would protect nothing an adapter had not measured. The Positron adapter sets
one second.

**Tested.** A process that writes into the profile 300 ms after the delete
brings it back with no watch, which is the control, and is cleaned up with a
one-second watch; one that writes without stopping is reported. 182 pass,
the suite about thirty seconds longer. `DEFECTS.md` keeps an entry open for a
writer later than the watch.

## 2026-09-26: an application that opens no window is reported in its own words

**The defect.** An application that started, said why it could not go on,
and opened no window was reported only as "Timeout 30000ms exceeded while
waiting for event \"window\"", although the engine had collected its reason.
An application that exits at launch was already reported with its standard
error, by Playwright, and Positron on a profile it could not write to printed
no reason at all, both measured the same day.

**The fix.** When no window comes, the error carries the application's
standard error, less the lines Electron prints for the launch's own flags,
and the application is closed first, bounded, since nothing else would close
a launch that never finished.

**What the test found on the way.** `buggy` printed its reason first at the
top of its main script, then at Electron's ready event, and the engine heard
neither: Playwright's launch returns only once Electron is ready, and the
engine starts listening then. It prints a second later now, which is heard,
and the loss of everything earlier is filed in `DEFECTS.md`, with a wrapper
as the likely fix and not yet decided. The test fails with the error left as
it was, and 180 pass.

## 2026-09-26: a Route's profile folder is removed even while it changes

**The defect.** The fixture deleted a Route's profile once. Positron's child
processes were still exiting and writing into it, the delete failed with
"directory not empty", and two Positron profiles were left in the system
temp folder. A profile with a read-only part failed the same way.

**The fix.** `removeProfile` makes the profile writable, then deletes it
with Node's own retries, which cover exactly that error, and throws if it
still cannot. The fixture uses it.

**How it was proved.** Two tests, each first showing the single delete
failing on the same folder: one with a read-only part, and one another
process writes into without pause while it is deleted. A writer pausing a
millisecond between files let a fast delete through, so the control was
flaky until the writer stopped pausing. With `removeProfile` cut back to a
single delete both tests fail, and each passed twenty times running with
it. Failed attempts while writing the tests left test profiles behind, and
both tests now clean up after themselves however they end.

## 2026-09-26: hidden mode hides a window created already shown

**The defect.** Hidden mode replaced Electron's `show()` and hid the windows
open when the application launched. Positron creates its main window later,
with `show: true`, which never calls `show()`, so its window stayed on the
screen for whole runs that reported hidden mode, and was watched there. C5
says nothing takes over the screen.

**The fix.** Every window created from then on is hidden whenever it is
shown, on its own `show` event. Hiding it once on `browser-window-created`
was tried first and did not hold: a window created with `show: true` is shown
after that event fires.

**How it was proved.** A `buggy` launch flag creates its window with
`show: true`, a second after Electron is ready, as Positron does after its
own startup. Created at once, the old hiding already caught it and the test
passed without the fix, so it proved nothing; the delay is what reproduces
Positron. The test fails without the fix and passes with it, and on Positron
itself the window read visible at launch, at three seconds and at ten
without it, and hidden at all three with it. 177 tests pass.

## 2026-09-26: the settle wait no longer calls a busy page unresponsive

**The defect.** The settle wait gave each read whatever was left of its
budget, so a page still changing near the end got a last read of a few
milliseconds, which timed out and was reported as the page having stopped
answering, with the reading thrown away. Seven of twelve Positron Routes had
such a Hop at hop 1 or 2, each settling at exactly the budget, while neither
process paused for more than 400 ms, timed from inside each: Positron was
busy activating extensions, not stuck. This was one of the adapter's open
questions, whether readiness should wait longer, and the answer was that
readiness was fine and the engine was wrong.

**The fix.** Every read is given at least 500 ms, well above the slowest
healthy read measured, 276 ms, even when less of the budget is left, so a
read that times out means the page gave no answer for that long. The wait can
run past its budget by up to that much. A first version stopped reading once
less than 500 ms remained instead, and cut every budget short by that much:
an existing test caught it, returning after 113 ms of a 600 ms budget.

**How it was proved, and one attempt that did not.** A control in `buggy`
that kept its page changing for three seconds was tried first, and its test
passed with the fix removed: `buggy`'s page is small enough to read in the
few milliseconds left, so it never hit the defect. It was removed. The test
kept uses a stand-in page whose reads take 150 ms and always differ, which
hits the short last read on every run: it fails without the fix and passes
with it, and a page that never answers is still reported as not answering
either way. On Positron, the same three probe Routes that had each lost a Hop
now record every Hop: the busiest run out their two seconds, at 2,003 and
2,013 ms, and are journaled as unsettled with what they changed.

## 2026-09-26: a Positron adapter, five engine changes, and the first Positron bug

**What landed.** The Positron trial's second step: an adapter in
`trial/positron/`, pointed at an installed release named by `PHILEAS_APP_DIR`,
in the consumer layout `buggy` uses. Three Routes of twenty Hops each passed
through the current release, 2026.09.1. Getting there took five engine
changes, each found by pointing the engine at Positron, and each tested:

- **A bundle with no `app.asar` launches when there is no staleness guard.**
  Positron ships its code unpacked, and only the guard reads the archive.
- **`launchArgs`, `env` and `logPaths` may each be a function of the Route's
  profile folder,** for an extensions folder, a home folder and a log that
  have to be fresh per Route. The function form of `logPaths` needs `runRoute`
  to be given the folder, and refuses to start without it rather than
  reporting the log check as not run.
- **The close is bounded and ends in SIGKILL,** reported as its own finding.
  This closed the teardown defect filed the same day, which happened for
  real: a Route found a hang, then sat at `app.close()`, and Positron ignored
  an ordinary stop signal. Proved by `buggy`'s new `endless-hang`, a main
  process busy forever, with a control: the Route test fails at teardown with
  the bound removed.
- **Every application launches from its Route's profile folder,** after a
  bundled extension left a log in the folder the run was started from.

**Measured on Positron, and what each decided,** all recorded in `PLAN.md`
under the trial's second step:

- The ordinary launch works, and the profile's socket path came to 87
  characters, inside the 103 limit.
- Positron writes no log files unless launched with `--logsPath`, checked
  against a control log that was found.
- The bundled Copilot chat extension failed its sign-in at every launch and
  caused most of the idle errors. It is disabled, and the trial tests
  Positron without it.
- A native context menu blocked the whole application, and so would a native
  dialog. Menus, dialogs and file dialogs are drawn in the page instead, so
  the trial tests those rather than the macOS defaults. One main-process
  confirmation, Clear Recently Opened, is still native and is excluded.
- Positron writes into the home folder whatever `--user-data-dir` says, and
  earlier runs had left sixteen files in the real `~/.copilot`, moved to the
  Trash. Each Route now has its own home folder, and the trial's Journey
  carries a guard that fails the run on any write to the real home folder or
  the Journey's own folder, read from the folders themselves.
- A keychain prompt froze both processes for over fifteen seconds at every
  launch. `--use-mock-keychain` removed it: no event-loop gap over 300 ms in
  either process, timed from inside each.
- Positron cancels promises as ordinary control flow and drops them in its
  own handler; the uncaught-error check is narrowed to exactly that rule.

**The first Positron bug.** The log check ended a Route at hop 8, when an OK
confirmed the Open Folder dialog hop 1 had opened: `positron-connections`
throws a TypeError when deactivated, because its `deactivate` reads from an
argument the extension host never passes. Shortened to those two Hops and
reproduced once by script, then filed as ronplusron/phileas issue 44, to move
to Positron's tracker. The shortening, the judgment that it is real and the
write-up were done by hand, not by the engine, and `OUTSTANDING.md` 2.9
records what that asks for.

**Tested.** 174 passed, fifteen of them new.

## 2026-09-26: the first checks, for the Positron trial

**Why these and not all of phase 5.** Two studies of real bug reports, in
`research/`, found about five bugs in a hundred within reach on either IDE,
and could not count bugs nobody reported. A run against Positron is the
measurement they could not make, so the plan changed to a trial first, and
this is its first step: six of the universal checks, each with a planted
defect in `buggy`, as `PLAN.md` sets out under "Before the rest of phase 5".

**What landed.** `src/oracles/index.ts` runs six checks after every Trip hop
and every Fix step: uncaught errors in the renderer and the main process,
console errors, still responding, the window still showing something, no
unexpected dialog, and an error appended to a log the adapter names in
`logPaths`. The first failure ends the Route with a `CheckFailure`; after a
Fix step it arrives inside a `FixFailure` (R11). Narrowing (R19) applies to
every check, where it used to reach only the fixture's end-of-test renderer
check. `phileas show` and `--follow` print a failed check on its Hop's line.

**Four decisions, each made with a proposal before building:**

- **A check that could not run says so on every Hop.** Each Hop's journal line
  carries all eight checks, as passed, failed, or not run with the reason.
  The two not built yet, no navigation away and named controls, and the log
  check where no log is named, are recorded as not run rather than left out.
  This was an open question about how a report should name a check that did
  not run on a given system. Whether a setting should fail a run on any
  not-run check stays with R27's degraded-run setting in phase 7.
- **The log check sits in the universal tier,** doing nothing unless a log is
  named, which settles the question phase 5 carried about where it belongs.
- **Each planted defect has its own launch flag,** `--buggy-plant=<name>`,
  like `--buggy-fail-items` before it. Launched plainly, `buggy` is unchanged,
  so its baseline tests and every recorded seed still hold. Eight flags, one
  per way a check fires: a renderer throw, a main-process throw, a console
  error, a renderer hang, a main-process hang, the window blanked, an alert,
  and an error written to a log.
- **A test reaches its planted control through the choosing seam,** with a
  chooser that always picks it. This was an open question about how a test
  makes a seeded Trip reach a planted defect; a long enough Trip, or a seed
  recorded as reaching it, both fail whenever the draw shifts, for reasons
  that say nothing about the check.

**A hang shows in the engine's own calls, not in a later round trip.**
Measured on the planted hangs, each six seconds long: a click bounded to one
second returned after 6.4 seconds, the settle wait then passed, and the
round trip to each process answered at once, because the hang was over. So
the first build of still-responding passed on both hangs. Electron's main
process serves the debugging connection every Playwright call goes through,
and a busy renderer holds back the answer to the very click that made it
busy, so no call's own timeout can fire while the application is not
answering. The fix times the Hop's action and the settle wait from the
test's side as well: a call that overruns its bound by more than the
responsive wait, five seconds by default, is the finding, and one that has
still not returned by then is given up on so a hung application cannot hang
the Route.

**The main-process listener replaces Electron's own handling of an uncaught
exception,** which is a native dialog that blocks the process until someone
dismisses it: C5 broken, and the check firing would have said the
application stopped responding rather than that it threw. With the listener
installed, the planted main-process throw is caught and the process answers
on the same Hop, which the test asserts.

**Blank is defined narrowly:** nothing in the accessibility tree a person
could read, no text and no named element. One word on the screen is enough
not to be blank. Tuned against `buggy`, and due to be tuned again against
Positron.

**Measured on healthy applications, with nothing firing.** `buggy` without a
flag, three Routes of 40 Hops, and all three rail demo Journeys at the same
size, every Route passed. Thirteen new tests, 159 in all, pass: one per
check firing on its planted defect, the healthy run, a narrowing, a check
switched off, a check failing after a Fix step, and blank's definition.

**What is not closed.** The external-link stub defect stays open, since the
foreign-process half of no navigation away is not built. An uncaught error
during boot, before a Route starts watching, is still reported only by the
fixture at the end of the test.

## 2026-09-26: standard menu entries skipped by default, and long names cut

**The question that started it.** A run of 100 Hops on trickster-tales spent
Hops on Edit > Redo, Delete, the Zoom entries, Window > Zoom, Bring All to
Front and Substitutions, each changing nothing, and printed tale cards whose
names ran straight into what changed. Default exclusions for Electron's
standard entries had been agreed on 2026-09-24 as a list of risky ones, and
not built.

**Measured first.** Every menu entry of `buggy`, Rail Itinerary and
trickster-tales was read with its Electron role. Every standard entry carried
one, from `quit` to `front`, and none of the entries the applications' own
authors wrote did. So "has a role" is exactly "is standard", read from the
running menu with no list of labels, which would carry the application's name
("Quit Trickster Tales").

**What landed.** The engine skips every standard entry, chosen over the agreed
risky list, which would have left most of the wasted Hops in place, and over
the risky list plus the entries acting only on the window. The cost weighed:
Undo and Redo after typing can find real bugs, so an adapter allows roles back
with `allowStandardMenuRoles`, and a role allowed back that is never on offer
is reported as stale like any exclusion. The roles allowed back are written
on each Route's opening journal line, since the default is an input to the
draw. The adapter's own `names` and `menuPaths` are checked first, so an entry
they name is counted against them. `buggy`'s and Rail Itinerary's
hand-written Quit and clipboard exclusions were removed, as the default now
covers them.

**Long names are cut to their column** in `phileas show` and `--follow`, with
a space always before what changed; the journal keeps names whole, and a Fix
step still names a control by its full line. A menu path is cut in the middle,
keeping its first menu and the entry clicked, chosen over cutting at the end,
which could hide which entry it was.

**One seed moved.** Fewer menu entries changes what every seed draws, and the
test that counts keystrokes from Trip typing stopped typing under its seed. Its
positive control caught it, and it now uses `typing-seed-3`, found to type five
times in thirty Hops; `typing-seed` typed none, matching the failure.

**Tested.** 146 passed on Node 24.21.0. New: a role allowed back and a
misspelled one reported, a menu path excluding an entry the application wrote,
the journal recording the allowed roles, cutting names to the column, and the
baseline reading buggy's menu from the running application to check every
standard entry is skipped and every own entry offered. Positive control: with
the skip switched off, the six tests relying on it failed.

## 2026-09-25: a guided demo, Routes counted from 1, and a pause to watch a Fix

**The question that started it.** A demo was asked for that conveys the
Journey, Route, Hop and Fix, how controls are found, configuration, seeding,
the output, and a Fix of one step and of several, for a mixed audience. Running
it raised four more requests, each of which reached the engine.

**The guided demo.** `npm run demo:present` runs ten sections against Rail
Itinerary, live, with its window forward; `demo/rail-itinerary/PRESENTING.md`
is the same demo as a script. Every command is printed exactly as it would be
typed and waits for Enter before it runs, since a command printed as it starts
scrolls away unread; that was asked for after the first version printed them
as they ran. `--auto` plays through. Runs inherit no `PHILEAS_` settings from
the shell, so what is shown is what runs. `explain-hop.mjs` works one Hop's
choice out again from its journal line, and fails if its arithmetic lands on a
different control than the journal names: it matched all 180 Hops of two
fresh runs, and refused journals written before the shares were recorded.

**Three Journeys for the demo**, chosen by `RAIL_DEMO_JOURNEY`, the demo's own
switch: no Fix, for a first look; the one-step Fix; and a Fix of nine steps
that adds a Geneva to Zurich leg and ends in the ticket purchase dialog, so
every Route's Trip visibly starts inside it, which was asked for as showing a
Fix "in an obvious way". One of its steps is Playwright code, because the From
and To dropdowns list the same stations and a line copied from the survey
always reaches From, the same-name question recorded as open.

**The hop delay now pauses after each Fix step and each survey listing**, not
only after Trip hops. Asked for because a surveyed window closed before anyone
could see it: "The app instances that only show the main page need to stay up
for at least two second". Chosen over a demo-only hold because the delay
exists so a run can be watched, and a Fix or a survey that flashes past cannot
be. It changes no draw, and sits after each record, so no step's recorded time
includes it. With no Fix, the survey's one listing now says it is also where
the Trip begins.

**Routes count from 1**, asked for as "Humans should numbers starting with
one." First done on screen only, with the seed still derived from a count from
0; that left `routeIndex: 0` in every journal, and was reversed the same day
to count from 1 all the way down: `routeSeed = hash(journeySeed, routeNumber)`,
`routeNumbers()` in place of `routeIndices()`, and `routeNumber` in the
journal. Recorded seeds from earlier runs now retrace different Routes, which
was judged not to matter before phase 5. The pinned values for Routes 1 and 2
equal those pinned for positions 1 and 2 before, which is the check that only
the counting moved; the new pins came from a separate implementation in
another language that first reproduced every earlier pin. The demo Fix's
measurement was taken again under the new numbering: 51 of 150 hops changed
nothing with it and 52 without, where the entry below has 61 and 62. `nth`,
which of several controls sharing a role and name a candidate is, counts from
1 too, since it shows in every journal line; Playwright's count from 0 is
reached only where the locator is built.

**A longer Trip retraces a shorter one**, measured on the train demo: the same
seed for five Hops and then ten gave the same first five. The Trip length only
decides where a Route stops. The documents had said a replay needs the same
Route count and Trip length as the run it repeats; that was stricter than
true, and was corrected.

**Tested.** 143 passed on Node 24.21.0. New: the pause after a Fix step,
measured as the gap between steps; the pause holding a survey; a longer Trip
retracing a shorter one; Routes reading from 1, with a journal missing its
opening line reading `route ?`; and two planted buttons sharing a name numbered
1 and 2, with 2 reaching the second. Positive controls: with the pause switched
off both pause tests failed; with the longer run given another Route's seed the
retracing test failed; and without the conversion to Playwright's count the
twins test failed.

## 2026-09-24: writing a Fix from what the engine sees, and the demo's Fix

**The question that started it.** Adding a Fix to the train demo raised how
anyone knows what a Fix can act on. The answer was a journal from an earlier
run, the app's source, or Playwright's inspector, which drew the question "So
I have to scour the code to find a control that the app discovers on its
own?" The reply was that the engine should hand over what it finds, and the
two pieces below were proposed. Asked for before phase 5, in one branch with
the demo work and the overview.

**`phileas survey [config]`** launches the application, surveys the first
screen, prints one control per line, then runs the Fix if there is one,
printing each step, surveys again where the Trip would begin, and stops. The
second survey was asked for after the first version showed only the start,
which left a Fix's second step to be found by guessing. It sets
`PHILEAS_SURVEY=1` and one Route; the Route prints and returns before its
journal opens, so a survey leaves no record that could read as a Route that
traveled nowhere. Each line is in the renderer's form, `button "Open Alps by
rail"` or `menu View > Show Timetable`; excluded controls are listed with
their rule, and the common keys on one line.

**`hop(target, value?)` in a Fix** takes one of those lines as it is. It
surveys, finds the first candidate whose text matches, and acts on it the way a
Trip hop would, typing `value` into a text field. It is a Fix step like any
other, named by the target. A name not on screen fails the Fix and lists what
is on screen, so a wrong name says what the right one is; an excluded control
is refused to a Fix too, by its rule, since the list is a safety rail; a text
field without a value is refused. `step()` with Playwright code stays.

**The demo's Fix, and a measurement that changed what it is for.** It opens
"Alps by rail", as one `hop()` line. It was proposed to make the demo livelier,
since most hops started on a list where little changed. Measured with the same
seed and settings, hidden: 61 of 150 hops changed nothing with the Fix and 62
without. Routes leave the itinerary within a few hops, and most unchanged hops
are on the timetable screen, which offers three ways to reach itself -- its
tab button (11 unchanged hops), the ⌘F shortcut (10) and `View > Show
Timetable` (7) -- plus Clear on an empty search (6). So the cause is a sparse
screen offering moves to where the Route already is, which is the case the
weighting idea recorded in `OUTSTANDING.md` 2.6 aims at, not the starting
point. Whether to keep the Fix was asked and not answered; it was kept as the
session's own call, because it costs nothing, it is the only place the demo
shows a Fix, and it is now the worked example of `hop()`. Dropping it is one
line.

**The demo refuses to ticket an empty itinerary**, decided the same day:
Buy tickets is disabled while an itinerary has no legs, and Purchase refuses
too in case the last leg goes some other way while the dialog is open.
Checked on the repackaged build: enabled with legs, disabled once every leg
was removed.

**An overview for a reader outside the project**, `OVERVIEW.md`: a short
paragraph, then the same in more detail. Asked for as a file in the
repository, written for a manager, knowingly against the rule that nothing is
summarized across documents; it is dated, and says `../ORIENTATION.md` wins
where the two disagree.

**Tested.** Six tests: the survey's lines, a named step acting and its effect
recorded, typing and its refusal without a value, a wrong name listing what is
on screen, an excluded control refused, and a survey-only Route running its
Fix and writing no journal; the command's parser takes `survey`. 138 passed on Node 24.21.0.
Positive controls: with names never matching, the two tests of a working step
failed; with survey mode ignored, its test failed.

## 2026-09-24: a run removes the temporary folders it makes

**What was wrong.** The suite and Journeys left folders in the system temp
folder and never removed them: 1,302 of them, about 379 MB, found on
2026-09-24, and roughly 80 more per `npm test`. The route and journal specs
made scratch folders and never removed them, `app-dir.spec.ts` did the same,
and `window-modes-applied.spec.ts` closed the application but left its user
data folder. Nine other launches removed their folder in a `finally` that a
failed launch never reached.

**What changed.** `tests/scratch.ts` records each scratch folder and removes it
in `afterEach`, which runs whether the test passed or failed; a test built to
fail confirmed that. `launchOrRemove` removes a user data folder when the launch
itself throws. `tests/leftover-temp.ts` fails the run if any `phileas-*` folder
it did not start with is still there at the end. Disabling the journal spec's
cleanup made it fail and name all nine folders that spec makes, which is the
positive control.

**A Journey's user data folder is removed when its Route ends, whatever the
outcome.** The fixture already did this, and a five-Route Journey left none.
Keeping them for a failed Route was considered and not taken: a seed replays
the Route exactly, and the journal and trace are the record, so a profile of
several megabytes per Route adds nothing. What still escapes is a run killed
outright, since teardown never runs. That is the likeliest source of the few
demo folders found, though it was not confirmed.

## 2026-09-24: reading a journal, moved forward from phase 7

**Why now.** Right after the `phileas` command landed, the first question was
how to see a run's log in the terminal, and the only answers were a `jq`
one-liner and the train demo's private reader. `PLAN.md` phase 7 had said that
if reading journals hurt during phases 5 and 6, R30's renderer would move
forward "as the first part of `report/` rather than being built twice". It
moved forward before phase 5, which runs Journeys many times over. Asked for,
after the design and the difference between the two commands were explained:
`phileas run --follow` and `phileas show`.

**One renderer, `src/report/render.mjs`.** One line per Hop: the Route and Hop
number, the action, the target, a typed value shortened for the screen, and
the effect, plus notes and the outcome. It reads a journal cut off mid-write
and says the Route did not finish, and reports a broken line where it sits and
keeps reading. `--follow` sets `PHILEAS_FOLLOW=1`, and the journal prints each
rendered line after the entry is on disk, never before; Playwright shows a
test's output as it arrives, measured at one line a second under a one-second
hop delay. `show` takes a run folder, a seed's folder, a journals folder, one
journal file or a seed's name under `phileas/.phileas-journals/`, defaulting to
the latest run there; runs are named in UTC, so the latest sorts last. The
train demo prints `--follow`'s lines and has no reader of its own, and its
replay still retraced all 50 hops.

**Why it is plain JavaScript, measured rather than assumed.** The command is
plain JavaScript and has to load the renderer. The first plan was a
self-contained TypeScript file, which Node 24 and 25 both loaded by erasing
its types. But Node refuses to erase types in a file that sits inside
`node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), while a file
linked into `node_modules` loads, because Node follows the link. So the plan
would have worked for this repository's consumers, which link the engine, and
failed for anyone who installs a copy. The renderer is JavaScript with its
types in comments, checked by the compiler through `checkJs`, and so is the
command now; a real copy of both inside `node_modules` ran `show`.

**Tested on Node 24.** Node 24.21.0 was installed and made the default the
same day, so the floor set earlier is now the version tested: 126 tests passed
on it before this change and 132 after. Six new tests: the rendering of every
entry kind, a journal cut off mid-write, a broken middle line, which run
`show` picks, the follow setting's refusal, and a real `--follow` run whose
printed lines match `show`'s for the same Route, line for line. Positive
controls: with the journal ignoring `follow`, the real run printed no Hops and
failed; with `show` picking the earliest run, the run-choice test failed.

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
