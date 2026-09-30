// Real tree canopy for every map square of Pitt County, from Meta / World Resources Institute's
// 1-metre global canopy height map (public, on AWS open data: s3://dataforgood-fb-data/forests/v1).
// For each ~1.1 km map square it reads just that window of the big cloud-optimised GeoTIFFs,
// keeps the tallest tree in every ~4.3 m cell (256×256 per square) and saves it to
//   public-data/canopy/<tx>_<ty>.bin.gz   (bytes = canopy height × 4, so 0.25 m steps, 0 = no tree)
// The game places its trees from these (04_world.js buildTrees) and falls back to land-use guesses
// where a square has none.
//   npm run fetch-canopy                 → all of Pitt County (resumes where it left off)
//   npm run fetch-canopy -- --probe      → just print what the source files look like
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gridHelpers } from './pack-data.mjs';

const root = process.cwd();
const G = gridHelpers(root);
const out = path.join(root, 'public-data', 'canopy'); fs.mkdirSync(out, { recursive: true });
const logFile = path.join(root, 'fetch-canopy.log');
const log = (...a) => { const s = a.join(' '); console.log(s); try { fs.appendFileSync(logFile, s + '\n'); } catch { } };
const BASE = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/';
const N = 256;

let fromUrl;
try { ({ fromUrl } = await import('geotiff')); }
catch (e) { log('The "geotiff" package is missing — run "npm install" first (fetch-canopy.cmd does this for you).'); process.exit(1); }

// ---- quadkeys (zoom 9 web-mercator tiles) of the source files ----
const Z = 9;
function tileXY(lat, lon) { const x = (lon + 180) / 360, s = Math.sin(lat * Math.PI / 180), y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); const n = 2 ** Z; return [Math.floor(x * n), Math.floor(y * n)]; }
function quadkey(tx, ty) { let q = ''; for (let i = Z; i > 0; i--) { let d = 0; const m = 1 << (i - 1); if (tx & m) d += 1; if (ty & m) d += 2; q += d; } return q; }
const merc = (lat, lon) => [lon * 20037508.342789244 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];

const sources = new Map(); // quadkey -> { image, bbox:[minx,miny,maxx,maxy], w, h, nodata }
async function source(qk) {
  if (sources.has(qk)) return sources.get(qk);
  const p = (async () => {
    const tiff = await fromUrl(BASE + qk + '.tif', { cacheSize: 4096 });
    const image = await tiff.getImage();
    const s = { tiff, image, bbox: image.getBoundingBox(), w: image.getWidth(), h: image.getHeight(), nodata: image.getGDALNoData(), bps: image.getBitsPerSample(), fmt: image.getSampleFormat ? image.getSampleFormat() : '?' };
    return s;
  })().catch(e => { sources.delete(qk); throw e; });
  sources.set(qk, p); return p;
}

// ---- one row of map squares at a time ----
// The source files are stored as full-width strips, so a whole row ("band") of squares is read in one
// go per source file and then cut up — every strip is downloaded and decoded only once.
async function readBand(ty, w, e) {
  const b = G.tileBBox(0, ty); const parts = [];
  const qks = new Set(); for (const la of [b.s, b.n]) for (let lo = w; lo <= e + 0.3; lo += 0.3) qks.add(quadkey(...tileXY(la, Math.min(lo, e))));
  for (const qk of qks) {
    const S = await source(qk); const [minx, miny, maxx, maxy] = S.bbox; const rx = (maxx - minx) / S.w, ry = (maxy - miny) / S.h;
    const [x0m, y0m] = merc(b.s, w), [x1m, y1m] = merc(b.n, e);
    let px0 = Math.floor((x0m - minx) / rx), px1 = Math.ceil((x1m - minx) / rx), py0 = Math.floor((maxy - y1m) / ry), py1 = Math.ceil((maxy - y0m) / ry);
    px0 = Math.max(0, px0); py0 = Math.max(0, py0); px1 = Math.min(S.w, px1); py1 = Math.min(S.h, py1);
    if (px1 <= px0 || py1 <= py0) continue;
    const ras = await S.image.readRasters({ window: [px0, py0, px1, py1], samples: [0], interleave: true });
    parts.push({ S, minx, maxy, rx, ry, px0, py0, ww: px1 - px0, hh: py1 - py0, ras });
  }
  return parts;
}
function cutSquare(parts, tx, ty) {
  const b = G.tileBBox(tx, ty); const grid = new Uint8Array(N * N); let any = 0;
  for (const P of parts) {
    const { minx, maxy, rx, ry, px0, py0, ww, hh, ras } = P; const nd = P.S.nodata;
    const i0 = Math.max(0, Math.floor((b.w * 20037508.342789244 / 180 - minx) / rx) - px0), i1 = Math.min(ww, Math.ceil((b.e * 20037508.342789244 / 180 - minx) / rx) - px0 + 1);
    if (i1 <= i0) continue;
    for (let j = 0; j < hh; j++) {
      const ym = maxy - (py0 + j + 0.5) * ry; const lat = (2 * Math.atan(Math.exp(ym / 6378137)) - Math.PI / 2) * 180 / Math.PI;
      const v = Math.floor((b.n - lat) / (b.n - b.s) * N); if (v < 0 || v >= N) continue;
      const row = j * ww;
      for (let i = i0; i < i1; i++) {
        const h = ras[row + i]; if (!(h > 0) || h === nd || h > 90) continue;
        const lon = (minx + (px0 + i + 0.5) * rx) * 180 / 20037508.342789244;
        const u = Math.floor((lon - b.w) / (b.e - b.w) * N); if (u < 0 || u >= N) continue;
        const q = Math.min(255, Math.round(h * 4)); const k = v * N + u; if (q > grid[k]) { if (!grid[k]) any++; grid[k] = q; }
      }
    }
  }
  fs.writeFileSync(path.join(out, `${tx}_${ty}.bin.gz`), zlib.gzipSync(Buffer.from(grid), { level: 9 }));
  return any;
}

// ---- main ----
const A = G.COUNTY;
const [cx0, cy0] = G.tileOfLL(A.s, A.w), [cx1, cy1] = G.tileOfLL(A.n, A.e);
if (process.argv.includes('--probe')) {
  const qks = new Set(); for (const la of [A.s, A.n]) for (const lo of [A.w, A.e]) qks.add(quadkey(...tileXY(la, lo)));
  for (const qk of qks) { try { const S = await source(qk); log(qk, 'size', S.w, 'x', S.h, 'nodata', S.nodata, 'bits', S.bps, 'fmt', S.fmt); } catch (e) { log(qk, 'FAILED', e.message); } }
  const t0 = Date.now(); const [tx, ty] = G.tileOfLL(35.6117, -77.3718); const parts = await readBand(ty, G.tileBBox(tx, ty).w, G.tileBBox(tx, ty).e); const n = cutSquare(parts, tx, ty); log(`test square ${tx}_${ty}: ${n} canopy cells in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(0);
}
const has = (tx, ty) => fs.existsSync(path.join(out, `${tx}_${ty}.bin.gz`));
const total = (cx1 - cx0 + 1) * (cy1 - cy0 + 1); let left = 0; for (let ty = cy0; ty <= cy1; ty++) for (let tx = cx0; tx <= cx1; tx++) if (!has(tx, ty)) left++;
log(`Pitt County canopy: ${total} map squares in ${cy1 - cy0 + 1} rows, ${total - left} already done, ${left} to go.`);
const t0 = Date.now(); let done = 0, rows = 0, failedRows = 0;
for (let ty = cy0; ty <= cy1; ty++) {
  const need = []; for (let tx = cx0; tx <= cx1; tx++) if (!has(tx, ty)) need.push(tx);
  if (!need.length) continue;
  const w = G.tileBBox(need[0], ty).w, e = G.tileBBox(need[need.length - 1], ty).e;
  let parts = null;
  for (let a = 0; a < 4 && !parts; a++) { try { parts = await readBand(ty, w, e); } catch (err) { log(`  row ${ty}: ${err.message} — ${a < 3 ? 'retrying' : 'skipped, run again later'}`); await new Promise(r => setTimeout(r, 5000 * (a + 1))); } }
  if (!parts) { failedRows++; continue; }
  for (const tx of need) { cutSquare(parts, tx, ty); done++; }
  parts = null; sources.forEach(p => p.then(S => S.tiff.source && S.tiff.source.blockCache && S.tiff.source.blockCache.clear && S.tiff.source.blockCache.clear()).catch(() => { }));
  rows++; const m = (Date.now() - t0) / 60000; log(`  row ${ty}: ${need.length} squares — ${done} of ${left} done (${m.toFixed(1)} min, about ${Math.round(m / done * (left - done))} min left)`);
}
const list = fs.readdirSync(out).filter(f => f.endsWith('.bin.gz')).map(f => f.replace('.bin.gz', '')).sort();
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(list));
log(failedRows ? `Done for now: ${failedRows} rows failed — run this again to finish them.` : `All ${list.length} squares of canopy saved in public-data/canopy/.`);
