// =====================================================================
// REAL-WORLD LAYERS for each map square (all public data):
//   • Aerial — USGS National Map NAIP imagery (USDA summer aerial photos, ~0.6 m, public domain),
//     draped on the ground in place of the painted land-use colours.
//   • NCBuildings — NC Emergency Management's statewide building footprints (NC Risk Building
//     Footprints: every structure, with number of storeys and occupancy type). Adds the buildings
//     OpenStreetMap is missing (most of rural Pitt County) and gives mapped ones their storeys.
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
// OSM building type for a HAZUS occupancy class
function ncBuildingType(occ, area) {
  switch (occ) {
    case 'RES1': return area < 38 ? 'shed' : 'house';
    case 'RES2': return 'static_caravan';
    case 'RES3': return area < 260 ? 'semidetached_house' : 'apartments';
    case 'RES4': return 'hotel';
    case 'RES5': case 'RES6': return 'dormitory';
    case 'COM1': return 'retail';
    case 'COM2': return 'warehouse';
    case 'COM3': case 'COM8': case 'COM9': return 'commercial';
    case 'COM4': case 'COM5': case 'COM7': case 'GOV1': case 'GOV2': return 'office';
    case 'COM6': return 'hospital';
    case 'COM10': return 'parking';
    case 'EDU1': return 'school';
    case 'EDU2': return 'university';
    case 'REL1': return 'church';
    case 'AGR1': return area < 60 ? 'shed' : 'barn';
    case 'IND1': case 'IND2': case 'IND3': case 'IND4': case 'IND5': case 'IND6': return 'industrial';
    default: return area < 45 ? 'shed' : area < 300 ? 'yes' : 'commercial';
  }
}
// add the footprints OSM is missing; give matched OSM buildings their storeys
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
    if (hit) { // OSM already has it: just the storeys (and a type if OSM only says "yes")
      matched++; const t = hit.tags;
      if (st > 0 && !t['building:levels'] && !t.height && !hit.part) t['building:levels'] = String(st);
      if ((t.building === 'yes' || !t.building) && occ && occ !== 'OTHER' && !hit.part) t.building = ncBuildingType(occ, area);
      return;
    }
    // footprints are from 2009–12: skip ones now under a road or a mapped parking lot (demolished since)
    if (onRoadSurface(cx, cz)) return;
    if (park.some(a => pointInPoly(cx, cz, a.rings[0]))) return;
    const tags = { building: ncBuildingType(occ, area), source: 'NCEM' }; if (st > 0) tags['building:levels'] = String(st); if (year > 1700) tags.start_date = String(year);
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
