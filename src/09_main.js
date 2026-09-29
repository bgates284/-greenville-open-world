
// =====================================================================
// GAME
// =====================================================================
const Game = {
  playing: false, paused: false, simT: 0, fps: 60, menuFocus: new THREE.Vector3(), menuAng: 0,
  init() {
    buildTextures(); buildMaterials(); buildModels();
    Env.init(); Player.init(); Grass.init(); UI.init();
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.25, 0.5, 0.9); this.bloom.enabled = Q.bloom; this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    addEventListener('resize', () => this.resize()); this.resize();
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    // start fetching the default start area right away, behind the menu
    const [, la, lo] = LANDMARKS[0]; this.menuFocus.set(lonToX(lo), 20, latToZ(la));
    Tiles.update(this.menuFocus.x, this.menuFocus.z);
    Player.car.pos.set(this.menuFocus.x, -100, this.menuFocus.z); Player.syncCar(0); Player.person.g.visible = false;
    Env.hour = 10; Env.speed = 60;
    addEventListener('keydown', e => this.onKey(e));
    requestAnimationFrame(t => { this.last = t; this.frame(t); });
  },
  resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio(); if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  },
  onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Escape') { if (!$('bigmap').hidden) { UI.closeBig(); return; } if (this.playing) { this.paused ? this.resume() : this.pause(); } return; }
    if (!this.playing || this.paused) return;
    if (e.code === 'KeyM') { $('bigmap').hidden ? UI.openBig() : UI.closeBig(); }
    if (e.code === 'KeyT') { Env.hour = (Env.hour + 1) % 24; UI.toast('Time: ' + UI.fmtHour(Env.hour)); $('clockRange').value = Env.hour; }
    if (e.code === 'KeyR') { const order = ['clear', 'partly', 'overcast', 'rain']; const w = order[(order.indexOf(Env.weather) + 1) % 4]; Env.setWeather(w); $('weatherSel').value = w; UI.toast('Weather: ' + { clear: 'Clear', partly: 'Partly cloudy', overcast: 'Overcast', rain: 'Rain' }[w]); }
    if (e.code === 'F3') { $('dbg').hidden = !$('dbg').hidden; e.preventDefault(); }
  },
  pause() { this.paused = true; $('menu').hidden = false; $('playBtn').textContent = 'Travel to location'; $('resumeBtn').hidden = false; if (document.exitPointerLock) document.exitPointerLock(); $('clockRange').value = Env.hour; },
  resume() { this.paused = false; $('menu').hidden = true; canvasEl.focus(); },
  async play(idx) {
    Sound.start();
    const [name, la, lo] = Array.isArray(idx) ? idx : (LANDMARKS[idx] || LANDMARKS[0]);
    if (!this._foodRefresh) { this._foodRefresh = true; Food.refresh(); }
    $('playBtn').disabled = true;
    let gx = lonToX(lo), gz = latToZ(la); if (/your plane/.test(name)) { Airport.init(); gx = Airport.stand.x; gz = Airport.stand.z; }
    const ok = await this.goTo(gx, gz, name);
    $('playBtn').disabled = false;
    if (!ok) return;
    if (/your plane/.test(name)) {
      await Airport.ensure(); Plane.park(); Plane.placed = true;
      const { L, F } = Plane.axes(); const x = Plane.pos.x + L.x * 4 - F.x * 2, z = Plane.pos.z + L.z * 4 - F.z * 2;
      Player.pos.set(x, groundY(x, z, Plane.pos.y + 1), z); Player.yaw = Math.atan2(-L.x, -L.z); Player.camYaw = Math.atan2(L.x, L.z) + 0.5; Player.camPitch = 0.22; Player.camDist = 7;
      Player.camPos.set(x + Math.sin(Player.camYaw) * 7, Player.pos.y + 3, z + Math.cos(Player.camYaw) * 7);
    }
    this.started = true;
    $('menu').hidden = true; $('hud').hidden = false; this.playing = true; this.paused = false; canvasEl.focus();
    UI.toast(/your plane/.test(name) ? 'Welcome to Pitt-Greenville Airport — walk to the plane and press E to fly' : 'Welcome to ' + name + ' — press E to drive, M for the map', 5000);
  },
  async teleport(x, z) { await this.goTo(x, z, 'this spot'); },
  async goTo(x, z, label) {
    UI.loading(true, 'Building Greenville', 'Finding ' + label + '…', 0.02);
    for (const c of Traffic.cars.slice()) Traffic.remove(c);
    for (const p of Peds.list.slice()) Peds.remove(p); for (const c of Peds.crowd) disposePerson(c.person); Peds.crowd = []; HospitalLife.clear(); Hangouts.clear(); if (Cine.active) Cine.finish();
    this.menuFocus.set(x, 20, z);
    Tiles.update(x, z);
    const [tx, ty] = tileOfXZ(x, z); const need = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) need.push(tileKey(tx + dx, ty + dy));
    const d0 = Net.downloaded; const t0 = performance.now();
    while (true) {
      Tiles.update(x, z);
      const ready = need.filter(k => Tiles.map.get(k)?.state === 'ready').length;
      const err = need.map(k => Tiles.map.get(k)).find(T => T && T.state === 'error');
      const dl = Net.downloaded - d0;
      const msg = dl > 0 || Net.active > 0 ? `Downloading real map data from OpenStreetMap (first visit only — it's saved on this PC afterwards). ${ready} of 9 areas ready.` : `Loading saved map… ${ready} of 9 areas ready.`;
      const busy = /busy|replied (429|5\d\d)|timed out|runtime error/i.test(Net.lastErr || '');
      const blocked = Net.errors >= 2 && ready === 0 && !busy;
      if (!blocked && Net.errors >= 2 && ready === 0 && busy) { UI.loading(true, 'Map server is busy', `The free OpenStreetMap server is overloaded right now — still retrying (${Net.errors} tries so far, switching between mirror servers). This usually clears within a minute or two.`, 0.05); await sleep(150); continue; }
      UI.loading(true, blocked ? "Can't reach the map servers" : null, blocked ? "This window can't download map data. If you opened the game inside the Claude app's preview, save the file and double-click it to open it in Chrome or Edge instead. Also check your internet connection. Still retrying…\n\nDetails: " + (Net.lastErr || '') + ' · page: ' + location.protocol + ' ' + (navigator.userAgentData ? navigator.userAgentData.brands.map(b => b.brand).join('/') : navigator.userAgent.slice(-40)) : msg, 0.05 + 0.95 * ready / 9);
      if (ready >= 9) break;
      const centerErr = Tiles.map.get(tileKey(tx, ty));
      if (!centerErr && performance.now() - t0 > 2000) { /* re-queued after error */ }
      if (ready !== this._lastReady) { this._lastReady = ready; this._progT = performance.now(); }
      if (performance.now() - t0 > 150000 && performance.now() - (this._progT || t0) > 90000) { UI.loading(true, 'Map servers are busy', 'Could not download the map for this area. Check your internet connection, then try again. Areas you have already visited still work offline.', 0); await sleep(4000); UI.loading(false); return false; }
      await sleep(150);
    }
    Player.placeAt(x, z);
    Player.camPos.copy(Player.pos).add(new THREE.Vector3(0, 3, 6));
    Grass.cx = 1e9;
    UI.loading(false); UI.refreshCache();
    return true;
  },
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.fps = lerp(this.fps, 1 / Math.max(dt, 1e-3), 0.05);
    U.uTime.value += dt;
    const sim = this.playing && !this.paused;
    if (sim) { this.simT += dt; if (!Cine.active) Player.update(dt); } // the idle cinematic (08b_cinematic.js) holds the player still
    else {
      // slow orbit behind the menu
      this.menuAng += dt * 0.03; const f = this.menuFocus; const gy = H(f.x, f.z);
      camera.position.set(f.x + Math.cos(this.menuAng) * 260, gy + 95, f.z + Math.sin(this.menuAng) * 260); camera.lookAt(f.x, gy + 5, f.z);
    }
    if (sim) try { Cine.update(dt); } catch (e) { if (!Cine.warned) { Cine.warned = 1; console.warn('idle cinematic skipped', e); } }
    const f = sim ? (Cine.active ? Cine.focus : Player.focus()) : this.menuFocus;
    this._tu = (this._tu || 0) + dt; if (this._tu > 0.5) { this._tu = 0; Tiles.update(f.x, f.z); Env.updateLampLights(f); }
    Env.update(sim ? dt : 0, f);
    if (sim) { Traffic.update(dt, f, this.simT); Peds.update(dt, f); Peds.updateCrowd(dt, f); try { HospitalLife.update(dt, f); } catch (e) { if (!HospitalLife.warned) { HospitalLife.warned = 1; console.warn('hospital people skipped', e); } } try { Hangouts.update(dt, f); } catch (e) { if (!Hangouts.warned) { Hangouts.warned = 1; console.warn('smoke-shop regulars skipped', e); } } updateSignalLights(this.simT); Grass.update(f); Sound.update(dt); UI.update(dt); }
    this.bloom.strength = 0.18 + Env.night * 0.55; this.bloom.threshold = lerp(0.92, 0.6, Env.night);
    if (sim) Cine.apply();
    if (Q.bloom) this.composer.render(dt); else renderer.render(scene, camera);
  },
};

// ---- on-screen error reporting (so problems are visible, not silent) ----
function showErr(msg) {
  let el = document.getElementById('errbox');
  if (!el) { el = document.createElement('div'); el.id = 'errbox'; el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:220px;z-index:99;max-width:640px;background:rgba(70,10,10,.92);color:#fff;padding:10px 12px;font:12px/1.4 monospace;border-radius:6px;white-space:pre-wrap;cursor:pointer'; el.title = 'Click to dismiss'; el.onclick = () => el.remove(); document.body.appendChild(el); }
  el.textContent = 'Something went wrong (click to hide):\n' + String(msg).slice(0, 600);
}
addEventListener('error', e => showErr((e.message || e.error) + (e.filename ? '\n' + e.filename.split('/').pop() + ':' + e.lineno : '')));
addEventListener('unhandledrejection', e => showErr(e.reason && (e.reason.stack || e.reason.message) || e.reason));

// ---- boot ----
try { Game.init(); window.GV = { Game, World, Tiles, Player, Plane, Airport, Traffic, Peds, HospitalLife, Hangouts, Cine, RB, NPCKit, Food, nearestRoad, insideBuilding, onRoadSurface, Env, Store, Net, THREE, scene, renderer, camera, H }; }
catch (e) { console.error(e); showErr('Startup error: ' + (e && e.stack || e)); }
