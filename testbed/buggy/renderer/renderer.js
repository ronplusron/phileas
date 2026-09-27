// The renderer.
//
// The count above the list and the total on the summary view are both derived
// here, from the same data the main process read. That is what gives a
// structural check two things to disagree about, and gives a specified oracle
// something to compute independently from the data file.

let all = [];
let query = '';
let category = '';
// Set by the miscount plant: the count above the list stops agreeing with it.
let miscount = false;

const el = (id) => document.getElementById(id);

function visible() {
  const needle = query.toLowerCase();
  return all.filter(
    (item) =>
      (category === '' || item.category === category) &&
      (needle === '' || item.name.toLowerCase().includes(needle))
  );
}

function render() {
  const shown = visible();

  const counted = shown.length + (miscount ? 1 : 0);
  el('count').textContent = counted === 1 ? '1 item' : `${counted} items`;

  const list = el('items');
  list.replaceChildren();
  for (const item of shown) {
    const li = document.createElement('li');
    li.textContent = `${item.name} (${item.category}) ${item.grams} g`;
    list.append(li);
  }

  const total = all.reduce((sum, item) => sum + item.grams, 0);
  el('total').textContent = `${total} g`;
}

function showView(view) {
  const inventory = view === 'inventory';
  el('inventory').hidden = !inventory;
  el('summary').hidden = inventory;
  el('view-inventory').setAttribute('aria-pressed', String(inventory));
  el('view-summary').setAttribute('aria-pressed', String(!inventory));
}

/**
 * Report a boot failure in the application's own words.
 *
 * Defined before anything that can throw, and reached from both a synchronous
 * throw during setup and a rejected items request. An earlier version installed
 * the failure path last, as the .catch on the items promise: a throw while
 * registering the listeners below aborted the module before that handler
 * existed, so a broken boot presented as a page that simply never finished, and
 * the adapter waiting on it reported a timeout saying nothing about why.
 *
 * Handles a non-Error rejection, which otherwise produced the message
 * "failed: undefined" -- an error state carrying no information about itself.
 */
function reportBootFailure(error) {
  const status = el('status');
  if (!status) return;
  status.dataset.boot = 'failed';
  status.textContent = `failed: ${error?.message ?? String(error)}`;
}

/**
 * The planted defects' buttons, one per flag buggy was launched with.
 *
 * Added before the ready marker is set, so a Route's first survey sees them.
 * Named as ordinary controls in the application's own terms, so nothing about
 * them says to the engine that they are planted.
 */
const PLANTED = {
  'renderer-throw': ['Weigh the trunk', () => {
    throw new Error('the trunk is too heavy to weigh');
  }],
  'main-throw': ['Strap the trunk', () => window.buggy.plant('main-throw')],
  'console-error': ['Check the tickets', () => console.error('the tickets could not be checked')],
  'renderer-hang': ['Wait for the tide', () => {
    const until = Date.now() + 6000;
    while (Date.now() < until) {
      // Busy on purpose: the renderer answers nothing until this ends.
    }
  }],
  'main-hang': ['Wait at the port', () => window.buggy.plant('main-hang')],
  'endless-hang': ['Wait for the last ferry', () => window.buggy.plant('endless-hang')],
  blank: ['Fold the map', () => document.body.replaceChildren()],
  dialog: ['Ring the bell', () => alert('the bell rang')],
  'log-error': ['Write in the logbook', () => window.buggy.plant('log-error')],
  'renderer-crash': ['Drop the lantern', () => window.buggy.plant('renderer-crash')],
  'main-exit': ['Miss the boat', () => window.buggy.plant('main-exit')],
  miscount: ['Count the luggage', () => {
    miscount = true;
    render();
  }],
};

async function addPlanted() {
  const plants = await window.buggy.plants();
  if (!plants.length) return;
  const box = document.createElement('div');
  box.className = 'controls';
  for (const plant of plants) {
    const [label, act] = PLANTED[plant];
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', act);
    box.append(button);
  }
  el('inventory').prepend(box);
}

try {
  el('search').addEventListener('input', (event) => {
    query = event.target.value;
    render();
  });

  el('category').addEventListener('change', (event) => {
    category = event.target.value;
    render();
  });

  el('clear').addEventListener('click', () => {
    query = '';
    el('search').value = '';
    render();
  });

  el('view-inventory').addEventListener('click', () => showView('inventory'));
  el('view-summary').addEventListener('click', () => showView('summary'));

  // Throws when the preload bridge is missing, which is a boot failure and is
  // now reported as one rather than aborting the module in silence.
  window.buggy.onShowView(showView);

  window.buggy
    .items()
    .then(async (items) => {
      all = items;
      render();
      await addPlanted();
      // Set after render, so the marker means the data arrived and is on the
      // screen. That is what lets the adapter stop here rather than waiting for
      // a list item, which would never appear for an empty inventory.
      const status = el('status');
      status.dataset.boot = 'ready';
      status.textContent = 'Ready';
    })
    .catch(reportBootFailure);
} catch (error) {
  reportBootFailure(error);
}
