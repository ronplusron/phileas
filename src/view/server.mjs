// `phileas view`: a page for working with Journeys, served on this machine.
//
// Asked for on 2026-10-12 as R35; docs/PLAN.md has it under "After the run".
// It lists the runs kept, shows any Route through the renderer, starts a
// Journey, a replay, a reproduce or a triage and streams what it prints, and
// files a draft a triage left once a person presses the button for it.
//
// **It can start processes, so it answers nobody else.** It listens on
// 127.0.0.1 only. Every request must carry the token printed in its address,
// compared in constant time, and name this server as its host, which stops a
// web page elsewhere reaching it through a name that resolves here. What it
// starts is always this machine's own `phileas` command, with arguments built
// here from checked fields, never from text a request supplies as a flag. A
// folder or journal a request names must sit under the config's journals.
//
// One job at a time, since two Journeys at once would launch the application
// twice over the same folders.
//
// Plain JavaScript for the renderer's reason.

import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { readKnownFindings } from '../known.mjs';
import { journalSteps, renderJournal } from '../report/render.mjs';
import { listRuns, summarizeRun } from '../report/summary.mjs';
import { fileDraft, readFiling } from '../assistant/filing.mjs';
import { draftsIn, prepareTriage, sendNotice, TRIAGE_FOLDER } from '../assistant/triage.mjs';
import { PAGE } from './page.mjs';

/** The header every request to the API carries the token in. */
export const TOKEN_HEADER = 'x-phileas-token';

/**
 * Where an adapter outside its application reads the application from:
 * `APP_DIR_VARIABLE` in src/launch.ts, named again here since this file is
 * plain JavaScript and cannot import that one. A job inherits it from this
 * server, so a server started without it starts Journeys that fail at once.
 */
const APP_DIR_VARIABLE = 'PHILEAS_APP_DIR';

/** A job's output is kept whole, up to this, so a page opened late sees it from the start. */
const KEPT_OUTPUT = 4 * 1024 * 1024;

/**
 * @typedef {{
 *   id: number,
 *   label: string,
 *   args: string[],
 *   output: string,
 *   status: 'running' | 'ended',
 *   code?: number | null,
 *   startedAt: string,
 *   listeners: Set<(chunk: string | null) => void>,
 *   child: import('node:child_process').ChildProcess,
 * }} Job
 */

/**
 * Whether `inside` is `root` or under it, once both are resolved.
 * @param {string} root
 * @param {string} inside
 */
export function isUnder(root, inside) {
  const relative = path.relative(path.resolve(root), path.resolve(inside));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Whether two tokens match, in constant time.
 * @param {string} expected
 * @param {string | undefined} given
 */
export function tokenMatches(expected, given) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The arguments for the `phileas` command a job runs, built from a request's
 * fields, each checked, or an error saying which field is wrong.
 * @param {any} body
 * @param {{ config: string, journals: string }} where
 * @returns {{ label: string, args: string[] }}
 */
export function jobArgs(body, { config, journals }) {
  const kind = body?.kind;
  /** @param {string} name @param {unknown} value @param {RegExp} shape */
  const checked = (name, value, shape) => {
    if (typeof value !== 'string' || !shape.test(value)) throw new Error(`${name} is not acceptable: ${String(value)}`);
    return value;
  };
  /** @param {string} name @param {unknown} value */
  const count = (name, value) => checked(name, String(value), /^[1-9]\d{0,5}$/);
  /** @param {unknown} value */
  const underJournals = (value) => {
    if (typeof value !== 'string' || !isUnder(journals, value)) throw new Error(`${String(value)} is not under ${journals}`);
    return value;
  };
  if (kind === 'run') {
    const args = ['run', config, '--follow'];
    if (body.routes !== undefined && body.routes !== '') args.push('--routes', count('routes', body.routes));
    if (body.tripLength !== undefined && body.tripLength !== '') args.push('--trip-length', count('tripLength', body.tripLength));
    if (body.seed) args.push('--seed', checked('seed', body.seed, /^\w[\w-]{0,63}$/));
    if (body.fix) args.push('--fix', checked('fix', body.fix, /^\w[\w.-]{0,63}$/));
    if (body.allow) args.push('--allow', checked('allow', body.allow, /^\w[\w.,-]{0,199}$/));
    return { label: 'Journey', args };
  }
  if (kind === 'replay') {
    const journal = underJournals(body.journal);
    const args = ['replay', journal, config, '--follow'];
    if (body.whole) args.push('--whole');
    if (body.withCurrentFix) args.push('--with-current-fix');
    return { label: `replay of ${path.basename(journal)}`, args };
  }
  if (kind === 'reproduce') {
    const folder = underJournals(body.folder);
    return { label: `reproduce ${path.basename(folder)}`, args: ['reproduce', folder, '--config', config] };
  }
  if (kind === 'triage') {
    const folder = underJournals(body.folder);
    // Sending is a choice the page asks for after showing what is sent (C3);
    // a request that does not say so sends nothing.
    if (body.send !== true) throw new Error('a triage sends the run to Anthropic, and the request did not say to');
    return { label: `triage ${path.basename(folder)}`, args: ['triage', folder, '--config', config, '--send'] };
  }
  throw new Error(`there is no job of the kind ${String(kind)}`);
}

/**
 * Serve the page, and print its address.
 * @param {{ config: string, port: number, journals: string, phileas: string, quiet?: boolean }} options
 * @returns {Promise<{ url: string, server: http.Server, token: string }>}
 */
export function serve({ config, port, journals, phileas, quiet = false }) {
  const token = randomBytes(24).toString('base64url');
  const configFolder = fs.existsSync(config) && fs.statSync(config).isFile() ? path.dirname(config) : config;
  /** @type {Job[]} */
  const jobs = [];
  let nextId = 1;
  let boundPort = port;
  const appDir = process.env[APP_DIR_VARIABLE] || null;

  /** @param {http.ServerResponse} res @param {number} status @param {unknown} body */
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  /** @param {http.IncomingMessage} req @returns {Promise<any>} */
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let text = '';
      req.on('data', (chunk) => {
        text += chunk;
        if (text.length > 64 * 1024) reject(new Error('the request is too large'));
      });
      req.on('end', () => {
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch {
          reject(new Error('the request is not JSON'));
        }
      });
    });

  /** @param {{ label: string, args: string[] }} asked @returns {Job} */
  const startJob = ({ label, args }) => {
    if (jobs.some((job) => job.status === 'running')) throw new Error('a job is already running; stop it or wait for it');
    const child = spawn(process.execPath, [phileas, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    /** @type {Job} */
    const job = { id: nextId++, label, args, output: `$ phileas ${args.join(' ')}\n`, status: 'running', startedAt: new Date().toISOString(), listeners: new Set(), child };
    /** @param {string} chunk */
    const add = (chunk) => {
      if (job.output.length < KEPT_OUTPUT) job.output += chunk;
      for (const listener of job.listeners) listener(chunk);
    };
    child.stdout?.on('data', (chunk) => add(String(chunk)));
    child.stderr?.on('data', (chunk) => add(String(chunk)));
    child.on('error', (error) => add(`\n${error.message}\n`));
    child.on('close', (code, signal) => {
      job.status = 'ended';
      job.code = code;
      add(`\n[ended ${signal ? `by ${signal}` : `with ${code}`}]\n`);
      for (const listener of job.listeners) listener(null);
      job.listeners.clear();
    });
    jobs.push(job);
    return job;
  };

  /** @param {Job} job */
  const jobView = (job) => ({ id: job.id, label: job.label, status: job.status, code: job.code, startedAt: job.startedAt });

  /** @param {URL} url @param {string} name */
  const folderParam = (url, name) => {
    const value = url.searchParams.get(name) ?? '';
    if (!value || !isUnder(journals, value)) throw new Error(`${value || 'nothing'} is not under ${journals}`);
    return value;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '';
      if (host !== `127.0.0.1:${boundPort}` && host !== `localhost:${boundPort}`) {
        res.writeHead(403).end('This server answers only at the address phileas view printed.');
        return;
      }
      const url = new URL(req.url ?? '/', `http://${host}`);
      res.setHeader('x-content-type-options', 'nosniff');
      res.setHeader('referrer-policy', 'no-referrer');

      if (url.pathname === '/') {
        if (!tokenMatches(token, url.searchParams.get('token') ?? undefined)) {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('Open the address phileas view printed, token included.');
          return;
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
        });
        res.end(PAGE);
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        res.writeHead(404).end();
        return;
      }
      if (!tokenMatches(token, /** @type {string | undefined} */ (req.headers[TOKEN_HEADER]))) {
        json(res, 403, { error: 'no token, or the wrong one' });
        return;
      }
      if (req.method === 'POST' && !(req.headers['content-type'] ?? '').startsWith('application/json')) {
        json(res, 415, { error: 'send JSON' });
        return;
      }

      const route = `${req.method} ${url.pathname}`;
      if (route === 'GET /api/overview') {
        let filing;
        let filingError;
        try {
          filing = readFiling(configFolder);
        } catch (error) {
          filingError = /** @type {Error} */ (error).message;
        }
        json(res, 200, { config, journals, appDir, filing: filing ?? null, filingError, runs: listRuns(journals), jobs: jobs.map(jobView) });
      } else if (route === 'GET /api/run') {
        const folder = folderParam(url, 'folder');
        const report = path.join(folder, TRIAGE_FOLDER, 'report.md');
        json(res, 200, {
          summary: summarizeRun(folder),
          report: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : null,
          drafts: draftsIn(folder),
        });
      } else if (route === 'GET /api/route') {
        const journal = folderParam(url, 'journal');
        const text = fs.readFileSync(journal, 'utf8');
        json(res, 200, { lines: renderJournal(text), ...journalSteps(text) });
      } else if (route === 'GET /api/known') {
        json(res, 200, readKnownFindings(path.join(configFolder, 'known-findings.json')));
      } else if (route === 'GET /api/triage-notice') {
        json(res, 200, { notice: sendNotice(prepareTriage(folderParam(url, 'folder'), configFolder)) });
      } else if (route === 'POST /api/jobs') {
        const job = startJob(jobArgs(await readBody(req), { config, journals }));
        json(res, 200, jobView(job));
      } else if (req.method === 'GET' && /^\/api\/jobs\/\d+\/output$/.test(url.pathname)) {
        const job = jobs.find((each) => each.id === Number(url.pathname.split('/')[3]));
        if (!job) return json(res, 404, { error: 'no such job' });
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        res.write(job.output);
        if (job.status === 'ended') return res.end();
        /** @param {string | null} chunk */
        const listener = (chunk) => (chunk === null ? res.end() : res.write(chunk));
        job.listeners.add(listener);
        req.on('close', () => job.listeners.delete(listener));
      } else if (req.method === 'POST' && /^\/api\/jobs\/\d+\/stop$/.test(url.pathname)) {
        const job = jobs.find((each) => each.id === Number(url.pathname.split('/')[3]));
        if (!job) return json(res, 404, { error: 'no such job' });
        if (job.status === 'running') job.child.kill('SIGINT');
        json(res, 200, jobView(job));
      } else if (route === 'POST /api/file') {
        const body = await readBody(req);
        const folder = body?.folder;
        if (typeof folder !== 'string' || !isUnder(journals, folder)) return json(res, 400, { error: `${String(folder)} is not under ${journals}` });
        const draft = draftsIn(folder).find((each) => each.finding === body.finding);
        if (!draft) return json(res, 404, { error: `no draft for ${String(body.finding)} in ${folder}` });
        const filed = await fileDraft(draft, { configFolder, filing: readFiling(configFolder) });
        json(res, 200, filed);
      } else {
        json(res, 404, { error: `nothing at ${route}` });
      }
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: /** @type {Error} */ (error).message });
      else res.end();
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      boundPort = typeof address === 'object' && address ? address.port : port;
      const url = `http://127.0.0.1:${boundPort}/?token=${token}`;
      if (!quiet) {
        console.log(`Phileas, for ${config}, at:\n\n  ${url}\n`);
        console.log(
          appDir
            ? `Journeys started from it run the application at ${appDir}, from ${APP_DIR_VARIABLE}.`
            : `${APP_DIR_VARIABLE} is not set, so a Journey whose adapter reads it fails when started from here. Set it before phileas view to run one.`
        );
        console.log('Only this machine can reach it, and only with the token above. Ctrl-C stops it, and any job it started.');
      }
      const stop = () => {
        for (const job of jobs) if (job.status === 'running') job.child.kill('SIGINT');
        server.close();
        process.exit(0);
      };
      if (!quiet) process.once('SIGINT', stop);
      resolve({ url, server, token });
    });
  });
}
