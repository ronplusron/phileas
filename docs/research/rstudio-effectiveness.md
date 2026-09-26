# Research: how much of RStudio's real bug stream Phileas could find

*Measured 2026-09-26, against the engine as planned through phase 6.*

## The question

Is Phileas worth the effort for RStudio? RStudio is one of the two large
applications the engine is meant for (`../OUTSTANDING.md` 1.8). The case made
for it so far rests on three recorded bugs, all in the part discovery reaches
and all missed by RStudio's scripted suite. Three hand-picked bugs say that
such bugs exist. They say nothing about how common they are.

## The answer

**About six bugs in a hundred, and three of those a cheaper tool would catch
first.** Of 100 fixed bugs drawn at random, 2 could plausibly be found by the
universal checks alone, 4 more with rules written for RStudio, and 94 not
realistically at all. Restricted to the 62 that affect RStudio Desktop, the
application Phileas would actually run against, it is 2, 4 and 56.

Of the six, an accessibility scanner finds one and a link checker run over
the source finds two, both more cheaply and more surely than random travel.
**Three bugs in a hundred need what Phileas does and nothing else does.**

**The limit is not traveling, it is setup.** Seven bugs in ten needed an
environment a Route does not have, such as particular R code, a signed-in AI
service, a network condition or another platform. Only one in five needed a
sequence of ordinary interface actions, which is what random travel produces.

## Method

**Population:** every issue in `rstudio/rstudio` labeled `bug`, closed as
completed, and opened on or after 2024-09-26, excluding those labeled
duplicate, not reproducible or won't fix. That was 716 issues on 2026-09-26.

**Positive control on the query:** the same search API returned 5,747 for
`label:bug` alone and 388 for closed `source editor` issues, so the filter
narrows and does not silently match nothing.

**Sample:** 100 drawn with Python's `random.sample` seeded with `20260926`,
from the sorted issue numbers. The draw can be repeated exactly.

**Classification:** each issue's title, labels and first 3,500 characters of
its body were read against one rubric, in four batches of 25, one reader per
batch. The rubric stated what a Hop can do (click, type a stock string, press
Enter, Escape, Tab or an arrow, choose from a native dropdown, click an entry
of the native menu), what discovery cannot reach, as measured on RStudio and
recorded in `../OUTSTANDING.md` 1.9, and what each kind of check can catch. It
asked for a verdict per issue:

- **A:** plausibly found by the universal checks alone, with reasonable odds
  or a generic Fix that opens the area.
- **B:** plausibly found only with RStudio-specific work: an application
  check, an oracle, or a purpose-built Fix or environment.
- **C:** not realistically found.

Readers were told to choose the less favorable verdict when unsure.

**A second pass re-read every A and B,** because the first pass accepted
checks that could only be written by knowing the bug, and odds that did not
survive being worked out. Each surviving B had to meet two tests. Its check
is a rule that holds whatever the Trip did, rather than an expected result
for one sequence of steps, which is a scripted test. And the Trip reaches
the trigger with odds worked out from the draw shares: menu entries get an
eighth of the draw across RStudio's hundred and more, so one given entry is
drawn about once in 800 Hops, and two given entries in order within a Trip
of 50 about once in 500 Routes. Six B verdicts moved to C and one C to B;
the appendix says which and why.

## Results

| | All 100 | Desktop, 62 |
| --- | --- | --- |
| A: universal checks | 2 | 2 |
| B: rules written for RStudio | 4 | 4 |
| C: not realistically | 94 | 56 |

**Scope of the 100:** 62 affect Desktop, 15 Windows only, 6 Linux only, 9
Server or Workbench only, and 8 are not application bugs at all (builds,
packaging, a test issue). Phileas runs on macOS first, so the 21
platform-specific bugs count as C here. Running on Windows too would move
about one of them, a hang in the New Project dialog.

**Why the 56 Desktop bugs are out of reach,** grouped by hand from each
reader's stated blocker, one group per bug:

| Blocker | Bugs |
| --- | --- |
| Needs a signed-in AI service (Copilot, Posit Assistant) | 16 |
| Lives in editor contents: source, visual or console input | 11 |
| Needs particular R code or data run first | 9 |
| Needs a machine condition: full disk, network failure, an install, an R build | 8 |
| Unreachable interface: iframe, native dialog, canvas drag, a restart | 6 |
| Reachable, but needs one specific sequence: a scripted test's job | 4 |
| Reachable, but no check would state the fault (wording, colors) | 2 |

## The six it could find

- **A, 17790.** Quitting while a modal dialog is open leaves the window grey
  and the process running. It was found the same way originally: a test that
  ended with a dialog open could not close the application. Every Route
  closes the application at its end, so any Route that ends inside a dialog
  meets it. Today a shutdown that fails is attached to the Route's result
  rather than failing it, so phase 5 has to decide that it counts.
- **A, 15757.** An image in the Console toolbar with no text. Found only if
  the named-controls check covers images, which it does not today: the
  survey reports unnamed elements only among roles it can hop to. It was
  found by an accessibility scanner, which does it better.
- **B, 18134.** Switching a document to visual mode sometimes stalls on its
  loading spinner forever. A Fix opens a document with some content, and the
  Trip clicks the visual-mode toggle often, since it is always on screen; the
  rule is that no loading spinner stays up past a set time. The stall is
  intermittent, and a Route that toggles many times gives it many chances.
  RStudio's own scripted suite met it, flakily, which is the same bug
  surfacing by chance rather than being looked for.
- **B, 16299.** Emptying the package repository setting raises an error. A
  Fix opens the Packages page of Global Options; a Trip hop that types the
  empty value into the repository field and a later one that clicks OK
  trigger it. The rule is that RStudio's own error dialog never appears,
  narrowed for dialogs that are expected. The odds depend on how the page is
  laid out, which the issue does not show.
- **B, 15673 and 15788.** Two Help menu links, one to a retired domain and
  one that returns 404. The external-link stub records every URL a Route
  opens, and a rule checks each against the current domains. A Route draws
  one given menu entry about once in 16 Routes. But a link checker run over
  the source finds both without launching anything, so Phileas adds nothing
  for this kind of bug.

**What moved to C on the second pass,** each for the reason in the appendix:
a folded chunk that stays folded (18668) and wrong tabs restored after a
reload (17944) need specific sequences a Route draws too rarely; a Copilot
restart prompt (16153) and a banner lost at startup (18166) are expected
results for one sequence, which is a scripted test; and a project ID that
changes (15405) needs a restart and a project made by an older release.

## What this means

**Universal checks alone find almost nothing here.** Two in a hundred is a
floor, not a verdict on the engine, but it says RStudio would not pay back an
adapter with no checks of its own.

**Rules written for RStudio add little more, because of odds rather than
checks.** Most reachable bugs need two or three particular steps in order, and
a random draw across RStudio's surface lands on a given sequence too rarely to
count on. A Fix can shorten the sequence, but a Fix written to reach one bug
is a scripted test with extra steps.

**The engine's cheapest improvements barely move the number.** Scrolling,
right-click and reading inside frames, the gaps `../OUTSTANDING.md` 1.9
records, would not on their own reach any of these bugs: each one they
would open up also needs editor contents, R data, or a check for something
visual. The limit is that most
bugs need a state, not a path, and random travel is a way of finding paths.

**Two gaps showed up that nothing records yet.** A restart within a Route,
since a Route starts fresh and so never sees a setting that fails to persist
(17177). And AI features, a quarter of the Desktop bugs: they need a live
account, and a model's output cannot be replayed from a seed.

**Where Phileas fits,** read from the three nothing else would catch: a
failure that is intermittent, which repetition finds and a single scripted
pass passes by (18134); state left behind when a Route ends somewhere
unplanned (17790); and a dialog pushed into a value nobody tried (16299).
Each is a small class, and together they are three in a hundred.

## Limits of this measurement

- **One reader per issue.** No second reader checked agreement, and the
  verdicts rest on issue text rather than on reproducing anything.
- **Issue text is not the bug.** Where a report gives a narrow trigger, a
  broader one may exist that random travel would hit.
- **The tracker is filtered.** It holds what escaped RStudio's own testing,
  which is the population Phileas targets. It does not hold what that testing
  already catches.
- **The sample leans on recent work.** A quarter of the Desktop bugs are in
  AI features built in the last two years, and a different window would
  weigh differently.

## Appendix: every issue

Columns: issue number, verdict, scope, where the bug lives, what kind of
check would detect it, and what blocks reaching it. Rows changed on the
second pass say so in the last column.

| Issue | Verdict | Scope | Surface | Detection | Blocker |
| --- | --- | --- | --- | --- | --- |
| 15292 | C | windows-only | console / R history | app-check | needs specific R code typed in the console on Windows |
| 15312 | C | desktop | visual markdown editor | app-check | needs specific file content (non-R chunks) and the visual editor |
| 15339 | C | not-app | packaging scripts | none | build scripts, not the running app |
| 15387 | C | desktop | console at startup | app-check | needs an .Rprofile calling readline |
| 15396 | C | linux-only | startup / GPU init | universal | Fedora with a particular GPU setup |
| 15405 | C | desktop | Project Options dialog | app-check | second pass, from B: needs a project made by an older release and a restart within the Route |
| 15415 | C | linux-only | Quarto render | app-check | Ubuntu-specific memory environment |
| 15452 | C | desktop | visual markdown editor | app-check | editor contents and cursor placement |
| 15482 | C | windows-only | data viewer satellite window | universal | second window and iframe data grid |
| 15529 | C | server-only | server logging | universal | RStudio Server in a container |
| 15531 | C | desktop | Help iframe | visual-only | iframe |
| 15589 | C | windows-only | startup / Electron | universal | Windows location permission prompts |
| 15609 | C | windows-only | startup | universal | Windows with Defender scanning |
| 15636 | C | server-only | server startup crypto | universal | FIPS kernel and server container |
| 15673 | B | desktop | Help menu | app-check | - |
| 15724 | C | windows-only | data viewer (Python) | oracle-only | needs Python, pandas and a Snowflake connection; iframe |
| 15749 | C | server-only | server service startup | universal | RStudio Server systemd service |
| 15757 | A | desktop | Console toolbar | universal | only if the named-controls check covers images; an accessibility scanner finds it more cheaply |
| 15788 | B | desktop | Profile menu | app-check | - |
| 15797 | C | desktop | Import Dataset dialog | none | native file picker and a text file to import |
| 15831 | C | desktop | File > New File menu | app-check | specific machine and Quarto install |
| 15848 | C | desktop | Copilot | none | needs a Copilot account at its usage limit, network |
| 15858 | C | desktop | Copilot startup | app-check | needs Copilot sign-in and a log level set |
| 15884 | C | desktop | visual editor Copilot ghost text | visual-only | needs Copilot and editor contents |
| 15917 | C | linux-only | source editor save | universal | needs a synced network folder changing timestamps |
| 15919 | C | desktop | Environment pane | oracle-only | needs specific R code in console |
| 15942 | C | desktop | Copilot options | app-check | needs network download from a redirected server |
| 15947 | C | not-app | file on disk | none | needs a corrupted file from a crash |
| 16001 | C | desktop | working directory / Quarto | app-check | needs terminal, R code and Quarto document |
| 16024 | C | desktop | Copilot options | app-check | needs a paid Copilot account and network |
| 16067 | C | desktop | project file monitoring | app-check | needs a large project on Linux or a shared drive |
| 16085 | C | desktop | folder picker | app-check | native dialog |
| 16129 | C | desktop | Copilot language server | app-check | needs Copilot enabled and a log setting in .Renviron |
| 16147 | C | linux-only | startup | universal | Fedora GTK environment |
| 16153 | C | desktop | Global Options Copilot | app-check | second pass, from B: an expected result for one sequence of toggles, which is a scripted test |
| 16204 | C | windows-only | startup | universal | Windows install missing R libraries |
| 16299 | B | desktop | Global Options Packages | app-check | second pass, from C: reachable through a Fix into Global Options; the error needs a rule against RStudio's own error dialog |
| 16320 | C | desktop | Create SSH key dialog | none | - |
| 16337 | C | desktop | console | oracle-only | needs specific R code |
| 16355 | C | desktop | R Markdown chunk output | app-check | editor contents and packages |
| 16376 | C | desktop | Packages vulnerability modal | none | needs renv-installed vulnerable package |
| 16414 | C | not-app | release process | none | build infrastructure |
| 16446 | C | windows-only | file download | app-check | needs R code, a package and network |
| 16460 | C | windows-only | New Project dialog | universal | Windows only |
| 16463 | C | desktop | source editor Quarto | visual-only | editor contents |
| 16483 | C | desktop | Quarto inline output | oracle-only | editor contents and packages |
| 16537 | C | desktop | visual markdown editor | app-check | drag from external application |
| 16656 | C | server-only | askpass modal | app-check | server and terminal command |
| 16722 | C | desktop | Copilot status bar | none | needs Copilot set up with suggestions |
| 16740 | C | windows-only | file open routing | app-check | second window and OS file manager |
| 16757 | C | desktop | source editor (Copilot) | visual-only | needs signed-in Copilot and editor contents |
| 16839 | C | windows-only | session log | universal | Windows with a bogus PATH entry |
| 16901 | C | desktop | Posit Assistant token usage | none | needs Posit AI account |
| 16930 | C | linux-only | Environment pane memory report | oracle-only | Linux cgroup setup |
| 16957 | C | desktop | Posit Assistant | none | needs Posit AI account and a missing package |
| 16965 | C | desktop | Terminal pane | none | canvas terminal and mouse drag |
| 16985 | C | desktop | Environment pane | oracle-only | needs specific R code in the console |
| 17007 | C | windows-only | source editor key bindings | app-check | Windows only |
| 17023 | C | desktop | Posit Assistant and Console | app-check | needs Posit AI account |
| 17042 | C | windows-only | Posit Assistant | universal | needs Posit AI account on Windows |
| 17126 | C | not-app | packaging | none | third-party Fedora build |
| 17144 | C | desktop | Copilot | none | needs Copilot account |
| 17177 | C | desktop | pane layout | app-check | needs an app restart within the Route |
| 17183 | C | not-app | R package install on FreeBSD | none | not RStudio |
| 17190 | C | not-app | issue tracker | none | not a bug |
| 17237 | C | desktop | Copilot | none | needs Copilot account |
| 17249 | C | server-only | Posit Assistant WebSocket | universal | server behind a subpath proxy |
| 17293 | C | desktop | R notebook save | none | needs a notebook with many complex plots |
| 17391 | C | desktop | publishing | app-check | needs an old rsconnect and a Connect Cloud OAuth flow |
| 17423 | C | server-only | Posit Assistant connectivity | universal | server over plain HTTP or behind a proxy |
| 17450 | C | windows-only | startup | universal | Windows and a custom Rprofile.site |
| 17494 | C | desktop | Posit Assistant | none | needs Posit AI account and a dataset |
| 17613 | C | desktop | data viewer | none | iframe and needs a data frame opened from R |
| 17650 | C | desktop | Select Repository dialog | visual-only | needs a dark theme applied first |
| 17738 | C | desktop | Source pane | app-check | needs file.edit typed as R code right after Close All |
| 17790 | A | desktop | shutdown with modal open | universal | - |
| 17845 | C | desktop | Find in Files replace | app-check | needs a full disk and files with matches |
| 17865 | C | windows-only | R session paths | none | Windows mapped network drive |
| 17893 | C | linux-only | R library paths | oracle-only | Fedora-specific R install |
| 17944 | C | desktop | Source pane tabs | app-check | second pass, from B: needs several documents opened in a particular order, then a reload; odds negligible |
| 18003 | C | windows-only | format on save | oracle-only | needs Air installed and a project with air.toml |
| 18019 | C | desktop | startup | universal | transient connection failure during bootstrap |
| 18033 | C | desktop | source editor ghost text | app-check | editor contents |
| 18037 | C | desktop | Posit Assistant / Plots pane | app-check | needs AI assistant service |
| 18089 | C | desktop | key bindings | none | shortcut not among common keys; editor contents |
| 18110 | C | server-only | Packages pane | universal | needs reticulate and pipenv setup, session resume |
| 18134 | B | desktop | visual markdown editor | app-check | needs a document with content |
| 18143 | C | desktop | Object Explorer | app-check | needs R code creating reference class objects |
| 18166 | C | desktop | startup warning bar | app-check | second pass, from B: a preference set before launch and one assertion at startup, which is a scripted test |
| 18244 | C | server-only | HTTP request internals | none | no observable behavior |
| 18250 | C | desktop | startup | universal | specific R build and OS version |
| 18277 | C | desktop | AI assistant agent | app-check | needs a broken node or missing assistant install |
| 18317 | C | desktop | console / assistant variable monitor | app-check | needs R code with data.table |
| 18363 | C | not-app | e2e test helper | none | test code only |
| 18425 | C | desktop | completion popup in source editor | universal | editor contents and completion timing |
| 18447 | C | desktop | console input | none | console input and a non-common key combination |
| 18469 | C | desktop | source editor folding | app-check | editor contents; fold gutter click |
| 18515 | C | not-app | Windows installer packaging | none | build packaging |
| 18626 | C | server-only | localhost proxy | none | needs a chunked upstream local server |
| 18668 | C | desktop | code folding menu | app-check | second pass, from B: needs Collapse All then Expand All in order, about once in 500 Routes |
