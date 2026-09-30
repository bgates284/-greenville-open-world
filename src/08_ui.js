
// =====================================================================
// GRASS TUFTS near the camera
// =====================================================================
const Grass = {
  mesh: null, cx: 1e9, cz: 1e9,
  init() {
    const a = new THREE.PlaneGeometry(0.7, 0.55); a.translate(0, 0.275, 0); const b = a.clone(); b.rotateY(Math.PI / 2);
    const geo = mergeGeometries([a, b]);
    const mat = new THREE.MeshStandardMaterial({ map: TEX.tuft, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xb8c8a0 });
    mat.onBeforeCompile = sh => { sh.uniforms.uTime = U.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hh = clamp(position.y/0.55,0.,1.);\n#ifdef USE_INSTANCING\nvec4 ip = instanceMatrix[3];\n#else\nvec4 ip = vec4(0.);\n#endif\ntransformed.x += sin(uTime*1.9 + ip.x*0.37 + ip.z*0.23)*0.07*hh; transformed.z += cos(uTime*1.3 + ip.x*0.21)*0.05*hh;'); };
    mat.customProgramCacheKey = () => 'tuft';
    this.max = 8000; this.mesh = new THREE.InstancedMesh(geo, mat, this.max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; scene.add(this.mesh);
  },
  update(focus) {
    const n = Q.tufts; if (!n) { this.mesh.count = 0; return; }
    if (Math.hypot(focus.x - this.cx, focus.z - this.cz) < 12) return;
    this.cx = focus.x; this.cz = focus.z; const R = 46; const o = new THREE.Object3D(); const r = mulberry32((focus.x * 13 + focus.z * 7) | 0);
    let k = 0;
    for (let i = 0; i < n * 2 && k < Math.min(n, this.max); i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R; const x = focus.x + Math.cos(a) * d, z = focus.z + Math.sin(a) * d;
      const cl = decodeCls(classAt(x, z)); if (!cl || cl === 215 || cl === 225) continue;
      const s = (0.7 + r() * 0.7) * (1 - smooth(R * 0.7, R, d) * 0.9);
      o.position.set(x, H(x, z) - 0.02, z); o.rotation.set(0, r() * 3.14, 0); o.scale.set(s, s * (0.8 + r() * 0.6), s); o.updateMatrix(); this.mesh.setMatrixAt(k++, o.matrix);
    }
    this.mesh.count = k; this.mesh.instanceMatrix.needsUpdate = true;
  },
};

// =====================================================================
// SOUND (synthesized with Web Audio — no files)
// =====================================================================
const Sound = {
  ctx: null, on: true,
  start() {
    if (this.ctx || !this.on) return;
    try {
      const A = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = A.createGain(); this.master.gain.value = 0.7; this.master.connect(A.destination);
      // engine
      this.eg = A.createGain(); this.eg.gain.value = 0; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
      this.o1 = A.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = A.createOscillator(); this.o2.type = 'square';
      const g2 = A.createGain(); g2.gain.value = 0.35; this.o1.connect(lp); this.o2.connect(g2); g2.connect(lp); lp.connect(this.eg); this.eg.connect(this.master); this.o1.start(); this.o2.start(); this.lp = lp;
      // noise bed for rain / wind / tires
      const buf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = A.createBufferSource(); noise.buffer = buf; noise.loop = true;
      this.rainF = A.createBiquadFilter(); this.rainF.type = 'highpass'; this.rainF.frequency.value = 1200; this.rainG = A.createGain(); this.rainG.gain.value = 0;
      this.windF = A.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 400; this.windG = A.createGain(); this.windG.gain.value = 0;
      noise.connect(this.rainF); this.rainF.connect(this.rainG); this.rainG.connect(this.master); noise.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master); noise.start();
      // crickets & tree frogs at night
      this.cr = A.createOscillator(); this.cr.frequency.value = 4600; this.crG = A.createGain(); this.crG.gain.value = 0;
      const am = A.createOscillator(); am.type = 'square'; am.frequency.value = 22; const amG = A.createGain(); amG.gain.value = 0.5; am.connect(amG); amG.connect(this.crG.gain);
      const pulse = A.createOscillator(); pulse.frequency.value = 0.9; const pg = A.createGain(); pg.gain.value = 0.5; pulse.connect(pg);
      this.crOut = A.createGain(); this.crOut.gain.value = 0; this.cr.connect(this.crG); this.crG.connect(this.crOut); this.crOut.connect(this.master); this.cr.start(); am.start(); pulse.start();
      // birds by day
      this.birdT = 2;
    } catch (e) { this.ctx = null; }
  },
  update(dt) {
    const A = this.ctx; if (!A) return; const t = A.currentTime;
    const P = Player;
    if (P.mode === 'heli') { const r = Heli.rpm, c = Heli.col, V = Heli.v.length(); // rotor thump + turbine whine
      this.o1.frequency.setTargetAtTime(14 + r * 12 + c * 4, t, 0.2); this.o2.frequency.setTargetAtTime(28 + r * 24, t, 0.2); this.lp.frequency.setTargetAtTime(300 + r * 900 + c * 500, t, 0.2);
      this.eg.gain.setTargetAtTime(0.05 + r * 0.1 + c * 0.04, t, 0.2); this.windG.gain.setTargetAtTime(Math.min(0.12, V * 0.003), t, 0.3); this.rainG.gain.setTargetAtTime(Env.rain * 0.05, t, 0.5); this.crOut.gain.setTargetAtTime(0, t, 0.5); return; }
    if (P.mode === 'fly') { const th = Plane.thr, V = Plane.v.length(); const rpm = 0.45 + th * 0.55;
      this.o1.frequency.setTargetAtTime(60 + rpm * 70, t, 0.2); this.o2.frequency.setTargetAtTime(30 + rpm * 35, t, 0.2); this.lp.frequency.setTargetAtTime(500 + rpm * 1400, t, 0.2);
      this.eg.gain.setTargetAtTime(0.1 + th * 0.09, t, 0.2); this.windG.gain.setTargetAtTime(Math.min(0.16, V * 0.0028), t, 0.3); this.rainG.gain.setTargetAtTime(Env.rain * 0.05, t, 0.5); this.crOut.gain.setTargetAtTime(0, t, 0.5); return; }
    const drive = P.mode === 'drive'; const sp = Math.abs(P.car.speed);
    const rpm = 0.25 + (sp % 14) / 14 * 0.6 + Math.min(1, sp / 40) * 0.3; const thr = key('KeyW', 'ArrowUp') ? 1 : 0;
    this.o1.frequency.setTargetAtTime(38 + rpm * 90, t, 0.08); this.o2.frequency.setTargetAtTime(19 + rpm * 45, t, 0.08);
    this.lp.frequency.setTargetAtTime(350 + rpm * 900 + thr * 400, t, 0.1);
    this.eg.gain.setTargetAtTime(drive ? 0.09 + thr * 0.05 : 0, t, 0.15);
    this.rainG.gain.setTargetAtTime(Env.rain * (drive ? 0.07 : 0.12), t, 0.5);
    this.windG.gain.setTargetAtTime(drive ? Math.min(0.12, sp * 0.004) : 0.015, t, 0.3);
    this.crOut.gain.setTargetAtTime(Env.night * (1 - Env.rain) * (drive ? 0.004 : 0.012), t, 1);
    if (!drive && Env.night < 0.3 && Env.rain < 0.3) { this.birdT -= dt; if (this.birdT < 0) { this.birdT = 3 + Math.random() * 7; this.chirp(); } }
  },
  chirp() {
    const A = this.ctx; const o = A.createOscillator(), g = A.createGain(); const t = A.currentTime; const f = 2600 + Math.random() * 1800;
    o.frequency.setValueAtTime(f, t); for (let i = 0; i < 3; i++) { o.frequency.linearRampToValueAtTime(f * 1.3, t + 0.05 + i * 0.12); o.frequency.linearRampToValueAtTime(f, t + 0.1 + i * 0.12); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.4); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.45);
  },
  honk() { const A = this.ctx; if (!A) return; const t = A.currentTime; for (const f of [392, 494]) { const o = A.createOscillator(), g = A.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(0.07, t); g.gain.setTargetAtTime(0, t + 0.35, 0.05); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.6); } },
  thud(v) { const A = this.ctx; if (!A) return; const t = A.currentTime; const o = A.createOscillator(), g = A.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.25); g.gain.setValueAtTime(Math.min(0.3, v * 0.012), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.32); },
  door() { const A = this.ctx; if (!A) return; const t = A.currentTime; const o = A.createOscillator(), g = A.createGain(); o.type = 'square'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.08); g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.15); },
  setOn(v) { this.on = v; if (this.ctx) this.master.gain.value = v ? 0.7 : 0; else if (v) this.start(); },
};

// =====================================================================
// UI: HUD, minimap, big map, menu, map-data tools
// =====================================================================
const $ = id => document.getElementById(id);
const UI = {
  shakeAmt: 0, _hint: '', _toastT: 0,
  init() {
    const sel = $('startSel'); LANDMARKS.forEach((l, i) => { const o = document.createElement('option'); o.value = i; o.textContent = l[0]; sel.appendChild(o); });
    for (const [label, test] of [['Restaurants', f => f.kind === 'food'], ['Stores & shopping', f => f.kind === 'shop' || f.kind === 'centre'], ['Gas stations', f => f.kind === 'fuel']]) {
      const L = Food.list.filter(test); if (!L.length) continue; const og = document.createElement('optgroup'); og.label = `${label} (${L.length})`;
      L.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(f => { const o = document.createElement('option'); o.value = `f${f.lat},${f.lon}`; o.textContent = f.kind === 'fuel' ? `${f.name} (gas)` : f.name; og.appendChild(o); }); sel.appendChild(og);
    }
    this.setQuality('low', true); // always start on Low; a higher setting chosen in the menu lasts for that session
    document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => this.setQuality(b.dataset.q)));
    $('timeSel').addEventListener('change', e => { const v = e.target.value; const h = v === 'now' ? new Date().getHours() + new Date().getMinutes() / 60 : parseFloat(v); Env.hour = h; $('clockRange').value = h; });
    $('clockRange').addEventListener('input', e => { Env.hour = parseFloat(e.target.value); });
    $('speedSel').addEventListener('change', e => Env.speed = parseFloat(e.target.value));
    $('weatherSel').addEventListener('change', e => Env.setWeather(e.target.value));
    $('soundChk').addEventListener('change', e => Sound.setOn(e.target.checked));
    try { if (localStorage.getItem('gv-parcels') === 'off') { $('parcelChk').checked = false; Parcels.enabled = false; } } catch (e) { }
    $('parcelChk').addEventListener('change', e => { Parcels.enabled = e.target.checked; try { localStorage.setItem('gv-parcels', e.target.checked ? 'on' : 'off'); } catch (x) { } this.toast('Applies to areas loaded from now on'); });
    $('playBtn').addEventListener('click', () => { const v = $('startSel').value; if (v[0] === 'f') { const [la, lo] = v.slice(1).split(',').map(Number); const o = $('startSel').selectedOptions[0]; Game.play([o.textContent, la, lo]); } else Game.play(parseInt(v)); });
    $('resumeBtn').addEventListener('click', () => Game.resume());
    $('realBtn').addEventListener('click', () => Player.realistic('casual')); $('glbBtn').addEventListener('click', () => $('glbFile').click()); $('glbFile').addEventListener('change', e => { if (e.target.files[0]) Player.loadAvatarFile(e.target.files[0]); e.target.value = ''; }); $('lookBtn').addEventListener('click', () => Player.newLook()); $('lookEcuBtn').addEventListener('click', () => Player.realistic('ecu'));
    try { const n = parseInt(localStorage.getItem('gv-pack-n')); if (n) { RB.target = n; $('packSize').value = String(n); } } catch (e) { }
    $('packSize').addEventListener('change', e => { RB.target = parseInt(e.target.value); try { localStorage.setItem('gv-pack-n', e.target.value); } catch (x) { } if (RB.state === 'done' && Game.started) RB.start(); this.peoplePack(); });
    $('packBtn').addEventListener('click', () => { if (RB.state === 'running') { RB.pause(); try { localStorage.setItem('gv-pack', 'off'); } catch (e) { } } else { try { localStorage.setItem('gv-pack', 'on'); } catch (e) { } if (Game.started) RB.start(); } this.peoplePack(); });
    try { if (localStorage.getItem('gv-pack') === 'off') $('packBtn').textContent = 'Resume download'; } catch (e) { }
    $('cityBtn').addEventListener('click', () => this.downloadCity());
    $('exportBtn').addEventListener('click', () => this.exportData());
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => { if (e.target.files[0]) this.importData(e.target.files[0]); e.target.value = ''; });
    $('clearBtn').addEventListener('click', () => $('clearConfirm').hidden = false);
    $('clearNo').addEventListener('click', () => $('clearConfirm').hidden = true);
    $('clearYes').addEventListener('click', async () => { await Store.clear(); $('clearConfirm').hidden = true; this.refreshCache(); this.toast('Saved map data deleted'); });
    // big map
    const bc = $('bigcanvas'); this.bm = { scale: 0.35, cx: 0, cz: 0, drag: null };
    bc.addEventListener('wheel', e => { e.preventDefault(); this.bm.scale = clamp(this.bm.scale * (e.deltaY > 0 ? 0.85 : 1.18), 0.03, 4); this.drawBig(); }, { passive: false });
    bc.style.touchAction = 'none'; bc.addEventListener('pointerdown', e => { if (e.isPrimary === false) return; this.bm.drag = { x: e.clientX, y: e.clientY, cx: this.bm.cx, cz: this.bm.cz, moved: false }; });
    addEventListener('pointermove', e => { const d = this.bm.drag; if (d && e.isPrimary === false) return; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; this.bm.cx = d.cx - dx / this.bm.scale; this.bm.cz = d.cz - dy / this.bm.scale; if (!$('bigmap').hidden) this.drawBig(); });
    addEventListener('pointerup', e => { if (e.isPrimary === false) return; const d = this.bm.drag; this.bm.drag = null; if (d && !d.moved && e.target === bc) { const r = bc.getBoundingClientRect(); const x = this.bm.cx + (e.clientX - r.left - r.width / 2) / this.bm.scale, z = this.bm.cz + (e.clientY - r.top - r.height / 2) / this.bm.scale; this.closeBig(); Game.teleport(x, z); } });
    this.refreshCache();
    this.mm = $('minimap').getContext('2d');
  },
  setQuality(q, silent) {
    Q = QUALITY[q]; document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.q === q));
    try { localStorage.setItem('gv-quality', q); } catch (e) { }
    if (silent || !Env.sun) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr)); Game.resize();
    Env.sun.castShadow = Q.shadows > 0; if (Q.shadows) { Env.sun.shadow.mapSize.set(Q.shadows, Q.shadows); if (Env.sun.shadow.map) { Env.sun.shadow.map.dispose(); Env.sun.shadow.map = null; } }
    Env.makeLampLights(); Game.bloom.enabled = Q.bloom; Grass.cx = 1e9;
  },
  cacheDirty() { clearTimeout(this._cd); this._cd = setTimeout(() => this.refreshCache(), 800); },
  async refreshCache() {
    const k = await Store.keys('osm'); const d = await Store.keys('dem');
    let est = ''; try { const e = await navigator.storage.estimate(); if (e && e.usage) est = ` · ${(e.usage / 1048576).toFixed(1)} MB used`; } catch (e) { }
    const total = this.cityTiles().length; const have = k.filter(x => this.cityTiles().some(t => tileKey(t[0], t[1]) === x)).length;
    $('cacheStat').innerHTML = Store.failed ? 'This browser blocked saving. Map data will download each time.' : `<b>${k.length}</b> map squares saved (${have} of ${total} for the whole city) · <b>${d.length}</b> elevation tiles${est}`;
  },
  cityTiles() { if (this._ct) return this._ct; const [x0, y0] = tileOfLL(CITY.s, CITY.w), [x1, y1] = tileOfLL(CITY.n, CITY.e); const out = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]); const [ox, oy] = tileOfLL(ORIGIN.lat, ORIGIN.lon); out.sort((a, b) => Math.hypot(a[0] - ox, a[1] - oy) - Math.hypot(b[0] - ox, b[1] - oy)); return this._ct = out; },
  peoplePack() {
    const n = RB.loaded.length, T = Math.min(RB.target, RB_POOL.length), run = RB.state === 'running' && !RB.paused;
    $('packStat').textContent = run ? `Loading characters… ${n} / ${T} ready` : n ? `${n} character models ready${RB.err ? ` (${RB.err} skipped)` : ''}${RB.state === 'paused' ? ' · paused' : ''}` : (RB.state === 'paused' ? 'Paused' : 'Loads automatically when you play.');
    $('packBarWrap').hidden = !run; $('packBar').style.width = (100 * n / T) + '%';
    $('packBtn').textContent = run ? 'Pause download' : (n >= T ? 'Pause download' : 'Resume download'); $('packBtn').disabled = !run && n >= T;
    const c = $('packchip'); c.textContent = `People pack ${n}/${T}`; c.classList.toggle('on', run);
  },
  async downloadCity() {
    if (this.cityRunning) { this.cityCancel = true; return; }
    this.cityRunning = true; this.cityCancel = false; $('cityBtn').textContent = 'Stop download'; $('cityBarWrap').hidden = false; $('cityMsg').hidden = false;
    const tiles = this.cityTiles(); const have = new Set(await Store.keys('osm'));
    const t0 = performance.now(); let fetched = 0; this.cityFailed = new Set();
    let todo = tiles.filter(([x, y]) => !have.has(tileKey(x, y))); const saved0 = tiles.length - todo.length;
    const msg = (extra) => {
      const got = tiles.length - todo.length + fetched - (this._passFetched0 || 0);
      $('cityBar').style.width = (Math.min(1, got / tiles.length) * 100) + '%';
      const el = (performance.now() - t0) / 1000, per = fetched ? el / fetched : 6, left = Math.max(0, tiles.length - got);
      $('cityMsg').textContent = `${got} of ${tiles.length} squares saved${this.cityFailed.size ? ` · ${this.cityFailed.size} to retry` : ''}${extra || (left ? ` · about ${Math.max(1, Math.ceil(left * per / 60 / 2))} min left` : '')}`;
    };
    // elevation for squares already saved (quick, and it's what makes the hills right)
    for (const [x, y] of tiles) { if (this.cityCancel) break; if (have.has(tileKey(x, y))) ensureDEM(tileBBox(x, y), 10).catch(() => { }); }
    const one = async ([x, y]) => {
      const k = tileKey(x, y);
      try {
        const c = await getTileData(x, y, 10); fetched++; this.cityFailed.delete(k);
        try { Overview.fromOSM(k, c); } catch (e) { }
        if (!Tiles.map.has(k)) forgetTileData(k);
        ensureDEM(tileBBox(x, y), 10).catch(() => { });
        if (Parcels.enabled) Parcels.get(x, y).catch(() => { });
        if (!$('bigmap').hidden) { (this.bigTiles || (this.bigTiles = new Set())).add(k); this.drawBig(); }
      } catch (e) { this.cityFailed.add(k); }
      msg();
    };
    this._passFetched0 = 0;
    // up to four passes: squares that fail (server busy, time-outs) are retried after a pause;
    // squares that are too dense for one request are fetched in quarters automatically
    for (let pass = 0; pass < 4 && todo.length && !this.cityCancel; pass++) {
      if (pass) { for (let w = 30 * pass; w > 0 && !this.cityCancel; w--) { msg(` · map server needs a break, retrying ${todo.length} in ${w}s`); await sleep(1000); } }
      this._passFetched0 = fetched; const before = fetched; const q = todo.slice(); todo = q; let idx = 0;
      const worker = async () => { while (idx < q.length && !this.cityCancel) await one(q[idx++]); };
      await Promise.all([worker(), worker()]);
      todo = q.filter(([x, y]) => this.cityFailed.has(tileKey(x, y))); this._passFetched0 = 0;
      fetched = before + (q.length - todo.length);
    }
    const ok = tiles.length - todo.length;
    this.cityRunning = false; $('cityBtn').textContent = 'Download whole city'; $('cityBar').style.width = (ok / tiles.length * 100) + '%';
    $('cityMsg').textContent = this.cityCancel ? `Download paused at ${ok} of ${tiles.length} squares. Press the button again to continue where it left off.`
      : todo.length ? `${ok} of ${tiles.length} squares saved. ${todo.length} couldn't be downloaded right now (the free map server is busy) — they're outlined red on the map; press the button again later to fetch just those.`
        : `Done — all ${tiles.length} squares saved${saved0 ? ` (${fetched} new)` : ''}. Greenville now loads without internet map downloads.`;
    this.refreshCache(); Overview.ensure(tiles.map(t => tileKey(t[0], t[1])).filter(k => !this.cityFailed.has(k)), () => { if (!$('bigmap').hidden) this.drawBig(); });
  },
  async exportData() {
    $('exportBtn').disabled = true; $('exportBtn').textContent = 'Exporting…';
    try {
      const out = { format: 'greenville-open-world-map', version: 1, created: new Date().toISOString(), osm: {}, dem: {} };
      for (const k of await Store.keys('osm')) out.osm[k] = bufToB64(await Store.get('osm', k));
      for (const k of await Store.keys('dem')) { const a = await Store.get('dem', k); const i16 = new Int16Array(a.length); for (let i = 0; i < a.length; i++) i16[i] = Math.round(a[i] * 10); out.dem[k] = bufToB64(await gzip(new Uint8Array(i16.buffer))); }
      const blob = new Blob([JSON.stringify(out)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'greenville-map-data.gvmap.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      this.toast(`Exported ${Object.keys(out.osm).length} map squares`);
    } catch (e) { this.toast('Export failed: ' + e.message); }
    $('exportBtn').disabled = false; $('exportBtn').textContent = 'Export map file';
  },
  async importData(file) {
    $('importBtn').disabled = true; $('importBtn').textContent = 'Importing…';
    try {
      const j = JSON.parse(await file.text()); if (j.format !== 'greenville-open-world-map') throw new Error('not a Greenville map file');
      let n = 0; for (const k in j.osm) { await Store.put('osm', k, b64ToBuf(j.osm[k])); n++; }
      for (const k in j.dem) { const txt = b64ToBuf(j.dem[k]); const ds = new Blob([txt]).stream().pipeThrough(new DecompressionStream('gzip')); const ab = await new Response(ds).arrayBuffer(); const i16 = new Int16Array(ab); const f = new Float32Array(i16.length); for (let i = 0; i < f.length; i++) f[i] = i16[i] / 10; await Store.put('dem', k, f); }
      this.toast(`Imported ${n} map squares`); this.refreshCache();
    } catch (e) { this.toast('Import failed: ' + e.message); }
    $('importBtn').disabled = false; $('importBtn').textContent = 'Import map file';
  },
  loading(on, title, msg, frac) { $('loading').hidden = !on; if (title) $('loadTitle').textContent = title; if (msg != null) $('loadMsg').textContent = msg; if (frac != null) $('loadBar').style.width = (frac * 100) + '%'; },
  hint(html) { if (html === this._hint) return; this._hint = html; const h = $('hint'); if (html) { h.innerHTML = html; h.classList.add('on'); } else h.classList.remove('on'); },
  toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), ms || 2600); },
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); },
  fmtHour(h) { let hh = Math.floor(h), mm = Math.floor((h - hh) * 60); const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; return `${hh}:${String(mm).padStart(2, '0')} ${ap}`; },
  tempF() { const h = Env.hour; const base = 74 + 8 * Math.cos((h - 15) / 24 * Math.PI * 2); return Math.round(base - Env.cloudCover * 4 - Env.rain * 6); },
  update(dt) {
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3);
    this._t = (this._t || 0) + dt; if (this._t < 0.12) return; const step = this._t; this._t = 0;
    const P = Player, f = P.focus();
    $('clockT').textContent = this.fmtHour(Env.hour);
    $('clockW').textContent = `${{ clear: 'Clear', partly: 'Partly cloudy', overcast: 'Overcast', rain: 'Rain' }[Env.weather]} · ${this.tempF()}°F`;
    const sp = $('speedo'); sp.hidden = P.mode !== 'drive'; if (P.mode === 'drive') { $('spd').textContent = Math.round(Math.abs(P.car.speed) * 2.237); $('gear').textContent = P.car.gear + (P.headlights ? ' · lights' : ''); }
    // street + area names
    this._n = (this._n || 0) + 1;
    if (this._n % 2 === 0) {
      const n = nearestRoad(f.x, f.z, 30, r => r.name && r.car) || nearestRoad(f.x, f.z, 18, r => !!r.name);
      $('street').textContent = n ? n.road.name : (nearestRoad(f.x, f.z, 20) ? 'Unnamed road' : 'Off road');
      let area = ''; let best = 1e12;
      for (const a of World.areas) { if (f.x < a.bb[0] || f.x > a.bb[2] || f.z < a.bb[1] || f.z > a.bb[3]) continue; if (a.area < best && a.rings.some(r => pointInPoly(f.x, f.z, r))) { best = a.area; area = a.name; } }
      let bname = ''; const nf = Food.nearest(f.x, f.z, 45); if (nf) bname = nf.name; else for (const b of World.bldHash.query(f.x - 35, f.z - 35, f.x + 35, f.z + 35)) if (b.name && Math.hypot(b.cx - f.x, b.cz - f.z) < 45) { bname = b.name; break; }
      const pc = Parcels.at(f.x, f.z); const lot = pc ? [pc.addr, pc.sub && pc.sub !== area ? pc.sub : ''].filter(Boolean).join(' · ') : '';
      const parts = [area, lot, bname && bname !== area ? 'near ' + bname : ''].filter(Boolean);
      $('area').textContent = (parts.join(' · ') || 'Greenville, NC') + `  ·  ${zToLat(f.z).toFixed(4)}, ${xToLon(f.x).toFixed(4)}`;
    }
    const nl = Tiles.loadingCount() + Net.queue.length; const chip = $('netchip'); chip.textContent = `Loading map · ${nl} area${nl === 1 ? '' : 's'}`; chip.classList.toggle('on', nl > 0);
    if (!$('dbg').hidden) { const i = renderer.info; $('dbg').textContent = `fps ${Math.round(Game.fps)}\ndraw calls ${i.render.calls}\ntriangles ${(i.render.triangles / 1000).toFixed(0)}k\ntiles ${Tiles.map.size}  roads ${World.roads.size}\ncars ${Traffic.cars.length}  people ${Peds.list.length}\ndownloaded ${Net.downloaded}  net errors ${Net.errors}`; }
    this.drawMini(f);
  },
  drawMini(f) {
    const g = this.mm, S = 380, R = S / 2, sc = S / 300; // 300 m across
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(R, R, R, 0, 7); g.clip();
    g.fillStyle = '#34452d'; g.fillRect(0, 0, S, S);
    const cy = Player.camYaw; const phi = Math.atan2(-Math.cos(cy), -Math.sin(cy)); const th = -Math.PI / 2 - phi;
    g.translate(R, R); g.rotate(th); g.scale(sc, sc); g.translate(-f.x, -f.z);
    const q = World.mmHash.query(f.x - 220, f.z - 220, f.x + 220, f.z + 220);
    for (const T of Tiles.map.values()) if (T.water) for (const a of T.water) { g.fillStyle = a.kind === 'water' ? '#3e6478' : a.kind === 'park' ? '#3f5c34' : '#2f4527'; ringsPath(g, a.rings); g.fill('evenodd'); }
    g.fillStyle = '#7b7670';
    for (const it of q) if (it.bld) { ringsPath(g, [it.bld]); g.fill(); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const roads = q.filter(it => it.road && !it.road.removed).map(it => it.road).sort((a, b) => a.rank - b.rank);
    for (const r of roads) {
      if (!r.car) { g.strokeStyle = 'rgba(220,210,190,.55)'; g.lineWidth = 1.4; g.setLineDash([2, 2]); }
      else { g.setLineDash([]); g.strokeStyle = r.rank >= 7 ? '#f2c230' : r.rank >= 5 ? '#f3e2a8' : '#e9e6df'; g.lineWidth = Math.max(4, r.w * 0.9); }
      linePath(g, r.pts); g.stroke();
    }
    g.setLineDash([]);
    // street names on the minimap (kept upright on screen)
    g.font = `600 ${11 / sc}px IBM Plex Sans, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const seen = new Set(); let lbl = 0;
    const segs = World.segHash.query(f.x - 110, f.z - 110, f.x + 110, f.z + 110).filter(it => it.road.car && it.road.name && !it.road.removed);
    segs.sort((a, b) => b.road.rank - a.road.rank);
    for (const it of segs) {
      if (seen.has(it.road.name) || lbl > 7) continue; const a = it.road.pts[it.i], b = it.road.pts[it.i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 30) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (Math.hypot(mx - f.x, mz - f.z) > 120) continue;
      seen.add(it.road.name); lbl++;
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const scr = angleDiff(0, ang + th); if (Math.abs(scr) > Math.PI / 2) ang += Math.PI;
      g.save(); g.translate(mx, mz); g.rotate(ang); g.lineWidth = 3 / sc; g.strokeStyle = 'rgba(30,40,28,.9)'; g.strokeText(it.road.name, 0, 0); g.fillStyle = '#fff'; g.fillText(it.road.name, 0, 0); g.restore();
    }
    g.fillStyle = '#fff'; for (const c of Traffic.cars) { g.beginPath(); g.arc(c.x, c.z, 2.4, 0, 7); g.fill(); }
    g.fillStyle = '#ffd9a0'; for (const p of Peds.list) { g.beginPath(); g.arc(p.x, p.z, 1.3, 0, 7); g.fill(); }
    if (Player.mode === 'walk') { g.fillStyle = '#b37cf0'; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(Player.car.pos.x, Player.car.pos.z, 4, 0, 7); g.fill(); g.stroke(); }
    g.restore();
    // player arrow in the middle, pointing up the screen (camera-relative map)
    g.save(); g.translate(R, R); const hy = Player.mode === 'drive' ? Player.car.yaw : Player.yaw; g.rotate(Math.atan2(Math.cos(hy), Math.sin(hy)) + th + Math.PI / 2);
    g.fillStyle = '#f2c230'; g.strokeStyle = '#1b1325'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 11); g.lineTo(0, 5); g.lineTo(-10, 11); g.closePath(); g.stroke(); g.fill(); g.restore();
    // north marker
    const na = -Math.PI / 2 + th; g.save(); g.translate(R + Math.cos(na) * (R - 20), R + Math.sin(na) * (R - 20)); g.fillStyle = '#1b1325'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '600 16px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', 0, 1); g.restore();
    g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.stroke();
  },
  async openBig() {
    $('bigmap').hidden = false; const f = Player.focus(); this.bm.cx = f.x; this.bm.cz = f.z; this.bigTiles = new Set(await Store.keys('osm')); this.drawBig(); Overview.ensure([...this.bigTiles], () => { if (!$('bigmap').hidden) this.drawBig(); });
  },
  closeBig() { $('bigmap').hidden = true; },
  drawBig() {
    const c = $('bigcanvas'); const w = c.clientWidth, h = c.clientHeight; if (c.width !== w * devicePixelRatio) { c.width = w * devicePixelRatio; c.height = h * devicePixelRatio; }
    const g = c.getContext('2d'); g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.fillStyle = '#1d2a1e'; g.fillRect(0, 0, w, h);
    const s = this.bm.scale; g.translate(w / 2, h / 2); g.scale(s, s); g.translate(-this.bm.cx, -this.bm.cz);
    // tile grid: saved squares outlined in gold
    for (const [x, y] of this.cityTiles()) { const W = tileWorld(x, y); const k = tileKey(x, y), saved = this.bigTiles && this.bigTiles.has(k), bad = this.cityFailed && this.cityFailed.has(k); g.strokeStyle = bad ? 'rgba(235,80,60,.8)' : saved ? 'rgba(242,194,48,.35)' : 'rgba(255,255,255,.08)'; g.lineWidth = 2 / s; g.strokeRect(W.x0, W.z0, W.x1 - W.x0, W.z1 - W.z0); }
    { const W = w / 2 / s, Hh = h / 2 / s; Overview.draw(g, s, { x0: this.bm.cx - W, x1: this.bm.cx + W, z0: this.bm.cz - Hh, z1: this.bm.cz + Hh }); }
    for (const T of Tiles.map.values()) if (T.water) for (const a of T.water) { g.fillStyle = a.kind === 'water' ? '#3e6478' : '#2f4a2c'; ringsPath(g, a.rings); g.fill('evenodd'); }
    g.lineCap = 'round';
    for (const r of World.roads.values()) { if (!r.car) continue; g.strokeStyle = r.rank >= 7 ? '#f2c230' : r.rank >= 5 ? '#e8d9a0' : 'rgba(230,226,215,.8)'; g.lineWidth = Math.max(1 / s, r.w * (s < 0.2 ? 1.5 : 0.8)); linePath(g, r.pts); g.stroke(); }
    // road names along the streets
    if (s > 0.45) {
      g.font = `600 ${11 / s}px IBM Plex Sans, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const placed = []; const minSep = 140 / s;
      const named = [...World.roads.values()].filter(r => r.car && r.name && r.len > 40 / s * 0.5).sort((a, b) => b.rank - a.rank || b.len - a.len);
      for (const r of named) {
        const m = pointAlong(r, r.len / 2), m2 = pointAlong(r, Math.min(r.len, r.len / 2 + 4));
        if (placed.some(p => p[2] === r.name && Math.hypot(p[0] - m[0], p[1] - m[1]) < minSep * 2.5) || placed.some(p => Math.hypot(p[0] - m[0], p[1] - m[1]) < minSep * 0.5)) continue;
        placed.push([m[0], m[1], r.name]);
        let ang = Math.atan2(m2[1] - m[1], m2[0] - m[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        g.save(); g.translate(m[0], m[1]); g.rotate(ang); g.lineWidth = 3 / s; g.strokeStyle = 'rgba(20,28,20,.9)'; g.strokeText(r.name, 0, 0); g.fillStyle = '#fff'; g.fillText(r.name, 0, 0); g.restore();
      }
      g.textBaseline = 'alphabetic';
    }
    // restaurants (dots; names when zoomed in)
    if (s > 0.25) { g.font = `600 ${10 / s}px IBM Plex Sans, sans-serif`; g.textAlign = 'left'; for (const fd of Food.list) { g.fillStyle = fd.look.trim; g.strokeStyle = '#fff'; g.lineWidth = 1.5 / s; g.beginPath(); g.arc(fd.x, fd.z, 3.5 / s, 0, 7); g.fill(); g.stroke(); if (s > 1.1) { g.fillStyle = '#ffe9c4'; g.fillText(fd.name, fd.x + 6 / s, fd.z + 3 / s); } } }
    // landmarks
    g.font = `600 ${13 / s}px IBM Plex Sans, sans-serif`; g.textAlign = 'left';
    for (const [name, la, lo] of LANDMARKS) { const x = lonToX(lo), z = latToZ(la); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(x, z, 5 / s, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText(name, x + 8 / s, z + 4 / s); }
    const f = Player.focus(); g.fillStyle = '#b37cf0'; g.strokeStyle = '#fff'; g.lineWidth = 2 / s; g.beginPath(); g.arc(f.x, f.z, 7 / s, 0, 7); g.fill(); g.stroke();
  },
};

// =====================================================================
// FIRST-VISIT DOWNLOAD — on the hosted site, new players quietly download every packed map square
// of Pitt County (and its elevation) into the browser in the background, so the whole county
// loads instantly from then on, even offline. It pauses while the area around you is loading.
// =====================================================================
const Prefetch = {
  running: false, done: 0, total: 0,
  async start() {
    if (this.running || !window.GV_DATA || Store.failed) return; this.running = true;
    try {
      const list = await fetch(window.GV_DATA + 'osm/index.json').then(r => r.ok ? r.json() : []).catch(() => []);
      const have = new Set(await Store.keys('osm')); const todo = list.filter(n => !have.has(n.replace('_', ',')) && !have.has(tileKey(...n.split('_').map(Number))));
      this.total = list.length; this.done = list.length - todo.length; if (!todo.length) return this.dem(list);
      // nearest squares first
      const f = Player.focus ? Player.focus() : null; if (f) { const [px, py] = tileOfXZ(f.x, f.z); todo.sort((a, b) => { const [ax, ay] = a.split('_').map(Number), [bx, by] = b.split('_').map(Number); return Math.hypot(ax - px, ay - py) - Math.hypot(bx - px, by - py); }); }
      const chip = $('prechip'); let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          while (Tiles.loadingCount() > 0 || document.hidden) await sleep(700); // never compete with the map you're standing in
          const n = todo[i++]; const [tx, ty] = n.split('_').map(Number); const k = tileKey(tx, ty);
          try { if (!(await Store.get('osm', k))) { const raw = await packedTile(tx, ty); if (raw) { const c = compactOSM(raw); await Store.put('osm', k, await gzip(JSON.stringify(c))); try { Overview.fromOSM(k, c); } catch (e) { } } } } catch (e) { }
          this.done++; if (chip) { chip.textContent = `Saving Pitt County map for offline play · ${Math.round(this.done / this.total * 100)}%`; chip.style.opacity = this.done < this.total ? 1 : 0; }
          await sleep(15);
        }
      };
      await Promise.all([worker(), worker()]);
      if (chip) chip.style.opacity = 0; UI.cacheDirty && UI.cacheDirty(); UI.toast('The whole Pitt County map is saved on this device', 4000);
      await this.dem(list);
    } catch (e) { console.warn('background map download stopped', e); }
    finally { this.running = false; }
  },
  async dem(list) { // elevation for every square (a few dozen image tiles cover the county)
    const seen = new Set();
    for (const n of list) { const [tx, ty] = n.split('_').map(Number); const b = tileBBox(tx, ty); const key = Math.floor(lonToPX((b.w + b.e) / 2) / 256) + ',' + Math.floor(latToPY((b.s + b.n) / 2) / 256); if (seen.has(key)) continue; seen.add(key);
      while (Tiles.loadingCount() > 0 || document.hidden) await sleep(700); try { await ensureDEM(b, 20); } catch (e) { } }
  },
};
