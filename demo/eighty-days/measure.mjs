// How far a run's Routes got, read from its journals: the balance measurement
// docs/DEMO_PLAN_EIGHTY_DAYS.md asks for.
//
//   node demo/eighty-days/measure.mjs demo/eighty-days/phileas/.phileas-journals/<seed>/<run>
//
// For each Route: the places it reached in order, how it ended, and how many
// Hops that took. Then across the run: how many Routes won, lost or were still
// going, how many distinct sequences of places they made, and the page
// candidates on offer, since the plan sets a floor on those. Everything comes
// from what the journals recorded; nothing here knows the game's rules.
import fs from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder || !fs.existsSync(folder)) {
  console.error('Usage: node demo/eighty-days/measure.mjs <run folder>');
  process.exit(2);
}

const WAYS_ON = /^Ways on from (.+)$/;
const routes = [];
for (const file of fs.readdirSync(folder).filter((f) => f.endsWith('.jsonl')).sort()) {
  const entries = fs.readFileSync(path.join(folder, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const pools = new Map(entries.filter((e) => e.kind === 'pool').map((e) => [e.id, e.candidates]));
  const hops = entries.filter((e) => e.kind === 'trip-hop' || e.kind === 'fix-hop');
  const places = [];
  let ending = 'still going';
  let endedAt;
  const pageCounts = [];
  hops.forEach((hop, i) => {
    for (const heading of hop.effect?.appeared ?? []) {
      const m = heading.match(WAYS_ON);
      if (m && places.at(-1) !== m[1]) places.push(m[1]);
      if (heading === 'The wager is won' || heading === 'The wager is lost') {
        if (endedAt === undefined) {
          ending = heading === 'The wager is won' ? 'won' : 'lost';
          endedAt = i + 1;
        }
      }
    }
    const pool = pools.get(hop.pool);
    if (pool && hop.kind === 'trip-hop') pageCounts.push(pool.filter((c) => c.source === 'page').length);
  });
  const outcome = entries.findLast((e) => e.kind === 'outcome');
  routes.push({ file, places, ending, endedAt, hops: hops.length, outcome: outcome?.outcome, pageCounts });
}

for (const r of routes) {
  console.log(`${r.file}  ${r.outcome ?? '?'} after ${r.hops} hops`);
  console.log(`  ${r.ending}${r.endedAt ? ` at hop ${r.endedAt}` : ''}; reached ${r.places.length}: ${r.places.join(' > ') || 'nowhere'}`);
}
const count = (e) => routes.filter((r) => r.ending === e).length;
const sequences = new Set(routes.map((r) => r.places.join('>')));
const allPage = routes.flatMap((r) => r.pageCounts);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log('');
console.log(`${routes.length} Routes: ${count('won')} won, ${count('lost')} lost, ${count('still going')} still going`);
console.log(`${sequences.size} distinct sequences of places`);
console.log(`places reached per Route: ${routes.map((r) => r.places.length).join(', ')}`);
if (allPage.length) console.log(`page candidates per Hop: median ${median(allPage)}, least ${Math.min(...allPage)}, most ${Math.max(...allPage)}`);
