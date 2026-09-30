// =====================================================================
// PHYSICS (cannon-es) — trees, lamps and signs fall over when you hit
// them, and cars get shoved out of the way.
// Only the things that have just been hit are simulated: everything else
// in the city stays static, so this costs nothing until you crash.
// Your own car stays on its hand-tuned driving model and is a kinematic
// body here (it pushes things, things don't push it — it just slows down).
// =====================================================================
let CANNON = null;
const Phys = {
  ready: false, failed: false, loading: false, world: null,
  items: [],      // simulated right now: { body, obj, k?, car?, t, rest }
  still: [],      // settled wreckage left lying where it fell (no body)
  queue: [],      // traffic cars to turn dynamic after the current step
  gc: null, ground: null,
  MAX_STILL: 120, MAX_ITEMS: 40,
  load() {
    if (this.ready || this.loading) return; this.loading = true;
    import('cannon-es').then(m => { CANNON = m; this.init(); }).catch(e => { this.failed = true; console.warn('physics unavailable — hits stay solid', e); });
  },
  init() {
    const w = new CANNON.World({ gravity: new CANNON.Vec3(0, -12, 0), allowSleep: true });
    w.broadphase = new CANNON.SAPBroadphase(w); w.solver.iterations = 8;
    w.defaultContactMaterial.friction = 0.45; w.defaultContactMaterial.restitution = 0.12;
    this.world = w;
    const pc = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 });
    pc.addShape(new CANNON.Box(new CANNON.Vec3(0.95, 0.7, 2.3)), new CANNON.Vec3(0, 0.75, 0));
    pc.addEventListener('collide', e => this.playerHit(e)); pc.isPlayer = true; pc.collisionFilterGroup = 2;
    w.addBody(pc); this.pcar = pc;
    this.ready = true;
  },

  // ---------- ground: a heightfield patch around the action ----------
  ensureGround(cx, cz) {
    if (this.gc && Math.abs(cx - this.gc[0]) < 18 && Math.abs(cz - this.gc[1]) < 18) return;
    if (this.ground) this.world.removeBody(this.ground);
    const N = 49, es = 1.5, x0 = cx - (N - 1) * es / 2, z0 = cz + (N - 1) * es / 2;
    const data = [];
    for (let i = 0; i < N; i++) { const row = []; for (let j = 0; j < N; j++) row.push(surfaceY(x0 + i * es, z0 - j * es) + 0.12); data.push(row); }
    const b = new CANNON.Body({ mass: 0 }); b.addShape(new CANNON.Heightfield(data, { elementSize: es }));
    b.position.set(x0, 0, z0); b.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // heightfield local y -> world -z
    this.world.addBody(b); this.ground = b; this.gc = [cx, cz]; this.half = (N - 1) * es / 2 - 2;
    for (const it of this.items) if (it.body) it.body.wakeUp();
  },
  inGround(x, z) { return this.gc && Math.abs(x - this.gc[0]) < this.half && Math.abs(z - this.gc[1]) < this.half; },

  // ---------- knocking static things over ----------
  // called by the player's car (and cars that are sliding) for each bumper circle
  knockAt(x, z, r, vx, vz) {
    if (!this.ready) return 0; const spd = Math.hypot(vx, vz); if (spd < 2) return 0; let mass = 0;
    for (const o of World.obsHash.query(x - r - 1.5, z - r - 1.5, x + r + 1.5, z + r + 1.5)) {
      if (!o.k || o.dead || spd < o.k.min) continue;
      if (Math.hypot(o.x - x, o.z - z) > r + o.r + 0.05) continue;
      mass += this.knock(o.k, vx, vz);
    }
    return mass;
  },
  bbox(ims) {
    const b = new THREE.Box3();
    for (const im of ims) { const g = im.geometry; if (!g.boundingBox) g.computeBoundingBox(); b.union(g.boundingBox); }
    return b;
  },
  knock(k, vx, vz) {
    if (k.dead || !Tiles.map.has(k.key)) return 0; k.dead = true; for (const o of k.obs) o.dead = true;
    if (k.again) return this.reKnock(k.again, vx, vz);
    const M = new THREE.Matrix4(); k.ims[0].getMatrixAt(k.idx, M);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(); M.decompose(pos, quat, scl);
    // hide the static copy
    const Z = Phys._zero || (Phys._zero = new THREE.Matrix4().makeScale(0, 0, 0));
    for (const im of k.ims) { im.setMatrixAt(k.idx, Z); im.instanceMatrix.needsUpdate = true; }
    if (k.lamp) { k.lamp[0] = 1e9; k.lamp[2] = 1e9; } // its street light goes out
    // moving copy: outer follows the body, inner is offset so the body sits at the centre of mass
    const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner); inner.scale.copy(scl);
    const col = new THREE.Color(), I = new THREE.Matrix4(); const own = [];
    for (const im of k.ims) {
      const m = new THREE.InstancedMesh(im.geometry, im.material, 1); m.setMatrixAt(0, I);
      if (im.instanceColor) { im.getColorAt(k.idx, col); m.setColorAt(0, col); }
      m.castShadow = im.castShadow || k.kind !== 'sign'; m.receiveShadow = true; m.frustumCulled = false; inner.add(m);
    }
    if (k.plate) { // street-name blades are part of a merged mesh: lift ours out, collapse the originals
      const src = k.plate.mesh.geometry, P = src.attributes.position, U = src.attributes.uv, Nn = src.attributes.normal;
      const n = k.plate.v1 - k.plate.v0, p = new Float32Array(n * 3), u = new Float32Array(n * 2), nn = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = k.plate.v0 + i;
        p[i * 3] = P.getX(v) - pos.x; p[i * 3 + 1] = P.getY(v) - pos.y; p[i * 3 + 2] = P.getZ(v) - pos.z;
        u[i * 2] = U.getX(v); u[i * 2 + 1] = U.getY(v); nn[i * 3] = Nn.getX(v); nn[i * 3 + 1] = Nn.getY(v); nn[i * 3 + 2] = Nn.getZ(v);
        P.setXYZ(v, pos.x, pos.y - 5, pos.z);
      }
      P.needsUpdate = true;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.BufferAttribute(u, 2)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      const pm = new THREE.Mesh(g, k.plate.mesh.material); pm.castShadow = true; inner.add(pm); own.push(g);
    }
    // collision box from the model's bounds (trees/lamps use a slimmer box so they topple onto the canopy/arm)
    const bb = this.bbox(k.ims), c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
    c.multiply(scl); sz.multiply(scl);
    const hx = Math.max(0.1, sz.x / 2 * k.f), hy = Math.max(0.1, sz.y / 2), hz = Math.max(0.1, sz.z / 2 * k.f);
    inner.position.copy(c).negate();
    const b = new CANNON.Body({ mass: k.mass, linearDamping: 0.08, angularDamping: 0.25 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    const wc = c.clone().applyQuaternion(quat).add(pos);
    b.position.set(wc.x, wc.y + 0.05, wc.z); b.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    const spd = Math.hypot(vx, vz), dx = vx / (spd || 1), dz = vz / (spd || 1);
    if (k.kind === 'car') { // shoved sideways, with a little spin
      b.velocity.set(vx * 0.45, 0.4, vz * 0.45); b.angularVelocity.set(0, (Math.random() - 0.5) * spd * 0.12, 0);
    } else { // the trunk/pole snaps and it tips over away from the car; your car drives through the stump
      b.collisionFilterMask = -1 ^ 2;
      const tq = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(dz, 0, -dx), 0.18); b.quaternion.copy(tq.mult(b.quaternion));
      const light = k.mass < 150, share = light ? 0.75 : 0.3;
      b.velocity.set(vx * share, light ? 1.2 + spd * 0.05 : 0.3, vz * share);
      const w = Math.max(1.2, spd / Math.max(1, hy * 2) * (light ? 1.4 : 1.3)); b.angularVelocity.set(dz * w, (Math.random() - 0.5) * 0.6, -dx * w);
    }
    b._hitT = performance.now();
    this.ensureGround(this.focus().x, this.focus().z);
    this.world.addBody(b);
    outer.position.set(b.position.x, b.position.y, b.position.z); outer.quaternion.copy(quat); scene.add(outer);
    this.items.push({ body: b, obj: outer, k, t: 0, rest: 0, own, r: Math.max(hx, hz) });
    if (this.items.length > this.MAX_ITEMS) this.settle(this.items.find(it => !it.car));
    Sound.thud(Math.min(30, spd * (k.mass > 500 ? 1 : 0.6)));
    return k.mass;
  },

  // ---------- traffic cars ----------
  dynCar(c, vx, vz) {
    if (!this.ready || c.phys || c.removed) return;
    this.dropKin(c);
    const b = new CANNON.Body({ mass: 1400, linearDamping: 0.12, angularDamping: 0.35 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.92, 0.6, c.len / 2 - 0.15)));
    b.position.set(c.x, c.obj.position.y + 0.55, c.z); b.quaternion.setFromEuler(0, c.yaw, 0);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    b.velocity.set(fx * c.speed + (vx || 0), 0, fz * c.speed + (vz || 0));
    b.addEventListener('collide', e => this.carHit(c, e));
    b._hitT = 0; c.phys = b; c.wreck = false; c.speed = 0; c.braking = true;
    this.ensureGround(this.focus().x, this.focus().z);
    this.world.addBody(b); this.items.push({ body: b, car: c, t: 0, rest: 0, r: 1.2 });
  },
  kinFor(c) {
    if (c.kin) return c.kin;
    const b = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 });
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.92, 0.6, c.len / 2 - 0.15)), new CANNON.Vec3(0, 0.55, 0));
    b.addEventListener('collide', e => this.carHit(c, e));
    this.world.addBody(b); c.kin = b; return b;
  },
  forget(c) { if (!this.ready) return; this.dropKin(c); if (c.phys) { this.world.removeBody(c.phys); c.phys = null; const i = this.items.findIndex(it => it.car === c); if (i >= 0) this.items.splice(i, 1); } },
  dropKin(c) { if (c.kin) { this.world.removeBody(c.kin); c.kin = null; } },
  carHit(c, e) { // something slammed into a traffic car: it goes dynamic after this step
    const o = e.body; if (!o || o === this.ground) return;
    const imp = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (!c.phys && imp > 2.5 && (o.isPlayer || o.mass > 30)) this.queue.push(c);
  },
  release(it) { // a shoved car that has stopped: rejoin traffic (or stay a wreck if it's off the road or on its roof)
    const c = it.car, b = it.body; this.world.removeBody(b); c.phys = null;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.obj.quaternion);
    const n = nearestRoad(c.x, c.z, 14, rd => rd.ai && !rd.removed);
    if (!n || up.y < 0.7) { c.wreck = true; c.stuck = 0; return; }
    const road = n.road, a = road.pts[n.i], bb = road.pts[n.i + 1]; let sx = bb[0] - a[0], sz = bb[1] - a[1]; const L = Math.hypot(sx, sz) || 1; sx /= L; sz /= L;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    let dir = road.oneway ? road.oneway : (fx * sx + fz * sz >= 0 ? 1 : -1);
    c.road = road; c.dir = dir; if (dir === 1) { c.i = n.i; c.s = n.t * L; } else { c.i = n.i + 1; c.s = (1 - n.t) * L; }
    const g = segOf(c); const px = g.p0[0] + g.dx * c.s, pz = g.p0[1] + g.dz * c.s;
    c.ox = c.x - px; c.oz = c.z - pz; c.next = chooseNext(c, carAllow, Traffic.rnd); c.stopped = null;
    c.speed = 0; c.bump = 1.5; c.stuck = 0; c.lastV = 0;
    c.obj.rotation.set(0, c.yaw, 0); c.obj.userData.bodyG.rotation.x = 0;
  },

  // ---------- your car ----------
  playerHit(e) {
    const o = e.body; if (!o || o.mass <= 0 || Player.mode !== 'drive') return;
    const now = performance.now(); if (now - (o._hitT || 0) < 450) return; o._hitT = now;
    const imp = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (imp < 2) return;
    const C = Player.car; C.speed *= 1 - Math.min(0.45, o.mass / (o.mass + 1500) * 0.7);
    Sound.thud(imp); UI.shake(Math.min(1, imp / 25));
  },
  focus() { return Player.focus(); },

  // ---------- per frame ----------
  settle(it) { // stop simulating; leave it lying there
    if (!it) return; const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
    if (it.car) { this.release(it); return; }
    this.world.removeBody(it.body); it.saved = it.body; it.body = null; this.still.push(it);
    if (it.k.kind === 'car' && Tiles.map.get(it.k.key) === it.k.T) { // a shoved parked car stays solid where it stopped (and can be shoved again)
      const T = it.k.T, b = it.saved, fw = new THREE.Vector3(0, 0, 1).applyQuaternion(it.obj.quaternion); const kk = { again: it, min: 3, obs: [] }; it.again = kk;
      for (const s of [-1.2, 1.2]) { const x = b.position.x + fw.x * s, z = b.position.z + fw.z * s; const o = { x, z, r: 1.0, k: kk }; kk.obs.push(o); T.hashItems.push([World.obsHash, World.obsHash.insert(o, x - 1, z - 1, x + 1, z + 1)]); }
    }
  },
  reKnock(it, vx, vz) {
    const i = this.still.indexOf(it); if (i < 0 || !it.saved) return 0; this.still.splice(i, 1);
    const b = it.saved; it.body = b; it.saved = null; it.t = 0; it.rest = 0;
    b.velocity.set(vx * 0.45, 0.3, vz * 0.45); b.angularVelocity.set(0, (Math.random() - 0.5) * 1.5, 0); b._hitT = performance.now();
    this.ensureGround(this.focus().x, this.focus().z); this.world.addBody(b); b.wakeUp(); this.items.push(it);
    Sound.thud(Math.min(30, Math.hypot(vx, vz))); return b.mass;
  },
  dispose(it) { it.obj.removeFromParent(); it.obj.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); for (const g of it.own || []) g.dispose(); },
  update(dt) {
    if (!this.ready) return;
    const C = Player.car, P = this.pcar, fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
    P.position.set(C.pos.x, C.pos.y - 0.2, C.pos.z); P.quaternion.setFromEuler(C.pitch || 0, C.yaw, 0, 'YXZ');
    const drv = Player.mode === 'drive'; P.velocity.set(drv ? fx * C.speed : 0, 0, drv ? fz * C.speed : 0);
    // wreckage from unloaded squares goes away with them
    for (let i = this.still.length - 1; i >= 0; i--) { const it = this.still[i]; if (Tiles.map.get(it.k.key) !== it.k.T) { this.dispose(it); this.still.splice(i, 1); } }
    while (this.still.length > this.MAX_STILL) { const it = this.still.shift(); if (it.again) for (const o of it.again.obs) o.dead = true; this.dispose(it); }
    const f = this.focus();
    // nearby traffic becomes solid for the loose things (only while something is loose)
    const live = this.items.length > 0;
    for (const c of Traffic.cars) {
      if (c.phys) continue;
      const near = live && Math.abs(c.x - f.x) < 60 && Math.abs(c.z - f.z) < 60;
      if (!near) { if (c.kin) this.dropKin(c); continue; }
      const b = this.kinFor(c); const cy = c.obj.position.y;
      b.position.set(c.x, cy, c.z); b.quaternion.setFromEuler(0, c.yaw, 0);
      b.velocity.set(c.wreck ? 0 : Math.sin(c.yaw) * c.speed, 0, c.wreck ? 0 : Math.cos(c.yaw) * c.speed);
    }
    if (!live) return;
    this.ensureGround(f.x, f.z);
    this.world.step(1 / 60, Math.min(dt, 0.1), 4);
    for (const c of this.queue.splice(0)) if (!c.phys && Traffic.cars.includes(c)) this.dynCar(c, 0, 0);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], b = it.body; if (!b) continue; it.t += dt;
      // keep out of buildings (they aren't in the physics world)
      const cc = collideCircle(b.position.x, b.position.z, it.r * 0.8, b.position.y - 0.3, false);
      if (cc.hit) { b.position.x = cc.x; b.position.z = cc.z; const vn = b.velocity.x * cc.nx + b.velocity.z * cc.nz; if (vn < 0) { b.velocity.x -= vn * cc.nx * 1.3; b.velocity.z -= vn * cc.nz * 1.3; } }
      // runaway guard
      const v = b.velocity.length(); if (v > 40) b.velocity.scale(40 / v, b.velocity);
      if (b.position.y < surfaceY(b.position.x, b.position.z) - 3) b.position.y = surfaceY(b.position.x, b.position.z) + 1;
      const sp = b.velocity.length(), av = b.angularVelocity.length();
      it.rest = sp < 0.35 && av < 0.4 ? it.rest + dt : 0;
      if (it.car) {
        const c = it.car; c.x = b.position.x; c.z = b.position.z;
        c.obj.position.set(b.position.x, b.position.y - 0.55, b.position.z); c.obj.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        const fw = new THREE.Vector3(0, 0, 1).applyQuaternion(c.obj.quaternion); c.yaw = Math.atan2(fw.x, fw.z);
        if (sp > 6) { const m = this.knockAt(c.x, c.z, 1.3, b.velocity.x, b.velocity.z); if (m) b.velocity.scale(1 - Math.min(0.4, m / 3000), b.velocity); }
        if (it.rest > 1.2 || it.t > 15 || !this.inGround(c.x, c.z)) this.settle(it);
      } else {
        it.obj.position.set(b.position.x, b.position.y, b.position.z); it.obj.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        if (it.k.kind === 'car' && sp > 6) { const m = this.knockAt(b.position.x, b.position.z, 1.3, b.velocity.x, b.velocity.z); if (m) b.velocity.scale(1 - Math.min(0.4, m / 3000), b.velocity); }
        if (it.rest > 1.5 || it.t > 12 || b.sleepState === CANNON.Body.SLEEPING || !this.inGround(b.position.x, b.position.z) || Tiles.map.get(it.k.key) !== it.k.T) this.settle(it);
      }
    }
  },
  clear() { // teleport: drop everything
    for (const it of [...this.items]) { if (it.car) { this.settle(it); } else { this.world.removeBody(it.body); this.dispose(it); } }
    for (const it of this.still) if (it.again) for (const o of it.again.obs) o.dead = true;
    this.items.length = 0; for (const it of this.still) this.dispose(it); this.still.length = 0;
    for (const c of Traffic.cars) if (c.kin) this.dropKin(c);
  },
};
