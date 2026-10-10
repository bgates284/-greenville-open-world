// The notable places of Pitt County, ranked — the list the hand-built landmarks and the photo fetchers work from.
// Reads the packed map squares (public-data/osm) and scores every named feature: a Wikipedia / Wikidata entry,
// historic or tourist status, civic and religious buildings, schools and colleges, parks and stadiums, big stores
// and anything large. Writes public-data/notable-places.json:
//   [{ key, name, kind, lat, lon, r (metres), score, osm: "way/123", wikidata?, wikipedia?, handBuilt? }, ...]
//   node tools/notable-places.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd(); const G = gridHelpers(root); const CTY = G.COUNTY;
// the county's real outline, roughly: cells of ~200 m that hold Pitt County parcels (public-data/pittbld)
const inPitt = (() => { const pd = path.join(root, 'public-data', 'pittbld'); if (!fs.existsSync(pd)) return () => true; const cells = new Set(); const C = 0.002;
  for (const f of fs.readdirSync(pd).filter(f => /^-?\d+_-?\d+\.json\.gz$/.test(f))) { const [tx, ty] = f.replace('.json.gz', '').split('_').map(Number); const lon0 = G.LON0 + tx * G.TLON, lat0 = G.LAT0 + ty * G.TLAT;
    for (const [, flat] of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(pd, f))))) cells.add(Math.floor((lat0 + flat[1] / 1e6) / C) + ',' + Math.floor((lon0 + flat[0] / 1e6) / C)); }
  return (lat, lon) => { const a = Math.floor(lat / C), b = Math.floor(lon / C); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (cells.has((a + i) + ',' + (b + j))) return true; return false; }; })(); const dir = path.join(root, 'public-data', 'osm');
const M_LAT = 110574, M_LON = 111320 * Math.cos(35.6 * Math.PI / 180);
// already modelled by hand (04f_landmarks / 04g_handmade / 04h_civic / 04k_ecu / 04l_pcc / 03j_airport)
const HAND = /^(The Cupola|Joyner Library|Greenville Amphitheater|Greenville Mall|Student Center|Dowdy-Ficklen Stadium|ECU Health Medical Center|Local Oak.*|Pitt-Greenville Airport|Town Common|Winterville Public Library)$/i;
const KIND = t => t.historic ? 'historic' : t.tourism ? 'tourism' : t.amenity === 'place_of_worship' ? 'worship'
  : /^(townhall|courthouse|library|fire_station|police|post_office|community_centre|arts_centre|theatre|cinema)$/.test(t.amenity || '') ? 'civic'
  : /^(university|college|school)$/.test(t.amenity || '') ? 'school' : /^(hospital|clinic)$/.test(t.amenity || '') ? 'health'
  : /^(park|stadium|sports_centre|golf_course|nature_reserve|marina)$/.test(t.leisure || '') ? 'leisure'
  : t.shop || /^(restaurant|fast_food|cafe|bar|pub|fuel|bank)$/.test(t.amenity || '') ? 'business' : t.building ? 'building' : 'other';
const score = (t, area) => {
  let s = 0;
  if (t.wikidata) s += 6; if (t.wikipedia) s += 4; if (t.historic) s += 4; if (t.tourism && !/^(hotel|motel|guest_house|hostel|apartment|camp_site|caravan_site|information|picnic_site|viewpoint)$/.test(t.tourism)) s += 3; if (t.heritage || t['ref:nrhp']) s += 4;
  if (/^(townhall|courthouse|library|theatre|arts_centre|university|college)$/.test(t.amenity || '')) s += 4;
  if (t.amenity === 'place_of_worship') s += 2; if (t.amenity === 'school') s += 1.5; if (/^(stadium|park|marina)$/.test(t.leisure || '')) s += 2;
  if (/^(supermarket|department_store|mall|hardware|doityourself)$/.test(t.shop || '')) s += 1.5;
  if (t.brand) s += 0.5; if (t.website) s += 0.5;
  s += Math.min(4, Math.log10(1 + area / 100)); // big things are noticed
  return Math.round(s * 10) / 10;
};
const seen = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json.gz'))) {
  let j; try { j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))); } catch { continue; }
  for (const e of j.elements) {
    const t = e.tags; if (!t || !t.name) continue;
    if (t.highway || t.waterway || t.railway || t.boundary || t.landuse === 'residential' || t.place || t.route || t.power || t.natural === 'water' && !t.wikidata) continue;
    const k = KIND(t); if (k === 'other' && !t.wikidata && !t.historic) continue;
    let lat, lon, area = 0, r = 15;
    if (e.type === 'node') { lat = e.lat; lon = e.lon; }
    else if (e.geometry && e.geometry.length) {
      const g = e.geometry.filter(Boolean).map(p => [p.lon, p.lat]); if (!g.length) continue;
      lon = g.reduce((s, p) => s + p[0], 0) / g.length; lat = g.reduce((s, p) => s + p[1], 0) / g.length;
      for (let i = 0, q = g.length - 1; i < g.length; q = i++) area += (g[q][0] - g[i][0]) * M_LON * (g[q][1] + g[i][1]) * M_LAT / 2; area = Math.abs(area);
      r = 0; for (const p of g) r = Math.max(r, Math.hypot((p[0] - lon) * M_LON, (p[1] - lat) * M_LAT));
    } else if (e.bounds) { lat = (e.bounds.minlat + e.bounds.maxlat) / 2; lon = (e.bounds.minlon + e.bounds.maxlon) / 2; r = Math.hypot((e.bounds.maxlon - e.bounds.minlon) * M_LON, (e.bounds.maxlat - e.bounds.minlat) * M_LAT) / 2; area = r * r * 2; }
    else continue;
    if (CTY && (lat < CTY.s || lat > CTY.n || lon < CTY.w || lon > CTY.e)) continue; if (!inPitt(lat, lon)) continue; // Pitt County only
    if (t.landuse === 'cemetery' || t.amenity === 'grave_yard' || t.amenity === 'prison') continue;
    const key = `${e.type}/${e.id}`; const s = score(t, area);
    const prev = seen.get(key); if (prev && prev.score >= s) continue;
    seen.set(key, { key, name: t.name, kind: k, lat: +lat.toFixed(6), lon: +lon.toFixed(6), r: Math.round(Math.min(r, 400)), score: s, osm: key, wikidata: t.wikidata, wikipedia: t.wikipedia, handBuilt: HAND.test(t.name) || undefined });
  }
}
// well-known places the map has as unnamed outlines (name, outline, rank)
const SEEDS = [
  { name: 'Pitt County Courthouse', osm: 'way/1140389745', lat: 35.61372, lon: -77.37289, r: 45, kind: 'civic', score: 9 },
];
for (const s of SEEDS) seen.set(s.osm, { key: s.osm, ...s });
// one entry per name+place (a church mapped as both a node and a building, etc.): keep the best
const best = new Map();
for (const p of seen.values()) { const k = p.name.toLowerCase() + '@' + Math.round(p.lat * 500) + ',' + Math.round(p.lon * 500); const q = best.get(k); if (!q || p.score > q.score || (p.score === q.score && p.osm.startsWith('way'))) best.set(k, p); }
const list = [...best.values()].sort((a, b) => b.score - a.score);
fs.writeFileSync(path.join(root, 'public-data', 'notable-places.json'), JSON.stringify(list, null, 0).replace(/\},\{/g, '},\n{'));
const kinds = {}; for (const p of list) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
console.log(`${list.length} named places ranked → public-data/notable-places.json`, kinds);
console.log('Top 60:'); for (const p of list.slice(0, 90)) console.log(`  ${p.score.toFixed(1).padStart(5)}  ${p.kind.padEnd(9)} ${p.name}${p.handBuilt ? '  (hand-built)' : ''}`);
