// =====================================================================
// REAL-WORLD LAYERS for each map square (all public data):
//   • Aerial — USGS National Map NAIP imagery (USDA summer aerial photos, ~0.6 m, public domain),
//     draped on the ground in place of the painted land-use colours.
//   • NCBuildings — NC Emergency Management's statewide building footprints (NC Risk Building
//     Footprints: every structure, with occupancy type). Adds the buildings OpenStreetMap is missing
//     (most of rural Pitt County). Its storey counts are not used: they made tall blocks out of houses.
//   • Canopy — tree canopy heights from Meta / WRI's 1 m canopy height map, pre-processed per square
//     by tools/fetch-canopy.mjs into public-data/canopy/ (see fetch-canopy.cmd). Trees are placed on
//     the real tree tops at their real heights.
// Everything is saved on this PC after the first download, and the game falls back to its own
// guesses for any square where a layer can't be had.
// =====================================================================
const AERIAL_SRC = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
const NCBLD_SRC = 'https://services1.arcgis.com/YBWrN5qiESVpqi92/ArcGIS/rest/services/NC_Risk_Building_Footprints/FeatureServer/0/query';
const REAL = { aerial: true, buildings: true, canopy: true };

async function fetchTimeout(url, ms, opt = {}) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, Object.assign({ signal: ctl.signal }, opt)); } finally { clearTimeout(to); }
}
function limiter(n) { let active = 0; const q = []; const next = () => { if (active >= n || !q.length) return; active++; const [f, res, rej] = q.shift(); f().then(res, rej).finally(() => { active--; next(); }); }; return f => new Promise((res, rej) => { q.push([f, res, rej]); next(); }); }

const Aerial = {
  SIZE: 1024, errors: 0, run: limiter(3),
  async get(tx, ty) {
    if (!REAL.aerial || this.errors > 12) return null;
    const key = 'aerial:v1:' + this.SIZE + ':' + tileKey(tx, ty);
    let buf = await Store.get('meta', key);
    if (!buf) {
      const b = tileBBox(tx, ty);
      const q = new URLSearchParams({ bbox: `${b.w},${b.s},${b.e},${b.n}`, bboxSR: 4326, imageSR: 4326, size: `${this.SIZE},${this.SIZE}`, format: 'jpg', compressionQuality: 78, interpolation: 'RSP_BilinearInterpolation', f: 'image' });
      try {
        buf = await this.run(async () => { const r = await fetchTimeout(AERIAL_SRC + '?' + q, 25000); if (!r.ok || !/image/.test(r.headers.get('content-type') || '')) throw new Error('aerial ' + r.status); return await r.arrayBuffer(); });
        this.errors = 0; Store.put('meta', key, buf);
      } catch (e) { this.errors++; console.warn('aerial photo unavailable for', tx, ty, e.message || e); return null; }
    }
    try { return await createImageBitmap(new Blob([buf], { type: 'image/jpeg' })); } catch (e) { Store.del('meta', key); return null; }
  },
};

// ---- NC Risk Building Footprints ----
// occupancy code → HAZUS class (code % 1000, low-confidence codes are offset by 335)
const NC_OCC = (() => { const s = '0:AGR1 5:COM1 10:COM10 15:COM2 20:COM3 25:COM4 30:COM5 35:COM6 40:COM7 45:COM8 50:COM9 55:EDU1 60:EDU2 95:GOV1 100:GOV2 105:IND1 110:IND2 115:IND3 120:IND4 125:IND5 130:IND6 240:REL1 245:RES1 250:RES2 255:RES3 260:RES3 265:RES3 270:RES3 275:RES3 280:RES3 285:RES4 290:RES5 295:RES6'; const m = {}; for (const p of s.split(' ')) { const [k, v] = p.split(':'); m[k] = v; } return m; })();
function ncOcc(code) { const c = parseInt(code); if (!(c >= 1000)) return ''; let b = c % 1000; if (b >= 335) b -= 335; return NC_OCC[b] || 'OTHER'; }
function ncStories(code) { const c = parseInt(code); if (!(c >= 1000)) return 0; let b = c % 1000; if (b >= 70) b -= 70; return { 0: 1, 1: 1.5, 10: 2, 20: 3, 30: 4, 40: 5, 50: 6, 60: 1.5 }[b] || 0; }
const NCBuildings = {
  errors: 0, run: limiter(2),
  async get(tx, ty) {
    if (!REAL.buildings || this.errors > 12) return null;
    const key = 'ncbld:v1:' + tileKey(tx, ty);
    try { const buf = await Store.get('meta', key); if (buf) return JSON.parse(await gunzip(buf)); } catch (e) { }
    try {
      const out = await this.run(async () => {
        const b = tileBBox(tx, ty); const rows = []; let off = 0;
        for (let page = 0; page < 15; page++) {
          const q = new URLSearchParams({
            where: '1=1', geometry: `${b.w},${b.s},${b.e},${b.n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, outSR: 4326, spatialRel: 'esriSpatialRelIntersects',
            outFields: 'NUM_STORY,OCCUP_TYPE,YEAR_BUILT,HTD_SQ_FT', returnGeometry: true, geometryPrecision: 6, resultOffset: off, resultRecordCount: 2000, orderByFields: 'OBJECTID', f: 'json',
          });
          const r = await fetchTimeout(NCBLD_SRC + '?' + q, 30000); if (!r.ok) throw new Error('buildings ' + r.status);
          const j = await r.json(); if (j.error) throw new Error(j.error.message || 'building query failed');
          for (const f of j.features || []) {
            const a = f.attributes, g = f.geometry; if (!g || !g.rings || !g.rings.length) continue;
            const ring = g.rings[0]; const flat = []; for (let i = 0; i < ring.length - 1; i++) flat.push(+ring[i][1].toFixed(6), +ring[i][0].toFixed(6));
            rows.push([ncStories(a.NUM_STORY), ncOcc(a.OCCUP_TYPE), parseInt(a.YEAR_BUILT) || 0, a.HTD_SQ_FT || 0, flat]);
          }
          if (!j.exceededTransferLimit || !(j.features || []).length) break; off += j.features.length;
        }
        return { v: 1, rows };
      });
      this.errors = 0; try { await Store.put('meta', key, await gzip(JSON.stringify(out))); } catch (e) { }
      return out;
    } catch (e) { this.errors++; console.warn('NC building footprints unavailable for', tx, ty, e.message || e); return null; }
  },
};
// OSM building type for a HAZUS occupancy class. Only the broad kind is trusted (home, farm building,
// warehouse, store, church): the statewide survey's office / hotel / hospital / campus classes and its
// storey counts are too often wrong for small buildings, which put tall office blocks on residential
// streets. Everything else comes out as a plain low building sized by its footprint.
function ncBuildingType(occ, area) {
  switch (occ) {
    case 'RES1': return area < 38 ? 'shed' : 'house';
    case 'RES2': return 'static_caravan';
    case 'RES3': return area < 260 ? 'semidetached_house' : 'apartments';
    case 'COM1': return 'retail';
    case 'COM2': return 'warehouse';
    case 'REL1': return 'church';
    case 'AGR1': return area < 60 ? 'shed' : 'barn';
    case 'IND1': case 'IND2': case 'IND3': case 'IND4': case 'IND5': case 'IND6': return 'industrial';
    default: return area < 45 ? 'shed' : area < 280 ? 'house' : 'yes';
  }
}
// add the footprints OSM is missing (heights are left to the game's own rules, not the survey's storeys)
function mergeNCBuildings(T, P, data) {
  if (!data || !data.rows || !data.rows.length) return 0;
  const W = T.W; const bl = new SpatialHash(30); const ringBox = r => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const q of r) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); } return [x0, z0, x1, z1]; };
  for (const B of P.buildings) { if (B.ring.length < 3) continue; const bb = ringBox(B.ring); B._c = centroid(B.ring); bl.insert(B, ...bb); }
  const park = P.areas.filter(a => a.kind === 'parking' && a.rings.length);
  let added = 0, matched = 0;
  data.rows.forEach(([st, occ, year, sqft, flat], i) => {
    const ring = []; for (let k = 0; k < flat.length; k += 2) ring.push([lonToX(flat[k + 1]), latToZ(flat[k])]);
    if (ring.length < 3) return; const area = Math.abs(signedArea(ring)); if (area < 8 || area > 60000) return;
    const [cx, cz] = centroid(ring); if (!(cx >= W.x0 && cx < W.x1 && cz >= W.z0 && cz < W.z1)) return;
    const bb = ringBox(ring); let hit = null;
    const bbA = (bb[2] - bb[0]) * (bb[3] - bb[1]);
    for (const B of bl.query(...bb)) {
      if (pointInPoly(cx, cz, B.ring) || pointInPoly(B._c[0], B._c[1], ring)) { hit = B; break; }
      const ob = B._bb || (B._bb = ringBox(B.ring)); const ox = Math.min(bb[2], ob[2]) - Math.max(bb[0], ob[0]), oz = Math.min(bb[3], ob[3]) - Math.max(bb[1], ob[1]);
      if (ox > 0 && oz > 0 && ox * oz > 0.3 * Math.min(bbA, (ob[2] - ob[0]) * (ob[3] - ob[1]))) { hit = B; break; } // overlapping outlines: same building
    }
    if (hit) { // OSM already has it: only say it's a home when OSM just says "yes"
      matched++; const t = hit.tags;
      if ((t.building === 'yes' || !t.building) && /^RES[12]$/.test(occ) && !hit.part) t.building = ncBuildingType(occ, area);
      return;
    }
    // footprints are from 2009–12: skip ones now under a road or a mapped parking lot (demolished since)
    if (onRoadSurface(cx, cz)) return;
    if (park.some(a => pointInPoly(cx, cz, a.rings[0]))) return;
    const tags = { building: ncBuildingType(occ, area), source: 'NCEM' }; if (year > 1700) tags.start_date = String(year);
    const B = { id: -(T.tx * 1e7 + T.ty * 1e4 + i + 1) * 10, tags, ring, holes: [], part: false, nc: true }; B._c = [cx, cz];
    P.buildings.push(B); bl.insert(B, ...bb); added++;
  });
  T.ncAdded = added; T.ncMatched = matched;
  return added;
}

// ---- canopy heights (pre-processed per square) ----
const Canopy = {
  N: 256, index: null,
  base() { return window.GV_DATA ? window.GV_DATA + 'canopy/' : 'public-data/canopy/'; },
  async get(tx, ty) {
    if (!REAL.canopy) return null;
    if (!this.index) this.index = fetchTimeout(this.base() + 'index.json', 15000).then(r => r.ok ? r.json() : []).then(a => new Set(a)).catch(() => new Set());
    const idx = await this.index; const name = `${tx}_${ty}`; if (!idx.has(name)) return null;
    try {
      const r = await fetchTimeout(this.base() + name + '.bin.gz', 20000); if (!r.ok) return null;
      let buf = new Uint8Array(await r.arrayBuffer());
      if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      return buf.length === this.N * this.N ? buf : null;
    } catch (e) { return null; }
  },
};

// ---- what each building is made of, from the Pitt County tax records ----
// tools/fetch-pitt-buildings.mjs saves, per map square, every parcel that has a building with the county's
// building cards (exterior walls, roof, style, storeys, year built). Each OpenStreetMap / NC building is matched
// to the parcel it stands in and gets those as tags before the builders run, so a brick ranch is brick with a
// hip roof, a vinyl two-storey is vinyl, a metal shop building is metal, and so on — for the whole county.
const PittRecords = {
  index: null,
  base() { return window.GV_DATA ? window.GV_DATA + 'pittbld/' : 'public-data/pittbld/'; },
  async get(tx, ty) {
    if (!this.index) this.index = fetchTimeout(this.base() + 'index.json', 15000).then(r => r.ok ? r.json() : []).then(a => new Set(a)).catch(() => new Set());
    const idx = await this.index; const name = `${tx}_${ty}`; if (!idx.has(name)) return null;
    try {
      const r = await fetchTimeout(this.base() + name + '.json.gz', 20000); if (!r.ok) return null;
      let buf = new Uint8Array(await r.arrayBuffer());
      if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const list = JSON.parse(new TextDecoder().decode(buf)); const lon0 = LON0 + tx * TLON, lat0 = LAT0 + ty * TLAT;
      return list.map(([cards, flat, pn]) => { const ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([lonToX(lon0 + flat[i] / 1e6), latToZ(lat0 + flat[i + 1] / 1e6)]); return { cards, ring, pn }; });
    } catch (e) { return null; }
  },
};
// county codes → OpenStreetMap-style tags the builders understand
function pittWall(w) {
  if (/^(FACE-BRK|COM-BRK|UTY-BRK|BK\/MASO|BK\/WOOD|BK\/STUCO|BK\/PFMET|BK\/BLOCK)$/.test(w) || /BRK|BRICK/.test(w)) return { mat: 'brick' };
  if (w === 'BK/VINYL') return { mat: 'vinyl', skirt: true };                                   // brick skirt, vinyl above
  if (/METAL|PRE-FAB|S-MAX/.test(w)) return { mat: 'metal' };
  if (/CONC|CM-|BLOCK|PRE-PAN/.test(w)) return { mat: 'concrete' };
  if (/STUC/.test(w)) return { mat: 'plaster' };
  if (/CED|WD|WOOD|SHING|SHIN/.test(w)) return { mat: 'wood' };
  if (/VINYL|SID|MASONITE|COMP|ALUM/.test(w)) return { mat: 'vinyl' };
  return null;
}
function pittRoof(r) { return r === 'HIP' || r === 'GAM/MANS' ? 'hipped' : r === 'GABLE' || r === 'SHED' ? 'gabled' : /FLAT|RF-CONC|BAR-JST|STEEL-FR/.test(r) ? 'flat' : ''; }
function applyPittRecords(T, P, list, F) {
  if (!list || !list.length) return 0;
  const H2 = new SpatialHash(30); for (const p of list) { H2.insert(p, ...ringBB(p.ring)); p.blds = []; }
  for (const B of P.buildings) {
    if (B.part || B.food || B.ring.length < 3) continue; const a = Math.abs(signedArea(B.ring)); if (a < 30) continue; // sheds keep their own look
    const [x, z] = centroid(B.ring); let best = null;
    for (const p of H2.query(x, z, x, z)) if (pointInPoly(x, z, p.ring) && (!best || Math.abs(signedArea(p.ring)) < Math.abs(signedArea(best.ring)))) best = p;
    if (best) best.blds.push([a, B]);
  }
  let n = 0;
  for (const p of list) {
    if (!p.blds.length) continue; p.blds.sort((u, v) => v[0] - u[0]);
    p.blds.forEach(([, B], i) => {
      const c = p.cards[Math.min(i, p.cards.length - 1)]; if (!c || (i >= p.cards.length && i > 0)) return; // more buildings than cards: the extras are outbuildings
      const [wall, roof, style, story, year] = c; const t = B.tags; const w = pittWall(wall);
      if (w && !t['building:material'] && !t['building:facade:material']) { t['building:material'] = w.mat; if (w.skirt) t['pitt:skirt'] = '1'; }
      const rs = pittRoof(roof); if (rs && !t['roof:shape']) t['roof:shape'] = rs;
      if (story > 0 && !t['building:levels'] && !t.height) t['building:levels'] = String(Math.max(1, Math.floor(story + 0.4)));
      if (year > 1700 && !t.start_date) t.start_date = String(year);
      if (/MANF-HM/.test(style) && (!t.building || t.building === 'yes' || t.building === 'house')) t.building = 'static_caravan';
      B.pitt = { wall, roof, style, story, year, parcel: p.pn }; n++;
      const f = i === 0 && F && p.pn && F['p' + p.pn]; if (f) { if (f.mat) t['building:material'] = f.mat; if (f.colour && f.mat !== 'brick') t['building:colour'] = f.colour; if (f.levels) t['building:levels'] = String(f.levels); if (f.roof) t['roof:colour'] = f.roof; if (f.roofShape) t['roof:shape'] = f.roofShape; B.facade = f; } // photo-read look for the parcel's main building
    });
  }
  return n;
}

// ---- what named buildings really look like, read off street-level photos ----
// public-data/facades.json: { "<OpenStreetMap way id>" or "p<county parcel number>": { mat, colour, levels, roof, roofShape, note } } — filled in from
// Mapillary photos (tools/fetch-mapillary.mjs + tools/mapillary-sheets.py). mat is brick | vinyl | wood | metal |
// plaster (stucco / painted block) | glass | concrete; colour is the wall colour (ignored for bare brick).
const Facades = { p: null, get() { if (!this.p) this.p = fetchTimeout((window.GV_DATA || 'public-data/') + 'facades.json', 15000).then(r => r.ok ? r.json() : {}).catch(() => ({})); return this.p; } };
function applyFacades(P, F) {
  if (!F) return 0; let n = 0;
  for (const B of P.buildings) {
    const f = F[B.id]; if (!f) continue; const t = B.tags;
    if (f.mat) t['building:material'] = f.mat; if (f.colour && f.mat !== 'brick') t['building:colour'] = f.colour;
    if (f.levels) t['building:levels'] = String(f.levels); if (f.roof) t['roof:colour'] = f.roof; if (f.roofShape) t['roof:shape'] = f.roofShape;
    B.facade = f; n++;
  }
  return n;
}
