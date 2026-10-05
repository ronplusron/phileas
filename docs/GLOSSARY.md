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
| Fix | The fixed opening of every Route: a script of Fix steps, written in advance by the Journey's author and the same every time. Each step is one call of `step()`, which names its kind: `act` on a target as `phileas survey` prints it, or `code` with Playwright code. A consumer keeps each in `phileas/fixes/`, listed by name in `fixes/index.ts` with `defineFixes`; the Journey's terms name the one it opens with, `--fix` chooses another for one run, and each Route's journal records its name and a fingerprint of its source. |
| Trip | The unpredictable rest of a Route after its Fix. A Route with no Fix is all Trip. |
| Semirandom | A known start and an unpredictable continuation: what a Fix followed by a Trip makes a Route. A Route with no Fix is random instead. |
| Hop | One jump of the Trip: one interaction with the application, drawn from the seed and made by the Route. Numbered from 1. Also called a Trip hop. A Fix has steps, not Hops. |
| Fix step | One step of a Fix's script: `{ kind: 'act', target, value? }`, performed the way a Trip hop is, or `{ kind: 'code', label, action }`, which runs whatever the author wrote. Each is settled after, checked, and journaled as its own line, which since 2026-10-03 records its kind, an `act` step's target as data and any value, and a `code` step's source text with a hash of it. Numbered from 1 within the Fix. Called a fix hop, and journaled as `fix-hop`, before 2026-09-29. |
| Trip length | How many Hops each Route's Trip takes, as `tripLength`; Fix steps don't count. A Route is meant to complete its Trip, and one that doesn't strands. |
| Journey deadline | How long, in clock time, the whole Journey may run, as `journeyDeadlineMs`. Optional, with no limit when unset, which is the common case. When it passes, finished Routes are reported, the running one is cut off, and the rest never start. |
| Route deadline | How long, in clock time, one Route may run, as `routeDeadlineMs`. Optional, with no limit when unset. A Route that reaches it is cut off. |
| Planner | The for-loop in a Journey's spec file that registers one Playwright test per Route. It decides how many Routes there are, and must never decide what they explore. |
| Passed / failed / stranded | A Route's three outcomes. Stranded means it ran out of moves before completing its Trip, or that every Hop it attempted was abandoned; that is neither a pass nor a failure. In the journal it is its own outcome; until phase 5 gives Playwright a way to show it, a stranded Route's test fails, with the reason. |
| Surveyed | What a Route reports when `PHILEAS_SURVEY=1` asked only for a survey. Not a pass, so a Journey run with the variable left over cannot read green. |

## Choosing a move

| Term | Meaning |
|---|---|
| Page | The contents of the application's window, which Electron draws as a web page. The native menu is not part of it. |
| Control | Something in the page a person can operate, such as a button, text box, tab, checkbox or link, known by its accessibility role and name, as in `button "New File"`. It exists whether or not the engine is looking. A native menu entry and a key are not controls, though either can be a candidate. |
| Survey | Finding what the page offers right now by reading its controls' accessibility roles and names, plus the native menu. Nobody lists an application's controls for it. While a modal dialog is open, native or marked `aria-modal`, only the dialog is read. Covered and hidden controls are left out. |
| Candidate | One thing a Hop could act on: a visible, enabled control with an accessible name, a menu entry, or a key. |
| Covered | A control something else is drawn over at the point a click would land, such as another window or an open menu. Left out of the pool, since a click on it would land on what covers it, and recorded on the pool with what covers it. Text boxes count too. A control scrolled out of sight, in the window or inside a pane, is not covered, since the click scrolls it into view. A text box under a layer of its own widget is layered rather than covered. |
| Layered | A text box with something on top of it that sits inside the text box's own parent, such as the content layer RStudio's code editor lays over its real text box, where a click reaches it. Kept in the pool, unlike a covered one, and recorded on it with what lies on top, since keeping it rests on how the page is built. |
| Hidden | A control the application has put inside a container that clips what it holds and has no area, such as an RStudio pane another pane has been zoomed over, so no person can see it (R32); or a control with no area of its own and no label that shows. Left out of the pool and recorded on it with what hides it, as a covered control is. A control scrolled out of sight inside a pane with room in it is not hidden, since scrolling brings it into view. |
| Labeled | A control with no area of its own whose label shows, such as the radio buttons Positron draws as cards in New Folder from Template, each a native input 0 by 0 inside its label. Kept in the pool, with a click sent to the label as a person's would be, and recorded on it with that label. Covered when its label is. |
| Common keys | Enter, Escape, Tab and the four arrows, offered on every Hop and pressed on whatever has focus. Together they get an eighth of the draw whenever anything else is on offer, or what the adapter sets as `keyShare`, and they never keep a Route from stranding. They are withheld while an excluded control has focus. |
| Printed shortcut | A shortcut shown in a control's accessible name, such as ⌘S in "Save current document (⌘S)", offered as a key to press and drawn with the controls. Excluded whenever its control is. Offered when its control is covered, since a key needs no clear spot to land on, except when every control printing it is covered by a dialog, which takes the keys; it is then recorded as covered. Native menu accelerators are not offered, since a key sent through Playwright never reaches one. |
| Exclusion list | What a Route must never touch, such as Quit or outbound links, supplied by the adapter. A safety rail, not a map. |
| Exclusion group | A named part of the exclusion list, with why it is left out, that a run can let back in with `--allow`, such as Positron's `new-windows`. Excluded by default; what the adapter excludes outside any group stays out whatever a run allows. Each Route's opening journal line records the groups let in. |
| Standard menu entry | A menu entry Electron builds from a role, such as Quit, Undo, Zoom In or Bring All to Front, as opposed to one the application's own authors wrote. Skipped by default; an adapter allows a role back with `allowStandardMenuRoles`. |
| Map | What someone who knows the application can hand the engine about it, full or partial. Never required; discovery covers whatever it leaves out (R29). *Planned, phase 10*; what an entry does is still open. |
| Menu source | The entries of the menu bar as candidates, offered in every window mode, standard entries skipped by default. A menu hop hands its handler the Route's window, as a person's click would. Together they get an eighth of the draw, or what the adapter sets as `menuShare`, and they never keep a Route from stranding, since the menu bar is on offer on every screen. An in-app menu built in the page is page controls, and native popup menus are not reached. |
| Pool | The candidates at one moment, after exclusions and covered and hidden controls are left out. The draw is made over it, and the journal writes each distinct pool once, with the covered and hidden controls, the layered text boxes and the labeled controls, where there were any. |
| Chooser | The named seam that picks a target from the pool. Today it's always the seeded draw. |
| Draw | The number from the seeded stream that picked the target, recorded as a raw 32-bit integer. Each Hop takes a share draw deciding between the common keys, the menu bar and the page, then a draw picking within that side; on the menu bar, since 2026-10-03, one draw per level instead, a top menu first and then an item within it, recorded as `menuDraws`. |
| Target | What a Hop acted on, or tried to: one candidate, chosen by the draw on a Trip hop or by name in a Fix's `act` step. So a target can be a control, a menu entry or a key, and a control is a target only in the action that picked it. An `act` step takes a target as the survey prints it. |
| Action | What was done to the target: `click`, `type`, `press`, `select`, `focus` or `menu-click`. `type` empties a field and presses one key per character; it replaced `fill`, which set a value without pressing keys and appears only in older journals. `press` presses one key on whatever has focus. In a native dropdown, `select` chooses an option without opening the list, and `focus` reaches the dropdown itself, since clicking it opens a list the engine cannot use. While a native dropdown has focus, the arrows and Enter are withheld, since on macOS they open its list on the real screen. |
| Value | The text a `type` put in, or a `fill` in older journals, from a second seam separate from the chooser. |
| Settle | What the page does when it stops changing after a Hop. The engine waits for it, up to a limit, by reading the page until it has stayed unchanged for a quiet window: 400 ms by default, which an adapter can change with `settleQuietMs`. |

## Seeds and replay

| Term | Meaning |
|---|---|
| Journey seed | The one seed a run is defined by, settled once before any Route starts. `phileas run --seed`, or `PHILEAS_SEED`, replays it, and wins over a seed pinned in the Journey file. |
| Route seed | Derived from the Journey seed and the Route's number, so any Route can be replayed on its own. Routes are numbered from 1, in the seed as everywhere else. |
| Fix stream / Trip stream | Two separate seeded streams of numbers per Route, so editing the Fix never shifts the Trip's draws. |
| Replay | Retracing a recorded Route. From the journal, `phileas replay <journal>`, since 2026-10-04: each Hop acts on its recorded target by name in place of drawing, so a changed application or another machine does not send it elsewhere, and it ends reproduced, not reproduced, or could not replay, never a plain pass. A Hop recorded as abandoned whose target is not on offer is skipped in its place, since it did nothing then either, and journaled as abandoned again. From the seed, re-running it with `--seed`, which retraces only the same build. A longer Trip retraces a shorter one's Hops and then carries on. Since 2026-09-24 the window mode no longer changes what is offered, though a replay across modes has not been measured. The hop delay changes nothing. |

## Recording

| Term | Meaning |
|---|---|
| Journal | One file per Route, at `<root>/<journey seed>/<run>/`, where only the root is the consumer's, one JSON object per line, flushed to disk as each is written so it survives a crash. Includes one entry per Hop. Made for the engine and for replay; a person reads it through `phileas run --follow` or `phileas show`, one line per Hop (R30). |
| Line kinds | `route` (the opening line), `pool`, `fix-step` (written `fix-hop` before 2026-09-29, and read as `fix-step`), `trip-hop`, `note` (such as the menu being unavailable, which only a launch path with no main process would cause), `outcome` (the closing line, absent if the Route died). |
| Effect | What a Hop did to the screen: whether anything changed, and which headings appeared and went away (R31), recorded on every Fix step and Trip hop. An effect that could not be read says so rather than claiming nothing changed. |
| Abandoned | A trip hop whose action timed out. It's still recorded, and the Route continues. Where a click timed out because something was drawn over its target, the journal names what took it, as `interceptedBy`. A replay's skipped Hop is abandoned too, its reason beginning "replayed as recorded". |

## Checking (phase 5 onward)

| Term | Meaning |
|---|---|
| Check | A test of the application run after every Hop and every Fix step. The first failure ends the Route. Each Hop's journal line records every check as passed, failed, or not run with the reason, so a check that did not run never reads as one that passed. |
| Universal checks | Checks that assume nothing about the application: no uncaught error, no console error, still responding, still showing something, no navigation away, no unexpected dialog, every control named, and no error in a log the adapter names, which does not run where it names none; a log line counts as an error when it holds a word ending in "error", or fatal, failed, failure, exception or panic, or matches that log's own `failsOn` pattern, read past a stack frame at its start, so a frame is part of the error above it and never one of its own. The console check sets aside one line the engine's own trace makes, `TRACE_SNAPSHOT_IN_SANDBOX`. The requirements call this tier **implicit** (R17). No navigation away and every control named are not built yet. |
| Planted defect | A fault built into a proving-ground application on purpose, each switched on by its own launch flag, such as `buggy`'s `--buggy-plant=dialog`, so that a check can be shown to fire. Off by default, so the application stays the unbroken baseline. |
| Structural check | Two things on the page agreeing with each other, such as a count matching its list (R18), declared by the adapter. Pulled forward from phase 6 for the Positron trial. |
| Metamorphic check | The application agreeing with itself over time, such as search then clear restoring the list (R20). Phase 6. |
| Specified check, or oracle | An expected result computed independently of the application and compared against what the page shows (R21). It must never share logic with what it judges. |
| Probe hop | A Hop the engine takes itself to test a relation, such as clearing a search it just made, marked as such in the journal. *Planned, phase 6.* |
| Positive control | Running a check against something known to be there before trusting a check that found nothing, since a broken check also finds nothing. |
| Narrowing | An adapter switching off or loosening one universal check for its own application, with a required reason that reaches the report (R19). For what is normal for that application; a known bug is a known finding instead. |
| Finding | One violation a check saw, named by its signature and a short id taken from it, with when it arrived: when the engine saw it, or for a log line the two reads it was written between and the log's own time where the adapter reads one. Each Hop's journal line lists the findings of each check. A check reads what arrived since it last ran, so the Hop it runs after is not always the one that caused it; a failure says which step was running when the finding arrived and lists the steps before it, and each Hop's line says how far into that Hop, or how long before it, its finding arrived. What the stubs caught carries the same times. |
| Signature | A finding with what varies from run to run taken out: temporary folders, timestamps, process ids, durations and Hop numbers, a stack frame's position, an id made fresh each time, a UUID or eight or more hex digits standing alone, which becomes `<id>`, the name of the user running it, which becomes `<user>`, and whatever the adapter names in `varyingInSignatures`, applied first. Two runs of the same bug share one; a message worded differently is a different finding. When the rules change, a Route matches stored entries under the new ones, and a Journey's end rewrites the file under them, merging entries that now agree. |
| Known finding | A finding held in the consumer's `known-findings.json`, in one of three states: filed with its issue, not yet filed, or a false alarm with its reason. A Route that meets one records it and carries on. A Journey adds what it found to the file, unfiled, when it ends, and never adds back one the file holds. `phileas known add` files one, `phileas known dismiss` marks one a false alarm, and `phileas known remove` takes one out, so it is reported as new if seen again. Every Route of a Journey reads the same file, which is written only when the Journey ends. |
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
| Proving ground | Applications built to be tested. `buggy` is the ordinary one, where defects are planted in later phases. |

## Settings

| Term | Meaning |
|---|---|
| `phileas` command | `phileas run [config] [flags]`: runs a Journey with its settings changed for that run only, without editing its file. Each flag travels to the run as one of the variables below. The config defaults to `phileas/`. `phileas show [what]` prints a finished run's journals, one line per Hop, and defaults to the latest run under `phileas/.phileas-journals/`. `phileas survey [config]` prints what the engine sees at the start and after the Fix, one candidate per line in the form a Fix's `act` step takes. `phileas known add <id> --issue <issue>` files a known finding, `phileas known dismiss <id> --reason <why>` marks one a false alarm, `phileas known remove <id>` takes one out, and `phileas known list` prints every one with when it was last met. Each `known` command reads `phileas/known-findings.json`, or `known-findings.json` in the folder it runs from where only that one is there. `phileas run` prints through the engine's reporter: each Route's ending from its journal, and a summary last. `phileas replay <journal> [config]` replays one Route from its journal. `phileas --version` prints the engine's version. |
| `PHILEAS_SEED` | Replays a Journey with a given seed. Set by `--seed`. |
| `PHILEAS_REPLAY` | The journal a Route replays from, in place of drawing, with `PHILEAS_REPLAY_WHOLE` and `PHILEAS_REPLAY_CURRENT_FIX` for `--whole` and `--with-current-fix`. Set by `phileas replay`, with the journal's seed and Route. |
| `PHILEAS_ROUTES`, `PHILEAS_TRIP_LENGTH`, `PHILEAS_ROUTE_DEADLINE_MS`, `PHILEAS_JOURNEY_DEADLINE_MS` | Override the Journey file's terms for one run, set by `--routes`, `--trip-length`, `--route-deadline-ms` and `--journey-deadline-ms`. Applied in `defineJourney`, checked like the file's own terms, and marked in the printout. |
| `PHILEAS_RUN` | The run's name, which `startJourney` in global setup sets fresh on every run, while printing every setting in force, and each Route reads to find its journal folder. Not set by hand: one left over in the environment is replaced. |
| `PHILEAS_SHOW` | `hidden` (default), `back` (shown behind: the application comes forward for a moment at launch and the engine hands the screen back to whatever was frontmost), `front` (shown and activated), or `top` (always on top). Set by `--show`. |
| `PHILEAS_HOP_DELAY_MS` | Pauses after each Hop, Fix steps included, and after each listing `phileas survey` prints, so a Route can be watched. It changes no draw. Set by `--hop-delay-ms`. |
| `PHILEAS_SURVEY` | `1` makes a Route print what it sees at its start, run its Fix printing each step, print what it sees after, and stop, with no Trip or journal. Set by `phileas survey`. |
| `PHILEAS_FOLLOW` | `1` prints each Route's journal as it is written, one line per Hop; `0` or unset, one line per Route. Changes no draw. Set by `--follow`. |
| `PHILEAS_ALLOW_STALE` | `1` runs against a build the staleness guard finds stale, and the printed settings say the guard is off. Anything but `1` or `0` is refused. |
| `PHILEAS_FIX` | Which of the consumer's Fixes every Route opens with for this run, by name, over the one the Journey names; `none` for no Fix. A name the consumer does not list is refused before anything launches. Set by `--fix`. |
| `PHILEAS_ALLOW_EXCLUDED` | The adapter's exclusion groups let back in for this run, by name, separated by commas. A name the adapter does not declare is refused before anything launches. Set by `--allow`. |
| `PHILEAS_ALLOW_TEMP_LEFTOVERS` | `1` skips the check that fails a run, or `npm test`, which left anything in its own folder in the system temp folder, and says what was left. |
| `PHILEAS_TEMP_FOLDER` | The run's own folder in the system temp folder, `phileas-<application>-<random>`, which `startJourney` in global setup makes and every Route's profile goes inside, so two runs at once never see each other's folders. Not set by hand: a profile asked for with it unset is refused by name. |
| `PHILEAS_REPORTER` | `1` when the engine's reporter prints the run, set by `phileas run` and not by hand: a followed failed Hop's line then leaves out what its checks saw, which the Route's ending says once. The Journey's end hands its known findings to the reporter only when the reporter is there, whatever this says. |
| `PHILEAS_APP_DIR` | Where the application's checkout is, for an adapter that lives outside it. Read through `requireAppDir()`, which refuses by name when it is unset or not a folder. |
