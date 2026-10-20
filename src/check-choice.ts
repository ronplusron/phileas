import { OPTIONAL_CHECKS, UNIVERSAL_CHECKS, type AppUnderTest } from './app-under-test.js';

/**
 * Which checks a Route runs: each check's default for the application, then
 * what the Journey or the run includes and excludes.
 *
 * **Knowing a check and running it by default are separate.** An adapter
 * defines whatever a check needs to work well on its application, such as
 * RStudio's patterns that make the data viewer's repeated rows and columns one
 * finding each, whether or not the check runs by default. Settled on
 * 2026-10-14: "It should be possible to have a check on or off for an adapter
 * by default, and also include or exclude a check at the Journey level."
 *
 * The order: the run (`--check-on`, `--check-off`), else the Journey's
 * `includeChecks` and `excludeChecks`, else the adapter's `checksByDefault`,
 * else on for a built-in check and the adapter's own, and off for an optional
 * one. The Journey's choice reaches each Route through the same variables as
 * the run's, which `startJourney` writes, as it does for exclusion groups.
 */

/** Checks the run or the Journey includes, by name, joined by commas. */
export const CHECK_ON_VARIABLE = 'PHILEAS_CHECK_ON';

/** Checks the run or the Journey excludes, by name, joined by commas. */
export const CHECK_OFF_VARIABLE = 'PHILEAS_CHECK_OFF';

/** What `--check-on none` or `--check-off none` gives, to include or exclude nothing. */
export const NO_CHECKS = 'none';

/** What the Route records for a check excluded for the run, on every Hop. */
export const EXCLUDED_OBSERVATION = 'excluded for this run';

/** What the Route records for a check its adapter has off by default, on every Hop. */
export const OFF_BY_DEFAULT_OBSERVATION = 'off by default for this application';

/** Check names trimmed, without repeats, and sorted, so one choice is one list. */
export function checkNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))].sort();
}

/** Every check this application can run: the built-in ones, every optional one, its own, and its relations. */
export function checksOf(cfg: AppUnderTest): string[] {
  return [
    ...UNIVERSAL_CHECKS,
    ...OPTIONAL_CHECKS,
    ...(cfg.checks ?? []).map((check) => check.name),
    ...(cfg.relations ?? []).map((relation) => relation.name),
  ];
}

/** Whether a check runs for this application when nothing includes or excludes it. */
export function defaultOf(cfg: AppUnderTest, name: string): 'on' | 'off' {
  return cfg.checksByDefault?.[name] ?? ((OPTIONAL_CHECKS as readonly string[]).includes(name) ? 'off' : 'on');
}

/**
 * Refuse an adapter's defaults that name a check it cannot run, or give a
 * value that is neither on nor off. A mistyped name would otherwise change
 * nothing, and read as though it had.
 */
export function assertCheckDefaults(cfg: AppUnderTest): void {
  const known = checksOf(cfg);
  for (const [name, value] of Object.entries(cfg.checksByDefault ?? {})) {
    if (!known.includes(name)) {
      throw new Error(`checksByDefault names ${JSON.stringify(name)}, which this application cannot run. It can run: ${known.join(', ')}.`);
    }
    if (value !== 'on' && value !== 'off') {
      throw new Error(`checksByDefault gives ${name} ${JSON.stringify(value)}; give "on" or "off".`);
    }
  }
}

/** What the run or the Journey includes and excludes, as each Route reads it. */
export interface CheckChoice {
  readonly included: readonly string[];
  readonly excluded: readonly string[];
}

/**
 * Refuse a choice that names a check this application cannot run, names one
 * check both ways, or includes one the adapter has switched off as unable to
 * run (`narrowedChecks`), each naming where the choice came from.
 */
export function assertCheckChoice(cfg: AppUnderTest, choice: CheckChoice, from: { included: string; excluded: string }): void {
  const known = checksOf(cfg);
  for (const [side, names] of [
    ['included', choice.included],
    ['excluded', choice.excluded],
  ] as const) {
    const unknown = names.filter((name) => !known.includes(name));
    if (unknown.length) {
      throw new Error(
        `${from[side]} names ${unknown.map((name) => JSON.stringify(name)).join(', ')}, which this application cannot run. ` +
          `It can run: ${known.join(', ')}.`
      );
    }
  }
  const both = choice.included.filter((name) => choice.excluded.includes(name));
  if (both.length) {
    throw new Error(`${both.join(', ')} is both included (${from.included}) and excluded (${from.excluded}).`);
  }
  for (const name of choice.included) {
    const narrowing = (cfg.narrowedChecks as Record<string, { kind: string; reason: string } | undefined> | undefined)?.[name];
    if (narrowing?.kind === 'off') {
      throw new Error(`${from.included} includes ${name}, which the adapter switches off as unable to run: ${narrowing.reason}`);
    }
  }
}

/** Read a variable's names, where `none` is none. */
function namesIn(variable: string): string[] | undefined {
  const raw = (process.env[variable] ?? '').trim();
  if (!raw) return undefined;
  return raw === NO_CHECKS ? [] : checkNames(raw.split(','));
}

/**
 * What this run includes and excludes, from the variables the run or the
 * Journey set, checked against the application.
 */
export function checkChoiceFromEnvironment(cfg: AppUnderTest): CheckChoice {
  const choice = { included: namesIn(CHECK_ON_VARIABLE) ?? [], excluded: namesIn(CHECK_OFF_VARIABLE) ?? [] };
  assertCheckChoice(cfg, choice, { included: CHECK_ON_VARIABLE, excluded: CHECK_OFF_VARIABLE });
  return choice;
}

/** Whether a check runs, and if not, why, for a check that is recorded either way. */
export function stateOf(cfg: AppUnderTest, choice: CheckChoice, name: string): { runs: true } | { runs: false; why: string } {
  if (choice.excluded.includes(name)) return { runs: false, why: EXCLUDED_OBSERVATION };
  if (choice.included.includes(name)) return { runs: true };
  return defaultOf(cfg, name) === 'on' ? { runs: true } : { runs: false, why: OFF_BY_DEFAULT_OBSERVATION };
}
