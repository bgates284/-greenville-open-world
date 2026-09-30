// =====================================================================
// IDLE CINEMATIC — after 30 seconds with no input, the camera leaves the player: first two minutes
// of the ECU plane flying a sightseeing loop over Greenville (chase, wing, fly-by and wide shots),
// then 30 seconds following one of the city's people (third-person follow, slow orbits, low tracking
// shots and crane moves) somewhere else in town, then back up in the plane, and so on.
// Any key, click, touch or mouse movement brings you straight back to where you were.
// =====================================================================
const Cine = {
  IDLE_MS: 30000, SCENE_S: 30, SHOT_S: 13, PLANE_S: 120, PLANE_SHOT_S: 15, next: 'plane',
  active: false, lastInput: performance.now(), focus: new THREE.Vector3(),
  spots: null, spotI: -1, subject: null, t: 0, shotT: 0, shot: 0, phase: 'off', fade: 0,
  camPos: new THREE.Vector3(), camLook: new THREE.Vector3(),

  poke(e) { // any real input
    if (e && e.type === 'mousemove') { const m = Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); if (m < 3) return; }
    this.lastInput = performance.now();
    if (this.active && this.phase !== 'return') this.stop();
  },
  eligible() {
    if (!Game.playing || Game.paused || !Game.started) return false;
    if (!$('bigmap').hidden) return false;
    if (Player.mode === 'fly' && typeof Plane !== 'undefined' && !Plane.onGround) return false; // never leave a plane in the air
    if (Player.mode === 'heli' && typeof Heli !== 'undefined' && !Heli.onGround) return false;
    return true;
  },

  // ---------- the places it visits ----------
  buildSpots() { // ECU, ECU Health, fast food and retail — never the smoke / vape shops
    const S = [], add = (name, x, z) => S.push({ name, x, z });
    for (const [name, la, lo] of LANDMARKS) if (/^ECU|Dowdy|Clark-LeClair|Greenville Mall/.test(name)) add(name, lonToX(lo), latToZ(la));
    add('ECU · College Hill', lonToX(-77.3584), latToZ(35.6048)); add('ECU · Mendenhall & the Mall', lonToX(-77.3655), latToZ(35.6053)); add('ECU Health Medical Center · Emergency', lonToX(-77.4022), latToZ(35.6073)); add('ECU Brody School of Medicine', lonToX(-77.4062), latToZ(35.6098));
    const pickSome = (list, n) => { const out = []; const used = new Set(); for (const f of list.sort(() => Math.random() - 0.5)) { const t = tileOfXZ(f.x, f.z).join(','); if (used.has(t)) continue; used.add(t); out.push(f); if (out.length >= n) break; } return out; };
    const ok = f => f.look && !f.look.smoke && !SMOKE_KINDS.test(f.amenity || '');
    for (const f of pickSome(Food.list.filter(f => ok(f) && f.kind === 'food' && f.amenity === 'fast_food'), 10)) add(f.name, f.x, f.z);
    for (const f of pickSome(Food.list.filter(f => ok(f) && (f.kind === 'centre' || (f.kind === 'shop' && f.brand))), 10)) add(f.name, f.x, f.z);
    // shuffle so every idle session is a different tour
    for (let i = S.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S[i], S[j]] = [S[j], S[i]]; }
    return S;
  },
  nextSpot() {
    if (!this.spots) this.spots = this.buildSpots();
    const cur = tileOfXZ(this.focus.x, this.focus.z).join(',');
    for (let k = 0; k < this.spots.length; k++) { this.spotI = (this.spotI + 1) % this.spots.length; const s = this.spots[this.spotI]; if (tileOfXZ(s.x, s.z).join(',') !== cur) return s; }
    return this.spots[0];
  },

  // ---------- start / stop ----------
  start() {
    this.active = true; this.phase = 'fadeout'; this.next = 'plane'; this.fade = 0; this.home = Player.focus().clone(); this.focus.copy(this.home);
    this.hudWas = $('hud').hidden; $('hud').hidden = true; if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) { }
    this.ui(true); this.caption('', '');
  },
  stop() { // back to the player: wait for the map around them, then fade in
    this.phase = 'return'; this.subject = null; if (this.fp) this.fp.g.visible = false; this.focus.copy(Player.focus()); this.fadeTo = 1; this.caption('Welcome back', 'returning to where you left off…');
  },
  finish() { if (this.fp) this.fp.g.visible = false; this.active = false; this.phase = 'off'; $('hud').hidden = this.hudWas; this.ui(false); Player.camPos.copy(Player.focus()).add(new THREE.Vector3(0, 3, 6)); },

  // ---------- per frame (called from Game.frame) ----------
  update(dt) {
    if (!this.active) { if (performance.now() - this.lastInput > this.IDLE_MS && this.eligible()) this.start(); return; }
    this.t += dt;
    const fadeSpeed = dt / 0.8;
    if (this.phase === 'fadeout') { this.fade = Math.min(1, this.fade + fadeSpeed); if (this.fade >= 1) { if (this.fp) this.fp.g.visible = false; if (this.next === 'plane') this.fly(); else this.goto(this.nextSpot()); } }
    else if (this.phase === 'flyload') { // wait for the ground under the plane
      this.fade = 1; this.flyStep(0); const P = this.fp.g.position;
      if ((Tiles.readyAround(P.x, P.z, 1) && this.t > 1.5) || this.t > 20) { this.phase = 'fly'; this.t = 0; this.pshot = Math.floor(Math.random() * 4); this.newPlaneShot(true); }
    }
    else if (this.phase === 'fly') {
      this.fade = Math.max(0, this.fade - fadeSpeed); this.flyStep(dt); this.filmPlane(dt);
      if (this.t > this.PLANE_S) { this.phase = 'fadeout'; this.next = 'npc'; }
    }
    else if (this.phase === 'load') { // waiting for the new map square
      this.fade = 1; const s = this.spot; this.focus.set(s.x, 0, s.z);
      if (Tiles.readyAround(s.x, s.z, 1) || this.t > 40) { if (!this.crowdDone) { this.crowdDone = true; this.seed(s); } if (this.t > 2.5) this.pick(); }
    }
    else if (this.phase === 'show') {
      this.fade = Math.max(0, this.fade - fadeSpeed);
      if (!this.alive(this.subject)) this.pick();
      if (this.subject) this.film(dt);
      if (this.t > this.SCENE_S) { this.phase = 'fadeout'; this.next = 'plane'; }
    }
    else if (this.phase === 'return') {
      this.fade = Math.min(1, this.fade + fadeSpeed); const f = Player.focus(); this.focus.copy(f);
      if (this.fade >= 1 && Tiles.readyAround(f.x, f.z, 1)) { this.finish(); this.fadeEl.style.opacity = 0; return; }
    }
    this.fadeEl.style.opacity = this.fade.toFixed(3);
  },
  goto(s) {
    this.spot = s; this.phase = 'load'; this.t = 0; this.crowdDone = false; this.subject = null;
    this.focus.set(s.x, 0, s.z); Tiles.update(s.x, s.z);
    this.caption(s.name, 'Greenville, NC');
  },
  seed(s) { // make sure there are people to film here
    let x = s.x, z = s.z; const r = nearestRoad(x, z, 80, q => q.ped || q.car); if (r) { x = r.x; z = r.z; }
    try { Peds.spawnCrowd(x, z, 4 + Math.floor(Math.random() * 3)); } catch (e) { }
    for (let k = 0; k < 6; k++) try { Peds.spawn(this.focus); } catch (e) { }
  },
  candidates() {
    const out = []; const c = this.focus; const near = (x, z) => Math.hypot(x - c.x, z - c.z) < 170;
    for (const p of Peds.list) if (p.state === 'walk' && near(p.x, p.z)) out.push({ o: p, w: 3, label: 'out for a walk' });
    for (const p of Peds.crowd) if (near(p.x, p.z)) out.push({ o: p, w: 1, label: 'hanging out with friends' });
    try { for (const set of HospitalLife.sets.values()) for (const a of set.actors) if (near(a.x, a.z)) out.push({ o: a, w: 2, label: a.kind === 'push' ? 'nurse on a wheelchair run' : a.kind === 'iv' ? 'patient taking a walk' : a.kind === 'doctor' ? 'doctor between rounds' : 'hospital staff' }); } catch (e) { }
    return out;
  },
  pick() {
    const C = this.candidates(); if (!C.length) { if (this.t > 12) this.goto(this.nextSpot()); return; }
    let tot = C.reduce((s, c) => s + c.w, 0), u = Math.random() * tot, pickd = C[0]; for (const c of C) { u -= c.w; if (u <= 0) { pickd = c; break; } }
    this.subject = pickd; this.phase = 'show'; this.t = 0; this.shotT = 0; this.shot = Math.floor(Math.random() * 4); this.newShot(true);
    const nm = this.spot ? this.spot.name : ''; this.caption(nm, pickd.label);
  },
  alive(s) { return s && s.o && s.o.person && s.o.person.g && s.o.person.g.parent; },
  pos(s) { const g = s.o.person.g; return g.position; },

  // ---------- camera work ----------
  newShot(first) {
    if (!first) this.shot = (this.shot + 1 + Math.floor(Math.random() * 2)) % 4;
    this.shotT = 0; this.orbitA = Math.random() * Math.PI * 2; this.orbitDir = Math.random() < 0.5 ? -1 : 1;
    const p = this.pos(this.subject); const yaw = this.subject.o.yaw || 0; const head = new THREE.Vector3(p.x, p.y + 1.4, p.z);
    // fixed tripod for the tracking shot: the first angle with a clear view of the subject
    for (let k = 0; k < 10; k++) {
      const a = yaw + 0.6 + k * 0.63, d = 7 - (k > 5 ? 2 : 0); const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      const v = new THREE.Vector3(x, groundY(x, z, H(x, z) + 1) + 0.6, z); this.anchor = v;
      if (!insideBuilding(x, z) && this.blocked(v, head) === null) break;
    }
    this.snap = true; this.pull = 1;
  },
  film(dt) {
    this.shotT += dt; if (this.shotT > this.SHOT_S) this.newShot(false);
    const p = this.pos(this.subject); const yaw = this.subject.o.yaw != null ? this.subject.o.yaw : 0; const k = this.shotT / this.SHOT_S;
    this.focus.set(p.x, 0, p.z);
    const want = new THREE.Vector3(), look = new THREE.Vector3(p.x, p.y + 1.3, p.z);
    if (this.shot === 0) { // third person: over the shoulder, trailing behind
      want.set(p.x - Math.sin(yaw) * 3.6 + Math.cos(yaw) * 0.7, p.y + 1.9, p.z - Math.cos(yaw) * 3.6 - Math.sin(yaw) * 0.7);
      look.set(p.x + Math.sin(yaw) * 4, p.y + 1.4, p.z + Math.cos(yaw) * 4);
    } else if (this.shot === 1) { // slow orbit
      const a = this.orbitA + this.orbitDir * this.shotT * 0.16; want.set(p.x + Math.sin(a) * 5.5, p.y + 1.7 + Math.sin(this.shotT * 0.3) * 0.4, p.z + Math.cos(a) * 5.5);
    } else if (this.shot === 2) { // low tripod, panning to follow
      want.copy(this.anchor); look.y = p.y + 1.1;
      if (want.distanceTo(p) > 26) this.newShot(false);
    } else { // crane: starts at head height in front, rises and pulls back
      const a = yaw + Math.PI * 0.85; const d = 3 + k * 9, h = 1.6 + k * 11; want.set(p.x + Math.sin(a) * d, p.y + h, p.z + Math.cos(a) * d); look.y = p.y + 1.0;
    }
    // nothing between the lens and the subject: pull in like a spring arm when a wall, canopy or truck is in the way
    this.occT = (this.occT || 0) - dt;
    if (this.occT <= 0) { this.occT = 0.4; const head = new THREE.Vector3(p.x, p.y + 1.4, p.z); const d = want.distanceTo(head); const hit = this.blocked(want, head); this.pullWant = hit === null ? 1 : Math.max(0.12, (d - hit - 0.4) / d); if (hit !== null && this.shot === 2) { this.newShot(false); return; } }
    this.pull = this.pull == null ? 1 : this.pull + ((this.pullWant == null ? 1 : this.pullWant) - this.pull) * Math.min(1, dt * (this.pullWant < this.pull ? 8 : 1.5));
    if (this.pull < 0.999) { want.x = p.x + (want.x - p.x) * this.pull; want.z = p.z + (want.z - p.z) * this.pull; want.y = p.y + 1.4 + (want.y - p.y - 1.4) * this.pull + (1 - this.pull) * 0.5; }
    // keep the camera out of buildings and above ground
    const gy = H(want.x, want.z); if (want.y < gy + 0.5) want.y = gy + 0.5;
    if (insideBuilding(want.x, want.z) && this.shot !== 3) { want.set(p.x + (want.x - p.x) * 0.45, Math.max(want.y, p.y + 2.2), p.z + (want.z - p.z) * 0.45); }
    const s = this.snap ? 1 : 1 - Math.exp(-dt * (this.shot === 2 ? 20 : 2.5)); this.snap = false;
    this.camPos.lerp(want, s); if (s === 1) this.camLook.copy(look); else this.camLook.lerp(look, 1 - Math.exp(-dt * 4));
  },
  // ---------- the plane: a sightseeing loop over Greenville ----------
  route() {
    if (this.curve) return this.curve;
    const W = [[35.6117, -77.3718], [35.6175, -77.3690], [35.6300, -77.3790], [35.6352, -77.3854], [35.6290, -77.4010], [35.6120, -77.4080], [35.6073, -77.4022],
      [35.5960, -77.3950], [35.5880, -77.3780], [35.5965, -77.3653], [35.6030, -77.3560], [35.6070, -77.3645]];
    const pts = W.map(([la, lo], i) => { const x = lonToX(lo), z = latToZ(la); return new THREE.Vector3(x, 0, z); });
    // cruise ~230 m above the highest ground along the way, with gentle climbs and descents
    let top = 0; for (const p of pts) top = Math.max(top, H(p.x, p.z)); pts.forEach((p, i) => { p.y = top + 215 + Math.sin(i * 1.7) * 25; });
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5); this.curveLen = this.curve.getLength(); this.flyS = Math.random() * this.curveLen;
    return this.curve;
  },
  fly() {
    this.route(); if (!this.fp) { this.fp = buildPlaneModel(); dynRoot.add(this.fp.g); }
    this.fp.g.visible = true; this.phase = 'flyload'; this.t = 0; this.subject = null; this.pvel = 52;
    this.flyStep(0); const P = this.fp.g.position; this.focus.copy(P); Tiles.update(P.x, P.z);
    this.caption('Over Greenville', 'the ECU plane out of Pitt-Greenville Airport');
  },
  flyStep(dt) { // move along the loop; nose along the path, banked into the turns
    const C = this.curve, L = this.curveLen; this.flyS = (this.flyS + this.pvel * dt) % L; const u = this.flyS / L, du = 1.5 / L;
    const P = C.getPointAt(u), F = C.getTangentAt(u).normalize(), F2 = C.getTangentAt((u + du) % 1).normalize();
    const acc = F2.clone().sub(F).multiplyScalar(this.pvel * this.pvel / 1.5); acc.y = 0; // centripetal acceleration
    const up = new THREE.Vector3(0, 1, 0).add(acc.multiplyScalar(1 / 9.81)).normalize();
    const Lx = new THREE.Vector3().crossVectors(up, F).normalize(), U = new THREE.Vector3().crossVectors(F, Lx);
    const m = new THREE.Matrix4().makeBasis(Lx, U, F); const q = new THREE.Quaternion().setFromRotationMatrix(m);
    const g = this.fp.g; g.position.copy(P); if (dt === 0) g.quaternion.copy(q); else g.quaternion.slerp(q, 1 - Math.exp(-dt * 3));
    const M = this.fp; this.propA = (this.propA || 0) + 60 * dt; if (M.prop) { M.prop.rotation.z = this.propA; M.prop.visible = false; } if (M.disc) M.disc.material.opacity = 0.18;
    this.pt = (this.pt || 0) + dt; if (M.strobes) for (const s of M.strobes) s.visible = (this.pt % 1.2) < 0.08; if (M.beacon) M.beacon.visible = (this.pt % 1.0) < 0.5;
    this.focus.copy(P);
  },
  newPlaneShot(first) {
    if (!first) this.pshot = (this.pshot + 1) % 4;
    this.pshotT = 0; this.psnap = true; const g = this.fp.g;
    if (this.pshot === 2) { // fly-by: a fixed spot ahead and off to one side
      const u = ((this.flyS + this.pvel * 5) % this.curveLen) / this.curveLen; const A = this.curve.getPointAt(u), F = this.curve.getTangentAt(u);
      const side = new THREE.Vector3(F.z, 0, -F.x).normalize().multiplyScalar(Math.random() < 0.5 ? 38 : -38); this.panchor = A.add(side); this.panchor.y -= 12;
    }
  },
  filmPlane(dt) {
    this.pshotT += dt; if (this.pshotT > this.PLANE_SHOT_S) this.newPlaneShot(false);
    const g = this.fp.g, P = g.position; const F = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion), Lx = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
    const Fh = new THREE.Vector3(F.x, 0, F.z).normalize(); const want = new THREE.Vector3(), look = P.clone(); let rate = 3;
    if (this.pshot === 0) { want.copy(P).addScaledVector(Fh, -24).add(new THREE.Vector3(0, 6.5, 0)); look.addScaledVector(Fh, 30); }                      // chase
    else if (this.pshot === 1) { const k = this.pshotT / this.PLANE_SHOT_S; const sd = Lx.clone().setY(0).normalize(); want.copy(P).addScaledVector(sd, 20).addScaledVector(Fh, 10 - k * 22).add(new THREE.Vector3(0, 2.5, 0)); } // alongside, drifting back
    else if (this.pshot === 2) { want.copy(this.panchor); rate = 50; if (this.panchor.distanceTo(P) > 420 && this.pshotT > 4) this.newPlaneShot(false); } // fly-by
    else { const a = this.pshotT * 0.05; want.copy(P).addScaledVector(Fh, -70).add(new THREE.Vector3(Math.sin(a) * 30, 55, Math.cos(a) * 30)); look.copy(P).addScaledVector(Fh, 70); look.y -= 30; } // wide, looking down over the city
    const gy = H(want.x, want.z) + 3; if (want.y < gy) want.y = gy;
    const s = this.psnap ? 1 : 1 - Math.exp(-dt * rate); this.psnap = false;
    this.camPos.lerp(want, s); if (s === 1) this.camLook.copy(look); else this.camLook.lerp(look, 1 - Math.exp(-dt * 5));
  },
  blocked(from, to) { // distance from the subject back toward the camera at which something solid blocks the view, or null
    const ray = this.ray || (this.ray = new THREE.Raycaster()); ray.camera = camera;
    const dir = new THREE.Vector3().subVectors(from, to); const d = dir.length(); if (d < 0.5) return null; dir.divideScalar(d);
    ray.set(to, dir); ray.near = 0.6; ray.far = d;
    const hits = ray.intersectObject(worldRoot, true); for (const h of hits) { if (h.object.isSprite || h.object.isPoints || h.object.isLine) continue; const m = h.object.material; if (m && (m.transparent && m.opacity < 0.5)) continue; return h.distance; }
    return null;
  },
  apply() { // called right before rendering
    if (!this.active || (this.phase !== 'show' && this.phase !== 'fly')) return;
    camera.position.copy(this.camPos); camera.lookAt(this.camLook);
  },

  // ---------- letterbox, fade, caption ----------
  ui(on) {
    if (!this.root) {
      const d = document.createElement('div'); d.id = 'cine'; d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40;display:none';
      d.innerHTML = '<div style="position:absolute;left:0;right:0;top:0;height:9vh;background:#000"></div><div style="position:absolute;left:0;right:0;bottom:0;height:11vh;background:#000"></div>'
        + '<div class="cf" style="position:absolute;inset:0;background:#000;opacity:0"></div>'
        + '<div style="position:absolute;left:4vw;bottom:2.4vh;color:#fff;font:600 20px/1.2 system-ui,Segoe UI,Arial,sans-serif;letter-spacing:.02em;text-shadow:0 1px 3px #000"><div class="c1"></div><div class="c2" style="font-weight:400;font-size:14px;opacity:.75;margin-top:3px"></div></div>'
        + '<div style="position:absolute;right:4vw;bottom:3.4vh;color:#fff;opacity:.6;font:13px system-ui,Segoe UI,Arial,sans-serif">Press any key or move the mouse to play</div>';
      document.body.appendChild(d); this.root = d; this.fadeEl = d.querySelector('.cf'); this.c1 = d.querySelector('.c1'); this.c2 = d.querySelector('.c2');
    }
    this.root.style.display = on ? 'block' : 'none';
  },
  caption(a, b) { if (!this.c1) this.ui(this.active); this.c1.textContent = a; this.c2.textContent = b; },
};
// the key or click that wakes the game up only ends the cinematic (it doesn't also honk, jump or open a menu)
for (const ev of ['keydown', 'mousedown', 'pointerdown']) addEventListener(ev, e => { const was = Cine.active && Cine.phase !== 'return'; Cine.poke(e); if (was) { e.stopImmediatePropagation(); if (ev === 'keydown') e.preventDefault(); } }, { capture: true });
for (const ev of ['mousemove', 'wheel', 'touchstart', 'keyup']) addEventListener(ev, e => Cine.poke(e), { passive: true, capture: true });
setInterval(() => { try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && (g.buttons.some(b => b.pressed) || g.axes.some(a => Math.abs(a) > 0.25))) Cine.poke(); } catch (e) { } }, 500);
