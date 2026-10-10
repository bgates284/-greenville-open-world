// Street-level photos of Pitt County's shops, restaurants, offices, churches and other named buildings,
// from Mapillary (free, openly licensed street imagery, CC BY-SA 4.0 — www.mapillary.com).
// For every such building in the packed map squares it finds the nearby photos whose camera was pointing at
// it, keeps the best two, and downloads them to .cache/mapillary/img/. tools/mapillary-sheets.py then lays
// them out on contact sheets so each building's real look (wall colour and material, awnings, storeys) can
// be read off and saved to public-data/facades.json, which the game uses when it builds them.
//   1. make a free account at www.mapillary.com → Dashboard → Developers → register an app → copy the
//      "Client token" (starts with MLY|) into a file called mapillary-token.txt next to this repo's README
//   2. double-click fetch-mapillary.cmd (or: node tools/fetch-mapillary.mjs [--area winterville|greenville|ayden|farmville|all] [--limit N])
// Safe to re-run: photos already downloaded are skipped.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd(); const G = gridHelpers(root);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const tokFile = path.join(root, 'mapillary-token.txt');
const TOKEN = (process.env.MAPILLARY_TOKEN || (fs.existsSync(tokFile) ? fs.readFileSync(tokFile, 'utf8') : '')).trim();
if (!/^MLY\|/.test(TOKEN)) { console.log('No Mapillary token yet. Put your Client token (starts with MLY|) in mapillary-token.txt in the repo folder — see the top of tools/fetch-mapillary.mjs.'); process.exit(1); }
const AREAS = { // [south, west, north, east]
  winterville: [35.505, -77.425, 35.545, -77.375], greenville: [35.55, -77.44, 35.66, -77.31], ayden: [35.455, -77.43, 35.485, -77.4],
  farmville: [35.585, -77.6, 35.61, -77.57], all: [35.35, -77.72, 35.85, -77.08],
};
const A = AREAS[arg('area', 'all')] || AREAS.all; const LIMIT = +arg('limit', 1e9);
const cache = path.join(root, '.cache', 'mapillary'), imgDir = path.join(cache, 'img'), metaDir = path.join(cache, 'meta');
for (const d of [cache, imgDir, metaDir]) fs.mkdirSync(d, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const M_LAT = 110574, M_LON = 111320 * Math.cos(35.6 * Math.PI / 180);

async function getJSON(url, tries = 4) {
  for (let k = 1; k <= tries; k++) {
    try { const r = await fetch(url, { headers: { Authorization: 'OAuth ' + TOKEN } }); if (r.status === 401 || r.status === 403) { console.log('Mapillary refused the token (' + r.status + '). Check mapillary-token.txt.'); process.exit(1); }
      if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) { if (k === tries) throw e; await sleep(1500 * k); }
  }
}
// all photos in a box (split into quarters when the API's 2000-per-request cap is hit)
async function photosIn(s, w, n, e, depth = 0) {
  const f = 'id,computed_geometry,geometry,compass_angle,computed_compass_angle,captured_at,is_pano';
  const j = await getJSON(`https://graph.mapillary.com/images?fields=${f}&bbox=${w},${s},${e},${n}&limit=2000`);
  const d = j.data || [];
  if (d.length >= 2000 && depth < 3) { const ms = (s + n) / 2, mw = (w + e) / 2; const out = []; for (const [a, b, c, dd] of [[s, w, ms, mw], [s, mw, ms, e], [ms, w, n, mw], [ms, mw, n, e]]) out.push(...await photosIn(a, b, c, dd, depth + 1)); return out; }
  return d.map(p => { const g = (p.computed_geometry || p.geometry || {}).coordinates; return g ? { id: p.id, lon: g[0], lat: g[1], hd: p.computed_compass_angle ?? p.compass_angle, t: p.captured_at || 0, pano: !!p.is_pano } : null; }).filter(Boolean);
}
// buildings worth photographing: shops, restaurants, offices, churches, schools, anything named — not houses
const WANT = /^(retail|commercial|office|church|chapel|school|college|university|civic|public|government|hotel|supermarket|kiosk|warehouse|industrial|fire_station|hospital|bank|restaurant|fast_food)$/;
function targetsIn(tx, ty) {
  const f = path.join(root, 'public-data', 'osm', `${tx}_${ty}.json.gz`); if (!fs.existsSync(f)) return [];
  let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); } catch { return []; }
  const nodes = new Map(), pois = [];
  for (const e of j.elements) if (e.type === 'node') { nodes.set(e.id, [e.lon, e.lat]); const t = e.tags; if (t && (t.shop || t.amenity || t.office || t.craft || t.brand || t.tourism || t.healthcare) && t.name) pois.push([e.lon, e.lat, t.name]); }
  const inside = (x, y, g) => { let c = false; for (let i = 0, k = g.length - 1; i < g.length; k = i++) { const [xi, yi] = g[i], [xk, yk] = g[k]; if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) c = !c; } return c; };
  const out = [];
  for (const e of j.elements) {
    if (e.type !== 'way' || !e.tags || !(e.tags.building || e.tags['building:part'])) continue; const t = e.tags, bt = t.building || 'yes';
    const g = e.geometry ? e.geometry.map(p => [p.lon, p.lat]) : (e.nodes || []).map(id => nodes.get(id)).filter(Boolean); if (g.length < 3) continue;
    let area = 0; for (let i = 0, k = g.length - 1; i < g.length; k = i++) area += (g[k][0] - g[i][0]) * M_LON * (g[k][1] + g[i][1]) * M_LAT / 2; area = Math.abs(area);
    if (area < 60) continue;
    const poi = pois.find(p => inside(p[0], p[1], g));
    const housey = /^(house|detached|residential|garage|garages|shed|roof|carport|apartments|static_caravan|semidetached_house|terrace|bungalow)$/.test(bt);
    if (!(poi || t.name || t.shop || t.amenity || t.brand || WANT.test(bt) || (!housey && bt === 'yes' && area > 250))) continue;
    const lon = g.reduce((s, p) => s + p[0], 0) / g.length, lat = g.reduce((s, p) => s + p[1], 0) / g.length;
    let r = 0; for (const p of g) r = Math.max(r, Math.hypot((p[0] - lon) * M_LON, (p[1] - lat) * M_LAT));
    out.push({ id: e.id, name: t.name || (poi && poi[2]) || t.brand || t.shop || t.amenity || bt, lon, lat, r: Math.min(r, 40), ring: g });
  }
  return out;
}
const bearing = (lon0, lat0, lon1, lat1) => (Math.atan2((lon1 - lon0) * M_LON, (lat1 - lat0) * M_LAT) * 180 / Math.PI + 360) % 360;
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const [tx0, ty0] = G.tileOfLL(A[0], A[1]), [tx1, ty1] = G.tileOfLL(A[2], A[3]);
const picksFile = path.join(cache, 'picks.json'); const picks = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, 'utf8')) : {};
let nB = 0, nImg = 0, nNone = 0;
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
  const T = targetsIn(tx, ty).filter(b => b.lat >= A[0] && b.lat <= A[2] && b.lon >= A[1] && b.lon <= A[3]); if (!T.length) continue;
  const mf = path.join(metaDir, `${tx}_${ty}.json`); let photos;
  if (fs.existsSync(mf)) photos = JSON.parse(fs.readFileSync(mf, 'utf8'));
  else { const s = G.LAT0 + ty * G.TLAT, w = G.LON0 + tx * G.TLON; try { photos = await photosIn(s - 0.0005, w - 0.0006, s + G.TLAT + 0.0005, w + G.TLON + 0.0006); } catch (e) { console.log(`square ${tx}_${ty}: ${e.message}`); continue; } fs.writeFileSync(mf, JSON.stringify(photos)); }
  console.log(`square ${tx}_${ty}: ${T.length} buildings, ${photos.length} photos`);
  for (const b of T) {
    if (nB >= LIMIT) break; nB++;
    if (picks[b.id] && picks[b.id].images.every(im => fs.existsSync(path.join(imgDir, im.file)))) { nImg += picks[b.id].images.length; continue; }
    const cand = [];
    for (const p of photos) {
      const d = Math.hypot((p.lon - b.lon) * M_LON, (p.lat - b.lat) * M_LAT) - b.r; if (d < 3 || d > 45) continue; // from the street, not inside it
      const br = bearing(p.lon, p.lat, b.lon, b.lat); const off = p.pano ? 0 : angDiff(p.hd, br); if (!(off < 32)) continue;
      const ageY = (Date.now() - p.t) / 3.15e10; cand.push({ p, score: d + off * 0.5 + Math.min(ageY, 10) * 2.5 + (p.pano ? 6 : 0), d, off, br });
    }
    cand.sort((u, v) => u.score - v.score);
    const chosen = []; for (const c of cand) { if (chosen.some(o => angDiff(o.br, c.br) < 25 && Math.abs(o.d - c.d) < 8)) continue; chosen.push(c); if (chosen.length >= 2) break; } // two different viewpoints
    if (!chosen.length) { nNone++; continue; }
    const images = [];
    for (const [k, c] of chosen.entries()) {
      const file = `${b.id}_${k}.jpg`; const fp = path.join(imgDir, file);
      if (!fs.existsSync(fp)) { try { const j = await getJSON(`https://graph.mapillary.com/${c.p.id}?fields=thumb_1024_url`); const r = await fetch(j.thumb_1024_url); if (!r.ok) continue; fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer())); } catch (e) { continue; } }
      images.push({ file, mly: c.p.id, dist: Math.round(c.d), off: Math.round(c.off), pano: c.p.pano, bearing: Math.round(c.br), year: c.p.t ? new Date(c.p.t).getFullYear() : 0 }); nImg++;
    }
    if (images.length) picks[b.id] = { id: b.id, name: b.name, lat: +b.lat.toFixed(6), lon: +b.lon.toFixed(6), tile: `${tx}_${ty}`, images };
    if (nB % 25 === 0) fs.writeFileSync(picksFile, JSON.stringify(picks));
  }
}
fs.writeFileSync(picksFile, JSON.stringify(picks));
console.log(`Done: ${nB} buildings looked at, ${Object.keys(picks).length} have photos (${nImg} photos), ${nNone} had none facing them. Next: python tools/mapillary-sheets.py`);
