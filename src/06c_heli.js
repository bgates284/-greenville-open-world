// =====================================================================
// HELICOPTER — a light utility helicopter on its own pad at Pitt-Greenville Airport.
// Walk up and press E to climb in. Easy "arcade" flight with real feel:
//   R / Shift climb · F descend (let go and it holds its height — auto-hover)
//   W/S nose down/up (fly forward/back) · A/D bank left/right · Z/X turn (pedals)
//   Space: level out and hover in place · C camera · E to get out once landed
// Land gently (under ~6 m/s down, fairly level) or it's a crash back to the pad.
// =====================================================================
const Heli = {
  m: null, pos: new THREE.Vector3(), v: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, yawRate: 0,
  rpm: 0, col: 0, onGround: true, parked: false, placed: false, t: 0,
  MASS: 1450,
  init() {
    if (this.m) return;
    this.m = buildHeliModel(); dynRoot.add(this.m.g); this.m.g.visible = false;
    const hud = document.createElement('div'); hud.id = 'helihud';
    hud.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:none;gap:18px;padding:8px 16px;border-radius:10px;background:rgba(10,12,16,.62);color:#e9edf2;font:600 14px/1.3 "IBM Plex Mono",ui-monospace,monospace;z-index:30;pointer-events:none;white-space:nowrap';
    document.body.appendChild(hud); this.hud = hud;
  },
  // the pad: on the GA apron, across from your plane
  padSpot() { Airport.init(); const M = Airport.RWY[0], A = Airport.apron; return { x: A.cx - M.ux * 30 + M.rx * 6, z: A.cz - M.uz * 30 + M.rz * 6, yaw: Math.atan2(M.rx, M.rz) }; },
  park(x, z, yaw) {
    this.init(); const S = this.padSpot(); x = x ?? S.x; z = z ?? S.z; yaw = yaw ?? S.yaw;
    this.pos.set(x, this.ground(x, z), z); this.yaw = yaw; this.pitch = this.roll = this.yawRate = 0; this.v.set(0, 0, 0);
    this.rpm = 0; this.col = 0; this.onGround = true; this.parked = true; this.m.g.visible = true; this.sync(0);
    if (!this.pad) { this.pad = makeHelipad(); dynRoot.add(this.pad); } this.pad.position.set(S.x, H(S.x, S.z), S.z); this.pad.rotation.y = S.yaw;
  },
  ground(x, z) { const a = Airport.surf(x, z); const s = surfaceY(x, z); return a !== null ? Math.max(a, s) : s; },
  near(p) { return this.m && this.m.g.visible && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 6.5; },
  quat() { return new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ')); },
  enter() {
    const P = Player; P.mode = 'heli'; P.person.g.visible = false; this.parked = false; this.hud.style.display = 'flex';
    P.camDist = 13; this.look = { yaw: 0, pitch: 0.18 }; Sound.door();
    if (!this._helped) { this._helped = true; UI.toast('Helicopter: R climb · F descend (let go to hover) · W/S forward/back · A/D bank · Z/X turn · Space hover in place · E to get out when landed', 10000); }
  },
  exit() {
    const P = Player;
    if (!this.onGround || this.v.length() > 1.5) { UI.toast('Land first to get out (F to descend)'); return; }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw); let x = this.pos.x + c * 2.6, z = this.pos.z - s * 2.6; const cc = collideCircle(x, z, 0.35); x = cc.x; z = cc.z;
    P.pos.set(x, groundY(x, z, this.pos.y + 1), z); P.vel.set(0, 0, 0); P.yaw = this.yaw; P.mode = 'walk'; P.person.g.visible = true; P.camDist = 5.5;
    this.parked = true; this.col = 0; this.hud.style.display = 'none'; Sound.door();
  },
  crash(why) {
    UI.shake(1); Sound.thud(30); UI.toast((why || 'Crashed!') + ' The helicopter is back on its pad.', 5000);
    this.park(); const P = Player; const x = this.pos.x + Math.cos(this.yaw) * 4, z = this.pos.z - Math.sin(this.yaw) * 4;
    P.pos.set(x, groundY(x, z, this.pos.y + 1), z); P.mode = 'walk'; P.person.g.visible = true; this.hud.style.display = 'none'; P.camDist = 6;
  },
  update(dt) {
    const P = Player;
    if (hit('KeyE')) { this.exit(); if (P.mode !== 'heli') return; }
    if (hit('KeyY')) { this.park(); this.enter(); UI.toast('Back on the helipad'); }
    const up = key('KeyR', 'ShiftLeft', 'ShiftRight') ? 1 : 0, down = key('KeyF') ? 1 : 0;
    const fwd = (key('KeyW', 'ArrowUp') ? 1 : 0) - (key('KeyS', 'ArrowDown') ? 1 : 0);
    const side = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const pedal = (key('KeyX') ? 1 : 0) - (key('KeyZ') ? 1 : 0), hover = key('Space');
    this.inputs = { up, down, fwd, side, pedal, hover };
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n && P.mode === 'heli'; i++) this.step(h);
    if (P.mode !== 'heli') return;
    P.pos.copy(this.pos); P.yaw = this.yaw; this.sync(dt); this.updateHud();
    UI.hint(this.onGround && this.rpm < 0.9 ? 'Spooling up… hold <kbd>R</kbd> to lift off' : this.onGround && this.v.length() < 1.5 ? 'Press <kbd>E</kbd> to get out' : '');
  },
  step(dt) {
    const I = this.inputs, v = this.v, g = 9.81, m = this.MASS;
    // engine / rotor: spools up over a few seconds once you're in
    this.rpm = Math.min(1, this.rpm + dt * 0.28);
    // attitude: the stick tilts the rotor disc; let go and it levels itself
    const maxT = 0.38; const tp = I.hover ? 0 : I.fwd * maxT, tr = I.hover ? 0 : I.side * maxT; // nose down to go forward, bank toward the turn
    const airborne = !this.onGround;
    this.pitch += ((airborne ? tp : 0) - this.pitch) * Math.min(1, dt * 2.6);
    this.roll += ((airborne ? tr : 0) - this.roll) * Math.min(1, dt * 2.6);
    // yaw: pedals, plus a gentle coordinated turn when banked at speed
    const hs = Math.hypot(v.x, v.z);
    const wantYaw = -I.pedal * 1.25 + (airborne ? -this.roll * clamp(hs / 25, 0, 1) * 1.1 : 0);
    this.yawRate += (wantYaw - this.yawRate) * Math.min(1, dt * 3); if (!airborne && this.rpm < 0.9) this.yawRate = 0;
    this.yaw += this.yawRate * dt;
    // collective: hold R to climb, F to sink; with neither, it holds your height (auto-hover)
    const wantVs = I.up ? 6.5 : I.down ? -4.5 : 0; const tilt = Math.max(0.35, Math.cos(this.pitch) * Math.cos(this.roll));
    let T;
    if (this.onGround && !I.up) T = 0; // sitting on the skids
    else T = m * (g + (wantVs - v.y) * 1.8) / tilt;
    T = clamp(T, 0, m * g * 1.9) * this.rpm * this.rpm; this.col = T / (m * g * 1.9);
    // thrust along the rotor axis (body up)
    const q = this.quat(); const U = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const acc = new THREE.Vector3(0, -g, 0).addScaledVector(U, T / m);
    // drag: horizontal, a little vertical; 'Space' brakes to a hover
    acc.x -= v.x * (I.hover ? 1.4 : 0.06) + v.x * hs * 0.0012; acc.z -= v.z * (I.hover ? 1.4 : 0.06) + v.z * hs * 0.0012; acc.y -= v.y * 0.35;
    v.addScaledVector(acc, dt); this.pos.addScaledVector(v, dt);
    // buildings and trees
    const b = Airport.paved(this.pos.x, this.pos.z) ? null : insideBuilding(this.pos.x, this.pos.z);
    if (b && this.pos.y < b.maxY - 0.2) { if (Math.hypot(v.x, v.y, v.z) > 4) return this.crash('You hit ' + (b.name || 'a building') + '!'); this.pos.y = b.maxY; v.set(0, 0, 0); this.onGround = true; } // rooftop landing
    // skids on the ground (or on a roof)
    const roof = b ? b.maxY : -1e9; const gy = Math.max(this.ground(this.pos.x, this.pos.z), roof);
    if (this.pos.y <= gy) {
      if (!this.onGround) {
        const sink = -v.y, lean = Math.max(Math.abs(this.pitch), Math.abs(this.roll));
        if (sink > 6.5) return this.crash('Hard landing!');
        if (lean > 0.45 && sink > 1) return this.crash('Rolled over on landing!');
        if (hs > 12) return this.crash('Landed too fast!');
        if (sink > 2.5) { UI.shake(0.35); Sound.thud(10); }
      }
      this.onGround = true; this.pos.y = gy; if (v.y < 0) v.y = 0; v.x *= Math.max(0, 1 - dt * 6); v.z *= Math.max(0, 1 - dt * 6);
      const c = Airport.paved(this.pos.x, this.pos.z) ? { hit: false } : collideCircle(this.pos.x, this.pos.z, 1.6, this.pos.y); if (c.hit) { this.pos.x = c.x; this.pos.z = c.z; }
    } else if (this.pos.y > gy + 0.1) this.onGround = false;
    // a rotor strike on trees / poles while flying low
    if (!this.onGround && this.pos.y - gy < 6) { const c = collideCircle(this.pos.x, this.pos.z, 4.5, this.pos.y + 1.5); if (c.hit && hs > 3) return this.crash('The rotor hit something!'); }
    if (this.pos.y > 3000) { this.pos.y = 3000; if (v.y > 0) v.y = 0; }
  },
  sync(dt) {
    const M = this.m; M.g.position.copy(this.pos); M.g.quaternion.copy(this.quat());
    const spin = (this.parked ? Math.max(0, this.rpm -= dt * 0.15) : this.rpm) * 42; // blades coast down after landing
    M.rotor.rotation.y += spin * dt; M.tail.rotation.x += spin * 2.6 * dt;
    M.disc.material.opacity = clamp((spin / 42 - 0.45) * 0.35, 0, 0.2); M.blades.visible = spin < 30;
    this.t += dt; const on = !this.parked; M.beacon.visible = on && (this.t % 1.0) < 0.5; for (const s of M.strobes) s.visible = on && (this.t % 1.3) < 0.08;
  },
  updateHud() {
    const V = Math.hypot(this.v.x, this.v.z); const hdg = ((Math.atan2(Math.sin(this.yaw), -Math.cos(this.yaw)) * 180 / Math.PI) + 360) % 360;
    const agl = this.pos.y - H(this.pos.x, this.pos.z), vs = this.v.y * 196.85;
    const cell = (k, val, warn) => `<span style="opacity:.62">${k}</span> <span style="${warn ? 'color:#ff6a4a' : ''}">${val}</span>`;
    this.hud.innerHTML = [cell('SPD', Math.round(V * 1.944) + ' kt'), cell('ALT', Math.round(this.pos.y * 3.281).toLocaleString() + ' ft'), cell('AGL', Math.round(Math.max(0, agl) * 3.281).toLocaleString() + ' ft', agl < 10 && !this.onGround && this.v.y < -4),
      cell('VS', (vs >= 0 ? '+' : '') + Math.round(vs / 50) * 50 + ' fpm', vs < -1100), cell('HDG', String(Math.round(hdg) % 360).padStart(3, '0')), cell('ROTOR', Math.round(this.rpm * 100) + '%'), cell('PWR', Math.round(this.col * 100) + '%')].join('  ');
  },
  camera(dt) {
    const P = Player; const q = this.quat();
    const idle = performance.now() / 1000 - Mouse.lastMove > 1.6;
    this.look.yaw -= Mouse.dx * 0.0026; this.look.pitch = clamp(this.look.pitch + Mouse.dy * 0.0026, -0.6, 1.3); Mouse.dx = Mouse.dy = 0;
    if (Mouse.wheel) { P.camDist = clamp(P.camDist * (1 + Mouse.wheel * 0.12), 6, 80); Mouse.wheel = 0; }
    if (idle) { this.look.yaw *= Math.max(0, 1 - dt * 1.5); this.look.pitch += (0.18 - this.look.pitch) * Math.min(1, dt * 2); }
    this.m.glass.visible = P.camMode !== 2;
    if (P.camMode === 2) { // pilot's seat (right side)
      camera.position.copy(new THREE.Vector3(-0.35, 1.55, 0.9).applyQuaternion(q).add(this.pos));
      camera.quaternion.copy(q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.look.pitch * 0.6 + 0.12, Math.PI + this.look.yaw, 0, 'YXZ')))); return;
    }
    const heading = this.yaw + Math.PI + this.look.yaw, dist = P.camDist * (P.camMode === 1 ? 2.4 : 1), pp = this.look.pitch;
    const tgt = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    const want = new THREE.Vector3(tgt.x + Math.sin(heading) * Math.cos(pp) * dist, tgt.y + Math.sin(pp) * dist, tgt.z + Math.cos(heading) * Math.cos(pp) * dist);
    const gy = H(want.x, want.z) + 1.0; if (want.y < gy) want.y = gy;
    P.camPos.lerp(want, Math.min(1, dt * 5)); if (P.camPos.distanceTo(want) > 120) P.camPos.copy(want);
    camera.position.copy(P.camPos); camera.position.x += UI.shakeAmt * (Math.random() - .5) * 0.4; camera.position.y += UI.shakeAmt * (Math.random() - .5) * 0.4;
    camera.up.set(0, 1, 0); camera.lookAt(tgt);
  },
};

// ---------- the model: a light utility helicopter (+z is the nose) ----------
function buildHeliModel() {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshStandardMaterial({ color: 0xf2f3f5, roughness: 0.35, metalness: 0.25 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x1d4f91, roughness: 0.4, metalness: 0.2 });
  const stripe2 = new THREE.MeshStandardMaterial({ color: 0xd2232a, roughness: 0.4, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.4 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x2b3f52, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.55 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = body) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; parent.add(o); return o; };
  // cabin: a stretched sphere, glass bubble at the front, engine hump on top
  const cab = new THREE.SphereGeometry(1, 28, 18); cab.scale(1.05, 1.0, 1.9); add(cab, paint, 0, 1.45, 0.2);
  const band = new THREE.SphereGeometry(1.012, 28, 6, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.08); band.scale(1.05, 1.0, 1.9); add(band, stripe, 0, 1.45, 0.2);
  const band2 = new THREE.SphereGeometry(1.014, 28, 3, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.03); band2.scale(1.05, 1.0, 1.9); add(band2, stripe2, 0, 1.45, 0.2);
  const bub = new THREE.SphereGeometry(1, 24, 14, -Math.PI * 0.5, Math.PI, 0, Math.PI * 0.62); bub.scale(0.98, 0.95, 1.2); const glass = add(bub, glassM, 0, 1.52, 0.95);
  const hump = new THREE.BoxGeometry(0.9, 0.5, 1.8); add(hump, paint, 0, 2.5, -0.3);
  const ex = new THREE.CylinderGeometry(0.14, 0.16, 0.5, 12); add(ex, dark, 0, 2.55, -1.3, Math.PI / 2 - 0.3);
  // tail boom, fins, tail rotor
  const boom = new THREE.CylinderGeometry(0.16, 0.34, 5.2, 14); add(boom, paint, 0, 1.75, -4.1, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.165, 0.2, 1.2, 14), stripe, 0, 1.75, -5.8, Math.PI / 2);
  const fin = new THREE.BoxGeometry(0.08, 1.3, 0.8); add(fin, stripe, 0, 2.35, -6.55, 0.35);
  const stab = new THREE.BoxGeometry(1.6, 0.06, 0.45); add(stab, paint, 0, 1.75, -5.6);
  const tail = new THREE.Group(); tail.position.set(0.22, 2.3, -6.6); body.add(tail);
  for (const s of [0, Math.PI / 2]) add(new THREE.BoxGeometry(0.03, 1.2, 0.12), dark, 0, 0, 0, s, 0, 0, tail);
  // skids
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8), dark, sx * 0.95, 0.06, 0.1, Math.PI / 2);
    const tip = add(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), dark, sx * 0.95, 0.16, 1.98, Math.PI / 2 - 0.7);
    for (const z of [-0.7, 0.9]) add(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8), dark, sx * 0.72, 0.5, z, 0, 0, sx * 0.45);
  }
  // main rotor: mast, hub, two blades, and a faint disc at speed
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 10), dark, 0, 2.95, 0.1);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.25, 0.1); g.add(rotor);
  const blades = new THREE.Group(); rotor.add(blades);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), dark, 0, 0, 0, 0, 0, 0, rotor);
  for (const s of [-1, 1]) { const b = add(new THREE.BoxGeometry(0.32, 0.04, 5.2), dark, 0, 0, s * 2.7, 0, 0, s * 0.02, blades); b.castShadow = true; }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.3, 40), new THREE.MeshBasicMaterial({ color: 0x1c1e22, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  // lights
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const beacon = add(new THREE.SphereGeometry(0.1, 8, 6), red, 0, 2.8, -0.9); const strobes = [add(new THREE.SphereGeometry(0.08, 8, 6), white, 0, 3.05, -6.8), add(new THREE.SphereGeometry(0.07, 8, 6), white, 0, 0.55, 1.6)];
  const regC = cnv(512, 96), rg = regC.getContext('2d'); rg.fillStyle = '#1d4f91'; rg.font = '700 70px Arial'; rg.textAlign = 'center'; rg.textBaseline = 'middle'; rg.fillText('N252PG', 256, 50);
  const regT = new THREE.CanvasTexture(regC); regT.colorSpace = THREE.SRGBColorSpace; const regM = new THREE.MeshBasicMaterial({ map: regT, transparent: true, depthWrite: false });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), regM); p.position.set(s * 0.29, 1.78, -4.2); p.rotation.y = s * Math.PI / 2; body.add(p); }
  return { g, rotor, blades, disc, tail, glass, beacon, strobes };
}
function makeHelipad() { // a painted pad with a big H
  const c = cnv(256, 256), x = c.getContext('2d'); x.fillStyle = '#55575a'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#f2c230'; x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 110, 0, 7); x.stroke();
  x.fillStyle = '#f4f4f0'; x.fillRect(78, 62, 26, 132); x.fillRect(152, 62, 26, 132); x.fillRect(78, 115, 100, 26);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.23; m.receiveShadow = true; const g = new THREE.Group(); g.add(m); return g;
}
