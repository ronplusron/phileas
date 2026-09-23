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
layer landed with a known hazard still open; a second closed in phase 4.

## 1. Agreed, not built

### 1.1 The engine

Everything in `PLAN.md` from phase 5 on. Phases 0 through 4 are done and
`HISTORY.md` records them: the toolchain, the launch layer lifted and
hardened, a packaged application it can launch, the seeds that make a run
reproducible, and the Routes that travel through it and write down where
they went. What is unwritten is every check: nothing yet judges whether anything
a Route found is wrong.

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

### 1.4 Three things the review scheduled rather than fixed

Each was found by the review on 2026-09-22, each is agreed, and each was
deliberately not done then because the phase that gives it its shape has not
arrived. `HISTORY.md` records the review itself. Two more stood here and closed
in phase 4.

**An application that throws on purpose, and an adapter that narrows it**, in
phase 5. The R19 narrowing branch in `fixtures.ts` has three paths and only the
"no narrowing" one is exercised, because nothing in the testbed throws and no
adapter declares a narrowing. `fixtures.ts` is reshaped in phase 5 anyway, and
a second deliberately awkward application is the cheapest way to cover it.

**Branded seed strings**, in phase 7. A journey seed, a route seed and a stream
seed are all bare `string`, so `deriveRouteStreams(streams.routeSeed, 0)`
compiles and produces a plausible, wrong stream. Real, and currently
theoretical: the seams still move, and phase 7 is when seeds start crossing
into a report and back out of one.

**Per-check observation types for `Narrowing.accept`**, in phase 6. Every check
shares one `accept(observation: string)`, but a `console-error` observation is
message text and a `named-controls` observation is not. An adapter author
writes a predicate against a string whose shape the interface never states.
The right shape is only knowable once app-declared checks exist.

### 1.5 The testbed's own contract, unchecked by anything

`tsconfig.json` compiles only TypeScript, so `main.cjs`, `preload.cjs` and
`renderer/renderer.js` are outside every static check. Two channel names and
two payload shapes are written out three times across those files with nothing
relating them, and `window.buggy` is untyped in the renderer.

It matters more than a testbed usually would. That directory is what a
consuming repository copies, and phase 2's whole job is to be the unbroken
version against which planted defects are measured -- a channel rename or a
payload change is a defect nobody planted, and the engine finding its own
testbed's accidental bugs is not the measurement anyone wants.

A `channels.d.ts` declaring the channel-to-payload map, referenced from all
three sides, expresses it without changing any runtime shape. Left as its own
change rather than folded into the review fixes, because turning on `checkJs`
will surface more than it fixes.

### 1.6 Keyboard shortcuts as a source of Hops

Raised 2026-09-22 and deliberately not declined. Three questions have to be
answered before it can be built.

**Today no Hop presses a key.** A click is a mouse click, `fill` sets a value
without keystrokes, and a menu entry is clicked through the menu. Keyboard-only
paths are a natural place for defects to live, and a Route that cannot press a
key can never reach them.

**The exclusion predicate makes the gap sharper.** Its only measured case is a
shortcut that closes an editor tab, and closes the application once no tabs
remain. That case cannot currently arise, so the one rail designed around a
shortcut guards against something the engine never does.

The three questions:

- **Discovery.** A shortcut is not a thing in the accessibility tree, so
  discovery by role does not find it. Menu accelerators are readable from the
  menu in the main process. Shortcuts the page handles itself are discoverable
  only where the application declares `aria-keyshortcuts`, which few do;
  finding the rest would mean reading source, which `survey` must not do.
  `../CLAUDE.md` says why.
- **Triggering.** Playwright cannot press a native accelerator, which is why
  `src/menu.ts` clicks menu entries instead. Whether a key event sent to the
  renderer reaches a native menu accelerator is unmeasured, and it decides
  whether menu accelerators are reachable at all.
- **Exclusion.** How `names` and the predicate apply to a shortcut, including
  whether a menu entry and its accelerator are one candidate or two. Excluding
  Quit by its menu path and leaving Cmd+Q reachable would be a rail with a gap
  in it that no test notices.

When a Hop does press a key, the journal records it as a `press` action,
which is planned rather than built: `action` today is `click`, `fill` or
`menu-click`, and a key press will need to record which key as well.

### 1.7 An optional map, in phase 10

**Reversed on 2026-09-23.** A per-application list of controls was recorded as
declined, on the grounds that an adapter listing every control would stop this
being a framework. That reasoning holds for a map that is *required*, and it
was wrongly applied to one that is merely allowed. What is agreed now:

- **Discovery stays primary, and a map is never required (R29).** An application
  with no map is explored exactly as today, and that remains the ordinary case.
- **A map may be full or partial.** Someone who knows the application can hand
  the engine what they know, and leave the rest to discovery.
- **It lands in phase 10, after the current last phase.** Phase 8 has to show
  that discovery alone finds every planted defect, and a map present by then
  would blur what found them. Phase 9 points the engine at a real application
  for the first time, and the places discovery actually fails there are the
  evidence the design below should be settled from.

Four questions are open, and are recorded rather than answered because phase 9
is what answers them:

- **What a map entry does.** It could add candidates discovery cannot find --
  a canvas surface, the rows a virtualized list is not rendering, a keyboard
  shortcut, which would also answer the discovery question in 1.6. It could
  annotate candidates discovery already found. Or it could steer the draw,
  which would be a new chooser behind the choosing seam rather than a change
  to the hop loop. The third needs care: steering is what planner-assigned
  route bias, 3.1, was declined for.
- **What happens to a stale entry.** A map entry that is not on the page could
  be skipped in silence or reported, the way an exclusion that matched nothing
  is. A map, like a hand-written exclusion list, goes stale the day the
  application changes.
- **Where a map comes from.** Written by hand, derived from the source
  beforehand, or read from an application's own automation bridge. The engine
  still reads no source at run time; whatever builds a map runs before the
  Journey and hands over the result.
- **How replay stays honest.** A map is an input to the draw, like the
  exclusion list, so editing one changes where Routes go. The journal should
  mark candidates a map supplied, so that R14 can tell a map edit from an
  application change.

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
choice of the next Hop starts needing judgment that a rule cannot express.
Revisit sooner if
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

### 2.4 Filling a field is not typing into it

Recorded 2026-09-23. A Hop that puts text in a field uses Playwright's `fill`,
which sets the whole value at once and fires a single input event. No key is
pressed. So a defect that lives in a key handler -- one that fires on each
keystroke, validates as you type, or reacts to a particular key -- is out of
every Route's reach, and nothing says so: the journal records `fill` and the
value, and a reader could reasonably assume the value was typed.

What to do about it is open. Typing each character instead would reach key
handlers, at a round trip per character, and changes no draw, though the
application may respond differently and so send a Route elsewhere. Choosing
between filling and typing by a draw would reach them some of the time, and
adding that draw changes every recorded seed. It is close kin to 1.6: both are about the
keyboard, and a Hop that types and a Hop that presses a shortcut would likely
share whatever settles how key events reach the application.

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

### 3.2 The name Fogg

Declined 2026-09-20 in favor of Phileas. "Fog" reads as obscurity, wrong for a
tool built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

### 3.3 The directory names `kit` and `app`

Declined 2026-09-20. Both non-standard, and `app` actively harmful because it
collides with "the application" -- it caused a real misreading during the
session that chose against it. Replaced by `src/` here and `phileas/adapter/`
in a consuming repository.
