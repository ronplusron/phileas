// Where a consumer files its findings, and the checks a draft must pass before
// it is filed.
//
// A consumer keeps `filing.json` beside its Playwright config, in `phileas/`:
//
//   {
//     "repository": "owner/name",
//     "titlePrefix": "RStudio: ",
//     "labels": ["bug"],
//     "noOtherRepositoryLinks": true,
//     "rules": ["anything else a draft for this tracker must follow"],
//     "environment": ["what is launched, and how, as a draft states it"]
//   }
//
// `environment` is there because a run does not record what was launched: a
// triage of RStudio's run of 2026-09-29, with nothing else to go on, wrote
// that RStudio was built from source, when the trial runs a copy of the
// installed release.
//
// Only `repository` is required. The rules are read by the assistant when it
// drafts; the rest are also enforced here, by code, on every draft, since a
// rule an assistant was only asked to follow is stated rather than enforced.
// Filing is one-way, so the check runs before `gh` is ever started.
//
// Asked for on 2026-10-12 with the rest of the work after a run; docs/PLAN.md
// has it under "After the run". Plain JavaScript for the renderer's reason.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { markFiled } from '../known.mjs';

/**
 * @typedef {{
 *   repository: string,
 *   titlePrefix?: string,
 *   labels?: string[],
 *   noOtherRepositoryLinks?: boolean,
 *   rules?: string[],
 *   environment?: string[],
 * }} Filing
 */

/**
 * One drafted issue, as the triage writes it.
 * @typedef {{ finding: string, title: string, body: string, routes?: number[] }} Draft
 */

/** The file a consumer says where its findings are filed in. */
export const FILING_FILE = 'filing.json';

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

const SETTINGS = ['repository', 'titlePrefix', 'labels', 'noOtherRepositoryLinks', 'rules', 'environment'];

/**
 * The first setting in a filing file that is not one of these, which is
 * most often a misspelling, and would otherwise be ignored without a word.
 * @param {object} parsed
 * @returns {string | undefined}
 */
function unknownSetting(parsed) {
  return Object.keys(parsed).find((key) => !SETTINGS.includes(key));
}

/**
 * The filing settings beside a config, or undefined where there are none. A
 * file that is there and wrong is refused by name rather than read as none,
 * since read as none it would quietly drop the tracker's rules.
 * @param {string} configFolder
 * @returns {Filing | undefined}
 */
export function readFiling(configFolder) {
  const file = path.join(configFolder, FILING_FILE);
  if (!fs.existsSync(file)) return undefined;
  /** @type {any} */
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${/** @type {Error} */ (error).message}`);
  }
  const problem =
    typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
      ? 'is not an object'
      : typeof parsed.repository !== 'string' || !REPOSITORY.test(parsed.repository)
        ? 'needs a repository, as owner/name'
        : parsed.titlePrefix !== undefined && typeof parsed.titlePrefix !== 'string'
          ? 'has a titlePrefix that is not text'
          : parsed.labels !== undefined && !(Array.isArray(parsed.labels) && parsed.labels.every((/** @type {unknown} */ l) => typeof l === 'string'))
            ? 'has labels that are not a list of text'
            : parsed.noOtherRepositoryLinks !== undefined && typeof parsed.noOtherRepositoryLinks !== 'boolean'
              ? 'has a noOtherRepositoryLinks that is neither true nor false'
              : parsed.rules !== undefined && !(Array.isArray(parsed.rules) && parsed.rules.every((/** @type {unknown} */ r) => typeof r === 'string'))
                ? 'has rules that are not a list of text'
                : parsed.environment !== undefined &&
                    !(Array.isArray(parsed.environment) && parsed.environment.every((/** @type {unknown} */ e) => typeof e === 'string'))
                  ? 'has an environment that is not a list of text'
                : unknownSetting(parsed)
                  ? `has a setting it does not know, ${unknownSetting(parsed)}`
                  : undefined;
  if (problem) throw new Error(`${file} ${problem}`);
  return /** @type {Filing} */ (parsed);
}

/**
 * A draft's title with the tracker's prefix, added where it is missing.
 * @param {string} title
 * @param {Filing | undefined} filing
 * @returns {string}
 */
export function prefixed(title, filing) {
  const prefix = filing?.titlePrefix;
  const trimmed = title.trim();
  return prefix && !trimmed.startsWith(prefix) ? `${prefix}${trimmed}` : trimmed;
}

/**
 * What stops a draft being filed, one line each, or none. Checked by code on
 * every draft, before filing, whatever the assistant was asked:
 *
 * - a title or body that is empty;
 * - a character outside ASCII, since an issue is a git artifact;
 * - a bare `#N`, which GitHub links to issue N of the same repository;
 * - with `noOtherRepositoryLinks`, any `owner/name#N` or GitHub issue or pull
 *   request address of another repository, which would put a link back to
 *   this tracker on that one's page.
 * @param {Draft} draft
 * @param {Filing | undefined} filing
 * @returns {string[]}
 */
export function draftProblems(draft, filing) {
  /** @type {string[]} */
  const problems = [];
  if (!draft.title.trim()) problems.push('the title is empty');
  if (!draft.body.trim()) problems.push('the body is empty');
  const text = `${draft.title}\n${draft.body}`;
  // An issue is a git artifact, kept to ASCII: an em dash or a curly quote
  // is the usual slip.
  const wide = [...new Set(text.match(/[^\x00-\x7f]/gu) ?? [])];
  if (wide.length) problems.push(`it has characters outside ASCII: ${wide.join(' ')}`);
  const bare = text.match(/(?<![\w/.-])#\d+\b/g);
  if (bare) problems.push(`it has ${[...new Set(bare)].join(', ')}, which GitHub links to an issue of the same repository`);
  if (filing?.noOtherRepositoryLinks) {
    const own = filing.repository.toLowerCase();
    const references = [...text.matchAll(/(?<![\w./:-])([\w-]+\/[\w.-]+)#\d+\b/g)]
      .filter((match) => (match[1] ?? '').toLowerCase() !== own)
      .map((match) => match[0]);
    const addresses = [...text.matchAll(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/\d+/g)]
      .filter((match) => (match[1] ?? '').toLowerCase() !== own)
      .map((match) => match[0]);
    const links = [...new Set([...references, ...addresses])];
    if (links.length) problems.push(`it links another repository, ${links.join(', ')}, which filing.json forbids`);
  }
  return problems;
}

/**
 * File one draft with `gh`, then mark its finding filed in the known findings.
 * Refuses, before `gh` starts, a draft with any problem, or a tracker with no
 * filing.json. Settles with the issue as `owner/name#N`.
 * @param {Draft} draft
 * @param {{ configFolder: string, filing: Filing | undefined }} where
 * @returns {Promise<{ issue: string, url: string }>}
 */
export async function fileDraft(draft, { configFolder, filing }) {
  if (!filing) throw new Error(`there is no ${path.join(configFolder, FILING_FILE)}, so there is nowhere to file it`);
  const title = prefixed(draft.title, filing);
  const problems = draftProblems({ ...draft, title }, filing);
  if (problems.length) throw new Error(`the draft for ${draft.finding} cannot be filed: ${problems.join('; ')}`);
  const args = ['issue', 'create', '--repo', filing.repository, '--title', title, '--body-file', '-'];
  for (const label of filing.labels ?? []) args.push('--label', label);
  const url = await new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', (error) =>
      reject(/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT' ? new Error('the gh command is not installed') : error)
    );
    child.on('close', (code) => (code === 0 ? resolve(out.trim().split('\n').at(-1) ?? '') : reject(new Error(err.trim() || `gh ended with ${code}`))));
    child.stdin.end(draft.body);
  });
  const number = /\/issues\/(\d+)$/.exec(/** @type {string} */ (url))?.[1];
  if (!number) throw new Error(`gh filed something, but its address was not an issue's: ${url}`);
  const issue = `${filing.repository}#${number}`;
  const known = path.join(configFolder, 'known-findings.json');
  try {
    markFiled(known, draft.finding, issue);
  } catch (error) {
    throw new Error(`filed as ${issue}, but ${known} was not changed: ${/** @type {Error} */ (error).message}`);
  }
  return { issue, url: /** @type {string} */ (url) };
}
