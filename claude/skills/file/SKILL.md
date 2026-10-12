---
name: file
description: Draft or file an issue for a Phileas finding, in the tracker the Journey's filing.json names, then mark the finding filed in known-findings.json. Use when asked to file, report or write up a Phileas finding, open an issue for one, or file a draft a triage left.
---

# Filing a finding

## Where it goes

The Journey's folder (`phileas/`) may hold `filing.json`:

- `repository`, as `owner/name`: where findings are filed.
- `titlePrefix`: what every title starts with, such as the application's
  name and a colon.
- `labels`: added to each issue.
- `noOtherRepositoryLinks`: when true, nothing filed may link an issue or
  pull request of another repository, so that one gets no link back.
- `rules`: anything else this tracker asks of a draft. Follow each one.
- `environment`: what is launched and how, as lines the Environment section
  states. Nothing else about the environment goes in a draft unless the run
  records it.

With no `filing.json`, ask where to file before drafting.

## The draft

A triage leaves drafts in the run's `triage/drafts/`, one `.md` to read and
one `.json` per finding, and names in each anything that would stop it being
filed. Otherwise draft one as the `triage` skill's "Drafts" section
describes: Environment, steps a person can follow, what happened, what was
expected, the Route as recorded in a collapsed section, and the finding's id
and seed in a closing comment. If a skill for writing bug reports in a house
style is available, use it for the wording.

**Before filing, check the steps were run on their own.** A triage's steps
are read from the Route; the `reproduce` skill confirms them from a fresh
launch. Say which, in the draft, and offer to confirm them first.

**Before showing a draft, check it as filing will:** ASCII only, no bare
`#N`, and with `noOtherRepositoryLinks`, no other repository's `owner/name#N`
or issue or pull request address. `phileas view` refuses to file a draft that breaks
any of these, and so should this.

## Filing it

Filing publishes it, and it cannot be taken back. **Show the title and body
and wait for a yes for that one draft.** A yes to one is not a yes to the
next.

```
gh issue create --repo <repository> --title "<title>" --body-file <file>
```

Then record it, with the issue as `owner/name#N`:

```
npx phileas known add <finding id> --issue <owner/name#N> [known-findings file]
```

The `known-findings.json` beside the config is the default. Say both results:
the issue's address, and the line `known add` printed.

## Never, without a yes for that one change

- `phileas known dismiss`, which marks a finding a false alarm.
- `phileas known remove`, which makes it new again.
- Editing `known-findings.json` by hand.

Each decides which findings end a Route from then on.
