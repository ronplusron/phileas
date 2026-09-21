# Phileas -- orientation for a new session

## 1. What it is

An exploratory testing engine. It travels through an Electron application
without a script, picks its own next move from what the screen actually offers,
checks a
set of invariants after every move, and reports what it found along with the
exact route it took to get there. It complements a scripted suite rather than
replacing one: the scripted suite covers the paths someone thought to write
down, and this covers the rest.

**The framework is the deliverable, not any one application's test coverage.**
Decisions that look like over-engineering for a single app are correct when
the engine is the product. That reading settles arguments: an adapter
enumerating every control in one application would be more precise and would
stop this being a framework, so generic discovery wins even where it costs
accuracy. `CLAUDE.md` records the commitments this produced.

`docs/PRODUCT_REQUIREMENTS.md` says what the product must do, apart from how
it gets built, and is the one to read first. Standing commitments live in
`CLAUDE.md` and the build order in `docs/PLAN.md`. None of the three is
summarized here -- read them.

## 2. Current state

**Documentation, and a toolchain that compiles nothing.** The repository
holds `package.json`, `tsconfig.json`, `.gitignore`, the README, this file,
`CLAUDE.md` and five documents under `docs/`. There is no engine code:
`src/` holds one deliberately empty `index.ts`, and `src/oracles/`, `tests/`
and `examples/` contain nothing but `.gitkeep`.

**Phase 0 is done.** The four dependencies are installed and
`npm run typecheck` passes, which proves the toolchain exists and nothing
else. `npm test` reports no tests found, correctly, since the first of this
engine's own tests arrives in phase 3.

The remote is `ronplusron/phileas`, private, created 2026-09-21 and scanned
before first publication.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

`docs/PLAN.md` is written: ten phases, three of whose boundaries are real
verification points rather than bookkeeping.

**Phase 1 is the next thing to do, and one question sits in front of it.**
It lifts seven files out of `trickster-tales` and hardens `AppUnderTest`
around them, and what the interface has to carry is the question
`docs/OUTSTANDING.md` holds. The hardening is where that answer becomes
permanent, so it is worth settling rather than guessing past.

`docs/OUTSTANDING.md` holds what is open. Its section 1 gates phase 1 rather
than phase 0: how much `AppUnderTest` has to carry now the consumers are
known, which deployment shape each consumer uses, and whether the plan's
proposed homes for three lifted files are accepted.

**Two research readings are recorded in `docs/HISTORY.md` and worth knowing
before designing anything.** Discovery by accessibility role was measured
against a real application and works, with its limit set by rendering
technique rather than by how interesting a surface is. And the engine cannot
require an application to tell it when it has settled: two mature suites were
examined and neither has such a signal, so the strategy has to work without
cooperation.

## 3. Part of this engine already exists, in a sibling repository

The launch and bundle layer was written inside a sibling Electron project's
Playwright suite and deliberately structured to be lifted out, including an
`AppUnderTest` interface whose own header comment states that the directory is
meant to become a shared package that sibling apps consume. `docs/HISTORY.md`
has what was measured; `docs/PLAN.md` says what moving it involves.

**It is `e2e/kit/` in `trickster-tales`, which is a project on hold rather
than one of the confirmed consumers.** Worth stating, because no document
said it before and finding it took a search of every checkout on the
machine. Two things follow. The kit is not going to keep moving underneath
this work, since the project holding it is not being worked on. And neither
confirmed consumer has anything like it: the one with a Playwright suite has
two flat spec files that call `electron.launch` directly, so there is no
second copy anywhere to reconcile against.

**Read that code before designing any of it again.** It covers launching an
Electron app, refusing to run against a stale build, and waiting for
readiness. It contains nothing that travels through an application: no
traversal, no seeding, no journal, no invariants. Those are the parts that
genuinely do not exist yet.

Nothing else from that project is this product's concern. Its adapter, its
scripted specs and its application-specific expectations stay where they are.

## 4. How to build, test, and run

```
npm install
npm run typecheck
npm test
```

`npm install` installs four dependencies and `npm run typecheck` passes over
one empty file. **Neither is evidence about the product**, only that the
toolchain works. `npm test` reports no tests found, which is correct rather
than broken: there is nothing to test until phase 3.

Playwright's downloaded browsers are not needed and installing did not fetch
any. The engine drives an Electron binary through Playwright's own Electron
support, never one of those browsers.

`tsconfig.json` is `noEmit` with `strict` and `noUncheckedIndexedAccess` on.
`noUncheckedIndexedAccess` is not tidiness: a traversal engine indexes into
arrays of discovered elements constantly, and that flag is what forces the
empty-survey case to be handled rather than crashing on a route that found
nothing to do.

## 5. Verification, and its limits

Nothing is verified, because nothing is built.

**The limit worth knowing before writing any of it:** a bug-finder that passes
its own tests has demonstrated nothing about whether it finds bugs. Its own
suite can only show that its parts behave as written. The real evidence is an
application with deliberately planted bugs, pointed at the engine, asserting
that each one is found -- which is what `examples/` is for and why it is not
an optional extra.

A second limit is inherent rather than a gap to close. Metamorphic checks buy
self-consistency, not correctness: a bug that is consistently wrong passes
every round-trip, idempotence and commutativity relation there is. Catching
that class needs a test oracle computing the expected answer from a source of
truth, and `CLAUDE.md` records the trap that makes oracles fail silently.
