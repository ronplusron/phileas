import { test, expect } from '@playwright/test';
import { effectOf, headingsIn, EFFECT_HEADINGS_LISTED } from '../src/index';

/**
 * What a Hop did to the screen (R31), from two readings of the tree.
 *
 * Pure functions over snapshots shaped as Playwright's accessibility snapshot
 * gives them, so no application is launched. The Route tests show the same
 * thing against the real testbed.
 */

const heading = (name: string) => ({ role: 'heading', name });
const screen = (...children: unknown[]) => ({ role: 'main', children });

test('headings that appeared and went away are named, and nothing else is', () => {
  const tale = screen(heading('Trickster'), heading('The Coyote tale'), heading('How this tale works'));
  const compare = screen(heading('Trickster'), heading('Compare'));

  expect(effectOf(tale, compare)).toEqual({
    readable: true,
    changed: true,
    appeared: ['Compare'],
    appearedMore: 0,
    wentAway: ['The Coyote tale', 'How this tale works'],
    wentAwayMore: 0,
  });
});

test('a change that moves no heading still reads as changed', () => {
  // A filter that leaves every heading in place is the measured case.
  const before = screen(heading('Library'), { role: 'button', name: 'Motif A', pressed: false });
  const after = screen(heading('Library'), { role: 'button', name: 'Motif A', pressed: true });
  const effect = effectOf(before, after);
  expect(effect).toMatchObject({ readable: true, changed: true, appeared: [], wentAway: [] });
});

test('a Hop that changed nothing says so', () => {
  const same = screen(heading('Library'));
  expect(effectOf(same, JSON.parse(JSON.stringify(same)))).toMatchObject({
    readable: true,
    changed: false,
  });
});

test('an effect that could not be read is never recorded as nothing changing', () => {
  const effect = effectOf(screen(heading('Library')), undefined, 'the page stopped answering');
  expect(effect).toEqual({ readable: false, reason: 'the page stopped answering' });
});

test('headings are counted, so one of two identical titles going away is seen', () => {
  const before = screen(heading('Tale'), heading('Tale'));
  const after = screen(heading('Tale'));
  expect(effectOf(before, after)).toMatchObject({ wentAway: ['Tale'], wentAwayMore: 0 });
});

test('past the listing limit, the rest are counted rather than listed', () => {
  const many = Array.from({ length: EFFECT_HEADINGS_LISTED + 3 }, (_, i) => heading(`Title ${i}`));
  const effect = effectOf(screen(), screen(...many));
  expect(effect).toMatchObject({ appearedMore: 3 });
  if (effect.readable) expect(effect.appeared).toHaveLength(EFFECT_HEADINGS_LISTED);
});

test('a heading carrying its text as a child, not a name, is still read', () => {
  expect(headingsIn(screen({ role: 'heading', children: ['Total weight'] }))).toEqual([
    'Total weight',
  ]);
});
