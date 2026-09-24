# Phileas -- glossary

Every term the engine, its journal and its documents use, grouped by what it
belongs to. **This is the one place terms are defined**; other documents point
here rather than defining them again, because a second copy is the one that
goes stale. Anything decided but not built yet is marked *planned*; later
phases are marked by number.

## The run

| Term | Meaning |
|---|---|
| Journey | One run of the engine, defined by a seed, a number of Routes, a Trip length, and optionally a Journey deadline and a Route deadline. |
| Route | One pass through the application, and one Playwright test with its own verdict, deadline and trace. Routes know nothing of each other. |
| Fix | The fixed opening of every Route: a sequence of fix hops, written in advance by the Journey's author and the same every time. |
| Trip | The unpredictable rest of a Route after its Fix. A Route with no Fix is all Trip. |
| Semirandom | A known start and an unpredictable continuation: what a Fix followed by a Trip makes a Route. A Route with no Fix is random instead. |
| Hop | One interaction with the application. Numbered from 1 within the Fix and within the Trip separately. |
| Fix hop | A Hop of the Fix. |
| Trip hop | A Hop of the Trip, drawn from the seed. |
| Trip length | How many Hops each Route's Trip takes, as `tripLength`; fix hops don't count. A Route is meant to complete its Trip, and one that doesn't strands. |
| Journey deadline | How long, in clock time, the whole Journey may run, as `journeyDeadlineMs`. Optional, with no limit when unset, which is the common case. When it passes, finished Routes are reported, the running one is cut off, and the rest never start. |
| Route deadline | How long, in clock time, one Route may run, as `routeDeadlineMs`. Optional, with no limit when unset. A Route that reaches it is cut off. |
| Planner | The for-loop in a Journey's spec file that registers one Playwright test per Route. It decides how many Routes there are, and must never decide what they explore. |
| Passed / failed / stranded | A Route's three outcomes. Stranded means it ran out of moves before completing its Trip; that is neither a pass nor a failure. |

## Choosing a move

| Term | Meaning |
|---|---|
| Page | The contents of the application's window, which Electron draws as a web page. The native menu is not part of it. |
| Survey | Finding what the page offers right now by reading its controls' accessibility roles and names, plus the native menu. Nobody lists an application's controls for it. |
| Candidate | One thing a Hop could act on: a visible, enabled control with an accessible name, or a menu entry. |
| Exclusion list | What a Route must never touch, such as Quit or outbound links, supplied by the adapter. A safety rail, not a map. |
| Map | What someone who knows the application can hand the engine about it, full or partial. Never required; discovery covers whatever it leaves out (R29). *Planned, phase 10*; what an entry does is still open. |
| Menu source | Menu entries as candidates. Withheld when no window has focus, because a menu click would then do nothing while reporting success. |
| Pool | The candidates at one moment, after exclusions. The draw is made over it, and the journal writes each distinct pool once. |
| Chooser | The named seam that picks a target from the pool. Today it's always the seeded draw. |
| Draw | The number from the seeded stream that picked the target, recorded as a raw 32-bit integer. |
| Target | What a Hop acted on, or tried to. |
| Action | What was done to the target: `click`, `fill`, `select`, `focus` or `menu-click`, with `press` planned, and `type` planned to replace `fill`. `fill` sets a value without pressing keys; `type` presses one key per character. In a native dropdown, `select` chooses an option without opening the list, and `focus` reaches the dropdown itself, since clicking it opens a list the engine cannot use. |
| Value | The text a `fill` put in, or a `type` once it replaces `fill`, from a second seam separate from the chooser. |
| Settle | What the page does when it stops changing after a Hop. The engine waits for it, up to a limit, by reading the page until it has stayed unchanged for a quiet window: 400 ms by default, which an adapter can change with `settleQuietMs`. |

## Seeds and replay

| Term | Meaning |
|---|---|
| Journey seed | The one seed a run is defined by, settled once before any Route starts. Setting `PHILEAS_SEED` replays it. |
| Route seed | Derived from the Journey seed and the Route's index, so any Route can be replayed on its own. |
| Fix stream / Trip stream | Two separate seeded streams of numbers per Route, so editing the Fix never shifts the Trip's draws. |
| Replay | Re-running a recorded seed to retrace a Route hop for hop. Only meaningful against the same build and the same window mode: a shown run offers menu entries a hidden one withholds, so one seed takes different routes. The hop delay changes nothing. |

## Recording

| Term | Meaning |
|---|---|
| Journal | One file per Route, in a folder per run under the Journey seed, one JSON object per line, flushed to disk as each is written so it survives a crash. Includes one entry per Hop. Made for the engine and for replay; a person reads it through the phase 7 report (R30). |
| Line kinds | `route` (the opening line), `pool`, `fix-hop`, `trip-hop`, `note` (such as the menu being withheld), `outcome` (the closing line, absent if the Route died). |
| Effect | What a Hop did to the screen: whether anything changed, and which headings appeared and went away (R31). *Planned, before phase 5.* |
| Abandoned | A trip hop whose action timed out. It's still recorded, and the Route continues. |

## Checking (phase 5 onward)

| Term | Meaning |
|---|---|
| Check | A test of the application run after every Hop, fix hops included. The first failure ends the Route. |
| Universal checks | Checks that assume nothing about the application: no uncaught error, still responding, still showing something, no navigation away, every control named. The requirements call this tier **implicit** (R17). |
| Structural check | Two things on the page agreeing with each other, such as a count matching its list (R18). Phase 6. |
| Metamorphic check | The application agreeing with itself over time, such as search then clear restoring the list (R20). Phase 6. |
| Specified check, or oracle | An expected result computed independently of the application and compared against what the page shows (R21). It must never share logic with what it judges. |
| Probe hop | A Hop the engine takes itself to test a relation, such as clearing a search it just made, marked as such in the journal. *Planned, phase 6.* |
| Positive control | Running a check against something known to be there before trusting a check that found nothing, since a broken check also finds nothing. |
| Narrowing | An adapter switching off or loosening one universal check for its own application, with a required reason that reaches the report (R19). |
| Fix failure | A broken Fix step, reported apart from a failed Route, since ten Routes failing on one broken step is one problem (R11). |

## Setup

| Term | Meaning |
|---|---|
| Journey's author | Whoever defines a Journey: its settings and its Fix. |
| Application under test | The application a Journey travels through. |
| Consumer | A repository that uses the engine as a package, with its own adapter and Journeys. `buggy` is the reference one. |
| Deployment shape | Where an adapter lives relative to the application: in the application's own repository, in a repository of its own beside a checkout someone builds, or beside an installed binary. `CLAUDE.md` has what each one loses. |
| Adapter | The application-specific code implementing `AppUnderTest`: how to launch, how to tell it's ready, what to exclude. It judges nothing itself. |
| Staleness guard | Refuses to run when a file in the packaged build differs in content from the source it was built from, naming each file (R23). Without source it can't run at all, and the run says so. |
| Testbed | Applications built to be tested. `buggy` is the ordinary one, where defects are planted in later phases. |

## Settings

| Term | Meaning |
|---|---|
| `PHILEAS_SEED` | Replays a Journey with a given seed. |
| `PHILEAS_RUN` | The run's name, which global setup sets fresh on every run and each Route reads to find its journal folder. Not set by hand: one left over in the environment is replaced. |
| `PHILEAS_SHOW` | `hidden` (default), `back` (shown behind), `front` (shown and activated), or `top` (always on top). |
| `PHILEAS_HOP_DELAY_MS` | Pauses after each Hop so a Route can be watched. It changes no draw. |
| `PHILEAS_APP_DIR` | Where the application's checkout is, for an adapter that lives outside it. Read through `requireAppDir()`, which refuses by name when it is unset or not a folder. |
| `PHILEAS_ALLOW_STALE` | Runs even when the staleness guard finds a mismatch, and the run says the guard was overridden. |
