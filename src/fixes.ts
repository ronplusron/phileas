import { FIX_OVERRIDE_VARIABLE, overriddenTerms, type Journey } from './journey.js';
import type { Fix } from './route.js';

/**
 * A consumer's Fixes, each under the name a Journey and `phileas run --fix`
 * choose it by.
 *
 * A consumer keeps them in `phileas/fixes/`, one file each, with
 * `fixes/index.ts` listing them through `defineFixes`. Named here rather than
 * chosen by a variable each consumer invents: before this, three consumers had
 * three such variables, each named as if it chose a Journey, and nothing in a
 * run's printed settings or journal said which Fix it had used.
 */
export type Fixes = Readonly<Record<string, Fix>>;

/** The name that means no Fix, for `--fix` to turn off the one a Journey names. */
export const NO_FIX = 'none';

/** The name each Fix was listed under, for the journal to record. */
const names = new WeakMap<Fix, string>();

/** The name a Fix was listed under in `defineFixes`, if it was. */
export function fixName(fix: Fix): string | undefined {
  return names.get(fix);
}

/**
 * Check a consumer's Fixes and freeze the list. A name must be one a person can
 * type after `--fix`: lower case, digits and hyphens. `none` is refused, since
 * it means no Fix.
 */
export function defineFixes(fixes: Record<string, Fix>): Fixes {
  for (const [name, fix] of Object.entries(fixes)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
      throw new RangeError(`A Fix is named "${name}", which is not lower case words joined by hyphens, as --fix takes it.`);
    }
    if (name === NO_FIX) throw new RangeError(`A Fix cannot be named "${NO_FIX}", which means no Fix.`);
    if (typeof fix !== 'function') throw new TypeError(`The Fix named "${name}" is not a function.`);
    const earlier = names.get(fix);
    if (earlier !== undefined && earlier !== name) {
      throw new RangeError(`One Fix is listed as both "${earlier}" and "${name}"; give it one name.`);
    }
    names.set(fix, name);
  }
  return Object.freeze({ ...fixes });
}

/**
 * The Fix a Journey opens with: the one its terms name, or the one this run's
 * `--fix` names instead. Undefined for no Fix. A name not in `fixes` is refused,
 * listing those that are, and so is a Journey that names a Fix with no list to
 * find it in.
 */
export function fixFor(journey: Journey, fixes: Fixes | undefined): Fix | undefined {
  if (journey.fix === undefined) return undefined;
  const from = overriddenTerms(journey).includes('fix') ? ` (from ${FIX_OVERRIDE_VARIABLE})` : '';
  if (fixes === undefined) {
    throw new Error(`The Journey names the Fix "${journey.fix}"${from}, but no Fixes were given to look it up in.`);
  }
  const fix = Object.hasOwn(fixes, journey.fix) ? fixes[journey.fix] : undefined;
  if (!fix) {
    const known = Object.keys(fixes);
    throw new Error(
      `The Journey names the Fix "${journey.fix}"${from}, which is not one of this consumer's Fixes. ` +
        (known.length ? `It has ${known.map((name) => `"${name}"`).join(', ')}, or "${NO_FIX}" for no Fix.` : 'It has none.')
    );
  }
  return fix;
}
