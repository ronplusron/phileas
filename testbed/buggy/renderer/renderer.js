// The renderer.
//
// The count above the list and the total on the summary view are both derived
// here, from the same data the main process read. That is what gives a
// structural check two things to disagree about, and gives a specified oracle
// something to compute independently from the data file.

let all = [];
let query = '';

const el = (id) => document.getElementById(id);

function visible() {
  if (query === '') return all;
  const needle = query.toLowerCase();
  return all.filter((item) => item.name.toLowerCase().includes(needle));
}

function render() {
  const shown = visible();

  el('count').textContent = shown.length === 1 ? '1 item' : `${shown.length} items`;

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

try {
  el('search').addEventListener('input', (event) => {
    query = event.target.value;
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
    .then((items) => {
      all = items;
      render();
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
