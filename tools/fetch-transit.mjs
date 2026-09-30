// Railways, level crossings, bus routes and bus stops for all of Pitt County, from OpenStreetMap,
// in one small file the game loads at start:  public-data/transit.json
//   npm run fetch-transit   (or double-click fetch-transit.cmd)
// Trains run on the stitched railway lines, buses drive their real routes and stop at the mapped stops.
import fs from 'node:fs';
import path from 'node:path';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd(); const G = gridHelpers(root); const A = G.COUNTY;
const out = path.join(root, 'public-data', 'transit.json');
const logFile = path.join(root, 'fetch-transit.log');
const log = (...a) => { const s = a.join(' '); console.log(s); try { fs.appendFileSync(logFile, s + '\n'); } catch { } };
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const bb = `${A.s},${A.w},${A.n},${A.e}`;
// a little wider for bus routes that leave the county briefly
const q = `[out:json][timeout:240];
(
  way["railway"~"^(rail|spur|siding|yard|light_rail)$"](${bb});
  node["railway"~"^(level_crossing|crossing)$"](${bb});
)->.rail;
.rail out geom;
relation["route"="bus"](${bb})->.routes;
.routes out geom;
node["highway"="bus_stop"](${bb});
out;
node["public_transport"="platform"]["bus"="yes"](${bb});
out;`;

async function overpass(query) {
  let last = '';
  for (let a = 0; a < 8; a++) {
    const ep = MIRRORS[a % MIRRORS.length];
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5 * 60 * 1000);
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GreenvilleOpenWorld/1.0 (transit fetch)' }, signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) { last = `${new URL(ep).host} ${r.status}`; log('  ' + last + ' — trying another server'); await new Promise(r => setTimeout(r, 5000)); continue; }
      return await r.json();
    } catch (e) { last = `${new URL(ep).host} ${e.message}`; log('  ' + last); await new Promise(r => setTimeout(r, 4000)); }
  }
  throw new Error(last);
}

log('Downloading railways, level crossings, bus routes and stops for Pitt County…');
const j = await overpass(q);
const r6 = v => Math.round(v * 1e6) / 1e6;
const rails = [], xings = [], routes = [], stops = new Map();
for (const e of j.elements) {
  if (e.type === 'way' && e.tags && e.tags.railway) {
    if (!e.geometry || e.geometry.length < 2) continue;
    const t = e.tags; if (t.tunnel === 'yes') continue;
    rails.push({ id: e.id, nodes: e.nodes, pts: e.geometry.map(p => [r6(p.lat), r6(p.lon)]), kind: t.railway, service: t.service || '', usage: t.usage || '', bridge: t.bridge === 'yes' ? 1 : 0, name: t.name || t.operator || '' });
  } else if (e.type === 'node' && e.tags && /^(level_crossing|crossing)$/.test(e.tags.railway || '')) {
    xings.push({ id: e.id, lat: r6(e.lat), lon: r6(e.lon), kind: e.tags.railway, barrier: e.tags['crossing:barrier'] || '', lights: e.tags['crossing:light'] || '' });
  } else if (e.type === 'relation' && e.tags && e.tags.route === 'bus') {
    const t = e.tags; const ways = [], rs = [];
    for (const m of e.members || []) {
      if (m.type === 'way' && (!m.role || m.role === 'forward' || m.role === 'backward') && m.geometry) ways.push(m.geometry.filter(Boolean).map(p => [r6(p.lat), r6(p.lon)]));
      else if (m.type === 'node' && /stop|platform/.test(m.role || '') && m.lat != null) rs.push([r6(m.lat), r6(m.lon)]);
    }
    if (ways.length) routes.push({ id: e.id, ref: t.ref || '', name: t.name || '', from: t.from || '', to: t.to || '', operator: t.operator || t.network || '', colour: t.colour || '', ways, stops: rs });
  } else if (e.type === 'node' && e.tags && (e.tags.highway === 'bus_stop' || e.tags.public_transport === 'platform')) {
    stops.set(e.id, { id: e.id, lat: r6(e.lat), lon: r6(e.lon), name: e.tags.name || '', shelter: e.tags.shelter === 'yes' ? 1 : 0, bench: e.tags.bench === 'yes' ? 1 : 0, operator: e.tags.operator || e.tags.network || '' });
  }
}
const data = { v: 1, date: new Date().toISOString().slice(0, 10), rails, xings, routes, stops: [...stops.values()] };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
log(`Saved public-data/transit.json: ${rails.length} railway pieces, ${xings.length} level crossings, ${routes.length} bus routes (${routes.map(r => (r.operator ? r.operator + ' ' : '') + (r.ref || r.name)).join(', ')}), ${stops.size} bus stops — ${Math.round(fs.statSync(out).size / 1024)} KB.`);
