---
name: reproduce
description: Reproduce a Phileas finding by replaying the Route that found it from its journal, and report honestly whether it came back. Use when asked to reproduce, replay or confirm a finding, check whether a bug still happens on a newer build, or check that a fix worked.
---

# Reproducing a finding

A finding is reproduced by replaying its Route from the journal, which acts
on each recorded target by name instead of drawing from the seed. That works
on another machine and on a later build, where the seed would send the Route
somewhere else.

## Every new finding of a run

```
npx phileas reproduce [run] [--config <config>]
```

Replays, one at a time, each Route that ended on a finding not yet known and
has not been replayed, then prints each verdict. Each replay launches the
application, so say how many Routes it will replay before starting.

## One Route

```
npx phileas replay <journal> [config] [--whole] [--with-current-fix] [--follow]
```

- The journal is the Route's file, `route-NNN-<seed>.jsonl`, in its run's
  folder. `phileas show --json` names it for each Route.
- By default it replays to the finding and three Hops past it. `--whole`
  replays every recorded Hop.
- A Fix with code steps cannot be held in a journal; `--with-current-fix`
  runs the current Fix's code, checked against what was recorded.
- Pass `--follow` when a person is watching.

## Reading the verdict

The reporter prints one line under the replayed Route. Quote it:

- **reproduced: the finding came back.** Say "reproduced once" for one
  replay. Twice is "reproduced in both of two replays".
- **not reproduced.** Every replayed Hop landed and the finding did not come
  back. On the build that recorded it, that points at timing or state. On a
  build carrying a fix, it is how the fix is checked.
- **not reproduced, and failed on something else.** A different finding,
  which is its own result.
- **could not replay.** A recorded target is not on offer now. The
  application changed, and the replay says nothing about the finding.

Never call a finding fixed on one replay that did not reproduce it, and
never call it reproduced when the replay failed on something else.

## Confirming the steps on their own

A replay retraces the whole Route, every Hop it took. A bug report needs the
few steps that matter, run from a fresh launch, with nothing else before
them. A replay that reproduced says the bug is real; only this says the
steps in the report are the ones that cause it.

1. **Read the steps off the Route,** as the `triage` skill's "Steps, written
   for a person" describes: from when the finding arrived, back to what it
   needs.
2. **Write a probe** in the Journey's `probes/` folder, beside `phileas/`, with
   its own `playwright.config.ts`. A probe is a Playwright test that runs one
   Route through the engine's `runRoute`, with a Fix holding the setup steps
   and a `Chooser` that always picks the decisive control, so it acts the
   steps and nothing else, and the engine's own checks judge it. Existing
   probes are the pattern to copy, where the repository has any.
3. **Run a control beside it:** the same steps without the decisive one, or
   with a similar control that ought to behave. A finding that comes back in
   both is not caused by that step.
4. **Run each a few times,** three at least, and say the count: "5 of 5, and
   0 of 3 without the click". Once is a sighting.
5. **Write the result into the draft,** replacing "read from the Route and
   not yet run on their own" with what was run and how many times.

Each run launches the application, so say how many runs before starting.
A step that the probe cannot reproduce stays in the draft as found on the
Route and not reproduced on its own, which is a finding too.

## Afterwards

A replay is a run of its own, in the same seed's folder, and `phileas show
--json` on the original run lists it under the Route's `replayedBy`. Offer to
draft an issue (the `triage` or `file` skill) for a finding that reproduced.
