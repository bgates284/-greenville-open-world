// Bridge & overpass profiles for the whole county, from the packed OpenStreetMap squares.
//   node tools/bridges.mjs            → public-data/bridges.json
//
// Why: OSM tags only the span itself as bridge=yes, and the 8–10 m elevation data is smooth enough that the
// embankments leading up to an overpass barely show. Building each bridge way on its own gave short, steep
// humps (and a double hump where one bridge is split into two ways), with the approaches lying flat on the
// ground. Here every group of joined bridge ways is treated as one structure:
//   1. find what it crosses (roads, railways, rivers and streams) and how much clearance each needs;
//   2. spread that height along the road network — over the bridge and out along the approach roads — as a
//      ramp at a steady grade, flattening back to the ground before the first junction on each side;
//   3. store, for every road involved, its lift above the ground every few metres, plus the points where the
//      ramps meet the ground (the game levels the deck between those using its own elevation data).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ORIGIN = { lat: 35.6122, lon: -77.3712 }, MX = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180), MZ = 110574;
const X = lon => (lon - ORIGIN.lon) * MX, Z = lat => -(lat - ORIGIN.lat) * MZ;
const CAR = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'road']);
const FOOT = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'bridleway', 'track']);
const STEP = 4, GRADE_MIN = 0.055, GRADE_MAX = 0.16;

// ---------- load ----------
const ways = new Map(), rails = new Map(), water = new Map();
const dir = path.join(root, 'public-data', 'osm');
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json.gz')) continue;
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))));
  for (const e of d.elements || []) {
    if (e.type !== 'way' || !e.geometry || !e.nodes || e.geometry.length !== e.nodes.length) continue;
    const t = e.tags || {}; const pts = e.geometry.map(g => [X(g.lon), Z(g.lat)]);
    if (t.highway && (CAR.has(t.highway) || FOOT.has(t.highway)) && t.area !== 'yes') { if (!ways.has(e.id)) ways.set(e.id, { id: e.id, t, nodes: e.nodes, pts, car: CAR.has(t.highway) }); }
    else if (/^(rail|light_rail|disused|spur|abandoned)$/.test(t.railway || '') && t.railway !== 'abandoned') rails.set(e.id, { id: e.id, t, nodes: e.nodes, pts });
    else if (/^(river|canal|stream|ditch|drain)$/.test(t.waterway || '')) water.set(e.id, { id: e.id, t, nodes: e.nodes, pts });
  }
}
const isBridge = t => t.bridge && t.bridge !== 'no';
const isTunnel = t => t.tunnel && t.tunnel !== 'no' || (t.layer && +t.layer < 0) || t.covered === 'yes';
const layerOf = t => (t.layer != null && !isNaN(+t.layer)) ? +t.layer : (isBridge(t) ? 1 : 0);
console.log('ways', ways.size, 'rails', rails.size, 'water', water.size);

// node → car ways
const nodeWays = new Map();
for (const w of ways.values()) { if (!w.car) continue; w.nodes.forEach((n, i) => { let a = nodeWays.get(n); if (!a) nodeWays.set(n, a = []); a.push({ w, i }); }); }
const cum = w => { if (w.cum) return w.cum; const c = [0]; for (let i = 1; i < w.pts.length; i++) c.push(c[i - 1] + Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1])); return w.cum = c; };

// ---------- bridge groups (car bridges joined end to end) ----------
const bridges = [...ways.values()].filter(w => w.car && isBridge(w.t) && !isTunnel(w.t));
const parent = new Map(); const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
for (const b of bridges) parent.set(b.id, b.id);
for (const b of bridges) for (const n of b.nodes) for (const { w } of nodeWays.get(n) || []) if (w !== b && parent.has(w.id)) parent.set(find(w.id), find(b.id));
const groups = new Map(); for (const b of bridges) { const r = find(b.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); }

// spatial index of everything a bridge can cross
const CELL = 60, grid = new Map(); const gk = (i, j) => i + ',' + j;
const addSeg = (it) => { const [a, b] = [it.a, it.b]; for (let i = Math.floor(Math.min(a[0], b[0]) / CELL); i <= Math.floor(Math.max(a[0], b[0]) / CELL); i++) for (let j = Math.floor(Math.min(a[1], b[1]) / CELL); j <= Math.floor(Math.max(a[1], b[1]) / CELL); j++) { const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(it); } };
const NEED = { car: 5.6, foot: 3.0, rail: 7.0, river: 4.5, canal: 3.0, stream: 1.6 };
for (const w of ways.values()) { if (isBridge(w.t) || isTunnel(w.t)) continue; for (let i = 0; i < w.pts.length - 1; i++) addSeg({ a: w.pts[i], b: w.pts[i + 1], f: w, need: w.car ? NEED.car : NEED.foot, nodes: new Set(w.nodes) }); }
for (const w of rails.values()) { if (isBridge(w.t) || isTunnel(w.t)) continue; for (let i = 0; i < w.pts.length - 1; i++) addSeg({ a: w.pts[i], b: w.pts[i + 1], f: w, need: NEED.rail, nodes: new Set(w.nodes) }); }
for (const w of water.values()) { if (isTunnel(w.t)) continue; const k = w.t.waterway; for (let i = 0; i < w.pts.length - 1; i++) addSeg({ a: w.pts[i], b: w.pts[i + 1], f: w, need: k === 'river' ? NEED.river : k === 'canal' ? NEED.canal : NEED.stream, nodes: new Set(w.nodes) }); }
const segX = (p1, p2, p3, p4) => { // proper intersection → [t on p1p2, angle sin]
  const d1x = p2[0] - p1[0], d1z = p2[1] - p1[1], d2x = p4[0] - p3[0], d2z = p4[1] - p3[1]; const den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * d2z - (p3[1] - p1[1]) * d2x) / den, u = ((p3[0] - p1[0]) * d1z - (p3[1] - p1[1]) * d1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null; return [t, Math.abs(den) / (Math.hypot(d1x, d1z) * Math.hypot(d2x, d2z))];
};

// is node n a junction (somewhere a ramp must be back on the ground)?
const minor = w => w.t.highway === 'service' && /driveway|parking_aisle|drive-through/.test(w.t.service || '');
const isJunction = (n) => { const a = (nodeWays.get(n) || []).filter(q => !minor(q.w)); if (a.length >= 3) return true; if (a.length === 2) { const ends = a.every(({ w, i }) => i === 0 || i === w.nodes.length - 1); return !ends; } return a.length === 1 && false; };

const out = { v: 1, roads: {}, groups: [] };
let nG = 0, nCross = 0, nRamp = 0;
for (const grp of groups.values()) {
  const ids = new Set(grp.map(w => w.id)), gNodes = new Set(grp.flatMap(w => w.nodes)), lay = Math.max(...grp.map(w => layerOf(w.t)));
  // 1) what it crosses: points along the group's ways with the clearance each needs
  const cross = []; // {w, s, need, flat}
  for (const w of grp) {
    const c = cum(w);
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1], seen = new Set();
      for (let gi = Math.floor(Math.min(a[0], b[0]) / CELL); gi <= Math.floor(Math.max(a[0], b[0]) / CELL); gi++) for (let gj = Math.floor(Math.min(a[1], b[1]) / CELL); gj <= Math.floor(Math.max(a[1], b[1]) / CELL); gj++)
        for (const it of grid.get(gk(gi, gj)) || []) {
          if (seen.has(it) || it.f === w || ids.has(it.f.id)) continue; seen.add(it);
          if (w.nodes.some(n => it.nodes.has(n))) continue;           // connected to it, not crossing over it
          if (layerOf(it.f.t) >= lay && !it.f.t.waterway) continue;     // that one is level with or above us
          const x = segX(a, b, it.a, it.b); if (!x || x[1] < 0.25) continue; // ~>15° crossing
          cross.push({ w, s: c[i] + x[0] * (c[i + 1] - c[i]), need: it.need, flat: (it.f.car ? 7 : it.need >= 7 ? 5 : it.need >= 4 ? 18 : 3) / x[1] });
        }
    }
  }
  nCross += cross.length;
  // a deck is always some way above what it spans: the whole length of every bridge way holds a floor height
  // (a low slab over a creek, a tall viaduct across a floodplain), and the ramps come down from its ends
  for (const w of grp) { const L = cum(w)[w.pts.length - 1]; if (L < 6) continue; cross.push({ w, s: L / 2, need: Math.max(1.2, Math.min(3.5, 0.8 + L / 40)), flat: L / 2 }); }
  if (!cross.length) continue;
  // 2) a graph over the group and its approach roads, out to the first junction (or far enough to reach the ground)
  const maxNeed = Math.max(...cross.map(c => c.need)), reach = maxNeed / GRADE_MIN + Math.max(...cross.map(c => c.flat)) + 40;
  // nodes are [wayId, index] positions; we run Dijkstra over way polylines, measuring distance
  const dist = (src) => { // src: {w, s} → Map(wayId → [{i, d}]) distances to each vertex of reached ways
    const D = new Map(), pq = []; const set = (w, i, d) => { let m = D.get(w.id); if (!m) D.set(w.id, m = { w, d: new Array(w.pts.length).fill(Infinity) }); if (d < m.d[i]) { m.d[i] = d; pq.push([d, w, i]); return true; } return false; };
    const c = cum(src.w); for (let i = 0; i < src.w.pts.length; i++) set(src.w, i, Math.abs(c[i] - src.s));
    while (pq.length) {
      pq.sort((p, q) => q[0] - p[0]); const [d, w, i] = pq.pop(); if (d > D.get(w.id).d[i] || d > reach) continue;
      const n = w.nodes[i]; if (!gNodes.has(n) && isJunction(n) && d > 0) continue; // a junction: the ramp stops here
      const cw = cum(w); for (const j of [i - 1, i + 1]) if (j >= 0 && j < w.pts.length) set(w, j, d + Math.abs(cw[j] - cw[i]));
      for (const { w: o, i: k } of nodeWays.get(n) || []) if (o !== w) set(o, k, d);
    }
    return D;
  };
  const per = cross.map(c => ({ c, D: dist(c) }));
  // grade: steep enough that every ramp is back on the ground at the first junction beyond the bridge
  let grade = GRADE_MIN; const stops = [];
  for (const { c, D } of per) for (const m of D.values()) {
    if (ids.has(m.w.id)) { // the bridge's own ends that are junctions
      for (const i of [0, m.w.pts.length - 1]) { const n = m.w.nodes[i]; const others = (nodeWays.get(n) || []).filter(q => !ids.has(q.w.id)); if (others.length >= 2 || (others.length === 1 && isJunction(n))) { const d = m.d[i] - c.flat; if (d > 1) grade = Math.max(grade, c.need / d); } }
      continue;
    }
    m.w.nodes.forEach((n, i) => { if (m.d[i] < Infinity && isJunction(n) && !gNodes.has(n)) { const d = m.d[i] - c.flat; if (d > 1) grade = Math.max(grade, c.need / d); } });
  }
  grade = Math.min(grade, GRADE_MAX);
  // 3) lift along every reached way, sampled every STEP metres
  const lifts = new Map(); // wayId → {w, L: Float32Array}
  for (const { c, D } of per) for (const m of D.values()) {
    const w = m.w, cw = cum(w), L = cw[w.pts.length - 1], n = Math.max(1, Math.round(L / STEP));
    let e = lifts.get(w.id); if (!e) lifts.set(w.id, e = { w, L: new Float32Array(n + 1), n });
    for (let k = 0; k <= n; k++) { const s = L * k / n; let i = 0; while (i < w.pts.length - 2 && cw[i + 1] < s) i++;
      // distance to the crossing through either end of this segment (or along the same way)
      let d = Math.min(m.d[i] + (s - cw[i]), m.d[i + 1] + (cw[i + 1] - s)); if (w === c.w) d = Math.min(d, Math.abs(s - c.s));
      const lift = c.need - grade * Math.max(0, d - c.flat); if (lift > e.L[k]) e.L[k] = lift; }
  }
  // the points where the ramps meet the ground: the last sample with lift on each reached way end
  const anchors = [];
  for (const e of lifts.values()) { if (ids.has(e.w.id)) continue; const L = cum(e.w)[e.w.pts.length - 1];
    for (let k = 0; k <= e.n; k++) { const up = e.L[k] > 0.02, prevUp = k > 0 && e.L[k - 1] > 0.02, nextUp = k < e.n && e.L[k + 1] > 0.02; if (!up && (prevUp || nextUp)) { const s = L * k / e.n; let i = 0; const cw = cum(e.w); while (i < e.w.pts.length - 2 && cw[i + 1] < s) i++; const t = (s - cw[i]) / ((cw[i + 1] - cw[i]) || 1); anchors.push([e.w.pts[i][0] + (e.w.pts[i + 1][0] - e.w.pts[i][0]) * t, e.w.pts[i][1] + (e.w.pts[i + 1][1] - e.w.pts[i][1]) * t]); } } }
  if (anchors.length < 2) for (const w of grp) for (const i of [0, w.pts.length - 1]) anchors.push(w.pts[i]); // ramps never touched down: use the bridge ends
  const gi = out.groups.length; out.groups.push(anchors.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]));
  for (const e of lifts.values()) { if (!e.L.some(v => v > 0.02)) continue; if (!ids.has(e.w.id)) nRamp++;
    const prev = out.roads[e.w.id]; const arr = [...e.L].map(v => Math.round(Math.max(0, v) * 10));
    if (prev && prev[2] === e.n) { for (let k = 0; k <= e.n; k++) prev[3 + k] = Math.max(prev[3 + k], arr[k]); } // an approach shared by two bridges
    else out.roads[e.w.id] = [gi, ids.has(e.w.id) ? 1 : 0, e.n, ...arr]; }
  nG++;
}
fs.writeFileSync(path.join(root, 'public-data', 'bridges.json'), JSON.stringify(out));
console.log('bridge groups', nG, 'crossings', nCross, 'roads lifted', Object.keys(out.roads).length, 'approach roads', nRamp, 'bytes', fs.statSync(path.join(root, 'public-data', 'bridges.json')).size);
