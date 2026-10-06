# Phileas -- what is wrong

Defects, limitations and hazards, confirmed by reading the code rather than
suspected.

**An item leaves this file when it is fixed.** It is not marked done and it is
not kept for the record, because `HISTORY.md` is the record.

**What belongs here:** something that produces a bad answer or hides a
failure, whether or not it is firing today. A latent hazard belongs here the
same as an active one, and documenting a defect is not containing it.

**What does not:** work that is agreed and unbuilt, a question waiting on an
opinion, and anything already fixed. The first two are `OUTSTANDING.md`, the
third is `HISTORY.md`.

**Honest limits are not defects** and belong in `PRODUCT_REQUIREMENTS.md`
section 4 as non-goals rather than as faults.

**Be careful with that distinction, because it fails toward comfort.** "Known
limit" needs a reason that is not just "this is how it currently behaves." A
real bug recorded as an accepted limit reads as a decision and stops being
fixed -- worst of all in a code comment, where an explanation of a workaround
is indistinguishable from a justification for it.

**Watch for phrasing that soothes rather than reports:** "it has not fired
yet", "latent, not active", "that is a separate concern".

---

**Fifteen defects are recorded.** The launch layer landed in phase 1, so this
file is no longer empty for the reason it used to be empty. Five of them were
found by the whole-codebase review of 2026-09-27 and deferred rather than
fixed with it, each for the reason its entry gives.

**A hazard in code that has not been lifted here yet is neither a defect nor
a worry.** It is not a defect, because the file is not in this repository; it
is not a worry, if what to do about it is already decided. `PLAN.md` carries
those as hazards and schedules the work against the phases that close them.
The entry belongs here on the day the file lands with the hazard still open,
which is how the first entry below arrived.

What follows are the defects, then the two things most likely to be filed
here wrongly, and one hazard to enter the moment it becomes real.

## The external-link stub can install successfully and do nothing

**Filed 2026-09-22, when `src/external.ts` landed with the hazard still
open.** `PLAN.md` carries the mechanism in full; the short version is that
`stubOpenExternal` replaces `shell.openExternal` on the module object, which
reaches the application only if the application looks the function up at call
time. An application that captured it at startup keeps Electron's real one.
The assignment still succeeds. A browser opens on the machine running the
Journey, the recorder stays empty, and "no navigation away" reports clean
because its evidence went somewhere else rather than because nothing left.

**Why it is a defect and not a limit.** It produces a bad answer while every
test passes, which is exactly what this file is for, and it is invisible from
outside: a clean report is what both the working case and the broken case look
like.

**What is done, and what is not.** Three items were scheduled to close it.
The install-timing measurement is done and came back negative:
`NODE_OPTIONS=--require` does not reach a packaged Electron main process, so
the stub cannot be installed ahead of the application's own handlers, and the
hazard cannot be closed at its source that way. The positive control is done:
`proving-ground/buggy` hops its outbound link and asserts the recorder caught it.
**The other two are not built.** The exclusion list is hand-written rather
than derived from source, so it goes stale silently the day an application
adds another way out. And the independent evidence in phase 5, a check that no
foreign process appeared, does not exist, so the recorder is still both the
prevention and the only proof of it.

**The two stubs added since share the shape.** `stubOpenPaths` replaces
`shell.openPath` and `shell.showItemInFolder`, and `stubSelfLaunch`, added on
2026-09-29, replaces `child_process.spawn`; each reaches an application only
through a lookup at call time. The self-launch stub is the one with evidence of
its own. A copy that escaped it inherits the Route's environment, `HOME`
included, so the stray sweep finds it at the Route's end, and it writes into
the application's real folder, which RStudio's home guard watches. Both report
after the fact rather than preventing anything, and neither is a general check
any application gets.

**Only one of those two closes this entry, decided 2026-09-22.** Deriving an
adapter's exclusion list keeps that one application's list current as the
application changes, which is worth doing and is scheduled in `PLAN.md`. It
says nothing about an application nobody has read, and that is the hazard
here. Crediting it as a closer repeats the mistake the paragraph below
identifies in the positive control.

**What the positive control does and does not cover.** It proves the technique
works against one application whose `main.js` was read. Three of three
applications measured write `shell.openExternal(url)` as a property lookup, so
nothing found so far is affected. That is not the same as the technique being
sound for an application nobody has read, which is the whole hazard.

**This entry leaves when phase 5's second evidence source exists**, and on
nothing else. Not when the exclusion list is derived, and not when the next
application also turns out to be unaffected.

## What an application prints before the launch returns is lost

**Filed 2026-09-26, measured on `buggy`.** The engine collects the
application's standard error by listening on its process once Playwright's
launch has returned, and Playwright returns only once Electron is ready.
Anything printed before that is gone: a line `buggy` wrote at the top of its
main script, and one it wrote the moment Electron was ready, were both
missing from what the engine collected, while one written a second later was
there. Playwright itself sees the early lines, and puts them in its own error
when a launch fails outright, but offers no way to receive them when the
launch succeeds.

**Why it is a defect and not a limit.** Two things read that output. The
error for an application that opens no window, which gives the application's
reason only if it came late enough, and the standard error attached to a
failed Route, which misses everything from boot. A failure during boot is
exactly where an application's own words matter most, and both report as if
it had said nothing.

**What would close it, not decided.** Launching through a small wrapper
that copies the application's standard error to a file in the profile, so
nothing is lost. It puts a shell between the engine and the process the
bounded close kills, which needs measuring before it is taken.

## Two menu entries with the same label click the first one

`menuEntries` lists every visible entry, so two entries whose label paths are
identical both reach the pool. `clickMenuItem` finds by label and clicks the
first match, which may even be a hidden one. The journal then records the
entry the draw chose while the application ran the other. No application in
use has such a pair; one that does gets a journal that misreports a Hop.
Deferred because the fix, carrying the entry's position through to the click,
touches the journal's menu target.

## A Journey's end loses known findings when two Journeys end at once

`recordJourneyFindings` reads `known-findings.json`, adds to it and writes it
back with no lock. Two Journeys against one consumer finishing together, such
as two Positron releases run side by side, can each write over the other's
additions. Deferred until runs actually overlap; a lock file beside it would
close it.

## The watch outlives its Route

`startWatching` adds page listeners and main-process handlers and nothing
removes them. Two `runRoute` calls on one page, which only the engine's own
tests do, stack them, and the dialog listener keeps dismissing dialogs after
the Route has ended. Harmless while every Route has its own launch; a
`stop()` called from `runRoute`'s `finally` closes it.

## A close that had to be forced leaves a passing Route green

The fixture attaches a forced kill or a failed shutdown rather than throwing,
so that it never replaces the test's own failure. When the test passed there
is nothing to replace, and an application that hangs on exit reads green with
an attachment no console reporter prints. Deferred rather than fixed because
Positron needed the forced close often enough to have its own defect, and
failing on it could turn every Positron Route red: how often a clean
Positron Route needs it is to be counted first.

## Signatures are stable only under macOS's usual temp folder

`VARYING` in `src/known.mjs` recognizes a Route's profile only under
`/var/folders`. Under a custom `TMPDIR`, or on another platform, every
signature naming a profile differs per Route, so a known finding is never
matched and ends every Route it appears on. It fails loud rather than quiet,
which is why it waits for the first run outside the usual folder.

## A uniform draw gets lost in screens that replace the view

The seeded draw treats every candidate alike and remembers nothing of what it
has done, so an application whose reference screens replace the working view
swallows a Route. Measured on Eighty Days as first built, where Circuit,
Ledger, Bradshaw and About each replaced the place, and the departures sat on
one venue tab among several: three Routes of sixty Hops from the Reform Club
reached no other place. A person reading the Ledger comes back without
thinking; the draw comes back only when it happens to draw the way back, and
four of five top-bar buttons led away. This is the pattern that sank Loki,
and real applications are full of such screens: settings, help, history,
file browsers.

The demo no longer shows it, because the game was changed to suit the draw:
those screens became a panel beside the place, and the ways on stand above
the tabs. That made the demo work and hid the finding, which is why it is
recorded here rather than in `HISTORY.md` as a balance fix. Weighting the
draw toward new targets and away from the last one, scheduled by the Positron
trial's session on its own branch, is aimed at exactly this, and Eighty Days
is to be its first measure.

## Typed values reach only the counts 1 and 2

`VALUE_CORPUS` in `src/route.ts` holds an empty string, "a", "travel",
"Carpet", "0", "1", "2", two spaces and two hundred x's. A field that
accepts only a count in a range is filled validly only when 1 or 2 is in it;
a field that needs 3 or more, or a range such as 10 to 100, is reached only
by the arrow keys on a focused field, which a key drawn an eighth of the time
rarely does. Whatever lies behind a successful entry in such a field is then
seldom reached.

Until 2026-09-27 it was worse: "0" was the only digit, so no count at all
could be typed. Measured on Eighty Days, whose ticket office refuses a berth
count outside 1 to 3, or smaller than the party, until it is retyped: across
six Routes of 200 Hops the office was cancelled or escaped from 45 times
against 17 bookings. The game was briefly changed to suit the engine, a
clerk who corrected bad counts, and that was undone once "1" and "2" were
added: `HISTORY.md` has both measurements. A party of three still needs a
3, so the demo still meets what remains of this.

**A range-aware generator was built and reverted the same day, unmerged.**
It had `seededValues` read a spin button's declared `min` and `max` at the
Hop and add its least, middle and greatest values to what its one draw
picked from. Reverted for two reasons. It rested on the demo alone: across
42 Positron Route journals, one pool offered a spin button, the Settings
editor's `editor.fontSize`, and no Hop acted on it. And it carried a latent
hazard to replay: a read that can time out on one run and not the next
changes the list one draw indexes into, so one seed types two different
values. Recording the range in the journal would not cure that, because a
seeded replay reruns from the seed and never reads the old journal.

If a range-aware generator returns, the design the Positron trial's session
proposed on review: read the range in the survey, as part of the candidate,
so a failed read shows as a different pool, which R13 and R14 already treat
as divergence rather than a silent change of value; and keep the list the
value draw picks from a fixed length, filling the range's places with fixed
entries when no range is read, so a failed read changes a value and never an
index. It waits for a real application to show the need.

## A stop sent to the `phileas` command alone does not stop the run

**Filed 2026-09-27, measured.** `bin/phileas.mjs` starts Playwright and
ignores SIGINT itself, on the reading that Ctrl-C reaches the whole process
group and Playwright stops on its own. That holds at a terminal. A SIGINT
sent to the command's process alone, as a script stopping a run does, is
swallowed: a Journey sent one kept running for eleven more minutes, until
Playwright's own process was sent it. A SIGTERM ends the command and leaves
Playwright running with nothing reporting it. Forwarding the signal as it
stands would deliver Ctrl-C to Playwright twice, and a second interrupt makes
Playwright quit without its teardown, which leaves profiles and processes
behind. Starting Playwright in a process group of its own and forwarding
once would close it, and needs measuring at a terminal as well as by pid.

## A determinism test failed once, and why is not known

**Filed 2026-09-30, observed rather than confirmed.** In a full run of the
Eighty Days demo's suite, `answers the same moves the same way in two
launches` in `demo/eighty-days/tests/determinism.spec.ts` failed after 24
seconds, where it usually takes about 55. It then passed alone, and again in
the next full run, 25 of 25. The test plays one seed twice with no Fix and
asserts the two plays match, so a real failure would mean a seed does not
replay, which is the guarantee the engine rests on; a failure of the test
itself would mean it cannot be trusted to say so. Which it was is not known:
the rerun overwrote the report. What is known is only that it was under a
full suite's load, and that the change being tested, to the Fix API, is not
on the path a Route with no Fix takes. The next failure should keep its
report, `test-results/` and the two plays' journals, before anything reruns.

## A page changing every 200 ms read as settled once

**Filed 2026-10-03, observed rather than confirmed.** In a full `npm test`
run, `a page that changes every 200ms is not settled, though two reads
agree` in `tests/route.spec.ts` failed at its last assertion: `settle`, with
its default quiet window of 400 ms, returned settled on a page replacing a
button every 200 ms. Its positive control, the same page reading as settled
with no quiet window, had passed just before. It passed in the next full
run. That run had other tests failing for a reason of its own, a build
older than its source, and nothing else is known about its load.

**Why it is a defect and not a flaky test to rerun.** Either the test can
fail on a correct engine, and then a red run says nothing, or the settle
wait really can call a moving page settled. Then a survey is taken from a
page mid-change, which is the first place a seed stops reproducing (R8).
Which one it was is not known. One reading, not measured: under load the
page's own timer can fall behind, so nothing changes for 400 ms and the
page really was quiet while it was read. The next failure should keep its
report and `test-results/` before anything reruns.

## The Hop a Route ends on depends on when a late finding arrives

**Filed 2026-09-30; what is left of a larger defect fixed the same day.** A
finding used to be charged to whichever Hop was running when a check read
it, and what the stubs caught to whichever Hop read their recorders. Both
now record when they arrived, and both the failure and each Hop's line say
so, which `HISTORY.md` has.

**What remains:** a Route ends at the first check that reads a finding, and
a finding that arrives late is read on whichever Hop is running then. So one
seed can end at hop 32 on one run and hop 33 on the next, with the same
finding, while every draw is the same. The failure says when the finding
arrived and lists the steps before it, so a reader can see the two runs
agree; nothing yet compares them, and R13 would read the second as a seed
that no longer reproduces.

## An application that brings itself forward partway through a Route stays in front

**Filed 2026-10-04, confirmed by reading Positron's code.** `back` mode hands
the screen back once, at launch, in `handBackTheScreen` in `src/launch.ts`.
An application that brings itself forward later stays in front for the rest
of the Route, which is the screen `back` exists not to take.

**The one path found in Positron.** Of the 17 places its interface asks for
focus, read the same day in
`out/vs/workbench/workbench.desktop.main.js`, one can be reached by a Route
alone: a debug session stopping at a breakpoint, with
`debug.focusWindowOnBreak` on, asks for focus in its "Force" mode, which
brings the application forward. A Route would have to set a breakpoint and
start debugging something that hits it. The others need a person, a file
dropped on the window, a link opened from outside, or Positron already
having focus; the canvas's reveal of the main window asks in the default
mode, and whether that brings it forward while behind is not measured.

**Why it is a defect and not a limit.** The person watching loses the
screen they were promised, and a Route then runs in front, so whatever it
types reaches only the application, which is right, while the person's own
keystrokes may reach it too, which is not.

**What would close it, not decided:** handing back again whenever a Hop
caused the application to come forward, which needs a measured threshold for
"caused"; handing back every time was declined, since it cannot be told from
a person clicking the window to look. Chosen on 2026-10-04 to hand back once
and record this, from three options weighed.

## A Fix's fingerprint misses what the Fix does not itself contain

**Filed 2026-10-02, confirmed by reading the code.** `fixFingerprint` in
`src/journal.ts` hashes `fix.toString()`, the Fix function's own source, and
each Route's opening line records it so that an edit to the Fix shows.
`OUTSTANDING.md` 2.13 relies on that, as the way an edited Fix is told apart
from a changed application. Three things change what a Fix does and leave
its fingerprint the same:

- **A constant outside the function.** RStudio's `r-markdown-further`
  inserts the text in `ADDED`, and `script` and `session-data` type the
  lines in `CODE`, each a module constant; changing `mean(x)` to `median(x)`
  changes what every Route types and nothing in its journal.
- **Anything the Fix imports.** Positron's `data-explorer` runs its
  `session` Fix, and `session` reads the adapter; an edit to either leaves
  `data-explorer`'s fingerprint as it was.
- **A branch on something read at run time.** Positron's `session` Fix
  takes different steps for the early releases and the current one, by
  `positronFamily`, so one fingerprint stands for two different openings.

**Why it is a defect and not a limit.** A recorded failing seed whose Fix
changed this way stops reproducing while the journal says the Fix is the
same, which reads as the application having changed, or as a fixed bug:
R13's failure, arriving through the record meant to prevent it. Found by a
review of how a replay could run a Fix's `code` steps.

**Narrowed on 2026-10-03.** Each `fix-step` line now records the step's
kind, an `act` step's target as data with any value typed, and a `code`
step's source text with a hash of it. That puts the second and third cases
on the steps' own lines: a step that an imported Fix or the other branch
takes is written down with what it is. **It does not reach the first.**
Read in the source, each of the three constants is used by name inside a
`code` step's action, `insertText(ADDED)`, `type(CODE.join('\n'))` and
`type(line)`, so the recorded source names the constant and not what it
holds. This entry had said the recording would make such a change visible;
it does not.

**What would close it,** both parts of `OUTSTANDING.md` 1.18 and both
unbuilt: a replay that compares each step's recorded content, and what the
step did to the screen (R31's effect), with what happens today; and the new
step kinds that let typed text sit on the line as data rather than as a
name inside code. Until a replay exists nothing compares the recorded
content either, so a changed Fix shows only to someone reading two
journals side by side.

## Two things that will look like candidates, and are not

Both are worth stating now, because each is more likely to be filed here
wrongly than to be missed.

**The ceiling of metamorphic testing is a non-goal, not a defect.** A bug that
is consistently wrong passes every round-trip, idempotence and commutativity
relation there is: the same wrong answer on both sides, so the relation holds.
That is a property of the technique, conceded deliberately when the design was
challenged on it, not a shortcoming in an implementation that does not exist
yet. It belongs in `PRODUCT_REQUIREMENTS.md` as a stated limit, and the
answer to it is an independent test oracle rather than a fix.

**A green Journey against a working application is not evidence of a defect
being absent.** It is consistent with an engine that checks nothing at all.
Until `proving-ground/buggy` holds planted defects and a Journey is demonstrably
finding them, this file being short carries no weight. An absence check needs
a positive control, and the entry above was filed by reading code rather
than by any run discovering it.

## One hazard to record the moment it becomes real

**The oracle sharing logic with the code it judges.** It produces a bad answer
while every test passes, which is exactly what this file is for, and it is
invisible from the outside: both sides agree, so nothing looks wrong. It is
not an entry yet because no oracle exists. `../CLAUDE.md` carries it as a
standing commitment so it does not get built that way in the first place, and
if it ever is built that way, the entry belongs here rather than being
reasoned about as a design preference.
