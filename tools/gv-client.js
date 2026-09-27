// In-browser hot-reload runtime for Greenville Open World (development only).
// Loads each game source file as a classic script (they share one global scope), then listens
// for edits and swaps the changed file into the running game without restarting it.

// ---------- how edited values are merged into the running game ----------
const isPlain = o => o !== null && typeof o === 'object' && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
const hasFn = o => Object.keys(o).some(k => { const d = Object.getOwnPropertyDescriptor(o, k); return typeof d.value === 'function' || d.get || d.set; });
const jsonish = (o, depth = 0) => {
  if (o === null || typeof o !== 'object') return typeof o !== 'function' && typeof o !== 'symbol';
  if (depth > 6) return false;
  if (Array.isArray(o)) return o.every(v => jsonish(v, depth + 1));
  if (!isPlain(o)) return false;
  return Object.keys(o).every(k => jsonish(o[k], depth + 1));
};
const initials = new Map(); // name → { key: initial primitive value } (to tell edited constants from live state)
const recordInitials = (name, o) => { if (!isPlain(o)) return; const r = {}; for (const k of Object.keys(o)) { const v = o[k]; if (v === null || typeof v !== 'object' && typeof v !== 'function') r[k] = v; } initials.set(name, r); };

window.__gvHot = {
  // var NAME = __gvHot.v('NAME', currentValue, () => (newExpression), filledByFileSetup)
  v(name, old, make, filled) {
    if (old === undefined) { const v = make(); recordInitials(name, v); return v; }
    let nw; try { nw = make(); } catch (e) { console.warn(`[hot] ${name}: kept the old value (${e.message})`); return old; }
    if (typeof nw === 'function') return nw;                                   // functions/arrow helpers
    if (nw === null || typeof nw !== 'object') return nw;                      // numbers, strings…
    if (old === null || typeof old !== 'object') return nw;
    if (isPlain(nw) && isPlain(old) && hasFn(nw)) {                           // systems: new methods, same state
      const init = initials.get(name) || {};
      for (const k of Object.keys(nw)) {
        const d = Object.getOwnPropertyDescriptor(nw, k);
        if (typeof d.value === 'function' || d.get || d.set) Object.defineProperty(old, k, d);
        else if (!(k in old)) old[k] = nw[k];
        else if ((d.value === null || typeof d.value !== 'object') && k in init && old[k] === init[k]) old[k] = d.value; // an edited constant
      }
      recordInitials(name, nw); return old;
    }
    if (nw instanceof Set || nw instanceof Map) return nw.size ? nw : old;       // lookup tables (a fresh empty one is live state)
    if (nw.isColor || nw.isVector2 || nw.isVector3 || nw.isVector4 || nw.isEuler || nw.isQuaternion || nw.isMatrix3 || nw.isMatrix4) return nw; // constants
    if (!filled && jsonish(nw) && (Array.isArray(nw) ? nw.length : Object.keys(nw).length)) return nw; // data tables
    if (isPlain(nw) && isPlain(old)) for (const k of Object.keys(nw)) if (!(k in old)) old[k] = nw[k];
    return old;                                                               // Maps, Sets, three.js objects…
  },
  // var X = __gvHot.cls('X', OldClass, class X {…}): existing instances pick up the new methods
  cls(name, Old, New) {
    if (!Old) return New;
    for (const k of Object.getOwnPropertyNames(New.prototype)) if (k !== 'constructor') Object.defineProperty(Old.prototype, k, Object.getOwnPropertyDescriptor(New.prototype, k));
    for (const k of Object.getOwnPropertyNames(New)) if (!['length', 'name', 'prototype'].includes(k)) { try { Object.defineProperty(Old, k, Object.getOwnPropertyDescriptor(New, k)); } catch { } }
    return Old;
  },
};

// ---------- what each file needs after it changes ----------
// hot:    swap code in place (state kept)
// tiles:  swap code, then rebuild the map squares around you with it
// plane:  swap code, then rebuild the plane model and the airport
// reload: reload the page and put you back where you were
const POLICY = {
  '01_core.js': 'reload', '02_render_textures.js': 'reload', '03_models.js': 'reload', '03c_people.js': 'reload',
  '03d_avatar.js': 'reload', '03e_npcs.js': 'reload', '03f_rocketbox.js': 'reload',
  '03g_food.js': 'tiles+setup', '03h_retail.js': 'tiles+setup', '03i_parcels.js': 'tiles',
  '03j_airport.js': 'plane', '04_world.js': 'tiles', '04b_food.js': 'tiles', '04c_neighborhoods.js': 'tiles', '04d_streets.js': 'tiles', '04e_overview.js': 'hot',
  '05_env.js': 'hot', '06_player.js': 'hot', '06b_plane.js': 'hot', '07_traffic.js': 'hot', '08_ui.js': 'hot', '09_main.js': 'hot',
};
const policyOf = f => POLICY[f] || (/^04/.test(f) ? 'tiles' : 'reload');

const toast = (m, ms) => { try { UI.toast(m, ms); } catch { console.log('[hot]', m); } };
const badge = (() => { const b = document.createElement('div'); b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99;padding:3px 8px;border-radius:6px;font:600 11px ui-monospace,monospace;background:rgba(20,140,70,.85);color:#fff;pointer-events:none;opacity:.8'; b.textContent = 'live reload'; document.body.appendChild(b); return b; })();
const flash = (text, bad) => { badge.textContent = text; badge.style.background = bad ? 'rgba(190,40,30,.92)' : 'rgba(20,140,70,.85)'; clearTimeout(flash.t); if (!bad) flash.t = setTimeout(() => { badge.textContent = 'live reload'; }, 2500); };

// ---------- keep your place across page reloads ----------
const KEY = 'gv:resume';
function saveState() {
  try {
    if (!window.Game || !Game.started) return;
    const P = Player; const pl = (typeof Plane !== 'undefined' && Plane.m && Plane.m.g.visible) ? { pos: Plane.pos.toArray(), q: Plane.q.toArray(), v: Plane.v.toArray(), thr: Plane.thr, onGround: Plane.onGround, trim: Plane.trim } : null;
    sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), mode: P.mode, pos: P.pos.toArray(), yaw: P.yaw, cam: [P.camYaw, P.camPitch, P.camDist, P.camMode], car: { pos: P.car.pos.toArray(), yaw: P.car.yaw }, hour: Env.hour, plane: pl }));
  } catch (e) { console.warn('[hot] could not save state', e); }
}
addEventListener('beforeunload', saveState);

async function resume() {
  let s; try { s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { }
  sessionStorage.removeItem(KEY);
  if (!s || Date.now() - s.t > 60 * 60 * 1000) return;
  const P = Player; const at = s.mode === 'fly' && s.plane ? s.plane.pos : s.pos;
  flash('restoring…');
  await Game.play(['where you left off', zToLat(at[2]), xToLon(at[0])]);
  if (!Game.started) return;
  if (s.plane) {
    await Airport.ensure(); Plane.init(); Plane.placed = true;
    const q = new THREE.Quaternion().fromArray(s.plane.q); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    Plane.park(s.plane.pos[0], s.plane.pos[2], Math.atan2(f.x, f.z));
    Plane.pos.fromArray(s.plane.pos); Plane.q.copy(q); Plane.v.fromArray(s.plane.v); Plane.thr = s.plane.thr; Plane.onGround = s.plane.onGround; Plane.trim = s.plane.trim ?? Plane.trim;
  }
  P.car.pos.fromArray(s.car.pos); P.car.yaw = s.car.yaw; P.car.speed = 0; P.syncCar(0);
  Env.hour = s.hour;
  [P.camYaw, P.camPitch, P.camDist, P.camMode] = s.cam;
  if (s.mode === 'fly' && s.plane) { Plane.enter(); Plane.parked = false; Plane.thr = s.plane.thr; P.pos.copy(Plane.pos); }
  else {
    P.pos.fromArray(s.pos); P.yaw = s.yaw;
    if (s.mode === 'drive') { P.mode = 'drive'; P.person.g.visible = false; } else { P.mode = 'walk'; P.person.g.visible = true; }
  }
  P.camPos.copy(P.focus()).add(new THREE.Vector3(0, 3, 6));
  toast('Reloaded — you are back where you left off'); flash('restored');
}

// ---------- applying an edit ----------
function disposeTree(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); const m = x.material; for (const mm of [].concat(m || [])) { for (const k in mm) if (mm[k] && mm[k].isTexture) mm[k].dispose(); mm.dispose?.(); } }); }
function rebuildTiles() {
  const f = Player.focus();
  for (const T of [...Tiles.map.values()]) if (T.state === 'ready' || T.state === 'queued') Tiles.unload(T);
  Tiles.update(f.x, f.z); if (typeof Grass !== 'undefined') Grass.cx = 1e9;
}
function rebuildPlane() {
  if (Plane.m) {
    const vis = Plane.m.g.visible; Plane.m.g.removeFromParent(); disposeTree(Plane.m.g);
    Plane.m = buildPlaneModel(); dynRoot.add(Plane.m.g); Plane.m.g.visible = vis; Plane.sync(0);
  }
  if (Airport.built || Airport.group) {
    if (Airport.group) { Airport.group.removeFromParent(); disposeTree(Airport.group); Airport.group = null; }
    if (Airport._hangarItem) { World.bldHash.remove(Airport._hangarItem); Airport._hangarItem = null; }
    Airport.built = false; Airport.rects = null; Airport.ensure();
  }
}
function runClassic(code, file) {
  return new Promise(res => {
    let err = null; const onErr = e => { err = err || e; e.preventDefault(); }; // (only this script runs while it is appended)
    addEventListener('error', onErr);
    const s = document.createElement('script'); s.textContent = code;
    try { document.head.appendChild(s); } catch (e) { err = err || { message: e.message, error: e }; }
    s.remove();
    removeEventListener('error', onErr); res(err);
  });
}
let busy = Promise.resolve();
function onChange(file) {
  busy = busy.catch(() => { }).then(async () => {
    const pol = policyOf(file);
    if (pol === 'reload' || !window.Game) { saveState(); flash('reloading…'); location.reload(); return; }
    let code;
    try { const r = await fetch(`/@gv/src/${file}?hot=1${pol.includes('setup') ? '&effects=1' : ''}&t=${Date.now()}`); code = await r.text(); if (!r.ok) throw new Error(code); }
    catch (e) { flash(`${file}: ${e.message}`, true); return; }
    const err = await runClassic(code, file);
    if (err) { const msg = `${file}:${err.lineno || '?'} ${err.message}`; console.error('[hot]', msg, err.error); flash(msg, true); toast('Code error — ' + msg, 6000); return; }
    try {
      if (pol.startsWith('tiles')) rebuildTiles();
      if (pol === 'plane') rebuildPlane();
    } catch (e) { console.error(e); flash(`${file}: ${e.message}`, true); return; }
    console.log(`[hot] updated ${file}`); flash(`updated ${file}`); toast(`Updated ${file.replace(/^\d+[a-z]?_/, '')}`);
  });
}

// ---------- map data through the dev server (retries + a disk cache that survives restarts) ----------
if (!window.GV_PROVIDER) window.GV_PROVIDER = {
  async osm(bbox, query) {
    try { const r = await fetch('/@gv/overpass', { method: 'POST', body: query }); if (r.ok) return await r.json(); throw new Error(await r.text()); }
    catch (e) { console.warn('[dev] map relay failed, trying the map servers directly:', e.message); return fetchTileOSM(bbox); }
  },
  async dem(z, x, y) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, { mode: 'cors' }); if (!r.ok) throw new Error('elevation ' + r.status);
    const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, 256, 256).data; const out = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) out[i] = d[4 * i] * 256 + d[4 * i + 1] + d[4 * i + 2] / 256 - 32768;
    return out;
  },
};

// ---------- boot ----------
(async () => {
  const spec = '/@gv/prelude.js'; await import(/* @vite-ignore */ spec); // three.js + addons → globals
  const { files } = await (await fetch('/@gv/files')).json();
  await new Promise((resolve, reject) => {
    files.forEach((f, i) => {
      const s = document.createElement('script'); s.src = `/@gv/src/${f}?t=${Date.now()}`; s.async = false;
      if (i === files.length - 1) s.onload = resolve; s.onerror = () => reject(new Error('could not load ' + f));
      document.body.appendChild(s);
    });
  });
  const unlockAudio = () => { try { Sound.ctx && Sound.ctx.resume(); } catch { } };
  addEventListener('pointerdown', unlockAudio); addEventListener('keydown', unlockAudio);
  const es = new EventSource('/@gv/events');
  es.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'change') onChange(m.file); else if (m.type === 'reload') { saveState(); location.reload(); } };
  es.onerror = () => flash('dev server offline', true); es.onopen = () => flash('live reload');
  window.__gvDev = { onChange, saveState, resume, rebuildTiles, rebuildPlane };
  if (window.Game) await resume();
})().catch(e => { console.error(e); flash(String(e.message || e), true); });
