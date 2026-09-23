import { test, expect } from '@playwright/test';
import { defineJourney } from '../src/index';
import type { Candidate, Journey, Narrowing } from '../src/index';

/**
 * The invalid states four types used to permit.
 *
 * **These are compile-time assertions, and `npm run typecheck` is what runs
 * them.** Each `@ts-expect-error` fails the build if the error it expects stops
 * happening, so removing one of the guarantees below breaks the typecheck
 * rather than quietly widening the type again. The runtime test at the end
 * exists only so this file is not empty to the runner.
 *
 * Every case here compiled before the review. None of them is hypothetical.
 */

// A Journey is branded, so defineJourney is the only way to make one. This
// object used to typecheck, register no tests at all, and report green having
// traveled nowhere.
// @ts-expect-error a Journey cannot be written by hand
const handWritten: Journey = { routes: 0, tripLength: 0 };
void handWritten;

// A menu candidate carries the path the exclusion rail matches against. Without
// it the candidate escapes `Exclusions.menuPaths` silently, which is a guard
// failing open.
// @ts-expect-error a menu candidate needs its menuPath
const menuWithoutPath: Candidate = { role: 'menuitem', name: 'Quit', source: 'menu' };
void menuWithoutPath;

// And a page candidate has no menu path to give. The directive sits on the
// offending property rather than the declaration, because that is where an
// excess-property error is reported.
const pageWithPath: Candidate = {
  role: 'button',
  name: 'Clear search',
  source: 'page',
  // @ts-expect-error a page candidate has no menuPath
  menuPath: ['File', 'Quit'],
};
void pageWithPath;

// A narrowing either runs with a predicate or is off. The two used to be one
// shape distinguished by an optional method, which its single reader decoded
// with a three-branch ternary.
// @ts-expect-error a narrowed check must supply the predicate that narrows it
const narrowedWithoutPredicate: Narrowing = { kind: 'narrowed', reason: 'a noisy widget' };
void narrowedWithoutPredicate;

const offWithPredicate: Narrowing = {
  kind: 'off',
  reason: 'a noisy widget',
  // @ts-expect-error a check that is off has no predicate to apply
  accept: () => true,
};
void offWithPredicate;

// The shapes that should compile, so the assertions above are about the
// invalid cases rather than about the types being unusable.
const validMenu: Candidate = { role: 'menuitem', name: 'Quit', source: 'menu', menuPath: ['Quit'] };
const validPage: Candidate = { role: 'button', name: 'Clear search', source: 'page' };
const validOff: Narrowing = { kind: 'off', reason: 'a noisy widget' };
const validNarrowed: Narrowing = {
  kind: 'narrowed',
  reason: 'a noisy widget',
  accept: (observation) => observation.includes('ResizeObserver'),
};

test('the shapes that should compile also behave', () => {
  expect(validMenu.source).toBe('menu');
  expect(validPage.source).toBe('page');
  expect(validOff.kind).toBe('off');
  expect(validNarrowed.kind === 'narrowed' && validNarrowed.accept('ResizeObserver loop')).toBe(
    true
  );

  // And the runtime check is still the one that catches a bad number, since a
  // brand says who built the object and nothing about what is in it.
  expect(() => defineJourney({ routes: 0, tripLength: 10 })).toThrow();
});
