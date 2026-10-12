---
name: triage
description: Triage a finished Phileas run - sort every Route that did not pass into new findings, known findings, stranded Routes and faults in the engine or setup, and draft an issue for each new finding worth filing. Use when asked to triage a Journey or a run, read its results, say what it found, or write up its findings.
---

# Triaging a run

The argument is a run folder, a run's `triage/` folder, or nothing, which
means the latest run under `phileas/.phileas-journals/`.

## Read the run

- **If a `triage/` folder is given or exists**, read `summary.json` there,
  and the rendered Routes in `triage/routes/`. Unattended, these are what
  there is to read, with the run's own journals beside them.
- **Otherwise** run `npx phileas show --json <run>` for the summary and
  `npx phileas show <journal>` for any Route worth reading Hop by Hop.

The summary gives each Route's outcome, Hops, the check that failed and what
it saw, each finding's id and whether it was already known, and any replay
of the Route with its verdict.

## Sort every Route that did not pass

Each falls in exactly one of these, and the report says which:

| Kind | How to tell |
| --- | --- |
| New finding | failed on a check, with a finding whose `known` is false |
| Known finding | failed on a check whose findings are all known, which happens only for a hung application, since a known finding otherwise does not end a Route |
| Stranded | outcome `stranded`: ran out of moves, or every Hop was abandoned. Not a failure and not a pass |
| Fault in the engine or setup | failed with no failed check: the reason is an error, not a finding |
| Unfinished | no outcome: cut off by a deadline, stopped, or the run died |

**A finding's `known` is how it stood when the run was made; its `now` is how
it stands today,** from the known findings file. A run read days later holds
findings filed or dismissed since. Say each one's standing now: `filed` with
its issue, `false alarm` with the reason given, `unfiled` or `not on file`
for one nobody has decided, and `no file` where there was nothing to ask.
Only a finding nobody has decided gets a draft.

**A finding is not a bug until somebody judges it.** A check reports what it
saw; whether the application is wrong is a judgment, and the report says
whose. Where the evidence leaves it open, say so rather than deciding. A
message an application logs as an error in ordinary use is the usual false
alarm, and is reported as a suspected false alarm with the reason, never
dismissed.

**Read when the finding arrived, not only the Hop the check ran after.** A
failed check names when each finding arrived against its step; the cause is
usually among the few steps before the arrival.

## Replays

A replay's verdict is the engine's, and is quoted, never restated more
strongly:

- `reproduced: the finding came back`
- `not reproduced: ...` says how many replayed Hops landed
- `could not replay: ...` means the replay says nothing either way

A finding with no replay is reported as not yet replayed. Say how many times
each was replayed; one replay that reproduced is "reproduced once", never
"every time".

## The report

Markdown, for a person who did not run the Journey:

1. One line: the seed, the run, and the counts by outcome.
2. A table, one row per Route that did not pass: Route, outcome, Hops, the
   finding's id, known or new, the replay's verdict, and the kind above.
3. A short section per new finding: what the check saw, the steps before it
   arrived, the replay, and the judgment with its reason.
4. Anything about the run itself worth knowing: every Route stranded at hop
   one, or the application never launching, is not a quiet run.

## Drafts

One draft per new finding worth filing, and none for a suspected false alarm,
a fault in the engine or setup, or a stranded Route; the report covers
those.

A draft is a bug report for a developer of the application, who has never
heard of Phileas, and has to make the bug happen on their own machine. **The
steps are what matter most;** everything else tells them what to run it on,
what to look for, and why it is wrong. If a skill for writing bug reports in
a house style is available, follow it for anything this leaves open.

### Shape

```
Found by Phileas, <where: which Journey, trial or batch>. <One sentence of
context a developer needs first, if any.>

### Environment

- <application and version, OS and architecture>
- <how it was launched: fresh profile, flags, settings that differ>

### Steps to reproduce

<Setup, if any, as one line: "With a fresh profile:">

1. <One action, in the application's words.>
    - <What happened, as an indented bullet, where it matters.>
2. ...

### What happened

<A short paragraph: the core of it, how often, and what was and was not
tried, such as a similar control that works, or one not tried.>

### What I expected

<One or two sentences.>

<details><summary>The Route as the journal recorded it</summary>

<The Hops that led to it, as the rendered Route lists them.>

</details>

<!-- Phileas finding <id>: seed <journey seed>, Route <n>, hop <h>. -->
```

### Steps, written for a person

**Read the Route, then write what a person would do.** A journal records
every Hop, most of which had nothing to do with the bug. The steps are the
few that do:

- **Start from when the finding arrived,** not the Hop the check ran after.
  Work back from there to the controls whose effect the bug needs: a dialog
  opened, a file selected, text typed into the field that later misbehaves.
- **Leave out Hops that changed nothing it needs.** A key that did nothing,
  a menu opened and closed, a tab visited and left.
- **Compare Routes that met the same finding.** What they share is likely
  what matters; what only one did likely is not.
- **One action per step,** named as a person sees it: "Click Manage, the gear
  at the bottom of the activity bar", not `button "Manage"`. Menus as
  `File -> New Window`, keys as `<kbd>Escape</kbd>`, exact text typed in
  quotes.
- **Observations are bullets under the step,** never steps of their own. An
  error the check read goes in a plain fenced block, quoted exactly, with a
  path into a person's home folder shortened to `.../`.

**Say how the steps were reached.** Steps cut down from a Route are a
reading of it until they are run on their own. Unattended, nothing can be
run, so a triage writes "These steps are read from the Route and not yet
run on their own; replaying the whole Route reproduced it" under the steps.
The `reproduce` skill is what confirms them.

### Wording

- **Title:** what happens, in the application's terms, not the check's name
  and not the fix. No commas or semicolons, and no "Bug:". The tracker's
  `titlePrefix` goes first.
- **Plain words and a direct tone.** "This occurs consistently", never
  "100% reproducible". Name what was actually run and how many times: "each
  time" after one run, or "reproduced by hand" for a replay, have both been
  written before.
- **No guessed environment.** A run does not record what was launched, so
  the Environment section says only what the filing settings' `environment`
  lines say, and what the journal itself records, such as a setting the Fix
  changed. Anything else, a version, how the application was built, the OS,
  is "not recorded", never inferred from a path or a name: a triage once
  wrote that RStudio was built from source, when the trial runs a copy of
  the installed release.
- **No guessed causes.** Report what was seen. The application's source,
  where it was read, is the developer's to explain, not the draft's.
- **ASCII only,** since an issue is a git artifact: `--` closed up for a
  dash, `->` for an arrow.
- **Follow the filing settings' `rules`.** With `noOtherRepositoryLinks`,
  never write another repository's `owner/name#N` or an issue or pull request
  address of one; say "neither tracker shows an issue for it" instead. Never
  write a bare `#N`, which links to an issue of the same repository. Number
  items `1.` or `Finding 1` instead.

## What triage never does

It never files an issue, marks a finding a false alarm, or changes
`known-findings.json`. Those wait for a person's yes, one change at a time;
the `file` skill files one draft once it is given. Unattended, it writes no
files at all: the report and drafts are its answer, and `phileas triage`
writes them.
