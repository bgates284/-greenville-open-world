// =====================================================================
// THE NURSE AT ECU HEALTH — a woman in black scrubs carrying her baby, strolling around the
// ECU Health Medical Center start point. Her model was made from a photo with TRELLIS.2 and rigged
// for this game (tools: scratchpad rig.py → public-data/people/nurse_baby.glb): hips, both legs
// (thigh, shin, foot), spine, neck and head. Her arms and the baby are part of the body, so the
// baby is held steady while she walks; she glances around, and turns her head to look at you
// when you come close.
// =====================================================================
// one walk cycle for the hand-rigged people (nurse, the kid who follows you). Bone axes: rotating a limb by a
// NEGATIVE x angle swings it forward; a POSITIVE x angle on the shin bends the knee. ph = stride phase,
// A = 0 (standing) … 1 (walking), run = 0 … 1 (jogging: longer stride, more knee and arm).
function rigWalk(B, base, ph, A, run) {
  const s = Math.sin(ph), c = Math.cos(ph), leg = (0.34 + 0.22 * run) * A, knee = (0.55 + 0.5 * run) * A;
  B.thighL.rotation.x = -leg * s; B.thighR.rotation.x = leg * s;
  B.shinL.rotation.x = knee * Math.max(0, -c) + 0.05 * A; B.shinR.rotation.x = knee * Math.max(0, c) + 0.05 * A; // knee bends while that leg swings through
  B.footL.rotation.x = -(B.thighL.rotation.x + B.shinL.rotation.x) * 0.7; B.footR.rotation.x = -(B.thighR.rotation.x + B.shinR.rotation.x) * 0.7;
  B.hips.position.y = base.hipsY + (Math.abs(c) * (0.02 + 0.02 * run) - 0.012 - 0.02 * run) * A; B.hips.rotation.y = -0.05 * s * A; B.spine.rotation.y = 0.07 * s * A;
  B.spine.rotation.x = 0.08 * run * A; // lean into a jog
  if (B.upperArmL) { // arms down at the sides, swinging against the legs
    const sw = (0.3 + 0.35 * run) * A * s, bend = 0.18 + (0.25 + 0.9 * run) * A;
    B.upperArmL.rotation.set(sw, 0, -1.28); B.upperArmR.rotation.set(-sw, 0, 1.28);
    B.foreArmL.rotation.set(0, -bend, 0); B.foreArmR.rotation.set(0, bend, 0);
  }
}
const Nurse = {
  LL: [35.6075, -77.4031], // ECU Health Medical Center (LANDMARKS)
  g: null, bones: null, state: 'off', center: null, pos: new THREE.Vector3(), yaw: 0, target: null, wait: 0,
  ph: 0, amp: 0, look: 0, lookT: 0, lookGoal: 0, _t: 0, base: null,
  url() { return (window.GV_DATA ? window.GV_DATA : 'public-data/') + 'people/nurse_baby.glb'; },
  async load() {
    this.state = 'loading';
    try {
      const buf = await fetch(this.url()).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      const gl = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      const g = gl.scene; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      const B = {}; for (const n of ['hips', 'spine', 'neck', 'head', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR']) B[n] = g.getObjectByName(n);
      this.bones = B; this.base = { hipsY: B.hips.position.y }; this.g = g; dynRoot.add(g); this.state = 'ready';
      this.place();
    } catch (e) { console.warn('nurse model unavailable', e); this.state = 'failed'; }
  },
  // her spot: where a player starting at "ECU Health Medical Center" appears
  place() {
    const x = lonToX(this.LL[1]), z = latToZ(this.LL[0]);
    let c; try { c = spawnSpot(x, z).c; } catch (e) { c = [x, z]; }
    const s = freeSpot(c[0] + 3, c[1] + 2); this.center = [c[0], c[1]]; this.pos.set(s[0], 0, s[1]); this.target = null; this.wait = 1;
  },
  walkable(x, z) { return !insideBuilding(x, z) && !onRoadSurface(x, z) && !World.obsHash.query(x - .4, z - .4, x + .4, z + .4).some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.4); },
  pickTarget() { // somewhere 3–11 m from her spot that she can walk straight to without crossing a road or a wall
    const [cx, cz] = this.center;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 8, tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d;
      const L = Math.hypot(tx - this.pos.x, tz - this.pos.z); let ok = L > 2;
      for (let s = 0.5; ok && s <= L; s += 0.8) { const t = s / L; ok = this.walkable(this.pos.x + (tx - this.pos.x) * t, this.pos.z + (tz - this.pos.z) * t); }
      if (ok) return [tx, tz];
    }
    return null;
  },
  update(dt) {
    if (this.state === 'off' || this.state === 'ready') {
      this._t -= dt; if (this._t <= 0) { this._t = 1;
        const f = Player.focus(), x = lonToX(this.LL[1]), z = latToZ(this.LL[0]), d = Math.hypot(f.x - x, f.z - z);
        const [tx, ty] = tileOfXZ(x, z), T = Tiles.map.get(tileKey(tx, ty));
        if (this.state === 'off' && d < 700 && T && T.state === 'ready') this.load();
        if (this.g) this.g.visible = d < 900;
        if (this.state === 'ready' && T && T.state === 'ready' && !this._placedTile) { this._placedTile = T; this.place(); } // re-find her spot once the square is fully built
        if (T !== this._placedTile) this._placedTile = null;
      }
    }
    if (this.state !== 'ready' || !this.g.visible) return;
    const B = this.bones;
    // ---- where she's going ----
    let moving = false;
    if (this.wait > 0) this.wait -= dt;
    else {
      if (!this.target) { this.target = this.pickTarget(); if (!this.target) this.wait = 2; }
      if (this.target) {
        const dx = this.target[0] - this.pos.x, dz = this.target[1] - this.pos.z, L = Math.hypot(dx, dz);
        if (L < 0.4) { this.target = null; if (Math.random() < 0.45) this.wait = 1.5 + Math.random() * 3; }
        else {
          let da = Math.atan2(dx, dz) - this.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); this.yaw += clamp(da, -2.2 * dt, 2.2 * dt);
          if (Math.abs(da) < 1.2) { const v = 1.1 * dt; const nx = this.pos.x + Math.sin(this.yaw) * v, nz = this.pos.z + Math.cos(this.yaw) * v; if (this.walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; moving = true; } else this.target = null; }
        }
      }
    }
    // ---- walk cycle ----
    this.amp += ((moving ? 1 : 0) - this.amp) * Math.min(1, dt * 5);
    if (moving) this.ph += dt * 1.1 / 0.62 * Math.PI;
    rigWalk(B, this.base, this.ph, this.amp, 0);
    // ---- her head: looks at you when you're close, otherwise glances around ----
    const f = Player.focus(), pdx = f.x - this.pos.x, pdz = f.z - this.pos.z, pd = Math.hypot(pdx, pdz);
    if (pd < 9 && Player.mode !== 'drone') { let a = Math.atan2(pdx, pdz) - this.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); this.lookGoal = clamp(a, -0.95, 0.95); this.lookT = 1; }
    else if ((this.lookT -= dt) <= 0) { this.lookGoal = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.3; this.lookT = 2 + Math.random() * 3.5; }
    this.look += (this.lookGoal - this.look) * Math.min(1, dt * 2.5);
    B.head.rotation.y = this.look * 0.75; B.neck.rotation.y = this.look * 0.25; B.head.rotation.x = 0.06 + 0.02 * Math.sin(this.ph * 2) * this.amp;
    this.g.position.set(this.pos.x, groundY(this.pos.x, this.pos.z, H(this.pos.x, this.pos.z) + 1), this.pos.z); this.g.rotation.y = this.yaw;
  },
};
