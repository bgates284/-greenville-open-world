
// =====================================================================
// WORLD REGISTRIES (roads graph, collision, names)
// =====================================================================
const RC = {
  motorway: { w: 11, v: 29, rank: 9 }, motorway_link: { w: 5.5, v: 17, rank: 4 },
  trunk: { w: 13, v: 24.6, rank: 8 }, trunk_link: { w: 5.5, v: 15.6, rank: 4 },
  primary: { w: 13, v: 20.1, rank: 7 }, primary_link: { w: 5.5, v: 13, rank: 4 },
  secondary: { w: 10, v: 17.9, rank: 6 }, secondary_link: { w: 5.5, v: 13, rank: 4 },
  tertiary: { w: 8.5, v: 15.6, rank: 5 }, tertiary_link: { w: 5.5, v: 11, rank: 4 },
  unclassified: { w: 6.5, v: 13.4, rank: 3 }, residential: { w: 7, v: 11.2, rank: 3 },
  living_street: { w: 5.5, v: 6.7, rank: 2 }, service: { w: 4.6, v: 6.7, rank: 1 }, road: { w: 6, v: 11, rank: 2 },
};
const WALK = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'bridleway', 'corridor', 'track']);
const AI_CAR = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street']);
const PED_OK = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'living_street', 'residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'service', 'track', 'tertiary_link', 'secondary_link', 'primary_link']);

const World = {
  roads: new Map(), nodeAdj: new Map(),
  segHash: new SpatialHash(30), bridgeHash: new SpatialHash(30),
  bldHash: new SpatialHash(20), obsHash: new SpatialHash(12), mmHash: new SpatialHash(150),
  deckHash: new SpatialHash(20), // raised walkable surfaces: porches, plinths, steps  ({poly, top})
  signals: new Map(), stops: new Set(), areas: [],
};
function parseLen(v) { if (v == null) return NaN; const m = String(v).match(/-?[\d.]+/); if (!m) return NaN; let n = parseFloat(m[0]); if (/ft|'/.test(v)) n *= 0.3048; return n; }
function parseSpeed(v) { if (!v) return 0; const n = parseFloat(v); if (!n) return 0; return /mph/.test(v) ? n * 0.447 : n / 3.6; }

function roadInfo(tags) {
  const hw = tags.highway; const base = RC[hw];
  if (!base) return null;
  let oneway = 0; const ow = tags.oneway;
  if (ow === 'yes' || ow === 'true' || ow === '1') oneway = 1; else if (ow === '-1' || ow === 'reverse') oneway = -1;
  if ((hw === 'motorway' || hw.endsWith('_link') && hw.startsWith('motorway')) && ow !== 'no') oneway = oneway || 1;
  if (tags.junction === 'roundabout' || tags.junction === 'circular') oneway = oneway || 1;
  let lanes = parseInt(tags.lanes) || 0;
  let w = parseLen(tags.width);
  if (!(w > 2)) {
    if (lanes) w = lanes * 3.35 + (lanes >= 3 ? 1.2 : 0.8);
    else if (hw === 'primary' || hw === 'trunk') w = oneway ? 8 : 13;
    else if (hw === 'service') w = tags.service === 'alley' ? 3.8 : 4.6;
    else w = oneway && base.rank < 5 ? Math.min(base.w, 5.5) : base.w;
  }
  if (!lanes) lanes = w > 11 ? 4 : w > 7.8 ? 2 : oneway && w > 7 ? 2 : oneway ? 1 : 2;
  let kind = 'plain';
  if (oneway) kind = hw === 'motorway' || hw === 'trunk' ? 'highway' : lanes >= 2 ? 'oneway' : 'plain';
  else if (lanes >= 4) kind = 'multi';
  else if (base.rank >= 5) kind = 'two';
  const v = parseSpeed(tags.maxspeed) || base.v;
  let sidewalk = tags.sidewalk || tags['sidewalk:both'] ? (tags.sidewalk || 'both') : null;
  if (!sidewalk && (tags['sidewalk:left'] === 'yes' || tags['sidewalk:right'] === 'yes')) sidewalk = tags['sidewalk:left'] === 'yes' ? (tags['sidewalk:right'] === 'yes' ? 'both' : 'left') : 'right';
  if (!sidewalk && base.rank >= 5 && base.rank <= 7 && !oneway && !hw.endsWith('_link')) sidewalk = 'both';
  if (sidewalk === 'yes') sidewalk = 'both';
  if (sidewalk === 'no' || sidewalk === 'none' || sidewalk === 'separate') sidewalk = null;
  return { hw, w, oneway, lanes, kind, v, rank: base.rank, sidewalk };
}

// ---------- height queries ----------
function deckHeight(road, i, t) { const s = road.cum[i] + t * (road.cum[i + 1] - road.cum[i]); return road.deckAt(s); }
function surfaceY(x, z, yRef) {
  let y = H(x, z); { const a = Airport.surf(x, z); if (a !== null) y = a; }
  const items = World.bridgeHash.query(x - 8, z - 8, x + 8, z + 8);
  for (const it of items) {
    const r = it.road, a = r.pts[it.i], b = r.pts[it.i + 1];
    const sd = segDist(x, z, a[0], a[1], b[0], b[1]);
    if (sd.d > r.w / 2 + 0.6) continue;
    const dy = deckHeight(r, it.i, sd.t) + 0.08;
    if (yRef === undefined || dy <= yRef + 1.4) y = Math.max(y, dy);
  }
  return y;
}
function nearestRoad(x, z, maxD, filter) {
  const items = World.segHash.query(x - maxD, z - maxD, x + maxD, z + maxD);
  let best = null, bd = maxD;
  for (const it of items) {
    const r = it.road; if (filter && !filter(r)) continue;
    const a = r.pts[it.i], b = r.pts[it.i + 1]; const sd = segDist(x, z, a[0], a[1], b[0], b[1]);
    if (sd.d < bd) { bd = sd.d; best = { road: r, i: it.i, t: sd.t, d: sd.d, x: sd.cx, z: sd.cz }; }
  }
  return best;
}
function onRoadSurface(x, z) { const n = nearestRoad(x, z, 12, r => r.mesh); return n && n.d < n.road.w / 2 + 0.2 ? n : null; }
function insideBuilding(x, z) {
  for (const b of World.bldHash.query(x, z, x, z)) if (b.minY < 3 && pointInPoly(x, z, b.ring)) { let inHole = false; for (const h of b.holes) if (pointInPoly(x, z, h)) inHole = true; if (!inHole) return b; }
  return null;
}
function ejectPoint(x, z, b, pad) { // nearest point just outside building b
  let best = null, bd = 1e9;
  for (const ring of [b.ring, ...b.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const sd = segDist(x, z, ring[j][0], ring[j][1], ring[i][0], ring[i][1]); if (sd.d < bd) { bd = sd.d; best = sd; } }
  if (!best) return [x, z]; let dx = best.cx - x, dz = best.cz - z; const l = Math.hypot(dx, dz) || 1; return [best.cx + dx / l * pad, best.cz + dz / l * pad];
}
function freeSpot(x, z, ax, az) { // nearest open ground (not inside a building or obstacle), searching outward
  const ok = (px, pz) => !insideBuilding(px, pz) && !World.obsHash.query(px - .5, pz - .5, px + .5, pz + .5).some(o => Math.hypot(o.x - px, o.z - pz) < o.r + 0.45) && Math.hypot(px - (ax ?? 1e9), pz - (az ?? 1e9)) > 1.6;
  if (ok(x, z)) return [x, z];
  for (let rad = 0.8; rad < 40; rad += 0.8) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (ok(px, pz)) return [px, pz]; }
  return [x, z];
}
function classAt(x, z) {
  const [tx, ty] = tileOfXZ(x, z); const T = Tiles.map.get(tileKey(tx, ty)); if (!T || !T.treeR) return 0;
  const W = T.W; const u = Math.floor((x - W.x0) / (W.x1 - W.x0) * 512), v = Math.floor((z - W.z0) / (W.z1 - W.z0) * 512);
  if (u < 0 || v < 0 || u > 511 || v > 511) return 0; return T.treeR[v * 512 + u];
}
// things a car can knock over: the obstacle circle remembers which instance(s) draw it (see 07d_phys.js)
function knockable(T, o, k) { k.T = T; k.key = T.key; (k.obs = k.obs || []).push(o); o.k = k; return o; }
// push a circle out of buildings / obstacles. returns {x,z,hit,nx,nz}
function collideCircle(x, z, r, y, withObs = true) {
  let hit = false, nx = 0, nz = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of World.bldHash.query(x - r, z - r, x + r, z + r)) {
      if (y !== undefined && (y > b.maxY - 0.3 || y + 1.6 < b.minY)) continue;
      const rings = b.holes.length ? [b.ring, ...b.holes] : [b.ring];
      for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], c = ring[i];
        if (Math.max(a[0], c[0]) < x - r || Math.min(a[0], c[0]) > x + r || Math.max(a[1], c[1]) < z - r || Math.min(a[1], c[1]) > z + r) continue;
        const sd = segDist(x, z, a[0], a[1], c[0], c[1]);
        if (sd.d < r) {
          let ex = x - sd.cx, ez = z - sd.cz, l = Math.hypot(ex, ez);
          if (l < 1e-4) { ex = -(c[1] - a[1]); ez = c[0] - a[0]; l = Math.hypot(ex, ez) || 1; }
          ex /= l; ez /= l; x += ex * (r - sd.d); z += ez * (r - sd.d); hit = true; nx = ex; nz = ez;
        }
      }
    }
    if (withObs) for (const o of World.obsHash.query(x - r, z - r, x + r, z + r)) {
      if (o.dead) continue; // knocked over (07d_phys.js)
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
      if (d < m && d > 1e-4) { x += dx / d * (m - d); z += dz / d * (m - d); hit = true; nx = dx / d; nz = dz / d; }
    }
  }
  return { x, z, hit, nx, nz };
}

// =====================================================================
// PARSE A TILE
// =====================================================================
function areaKind(t) {
  if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin' || t.water || t.leisure === 'swimming_pool') return 'water';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (t.natural === 'wetland') return 'wetland';
  if (t.natural === 'scrub' || t.natural === 'heath') return 'scrub';
  if (t.natural === 'sand' || t.natural === 'beach' || t.leisure === 'beach_resort') return 'sand';
  if (t.leisure === 'pitch') return (/tennis|basketball/.test(t.sport || '') || /asphalt|concrete|hard|paved/.test(t.surface || '')) ? 'court' : 'pitch';
  if (t.leisure === 'track') return 'track';
  if (t.leisure === 'golf_course') return 'golf';
  if (t.leisure === 'stadium' || t.leisure === 'sports_centre') return 'park';
  if (/^(park|garden|playground|recreation_ground|dog_park|nature_reserve)$/.test(t.leisure || '') || t.landuse === 'recreation_ground' || t.landuse === 'village_green') return 'park';
  if (t.amenity === 'parking' || t.landuse === 'garages' || t.amenity === 'fuel' || t.amenity === 'parking_space') return 'parking';
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return 'cemetery';
  if (/^(grass|meadow|greenfield|flowerbed)$/.test(t.landuse || '') || t.natural === 'grassland') return 'grass';
  if (/^(farmland|farmyard|orchard|vineyard|plant_nursery)$/.test(t.landuse || '')) return 'farmland';
  if (t.landuse === 'residential') return 'residential';
  if (t.landuse === 'commercial' || t.landuse === 'retail') return 'commercial';
  if (/^(industrial|railway|construction|brownfield|landfill|quarry)$/.test(t.landuse || '') || t.man_made === 'wastewater_plant' || t.power === 'substation') return 'industrial';
  if (/^(university|college|school|hospital|kindergarten)$/.test(t.amenity || '')) return 'institution';
  if (t.highway === 'pedestrian' || t.place === 'square' || t.amenity === 'marketplace') return 'paved';
  return null;
}
function parseTile(data, tx, ty) {
  const bb = tileBBox(tx, ty);
  const inTile = (lat, lon) => lat >= bb.s && lat < bb.n && lon >= bb.w && lon < bb.e;
  const PT = g => { const pts = []; for (let i = 0; i < g.length; i += 2) { if (g[i] == null) continue; pts.push([lonToX(g[i + 1]), latToZ(g[i])]); } return pts; };
  const P = { buildings: [], roads: [], areas: [], lines: [], trees: [], signals: [], stops: [], lamps: [], crossings: [], treeRows: [], fences: [] };
  for (const e of data.els) {
    const t = e.tags || {};
    if (e.t === 'n') {
      if (!inTile(e.la, e.lo)) continue;
      const x = lonToX(e.lo), z = latToZ(e.la);
      if (t.natural === 'tree') P.trees.push([x, z]);
      else if (t.highway === 'traffic_signals') P.signals.push({ id: e.id, x, z });
      else if (t.highway === 'stop') P.stops.push({ id: e.id, x, z });
      else if (t.highway === 'street_lamp') P.lamps.push([x, z]);
      else if (t.highway === 'crossing' && t.crossing !== 'unmarked' && t.crossing !== 'no') P.crossings.push({ id: e.id, x, z });
      continue;
    }
    if (e.t === 'w') {
      const g = e.g; if (!g || g.length < 4) continue;
      const closed = g.length >= 8 && g[0] === g[g.length - 2] && g[1] === g[g.length - 1];
      const pts = PT(g); if (pts.length < 2) continue;
      if ((t.building && t.building !== 'no') || t['building:part']) {
        if (!closed || pts.length < 4) continue;
        let la = 0, lo = 0, n = 0; for (let i = 0; i < g.length - 2; i += 2) { la += g[i]; lo += g[i + 1]; n++; }
        if (inTile(la / n, lo / n)) P.buildings.push({ id: e.id, tags: t, ring: pts.slice(0, -1), holes: [], part: !!t['building:part'] && !t.building });
        continue;
      }
      if (t.highway) {
        if (t.area === 'yes' && closed) { P.areas.push({ kind: 'paved', rings: [pts.slice(0, -1)], holes: [], tags: t }); continue; }
        const mi = Math.floor((g.length / 2 - 1) / 2) * 2; const own = inTile(g[mi], g[mi + 1]);
        if (e.nd && e.nd.length === pts.length) P.roads.push({ id: e.id, tags: t, nodes: e.nd, pts, own });
        continue;
      }
      if (t.railway === 'rail' || t.railway === 'light_rail' || t.railway === 'disused' || t.railway === 'spur') { if (t.tunnel !== 'yes') P.lines.push({ kind: 'rail', pts, bridge: t.bridge === 'yes' || t.bridge === 'viaduct', service: t.service || '' }); }
      if (t.waterway && !closed && t.tunnel !== 'culvert' && t.tunnel !== 'yes') P.lines.push({ kind: 'water', pts, w: t.waterway === 'river' ? 30 : t.waterway === 'canal' ? 8 : t.waterway === 'stream' ? 3.5 : 2.2 });
      if (t.natural === 'tree_row') P.treeRows.push(pts);
      if (t.barrier === 'fence' && !closed) P.fences.push(pts);
      const kind = areaKind(t);
      if (kind && closed) P.areas.push({ kind, rings: [pts.slice(0, -1)], holes: [], tags: t, name: t.name });
      continue;
    }
    if (e.t === 'r') {
      const outers = [], inners = [];
      for (const m of e.m) (m.r === 'inner' ? inners : outers).push(PT(m.g));
      if (t.building && t.building !== 'no') {
        const or = joinRings(outers), ir = joinRings(inners);
        for (const ring of or) {
          const c = centroid(ring); if (!inTile(zToLat(c[1]), xToLon(c[0]))) continue;
          P.buildings.push({ id: e.id, tags: t, ring, holes: ir.filter(h => pointInPoly(h[0][0], h[0][1], ring)), part: false });
        }
        continue;
      }
      const kind = areaKind(t);
      if (kind) P.areas.push({ kind, rings: joinRings(outers), holes: joinRings(inners), tags: t, name: t.name });
    }
  }
  // junction degree for road nodes (from every road in the tile's data)
  P.deg = new Map();
  for (const r of P.roads) {
    if (!RC[r.tags.highway]) continue;
    for (let i = 0; i < r.nodes.length; i++) { const id = r.nodes[i]; P.deg.set(id, (P.deg.get(id) || 0) + ((i === 0 || i === r.nodes.length - 1) ? 1 : 2)); }
  }
  // building:part handling — if a building outline has parts inside, the parts replace it
  const parts = P.buildings.filter(b => b.part);
  if (parts.length) {
    for (const b of P.buildings) if (!b.part) { const hasPart = parts.some(p => { const c = centroid(p.ring); return pointInPoly(c[0], c[1], b.ring); }); if (hasPart) b.skip = true; }
  }
  return P;
}

// =====================================================================
// TILE BUILDER
// =====================================================================
let _yieldT = 0;
async function yieldMaybe(force) { if (force || performance.now() - _yieldT > 10) { await new Promise(r => setTimeout(r, 0)); _yieldT = performance.now(); } }

const AREA_STYLE = {
  residential: { c: '#62853b', cls: 80, p: 1 }, institution: { c: '#688f42', cls: 240, p: 2 }, commercial: { c: '#6f7e57', cls: 215, p: 2 },
  industrial: { c: '#77796a', cls: 225, p: 2 }, farmland: { c: '#7d7a4c', cls: 200, p: 3 }, grass: { c: '#6a9143', cls: 120, p: 4 },
  cemetery: { c: '#5d8a40', cls: 120, p: 4 }, golf: { c: '#5c9a3e', cls: 120, p: 4 }, park: { c: '#5e9040', cls: 120, p: 5 },
  scrub: { c: '#5d6e3a', cls: 160, p: 5 }, wetland: { c: '#4b6040', cls: 160, p: 6 }, forest: { c: '#465a2c', cls: 160, p: 6 },
  sand: { c: '#d6c8a0', cls: 0, p: 7 }, pitch: { c: '#4d9a3a', cls: 0, p: 8 }, court: { c: '#3d6f8c', cls: 0, p: 8 }, track: { c: '#a4533c', cls: 0, p: 8 },
  parking: { c: '#4b4c4f', cls: 0, p: 9 }, paved: { c: '#a9a59b', cls: 0, p: 9 }, water: { c: '#34463d', cls: 0, p: 10 },
};
const CLS_VALUES = [40, 80, 120, 160, 200, 215, 225, 240];
function decodeCls(v) { if (v < 20) return 0; let best = 40, bd = 999; for (const c of CLS_VALUES) { const d = Math.abs(c - v); if (d < bd) { bd = d; best = c; } } return best; }

function ringsPath(g, rings, holes) {
  g.beginPath();
  for (const r of [...rings, ...(holes || [])]) { if (r.length < 3) continue; g.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) g.lineTo(r[i][0], r[i][1]); g.closePath(); }
}
function linePath(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); }

function paintTerrain(T, P) {
  const W = T.W, S = Q.canvas, sx = W.x1 - W.x0, sz = W.z1 - W.z0;
  const c = cnv(S, S), g = c.getContext('2d');
  const rc = cnv(256, 256), rg = rc.getContext('2d');
  const kc = cnv(512, 512), kg = kc.getContext('2d', { willReadFrequently: true });
  const setT = (ctx, s) => ctx.setTransform(s / sx, 0, 0, s / sz, -W.x0 * s / sx, -W.z0 * s / sz);
  // base ground: the real aerial photo when we have it (03k_realdata.js), else lawn / fields
  const AER = !!T.aerial; T.aerialUsed = AER; const r = mulberry32(T.tx * 7919 + T.ty * 104729);
  if (AER) { g.filter = 'saturate(1.1) contrast(1.05) brightness(1.12)'; g.drawImage(T.aerial, 0, 0, S, S); g.filter = 'none'; }
  else g.fillStyle = '#5f7f3a', g.fillRect(0, 0, S, S);
  if (!AER) for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = (8 + r() * 60) * S / 1024;
    const col = pick(['rgba(110,140,66,.30)', 'rgba(84,112,52,.30)', 'rgba(128,132,72,.22)', 'rgba(70,98,44,.28)', 'rgba(140,128,86,.14)'], r());
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  rg.fillStyle = '#fff'; rg.fillRect(0, 0, 256, 256);
  kg.fillStyle = 'rgb(40,40,40)'; kg.fillRect(0, 0, 512, 512);
  setT(g, S); setT(rg, 256); setT(kg, 512);
  const areas = P.areas.slice().sort((a, b) => AREA_STYLE[a.kind].p - AREA_STYLE[b.kind].p);
  for (const a of areas) { try { paintArea(a); } catch (e) { } }
  function paintArea(a) {
    const st = AREA_STYLE[a.kind];
    if (AER) { // the photo already shows it; only the masks (water, tree classes) are needed
      if (a.kind === 'water') { ringsPath(rg, a.rings, a.holes); rg.fillStyle = '#000'; rg.fill('evenodd'); }
      ringsPath(kg, a.rings, a.holes); kg.fillStyle = `rgb(${st.cls},${st.cls},${st.cls})`; kg.fill('evenodd'); return;
    }
    ringsPath(g, a.rings, a.holes); g.fillStyle = st.c; g.fill('evenodd');
    if (a.kind === 'farmland') { g.save(); ringsPath(g, a.rings, a.holes); g.clip('evenodd'); g.strokeStyle = 'rgba(70,90,40,.45)'; g.lineWidth = 1.2; const bb = a.rings[0].reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]); for (let x = bb[0]; x < bb[2]; x += 2.5) { g.beginPath(); g.moveTo(x, bb[1]); g.lineTo(x, bb[3]); g.stroke(); } g.restore(); }
    if (a.kind === 'pitch' || a.kind === 'court') { g.strokeStyle = 'rgba(240,240,240,.8)'; g.lineWidth = 0.25; ringsPath(g, a.rings); g.stroke(); }
    if (a.kind === 'parking') { g.strokeStyle = 'rgba(210,210,200,.5)'; g.lineWidth = 0.3; ringsPath(g, a.rings); g.stroke(); }
    if (a.kind === 'forest') { g.save(); ringsPath(g, a.rings, a.holes); g.clip('evenodd'); for (let i = 0; i < 80; i++) { const p = a.rings[0][Math.floor(r() * a.rings[0].length)]; g.fillStyle = 'rgba(92,72,44,.25)'; g.beginPath(); g.arc(p[0] + (r() - .5) * 60, p[1] + (r() - .5) * 60, 4 + r() * 10, 0, 7); g.fill(); } g.restore(); }
    if (a.kind === 'water') { ringsPath(rg, a.rings, a.holes); rg.fillStyle = '#000'; rg.fill('evenodd'); }
    ringsPath(kg, a.rings, a.holes); const cv = st.cls; kg.fillStyle = `rgb(${cv},${cv},${cv})`; kg.fill('evenodd');
  }
  // residential lots from the county parcels: mown lawns
  if (T.lawns && !AER) { g.fillStyle = 'rgba(112,150,64,.32)'; for (const L of T.lawns) { ringsPath(g, [L]); g.fill(); } }
  // snapshot landuse classes (before blocking)
  const lu = kg.getImageData(0, 0, 512, 512).data; T.luR = new Uint8Array(512 * 512); for (let i = 0; i < T.luR.length; i++) T.luR[i] = lu[i * 4];
  // lines: streams, rails (with a photo underneath these only go into the masks)
  g.globalAlpha = AER ? 0 : 1;
  for (const L of P.lines) {
    if (L.kind === 'water') { linePath(g, L.pts); g.strokeStyle = '#34463d'; g.lineWidth = L.w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); linePath(rg, L.pts); rg.strokeStyle = '#000'; rg.lineWidth = L.w * 0.8; rg.stroke(); linePath(kg, L.pts); kg.strokeStyle = '#000'; kg.lineWidth = L.w + 3; kg.stroke(); }
    if (L.kind === 'rail') {
      linePath(g, L.pts); g.lineCap = 'butt'; g.strokeStyle = '#6d675e'; g.lineWidth = 3.4; g.stroke();
      g.setLineDash([0.25, 0.45]); g.strokeStyle = '#4a3a2c'; g.lineWidth = 2.6; g.stroke(); g.setLineDash([]);
      for (const off of [-0.72, 0.72]) { const o = offsetLine(L.pts, off); linePath(g, o); g.strokeStyle = '#8b8680'; g.lineWidth = 0.14; g.stroke(); }
      linePath(kg, L.pts); kg.strokeStyle = '#000'; kg.lineWidth = 6; kg.stroke();
    }
  }
  // roads painted underneath meshes + paths/driveways that are only painted
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const rd of P.roads) {
    const hw = rd.tags.highway; const info = RC[hw] ? roadInfo(rd.tags) : null;
    if (rd.tags.tunnel === 'yes' || rd.tags.tunnel === 'building_passage') continue;
    if (info) {
      g.globalAlpha = AER ? 0 : 1;
      const paintOnly = hw === 'service' && /parking_aisle|driveway|drive-through/.test(rd.tags.service || '');
      linePath(g, rd.pts); g.strokeStyle = paintOnly && rd.tags.service === 'driveway' ? '#a8a49b' : '#3d3e41'; g.lineWidth = paintOnly ? (rd.tags.service === 'driveway' ? 3.2 : 5.5) : info.w + 0.8; g.stroke();
      linePath(kg, rd.pts); kg.strokeStyle = '#000'; kg.lineWidth = info.w + (paintOnly ? 1.5 : 5); kg.stroke();
    } else if (WALK.has(hw)) {
      const unpaved = hw === 'path' || hw === 'track' || /dirt|ground|gravel|unpaved|grass/.test(rd.tags.surface || '');
      const w = hw === 'track' ? 3 : hw === 'pedestrian' ? 5 : hw === 'cycleway' ? 2.5 : 1.8;
      g.globalAlpha = AER ? 0.4 : 1; linePath(g, rd.pts); g.strokeStyle = unpaved ? '#8f8163' : '#b3afa5'; g.lineWidth = w; g.stroke();
      linePath(kg, rd.pts); kg.strokeStyle = '#000'; kg.lineWidth = w + 1; kg.stroke();
    }
  }
  g.globalAlpha = 1;
  try { Airport.paint(AER ? null : g, kg); } catch (e) { }
  try { paintLandmarkGround(g, P); } catch (e) { }
  // driveways to houses built from parcel records
  if (T.driveways) for (const d of T.driveways) { linePath(g, d); g.lineCap = 'butt'; g.strokeStyle = '#aaa69c'; g.lineWidth = 3.0; g.stroke(); linePath(kg, d); kg.strokeStyle = '#000'; kg.lineWidth = 4.5; kg.stroke(); }
  // building footprints block trees, slightly darker ground around them
  for (const b of P.buildings) { ringsPath(kg, [b.ring]); kg.fillStyle = '#000'; kg.fill(); kg.strokeStyle = '#000'; kg.lineWidth = 4; kg.stroke(); if (!AER) { ringsPath(g, [b.ring]); g.strokeStyle = 'rgba(40,50,30,.35)'; g.lineWidth = 1.2; g.stroke(); } }
  const tr = kg.getImageData(0, 0, 512, 512).data; T.treeR = new Uint8Array(512 * 512); for (let i = 0; i < T.treeR.length; i++) T.treeR[i] = tr[i * 4];
  T.tex = ctex(c, { wrap: false }); T.tex.wrapS = T.tex.wrapT = THREE.ClampToEdgeWrapping; T.tex.flipY = false;
  T.rtex = new THREE.CanvasTexture(rc); T.rtex.flipY = false; T.rtex.wrapS = T.rtex.wrapT = THREE.ClampToEdgeWrapping;
}
function offsetLine(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push([pts[i][0] - dz * off, pts[i][1] + dx * off]);
  }
  return out;
}

function buildTerrainMesh(T) {
  const W = T.W, N = TGRID; // must match H() in 01_core.js
  const pos = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * (N + 1) + i, x = W.x0 + (W.x1 - W.x0) * i / N, z = W.z0 + (W.z1 - W.z0) * j / N;
    pos[3 * k] = x; pos[3 * k + 1] = Hraw(x, z); pos[3 * k + 2] = z; uv[2 * k] = i / N; uv[2 * k + 1] = j / N;
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * (N + 1) + i, b = a + N + 1, c = a + 1, d = b + 1; idx.push(a, b, c, c, b, d);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: T.tex, roughnessMap: T.rtex, roughness: 1, metalness: 0 }); terrainPatch(mat);
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; T.group.add(m); T.terrainMat = mat;
}

// ---------- mesh builder helpers ----------
class MB { // mesh bucket: positions, uvs, optional colors
  constructor(color = false) { this.p = []; this.u = []; this.c = color ? [] : null; }
  tri(a, b, c, ua, ub, uc, n, col) {
    if (n) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx; if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { let t = b; b = c; c = t; t = ub; ub = uc; uc = t; } }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    if (this.c) this.c.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
  }
  quad(a, b, c, d, ua, ub, uc, ud, n, col) { this.tri(a, b, c, ua, ub, uc, n, col); this.tri(a, c, d, ua, uc, ud, n, col); }
  geo(normals = true) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (normals) g.computeVertexNormals(); return g;
  }
}
const UPN = [0, 1, 0];

function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1], 0]]; let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, s + L * k / n]);
    s += L;
  }
  return out;
}
// strip along a resampled polyline; center offset c (to the right), width w
function strip(mb, R, c, w, yAt, vScale, skirt, i0 = 0, i1 = R.length - 1) {
  if (i1 - i0 < 1) return;
  const L = [], Rr = [];
  for (let i = i0; i <= i1; i++) {
    const p = R[i], a = R[Math.max(i0, i - 1)], b = R[Math.min(i1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let sx = -tz, sz = tx; // right side
    let k = 1;
    if (i > i0 && i < i1) { // miter
      const a2 = R[i - 1], b2 = R[i + 1]; let d1x = p[0] - a2[0], d1z = p[1] - a2[1]; const l1 = Math.hypot(d1x, d1z) || 1; d1x /= l1; d1z /= l1;
      const n1x = -d1z, n1z = d1x; k = 1 / Math.max(0.5, sx * n1x + sz * n1z);
    }
    const y = yAt(p, i);
    L.push([p[0] + sx * (c - w / 2) * k, y, p[1] + sz * (c - w / 2) * k, p[2], sx, sz]);
    Rr.push([p[0] + sx * (c + w / 2) * k, y, p[1] + sz * (c + w / 2) * k, p[2], sx, sz]);
  }
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i], b = Rr[i], c2 = Rr[i + 1], d = L[i + 1];
    const va = a[3] * vScale, vd = d[3] * vScale;
    mb.quad(a, b, c2, d, [0, va], [1, va], [1, vd], [0, vd], UPN);
    if (skirt) {
      for (const [E, u, sgn] of [[L, 0, -1], [Rr, 1, 1]]) {
        const e0 = E[i], e1 = E[i + 1];
        const drop = typeof skirt === 'number' ? skirt : 0;
        const b0 = [e0[0] + e0[4] * sgn * 0.25, drop ? e0[1] - drop : H(e0[0], e0[2]) - 0.15, e0[2] + e0[5] * sgn * 0.25];
        const b1 = [e1[0] + e1[4] * sgn * 0.25, drop ? e1[1] - drop : H(e1[0], e1[2]) - 0.15, e1[2] + e1[5] * sgn * 0.25];
        mb.quad(e0, e1, b1, b0, [u, va], [u, vd], [u, vd], [u, va], [e0[4] * sgn, 0.3, e0[5] * sgn]);
      }
    }
  }
}

function registerRoads(T, P) {
  T.roadIds = [];
  for (const rd of P.roads) {
    if (!rd.own) continue;
    const hw = rd.tags.highway; const info = RC[hw] ? roadInfo(rd.tags) : null;
    if (!info && !WALK.has(hw)) continue;
    if (World.roads.has(rd.id)) continue;
    const road = {
      id: rd.id, tags: rd.tags, hw, nodes: rd.nodes, pts: rd.pts, name: rd.tags.name || rd.tags.ref || '', tile: T.key,
      w: info ? info.w : (hw === 'pedestrian' ? 5 : 2), oneway: info ? info.oneway : 0, lanes: info ? info.lanes : 1, kind: info ? info.kind : null,
      v: info ? info.v : 1.4, rank: info ? info.rank : 0, sidewalk: info ? info.sidewalk : null,
      car: !!info, ai: AI_CAR.has(hw) && rd.tags.access !== 'private' && rd.tags.access !== 'no', ped: PED_OK.has(hw) && rd.tags.foot !== 'no',
      bridge: rd.tags.bridge && rd.tags.bridge !== 'no', tunnel: rd.tags.tunnel === 'yes' || rd.tags.tunnel === 'building_passage',
      mesh: false, cum: [0],
    };
    if (hw === 'service' && /parking_aisle|driveway|drive-through/.test(rd.tags.service || '')) road.paintOnly = true;
    road.mesh = !!info && !road.tunnel && !road.paintOnly;
    for (let i = 1; i < road.pts.length; i++) road.cum.push(road.cum[i - 1] + Math.hypot(road.pts[i][0] - road.pts[i - 1][0], road.pts[i][1] - road.pts[i - 1][1]));
    road.len = road.cum[road.cum.length - 1];
    if (road.bridge) {
      const p0 = road.pts[0], pn = road.pts[road.pts.length - 1]; const e0 = H(p0[0], p0[1]) + 0.25, e1 = H(pn[0], pn[1]) + 0.25; const Lr = road.len || 1;
      let minUnder = 1e9; for (let s = 0; s <= Lr; s += 4) { const q = pointAlong(road, s); minUnder = Math.min(minUnder, H(q[0], q[1])); }
      const clearance = Math.min(e0, e1) - minUnder; const layer = parseInt(rd.tags.layer) || 1;
      const bump = (layer >= 1 && Lr > 18 && clearance < 4.5 && road.car) ? (5.3 - clearance) : 0;
      road.deckAt = (s) => { const t = clamp(s / Lr, 0, 1); const q = pointAlong(road, s); return Math.max(lerp(e0, e1, t) + bump * Math.pow(Math.sin(Math.PI * t), 0.55), H(q[0], q[1]) + 0.5); };
    }
    World.roads.set(road.id, road); T.roadIds.push(road.id);
    for (let i = 0; i < road.nodes.length; i++) { const id = road.nodes[i]; let a = World.nodeAdj.get(id); if (!a) { a = []; World.nodeAdj.set(id, a); } a.push({ road, idx: i }); }
    for (let i = 0; i < road.pts.length - 1; i++) {
      const a = road.pts[i], b = road.pts[i + 1]; const pad = road.w / 2 + 1;
      World.segHash.insert({ road, i }, Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad);
      if (road.bridge && road.car) World.bridgeHash.insert({ road, i }, Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad);
    }
    const bb = road.pts.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    World.mmHash.insert({ road }, bb[0], bb[1], bb[2], bb[3]);
  }
  // traffic signals / stop signs (node-based)
  T.signalIds = [];
  for (const s of P.signals) {
    const adj = World.nodeAdj.get(s.id); let ax = 1, az = 0;
    if (adj && adj.length) { const { road, idx } = adj[0]; const a = road.pts[Math.max(0, idx - 1)], b = road.pts[Math.min(road.pts.length - 1, idx + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; ax = dx / l; az = dz / l; }
    World.signals.set(s.id, { x: s.x, z: s.z, ax, az }); T.signalIds.push(s.id);
  }
  for (const s of P.stops) World.stops.add(s.id);
}
function pointAlong(road, s) {
  const c = road.cum; if (s <= 0) return road.pts[0]; if (s >= road.len) return road.pts[road.pts.length - 1];
  let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const t = (s - c[lo]) / ((c[hi] - c[lo]) || 1), a = road.pts[lo], b = road.pts[hi]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function isJunction(id, P) { const d = P.deg.get(id) || 0; const adj = World.nodeAdj.get(id); return d >= 3 || (adj && adj.filter(a => a.road.car).length >= 2); }

function buildRoadMeshes(T, P) {
  const buckets = {}; for (const k in MAT.road) buckets[k] = new MB();
  const sw = new MB(), deckSide = new MB(), disc = new MB();
  const piers = [];
  T.lampPos = [];
  const lampInst = [];
  const J = TT("junctions", () => buildJunctions(T, P)); T.junctions = J; const R_of = new Map(); const mk = new MB(true);
  for (const id of T.roadIds) {
    const road = World.roads.get(id); if (!road || !road.mesh) continue;
    try { roadMesh(road); } catch (e) { console.warn('road skipped', id, e); }
  }
  function roadMesh(road) {
    const R = resample(road.pts, 5);
    const yoff = 0.15 + road.rank * 0.012;
    const yAt = road.bridge ? (p) => road.deckAt(p[2]) : (p) => H(p[0], p[1]) + yoff;
    strip(buckets.plain, R, 0, road.w, yAt, 1 / 12, road.bridge ? 1.1 : true); // markings are separate geometry (04d_streets.js)
    R_of.set(road.id, { R, Ry: R.map(p => yAt(p)) });
    // junction positions along this road (with each junction's clearance)
    const js = [];
    for (let i = 0; i < road.nodes.length; i++) { const j = J.get(road.nodes[i]); if (j) js.push([road.cum[i], j.e]); else if (isJunction(road.nodes[i], P)) js.push([road.cum[i], road.w / 2 + 2]); }
    const nearJ = (s, extra) => js.some(([c, e]) => Math.abs(c - s) < e + extra);
    if (road.bridge) {
      for (const side of [-1, 1]) strip(deckSide, R, side * (road.w / 2 + 0.15), 0.3, p => road.deckAt(p[2]) + 0.9, 1 / 4, 0.95);
      for (let s = 12; s < road.len - 8; s += 24) { const q = pointAlong(road, s); const top = road.deckAt(s) - 1.1, gy = H(q[0], q[1]); if (top - gy > 2.5) piers.push([q[0], gy - 0.5, q[1], top]); }
    }
    // sidewalks
    if (road.sidewalk && !road.bridge) {
      const sides = road.sidewalk === 'both' ? [-1, 1] : road.sidewalk === 'left' ? [-1] : [1];
      for (const side of sides) {
        // clear stretches between junctions, cut exactly where each junction's corner begins
        const blocks = js.map(([c, e]) => [c - e, c + e]).sort((p, q) => p[0] - q[0]); let s0 = 0; const total = R[R.length - 1][2];
        const runs = []; for (const [b0, b1] of blocks) { if (b0 > s0) runs.push([s0, b0]); s0 = Math.max(s0, b1); } if (s0 < total) runs.push([s0, total]);
        for (const [r0, r1] of runs) { if (r1 - r0 < 0.6) continue; const sub = clipPath(R, r0, r1); if (sub.length >= 2) strip(sw, sub, side * (road.w / 2 + 1.125), 2.25, (p, i) => { const o = side * (road.w / 2 + 1.125), a = sub[Math.max(0, i - 1)], b = sub[Math.min(sub.length - 1, i + 1)]; const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1; return H(p[0] - tz / tl * o, p[1] + tx / tl * o) + 0.3; }, 1 / 6, true); } // curb + sidewalk
      }
    }
    // street lamps
    if (road.rank >= 3 && !road.bridge && road.hw !== 'motorway' && !road.hw.endsWith('_link')) {
      const spacing = road.rank >= 5 ? 36 : 44; const both = road.rank >= 6;
      let k = 0;
      for (let s = spacing * 0.5; s < road.len; s += spacing, k++) {
        if (nearJ(s, 4)) continue;
        const side = both ? (k % 2 ? 1 : -1) : 1;
        const q = pointAlong(road, s), q2 = pointAlong(road, Math.min(road.len, s + 1)); let dx = q2[0] - q[0], dz = q2[1] - q[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const off = road.w / 2 + (road.sidewalk ? 2.9 : 1.1);
        const x = q[0] + (-dz) * side * off, z = q[1] + dx * side * off;
        if (insideBuilding(x, z)) continue;
        lampInst.push([x, H(x, z), z, Math.atan2(dz * side, -dx * side)]); // arm (+z local) points at the road
      }
    }
  }
  // intersections, crosswalks, stop bars, lane markings, sidewalk corners
  try { TT("streetDetail", () => buildStreetDetail(T, P, J, R_of, mk, disc, sw)); } catch (e) { console.warn('street detail skipped', e); }
  try { buildParkingLines(T, P, mk); } catch (e) { console.warn('parking lines skipped', e); }
  const addMesh = (mb, mat, shadow = false) => { const g = mb.geo(); if (!g) return; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = shadow; T.group.add(m); };
  for (const k in buckets) addMesh(buckets[k], MAT.road[k]);
  addMesh(disc, MAT.road.plain); addMesh(sw, MAT.sidewalk); addMesh(deckSide, MAT.concrete, true);
  if (!MAT.marking) MAT.marking = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 });
  addMesh(mk, MAT.marking);
  if (piers.length) {
    const geo = new THREE.BoxGeometry(1.2, 1, 1.2); geo.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(geo, MAT.concrete, piers.length); const m4 = new THREE.Matrix4();
    piers.forEach((p, i) => { m4.makeScale(1, p[3] - p[1], 1); m4.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; T.group.add(im);
  }
  // OSM-mapped lamps too
  for (const [x, z] of P.lamps) { const n = nearestRoad(x, z, 25, r => r.car); let yaw = 0; if (n) yaw = Math.atan2(n.x - x, n.z - z); lampInst.push([x, H(x, z), z, yaw]); }
  if (lampInst.length) {
    const pole = new THREE.InstancedMesh(GEO.lampPole, MAT.lampPole, lampInst.length), head = new THREE.InstancedMesh(GEO.lampHead, MAT.lampHead, lampInst.length);
    const o = new THREE.Object3D();
    lampInst.forEach((L, i) => {
      o.position.set(L[0], L[1], L[2]); o.rotation.set(0, L[3], 0); o.updateMatrix(); pole.setMatrixAt(i, o.matrix); head.setMatrixAt(i, o.matrix);
      T.lampPos.push([L[0] + Math.sin(L[3]) * GEO.lampHeadZ, L[1] + GEO.lampHeadY, L[2] + Math.cos(L[3]) * GEO.lampHeadZ]);
      const ob = knockable(T, { x: L[0], z: L[2], r: 0.2 }, { kind: 'lamp', ims: [pole, head], idx: i, mass: 90, min: 4, f: 0.25, lamp: T.lampPos[T.lampPos.length - 1] });
      T.hashItems.push([World.obsHash, World.obsHash.insert(ob, L[0] - 0.2, L[2] - 0.2, L[0] + 0.2, L[2] + 0.2)]);
    });
    pole.castShadow = true; T.group.add(pole, head);
  }
}

// ---------- buildings ----------
const PAL = {
  siding: ['#f1efe9', '#e6e1d3', '#d9d4c5', '#cfd6d8', '#c9d3c3', '#e8dcc0', '#b9c4cc', '#d8cbb5', '#a9b7a5', '#f3f1ec', '#dfe3e6', '#c7b9a3'],
  brick: ['#ffffff', '#f4ece6', '#e8ddd6', '#fff4ea', '#d9cfc9', '#f0e0d8'],
  shop: ['#ffffff', '#f5eee6', '#e9e3dc', '#fbe9dc'],
  office: ['#ffffff', '#efe9df', '#e3e6ea', '#f2efe7', '#e6ddd0'],
  store: ['#ffffff', '#f0e6d2', '#e6ddd0', '#ddd6c8', '#e9e4dc'],
  metal: ['#ffffff', '#dfe6ea', '#e8e2d6', '#cfd8d0', '#d6d0e0'],
  shingle: ['#5a5a5c', '#3f4042', '#6b5a4a', '#4a4038', '#5d6468', '#7a6a58', '#3b4a3f', '#7a3b2c', '#48494b'],
  flat: ['#d8d8d6', '#bfc0bf', '#9a9b9c', '#e8e8e6', '#7d7f82', '#cfcac0'],
  campus: ['#ffffff', '#fbeee8', '#f4e6de'], pcc: ['#ffffff', '#f6efe6'], hospital: ['#ffffff', '#f6f1e8', '#efe9de'], medglass: ['#ffffff'],
};
const _col = new THREE.Color();
function colHex(h) { return new THREE.Color(h); }
// downtowns of the county's small towns: [x, z, radius in metres]
const TOWN_CENTERS = [
  [35.5283, -77.4024, 150], // Winterville · Main & Railroad St
  [35.4727, -77.4155, 190], // Ayden · 2nd & 3rd St at Lee St
  [35.5954, -77.5853, 230], // Farmville · Main & Wilson St
  [35.3724, -77.4386, 150], // Grifton · Queen St & Highland Blvd
  [35.8071, -77.3786, 140], // Bethel · Main St
  [35.6721, -77.6358, 110], // Fountain
  [35.5637, -77.1928, 110], // Grimesland · Pitt St
].map(([la, lo, r]) => [lonToX(lo), latToZ(la), r]);
const HOUSEY = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'residential', 'terrace', 'cabin', 'duplex', 'farm']);
async function buildBuildings(T, P) {
  let _cnt = 0;
  const W = T.W; const buckets = {}; for (const k in MAT.facade) buckets[k] = new MB(true); const roofS = new MB(true), roofF = new MB(true);
  const FB = foodBuilder(T, P, { buckets, roofF, roofS }); // restaurants: branded buildings, storefronts, new buildings
  const decor = new MB(true), seats = new MB(true), houseDetail = new MB(true); const Z = P.zones || (P.zones = landmarkZones(P)); // landmark trim, grandstands
  const upt = (x, z) => Math.hypot(x - 0, z - 0);
  // small-town downtowns: storefront blocks within this distance of Main Street (distance ÷ radius, < 1 = downtown)
  const wvDown = (x, z) => { let m = 1e9; for (const [x0, z0, r] of TOWN_CENTERS) m = Math.min(m, Math.hypot(x - x0, z - z0) / r * 150); return m; };
  const luAt = (x, z) => { const u = Math.floor((x - W.x0) / (W.x1 - W.x0) * 512), v = Math.floor((z - W.z0) / (W.z1 - W.z0) * 512); if (u < 0 || v < 0 || u > 511 || v > 511) return 40; return decodeCls(T.luR[v * 512 + u]); };
  for (const B of P.buildings) {
    if ((++_cnt & 127) === 0) await yieldMaybe();
    try { addOneBuilding(B); } catch (e) { if (!buildBuildings._w) { buildBuildings._w = 1; console.warn('building skipped', B.id, e); } }
  }
  function addOneBuilding(B) {
    if (B.skip) return;
    if (B.food) { try { FB.themed(B); } catch (e) { console.warn('restaurant skipped', B.food.name, e); } return; }
    const t = B.tags; const ring = B.ring; if (ring.length < 3) return;
    let area = Math.abs(signedArea(ring)); if (area < 6) return;
    const [cx, cz] = centroid(ring); const rng = mulberry32((B.id % 2147483647) | 0);
    const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
    const bt = t.building || t['building:part'] || 'yes'; const lu = luAt(cx, cz); const du = upt(cx, cz);
    // --- facade ---
    let fac;
    const mat = (t['building:material'] || t['building:facade:material'] || '').toLowerCase();
    if (/brick/.test(mat)) fac = du < 700 && area > 200 ? 'shop' : 'brick';
    else if (/metal|steel/.test(mat)) fac = 'metal';
    else if (/glass|concrete|stone/.test(mat)) fac = 'office';
    else if (/wood|vinyl|plaster/.test(mat)) fac = 'siding';
    // small-town downtowns (Winterville, Ayden, Farmville, Grifton, Bethel…): storefront blocks, some mapped as "house"
    else if (wvDown(cx, cz) < 150 && /^(yes|retail|commercial|house)$/.test(bt) && (area > 400 || (area > 120 && (B.units || lu !== 80)))) fac = 'shop';
    else if (HOUSEY.has(bt) || (bt === 'yes' && area < 280 && lu === 80)) fac = r1 < 0.36 ? 'brick' : 'siding';
    else if (bt === 'apartments' || bt === 'dormitory') fac = r1 < 0.62 ? 'brick' : 'siding';
    else if (/^(university|college|school|church|chapel|cathedral|civic|public|government|kindergarten|library|museum|fire_station|courthouse|townhall)$/.test(bt) || lu === 240) fac = 'brick';
    else if (/^(retail|commercial|supermarket|kiosk|restaurant|fast_food)$/.test(bt)) fac = du < 800 ? 'shop' : 'store';
    else if (/^(office|hospital|hotel|bank)$/.test(bt)) fac = 'office';
    else if (/^(industrial|warehouse|manufacture|garage|garages|shed|hangar|barn|farm_auxiliary|storage_tank|service|carport|greenhouse|roof|parking|transportation)$/.test(bt)) fac = bt === 'parking' ? 'office' : 'metal';
    else if (du < 650) fac = area > 120 ? 'shop' : 'brick';
    else if (lu === 215) fac = area > 1500 ? 'store' : (r1 < .5 ? 'store' : 'brick');
    else if (lu === 225) fac = 'metal';
    else if (area > 2500) fac = 'store';
    else fac = r1 < 0.4 ? 'brick' : 'siding';
    // --- height ---
    const lv = parseFloat(t['building:levels']);
    let h = parseLen(t.height);
    const floorH = (fac === 'siding' || (fac === 'brick' && (HOUSEY.has(bt) || lu === 80))) ? 3.0 : 3.7;
    if (!(h > 0)) {
      if (lv > 0) h = lv * floorH + (t['roof:shape'] && t['roof:shape'] !== 'flat' ? 0 : 0.6);
      else if (HOUSEY.has(bt) || (bt === 'yes' && area < 280 && (lu === 80 || lu === 40))) h = r2 < 0.72 ? 3.2 : 5.9;
      else if (bt === 'apartments') h = area > 1500 ? 13 : 9.5;
      else if (bt === 'dormitory') h = 17;
      else if (bt === 'university' || bt === 'college' || lu === 240) h = area > 2500 ? 16 : 12;
      else if (bt === 'hospital') h = 24;
      else if (bt === 'office') h = 11;
      else if (bt === 'hotel') h = 16;
      else if (bt === 'church' || bt === 'chapel') h = 10;
      else if (bt === 'parking') h = 11;
      else if (/^(retail|commercial|supermarket)$/.test(bt)) h = du < 800 ? 8 + r2 * 4 : 6.5;
      else if (/^(industrial|warehouse|manufacture|hangar)$/.test(bt)) h = 8;
      else if (/^(garage|garages|shed|carport|service)$/.test(bt)) h = 2.8;
      else if (bt === 'roof') h = 5;
      else if (du < 650) h = area > 400 ? 9 + r2 * 5 : 7 + r2 * 3;
      else if (fac === 'shop' && wvDown(cx, cz) < 150) h = area > 350 ? 7.6 : 5.4;
      else h = area < 250 ? (r2 < .7 ? 3.4 : 6) : area < 900 ? 6 : area < 3000 ? 7 : 8.5;
    }
    let minH = parseLen(t.min_height); if (!(minH > 0)) { const ml = parseFloat(t['building:min_level']); minH = ml > 0 ? ml * floorH : 0; }
    if (bt === 'roof' && !(minH > 0)) minH = Math.max(0, h - 1);
    // --- roof ---
    let shape = (t['roof:shape'] || '').toLowerCase();
    const obb = minAreaRect(ring); const rect = obb ? area / (obb.L * obb.W) : 0;
    // ECU campus / hospital / stadium buildings get their own look (04f_landmarks.js)
    const LM = landmarkStyle(B, cx, cz, area, obb, Z);
    if (LM && LM.kind === 'skip') return;
    if (LM && LM.kind === 'grandstand') { buildGrandstand(B, T, P, seats, Z); return; }
    if (LM) { fac = LM.fac; if (!(parseLen(t.height) > 0)) h = LM.h; if (!shape) shape = LM.shape; }
    if (!shape) {
      const housey = fac === 'siding' || (fac === 'brick' && (HOUSEY.has(bt) || (bt === 'yes' && lu === 80)));
      if (housey && area < 480 && rect > 0.7 && obb.W < 16) shape = r3 < 0.55 ? 'hipped' : 'gabled';
      else if ((bt === 'apartments' || bt === 'church') && area < 1600 && rect > 0.75 && obb.W < 22) shape = 'gabled';
      else shape = 'flat';
    }
    if (!/^(gabled|hipped|pyramidal|flat)$/.test(shape) || !obb || rect < 0.55) shape = shape === 'flat' || !obb || rect < 0.55 ? 'flat' : 'hipped';
    // --- ground ---
    let gmin = 1e9, gsum = 0; for (const p of ring) { const y = H(p[0], p[1]); gmin = Math.min(gmin, y); gsum += y; } const gavg = gsum / ring.length;
    const base = minH > 0 ? gavg + minH : gmin - 0.4; const top = gavg + h - (shape !== 'flat' && !(parseLen(t.height) > 0) ? 0 : 0);
    let wallTop = top;
    const pitch = (shape === 'flat') ? 0 : (t['roof:angle'] ? parseFloat(t['roof:angle']) : 22 + r4 * 12) * Math.PI / 180;
    let rise = 0;
    if (shape !== 'flat') { rise = Math.min(5, obb.W / 2 * Math.tan(pitch)); if (parseLen(t.height) > 0) wallTop = Math.max(base + 2.4, top - rise); }
    // --- colours ---
    let wallCol = colHex(pick(PAL[fac] || PAL.office, r3)); if (t['building:colour']) try { wallCol = new THREE.Color(t['building:colour']); if (fac !== 'siding') wallCol.lerp(new THREE.Color(1, 1, 1), 0.4); } catch (e) { }
    let roofCol = colHex(pick(shape === 'flat' ? PAL.flat : PAL.shingle, r4)); if (t['roof:colour']) try { roofCol = new THREE.Color(t['roof:colour']); } catch (e) { }
    if (LM) { wallCol = new THREE.Color(LM.wall); if (!t['roof:colour']) roofCol = new THREE.Color(shape === 'flat' ? '#b9b7b1' : LM.roof); }
    const tf = TEX.facade[fac]; const texW = tf.bayW * 4, texH = tf.floorH * 4; const uOff = Math.floor(r2 * 4) / 4;
    const mbw = buckets[fac];
    // --- detached houses: built as real houses (04i_houses.js) ---
    if (!LM && houseCandidate(B, { fac, bt, lu, area, obb, rect })) {
      let topY = 0; try { topY = buildHouse(B, { obb, area, rng, gavg, buckets, roofS, roofF, detail: houseDetail, glass: buckets.houseGlass, glassLit: buckets.houseGlassLit }); } catch (e) { if (!buildBuildings._hw) { buildBuildings._hw = 1; console.warn('house builder failed, using plain walls', B.id, e); } topY = 0; }
      if (topY) { register(gavg, -1e9, topY); return; }
    }
    // --- walls ---
    const rings = [ring, ...B.holes];
    rings.forEach((rg, ri) => {
      const sa = signedArea(rg); const outer = ri === 0; let acc = 0;
      for (let i = 0; i < rg.length; i++) {
        const a = rg[i], b = rg[(i + 1) % rg.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.05) continue;
        let nx = dz / L, nz = -dx / L; if ((sa > 0) !== outer) { nx = -nx; nz = -nz; }
        const u0 = uOff + acc / texW, u1 = uOff + (acc + L) / texW; acc += L;
        const v0 = (base - gavg) / texH, v1 = (wallTop - gavg) / texH;
        mbw.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], wallTop, b[1]], [a[0], wallTop, a[1]], [u0, v0], [u1, v0], [u1, v1], [u0, v1], [nx, 0, nz], wallCol);
      }
    });
    // --- roof geometry ---
    if (shape === 'flat') {
      const contour = ring.map(p => new THREE.Vector2(p[0], p[1])); const holes = B.holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { tris = []; }
      const all = contour.concat(...holes);
      for (const tr of tris) { const A = all[tr[0]], Bv = all[tr[1]], C = all[tr[2]]; roofF.tri([A.x, wallTop, A.y], [Bv.x, wallTop, Bv.y], [C.x, wallTop, C.y], [A.x / 8, A.y / 8], [Bv.x / 8, Bv.y / 8], [C.x / 8, C.y / 8], UPN, roofCol); }
      // parapet cap for bigger commercial buildings
      if (area > 400 && fac !== 'siding') for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .05) continue; const sa = signedArea(ring); let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } roofF.quad([a[0], wallTop, a[1]], [b[0], wallTop, b[1]], [b[0], wallTop + 0.7, b[1]], [a[0], wallTop + 0.7, a[1]], [0, 0], [L / 8, 0], [L / 8, .1], [0, .1], [-nx, 0, -nz], roofCol); }
    } else {
      const o = 0.4; const { ux, uz, vx, vz } = obb; const W2 = obb.W / 2, L2 = obb.L / 2;
      const P3 = (u, v, y) => [obb.cx + u * ux + v * vx, y, obb.cz + u * uz + v * vz];
      const eave = wallTop - o * Math.tan(pitch); const ridgeY = wallTop + rise;
      const A = P3(-L2 - o, -W2 - o, eave), Bq = P3(L2 + o, -W2 - o, eave), C = P3(L2 + o, W2 + o, eave), D = P3(-L2 - o, W2 + o, eave);
      const nUp = (u, v) => [u * ux + v * vx, 1.2, u * uz + v * vz];
      const slopeLen = Math.hypot(W2 + o, rise + o * Math.tan(pitch));
      if (shape === 'gabled') {
        const R1 = P3(-L2 - o, 0, ridgeY), R2 = P3(L2 + o, 0, ridgeY);
        const ul = (obb.L + 2 * o) / 4, vl = slopeLen / 4;
        roofS.quad(A, Bq, R2, R1, [0, 0], [ul, 0], [ul, vl], [0, vl], nUp(0, -1), roofCol);
        roofS.quad(C, D, R1, R2, [ul, 0], [0, 0], [0, vl], [ul, vl], nUp(0, 1), roofCol);
        for (const s of [-1, 1]) { // gable ends (wall material)
          const g1 = P3(s * L2, -W2, wallTop), g2 = P3(s * L2, W2, wallTop), g3 = P3(s * L2, 0, ridgeY);
          mbw.tri(g1, g2, g3, [uOff, (wallTop - gavg) / texH], [uOff + obb.W / texW, (wallTop - gavg) / texH], [uOff + obb.W / 2 / texW, (ridgeY - gavg) / texH], [s * ux, 0, s * uz], wallCol);
        }
      } else {
        const rr = Math.max(0, L2 - W2);
        const R1 = P3(-rr, 0, ridgeY), R2 = P3(rr, 0, ridgeY);
        const ul = (obb.L + 2 * o) / 4, vl = slopeLen / 4, wl = (obb.W + 2 * o) / 4;
        roofS.quad(A, Bq, R2, R1, [0, 0], [ul, 0], [ul / 2 + rr / 4, vl], [ul / 2 - rr / 4, vl], nUp(0, -1), roofCol);
        roofS.quad(C, D, R1, R2, [ul, 0], [0, 0], [ul / 2 - rr / 4, vl], [ul / 2 + rr / 4, vl], nUp(0, 1), roofCol);
        roofS.tri(D, A, R1, [0, 0], [wl, 0], [wl / 2, vl], nUp(-1, 0), roofCol);
        roofS.tri(Bq, C, R2, [0, 0], [wl, 0], [wl / 2, vl], nUp(1, 0), roofCol);
      }
      // ceiling under the eaves so you can't see inside from below
      roofF.quad(A, Bq, C, D, [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0], new THREE.Color(0.8, 0.8, 0.78));
    }
    if (LM) try { landmarkExtras(LM, B, T, { ring, base, wallTop, gavg, obb, decor, area }); } catch (e) { console.warn('landmark details skipped', e); }
    // --- register for collision / names ---
    register(gavg, minH > 0 ? gavg + minH : -1e9, wallTop + rise);
    if (B.units) try { FB.storefronts(B, base, wallTop); } catch (e) { console.warn('storefront skipped', e); }
    if (B.fuel) try { FB.canopy(B, base, wallTop); } catch (e) { console.warn('canopy skipped', e); }
    function register(gavg, minY, maxY) {
      const bb = ring.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
      const item = { ring, holes: B.holes, minY, maxY, name: t.name || '', cx, cz, h: maxY };
      T.hashItems.push([World.bldHash, World.bldHash.insert(item, bb[0], bb[1], bb[2], bb[3])]);
      T.hashItems.push([World.mmHash, World.mmHash.insert({ bld: ring }, bb[0], bb[1], bb[2], bb[3])]);
    }
  }
  if (!FB.none) { try { FB.standalone(); } catch (e) { console.warn('restaurant placement skipped', e); } FB.finish(); }
  for (const k in buckets) { const g = buckets[k].geo(); if (g) { const m = new THREE.Mesh(g, MAT.facade[k]); m.castShadow = true; m.receiveShadow = true; T.group.add(m); } }
  const gs = roofS.geo(); if (gs) { const m = new THREE.Mesh(gs, MAT.shingle); m.castShadow = true; m.receiveShadow = true; T.group.add(m); }
  const gf = roofF.geo(); if (gf) { const m = new THREE.Mesh(gf, MAT.flatroof); m.castShadow = true; m.receiveShadow = true; T.group.add(m); }
  addMB(T, decor, lmPlainMat()); addMB(T, seats, standsMat());
  { const g = houseDetail.geo(); if (g) { const m = new THREE.Mesh(g, MAT.houseTrim); m.castShadow = true; m.receiveShadow = true; m.userData.detail = true; T.group.add(m); } }
}

// ---------- trees ----------
function buildTrees(T, P) {
  const W = T.W, sx = W.x1 - W.x0, sz = W.z1 - W.z0; const r = mulberry32(T.tx * 31337 + T.ty * 7);
  const dens = { 40: 1 / 520, 80: 1 / 300, 120: 1 / 520, 160: 1 / 38, 200: 0, 215: 1 / 1600, 225: 1 / 2400, 240: 1 / 420 };
  const maxD = 1 / 38; const attempts = Math.min(sx * sz * maxD, Q.trees * 8);
  const lists = { pine: [], oak: [], myrtle: [] };
  const put = (x, z, cls, force) => {
    let sp; const q = r();
    if (cls === 160) sp = q < 0.68 ? 'pine' : 'oak'; else if (cls === 80) sp = q < 0.42 ? 'oak' : q < 0.8 ? 'pine' : 'myrtle';
    else if (cls === 215 || cls === 225) sp = q < 0.55 ? 'myrtle' : 'oak'; else if (cls === 240) sp = q < 0.6 ? 'oak' : q < .85 ? 'pine' : 'myrtle'; else sp = q < 0.5 ? 'pine' : 'oak';
    if (force) sp = q < .6 ? 'oak' : 'pine';
    lists[sp].push([x, z, 0.75 + r() * 0.55, r() * 6.28]);
  };
  if (T.canopy) { placeCanopyTrees(T, lists, r); T.canopy = null; }
  else {
  for (const [x, z] of P.trees) put(x, z, 80, true);
  for (const row of P.treeRows) { const R = resample(row, 9); for (const p of R) put(p[0], p[1], 80, true); }
  let count = P.trees.length;
  for (let i = 0; i < attempts && count < Q.trees; i++) {
    const u = r(), v = r(); const px = Math.floor(u * 512), pz = Math.floor(v * 512); const cls = decodeCls(T.treeR[pz * 512 + px]); if (!cls) continue;
    if (r() > (dens[cls] || 0) / maxD) continue;
    put(W.x0 + (px + r()) / 512 * sx, W.z0 + (pz + r()) / 512 * sz, cls); count++;
  }
  }
  const o = new THREE.Object3D(); const col = new THREE.Color();
  for (const sp in lists) {
    const L = lists[sp]; if (!L.length) continue;
    const im = new THREE.InstancedMesh(sp === 'oak' && Q === QUALITY.low ? GEO.oakLo : GEO[sp], MAT.tree, L.length); im.userData.detail = true;
    L.forEach((t, i) => {
      o.position.set(t[0], H(t[0], t[1]) - 0.1, t[1]); o.rotation.set(0, t[3], 0); o.scale.set(t[2], t[2] * (0.9 + (i % 7) * 0.04), t[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      const k = 0.82 + ((i * 2654435761) >>> 0) % 1000 / 1000 * 0.36; col.setRGB(k, k * (0.96 + (i % 5) * 0.02), k * 0.95); im.setColorAt(i, col);
      const rr = sp === 'myrtle' ? 0.25 : 0.4 * t[2];
      const ob = knockable(T, { x: t[0], z: t[1], r: rr }, { kind: 'tree', ims: [im], idx: i, mass: 160 * t[2] * t[2], min: t[2] > 1.1 ? 9 : 5.5, f: sp === 'myrtle' ? 0.4 : 0.28 });
      T.hashItems.push([World.obsHash, World.obsHash.insert(ob, t[0] - rr, t[1] - rr, t[0] + rr, t[1] + rr)]);
    });
    im.castShadow = Q !== QUALITY.low; im.receiveShadow = true; im.computeBoundingSphere(); T.group.add(im);
  }
}

// trees on the real tree tops from the canopy height map (03k_realdata.js): every local maximum
// of canopy height is a crown; its height sets the tree's size
function treeBaseH(sp) { const g = GEO[sp]; if (!g.boundingBox) g.computeBoundingBox(); return Math.max(1, g.boundingBox.max.y); }
function placeCanopyTrees(T, lists, r) {
  const C = T.canopy, N = Canopy.N, W = T.W, sx = W.x1 - W.x0, sz = W.z1 - W.z0; const tops = [];
  const at = (u, v) => (u < 0 || v < 0 || u >= N || v >= N) ? 0 : C[v * N + u];
  for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) {
    const h = C[v * N + u]; if (h < 12) continue; // under 3 m: shrubs / grass
    let top = true; for (let dv = -1; dv <= 1 && top; dv++) for (let du = -1; du <= 1; du++) { if (!du && !dv) continue; const o = at(u + du, v + dv); if (o > h || (o === h && (dv < 0 || (dv === 0 && du < 0)))) { top = false; break; } }
    if (!top) continue;
    // tree mask: not on roads, buildings, water or rails
    const mu = Math.min(511, Math.floor((u + 0.5) / N * 512)), mv = Math.min(511, Math.floor((v + 0.5) / N * 512));
    const cls = decodeCls(T.treeR[mv * 512 + mu]); if (!cls) continue;
    tops.push([u, v, h / 4, cls]);
  }
  // too many for this quality level: keep an even random sample (tall ones slightly favoured)
  let keep = tops; if (tops.length > Q.trees) { keep = tops.map(t => [t, r() * (0.7 + Math.min(0.6, t[2] / 40))]).sort((a, b) => b[1] - a[1]).slice(0, Q.trees).map(q => q[0]); }
  const base = { pine: treeBaseH('pine'), oak: treeBaseH('oak'), myrtle: treeBaseH('myrtle') };
  for (const [u, v, h, cls] of keep) {
    const q = r(); let sp;
    if (h < 5.5) sp = q < 0.6 ? 'myrtle' : 'oak';
    else if (cls === 160) sp = q < (h > 18 ? 0.72 : 0.5) ? 'pine' : 'oak';   // woods: loblolly pine + hardwoods
    else if (cls === 80 || cls === 240) sp = q < (h > 20 ? 0.45 : 0.25) ? 'pine' : 'oak'; // neighbourhoods / campus: mostly oaks
    else sp = q < 0.55 ? 'pine' : 'oak';
    const x = W.x0 + (u + 0.3 + r() * 0.4) / N * sx, z = W.z0 + (v + 0.3 + r() * 0.4) / N * sz;
    lists[sp].push([x, z, clamp(h / base[sp], 0.35, 2.6), r() * 6.28]);
  }
  T.canopyTrees = keep.length;
}

// ---------- signals & stop signs ----------
function buildSignals(T, P) {
  const body = [], lamps = { Ar: [], Ay: [], Ag: [], Br: [], By: [], Bg: [] };
  const box = (w, h, d, m) => { const g = new THREE.BoxGeometry(w, h, d); g.applyMatrix4(m); return prep(g); };
  const cyl = (r1, r2, h, m) => { const g = new THREE.CylinderGeometry(r1, r2, h, 6); g.applyMatrix4(m); return prep(g); };
  const M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(); const stops = [];
  for (const id of T.signalIds) {
    const s = World.signals.get(id); if (!s) continue;
    const adj = World.nodeAdj.get(id) || []; let wmax = 8; for (const a of adj) wmax = Math.max(wmax, a.road.w);
    const y0 = H(s.x, s.z); const hy = y0 + 6.2;
    // two poles at opposite corners, span wire between
    const px = -s.az, pz = s.ax; const d = wmax / 2 + 2.2;
    const c1 = [s.x + (s.ax + px) * d * 0.72, s.z + (s.az + pz) * d * 0.72], c2 = [s.x - (s.ax + px) * d * 0.72, s.z - (s.az + pz) * d * 0.72];
    for (const c of [c1, c2]) { const gy = H(c[0], c[1]); M.makeTranslation(c[0], gy + 3.8, c[1]); body.push(cyl(0.12, 0.18, 7.6, M)); }
    { const dx = c2[0] - c1[0], dz = c2[1] - c1[1]; const L = Math.hypot(dx, dz); M.makeRotationY(Math.atan2(dx, dz)); M.setPosition((c1[0] + c2[0]) / 2, hy + 1.2, (c1[1] + c2[1]) / 2); body.push(box(0.04, 0.04, L, M)); }
    // four heads facing the four approaches
    const dirs = [[s.ax, s.az, 'A'], [-s.ax, -s.az, 'A'], [-s.az, s.ax, 'B'], [s.az, -s.ax, 'B']];
    for (const [fx, fz, ax] of dirs) {
      const yaw = Math.atan2(fx, fz); M.makeRotationY(yaw); M.setPosition(s.x + fx * 0.3, hy, s.z + fz * 0.3); body.push(box(0.36, 1.05, 0.28, M));
      ['r', 'y', 'g'].forEach((c, k) => {
        const g = new THREE.CircleGeometry(0.11, 10); M2.makeRotationY(yaw); M2.setPosition(s.x + fx * 0.45, hy + 0.32 - k * 0.32, s.z + fz * 0.45); g.applyMatrix4(M2); lamps[ax + c].push(prep(g));
      });
    }
  }
  for (const id of P.stops.map(s => s.id)) {
    const adj = World.nodeAdj.get(id); if (!adj || !adj.length) continue; const { road, idx } = adj[0];
    const p = road.pts[idx]; const a = road.pts[Math.max(0, idx - 1)], b = road.pts[Math.min(road.pts.length - 1, idx + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; if (idx > 0) { dx = -dx; dz = -dz; }
    // sign faces traffic that approaches the node along this way
    const sx = p[0] + dz * (road.w / 2 + 1.2) * (idx > 0 ? -1 : 1), sz = p[1] - dx * (road.w / 2 + 1.2) * (idx > 0 ? -1 : 1);
    stops.push([sx, H(sx, sz), sz, Math.atan2(dx, dz)]);
  }
  if (stops.length) { // instanced so a car can knock one flat
    if (!GEO.stopPole) { GEO.stopPole = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6); GEO.stopPole.translate(0, 1.1, 0); const o = new THREE.CylinderGeometry(0.38, 0.38, 0.04, 8); o.rotateX(Math.PI / 2); o.rotateZ(Math.PI / 8); o.translate(0, 2.2, 0); GEO.stopOct = o; }
    const pole = new THREE.InstancedMesh(GEO.stopPole, MAT.signalBody, stops.length), oct = new THREE.InstancedMesh(GEO.stopOct, MAT.stopRed, stops.length);
    stops.forEach((s, i) => {
      M.makeRotationY(s[3]); M.setPosition(s[0], s[1], s[2]); pole.setMatrixAt(i, M); oct.setMatrixAt(i, M);
      const ob = knockable(T, { x: s[0], z: s[2], r: 0.1 }, { kind: 'stop', ims: [pole, oct], idx: i, mass: 25, min: 2, f: 0.5 });
      T.hashItems.push([World.obsHash, World.obsHash.insert(ob, s[0] - 0.2, s[2] - 0.2, s[0] + 0.2, s[2] + 0.2)]);
    });
    pole.castShadow = true; pole.computeBoundingSphere(); oct.computeBoundingSphere(); T.group.add(pole, oct);
  }
  if (body.length) { const m = new THREE.Mesh(mergeGeometries(body), MAT.signalBody); m.castShadow = true; T.group.add(m); }
  for (const k in lamps) if (lamps[k].length) { const m = new THREE.Mesh(mergeGeometries(lamps[k]), k === 'stop' ? MAT.stopRed : MAT.sig[k]); T.group.add(m); }
}

// ---------- parked cars in lots ----------
function buildParked(T, P) {
  const W = T.W; const r = mulberry32(T.tx * 991 + T.ty * 17); const slots = [];
  for (const a of P.areas) {
    if (a.kind !== 'parking' || !a.rings.length) continue; const ring = a.rings[0]; if (ring.length < 3) continue;
    const ob = minAreaRect(ring); if (!ob || ob.L * ob.W > 60000) continue;
    for (let v = -ob.W / 2 + 2.8; v < ob.W / 2 - 2.5; v += 18) for (const dv of [0, 5.6]) for (let u = -ob.L / 2 + 2; u < ob.L / 2 - 1.5; u += 2.8) {
      if (r() < 0.5) continue; const vv = v + dv;
      const x = ob.cx + u * ob.ux + vv * ob.vx, z = ob.cz + u * ob.uz + vv * ob.vz;
      if (x < W.x0 || x >= W.x1 || z < W.z0 || z >= W.z1) continue;
      if (!pointInPoly(x, z, ring) || insideBuilding(x, z)) continue;
      const nr = nearestRoad(x, z, 10, rd => rd.mesh); if (nr && nr.d < nr.road.w / 2 + 1.5) continue;
      slots.push([x, z, Math.atan2(ob.vx, ob.vz) + (r() < .5 ? Math.PI : 0), r()]);
      if (slots.length >= Q.parked) break;
    }
    if (slots.length >= Q.parked) break;
  }
  if (!slots.length) return;
  const types = { sedan: [], suv: [], pickup: [] };
  for (const s of slots) types[s[3] < .5 ? 'sedan' : s[3] < .8 ? 'suv' : 'pickup'].push(s);
  const o = new THREE.Object3D(); const col = new THREE.Color();
  for (const ty in types) {
    const L = types[ty]; if (!L.length) continue; const G = GEO.car[ty];
    const parts = [[G.liteBody, MAT.carBodyWhite, true], [G.liteGlass, MAT.carGlass, false], [G.liteTrim, MAT.carTrim, false], [G.liteLamps, MAT.lampOff, false], [G.wheelsStatic, MAT.wheel, false]];
    const meshes = parts.map(([g, m]) => new THREE.InstancedMesh(g, m, L.length));
    L.forEach((s, i) => {
      o.position.set(s[0], H(s[0], s[1]) + 0.05, s[1]); o.rotation.set(0, s[2], 0); o.updateMatrix();
      meshes.forEach(m => m.setMatrixAt(i, o.matrix)); col.setHex(CAR_COLORS[Math.floor(hashN(i * 7 + T.tx) * CAR_COLORS.length)]); meshes[0].setColorAt(i, col);
      const kk = { kind: 'car', ims: meshes, idx: i, mass: 1300, min: 3, f: 1 };
      for (const k of [-1.2, 1.2]) { const x = s[0] + Math.sin(s[2]) * k, z = s[1] + Math.cos(s[2]) * k; T.hashItems.push([World.obsHash, World.obsHash.insert(knockable(T, { x, z, r: 1.0 }, kk), x - 1, z - 1, x + 1, z + 1)]); }
    });
    meshes[0].castShadow = true; meshes.forEach(m => { m.computeBoundingSphere(); m.userData.detail = true; T.group.add(m); });
  }
}

// named areas for the HUD ("ECU Main Campus", "Town Common")
function registerAreas(T, P) {
  T.areaRefs = [];
  for (const a of P.areas) {
    if (!a.name || !a.rings.length) continue;
    const ring = a.rings[0]; const bb = ring.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const key = a.name + '|' + Math.round(bb[0]) + '|' + Math.round(bb[1]);
    if (World.areas.some(x => x.key === key)) continue;
    const ref = { key, name: a.name, kind: a.kind, rings: a.rings, bb, area: (bb[2] - bb[0]) * (bb[3] - bb[1]), tile: T.key };
    World.areas.push(ref); T.areaRefs.push(ref);
  }
  T.water = P.areas.filter(a => a.kind === 'water' || a.kind === 'park' || a.kind === 'forest').map(a => ({ kind: a.kind, rings: a.rings }));
}

// =====================================================================
// TILE MANAGER — streams 1.1 km squares around the player
// =====================================================================
const Tiles = {
  map: new Map(), queue: [], busy: false, px: 0, pz: 0, failed: new Map(),
  ensure(tx, ty, prio) {
    const k = tileKey(tx, ty); let T = this.map.get(k);
    if (!T && performance.now() - (this.failed.get(k) || -1e9) < 20000) return null;
    if (!T) {
      T = { tx, ty, key: k, W: tileWorld(tx, ty), group: new THREE.Group(), state: 'queued', hashItems: [], roadIds: [], signalIds: [], lampPos: [], prio };
      T.group.name = 'tile ' + k; this.map.set(k, T); this.queue.push(T); this.pump();
      getTileData(tx, ty, prio).catch(() => { }); // start the download early
    }
    return T;
  },
  async pump() {
    if (this.busy) return; this.busy = true;
    try {
      while (this.queue.length) {
        this.queue.sort((a, b) => this.dist(a) - this.dist(b));
        const T = this.queue.shift(); if (T.state !== 'queued') continue;
        T.state = 'loading';
        try { await buildTile(T); T.state = 'ready'; }
        catch (e) { console.error('tile failed', T.key, e); T.state = 'error'; T.err = e; this.failed.set(T.key, performance.now()); UI.toast('Map download problem — retrying shortly'); this.map.delete(T.key); T.group.removeFromParent(); for (const [h, it] of T.hashItems) h.remove(it); unregisterRoads(T); }
      }
    } finally { this.busy = false; }
  },
  dist(T) { const c = T.W; const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2; return Math.hypot(cx - this.px, cz - this.pz); },
  update(px, pz) {
    this.px = px; this.pz = pz; const [tx, ty] = tileOfXZ(px, pz); const R = Q.radius;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) this.ensure(tx + dx, ty + dy, Math.max(Math.abs(dx), Math.abs(dy)));
    for (const T of this.map.values()) {
      const d = Math.max(Math.abs(T.tx - tx), Math.abs(T.ty - ty));
      if (d > R + 1 && (T.state === 'ready' || T.state === 'queued')) this.unload(T);
    }
    this.detailLOD(px, pz);
  },
  // trees, parked cars and house trim only in squares near you (farther ones are mostly in the fog anyway)
  detailLOD(px, pz) {
    const D = (Q.detailD || 900) * (Player.mode === 'fly' || Player.mode === 'heli' ? 1.6 : 1);
    for (const T of this.map.values()) {
      if (T.state !== 'ready' || !T.W) continue;
      const dx = Math.max(T.W.x0 - px, 0, px - T.W.x1), dz = Math.max(T.W.z0 - pz, 0, pz - T.W.z1); const show = Math.hypot(dx, dz) < D;
      if (T.detailShown === show) continue; T.detailShown = show;
      for (const o of T.group.children) if (o.userData.detail) o.visible = show;
    }
  },
  unload(T) {
    this.map.delete(T.key); T.state = 'gone';
    T.group.removeFromParent();
    T.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !o.geometry.userData.shared && !Object.values(GEO).includes(o.geometry) && !isSharedGeo(o.geometry)) o.geometry.dispose(); });
    if (T.signMat) { MAT.signMats.delete(T.signMat); T.signMat.dispose(); T.signTex.dispose(); } if (T.foodMat) { MAT.foodSigns.delete(T.foodMat); T.foodMat.dispose(); T.foodTex.dispose(); } if (T.terrainMat) T.terrainMat.dispose(); if (T.tex) T.tex.dispose(); if (T.rtex) T.rtex.dispose();
    for (const m of T.lmMats || []) { if (m.map) m.map.dispose(); m.dispose(); } World.hospitalSpots.delete(T.key);
    for (const [h, it] of T.hashItems) h.remove(it);
    unregisterRoads(T);
    World.areas = World.areas.filter(a => a.tile !== T.key);
    forgetTileData(T.key);
  },
  readyAround(px, pz, R) { const [tx, ty] = tileOfXZ(px, pz); for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const T = this.map.get(tileKey(tx + dx, ty + dy)); if (!T || T.state !== 'ready') return false; } return true; },
  loadingCount() { let n = 0; for (const T of this.map.values()) if (T.state !== 'ready') n++; return n; },
};
function isSharedGeo(g) { for (const k in GEO.car) for (const kk in GEO.car[k]) if (GEO.car[k][kk] === g) return true; return g === GEO.pine || g === GEO.oak || g === GEO.myrtle || g === GEO.lampPole || g === GEO.lampHead; }
function unregisterRoads(T) {
  for (const id of T.roadIds || []) {
    const road = World.roads.get(id); if (!road) continue; road.removed = true; World.roads.delete(id);
    for (const nid of road.nodes) { const a = World.nodeAdj.get(nid); if (!a) continue; const f = a.filter(e => e.road !== road); if (f.length) World.nodeAdj.set(nid, f); else World.nodeAdj.delete(nid); }
  }
  // segment/bridge/minimap entries reference removed roads; purge lazily
  for (const h of [World.segHash, World.bridgeHash, World.mmHash]) for (const [k, arr] of h.m) { const f = arr.filter(it => !(it.road && it.road.removed)); if (f.length !== arr.length) { if (f.length) h.m.set(k, f); else h.m.delete(k); } }
  for (const id of T.signalIds || []) World.signals.delete(id);
}

const TIMES = (window.GV_TIMES = {});
function TT(n, f) { const t = performance.now(); const r = f(); TIMES[n] = (TIMES[n] || 0) + performance.now() - t; return r; }
async function TTa(n, f) { const t = performance.now(); const r = await f(); TIMES[n] = (TIMES[n] || 0) + performance.now() - t; return r; }
async function buildTile(T) {
  const parcelP = Parcels.get(T.tx, T.ty).catch(() => null); // county parcels load alongside the map data
  const aerialP = Aerial.get(T.tx, T.ty).catch(() => null), ncP = NCBuildings.get(T.tx, T.ty).catch(() => null), canopyP = Canopy.get(T.tx, T.ty).catch(() => null); // real-world layers (03k_realdata.js)
  const data = await getTileData(T.tx, T.ty, T.prio);
  if (Food.extraP) await Promise.race([Food.extraP, sleep(4000)]); // the county's restaurants & stores (places.json)
  await ensureDEM(tileBBox(T.tx, T.ty), T.prio);
  if (T.state === 'gone') return;
  _yieldT = performance.now();
  const P = TT('parseTile', () => parseTile(data, T.tx, T.ty)); await yieldMaybe();
  TT('registerRoads', () => registerRoads(T, P)); await yieldMaybe();
  const late = ms => sleep(ms).then(() => null);
  try { mergeNCBuildings(T, P, await Promise.race([ncP, late(15000)])); } catch (e) { console.warn('NC building footprints skipped', e); } await yieldMaybe();
  T.aerial = await Promise.race([aerialP, late(15000)]); T.canopy = await Promise.race([canopyP, late(8000)]);
  if (T.state === 'gone') { if (T.aerial && T.aerial.close) T.aerial.close(); return; }
  try { T.parcelAdded = applyParcels(T, P, await Promise.race([parcelP, sleep(12000).then(() => null)])); } catch (e) { console.warn('parcels skipped', e); } await yieldMaybe();
  try { prepCivic(T, P); } catch (e) { console.warn('stations skipped', e); }
  TT('paintTerrain', () => paintTerrain(T, P)); if (T.aerial && T.aerial.close) T.aerial.close(); T.aerial = null; await yieldMaybe();
  TT('buildTerrainMesh', () => buildTerrainMesh(T)); await yieldMaybe();
  TT('buildRoadMeshes', () => buildRoadMeshes(T, P)); await yieldMaybe();
  try { TT('buildRails', () => buildRails(T, P)); } catch (e) { console.warn('railway track skipped', e); }
  await TTa('buildBuildings', () => buildBuildings(T, P)); await yieldMaybe();
  try { TT('buildLots', () => buildLots(T, P)); } catch (e) { console.warn('parking lots skipped', e); }
  try { TT('buildBusinessWalks', () => buildBusinessWalks(T, P)); } catch (e) { console.warn('business sidewalks skipped', e); } await yieldMaybe();
  try { TT('buildStadiums', () => buildStadiums(T, P, P.zones || (P.zones = landmarkZones(P)))); } catch (e) { console.warn('stadium skipped', e); } await yieldMaybe();
  try { TT('buildHandmade', () => buildHandmade(T, P)); } catch (e) { console.warn('hand-built landmarks skipped', e); }
  try { TT('buildCivic', () => buildCivic(T, P)); } catch (e) { console.warn('stations skipped', e); }
  try { buildMailboxes(T); } catch (e) { }
  TT('buildTrees', () => buildTrees(T, P)); await yieldMaybe();
  TT('buildSignals', () => buildSignals(T, P));
  TT('buildStreetSigns', () => buildStreetSigns(T, P));
  TT('buildParked', () => buildParked(T, P));
  registerAreas(T, P);
  if (T.state === 'gone') return;
  worldRoot.add(T.group);
}

// ---------- street name signs (green NC-style blades at intersections) ----------
const ABBR = [[/\bStreet\b/g, 'St'], [/\bAvenue\b/g, 'Ave'], [/\bBoulevard\b/g, 'Blvd'], [/\bDrive\b/g, 'Dr'], [/\bRoad\b/g, 'Rd'], [/\bLane\b/g, 'Ln'], [/\bCircle\b/g, 'Cir'], [/\bCourt\b/g, 'Ct'], [/\bPlace\b/g, 'Pl'], [/\bParkway\b/g, 'Pkwy'], [/\bHighway\b/g, 'Hwy'], [/\bExtension\b/g, 'Ext'], [/\bTerrace\b/g, 'Ter'], [/^East\b/, 'E'], [/^West\b/, 'W'], [/^North\b/, 'N'], [/^South\b/, 'S']];
function signText(n) { let s = n; for (const [re, r] of ABBR) s = s.replace(re, r); return s; }
MAT.signMats = new Set();
// where a street-name sign goes at a junction: on the sidewalk just behind a curb corner, never in a road
function signSpot(T, nid, x, z) {
  let arms = T.junctions && T.junctions.get(nid) && T.junctions.get(nid).arms;
  if (!arms) {
    arms = [];
    for (const { road: r, idx } of World.nodeAdj.get(nid) || []) { if (!r.mesh || r.bridge) continue; for (const k of [-1, 1]) { const j = idx + k; if (j < 0 || j >= r.pts.length) continue; const dx = r.pts[j][0] - x, dz = r.pts[j][1] - z, l = Math.hypot(dx, dz); if (l < 0.5) continue; arms.push({ dx: dx / l, dz: dz / l, w: r.w, ang: Math.atan2(dz, dx), segLen: l }); } }
    arms.sort((a, b) => a.ang - b.ang);
  }
  if (arms.length < 2) return null;
  const clear = (px, pz) => { if (insideBuilding(px, pz)) return false; for (const it of World.segHash.query(px - 16, pz - 16, px + 16, pz + 16)) { const r = it.road; if (!r || !r.mesh || r.removed) continue; const a = r.pts[it.i], b = r.pts[it.i + 1]; if (!a || !b) continue; if (segDist(px, pz, a[0], a[1], b[0], b[1]).d < r.w / 2 + 0.8) return false; } return true; };
  const cands = [];
  for (let i = 0; i < arms.length; i++) {
    const a = arms[i], b = arms[(i + 1) % arms.length]; let gap = b.ang - a.ang; if (i === arms.length - 1) gap += Math.PI * 2; if (gap < 0.35) continue;
    const g = Math.min(gap, Math.PI * 0.95); const bis = a.ang + gap / 2; const bx = Math.cos(bis), bz = Math.sin(bis);
    const D = (Math.max(a.w, b.w) / 2 + 1.6) / Math.sin(g / 2);
    if (D > Math.min(a.segLen, b.segLen) + 4 || D > 40) continue;
    cands.push([Math.abs(gap - Math.PI / 2), x + bx * D, z + bz * D]);
  }
  cands.sort((p, q) => p[0] - q[0]);
  for (const c of cands) if (clear(c[1], c[2])) return [c[1], c[2]];
  return null;
}
function buildStreetSigns(T, P) {
  const bb = tileBBox(T.tx, T.ty); const W = T.W;
  const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1;
  const signs = []; const done = new Set();
  for (const id of T.roadIds) {
    const road = World.roads.get(id); if (!road || !road.car || road.bridge) continue;
    for (let i = 0; i < road.nodes.length; i++) {
      const nid = road.nodes[i]; if (done.has(nid)) continue;
      const adj = (World.nodeAdj.get(nid) || []).filter(a => a.road.car && a.road.name && !a.road.bridge && a.road.hw !== 'service');
      const names = [...new Set(adj.map(a => a.road.name))]; if (names.length < 2) continue;
      done.add(nid); const [x, z] = road.pts[i]; if (!own(x, z)) continue;
      const dirOf = (nm) => { const a = adj.find(q => q.road.name === nm); const r = a.road, k = a.idx; const p = r.pts[Math.max(0, k - 1)], q = r.pts[Math.min(r.pts.length - 1, k + 1)]; const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l, r.w]; };
      const d1 = dirOf(names[0]), d2 = dirOf(names[1]);
      const spot = signSpot(T, nid, x, z); if (!spot) continue;
      signs.push({ x: spot[0], z: spot[1], blades: [[signText(names[0]), d1], [signText(names[1]), d2]] });
    }
  }
  if (!signs.length) return;
  // atlas of names
  const CW = 1024, SH = 48, SW = 512, cols = 2; const uniq = [...new Set(signs.flatMap(s => s.blades.map(b => b[0])))];
  const rows = Math.ceil(uniq.length / cols); const CH = Math.min(4096, Math.pow(2, Math.ceil(Math.log2(Math.max(64, rows * SH)))));
  const maxSlots = Math.floor(CH / SH) * cols;
  const c = cnv(CW, CH), g = c.getContext('2d'); const slot = new Map();
  g.font = '600 34px "IBM Plex Sans", "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle';
  uniq.slice(0, maxSlots).forEach((name, k) => {
    const col = k % cols, row = Math.floor(k / cols); const x0 = col * SW, y0 = row * SH;
    let tw = Math.min(SW - 24, g.measureText(name).width); const w = tw + 24;
    g.fillStyle = '#0f6b3a'; g.fillRect(x0, y0, w, SH); g.strokeStyle = '#f4f4f0'; g.lineWidth = 3; g.strokeRect(x0 + 3, y0 + 3, w - 6, SH - 6);
    g.fillStyle = '#f7f7f2'; g.fillText(name, x0 + 12, y0 + SH / 2 + 1, SW - 24);
    slot.set(name, { u0: x0 / CW, u1: (x0 + w) / CW, v0: y0 / CH, v1: (y0 + SH) / CH, len: w / SH * 0.3 });
  });
  const tex = ctex(c, { wrap: false }); tex.flipY = false;
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1, roughness: 0.6, side: THREE.DoubleSide });
  MAT.signMats.add(mat); T.signMat = mat; T.signTex = tex;
  const mb = new MB(); const poles = [];
  for (const s of signs) {
    const gy = H(s.x, s.z); poles.push(s); s.gy = gy; s.v0 = mb.p.length / 3;
    s.blades.forEach(([name, d], k) => {
      const sl = slot.get(name); if (!sl) return;
      const y = gy + 2.75 + k * 0.33; const L = sl.len, hx = d[0] * L / 2, hz = d[1] * L / 2;
      // normal perpendicular to the road; both faces show readable text
      const nx = -d[1], nz = d[0]; const e = 0.012;
      for (const side of [1, -1]) {
        const ox = nx * e * side, oz = nz * e * side;
        const a = [s.x - hx + ox, y - 0.15, s.z - hz + oz], b = [s.x + hx + ox, y - 0.15, s.z + hz + oz], c2 = [s.x + hx + ox, y + 0.15, s.z + hz + oz], dd = [s.x - hx + ox, y + 0.15, s.z - hz + oz];
        if (side === 1) mb.quad(a, b, c2, dd, [sl.u0, sl.v1], [sl.u1, sl.v1], [sl.u1, sl.v0], [sl.u0, sl.v0], [nx, 0, nz]);
        else mb.quad(a, b, c2, dd, [sl.u1, sl.v1], [sl.u0, sl.v1], [sl.u0, sl.v0], [sl.u1, sl.v0], [-nx, 0, -nz]);
      }
    });
    s.v1 = mb.p.length / 3;
  }
  const geo = mb.geo(); let plates = null; if (geo) { plates = new THREE.Mesh(geo, mat); plates.castShadow = true; T.group.add(plates); }
  const pg = new THREE.CylinderGeometry(0.04, 0.05, 3.4, 6); pg.translate(0, 1.7, 0);
  const im = new THREE.InstancedMesh(pg, MAT.lampPole, poles.length); const M = new THREE.Matrix4();
  poles.forEach((s, i) => {
    M.makeTranslation(s.x, s.gy, s.z); im.setMatrixAt(i, M);
    const ob = knockable(T, { x: s.x, z: s.z, r: 0.12 }, { kind: 'sign', ims: [im], idx: i, mass: 40, min: 3, f: 0.6, plate: plates && s.v1 > s.v0 ? { mesh: plates, v0: s.v0, v1: s.v1 } : null });
    T.hashItems.push([World.obsHash, World.obsHash.insert(ob, s.x - .2, s.z - .2, s.x + .2, s.z + .2)]);
  });
  im.castShadow = true; T.group.add(im);
}
