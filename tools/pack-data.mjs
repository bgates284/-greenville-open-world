// Copies the map squares the dev server has downloaded (.cache/) into public-data/osm/, named by
// square, so they can be committed and shipped with the hosted game:  npm run pack-data
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chunks } from './gv-hot.mjs';

export function gridHelpers(root) {
  // reuse the game's own grid + query code so the names match exactly what the game asks for
  const core = fs.readFileSync(path.join(root, 'src', '01_core.js'), 'utf8');
  const want = [/^const LAT0\b/, /^const tileOfLL\b/, /^function tileBBox\b/, /^function overpassQuery\b/, /^const CITY\b/, /^const COUNTY\b/];
  const code = chunks(core).list.map(c => c.text).filter(t => want.some(re => re.test(t.trimStart()))).join('\n').replace(/^const /gm, 'var ');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx);
  return ctx;
}

export function packData(root, { quiet } = {}) {
  const G = gridHelpers(root);
  const cache = path.join(root, '.cache', 'overpass'), out = path.join(root, 'public-data', 'osm');
  fs.mkdirSync(out, { recursive: true });
  const A = G.COUNTY || G.CITY; // pack everything downloaded for Pitt County (the city is inside it)
  const [x0, y0] = G.tileOfLL(A.s, A.w), [x1, y1] = G.tileOfLL(A.n, A.e);
  let added = 0; const have = new Set(fs.readdirSync(out).filter(f => f.endsWith('.json.gz')).map(f => f.replace('.json.gz', '')));
  for (let ty = y0 - 3; ty <= y1 + 3; ty++) for (let tx = x0 - 3; tx <= x1 + 3; tx++) {
    const name = `${tx}_${ty}`; if (have.has(name)) continue;
    const q = G.overpassQuery(G.tileBBox(tx, ty));
    const src = path.join(cache, crypto.createHash('sha1').update(q).digest('hex') + '.json.gz');
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(out, name + '.json.gz')); have.add(name); added++; }
  }
  const list = [...have].sort(); fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(list));
  const total = (x1 - x0 + 1) * (y1 - y0 + 1); const inCity = list.filter(n => { const [x, y] = n.split('_').map(Number); return x >= x0 && x <= x1 && y >= y0 && y <= y1; }).length;
  if (!quiet) console.log(`public-data/osm: ${list.length} map squares (${added} new) — ${inCity} of ${total} squares of Pitt County`);
  return { list, added, inCity, total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) packData(process.cwd());
