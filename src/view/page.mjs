// The page `phileas view` serves: one file, no dependencies, nothing fetched
// from anywhere but the server that served it, fonts included, which is why
// it names only faces macOS ships.
//
// **Every value from a journal is set as text, never as markup.** A journal
// holds whatever the application put on its screen and in its logs, and the
// page would otherwise run it.
//
// **Each Route is drawn as a line,** since reading a Route quickly enough to
// judge its finding is the page's main job. A run is a stack of them, each as
// long as the Hops it traveled out of its Trip, with its outcome only at its
// end: a terminus where it passed, a bar where it failed, a line that stops
// short where it stranded, and one cut off where it did not finish. Opened, a
// Route's line runs down the page with one stop per step, the Fix drawn as a
// double rail and the Trip as a single one: the known start and the
// unpredictable continuation. Color says an outcome and nothing else.
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
    --chart: #e9edef; --surface: #f6f8f9; --rule: #cfd6db; --faint: #b5bec5;
    --ink: #1b2430; --quiet: #56626e;
    --route: #2a4e8c; --clear: #2f7d4f; --danger: #c23b2e; --caution: #9a6508; --cut: #7d8790;
    --danger-wash: #f6e3e0;
    --read: "Avenir Next", Avenir, system-ui, sans-serif;
    --count: "Avenir Next Condensed", "Avenir Next", system-ui, sans-serif;
    --id: ui-monospace, "SF Mono", Menlo, monospace;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --chart: #12171c; --surface: #1a2128; --rule: #2e3943; --faint: #435160;
      --ink: #dce3e8; --quiet: #93a0ac;
      --route: #8fb0e6; --clear: #7cc79a; --danger: #f08a7e; --caution: #e7b652; --cut: #8a959f;
      --danger-wash: #3a2222;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--chart); color: var(--ink); font: 15px/1.5 var(--read); }
  :focus-visible { outline: 2px solid var(--route); outline-offset: 2px; border-radius: 2px; }
  .id { font-family: var(--id); font-size: 13px; overflow-wrap: anywhere; }
  .quiet { color: var(--quiet); }

  button { font: 500 14px/1.2 var(--read); color: var(--ink); background: var(--surface); border: 1px solid var(--rule); border-radius: 4px; padding: 7px 12px; cursor: pointer; }
  button:hover { border-color: var(--quiet); }
  button.go { background: var(--route); border-color: var(--route); color: var(--chart); }
  button:disabled { opacity: .5; cursor: default; }
  input { font: 15px/1.3 var(--read); width: 100%; padding: 6px 8px; border: 1px solid var(--rule); border-radius: 4px; background: var(--surface); color: var(--ink); }
  label { display: block; font-size: 13px; color: var(--quiet); }

  /* The top of the page: what this page serves, and the one way to start a Journey. */
  .top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 20px; padding: 14px 24px; border-bottom: 1px solid var(--rule); }
  .top h1 { font: 700 22px/1 var(--count); letter-spacing: .01em; margin: 0; }
  .top .where { display: flex; flex-wrap: wrap; gap: 4px 16px; flex: 1; min-width: 0; font-size: 13px; }
  .top .unfiled { color: var(--caution); }
  .booking { display: none; padding: 16px 24px 20px; border-bottom: 1px solid var(--rule); background: var(--surface); }
  .booking.open { display: block; }
  .booking form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 16px; max-width: 980px; align-items: end; }
  .booking p { margin: 0 0 12px; max-width: 70ch; }

  .layout { display: grid; grid-template-columns: minmax(220px, 280px) 1fr; min-height: calc(100vh - 54px); }
  .runs { border-right: 1px solid var(--rule); padding: 16px 12px 16px 24px; overflow: auto; max-height: 100vh; position: sticky; top: 0; }
  .runs h2 { font: 600 16px/1.2 var(--count); margin: 0 0 10px; }
  .runs ol { list-style: none; margin: 0; padding: 0; }
  .runs button { display: block; width: 100%; text-align: left; border: 0; border-left: 3px solid transparent; border-radius: 0; background: none; padding: 7px 8px 7px 10px; }
  .runs button:hover { background: var(--surface); }
  .runs button[aria-current="true"] { border-left-color: var(--route); background: var(--surface); }
  .runs .when { display: block; font-weight: 600; }
  .runs .what { display: block; font-size: 13px; color: var(--quiet); margin-top: 2px; }
  .content { padding: 20px 24px 120px; min-width: 0; }
  .alert { color: var(--danger); margin: 0 0 12px; max-width: 80ch; }
  .alert:empty { display: none; }
  .notice { margin: 0 0 12px; max-width: 80ch; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--clear); }
  .notice:empty { display: none; }
  .notice a { color: var(--route); }
  /* Asked in the page rather than in a browser dialog, which a browser may
     answer itself without showing, and which cannot show a long notice well. */
  .ask { margin: 12px 0 0; padding: 12px 14px; max-width: 90ch; background: var(--surface); border-left: 3px solid var(--route); }
  .ask:focus { outline: none; }
  .ask h4 { font: 600 17px/1.3 var(--read); margin: 0; }
  .ask pre { white-space: pre-wrap; max-height: 40vh; }
  .ask .actions { margin-top: 10px; }

  .run-head h2 { font: 600 28px/1.15 var(--count); margin: 0 0 4px; }
  .tally { margin: 0 0 14px; font-size: 16px; }
  .tally b { font: 600 18px/1 var(--count); font-variant-numeric: tabular-nums; }
  .tally .passed b { color: var(--clear); } .tally .failed b { color: var(--danger); }
  .tally .stranded b { color: var(--caution); } .tally .unfinished b { color: var(--cut); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .built { font-size: 13px; color: var(--quiet); margin: 12px 0 0; max-width: 90ch; }
  .built div { margin: 2px 0; }
  h3 { font: 600 19px/1.2 var(--count); margin: 28px 0 10px; }

  /* A run as lines, one per Route. */
  .lines-bar { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; margin: 28px 0 8px; }
  .lines-bar h3 { margin: 0; }
  .lines-bar label { display: flex; gap: 6px; align-items: center; font-size: 14px; color: var(--ink); }
  .lines-bar input { width: auto; }
  .lines { list-style: none; margin: 0; padding: 0; }
  .line { display: grid; grid-template-columns: 3.2em minmax(160px, 1fr) minmax(220px, 1.1fr); gap: 14px; align-items: center; width: 100%; text-align: left; border: 0; border-radius: 0; background: none; padding: 3px 4px; }
  .line:hover, .line[aria-expanded="true"] { background: var(--surface); }
  .line .no { font: 600 16px/1 var(--count); font-variant-numeric: tabular-nums; text-align: right; color: var(--quiet); }
  .line[aria-expanded="true"] .no { color: var(--route); }
  .line .say { font-size: 14px; overflow-wrap: anywhere; }
  .line .say .id { font-size: 12px; }
  .track { position: relative; height: 14px; }
  .track::before { content: ""; position: absolute; left: 0; right: 0; top: 6px; border-top: 2px dotted var(--faint); }
  .track::after { content: ""; position: absolute; left: -3px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: var(--ink); }
  .travel { position: absolute; left: 0; top: 5px; height: 4px; width: var(--reach); background: var(--ink); border-radius: 2px; transform-origin: left; }
  .end { position: absolute; left: var(--reach); top: 0; height: 14px; transform: translateX(-50%); }
  .passed .end { width: 14px; height: 14px; top: 0; border-radius: 50%; border: 3px solid var(--clear); background: var(--chart); }
  .line.passed:hover .end, .line.passed[aria-expanded="true"] .end { background: var(--surface); }
  .failed .end { width: 11px; height: 11px; top: 2px; background: var(--danger); border-radius: 1px; }
  .stranded .end { width: 5px; height: 16px; top: -1px; background: var(--caution); border-radius: 1px; }
  .unfinished .end { width: 3px; background: var(--cut); transform: translateX(-50%) skewX(-24deg); }
  .say .how { font-weight: 600; }
  .passed .say .how { color: var(--clear); } .failed .say .how { color: var(--danger); }
  .stranded .say .how { color: var(--caution); } .unfinished .say .how { color: var(--cut); }
  @media (prefers-reduced-motion: no-preference) {
    .drawing .travel { animation: draw .5s cubic-bezier(.2,.7,.2,1) backwards; animation-delay: var(--delay); }
    .drawing .end { animation: arrive .2s ease-out backwards; animation-delay: calc(var(--delay) + .4s); }
  }
  @keyframes draw { from { transform: scaleX(0); } }
  @keyframes arrive { from { opacity: 0; } }

  /* One Route, opened: its line runs down the page, one stop per step. */
  .route { margin: 6px 0 18px 4px; padding: 16px 20px 18px; background: var(--surface); border-left: 3px solid var(--route); }
  .route-head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; }
  .route-head h4 { font: 600 21px/1.2 var(--count); margin: 0; }
  .route-facts { margin: 6px 0 12px; font-size: 13px; color: var(--quiet); max-width: 90ch; }
  .route-facts div { margin: 2px 0; }
  .stops { list-style: none; margin: 8px 0 0; padding: 0; }
  .leg { position: relative; font: 600 15px/1.2 var(--count); color: var(--quiet); padding: 10px 0 4px 34px; }
  .leg + .stop::before, .leg + .note::before { top: -2px; }
  .stop ~ .leg::before { content: ""; position: absolute; left: 11px; top: 0; bottom: 0; border-left: 2px solid var(--ink); }
  .stop { position: relative; display: grid; grid-template-columns: 4.4em 4.6em minmax(0, 1fr); gap: 2px 10px; padding: 3px 0 5px 34px; }
  .stop::before, .note::before { content: ""; position: absolute; left: 11px; top: 0; bottom: 0; border-left: 2px solid var(--ink); }
  .stop.fix::before { left: 8px; width: 8px; border-right: 2px solid var(--ink); }
  .stop::after { content: ""; position: absolute; left: 7px; top: 10px; width: 10px; height: 10px; border-radius: 50%; background: var(--surface); border: 2px solid var(--ink); }
  .stop.still::after { border-color: var(--faint); }
  .stop.gave-up::after { border-style: dashed; border-color: var(--cut); }
  .stop.known::after { background: var(--caution); border-color: var(--caution); }
  .stop.broke::after { background: var(--danger); border-color: var(--danger); border-radius: 1px; }
  .stop .n { font: 600 14px/1.6 var(--count); font-variant-numeric: tabular-nums; color: var(--quiet); }
  .stop .act { font-size: 13px; line-height: 1.75; color: var(--quiet); }
  .stop .what { min-width: 0; }
  .stop .target { font-family: var(--id); font-size: 13px; overflow-wrap: anywhere; }
  .stop .typed { font-family: var(--id); font-size: 13px; color: var(--route); }
  .stop .did { display: block; font-size: 14px; color: var(--quiet); overflow-wrap: anywhere; }
  .stop.changed .did { color: var(--ink); }
  .stop .flag { display: block; font-size: 13px; color: var(--quiet); overflow-wrap: anywhere; }
  .stop .flag.known-flag { color: var(--caution); }
  .stop .flag.broke-flag { color: var(--danger); }
  .stop .finding { grid-column: 3; margin-top: 4px; padding: 8px 10px; background: var(--danger-wash); border-left: 3px solid var(--danger); font-size: 14px; overflow-wrap: anywhere; }
  .stop .finding b { color: var(--danger); }
  .note { position: relative; padding: 3px 0 5px 34px; font-size: 13px; color: var(--quiet); }
  .terminus { position: relative; padding: 8px 0 0 34px; }
  .terminus::after { content: ""; position: absolute; left: 11px; top: 0; height: 10px; border-left: 2px solid var(--ink); }
  .terminus::before { content: ""; position: absolute; left: 3px; top: 9px; width: 18px; height: 18px; border-radius: 50%; border: 4px solid var(--cut); background: var(--surface); box-sizing: border-box; }
  .terminus.passed::before { border-color: var(--clear); }
  .terminus.failed::before { border-color: var(--danger); background: var(--danger); border-radius: 2px; }
  .terminus.stranded::before { left: 2px; top: 15px; width: 20px; height: 6px; border: 0; border-radius: 1px; background: var(--caution); }
  .terminus .how { font-weight: 600; }
  .terminus.passed .how { color: var(--clear); } .terminus.failed .how { color: var(--danger); }
  .terminus.stranded .how { color: var(--caution); } .terminus.unfinished .how { color: var(--cut); }
  .reason { white-space: pre-wrap; margin: 6px 0 0; max-width: 100ch; }
  .printed { margin-top: 14px; }
  .printed summary { cursor: pointer; font-size: 14px; color: var(--quiet); }

  pre { font-family: var(--id); font-size: 12.5px; line-height: 1.45; background: var(--chart); border: 1px solid var(--rule); border-radius: 3px; padding: 10px 12px; overflow: auto; white-space: pre; max-height: 60vh; margin: 8px 0 0; }
  .found { list-style: none; margin: 0; padding: 0; max-width: 100ch; }
  .found li { padding: 8px 0; border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 7em minmax(0, 1fr); gap: 2px 12px; }
  .found .sig { grid-column: 2; font-size: 12px; color: var(--quiet); }
  .report { white-space: pre-wrap; font-size: 14px; max-width: 80ch; background: var(--surface); padding: 14px 16px; border-left: 3px solid var(--rule); }
  .draft { background: var(--surface); padding: 14px 16px; margin: 0 0 12px; max-width: 100ch; border-left: 3px solid var(--rule); }
  .draft h4 { font: 600 17px/1.3 var(--read); margin: 0 0 4px; }
  .draft .blocked { color: var(--danger); font-size: 14px; }
  .draft pre { white-space: pre-wrap; }
  .empty { max-width: 60ch; }

  /* A job's output, docked at the bottom while it runs and after. */
  .job { position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface); border-top: 2px solid var(--route); box-shadow: 0 -8px 24px rgba(16, 24, 32, .12); z-index: 2; }
  .job[hidden] { display: none; }
  .job-head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px 24px; }
  .job-head strong { font: 600 17px/1.2 var(--count); }
  .job-head .state { font-size: 14px; color: var(--quiet); flex: 1; }
  .job pre { margin: 0 24px 14px; max-height: 34vh; }
  .job.small pre { display: none; }

  @media (max-width: 760px) {
    .top, .booking { padding-left: 16px; padding-right: 16px; }
    .layout { grid-template-columns: 1fr; }
    .runs { position: static; max-height: 38vh; border-right: 0; border-bottom: 1px solid var(--rule); padding: 12px 16px; }
    .content { padding: 16px 16px 120px; }
    .line { grid-template-columns: 2.6em minmax(0, 1fr); gap: 4px 12px; }
    .line .say { grid-column: 2; }
    .route { margin-left: 0; padding: 12px 12px 14px; }
    .stop { grid-template-columns: 3.6em minmax(0, 1fr); }
    .stop .act { display: none; }
    .stop .finding { grid-column: 2; }
    .job-head { padding: 10px 16px; }
    .job pre { margin: 0 16px 14px; }
  }
</style>
</head>
<body>
<header class="top">
  <h1>Phileas</h1>
  <div class="where" id="where"></div>
  <button type="button" id="book" aria-expanded="false" aria-controls="booking">New Journey</button>
</header>
<section class="booking" id="booking" aria-label="New Journey">
  <p class="quiet">Leave a field empty to keep what the Journey file books.</p>
  <form id="journey">
    <label>Routes <input name="routes" inputmode="numeric" autocomplete="off"></label>
    <label>Trip length <input name="tripLength" inputmode="numeric" autocomplete="off"></label>
    <label>Seed <input name="seed" placeholder="a fresh one" autocomplete="off"></label>
    <label>Fix <input name="fix" autocomplete="off"></label>
    <label>Let in exclusion groups <input name="allow" placeholder="none" autocomplete="off"></label>
    <div><button class="go" type="submit">Start the Journey</button></div>
  </form>
</section>
<div class="layout">
  <nav class="runs" aria-label="Runs kept">
    <h2>Runs kept</h2>
    <ol id="runs"></ol>
  </nav>
  <main class="content">
    <p class="alert" id="error" role="alert"></p>
    <p class="notice" id="notice" role="status"></p>
    <div id="run"><p class="empty quiet">Choose a run to see its Routes.</p></div>
  </main>
</div>
<section class="job" id="job" hidden aria-label="Job output"></section>
<script>
(() => {
  const token = new URLSearchParams(location.search).get('token') || '';
  history.replaceState(null, '', '/?token=' + encodeURIComponent(token));
  const $ = (id) => document.getElementById(id);
  // Builds an element. Children are set as text, so nothing from a journal
  // is ever read as markup.
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') node.className = value;
      else if (key === 'style') for (const [name, v] of Object.entries(value)) node.style.setProperty(name, v);
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) if (child !== null && child !== undefined && child !== false && child !== '') node.append(typeof child === 'string' ? document.createTextNode(child) : child);
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
  // Asks a question in the page, into the element given, and answers whether
  // the person said yes. Asking again replaces it. Never a browser dialog: a
  // browser may answer one itself without showing it, measured in the Claude
  // app's browser pane on 2026-10-12, and the button then did nothing at all.
  const ask = (into, { title, text, yes }) => new Promise((resolve) => {
    const answer = (said) => { into.replaceChildren(); resolve(said); };
    const panel = el('div', { class: 'ask', tabindex: '-1', role: 'group', 'aria-label': title },
      el('h4', {}, title),
      text ? el('pre', {}, text) : null,
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'go', onclick: () => answer(true) }, yes),
        el('button', { type: 'button', onclick: () => answer(false) }, 'Cancel')));
    panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') answer(false); });
    into.replaceChildren(panel);
    panel.focus();
  });
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  const capital = (text) => text ? text[0].toUpperCase() + text.slice(1) : text;
  // Playwright's errors carry terminal colors, which a page shows as debris.
  const plain = (text) => String(text).replace(/\\x1b\\[[0-9;]*m/g, '');

  // A run is named for when it started, in UTC: 2026-10-12T11-00-00-000Z.
  const runWhen = (name) => {
    const iso = name.replace(/^(\\d{4}-\\d{2}-\\d{2})T(\\d{2})-(\\d{2})-(\\d{2})-(\\d{3})Z$/, '$1T$2:$3:$4.$5Z');
    const date = new Date(iso);
    return isNaN(date) ? name : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  let current = null;
  let openRoute = null;
  let notPassedOnly = false;

  async function loadOverview() {
    const overview = await api('/api/overview');
    $('where').replaceChildren(
      el('span', { class: 'id quiet', title: 'Journals in ' + overview.journals }, overview.config),
      overview.appDir
        ? el('span', { class: 'quiet' }, 'Runs ', el('span', { class: 'id' }, overview.appDir))
        : el('span', { class: 'unfiled', title: 'Journeys started here inherit it from phileas view' }, 'PHILEAS_APP_DIR is not set, so an adapter that reads it cannot start a Journey here'),
      overview.filing
        ? el('span', { class: 'quiet' }, 'Files findings in ', el('span', { class: 'id' }, overview.filing.repository))
        : el('span', { class: 'unfiled' }, overview.filingError || 'No filing.json, so nothing can be filed from here'),
    );
    $('runs').replaceChildren(...(overview.runs.length ? overview.runs.map((run) =>
      el('li', {}, el('button', { type: 'button', title: run.folder, 'aria-current': String(current === run.folder), onclick: () => openRun(run.folder) },
        el('span', { class: 'when' }, runWhen(run.run)),
        el('span', { class: 'what' }, plural(run.routes, 'Route') + ', seed ', el('span', { class: 'id' }, run.seed))))
    ) : [el('li', { class: 'quiet' }, 'No runs kept yet. Start a Journey to make one.')]));
    const running = overview.jobs.find((job) => job.status === 'running');
    if (running && !watching) watch(running);
  }

  $('book').addEventListener('click', () => {
    const open = !$('booking').classList.contains('open');
    $('booking').classList.toggle('open', open);
    $('book').setAttribute('aria-expanded', String(open));
    if (open) $('journey').elements.routes.focus();
  });

  // A job's output, docked at the bottom of the page.
  let watching = null;
  async function watch(job) {
    watching = job.id;
    const out = el('pre', { tabindex: '0' });
    const state = el('span', { class: 'state' }, 'Running');
    const stop = el('button', { type: 'button', onclick: () => api('/api/jobs/' + job.id + '/stop', {}).catch(showError) }, 'Stop');
    const shrink = el('button', { type: 'button', 'aria-expanded': 'true', onclick: () => {
      const small = $('job').classList.toggle('small');
      shrink.textContent = small ? 'Show output' : 'Hide output';
      shrink.setAttribute('aria-expanded', String(!small));
    } }, 'Hide output');
    const close = el('button', { type: 'button', hidden: true, onclick: () => { $('job').hidden = true; } }, 'Close');
    $('job').classList.remove('small');
    $('job').replaceChildren(el('div', { class: 'job-head' }, el('strong', {}, capital(job.label)), state, stop, shrink, close), out);
    $('job').hidden = false;
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
      const ended = /\\[ended ([^\\]]*)\\]\\s*$/.exec(out.textContent);
      state.textContent = ended ? 'Ended ' + ended[1] : 'Ended';
    } catch (error) { showError(error); state.textContent = 'The output stopped arriving'; }
    stop.disabled = true;
    close.hidden = false;
    watching = null;
    await loadOverview();
    if (current) await openRun(current);
  }

  async function startJob(body) {
    showError(null);
    try { watch(await api('/api/jobs', body)); } catch (error) { showError(error); }
  }

  // How a Route ended, in words, beside its line.
  function endingWords(route) {
    const findings = route.failedChecks.flatMap((check) => check.findings.map((f) => ({ check: check.check, ...f })));
    const replay = route.replays ? 'replay: ' + route.replays.verdict
      : route.replayedBy.length ? 'replayed: ' + route.replayedBy.map((r) => r.verdict).join('; ') : null;
    const of = route.tripLength ? ' of ' + route.tripLength : '';
    const parts = [];
    if (route.outcome === 'passed') parts.push(el('span', { class: 'how' }, 'Passed'), ', ' + plural(route.hops, 'Hop'));
    else if (route.outcome === 'failed' && !route.failedAt && route.hops === 0) {
      // A Fix that broke before any check ran: one broken precondition, not
      // a finding about the Route (R11).
      parts.push(el('span', { class: 'how' }, 'Fix failed'), ', so the Trip never started');
    } else if (route.outcome === 'failed') {
      parts.push(el('span', { class: 'how' }, 'Failed'), ' at ' + (route.failedAt ? route.failedAt.split(',')[0] : 'hop ' + route.hops));
      const checks = [...new Set(findings.map((f) => f.check))];
      if (checks.length) parts.push(': ' + checks.join(', '));
      // The new findings are what ended it; a known one met on the same Hop
      // is counted, and named only in the opened Route.
      const once = findings.filter((f, i) => findings.findIndex((o) => o.id === f.id) === i);
      const fresh = once.filter((f) => !f.known);
      const known = once.length - fresh.length;
      if (fresh.length) parts.push('. New ', ...fresh.slice(0, 2).flatMap((f, i) => [i ? ', ' : '', el('span', { class: 'id' }, f.id)]), fresh.length > 2 ? ' and ' + (fresh.length - 2) + ' more' : '');
      if (known) parts.push(el('span', { class: 'quiet' }, (fresh.length ? '; ' : '. ') + known + ' known'));
    } else if (route.outcome === 'stranded') parts.push(el('span', { class: 'how' }, 'Stranded'), ' after ' + route.hops + of);
    else parts.push(el('span', { class: 'how' }, 'Did not finish'), ' after ' + route.hops + of);
    if (replay) parts.push(el('span', { class: 'quiet' }, '  (' + replay + ')'));
    return parts;
  }

  // What a run's Routes ran against or on, each once, naming its Routes only
  // where they differ: one where the run was steady, more where it changed.
  function grouped(routes, textOf) {
    const groups = new Map();
    for (const route of routes) groups.set(textOf(route), [...(groups.get(textOf(route)) || []), route.routeNumber]);
    return [...groups].map(([text, numbers]) => text + (groups.size > 1 ? ' (Routes ' + numbers.join(', ') + ')' : '')).join('. ');
  }

  function standingWords(now) {
    if (now && now.standing === 'filed') return '; filed as ' + now.issue;
    if (now && now.standing === 'false alarm') return '; dismissed as a false alarm';
    if (now && now.standing === 'unfiled') return '; known, not yet filed';
    return '';
  }

  async function openRun(folder) {
    if (current !== folder) { openRoute = null; notPassedOnly = false; $('notice').replaceChildren(); }
    current = folder;
    showError(null);
    let data;
    try { data = await api('/api/run?folder=' + encodeURIComponent(folder)); } catch (error) { return showError(error); }
    for (const button of $('runs').querySelectorAll('button')) button.setAttribute('aria-current', String(button.title === folder));
    const { summary, report, drafts } = data;
    const c = summary.counts;
    const longest = Math.max(1, ...summary.routes.map((r) => r.tripLength || r.hops));

    const lines = el('ol', { class: 'lines drawing' });
    const drawLines = () => {
      const shown = summary.routes.filter((route) => !notPassedOnly || route.outcome !== 'passed');
      lines.replaceChildren(...shown.map((route, index) => {
        const reach = Math.max(0, Math.min(1, route.hops / (route.tripLength || longest)));
        const detail = el('div', { id: 'route-' + route.routeNumber });
        const row = el('button', {
          type: 'button', class: 'line ' + route.outcome, 'aria-expanded': 'false', 'aria-controls': 'route-' + route.routeNumber,
          style: { '--reach': (reach * 100).toFixed(2) + '%', '--delay': Math.min(index, 40) * 18 + 'ms' },
          onclick: () => toggleRoute(route, row, detail),
        },
          el('span', { class: 'no', 'aria-label': 'Route ' + route.routeNumber }, String(route.routeNumber)),
          el('span', { class: 'track', 'aria-hidden': 'true' }, el('span', { class: 'travel' }), el('span', { class: 'end' })),
          el('span', { class: 'say' }, ...endingWords(route)),
        );
        if (openRoute === route.journal) toggleRoute(route, row, detail);
        return el('li', {}, row, detail);
      }));
    };
    drawLines();
    setTimeout(() => lines.classList.remove('drawing'), 1600);

    const asking = el('div');
    const triage = async () => {
      showError(null);
      try {
        const { notice } = await api('/api/triage-notice?folder=' + encodeURIComponent(folder));
        if (await ask(asking, { title: 'Send this run to Anthropic for triage?', text: notice, yes: 'Send to Anthropic' })) startJob({ kind: 'triage', folder, send: true });
      } catch (error) { showError(error); }
    };
    const tally = [
      [c.passed, 'passed', 'passed'], [c.failed, 'failed', 'failed'],
      [c.stranded, 'stranded', 'stranded'], [c.unfinished, 'unfinished', 'did not finish'],
    ].filter(([n]) => n).map(([n, kind, words]) => el('span', { class: kind }, el('b', {}, String(n)), ' ' + words));

    $('run').replaceChildren(...[
      el('div', { class: 'run-head' },
        el('h2', {}, 'Run of ' + runWhen(summary.run)),
        el('p', { class: 'tally' }, ...tally.flatMap((part, i) => i ? [', ', part] : [part]),
          el('span', { class: 'quiet' }, '.  Seed '), el('span', { class: 'id' }, summary.seed)),
        el('div', { class: 'actions' },
          el('button', { type: 'button', onclick: () => startJob({ kind: 'reproduce', folder }) }, 'Reproduce new findings'),
          el('button', { type: 'button', onclick: triage }, 'Triage with Claude')),
        asking,
        el('div', { class: 'built' },
          el('div', {}, grouped(summary.routes, (route) => route.buildText)),
          el('div', {}, grouped(summary.routes, (route) => route.platformText)))),
      summary.newFindings.length ? el('section', {},
        el('h3', {}, capital(plural(summary.newFindings.length, 'new finding'))),
        el('ul', { class: 'found' }, ...summary.newFindings.map((f) => el('li', {},
          el('span', { class: 'id' }, f.id),
          el('span', {}, f.check + ', on ' + (f.routes.length === 1 ? 'Route ' : 'Routes ') + f.routes.join(', ') + standingWords(f.now)),
          el('span', { class: 'sig id' }, f.signature))))) : null,
      el('div', { class: 'lines-bar' },
        el('h3', {}, 'Routes'),
        c.passed && c.passed < summary.routes.length ? el('label', {},
          el('input', { type: 'checkbox', checked: notPassedOnly, onchange: (event) => { notPassedOnly = event.target.checked; drawLines(); } }),
          'Only Routes that did not pass') : null),
      lines,
      report ? el('section', {}, el('h3', {}, 'Triage report'), el('div', { class: 'report' }, report)) : null,
      drafts.length ? el('section', {}, el('h3', {}, capital(plural(drafts.length, 'draft'))), ...drafts.map((draft) => draftCard(folder, draft))) : null,
    ].filter(Boolean));
  }

  async function toggleRoute(route, row, into) {
    if (row.getAttribute('aria-expanded') === 'true') {
      row.setAttribute('aria-expanded', 'false');
      into.replaceChildren();
      openRoute = null;
      return;
    }
    let data;
    try { data = await api('/api/route?journal=' + encodeURIComponent(route.journal)); } catch (error) { return showError(error); }
    openRoute = route.journal;
    row.setAttribute('aria-expanded', 'true');
    into.replaceChildren(routeView(route, data));
  }

  // One Route, as a line down the page.
  function routeView(route, { opening, steps, outcome, setup, unreadable, lines }) {
    const stops = el('ol', { class: 'stops' });
    let leg = null;
    for (const step of steps) {
      if (step.kind === 'note') {
        stops.append(el('li', { class: 'note' }, 'Before hop ' + step.before + ': ' + step.text));
        continue;
      }
      if (step.kind !== leg) {
        leg = step.kind;
        stops.append(el('li', { class: 'leg' }, step.kind === 'fix' ? 'Fix' + (opening && opening.fix ? ', ' + opening.fix : '') : 'Trip'));
      }
      const look = step.failed.length || step.error ? 'broke' : step.known.length ? 'known' : step.abandoned ? 'gave-up' : step.effect === 'no change' ? 'still' : 'changed';
      stops.append(el('li', { class: 'stop ' + step.kind + ' ' + look },
        el('span', { class: 'n' }, (step.kind === 'fix' ? 'fix ' : 'hop ') + step.number),
        el('span', { class: 'act' }, step.action),
        el('span', { class: 'what' },
          el('span', { class: 'target' }, step.target),
          step.value ? el('span', { class: 'typed' }, '  ' + step.value) : null,
          step.effect ? el('span', { class: 'did' }, step.effect) : null,
          step.error ? el('span', { class: 'flag broke-flag' }, 'Failed: ' + plain(step.error)) : null,
          step.abandoned ? el('span', { class: 'flag' }, 'Gave up: ' + step.abandoned) : null,
          step.caught.length ? el('span', { class: 'flag' }, 'Stubbed: ' + step.caught.join('; ')) : null,
          step.recovered ? el('span', { class: 'flag' }, capital(step.recovered)) : null,
          step.known.length ? el('span', { class: 'flag known-flag' }, 'Carried on past known ',
            ...step.known.flatMap((k, i) => [i ? ', ' : '', el('span', { class: 'id' }, k.id), ' (' + k.standing + ')'])) : null),
        ...step.failed.map((check) => el('div', { class: 'finding' },
          el('b', {}, check.check), ': ' + check.observation,
          ...check.findings.map((f) => el('div', {}, 'Finding ', el('span', { class: 'id' }, f.id), f.arrived ? ', arrived ' + f.arrived : ''))))));
    }
    for (const problem of unreadable) stops.append(el('li', { class: 'note' }, capital(problem) + '.'));
    const ending = outcome ? outcome.outcome : 'unfinished';
    stops.append(el('li', { class: 'terminus ' + ending },
      el('span', { class: 'how' }, { passed: 'Passed', failed: 'Failed', stranded: 'Stranded' }[ending] || 'Did not finish'),
      outcome ? ' after ' + plural(outcome.hops, 'Hop') + (outcome.ranWith ? '; ' + outcome.ranWith : '') : ': no outcome was recorded, so the Route stopped partway',
      // The setup only where what ran does not bear it out.
      setup ? '; ' + setup : '',
      outcome && outcome.reason ? el('pre', { class: 'reason' }, plain(outcome.reason)) : null));

    return el('div', { class: 'route' },
      el('div', { class: 'route-head' },
        el('h4', {}, 'Route ' + route.routeNumber),
        route.failedChecks.length ? el('button', { type: 'button', class: 'go', onclick: () => startJob({ kind: 'replay', journal: route.journal }) }, 'Replay to the finding') : null,
        el('button', { type: 'button', onclick: () => startJob({ kind: 'replay', journal: route.journal, whole: true }) }, 'Replay every Hop')),
      opening ? el('div', { class: 'route-facts' },
        el('div', {}, 'Route seed ', el('span', { class: 'id' }, opening.routeSeed), ', Trip of ' + plural(opening.tripLength, 'Hop') + (opening.fix ? ', Fix ' + opening.fix : ', no Fix')),
        el('div', {}, opening.build),
        el('div', {}, opening.platform)) : null,
      stops,
      el('details', { class: 'printed' }, el('summary', {}, 'As phileas show prints it'), el('pre', {}, lines.join('\\n'))));
  }

  function draftCard(folder, draft) {
    const asking = el('div');
    const file = async () => {
      showError(null);
      const into = 'File in ' + draft.repository;
      if (!await ask(asking, { title: into + '? A filed issue cannot be taken back.', text: draft.title, yes: into })) return;
      try {
        const filed = await api('/api/file', { folder, finding: draft.finding });
        $('notice').replaceChildren('Filed as ' + filed.issue + ': ', el('a', { href: filed.url, target: '_blank', rel: 'noreferrer' }, filed.url));
        await openRun(folder);
      } catch (error) { showError(error); }
    };
    return el('article', { class: 'draft' },
      el('h4', {}, draft.title),
      el('div', { class: 'quiet' }, 'For finding ', el('span', { class: 'id' }, draft.finding)),
      draft.problems.length ? el('p', { class: 'blocked' }, 'Cannot be filed as it stands: ' + draft.problems.join('; ')) : null,
      el('pre', {}, draft.body),
      el('p', {}, el('button', { type: 'button', class: 'go', disabled: draft.problems.length > 0 || !draft.repository, onclick: file }, 'File in ' + (draft.repository || 'no repository'))),
      asking);
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
