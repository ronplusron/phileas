# Demo plan: Eighty Days, a game of going round the world

A plan for a second demonstration of Phileas at work, written for review
before anything is built. Named for its application, as the first was. It
follows the shape of `DEMO_PLAN_TRAIN.md`, and where the two demos differ
this file says why.

## Purpose

The rail demo shows exploring: a Journey through an application the engine
was never told about, every move written down, and exact replay. It was
planned when the engine judged nothing, and it says so.

This demo shows more, in three ways, each decided 2026-09-27:

- **A richer application**, with more kinds of controls and more screens, so
  the exploration itself has more to find. The rail demo offers buttons,
  text fields, native dropdowns, menu entries and keys. This one offers
  thirteen roles on the page, plus the native menu and the keys.
- **A game rather than a form.** Asked, of the first draft of this plan,
  whether it would be "just going to be buying tickets and itineraries like
  the train demo or something more interesting", and then, of the answer:
  "yes, rewrite the plan around the game. No randomness." So every Route
  plays a race round the world and meets a fate, and a watcher sees three
  Routes of one Journey win, lose, and wander, each from its seed.
- **Finding bugs.** Six universal checks exist since 2026-09-26, and known
  findings since 2026-09-27. So a bug can be planted, found by a Journey,
  reported with the seed that replays it, filed as known, and traveled past
  on the next run. That whole loop is what the rail demo could not show.

It lives beside the rail demo rather than replacing it. The rail demo stays
the short first look; this one is the longer sitting.

## Where it lives

`demo/eighty-days/`, committed beside `demo/rail-itinerary/`, laid out the
same way, for the reasons that plan gives:

```
demo/eighty-days/
  main.cjs, preload.cjs, renderer/   the application
  data/                              places, departures, events, as JSON
  renderer/engravings/               the 1873 engravings, with CREDITS.md
  package.json                       packages the application
  phileas/                           adapter, journeys, spec, global setup, config
  watch.mjs                          the watched run
  present.mjs, PRESENTING.md         the guided demo, and its script
```

Bundle id `com.drugstoresushi.eightydays`, with the same copyright notice in
its package metadata. Root scripts `demo:eighty-days` for the watched run and
`demo:eighty-days:present` for the guided demo, and the rail demo's
`demo:present` renamed `demo:train:present` to match, as settled in review
below.

**The guided demo is kept**, decided 2026-09-27 when asked whether it was
needed: "Let's keep it." It earns more here than in the rail demo, since
stage two's sections depend on values from the ones before them: the run
folder, the finding id `phileas known add` takes, and whether a pinned seed
still reached its bug, which it reads from the section's own run.

**What is shared with the rail demo, and what is not.** `present.mjs` there
is 467 lines, most of it a runner: print a command, wait for Enter, run it,
compare two journals. Copying it makes two runners that drift. So, decided
in review below: lift the runner into `demo/presenting.mjs`, one file both
demos call with their own sections, done as the first step of building this
one. Named apart from the two demos' own `present.mjs` files so three files
do not share a name. The rail demo's sections do not change.

**The runner was not shareable as it stood**, and the lift made it so. It
hardcoded the rail demo's config folder, journals folder and title, and
stripped only `PHILEAS_*` and `RAIL_DEMO_JOURNEY` from the environment before
each command. The first three became what a demo passes in, and the
variables stripped became a list of prefixes: `PHILEAS_`, `RAIL_DEMO_`, and
`EIGHTY_DAYS_`. The last matters most. A leftover `EIGHTY_DAYS_PLANT` in the
presenter's shell would switch a bug on in a section meant to show the game
working, and nothing on screen would say why.

## The game

A race round the world, eastward from London, against the Reform Club's
wager. The player makes Fogg's choices: which steamer, whether to buy an
elephant, whether to wait for a ship or charter one. The book's events
happen where they happened in the book, and whether each goes well depends
on what was chosen before it. The game ends at the Reform Club, won or
lost, or earlier, lost, when the purse runs dry or the Detective's warrant
holds.

Chosen because it is the project's namesake; because four modes of travel
give screens that each hold different controls without looking contrived;
and because the novel ends on a computed date being wrong by one day, which
is the shape of bug a specified check exists to find.

### The rule the game is built around: nothing is random

**Every event follows from where Fogg is, the date, and what was chosen.**
Nothing is drawn from `Math.random`, the wall clock, or anything else that
differs between two runs. The engine's replay rests on the application
answering the same moves the same way: a Passepartout who went missing on a
coin flip would make one seed play two games, and the replay that retraces
a failing Route would retrace a different one.

**Nothing happens on a timer either.** The Carnatic leaves when the game's
clock passes its hour, and the game's clock moves only when the player acts.
A ship that left after five real seconds would leave at a different Hop
depending on `--hop-delay-ms`, and the hop delay is recorded as changing
nothing. It would also keep the page changing between Hops, which the settle
wait reads as a page still moving.

**A check enforces it rather than this paragraph.** A test in the demo
plays the same moves twice, in two launches, and compares every screen's
text; a second plays a Trip at two hop delays and compares the same. Both
are written before the first event is, per the standing rule that a rule
worth writing down gets the check that fails when it is broken. They live in
`demo/eighty-days/tests/determinism.spec.ts`, beside two tests of the
comparison itself, which run against the rail demo: one finds no difference
between two launches, and one finds a difference planted before a chosen
Hop. **Once the game exists, a `coin-flip` plant joins them**: one event
decided by `Math.random`, switched on by its flag, which the two game tests
must fail on. It is the control that shows the tests catch randomness in the
game itself, and not only a note planted from outside.

### The people, and the words the game uses

**No Phileas terms in the application.** The rail plan's rule, and it bites
harder here, since the novel is where the engine's names came from. The
game calls Fogg's whole undertaking **the circuit**, and one stretch by one
mode **a passage**. It never says Journey, Route, Trip, Hop, Fix, or Map,
in its screens, its data or its code, and it never says **stranded**
either, since that is one of a Route's three outcomes: a game lost to an
empty purse says Fogg is "without funds at Yokohama".

**The book's own names are in, decided 2026-09-27:** "Include Kiouni. We
can even include Passepartout and Fogg. Even The Reform Club and the
wager." And then: "You can include Detective instead of Detective Fix, and
also Aouda." So the traveler is Fogg, by surname, with Passepartout as his
servant; Aouda joins in the forest before Allahabad, if she is rescued; the
elephant is Kiouni; the man following with a warrant is **the Detective**,
never named, since his name is the engine's Fix; and the wager is the Reform
Club's, £20,000 on eighty days. **"Phileas"** stays out, since it is the
engine's name: the traveler is Fogg and never Phileas Fogg, or a watcher
hears the engine named inside the application it is exploring. **On
"wager":** `OUTSTANDING.md` 2.3 holds the word parked as a possible name for
a Journey's terms, and that stays parked; if it is ever adopted, the
application's use of it is the collision to resolve then, and this
paragraph is where to find it.

**The clock starts at 8:45 in the evening of 2 October 1872**, decided the
same day, the moment Fogg leaves the Reform Club, and the wager is won at the
same hour on 21 December. Both are checked against the book's text when they
go into `data/`, as every date and figure taken from the book is.

### How it plays

**The state is small and all of it shows.** Where Fogg is, the date and
hour, what is left in the carpet-bag, who travels with him (Passepartout,
Aouda), whether Kiouni is his, and how close the Detective is. Every part
of it is on the screen somewhere, which is what lets a watcher follow a
Route and lets a check in phase 6 read it.

**Places.** Two kinds, kept apart in `data/` and never confused:

- **The book's stops**, in its order: London, Suez (by way of Brindisi),
  Aden, Bombay, Kholby, Allahabad, Calcutta, Singapore, Hong Kong,
  Shanghai, Yokohama, San Francisco, Salt Lake City, Fort Kearney, Omaha,
  New York, Queenstown, Liverpool, and London again. Checked against the
  text when they go in, like every fact from the book.
- **The game's own alternatives**, invented for play and marked as
  invented in `data/`: a plausible 1872 steamer, line or stopover that the
  book's Fogg did not take. Each is reached only by a choice that leaves
  the book's path, and each is added only where it gives a Quay a real
  choice, per the rule on how much of the book goes in.

A Route that follows the book's choices draws the book's line on the
chart; one that takes an alternative draws a line the book never drew,
which is what makes three Routes side by side worth watching. Even on the
book's path, two Routes differ in what they did at each place, which the
venues below are for.

### Wide at every step, not a corridor

**Decided 2026-09-27, in the words it was put:** "It's important that there
be multiple controls so that Phileas isn't just traveling through a fairly
predictable path." A game round the world has a risk built into it: the
circuit runs one way, and a screen offering only "Take the Mongolia" and
"Wait" makes every Route the same Route with different pauses. By default
the page gets three quarters of the draw, drawn evenly among its controls,
and the keys and the native menu an eighth each (`DEFAULT_KEY_SHARE` and
`DEFAULT_MENU_SHARE` in `src/route.ts`).
So how wide each page is decides how different two Routes can be. So:

- **Every place is several venues, as tabs**: the Telegraph Office, the
  Market, the Consulate, the Hotel, and whatever the place adds, such as the
  temple at Bombay or the tavern at Hong Kong. Each venue has several
  controls of different roles. Tabs are how the survey gets its `tab` role,
  on every screen rather than on the sledge alone. **The ways on are not a
  tab.** They stand above the tabs at every place, with what the place
  itself offers, such as Kiouni for sale or the sledge, so that choosing a
  venue never hides the departures. Built first with the Quay as one tab
  among the others, and measured: a Route on any other tab could not
  travel until it drew its way back, which it rarely did.
- **Each venue's controls do something the game remembers.** Taking a
  fur coat at the Market matters on the plains of Nebraska; a visa stamped at
  the Consulate matters when the Detective reaches Suez; hours spent at the
  Hotel move the clock and can miss a sailing; a telegram sent from the
  Telegraph Office changes how close the Detective is at Liverpool. A
  control that changed nothing would widen the pool and add only "no
  change" lines, which is width a watcher can see through.
- **What is on offer depends on what came before.** Things taken at a
  market appear later as controls of their own ("Hand round the fur coats",
  "Give Kiouni a lump of sugar"), Passepartout brings his own ("Send
  Passepartout with the passport", "Let Passepartout drink with the
  stranger") only while he travels with Fogg, and a departure missed is
  gone. So the pool at Yokohama differs between two
  Routes that reached it differently, and the survey lines say so.
- **Every screen is reachable at any time** from the top bar and the menu:
  Circuit, Ledger, Bradshaw and About. **Each opens as a panel beside the
  place, not instead of it.** Wandering off to read the Ledger mid-port is
  a real path a Route can take, and one a scripted test never would, and
  it costs one Hop rather than a detour. Built first as screens that
  replaced the place, and measured: in three Routes of sixty Hops from
  London, not one Route left London.
- **The ticket office is the one narrowing**, since a native modal hides
  what is behind it, and it is kept brief and still holds several
  controls: berths, cabin, a note for the purser, Book and Cancel.

**A floor, measured from the journals:** every place offers at least a
dozen page candidates across at least four roles before the menu and the keys,
and no screen outside a dialog offers fewer than eight. `phileas survey`
cannot measure this, since it prints only the screen a Route starts on and the
one after its Fix (the survey-only branch of `runRoute`, `src/route.ts`). So
the counts come from the pools the balance batch's journals record, read with
`phileas show`. A printed shortcut is drawn as a candidate of its own beside
its control (`printedShortcut`, `src/survey.ts`), so "Book (⌘B)" counts twice
and is counted that way. The measured counts go into `HISTORY.md` with the
balance numbers below, and a screen under the floor is widened rather than
excused.

**Each place is one screen**, headed by its engraving, with what is
happening there, its venues, and the ways to leave. Two to four departures,
each with its days shown before it is taken: a faster ship
that sails tomorrow, a slower one that sails tonight, a train that reaches
only as far as the line is built, a wait for the next sailing. Every
departure is named for itself, such as "Sail on the Carnatic" or "Wait for
the Rangoon", never a shared "Book" or "Take", since a Fix step acts on the
first control whose name matches and says nothing about a second
(`OUTSTANDING.md` 2.7).

### Money, only where the book spends it

**Decided 2026-09-27:** "avoid money if possible. But if it would help or
enhance, we can include it." Time is the game's one running measure: every
choice is weighed in days and hours, and tickets, goods and hotels carry no
price. Money appears only where the book makes a purchase into an event,
and there it earns its place:

- **The wager itself**, £20,000 with the Reform Club, which is what the
  game is about.
- **The carpet-bag**, the £20,000 Fogg carries, drawn on only for the
  book's big purchases: Kiouni at Kholby, the Parsee guide, bail at
  Calcutta, the Tankadere at Hong Kong, the Henrietta at New York. So
  every use of money is a choice a watcher can see, and overpaying early
  can leave Fogg unable to buy the Henrietta later, which is one way to
  lose.
- **The offer for Kiouni**, made by clicking: "Offer £1,000" to open, then
  "Raise by £200" and "Stand firm", with the offer and the owner's answer
  shown. The owner accepts at £2,000, so the offer never goes past it, and
  the `kiouni-throw` plant fires on the raise that reaches it.

**Why buttons and not a number field.** A Trip types only from a fixed
list of values: empty, "a", "travel", "Carpet", "0", two spaces, and two
hundred x's (`VALUE_CORPUS`, `src/route.ts`). So a Trip can never type
£2,500 into a field, and a control whose effect depends on a particular
number has to be reachable by clicking. This applies everywhere in the
game, not only to Kiouni: the Hotel's stay is a dropdown ("an hour", "a
night", "until the next sailing"), not a number of hours. The one number
field left is the ticket office's berths, where what a Trip types is
exactly the test: "0", "a" or empty is corrected by the clerk to the
party's size, with a message saying so, and the ticket is booked. It was
first refused until retyped, which measured as a trap: no value a Trip
types is a berth count, so a Route that typed into the field could never
book that ticket.

The Ledger shows the carpet-bag in one line under the days, and no check
rests on it: the structural and specified checks in stage two are about
days and dates.

**Events, from the book, each decided by earlier choices.** Written here
from memory of the book and adapted for play; each is checked against the
text when it goes into `data/`, and where the game departs from the book on
purpose, such as the bullock cart, the data says so.

- **Suez.** The Detective boards. Whether he learns where Fogg is bound
  depends on whether Passepartout was sent ashore for the passport visa.
- **Bombay.** Passepartout's visit to the temple on Malabar Hill, if he was
  let ashore, costs a day in court at Calcutta.
- **Kholby.** The railway is unfinished. Buy Kiouni, walk, or wait for a
  bullock cart, each with its days. Only the elephant passes the forest
  where Aouda is, and only with the Parsee guide hired.
- **Hong Kong.** The Carnatic's departure is brought forward. In the book
  the Detective drugs Passepartout at an opium house so he cannot tell
  Fogg; Passepartout sails on the Carnatic alone, and Fogg misses it. In
  the game, whether that happens depends on whether Passepartout was let
  go ashore with the Detective. If Fogg misses the Carnatic, charter the
  Tankadere to Shanghai for the steamer to Yokohama, or wait; Passepartout
  is found again at Yokohama only if Fogg goes there.
- **Plains of Nebraska.** The train is stopped. The sledge under sail from
  Fort Kearney to Omaha, or a wait for the next train.
- **New York.** The China has sailed. Take passage on the Henrietta, bound
  elsewhere, and turn her for Liverpool; when her coal runs out, buy her
  and burn her woodwork. She puts in at Queenstown, and the rest is by
  train and boat to Liverpool.
- **Liverpool.** The Detective's warrant. Its cost in hours depends on how
  close he is, which depends on the telegrams sent and choices made since
  Suez.
- **London.** The date line. Fogg arrives believing he is a day late. The
  last screen offers "Go to the Reform Club" anyway, and there the day
  gained by going eastward shows, and the wager is won or lost by the
  clock.

**It always has a way on.** Every ending, won or lost, offers "Set out again",
and a game lost midway offers it too. **Only an ending offers it.** The menu's
Game > Set out again is disabled until the game has ended, and a disabled
entry is never offered (`menuEntries`, `src/menu.ts`). Offered all the time,
it would take a share of the menu's eighth of the draw on every Hop, and over
a few hundred Hops a Route would be sent back to London several times, losing
its Fix's progress with it. A screen with no way on would strand every Route
that reached it, and would say something about the game rather than find a bug
in it. The one screen with no way out is the `bradshaw-trap` plant, on
purpose, and it strands rather than fails: see stage two.

### Screens

The current place is always on screen: its engraving, its events, its ways
on and its venues. A top bar opens a panel beside it:

- **Circuit.** The chart, and the passages so far as ticket stubs: mode,
  from, to, days, and a heading counting them ("8 passages, 79
  days"). Beneath them one disclosure, "Show Passepartout's diary", holding
  his lines for the whole circuit. It was one disclosure per passage, which
  measured as a pool that grew by one control with every passage.
- **Ledger.** The wager's terms at the head, then one ruled row for
  everything that cost time, in days and hours: each passage, and each
  wait, delay and stay, such as a night at the Hotel, the day in court at
  Calcutta or the hours lost to the warrant. Beneath them, the total
  against the eighty, and the arrival date counting the day gained
  eastward. Nothing moves the clock without a row, so the rows are the
  whole account of the time. Rows and total are on the one screen because
  a structural check reads one screen at a time (`PLAN.md`, phase 6), so
  the `sledge-days-missing` plant can be caught by comparing the total with
  its own rows. Beneath it all, one line for the carpet-bag.
- **Bradshaw.** The railway guide, as a tree: country, line, train. A
  search box over it, with a heading counting matches.
- **About.** A heading, the credits for the engravings, and one outbound
  link, for the book's text online, confirmed to resolve when it is written
  in and excluded by the adapter.

**Where the controls come from.** Thirteen roles on the page, each where the
game needs it, plus the native menu. `src/survey.ts` hops to sixteen, but
every native menu entry is offered as `menuitem` whatever its type (where
`src/survey.ts` builds its menu candidates), so `menuitemcheckbox` and
`menuitemradio` would need a menu built in the page, and the game has no
reason for one:

| Role | Where |
| --- | --- |
| button | departures, events, the top bar, "Set out again" |
| link | About, excluded |
| textbox | a telegram's message |
| searchbox | Bradshaw |
| combobox, option | a telegram's recipient; the class on a train; the stay at the Hotel |
| radio | the cabin on a steamer: saloon or second |
| checkbox | goods at the Market; "Take coal" when chartering the Henrietta |
| spinbutton | berths in the ticket office, where typed nonsense is refused |
| slider | Kiouni's pace; the wind under the sledge's sail; a Trip clicks a slider at its middle, and moves it further only with the arrow keys while it has focus (`act`, `src/route.ts`) |
| switch | hire the Parsee guide; hoist the sail |
| tab | every place's venues: Telegraph Office, Market, Consulate, Hotel, and the place's own |
| treeitem | Bradshaw's lines |
| menuitem | the game's own menu entries, the checkbox entry View > Show the clock included |

**The ticket office is a native modal dialog**, opened by any departure
that is taken: berths as a spinbutton, cabin as a radio group, a note for
the purser as a text field, and Book and Cancel. No price. Native for the
rail demo's reason: the survey reads only the dialog while it is open.

**The menu** has the standard entries, which the engine skips by default,
and the game's own: Game > Set out again, Consult Bradshaw, Export the
ledger; View > Show the chart, Show the Ledger, Show the clock. None opens
a native file dialog, which would hold the main process until a person
answered it: Export writes a text file into the Route's profile folder.

**Designed for discovery,** as the rail demo is: every control an ordinary
element with a role and a readable name; some buttons printing their
shortcuts in their names, such as "Book (⌘B)" and "Search Bradshaw (⌘F)",
with the page handling those keys itself; the adapter excluding the outbound
link and nothing else.

**Data** ships as JSON in `data/`: the places, the departures, the events and
what decides each, and the prices of the book's few purchases.

**The ship's log** is a file the game appends a line to at each departure,
for the log check. The game reads where it is from `EIGHTY_DAYS_LOG`, which
the adapter sets through `env` as a function of the Route's profile folder
and names again in `logPaths` (both in `src/app-under-test.ts`), as
`buggy` does with its own log. The file is named `ship.log`, since a
finding's signature takes the folder out only for a `.log` file (the
signature rules in `src/known.mjs`), and no ordinary line contains the word
"error", since the check matches it on every line appended (the log check in
`startWatching`, `src/oracles/index.ts`). **The game creates the file, empty,
when it starts**, rather than at the first departure: a named log that does
not exist is reported on every Hop as a check that could not run, not as a
clean log, so a log written only later would leave the early Hops of every
Route unchecked.

### Balance, measured rather than guessed

Whether a Route reaches an ending depends on how many moves the game takes
and how many Hops a Trip has, and neither is known until the game exists.
A game that no Route finishes shows only wandering; one that every Route
finishes the same way shows nothing. So once the game plays, a batch of
seeds is run at the demo's Trip length and three shares are measured:
Routes that win, that lose, and that are still going when the Trip ends.
The game's days and the demo's Trip length are tuned until all three show
up in a three-Route Journey, and the numbers go into `HISTORY.md`. The Fixes
below are the other lever, since a Fix that plays the book's opening
moves the Trip closer to the ending.

**How different the Routes are is measured too**, since width is the point
of the section above and a floor on candidates does not prove it. Over the
same batch of seeds: how many distinct sequences of places the Routes
visit, and how many Hops two Routes starting from the same Fix share before
they part. If most Routes follow the book's path place for place, the
game is a corridor however many controls it has, and the fix is more real
choices at the Quays, not more controls in the venues.

**Width and progress pull against each other, and probably hard.** A rough
estimate before anything is built: on a Quay of fifteen page candidates
with three departures, a Hop takes a departure about one time in seven,
and inside the ticket office a Hop reaches Book about one time in eight,
with Cancel as likely. So a passage costs a few tens of Hops, and a whole
circuit of fifteen or more passages several hundred. At a second or so per
Hop in a watched run, that is several minutes per Route from London.

**So a watched run has a time budget, and it sets the floor as much as the
three shares do:** the default Journey's three Routes, watched, finish in
about ten minutes. The levers, in order: the Fix, which starts the Trip
later in the circuit; fewer venues on places a Route passes through
quickly; and the Trip length. Width is not traded below the floor to meet
the budget; if both cannot hold, that is raised rather than settled
quietly.

## The look

**Decided 2026-09-27, in the words it was put:** "Make the demo attractive,
more than the plain train demo and buggy test app." The rail demo left its
styling open and settled on enough to read on a projector. This one is
meant to be looked at, since a demo is watched before it is understood.

**A Victorian travel office, not a web form.** Warm paper for the page, a
serif for headings and a clean face for the tables, ink-dark text, and
brass and oxblood as the two accents. Each mode has its own color and
engraved-style glyph, used on its departures, its passages and its line on
the map: sea blue for ships, soot for trains, saffron for the elephant, ice
for the sledge. Passages look like ticket stubs, with a perforated edge and
the mode's color. The Ledger is ruled like a ledger, with the wager's terms
at its head on a card from the Reform Club.

**The centerpiece is a map**, which the game calls the chart, since Map is
a planned engine term (`GLOSSARY.md`) and the application never says it. A
world chart on the Circuit screen, drawn to match the engravings, with
each passage traced over it in its mode's color as it is taken, and a
marker at the place reached. It is the one thing in the demo a person
watching from the back of a room can follow without
reading a line: every Route draws its own line round the world, and a
Route that leaves the book's path draws it somewhere the book never went.
The clock sits beside it as a brass dial with the date reached and the days
left.

**Small motion, where it tells the watcher something.** A new passage's
line draws itself along the chart; the clock's hand moves when the date
does; a booked ticket stamps "Booked". All of it is drawing that is hidden
from the accessibility tree, and none repeats.

**The engine's constraints on the look, measured in the code rather than
assumed:**

- **The settle wait reads the accessibility tree** (`src/route.ts`,
  `settle`), not pixels. So motion that changes only drawing is free, and
  motion that changes text is not: a clock whose text counted up day by
  day would keep the tree moving and stretch every Hop to its settle
  limit. **Every change to text, names or values happens at once, in the
  same handler as the action**, and only hidden drawing animates. Text
  that changed at the end of an animation would be worse than slow: the
  settle wait returns once the tree has been still for 400 ms (`settle`,
  `src/route.ts`), so a change landing later is read by the next
  Hop's survey or not, depending on timing, and one seed could offer two
  different pools on two runs.
- **The blank-window check reads the tree too** (`showsNothing` in
  `src/oracles/index.ts`): a screen with no text and no named element is
  blank however much is drawn on it. So the `blank-club` plant has to
  empty the tree, not just the picture, or the check will not fire.
- **Decoration stays out of the survey.** The map, the glyphs, the stamps
  and the engravings are `aria-hidden` or carry alternative text as images,
  so they add nothing to the pool and no nameless element to the
  named-controls check when it lands. The one icon-only button without a
  name is the `nameless-button` plant, and it is the only one.
- **Every control stays a real control with a role and a name**, however
  it is dressed. A styled radio group is still inputs of type radio, a
  switch is still a checkbox with the switch role, a slider is still a
  range input. The survey finds what the page is, not what it looks like.
- **Nothing is fetched at run time.** Fonts, the map, the glyphs and the
  engravings ship with the application, since an application that reaches
  the network for its look would do so on every Route, and the
  no-navigation check and a profile cleanup should never have to reason
  about it.

**The pictures are the 1873 edition's engravings,** decided 2026-09-27:
"Let's use the 1873 engravings." They head the place screens and the About
page, and the map and the mode glyphs are drawn to match them. Two things
follow. Each engraving is a download, asked for each time with its source
and size before it is fetched. And each one's public-domain status is
checked at its source rather than assumed from the date, with the source
and status recorded in `renderer/engravings/CREDITS.md`, since a scan can
carry restrictions the engraving does not. Each is scaled down before it
is committed, to at most 1600 pixels wide and about 300 KB, with the total
kept under 8 MB, and `CREDITS.md` records the size taken as well as the
source. Fonts are chosen from ones licensed for bundling, and the license
ships beside them.

**One window size, 1280 by 800,** laid out for it and checked at it, since
the demo is shown on one screen at a time. Light only: a projector washes
out a dark page, and a second theme is work the demo does not need.

## The Journeys, chosen by `EIGHTY_DAYS_JOURNEY`

The rail demo's pattern, kept so this demo stands on its own:

- **`no-fix`**: no Fix. The game opens at the Reform Club with the wager
  offered and not yet taken, so a Route with no Fix may wander the club's
  screen for a while before it accepts. That is the unanchored mode Loki
  was, and it is the first look.
- **`accept`**: a Fix of one step, `hop('button "Accept the wager"')`,
  copied from `phileas survey`. Every Route starts on the road.
- **`hong-kong`** (the default): a Fix that plays the book's own choices
  from London to Hong Kong, a step at a time from the survey, so every
  Route's Trip starts where the book's Fogg stood on the quay. It is the Fix
  that shows why a Fix exists, in the game's own terms: a known start,
  Fogg's, and an unpredictable continuation, where the three Routes go
  three ways from the same quay. Its length is whatever the book's choices
  take, counted when it is written. Every Fix step surveys, settles, runs
  the checks and waits out the hop delay (`runFix`, `src/route.ts`),
  so a long Fix costs tens of seconds per Route in a watched run, before
  the Trip starts. Written, it is twenty-seven steps, of which buying
  Kiouni takes six.
- **One Fix per stage-two section where a plant sits late in the game**,
  such as `omaha` for the sledge's plants, so the section's Trip starts
  near its bug rather than needing a seed that wanders there from London.

**A plant never sits on a Fix's path.** A Fix that walked through a planted
bug would fail inside the Fix on every Route, which is reported as one
Fix failure and never reaches the Trip at all. So each section's Fix stops
short of its plant, and no plant is placed on the default Fix's path: the
Kiouni plant, for one, is shown with a Fix that ends at Kholby, never with
the default. The guided demo's own check of each section's seed would
catch a Fix that strayed onto a plant, since the finding would appear as a
Fix failure rather than on a Trip Hop.

Three Routes each, fixed seed by default, and `PHILEAS_SEED` or `--seed` for
another. The Trip length is set by the balance measurement above.

## Stage one: exploring, with checks passing

The watched run and the guided demo, as the rail demo has them, over the
game. What a watcher sees that the rail demo could not show:

- **Three fates from one Journey**, on the map: the Routes leave the same
  quay and draw three different lines.
- **Every Hop's line carries the checks.** Six run today, and two say "not
  run" with the reason. An absent check is never read as a passing one.
- **The Journey ends with a summary**: what was found, how often, and what
  was not seen. With nothing planted it says nothing was found, which is
  the baseline stage two breaks.
- **Replay as a story**: the same seed plays the same game, and Fogg meets
  the same fate at the same Hop.

Stage one runs today. Nothing in it waits on the engine.

## Stage two: finding bugs

Bugs are planted in the game, each behind its own launch flag,
`--plant=<name>`, given more than once for several at a time, and refused
by name when it names none. That is `buggy`'s pattern, and it is chosen
over one setting for all of them so that the game shown working is the
same build as the one shown broken, and so that any one bug can be shown
alone. The adapter turns `EIGHTY_DAYS_PLANT`, a comma-separated list, into
those flags through `launchArgs`.

Each planted bug is visible to a watcher when it happens, and each is tied
to the check that catches it:

| Plant | What happens | Caught by | Runs |
| --- | --- | --- | --- |
| `kiouni-throw` | Raising the offer for Kiouni past £2,000 throws an uncaught error in the page | uncaught error | today |
| `export-throw` | Game > Export the ledger throws in the main process, from a timer, as `buggy`'s `plant:main-throw` does (`testbed/buggy/main.cjs`), so no IPC handler catches it | uncaught error, main process | today |
| `sail-console-error` | Hoisting the sledge's sail with the wind at its middle setting or above logs a console error. The middle is where a Trip's click sets the slider | console error | today |
| `coal-hang` | Burning the Henrietta's woodwork busies the page for twelve seconds. A stall is found only when a call outruns the Hop timeout, 3 s, plus the responsive wait, 5 s (`DEFAULT_HOP_TIMEOUT_MS` in `src/route.ts`, `DEFAULT_RESPONSIVE_TIMEOUT_MS` and `bounded` in `src/oracles/index.ts`), so six would pass. A known hang still ends a Route, decided in the engine's review of 2026-09-27, so this plant is never the one the known-findings loop below is shown with | still responding | today |
| `blank-club` | Arriving at the Reform Club blanks the window, so the ending never shows | window showing content | today |
| `set-out-confirm` | Game > Set out again asks with a native confirm | no unexpected dialog | today |
| `carnatic-log-error` | Booking the Carnatic writes an ERROR line to the ship's log, which the adapter names | log error | today |
| `bradshaw-trap` | Game > Consult Bradshaw opens a native modal with no way out | the Route strands; not a finding | today |
| `nameless-button` | An icon-only button on the sledge with no accessible name | named controls | after phase 5 |
| `sledge-days-missing` | The Ledger's total leaves out its sledge rows | structural check, on the Ledger alone | phase 6 |
| `date-line` | The arrival date ignores the day gained eastward, so the Ledger says the wager is lost when it was won | specified check, against `data/` | phase 6 |
| `sail-clears-wind` | Hoisting the sail resets the wind slider | metamorphic check | phase 6 |

The `date-line` plant is the novel's own ending turned into a bug, and it
is the one to point at when explaining what a specified oracle is: the game
computes the arrival date, the check computes it again, and the two
disagree. **What the check computes is the date line, and only that.** It
reads the Ledger's rows, adds them itself rather than taking the Ledger's
total, and turns the sum into a date from the starting moment and the
date-line rule, both taken from `data/`. It does not recompute how long
each passage or delay took: that depends on every rule in the game, from
the court day to the warrant, and a check that reimplemented them all
would be a second copy of the game's logic, which is the trap `CLAUDE.md`
names. So the specified part is narrow and independent, and whether each
row's time is right is a different question, left to the structural and
metamorphic checks.

**`bradshaw-trap` is shown apart from the rest.** A Route that strands is
reported as stranded, never as failed, and a stranding has no signature
and no id. So it appears in step 1 below as a third outcome, and not in
steps 2 to 4, which are about findings.

**The known findings file decides the order.** When a Journey ends, every new
finding is added to the file as known but unfiled, and an unfiled finding
already lets a Route carry on past it (`recordJourneyFindings` in
`src/known.mjs`, and how `startWatching` in `src/oracles/index.ts` treats a
known finding). So a replay run after the Journey that found a bug would
travel past it rather than stop. **A known hang is the exception**: it still
ends the Route, so the loop is shown with a plant that is not a hang. The
guided demo keeps its known findings file in a scratch folder and controls it:

1. **Found.** A Journey with one plant on, from an empty file. A Route
   reaches the bug, the check fires, the Route ends there, and the failed
   check's line names the Hop and the finding's id. The Journey's end adds
   the finding to the file, unfiled, and says so.
2. **Replayed.** The same Route again, from its seed, against the file as
   it was before step 1, which the demo put back. It plays the same game
   straight back to the same Hop and stops there.
3. **Filed.** `phileas known add <id> --issue <issue>`, and the Journey run
   again against the filed file: the Route travels past the bug, the line
   records the finding as known with its issue, and the summary says it was
   seen. This is the loop that was asked for on 2026-09-27, shown end to
   end.
4. **Several at once.** Several plants on, from an empty file, and one
   Journey's summary listing each finding once with how often it was seen.

**The wiring this needs, which the rail demo does not have.** The spec
passes `knownFindings` to `runRoute` (`RunRouteOptions` in `src/route.ts`),
and the global setup's returned function calls `finishJourney({
journalsRoot, knownFindings })` (`src/start.ts`). The rail demo's spec and
global setup pass neither. The spec also marks a survey-only Route skipped,
as the rail demo's now does, since `surveyed` is an outcome of its own.

**The demo's known findings file is never committed.** Every Journey that
finds something adds to it, so a committed file would change on every run
with a plant on. It lives beside the journals, under `.phileas-journals/`,
which is already ignored, and the guided demo points `knownFindings` at its
own scratch copy. The trial's committed file is different in kind: it
records real bugs filed against Positron, where these are planted ones
that exist to be found again.

**The seeds have to be found, and they move.** A planted bug is found by a
Journey rather than steered to, since steering would show the check and not
the search, and that is the point of a demo. So each stage-two section
carries a Fix that starts near its bug and a seed measured to reach it
within the Trip, and every change to the draw, the survey or the game
moves those seeds. The engine's own pinned test seeds have moved that way
more than once, and `HISTORY.md` records it; the rail demo never had a seed
pinned to a bug, since its stage two was never built. **How the guided demo
knows a seed still works:** it runs the section's Journey once, as the
audience watches, then reads that run's journals for the finding. If it is
not there, the section says, from that same run, that the seed no longer
reaches its bug and names the Trip length and plant, rather than moving on
as if something were found. There is no hidden run beforehand, which would
double every section's time.

## Review by a second model, 2026-09-27

A review of this plan found twenty-one problems, and the fixes are written
into the sections above rather than listed here. The ones that would have
broken the demo as first written: a replay run after the Journey that
found a bug would travel past it, since that Journey's end adds the
finding as known; a six-second hang does not fire
the still-responding check; a Trip cannot type a number other than 0, so
number fields whose effect depends on a value were unreachable; a slider
clicked by a Trip always lands at its middle; text changed after an
animation could change what the next Hop is offered; and native menu
entries are never offered as `menuitemcheckbox`. Several facts about the
book were also wrong and are corrected, still to be checked at the text.

## A second review, 2026-09-27

Read afresh after the fixes above, and found eight more, each fixed in the
section it belongs to. Three would have broken the demo: Set out again on
offer in the menu at every Hop would have sent Routes back to London
several times over; the date-line oracle could not compute the arrival
date from departures alone without copying the game's rules; and a plant on
a Fix's path would fail every Route inside its Fix.

## Settled in review

Each answered 2026-09-27, in the words given:

- **The application's name** is "Eighty Days".
- **The shared runner:** "Do this." The rail demo's runner is lifted into
  `demo/presenting.mjs` as the first step of the build.
- **How much of the book:** "As much as possible but don't force it or
  inflate the demo just to include more." So a detail from the book goes in
  wherever it fits a choice, a control, an event or a bug the game already
  needs, and is left out where it would only add length.
- **The currency menu is gone**, with money kept to the few places
  "Money, only where the book spends it" lists.
- **The root script names:** "rename". The new demo gets
  `demo:eighty-days` and `demo:eighty-days:present`, and the rail demo's
  `demo:present` becomes `demo:train:present`, so each name says which
  demo it runs. README, the rail demo's `PRESENTING.md` and
  `DEMO_PLAN_TRAIN.md` are updated with it; `HISTORY.md` keeps the old name
  where it was recorded, since it is the record.
- **The order of plants in the guided demo:** one at a time first, then
  several at once in the last section, as proposed, and open to revisiting
  once the sections exist.

## Open

Nothing is open. New questions go here as building raises them.

## Build order

Steps 1, 2, 4 and 5 are built, 2026-09-27, and step 3 is built but for the
engravings, which wait on a download for each; `HISTORY.md` has what was
measured. The balance was measured before the engravings, since the look
matters less if Routes never leave London.

1. Lift the rail demo's presenting runner into `demo/presenting.mjs`, with
   the parameters listed under "What is shared", and rename its script to
   `demo:train:present`, with the rail demo's sections unchanged and its
   guided demo run once to show nothing moved.
2. The two determinism tests, failing, before there is a game for them to
   pass on.
3. The game's state, places and events as data, and the screens, with the
   look from the start rather than added after. The engravings are fetched
   here, each asked for.
4. The adapter, staleness-guarded, naming the ship's log for the log check,
   the spec and global setup wired for known findings, and the package.
5. The balance measurement, the width measurement and the watched-run
   time budget, and the tuning they call for.
6. The Journeys, the one-command watched run, and the presenting script for
   stage one.
7. The eight plants that run today, each behind its flag, and a Fix and seed
   measured to reach each. The rest are planted when their checks exist.
8. The presenting script's stage-two sections, including the known-findings
   loop.
