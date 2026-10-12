import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { listRuns, summarizeRun } from '../src/report/summary.mjs';
import { findingId } from '../src/known.mjs';
import { draftProblems, prefixed, readFiling } from '../src/assistant/filing.mjs';
import { draftsIn, parseTriageOutput, prepareTriage, sendNotice, triageArgs, writeTriage, PLUGIN_DIR } from '../src/assistant/triage.mjs';
import { isUnder, jobArgs, serve, tokenMatches, TOKEN_HEADER } from '../src/view/server.mjs';
import { parse, toReproduce } from '../bin/phileas.mjs';
import { removeScratch, scratch } from './scratch';

/**
 * The work done after a run, asked for on 2026-10-12: a run as data, the
 * assistant's triage, filing a draft, and the page. None of it is inside the
 * engine, and none of it launches the application here; docs/PLAN.md has it
 * under "After the run".
 */

test.afterEach(removeScratch);

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function opening(routeNumber: number, extra: Record<string, unknown> = {}) {
  return { kind: 'route', journeySeed: 'seed1', routeSeed: `r${routeNumber}`, routeNumber, tripLength: 10, settleQuietMs: 400, startedAt: '2026-10-12T10:00:00.000Z', ...extra };
}

function hop(n: number, checks: unknown[] = []) {
  return {
    kind: 'trip-hop',
    hop: n,
    target: { source: 'page', role: 'button', name: 'Save', nth: 1 },
    action: 'click',
    pool: 'p',
    startedAt: '2026-10-12T10:00:01.000Z',
    durationMs: 10,
    settled: true,
    settleMs: 10,
    effect: { readable: true, changed: false, appeared: [], appearedMore: 0, wentAway: [], wentAwayMore: 0 },
    checks,
  };
}

const failedCheck = (id: string, known: boolean, issue?: string) => ({
  check: 'console-error',
  result: 'failed',
  observation: `Error ${id}`,
  findings: [{ id, signature: `console-error: Error ${id}`, known, ...(issue ? { issue } : {}) }],
});

function write(folder: string, name: string, entries: unknown[]) {
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, name);
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  return file;
}

/** A journals folder with one run of four Routes, and one replay of its second. */
function aRun() {
  const journals = path.join(scratch('phileas-after-test-'), '.phileas-journals');
  const run = path.join(journals, 'seed1', '2026-10-12T10-00-00-000Z');
  write(run, 'route-001-r1.jsonl', [opening(1), hop(1), { kind: 'outcome', outcome: 'passed', hops: 10, endedAt: 'x' }]);
  const second = write(run, 'route-002-r2.jsonl', [
    opening(2),
    hop(1),
    hop(2, [failedCheck('aaaa1111', false), { check: 'still-responding', result: 'passed' }]),
    { kind: 'outcome', outcome: 'failed', hops: 2, reason: '1 check failed after hop 2.', endedAt: 'x' },
  ]);
  write(run, 'route-003-r3.jsonl', [opening(3), hop(1), { kind: 'outcome', outcome: 'stranded', hops: 1, reason: 'Nothing to act on.', endedAt: 'x' }]);
  write(run, 'route-004-r4.jsonl', [opening(4), hop(1), hop(2, [failedCheck('cccc3333', false)])]);
  const replayRun = path.join(journals, 'seed1', '2026-10-12T11-00-00-000Z');
  write(replayRun, 'route-002-r2.jsonl', [
    opening(2, { replays: { journal: second, hops: 2, fix: 'journal', setAside: ['console-error: Error aaaa1111'] } }),
    hop(1),
    hop(2, [failedCheck('aaaa1111', false)]),
    { kind: 'outcome', outcome: 'failed', hops: 2, reason: '1 check failed after hop 2.', endedAt: 'x' },
  ]);
  return { journals, run, replayRun, second };
}

test('a run as data says what the reporter says of each Route, and finds the replays beside it', () => {
  const { run, replayRun, second } = aRun();
  const summary = summarizeRun(run);

  expect(summary).toMatchObject({ seed: 'seed1', run: '2026-10-12T10-00-00-000Z' });
  expect(summary.counts).toEqual({ passed: 1, failed: 1, stranded: 1, unfinished: 1 });
  const [first, failed, stranded, unfinished] = summary.routes;
  expect(first).toMatchObject({ routeNumber: 1, outcome: 'passed', failedChecks: [], newFindings: [] });
  expect(failed).toMatchObject({ routeNumber: 2, outcome: 'failed', hops: 2, failedAt: 'hop 2, click button "Save"', newFindings: ['aaaa1111'] });
  expect(failed?.failedChecks).toEqual([
    {
      check: 'console-error',
      observation: 'Error aaaa1111',
      findings: [{ id: 'aaaa1111', signature: 'console-error: Error aaaa1111', known: false, now: { standing: 'no file' } }],
    },
  ]);
  expect(failed?.replayedBy).toEqual([{ journal: path.join(replayRun, 'route-002-r2.jsonl'), verdict: 'reproduced: the finding came back' }]);
  expect(stranded).toMatchObject({ outcome: 'stranded', reason: 'Nothing to act on.' });
  expect(unfinished).toMatchObject({ outcome: 'unfinished', hops: 2, newFindings: ['cccc3333'] });
  expect(summary.newFindings).toEqual([
    { id: 'aaaa1111', signature: 'console-error: Error aaaa1111', check: 'console-error', routes: [2], now: { standing: 'no file' } },
    { id: 'cccc3333', signature: 'console-error: Error cccc3333', check: 'console-error', routes: [4], now: { standing: 'no file' } },
  ]);
  expect(summary.knownFindings).toBeNull();

  // The replay's own run says what it replays.
  expect(summarizeRun(replayRun).routes[0]?.replays).toEqual({ journal: second, verdict: 'reproduced: the finding came back' });
});

test('one Route is replayed for each new finding, and none for a finding replayed already', () => {
  const { run } = aRun();
  // Route 2's finding was replayed already, and Route 4 did not finish but
  // its last Hop met a new finding; Routes 1 and 3 found nothing new.
  expect(toReproduce(summarizeRun(run)).map((route) => route.routeNumber)).toEqual([4]);

  // Three Routes ending on one finding, none replayed, and one on two.
  const journals = path.join(scratch('phileas-after-test-'), '.phileas-journals');
  const many = path.join(journals, 'seed1', 'run');
  for (const n of [1, 2, 3]) {
    write(many, `route-00${n}-r${n}.jsonl`, [opening(n), hop(1, [failedCheck('aaaa1111', false)]), { kind: 'outcome', outcome: 'failed', hops: 1, endedAt: 'x' }]);
  }
  write(many, 'route-004-r4.jsonl', [
    opening(4),
    hop(1, [failedCheck('aaaa1111', false), failedCheck('dddd4444', false)]),
    { kind: 'outcome', outcome: 'failed', hops: 1, endedAt: 'x' },
  ]);
  expect(toReproduce(summarizeRun(many)).map((route) => route.routeNumber)).toEqual([1, 4]);
});

test('a finding new when the run was made says how it stands now, and one filed since is not replayed', () => {
  // Real ids, made from their signatures, since a known findings file checks them.
  const journals = path.join(scratch('phileas-after-test-'), '.phileas-journals');
  const run = path.join(journals, 'seed1', 'run');
  const seen = (word: string) => {
    const signature = `console-error: Error saving ${word}`;
    return { check: 'console-error', result: 'failed', observation: `Error saving ${word}`, findings: [{ id: findingId(signature), signature, known: false }] };
  };
  write(run, 'route-001-r1.jsonl', [opening(1), hop(1, [seen('notes')]), { kind: 'outcome', outcome: 'failed', hops: 1, endedAt: 'x' }]);
  write(run, 'route-002-r2.jsonl', [opening(2), hop(1, [seen('plots')]), { kind: 'outcome', outcome: 'failed', hops: 1, endedAt: 'x' }]);
  const notes = findingId('console-error: Error saving notes');
  const plots = findingId('console-error: Error saving plots');

  // Beside the journals folder, where every consumer here keeps it.
  const known = path.join(path.dirname(journals), 'known-findings.json');
  const entry = (word: string, extra: Record<string, unknown>) => ({
    id: findingId(`console-error: Error saving ${word}`), check: 'console-error', signature: `console-error: Error saving ${word}`,
    added: '2026-10-12', source: 'journey', ...extra,
  });
  fs.writeFileSync(known, JSON.stringify([entry('plots', { issue: 'owner/name#7' })]));
  const summary = summarizeRun(run);
  expect(summary.knownFindings).toBe(known);
  expect(summary.newFindings.map((finding) => [finding.id, finding.now])).toEqual([
    [notes, { standing: 'not on file' }],
    [plots, { standing: 'filed', issue: 'owner/name#7' }],
  ]);
  // Only the finding nobody has decided is replayed.
  expect(toReproduce(summary).map((route) => route.routeNumber)).toEqual([1]);

  fs.writeFileSync(known, JSON.stringify([entry('notes', {}), entry('plots', { falseAlarm: 'logged on every quit' })]));
  expect(summarizeRun(run).newFindings.map((finding) => finding.now.standing)).toEqual(['unfiled', 'false alarm']);
  expect(summarizeRun(run, { knownFile: path.join(journals, 'none.json') }).newFindings[0]?.now).toEqual({ standing: 'no file' });
});

test('runs are listed newest first, and a folder holding no journals is not a run', () => {
  const { journals } = aRun();
  fs.mkdirSync(path.join(journals, 'seed2', 'empty'), { recursive: true });
  expect(listRuns(journals).map((run) => run.run)).toEqual(['2026-10-12T11-00-00-000Z', '2026-10-12T10-00-00-000Z']);
  expect(listRuns(path.join(journals, 'missing'))).toEqual([]);
});

test('the commands after a run read their flags, and refuse what they do not take', () => {
  expect(parse(['show', '--json', 'run'])).toEqual({ command: 'show', what: 'run', json: true });
  expect(parse(['show'])).toEqual({ command: 'show', what: undefined, json: false });
  expect(() => parse(['show', '--yaml'])).toThrow('show takes --json, and was given --yaml');
  expect(parse(['reproduce', 'run', '--config', 'trial/rstudio/phileas'])).toEqual({
    command: 'reproduce', what: 'run', config: 'trial/rstudio/phileas', withCurrentFix: false,
  });
  expect(parse(['triage', '--send', '--budget=2.5', '--model', 'opus'])).toEqual({
    command: 'triage', what: undefined, config: 'phileas', send: true, model: 'opus', budget: '2.5',
  });
  expect(() => parse(['triage', '--budget', 'lots'])).toThrow('--budget takes a number of US dollars');
  expect(parse(['unattended', 'phileas', '--routes', '5', '--send', '--budget', '3', '--', '--grep', 'route 1$'])).toEqual({
    command: 'unattended', config: 'phileas', settings: { PHILEAS_ROUTES: '5' }, passThrough: ['--grep', 'route 1$'], send: true, budget: '3',
  });
  expect(() => parse(['unattended', '--nope'])).toThrow('unknown flag --nope');
  expect(parse(['view', '--port', '8123'])).toEqual({ command: 'view', config: 'phileas', port: 8123 });
  expect(() => parse(['view', '--port', '70000'])).toThrow('--port takes a port from 0 to 65535');
  expect(parse(['claude', '--', '--model', 'opus'])).toEqual({ command: 'claude', passThrough: ['--model', 'opus'] });
  expect(() => parse(['claude', '--model', 'opus'])).toThrow('claude takes its own arguments after --');
});

test('filing settings are refused by name when wrong, never read as none', () => {
  const folder = scratch('phileas-filing-test-');
  expect(readFiling(folder)).toBeUndefined();
  const file = path.join(folder, 'filing.json');
  fs.writeFileSync(file, JSON.stringify({ repository: 'owner/name', titlePrefix: 'App: ', noOtherRepositoryLinks: true }));
  expect(readFiling(folder)).toEqual({ repository: 'owner/name', titlePrefix: 'App: ', noOtherRepositoryLinks: true });
  fs.writeFileSync(file, JSON.stringify({ repository: 'owner/name', environment: ['App 1.0, an installed release'] }));
  expect(readFiling(folder)?.environment).toEqual(['App 1.0, an installed release']);
  fs.writeFileSync(file, JSON.stringify({ repository: 'owner/name', environment: 'App 1.0' }));
  expect(() => readFiling(folder)).toThrow('has an environment that is not a list of text');
  fs.writeFileSync(file, JSON.stringify({ repository: 'not a repository' }));
  expect(() => readFiling(folder)).toThrow('needs a repository, as owner/name');
  fs.writeFileSync(file, JSON.stringify({ repository: 'owner/name', titlePrefx: 'App: ' }));
  expect(() => readFiling(folder)).toThrow('has a setting it does not know, titlePrefx');
  fs.writeFileSync(file, '{');
  expect(() => readFiling(folder)).toThrow('is not valid JSON');
});

test('a draft is checked by code for what filing forbids, whatever the assistant was asked', () => {
  const filing = { repository: 'owner/name', titlePrefix: 'App: ', noOtherRepositoryLinks: true };
  expect(prefixed('Saving loses the file', filing)).toBe('App: Saving loses the file');
  expect(prefixed('App: Saving loses the file', filing)).toBe('App: Saving loses the file');

  const clean = { finding: 'aaaa1111', title: 'App: Saving loses the file', body: 'Steps:\n\n1. Save\n\nSee owner/name#4 and https://example.com/x#3.' };
  expect(draftProblems(clean, filing)).toEqual([]);
  expect(draftProblems({ ...clean, body: 'Like #12 again' }, filing)).toEqual([
    'it has #12, which GitHub links to an issue of the same repository',
  ]);
  const linked = { ...clean, body: 'Upstream: other/repo#9 and https://github.com/other/repo/pull/3' };
  expect(draftProblems(linked, filing)).toEqual([
    'it links another repository, other/repo#9, https://github.com/other/repo/pull/3, which filing.json forbids',
  ]);
  expect(draftProblems(linked, { repository: 'owner/name' })).toEqual([]);
  expect(draftProblems({ ...clean, title: ' ', body: '' }, filing)).toEqual(['the title is empty', 'the body is empty']);
  expect(draftProblems({ ...clean, body: 'Saves \u2014 then \u201clost\u201d' }, filing)).toEqual([
    'it has characters outside ASCII: \u2014 \u201c \u201d',
  ]);
});

test('a triage prepares what it sends, says so, and gives the assistant nothing but reading', () => {
  const { run } = aRun();
  const config = scratch('phileas-triage-config-');
  fs.writeFileSync(path.join(config, 'filing.json'), JSON.stringify({ repository: 'owner/name', titlePrefix: 'App: ', noOtherRepositoryLinks: true }));
  const prepared = prepareTriage(run, config);

  const rendered = fs.readdirSync(path.join(run, 'triage', 'routes')).sort();
  // Every Route that did not pass, and the replay of Route 2, but not Route 1.
  expect(rendered).toEqual([
    'route-002-r2.replay-2026-10-12T11-00-00-000Z.txt',
    'route-002-r2.txt',
    'route-003-r3.txt',
    'route-004-r4.txt',
  ]);
  expect(JSON.parse(fs.readFileSync(path.join(run, 'triage', 'summary.json'), 'utf8')).counts.failed).toBe(1);
  expect(sendNotice(prepared)).toMatch(/^Triage sends what Claude Code reads of .* to Anthropic: its summary, 4 journal\(s\) and 4 rendered Route\(s\)/);
  expect(sendNotice(prepared)).toContain('Drafts are written for owner/name');

  const args = triageArgs(prepared, { budget: '2' });
  const after = (flag: string) => args[args.indexOf(flag) + 1];
  expect(after('--tools')).toBe('Read,Grep,Glob');
  // Allowing Read outright would allow reading any path, which the first
  // triage did; without it, reads outside the two folders are refused.
  expect(args).not.toContain('--allowedTools');
  expect(after('--permission-mode')).toBe('dontAsk');
  // A repository's own settings can allow reads of the whole tree.
  expect(after('--setting-sources')).toBe('user');
  expect(after('--plugin-dir')).toBe(PLUGIN_DIR);
  expect(after('--max-budget-usd')).toBe('2');
  // Capped whether or not a budget is given.
  expect(triageArgs(prepared)[triageArgs(prepared).indexOf('--max-budget-usd') + 1]).toBe('5');
  expect(sendNotice(prepared)).toContain('It may spend up to $5.');
  expect(sendNotice(prepared, '2')).toContain('It may spend up to $2.');
  expect(args).toContain('--strict-mcp-config');
  // The flags, not the prompt, which may say what not to do.
  expect(args.filter((_, i) => i !== 1).join(' ')).not.toMatch(/dangerously|bypassPermissions|Bash|Write|Edit/);
  expect(args[1]).toMatch(/^\/phileas:triage /);

  // Absolute, whatever it was given, since Claude Code runs in another folder.
  const relative = prepareTriage(path.relative(process.cwd(), run), config);
  expect(path.isAbsolute(relative.folder)).toBe(true);
  expect(triageArgs(relative)[triageArgs(relative).indexOf('--add-dir') + 1]).toBe(path.resolve(run));
});

test("the assistant's answer is read from its structured output, and anything else is refused", () => {
  const answer = { report: '# Run', drafts: [{ finding: 'aaaa1111', title: 't', body: 'b' }] };
  expect(parseTriageOutput(JSON.stringify({ type: 'result', structured_output: answer }))).toEqual({ ...answer, refused: [] });
  expect(parseTriageOutput(JSON.stringify({ type: 'result', result: JSON.stringify(answer) }))).toEqual({ ...answer, refused: [] });
  // As measured from a signed-in probe on 2026-10-12: the cost, and each refused read.
  expect(
    parseTriageOutput(
      JSON.stringify({
        structured_output: answer,
        total_cost_usd: 0.35,
        permission_denials: [{ tool_name: 'Read', tool_input: { file_path: '/elsewhere/main.cjs' } }],
      })
    )
  ).toEqual({ ...answer, costUsd: 0.35, refused: ['Read /elsewhere/main.cjs'] });
  expect(() => parseTriageOutput(JSON.stringify({ is_error: true, result: 'Failed to authenticate' }))).toThrow('Failed to authenticate');
  expect(() => parseTriageOutput(JSON.stringify({ result: 'I looked at it.' }))).toThrow('without the structured output');
  expect(() => parseTriageOutput(JSON.stringify({ structured_output: { report: 'r' } }))).toThrow('not with a report and a list of drafts');
  expect(() => parseTriageOutput('not json')).toThrow("Claude Code's output was not JSON");
});

test('a triage is written beside the run, each draft prefixed and with what would stop it being filed', () => {
  const { run } = aRun();
  const config = scratch('phileas-triage-config-');
  fs.writeFileSync(path.join(config, 'filing.json'), JSON.stringify({ repository: 'owner/name', titlePrefix: 'App: ', noOtherRepositoryLinks: true }));
  const prepared = prepareTriage(run, config);
  const written = writeTriage(prepared, {
    report: '# Seed seed1\n',
    drafts: [
      { finding: 'aaaa1111', title: 'Saving logs an error', body: 'Reproduced once.' },
      { finding: 'bbbb2222', title: 'Another', body: 'Like other/repo#9.' },
    ],
  });
  expect(fs.readFileSync(written.report, 'utf8')).toBe('# Seed seed1\n');
  const drafts = draftsIn(run);
  expect(drafts.map((draft) => [draft.finding, draft.title, draft.problems])).toEqual([
    ['aaaa1111', 'App: Saving logs an error', []],
    ['bbbb2222', 'App: Another', ['it links another repository, other/repo#9, which filing.json forbids']],
  ]);
  expect(fs.readFileSync(path.join(run, 'triage', 'drafts', 'bbbb2222.md'), 'utf8')).toContain('Cannot be filed as it stands');
});

test("the page's jobs are built from checked fields, so a request cannot hand the command a flag", () => {
  const where = { config: 'phileas', journals: '/j' };
  expect(jobArgs({ kind: 'run', routes: 5, seed: 'abc123', fix: 'data-viewer' }, where).args).toEqual([
    'run', 'phileas', '--follow', '--routes', '5', '--seed', 'abc123', '--fix', 'data-viewer',
  ]);
  expect(() => jobArgs({ kind: 'run', seed: '--routes' }, where)).toThrow('seed is not acceptable');
  expect(() => jobArgs({ kind: 'run', fix: '-x' }, where)).toThrow('fix is not acceptable');
  expect(() => jobArgs({ kind: 'run', seed: 'a b' }, where)).toThrow('seed is not acceptable');
  expect(() => jobArgs({ kind: 'run', routes: '0' }, where)).toThrow('routes is not acceptable');
  expect(() => jobArgs({ kind: 'replay', journal: '/elsewhere/route-001-x.jsonl' }, where)).toThrow('is not under /j');
  expect(jobArgs({ kind: 'replay', journal: '/j/s/r/route-001-x.jsonl' }, where).args).toEqual(['replay', '/j/s/r/route-001-x.jsonl', 'phileas', '--follow']);
  expect(() => jobArgs({ kind: 'triage', folder: '/j/s/r' }, where)).toThrow('did not say to');
  expect(jobArgs({ kind: 'triage', folder: '/j/s/r', send: true }, where).args).toEqual(['triage', '/j/s/r', '--config', 'phileas', '--send']);
  expect(() => jobArgs({ kind: 'shell' }, where)).toThrow('there is no job of the kind shell');
  expect(isUnder('/j', '/j/../k')).toBe(false);
  expect(tokenMatches('abc', 'abc')).toBe(true);
  expect(tokenMatches('abc', 'abd')).toBe(false);
  expect(tokenMatches('abc', undefined)).toBe(false);
});

/** A request to the page's server, with the host header given. */
function request(url: string, { host, headers = {} }: { host?: string; headers?: Record<string, string> } = {}) {
  const target = new URL(url);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      { hostname: target.hostname, port: target.port, path: target.pathname + target.search, headers: { ...headers, ...(host ? { host } : {}) } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

test('the page answers only with its token, and only at its own address', async () => {
  const { journals, run } = aRun();
  const config = path.dirname(journals);
  const { url, server, token } = await serve({ config, port: 0, journals, phileas: path.join(repo, 'bin', 'phileas.mjs'), quiet: true });
  try {
    const origin = new URL(url).origin;
    expect((await request(`${origin}/`)).status).toBe(403);
    expect((await request(url)).status).toBe(200);
    expect((await request(url, { host: `evil.example:${new URL(url).port}` })).status).toBe(403);
    expect((await request(`${origin}/api/overview`)).status).toBe(403);

    const auth = { [TOKEN_HEADER]: token };
    const overview = JSON.parse((await request(`${origin}/api/overview`, { headers: auth })).body);
    expect(overview.runs.map((each: { run: string }) => each.run)).toEqual(['2026-10-12T11-00-00-000Z', '2026-10-12T10-00-00-000Z']);
    const shown = JSON.parse((await request(`${origin}/api/run?folder=${encodeURIComponent(run)}`, { headers: auth })).body);
    expect(shown.summary.counts.failed).toBe(1);
    const outside = await request(`${origin}/api/route?journal=${encodeURIComponent('/etc/hosts')}`, { headers: auth });
    expect(outside.status).toBe(400);
    expect(JSON.parse(outside.body).error).toContain('is not under');
  } finally {
    server.close();
  }
});

test("the plugin ships with the package, at the package's version, and each skill names itself", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf8'));
  expect(PLUGIN_DIR).toBe(path.join(repo, 'claude'));
  expect(pkg.files).toContain('claude');
  expect(plugin.name).toBe('phileas');
  expect(plugin.version).toBe(pkg.version);
  const skills = fs.readdirSync(path.join(PLUGIN_DIR, 'skills')).sort();
  expect(skills).toEqual(['file', 'journey', 'reproduce', 'triage']);
  for (const skill of skills) {
    const text = fs.readFileSync(path.join(PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
    expect(front, skill).toContain(`name: ${skill}\n`);
    expect(front, skill).toMatch(/\ndescription: \S/);
  }
});
