import { expect } from '@playwright/test';
import {
  CheckFailure,
  RUN_VARIABLE,
  createTest,
  deriveRouteStreams,
  runRoute,
  type AppUnderTest,
  type Chooser,
} from '@drugstoresushi/phileas';
import { railItinerary } from '../phileas/adapter/index';
import { openAlps } from '../phileas/fixes/open-alps';

/**
 * Each planted bug, reached on purpose, and the check that catches it.
 *
 * Run from the repository root:
 *
 *   npx playwright test --config demo/rail-itinerary/playwright.config.ts plants
 *
 * **These prove the plants, not the search.** A chooser picks the planted
 * control, as the engine's own tests do for `buggy`, so a failure here says
 * the plant or its check is broken and nothing about whether a Journey finds
 * it. The seeds that let a Journey find each one are measured separately, and
 * `demo/rail-itinerary/seeds.mjs` holds them.
 *
 * **Each plant has its control:** the same Fix and the same moves with the
 * plant off, which must pass. A plant that fired either way would be a bug in
 * the application rather than a plant. The seating chart's button exists only
 * while its plant is on, so its control is instead that the button is never
 * on offer with the plant off, which is what keeps stage one's pools as they
 * were.
 */

process.env[RUN_VARIABLE] = 'plants';

/**
 * A chooser that acts on each wanted page control in turn, then on the
 * Itineraries button, which changes nothing that matters, for any Hop left
 * over. It remembers every name it was offered.
 */
function inTurn(wanted: readonly string[]): Chooser & { offered: Set<string> } {
  let next = 0;
  const offered = new Set<string>();
  return {
    offered,
    choose: (candidates) => {
      for (const c of candidates) if (c.source === 'page') offered.add(c.name);
      const want = wanted[next] ?? 'Itineraries';
      next++;
      const target = candidates.find((c) => c.source === 'page' && c.name === want);
      if (!target) throw new Error(`${JSON.stringify(want)} is not on offer`);
      return { target };
    },
  };
}

interface Case {
  readonly plant: string;
  readonly moves: readonly string[];
  /** The check that fails, and what it saw; absent for the plant that strands. */
  readonly check?: string;
  readonly observed?: RegExp;
}

const CASES: readonly Case[] = [
  { plant: 'sleeper-throw', moves: ['Add a leg', 'Sleeper'], check: 'uncaught-error', observed: /No sleeper berths/ },
  {
    plant: 'last-leg-blank',
    moves: ['Remove London to Paris', 'Remove Paris to Lyon', 'Remove Lyon to Geneva'],
    check: 'window-showing-content',
    observed: /shows nothing/,
  },
  { plant: 'seating-trap', moves: ['Choose seats'] },
];

function withPlant(plant: string | undefined): AppUnderTest {
  return { ...railItinerary, launchArgs: plant ? [`--plant=${plant}`] : [] };
}

for (const c of CASES) {
  for (const on of [true, false]) {
    const cfg = withPlant(on ? c.plant : undefined);
    const test = createTest(cfg);
    test.setTimeout(2 * 60_000);

    const trap = !c.check;
    const title = on
      ? trap
        ? `the planted ${c.plant} strands the Route`
        : `${c.check} fires on the planted ${c.plant}`
      : trap
        ? `Choose seats is never on offer with ${c.plant} off`
        : `the same moves pass with ${c.plant} off`;

    test(title, async ({ page, app, userDataDir }, testInfo) => {
      // The trap's control takes no planted moves, since its button is absent.
      const moves = !on && trap ? [] : c.moves;
      const chooser = inTurn(moves);
      // Two Hops past the moves, so a fault that shows a Hop late is still seen.
      const tripLength = c.moves.length + 2;
      const outcome = await runRoute({
        page,
        app,
        cfg,
        streams: deriveRouteStreams(`plant-${c.plant}`, 1),
        journeySeed: `plant-${c.plant}`,
        routeNumber: 1,
        tripLength,
        fix: openAlps,
        journalsRoot: testInfo.outputPath('journals'),
        userDataDir,
        chooser,
      }).then(
        (result) => ({ result }),
        (error: unknown) => ({ error })
      );

      if (!on) {
        expect('error' in outcome ? String(outcome.error) : '').toBe('');
        expect('result' in outcome && outcome.result.kind).toBe('passed');
        if (trap) {
          // The positive control for the absence below: the itinerary's own
          // buttons were offered, so the chooser did see the screen.
          expect(chooser.offered.has('Buy tickets')).toBe(true);
          expect(chooser.offered.has('Choose seats')).toBe(false);
        }
      } else if (c.check) {
        expect('error' in outcome && outcome.error, 'the Route should have ended on a failed check').toBeInstanceOf(CheckFailure);
        const failure = (outcome as { error: CheckFailure }).error;
        const failed = failure.failed.find((f) => f.check === c.check);
        expect(failed, `failed: ${failure.failed.map((f) => f.check).join(', ')}`).toBeDefined();
        expect(failed?.observation).toMatch(c.observed ?? /./);
      } else {
        expect('result' in outcome && outcome.result.kind).toBe('stranded');
      }
    });
  }
}
