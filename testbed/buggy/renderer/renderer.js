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

window.buggy.onShowView(showView);

window.buggy
  .items()
  .then((items) => {
    all = items;
    render();
    // The readiness marker the adapter waits for. It says the data arrived,
    // not merely that a window exists.
    el('status').textContent = 'ready';
  })
  .catch((error) => {
    // Fail loudly and in the application's own words. An adapter that waited
    // for a success marker alone would turn this into a timeout, which reports
    // as "did not appear" and says nothing about why.
    el('status').textContent = `failed: ${error.message}`;
  });
