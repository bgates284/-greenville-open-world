
// =====================================================================
// INPUT
// =====================================================================
const Keys = new Set(); const Pressed = new Set();
const Mouse = { dx: 0, dy: 0, drag: false, lastMove: -99, locked: false, wheel: 0 };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (!Keys.has(e.code)) Pressed.add(e.code); Keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3'].includes(e.code) && Game.playing) e.preventDefault();
});
addEventListener('keyup', e => Keys.delete(e.code));
addEventListener('blur', () => Keys.clear());
canvasEl.addEventListener('mousedown', e => { Mouse.drag = true; if (Game.playing && !Mouse.locked && canvasEl.requestPointerLock) { try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (err) { } } });
addEventListener('mouseup', () => Mouse.drag = false);
addEventListener('mousemove', e => { if (Mouse.locked || Mouse.drag) { Mouse.dx += e.movementX; Mouse.dy += e.movementY; Mouse.lastMove = performance.now() / 1000; } });
document.addEventListener('pointerlockchange', () => { Mouse.locked = document.pointerLockElement === canvasEl; canvasEl.classList.toggle('locked', Mouse.locked); });
canvasEl.addEventListener('wheel', e => { Mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
const key = (...c) => c.some(k => Keys.has(k));
const hit = c => { if (Pressed.has(c)) { Pressed.delete(c); return true; } return false; };

// =====================================================================
// PLAYER: on foot or driving
// =====================================================================
const Player = {
  mode: 'walk', pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, grounded: true,
  camYaw: 0, camPitch: 0.25, camDist: 5, camMode: 0, camPos: new THREE.Vector3(),
  car: null, headlights: true, autoLights: true, horn: false,
  init() {
    this.person = makePerson(1, { fem: false, top: 'tee', shirt: 0x8d9399, pantsKind: 'shorts', pants: 0xb59f76, skin: 0xc08a64, hair: 0x2e2018, hairStyle: 'cap', hatC: 0x1d2a47, face: 0, beard: false, glasses: false, backpack: false, shoe: 'sneakW', scale: 1, width: 1 });
    dynRoot.add(this.person.g);
    AvatarMgr.ensure().then(av => { if (av && AvatarMgr.want === 'realistic') this.useAvatar(av); }).finally(() => NPCKit.load().then(ok => { if (ok) Peds.upgradeCrowd(); if (localStorage.getItem('gv-pack') !== 'off') RB.start(); }));
    // the player's car: chosen in the menu's garage (03l_cars.js). The original blue coupe stands in
    // while a detailed model loads.
    const g = new THREE.Group(); this.carObj = g;
    this.useCarVisual(buildSportsCar(0x1745c4)); const pick = Garage.pick(); if (pick.id !== 'classic') this.setCar(pick.id, pick.color);
    // headlights (always present so shaders don't recompile)
    this.spots = [];
    for (const x of [-0.6, 0.6]) {
      const s = new THREE.SpotLight(0xfff2dc, 0, 70, 0.5, 0.55, 1.4); s.position.set(x, 0.75, 2.2); const t = new THREE.Object3D(); t.position.set(x * 1.4, -1.5, 22); g.add(s, t); s.target = t; this.spots.push(s);
    }
    dynRoot.add(g);
    this.car = { pos: new THREE.Vector3(), yaw: 0, speed: 0, steer: 0, vy: 0, pitch: 0, roll: 0, wheelRot: 0, gear: 'P' };
  },
  useCarVisual(SC) {
    if (this.carVis) { this.carVis.removeFromParent(); }
    this.carVis = SC.g; this.tailMat = SC.tailMat; this.wheels = SC.wheels; this.wheelR = SC.wheelR || 0.34; this.carInfo = SC.info || null;
    SC.g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.carObj.add(SC.g);
  },
  async setCar(id, color) {
    const want = (this._carReq = id + ':' + color);
    try { const SC = await Garage.build(id, color); if (this._carReq !== want) return; this.useCarVisual(SC); Garage.save(id, color); if (this.car) this.syncCar(0); }
    catch (e) { console.warn('car unavailable', id, e); if (typeof UI !== 'undefined' && UI.toast) UI.toast('Could not load that car — keeping the current one'); }
  },
  placeAt(x, z, crowd) {
    // find an OPEN stretch of real street near (x,z): far from building walls, not on a bridge
    let n = null, bestScore = -1e9;
    const cands = World.segHash.query(x - 220, z - 220, x + 220, z + 220).filter(it => it.road.car && it.road.ai && !it.road.bridge && it.road.rank >= 3);
    for (const it of cands) {
      const a = it.road.pts[it.i], b = it.road.pts[it.i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 12) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; const d = Math.hypot(mx - x, mz - z); if (d > 220) continue;
      let clear = 30;
      for (const bl of World.bldHash.query(mx - 30, mz - 30, mx + 30, mz + 30)) for (let i = 0, j = bl.ring.length - 1; i < bl.ring.length; j = i++) { const sd = segDist(mx, mz, bl.ring[j][0], bl.ring[j][1], bl.ring[i][0], bl.ring[i][1]); if (sd.d < clear) clear = sd.d; }
      const score = clear * 1.0 - d / 25;
      if (score > bestScore) { bestScore = score; n = { road: it.road, i: it.i, t: 0.5, d, x: mx, z: mz }; }
    }
    if (!n) n = nearestRoad(x, z, 250, r => r.ai && !r.bridge && r.rank >= 3) || nearestRoad(x, z, 400, r => r.car && !r.bridge);
    let cx = x, cz = z, yaw = 0;
    if (n) {
      const r = n.road, a = r.pts[n.i], b = r.pts[n.i + 1]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const lane = r.oneway ? 0 : Math.min(r.w / 4, 2.2); cx = n.x - dz * lane; cz = n.z + dx * lane; yaw = Math.atan2(dx, dz);
      if (r.oneway === -1) yaw += Math.PI;
    }
    this.car.pos.set(cx, surfaceY(cx, cz) + 0.22, cz); this.car.yaw = yaw; this.car.speed = 0; this.car.steer = 0; this.car.vy = 0;
    const lane0 = n && !n.road.oneway ? Math.min(n.road.w / 4, 2.2) : 0;
    const side = n ? (n.road.w / 2 - lane0 + 1.6) : 3;
    const px = cx - Math.cos(yaw) * side, pz = cz + Math.sin(yaw) * side; // curb side of the car
    const c = freeSpot(px, pz, cx, cz);
    this.pos.set(c[0], groundY(c[0], c[1], H(c[0], c[1]) + 1), c[1]); this.vel.set(0, 0, 0); this.yaw = yaw;
    if (this.mode === 'fly' && Plane.hud) { Plane.hud.style.display = 'none'; Plane.parked = true; Plane.thr = 0; } // traveling away from the plane / helicopter: leave it parked
    if (this.mode === 'heli' && Heli.hud) { Heli.hud.style.display = 'none'; Heli.parked = true; }
    this.unseat();
    this.mode = 'walk'; this.camPitch = 0.3; this.camDist = 5.5;
    // point the camera from the most open direction so you can see yourself
    { let best = yaw + Math.PI, bs = -1; for (let k = 0; k < 16; k++) { const a = yaw + Math.PI + k / 16 * Math.PI * 2; let free = 0; for (let d = 1; d <= 12; d++) { const qx = this.pos.x + Math.sin(a) * d, qz = this.pos.z + Math.cos(a) * d; if (insideBuilding(qx, qz)) break; free = d; } if (free > bs + 0.5) { bs = free; best = a; } } this.camYaw = best; }
    if (crowd !== false) Peds.spawnCrowd(this.pos.x, this.pos.z, 7);
    this.person.g.visible = true;
    this.syncCar(0);
  },
  useAvatar(av) {
    const vis = this.person.g.visible; disposePerson(this.person);
    this.person = { g: av.root, avatar: av }; dynRoot.add(av.root);
    av.root.visible = vis; av.root.position.copy(this.pos); av.root.rotation.y = this.yaw;
  },
  async loadAvatarFile(file) {
    try { const buf = await file.arrayBuffer(); await Store.put('models', 'avatar:custom', buf); AvatarMgr.av = null; AvatarMgr.want = 'realistic'; const av = await AvatarMgr.ensure(buf); if (av) { this.useAvatar(av); UI.toast('Loaded your avatar: ' + file.name); } }
    catch (e) { UI.toast('That file could not be loaded as an avatar'); }
  },
  async realistic(outfit) {
    AvatarMgr.want = 'realistic';
    if (outfit && (outfit !== AvatarMgr.outfit || AvatarMgr.custom)) { AvatarMgr.av = null; await Store.del('models', 'avatar:custom'); }
    const av = AvatarMgr.av || await AvatarMgr.ensure(undefined, outfit); if (av) { this.useAvatar(av); UI.toast(outfit === 'ecu' ? 'Game-day outfit' : 'Realistic avatar'); }
  },
  newLook(kind) {
    AvatarMgr.want = 'classic';
    const vis = this.person.g.visible; disposePerson(this.person);
    const seed = 1000 + Math.floor(Math.random() * 1e6);
    this.person = makePerson(seed, kind === 'ecu' ? { top: pick(['ecu', 'pirates', 'jersey'], Math.random()), hairStyle: Math.random() < 0.5 ? 'cap' : undefined, hatC: 'ecu' } : undefined);
    dynRoot.add(this.person.g); this.person.g.visible = vis; this.person.g.position.copy(this.pos); this.person.g.rotation.y = this.yaw;
    UI.toast('New look');
  },
  focus() { return this.mode === 'drive' ? this.car.pos : this.mode === 'fly' ? Plane.pos : this.mode === 'heli' ? Heli.pos : this.pos; },
  unstick() { // Y key: back to the nearest street next to your car
    const f = this.focus(); const wasDriving = this.mode === 'drive';
    this.placeAt(f.x, f.z, false); if (wasDriving) this.toggleCar(); UI.toast('Moved to an open street nearby');
  },
  update(dt) {
    Airport.tick(dt, this.focus()); Chute.tick(dt);
    if (Airport.built && !Plane.placed) { Plane.placed = true; if (!(Plane.m && Plane.m.g.visible)) Plane.park(); }
    if (Airport.built && !Heli.placed) { Heli.placed = true; if (!(Heli.m && Heli.m.g.visible)) Heli.park(); }
    if (this.mode === 'heli') {
      if (hit('KeyC')) { this.camMode = this.camMode === 0 ? 1 : this.camMode === 1 ? 2 : 0; UI.toast(['Chase camera', 'Far camera', 'Cockpit'][this.camMode]); }
      Heli.update(dt);
      if (this.mode === 'heli') { Heli.camera(dt); this.seatPerson(dt); return; }
      this.updateCamera(dt); return;
    }
    if (this.mode === 'fly') {
      if (hit('KeyC')) { this.camMode = this.camMode === 0 ? 1 : this.camMode === 1 ? 2 : 0; UI.toast(['Chase camera', 'Far camera', 'Cockpit'][this.camMode]); }
      if (hit('KeyB')) { if (Voice.mode === 'babble') { Voice.stop(); } else Voice.startBabble(); }
      Plane.update(dt);
      if (this.mode === 'fly') { Plane.camera(dt); this.seatPerson(dt); return; }
      this.updateCamera(dt); return;
    }
    // camera input
    const sens = 0.0026;
    this.camYaw -= Mouse.dx * sens; this.camPitch = clamp(this.camPitch + Mouse.dy * sens, -0.35, 1.25); Mouse.dx = Mouse.dy = 0;
    if (Mouse.wheel) { this.camDist = clamp(this.camDist * (1 + Mouse.wheel * 0.12), 2.5, 40); Mouse.wheel = 0; }
    if (hit('KeyC')) { this.camMode = this.camMode >= 2 ? 0 : this.camMode + 1; UI.toast(['Chase camera', 'Far camera', 'First person'][this.camMode]); }
    if (this.mode === 'para') { Pressed.delete('KeyE'); Chute.update(dt); this.updateCamera(dt); return; }
    if (hit('KeyL')) { this.autoLights = false; this.headlights = !this.headlights; UI.toast(this.headlights ? 'Headlights on' : 'Headlights off'); }
    if (this.mode === 'walk' && Heli.near(this.pos) && Pressed.has('KeyE')) { Pressed.delete('KeyE'); Heli.enter(); return; }
    if (hit('KeyE')) { if (this.mode === 'walk' && Plane.near(this.pos) && Math.hypot(this.pos.x - this.car.pos.x, this.pos.z - this.car.pos.z) > Math.hypot(this.pos.x - Plane.pos.x, this.pos.z - Plane.pos.z) - 2) { Plane.enter(); return; } this.toggleCar(); }
    if (hit('KeyY')) this.unstick();
    if (hit('KeyF')) { this.camMode = this.camMode === 3 ? 0 : 3; UI.toast(this.camMode === 3 ? 'Face close-up (F to go back)' : 'Chase camera'); }
    if (hit('KeyB')) { if (Voice.mode === 'babble') { Voice.stop(); UI.toast('Stopped talking'); } else Voice.startBabble(); }
    if (hit('KeyV')) { if (Voice.mode === 'mic') { Voice.stop(); UI.toast('Microphone off'); } else Voice.startMic(); }
    if (hit('KeyG')) { const av = this.person.avatar; if (av) { av.expr.smile = av.expr.smile ? 0 : 1; UI.toast(av.expr.smile ? 'Smiling' : 'Neutral face'); } }
    if (hit('Digit1')) this.person.avatar?.gesture('agree');
    if (hit('Digit2')) this.person.avatar?.gesture('headshake');
    if (this.mode === 'walk') this.updateWalk(dt); else this.updateDrive(dt);
    if (this.mode === 'walk') this.syncCar(0);
    this.updateCamera(dt);
    if (this.mode === 'drive') this.seatPerson(dt);
  },
  // your character rides along: sitting in the driver's seat (or the pilot's), visible through the
  // windows, hidden only in the first-person / cockpit camera
  seatPerson(dt) {
    const p = this.person; if (!p || !p.g) return; const g = p.g;
    let q, base; const off = this._seatOff || (this._seatOff = new THREE.Vector3());
    if (this.mode === 'drive') { const I = this.carInfo || {}; q = this.carObj.quaternion; base = this.car.pos; off.set(Math.min(0.42, (I.width || 2.2) * 0.17), (I.height || 1.3) * 0.35, -0.3); }
    else if (this.mode === 'fly') { q = Plane.q; base = Plane.pos; off.set(0.3, 0.98, 0.0); }
    else if (this.mode === 'heli') { q = Heli.quat(); base = Heli.pos; off.set(-0.35, 0.8, 0.82); }
    else return;
    g.visible = this.camMode !== 2; if (!g.visible) return;
    if (!p._seated) { p._seated = true; if (p.avatar) p.avatar.seat = true; if (p.npc) p.npc.pose = { name: 'drive' }; }
    const seat = off.clone().applyQuaternion(q).add(base);
    g.quaternion.copy(q); g.position.copy(seat); g.position.y -= 0.95 * g.scale.y;
    animatePerson(p, 0, dt);
    const B = p.B; if (!p.avatar && !p.npc && B && B.uLegL) { // simple people
      B.uLegL.rotation.set(-1.55, 0, 0.08); B.uLegR.rotation.set(-1.55, 0, -0.08); B.lLegL.rotation.x = B.lLegR.rotation.x = 0.65; if (B.footL) B.footL.rotation.x = B.footR.rotation.x = -0.25;
      B.uArmL.rotation.set(-0.9, 0, 0.12); B.uArmR.rotation.set(-0.9, 0, -0.12); B.lArmL.rotation.x = B.lArmR.rotation.x = -0.55; }
    // line the hips up with the seat cushion, whatever the rig
    const hips = (p.avatar && p.avatar.B && p.avatar.B.Hips) || (p.npc && p.npc.bones && p.npc.bones.Hips) || (B && B.hips);
    if (hips) { g.updateMatrixWorld(true); const hp = hips.getWorldPosition(new THREE.Vector3()); g.position.add(seat.sub(hp)); }
  },
  unseat() { const p = this.person; if (!p || !p._seated) return; p._seated = false; if (p.avatar) p.avatar.seat = false; if (p.npc) p.npc.pose = null; p.g.rotation.set(0, this.yaw, 0); },
  toggleCar() {
    if (this.mode === 'walk') {
      const d = Math.hypot(this.pos.x - this.car.pos.x, this.pos.z - this.car.pos.z);
      if (d < 4.5) { this.mode = 'drive'; this.person.g.visible = false; this.camYaw = this.car.yaw + Math.PI; this.camPitch = 0.18; this.camDist = Math.max(this.camDist, 7); Sound.door(); }
      else UI.toast('Your car is ' + Math.round(d) + ' m away — the purple dot on the minimap');
    } else {
      if (Math.abs(this.car.speed) > 4) { UI.toast('Slow down to get out'); return; }
      const yaw = this.car.yaw; let x = this.car.pos.x + Math.cos(yaw) * 1.6, z = this.car.pos.z - Math.sin(yaw) * 1.6;
      const c = collideCircle(x, z, 0.35); x = c.x; z = c.z;
      this.pos.set(x, groundY(x, z, this.car.pos.y + 1), z); this.vel.set(0, 0, 0); this.yaw = yaw; this.mode = 'walk'; this.person.g.visible = true; this.car.speed = 0; this.car.gear = 'P'; this.camDist = 5; Sound.door();
    }
  },
  updateWalk(dt) {
    const fwd = (key('KeyW', 'ArrowUp') ? 1 : 0) - (key('KeyS', 'ArrowDown') ? 1 : 0);
    const str = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const run = key('ShiftLeft', 'ShiftRight');
    const cy = this.camYaw; const fx = -Math.sin(cy), fz = -Math.cos(cy); const rx = -fz, rz = fx; // camera forward/right on ground
    let mx = fx * fwd + rx * str, mz = fz * fwd + rz * str; const ml = Math.hypot(mx, mz);
    const target = ml > 0 ? (run ? 6.2 : 1.9) : 0; if (ml > 0) { mx /= ml; mz /= ml; }
    const acc = this.grounded ? 12 : 3;
    this.vel.x += (mx * target - this.vel.x) * Math.min(1, acc * dt); this.vel.z += (mz * target - this.vel.z) * Math.min(1, acc * dt);
    if (ml > 0) { const want = Math.atan2(mx, mz); this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * 10); }
    if (this.grounded && hit('Space')) { this.vel.y = 5.2; this.grounded = false; }
    this.vel.y -= 18 * dt;
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const c = collideCircle(nx, nz, 0.33, this.pos.y); nx = c.x; nz = c.z;
    // don't walk through your own car
    { const cp = this.car.pos, cyaw = this.car.yaw; for (const k of [-1.3, 0, 1.3]) { const ox = cp.x + Math.sin(cyaw) * k, oz = cp.z + Math.cos(cyaw) * k; const dx = nx - ox, dz = nz - oz, d = Math.hypot(dx, dz); if (d < 1.25 && d > 1e-3) { nx = ox + dx / d * 1.25; nz = oz + dz / d * 1.25; } } }
    { const b = insideBuilding(nx, nz); if (b && this.pos.y < b.maxY - 0.5) { const e = ejectPoint(nx, nz, b, 0.6); nx = e[0]; nz = e[1]; } }
    let gy = groundY(nx, nz, this.pos.y);
    const ny = this.pos.y + this.vel.y * dt;
    if (ny <= gy) { this.pos.y = gy; this.vel.y = 0; this.grounded = true; } else { this.pos.y = ny; this.grounded = ny - gy < 0.05; }
    this.pos.x = nx; this.pos.z = nz;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.person._seated) this.unseat();
    this.person.g.position.copy(this.pos); this.person.g.rotation.y = this.yaw;
    if (this.person.avatar) { // pick someone nearby to glance at
      let best = null, bd = 7; const fx0 = Math.sin(this.yaw), fz0 = Math.cos(this.yaw);
      for (const q of [...Peds.list, ...Peds.crowd]) { const dx = q.x - this.pos.x, dz = q.z - this.pos.z, d = Math.hypot(dx, dz); if (d < bd && d > 0.5 && (dx * fx0 + dz * fz0) / d > -0.2) { bd = d; best = q; } }
      this.person.avatar.lookAt = best ? new THREE.Vector3(best.x, (best.person.g.position.y || this.pos.y) + 1.6, best.z) : null;
    }
    animatePerson(this.person, sp, dt, !this.grounded);
    // hint near car
    const d = Math.hypot(this.pos.x - this.car.pos.x, this.pos.z - this.car.pos.z);
    UI.hint(Heli.near(this.pos) ? 'Press <kbd>E</kbd> to fly the helicopter' : Plane.near(this.pos) ? 'Press <kbd>E</kbd> to fly the plane' : d < 4.5 ? 'Press <kbd>E</kbd> to drive' : '');
  },
  updateDrive(dt) {
    const C = this.car;
    const thr = key('KeyW', 'ArrowUp') ? 1 : 0, brk = key('KeyS', 'ArrowDown') ? 1 : 0;
    const steerIn = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const hb = key('Space');
    const vmax = 52, spd = C.speed;
    if (thr) { if (spd < -0.3) C.speed += 16 * dt; else C.speed += 7.5 * (1 - clamp(spd / vmax, 0, 1) ** 1.6) * dt; }
    if (brk) { if (spd > 0.3) C.speed -= 16 * dt; else C.speed = Math.max(-11, C.speed - 5 * dt); }
    if (!thr && !brk) C.speed -= Math.sign(C.speed) * Math.min(Math.abs(C.speed), (0.55 + Math.abs(C.speed) * 0.018) * dt * 2);
    if (hb) C.speed -= Math.sign(C.speed) * Math.min(Math.abs(C.speed), 10 * dt);
    // steering: sharper at low speed
    const maxSteer = lerp(0.6, 0.1, clamp(Math.abs(C.speed) / 38, 0, 1)) * (hb ? 1.5 : 1);
    C.steer += (steerIn * maxSteer - C.steer) * Math.min(1, dt * (steerIn ? 4 : 7));
    const yawRate = -C.speed * Math.tan(C.steer) / 2.75;
    C.yaw += yawRate * dt;
    const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
    const sub = Math.max(1, Math.ceil(Math.abs(C.speed) * dt / 0.4));
    for (let s = 0; s < sub; s++) {
      let nx = C.pos.x + fx * C.speed * dt / sub, nz = C.pos.z + fz * C.speed * dt / sub;
      let bumped = false;
      for (const k of [1.35, -1.35]) {
        const ox = nx + fx * k, oz = nz + fz * k;
        if (k * C.speed > 0) { const m = Phys.knockAt(ox, oz, 0.98, fx * C.speed, fz * C.speed); if (m) { C.speed *= 1 - Math.min(0.4, m / (m + 1500) * 0.6); UI.shake(Math.min(0.8, m / 2000 + 0.15)); } } // knock it over (07d_phys.js)
        const c = collideCircle(ox, oz, 0.98, C.pos.y);
        if (c.hit) { nx += c.x - ox; nz += c.z - oz; bumped = true; const into = -(c.nx * fx + c.nz * fz) * Math.sign(C.speed); if (into > 0.3 && Math.abs(C.speed) > 6) { UI.shake(Math.min(1, Math.abs(C.speed) / 25)); Sound.thud(Math.abs(C.speed)); } }
      }
      if (bumped) C.speed *= 0.86;
      C.pos.x = nx; C.pos.z = nz;
    }
    { const b = insideBuilding(C.pos.x, C.pos.z); if (b && C.pos.y < b.maxY - 0.5) { const e = ejectPoint(C.pos.x, C.pos.z, b, 2.4); C.pos.x = e[0]; C.pos.z = e[1]; C.speed *= 0.3; } }
    Traffic.collidePlayerCar(C);
    // vertical: follow ground / bridges, allow short drops
    const gy = surfaceY(C.pos.x, C.pos.z, C.pos.y) + 0.22;
    C.vy -= 20 * dt; C.pos.y += C.vy * dt;
    if (C.pos.y < gy) { C.pos.y = gy; C.vy = 0; }
    // pitch & roll from terrain
    const hf = surfaceY(C.pos.x + fx * 1.4, C.pos.z + fz * 1.4, C.pos.y), hb2 = surfaceY(C.pos.x - fx * 1.4, C.pos.z - fz * 1.4, C.pos.y);
    const hl = surfaceY(C.pos.x + fz * 0.8, C.pos.z - fx * 0.8, C.pos.y), hr = surfaceY(C.pos.x - fz * 0.8, C.pos.z + fx * 0.8, C.pos.y);
    C.pitch += (Math.atan2(hb2 - hf, 2.8) - C.pitch) * Math.min(1, dt * 8); C.roll += (Math.atan2(hl - hr, 1.6) * 0.8 - C.roll + C.steer * C.speed * 0.004) * Math.min(1, dt * 6);
    C.gear = C.speed < -0.3 ? 'R' : Math.abs(C.speed) < 0.3 ? (thr || brk ? 'D' : 'N') : 'D';
    this.pos.copy(C.pos);
    if (hit('KeyH')) Sound.honk(); if (key('KeyH')) Traffic.honked = 1;
    this.syncCar(dt, brk && C.speed > 0.2);
    UI.hint(Math.abs(C.speed) < 4 ? 'Press <kbd>E</kbd> to get out' : '');
  },
  syncCar(dt, braking) {
    const C = this.car, g = this.carObj;
    g.position.copy(C.pos); g.rotation.set(0, 0, 0); g.rotateY(C.yaw); g.rotateX(C.pitch); g.rotateZ(C.roll);
    C.wheelRot += C.speed * dt / (this.wheelR || 0.34);
    for (const w of this.wheels) { w.spin.rotation.x = C.wheelRot; w.piv.rotation.y = w.front ? -C.steer : 0; }
    if (this.autoLights) this.headlights = Env.night > 0.35 || Env.rain > 0.5;
    const on = this.headlights && this.mode === 'drive' || (this.headlights && Env.night > 0.5);
    for (const s of this.spots) s.intensity = on ? 260 : 0;
    this.tailMat.emissiveIntensity = braking ? 5 : (on ? 1.6 : 0.3);
  },
  updateCamera(dt) {
    const drive = this.mode === 'drive'; const C = this.car;
    if (drive && performance.now() / 1000 - Mouse.lastMove > 1.6 && Math.abs(C.speed) > 1) {
      const want = C.yaw + (C.speed < -1 ? 0 : Math.PI); this.camYaw += angleDiff(this.camYaw, want) * Math.min(1, dt * 3);
      this.camPitch += (0.2 - this.camPitch) * Math.min(1, dt * 1.5);
    }
    const tgt = drive ? new THREE.Vector3(C.pos.x, C.pos.y + 1.5, C.pos.z) : new THREE.Vector3(this.pos.x, this.pos.y + (this.mode === 'para' && Chute.state === 'open' ? 1.6 + 2.6 * Chute.open : 1.6), this.pos.z);
    if (this.camMode === 3 && !drive) { // face close-up: stand in front of the character
      const hb = this.person.avatar?.B?.Head; const hp = hb ? hb.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z);
      const fy = this.yaw; const want = new THREE.Vector3(hp.x + Math.sin(fy) * 1.15 + Math.cos(fy) * 0.25, hp.y + 0.04, hp.z + Math.cos(fy) * 1.15 - Math.sin(fy) * 0.25);
      this.camPos.lerp(want, Math.min(1, dt * 5)); camera.position.copy(this.camPos); camera.lookAt(hp.x, hp.y - 0.02, hp.z); this.person.g.visible = true; return;
    }
    if (this.camMode === 2) {
      // first person
      const eye = drive ? new THREE.Vector3(C.pos.x + Math.cos(C.yaw) * 0.38 - Math.sin(C.yaw) * 0.25, C.pos.y + 1.22, C.pos.z - Math.sin(C.yaw) * 0.38 - Math.cos(C.yaw) * 0.25) : new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z);
      camera.position.copy(eye);
      const look = drive ? C.yaw + (this.camYaw - (C.yaw + Math.PI)) + 0 : this.camYaw + Math.PI;
      const yawL = drive ? (this.camYaw + Math.PI) : this.camYaw + Math.PI;
      const p = -this.camPitch * 0.8 + (drive ? 0.05 : 0);
      camera.lookAt(eye.x + Math.sin(yawL) * Math.cos(p) * 10, eye.y + Math.sin(p) * 10, eye.z + Math.cos(yawL) * Math.cos(p) * 10);
      this.person.g.visible = false;
      return;
    }
    if (!drive) this.person.g.visible = true;
    const dist = (drive ? Math.max(this.camDist, 6.5) : this.camDist) * (this.camMode === 1 ? 2.4 : 1) + (drive ? Math.abs(C.speed) * 0.05 : 0);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const want = new THREE.Vector3(tgt.x + Math.sin(this.camYaw) * cp * dist, tgt.y + sp * dist, tgt.z + Math.cos(this.camYaw) * cp * dist);
    // keep camera out of buildings (pull in along the ray)
    let t = 1; const N = 16; for (let k = 1; k <= N; k++) { const f = k / N; const x = lerp(tgt.x, want.x, f), z = lerp(tgt.z, want.z, f), y = lerp(tgt.y, want.y, f); const b = insideBuilding(x, z); if (b && y < b.h + 0.5) { t = Math.max(0.08, (k - 1.5) / N); break; } }
    want.lerpVectors(tgt, want, t);
    if (t * dist < 1.8) { // too cramped behind: look down from above instead of from inside your head
      want.set(tgt.x + Math.sin(this.camYaw) * 1.2, tgt.y + 4.5, tgt.z + Math.cos(this.camYaw) * 1.2);
    }
    const gy = H(want.x, want.z) + 0.5; if (want.y < gy) want.y = gy;
    this.camPos.lerp(want, Math.min(1, dt * (drive ? 10 : 14)));
    if (this.camPos.distanceTo(want) > 60) this.camPos.copy(want);
    camera.position.copy(this.camPos); camera.position.x += UI.shakeAmt * (Math.random() - .5) * 0.3; camera.position.y += UI.shakeAmt * (Math.random() - .5) * 0.3;
    camera.lookAt(tgt);
  },
};
