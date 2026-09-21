# Phileas: product requirements

What the product does, from the side a person using it can see. It says
nothing about how any of it is built, so it stays true when that changes.

Requirements are numbered and marked Must, Should or Could. Each is written so
a finished build can be held up to it and answered yes or no.

Nothing described here is built. Where a requirement exists because something
specific went wrong, the failure is named, since those are the ones most
likely to be relaxed by someone who never saw it.

Terms used throughout:

- A **journey** is one run, made of several **routes**.
- A **route** is one pass through the application, made up of **hops**.
- A **hop** is one interaction.
- A **journal** is the record a route writes as it goes, one entry per hop.
- A **fix** anchors the start of every route: a fixed sequence of hops, chosen
  in advance and the same every time, putting the application into a known
  state before the unpredictable part begins. That anchoring is what makes a
  journey semirandom rather than random, and most journeys will define one. A
  journey without a fix is valid, and every route then starts from the
  application's own initial state.

A journey has three possible outcomes per route: passed, failed, or
**stranded**. Stranded means the route ran out of moves before reaching its
hop budget. It is reported and is worth investigating, but it is not by itself
a defect.

## 1. Problem

- A scripted test suite only checks the paths somebody thought to write down.
  The defects that reach users are mostly on the paths nobody imagined.
- Writing more scripted tests does not close that gap, because the gap is
  made of cases nobody has thought of yet.
- Exploratory testing finds them, because the tester decides what to try next
  from what is actually on screen rather than from a script written in
  advance.
- Done by hand it is slow, it is not repeatable, and what the tester did is
  usually lost by the time the bug is filed.
- Today a team either accepts the gap, or spends a person's time traveling
  through the application by hand and writing down what they can remember.

## 2. Users

One team, working on one application, sharing a test suite. Three distinct
jobs, which may be the same person on different days.

- **The person who wires it up.** Connects the engine to their application once:
  how to start it, how to tell it is ready, and what must never be touched.
  Wants that to be a small, stable piece of work rather than a running cost.
- **The person who runs a journey.** Starts a run, waits, and wants to know
  whether anything was found. Cares that a green run means something.
- **The person who triages a finding.** Often did not run the journey. Wants
  to reproduce the failure and understand how the application got into that
  state, without needing to ask whoever ran it.

## 3. Goals

- Do exploratory testing, automatically and unattended. The engine chooses each
  move from what the application is offering at that moment, which is what
  makes it exploratory rather than a suite of scripts somebody generated.
- Keep the two things hand exploration loses: repeatability, and a record of
  what was actually done.
- Find defects on paths nobody wrote a test for.
- Make every finding reproducible by someone who did not produce it.
- Report not just what broke, but the exact sequence that got there.
- Cost a team nothing when it finds nothing, so it can run often.
- Stay usable by a team that did not build it. [inferred: follows from
  publishing being an eventual goal, not stated directly]

## 4. Non-goals

- **Replacing the scripted suite.** This covers the paths nobody wrote down.
  Checking that the paths someone did write down still work is a different
  job, and both are wanted.
- **Judging whether the application computes the right answers.** Most of what
  the engine finds is that the application broke, or that it contradicts itself.
  Neither is the same as knowing the answer on screen is correct. An
  application can close that gap by supplying expected answers worked out
  independently, but without that the engine has no opinion on whether a number
  is right -- only on whether it is consistent.
- **Catching a defect that is consistently wrong, through relationships
  alone.** Checks that compare the application against itself before and after
  something buy self-consistency, not correctness. A result that is wrong the
  same way every time passes every one of them: the same wrong answer on both
  sides, so the relationship holds. This is a limit of that kind of check
  rather than a fault to fix, and it is the reason the independent answers
  above exist.
- **Testing applications that are not Electron, for now.** Widening beyond
  Electron is intended, and the design deliberately keeps the parts that would
  have to change in one place. It is a non-goal of this version rather than a
  permanent boundary: no other target is supported, and none is promised on a
  date.
- **Testing native desktop or mobile applications.** Applications built with
  platform-native interface toolkits cannot be traveled through by this engine
  at all, and no adapter will change that.
- **Using a language model for anything, in this version.** Every move is
  chosen by a seeded draw over what the application is offering, and every
  judgment is a check somebody wrote. This is a decision about this version
  rather than a permanent one, and it is deliberately reversible: what would
  otherwise make it expensive to reverse is R7 and R8, since a model choosing
  moves cannot replay from a seed. The journal already names what
  was chosen and what else was available at every hop, so a run made that way
  would replay from the record instead. Anything of the kind is a declared
  mode that the report names, never a default, and never inside the checks
  themselves: a check that ends a route on a judgment nobody can reproduce
  makes a red result untrustworthy, which costs more than the finding is
  worth.
- **Gating merges.** An unlucky run would block unrelated work, and a check
  that fires on unrelated work gets switched off.
- **Measuring performance.** Slowness is only treated as a failure where the
  application has stopped responding altogether.

## 5. Features

- **Unscripted traversal.** The engine decides its own next move from what the
  screen actually offers, rather than following a written path. Answers: the
  paths nobody thought to write down.
- **Seeded runs.** Every run is defined by a seed, so any run or any single
  route can be repeated exactly. Answers: exploratory testing by hand not
  being repeatable.
- **Continuous checking.** A set of checks runs after every hop, not at the
  end. Answers: knowing which interaction broke it rather than that something
  broke somewhere.
- **Built-in checks that assume nothing.** A set that applies to any
  application, available without writing anything. Answers: the setup cost
  that stops teams adopting this kind of tool.
- **Application-specific checks.** A team declares what is true of their own
  application: things that must agree on screen at the same moment, and things
  that must still hold after an operation and its reversal. Answers: the
  built-in set being necessarily shallow.
- **Independently computed answers.** A team can supply what the application
  ought to be showing, worked out separately from the code that produces it.
  Answers: a result that is wrong the same way every time, which no other
  check here catches.
- **A written record of the route.** Every hop is recorded as it happens: what
  was chosen, what else was available, and what the checks said. Answers: what
  the tester did being lost by the time the bug is filed.
- **A budget.** A run is bounded by a number of routes, a limit on hops per
  route, and a deadline. Answers: an unbounded route being unusable in
  practice.

## 6. User flows

**Wiring an application up, once**

1. State how to start the application and how to tell when it is ready.
2. List anything that must never be interacted with, such as a control that
   quits the application or a link that leaves it.
3. Run a journey with a small budget and confirm it travels through and reports.

**Running a journey**

1. Choose a seed, or let one be generated and recorded.
2. Start the run and wait for it to finish or hit its deadline.
3. Read the result: how many routes ran, how many passed, what was found.

**Triaging a finding somebody else produced**

1. Read the reported route, its seed, and the hop the failure happened at.
2. Read the journal to see how the application reached that state.
3. Re-run that one route from its seed and watch the failure happen again.

## 7. Requirements

### How a defect gets found

Five ways, differing in what each is capable of catching. The checks are also
called **invariants**, since each states something that should hold after
every hop. This subsection states no requirement of its own: each path is a
requirement below, named here so the shape is visible in one place. If one of
them changes, this list changes with it.

- **Checks needing no comparison (R17).** An uncaught error, or a window gone
  blank, is a defect on its own evidence. These ship with the engine and assume
  nothing about the application, and are called the **universal** checks.
- **Two things on screen agreeing with each other (R18).** A count in a
  heading against the rows beneath it. Catches a wrong answer without anyone
  having to know what the right answer was. These are the **structural**
  checks.
- **The application agreeing with itself over time (R20).** Search then clear,
  navigate away and back. Catches state that leaks, resets that do not
  reset, and drift on repetition. Known in testing literature as
  **metamorphic** checks, because they assert a relationship rather than a
  value. **This is the path with the limit stated in the non-goals:** a result
  that is wrong the same way every time satisfies every one of these.
- **An independently computed answer (R21).** The only path that judges
  whether what is displayed is right, rather than whether it is consistent.
  In the taxonomy below this is a **specified oracle**, or a **pseudo-oracle**
  where the expected answer comes from an independent implementation rather
  than a specification. Optional, and the remedy for the limit above.
- **Running out of moves (R5, R6).** A route that strands has found a dead
  end, a trap, or a corner with nothing further to do, without any check being
  written for it.

**The first four are test oracles**, in the established sense of a mechanism
that decides whether observed behavior is correct. The literature names the
kinds, and using its words rather than inventing more costs nothing:

| Path | Kind |
| --- | --- |
| Checks needing no comparison (R17) | **implicit** -- needs no specification, works on any application |
| Two things agreeing on screen (R18) | no clean standard name; called structural here |
| Agreeing with itself over time (R20) | **metamorphic**, a **partial** or **hybrid** oracle |
| An independently computed answer (R21) | **specified**, or a **pseudo-oracle** where it is an independent implementation |

Running out of moves is not an oracle. It is a liveness property: the route
could not continue, which says nothing about whether anything was correct.

**No collective noun is needed.** These are siblings that check different
things and never arbitrate with each other, so the ensemble and voting
vocabulary from elsewhere does not apply. Plainly, they are the **checks**,
and the runner runs all of them after every hop.

### Running a journey

- **R1 (Must)** A journey is defined by a seed, a number of routes, a maximum
  number of hops per route, and a deadline. Stating those four is enough to
  repeat the run.
- **R2 (Must)** Routes within a journey are independent. Re-running a single
  route on its own produces the same route it produced inside the full journey.
- **R3 (Must)** Where a fix is defined, it runs fresh at the start of every
  route rather than once per journey, so no route inherits the state the
  previous route left behind. A journey with no fix is valid, and every route
  then starts from the application's own initial state.
- **R4 (Must)** When the deadline passes, the journey stops and reports the
  routes that finished. Work already done is never discarded.
- **R5 (Should)** A route that runs out of available moves before reaching its
  hop budget is reported as stranded, naming the hop where it ran out.
  Stranded is its own outcome, distinct from both passed and failed: a dead
  end, an inescapable dialog and a trap are all found this way, and so is a
  perfectly reasonable corner of the application with nothing further to do in
  it. Calling it a failure would assert a defect the engine has not found.
- **R6 (Should)** A journey reports its stranded routes separately from its
  failures, with enough of the journal to tell the two causes apart.

### Findings and reproducing them

- **R7 (Must)** Every failure names one route and the seed that reproduces
  that route.
- **R8 (Must)** Re-running a reported seed against an unchanged application
  reproduces the same route, hop for hop. **A seed is only meaningful against
  the build it was recorded on.** A route is reproduced by drawing from the
  same candidates at each hop, so anything that changes what is on screen at
  hop 3 sends the draw elsewhere and every hop after it diverges. Findings
  from an older build cannot be re-run against a newer one, which is why the
  journal is the durable artifact and the seed is not.
- **R9 (Must)** The record of a route is readable after anything that ends the
  run abruptly, covering every hop completed up to that point. This covers the
  application crashing, the application hanging and being given up on, the run
  being stopped by hand or by its deadline, and the machine running it dying.
  It exists because an abrupt ending is exactly the case where end-of-run
  reporting never happens, and several of those endings are themselves the
  findings.
- **R10 (Must)** Each hop in the record states its position in the route, what
  was chosen, what else could have been chosen at that point, and the result
  of every check that ran.
- **R11 (Must)** A failure in the fix is reported as distinct from a failure
  found while traveling. Ten routes failing on one broken precondition is one
  problem, not ten, and the fix is fixed, so a failure in it says nothing
  about the route that was about to be traveled.
- **R12 (Should)** Someone who did not run the journey can reproduce a finding
  from the report alone, without asking whoever ran it.
- **R13 (Should)** A reported seed that no longer reproduces its route is
  flagged as such, rather than silently passing. A seed that stops reproducing
  reads as a fixed bug, which is worse than no record at all. This is also the
  only way anyone finds out that reproducibility itself has broken, whether
  from a change in how moves are chosen or from an edit to what the engine is
  allowed to touch, so it is not the optional extra it first appears to be.
- **R14 (Should)** When a seed no longer reproduces, the report says whether
  the application changed or the outcome did. Both look identical otherwise:
  the defect was fixed, or the interface moved and the route now goes
  somewhere else. The journal records what could have been chosen at each hop,
  so comparing that against what is available now answers it. Without this, a
  green re-run is unreadable, which is the same failure the requirement above
  exists to prevent, one level up.

### What gets checked

- **R15 (Must)** Checks run after every hop.
- **R16 (Must)** A route stops at the first failed check rather than
  continuing. Continuing produces cascading noise that buries the hop that
  mattered.
- **R17 (Must)** The engine ships with checks that assume nothing about the
  application: no uncaught error, no error written to the console, the
  application still responding, the window still showing content, no
  navigation away from the application, no unexpected dialog, and every
  visible control carrying a readable name.
- **R18 (Must)** An application can declare checks that two things visible at
  the same moment agree with each other: one view active at a time, a selected
  row matching the detail shown beside it, a displayed count matching what it
  counts. These are the checks that catch a wrong answer without needing to
  know what the right answer is.
- **R19 (Must)** An application can switch off or narrow any built-in check
  that does not apply to it, and the report states which were changed. An
  application that writes to the console in normal operation is otherwise
  unusable with this engine, and silently weakening the check for everyone is
  the wrong answer.
- **R20 (Should)** An application can declare relationships that compare two
  states: searching then clearing returns the original list, navigating away
  and back returns the same state, applying a filter twice equals applying it
  once.
- **R21 (Could)** An application can supply expected answers computed
  independently of the code being tested, and the engine compares them against
  what is displayed. Without this, a result that is consistently wrong is
  never caught.

### Setting it up

- **R22 (Must)** An application is connected by stating how to start it, how
  to tell it is ready, and what must never be interacted with.
- **R23 (Must)** A journey refuses to start when the packaged build does not
  match the sources it was built from, and names each file that differs.
  Comparison is by content rather than by timestamp, and reports a difference
  in either direction: a source edited after packaging and a build carrying
  something no longer in the sources are both reasons the results would
  describe an application nobody is running.
- **R24 (Should)** A setup that is wrong reports what is missing, rather than
  waiting and reporting that something did not appear. A timeout says nothing
  about why.

### Fitting into existing work

- **R25 (Must)** Failures appear in the team's existing test results,
  alongside the scripted suite's own.
- **R26 (Must)** Running a journey never blocks a merge or a push unless a
  team deliberately configures it to.
- **R27 (Should)** A journey that could not do what was asked of it says so
  rather than reporting success. A run where the application never launched,
  where every route stranded at the first hop, or where zero routes ran at all
  is not a green run, and a scheduled journey that quietly degrades to nothing
  is the failure this prevents. A setting makes any such degradation a
  failure, for runs where the absence of findings is meant to mean something.
- **R28 (Should)** A journey can be started on demand or on a schedule.

## 8. Constraints

Stated as what must be true for someone using it.

- **C1** Runs against a packaged build of the application rather than a
  development server. Ideally the same artifact a user would install, though a
  build made from source is the common case and is not identical to a release.
  Where the two differ, a finding should say which was tested.
- **C1a** The staleness guard in R23 needs the sources the build came from, so
  it works wherever those are available and cannot run at all against an
  installed binary alone. Everything else here works on any Electron
  application the engine can get all the way into, since it observes a running
  process rather than reading source.
- **C1b** A release can be built to refuse the ordinary way in. Such an
  application can still be traveled through, but only through a connection
  that reaches the part of it drawing the screen, so the checks that watch the
  process behind that screen are unavailable and the run says so rather than
  reporting them as passed. This is the application's choice rather than the
  engine's, and it is only forced on a run that has no sources to build from,
  since anyone building the application decides it for themselves.
- **C2** Slots into a team's existing browser-automation test run. A team not
  already running one has to adopt it first, which is a real cost of entry.
- **C3** Everything produced by a run -- results, journals -- stays
  on the machine that ran it. Nothing is sent anywhere.
- **C4** Private for now. No public release is promised, and nothing about it
  is stable for outside consumers yet. [inferred: publishing is an eventual
  goal, so this constraint has an expiry]
- **C5** Runs unattended. Nothing takes over the screen and nothing waits for
  a person.

## 9. Edge cases and failure states

- **The route runs out of moves.** Reported as stranded, naming the hop it
  stopped at. Not a pass, because the route did not do what was asked of it,
  and not a failure, because nothing has been shown to be wrong.
- **The application ends abruptly mid-route.** Whether it crashed, was killed,
  or the run was stopped, the record of that route up to that point survives
  and is readable.
- **The application stops responding.** Treated as a failure of that route
  after a stated wait, not as a run that hangs forever.
- **A dialog cannot be dismissed.** Shows up as stranded, since nothing else
  is reachable. Worth investigating precisely because a user would be stuck
  there too.
- **Nothing is found.** A journey that finds nothing reports what it traveled
  through -- how many routes, how many hops, what was checked -- so a green
  result can be told apart from a run that did nothing.
- **A seed no longer reproduces.** Stated plainly in the report rather than
  passing quietly, and distinguishing a fixed defect from a changed interface.
- **The application changed since the finding was recorded.** Older seeds stop
  replaying. The journals stay readable, so what happened can still be read
  even where it can no longer be re-run.
- **The build is stale.** The run refuses to start rather than testing
  yesterday's application and reporting on today's.

## 10. Success measures

- Every deliberately planted defect in the bundled example application is
  found by a journey. This is the measure that matters: a tool that finds bugs
  cannot be validated by its own tests passing.
- At least one real defect is found in a real application that the scripted
  suite did not catch. [inferred: nobody has agreed a target]
- A finding can be reproduced by a second person from the report alone.
- A green journey is trusted enough to be run regularly rather than once.
  [inferred]

## 11. Open questions

- **What kinds of fault does it deliberately introduce?** Breaking things on
  purpose is wanted, and which kinds apply depends on what the applications
  under test are. Deciding this against one application will be wrong for the
  next.
- **How long are journals kept, and by whom?** Nobody has said.
  Relevant because a record names what a run did, and runs may be frequent.
- **What does a journey do when it finds the same defect on several routes?**
  Reporting it five times and reporting it once are both defensible and
  nobody has chosen.
- **Who decides the budget for a scheduled run?** A deadline that is too short
  finds nothing and still reports green.
- **Should a journey report what it never reached?** Nobody has weighed this.
  Where the application's source is available, what exists can be enumerated,
  and the journals record what was reached, so the engine could report that two
  hundred routes never once entered a particular view. That is not coverage as
  a guarantee, which is a stated non-goal, but it is the only way to tell
  exploring apart from circling the same corner. It would be the first thing
  here that needs the application's source rather than just its running
  process.

## 12. Assumptions

- The application behaves the same way twice given the same inputs, and does
  not change between the run and the replay. A seed replays a route only while
  both hold, which is why the journal exists alongside the seed rather than
  being redundant with it.
- The application's controls carry readable names. A control without one
  cannot be reliably hopped to, which is why the engine treats a missing name as
  a failure rather than working around it.
- The team already runs an automated browser-based test suite. [inferred from
  the constraint above, not stated]
- One application at a time. Nothing here assumes a journey spans two
  applications or that two journeys run at once.
