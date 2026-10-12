// A run handed to Claude Code, unattended, for a triage report and a draft
// issue per finding worth filing.
//
// Asked for on 2026-10-12; docs/PLAN.md has it under "After the run". What it
// sends leaves the machine, which C3 allows only of a tool somebody chose to
// run and only once it has said so: `sendNotice` says, and `phileas triage`
// sends nothing without --send.
//
// **The assistant reads, and the command writes.** Claude Code runs with
// Read, Grep and Glob and no other tool, in the run's triage folder, and
// answers with structured output; this module writes the files. So an
// assistant asked to triage cannot run anything, file anything, or change the
// known findings, whatever it decides to try (R34).
//
// **What it reads is prepared first,** in the run's `triage/` folder: the
// run's summary, as `phileas show --json` prints it, and each Route that did
// not pass, and each replay of one, rendered as `phileas show` renders it.
// The run's own journals are readable too, for anything the rendering leaves
// out. Nothing outside those two folders is: a read anywhere else is refused,
// which was measured on 2026-10-12 with a probe that read one of each.
//
// Plain JavaScript for the renderer's reason.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJournal } from '../report/render.mjs';
import { summarizeRun } from '../report/summary.mjs';
import { draftProblems, prefixed, readFiling } from './filing.mjs';

/** @typedef {import('../report/summary.mjs').RunSummary} RunSummary */
/** @typedef {import('./filing.mjs').Filing} Filing */
/** @typedef {import('./filing.mjs').Draft} Draft */

/** The engine's Claude Code plugin, shipped in the package beside `src/`. */
export const PLUGIN_DIR = fileURLToPath(new URL('../../claude', import.meta.url));

/** The folder in a run where a triage is prepared and written. */
export const TRIAGE_FOLDER = 'triage';

/**
 * What the assistant must answer with. Asked for as structured output, so the
 * answer is checked against this before anything is written.
 */
export const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string', description: 'The triage report, in Markdown.' },
    drafts: {
      type: 'array',
      description: 'One draft issue for each new finding worth filing.',
      items: {
        type: 'object',
        properties: {
          finding: { type: 'string', description: "The finding's id, as the summary gives it." },
          title: { type: 'string' },
          body: { type: 'string', description: 'The issue body, in Markdown.' },
          routes: { type: 'array', items: { type: 'integer' }, description: 'The Routes it was met on.' },
        },
        required: ['finding', 'title', 'body'],
      },
    },
  },
  required: ['report', 'drafts'],
};

/**
 * A triage, prepared and not yet sent.
 * @typedef {{
 *   folder: string,
 *   triageDir: string,
 *   summary: RunSummary,
 *   filing: Filing | undefined,
 *   configFolder: string,
 *   files: string[],
 *   bytes: number,
 * }} PreparedTriage
 */

/**
 * A rendered Route's file name: its own journal's, as text, so a replay's
 * keeps the run it came from.
 * @param {string} journal
 * @param {string} [replayOf] the run folder a replay was made in
 * @returns {string}
 */
function renderedName(journal, replayOf) {
  const base = path.basename(journal, '.jsonl');
  return replayOf ? `${base}.replay-${path.basename(replayOf)}.txt` : `${base}.txt`;
}

/**
 * Write what the assistant will read into the run's triage folder, and say
 * what that is: the summary, and each Route that did not pass and each replay
 * of one, rendered. Sends nothing.
 * @param {string} given the run folder
 * @param {string} configFolder the Journey's folder, holding filing.json
 * @returns {PreparedTriage}
 */
export function prepareTriage(given, configFolder) {
  // Absolute, since Claude Code runs in the triage folder and a relative
  // path handed to it would name somewhere else: the first triage after the
  // read scope was narrowed was refused the run's own journals that way.
  const folder = path.resolve(given);
  const summary = summarizeRun(folder);
  const filing = readFiling(configFolder);
  const triageDir = path.join(folder, TRIAGE_FOLDER);
  const routesDir = path.join(triageDir, 'routes');
  fs.rmSync(routesDir, { recursive: true, force: true });
  fs.mkdirSync(routesDir, { recursive: true });
  fs.writeFileSync(path.join(triageDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  for (const route of summary.routes.filter((each) => each.outcome !== 'passed')) {
    const rendered = renderJournal(fs.readFileSync(route.journal, 'utf8')).join('\n');
    fs.writeFileSync(path.join(routesDir, renderedName(route.journal)), `${rendered}\n`);
    for (const replay of route.replayedBy) {
      const text = renderJournal(fs.readFileSync(replay.journal, 'utf8')).join('\n');
      fs.writeFileSync(path.join(routesDir, renderedName(replay.journal, path.dirname(replay.journal))), `${text}\n`);
    }
  }
  const files = [
    path.join(triageDir, 'summary.json'),
    ...fs.readdirSync(routesDir).map((name) => path.join(routesDir, name)),
    ...summary.routes.map((route) => route.journal),
  ];
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  return { folder, triageDir, summary, filing, configFolder, files, bytes };
}

/**
 * What a triage sends, and to whom, said before it is sent (C3).
 * @param {PreparedTriage} prepared
 * @returns {string}
 */
export function sendNotice(prepared) {
  const { summary, files, bytes, filing, configFolder } = prepared;
  const rendered = files.filter((file) => file.endsWith('.txt')).length;
  return [
    `Triage sends what Claude Code reads of ${prepared.folder} to Anthropic: its summary, ` +
      `${summary.routes.length} journal(s) and ${rendered} rendered Route(s), ${Math.ceil(bytes / 1024)} KB in all.`,
    filing
      ? `Drafts are written for ${filing.repository}, by ${path.join(configFolder, 'filing.json')}. Nothing is filed.`
      : `There is no ${path.join(configFolder, 'filing.json')}, so drafts name no repository. Nothing is filed.`,
  ].join('\n');
}

/**
 * The instruction a triage starts with: the plugin's triage skill, on this
 * run, with the tracker's settings.
 * @param {PreparedTriage} prepared
 * @returns {string}
 */
export function triagePrompt(prepared) {
  const filing = prepared.filing ? JSON.stringify(prepared.filing) : 'none';
  return [
    `/phileas:triage ${prepared.triageDir}`,
    '',
    'This is an unattended triage. Nobody will answer a question; decide, and say in the report what you decided and why.',
    `The run's journals are in ${prepared.folder}. The summary and rendered Routes are in ${prepared.triageDir}.`,
    `Filing settings: ${filing}`,
    'Answer with the report and the drafts, as the output schema asks. Write no files.',
  ].join('\n');
}

/**
 * The arguments Claude Code is started with: print mode, the plugin, the
 * structured answer, and no tool but reading.
 * @param {PreparedTriage} prepared
 * @param {{ model?: string, budget?: string }} options
 * @returns {string[]}
 */
export function triageArgs(prepared, { model, budget } = {}) {
  return [
    '-p',
    triagePrompt(prepared),
    '--plugin-dir',
    PLUGIN_DIR,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(TRIAGE_SCHEMA),
    // Only these tools exist for it. They are deliberately not also given
    // to --allowedTools: that would allow reading any path at all, which the
    // first triage on 2026-10-12 did, reading the application's source and
    // the repository's package.json. Without it, a read inside the triage
    // folder and the run folder needs no permission, and with nobody to ask,
    // any other is refused rather than waited on.
    '--tools',
    'Read,Grep,Glob',
    '--permission-mode',
    'dontAsk',
    // The person's own settings only. A repository's project and local
    // settings can allow reads far wider than the run: run inside this
    // project's main checkout, its settings.local.json allowed the whole
    // folder tree, and the second Positron triage read the adapter's source.
    '--setting-sources',
    'user',
    '--add-dir',
    prepared.folder,
    // No server of the person's own is reached, so nothing read here is sent
    // anywhere but to the model.
    '--strict-mcp-config',
    '--no-session-persistence',
    ...(model ? ['--model', model] : []),
    ...(budget ? ['--max-budget-usd', budget] : []),
  ];
}

/**
 * The structured answer out of Claude Code's JSON output, checked, with what
 * it cost and any reads it was refused.
 * @param {string} stdout
 * @returns {{ report: string, drafts: Draft[], costUsd?: number, refused: string[] }}
 */
export function parseTriageOutput(stdout) {
  /** @type {any} */
  let output;
  try {
    output = JSON.parse(stdout);
  } catch {
    throw new Error(`Claude Code's output was not JSON: ${stdout.slice(0, 300)}`);
  }
  if (output.is_error) throw new Error(`Claude Code reported an error: ${output.result ?? output.subtype ?? 'with no reason'}`);
  /** @type {any} */
  let answer = output.structured_output;
  if (answer === undefined && typeof output.result === 'string') {
    try {
      answer = JSON.parse(output.result);
    } catch {
      throw new Error(`Claude Code answered without the structured output asked for: ${output.result.slice(0, 300)}`);
    }
  }
  const valid =
    answer &&
    typeof answer.report === 'string' &&
    Array.isArray(answer.drafts) &&
    answer.drafts.every(
      (/** @type {any} */ draft) => typeof draft?.finding === 'string' && typeof draft.title === 'string' && typeof draft.body === 'string'
    );
  if (!valid) throw new Error('Claude Code answered, but not with a report and a list of drafts');
  const refused = (Array.isArray(output.permission_denials) ? output.permission_denials : []).map(
    (/** @type {any} */ denial) => `${denial?.tool_name ?? 'a tool'} ${denial?.tool_input?.file_path ?? denial?.tool_input?.path ?? denial?.tool_input?.pattern ?? ''}`.trim()
  );
  return {
    report: answer.report,
    drafts: answer.drafts,
    ...(typeof output.total_cost_usd === 'number' ? { costUsd: output.total_cost_usd } : {}),
    refused,
  };
}

/**
 * Run the triage: start Claude Code in the triage folder and read its answer.
 * @param {PreparedTriage} prepared
 * @param {{ model?: string, budget?: string }} [options]
 * @returns {Promise<ReturnType<typeof parseTriageOutput>>}
 */
export function runTriage(prepared, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', triageArgs(prepared, options), { cwd: prepared.triageDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('error', (error) =>
      reject(
        /** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT'
          ? new Error('Claude Code is not installed: there is no claude command to start')
          : error
      )
    );
    child.on('close', () => {
      try {
        resolve(parseTriageOutput(out));
      } catch (error) {
        reject(err.trim() ? new Error(`${/** @type {Error} */ (error).message}\n${err.trim()}`) : error);
      }
    });
  });
}

/**
 * Write a triage's answer into the run's triage folder: the report, and each
 * draft twice, as JSON for the page to file from and as Markdown to read. A
 * draft's title gets the tracker's prefix, and what would stop it being filed
 * is written beside it, so a reader sees it before trying.
 * @param {PreparedTriage} prepared
 * @param {{ report: string, drafts: Draft[] }} answer
 * @returns {{ report: string, drafts: string[] }}
 */
export function writeTriage(prepared, answer) {
  const report = path.join(prepared.triageDir, 'report.md');
  fs.writeFileSync(report, `${answer.report.trim()}\n`);
  const draftsDir = path.join(prepared.triageDir, 'drafts');
  fs.rmSync(draftsDir, { recursive: true, force: true });
  fs.mkdirSync(draftsDir, { recursive: true });
  /** @type {string[]} */
  const written = [];
  for (const draft of answer.drafts) {
    const id = draft.finding.replace(/[^0-9a-f]/gi, '');
    if (!id) continue;
    const title = prefixed(draft.title, prepared.filing);
    const problems = draftProblems({ ...draft, title }, prepared.filing);
    const record = {
      finding: draft.finding,
      title,
      body: draft.body,
      ...(draft.routes ? { routes: draft.routes } : {}),
      ...(prepared.filing ? { repository: prepared.filing.repository } : {}),
      problems,
    };
    fs.writeFileSync(path.join(draftsDir, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
    const markdown = path.join(draftsDir, `${id}.md`);
    const head = [
      `Finding: ${draft.finding}`,
      `Repository: ${prepared.filing?.repository ?? 'none named'}`,
      ...(problems.length ? [`Cannot be filed as it stands: ${problems.join('; ')}`] : []),
    ];
    fs.writeFileSync(markdown, `${head.join('\n')}\n\n# ${title}\n\n${draft.body.trim()}\n`);
    written.push(markdown);
  }
  return { report, drafts: written };
}

/**
 * The drafts a triage left in a run, as the page lists them.
 * @param {string} folder the run folder
 * @returns {(Draft & { repository?: string, problems: string[], file: string })[]}
 */
export function draftsIn(folder) {
  const draftsDir = path.join(folder, TRIAGE_FOLDER, 'drafts');
  if (!fs.existsSync(draftsDir)) return [];
  return fs
    .readdirSync(draftsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ ...JSON.parse(fs.readFileSync(path.join(draftsDir, name), 'utf8')), file: path.join(draftsDir, name) }));
}
