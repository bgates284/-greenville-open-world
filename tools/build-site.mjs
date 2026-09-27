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
if (!fs.existsSync(path.join(site, 'data', 'osm', 'index.json'))) fs.writeFileSync(path.join(site, 'data', 'osm', 'index.json'), '[]');
fs.writeFileSync(path.join(site, '.nojekyll'), '');
console.log(`Built site/ — game ${Math.round(html.length / 1024)} KB, ${n} packed map squares`);
