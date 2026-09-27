// The chart on the Circuit screen: the circuit so far, drawn round the world.
//
// Decoration only, hidden from the accessibility tree, so nothing drawn here
// is ever a candidate or a nameless control. The same passages are listed as
// text beside it. The game calls this the chart because Map is a word the
// engine uses, and the application never says it.
//
// The world is unrolled eastward from London, so the whole circuit reads left
// to right and London stands at both ends.
(function (root) {
  'use strict';

  const WIDTH = 1000;
  const HEIGHT = 300;
  const WEST = -20;
  const EAST = 380;
  const NORTH = 66;
  const SOUTH = -12;

  const MODE_CLASS = { ship: 'sea', boat: 'sea', train: 'rail', elephant: 'elephant', sledge: 'sledge', foot: 'land', cart: 'land' };

  const x = (lon) => ((lon - WEST) / (EAST - WEST)) * WIDTH;
  const y = (lat) => ((NORTH - lat) / (NORTH - SOUTH)) * HEIGHT;

  /** The shortest signed step in longitude, so an eastward crossing of the Pacific moves right. */
  function step(fromLon, toLon) {
    return ((toLon - fromLon + 540) % 360) - 180;
  }

  function escape(text) {
    return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  /** The chart as SVG markup, from the Ledger's passages and the places. */
  function chartSvg(passages, places, bookPlaceIds) {
    const parts = [];
    parts.push(`<svg class="chart" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true" focusable="false">`);
    parts.push(`<rect class="chart-sea" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" />`);
    for (let lon = 0; lon <= 360; lon += 30) {
      parts.push(`<line class="chart-grid" x1="${x(lon)}" y1="0" x2="${x(lon)}" y2="${HEIGHT}" />`);
    }
    for (let lat = -0; lat <= 60; lat += 20) {
      parts.push(`<line class="chart-grid${lat === 0 ? ' chart-equator' : ''}" x1="0" y1="${y(lat)}" x2="${WIDTH}" y2="${y(lat)}" />`);
    }
    parts.push(`<line class="chart-meridian" x1="${x(180)}" y1="0" x2="${x(180)}" y2="${HEIGHT}" />`);
    parts.push(`<text class="chart-note" x="${x(180) + 6}" y="${HEIGHT - 10}">180°</text>`);

    // The book's own stops, faintly, so a watcher can see where the book went.
    let unrolled = 0;
    let previous = places.london;
    const bookX = { london: 0 };
    for (const id of bookPlaceIds) {
      const p = places[id];
      unrolled += step(previous.lon, p.lon);
      bookX[id] = unrolled;
      previous = p;
      parts.push(`<circle class="chart-book" cx="${x(unrolled)}" cy="${y(p.lat)}" r="3" />`);
    }
    parts.push(`<circle class="chart-book" cx="${x(360)}" cy="${y(places.london.lat)}" r="3" />`);

    // The passages taken, each in its mode's color, drawn in the order taken.
    let lon = 0;
    let at = places.london;
    const drawn = [{ lon: 0, place: at }];
    passages.forEach((passage, i) => {
      const to = places[passage.to];
      const next = lon + step(at.lon, to.lon);
      const cls = MODE_CLASS[passage.mode] ?? 'land';
      const latest = i === passages.length - 1 ? ' chart-latest' : '';
      parts.push(
        `<line class="chart-passage chart-${cls}${latest}" x1="${x(lon)}" y1="${y(at.lat)}" x2="${x(next)}" y2="${y(to.lat)}" pathLength="1" />`
      );
      lon = next;
      at = to;
      drawn.push({ lon, place: to });
    });
    for (const point of drawn) {
      parts.push(`<circle class="chart-stop" cx="${x(point.lon)}" cy="${y(point.place.lat)}" r="4" />`);
      parts.push(`<text class="chart-label" x="${x(point.lon) + 6}" y="${y(point.place.lat) - 6}">${escape(point.place.name)}</text>`);
    }
    const last = drawn.at(-1);
    parts.push(`<circle class="chart-here" cx="${x(last.lon)}" cy="${y(last.place.lat)}" r="8" />`);
    parts.push('</svg>');
    return parts.join('');
  }

  root.EightyDaysChart = { chartSvg };
})(typeof window !== 'undefined' ? window : globalThis);
