# Research: how much of Positron's real bug stream Phileas could find

*Measured 2026-09-26, against the engine as planned through phase 6.*

## The question

The same question `rstudio-effectiveness.md` asked of RStudio, asked of
Positron, the other large application the engine is meant for
(`../OUTSTANDING.md` 1.8). Positron was expected to do better: its release
launches the ordinary way, so the main process and the menu are in reach
without a build from source, and more of its interface is drawn from
ordinary controls.

## The answer

**About the same as RStudio: five bugs in a hundred.** Of 100 fixed bugs drawn
at random, 2 could plausibly be found by the universal checks alone, 3 more
with rules written for Positron, and 95 not realistically at all. Restricted
to the 71 that affect the Positron desktop app, it is 2, 3 and 66.

**The easier launch did not help, because launch was never the limit.** Eight
bugs in ten needed an environment a Route does not have. For Positron that
is mostly a running interpreter doing something particular: R or Python code,
a package, a dataset, a debugging session. Another quarter of the Desktop bugs
sit behind a signed-in AI provider.

## Method

The RStudio study's method, with three differences.

**Population:** every issue in `posit-dev/positron` labeled `bug`, closed as
completed, and opened on or after 2024-09-26. That was 768 issues on
2026-09-26. Positron has no duplicate, not-reproducible or won't-fix labels,
so nothing further was excluded. The same search returned 1,828 for
`label:bug` alone, as the positive control.

**Sample:** 100 drawn with the same seed, `20260926`, the same way.

**Rubric:** the RStudio rubric as its second pass left it, applied from the
start: a check counts only if it is a rule that holds whatever the Trip did,
and the odds are worked out from the draw shares. It also stated what was
measured on Positron: the editor's text layer and the terminal are out of
reach, Help and the Viewer are webviews the survey cannot enter, the data
explorer is drawn in the page, and the console-error check needs narrowing
because Positron writes to the console in normal operation. No verdict was
changed on review.

## Results

| | All 100 | Desktop, 71 |
| --- | --- | --- |
| A: universal checks | 2 | 2 |
| B: rules written for Positron | 3 | 3 |
| C: not realistically | 95 | 66 |

**Scope of the 100:** 71 affect the desktop app, 12 Windows only, 3 Linux
only, 11 Server, Workbench or a remote host only, and 3 are not application
bugs.

**Why the 66 Desktop bugs are out of reach,** grouped by hand from each
reader's stated blocker, one group per bug:

| Blocker | Bugs |
| --- | --- |
| Needs an interpreter running particular code, packages or data | 27 |
| Needs a signed-in AI provider (Positron Assistant) | 18 |
| Needs a machine condition: a tool installed, a screen size, an extension | 8 |
| Unreachable interface: a webview, native dialog, drag, hover, scroll, a restart, a key not offered | 7 |
| Reachable, but no check would state the fault (layout, colors, nothing happening) | 5 |
| Reachable, but needs one specific sequence: a scripted test's job | 1 |

## The five it could find

- **A, 7776.** A toolbar in the Console panel leaks a disposable object and
  says so in the browser console every time it draws, which is nearly every
  Route. The console-error check catches it, provided its narrowing for
  Positron's routine logging does not also swallow this message. Positron's
  own end-to-end runs logged it without failing, so making those runs fail on
  that console message would have caught it more cheaply.
- **A, 7098.** Switching a Quarto document to its visual editor failed with
  an extension's command not found, written to the extension host's log. A
  Fix opens a Quarto document, the toggle is on screen on every Hop, and the
  log check reads the log if the adapter names it. A single scripted test of
  the toggle would have caught it too.
- **B, 5460.** Restarting a notebook's kernel timed out with an error
  notification and nothing in the console. A Fix opens a notebook, the
  restart control is always on screen and is drawn in most Routes, and the
  rule is that Positron's error notification never appears.
- **B, 6029.** Starting and then stopping an interpreter left stale sessions
  listed in the Variables pane. The rule is that the pane's session list
  matches the running sessions. The Route needs to start and stop one
  through the always-visible interpreter control, which happens in a few
  Routes in a hundred.
- **B, 6480.** A data explorer whose interpreter stopped did not show its
  closed state. The rule is that an explorer whose session ended says so.
  The stop has to land while an explorer a Fix opened is still showing.

**All three B verdicts need an interpreter the adapter installs.** That is
setup any Positron adapter would have, rather than setup written for one bug,
so they count.

## Compared with RStudio

| | RStudio | Positron |
| --- | --- | --- |
| Found by universal checks | 2 | 2 |
| Found by rules for the application | 4 | 3 |
| Needed an environment a Route lacks | 70 | 80 |
| Desktop bugs behind an AI account | 16 of 62 | 18 of 71 |

**The two agree closely, and the easier launch bought nothing measurable.**
What the found bugs share is also the same on both: something that
repetition finds (a stall, a timeout), or state left inconsistent by starting,
stopping or restarting something. On Positron all three rules are about
interpreter lifecycle, which suggests where rules for Positron would pay
first.

## Limits of this measurement

The RStudio study's limits apply unchanged: one reader per issue, verdicts
from issue text, a tracker that holds only what escaped existing testing, and
a window weighted toward recent AI work. One more applies here: Positron's
tracker has no label for reports that could not be reproduced, so a few of
the 768 may be reports nobody confirmed.

## Appendix: every issue

Columns: issue number, verdict, scope, where the bug lives, what kind of
check would detect it, and what blocks reaching it.

| Issue | Verdict | Scope | Surface | Detection | Blocker |
| --- | --- | --- | --- | --- | --- |
| 4977 | C | desktop | data explorer summary pane | visual-only | needs an ultrawide maximized window |
| 5012 | C | desktop | console input | none | needs an unfinished R statement sent from an editor |
| 5068 | C | desktop | plots pane | visual-only | needs matplotlib and specific Python code |
| 5155 | C | desktop | R debugger call stack | oracle-only | needs an R debugging session with nested calls |
| 5171 | C | desktop | help pane vignette links | none | needs the cli and fs packages, and the result is inside a webview |
| 5195 | C | windows-only | new folder and new project modals | universal | Windows paths only |
| 5210 | C | desktop | reticulate object passing | oracle-only | needs reticulate, arrow and a Python venv |
| 5295 | C | desktop | notebook cell execution queue | app-check | needs a slow cell that raises, with a second cell queued behind it |
| 5338 | C | desktop | viewer pane for htmltools output | none | needs htmltools and devtools and specific R code |
| 5460 | B | desktop | notebook kernel restart | app-check | - |
| 5473 | C | server-only | variables pane scrolling | none | web build only, and needs mouse wheel scrolling |
| 5603 | C | desktop | notebook cell output scrolling | none | needs large cell output and scrolling |
| 5616 | C | server-only | workbench create folder dialog | none | Workbench server with a Windows browser client |
| 5692 | C | windows-only | connections pane reconnect code | none | Windows paths and a SQLite connection |
| 5744 | C | desktop | data explorer number formatting | universal | needs a specific R data frame mixing small and large integers |
| 5948 | C | desktop | notebook path completions | oracle-only | needs a notebook in a workspace subfolder and a typed string literal |
| 5975 | C | server-only | reprex output in web build | universal | web build and the reprex package |
| 6029 | B | desktop | variables pane session menu | app-check | needs interpreters installed by the adapter |
| 6087 | C | server-only | workbench server native module | universal | RHEL9 Workbench server |
| 6113 | C | desktop | plots pane multiple plots | oracle-only | needs ggplot2 and multi-plot R code |
| 6258 | C | server-only | console output rendering | universal | remote or Workbench host with polars |
| 6267 | C | server-only | remote SSH Python runtime | universal | remote SSH host |
| 6275 | C | desktop | interpreter picker | app-check | needs pyenv virtualenvs on the machine |
| 6397 | C | desktop | reticulate Python session startup | app-check | needs reticulate without ipykernel installed |
| 6480 | B | desktop | data explorer closed-connection state | app-check | - |
| 6485 | C | desktop | data explorer summary panel | app-check | needs a dataset loaded in the data explorer, which a Fix must set up |
| 6538 | C | desktop | Jupyter notebook input() | app-check | needs a Python kernel and a cell containing input() code, which random typing never produces |
| 6553 | C | desktop | R debugger and kernel restart | universal | needs an R interpreter and an active debug session |
| 6634 | C | desktop | R console prompt rendering | visual-only | needs R, a third-party package and specific R code |
| 6746 | C | desktop | plots pane with raster packages | visual-only | needs R with terra, raster or stars and plotting code |
| 6799 | C | desktop | project picker and session reconnection | universal | needs several recent projects and running interpreters, and switching projects reloads the window |
| 6883 | C | desktop | editor Run button menu | app-check | needs a Shiny for Python app.py file open |
| 6933 | C | desktop | Python diagnostics via Pyright extension | oracle-only | needs a third-party extension version, Python files and diagnostics content |
| 6975 | C | windows-only | R kernel crash | universal | Windows only, and needs R packages, network download and specific code |
| 7098 | A | desktop | Quarto visual editor toggle | universal | - |
| 7339 | C | desktop | Python interpreter discovery at startup | app-check | needs a user setting applied and then an application restart |
| 7385 | C | desktop | data explorer via View() with magrittr pipe | app-check | needs R with tidyverse and specific pipe code |
| 7410 | C | server-only | remote SSH R session file opening | oracle-only | needs a remote SSH host and R code |
| 7453 | C | desktop | Assistant add language model button | none | - |
| 7500 | C | desktop | Assistant tool calls with large content | none | needs an AI provider account and a specific model |
| 7586 | C | desktop | Assistant generated plotting code | none | needs an AI provider account and Python plotting |
| 7709 | C | desktop | Quarto visual editor statement execution | app-check | needs an R interpreter, multi-line code in a chunk and cursor placement |
| 7774 | C | desktop | Assistant inspect variables tool | universal | needs an AI provider account and a Python session |
| 7776 | A | desktop | console panel toolbar dropdown | universal | - |
| 7844 | C | desktop | Assistant with AWS Bedrock models | app-check | needs an AWS Bedrock account |
| 8005 | C | windows-only | Python native locator for uv interpreters | oracle-only | Windows only, and needs uv-installed Pythons |
| 8434 | C | desktop | Settings UI in high contrast themes | visual-only | needs a high contrast theme selected |
| 8622 | C | desktop | Assistant chat rendering | visual-only | needs an AI provider account, several chats and scrolling |
| 8794 | C | desktop | rstudioapi restartSession frontend method | universal | needs R, rstudioapi and specific R code |
| 8971 | C | desktop | Assistant getTableSummary tool | universal | needs an AI provider account and a Python session with data |
| 9070 | C | desktop | notebook code completion | oracle-only | needs a running Python kernel and real Python code typed into a cell |
| 9166 | C | desktop | Jupyter extension host placement | app-check | depends on a random extension-host split with live R and Python sessions |
| 9181 | C | server-only | Assistant commit context on Workbench | app-check | Workbench only, plus a Git repo and AI provider account |
| 9216 | C | windows-only | R package check task | universal | Windows only, custom R install and Git bash |
| 9288 | C | desktop | Assistant commit message provider choice | none | needs several AI provider accounts and a Git repo |
| 9390 | C | server-only | terminal paste in browser | visual-only | browser sessions in Workbench, clipboard paste into the terminal |
| 9471 | C | windows-only | Assistant Apply in Editor with Copilot | app-check | needs a Copilot account and a chat response |
| 9673 | C | desktop | notebook working directory dialog path | oracle-only | needs a Python kernel and saving through a native Save dialog |
| 9740 | C | windows-only | Python plotting crash under conda | universal | Windows plus a conda environment and matplotlib code |
| 9883 | C | desktop | Assistant Apply in Editor on large files | app-check | needs an AI provider account and a large file |
| 9944 | C | not-app | Python CI type check | none | CI build failure, not app behavior |
| 9989 | C | desktop | run button in split editor | oracle-only | needs an interpreter session and two script files open side by side |
| 10136 | C | windows-only | interpreter discovery over Remote-SSH | none | remote host over SSH |
| 10271 | C | windows-only | third-party SAS extension runtime | app-check | needs a third-party extension installed |
| 10671 | C | desktop | Assistant editFile tool timing | none | needs an AI provider in Agent mode |
| 10713 | C | desktop | Python console stray REPL hint | app-check | needs a Python interpreter session and appears only occasionally |
| 10793 | C | desktop | Assistant model picker after sign-in | app-check | needs AI provider accounts |
| 10825 | C | server-only | Assistant Manage Models on Workbench | app-check | Workbench plus AI provider accounts |
| 11033 | C | desktop | Assistant Manage Models panel empty | app-check | needs signed-in AI providers |
| 11115 | C | desktop | chat pane selection color with a theme | visual-only | needs a particular third-party theme and chat content |
| 11230 | C | linux-only | console startup after upgrade | universal | Linux, first launch after changing the installed version |
| 11359 | C | desktop | Assistant agent file creation | universal | needs an AI provider in Agent mode |
| 11537 | C | desktop | Assistant provider auth status | app-check | needs manual authentication to an autoconfigurable AI provider |
| 11611 | C | desktop | notebook cell navigation scroll | visual-only | Alt+arrow is not among the keys a Hop presses, and it needs a notebook with many cells |
| 12019 | C | desktop | Custom Title Bar menu entry | none | - |
| 12070 | C | desktop | assistant Bedrock provider | oracle-only | needs a configured AWS Bedrock account |
| 12113 | C | desktop | New Folder from Template dialog | visual-only | - |
| 12124 | C | desktop | variables pane layout | none | moving a pane needs drag |
| 12214 | C | desktop | assistant custom model settings | oracle-only | needs a Snowflake Cortex account and custom settings |
| 12259 | C | desktop | assistant MCP autostart | app-check | needs a signed-in AI provider to start a chat |
| 12492 | C | windows-only | PDF viewer printing | none | needs a PDF file, lives in a webview, reported on Windows |
| 12512 | C | windows-only | code editor horizontal scrollbar | visual-only | inside the editor text layer; reported on Windows |
| 12642 | C | desktop | R debugger browser() session | oracle-only | needs an R interpreter and meaningful R code |
| 12806 | C | desktop | notebook ipywidgets theming | visual-only | needs Python with ipywidgets and polars, output in a webview |
| 13016 | C | not-app | Windows installer registry entries | none | installer behavior on Windows |
| 13234 | C | desktop | PDF viewer text copy | oracle-only | needs a PDF file, lives in a webview, needs text selection |
| 13456 | C | linux-only | variables pane column resize | none | needs drag; reported on Linux |
| 13854 | C | desktop | sidebar header button tooltips | visual-only | needs hover |
| 13947 | C | desktop | assistant GitHub Copilot models | app-check | needs a GitHub Copilot account and network |
| 14294 | C | desktop | Packages pane outdated flags | oracle-only | needs a new R version installed by rig and a pak cache state |
| 14822 | C | server-only | web help welcome page bug report popup | visual-only | Positron on the web in Firefox |
| 14887 | C | desktop | Python install via uv onboarding | none | needs the uv install flow with network and no workspace |
| 14904 | C | desktop | Connections generated code switcher | visual-only | the dialog likely needs a connection driver in the environment |
| 15031 | C | windows-only | update notifications | app-check | needs the daily update channel, network and hours of waiting |
| 15187 | C | not-app | e2e test for assistant welcome page | none | test-only issue in CI |
| 15248 | C | desktop | assistant custom provider sign-in | universal | needs a custom provider endpoint with required headers |
| 15254 | C | desktop | Python console plot rendering | app-check | needs Python with matplotlib and specific code |
| 15275 | C | desktop | Quarto inline output plot popout | app-check | needs a setting, a .qmd file and an interpreter producing a plot |
| 15509 | C | linux-only | Python module environment sessions | universal | needs environment modules on an EL9 system |
| 15578 | C | desktop | console interrupt button | app-check | needs two interpreter consoles and a long-running command |
