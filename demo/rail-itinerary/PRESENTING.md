# Presenting Phileas on Rail Itinerary

A script for showing Phileas to people who have not seen it, technical or not.
The commands take about ten minutes, both stages together, measured with no
pause between sections; with talking, allow twenty, plus questions. Sections
1 to 10 are stage one, exploring; 11 to 16 are stage two, finding planted
bugs, and `-- --from 11` starts there.

**Two ways to give it.** `npm run demo:train:present` runs the sections below
in order, with the application's window on screen, and waits for Enter
between them. `npm run demo:train:present -- --auto` plays straight through,
eight seconds apart, or `--auto=15` for fifteen. `-- --from 8` starts at
section 8. Or run each section's command by hand from this file, which is
slower and leaves room to wander. The guided command prints every command
exactly as it would be typed, and waits for Enter before running it, so there
is time to read it out; the two ways match line for line.

Everything runs live against the real application. Nothing is recorded in
advance, so a run can be repeated if a question calls for it.

## Before you start

From the repository root, once:

```
npm install
cd demo/rail-itinerary && npm install && npm run package
```

If a run then says it cannot find Electron, `node node_modules/electron/install.js`
fetches it, in the root and in `demo/rail-itinerary/` separately.

Commands below run from the repository root. Where they say `phileas`, type
`node bin/phileas.mjs`; in a repository that consumes the engine, `phileas` is
the command itself. `phileas survey` takes no flags, so its window mode and
its pause go in front of it as `PHILEAS_SHOW=front` and `PHILEAS_HOP_DELAY_MS=2000`.
The pause holds each screen for two seconds, which a survey otherwise shows
for a moment.

`PHILEAS_FIX` chooses which Fix every Route opens with, the same as `--fix`:
`open-alps` (the Journey's own), `add-leg-then-buy`, or `none`.

Put the terminal and the application's window side by side. The window opens
and closes with every run, because every Route starts the application fresh.

## 1. What you are about to see

No command. Say what Phileas is, and name the five pieces, since everything
after this uses them:

- **Journey**: one run of Phileas. How many Routes, how long each one is, and a seed.
- **Route**: one independent exploration, with its own pass or fail.
- **Fix**: the fixed opening every Route follows first, so it starts somewhere known.
- **Trip**: the unpredictable rest of a Route, after its Fix.
- **Hop**: one move. A click, some typing, a key, a menu choice.

Every choice comes from a seed, so any run can be repeated exactly. That is
what turns "it did something strange once" into something a person can watch
happen again.

## 2. A first look

```
PHILEAS_FIX=none phileas run demo/rail-itinerary/phileas --seed first-look --routes 1 --trip-length 10 --hop-delay-ms 700 --follow --show front
```

A whole Journey, as small as it gets: one Route of ten Hops, with no Fix, so it
starts wherever the application starts. Let the audience watch the window
first, then point at the lines. Each is one Hop, in five columns:

- **Route**: which Route, counting from 1.
- **Hop**: which move in that Route.
- **Action**: click, type, press, select or menu-click.
- **Acted on**: the control, by its kind and name, and any text typed into it.
- **What changed**: headings that appeared (+) or went away (-), or "no change".

Say that the rest of the demo takes this apart.

## 3. How Phileas finds controls

```
PHILEAS_FIX=none PHILEAS_HOP_DELAY_MS=2000 PHILEAS_SHOW=front phileas survey demo/rail-itinerary/phileas
```

Point at the listing. Nobody told Phileas what is in the
application: it reads the screen the way a screen reader does, and keeps what
is visible, enabled and named. Each line is one thing it could act on. The
menu bar is read too, and the keys are offered on every screen.

Point at an "excluded" line. Phileas skips the standard menu entries every
Electron application gets, such as Quit and Cut, and anything the adapter
lists, and still shows each one with its reason so nobody wonders whether it
was missed.

## 4. How it decides each move

```
PHILEAS_FIX=none phileas run demo/rail-itinerary/phileas --seed how-it-decides --routes 1 --trip-length 3 --hop-delay-ms 1500 --follow --show front
node demo/rail-itinerary/explain-hop.mjs demo/rail-itinerary/phileas/.phileas-journals/how-it-decides/<run> 1
```

The `<run>` folder is named on the run's second line. The guided command fills
it in.

The question to answer here is how an unscripted run works on top of
Playwright, which is built for scripted tests. Playwright only does things:
find, click, type. Phileas decides which thing, one move at a time, in a loop:

1. **Look**: read what the screen offers right now.
2. **Pick a kind of move**: a number from the seed decides between the page, the
   menu bar and the keys.
3. **Pick one**: a second number picks which.
4. **Act**: click a button, type into a field, choose an option, press a key.
5. **See what changed**, write it down, and go back to 1.

The explanation is worked out from the journal the run just wrote, not
described from memory, and it checks its arithmetic against the journal.

## 5. How it is configured

Show two files, or let the guided command show the parts that matter:

- `demo/rail-itinerary/phileas/journeys/index.ts`: the Journey. Three Routes,
  fifty Hops each.
- `demo/rail-itinerary/phileas/adapter/index.ts`: the adapter. Where the
  application's build is, how to tell it has started, and what never to touch.

Then the point for a mixed audience: any setting can be changed for one run
without editing a file.

```
phileas run --seed <anything> --routes 5 --trip-length 100 --show front --follow
```

## 6. A Fix of one step

```
PHILEAS_FIX=open-alps PHILEAS_HOP_DELAY_MS=2000 PHILEAS_SHOW=front phileas survey demo/rail-itinerary/phileas
```

Show the Fix, in `fixes/open-alps.ts`:

```ts
export const openAlps: Fix = ({ step }) => step({ kind: 'act', target: 'button "Open Alps by rail"' });
```

It is one line copied from the survey in section 3. Nobody read the
application's code to write it. Point at the listing after the Fix: that is
where every Route's Trip begins.

## 7. A Fix of several steps

```
PHILEAS_FIX=add-leg-then-buy PHILEAS_HOP_DELAY_MS=2000 PHILEAS_SHOW=front phileas survey demo/rail-itinerary/phileas
```

Show `fixes/add-leg-then-buy.ts`. This Fix opens the same itinerary, adds a leg from
Geneva to Zurich, and opens the ticket purchase dialog, in nine steps. It was
built one step at a time: run the survey, copy the line for the next control,
run the survey again.

Point at the one step that is not a copied line. The From and To lists name the
same twelve stations, so `option "Zurich"` appears twice and a copied line
would always pick the one in From. A Fix can use ordinary Playwright code for
a step like that. It is a known limit, kept visible on purpose.

Point at the Save step: the fare total went from $159.00 to $328.20. Then at
the listing after the Fix: the only controls on offer are the dialog's, which
is where every Trip in the next section starts.

## 8. A Journey in action

```
PHILEAS_FIX=add-leg-then-buy phileas run demo/rail-itinerary/phileas --seed rail-demo --routes 3 --trip-length 15 --hop-delay-ms 300 --follow --show front
```

Point at the settings block first: the seed, three Routes, fifteen Hops. Then
at the window. Each Route starts the application fresh, follows the Fix into
the ticket dialog, and takes its Trip from there, so every Route's first Hops
are inside the dialog: the Fix at work, where it can be seen. One line per Hop:
what it acted on, how, and what changed on screen. "no change" is worth
pointing at once: a Hop that does nothing is recorded honestly, not skipped.

## 9. Seeding

```
PHILEAS_FIX=none phileas run demo/rail-itinerary/phileas --seed five-then-ten --routes 1 --trip-length 5 --hop-delay-ms 500 --follow --show front
PHILEAS_FIX=none phileas run demo/rail-itinerary/phileas --seed five-then-ten --routes 1 --trip-length 10 --hop-delay-ms 500 --follow --show front
```

The same seed, five Hops and then ten. Point at the first five lines of the
second run: they are the first run's, exactly, and then it carries on. The
seed decides every move; the Trip length only decides where a Route stops.

```
PHILEAS_FIX=add-leg-then-buy phileas run demo/rail-itinerary/phileas --seed rail-demo --routes 3 --trip-length 15 --hop-delay-ms 300 --show front -- --grep 'route 1$'
```

Route 1 of section 8's Journey again, on its own. The guided command compares
the two journals and says whether every Hop matched. By hand, add `--follow`
and read it against section 8's Route 1. A replay needs the seed, a Route count
that includes the Route, and a Trip at least as long as the part to retrace.

```
PHILEAS_FIX=none phileas run demo/rail-itinerary/phileas --seed another-seed --routes 1 --trip-length 5 --hop-delay-ms 500 --follow --show front
```

A different seed makes different moves: read it against the five-Hop run.

## 10. The output

```
ls demo/rail-itinerary/phileas/.phileas-journals/rail-demo/<run>
phileas show demo/rail-itinerary/phileas/.phileas-journals/rail-demo/<run>
```

One journal per Route, written a Hop at a time and saved after each one, so a
crash leaves everything up to the crash. `phileas show` reads it back for a
person. Then show one raw line from a journal: what was on offer, what was
chosen, both numbers drawn, and what changed. That record is what makes an
exact replay possible.

## 11. Stage two: planting a bug

No command. Three bugs are planted in the application, each behind its own
switch, so the build shown working in stage one is the build shown broken
now, and any one can be shown alone. The guided command lists them. Say the
most important thing about them: **a planted bug is found by a Journey, not
steered to**. Each one's seed was searched for until a Route met the bug by
its own draws, which is what shows the search working and not only the
check.

## 12. Found

```
RAIL_DEMO_PLANT=sleeper-throw RAIL_DEMO_KNOWN=demo/rail-itinerary/phileas/.phileas-journals/present/known-findings.json phileas run demo/rail-itinerary/phileas --fix open-alps --seed rail-demo --routes 1 --trip-length 50 --hop-delay-ms 300 --show front --follow
```

The bug: choosing the sleeper class in the Add a leg form throws an error in
the page. Nothing steers the Route there. It wanders the timetable and the
itineraries, opens Add a leg, and picks Sleeper at Trip hop 17.

Point at the line for that Hop: the failed check, what it saw, and the
finding's id, which is the same every time the same bug is seen. The Route
ends there, not after its Trip: Hops after a known-broken state are noise.
Then at the Journey's end: the finding was added to the known findings, as
unfiled.

## 13. Stranded, which is not a finding

```
RAIL_DEMO_PLANT=seating-trap RAIL_DEMO_KNOWN=demo/rail-itinerary/phileas/.phileas-journals/present/known-trap.json phileas run demo/rail-itinerary/phileas --fix open-alps --seed vienna --routes 1 --trip-length 50 --hop-delay-ms 300 --show front --follow
```

With this bug on, the itinerary screen has a Choose seats button, and it
opens a dialog with nothing in it to press, which Escape does not close. The
Route strands after Trip hop 7: no move left. Stranded is the third outcome,
neither a pass nor a failure, and the summary shows no finding. A trap may be
a bug or a corner with nothing more to do, and the engine reports what it saw
rather than guessing which.

## 14. Replayed

Delete the known findings file, putting it back as it was before section 12,
then run section 12's command again.

The same Route, from the same seed, makes the same moves straight back to
Trip hop 17 and the same finding. The guided command compares the two
journals and says whether every Hop matched. This is what makes a finding
worth filing: whoever gets the report can watch it happen again, from the
seed alone. It had to be run against the file as it was, since a finding the
file already holds no longer ends a Route; the next section is that.

## 15. Filed, and traveled past

```
phileas known add <id> --issue demo-1 demo/rail-itinerary/phileas/.phileas-journals/present/known-findings.json
```

Then section 12's command once more. `<id>` is the finding's id from
section 12; the guided command fills it in.

Filed, the bug no longer ends the Route. Point at Trip hop 17 again: the line
now says the finding is known, with its issue, and the Route carries on to the
end of its Trip and passes. Point at the summary: it still lists the finding,
as seen, with its issue. A filed bug stops blocking without going quiet. One
not seen in a later Journey is counted at its end, and `phileas known list`
says when each was last met.

## 16. Several at once

```
RAIL_DEMO_PLANT=sleeper-throw,last-leg-blank RAIL_DEMO_KNOWN=demo/rail-itinerary/phileas/.phileas-journals/present/known-several.json phileas run demo/rail-itinerary/phileas --fix open-alps --seed vienna --routes 5 --trip-length 100 --hop-delay-ms 300 --show front
```

Two bugs on together, five Routes of a hundred Hops, a few minutes. The
guided command prints how each Route ended, then the summary: each finding
once, with how often it was seen. With this seed, removing the Alps
itinerary's last leg blanks the window on two Routes, and the sleeper class
throws on a third, at its very last Hop. The other two Routes pass. The trap
is left out of this section, since a Route that strands on it ends with no
finding and would hide whatever else it met.

## Questions that tend to come up

- **Does it find bugs yet?** Some. Six checks run after every step, and
  against Positron they found real bugs. Stage two of this demo plants three
  bugs and finds each one; the rest of its planned bugs wait for checks that
  are not built yet.
- **Why not just record a tester?** A recording follows one path. Phileas takes
  new paths every run, and still repeats any one of them exactly.
- **What if it clicks something dangerous?** The adapter's exclusion list keeps
  it away from things like Quit and the link that leaves the application.
