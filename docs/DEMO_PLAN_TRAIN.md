# Demo plan: Rail Itinerary, a train travel planner

A plan for a demonstration of Phileas at work, written for review before
anything is built. Named for its application, since more demos are expected.

## Purpose

To show a person what Phileas does, on a screen, in a few minutes: it travels
through an application it was never told about, chooses each move from what
the screen offers, writes down every move and what it did, and can retrace a
run exactly from its seed.

**What it cannot show yet.** Phileas judges nothing until phase 5, when the
checks arrive. Until then a demo shows exploring, not finding. So the demo is
built in two stages, and the second waits on phase 5.

## Where it lives

`demo/rail-itinerary/`, committed in this repository, beside `testbed/` and
apart from it. The two have different jobs: `testbed/` is what the engine's own
tests run against, and its behavior is recorded as a baseline; a demo is
changed for an audience. Keeping them apart means a demo change can never move
what the tests measure.

Laid out the way `buggy` is, since that is the reference consumer:

```
demo/rail-itinerary/
  main.cjs, preload.cjs, renderer/   the application
  data/                              stations, timetable and fares, as JSON
  package.json                       packages the application
  phileas/                           adapter, journey, spec, global setup, config
  watch.mjs                          the per-hop log for a watched run
```

Packaged like `buggy`, with the bundle id `com.drugstoresushi.railitinerary`
and the same copyright notice in its package metadata.

## The application

A small planner for travel by train. Chosen for the project's theme, and
because its screens naturally hold what later stages need: lists with counts,
totals computed from rows, forms, and a search.

**Screens**, each reached by a named button in a top bar:

- **Itineraries.** A list of itineraries with a heading counting them ("3
  itineraries"). Each opens its legs. A button adds one.
- **Itinerary.** Its legs, one row each: from, to, train, departure and
  arrival, class. Beneath them, a fare total. Buttons to add a leg, remove a
  leg, and go back.
- **Add a leg.** A form: from and to as native station dropdowns, a date
  field, a time field, a class dropdown (standard, first, sleeper), and Save
  and Cancel.
- **Timetable.** A search box over the day's trains, with a heading counting
  the matches and a Clear button.
- **About.** A heading and one outbound link, for the rail network's site.

**Data** ships as JSON in `data/`: a dozen stations, a day's timetable of
thirty or so trains, and a fare table by class. Fares are computed from the
data rather than written into the screen, which is what gives a specified
check in phase 6 an independent source of truth.

**No Phileas terms in the application.** A train planner reaches naturally
for the words Phileas already uses: Journey, Route, Trip and Hop. A person
watching a demo where a Route's Trip clicks "Add a trip" cannot tell the
engine's terms from the application's, so the application uses none of them,
in its screens, its data or its code. It plans itineraries made of legs, and
names a leg by its end stations. The Fix is left alone as well.

**Designed for discovery,** since the point is to watch Phileas find its way
with nothing handed to it:

- Every control is an ordinary element with a role and a readable name, so
  the survey finds all of them.
- Some buttons print their shortcuts in their names, such as "Save (⌘S)" and
  "Search timetable (⌘F)", and the page handles those keys itself, so the
  keyboard work has something to press.
- The native menu holds the standard entries, and the adapter excludes Quit,
  the clipboard entries and the outbound link, as `buggy`'s does.

## Stage one: exploring, now

**The watched run.** One command runs a Journey with the window brought
forward and a pause after each Hop, so a person can follow it:
`PHILEAS_SHOW=front` and `PHILEAS_HOP_DELAY_MS` at about 800. A few Routes of
about twenty Hops each, a fixed seed by default so the demo is the same every
time, and an easy way to pass another.

**The per-hop log.** Beside the window, `watch.mjs` follows the run's journal
as it is written and prints one plain line per Hop: its number, what it acted
on and how, the value typed or key pressed, and what changed on screen, from
the Hop's recorded effect. For example:

```
hop 4   click   button "Timetable"      + 31 trains   - Itineraries
hop 5   type    searchbox "Search"  "Carpet"   changed, no heading moved
hop 6   press   ArrowUp                 no change
```

**This log belongs to the demo, not the engine.** R30, a journal a person can
read, is phase 7's, built into the report. The demo's log is a few dozen lines
reading the journal format as it stands, and must not grow into a second
reader that phase 7 would then have to reconcile with.

**Replay, shown.** The demo ends by running one Route again from its seed and
showing its lines match the first run's, hop for hop.

**What stage one shows:** discovery by role with nothing handed over, the
seeded choice among controls and keys, typing and key presses, the effect of
each Hop, a Route stranding if it reaches a dead end, and exact replay.

## Stage two: finding bugs, after phase 5

Once phase 5 ships the universal checks, bugs are planted in Rail Itinerary,
visible ones a watcher can see happen, each found by a check and reported
with the seed that replays it. Candidates, each tied to the check that would
catch it:

| Bug | Caught by |
| --- | --- |
| Choosing the sleeper class throws an uncaught error | uncaught error (phase 5) |
| Removing the last leg blanks the window | window showing content (phase 5) |
| An icon-only "seating chart" button with no name | named controls (phase 5) |
| The seating chart opens a dialog with no way out | stranding (phase 5) |
| "Book on the operator's site" leaves the application | no navigation away (phase 5) |
| The fare total leaves out the last leg | structural check (phase 6) |
| Clearing the timetable search does not bring every train back | metamorphic check (phase 6) |
| A first-class fare is wrong the same way every time | specified check (phase 6) |

Planted bugs are switched on by a setting, so the same application can be
shown working and then broken, and so stage one stays available.

**What stage two shows:** a finding, the Hop it happened at, the seed that
reproduces it, and a replay that walks straight back to it.

## Open

- **The application's name.** "Rail Itinerary" is a working name.
- **How much styling.** Enough to read well on a projector; how much beyond
  that is undecided.
- **Whether stage two's bugs switch on together or one at a time.** One at a
  time reads better in a demo; together is closer to phase 8's measure.
- **Where the modal question lands.** `OUTSTANDING.md` 1.11 asks whether a
  dialog hides the controls behind it from the survey. The seating-chart
  dialog in stage two depends on the answer.

## Build order for stage one

1. The application and its data, packaged, with a staleness-guarded adapter.
2. The Journey and its one-command watched run.
3. The per-hop log.
4. A short script for presenting it, in this file or beside the application.
