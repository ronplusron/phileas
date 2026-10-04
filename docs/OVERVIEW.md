# Phileas -- an overview

*As of 2026-09-29.*

Phileas is a testing engine for Electron desktop apps that explores an app the
way a curious tester would, clicking and typing its way through whatever is on
screen, instead of following a script. Every run is seeded, so any problem it
finds can be replayed exactly, and it records every step as it goes. Phases 0
to 4 of 11 are done, with part of phase 5: it travels through apps, replays
runs exactly, records everything, and checks every step for errors, hangs,
crashes and blank windows, with three hundred and seventy-eight automated tests
behind it. Pointed at Positron and then RStudio, two large data-science code
editors, it found real bugs in both.

---

The rest is the same in more detail.

## What it is

Phileas is an exploratory testing engine for desktop applications built on
Electron, the framework behind apps such as VS Code and Slack. It travels
through an application the way a curious tester would: it looks at what is on
screen, picks something to do, does it, checks nothing has gone wrong, and
repeats. Every run is seeded, so any problem it finds can be replayed exactly,
step for step.

It is a component, not a product anyone runs on its own. An application's
team adds it beside their existing automated tests.

## The problem it solves

An automated test suite only checks the paths somebody thought to write down,
and the bugs that reach users are mostly on the paths nobody imagined.
Writing more scripted tests does not close that gap, because the gap is made
of cases nobody has thought of yet. A person exploring by hand finds them, but
that is slow, it cannot be repeated, and what they did is usually lost by the
time the bug is filed. Phileas does the exploring, repeatably, and keeps an
exact record.

## How it works, in one paragraph

A run, called a Journey, is a set of independent tries, called Routes. Each
Route starts from a known place, then takes a number of steps, called Hops,
each chosen from what the screen offers at that moment. After every Hop it
checks that the application is still healthy, and it stops at the first
problem. Every Hop is written to disk as it happens, so even a crash leaves a
full record of how it got there.

## Why it is built this way

It has a predecessor, Loki, which clicked around applications completely at
random, with no fixed starting point and no checks. Over several dozen runs
against a large, mature application it found one real defect. The lesson drawn
was that pure randomness was the problem, so Phileas starts each Route from a
known place and varies only what comes after, and checks the application after
every step rather than waiting for something to crash.

Two further choices matter to anyone deciding whether to rely on it:

- **It needs no list of what an application contains.** It finds buttons,
  fields and menus by reading the screen, so it works on an application
  nobody has described to it. A team can add a partial description later to
  help it along, but never has to.
- **It never blocks anyone's work.** An unlucky run could otherwise stop an
  unrelated change from shipping. It runs on demand or on a schedule and
  reports loudly; the existing scripted tests stay the gate.

## Where it stands

Started on 2026-09-20. The build is planned in eleven phases, 0 to 10, and
phases 0 through 4 are done:

- It launches an application, keeps its windows out of the way, and travels
  through it, choosing each step from a seed and recording every one.
- Any run can be replayed exactly from its seed, and that is tested.
- A command runs it with different settings, prints each step live if asked,
  and prints any finished run for a person to read.
- Three hundred and forty-four automated tests cover the engine itself, run against a
  small application built for the purpose, and a demo application shows it at
  work.
- Six checks run after every step: no uncaught error, no console error, still
  responding, still showing something, no unexpected dialog, and no error in
  a log the application names. A bug already filed is recorded and traveled
  past rather than ending every run it appears in.

**It judges some things, not all.** Two of the checks that apply to every
application are not built yet, and most of the checks an application adds
for itself are phase 6.

**On real applications.** On Positron it found four candidate bugs, all
written up. On RStudio Desktop it found three new bugs, each an error logged
with nothing wrong on screen: closing a terminal, which RStudio's developers
have since submitted a fix for, refreshing an empty Find in Files pane, and
installing a database driver package from the New Connection dialog. It
also found one RStudio already knew about. Along the way, each
application taught the engine something about surviving it: a dialog drawn
by the operating system, an application that restarts itself, a computer
going to sleep mid-run.

## What comes next

- **Phase 5:** the rest of the checks that apply to every application, such
  as no navigation away and every control labeled, after the Positron trial
  settles how much they are worth.
- **Phases 6 to 8:** checks an application adds for itself, a readable report
  of each run, and proof that it works: a test application with deliberately
  planted bugs, and a run that must find every one.
- **Phase 9:** the first real applications. Two smaller in-house applications,
  and Positron and RStudio, which work has already started on.
- **Phase 10:** the optional description of an application mentioned above.

## Honest limits

- **Its own tests show that its parts work, not that it finds bugs.** That
  evidence comes in phase 8, from the planted bugs.
- **Some screens are hard for it.** Content drawn as a picture rather than as
  ordinary controls, such as a code editor's text area, gives it little to
  act on. That was measured on real applications, and it is the main thing
  the two code editors will test.
- **Randomness finds some things and not others.** A bug that is consistently
  wrong in the same way everywhere passes checks that only compare the
  application with itself. Catching those needs an application to supply
  independently worked-out answers, which phase 6 allows for.
- **Deciding what a finding means is still a person's job.** It finds a
  problem, records exactly how it got there, and recognizes it next time, but
  whether it is a bug, a known one, or normal for the application is decided
  by someone reading it.
