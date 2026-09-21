# Phileas -- what is outstanding

Everything not settled that is not itself a defect: what is agreed and
unbuilt, what waits on a person, what nobody has decided, and what was
declined.

**An item leaves this file when it closes.** It is not marked done and it is
not kept for the record, because `HISTORY.md` is the record. A file that only
accumulates is how a section grows until nobody reads it.

**These headings are judgments.** Placing an item is a decision about what
kind of thing it is, and worth making deliberately.

`DEFECTS.md` is what is wrong. Nothing is built, so it is empty.

## 1. Settle before building on them

### 1.1 Which repositories are actually intended as consumers

Two earlier records disagree and neither was reconciled. One names three
sibling repositories as consumers; an earlier one names a different set of
five. Confirming which is right is cheap and changes what generality the
engine has to carry: one consumer justifies far less abstraction than five,
and the difference lands on `AppUnderTest`.

Worth answering before that interface is hardened, not after. `PLAN.md` names
this at the phase that does the hardening, which is early, rather than at the
one that eventually wires a second repository up.

### 1.2 Three of the seven files being lifted have no planned home

The kit that becomes `src/` has 7 files. The planned layout accounts for
`app-under-test.ts`, `launch.ts` and `bundle.ts`. It says nothing about the
remaining three, which cover fixtures, menu handling and external-link
handling.

Each needs a decision rather than an improvisation at the moment it is moved:
part of the engine, part of what a consuming adapter supplies, or dropped.
Menu handling in particular may be generic traversal machinery or may be
application-specific, and guessing wrong puts app knowledge inside the engine,
which is the thing the framework reading exists to prevent.

## 2. Agreed, not built

### 2.1 Dependencies

Four, not two. Until they are added, `npm run typecheck` and `npm test` are
inert and no later work can be verified at all. Nothing blocks this.

- `typescript` and `@playwright/test`, the obvious pair.
- `@types/node`, because `tsconfig.json` already names the `node` types. The
  compiler reports that missing before it reports anything else, so leaving it
  out makes the first typecheck misleading rather than merely failing.
- `@electron/asar`, because the staleness guard being lifted from the sibling
  repository reads the packaged archive directly. This one is easy to miss:
  nothing in the current repository mentions it, and it only surfaces when the
  guard's own source arrives.

### 2.2 The engine

Everything in `PLAN.md`. None of it started.

### 2.3 An example application with planted bugs

`examples/` wants an application with deliberately planted faults and tests
asserting that a Journey finds each one.

**This is not an optional extra and should not be treated as a late nicety.**
Every other test in this repository can only show that the parts behave as
written. This is the only thing that shows the assembled engine does its job,
and the right way to test a bug-finder is to point it at known bugs.

### 2.4 Wiring a consuming repository

Consume the engine via a `file:` dependency rather than a registry, so imports
take their eventual shape immediately without anything being published.

## 3. Undecided

Product questions that are still open -- what fault injection covers, how long
records of a walk are kept, what happens when one defect is found on several
routes -- are in `PRODUCT_REQUIREMENTS.md` under Open questions, and are not
repeated here.

### 3.1 A language model, deferred rather than undecided

Not in this version, and wanted eventually. `PRODUCT_REQUIREMENTS.md` states it
as a non-goal of this version. This entry exists to keep the seams honest in
the meantime, because the cost of adding one later is decided now, not then.

Four places it could go, and they are not equally risky:

- **Summarizing a finding from the record of a walk.** Runs after everything,
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
traversal starts needing judgment that a rule cannot express. Revisit sooner if
anyone proposes inlining the choice of the next candidate into the hop loop,
which is the change that would make this expensive. `../CLAUDE.md` holds that
as a commitment.

**Not deferred, and not wanted later either: a model inside the checks.** A
route ends at the first violation, so a judgment nobody can reproduce would end
routes at random and a red result would stop being worth reading. If a model
ever judges, it is a separate tier with its own reporting, never mixed with the
deterministic ones.

### 3.2 Wager, as a name for the terms of a Journey

Proposed, then parked rather than rejected, on an explicit request to hold on
to it in case it proves useful. It failed a use-it-in-a-sentence test: "a
journey of 10 routes" reads, "a journey for which the wager was 10 routes"
does not, and is inaccurate besides.

Kept here rather than under Declined because parking it was deliberate. If
the terms of a Journey ever need a collective noun, this is the candidate
already considered.

## 4. Declined

### 4.1 Planner-assigned route bias

Declined 2026-09-20, for two reasons. It is interference rather than learning,
since nothing has run when the bias is assigned, which makes it stratified
sampling. And the problem it solves is negligible: measured over eight buttons
and ten routes, about four pairs collide on the first hop, each diverging with
probability 7/8 on the next, for a handful of duplicated hops out of roughly
400.

`HISTORY.md` has the full reasoning. Reopen only on measurement showing real
clustering, not on the intuition that ten random walks must overlap.

**The related guard is a standing commitment rather than a declined item:** the
planner stays a for-loop. If it starts deciding what gets explored rather than
how many Routes there are, this decision has been reversed under another name.

### 4.2 A per-application enumeration of controls

Declined as the basis for discovery. An adapter listing every control would be
more precise than discovery by accessibility role, and would stop this being a
framework, which is the trade the project exists to make.

Not declined: the adapter-supplied exclusion list of things that must never be
hopped to, such as Quit and outbound links. That is a safety rail, not a map,
and it stays.

### 4.3 The name Fogg

Declined 2026-09-20 in favor of Phileas. "Fog" reads as obscurity, wrong for a
tool built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

### 4.4 The directory names `kit` and `app`

Declined 2026-09-20. Both non-standard, and `app` actively harmful because it
collides with "the application" -- it caused a real misreading during the
session that chose against it. Replaced by `src/` here and `phileas/adapter/`
in a consuming repository.
