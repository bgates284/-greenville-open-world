// =====================================================================
// THE KID WHO TAGS ALONG — a girl in a cream T-shirt and grey pants who follows you everywhere.
// Model made from a photo with TRELLIS.2, rigged for this game (arms, legs, spine, neck, head;
// public-data/people/kid.glb). On foot she keeps a step or two behind you, jogs to catch up, and
// looks around (and at you when you stop). She rides along in your car — out of the passenger side
// when you get out — and in the plane, helicopter or drone she's with you, out of sight, until
// you're back on your feet. Wherever you travel to, she's there next to you.
// =====================================================================
const Kid = {
  g: null, bones: null, base: null, state: 'off', pos: new THREE.Vector3(), yaw: 0, ph: 0, amp: 0, run: 0,
  shown: false, lastMode: '', look: 0, lookGoal: 0, lookT: 0, stuck: 0, side: 1, sideT: 0,
  url() { return (window.GV_DATA ? window.GV_DATA : 'public-data/') + 'people/kid.glb'; },
  async load() {
    this.state = 'loading';
    try {
      const buf = await fetch(this.url()).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      const gl = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      const g = gl.scene; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      const B = {}; for (const n of ['hips', 'spine', 'neck', 'head', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR']) B[n] = g.getObjectByName(n);
      this.bones = B; this.base = { hipsY: B.hips.position.y }; this.g = g; g.visible = false; dynRoot.add(g); this.state = 'ready';
      rigWalk(B, this.base, 0, 0, 0); // arms down
    } catch (e) { console.warn('kid model unavailable', e); this.state = 'failed'; }
  },
  // put her beside you: behind and to one side, on open ground
  appear(x, z, yaw) {
    const P = Player, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = fz, rz = -fx;
    const px = x != null ? x : P.pos.x - fx * 1.6 + rx * 0.9 * this.side, pz = z != null ? z : P.pos.z - fz * 1.6 + rz * 0.9 * this.side;
    const c = freeSpot(px, pz, P.pos.x, P.pos.z); this.pos.set(c[0], 0, c[1]); this.yaw = yaw != null ? yaw : P.yaw; this.stuck = 0;
    this.shown = true; this.g.visible = true; this.g.quaternion.identity(); this.g.rotation.set(0, this.yaw, 0); if (this.bones) { this.bones.thighL.rotation.z = this.bones.thighR.rotation.z = 0; }
  },
  hide() { this.shown = false; if (this.g) this.g.visible = false; },
  // sitting in the front passenger seat (the mirror of where you sit), looking out of the windscreen and around
  _off: new THREE.Vector3(), _hp: new THREE.Vector3(),
  seat(dt) {
    const P = Player, I = P.carInfo || {}, B = this.bones, g = this.g;
    this.shown = false; g.visible = true;
    B.thighL.rotation.set(-1.45, 0, 0.06); B.thighR.rotation.set(-1.45, 0, -0.06); B.shinL.rotation.x = B.shinR.rotation.x = 1.3; B.footL.rotation.x = B.footR.rotation.x = 0.1;
    B.hips.position.y = this.base.hipsY; B.hips.rotation.set(0, 0, 0); B.spine.rotation.set(-0.05, 0, 0);
    B.upperArmL.rotation.set(-0.45, 0, -1.3); B.upperArmR.rotation.set(-0.45, 0, 1.3); B.foreArmL.rotation.set(0, -1.0, 0); B.foreArmR.rotation.set(0, 1.0, 0);
    // she watches the road, and now and then looks out of her window or over at you
    if ((this.lookT -= dt) <= 0) { const r = Math.random(); this.lookGoal = r < 0.5 ? 0 : r < 0.75 ? -0.9 : 0.8; this.lookT = 2 + Math.random() * 4; }
    this.look += (this.lookGoal - this.look) * Math.min(1, dt * 2.5); B.head.rotation.set(0.02, this.look * 0.75, 0); B.neck.rotation.y = this.look * 0.25;
    const q = P.carObj.quaternion, seat = this._off.set(-Math.min(0.42, (I.width || 2.2) * 0.17), (I.height || 1.3) * 0.35, -0.3).applyQuaternion(q).add(P.car.pos);
    g.quaternion.copy(q); g.position.copy(seat); g.updateMatrixWorld(true);
    const hp = B.hips.getWorldPosition(this._hp); g.position.add(seat.sub(hp)); // hips on the seat cushion
    this.pos.set(g.position.x, 0, g.position.z);
  },
  update(dt) {
    if (this.state === 'off' && Game.started) this.load();
    if (this.state !== 'ready') return;
    const P = Player, mode = P.mode;
    if (mode === 'drive' && P.carObj) { this.seat(dt); this.lastMode = mode; return; } // in the passenger seat
    if (mode !== 'walk') { // plane, helicopter, drone: along for the ride, out of sight
      if (this.shown || this.g.visible) this.hide();
      this.lastMode = mode; return;
    }
    if (!this.shown) { // just got out (or arrived somewhere): out of the passenger door if there's a car right here
      const cd = Math.hypot(P.pos.x - P.car.pos.x, P.pos.z - P.car.pos.z);
      if (this.lastMode === 'drive' && cd < 4) { const yaw = P.car.yaw, side = ((P.carInfo && P.carInfo.width) || 1.9) / 2 + 0.7; this.appear(P.car.pos.x - Math.cos(yaw) * side, P.car.pos.z + Math.sin(yaw) * side, yaw); }
      else this.appear();
    }
    this.lastMode = mode;
    // ---- follow: a spot a step or two behind you, on whichever side she's on ----
    if ((this.sideT -= dt) <= 0) { this.sideT = 6 + Math.random() * 8; if (Math.random() < 0.3) this.side = -this.side; }
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = fz, rz = -fx;
    const tx = P.pos.x - fx * 1.4 + rx * 0.85 * this.side, tz = P.pos.z - fz * 1.4 + rz * 0.85 * this.side;
    const dP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    if (dP > 35) { this.appear(); return; } // left far behind (fast travel, a long run): catch up
    let dx = tx - this.pos.x, dz = tz - this.pos.z; const dT = Math.hypot(dx, dz);
    let speed = 0; if (dT > 0.45 && dP > 1.1) speed = clamp(0.9 + (dT - 0.45) * 1.7, 0, 6.2);
    this.run += ((speed > 2.4 ? 1 : 0) - this.run) * Math.min(1, dt * 3);
    let moving = false;
    if (speed > 0) {
      let da = Math.atan2(dx, dz) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -5 * dt, 5 * dt);
      const v = speed * dt * Math.max(0.2, Math.cos(Math.min(1.5, Math.abs(da))));
      const nx = this.pos.x + Math.sin(this.yaw) * v, nz = this.pos.z + Math.cos(this.yaw) * v;
      if (!insideBuilding(nx, nz)) { this.pos.x = nx; this.pos.z = nz; moving = true; this.stuck = 0; }
      else if ((this.stuck += dt) > 1.2) this.appear(); // walled off: hop over beside you
    } else { // standing: face roughly the way you face
      let da = P.yaw - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > 0.6) this.yaw += clamp(da, -1.5 * dt, 1.5 * dt);
    }
    // keep out of your way
    const ox = this.pos.x - P.pos.x, oz = this.pos.z - P.pos.z, od = Math.hypot(ox, oz); if (od < 0.75 && od > 1e-3) { this.pos.x = P.pos.x + ox / od * 0.75; this.pos.z = P.pos.z + oz / od * 0.75; }
    // ---- animation ----
    this.amp += ((moving ? 1 : 0) - this.amp) * Math.min(1, dt * 6);
    if (moving) this.ph += dt * speed / (0.55 + 0.35 * this.run) * Math.PI;
    rigWalk(this.bones, this.base, this.ph, this.amp, this.run);
    // ---- head: glances around; looks up at you when you're both standing still ----
    if (!moving && dP < 4) { let a = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.lookGoal = clamp(a, -1, 1); }
    else if ((this.lookT -= dt) <= 0) { this.lookGoal = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 1.4; this.lookT = 1.5 + Math.random() * 3.5; }
    this.look += (this.lookGoal - this.look) * Math.min(1, dt * 3);
    const B = this.bones; B.head.rotation.y = this.look * 0.75; B.neck.rotation.y = this.look * 0.25; B.head.rotation.x = (!moving && dP < 4) ? -0.12 : 0.03;
    this.g.position.set(this.pos.x, groundY(this.pos.x, this.pos.z, P.pos.y + 1), this.pos.z); this.g.rotation.y = this.yaw;
  },
};
