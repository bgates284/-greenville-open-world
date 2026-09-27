// Downloads the whole city's map data in a few large requests and splits it into map squares
// locally (much faster than asking the busy public map server for ~255 squares one by one).
//   npm run fetch-city            → fills .cache/overpass/ (what the dev server and pack-data use)
//   npm run fetch-city -- --pack  → also copies everything into public-data/osm/ for the hosted site
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { gridHelpers, packData } from './pack-data.mjs';

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = process.cwd();
const G = gridHelpers(root);
const cacheDir = path.join(root, '.cache', 'overpass'); fs.mkdirSync(cacheDir, { recursive: true });
const keyOf = (tx, ty) => crypto.createHash('sha1').update(G.overpassQuery(G.tileBBox(tx, ty))).digest('hex');
const fileOf = (tx, ty) => path.join(cacheDir, keyOf(tx, ty) + '.json.gz');
const have = (tx, ty) => fs.existsSync(fileOf(tx, ty));

// ---- one Overpass request, rotating mirrors when a server is busy ----
let mi = 0;
async function overpass(query, label) {
  let last = '';
  for (let a = 0; a < 6; a++) {
    const ep = MIRRORS[mi++ % MIRRORS.length], host = new URL(ep).host; const t0 = Date.now();
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 16 * 60 * 1000);
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GreenvilleOpenWorld/1.0 (city download)' }, signal: ctl.signal });
      const txt = await r.text(); clearTimeout(to);
      if (r.ok && txt.trimStart().startsWith('{')) {
        const j = JSON.parse(txt);
        if (Array.isArray(j.elements) && !(j.remark && /runtime error|timed out|out of memory/i.test(j.remark))) { console.log(`  ${label}: ${j.elements.length.toLocaleString()} features from ${host} in ${Math.round((Date.now() - t0) / 1000)}s`); return j; }
        last = `${host}: ${j.remark}`;
      } else last = `${host}: HTTP ${r.status}`;
    } catch (e) { last = `${host}: ${e.name === 'AbortError' ? 'timed out' : e.message}`; }
    console.log(`  ${label}: server busy (${last}) — trying again`);
    await sleep(Math.min(30000, 5000 * (a + 1)));
  }
  throw new Error(last);
}

// ---- which elements a single-square request would have returned ----
function clipHit(x0, y0, x1, y1, b) { // does segment (lon,lat) touch box b?
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - b.w], [dx, b.e - x0], [-dy, y0 - b.s], [dy, b.n - y0]]) {
    if (p === 0) { if (q < 0) return false; }
    else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
}
function lineHits(geom, b) {
  const pts = (geom || []).filter(Boolean);
  if (pts.length === 1) return pts[0].lon >= b.w && pts[0].lon <= b.e && pts[0].lat >= b.s && pts[0].lat <= b.n;
  for (let i = 1; i < pts.length; i++) if (clipHit(pts[i - 1].lon, pts[i - 1].lat, pts[i].lon, pts[i].lat, b)) return true;
  return false;
}
function boundsOf(e) {
  let s = 90, n = -90, w = 180, ea = -180; const add = p => { if (!p) return; s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); ea = Math.max(ea, p.lon); };
  if (e.type === 'node') add(e); else if (e.type === 'way') (e.geometry || []).forEach(add); else for (const m of e.members || []) (m.geometry || []).forEach(add);
  return { s, n, w, e: ea };
}
function elementHits(e, b) {
  if (e.type === 'node') return e.lon >= b.w && e.lon <= b.e && e.lat >= b.s && e.lat <= b.n;
  if (e.type === 'way') return lineHits(e.geometry, b);
  return (e.members || []).some(m => m.type === 'way' ? lineHits(m.geometry, b) : m.type === 'node' && m.lat != null && m.lon >= b.w && m.lon <= b.e && m.lat >= b.s && m.lat <= b.n);
}

// ---- fetch a block of squares in one request, split it, save each square ----
async function fetchBlock(x0, y0, x1, y1, depth = 0) {
  const need = []; for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!have(tx, ty)) need.push([tx, ty]);
  if (!need.length) return 0;
  const a = G.tileBBox(x0, y0), c = G.tileBBox(x1, y1); const bb = { s: a.s, w: a.w, n: c.n, e: c.e };
  const label = `squares ${x0}_${y0}…${x1}_${y1}`;
  let j;
  try {
    const single = x0 === x1 && y0 === y1;
    const q = single ? G.overpassQuery(bb) : G.overpassQuery(bb).replace('[timeout:120]', '[timeout:900][maxsize:2000000000]');
    j = await overpass(q, label);
  } catch (e) {
    if (x0 === x1 && y0 === y1) { console.log(`  ${label}: skipped (${e.message}) — run again later`); return 0; }
    console.log(`  ${label}: too big right now, splitting it up`);
    const mx = Math.floor((x0 + x1) / 2), my = Math.floor((y0 + y1) / 2); let n = 0;
    for (const [ax, ay, bx, by] of [[x0, y0, mx, my], [mx + 1, y0, x1, my], [x0, my + 1, mx, y1], [mx + 1, my + 1, x1, y1]]) if (ax <= bx && ay <= by) n += await fetchBlock(ax, ay, bx, by, depth + 1);
    return n;
  }
  const els = j.elements.map(e => ({ e, b: boundsOf(e) }));
  let n = 0;
  for (const [tx, ty] of need) {
    const b = G.tileBBox(tx, ty);
    const mine = els.filter(({ e, b: eb }) => eb.e >= b.w && eb.w <= b.e && eb.n >= b.s && eb.s <= b.n && elementHits(e, b)).map(x => x.e);
    fs.writeFileSync(fileOf(tx, ty), zlib.gzipSync(JSON.stringify({ version: j.version, generator: j.generator, osm3s: j.osm3s, elements: mine }))); n++;
  }
  return n;
}

const B = +(process.env.BLOCK || 3);
const [cx0, cy0] = G.tileOfLL(G.CITY.s, G.CITY.w), [cx1, cy1] = G.tileOfLL(G.CITY.n, G.CITY.e);
const total = (cx1 - cx0 + 1) * (cy1 - cy0 + 1); let missing = 0;
for (let ty = cy0; ty <= cy1; ty++) for (let tx = cx0; tx <= cx1; tx++) if (!have(tx, ty)) missing++;
console.log(`Greenville: ${total} map squares, ${total - missing} already downloaded, ${missing} to go.`);
const t0 = Date.now(); let got = 0;
for (let by = cy0; by <= cy1; by += B) for (let bx = cx0; bx <= cx1; bx += B) {
  got += await fetchBlock(bx, by, Math.min(cx1, bx + B - 1), Math.min(cy1, by + B - 1));
  console.log(`  … ${got} of ${missing} new squares saved (${Math.round((Date.now() - t0) / 60000)} min)`);
}
let left = 0; for (let ty = cy0; ty <= cy1; ty++) for (let tx = cx0; tx <= cx1; tx++) if (!have(tx, ty)) left++;
console.log(left ? `Done for now: ${left} squares couldn't be downloaded (busy servers) — run this again to get them.` : 'The whole city is downloaded.');
if (process.argv.includes('--pack')) packData(root);
