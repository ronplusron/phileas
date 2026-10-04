# Presenting Phileas on Eighty Days

A script for showing Phileas to people who have not seen it, technical or not.
It has both stages of `docs/DEMO_PLAN_EIGHTY_DAYS.md`. Sections 1 to 6 are
stage one, exploring with every check passing and nothing planted; sections
7 to 12 are stage two, planted bugs found, replayed, filed and traveled
past. It runs about half an hour, plus questions, most of it in sections 4,
6 and 12, where the game plays itself while you talk. `-- --from 7` gives
stage two alone. The rail demo, `demo/rail-itinerary/PRESENTING.md`, is the shorter
first look and takes the pieces apart more slowly; this one assumes less
patience and shows more.

**Two ways to give it.** `npm run demo:eighty-days:present` runs the sections
below in order, with the game's window on screen, and waits for Enter between
them. `npm run demo:eighty-days:present -- --auto` plays straight through,
eight seconds apart, or `--auto=15` for fifteen. `-- --from 4` starts at
section 4. Or run each section's command by hand from this file, which is
slower and leaves room to wander. The guided command prints every command
exactly as it would be typed, and waits for Enter before running it, so there
is time to read it out; the two ways match line for line.

Everything runs live against the real game. Nothing is recorded in advance,
so a run can be repeated if a question calls for it.

## Before you start

From the repository root, once:

```
npm install
cd demo/eighty-days && npm install && npm run package
```

If a run then says it cannot find Electron, `node node_modules/electron/install.js`
fetches it, in the root and in `demo/eighty-days/` separately.

Commands below run from the repository root. Where they say `phileas`, type
`node bin/phileas.mjs`; in a repository that consumes the engine, `phileas` is
the command itself. `phileas survey` takes no flags, so its window mode and
its pause go in front of it as `PHILEAS_SHOW=front` and `PHILEAS_HOP_DELAY_MS`.

Two switches are this demo's own, not the engine's, and one is the engine's.
`phileas run --fix <name>`, or `PHILEAS_FIX` in front of a survey, chooses
the Fix every Route follows, and so where its Trip starts: `none`, no Fix
at all, which starts in the Reform Club; `accept`, whose Fix takes the
wager; `hong-kong`, the Journey's own, whose Fix plays the book to the Hong
Kong quay; and five that start stage two near its bugs, `kholby`,
`fort-kearney`, `new-york`, `london` and `reform-club`. The Fixes are in
`demo/eighty-days/phileas/fixes/`.
`EIGHTY_DAYS_PLANT` switches planted bugs on, by name, commas between.
`EIGHTY_DAYS_KNOWN` names the known findings file: the guided command keeps
its own under `demo/eighty-days/phileas/.phileas-journals/present/` and
empties each one before the section that needs it empty; by hand, delete
the file named in a command first to do the same. The seeds below are in
`demo/eighty-days/seeds.mjs`, each searched for rather than steered, and a
change to the game or the engine can move them; the guided command says so
if a seed no longer reaches its bug, rather than carrying on.

Put the terminal and the game's window side by side. The window opens and
closes with every Route, because every Route starts the game fresh. It is laid
out for 1280 by 800.

## 1. What you are about to see

No command. Say what Phileas is, and name the five pieces, since everything
after this uses them:

- **Journey**: one run of Phileas. How many Routes, how long each one is, and a seed.
- **Route**: one independent exploration, with its own pass or fail.
- **Fix**: the fixed opening every Route follows first, so it starts somewhere known.
- **Trip**: the unpredictable rest of a Route, after its Fix.
- **Hop**: one move. A click, some typing, a key, a menu choice.

Then the game. Fogg races east from London to win the Reform Club's wager of
£20,000 on eighty days, choosing steamers, trains, an elephant and a sledge.
**Nothing in it is random**: the same moves always play the same game. That is
what lets a seed replay a Route, and a test in the demo's own suite checks it.

## 2. What Phileas finds at the Reform Club

```
PHILEAS_FIX=none PHILEAS_HOP_DELAY_MS=2000 PHILEAS_SHOW=front phileas survey demo/eighty-days/phileas
```

Point at the listing. Nobody told Phileas what is in the game: it reads the
screen the way a screen reader does, and keeps what is visible, enabled and
named. Each line is one thing it could act on. The club offers only buttons
and menu entries; once Fogg is travelling, each place adds tabs for its
venues, dropdowns, text fields, a slider and a switch. The menu bar is read
too, and the keys are offered on every screen.

Point at an "excluded" line. Phileas skips the standard menu entries every
Electron application gets, such as Quit, and anything the adapter lists.

## 3. The book's own opening, as a Fix

```
PHILEAS_FIX=hong-kong PHILEAS_HOP_DELAY_MS=700 PHILEAS_SHOW=front phileas survey demo/eighty-days/phileas
```

Show `demo/eighty-days/phileas/fixes/hong-kong.ts`. Twenty-seven steps, each
a line copied from a survey like section 2's, playing Fogg's choices from the
book: the Mongolia, the passport, Kiouni bought for £2,000 after four raises,
Aouda rescued, the Rangoon. Nobody read the game's code to write it.

This is why a Fix exists. The engine's predecessor, Loki, started every run
wherever the application started and wandered from there, and found little.
A Fix is a known start; the Trip after it is where the unpredictable part
begins. Point at the listing after the Fix: the Hong Kong quay, where every
Trip in the next section starts.

## 4. Three fates from one Journey

```
EIGHTY_DAYS_KNOWN=demo/eighty-days/phileas/.phileas-journals/present/known-findings.json phileas run demo/eighty-days/phileas --seed carnatic --routes 3 --trip-length 150 --hop-delay-ms 300 --show front
node demo/eighty-days/measure.mjs demo/eighty-days/phileas/.phileas-journals/carnatic/<run>
```

The `<run>` folder is named on the run's second line. The guided command fills
it in and prints the fates itself.

About seven minutes, so this is the time to talk. Point at the settings
block first: the seed, three Routes, a hundred and fifty Hops. Then at the
window. Each Route starts the game fresh, follows the Fix to Hong Kong, and
from there goes its own way: the tavern, the Carnatic or the Tankadere, the
Pacific, the plains, the Atlantic. When a Route opens the Circuit panel, the
chart shows the line it has drawn round the world.

With this seed the three games go three ways, and the guided command prints
them when the run ends:

- **Route 1 loses.** By way of Shanghai and Yokohama it crosses to San
  Francisco, and the wager is lost there, at Trip hop 100.
- **Route 2 wins.** It sails straight for Yokohama, crosses the Pacific,
  follows the book overland by Salt Lake City, Fort Kearney and Omaha to New
  York, and reaches the Reform Club by way of Queenstown and Liverpool, at
  Trip hop 126.
- **Route 3 is still going** when its Trip ends, having reached Liverpool by
  way of Shanghai, San Francisco, Omaha, New York and Queenstown.

Each Route that ends offers "Set out again", and the rest of its Trip starts
the game over from London, which is why the places listed carry on past it.

One known start, three continuations, and each replayable from the seed.

## 5. Checked after every Hop

No new run: the guided command reads the journals section 4 wrote. By hand,
`phileas show` on the run folder prints every Hop, and `jq '.checks'` on a
journal line shows one Hop's checks.

After every Hop, the Fix's included, six checks run: no uncaught error, no
console error, still responding, still showing something, no unexpected
dialog, and no error in the game's own log. Two more say "not run", with the
reason, on every Hop: they are not built yet, and a check that did not run is
never counted as one that passed.

Then point at the Journey's summary, the last lines section 4 printed: nothing
found, and nothing held. That is the baseline. Stage two plants bugs in the
game and shows the same Journey finding them.

## 6. The same seed, the same game

```
EIGHTY_DAYS_KNOWN=demo/eighty-days/phileas/.phileas-journals/present/known-findings.json phileas run demo/eighty-days/phileas --seed carnatic --routes 3 --trip-length 150 --hop-delay-ms 300 --show front -- --grep 'route 1$'
```

Route 1 of section 4's Journey again, on its own, about two and a half minutes.
The guided command compares the two journals and says whether every Hop
matched, and prints how the game went both times. By hand, run `measure.mjs`
on the new run folder and read it against section 4's.

Route 1 again: the same Shanghai, the same San Francisco, the same loss at
the same Hop.

A Route that had found a bug would walk straight back to it, which is what
makes a finding worth filing. A replay needs the seed, a Route count that
includes the Route, and a Trip at least as long as the part to retrace.

## 7. Stage two: planting a bug

No command. Eight bugs are planted in the game, each behind its own switch,
so the build shown working in stage one is the build shown broken now, and
any one can be shown alone. The guided command lists them with the place
each is reached from. Say the most important thing about them: **a planted
bug is found by a Journey, not steered to**. Each one's seed was searched
for until a Route met the bug by its own draws, which is what shows the
search working and not only the check.

## 8. Found

```
EIGHTY_DAYS_PLANT=kiouni-throw EIGHTY_DAYS_KNOWN=demo/eighty-days/phileas/.phileas-journals/present/known-findings.json phileas run demo/eighty-days/phileas --fix kholby --seed fogg --routes 1 --trip-length 40 --hop-delay-ms 300 --show front --follow
```

The bug: the raise that brings the offer for Kiouni to £2,000 throws an
error in the page. The Fix ends at Kholby with the offer at £1,800, so one
raise is left for the Trip to choose. It does at Trip hop 9.

Point at the line for that Hop: the failed check, what it saw, and the
finding's id, which is the same every time the same bug is seen. The Route
ends there, not after its Trip: Hops after a known-broken state are noise.
Then at the Journey's end: the finding was added to the known findings, as
unfiled.

## 9. Stranded, which is not a finding

```
EIGHTY_DAYS_PLANT=bradshaw-trap EIGHTY_DAYS_KNOWN=demo/eighty-days/phileas/.phileas-journals/present/known-trap.json phileas run demo/eighty-days/phileas --fix hong-kong --seed fogg --routes 1 --trip-length 80 --hop-delay-ms 300 --show front --follow
```

Game > Consult Bradshaw opens a dialog with nothing in it to press, and
Escape does not close it. The Route strands after Trip hop 12: no move left.
Stranded is the third outcome, neither a pass nor a failure, and the
summary shows no finding. A trap may be a bug or a corner with nothing
more to do, and the engine reports what it saw rather than guessing which.

## 10. Replayed

Delete the known findings file, putting it back as it was before section 8,
then run section 8's command again.

The same Route, from the same seed, plays the same game straight back to
Trip hop 9 and the same finding. The guided command compares the two
journals and says whether every Hop matched. This is what makes a finding
worth filing: whoever gets the report can watch it happen again, from the
seed alone. It had to be run against the file as it was, since a finding
the file already holds no longer ends a Route; the next section is that.

## 11. Filed, and traveled past

```
phileas known add <id> --issue demo-1 demo/eighty-days/phileas/.phileas-journals/present/known-findings.json
```

Then section 8's command once more. `<id>` is the finding's id from
section 8; the guided command fills it in.

Filed, the bug no longer ends the Route. Point at Trip hop 9 again: the
line now says the finding is known, with its issue, and the Route carries
on to the end of its Trip and passes. Point at the summary: it still lists
the finding, as seen, with its issue. A filed bug stops blocking without
going quiet. One not seen in a later Journey is counted at its end, and
`phileas known list` says when each was last met.

## 12. Several at once

```
EIGHTY_DAYS_PLANT=carnatic-log-error,export-throw,sail-console-error,coal-hang EIGHTY_DAYS_KNOWN=demo/eighty-days/phileas/.phileas-journals/present/known-several.json phileas run demo/eighty-days/phileas --fix hong-kong --seed mudge --routes 5 --trip-length 150 --hop-delay-ms 300 --show front
```

Four bugs on together, five Routes from Hong Kong, a few minutes. The
guided command prints how each Route ended, then the summary: each finding
once, with how often it was seen. With this seed, Game > Export the ledger
throws in four of the Routes and the Carnatic's log error ends the fifth.
Every Route ended at its first bug, since none was known yet. The sledge's
and the Henrietta's bugs were planted and not reached, and the summary does
not pretend otherwise: it lists what was seen, never what was not looked
for.

## Questions that tend to come up

- **Does it find bugs?** Six checks run after every step, and against Positron
  they found real bugs. Stage two shows it here, on bugs planted in the game,
  each found by a seeded Route rather than steered to.
- **Why does a failed Route stop at the bug?** Hops after a known-broken
  state are noise that buries the one that mattered. Filing the bug, as in
  section 11, lets later Routes carry on past it.
- **Why does a Route keep going after the game ends?** A Route's Trip is a
  number of Hops, not a goal. Winning or losing the wager is a fate for the
  audience; the engine's work is to explore and to check.
- **Was the game made easy for Phileas?** Once, and it was undone or recorded.
  Two changes suited the engine rather than the game; `docs/DEFECTS.md` has
  both weaknesses, and the plan says how the harder game comes back.
- **What if it clicks something dangerous?** The adapter's exclusion list keeps
  it away from Quit and the link to the book online.
