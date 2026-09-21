# Phileas -- what is outstanding

Everything not settled that is not itself a defect: what is agreed and
unbuilt, what waits on a person, what nobody has decided, and what was
declined.

**An item leaves this file when it closes.** It is not marked done and it is
not kept for the record, because `HISTORY.md` is the record. A file that only
accumulates is how a section grows until nobody reads it.

**These headings are judgments.** Placing an item is a decision about what
kind of thing it is, and worth making deliberately.

`DEFECTS.md` is what is wrong. Nothing is built, so it holds no defects yet,
only the two things most likely to be filed there by mistake.

## 1. Settle before building on them

### 1.1 How much the interface has to carry, now that the consumers are known

The consumers were settled on 2026-09-21 and `HISTORY.md` records them and the
reasoning. What stays open is the consequence: two small Electron applications
under the same ownership justify a narrow `AppUnderTest`, and two very large
external ones justify a broader one. The answer lands in the phase that hardens
the interface, and every later phase builds on it.

The large candidates pull hardest. Both already run Playwright, so adoption is
cheap, but their surfaces are hostile in opposite directions -- one may give
discovery by role almost nothing to work with, the other far more than a hop
budget can handle, and it changes underfoot. Neither is a reason to narrow the
interface; both are reasons to measure discovery against a real one before
phase 4 rather than during it.

### 1.2 Which deployment shape each candidate consumer uses

`../CLAUDE.md` records three shapes: adapters in the application's own
repository, adapters in a repository of your own pointed at a source checkout
you build, or adapters pointed at an installed binary. The first is cheapest
and the third is the most limited, since the staleness guard cannot run there.

For the applications under your own ownership the first shape applies and
nothing is open. For the two large external candidates it is genuinely
undecided, and the answer is not entirely yours: their maintainers may accept
a directory upstream, which would make the first shape available. If they do
not, both are public repositories that can be cloned and built, so the second
shape is always available as a fallback and no candidate is forced into the
third.

**The plan's position is to default to the second shape and not wait on this.**
It is the only one available for every candidate without anyone's permission,
it keeps the staleness guard working, and it makes the first shape an upgrade
to be earned rather than a decision to be made now. Asking an external project
to accept a phileas directory is a conversation better had after the engine
has found something than before it exists.

Nothing in phases 0 through 8 depends on the answer, since the example
application lives inside this repository. One concrete consequence does land
earlier, in the phase that hardens the interface: `repoRoot` assumes the first
shape, and `PLAN.md` carries it there.

### 1.3 Whether the proposed homes for three lifted files are accepted

The kit that becomes `src/` has 7 files. Four had an obvious home from the
start. The other three -- fixtures, menu handling and external-link handling
-- did not, and `PLAN.md` phase 1 now proposes one for each with its
reasoning, so the question here is no longer where they go but whether those
positions are accepted.

Each is a decision rather than an improvisation at the moment it is moved:
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
journals are kept, what happens when one defect is found on several
routes -- are in `PRODUCT_REQUIREMENTS.md` under Open questions, and are not
repeated here.

### 3.1 A language model, deferred rather than undecided

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

### 3.2 Publishing, deferred with an expiry that nothing currently watches

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

### 3.3 Wager, as a name for the terms of a Journey

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
sampling. And the problem it solves is negligible, which was measured rather
than assumed.

`HISTORY.md` has the reasoning and the measurement. Reopen only on measurement
showing real clustering, not on the intuition that ten random walks must
overlap.

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
