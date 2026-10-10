// Builds the hosted version into site/:  npm run site
//   site/index.html      the game, set to read map squares from site/data/ first
//   site/data/osm/       the packed map squares (from public-data/osm, see npm run pack-data)
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd(), src = path.join(root, 'src'), site = path.join(root, 'site');
fs.rmSync(site, { recursive: true, force: true }); fs.mkdirSync(path.join(site, 'data', 'osm'), { recursive: true });
const files = fs.readdirSync(src).filter(f => /^0.*\.js$/.test(f)).sort();
const js = files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
let html = fs.readFileSync(path.join(src, 'template.html'), 'utf8').replace('/*GAME*/', () => js).replace('<!--MOCK-->', '');
html = html.replace('<script type="importmap">', '<script>window.GV_DATA = "data/";</script>\n<script type="importmap">');
fs.writeFileSync(path.join(site, 'index.html'), html);
const dataSrc = path.join(root, 'public-data', 'osm'); let n = 0;
if (fs.existsSync(dataSrc)) for (const f of fs.readdirSync(dataSrc)) { fs.copyFileSync(path.join(dataSrc, f), path.join(site, 'data', 'osm', f)); if (f.endsWith('.gz')) n++; }
// railways, level crossings, bus routes and stops (npm run fetch-transit)
if (fs.existsSync(path.join(root, 'public-data', 'transit.json'))) fs.copyFileSync(path.join(root, 'public-data', 'transit.json'), path.join(site, 'data', 'transit.json'));
// restaurants & stores for the whole county (npm run fetch-places)
if (fs.existsSync(path.join(root, 'public-data', 'places.json'))) fs.copyFileSync(path.join(root, 'public-data', 'places.json'), path.join(site, 'data', 'places.json'));
// tree canopy heights per square (npm run fetch-canopy)
const canSrc = path.join(root, 'public-data', 'canopy'); let nc = 0;
if (fs.existsSync(canSrc)) { fs.mkdirSync(path.join(site, 'data', 'canopy'), { recursive: true }); for (const f of fs.readdirSync(canSrc)) { fs.copyFileSync(path.join(canSrc, f), path.join(site, 'data', 'canopy', f)); if (f.endsWith('.gz')) nc++; } }
// what each building is made of, from the county tax records (npm run fetch-pitt-buildings)
const pbSrc = path.join(root, 'public-data', 'pittbld');
if (fs.existsSync(pbSrc)) { fs.mkdirSync(path.join(site, 'data', 'pittbld'), { recursive: true }); for (const f of fs.readdirSync(pbSrc)) if (f !== 'summary.json') fs.copyFileSync(path.join(pbSrc, f), path.join(site, 'data', 'pittbld', f)); }
// building looks read off street-level photos (tools/fetch-mapillary.mjs)
if (fs.existsSync(path.join(root, 'public-data', 'facades.json'))) fs.copyFileSync(path.join(root, 'public-data', 'facades.json'), path.join(site, 'data', 'facades.json'));
// detailed car models (03l_cars.js)
const vehSrc = path.join(root, 'public-data', 'vehicles');
if (fs.existsSync(vehSrc)) { fs.mkdirSync(path.join(site, 'data', 'vehicles'), { recursive: true }); for (const f of fs.readdirSync(vehSrc)) fs.copyFileSync(path.join(vehSrc, f), path.join(site, 'data', 'vehicles', f)); }
if (!fs.existsSync(path.join(site, 'data', 'osm', 'index.json'))) fs.writeFileSync(path.join(site, 'data', 'osm', 'index.json'), '[]');
fs.writeFileSync(path.join(site, '.nojekyll'), '');
console.log(`Built site/ — game ${Math.round(html.length / 1024)} KB, ${n} packed map squares, ${nc} canopy squares`);
