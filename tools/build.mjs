// Builds the single double-clickable game file:  npm run build  → dist/Greenville Open World.html
//   npm run desktop also copies it to your Desktop.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd(), src = path.join(root, 'src'), dist = path.join(root, 'dist');
const files = fs.readdirSync(src).filter(f => /^0.*\.js$/.test(f)).sort();
const js = files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const html = fs.readFileSync(path.join(src, 'template.html'), 'utf8').replace('/*GAME*/', () => js).replace('<!--MOCK-->', '');
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, 'Greenville Open World.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(root, out)} (${Math.round(html.length / 1024)} KB, ${files.length} source files)`);
if (process.argv.includes('--desktop')) {
  const desk = path.join(os.homedir(), 'Desktop', 'Greenville Open World.html');
  fs.copyFileSync(out, desk); console.log(`Copied to ${desk}`);
}
