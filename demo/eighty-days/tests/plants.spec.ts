import { expect } from '@playwright/test';
import {
  CheckFailure,
  RUN_VARIABLE,
  createTest,
  deriveRouteStreams,
  runRoute,
  type AppUnderTest,
  type Chooser,
  type Fix,
} from '@drugstoresushi/phileas';
import { eightyDays } from '../phileas/adapter/index';
import { accept } from '../phileas/journeys/demo';
import { toHongKong } from '../phileas/journeys/hongkong';
import { toFortKearney, toKholby, toLondon, toNewYork, toReformClub } from '../phileas/journeys/stage-two';

/**
 * Each planted bug, reached on purpose, and the check that catches it.
 *
 * Run from the repository root:
 *
 *   npx playwright test --config demo/eighty-days/playwright.config.ts plants
 *
 * **These prove the plants, not the search.** A chooser picks the planted
 * control, as the engine's own tests do for `buggy`, so a failure here says
 * the plant or its check is broken and nothing about whether a Journey finds
 * it. The seeds that let a Journey find each one are measured separately, and
 * `demo/eighty-days/seeds.mjs` holds them.
 *
 * **Each plant has its control:** the same Fix and the same moves with the
 * plant off, which must pass. A plant that fired either way would be a bug in
 * the game rather than a plant, and would show every check working whether
 * it did or not. Each Route starts from the Fix a stage-two section uses, so
 * a Fix that walked into its own plant would fail here first.
 */

process.env[RUN_VARIABLE] = 'plants';

/** A target on offer: a page control by name, or a menu entry by its label. */
type Wanted = string | { readonly menu: string };

/**
 * A chooser that acts on each wanted target in turn, then on the Circuit
 * button, which changes nothing that matters, for any Hop left over.
 */
function inTurn(wanted: readonly Wanted[]): Chooser {
  let next = 0;
  return {
    choose: (candidates) => {
      const want = wanted[next] ?? 'Circuit';
      next++;
      const target = candidates.find((c) =>
        typeof want === 'string' ? c.source === 'page' && c.name === want : c.source === 'menu' && c.name === want.menu
      );
      if (!target) throw new Error(`${JSON.stringify(want)} is not on offer`);
      return { target };
    },
  };
}

interface Case {
  readonly plant: string;
  readonly fix: Fix;
  readonly moves: readonly Wanted[];
  /** The check that fails, and what it saw; absent for the plant that strands. */
  readonly check?: string;
  readonly observed?: RegExp;
}

const CASES: readonly Case[] = [
  { plant: 'kiouni-throw', fix: toKholby, moves: ['Raise the offer'], check: 'uncaught-error', observed: /offer for Kiouni/ },
  { plant: 'export-throw', fix: accept, moves: [{ menu: 'Export the ledger' }], check: 'uncaught-error', observed: /main process: .*would not balance/ },
  { plant: 'sail-console-error', fix: toFortKearney, moves: ['Hoist the sail'], check: 'console-error', observed: /sail split at 30 knots/ },
  { plant: 'coal-hang', fix: toNewYork, moves: ['Take passage on the Henrietta', 'Book (⌘B)'], check: 'still-responding', observed: /stopped answering|did not answer/ },
  { plant: 'blank-club', fix: toLondon, moves: ['Go to the Reform Club'], check: 'window-showing-content', observed: /shows nothing/ },
  { plant: 'set-out-confirm', fix: toReformClub, moves: [{ menu: 'Set out again' }], check: 'no-unexpected-dialog', observed: /confirm: Set out again/ },
  { plant: 'carnatic-log-error', fix: toHongKong, moves: ['Sail on the Carnatic for Yokohama', 'Book (⌘B)'], check: 'log-error', observed: /ERROR the Carnatic's port boiler/ },
  { plant: 'bradshaw-trap', fix: accept, moves: [{ menu: 'Consult Bradshaw' }] },
];

function withPlant(plant: string | undefined): AppUnderTest {
  return { ...eightyDays, launchArgs: plant ? [`--plant=${plant}`] : [] };
}

for (const c of CASES) {
  for (const on of [true, false]) {
    const cfg = withPlant(on ? c.plant : undefined);
    const test = createTest(cfg);
    test.setTimeout(4 * 60_000);

    const title = on
      ? c.check
        ? `${c.check} fires on the planted ${c.plant}`
        : `the planted ${c.plant} strands the Route`
      : `the same moves pass with ${c.plant} off`;

    test(title, async ({ page, app, userDataDir }, testInfo) => {
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
        fix: c.fix,
        journalsRoot: testInfo.outputPath('journals'),
        userDataDir,
        chooser: inTurn(c.moves),
      }).then(
        (result) => ({ result }),
        (error: unknown) => ({ error })
      );

      if (!on) {
        expect('error' in outcome ? String(outcome.error) : '').toBe('');
        expect('result' in outcome && outcome.result.kind).toBe('passed');
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
