// The planted bugs and the layouts the game can be launched with, in one list
// that the game and its adapter both read, so the adapter can refuse a name
// before anything launches and the two can never disagree about what exists.
// docs/DEMO_PLAN_EIGHTY_DAYS.md has what each plant does and which check
// catches it.
module.exports = {
  PLANTS: [
    'kiouni-throw',
    'export-throw',
    'sail-console-error',
    'coal-hang',
    'blank-club',
    'set-out-confirm',
    'carnatic-log-error',
    'bradshaw-trap',
    'coin-flip',
  ],
  LAYOUTS: ['panel', 'screens'],
};
