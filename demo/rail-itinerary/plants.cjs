// The planted bugs, in one list that the application and its adapter both
// read, so the adapter can refuse a name before anything launches and the two
// can never disagree about what exists. docs/DEMO_PLAN_TRAIN.md has what each
// plant does and which check catches it.
module.exports = {
  PLANTS: ['sleeper-throw', 'last-leg-blank', 'seating-trap'],
};
