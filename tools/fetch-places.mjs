// Restaurants, bars, cafés and stores for all of Pitt County, in one file the game loads at start:
//   public-data/places.json     (npm run fetch-places, or double-click fetch-places.cmd)
// 1. Every named restaurant / shop / gas station OpenStreetMap has in the county.
// 2. The small towns' businesses OpenStreetMap is missing, from business listings (Yellow Pages, Yelp,
//    Restaurantji, town & chamber directories, store locators — collected Sep 2026) in
//    tools/places-listings.json. Each is found by its street address in the county's tax parcels
//    (NC OneMap) and put on the building that stands on that parcel (OpenStreetMap or NC building
//    footprints), spread along the building when several share it.
// Rows use the restaurant layout: [name, brand?, type, cuisine, lat, lon, ref, drive-thru]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd(); const G = gridHelpers(root); const A = G.COUNTY;
const out = path.join(root, 'public-data', 'places.json');
const logFile = path.join(root, 'fetch-places.log');
const log = (...a) => { const s = a.join(' '); console.log(s); try { fs.appendFileSync(logFile, s + '\n'); } catch { } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const PARCELS = 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query';
const NCBLD = 'https://services1.arcgis.com/YBWrN5qiESVpqi92/ArcGIS/rest/services/NC_Risk_Building_Footprints/FeatureServer/0/query';
const r6 = v => Math.round(v * 1e6) / 1e6;

async function overpass(query) {
  let last = '';
  for (let a = 0; a < 8; a++) {
    const ep = MIRRORS[a % MIRRORS.length];
    try {
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GreenvilleOpenWorld/1.0 (places fetch)' }, signal: AbortSignal.timeout(300000) });
      if (r.ok) return await r.json(); last = `${new URL(ep).host} ${r.status}`;
    } catch (e) { last = `${new URL(ep).host} ${e.message}`; }
    log('  ' + last + ' — trying another server'); await sleep(5000);
  }
  throw new Error(last);
}
async function arcgis(url, params) {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url + '?' + new URLSearchParams(params), { signal: AbortSignal.timeout(60000) }); const j = await r.json(); if (!j.error) return j; } catch (e) { }
    await sleep(2000 * (a + 1));
  }
  return { features: [] };
}

// ---- 1. OpenStreetMap ----
log('Downloading every restaurant and store OpenStreetMap has in Pitt County…');
const bb = `(${A.s},${A.w},${A.n},${A.e})`;
const j = await overpass(`[out:json][timeout:180];(nwr["amenity"~"^(restaurant|fast_food|cafe|ice_cream|food_court|bar|pub|biergarten|fuel)$"]${bb};nwr["shop"]${bb};nwr["landuse"="retail"]["name"]${bb};);out center tags;`);
const rows = [];
for (const e of j.elements) {
  const t = e.tags || {}; if (!t.name) continue; const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon; if (la == null) continue;
  if (/auction|mortuary|funeral|highway patrol/i.test(t.name) || /^(vacant|no|funeral_directors|erotic)$/.test(t.shop || '')) continue;
  const type = t.shop || (t.landuse === 'retail' ? 'centre' : t.amenity);
  rows.push([t.name, t.brand ? 1 : 0, type, t.cuisine || '', r6(la), r6(lo), e.type[0] + e.id, t.drive_through === 'yes' ? 1 : 0]);
}
log(`  ${rows.length} places from OpenStreetMap.`);

// ---- 2. business listings for the small towns ----
const listings = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'places-listings.json'), 'utf8'));
const TOWN = { Ayden: [35.4727, -77.4155], Grifton: [35.3724, -77.4386], Farmville: [35.5954, -77.5853], Fountain: [35.6721, -77.6358], Falkland: [35.6999, -77.5139], 'Bell Arthur': [35.5912, -77.5131], Bethel: [35.8071, -77.3786], Grimesland: [35.5637, -77.1928], Stokes: [35.7115, -77.2733] };
const ORD = { '1ST': 'FIRST', '2ND': 'SECOND', '3RD': 'THIRD', '4TH': 'FOURTH', '5TH': 'FIFTH', '6TH': 'SIXTH' };
// "4787 NC Highway 11 N" → [4787, "NC 11%", …];  "566 3rd St" → [566, "%THIRD%", …]  (number, exact pattern, same-street test)
function streetKey(addr) {
  let [n, ...w] = addr.split(' '); w = w.filter(x => !/^(N|S|E|W)$/.test(x)); const s = w.join(' ');
  const hw = s.match(/\b(NC|US)[- ](?:Highway |Hwy )?(\d+)|\bHighway (\d+)/i);
  if (hw) { const r = hw[1] ? `${hw[1].toUpperCase()} ${hw[2]}` : `NC ${hw[3]}`; return [+n, `${r}%`, `(siteadd LIKE '% ${r}' OR siteadd LIKE '% ${r} %')`]; }
  if (w.length > 1) w.pop(); let k = w.join(' ').toUpperCase(); k = ORD[k] || k.replace(/ AVE$/, ''); if (k === 'PACTOLUS') k = 'PACTOLUS';
  return [+n, `%${k}%`, `siteadd LIKE '%${k}%'`];
}
const ringCentroid = r => { let a = 0, b = 0; for (const p of r) { a += p[1]; b += p[0]; } return [a / r.length, b / r.length]; }; // [lat, lon]
async function geocode(town, addr) {
  const [n, k, street] = streetKey(addr); const c = TOWN[town] || [35.61, -77.37];
  const env = TOWN[town] ? `${c[1] - 0.09},${c[0] - 0.07},${c[1] + 0.09},${c[0] + 0.07}` : `${A.w},${A.s},${A.e},${A.n}`;
  const q = { geometry: env, geometryType: 'esriGeometryEnvelope', inSR: 4326, outSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'siteadd', returnGeometry: true, geometryPrecision: 6, f: 'json' };
  const pick = feats => feats.map(f => ({ s: f.attributes.siteadd, ring: f.geometry && f.geometry.rings && f.geometry.rings[0], n: parseInt(f.attributes.siteadd) })).filter(f => f.ring);
  let f = pick((await arcgis(PARCELS, { ...q, where: `cntyname='Pitt' AND siteadd LIKE '${n} ${k}'` })).features || []);
  if (!f.length) { // no parcel with that exact number: the nearest number on the same street
    f = pick((await arcgis(PARCELS, { ...q, where: `cntyname='Pitt' AND ${street}` })).features || []).filter(p => p.n > 0 && Math.abs(p.n - n) <= 150).sort((a, b) => Math.abs(a.n - n) - Math.abs(b.n - n));
    f = f.filter(p => (p.n - n) % 2 === 0).concat(f.filter(p => (p.n - n) % 2 !== 0)); // same side of the street first (odd/even)
  }
  const d = (addr.match(/ (N|S|E|W) /) || [])[1]; const OPP = { N: 'SOUTH', S: 'NORTH', E: 'WEST', W: 'EAST' }; // "W Wilson St" is never "EAST WILSON ST"
  if (d) f = f.filter(p => !new RegExp('\\b(' + OPP[d] + '|' + OPP[d][0] + ') ').test(p.s));
  if (!f.length) return null;
  if (f.length > 1 && f[0].n === n) f.sort((a, b) => { const ca = ringCentroid(a.ring), cb = ringCentroid(b.ring); return Math.hypot(ca[0] - c[0], ca[1] - c[1]) - Math.hypot(cb[0] - c[0], cb[1] - c[1]); });
  return f[0];
}
// buildings: OpenStreetMap (the map squares the game ships) + NC building footprints
const X = lon => (lon + 77.3712) * 90607, Z = lat => -(lat - 35.6122) * 110574; // local metres, same scale as the game
const pip = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const areaOf = r => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
const cen = r => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; };
const tileBld = new Map();
async function buildingsNear(lat, lon) {
  const [tx, ty] = G.tileOfLL(lat, lon); const key = tx + '_' + ty; if (tileBld.has(key)) return tileBld.get(key);
  const list = [];
  const f = path.join(root, 'public-data', 'osm', key + '.json.gz');
  if (fs.existsSync(f)) for (const e of JSON.parse(zlib.gunzipSync(fs.readFileSync(f))).elements || []) {
    if (e.type !== 'way' || !e.tags || !e.tags.building || e.tags.building === 'roof' || !e.geometry) continue;
    const ring = e.geometry.filter(Boolean).map(p => [X(p.lon), Z(p.lat)]); if (ring.length >= 4) list.push({ ring: ring.slice(0, -1) });
  }
  const b = G.tileBBox(tx, ty);
  const nc = await arcgis(NCBLD, { where: '1=1', geometry: `${b.w},${b.s},${b.e},${b.n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, outSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'OBJECTID', returnGeometry: true, geometryPrecision: 6, resultRecordCount: 2000, f: 'json' });
  for (const ft of nc.features || []) { const r = ft.geometry && ft.geometry.rings && ft.geometry.rings[0]; if (r && r.length >= 4) list.push({ ring: r.slice(0, -1).map(p => [X(p[0]), Z(p[1])]) }); }
  for (const B of list) { B.c = cen(B.ring); B.a = areaOf(B.ring); }
  const keep = list.filter(B => B.a > 40); tileBld.set(key, keep); return keep;
}
function hostFor(parcelRing, blds) {
  const pr = parcelRing.map(p => [X(p[0]), Z(p[1])]); const pc = cen(pr);
  let best = null; for (const B of blds) if (pip(B.c[0], B.c[1], pr) && (!best || B.a > best.a)) best = B;
  if (!best) best = blds.find(B => pip(pc[0], pc[1], B.ring)) || null;
  if (!best) { let bd = 30; for (const B of blds) { const d = Math.hypot(B.c[0] - pc[0], B.c[1] - pc[1]); if (d < bd) { bd = d; best = B; } } }
  return { B: best, pc };
}
// the long axis of a footprint (for spreading several businesses along one building)
function axis(ring) {
  const [cx, cz] = cen(ring); let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of ring) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz); const ux = Math.cos(ang), uz = Math.sin(ang);
  let lo = 1e9, hi = -1e9; for (const [x, z] of ring) { const t = (x - cx) * ux + (z - cz) * uz; lo = Math.min(lo, t); hi = Math.max(hi, t); }
  return { cx, cz, ux, uz, L: hi - lo };
}

log(`Placing ${listings.length} listed businesses by street address…`);
const slots = new Map(); const placed = []; let missing = 0;
for (const [i, L] of listings.entries()) {
  const [name, town, cat, cuisine, brand, addr, drive] = L;
  let p = null; try { p = await geocode(town, addr); } catch (e) { }
  if (!p) { missing++; log(`  not found: ${name}, ${addr} (${town})`); continue; }
  const [la, lo] = ringCentroid(p.ring); const blds = await buildingsNear(la, lo);
  const h = hostFor(p.ring, blds); const k = h.B || ('p' + p.s);
  if (!slots.has(k)) slots.set(k, []); const item = { L, h, i }; slots.get(k).push(item); placed.push(item);
  if ((i + 1) % 25 === 0) log(`  … ${i + 1} of ${listings.length}`);
}
for (const list of slots.values()) list.forEach((it, i) => {
  const n = list.length; let x, z;
  if (it.h.B) { const a = axis(it.h.B.ring); let ok = false; for (const f of [0.8, 0.6, 0.4, 0.2]) { const t = ((i + 0.5) / n - 0.5) * a.L * f; x = a.cx + a.ux * t; z = a.cz + a.uz * t; if (pip(x, z, it.h.B.ring)) { ok = true; break; } } if (!ok) [x, z] = it.h.B.c; }
  else { [x, z] = it.h.pc; x += (i - (n - 1) / 2) * 30; }
  it.lat = r6(35.6122 - z / 110574); it.lon = r6(-77.3712 + x / 90607);
});

// ---- 3. merge: a listed business OSM (or the game's own snapshot) already has is left out ----
const nk = s => s.toLowerCase().replace(/^the /, '').replace(/[^a-z0-9]/g, '').slice(0, 7);
const snap = []; for (const f of ['03g_food.js', '03h_retail.js']) { const s = fs.readFileSync(path.join(root, 'src', f), 'utf8'); for (const m of s.matchAll(/\["([^"]+)",\d,"[^"]*",(?:"[^"]*",)?(35\.\d+),(-77\.\d+)/g)) snap.push([nk(m[1]), +m[2], +m[3]]); }
const have = rows.map(r => [nk(r[0]), r[4], r[5]]).concat(snap);
const GENERIC = new Set('auto parts repair service station store shop market mart food grill restaurant cafe pizza salon hair beauty nails nail barber bank dollar general family country convenient convenience grocery inc llc the and of farmville ayden grifton bethel fountain grimesland stokes falkland greenville winterville express home center tire tires body sales'.split(' '));
const words = s => s.toLowerCase().replace(/'s\b/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !GENERIC.has(w));
const near = rows.map(r => [r[2], r[4], r[5], words(r[0])]);
const dist = (a, b, c, d) => Math.hypot((a - c) * 110574, (b - d) * 90700);
const FOOD = /^(restaurant|fast_food|cafe|ice_cream|bar|pub|food_court|biergarten)$/;
let added = 0, dup = 0;
placed.forEach((it, i) => {
  const [name, town, cat, cuisine, brand, addr, drive] = it.L; const n = nk(name);
  if (have.some(h => h[0] === n && dist(h[1], h[2], it.lat, it.lon) < 150)) { dup++; return; }
  // the same shop under a different spelling ("Lizzy's Quilt Shop" / "Quilt Lizzy Ayden") in the same building
  const tk = words(name); if (near.some(o => dist(o[1], o[2], it.lat, it.lon) < 45 && (o[3].some(w => tk.includes(w)) || (o[0] === cat && dist(o[1], o[2], it.lat, it.lon) < 25)))) { dup++; return; } // …or the same kind of shop on the same spot
  rows.push([name, brand ? 1 : 0, cat, FOOD.test(cat) ? cuisine : '', it.lat, it.lon, 'y' + (9300 + it.i), drive ? 1 : 0]); have.push([n, it.lat, it.lon]); added++;
});
fs.writeFileSync(out, JSON.stringify({ v: 1, date: new Date().toISOString().slice(0, 10), rows }));
log(`Saved public-data/places.json: ${rows.length} places (${rows.length - added} from OpenStreetMap, ${added} from business listings; ${dup} listings OSM already had, ${missing} addresses not found) — ${Math.round(fs.statSync(out).size / 1024)} KB.`);
