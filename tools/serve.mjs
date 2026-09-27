// No-dependency fallback dev server (same live reloading, without Vite):  npm run dev:plain
import http from 'node:http';
import { exec } from 'node:child_process';
import { gvDev } from './gv-dev.mjs';

const port = +(process.env.PORT || 5173);
const gv = gvDev(process.cwd());
http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(gv.devHtml()); }
  gv.middleware(req, res, () => { res.writeHead(404); res.end('not found'); });
}).listen(port, () => {
  const url = `http://localhost:${port}/`; console.log(`Greenville Open World dev server: ${url}`);
  if (!process.argv.includes('--no-open')) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`);
});
