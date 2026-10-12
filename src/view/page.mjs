// The page `phileas view` serves: one file, no dependencies, nothing fetched
// from anywhere but the server that served it.
//
// **Every value from a journal is set as text, never as markup.** A journal
// holds whatever the application put on its screen and in its logs, and the
// page would otherwise run it.
//
// Plain JavaScript for the renderer's reason.

export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phileas</title>
<style>
  :root {
    --bg: #fbfaf7; --panel: #ffffff; --ink: #1d1d1b; --muted: #6b6a66; --line: #e3e1db;
    --accent: #1f5f8b; --pass: #2e7d32; --fail: #b3261e; --strand: #8a6d00; --unfinished: #6b6a66;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #161615; --panel: #1f1f1d; --ink: #ecebe6; --muted: #a09f99; --line: #34332f;
      --accent: #7fb6dd; --pass: #7cc47f; --fail: #f2867c; --strand: #e0c35a; --unfinished: #a09f99;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, sans-serif; }
  header { padding: 12px 16px; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  header h1 { font-size: 17px; margin: 0; }
  header .where { color: var(--muted); font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }
  main { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; min-height: calc(100vh - 50px); }
  @media (max-width: 760px) { main { grid-template-columns: 1fr; } nav { max-height: 40vh; } }
  nav { border-right: 1px solid var(--line); overflow: auto; padding: 12px 16px; }
  section { padding: 12px 16px; overflow: auto; min-width: 0; }
  h2 { font-size: 14px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  h2:first-child { margin-top: 0; }
  button { font: inherit; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
  button:disabled { opacity: .5; cursor: default; }
  input { font: inherit; width: 100%; padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); }
  label { display: block; color: var(--muted); font-size: 12px; margin-top: 6px; }
  .runs button { display: block; width: 100%; text-align: left; margin: 0 0 4px; font-family: var(--mono); font-size: 12px; }
  .runs button.on { border-color: var(--accent); }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
  .outcome-passed { color: var(--pass); } .outcome-failed { color: var(--fail); }
  .outcome-stranded { color: var(--strand); } .outcome-unfinished { color: var(--unfinished); }
  .mono { font-family: var(--mono); font-size: 12px; }
  pre { font-family: var(--mono); font-size: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px; overflow: auto; white-space: pre; max-height: 60vh; margin: 0; }
  .report { white-space: pre-wrap; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
  .problems { color: var(--fail); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .muted { color: var(--muted); }
  .error { color: var(--fail); }
</style>
</head>
<body>
<header><h1>Phileas</h1><span class="where" id="where"></span></header>
<main>
  <nav>
    <h2>New Journey</h2>
    <form id="journey">
      <label>Routes <input name="routes" inputmode="numeric" placeholder="as booked"></label>
      <label>Trip length <input name="tripLength" inputmode="numeric" placeholder="as booked"></label>
      <label>Seed <input name="seed" placeholder="a fresh one"></label>
      <label>Fix <input name="fix" placeholder="as booked"></label>
      <label>Let in exclusion groups <input name="allow" placeholder="none"></label>
      <p><button class="primary" type="submit">Run</button></p>
    </form>
    <h2>Runs</h2>
    <div class="runs" id="runs"></div>
  </nav>
  <section>
    <div id="error" class="error"></div>
    <div id="job"></div>
    <div id="run"><p class="muted">Choose a run.</p></div>
  </section>
</main>
<script>
(() => {
  const token = new URLSearchParams(location.search).get('token') || '';
  history.replaceState(null, '', '/?token=' + encodeURIComponent(token));
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) if (child !== null && child !== undefined) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    return node;
  };
  const api = async (path, body) => {
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-phileas-token': token, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || response.statusText);
    return data;
  };
  const showError = (error) => { $('error').textContent = error ? String(error.message || error) : ''; };
  let overview = null;
  let current = null;

  async function loadOverview() {
    overview = await api('/api/overview');
    $('where').textContent = overview.config + '  ·  ' + overview.journals +
      (overview.filing ? '  ·  files to ' + overview.filing.repository : overview.filingError ? '  ·  ' + overview.filingError : '  ·  no filing.json');
    const runs = $('runs');
    runs.replaceChildren(...(overview.runs.length ? overview.runs.map((run) =>
      el('button', { class: current === run.folder ? 'on' : '', title: run.folder, onclick: () => openRun(run.folder) },
        run.run, el('br'), el('span', { class: 'muted' }, 'seed ' + run.seed + ', ' + run.routes + ' Route(s)'))
    ) : [el('p', { class: 'muted' }, 'No runs kept yet.')]));
    const running = overview.jobs.find((job) => job.status === 'running');
    if (running && !watching) watch(running);
  }

  let watching = null;
  async function watch(job) {
    watching = job.id;
    const out = el('pre');
    const stop = el('button', { onclick: () => api('/api/jobs/' + job.id + '/stop', {}).catch(showError) }, 'Stop');
    $('job').replaceChildren(el('div', { class: 'card' }, el('div', { class: 'row' }, el('strong', {}, job.label), stop), out));
    try {
      const response = await fetch('/api/jobs/' + job.id + '/output', { headers: { 'x-phileas-token': token } });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const atEnd = out.scrollTop + out.clientHeight >= out.scrollHeight - 4;
        out.textContent += decoder.decode(value, { stream: true });
        if (atEnd) out.scrollTop = out.scrollHeight;
      }
    } catch (error) { showError(error); }
    stop.disabled = true;
    watching = null;
    await loadOverview();
    if (current) await openRun(current);
  }

  async function startJob(body) {
    showError(null);
    try { watch(await api('/api/jobs', body)); } catch (error) { showError(error); }
  }

  async function openRun(folder) {
    current = folder;
    showError(null);
    let data;
    try { data = await api('/api/run?folder=' + encodeURIComponent(folder)); } catch (error) { return showError(error); }
    for (const button of $('runs').children) button.classList.toggle('on', button.title === folder);
    const { summary, report, drafts } = data;
    const c = summary.counts;
    const routeView = el('div');
    const rows = summary.routes.map((route) => el('tr', {},
      el('td', {}, String(route.routeNumber)),
      el('td', { class: 'outcome-' + route.outcome }, route.outcome),
      el('td', {}, String(route.hops) + (route.tripLength ? ' / ' + route.tripLength : '')),
      el('td', { class: 'mono' }, route.failedChecks.flatMap((check) => check.findings.map((f) => f.id + (f.known ? ' (known' + (f.issue ? ', ' + f.issue : '') + ')' : ' (new)'))).join(', ') || route.failedAt || ''),
      el('td', {}, route.replays ? 'replay: ' + route.replays.verdict : route.replayedBy.map((r) => r.verdict).join('; ')),
      el('td', { class: 'row' },
        el('button', { onclick: () => showRoute(route.journal, routeView) }, 'Hops'),
        route.outcome !== 'passed' ? el('button', { onclick: () => startJob({ kind: 'replay', journal: route.journal }) }, 'Replay') : null),
    ));
    const triage = async () => {
      showError(null);
      try {
        const { notice } = await api('/api/triage-notice?folder=' + encodeURIComponent(folder));
        if (confirm(notice + '\\n\\nSend it?')) startJob({ kind: 'triage', folder, send: true });
      } catch (error) { showError(error); }
    };
    $('run').replaceChildren(...[
      el('h2', {}, 'Run ' + summary.run),
      el('p', {}, 'Seed ', el('span', { class: 'mono' }, summary.seed), ': ',
        c.passed + ' passed, ' + c.failed + ' failed, ' + c.stranded + ' stranded' + (c.unfinished ? ', ' + c.unfinished + ' did not finish' : '')),
      el('div', { class: 'row' },
        el('button', { onclick: () => startJob({ kind: 'reproduce', folder }) }, 'Reproduce new findings'),
        el('button', { onclick: triage }, 'Triage with Claude')),
      el('h2', {}, 'Routes'),
      el('table', {}, el('thead', {}, el('tr', {}, ...['Route', 'Outcome', 'Hops', 'Findings', 'Replay', ''].map((h) => el('th', {}, h)))), el('tbody', {}, rows)),
      routeView,
      report ? el('div', {}, el('h2', {}, 'Triage report'), el('div', { class: 'card report' }, report)) : null,
      drafts.length ? el('div', {}, el('h2', {}, 'Drafts'), ...drafts.map((draft) => draftCard(folder, draft))) : null,
    ].filter(Boolean));
  }

  async function showRoute(journal, into) {
    try {
      const { lines } = await api('/api/route?journal=' + encodeURIComponent(journal));
      into.replaceChildren(el('h2', {}, journal.split('/').pop()), el('pre', {}, lines.join('\\n')));
    } catch (error) { showError(error); }
  }

  function draftCard(folder, draft) {
    const file = async () => {
      if (!confirm('File this as an issue in ' + (draft.repository || 'the repository filing.json names') + '? It cannot be taken back.\\n\\n' + draft.title)) return;
      try {
        const filed = await api('/api/file', { folder, finding: draft.finding });
        alert('Filed as ' + filed.issue + '\\n' + filed.url);
        await openRun(folder);
      } catch (error) { showError(error); }
    };
    return el('div', { class: 'card' },
      el('div', { class: 'row' }, el('strong', {}, draft.title), el('span', { class: 'mono muted' }, draft.finding)),
      draft.problems.length ? el('p', { class: 'problems' }, 'Cannot be filed as it stands: ' + draft.problems.join('; ')) : null,
      el('pre', { class: 'report' }, draft.body),
      el('p', {}, el('button', { class: 'primary', disabled: draft.problems.length > 0 || !draft.repository, onclick: file }, 'File in ' + (draft.repository || 'no repository'))),
    );
  }

  $('journey').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const body = { kind: 'run' };
    for (const [key, value] of form) if (String(value).trim()) body[key] = String(value).trim();
    startJob(body);
  });

  loadOverview().catch(showError);
})();
</script>
</body>
</html>
`;
