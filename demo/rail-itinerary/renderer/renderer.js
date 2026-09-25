// The page. Plain DOM, so every control is an ordinary element with a role.
const $ = (id) => document.getElementById(id);
const money = (n) => `$${n.toFixed(2)}`;

let data;
let itineraries;
let current;

const trainById = (id) => data.timetable.find((t) => t.train === id);
const fareOf = (leg) => trainById(leg.train).standardFare * data.fares[leg.class ?? 'standard'];
const fareTotal = (itinerary) => itinerary.legs.reduce((sum, leg) => sum + fareOf(leg), 0);

function show(screen) {
  for (const section of document.querySelectorAll('main > section')) {
    section.hidden = section.id !== screen;
  }
  if (screen === 'itineraries') renderItineraries();
  if (screen === 'timetable') renderTimetable();
}

function renderItineraries() {
  const n = itineraries.length;
  $('itinerary-count').textContent = `${n} ${n === 1 ? 'itinerary' : 'itineraries'}`;
  $('itinerary-list').replaceChildren(
    ...itineraries.map((itinerary) => {
      const li = document.createElement('li');
      const open = document.createElement('button');
      open.textContent = `Open ${itinerary.name}`;
      open.addEventListener('click', () => openItinerary(itinerary));
      li.append(open);
      return li;
    })
  );
}

function openItinerary(itinerary) {
  current = itinerary;
  show('itinerary');
  $('itinerary-name').textContent = itinerary.name;
  $('ticketed').hidden = !itinerary.ticketed;
  $('legs').replaceChildren(
    ...itinerary.legs.map((leg) => {
      const t = trainById(leg.train);
      const row = document.createElement('tr');
      for (const text of [t.from, t.to, t.train, t.departs, t.arrives, leg.class ?? 'standard', money(fareOf(leg))]) {
        const cell = document.createElement('td');
        cell.textContent = text;
        row.append(cell);
      }
      const remove = document.createElement('button');
      remove.textContent = `Remove ${t.from} to ${t.to}`;
      remove.addEventListener('click', () => {
        itinerary.legs = itinerary.legs.filter((l) => l !== leg);
        openItinerary(itinerary);
      });
      const cell = document.createElement('td');
      cell.append(remove);
      row.append(cell);
      return row;
    })
  );
  $('fare-total').textContent = `Fare total: ${money(fareTotal(itinerary))}`;
  // An itinerary with no legs has nothing to ticket.
  $('buy-tickets').disabled = itinerary.legs.length === 0;
}

function renderTimetable() {
  const q = $('train-search').value.trim().toLowerCase();
  const matches = data.timetable.filter((t) =>
    `${t.train} ${t.from} ${t.to}`.toLowerCase().includes(q)
  );
  $('train-count').textContent = `${matches.length} ${matches.length === 1 ? 'train' : 'trains'}`;
  $('train-list').replaceChildren(
    ...matches.map((t) => {
      const li = document.createElement('li');
      li.textContent = `${t.train}  ${t.from} ${t.departs} to ${t.to} ${t.arrives}  from ${money(t.standardFare)}`;
      return li;
    })
  );
}

function fillStations(select) {
  select.replaceChildren(
    ...data.stations.map((s) => Object.assign(document.createElement('option'), { textContent: s }))
  );
}

function saveLeg() {
  const from = $('leg-from').value;
  const to = $('leg-to').value;
  const train = data.timetable.find((t) => t.from === from && t.to === to);
  if (!train) {
    $('leg-message').textContent = `No train runs from ${from} to ${to}.`;
    return;
  }
  current.legs.push({ train: train.train, class: $('leg-class').value });
  $('leg-message').textContent = '';
  openItinerary(current);
}

function openPurchase() {
  $('holder').value = '';
  $('ticket-count').value = '1';
  $('purchase-message').textContent = '';
  updateTicketTotal();
  $('purchase-dialog').showModal();
}

function updateTicketTotal() {
  const count = Number($('ticket-count').value);
  $('ticket-total').textContent = `Total for ${count}: ${money(fareTotal(current) * count)}`;
}

function purchase() {
  // Refused here too, not only by disabling Buy tickets, in case the last leg
  // is removed some other way while the dialog is open.
  if (current.legs.length === 0) {
    $('purchase-message').textContent = 'This itinerary has no legs, so there is nothing to ticket.';
    return;
  }
  if (!$('holder').value.trim()) {
    $('purchase-message').textContent = "Enter the ticket holder's name.";
    return;
  }
  current.ticketed = true;
  $('purchase-dialog').close();
  openItinerary(current);
}

async function start() {
  data = await window.rail.data();
  itineraries = data.itineraries.map((i) => ({ ...i, legs: i.legs.map((l) => ({ ...l })) }));

  for (const button of document.querySelectorAll('nav button')) {
    button.addEventListener('click', () => show(button.dataset.screen));
  }
  window.rail.onShowScreen(show);

  $('new-itinerary').addEventListener('click', () => {
    const itinerary = { name: `Itinerary ${itineraries.length + 1}`, legs: [] };
    itineraries.push(itinerary);
    openItinerary(itinerary);
  });
  $('back').addEventListener('click', () => show('itineraries'));
  $('add-leg').addEventListener('click', () => {
    fillStations($('leg-from'));
    fillStations($('leg-to'));
    show('add');
  });
  $('leg-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveLeg();
  });
  $('cancel-leg').addEventListener('click', () => openItinerary(current));
  $('buy-tickets').addEventListener('click', openPurchase);
  $('ticket-count').addEventListener('change', updateTicketTotal);
  $('purchase-button').addEventListener('click', purchase);
  $('cancel-purchase').addEventListener('click', () => $('purchase-dialog').close());
  $('train-search').addEventListener('input', renderTimetable);
  $('clear-search').addEventListener('click', () => {
    $('train-search').value = '';
    renderTimetable();
  });

  // Shortcuts the page handles itself, printed in the names of their buttons.
  document.addEventListener('keydown', (event) => {
    if (!event.metaKey) return;
    if (event.key === 's' && !$('add').hidden) {
      event.preventDefault();
      saveLeg();
    }
    if (event.key === 'f') {
      event.preventDefault();
      show('timetable');
      $('train-search').focus();
    }
  });

  show('itineraries');
  $('status').dataset.ready = 'true';
  $('status').textContent = 'Ready';
}

start().catch((error) => {
  $('status').dataset.ready = 'failed';
  $('status').textContent = `Could not load: ${error.message}`;
});
