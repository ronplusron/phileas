import {
  closeApp,
  deriveRouteStreams,
  launchApp,
  makeUserDataDir,
  removeProfile,
  runRoute,
  seededChooser,
  type AppUnderTest,
  type Chooser,
  type Fix,
} from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/**
 * Playing one seeded Route while writing down every screen it saw, so that two
 * plays can be compared.
 *
 * **Why the game needs this before it has a single event.** The engine's
 * replay rests on the application answering the same moves the same way. A
 * game that drew an event from `Math.random`, or from the clock, or that moved
 * on a timer, would play two games from one seed, and a failing seed would
 * retrace somewhere else. `docs/DEMO_PLAN_EIGHTY_DAYS.md` states that rule;
 * this is the check that fails when it is broken, written first so that no
 * event is ever written without it.
 *
 * **What is compared is the screen, not only the moves.** The journal already
 * records each Hop's target and draws, and two plays whose moves matched would
 * still differ if an event's text did. So the whole accessibility tree is
 * read before each Trip Hop's choice, which is the settled screen the Hop
 * chose from, and once more after the Route ends.
 */

/** Everything one play saw, in order: one tree per Trip Hop, then the last. */
export interface Recording {
  readonly screens: readonly string[];
  readonly outcome: string;
}

export interface PlayOptions {
  readonly seed: string;
  readonly tripLength: number;
  readonly journalsRoot: string;
  readonly fix?: Fix;
  readonly hopDelayMs?: number;
  /**
   * Called with the page before each screen is read, for a test that plants a
   * difference on purpose. Absent in every real comparison.
   */
  readonly beforeReading?: (page: Page, hop: number) => Promise<void>;
}

/** The tree a person using a screen reader would get, as text. */
async function screenOf(page: Page): Promise<string> {
  return page.locator('body').ariaSnapshot({ timeout: 10_000 });
}

/**
 * Launch the application fresh, play Route 1 of `seed`, and close it again.
 *
 * Launched here rather than through the test fixture, which launches once per
 * test: a comparison needs two launches in one test. The launch, profile and
 * teardown are the engine's own, so nothing here starts differently from a
 * Journey's Route.
 */
export async function playRecorded(cfg: AppUnderTest, options: PlayOptions): Promise<Recording> {
  const userDataDir = await makeUserDataDir(cfg);
  // A launch that throws never reaches the `finally` below, so its profile is
  // removed here: the suite's leftover check found five left this way on
  // 2026-09-28, from launches refused for want of a packaged build.
  const launched = await launchApp(cfg, userDataDir).catch(async (error: unknown) => {
    await removeProfile(userDataDir, cfg.profileWatchMs);
    throw error;
  });
  try {
    const page = cfg.selectPage ? await cfg.selectPage(launched.app) : await launched.app.firstWindow();
    await cfg.waitForReady(page);

    const screens: string[] = [];
    const recording: Chooser = {
      async choose(candidates, rng) {
        await options.beforeReading?.(page, screens.length + 1);
        screens.push(await screenOf(page));
        return seededChooser.choose(candidates, rng);
      },
    };

    // A Route that ends on a failed check throws. That is part of what two
    // plays must agree on, so it is recorded by its kind rather than let
    // through; its message is left out, since a hang's carries durations.
    const outcome = await runRoute({
      page,
      app: launched.app,
      cfg,
      streams: deriveRouteStreams(options.seed, 1),
      journeySeed: options.seed,
      routeNumber: 1,
      tripLength: options.tripLength,
      fix: options.fix,
      journalsRoot: options.journalsRoot,
      chooser: recording,
      hopDelayMs: options.hopDelayMs ?? 0,
      userDataDir,
    }).then(
      (ended) => ended.kind,
      (thrown: unknown) => `threw ${thrown instanceof Error ? thrown.name : String(thrown)}`
    );
    screens.push(await screenOf(page));
    return { screens, outcome };
  } finally {
    await closeApp(cfg, launched);
    await removeProfile(userDataDir, cfg.profileWatchMs);
  }
}

/**
 * Where two plays first part, said so a person can find it, or undefined when
 * they saw the same screens and ended the same way.
 */
export function firstDifference(a: Recording, b: Recording): string | undefined {
  const shorter = Math.min(a.screens.length, b.screens.length);
  for (let i = 0; i < shorter; i++) {
    if (a.screens[i] !== b.screens[i]) {
      const where = i < a.screens.length - 1 ? `before Trip hop ${i + 1}` : 'after the Route ended';
      return `The screens differ ${where}.\n\nFirst play:\n${a.screens[i]}\n\nSecond play:\n${b.screens[i]}`;
    }
  }
  if (a.screens.length !== b.screens.length) {
    return `One play saw ${a.screens.length} screens and the other ${b.screens.length}.`;
  }
  if (a.outcome !== b.outcome) return `One play ended ${a.outcome} and the other ${b.outcome}.`;
  return undefined;
}
