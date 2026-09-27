// Dev-server side of hot reloading (used by the Vite plugin and by the no-dependency fallback server).
//   /@gv/files        list of game source files + the three.js imports they need
//   /@gv/prelude.js   module that loads three.js (via the page's import map) and exposes it globally
//   /@gv/client.js    the in-browser hot-reload runtime
//   /@gv/src/<file>   a source file as a classic script (?hot=1 for a live re-run)
//   /@gv/events       server-sent events: {type:'change', file} / {type:'reload'}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { transform } from './gv-hot.mjs';

// ---- map data relay: the dev server fetches OpenStreetMap data for the page (no browser limits),
// retries across mirror servers when one is busy, and keeps a copy in .cache/ so a restart,
// a different browser or a new port never downloads the same area twice.
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
function overpassRelay(root) {
  const dir = path.join(root, '.cache', 'overpass'); fs.mkdirSync(dir, { recursive: true });
  let active = 0, mi = 0; const waiters = [];
  const slot = async () => { while (active >= 2) await new Promise(r => waiters.push(r)); active++; };
  const release = () => { active--; const w = waiters.shift(); if (w) w(); };
  return async function get(query) {
    const file = path.join(dir, crypto.createHash('sha1').update(query).digest('hex') + '.json.gz');
    if (fs.existsSync(file)) return zlib.gunzipSync(fs.readFileSync(file));
    await slot();
    try {
      if (fs.existsSync(file)) return zlib.gunzipSync(fs.readFileSync(file));
      let last = '';
      for (let a = 0; a < 8; a++) {
        const ep = MIRRORS[mi++ % MIRRORS.length]; const host = new URL(ep).host;
        try {
          const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 180000);
          const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'GreenvilleOpenWorld/1.0 (local dev server)' }, signal: ctl.signal });
          clearTimeout(to); const txt = await r.text();
          if (r.ok && txt.trimStart().startsWith('{')) {
            const j = JSON.parse(txt);
            if (!(j.remark && /runtime error|timed out/i.test(j.remark)) && Array.isArray(j.elements)) { fs.writeFileSync(file, zlib.gzipSync(txt)); console.log(`[gv] map data from ${host} (${j.elements.length} features)`); return Buffer.from(txt); }
            last = `${host}: ${j.remark}`;
          } else last = `${host}: HTTP ${r.status}`;
        } catch (e) { last = `${host}: ${e.name === 'AbortError' ? 'timed out' : e.message}`; }
        console.log(`[gv] map server busy (${last}) — retry ${a + 1}/8`);
        await sleep(Math.min(20000, 2500 * (a + 1)));
      }
      throw new Error(last);
    } finally { release(); }
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));

export function gvDev(root) {
  const src = path.join(root, 'src');
  const listFiles = () => fs.readdirSync(src).filter(f => /^0.*\.js$/.test(f)).sort();
  const clients = new Set(); const relay = overpassRelay(root);
  const send = msg => { const line = `data: ${JSON.stringify(msg)}\n\n`; for (const res of clients) res.write(line); };

  // watch by polling modification times: reliable on Windows, network drives and shared folders
  const mtimes = new Map();
  const poll = () => {
    let files; try { files = listFiles().concat(['template.html']); } catch { return; }
    for (const f of files) {
      let m; try { m = fs.statSync(path.join(src, f)).mtimeMs; } catch { continue; }
      const old = mtimes.get(f); mtimes.set(f, m);
      if (old !== undefined && old !== m) {
        if (f === 'template.html') { console.log(`[gv] template.html changed → reload`); send({ type: 'reload', file: f }); }
        else { console.log(`[gv] ${f} changed → hot update`); send({ type: 'change', file: f }); }
      }
    }
  };
  poll(); const timer = setInterval(poll, 300); timer.unref?.();

  const importsOf = () => {
    const core = fs.readFileSync(path.join(src, listFiles()[0]), 'utf8');
    return [...core.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm)].map(m => ({ what: m[1].trim(), from: m[2] }));
  };
  const prelude = () => {
    const imps = importsOf(); const names = [];
    for (const { what } of imps) {
      const star = /^\*\s+as\s+([\w$]+)$/.exec(what); if (star) { names.push(star[1]); continue; }
      const list = /^\{([\s\S]*)\}$/.exec(what); if (list) for (const part of list[1].split(',')) { const p = part.trim(); if (!p) continue; const as = /\s+as\s+([\w$]+)$/.exec(p); names.push(as ? as[1] : p); }
    }
    return imps.map(i => `import ${i.what} from '${i.from}';`).join('\n') + `\nObject.assign(window, { ${names.join(', ')} });\n`;
  };
  const devHtml = () => fs.readFileSync(path.join(src, 'template.html'), 'utf8')
    .replace('<!--MOCK-->', '')
    .replace(/<script type="module">\s*\/\*GAME\*\/\s*<\/script>/, '<script type="module" src="/@gv/client.js"></script>');

  const js = (res, body) => { res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
  const middleware = (req, res, next) => {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    if (!p.startsWith('/@gv/')) return next();
    try {
      if (p === '/@gv/files') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ files: listFiles() })); }
      if (p === '/@gv/prelude.js') return js(res, prelude());
      if (p === '/@gv/overpass' && req.method === 'POST') {
        let body = ''; req.setEncoding('utf8'); req.on('data', c => body += c);
        req.on('end', () => relay(body).then(buf => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(buf); })
          .catch(e => { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('map servers unavailable: ' + e.message); }));
        return;
      }
      if (p === '/@gv/client.js') return js(res, fs.readFileSync(path.join(here, 'gv-client.js'), 'utf8'));
      if (p === '/@gv/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 1000\n\n'); clients.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 15000);
        req.on('close', () => { clearInterval(ping); clients.delete(res); });
        return;
      }
      const m = /^\/@gv\/src\/(0[\w.-]*\.js)$/.exec(p);
      if (m) {
        const file = m[1]; const code = fs.readFileSync(path.join(src, file), 'utf8');
        const out = transform(code, { hot: url.searchParams.get('hot') === '1', effects: url.searchParams.get('effects') === '1', file }).code;
        return js(res, out + `\n//# sourceURL=gv/${file}${url.searchParams.get('hot') === '1' ? '?hot' : ''}`);
      }
      res.writeHead(404); res.end('not found');
    } catch (e) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end(String(e && e.stack || e)); }
  };
  return { middleware, devHtml, send };
}
