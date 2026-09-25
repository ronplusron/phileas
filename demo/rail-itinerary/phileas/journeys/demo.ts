import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: a few Routes, short enough to watch.
 *
 * No seed here. The demo's fixed default is set by watch.mjs, which is where
 * the demo is run from.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 50,
});

/**
 * The demo's Fix: open an itinerary that has legs, so every Route's Trip
 * starts inside one.
 *
 * Written by copying a line from `phileas survey`, which is the point of it:
 * the demo shows a Fix being made without reading the application's code.
 *
 * It does not make the demo livelier, and was measured not to on 2026-09-24:
 * with the same seed, 61 of 150 hops changed nothing with it and 62 without.
 * Routes leave the itinerary within a few hops, and most of the hops that
 * change nothing are on the timetable screen, which offers three ways to reach
 * itself. It runs fresh at the start of every Route.
 */
export const openAlps: Fix = ({ hop }) => hop('button "Open Alps by rail"');
