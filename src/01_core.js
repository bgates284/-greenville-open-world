import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =====================================================================
// CONFIG + PROJECTION
// =====================================================================
const LAT0 = 35.5, LON0 = -77.5, TLAT = 0.01, TLON = 0.012;   // tile grid (~1.1 km squares)
const ORIGIN = { lat: 35.6122, lon: -77.3712 };                 // Uptown Greenville
const MX = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), MZ = 110574;
const lonToX = lon => (lon - ORIGIN.lon) * MX;
const latToZ = lat => -(lat - ORIGIN.lat) * MZ;
const xToLon = x => ORIGIN.lon + x / MX;
const zToLat = z => ORIGIN.lat - z / MZ;
const tileOfLL = (lat, lon) => [Math.floor((lon - LON0) / TLON + 1e-9), Math.floor((lat - LAT0) / TLAT + 1e-9)];
const tileOfXZ = (x, z) => tileOfLL(zToLat(z), xToLon(x));
const tileKey = (tx, ty) => tx + ',' + ty;
function tileBBox(tx, ty) { const w = LON0 + tx * TLON, s = LAT0 + ty * TLAT; return { w, s, e: w + TLON, n: s + TLAT }; }
function tileWorld(tx, ty) { const b = tileBBox(tx, ty); return { x0: lonToX(b.w), x1: lonToX(b.e), z0: latToZ(b.n), z1: latToZ(b.s) }; }
const CITY = { s: 35.53, n: 35.675, w: -77.47, e: -77.28 };  // Greenville city limits + ETJ, Winterville edge, airport, Simpson

const LANDMARKS = [
  ['Pitt-Greenville Airport · your plane', 35.6316, -77.3871],
  ['Town Common · Tar River (open park)', 35.6158, -77.3712],
  ['Uptown · Evans St & 5th St', 35.6117, -77.3718],
  ['ECU · Wright Auditorium', 35.6070, -77.3645],
  ['ECU · Joyner Library', 35.6071, -77.3686],
  ['Dowdy-Ficklen Stadium', 35.5965, -77.3653],
  ['Clark-LeClair Stadium', 35.5934, -77.3673],
  ['ECU Health Medical Center', 35.6075, -77.4031],
  ['Greenville Mall', 35.5863, -77.3680],
  ['Arlington Boulevard', 35.5918, -77.3927],
  ['Greenville Convention Center', 35.5730, -77.3911],
  ['River Park North', 35.6277, -77.3561],
];

const QUALITY = {
  low:    { pr: 0.75, shadows: 0,    bloom: false, trees: 1500, tufts: 0,    traffic: 12, peds: 12, radius: 1, lampLights: 0, canvas: 512,  grid: 40, parked: 80 },
  medium: { pr: 1.0,  shadows: 2048, bloom: true,  trees: 4000, tufts: 3500, traffic: 26, peds: 26, radius: 1, lampLights: 4, canvas: 1024, grid: 64, parked: 200 },
  high:   { pr: 1.5,  shadows: 4096, bloom: true,  trees: 8000, tufts: 8000, traffic: 40, peds: 40, radius: 2, lampLights: 8, canvas: 1024, grid: 96, parked: 350 },
};
let Q = QUALITY.medium;

// =====================================================================
// SMALL UTILITIES
// =====================================================================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashN(n) { let h = Math.imul(n | 0, 2654435761) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
const angleDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

function tileNoise(size, scales, seed) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (const sc of scales) {
    const g = new Float32Array(sc * sc); const r = mulberry32(seed++); for (let i = 0; i < g.length; i++) g[i] = r();
    for (let y = 0; y < size; y++) {
      const fy = y / size * sc, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % sc;
      for (let x = 0; x < size; x++) {
        const fx = x / size * sc, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % sc;
        const a = g[y0 * sc + x0], b = g[y0 * sc + x1], c = g[y1 * sc + x0], d = g[y1 * sc + x1];
        const top = a + (b - a) * sx, bot = c + (d - c) * sx;
        out[y * size + x] += amp * (top + (bot - top) * sy);
      }
    }
    tot += amp; amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

// ---- 2D geometry (points are [x,z]) ----
function signedArea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function centroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
function pointInPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (((a[1] > z) !== (b[1] > z)) && (x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
  }
  return c;
}
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function minAreaRect(pts) {
  const h = convexHull(pts); let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    let ux = b[0] - a[0], uz = b[1] - a[1]; const l = Math.hypot(ux, uz); if (l < 1e-6) continue; ux /= l; uz /= l;
    const vx = -uz, vz = ux; let mnu = 1e9, mxu = -1e9, mnv = 1e9, mxv = -1e9;
    for (const q of h) { const du = q[0] * ux + q[1] * uz, dv = q[0] * vx + q[1] * vz; if (du < mnu) mnu = du; if (du > mxu) mxu = du; if (dv < mnv) mnv = dv; if (dv > mxv) mxv = dv; }
    const area = (mxu - mnu) * (mxv - mnv);
    if (!best || area < best.area) { const cu = (mnu + mxu) / 2, cv = (mnv + mxv) / 2; best = { area, cx: cu * ux + cv * vx, cz: cu * uz + cv * vz, ux, uz, vx, vz, L: mxu - mnu, W: mxv - mnv }; }
  }
  if (best && best.L < best.W) { const b = best; best = { area: b.area, cx: b.cx, cz: b.cz, ux: b.vx, uz: b.vz, vx: -b.ux, vz: -b.uz, L: b.W, W: b.L }; }
  return best;
}
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
  const cx = ax + dx * t, cz = az + dz * t; return { d: Math.hypot(px - cx, pz - cz), t, cx, cz };
}
function joinRings(ways) {
  const eq = (a, b) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  const rest = ways.filter(w => w.length >= 2).map(w => w.slice()); const rings = [];
  while (rest.length) {
    let cur = rest.shift(); let guard = 0;
    while (!eq(cur[0], cur[cur.length - 1]) && guard++ < 5000) {
      const end = cur[cur.length - 1]; let found = -1, rev = false;
      for (let i = 0; i < rest.length; i++) {
        if (eq(rest[i][0], end)) { found = i; break; }
        if (eq(rest[i][rest[i].length - 1], end)) { found = i; rev = true; break; }
      }
      if (found < 0) break;
      let nxt = rest.splice(found, 1)[0]; if (rev) nxt.reverse(); cur = cur.concat(nxt.slice(1));
    }
    if (eq(cur[0], cur[cur.length - 1])) cur.pop();
    if (cur.length >= 3) rings.push(cur);
  }
  return rings;
}

class SpatialHash {
  constructor(cell) { this.c = cell; this.m = new Map(); this.q = 1; }
  insert(item, minx, minz, maxx, maxz) {
    const c = this.c, i0 = Math.floor(minx / c), i1 = Math.floor(maxx / c), j0 = Math.floor(minz / c), j1 = Math.floor(maxz / c);
    const keys = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = (i + 32768) * 65536 + (j + 32768); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(item); keys.push(k);
    }
    item._hk = keys; return item;
  }
  remove(item) {
    if (!item._hk) return;
    for (const k of item._hk) { const a = this.m.get(k); if (!a) continue; const i = a.indexOf(item); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } if (!a.length) this.m.delete(k); }
    item._hk = null;
  }
  query(minx, minz, maxx, maxz, out = []) {
    const c = this.c, i0 = Math.floor(minx / c), i1 = Math.floor(maxx / c), j0 = Math.floor(minz / c), j1 = Math.floor(maxz / c);
    const q = ++this.q;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.m.get((i + 32768) * 65536 + (j + 32768)); if (!a) continue;
      for (const it of a) if (it._q !== q) { it._q = q; out.push(it); }
    }
    return out;
  }
}

// =====================================================================
// STORAGE (IndexedDB) — map data is saved here so it only downloads once
// =====================================================================
const Store = {
  db: null, failed: false,
  open() {
    if (this.db) return Promise.resolve(this.db);
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('greenville-world', 2);
        r.onupgradeneeded = () => { const d = r.result; for (const s of ['osm', 'dem', 'meta', 'models']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => { this.failed = true; rej(r.error); };
      } catch (e) { this.failed = true; rej(e); }
    });
    return this._p;
  },
  async get(s, k) { try { const d = await this.open(); return await new Promise((res, rej) => { const t = d.transaction(s).objectStore(s).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); } catch (e) { return undefined; } },
  async del(s, k) { try { const d = await this.open(); await new Promise(res => { const tx = d.transaction(s, 'readwrite'); tx.objectStore(s).delete(k); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { } },
  async put(s, k, v) { try { const d = await this.open(); await new Promise((res, rej) => { const tx = d.transaction(s, 'readwrite'); tx.objectStore(s).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return true; } catch (e) { console.warn('save failed', e); return false; } },
  async keys(s) { try { const d = await this.open(); return await new Promise((res, rej) => { const t = d.transaction(s).objectStore(s).getAllKeys(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); } catch (e) { return []; } },
  async clear() { try { const d = await this.open(); for (const s of ['osm', 'dem', 'meta']) await new Promise((res) => { const tx = d.transaction(s, 'readwrite'); tx.objectStore(s).clear(); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { } },
};
async function gzip(str) { const s = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip')); return await new Response(s).arrayBuffer(); }
async function gunzip(buf) { const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')); return await new Response(s).text(); }
function bufToB64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function b64ToBuf(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

// =====================================================================
// NETWORK: OpenStreetMap (Overpass API) + terrain elevation tiles
// =====================================================================
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const Net = { epIdx: 0, active: 0, queue: [], max: 2, downloaded: 0, pending: 0, errors: 0 };
function netRun(fn, prio = 0) {
  return new Promise((res, rej) => {
    Net.queue.push({ fn, res, rej, prio, seq: Net.pending++ });
    Net.queue.sort((a, b) => a.prio - b.prio || a.seq - b.seq);
    netPump();
  });
}
function netPump() {
  while (Net.active < Net.max && Net.queue.length) {
    const job = Net.queue.shift(); Net.active++;
    job.fn().then(job.res, job.rej).finally(() => { Net.active--; netPump(); });
  }
}
function overpassQuery(b) {
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  return `[out:json][timeout:120];(` +
    `way["building"](${bb});way["building:part"](${bb});way["highway"](${bb});way["landuse"](${bb});way["leisure"](${bb});` +
    `way["natural"](${bb});way["amenity"](${bb});way["waterway"](${bb});way["railway"](${bb});way["man_made"](${bb});way["barrier"="fence"](${bb});` +
    `relation["type"="multipolygon"](${bb});` +
    `node["natural"="tree"](${bb});node["highway"~"^(traffic_signals|stop|street_lamp|crossing)$"](${bb});` +
    `);out geom;`;
}
async function overpassFetch(q, tries = 10) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ep = OVERPASS[Net.epIdx % OVERPASS.length];
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 170000);
      let r; try { r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal }); } finally { clearTimeout(to); }
      if (r.status === 429 || r.status === 504) { lastErr = new Error('Map server busy (' + r.status + ')'); Net.lastErr = ep.split('/')[2] + ': busy'; Net.errors++; Net.epIdx++; await sleep(Math.min(30000, 4000 * (attempt + 1))); continue; }
      if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.elements)) { if (j.remark && /runtime error|timed out/i.test(j.remark)) throw new Error(j.remark); return j; } }
      lastErr = new Error('Map server replied ' + r.status);
    } catch (e) { lastErr = e; }
    Net.lastErr = (ep.split('/')[2]) + ': ' + (lastErr && lastErr.message || lastErr);
    Net.errors++; Net.epIdx++;
    await sleep(Math.min(15000, 1200 * (attempt + 1)));
  }
  throw lastErr;
}
function compactOSM(j) {
  const r6 = v => Math.round(v * 1e6) / 1e6;
  const geo = g => { const a = new Array(g.length * 2); for (let i = 0; i < g.length; i++) { const p = g[i]; a[2 * i] = p ? r6(p.lat) : null; a[2 * i + 1] = p ? r6(p.lon) : null; } return a; };
  const keep = k => !(k.startsWith('tiger:') || k.startsWith('NHD') || k.startsWith('gnis:') || k.startsWith('addr:') || k.startsWith('source') || k === 'note' || k === 'fixme' || k.startsWith('wikipedia') || k.startsWith('wikidata') || k === 'phone' || k === 'website' || k.startsWith('contact:') || k === 'opening_hours' || k.startsWith('check_date'));
  const els = [];
  for (const e of j.elements) {
    const tags = {}; if (e.tags) for (const k in e.tags) if (keep(k)) tags[k] = e.tags[k];
    if (e.type === 'node') els.push({ t: 'n', id: e.id, tags, la: r6(e.lat), lo: r6(e.lon) });
    else if (e.type === 'way') { if (!e.geometry) continue; const o = { t: 'w', id: e.id, tags, g: geo(e.geometry) }; if (tags.highway && e.nodes) o.nd = e.nodes; els.push(o); }
    else if (e.type === 'relation') { const m = []; for (const mm of e.members || []) if (mm.type === 'way' && mm.geometry) m.push({ r: mm.role, g: geo(mm.geometry) }); if (m.length) els.push({ t: 'r', id: e.id, tags, m }); }
  }
  return { v: 1, els };
}
// A dense map square (Uptown, ECU, the hospital, big shopping centres) can make the map server time out.
// Try it whole a few times; if it keeps failing, fetch it as four quarters and stitch them together.
async function fetchTileOSM(b, depth = 0) {
  try { return await overpassFetch(overpassQuery(b), depth ? 5 : 4); }
  catch (e) {
    if (depth >= 2) throw e;
    const mx = (b.w + b.e) / 2, my = (b.s + b.n) / 2; const seen = new Set(); const els = [];
    for (const q of [{ s: b.s, w: b.w, n: my, e: mx }, { s: b.s, w: mx, n: my, e: b.e }, { s: my, w: b.w, n: b.n, e: mx }, { s: my, w: mx, n: b.n, e: b.e }]) {
      const j = await fetchTileOSM(q, depth + 1);
      for (const el of j.elements) { const k = el.type[0] + el.id; if (!seen.has(k)) { seen.add(k); els.push(el); } }
    }
    return { elements: els };
  }
}
const tileDataP = new Map();
function getTileData(tx, ty, prio = 0) {
  const k = tileKey(tx, ty);
  if (tileDataP.has(k)) return tileDataP.get(k);
  const p = (async () => {
    const buf = await Store.get('osm', k);
    if (buf) { try { return JSON.parse(await gunzip(buf)); } catch (e) { console.warn('bad cache entry', k); } }
    const raw = await netRun(() => window.GV_PROVIDER ? window.GV_PROVIDER.osm(tileBBox(tx, ty), overpassQuery(tileBBox(tx, ty))) : fetchTileOSM(tileBBox(tx, ty)), prio);
    const c = compactOSM(raw);
    try { await Store.put('osm', k, await gzip(JSON.stringify(c))); } catch (e) { }
    Net.downloaded++; UI && UI.cacheDirty && UI.cacheDirty(); try { Overview.fromOSM(k, c); } catch (e) { }
    return c;
  })();
  tileDataP.set(k, p); p.catch(() => tileDataP.delete(k));
  return p;
}
function forgetTileData(k) { tileDataP.delete(k); }

// ---- terrain elevation (Terrarium PNG tiles, zoom 14 ≈ 7.6 m/pixel here) ----
const DEM_Z = 14, DEM_N = 2 ** DEM_Z * 256;
const demTiles = new Map(); const demP = new Map();
let DEM_FALLBACK = 12;
const lonToPX = lon => (lon + 180) / 360 * DEM_N;
const latToPY = lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * DEM_N; };
function loadDEM(x, y, prio = 0) {
  const k = x + ',' + y; if (demP.has(k)) return demP.get(k);
  const p = (async () => {
    let arr = await Store.get('dem', k);
    if (!arr) {
      try {
        if (window.GV_PROVIDER) arr = await window.GV_PROVIDER.dem(DEM_Z, x, y);
        else arr = await netRun(async () => {
          const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEM_Z}/${x}/${y}.png`, { mode: 'cors' });
          if (!r.ok) throw new Error('elevation ' + r.status);
          const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
          const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, 256, 256).data; const out = new Float32Array(65536);
          for (let i = 0; i < 65536; i++) out[i] = d[4 * i] * 256 + d[4 * i + 1] + d[4 * i + 2] / 256 - 32768;
          return out;
        }, prio);
        if (arr) await Store.put('dem', k, arr);
      } catch (e) { console.warn('elevation unavailable, using flat ground here', e); arr = null; }
    }
    if (arr) demTiles.set(k, arr);
    return arr;
  })();
  demP.set(k, p); return p;
}
function demTilesForBBox(b) {
  const out = []; const x0 = Math.floor(lonToPX(b.w - 0.002) / 256), x1 = Math.floor(lonToPX(b.e + 0.002) / 256), y0 = Math.floor(latToPY(b.n + 0.002) / 256), y1 = Math.floor(latToPY(b.s - 0.002) / 256);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]); return out;
}
function ensureDEM(b, prio = 0) { return Promise.all(demTilesForBBox(b).map(([x, y]) => loadDEM(x, y, prio))); }
let _dk = '', _dt = null;
function demAt(ix, iy) {
  const k = (ix >> 8) + ',' + (iy >> 8);
  if (k !== _dk) { _dk = k; _dt = demTiles.get(k) || null; }
  return _dt ? _dt[(iy & 255) * 256 + (ix & 255)] : DEM_FALLBACK;
}
function H(x, z) {
  const px = lonToPX(xToLon(x)) - 0.5, py = latToPY(zToLat(z)) - 0.5;
  const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
  const a = demAt(ix, iy), b = demAt(ix + 1, iy), c = demAt(ix, iy + 1), d = demAt(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
