# Phileas -- what has landed, and why

Work that is done, with the reasoning and the measurements behind each piece
of it.

**Nothing here needs reading to start work.** It is the record, not the brief.
`../ORIENTATION.md` is short on purpose and says what a session needs;
`OUTSTANDING.md` is what has not been settled; `DEFECTS.md` is what is wrong.

**What belongs here:** a change that shipped, a bug that was closed, a
measurement that settled an argument, and a decision taken with the reasoning
that produced it.

**What does not:** anything still open, which belongs in `OUTSTANDING.md`, and
anything a session needs in order to run the software, which belongs in
`../ORIENTATION.md`.

**An entry here should stand on its own.** `OUTSTANDING.md` is a moving
target: its items are renumbered when neighbors close and deleted outright
when they are settled. Name what the question was, not where it was filed.

**Most of what follows is reasoning rather than shipped code**, because almost
nothing is built. The design decisions below each cost a real argument, and
re-deriving them would cost it again.

---

## 2026-09-21: the build plan was written, and corrected two documents

Writing the build order against the code that is to be lifted turned up two
things neither the requirements nor the open-items list had right.

**Two dependencies were missing from the list of what to install.**
`@types/node`, which the existing `tsconfig.json` already names, and
`@electron/asar`, which the staleness guard imports to read the packaged
archive. Nothing in this repository mentions the second one; it surfaces only
when the guard's own source arrives, which is why counting dependencies from
the current repository alone produced a short list.

**The staleness requirement described a weaker check than the code performs.**
It was written as refusing a build "older" than its sources and naming the file
that is "newer", which is a timestamp comparison. The lifted guard compares
content and names every file that differs, in either direction. The
requirement was corrected to match the stronger behavior rather than the code
being relaxed to match the requirement.

Both were found by reading the code that is being extracted, not by reasoning
about it. The build order could not be written without opening those files, and
opening them is what produced the corrections.

## 2026-09-21: scoped to Electron, with the door left open

Three options were weighed: Electron only, any application a browser-automation
tool can drive, or Electron named as the supported target while the seam stays
capable of more. The third was chosen.

**The deciding argument was about the built-in checks, not about effort.** The
tier that ships with the engine and assumes nothing about the application is
the product's whole value. Scoping to two kinds of target shrinks that tier to
what both share, or makes it conditional: checking that the application's main
process is alive has no equivalent in a browser. Weakening it to serve a target
nobody would run was the worse trade, given one team testing one application.

The cost accepted: the adapter seam gets its shape from one kind of target, and
the second adapter is what would discover where that shape is wrong.

Checked during the decision rather than assumed: a fork of a large Electron
editor is inside this scope, since it is an Electron application, and the
existing interface already carries an override for a different packaging
layout. What makes such an application hard is discovery on a virtualized,
custom-rendered surface, and that difficulty is identical under every scope
option. It also produces console errors in normal operation, which is the
origin of the requirement that an application be able to narrow a built-in
check and have the report say so.

## 2026-09-21: the eight-document set was created

The repository previously held one markdown file. The design state lived in a
session handoff document outside the repository, which is ephemeral by
construction and was about to be the only copy.

The structure is the eight-document pattern: three files in the root and five
under `docs/`, each stating its own role and pointing at the others rather
than summarizing them. `PRODUCT_REQUIREMENTS.md` was deliberately left as a
role-stating stub rather than drafted, because it is being worked through
directly rather than written ahead.

## 2026-09-21: measured what already exists to be lifted

A sibling Electron project's Playwright suite holds the launch and bundle
layer this engine needs, written to be extracted. Counted rather than
estimated:

| | Lines | Files |
| --- | --- | --- |
| The reusable kit, which becomes this repository's `src/` | 613 | 7 |

Its `app-under-test.ts` is 54 lines and already defines the `AppUnderTest`
interface, covering the product name, the repository root, the packaged
inputs that drive the staleness guard, a readiness hook, launch arguments and
whether an uncaught renderer exception fails the test. Its header comment
states outright that the directory is meant to be lifted into a shared package
that sibling apps consume, each supplying its own implementation.

**This corrected a plan to write that interface from scratch.** It had been
recorded as the highest-value next step on the understanding that nothing
existed. The work is extraction and hardening, and the existing interface has
nothing about the traversal exclusion list that the engine now requires.

What is not there: nothing in that kit walks an application. No traversal, no
seeding, no journal, no invariant machinery. Those are genuinely unwritten.

## 2026-09-21: the repository was published, private, after a full scan

`ronplusron/phileas`, private, matching the four sibling repositories. Squash
merging was switched off after creation, since `gh repo create` leaves it on
and it contradicts the rebase convention.

The pre-publication scan covered the working tree and all history under three
rulesets plus a dataflow tool, with a canary planted for each pass. Everything
returned zero across 8 tracked files and 1 commit, with commits-scanned
checked against the commit count so the zero could not come from an empty
range.

**One pass reported a false clean and was caught by its control.** A grep
sweep across the tracked files was written with an unquoted file list
containing newlines, so the shell handed the whole list to grep as a single
filename. Every category returned "none", which looked exactly like a clean
result. The positive control -- searching for a string known to be present --
also returned zero, which is what exposed it. Rerun with `git grep`, the
controls returned 2 hits and 1 hit and the sweep was genuinely clean. An
absence check without a positive control produces a zero that cannot be
distinguished from a broken search.

## 2026-09-20: the Route is the test, not the Journey

Claimed early in the design session that the Journey maps to a Playwright
test. That was wrong and was corrected after challenge.

The Route is the test. It is the unit that carries a verdict, a fixture scope,
a timeout boundary, a retry unit and a trace boundary. Under the wrong
mapping, ten traversals would share one verdict and one trace, and one failure
would take the other nine with it.

The rest follows: Journey is the run and holds the seed, the route count, the
hop budget and the deadline; Fix is `beforeEach`; Hop is `test.step`, so hops
nest in the trace without each becoming a separate pass or fail.

## 2026-09-20: per-Route seeds, derived and split in two

Two decisions, both about reproducibility, both expensive to retrofit.

**Derive each Route's seed from the Journey seed** as
`hash(journeySeed, routeIndex)` rather than drawing every Route from one
shared stream. A shared stream makes route 7 reproducible only by replaying
routes 1 through 6, which reintroduces exactly the inter-route dependence the
design removes -- and does it silently, because every route still passes.

**Split each Route's seed into a Fix stream and a traversal stream.** Sharing
one stream means editing a Fix later shifts every subsequent draw, so recorded
failing seeds stop reproducing. A recorded seed that no longer reproduces is
worse than no recording, because it reads as a bug that got fixed.

## 2026-09-20: the Fix runs per Route and is never cached

Decided explicitly against caching it for speed. Stated close to verbatim:
keep the fixes running per route, saving ten seconds is not worth losing the
functionality.

**The stronger argument arrived after the decision and is the one to keep.**
Running the Fix fresh is not merely a way to reach a clean state -- it IS the
independence guarantee. A cached Fix means route 5 begins from whatever route
4 left behind, every route still reports green, and the failures it hides are
precisely the state-leakage bugs the engine exists to find. Caching also
forecloses different Fixes per Route, which was raised as a wanted future
option.

Settled alongside it: a failed Fix reports as a distinct finding from a failed
Route. Ten Routes failing on one broken precondition is one bug, not ten.

## 2026-09-20: planner-assigned route bias was proposed and declined

Proposed as a way to spread coverage across a Journey, then dropped for two
reasons. The second is the stronger one.

**It is interference, not learning.** Nothing has run at the moment the bias
is assigned, so it is stratified sampling. It was described as adaptive
learning during the session, which was wrong and was named as interference.

**The problem it solves is negligible, measured rather than assumed.** With
eight buttons and ten routes, roughly four pairs collide on the first hop, and
each colliding pair diverges with probability 7/8 on the next. The duplicated
prefixes come to a handful of hops out of about 400.

Ten independent unbiased random walks is the decision, revisited only if
measurement later shows real clustering.

## 2026-09-20: the ceiling of metamorphic testing was conceded

Raised as a challenge against the design and accepted rather than argued
around. If a bug is consistent, every metamorphic relation passes: 42 before,
42 after, the round-trip holds, and the answer is still wrong.

Metamorphic testing buys self-consistency, not correctness. It catches state
leakage, incomplete resets, drift on repeat and stale caches. A uniformly
wrong implementation walks straight through it.

This is why accuracy checking needs an independent oracle, and why the oracle
must not share logic with what it judges. Sharing a data loader is acceptable.
Sharing the computation means the bug exists identically on both sides, both
agree, and the test passes while the screen lies.

Recorded as an honest limit rather than a defect, and belongs in
`PRODUCT_REQUIREMENTS.md` as a non-goal. `DEFECTS.md` explains why filing it
as a fault would be the wrong call.

## 2026-09-20: naming settled, and one name parked

**Phileas, not Fogg.** "Fog" reads as obscurity, which is wrong for a tool
built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

Names are taken from *Around the World in Eighty Days* only where one
genuinely fits. Fix is Detective Fix and was already in the original
specification by coincidence. Passepartout is reserved for the traveler
module, kept in mind rather than implemented. Journey, Route and Hop are plain
travel words and stay that way.

**Wager was parked rather than rejected**, on a request to hold on to it in
case it proves useful. It failed a use-it-in-a-sentence test: "a journey of 10
routes" reads, "a journey for which the wager was 10 routes" does not, and is
inaccurate besides.

## 2026-09-20: directory naming, after one reversal

`kit` and `app` were judged non-standard, and `app` actively harmful because
it collides with "the application" -- it caused a misreading during the
session itself.

Settled: the engine is a package, `@drugstoresushi/phileas`, consumed from
`node_modules`. A consuming repository gets one directory named for the tool,
following the `cypress/` and `.storybook/` precedent, holding `adapter/`,
`journeys/` and `journey.spec.ts`. The repository's own `tests/` keeps
Playwright's default meaning and stays the scripted suite.

**This was reversed once and then restored.** Naming the consumer directory
`phileas/` while the package is also phileas was presented in a tree that made
it look as though the adapter had moved inside the engine. The name was backed
away from on that basis, then reinstated once the `cypress/` precedent was
recognized as the standard it is. The presentation was the problem, not the
name.

## 2026-09-20: the scaffold was committed

Commit `e11a61c`, the root commit: `package.json`, `tsconfig.json`,
`.gitignore`, a README fixing the Journey/Route/Fix/Hop vocabulary, and empty
directories. No dependencies and no engine code.

`tsconfig.json` is strict with `noUncheckedIndexedAccess` on, which is not
tidiness: a traversal engine indexes into arrays of discovered elements
constantly, and that flag forces the empty-survey case to be handled rather
than crashing on a route that found nothing to do.
