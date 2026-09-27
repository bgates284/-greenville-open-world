
// =====================================================================
// PLANE — your Cessna-class trainer at Pitt-Greenville Airport.
// Walk up and press E to climb in. Simple but physical flight model:
// lift/drag from angle of attack, thrust falls off with speed, stalls, ground roll with
// nose-wheel steering and brakes. Land gently (under ~1,300 ft/min, wings level).
// =====================================================================
const Plane = {
  m: null, pos: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(),
  thr: 0, trim: 0.03, onGround: true, propA: 0, parked: false, t: 0, lights: true,
  MASS: 950, AREA: 16.2,
  init() {
    if (this.m) return;
    this.m = buildPlaneModel(); dynRoot.add(this.m.g); this.m.g.visible = false;
    const hud = document.createElement('div'); hud.id = 'flyhud';
    hud.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:none;gap:18px;padding:8px 16px;border-radius:10px;background:rgba(10,12,16,.62);color:#e9edf2;font:600 14px/1.3 "IBM Plex Mono",ui-monospace,monospace;z-index:30;pointer-events:none;white-space:nowrap';
    document.body.appendChild(hud); this.hud = hud;
  },
  // put the plane on its parking spot (or anywhere given)
  park(x, z, yaw) {
    this.init(); Airport.init();
    const S = Airport.stand; x = x ?? S.x; z = z ?? S.z; yaw = yaw ?? S.yaw;
    this.pos.set(x, this.ground(x, z), z); this.q.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    this.v.set(0, 0, 0); this.w.set(0, 0, 0); this.thr = 0; this.onGround = true; this.parked = true; this.m.g.visible = true; this.sync(0);
    this.clearCar();
  },
  // keep your car off the plane's parking spot: park it at the edge of the apron instead
  clearCar() {
    const C = Player.car; if (!C || Player.mode === 'drive') return;
    if (Math.hypot(C.pos.x - this.pos.x, C.pos.z - this.pos.z) > 9) return;
    const S = Airport.carSpot; C.pos.set(S.x, surfaceY(S.x, S.z) + 0.22, S.z); C.yaw = S.yaw; C.speed = 0; C.vy = 0; Player.syncCar(0);
  },
  ground(x, z) { const a = Airport.surf(x, z); const s = surfaceY(x, z); return a !== null ? Math.max(a, s) : s; },
  near(p) { return this.m && this.m.g.visible && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 7; },
  axes() { const F = new THREE.Vector3(0, 0, 1).applyQuaternion(this.q), U = new THREE.Vector3(0, 1, 0).applyQuaternion(this.q), L = new THREE.Vector3(1, 0, 0).applyQuaternion(this.q); return { F, U, L }; },
  enter() {
    const P = Player; P.mode = 'fly'; P.person.g.visible = false; this.parked = false; this.hud.style.display = 'flex';
    P.camDist = 14; this.look = { yaw: 0, pitch: 0.12 }; Sound.door();
    if (!this._helped) { this._helped = true; UI.toast('Flying: R/F throttle · W/S pitch · A/D roll · Z/X rudder · Space brakes · C camera · E to get out when stopped', 9000); }
  },
  exit() {
    const P = Player; const spd = this.v.length();
    if (!this.onGround || spd > 3) { UI.toast(this.onGround ? 'Stop the plane first (Space brakes, F to idle)' : 'Land first to get out'); return; }
    const { L } = this.axes(); let x = this.pos.x + L.x * 2.2, z = this.pos.z + L.z * 2.2; const c = collideCircle(x, z, 0.35); x = c.x; z = c.z;
    P.pos.set(x, groundY(x, z, this.pos.y + 1), z); P.vel.set(0, 0, 0); P.yaw = Math.atan2(L.x, L.z); P.mode = 'walk'; P.person.g.visible = true; P.camDist = 5.5;
    this.thr = 0; this.parked = true; this.hud.style.display = 'none'; Sound.door();
  },
  crash(why) {
    UI.shake(1); Sound.thud(30); UI.toast((why || 'Crashed!') + ' Your plane is back on its parking spot.', 5000);
    this.park(); Player.pos.copy(this.pos); this.exitAfterCrash();
  },
  exitAfterCrash() { const P = Player; const { L } = this.axes(); const x = this.pos.x + L.x * 3, z = this.pos.z + L.z * 3; P.pos.set(x, groundY(x, z, this.pos.y + 1), z); P.mode = 'walk'; P.person.g.visible = true; this.hud.style.display = 'none'; P.camDist = 6; },
  update(dt) {
    const P = Player;
    if (hit('KeyE')) { this.exit(); if (P.mode !== 'fly') return; }
    if (hit('KeyY')) { this.park(); this.enter(); UI.toast('Back at the airport'); }
    if (hit('KeyL')) { this.lights = !this.lights; UI.toast(this.lights ? 'Lights on' : 'Lights off'); }
    // controls
    if (key('KeyR', 'ShiftLeft', 'ShiftRight')) this.thr = Math.min(1, this.thr + dt * 0.6);
    if (key('KeyF')) this.thr = Math.max(0, this.thr - dt * 0.8);
    const pitchIn = (key('KeyS', 'ArrowDown') ? 1 : 0) - (key('KeyW', 'ArrowUp') ? 1 : 0);
    const rollIn = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const yawIn = (key('KeyX') ? 1 : 0) - (key('KeyZ') ? 1 : 0);
    const brake = key('Space');
    this.inputs = { pitchIn, rollIn, yawIn };
    const n = Math.max(1, Math.ceil(dt / (1 / 120))); const h = dt / n;
    for (let i = 0; i < n && P.mode === 'fly'; i++) this.step(h, pitchIn, rollIn, yawIn, brake);
    if (P.mode !== 'fly') return;
    P.pos.copy(this.pos); const { F } = this.axes(); P.yaw = Math.atan2(F.x, F.z);
    this.sync(dt); this.updateHud();
    UI.hint(this.onGround && this.v.length() < 3 ? 'Press <kbd>E</kbd> to get out' : '');
  },
  step(dt, pitchIn, rollIn, yawIn, brake) {
    const { F, U, L } = this.axes(); const v = this.v; const V = v.length();
    const vf = v.dot(F), vu = v.dot(U), vl = v.dot(L);
    const alpha = Math.atan2(-vu, Math.max(0.5, Math.abs(vf))), beta = Math.atan2(vl, Math.max(0.5, Math.abs(vf)));
    const rho = 1.225, qd = 0.5 * rho * V * V, Sw = this.AREA, m = this.MASS;
    // lift coefficient with a stall past ~16°
    const AS = 0.28; let CL = 0.4 + 4.6 * alpha; if (alpha > AS) CL = Math.max(0.35, 0.4 + 4.6 * AS - 3.2 * (alpha - AS)); CL = Math.max(-0.9, CL);
    this.stall = !this.onGround && alpha > AS && V > 8;
    const acc = new THREE.Vector3(0, -9.81, 0);
    if (V > 0.5) {
      const vh = v.clone().divideScalar(V);
      const liftDir = U.clone().addScaledVector(vh, -U.dot(vh)); if (liftDir.lengthSq() > 1e-6) liftDir.normalize();
      acc.addScaledVector(liftDir, qd * Sw * CL / m);
      acc.addScaledVector(vh, -qd * Sw * (0.03 + 0.05 * CL * CL) / m);
      acc.addScaledVector(L, -qd * Sw * 0.9 * beta / m); // side force from sideslip
    }
    acc.addScaledVector(F, this.thr * 4200 * Math.max(0.25, 1 - Math.max(0, vf) / 82) / m);
    // rotation: control power grows with airspeed; the aircraft weathervanes into the airflow
    const ce = clamp(qd / (0.5 * rho * 33 * 33), 0.04, 1.25), cs = clamp(V / 30, 0, 1.4);
    const bank = Math.asin(clamp(L.y, -1, 1));
    // auto-trim: with the stick centred the plane holds roughly level flight for its speed
    if (!this.onGround && V > 15) { const need = clamp((m * 9.81 / Math.max(0.3, Math.cos(bank)) / Math.max(1, qd * Sw) - 0.4) / 4.6, -0.03, 0.15); if (!pitchIn) this.trim += (need - this.trim) * Math.min(1, dt * 0.8); }
    else if (this.onGround) this.trim = 0.03;
    const tgt = new THREE.Vector3(
      (alpha - (this.trim + pitchIn * 0.2)) * 3.2 * cs - pitchIn * 0.25 * ce, // the stick sets the angle of attack
      -yawIn * 0.55 * ce + beta * 2.2 * cs,
      rollIn * 1.05 * ce - (rollIn ? 0 : bank * 0.35 * cs));
    this.w.lerp(tgt, Math.min(1, dt * 3.2));
    // ground handling
    const gy = this.ground(this.pos.x, this.pos.z);
    if (this.onGround) {
      const steer = -(yawIn || rollIn) * clamp(1.2 / Math.max(1, V * 0.25), 0.05, 0.8);
      this.w.y = steer * clamp(vf / 3, -1, 1) * 0.9 + (V > 25 ? this.w.y * 0.5 : 0);
      this.w.z = 0; if (pitchIn <= 0 && V < 22) this.w.x = Math.max(this.w.x, 0);
    }
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.w.x * dt, this.w.y * dt, this.w.z * dt, 'YXZ'));
    this.q.multiply(dq).normalize();
    v.addScaledVector(acc, dt);
    this.pos.addScaledVector(v, dt);
    // buildings
    const onPave = Airport.paved(this.pos.x, this.pos.z); const b = onPave ? null : insideBuilding(this.pos.x, this.pos.z); if (b && this.pos.y < b.maxY - 0.3 && V > 6) return this.crash('You hit ' + (b.name || 'a building') + '!');
    // wheels on the ground?
    const g2 = this.ground(this.pos.x, this.pos.z);
    if (this.pos.y <= g2 + 0.005) {
      const { F: F2, L: L2 } = this.axes(); const pitch = Math.asin(clamp(F2.y, -1, 1)), bk = Math.asin(clamp(L2.y, -1, 1));
      if (!this.onGround) {
        const sink = -v.y;
        if (sink > 8.2) return this.crash('Hard landing!');
        if ((Math.abs(bk) > 0.5 || pitch < -0.26) && sink > 1.5) return this.crash('Wing/nose strike!');
        if (sink > 3.2) { UI.shake(0.4); Sound.thud(12); }
      }
      this.onGround = true; if (this.pos.y < g2) this.pos.y = g2; if (v.y < 0) v.y = 0;
      // level the wings, keep the nose wheel down unless rotating
      const yaw = Math.atan2(F2.x, F2.z); const p2 = clamp(pitch, 0, 0.24);
      this.q.setFromEuler(new THREE.Euler(-p2, yaw, bk * Math.max(0, 1 - dt * 10), 'YXZ'));
      const { F: F3, L: L3 } = this.axes();
      // tyres: kill sideways motion, rolling resistance, brakes (grass is slower)
      const paved = Airport.surf(this.pos.x, this.pos.z) !== null || onRoadSurface(this.pos.x, this.pos.z);
      const vf2 = v.dot(F3), vl2 = v.dot(L3);
      v.addScaledVector(L3, -vl2 * Math.min(1, dt * 12));
      const fr = (paved ? 0.25 : 1.1) + (brake ? 4.5 : 0);
      const nf = Math.sign(vf2) * Math.max(0, Math.abs(vf2) - fr * dt); v.addScaledVector(F3, nf - vf2);
      if (Math.abs(nf) < 0.05 && this.thr < 0.05) v.set(0, v.y, 0);
      // obstacles on the ground (trees, poles) at taxi speed
      const c = onPave ? { hit: false } : collideCircle(this.pos.x, this.pos.z, 1.2, this.pos.y); if (c.hit) { this.pos.x = c.x; this.pos.z = c.z; if (V > 28) return this.crash('You hit something on the ground!'); v.multiplyScalar(0.2); }
    } else if (this.pos.y > g2 + 0.15) this.onGround = false;
    if (this.pos.y > 3500) { this.pos.y = 3500; if (v.y > 0) v.y = 0; }
  },
  sync(dt) {
    const M = this.m; M.g.position.copy(this.pos); M.g.quaternion.copy(this.q);
    this.propA += (this.thr * 55 + (this.parked ? 0 : 8)) * dt; M.prop.rotation.z = this.propA;
    M.disc.material.opacity = clamp((this.thr - 0.15) * 0.35, 0, 0.22); M.prop.visible = this.thr < 0.55;
    const I = this.inputs || { pitchIn: 0, rollIn: 0, yawIn: 0 };
    M.elev.rotation.x += (I.pitchIn * 0.35 - M.elev.rotation.x) * Math.min(1, dt * 10);
    M.ailL.rotation.x += (I.rollIn * 0.3 - M.ailL.rotation.x) * Math.min(1, dt * 10); M.ailR.rotation.x = -M.ailL.rotation.x;
    M.rud.rotation.y += (-I.yawIn * 0.4 - M.rud.rotation.y) * Math.min(1, dt * 10);
    this.t += dt; const on = this.lights && !this.parked; const fl = on && (this.t % 1.2) < 0.08;
    for (const s of M.strobes) s.visible = fl; M.beacon.visible = on && (this.t % 1.0) < 0.5;
    const spin = this.v.length() * dt / 0.3; for (const w of M.wheels) w.rotation.x += this.onGround ? spin : 0;
  },
  updateHud() {
    const { F } = this.axes(); const V = this.v.length();
    const hdg = ((Math.atan2(F.x, -F.z) * 180 / Math.PI) + 360) % 360; // 0 = north (−z)
    const agl = this.pos.y - H(this.pos.x, this.pos.z), msl = this.pos.y;
    const vs = this.v.y * 196.85;
    const cell = (k, v, warn) => `<span style="opacity:.62">${k}</span> <span style="${warn ? 'color:#ff6a4a' : ''}">${v}</span>`;
    this.hud.innerHTML = [cell('IAS', Math.round(V * 1.944) + ' kt', V < 26 && !this.onGround), cell('ALT', Math.round(msl * 3.281).toLocaleString() + ' ft'), cell('AGL', Math.round(Math.max(0, agl) * 3.281).toLocaleString() + ' ft'),
      cell('VS', (vs >= 0 ? '+' : '') + Math.round(vs / 50) * 50 + ' fpm', vs < -1000), cell('HDG', String(Math.round(hdg) % 360).padStart(3, '0')), cell('THR', Math.round(this.thr * 100) + '%'), this.stall ? '<span style="color:#ff6a4a">STALL</span>' : ''].join('  ');
  },
  camera(dt) {
    const P = Player; const { F, U } = this.axes();
    const idle = performance.now() / 1000 - Mouse.lastMove > 1.6;
    this.look.yaw -= Mouse.dx * 0.0026; this.look.pitch = clamp(this.look.pitch + Mouse.dy * 0.0026, -0.6, 1.2); Mouse.dx = Mouse.dy = 0;
    if (Mouse.wheel) { P.camDist = clamp(P.camDist * (1 + Mouse.wheel * 0.12), 8, 80); Mouse.wheel = 0; }
    if (idle) { this.look.yaw *= Math.max(0, 1 - dt * 2); this.look.pitch += (0.12 - this.look.pitch) * Math.min(1, dt * 2); }
    for (const gm of this.m.glass) gm.visible = P.camMode !== 2;
    if (P.camMode === 2) { // cockpit, left seat
      const eye = new THREE.Vector3(0.3, 1.74, 0.1).applyQuaternion(this.q).add(this.pos);
      camera.position.copy(eye);
      const rot = this.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.look.pitch * 0.6 + 0.07, Math.PI + this.look.yaw, 0, 'YXZ')));
      camera.quaternion.copy(rot); return;
    }
    const heading = Math.atan2(F.x, F.z) + Math.PI + this.look.yaw; const dist = P.camDist * (P.camMode === 1 ? 2.5 : 1);
    const pp = this.look.pitch + clamp(-F.y, -0.5, 0.5) * 0.5;
    const tgt = this.pos.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(F, 2);
    const want = new THREE.Vector3(tgt.x + Math.sin(heading) * Math.cos(pp) * dist, tgt.y + Math.sin(pp) * dist, tgt.z + Math.cos(heading) * Math.cos(pp) * dist);
    const gy = H(want.x, want.z) + 1.0; if (want.y < gy) want.y = gy;
    P.camPos.lerp(want, Math.min(1, dt * 6)); if (P.camPos.distanceTo(want) > 120) P.camPos.copy(want);
    camera.position.copy(P.camPos); camera.position.x += UI.shakeAmt * (Math.random() - .5) * 0.4; camera.position.y += UI.shakeAmt * (Math.random() - .5) * 0.4;
    camera.up.set(0, 1, 0); camera.lookAt(tgt);
  },
};
