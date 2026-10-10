// What every building in Pitt County is made of, from the county's own tax records (Pitt County GIS
// open data — gis.pittcountync.gov/gis/rest/services/PittOpenData):
//   • Tables/13 ParcelBuildingPOD — one row per building card: EXTERIOR_WALLS (brick, vinyl, ...),
//     ROOF_FLOOR_SYSTEM (gable, hip, flat, ...), DESIGN_STYLE (ranch, 2 story, ...), STORY_HEIGHT,
//     YEAR_BUILT, footprint area
//   • CadastralPitt/0 Pitt Parcels — the parcel shapes, joined by parcel number
// Saved per map square as public-data/pittbld/<tx>_<ty>.json.gz:
//   [[cards, ring, parcel], ...]  cards = [[wall, roof, style, storeys, year, footprintSqFt, landClass], ...] (largest first)
//                         ring  = parcel outline as integer micro-degrees from the square's south-west corner
// The game matches each building to the parcel it stands in (03k_realdata.js) and builds it from the
// right materials. A summary of every value found goes to public-data/pittbld/summary.json.
//   npm run fetch-pitt-buildings          (or double-click fetch-pitt-buildings.cmd)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd(); const G = gridHelpers(root);
const out = path.join(root, 'public-data', 'pittbld'); fs.mkdirSync(out, { recursive: true });
const cache = path.join(root, '.cache', 'pittbld'); fs.mkdirSync(cache, { recursive: true });
const BASE = 'https://gis.pittcountync.gov/gis/rest/services/PittOpenData/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function query(url, params, tries = 5) {
  const body = new URLSearchParams({ f: 'json', ...params });
  for (let k = 1; k <= tries; k++) {
    try {
      const r = await fetch(url + '/query', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j;
    } catch (e) { console.log(`  retry ${k}/${tries}: ${e.message}`); await sleep(1500 * k); }
  }
  throw new Error('gave up on ' + url);
}
// every row, 2000 at a time by OBJECTID (works whether or not the server pages by offset); cached so a re-run resumes
async function all(name, url, params) {
  const file = path.join(cache, name + '.json');
  if (fs.existsSync(file)) { const rows = JSON.parse(fs.readFileSync(file, 'utf8')); console.log(`${name}: ${rows.length} rows (cached)`); return rows; }
  const rows = []; let last = -1;
  for (;;) {
    const j = await query(url, { ...params, where: `(${params.where || '1=1'}) AND OBJECTID > ${last}`, orderByFields: 'OBJECTID', resultRecordCount: 2000 });
    const f = j.features || []; if (!f.length) break;
    for (const x of f) rows.push(x); last = f[f.length - 1].attributes.OBJECTID;
    process.stdout.write(`\r${name}: ${rows.length} rows…`);
    if (f.length < 100 && !j.exceededTransferLimit) break;
  }
  console.log(`\r${name}: ${rows.length} rows          `);
  fs.writeFileSync(file, JSON.stringify(rows)); return rows;
}

const clean = s => (s == null ? '' : String(s)).trim().toUpperCase();
const pkey = s => clean(s).replace(/^0+/, ''); // the building table zero-pads parcel numbers to 7 digits, the parcel layer doesn't
const bldRows = await all('buildings', BASE + 'Tables/MapServer/13', { outFields: 'OBJECTID,PARCEL_NUM,CARD_NUM,MB_FOOTPRINT_AREA,YEAR_BUILT,STORY_HEIGHT,DESIGN_STYLE,EXTERIOR_WALLS,ROOF_FLOOR_SYSTEM,LAND_CLASS', returnGeometry: false });
const cardsOf = new Map(); const tally = { walls: {}, roofs: {}, styles: {}, stories: {}, landClass: {} };
const bump = (t, k) => { t[k] = (t[k] || 0) + 1; };
for (const { attributes: a } of bldRows) {
  const pn = pkey(a.PARCEL_NUM); if (!pn) continue;
  const c = [clean(a.EXTERIOR_WALLS), clean(a.ROOF_FLOOR_SYSTEM), clean(a.DESIGN_STYLE), +a.STORY_HEIGHT || 0, +a.YEAR_BUILT || 0, +a.MB_FOOTPRINT_AREA || 0, clean(a.LAND_CLASS)];
  bump(tally.walls, c[0]); bump(tally.roofs, c[1]); bump(tally.styles, c[2]); bump(tally.stories, String(c[3])); bump(tally.landClass, clean(a.LAND_CLASS));
  (cardsOf.get(pn) || cardsOf.set(pn, []).get(pn)).push(c);
}
for (const l of cardsOf.values()) l.sort((p, q) => q[5] - p[5]);
console.log(`${cardsOf.size} parcels have buildings`);

const parcels = await all('parcels', BASE + 'CadastralPitt/MapServer/0', { outFields: 'OBJECTID,PARCELNUMBER', returnGeometry: true, outSR: 4326, geometryPrecision: 6 });
const squares = new Map(); let matched = 0;
for (const f of parcels) {
  const pn = pkey(f.attributes.PARCELNUMBER); const cards = cardsOf.get(pn); if (!cards || !f.geometry || !f.geometry.rings) continue;
  const ring = f.geometry.rings.slice().sort((p, q) => q.length - p.length)[0]; if (!ring || ring.length < 3) continue; matched++;
  let w = 1e9, s = 1e9, e = -1e9, n = -1e9; for (const [x, y] of ring) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const [tx0, ty0] = G.tileOfLL(s, w), [tx1, ty1] = G.tileOfLL(n, e);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const lon0 = G.LON0 + tx * G.TLON, lat0 = G.LAT0 + ty * G.TLAT; const flat = [];
    for (const [x, y] of ring) flat.push(Math.round((x - lon0) * 1e6), Math.round((y - lat0) * 1e6));
    const k = tx + '_' + ty; (squares.get(k) || squares.set(k, []).get(k)).push([cards, flat, pn]);
  }
}
for (const [k, list] of squares) fs.writeFileSync(path.join(out, k + '.json.gz'), zlib.gzipSync(JSON.stringify(list)));
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify([...squares.keys()].sort()));
const top = t => Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ buildingCards: bldRows.length, parcelsWithBuildings: cardsOf.size, parcelsMatched: matched, squares: squares.size, walls: top(tally.walls), roofs: top(tally.roofs), styles: top(tally.styles), stories: top(tally.stories), landClass: top(tally.landClass) }, null, 1));
console.log(`Done: ${matched} parcels with buildings in ${squares.size} map squares → public-data/pittbld/ (see summary.json)`);
