// =====================================================================
// PARACHUTE — press E in the air to bail out of the plane or helicopter.
// Freefall first (Space opens the canopy; it opens by itself low down), then a steerable
// square-ish canopy in ECU purple and gold: W faster · S slower · A/D turn · hold Space to flare
// just before touchdown. The empty aircraft carries on without you and goes down; a few seconds
// after it hits the ground it's back on its spot at the airport.
// =====================================================================
const Chute = {
  g: null, state: 'off', t: 0, open: 0, yaw: 0, vel: new THREE.Vector3(), drop: null, wrecks: [],
  build() {
    if (this.g) return this.g;
    const g = new THREE.Group();
    const c = cnv(512, 64), x = c.getContext('2d'); const N = 14; // gores in alternating colours
    for (let i = 0; i < N; i++) { x.fillStyle = i % 2 ? '#5b2a86' : '#f2c230'; x.fillRect(i * 512 / N, 0, 512 / N + 1, 64); }
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 56, 512, 8);
    const mat = new THREE.MeshStandardMaterial({ map: ctex(c), side: THREE.DoubleSide, roughness: 0.75 });
    const R = 4.2, PH = Math.PI * 0.4, SQ = 0.5; const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 8, 0, Math.PI * 2, 0, PH), mat);
    dome.scale.set(1.15, SQ, 0.8); dome.position.y = 6.4; dome.castShadow = true; g.add(dome);
    // suspension lines from the canopy's edge down to the harness at the shoulders
    const rimY = 6.4 + R * Math.cos(PH) * SQ, rimR = R * Math.sin(PH); const pts = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rx = Math.cos(a) * rimR * 1.15, rz = Math.sin(a) * rimR * 0.8; pts.push(rx, rimY, rz, rx > 0 ? 0.24 : -0.24, 1.42, -0.05); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.45 })));
    this.dome = dome; g.visible = false; dynRoot.add(g); return this.g = g;
  },
  // leave the aircraft in flight
  bail(kind) {
    const P = Player, A = kind === 'plane' ? Plane : Heli; this.build();
    const q = kind === 'plane' ? A.q : A.quat(); const side = new THREE.Vector3(kind === 'plane' ? 1 : -1, 0, 0).applyQuaternion(q); side.y = 0; side.normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1); fwd.normalize();
    P.unseat(); P.mode = 'para'; P.person.g.visible = true;
    P.pos.copy(A.pos).addScaledVector(side, 2.6); P.pos.y -= 1.2;
    this.vel.copy(A.v); this.vel.y = Math.min(this.vel.y, 0) - 1; this.yaw = Math.atan2(fwd.x, fwd.z); P.yaw = this.yaw;
    this.state = 'free'; this.t = 0; this.open = 0; this.g.visible = false;
    A.hud.style.display = 'none'; A.abandoned = true; A.wreckT = 0; if (kind === 'plane') A.thr = 0; else { A.col = 0; }
    if (!this.wrecks.includes(kind)) this.wrecks.push(kind);
    P.camDist = 9; P.camPitch = 0.35; P.camYaw = this.yaw + Math.PI; Sound.door();
    UI.toast('You jumped! Space opens the parachute (it opens by itself at about 800 ft)', 6000);
  },
  update(dt) {
    const P = Player, p = P.pos; this.t += dt;
    let gy = groundY(p.x, p.z, p.y); const agl = p.y - gy;
    const fwdIn = (key('KeyW', 'ArrowUp') ? 1 : 0) - (key('KeyS', 'ArrowDown') ? 1 : 0), turn = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const space = key('Space');
    if (this.state === 'free') {
      if ((space && this.t > 0.35) || (agl < 250 && this.t > 0.8) || agl < 45 || this.t > 9) { this.state = 'open'; this.open = 0; this.g.visible = true; Sound.thud(4); P.camDist = Math.max(P.camDist, 14); P.camPitch = Math.min(P.camPitch, 0.22); }
      this.vel.y = Math.max(-55, this.vel.y - 9.8 * dt);
      const k = Math.min(1, dt * 0.25); this.vel.x -= this.vel.x * k; this.vel.z -= this.vel.z * k; // air drag bleeds off the aircraft's speed
      this.yaw -= turn * dt * 1.2; const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); this.vel.x += fx * fwdIn * 4 * dt; this.vel.z += fz * fwdIn * 4 * dt; // track a little
    } else {
      this.open = Math.min(1, this.open + dt / 1.1);
      this.yaw -= turn * dt * 0.9;
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); const gs = 7 + fwdIn * 2.5; const flare = space && agl < 12;
      const wantVy = flare ? -1.8 : -5.2 - (fwdIn > 0 ? 0.8 : 0) + Math.abs(turn) * -0.6;
      const k = Math.min(1, dt * (this.open < 1 ? 2.5 : 1.6)) * this.open;
      this.vel.x += (fx * gs * (flare ? 0.5 : 1) - this.vel.x) * k; this.vel.z += (fz * gs * (flare ? 0.5 : 1) - this.vel.z) * k; this.vel.y += (wantVy - this.vel.y) * Math.min(1, dt * (this.open < 1 ? 3 : 2));
    }
    let nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt; const ny = p.y + this.vel.y * dt;
    if (agl < 40) { const c = collideCircle(nx, nz, 0.4, ny); if (c.x !== nx || c.z !== nz) { this.vel.x *= 0.3; this.vel.z *= 0.3; } nx = c.x; nz = c.z; }
    gy = groundY(nx, nz, p.y);
    p.set(nx, ny, nz); P.yaw = this.yaw;
    const G = P.person.g;
    if (ny <= gy) { p.y = gy; this.land(); return; }
    // body: belly-down in freefall, hanging upright under the canopy
    const tilt = this.state === 'free' ? 1.25 : -0.12 * this.open * Math.max(0, fwdIn);
    G.rotation.set(tilt, this.yaw, -turn * 0.15, 'YXZ'); G.position.copy(p);
    if (this.state === 'free') G.position.y += 0.9;
    animatePerson(P.person, 0, dt, true);
    if (this.g.visible) {
      const s = 0.25 + this.open * 0.75; this.g.position.copy(p); this.g.rotation.set(0, this.yaw, -turn * 0.12, 'YXZ'); this.dome.scale.set(1.15 * s, 0.5 * (0.6 + 0.4 * this.open), 0.8 * s); this.dome.position.y = 1.5 + 4.9 * Math.min(1, this.open * 1.4);
    }
    UI.hint(`Altitude <b>${Math.max(0, Math.round(agl * 3.281))} ft</b> · ` + (this.state === 'free' ? '<kbd>Space</kbd> open the parachute' : '<kbd>W</kbd>/<kbd>S</kbd> speed · <kbd>A</kbd>/<kbd>D</kbd> steer · hold <kbd>Space</kbd> to flare'));
  },
  land() {
    const P = Player, vy = this.vel.y; P.mode = 'walk'; P.vel.set(0, 0, 0); P.grounded = true;
    P.person.g.rotation.set(0, this.yaw, 0, 'XYZ'); P.person.g.position.copy(P.pos); P.camDist = 6; UI.hint('');
    if (this.state === 'free') { UI.shake(1); Sound.thud(20); UI.toast('Ouch — that was a hard landing! (Open the parachute sooner next time)', 5000); }
    else { Sound.thud(3); UI.toast(vy > -3 ? 'Nice soft landing!' : 'Landed!', 3000); }
    this.state = 'off';
    // the canopy settles onto the ground behind you and fades away
    if (this.g.visible) { this.drop = { t: 0, x: P.pos.x - Math.sin(this.yaw) * 3, z: P.pos.z - Math.cos(this.yaw) * 3 }; }
  },
  // runs every frame, whatever the player is doing: the collapsing canopy and the empty aircraft
  tick(dt) {
    if (this.drop && this.g) {
      const D = this.drop; D.t += dt; const k = Math.min(1, D.t / 1.4); const gy = H(D.x, D.z);
      this.g.position.set(D.x, gy, D.z); this.dome.position.y = 6.4 * (1 - k) + 0.25; this.dome.scale.y = 0.5 * (1 - k) + 0.04;
      this.g.children[1].visible = k < 0.6; if (D.t > 6) { this.g.visible = false; this.drop = null; this.g.children[1].visible = true; }
    }
    for (const kind of this.wrecks.slice()) {
      const A = kind === 'plane' ? Plane : Heli; if (!A.abandoned) { this.wrecks.splice(this.wrecks.indexOf(kind), 1); continue; }
      if (A.wreckT > 0) { A.wreckT += dt; if (A.wreckT > 4) { A.abandoned = false; A.park(); UI.toast(kind === 'plane' ? 'Your plane is back on its parking spot at the airport.' : 'The helicopter is back on its pad at the airport.', 4000); } continue; }
      // unpiloted: falls, drag, nose drops toward where it's heading
      A.v.y -= 9.8 * dt; const dr = Math.min(1, dt * (kind === 'plane' ? 0.12 : 0.6)); A.v.x -= A.v.x * dr; A.v.z -= A.v.z * dr;
      A.pos.addScaledVector(A.v, dt);
      if (kind === 'plane') { const d = this._d || (this._d = new THREE.Object3D()); d.position.set(0, 0, 0); d.lookAt(A.v); A.q.slerp(d.quaternion, Math.min(1, dt * 0.7)); }
      else { A.pitch += (0.5 - A.pitch) * dt * 0.4; A.roll += dt * 0.3; A.yaw += dt * 1.2; A.rpm = Math.max(0, (A.rpm || 0) - dt * 0.1); }
      const gy = A.ground(A.pos.x, A.pos.z);
      if (A.pos.y <= gy + (kind === 'plane' ? 0.6 : 0.2)) {
        A.pos.y = gy + 0.4; A.v.set(0, 0, 0); A.wreckT = 0.001;
        const d = Math.hypot(A.pos.x - Player.pos.x, A.pos.z - Player.pos.z); if (d < 400) { UI.shake(Math.max(0.15, 1 - d / 400)); Sound.thud(Math.max(4, 30 - d / 15)); }
      }
      A.sync(dt);
    }
  },
};
