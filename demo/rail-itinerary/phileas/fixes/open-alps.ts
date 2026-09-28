import type { Fix } from '@drugstoresushi/phileas';

/**
 * The demo's default Fix: open an itinerary that has legs, so every Route's Trip
 * starts inside one.
 *
 * Written by copying a line from `phileas survey`, which is the point of it:
 * the demo shows a Fix being made without reading the application's code.
 *
 * It does not make the demo livelier, and was measured not to on 2026-09-24,
 * and again on 2026-09-25 once Routes counted from 1: with seed rail-demo,
 * three Routes of fifty Hops, 51 of 150 hops changed nothing with it and 52
 * without.
 * Routes leave the itinerary within a few hops, and most of the hops that
 * change nothing are on the timetable screen, which offers three ways to reach
 * itself. It runs fresh at the start of every Route.
 */
export const openAlps: Fix = ({ hop }) => hop('button "Open Alps by rail"');
