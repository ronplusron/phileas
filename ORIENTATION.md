# Phileas -- orientation for a new session

## 1. What it is

An exploratory testing engine. It walks an Electron application without a
script, picks its own next move from what the screen actually offers, checks a
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

**Scaffold and documentation only.** The repository holds `package.json`,
`tsconfig.json`, `.gitignore`, the README, this file, `CLAUDE.md` and five
documents under `docs/`. There is no engine code at all: `src/`,
`src/invariants/`, `tests/` and `examples/` contain nothing but `.gitkeep`.

`package.json` declares no dependencies. `npm run typecheck` and `npm test`
are both inert until `typescript` and `@playwright/test` are added, so neither
is evidence of anything today.

The remote is `ronplusron/phileas`, private, created 2026-09-21 and scanned
before first publication.

`docs/PRODUCT_REQUIREMENTS.md` is written. The product is scoped to Electron
applications, with the seam kept capable of other targets that render to a
browser-style page, though none is promised. Read it before anything else.

**`docs/PLAN.md` is a stub and is the next thing to write.** It is being
worked through directly rather than drafted ahead, and it could not be written
before the requirements it sequences.

`docs/OUTSTANDING.md` holds what is open. Two items gate work rather than
waiting quietly: which sibling repositories are actually intended as
consumers, where two earlier records disagree, and what becomes of three of
the seven files being lifted out of the sibling repository.

## 3. Part of this engine already exists, in a sibling repository

The launch and bundle layer was written inside a sibling Electron project's
Playwright suite and deliberately structured to be lifted out: 613 lines
across 7 files, including an `AppUnderTest` interface whose own header comment
states that the directory is meant to become a shared package that sibling
apps consume. `docs/PLAN.md` says where it is and what moving it involves.

**Read that code before designing any of it again.** It covers launching an
Electron app, refusing to run against a stale build, and waiting for
readiness. It contains nothing that walks an application: no traversal, no
seeding, no journal, no invariants. Those are the parts that genuinely do not
exist yet.

Nothing else from that project is this product's concern. Its adapter, its
scripted specs and its application-specific expectations stay where they are.

## 4. How to build, test, and run

```
npm install
npm run typecheck
npm test
```

**All three currently do nothing useful**, and that is the honest state rather
than a broken checkout. There are no dependencies to install, no TypeScript
to check, and no tests to run.

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
that class needs an oracle computing the expected answer from a source of
truth, and `CLAUDE.md` records the trap that makes oracles fail silently.
