// The page: draws every screen from the game's state, and turns each control
// into one action for the rules in game.js.
//
// Every change to text, names and values happens at once, in the handler for
// the action that caused it; only hidden drawing animates. The engine's
// settle wait reads the accessibility tree, and text that changed later
// would be read by the next move or not depending on timing, which would
// make one seed play two games.
'use strict';

const G = window.EightyDays;
const $ = (id) => document.getElementById(id);

let world;
let data;
let state;
let screen = 'here';
let showClock = true;
let bradshawQuery = '';
let bradshawOpen = new Set();
let bradshawChosen = '';

/** Build an element. Attributes starting with "on" are handlers; the rest are set as written. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false || value === null) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** A decorative picture: never in the accessibility tree. */
function picture(className) {
  const div = h('div', { class: `engraving ${className}`, 'aria-hidden': 'true' });
  return div;
}

function dispatch(action) {
  const before = state;
  state = G.act(state, action, world);
  if (state.ledger.length > before.ledger.length) {
    for (const row of state.ledger.slice(before.ledger.length)) {
      if (row.kind === 'passage') window.eightyDays.log(`${G.clockText(state.hours, world.start)} arrived at ${world.places[row.to].name} from ${world.places[row.from].name} by ${row.mode}`);
    }
  }
  if (action.type === 'restart') screen = 'here';
  window.eightyDays.ended(state.phase === 'ended');
  render();
}

// --- the clock --------------------------------------------------------------

function drawDialTicks() {
  const g = $('dial-ticks');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(50 + Math.sin(a) * 34));
    line.setAttribute('y1', String(50 - Math.cos(a) * 34));
    line.setAttribute('x2', String(50 + Math.sin(a) * 39));
    line.setAttribute('y2', String(50 - Math.cos(a) * 39));
    line.setAttribute('class', 'dial-tick');
    g.append(line);
  }
}

function renderClock() {
  $('clock').hidden = !showClock;
  const days = state.hours / 24;
  $('clock-date').textContent = G.clockText(state.hours, world.start);
  $('clock-days').textContent =
    state.phase === 'club' ? 'The wager is not yet laid' : `Day ${Math.floor(days) + 1} of 80${state.crossedDateLine ? ', by Fogg’s diary' : ''}`;
  // The hand goes once round for the eighty days. Drawing only.
  $('dial-hand').style.transform = `rotate(${Math.min(days / 80, 1) * 360}deg)`;
}

// --- Here -------------------------------------------------------------------

const VENUE_NAMES = {
  quay: 'Quay',
  telegraph: 'Telegraph Office',
  market: 'Market',
  consulate: 'Consulate',
  hotel: 'Hotel',
  temple: 'Malabar Hill',
  tavern: 'Tavern',
  circus: 'Circus',
  fort: 'The fort',
};

const MODE_WORDS = { ship: 'By sea', boat: 'By sea', train: 'By rail', elephant: 'By elephant', sledge: 'By sledge', foot: 'On foot', cart: 'By cart' };

function notice() {
  return h('p', { class: 'notice', id: 'notice', 'aria-live': 'polite' }, state.notice || '');
}

function renderHere() {
  const section = $('here');
  if (state.phase === 'club') return section.replaceChildren(renderClub());
  if (state.phase === 'london') return section.replaceChildren(renderLondon());
  if (state.phase === 'ended') return section.replaceChildren(renderEnding());

  const place = world.places[state.place];
  const venues = ['quay', ...place.venues];
  if (!venues.includes(state.venue)) state.venue = 'quay';

  const tabs = h(
    'div',
    { role: 'tablist', 'aria-label': `Venues at ${place.name}`, class: 'venues' },
    venues.map((v) =>
      h(
        'button',
        {
          role: 'tab',
          id: `tab-${v}`,
          'aria-selected': String(state.venue === v),
          'aria-controls': 'venue-panel',
          class: state.venue === v ? 'selected' : '',
          onclick: () => dispatch({ type: 'venue', venue: v }),
        },
        VENUE_NAMES[v]
      )
    )
  );
  const panel = h('div', { role: 'tabpanel', id: 'venue-panel', 'aria-labelledby': `tab-${state.venue}`, class: 'venue' }, renderVenue(place, state.venue));

  section.replaceChildren(
    h('div', { class: 'place-head' }, picture(`place-${place.id}`), h('div', {}, h('h2', {}, place.name), h('p', { class: 'about' }, place.about), companions())),
    notice(),
    tabs,
    panel
  );
}

function companions() {
  const who = ['Fogg', state.passepartout && 'Passepartout', state.aouda && 'Aouda', state.kiouni && 'Kiouni'].filter(Boolean);
  return h('p', { class: 'party' }, `Travelling: ${who.join(', ')}. The carpet-bag holds ${G.pounds(state.bag)}.`);
}

function renderVenue(place, venue) {
  switch (venue) {
    case 'quay':
      return renderQuay(place);
    case 'telegraph':
      return renderTelegraph(place);
    case 'market':
      return renderMarket(place);
    case 'consulate':
      return h(
        'div',
        {},
        h('h3', {}, `The Consulate at ${place.name}`),
        h('p', {}, state.flags[`visa-${place.id}`] ? 'The passport bears this consulate’s visa.' : 'The passport has no visa from here yet.'),
        h('button', { onclick: () => dispatch({ type: 'visa', by: 'fogg' }) }, 'Have the passport stamped'),
        state.passepartout && h('button', { onclick: () => dispatch({ type: 'visa', by: 'servant' }) }, 'Send Passepartout with the passport')
      );
    case 'hotel':
      return h(
        'div',
        {},
        h('h3', {}, `A hotel at ${place.name}`),
        h(
          'label',
          {},
          'Stay ',
          h(
            'select',
            { id: 'stay' },
            h('option', { value: 'hour' }, 'an hour'),
            h('option', { value: 'night' }, 'a night'),
            h('option', { value: 'sailing' }, 'until the next sailing')
          )
        ),
        h('button', { onclick: () => dispatch({ type: 'stay', value: $('stay').value }) }, 'Take a room')
      );
    case 'temple':
      return h(
        'div',
        {},
        h('h3', {}, 'The pagoda on Malabar Hill'),
        h('p', {}, state.flags.temple ? 'Passepartout has seen the pagoda, and the priests have seen him.' : 'Passepartout would like to see the famous pagoda.'),
        state.passepartout && !state.flags.temple && h('button', { onclick: () => dispatch({ type: 'temple' }) }, 'Let Passepartout visit Malabar Hill')
      );
    case 'tavern':
      return h(
        'div',
        {},
        h('h3', {}, 'A tavern by the quay'),
        h('p', {}, 'A friendly stranger has been asking after Mr. Fogg.'),
        state.passepartout && !state.flags.tavern && h('button', { onclick: () => dispatch({ type: 'tavern' }) }, 'Let Passepartout drink with the stranger')
      );
    case 'circus':
      return h(
        'div',
        {},
        h('h3', {}, "The Honourable William Batulcar's troupe"),
        h('p', {}, 'The Long Noses of the god Tingou perform tonight.'),
        h('button', { onclick: () => dispatch({ type: 'circus' }) }, "Go to the Honourable William Batulcar's performance")
      );
    case 'fort':
      return h(
        'div',
        {},
        h('h3', {}, 'Fort Kearney'),
        h('p', {}, state.flags.passepartoutCaptured ? 'The war party has carried Passepartout off.' : 'The garrison stands to arms.'),
        state.flags.passepartoutCaptured && h('button', { onclick: () => dispatch({ type: 'soldiers' }) }, 'Lead the soldiers after the war party')
      );
  }
  return h('p', {}, 'Nothing here.');
}

function departureCard({ d, affordable }) {
  const when =
    d.departs !== undefined ? `Sails ${G.clockText(d.departsAt, world.start)}` : `Leaves when taken, ${G.durationText(G.hoursFor(state, d))}`;
  return h(
    'li',
    { class: `departure mode-${d.mode}` },
    h('span', { class: 'glyph', 'aria-hidden': 'true' }),
    h(
      'div',
      {},
      h('button', { id: `take-${d.id}`, onclick: () => dispatch({ type: 'take', departure: d.id }) }, d.label),
      h(
        'p',
        { class: 'departure-detail' },
        `${MODE_WORDS[d.mode]} to ${world.places[d.to].name}. ${when}.${d.cost ? ` ${G.pounds(d.cost)}.` : ''}${affordable ? '' : ' More than the carpet-bag holds.'}`
      ),
      h('p', { class: 'provenance' }, d.book ? `As in the book, chapter ${d.chapter}.` : 'The game’s own, not the book’s.')
    )
  );
}

function renderQuay(place) {
  const here = G.departuresHere(state, world);
  const parts = [h('h3', {}, `The quay at ${place.name}`)];
  if (place.id === 'kholby') parts.push(renderKiouni());
  if (place.id === 'pillaji') parts.push(renderPillaji());
  if (place.id === 'fortkearney') parts.push(renderSledge());
  parts.push(here.length ? h('ul', { class: 'departures' }, here.map(departureCard)) : h('p', {}, 'Nothing leaves from here now.'));
  return h('div', {}, parts);
}

function renderKiouni() {
  const offer = G.KIOUNI_OFFERS[state.kiouniOffer];
  if (state.kiouni) {
    return h('div', { class: 'feature' }, h('h4', {}, 'Kiouni'), h('p', {}, 'Kiouni is Fogg’s, and waits to be ridden.'), paceControl(), sugarControl());
  }
  return h(
    'div',
    { class: 'feature' },
    h('h4', {}, 'An elephant for sale'),
    h('p', {}, `Fogg's offer stands at ${G.pounds(offer)}.`),
    h('button', { onclick: () => dispatch({ type: 'offer', raise: true }) }, 'Raise the offer'),
    h('button', { onclick: () => dispatch({ type: 'offer', raise: false }) }, 'Stand firm'),
    h('button', { onclick: () => dispatch({ type: 'buy-kiouni' }) }, 'Buy Kiouni'),
    h(
      'label',
      { class: 'switch' },
      h('input', {
        type: 'checkbox',
        role: 'switch',
        id: 'guide',
        checked: state.guide,
        'aria-checked': String(state.guide),
        onchange: (e) => dispatch({ type: 'guide', value: e.target.checked }),
      }),
      ` Hire the Parsee guide (${G.pounds(G.GUIDE_WAGE)})`
    ),
    paceControl(),
    state.goods.includes('provisions') && h('button', { onclick: () => dispatch({ type: 'use-good', good: 'provisions' }) }, 'Share out the provisions')
  );
}

function paceControl() {
  return h(
    'label',
    {},
    'Kiouni’s pace ',
    h('input', {
      type: 'range',
      id: 'pace',
      min: '1',
      max: '5',
      step: '1',
      value: String(state.pace),
      'aria-valuetext': `pace ${state.pace} of 5`,
      onchange: (e) => dispatch({ type: 'pace', value: e.target.value }),
    })
  );
}

function sugarControl() {
  return state.goods.includes('sugar') && h('button', { onclick: () => dispatch({ type: 'use-good', good: 'sugar' }) }, 'Give Kiouni a lump of sugar');
}

function renderPillaji() {
  return h(
    'div',
    { class: 'feature' },
    h('h4', {}, 'The procession to the pagoda of Pillaji'),
    state.aouda ? h('p', {}, 'Aouda is safe, and travels with Fogg.') : h('button', { onclick: () => dispatch({ type: 'rescue' }) }, 'Rescue the widow'),
    sugarControl()
  );
}

function renderSledge() {
  const tabs = ['weather', 'sledge', 'crew'];
  const names = { weather: 'Weather', sledge: 'Sledge', crew: 'Crew' };
  let body;
  if (state.sledgeTab === 'weather') {
    body = h(
      'label',
      {},
      'Wind, in knots ',
      h('input', {
        type: 'range',
        id: 'wind',
        min: '0',
        max: '60',
        step: '5',
        value: String(state.wind),
        'aria-valuetext': `${state.wind} knots`,
        onchange: (e) => dispatch({ type: 'wind', value: e.target.value }),
      })
    );
  } else if (state.sledgeTab === 'sledge') {
    body = h(
      'label',
      { class: 'switch' },
      h('input', {
        type: 'checkbox',
        role: 'switch',
        id: 'sail',
        checked: state.sail,
        'aria-checked': String(state.sail),
        onchange: (e) => dispatch({ type: 'sail', value: e.target.checked }),
      }),
      ' Hoist the sail'
    );
  } else {
    body = h(
      'div',
      {},
      h('p', {}, 'Mudge, who owns the sledge, will take the rudder.'),
      state.goods.includes('furcoats') && h('button', { onclick: () => dispatch({ type: 'use-good', good: 'furcoats' }) }, 'Hand round the fur coats')
    );
  }
  return h(
    'div',
    { class: 'feature' },
    h('h4', {}, 'A sledge with sails'),
    h('p', {}, `At ${state.wind} knots, ${state.sail ? 'under sail' : 'with the sail down'}, Omaha is ${G.durationText(G.hoursFor(state, world.departures.find((d) => d.id === 'sledge-omaha')))} away.`),
    h(
      'div',
      { role: 'tablist', 'aria-label': 'The sledge', class: 'subtabs' },
      tabs.map((t) =>
        h(
          'button',
          { role: 'tab', id: `sledge-${t}`, 'aria-selected': String(state.sledgeTab === t), class: state.sledgeTab === t ? 'selected' : '', onclick: () => dispatch({ type: 'sledge-tab', value: t }) },
          names[t]
        )
      )
    ),
    h('div', { role: 'tabpanel', 'aria-labelledby': `sledge-${state.sledgeTab}` }, body)
  );
}

function renderTelegraph(place) {
  return h(
    'div',
    {},
    h('h3', {}, `The Telegraph Office at ${place.name}`),
    h(
      'label',
      {},
      'Send to ',
      h(
        'select',
        { id: 'wire-to' },
        h('option', { value: 'reformclub' }, 'The Reform Club'),
        h('option', { value: 'barings' }, "Baring's Bank"),
        h('option', { value: 'scotlandyard' }, 'Scotland Yard')
      )
    ),
    h('label', {}, 'Message ', h('input', { type: 'text', id: 'wire-message' })),
    h('button', { onclick: () => dispatch({ type: 'telegraph', to: $('wire-to').value, message: $('wire-message').value }) }, 'Send the telegram')
  );
}

function renderMarket(place) {
  return h(
    'div',
    {},
    h('h3', {}, `The market at ${place.name}`),
    h('p', {}, 'Whatever is taken goes into the luggage, to be used where it helps.'),
    h(
      'ul',
      { class: 'goods' },
      data.story.goods.map((g) =>
        h(
          'li',
          {},
          h(
            'label',
            {},
            h('input', { type: 'checkbox', id: `good-${g.id}`, checked: state.goods.includes(g.id), onchange: () => dispatch({ type: 'buy-good', good: g.id }) }),
            ` ${g.label}`
          ),
          h('span', { class: 'why' }, ` ${g.why}`)
        )
      )
    )
  );
}

function renderClub() {
  return h(
    'div',
    { class: 'club' },
    h('div', { class: 'place-head' }, picture('place-club'), h('div', {}, h('h2', {}, 'The Reform Club'), h('p', { class: 'about' }, 'Pall Mall, London. Wednesday, the 2nd of October, 1872.'))),
    notice(),
    h('p', { class: 'terms' }, data.story.wager.terms),
    h('div', { class: 'actions' },
      h('button', { onclick: () => dispatch({ type: 'paper' }) }, 'Hear the talk of the bank robbery'),
      h('button', { onclick: () => dispatch({ type: 'whist' }) }, 'Play a rubber of whist'),
      h('button', { id: 'accept', onclick: () => dispatch({ type: 'accept' }) }, 'Accept the wager')
    )
  );
}

function renderLondon() {
  return h(
    'div',
    {},
    h('div', { class: 'place-head' }, picture('place-london'), h('div', {}, h('h2', {}, 'London'), h('p', { class: 'about' }, 'The special train stops at the station. Pall Mall is a short drive.'))),
    notice(),
    h('button', { onclick: () => dispatch({ type: 'club' }) }, 'Go to the Reform Club')
  );
}

function renderEnding() {
  const won = state.ending?.won;
  return h(
    'div',
    { class: `ending ${won ? 'won' : 'lost'}` },
    picture(won ? 'place-won' : 'place-lost'),
    h('h2', {}, won ? 'The wager is won' : 'The wager is lost'),
    h('p', {}, state.ending?.reason ?? ''),
    notice(),
    h('button', { id: 'set-out-again', onclick: () => dispatch({ type: 'restart' }) }, 'Set out again')
  );
}

// --- Circuit ----------------------------------------------------------------

function renderCircuit() {
  const passages = state.ledger.filter((r) => r.kind === 'passage');
  const days = state.ledger.reduce((s, r) => s + r.hours, 0) / 24;
  const bookIds = data.places.places.filter((p) => p.book && p.id !== 'london' && p.id !== 'pillaji').map((p) => p.id);
  const chart = h('div', { class: 'chart-frame', 'aria-hidden': 'true' });
  chart.innerHTML = window.EightyDaysChart.chartSvg(passages, world.places, bookIds);
  $('circuit').replaceChildren(
    h('h2', {}, `${passages.length} ${passages.length === 1 ? 'passage' : 'passages'}, ${Math.round(days)} days`),
    chart,
    passages.length
      ? h(
          'ol',
          { class: 'stubs' },
          passages.map((p) => {
            const lines = state.diary.filter((d) => d.place === p.to).map((d) => d.text);
            return h(
              'li',
              { class: `stub mode-${p.mode}` },
              h('span', { class: 'glyph', 'aria-hidden': 'true' }),
              h(
                'div',
                {},
                h('p', {}, `${MODE_WORDS[p.mode]}: ${world.places[p.from].name} to ${world.places[p.to].name}, ${G.durationText(p.hours)}`),
                h('details', {}, h('summary', {}, `Show Passepartout's diary for ${world.places[p.to].name}`), h('p', {}, lines.length ? lines.join(' ') : 'Nothing worth writing down.'))
              )
            );
          })
        )
      : h('p', {}, 'The circuit has not begun.')
  );
}

// --- Ledger -----------------------------------------------------------------

function renderLedger() {
  const totals = G.ledgerTotals(state, world);
  $('ledger').replaceChildren(
    h('div', { class: 'wager-card' }, h('h2', {}, 'The Ledger'), h('p', {}, data.story.wager.terms)),
    h(
      'table',
      { class: 'ledger' },
      h('thead', {}, h('tr', {}, h('th', {}, 'What took the time'), h('th', {}, 'Kind'), h('th', {}, 'Hours'))),
      h('tbody', {}, state.ledger.map((r) => h('tr', {}, h('td', {}, r.label), h('td', {}, r.kind === 'passage' ? MODE_WORDS[r.mode] : r.kind), h('td', {}, r.hours.toFixed(2)))))
    ),
    h('p', { class: 'total' }, `Total: ${G.durationText(totals.hours)} of eighty days.`),
    h('p', {}, `By Fogg's diary: ${totals.diary}.`),
    h('p', {}, `By London's calendar: ${totals.london}.`),
    h('p', { class: 'bag' }, `The carpet-bag: ${G.pounds(state.bag)} of ${G.pounds(data.story.wager.carried)}.`)
  );
}

// --- Bradshaw ---------------------------------------------------------------

const COUNTRY = {
  london: 'Britain', liverpool: 'Britain', queenstown: 'Ireland', brindisi: 'Italy',
  bombay: 'India', kholby: 'India', allahabad: 'India', calcutta: 'India',
  sanfrancisco: 'America', saltlake: 'America', fortkearney: 'America', omaha: 'America', newyork: 'America',
};

function renderBradshaw() {
  const trains = data.departures.departures.filter((d) => d.mode === 'train');
  const q = bradshawQuery.trim().toLowerCase();
  const matches = trains.filter((d) => !q || `${d.label} ${world.places[d.from].name} ${world.places[d.to].name}`.toLowerCase().includes(q));
  const byCountry = {};
  for (const d of matches) (byCountry[COUNTRY[d.from] ?? 'Elsewhere'] ??= []).push(d);

  const tree = h(
    'ul',
    { role: 'tree', 'aria-label': "Bradshaw's lines", class: 'tree' },
    Object.entries(byCountry).map(([country, list]) => {
      const open = bradshawOpen.has(country) || !!q;
      return h(
        'li',
        {
          role: 'treeitem',
          'aria-expanded': String(open),
          tabindex: '0',
          onclick: (e) => {
            if (e.target !== e.currentTarget && e.target.closest('[role=treeitem]') !== e.currentTarget) return;
            if (open) bradshawOpen.delete(country);
            else bradshawOpen.add(country);
            render();
          },
        },
        country,
        open &&
          h(
            'ul',
            { role: 'group' },
            list.map((d) =>
              h(
                'li',
                {
                  role: 'treeitem',
                  tabindex: '0',
                  'aria-selected': String(bradshawChosen === d.id),
                  onclick: (e) => {
                    e.stopPropagation();
                    bradshawChosen = d.id;
                    render();
                  },
                },
                `${world.places[d.from].name} to ${world.places[d.to].name}`
              )
            )
          )
      );
    })
  );
  const chosen = trains.find((d) => d.id === bradshawChosen);
  $('bradshaw').replaceChildren(
    h('h2', {}, `${matches.length} ${matches.length === 1 ? 'train' : 'trains'} in Bradshaw`),
    h('label', {}, 'Search Bradshaw (⌘F) ', h('input', { type: 'search', id: 'bradshaw-search', value: bradshawQuery, oninput: (e) => { bradshawQuery = e.target.value; render(); } })),
    h('button', { onclick: () => { bradshawQuery = ''; render(); } }, 'Clear the search'),
    tree,
    chosen && h('p', { class: 'bradshaw-entry' }, `${chosen.label}: ${chosen.departs ? `departs ${G.clockText(world.departures.find((d) => d.id === chosen.id).departsAt, world.start)}` : 'runs when wanted'}.`)
  );
  if (document.activeElement?.id !== 'bradshaw-search' && screen === 'bradshaw' && focusSearch) {
    $('bradshaw-search').focus();
    focusSearch = false;
  }
}
let focusSearch = false;

// --- About ------------------------------------------------------------------

function renderAbout() {
  $('about').replaceChildren(
    h('h2', {}, 'About'),
    h('p', {}, 'A game after Around the World in Eighty Days, by Jules Verne, in the translation by George M. Towle, built to show Phileas at work. Nothing in it is random: every event follows from where Fogg is, the date, and what was chosen.'),
    h('p', {}, 'The pictures are engravings from the 1873 edition.'),
    h('a', { href: 'https://www.gutenberg.org/ebooks/103', id: 'book-link' }, 'Read the book at Project Gutenberg')
  );
}

// --- the ticket office ------------------------------------------------------

function renderTicket() {
  const dialog = $('ticket-office');
  const t = state.ticket;
  if (!t) {
    if (dialog.open) dialog.close();
    return;
  }
  const d = world.departures.find((x) => x.id === t.departure);
  const sea = d.mode === 'ship';
  $('ticket-form').replaceChildren(
    h('h2', { id: 'ticket-title' }, 'The ticket office'),
    h('p', {}, `${d.label}, to ${world.places[d.to].name}.`),
    h('label', {}, 'Berths ', h('input', { type: 'number', id: 'berths', min: '1', max: '3', value: t.berths, onchange: (e) => dispatch({ type: 'berths', value: e.target.value }) })),
    h(
      'fieldset',
      {},
      h('legend', {}, sea ? 'Cabin' : 'Class'),
      ['saloon', 'second'].map((c) =>
        h('label', {}, h('input', { type: 'radio', name: 'cabin', value: c, checked: t.cabin === c, onchange: () => dispatch({ type: 'cabin', value: c }) }), ` ${c === 'saloon' ? (sea ? 'Saloon' : 'First class') : sea ? 'Second cabin' : 'Second class'}`)
      )
    ),
    h('label', {}, 'A note for the purser ', h('input', { type: 'text', id: 'purser-note', value: t.note, onchange: (e) => dispatch({ type: 'note', value: e.target.value }) })),
    d.id === 'henrietta' && h('label', {}, h('input', { type: 'checkbox', id: 'coal', checked: t.coal, onchange: (e) => dispatch({ type: 'coal', value: e.target.checked }) }), ` Take coal (${G.pounds(G.COAL_PRICE)})`),
    h('p', { class: 'ticket-message', 'aria-live': 'polite' }, t.message || ''),
    h('div', { class: 'actions' },
      h('button', { type: 'button', id: 'book', onclick: () => book() }, 'Book (⌘B)'),
      h('button', { type: 'button', id: 'cancel-ticket', onclick: () => dispatch({ type: 'cancel' }) }, 'Cancel')
    )
  );
  if (!dialog.open) dialog.showModal();
}

/** Book with whatever the fields hold now, since a typed value may not have fired its change yet. */
function book() {
  const berths = $('berths');
  const note = $('purser-note');
  if (berths && berths.value !== state.ticket.berths) state = G.act(state, { type: 'berths', value: berths.value }, world);
  if (note && note.value !== state.ticket.note) state = G.act(state, { type: 'note', value: note.value }, world);
  dispatch({ type: 'book' });
}

// --- all of it --------------------------------------------------------------

function show(next) {
  screen = next;
  render();
}

function render() {
  for (const section of document.querySelectorAll('main > section')) section.hidden = section.id !== screen;
  for (const button of document.querySelectorAll('nav.screens button')) button.classList.toggle('selected', button.dataset.screen === screen);
  renderClock();
  if (screen === 'here') renderHere();
  if (screen === 'circuit') renderCircuit();
  if (screen === 'ledger') renderLedger();
  if (screen === 'bradshaw') renderBradshaw();
  if (screen === 'about') renderAbout();
  renderTicket();
}

async function start() {
  const loaded = await window.eightyDays.data();
  data = loaded;
  world = G.prepare(loaded);
  state = G.initialState();

  drawDialTicks();
  for (const button of document.querySelectorAll('nav.screens button')) button.addEventListener('click', () => show(button.dataset.screen));
  $('ticket-office').addEventListener('cancel', (event) => {
    event.preventDefault();
    dispatch({ type: 'cancel' });
  });

  window.eightyDays.onMenu((command) => {
    if (command === 'restart') dispatch({ type: 'restart' });
    else if (command === 'bradshaw') show('bradshaw');
    else if (command === 'circuit') show('circuit');
    else if (command === 'ledger') show('ledger');
    else if (command === 'clock') {
      showClock = !showClock;
      render();
    } else if (command === 'export') {
      const totals = G.ledgerTotals(state, world);
      window.eightyDays.exportLedger(
        [...state.ledger.map((r) => `${r.hours.toFixed(2)}\t${r.label}`), `total\t${totals.hours.toFixed(2)}`].join('\n')
      );
      state = { ...state, notice: 'The ledger is exported.' };
      render();
    }
  });

  // Shortcuts the page handles itself, printed in the names of their controls.
  document.addEventListener('keydown', (event) => {
    if (!event.metaKey) return;
    if (event.key === 'b' && state.ticket) {
      event.preventDefault();
      book();
    }
    if (event.key === 'f' && !state.ticket) {
      event.preventDefault();
      focusSearch = true;
      show('bradshaw');
    }
  });

  window.eightyDays.ended(false);
  render();
  $('status').dataset.ready = 'true';
  $('status').textContent = 'Ready';
}

start().catch((error) => {
  $('status').dataset.ready = 'failed';
  $('status').textContent = `Could not load: ${error.message}`;
});
