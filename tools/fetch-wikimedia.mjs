// Photos of Pitt County's notable places from Wikimedia Commons (free to use; each photo's author and licence are
// kept in .cache/wikimedia/credits.json). For each place in public-data/notable-places.json (tools/notable-places.mjs)
// it looks for photos taken within a short distance of it, and also for photos whose title names it, then downloads
// up to six 1024 px versions to .cache/wikimedia/img/ and lays them out on contact sheets (tools/mapillary-sheets.py --src wikimedia).
// They're used as reference when the place is modelled by hand. No account or key needed.
//   node tools/fetch-wikimedia.mjs [--top 300] [--only "name pattern"] [--places other-list.json]            (or double-click fetch-wikimedia.cmd)
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TOP = +arg('top', 300);
const ONLY = arg('only', ''); // a name pattern, e.g. --only "Courthouse|City Hall"
const places = JSON.parse(fs.readFileSync(arg('places', path.join(root, 'public-data', 'notable-places.json')), 'utf8')).filter(p => !ONLY || new RegExp(ONLY, 'i').test(p.name)).slice(0, TOP);
const cache = path.join(root, '.cache', 'wikimedia'), imgDir = path.join(cache, 'img'); fs.mkdirSync(imgDir, { recursive: true });
const picksFile = path.join(cache, 'picks.json'), credFile = path.join(cache, 'credits.json');
const picks = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, 'utf8')) : {};
const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : {};
const UA = { 'User-Agent': 'GreenvilleOpenWorld/1.0 (hobby game of Pitt County NC; https://github.com/bgates284/-greenville-open-world)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const API = 'https://commons.wikimedia.org/w/api.php';
async function api(params) {
  const u = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  for (let k = 1; k <= 4; k++) { try { const r = await fetch(u, { headers: UA }); if (r.status === 429) { await sleep(5000 * k); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) { if (k === 4) throw e; await sleep(1500 * k); } }
}
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const IMGINFO = { prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1024', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal|ImageDescription' };
const M_LAT = 110574, M_LON = 111320 * Math.cos(35.6 * Math.PI / 180);
const TOWNS = /Winterville|Ayden|Farmville|Grifton|Bethel|Fountain|Falkland|Grimesland|Simpson|Stokes|Bell Arthur/i;

let nPlaces = 0, nImgs = 0;
for (const p of places) {
  const key = p.osm.replace('/', '_');
  if (picks[key] && picks[key].images.every(im => fs.existsSync(path.join(imgDir, im.file)))) { nPlaces++; nImgs += picks[key].images.length; continue; }
  const found = new Map();
  try { // photos taken near it
    const j = await api({ action: 'query', generator: 'geosearch', ggscoord: `${p.lat}|${p.lon}`, ggsradius: String(Math.max(60, Math.min(500, p.r + 70))), ggsnamespace: '6', ggslimit: '30', ...IMGINFO });
    for (const pg of (j.query && j.query.pages) || []) found.set(pg.title, pg);
  } catch (e) { console.log(`  ${p.name}: nearby search failed (${e.message})`); }
  await sleep(400);
  try { // photos named after it
    const town = TOWNS.test(p.name) ? '' : ' Greenville';
    const j = await api({ action: 'query', generator: 'search', gsrsearch: `"${p.name}"${town} North Carolina`, gsrnamespace: '6', gsrlimit: '15', ...IMGINFO });
    for (const pg of (j.query && j.query.pages) || []) if (!found.has(pg.title)) { pg._byName = true; found.set(pg.title, pg); }
  } catch (e) { console.log(`  ${p.name}: name search failed (${e.message})`); }
  await sleep(400);
  // rank: photos (not maps / logos / scans), closest first, ones with the name in the title first
  const words = p.name.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const cand = [];
  for (const pg of found.values()) {
    const ii = pg.imageinfo && pg.imageinfo[0]; if (!ii || !/jpe?g|png|webp/.test(ii.mime || '') || !ii.thumburl) continue;
    if (/map|logo|seal|flag|diagram|svg|plan\b|chart|coat of arms/i.test(pg.title) || (ii.width && ii.width < 500)) continue;
    const c = pg.coordinates && pg.coordinates[0]; const d = c ? Math.hypot((c.lon - p.lon) * M_LON, (c.lat - p.lat) * M_LAT) : 9999;
    if (pg._byName && c && d > 3000) continue; // same name somewhere else
    if (pg._byName && !c && !/N\.? ?C\b|North Carolina|Pitt County|Greenville, NC/i.test(pg.title)) continue; // no location: only if the title says it's here (there are many Greenvilles)
    const named = words.filter(w => pg.title.toLowerCase().includes(w)).length;
    cand.push({ pg, ii, d, score: (c ? d : 400) - named * 120 });
  }
  cand.sort((a, b) => a.score - b.score);
  const images = [];
  for (const c of cand.slice(0, 6)) {
    const file = `${key}_${images.length}.jpg`; const fp = path.join(imgDir, file);
    if (!fs.existsSync(fp)) { try { const r = await fetch(c.ii.thumburl, { headers: UA }); if (!r.ok) continue; fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer())); await sleep(250); } catch { continue; } }
    const m = c.ii.extmetadata || {};
    credits[file] = { title: c.pg.title, page: c.ii.descriptionurl, author: strip(m.Artist && m.Artist.value), licence: strip(m.LicenseShortName && m.LicenseShortName.value) };
    images.push({ file, title: c.pg.title.replace(/^File:/, ''), dist: c.d < 9999 ? Math.round(c.d) : -1, year: +(strip(m.DateTimeOriginal && m.DateTimeOriginal.value).slice(0, 4)) || 0 });
  }
  if (images.length) { picks[key] = { id: key, name: p.name, kind: p.kind, score: p.score, lat: p.lat, lon: p.lon, tile: String(1000 - Math.round(p.score * 10)).padStart(4, '0'), images }; nPlaces++; nImgs += images.length; }
  console.log(`${String(p.score).padStart(5)} ${p.name}: ${images.length} photos`);
  if (nPlaces % 10 === 0) { fs.writeFileSync(picksFile, JSON.stringify(picks)); fs.writeFileSync(credFile, JSON.stringify(credits, null, 1)); }
}
fs.writeFileSync(picksFile, JSON.stringify(picks)); fs.writeFileSync(credFile, JSON.stringify(credits, null, 1));
console.log(`Done: ${nPlaces} of ${places.length} places have photos (${nImgs} photos) → .cache/wikimedia/. Next: python tools/mapillary-sheets.py --src wikimedia`);
