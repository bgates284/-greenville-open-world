// Vite dev server with live code swapping for Greenville Open World.
//   npm run dev    → http://localhost:5173 (opens your browser)
// Edit any file in src/ and the running game picks it up — see tools/gv-client.js for what
// happens per file (most swap in place; a few reload the page and put you back where you were).
import { defineConfig } from 'vite';
import { gvDev } from './tools/gv-dev.mjs';

const gv = gvDev(process.cwd());

export default defineConfig({
  server: { port: 5173, open: true, preTransformRequests: false, watch: { ignored: ['**/src/**', '**/dist/**'] } },
  optimizeDeps: { noDiscovery: true, include: [], entries: [] },
  plugins: [{
    name: 'greenville-hot',
    configureServer(server) { server.middlewares.use(gv.middleware); },
    transformIndexHtml: { order: 'pre', handler: () => gv.devHtml() },
  }],
});
