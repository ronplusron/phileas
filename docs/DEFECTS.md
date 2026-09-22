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

**No defects are recorded, because nothing is built.** Writing speculative
ones against unwritten code would make this a list of worries, and a worry
belongs in `OUTSTANDING.md`.

**A hazard in code that has not been lifted here yet is neither.** It is not
a defect, because the file is not in this repository; it is not a worry, if
what to do about it is already decided. `PLAN.md` carries those as hazards
and schedules the work against the phases that close them. The entry belongs
here on the day the file lands with the hazard still open.

What follows is not a list of defects. It is the two things most likely to be
filed here wrongly, and two hazards to enter the moment each becomes real.

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
Until `examples/` holds an application with planted bugs and a Journey is
demonstrably finding them, the absence of entries in this file carries no
weight. An absence check needs a positive control, and this file has none
until that example exists.

## Two hazards to record the moment each becomes real

**The oracle sharing logic with the code it judges.** It produces a bad answer
while every test passes, which is exactly what this file is for, and it is
invisible from the outside: both sides agree, so nothing looks wrong. It is
not an entry yet because no oracle exists. `../CLAUDE.md` carries it as a
standing commitment so it does not get built that way in the first place, and
if it ever is built that way, the entry belongs here rather than being
reasoned about as a design preference.

**The external-link stub installing successfully and doing nothing.** The same
shape one level down: the recorder that stops a browser opening is also the
only evidence that none did, so a stub that never took reports exactly like a
Route that never left the application. It is not an entry yet because
`external.ts` has not been lifted. `PLAN.md` has the mechanism, the
measurement showing no application yet found is affected, and the three items
across phases 1, 2 and 5 that close it. It becomes an entry here if the file
lands with any of those three still missing.
