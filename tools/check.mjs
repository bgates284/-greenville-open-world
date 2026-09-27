// Syntax-checks every source file the way the dev server and the build use it:  npm run check
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { transform, topNames } from './gv-hot.mjs';

const src = path.join(process.cwd(), 'src'); let bad = 0; const seen = new Map();
for (const f of fs.readdirSync(src).filter(f => /^0.*\.js$/.test(f)).sort()) {
  const code = fs.readFileSync(path.join(src, f), 'utf8');
  for (const hot of [false, true]) { try { new vm.Script(transform(code, { hot }).code, { filename: f }); } catch (e) { bad++; console.log(`✗ ${f}${hot ? ' (hot)' : ''}: ${e.message}`); } }
  for (const n of topNames(code)) { if (seen.has(n)) { bad++; console.log(`✗ ${n} is declared in both ${seen.get(n)} and ${f}`); } seen.set(n, f); }
}
console.log(bad ? `${bad} problem(s)` : `OK — ${seen.size} top-level names, no syntax errors`);
process.exit(bad ? 1 : 0);
