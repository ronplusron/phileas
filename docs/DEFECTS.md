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

**Ten defects are recorded.** The launch layer landed in phase 1, so this
file is no longer empty for the reason it used to be empty. Six of them were
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
`testbed/buggy` hops its outbound link and asserts the recorder caught it.
**The other two are not built.** The exclusion list is hand-written rather
than derived from source, so it goes stale silently the day an application
adds another way out. And the independent evidence in phase 5, a check that no
foreign process appeared, does not exist, so the recorder is still both the
prevention and the only proof of it.

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

## The Positron home guard can report clean without having read anything

`entries()` in `trial/positron/phileas/home-guard.ts` returns an empty set on
any error, and "nothing written" is printed all the same. When `ps` fails,
`outsidePositrons()` returns 0 and the refusal then says no other Positron was
running. A guard that could not look reads like one that looked. Printing how
much was read, and "unknown" for a failed `ps`, closes it.

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
Until `testbed/buggy` holds planted defects and a Journey is demonstrably
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
