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

What follows is three defects, then the two things most likely to be filed here
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

## A shown run reaches the system clipboard

**Filed 2026-09-23, found while writing an adapter for another application.**
With windows shown, the menu source is offered, and `buggy`'s adapter excludes
only Quit. So its Journeys can hop to Edit > Cut, Copy and Paste, and they
have. Counted from journals still on disk: the `headed01` Journey hopped Cut 9
times, Copy 10 and Paste 6, and a watched demo run, `demo1`, hopped Cut 7,
Copy 3 and Paste 4. A hidden run is unaffected, because it withholds the menu.

**Three things go wrong, and none is visible from the record.**

- **It changes the machine it runs on.** Cut and Copy overwrite whatever the
  person running the Journey had on their clipboard.
- **It can carry that content into evidence.** Paste puts the clipboard into
  the page, and from there into any failure screenshot, DOM dump or trace. A
  password copied a minute before the run could end up in an attachment.
- **It breaks replay.** What a Paste inserts is state from outside the seed,
  different on every machine and every minute, and the journal does not
  record it, since a paste is not a `fill`. Two runs of one seed can diverge
  at the first Paste with nothing in the record to say why.

**Why a defect and not a limit:** it produces a wrong answer, a replay that does
not reproduce, and it leaks data, and every Journey still passes.

**What closes it:** `buggy`'s adapter excluding the clipboard entries, before
phase 5. Whether the engine should exclude them by default for every
application is undecided and is in `OUTSTANDING.md`, beside the other standard
menu entries every Electron application carries.

## An earlier run's journals sit beside a new run's

**Filed 2026-09-23, found by listing a Journey's journal folder.** A run writes
each Route's journal into `.phileas-journals/<journey seed>/` and never clears
that folder. A rerun of the same seed rewrites only the files it writes, so a
rerun with fewer Routes leaves the earlier run's extra files in place, under
the same seed. Measured: in the `demo1` folder, Route 0's journal was written
at 07:19 by a one-Route run, and Routes 1 to 4 were left from a five-Route run
at 06:55.

**Why a defect:** nothing distinguishes the stale files. A person reading the
folder, or the phase 7 report reading it, takes five files as one Journey, and
four of them describe a run that is not the one being looked at.

**What closes it,** before phase 5: a run either clears its seed's folder before
writing, or writes each run to a folder of its own. Which is undecided. The
second keeps earlier runs available for comparison, which a replay wants.

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
a positive control, and the one entry above was filed by reading code rather
than by any run discovering it.

## One hazard to record the moment it becomes real

**The oracle sharing logic with the code it judges.** It produces a bad answer
while every test passes, which is exactly what this file is for, and it is
invisible from the outside: both sides agree, so nothing looks wrong. It is
not an entry yet because no oracle exists. `../CLAUDE.md` carries it as a
standing commitment so it does not get built that way in the first place, and
if it ever is built that way, the entry belongs here rather than being
reasoned about as a design preference.
