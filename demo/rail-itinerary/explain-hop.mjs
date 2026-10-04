// How one Hop chose its move, told from its journal line: what the screen
// offered, the two numbers drawn from the seed, which control those numbers
// point at, what was done to it, and what changed.
//
// For the demo's "how it decides each move" section. It reads the record the
// engine wrote rather than describing the engine, so what it shows is what
// happened. It works the choice out again from the draws, and if that ever
// lands on a different control than the one the journal names, it says so and
// fails, rather than showing an explanation that does not match the record.
//
//   node demo/rail-itinerary/explain-hop.mjs <run folder or journal file> [hop]
//
// A run folder means its Route 1. The hop defaults to 1, and counts Trip hops,
// since a Fix hop is written in advance and draws nothing.
import fs from 'node:fs';
import path from 'node:path';
import { effectText, targetText } from '../../src/report/render.mjs';

const [where, hopArg = '1'] = process.argv.slice(2);
if (!where) {
  console.error('Usage: node explain-hop.mjs <run folder or journal file> [hop]');
  process.exit(2);
}
const hopNumber = Number(hopArg);

const file = fs.statSync(where).isDirectory()
  ? path.join(where, fs.readdirSync(where).filter((f) => /^route-001-.*\.jsonl$/.test(f))[0] ?? '')
  : where;
const entries = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const route = entries.find((e) => e.kind === 'route');
const hop = entries.find((e) => e.kind === 'trip-hop' && e.hop === hopNumber);
if (!route || !hop) {
  console.error(`No Trip hop ${hopNumber} in ${file}.`);
  process.exit(1);
}
if (route.keyShare === undefined || route.menuShare === undefined || hop.shareDraw === undefined) {
  console.error(
    `${file} does not record the shares its draws were made with, which journals ` +
      `began doing on 2026-09-24, so its choices cannot be worked out again. Explain a newer run.`
  );
  process.exit(1);
}
const pool = entries.find((e) => e.kind === 'pool' && e.id === hop.pool)?.candidates ?? [];

// The three sides a Hop draws between, in the engine's order. Printed
// shortcuts go with the page, since they are drawn with the controls.
const isKey = (c) => c.source === 'key' && c.role === 'key';
const sides = {
  keys: pool.filter(isKey),
  menu: pool.filter((c) => c.source === 'menu'),
  page: pool.filter((c) => c.source !== 'menu' && !isKey(c)),
};

const fraction = (draw) => draw / 4_294_967_296;
const percent = (x) => `${(x * 100).toFixed(1)}%`;
const keyShare = route.keyShare;
const menuShare = route.menuShare;

console.log(`Hop ${hopNumber} of Route ${route.routeNumber}, seed "${route.journeySeed}"\n`);

console.log(`1. Look. The screen offered ${pool.length} things:`);
const labels = { page: 'On the page', menu: 'In the menu bar', keys: 'Keys' };
for (const side of ['page', 'menu', 'keys']) {
  const list = sides[side];
  if (!list.length) continue;
  console.log(`   ${labels[side]} (${list.length}):`);
  list.forEach((c, i) => console.log(`     ${String(i + 1).padStart(2)}  ${targetText(c)}`));
}
console.log('');

const shareFraction = fraction(hop.shareDraw);
const pointed =
  shareFraction < keyShare ? 'keys' : shareFraction < keyShare + menuShare ? 'menu' : 'page';
// A side with nothing on it falls back to the page, then the keys, then the menu.
const side = [pointed, 'page', 'keys', 'menu'].find((s) => sides[s].length);
console.log(`2. Pick a kind of move. The seed gave ${hop.shareDraw}, which is ${percent(shareFraction)} of the way up.`);
console.log(
  `   Below ${percent(keyShare)} means a key, up to ${percent(keyShare + menuShare)} the menu bar, above that the page.`
);
console.log(
  side === pointed
    ? `   So: ${labels[side].toLowerCase()}.\n`
    : `   That points at ${labels[pointed].toLowerCase()}, which offered nothing, so: ${labels[side].toLowerCase()}.\n`
);

const list = sides[side];
let chosen;
if (hop.menuDraws) {
  // Since 2026-10-03 the menu is opened as a person opens it: a top menu
  // first, then an item within it, one number from the seed for each level.
  console.log(`3. Open the menu, a level at a time, one number from the seed for each.`);
  let remaining = list;
  hop.menuDraws.forEach((draw, depth) => {
    const itemOf = (c) => `${c.menuPath[depth]}${c.menuPath.length === depth + 1 ? '' : ' >'}`;
    const items = [...new Set(remaining.map(itemOf))];
    const index = Math.floor(fraction(draw) * items.length);
    console.log(`   ${percent(fraction(draw))} of [${items.join(', ')}] lands on ${items[index]}.`);
    remaining = remaining.filter((c) => itemOf(c) === items[index]);
  });
  chosen = remaining[0];
  console.log(`   So: ${chosen ? targetText(chosen) : 'nothing'}.\n`);
} else {
  const index = Math.floor(fraction(hop.draw) * list.length);
  chosen = list[index];
  console.log(`3. Pick one. The seed gave ${hop.draw}, which is ${percent(fraction(hop.draw))} of the way up.`);
  console.log(
    `   ${percent(fraction(hop.draw))} of ${list.length} lands on number ${index + 1}: ${chosen ? targetText(chosen) : 'nothing'}.\n`
  );
}

if (!chosen || JSON.stringify(chosen) !== JSON.stringify(hop.target)) {
  console.error(
    `This explanation does not match the journal, which says the Hop acted on ` +
      `${targetText(hop.target)}. The demo's arithmetic has drifted from the engine's; ` +
      `trust the journal, and fix this script.`
  );
  process.exit(1);
}

const how = { click: 'click it', type: `type ${JSON.stringify(hop.value ?? '')} into it`, press: 'press it', select: 'select it', focus: 'focus it', 'menu-click': 'choose it from the menu' };
console.log(`4. Act. It is a ${hop.target.role}, so ${how[hop.action] ?? hop.action}.\n`);
console.log(`5. See what changed: ${effectText(hop.effect)}`);
