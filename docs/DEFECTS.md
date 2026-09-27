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

**Three defects are recorded.** The launch layer landed in phase 1, so this file
is no longer empty for the reason it used to be empty.

**A hazard in code that has not been lifted here yet is neither a defect nor
a worry.** It is not a defect, because the file is not in this repository; it
is not a worry, if what to do about it is already decided. `PLAN.md` carries
those as hazards and schedules the work against the phases that close them.
The entry belongs here on the day the file lands with the hazard still open,
which is how the first entry below arrived.

What follows are three defects, then the two things most likely to be filed here
wrongly, and one hazard to enter the moment it becomes real.

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

## A Route's profile folder can be left behind

**Filed 2026-09-26, found on Positron.** The fixture deletes a Route's profile
folder once, after the application has closed. Positron's child processes
were still exiting and writing into it when that happened, and the delete
failed with "directory not empty": two Positron profiles were left in the
system temp folder that day, and one run's teardown reported the error. A
profile holding a file the run made read-only fails the same way.

**Why it is a defect and not a limit.** Each leftover is a profile a later
reader has to find and remove by hand, and the engine's own suite fails when
its runs leave one. The race depends only on how long an application's
children take to exit, which the engine does not control.

**What closes it.** Retry the delete while the folder is still changing, and
make anything read-only writable before deleting it. Proved by a test that
keeps writing into a profile while it is deleted, and one that makes part of
it read-only.

## An application that opens no window is reported only as a timeout

**Filed 2026-09-26, measured on `buggy` and Positron.** An application can
start, say why it cannot go on, and never open a window. The engine then
waits thirty seconds for the first window and reports only "Timeout 30000ms
exceeded while waiting for event \"window\"", although it had already
collected the application's standard error, which held the reason. Measured
with a `buggy` launch flag that prints a reason and opens no window.

Two nearby cases are not this defect, measured the same day. An application
that exits at launch is reported by Playwright with its standard error in the
message. And Positron, launched on a profile folder it cannot write to, timed
out inside Playwright's own launch, whose message carried everything Positron
printed: Positron printed no reason, which no engine change can supply.

**Why it is a defect and not a limit.** R24 asks that a setup that is wrong
reports what is missing rather than timing out, and here the reason was in
hand and dropped.

**What closes it.** Put the standard error collected so far into the error
when no window appears. Proved by a test that the launch error carries the
reason `buggy` printed.

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
