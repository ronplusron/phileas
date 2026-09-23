# Phileas

An exploratory testing engine for Electron apps: unscripted travel with
continuous invariant checking, seeded so that any failure replays exactly. It
ships as a package and is consumed by the application under test.

**The framework is the deliverable.** The first application it will be pointed
at is a vehicle for building it, not the point of it. Several commitments
below are only correct under that reading, and each says so where it applies.

`docs/PRODUCT_REQUIREMENTS.md` is what the product must do, stated apart from
how it gets built. Read it first: everything below is a means to something in
there, and a commitment that looks arbitrary here usually has its reason
there.

`ORIENTATION.md` is the brief for a session starting work. `docs/PLAN.md` is
the build order and the reasoning. `docs/OUTSTANDING.md` is what is open,
`docs/DEFECTS.md` is what is wrong, and `docs/HISTORY.md` is the record.
`docs/GLOSSARY.md` defines every term, and is the only place terms are defined.

## The Route is the test, not the Journey

The hierarchy maps onto Playwright in exactly one way, and getting it wrong
costs the whole reporting model:

| Phileas | Playwright | Why it has to be this one |
| --- | --- | --- |
| Journey | the run | Holds the seed, the route count, the Trip length, and the optional Journey and Route deadlines |
| Route | a test | The unit with a verdict, the fixture scope, the timeout boundary, the retry unit, the trace boundary |
| Fix | `beforeEach` | Anchors every Route's start. Defined once per Journey, applied at the start of each Route. Optional, and usually present |
| Hop | `test.step` | Hops nest in the trace without each becoming a separate pass or fail |

Journey was claimed to be the test early on and that was wrong. If the Journey
were the test, ten Routes would share one verdict, one timeout and one
trace, and a single failure would take the other nine with it.

## Routes are independent, and the seed is split two ways

All Routes in a Journey share one Fix and know nothing of each other. Two
consequences, both painful to retrofit once routes exist:

**Derive a per-Route seed from the Journey seed**, as
`routeSeed = hash(journeySeed, routeIndex)`. One shared PRNG stream would make
route 7 reproducible only by replaying routes 1 through 6, which reintroduces
exactly the dependence the design is built to avoid -- quietly, because
everything still passes.

**Split each Route's seed in two**, one for the Fix and one for the Trip.
Otherwise editing a Fix later shifts every subsequent draw, and routes that
used to fail stop reproducing. A recorded failing seed that no longer
reproduces is worse than no recording, because it reads as a fixed bug.

## Why a Fix exists at all

This engine has a predecessor. It was called Loki, and it was about breaking
things randomly: chaos and discord. It walked an application by invoking
commands at random, with no anchoring and no checks.

**It did not find much, and the diagnosis was that pure randomness was the
problem.** Late on, the idea arrived of anchoring the opening steps of a run
so that the unpredictable part started from somewhere known. Those were called
Anchors. Loki was not built to take them, so the engine was started again from
scratch, and Anchors became the Fix.

**So the Fix is not setup ceremony borrowed from a scripted suite. It is the
correction that made the second attempt different from the first,** and it is
what makes a Route **semirandom** rather than random: a known start, an
unpredictable continuation. That is also the reason the name fits. Fogg knew
where he was leaving from and when he had to be back, and nothing in between.

**A Journey with no Fix is still valid, and that is deliberate.** It is the
unanchored mode Loki was -- pure randomness, starting wherever the application
starts. It remains available on purpose and is why the Fix is optional at all.
It is simply the less interesting of the two, and the common case is that a
Fix is defined. Anyone reading the optional flag as a sign that the Fix is
peripheral has it backwards.

One measurement is worth carrying, from `docs/HISTORY.md`: unanchored and
unchecked, over several dozen runs against a large mature application, Loki
found one real defect. That is not nothing, and it is not much.

## Two commitments that read as performance wins and are not

Both look like obvious optimizations. Deleting either one removes a guarantee
rather than an inefficiency, so the reasoning is here at the point where
somebody would reach for the change.

**A Fix, where one is defined, runs at the start of every Route and is never
cached.** Running it fresh IS the independence guarantee, not merely a way of
getting a clean state. A cached Fix means route 5 begins from whatever route 4
left behind, every route still reports green, and the failures it hides are
precisely the state-leakage bugs this engine exists to find. Caching it also
forecloses different Fixes per Route, which was raised as a wanted option.
Decided explicitly, and worth quoting because the trade was weighed rather
than assumed: keep the fixes running per route, since saving ten seconds is
not worth losing the functionality.

**The journal flushes after every Hop, not at the end of the Route.** A crash
is exactly the case where end-of-test reporting never runs, and a crash is
exactly what this engine is hunting. Buffering the journal makes the record
disappear in the one situation it was written for. Each flush records the hop
index, what was chosen, what it could have been chosen from, and the invariant
results.

## A failed Fix is a distinct finding from a failed Route

Ten Routes failing on one broken precondition is one bug, not ten. If the Fix
and the Trip report through the same channel, a single broken setup
step looks like a catastrophic morning and buries whatever else was found.

## The planner is a for-loop, and must not become a component

Playwright collects tests before running them, so Routes have to be generated
up front from the seed. That is the only reason anything resembling a planner
exists. It derives seeds and registers tests, it lives in a collected spec
file, and it was judged explicitly not to deserve being a named component.

**Watch for it growing back.** The moment it starts deciding what gets
explored rather than how many Routes there are, it has become interference in
where Routes go, which `docs/OUTSTANDING.md` records as considered and declined.

## Invariants run after every Hop, and the first violation ends the Route

Run the whole set after every Hop until something is measured slow, rather
than sampling or staggering them. Stop the Route on the first violation
instead of continuing: hops 13 through 40 of a known-broken state produce
cascading noise that buries the one hop that mattered.

The tiers are in the README and in `docs/PRODUCT_REQUIREMENTS.md`. The
universal tier ships with the engine and assumes nothing about any app. One
of its checks does double duty: an element with no accessible name is both an
accessibility fault and something a Route cannot reliably hop to.

## A Route has three outcomes, and stranded is the third

Passed, failed, and **stranded**: the Route ran out of available moves before
completing its Trip. Stranded is reported separately and is never folded
into either of the others.

**It is not a failure**, because nothing has been shown to be wrong. A dead
end, an inescapable dialog and a trap all strand, and so does a perfectly
reasonable corner of the application with nothing further to do in it. Calling
it a failure asserts a defect the engine has not found, which is the mistake
the README made before this was settled. **It is not a pass either**, because
the Route did not do what was asked of it.

## Completing the Journey is itself an assertion

If `survey` returns nothing actionable at hop 23, the Route cannot complete its
Trip. No invariant catches that, because the page is structurally fine. A
Route that fails for not finishing means dead ends, inescapable modals and
traps get caught without a check written for any of them.

## A specified oracle never shares logic with what it judges

Accuracy checking needs an oracle that computes the expected answer from a
source of truth and compares it to the screen. Sharing the data loader with
the application is acceptable. **Sharing the logic under test is not:** a bug
then exists identically on both sides, both agree, the test passes, and the
screen lies.

**Independence is lost through maintenance more often than through
construction.** Building an oracle that imports the application's logic is the
obvious mistake and the easy one to catch. The likelier path is drift: the
application changes, the oracle disagrees, and somebody repairs the oracle by
looking at what the application now produces. At that moment it stops being
independent and starts agreeing with every future bug, and nothing about it
looks any different afterwards. When an oracle fails, the first question is
whether the expected answer changed, not how to make the oracle match.

The application under test never judges anything. The app-specific test code
does. An earlier phrasing, "the app supplies the judge", caused a real
misreading in the originating session because "app" was doing two jobs in one
sentence. Say "the adapter" or "the app-specific test code" and the ambiguity
disappears.

**The same trap sits one level down: prevention and detection must not share
their evidence.** Where something is both the mechanism that stops a thing
happening and the only proof that it did not happen, one silent failure takes
out both at once, and the result reads exactly like success. The measured case
is the stub that keeps a Route from opening a browser: its recorder is also
the only evidence none opened, so a stub that never took effect reports
identically to a Route that never left the application. `docs/DEFECTS.md`
carries that one. The rule it produced is general -- a check needs a source of
evidence that does not depend on the guard it is checking having worked.

## Choosing the next candidate is an interface, not a few lines in the loop

`route.ts` surveys, chooses, executes, journals and checks. **The choosing
step is a named seam taking the candidate list and a source of randomness and
returning one candidate**, even though today there is exactly one
implementation and it is a seeded draw.

This reads as ceremony around a single line and is not. It is what lets a
different chooser be added later without the hop loop being rewritten
around it, and `docs/OUTSTANDING.md` records what that later chooser is
expected to be. Inlining it is the specific change that turns a cheap addition
into an expensive one, so it is called out here at the point where someone
would reach for the simplification.

Generating an input value is a separate seam from choosing a control, for the
same reason and at lower stakes: a different value generator does not cost
seeded replay, because the control being acted on is still drawn from the
seed.

**Neither seam permits judgment inside the checks.** A Route ends at
the first violation, so a check whose verdict cannot be reproduced would end
Routes at random and make a red result not worth reading.

## Discovery is generic, with an adapter-supplied exclusion list

`survey` finds candidates by role: visible, enabled, and carrying an
accessible name. It does not consult an enumeration of the application's
controls. An adapter listing every control would be more precise and would
stop this being a framework, which is the trade the project exists to make.

What the adapter does supply is an exclusion list -- things that must never be
hopped to, such as Quit and outbound links. That list is a safety rail, not a
map.

**An exclusion is a name or a predicate, and names stay first-class.** A list
of names cannot express a control that is harmless many times and fatal once:
the measured case is a shortcut that closes an editor tab, and closes the
application once no tabs remain. So a predicate is available for what a list
cannot say. It is the exception rather than the shape, because only a list of
names can be derived from the application's source and checked against it,
which is what the section below is for. A predicate must be deterministic: the
exclusion list is an input to the seeded draw, so one that answered differently
on a replay would send every hop after it somewhere else.

## Source access is useful, and is how two declined decisions come back

Most deployment shapes give you the source, and several things depend on it:
the staleness guard needs it by definition, a test oracle usually needs the
application's own data to compute an expected answer from, and fault injection
needs to be able to corrupt something.

**One further use is worth taking deliberately.** The exclusion list can be
derived from the source rather than written by hand -- the quit handler, calls
that open something outside the application, outbound links -- and, more
importantly, *checked* against it. A hand-written list silently goes stale the
day upstream adds a new way out of the application. A derived one fails
instead, which is the difference between a guard and a note.

**Now the part that matters.** Source access makes both of the following
easier, cheaper and more tempting than they have ever been, and each is a
decision already taken and recorded as declined:

- **Reading the source to enumerate what can be hopped to.** It is precise, it
  is tractable, and it is the per-application enumeration that
  `docs/OUTSTANDING.md` records as declined, arriving by a route nobody
  recognizes as the same idea. `survey` finds candidates by role, from the
  running application, and consults no source.
- **Deriving checks from the implementation rather than from intent.** A
  structural check asserting that a heading's count matches what the code
  computes is a tautology: it passes whatever the code does, including when
  the code is wrong. This is the test oracle trap above, wearing different
  clothes, and the same rule settles it -- a check earns its place by knowing
  what *should* be true, never by restating what the code already does.

**An application's own automation bridge is the same boundary in a new
place.** Some applications expose one: a hook installed by a launch flag that
reports uncaught client exceptions, how many dialogs are showing, whether the
session is ready. Using it for checks is excellent and is exactly what an
adapter is for. But such a bridge usually also enumerates every command the
application has, and choosing hops from that list is the per-application map
declined above, arriving through a door that looks like instrumentation.
Invariants may read the bridge. `survey` may not.

The engine reads no source at run time, ever. Everything above that uses
source happens beforehand, in the adapter or in a build step, and produces
something the engine consumes without knowing where it came from.

## Exploratory runs never gate a push

An unlucky seed would block unrelated work, and a gate that fires on unrelated
work gets switched off. The scripted suite gates. Journeys run on demand or on
a schedule, and report loudly.

## The 60-30-10 ratio is a statement of weight, not a scheduler input

It describes where the product's testing weight sits. Do not implement it as
literal percentages anywhere. Contract validation runs after every Hop
regardless, so it does not share a denominator with the other two in the first
place.

## Naming

**Phileas, not Fogg.** "Fog" reads as obscurity, which is wrong for a tool
built to reveal things, and "Fogg" invites the one-g misspelling on every
install.

Names come from *Around the World in Eighty Days* only where one genuinely
fits, and are never forced:

- **Fix** is Detective Fix, and was already in the original specification by
  coincidence. It works because "fix" is also an ordinary English word meaning
  what the thing does, which is the test any further character name has to
  pass.
- **Journey**, **Route**, **Trip** and **Hop** are plain travel words and stay
  that way. The **Trip** is the part of a Route after its Fix: the unpredictable
  continuation, where each Hop is drawn from the seed. In a Journey with no Fix,
  a Route is all Trip. Avoid "trip" as a verb in this project, as in a check
  that trips; say fires or fails, so the noun stays unambiguous.
- **Passepartout** was reserved for the module that travels and has been dropped.
  `docs/HISTORY.md` records why. Watch for a place it genuinely fits rather
  than reinstating it as a label.

**The theme is fully spent, and that is deliberate.** Phileas names the
product, Journey and Route and Hop are plain words, and Fix does double duty.
A fourth reference buys atmosphere and costs legibility, which is what the
"never forced" rule above exists to prevent.

**The engine travels through an application.** It does not traverse one, which
would imply systematic coverage it does not attempt, and it does not walk one
as a countable noun, because that is what a Route is. Two usages follow from
that and are easy to get wrong: you **follow a Fix**, because a Fix is fixed in
advance, and you **retrace a Route** only on a replay, where it already exists.
A Route is otherwise what traveling produced, never a path laid out to be
followed.

**Call it the engine, not the tool.** "Tool" reads as a standalone utility
somebody runs; this is a component consumed by the application under test.

**Wager** was proposed for the terms of a Journey and is parked rather than
rejected. It failed a use-it-in-a-sentence test: "a journey of 10 routes"
reads, "a journey for which the wager was 10 routes" does not, and is
inaccurate besides. `docs/OUTSTANDING.md` holds it.

## Packaging, and what a consuming repository looks like

The engine is a package, `@drugstoresushi/phileas`, consumed from
`node_modules`. A consuming repository gets one directory named for the engine,
following the `cypress/` and `.storybook/` precedent:

```
phileas/
  adapter/            that application's AppUnderTest implementation
  journeys/           journey definitions
  journey.spec.ts     the spec Playwright collects
tests/                the scripted suite, keeping Playwright's default meaning
```

`kit` and `app` were both rejected as directory names. `app` is actively
harmful, because it collides with "the application" and caused a misreading in
the originating session.

**That layout assumes the adapter can live in the application's own
repository, and it is not the only shape.** Three exist, and which one applies
is a property of the application rather than of the engine:

- **In the application's repository**, as above. Available when the repository
  is yours, or when its maintainers accept the directory upstream.
- **Adapters in a repository of your own**, pointed at a checkout of the
  application that you build yourself. Available for any application whose
  source you can obtain, which includes every public repository. Everything
  works in this shape, including the staleness guard, because you built the
  thing you are testing -- which is also what lets you decide whether it is
  built hardened against automation, and the bullet below is what that
  decides.
- **Adapters in a repository of your own, pointed at an installed binary.**
  The only shape available for a closed-source application, and the only one
  where how the application was built is somebody else's choice. The
  staleness guard cannot run at all, because there are no sources to compare
  against, and a test oracle is usually out of reach for the same reason.
  **Whether anything else is lost depends on the release rather than on the
  shape.** Where it allows the ordinary launch path, traveling and the
  universal checks all work, since they observe a running process. Where it
  ships hardened, the engine gets in over the debugging protocol instead, and
  that reaches the part of the application that draws the screen and not the
  process behind it: stubbing outbound links, keeping windows off the screen,
  checking that process is alive and reaching native menus all go with it,
  and the checks that rest on them read green while checking nothing.
  `docs/HISTORY.md` has the measurement and `docs/PLAN.md` carries it as a
  hazard.

**A build you made is not the artifact a user installs.** Signing, packaging
flags and bundled runtimes can all differ. Testing your own build of somebody
else's application answers a slightly different question than testing their
release, and a finding should say which one it came from.

## The stack, and why each piece

| Piece | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | The engine is consumed as a typed seam; `AppUnderTest` is the product's main surface and wants a compiler behind it |
| Runner | Playwright | Already drives Electron, and its test/step/fixture model is what Route/Hop/Fix map onto |
| Distribution | A package consumed from `node_modules` | Keeps engine and adapter separable; a copied directory would let them drift per consumer |
| Discovery | Accessibility roles | The only mechanism that works without an enumeration of each app's controls |

Rejected, and why, so neither returns as a fresh idea: a per-app enumeration
of controls, on the grounds that it is precise and is not a framework; and
planner-assigned route bias, on the grounds that it is interference rather
than learning and solves a negligible problem. `docs/OUTSTANDING.md` has the
numbers behind the second.

## Conventions

- An item leaves a document when it closes. It is not marked done in place,
  because `docs/HISTORY.md` is the record.
- Nothing is summarized across documents. Point at the other file and say to
  read it; a summary is a second copy, and the copy is what goes stale.
- **Phileas** is the engine, the traveler going on a Journey. **phileas** in
  lower case is only ever a package name, a repository name or a directory:
  `@drugstoresushi/phileas`, `ronplusron/phileas`, `phileas/` in a consuming
  repository. If a sentence could put "the engine" there instead, it takes
  the capital.
- ASCII only in git artifacts: commit messages, branch names, tags.
- American spelling: license, organization, behavior, analyze.
- Documents address whoever reads next. No personal names in prose, and no
  gendered pronouns for the reader. The copyright notice is an ownership
  claim and is the exception.
