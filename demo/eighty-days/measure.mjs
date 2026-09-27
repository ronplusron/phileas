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
//
// `fates` is the same reading, for the demo's watcher and guided run to say
// how each Route's game went.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WAYS_ON = /^Ways on from (.+)$/;

/**
 * Each Route of a run folder: the places it reached, how its game ended, and
 * where. `endedAt` counts Fix and Trip hops together; `endedAtTripHop` is the
 * Trip hop, absent when the game ended inside the Fix or not at all.
 */
export function fates(folder) {
  const routes = [];
  for (const file of fs.readdirSync(folder).filter((f) => f.endsWith('.jsonl')).sort()) {
    const entries = fs.readFileSync(path.join(folder, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const pools = new Map(entries.filter((e) => e.kind === 'pool').map((e) => [e.id, e.candidates]));
    const hops = entries.filter((e) => e.kind === 'trip-hop' || e.kind === 'fix-hop');
    const places = [];
    let ending = 'still going';
    let endedAt;
    let endedAtTripHop;
    let placesAtEnd;
    const pageCounts = [];
    hops.forEach((hop, i) => {
      for (const heading of hop.effect?.appeared ?? []) {
        const m = heading.match(WAYS_ON);
        if (m && places.at(-1) !== m[1]) places.push(m[1]);
        if (heading === 'The wager is won' || heading === 'The wager is lost') {
          if (endedAt === undefined) {
            ending = heading === 'The wager is won' ? 'won' : 'lost';
            endedAt = i + 1;
            if (hop.kind === 'trip-hop') endedAtTripHop = hop.hop;
            placesAtEnd = places.length;
          }
        }
      }
      const pool = pools.get(hop.pool);
      if (pool && hop.kind === 'trip-hop') pageCounts.push(pool.filter((c) => c.source === 'page').length);
    });
    const outcome = entries.findLast((e) => e.kind === 'outcome');
    const route = Number(file.match(/^route-(\d+)-/)?.[1]);
    routes.push({ file, route, places, ending, endedAt, endedAtTripHop, placesAtEnd, hops: hops.length, outcome: outcome?.outcome, pageCounts });
  }
  return routes;
}

/**
 * One line per Route, for a person: how the game went, and the places it
 * went through from `from` on, such as the place a Fix ends at, which every
 * Route shares. A game that ended stops at its ending; what a Route did after
 * setting out again is another game.
 */
export function fateLines(folder, from) {
  return fates(folder).map((r) => {
    const how =
      r.ending === 'still going'
        ? 'still going when its Trip ended'
        : `${r.ending} the wager${r.endedAtTripHop ? ` at Trip hop ${r.endedAtTripHop}` : ''}`;
    const played = r.places.slice(0, r.placesAtEnd ?? r.places.length);
    // London shows no ways on, so it is never read as a place; a won game reached it.
    if (r.ending === 'won') played.push('London');
    const start = from ? played.indexOf(from) : -1;
    return `route ${r.route}  ${how}: ${played.slice(Math.max(start, 0)).join(' > ') || 'nowhere'}`;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  if (!folder || !fs.existsSync(folder)) {
    console.error('Usage: node demo/eighty-days/measure.mjs <run folder>');
    process.exit(2);
  }
  const routes = fates(folder);
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
}
