import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * The game's rules, played without a window: the book's own choices must end
 * the way the book does.
 *
 * Fogg reaches the Reform Club at ten minutes before nine on the 21st of
 * December by his diary, believes he is five minutes late, and has won,
 * because by London's calendar it is Friday the 20th. Chapters XXXV to
 * XXXVII. If the data or the rules drift from the book, this is where it
 * shows first, and it runs in a second rather than launching the game.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

interface Rules {
  prepare(data: unknown): World;
  initialState(): State;
  act(state: State, action: Record<string, unknown>, world: World): State;
  clockText(hours: number, start: string): string;
  londonHours(state: State): number;
}
interface World {
  start: string;
}
interface State {
  phase: string;
  place: string;
  hours: number;
  bag: number;
  notice: string;
  ticket: { message: string } | null;
  ending: { won: boolean; reason: string } | null;
  flags: Record<string, boolean>;
}

function load(): { rules: Rules; world: World } {
  const context: Record<string, unknown> = {};
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'renderer', 'game.js'), 'utf8'), context);
  const rules = context.EightyDays as Rules;
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
  const world = rules.prepare({ places: read('places.json'), departures: read('departures.json'), story: read('story.json') });
  return { rules, world };
}

/** The novel's choices, in order. A ticketed departure is taken, then booked. */
const BOOK: Record<string, unknown>[] = [
  { type: 'accept' },
  { type: 'take', departure: 'mail-brindisi' }, { type: 'book' },
  { type: 'take', departure: 'mongolia-suez' }, { type: 'book' },
  { type: 'visa', by: 'servant' },
  { type: 'take', departure: 'mongolia-aden' },
  { type: 'take', departure: 'mongolia-bombay' },
  { type: 'temple' },
  { type: 'take', departure: 'gip-kholby' }, { type: 'book' },
  { type: 'offer', raise: true }, { type: 'offer', raise: true }, { type: 'offer', raise: true }, { type: 'offer', raise: true },
  { type: 'guide', value: true },
  { type: 'buy-kiouni' },
  { type: 'take', departure: 'kiouni-pillaji' },
  { type: 'rescue' },
  { type: 'take', departure: 'kiouni-allahabad' },
  { type: 'take', departure: 'rail-calcutta' }, { type: 'book' },
  { type: 'take', departure: 'rangoon-singapore' }, { type: 'book' },
  { type: 'take', departure: 'rangoon-hongkong' },
  { type: 'tavern' },
  { type: 'take', departure: 'tankadere' },
  { type: 'take', departure: 'general-grant-shanghai' }, { type: 'book' },
  { type: 'circus' },
  { type: 'take', departure: 'general-grant' }, { type: 'book' },
  { type: 'take', departure: 'pacific-railroad' }, { type: 'book' },
  { type: 'take', departure: 'rail-fortkearney' },
  { type: 'soldiers' },
  { type: 'sail', value: true },
  { type: 'take', departure: 'sledge-omaha' },
  { type: 'take', departure: 'rail-newyork' }, { type: 'book' },
  { type: 'take', departure: 'henrietta' }, { type: 'book' },
  { type: 'take', departure: 'mail-liverpool' },
  { type: 'take', departure: 'express-london' },
  { type: 'club' },
];

function play(actions: Record<string, unknown>[]) {
  const { rules, world } = load();
  let state = rules.initialState();
  for (const action of actions) {
    state = rules.act(state, action, world);
    expect(state.ticket?.message ?? '', `after ${JSON.stringify(action)}`).toBe('');
    expect(state.notice, `after ${JSON.stringify(action)}`).not.toMatch(/not open|holds only|will not sell/);
  }
  return { rules, world, state };
}

test('the book’s own choices win the wager, a day early by London’s calendar', () => {
  const { rules, world, state } = play(BOOK);
  expect(state.phase).toBe('ended');
  expect(state.ending?.won).toBe(true);
  expect(rules.clockText(state.hours, world.start)).toBe('Saturday, 21 December 1872, 8.50 p.m.');
  expect(rules.clockText(rules.londonHours(state), world.start)).toBe('Friday, 20 December 1872, 8.50 p.m.');
  expect(state.flags.believesLate).toBe(true);
});

test('the book’s places are reached on the book’s dates', () => {
  const { rules, world } = load();
  let state = rules.initialState();
  const reached: Record<string, string> = {};
  for (const action of BOOK) {
    const before = state.place;
    state = rules.act(state, action, world);
    if (state.place !== before && !reached[state.place]) reached[state.place] = rules.clockText(state.hours, world.start);
  }
  // Each from the novel. Liverpool is after the warrant: the quay at 11.40, the special at three.
  expect(reached.suez).toBe('Wednesday, 9 October 1872, 11.00 a.m.');
  expect(reached.bombay).toBe('Sunday, 20 October 1872, 4.30 p.m.');
  expect(reached.sanfrancisco).toBe('Tuesday, 3 December 1872, 7.00 a.m.');
  expect(reached.newyork).toBe('Wednesday, 11 December 1872, 11.15 p.m.');
  expect(reached.liverpool).toBe('Saturday, 21 December 1872, 3.00 p.m.');
});

test('missing the Carnatic by the tavern is the book’s way, and staying out of it keeps the Carnatic', () => {
  const upToHongKong = BOOK.slice(0, BOOK.findIndex((a) => a.type === 'tavern'));
  const { rules, world, state } = play(upToHongKong);
  const withTavern = rules.act(state, { type: 'tavern' }, world);
  const carnatic = rules.act(withTavern, { type: 'take', departure: 'carnatic' }, world);
  expect(carnatic.notice).toMatch(/not open/);
  const without = rules.act(state, { type: 'take', departure: 'carnatic' }, world);
  expect(without.ticket).not.toBeNull();
});
