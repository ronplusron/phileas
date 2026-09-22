# Phileas -- what is outstanding

Everything not settled that is not itself a defect: what is agreed and
unbuilt, what nobody has decided, and what was declined.

**Nothing currently waits on an opinion**, so there is no section for it.
The three questions that gated phase 1 were settled on 2026-09-21, and
`HISTORY.md` records each with the measurement behind it. A section comes
back when something needs one.

**An item leaves this file when it closes.** It is not marked done and it is
not kept for the record, because `HISTORY.md` is the record. A file that only
accumulates is how a section grows until nobody reads it.

**These headings are judgments.** Placing an item is a decision about what
kind of thing it is, and worth making deliberately.

`DEFECTS.md` is what is wrong. It holds one entry, filed when the launch
layer landed with a known hazard still open.

## 1. Agreed, not built

### 1.1 The engine

Everything in `PLAN.md` from phase 4 on. Phases 0 through 3 are done and
`HISTORY.md` records them: the toolchain, the launch layer lifted and
hardened, a packaged application it can launch, and the seeds that make a run
reproducible. What is unwritten is everything that makes this an explorer --
traversal, the journal and every check.

### 1.2 Planted defects, and the applications still to build

`testbed/buggy` exists and is structurally ordinary on purpose. **No defects
are planted in it yet**, and until they are, nothing here shows the engine
finds anything. `PLAN.md` plants them across phases 5, 6 and 8.

The siblings are also unbuilt, and each makes a different claim: a build with
the Electron fuses disabled, a virtualized list, a canvas-backed surface, a
dismissed widget that still takes keystrokes, a native dialog that blocks the
main process, a splash window, an application noisy on the console, and one
that fails only into a log. Those test that the engine copes rather than that
it finds.

**This is not an optional extra and should not be treated as a late nicety.**
Every other test in this repository can only show that the parts behave as
written. This is the only thing that shows the assembled engine does its job,
and the right way to test a bug-finder is to point it at known bugs.

### 1.3 Wiring a consuming repository in another checkout

`testbed/buggy` already consumes the engine as a `file:` dependency and
imports it by package name, so the shape is proved. **What is not proved is
the case that matters**, because that symlink lands back inside this
repository: whether Playwright transpiles a package whose TypeScript source
sits outside the consumer's own tree. Phase 9 is where that is found out, and
the answer decides whether the engine must be built before it can be
consumed.

## 2. Undecided

Product questions that are still open -- what fault injection covers, how long
journals are kept, what happens when one defect is found on several
routes -- are in `PRODUCT_REQUIREMENTS.md` under Open questions, and are not
repeated here.

### 2.1 A language model, deferred rather than undecided

Not in this version, and wanted eventually. `PRODUCT_REQUIREMENTS.md` states it
as a non-goal of this version. This entry exists to keep the seams honest in
the meantime, because the cost of adding one later is decided now, not then.

Four places it could go, and they are not equally risky:

- **Summarizing a finding from a route's journal.** Runs after everything,
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

### 2.2 Publishing, deferred with an expiry that nothing currently watches

Private for now, and publishing is wanted eventually.
`PRODUCT_REQUIREMENTS.md` carries this as a constraint and marks it inferred
rather than stated, and a goal there rests on it. Nothing tracked the decision
itself until this entry, which is why it is here: a constraint with an expiry
and no watcher expires quietly.

**What it rests on:** that every consumer is a repository under the same
ownership, reachable by a `file:` dependency, so nothing outside can be broken
by a change. That holds today.

**When to revisit:** when a consumer appears that cannot use a `file:`
dependency, or when anyone outside would be asked to write an adapter. Both
turn interface stability and adapter ergonomics from preferences into
requirements, which is a larger change to this document set than to the code.

**One deployment shape forces the question immediately.** If an external
application's maintainers accept a phileas directory in their own repository,
that repository becomes a consumer and cannot reach a `file:` dependency on a
private package, so the engine would have to be published before the offer
could be taken up. The other two shapes keep every consumer under your own
ownership and leave this deferred. So the answer is downstream of a question
nobody has asked yet, rather than of a date.

**What is not deferred:** the engine is already named
`@drugstoresushi/phileas` and versioned, so the decision is about whether to
publish rather than about how the package would be identified.

### 2.3 Wager, as a name for the terms of a Journey

Proposed, then parked rather than rejected, on an explicit request to hold on
to it in case it proves useful. It failed a use-it-in-a-sentence test: "a
journey of 10 routes" reads, "a journey for which the wager was 10 routes"
does not, and is inaccurate besides.

Kept here rather than under Declined because parking it was deliberate. If
the terms of a Journey ever need a collective noun, this is the candidate
already considered.

## 3. Declined

### 3.1 Planner-assigned route bias

Declined 2026-09-20, for two reasons. It is interference rather than learning,
since nothing has run when the bias is assigned, which makes it stratified
sampling. And the problem it solves is negligible, which was measured rather
than assumed.

`HISTORY.md` has the reasoning and the measurement. Reopen only on measurement
showing real clustering, not on the intuition that ten random walks must
overlap.

**The related guard is a standing commitment rather than a declined item:** the
planner stays a for-loop. If it starts deciding what gets explored rather than
how many Routes there are, this decision has been reversed under another name.

### 3.2 A per-application enumeration of controls

Declined as the basis for discovery. An adapter listing every control would be
more precise than discovery by accessibility role, and would stop this being a
framework, which is the trade the project exists to make.

Not declined: the adapter-supplied exclusion list of things that must never be
hopped to, such as Quit and outbound links. That is a safety rail, not a map,
and it stays.

### 3.3 The name Fogg

Declined 2026-09-20 in favor of Phileas. "Fog" reads as obscurity, wrong for a
tool built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

### 3.4 The directory names `kit` and `app`

Declined 2026-09-20. Both non-standard, and `app` actively harmful because it
collides with "the application" -- it caused a real misreading during the
session that chose against it. Replaced by `src/` here and `phileas/adapter/`
in a consuming repository.
