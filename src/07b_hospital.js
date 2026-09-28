// =====================================================================
// HOSPITAL LIFE — doctors, nurses and patients around ECU Health Medical Center
//   The main hospital building (04f_landmarks.js) records its entrance in World.hospitalSpots.
//   When you come near, a small cast is placed there:
//     • a nurse pushing a patient in a wheelchair along the entrance drive
//     • a patient in a gown and grip socks shuffling along with an IV pole
//     • a doctor in a white coat walking between wings, another on a break
//     • nurses and a doctor talking outside the Emergency entrance
//     • a patient waiting in a wheelchair with a visitor
//   Ordinary pedestrians near the hospital are also dressed as staff, patients and visitors
//   (hospitalLook in 03c_people.js).
// =====================================================================
const HospitalLife = {
  sets: new Map(), // spot key → { actors: [] }
  rnd: mulberry32(4242),
  update(dt, focus) {
    // start/stop casts as you come and go
    const live = new Set();
    for (const [tile, spots] of World.hospitalSpots) for (const s of spots) {
      if (s.type !== 'door') continue; const key = tile + ':' + s.x.toFixed(1) + ':' + s.z.toFixed(1); live.add(key);
      const d = Math.hypot(s.x - focus.x, s.z - focus.z);
      if (d < 230 && !this.sets.has(key)) this.sets.set(key, this.cast(s, spots));
      else if (d > 290 && this.sets.has(key)) { this.drop(this.sets.get(key)); this.sets.delete(key); }
    }
    for (const [key, set] of this.sets) if (!live.has(key)) { this.drop(set); this.sets.delete(key); }
    for (const set of this.sets.values()) for (const a of set.actors) this.step(a, dt);
  },
  clear() { for (const set of this.sets.values()) this.drop(set); this.sets.clear(); },
  drop(set) { for (const a of set.actors) { disposePerson(a.person); if (a.rider) disposePerson(a.rider); for (const p of a.props || []) p.removeFromParent(); } },

  // ---------- who is where ----------
  cast(s, spots) {
    const r = mulberry32(Math.round(s.x * 7 + s.z * 13)); const actors = [];
    const nx = Math.sin(s.yaw), nz = Math.cos(s.yaw); const tx = s.tx, tz = s.tz;
    const at = (t, n) => [s.x + tx * t + nx * n, s.z + tz * t + nz * n];
    const add = a => { if (a) actors.push(a); };
    // wheelchair pushed along the drive, in front of the doors
    add(this.walker('push', r, this.path(at(-26, 0.2), at(2, 0.2)), 0.85));
    // patient walking with an IV pole
    add(this.walker('iv', r, this.path(at(8, 1.4), at(22, 1.4)), 0.32));
    // doctors walking between entrances
    add(this.walker('doctor', r, this.path(at(12, 10), at(34, 10)), 1.35));
    add(this.walker('nurse', r, this.path(at(-34, 11), at(-14, 11)), 1.2));
    // staff huddle outside the Emergency entrance
    const er = spots.find(q => q.type === 'er');
    const hc = er ? [er.x - tx * 10, er.z - tz * 10] : at(-10, 14);
    const roles = ['doctor', 'nurse', 'nurse'];
    roles.forEach((role, k) => { const a = k / roles.length * Math.PI * 2 + 0.4; add(this.stander(role, r, hc[0] + Math.sin(a) * 1.05, hc[1] + Math.cos(a) * 1.05, hc)); });
    // patient waiting in a wheelchair with a visitor
    const w = at(5.5, -0.6); add(this.chair(r, w[0], w[1], s.yaw));
    const v = at(6.6, 0.1); add(this.stander('visitor', r, v[0], v[1], w));
    // a doctor on the phone by the doors
    const ph = at(-4, -0.4); const doc = this.stander('doctor', r, ph[0], ph[1], null); if (doc) { doc.phone = true; doc.yaw = s.yaw; add(doc); }
    return { actors };
  },
  // open path between two points (trimmed where it would enter a building)
  path(a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return null;
    const ok = (f) => { const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; return !insideBuilding(x, z) && !onRoadSurface(x, z); };
    let f0 = 0, f1 = 1; const n = Math.ceil(L);
    // find the longest free run
    let best = [0, 0], cur = -1;
    for (let i = 0; i <= n; i++) { const f = i / n; if (ok(f)) { if (cur < 0) cur = f; if (f - cur > best[1] - best[0]) best = [cur, f]; } else cur = -1; }
    [f0, f1] = best; if ((f1 - f0) * L < 5) return null;
    return [[a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1]];
  },
  person(role, r) {
    const seed = Math.floor(r() * 1e6);
    // staff use the realistic medical models when the people pack has them
    if ((role === 'doctor' || role === 'nurse') && typeof RB !== 'undefined' && r() < 0.5) {
      const g = role === 'nurse' ? (r() < 0.8 ? 'f' : 'm') : (r() < 0.5 ? 'f' : 'm');
      const has = RB.loaded.some(k => NPCKit.tpl[k] && NPCKit.tpl[k].role === 'medical' && NPCKit.tpl[k].gender === g);
      if (has) { let u = r(), eth = 'W'; for (const [k, w] of DEMO) { if (u < w) { eth = k; break; } u -= w; } const n = RB.spawn(seed, g, 'medical', eth, r); if (n) { dynRoot.add(n.g); return n; } }
    }
    const p = makePerson(seed, hospitalLook(r, role)); dynRoot.add(p.g); return p;
  },
  walker(kind, r, path, speed) {
    if (!path) return null;
    const role = kind === 'push' ? 'nurse' : kind === 'iv' ? 'patient' : kind;
    const a = { kind, path, s: r(), dir: r() < 0.5 ? 1 : -1, speed: speed * (0.9 + r() * 0.2), pause: 0, props: [], x: 0, z: 0, yaw: 0 };
    a.person = kind === 'push' ? this.personProc('nurse', r) : this.person(role, r);
    if (kind === 'push') { const pat = this.personProc('patient', r); const ch = makeWheelchair(); dynRoot.add(ch); a.rider = pat; a.props.push(ch); a.chair = ch; a.riderPerson = pat; }
    if (kind === 'iv') { const pole = makeIVPole(); dynRoot.add(pole); a.props.push(pole); a.pole = pole; }
    return a;
  },
  personProc(role, r) { const p = makePerson(Math.floor(r() * 1e6), hospitalLook(r, role)); dynRoot.add(p.g); return p; },
  stander(role, r, x, z, face) {
    const a = { kind: 'stand', x, z, yaw: face ? Math.atan2(face[0] - x, face[1] - z) : 0, props: [], gest: r() * 4, gT: 0 };
    if (insideBuilding(x, z)) return null;
    a.person = this.person(role, r); return a;
  },
  chair(r, x, z, yaw) {
    if (insideBuilding(x, z)) return null;
    const a = { kind: 'chair', x, z, yaw, props: [] }; a.person = this.personProc('patient', r);
    const ch = makeWheelchair(); dynRoot.add(ch); a.props.push(ch); a.chair = ch; return a;
  },

  // ---------- per frame ----------
  step(a, dt) {
    const P = a.person; if (!P) return;
    if (a.kind === 'stand' || a.kind === 'chair') {
      if (Player.mode === 'walk') { const dx = a.x - Player.pos.x, dz = a.z - Player.pos.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-3 && a.kind === 'stand') { a.x = Player.pos.x + dx / d * 0.7; a.z = Player.pos.z + dz / d * 0.7; } }
      const y = groundY(a.x, a.z, H(a.x, a.z) + 1);
      if (a.kind === 'chair') { this.placeChair(a.chair, P, a.x, a.z, y, a.yaw); return; }
      P.g.position.set(a.x, y, a.z); P.g.rotation.set(0, a.yaw, 0); animatePerson(P, 0, dt); npcLook(P, a.yaw, a.x, a.z, dt);
      if (a.phone && P.B) { P.B.uArmR.rotation.set(-0.35, 0, -0.55); P.B.lArmR.rotation.x = -2.1; P.B.head.rotation.z = -0.12; return; }
      a.gest -= dt; if (a.gest < 0) { a.gest = 2.5 + this.rnd() * 5; a.gT = 1.3; }
      if (a.gT > 0) { a.gT -= dt; if (P.npc) { if (!a.spoke) { a.spoke = true; P.npc.talk = 1.5 + this.rnd() * 2; if (this.rnd() < 0.4) P.npc.nod('agree'); } } else if (P.B) { const k = Math.sin((1.3 - a.gT) / 1.3 * Math.PI); P.B.uArmR.rotation.x = -0.5 * k; P.B.lArmR.rotation.x = -1.1 * k - 0.12; } } else a.spoke = false;
      return;
    }
    // walkers go back and forth along their path, stopping now and then
    const [p0, p1] = a.path; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    let v = 0;
    if (a.pause > 0) a.pause -= dt;
    else {
      v = a.speed; a.s += a.dir * v * dt / L;
      if (a.s > 1 || a.s < 0) { a.s = clamp(a.s, 0, 1); a.dir = -a.dir; a.pause = 1.5 + this.rnd() * 3; }
      else if (this.rnd() < dt * 0.02) a.pause = 2 + this.rnd() * 3;
    }
    let x = p0[0] + (p1[0] - p0[0]) * a.s, z = p0[1] + (p1[1] - p0[1]) * a.s;
    // step aside for the walking player
    if (Player.mode === 'walk') { const dx = x - Player.pos.x, dz = z - Player.pos.z, d = Math.hypot(dx, dz); if (d < 1.2) { v = 0; if (a.pause <= 0) a.pause = 0.6; } }
    a.x = x; a.z = z;
    const want = Math.atan2((p1[0] - p0[0]) * a.dir, (p1[1] - p0[1]) * a.dir); a.yaw += angleDiff(a.yaw, want) * Math.min(1, dt * 5);
    const y = groundY(x, z, H(x, z) + 1); const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    P.g.position.set(x, y, z); P.g.rotation.set(0, a.yaw, 0); animatePerson(P, v, dt);
    if (a.kind === 'push') {
      // chair rolls ahead of the nurse; arms forward on the handles, patient seated
      const cx = x + fx * 0.88, cz = z + fz * 0.88; this.placeChair(a.chair, a.rider, cx, cz, groundY(cx, cz, H(cx, cz) + 1), a.yaw, v, dt);
      if (P.B) { P.B.uArmL.rotation.set(-0.95, 0, 0.12); P.B.uArmR.rotation.set(-0.95, 0, -0.12); P.B.lArmL.rotation.x = P.B.lArmR.rotation.x = -0.55; P.B.spine.rotation.x = 0.12; }
    } else if (a.kind === 'iv') {
      // slow shuffle, one hand on the pole
      const sx = -Math.cos(a.yaw) * 0.32, sz = Math.sin(a.yaw) * 0.32; // pole on the right-hand side
      const px = x + sx + fx * 0.28, pz = z + sz + fz * 0.28; a.pole.position.set(px, groundY(px, pz, H(px, pz) + 1), pz); a.pole.rotation.y = a.yaw;
      if (P.B) { P.B.uArmR.rotation.set(-0.45, 0, -0.3); P.B.lArmR.rotation.x = -0.9; P.B.spine.rotation.x = 0.1; P.B.head.rotation.x = 0.12; }
    } else npcLook(P, a.yaw, x, z, dt);
  },
  placeChair(ch, rider, x, z, y, yaw, v = 0, dt = 0) {
    ch.position.set(x, y, z); ch.rotation.y = yaw;
    if (v && ch.userData.wheels) for (const w of ch.userData.wheels) w.rotation.x += v * dt / 0.3;
    const g = rider.g; g.position.set(x - Math.sin(yaw) * 0.05, y, z - Math.cos(yaw) * 0.05); g.rotation.set(0, yaw, 0);
    animatePerson(rider, 0, dt || 0.016); seatPose(rider);
  },
};

// seated pose for the simple people (thighs level on the seat, feet on the footrests, hands on the armrests)
function seatPose(p) {
  const B = p.B; if (!B) return;
  B.hips.position.y = 0.6; B.hips.rotation.set(0, 0, 0); B.spine.rotation.x = -0.08;
  B.uLegL.rotation.set(-1.5, 0, 0.04); B.uLegR.rotation.set(-1.5, 0, -0.04); B.lLegL.rotation.x = B.lLegR.rotation.x = 1.35; B.footL.rotation.x = B.footR.rotation.x = 0.1;
  B.uArmL.rotation.set(-0.35, 0, 0.22); B.uArmR.rotation.set(-0.35, 0, -0.22); B.lArmL.rotation.x = B.lArmR.rotation.x = -1.1;
}

// ---------- props ----------
let _wcParts = null;
function makeWheelchair() {
  if (!_wcParts) {
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 }), black = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.8 }), seat = new THREE.MeshStandardMaterial({ color: 0x23355e, roughness: 0.85 });
    const wheel = new THREE.TorusGeometry(0.3, 0.022, 8, 28); wheel.rotateY(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.27, 0.008, 5, 24); rim.rotateY(Math.PI / 2);
    const caster = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12); caster.rotateZ(Math.PI / 2);
    const tube = (L) => new THREE.CylinderGeometry(0.012, 0.012, L, 6);
    _wcParts = { metal, black, seat, wheel, rim, caster, tube, box: new THREE.BoxGeometry(1, 1, 1), tubes: {} };
    for (const g of [wheel, rim, caster, _wcParts.box]) g.userData.shared = true;
  }
  const W = _wcParts; const g = new THREE.Group(); const wheels = [];
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(W.box, m); b.scale.set(w, h, d); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  const bar = (L, x, y, z, rx, rz) => { const t = W.tubes[L] || (W.tubes[L] = W.tube(L)); t.userData.shared = true; const m = new THREE.Mesh(t, W.metal); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); g.add(m); };
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.3, 0.3, -0.08); const t = new THREE.Mesh(W.wheel, W.black); t.castShadow = true; w.add(t); w.add(new THREE.Mesh(W.rim, W.metal)); g.add(w); wheels.push(w);
    const c = new THREE.Mesh(W.caster, W.black); c.position.set(s * 0.22, 0.07, 0.34); g.add(c);
    bar(0.42, s * 0.23, 0.29, 0.34);             // front upright
    bar(0.86, s * 0.23, 0.72, -0.24, -0.12);     // back upright → push handle
    bar(0.52, s * 0.23, 0.48, 0.05, Math.PI / 2); // seat rail
    bar(0.4, s * 0.25, 0.66, 0.02, Math.PI / 2);  // armrest
    box(0.06, 0.04, 0.3, s * 0.25, 0.68, 0.02, W.black);
    box(0.13, 0.015, 0.1, s * 0.1, 0.1, 0.44, W.black); // footrest
    box(0.05, 0.05, 0.12, s * 0.23, 1.14, -0.33, W.black); // handle grip
  }
  box(0.46, 0.05, 0.42, 0, 0.49, 0.04, W.seat);  // seat
  box(0.46, 0.44, 0.03, 0, 0.77, -0.19, W.seat); // backrest
  g.rotation.order = 'YXZ'; g.userData.wheels = wheels; return g;
}
let _ivParts = null;
function makeIVPole() {
  if (!_ivParts) {
    const metal = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 0.75, roughness: 0.3 });
    const bag = new THREE.MeshStandardMaterial({ color: 0xe6f1f6, roughness: 0.2, transparent: true, opacity: 0.75 });
    _ivParts = { metal, bag, pole: new THREE.CylinderGeometry(0.012, 0.012, 2.0, 6), leg: new THREE.CylinderGeometry(0.01, 0.01, 0.34, 5), bagG: new THREE.BoxGeometry(0.12, 0.2, 0.04), line: new THREE.CylinderGeometry(0.003, 0.003, 1.1, 4), wheel: new THREE.SphereGeometry(0.025, 6, 4) };
    for (const k in _ivParts) if (_ivParts[k].isBufferGeometry) _ivParts[k].userData.shared = true;
  }
  const P = _ivParts; const g = new THREE.Group();
  const pole = new THREE.Mesh(P.pole, P.metal); pole.position.y = 1.02; g.add(pole);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const l = new THREE.Mesh(P.leg, P.metal); l.rotation.set(0, a, Math.PI / 2 - 0.12); l.position.set(Math.cos(a) * 0.16, 0.06, -Math.sin(a) * 0.16); l.rotation.order = 'YZX'; g.add(l); const w = new THREE.Mesh(P.wheel, P.metal); w.position.set(Math.cos(a) * 0.32, 0.025, -Math.sin(a) * 0.32); g.add(w); }
  const hook = new THREE.Mesh(P.leg, P.metal); hook.rotation.z = Math.PI / 2; hook.position.y = 1.98; g.add(hook);
  const b = new THREE.Mesh(P.bagG, P.bag); b.position.set(0.12, 1.84, 0); g.add(b);
  const ln = new THREE.Mesh(P.line, P.metal); ln.position.set(0.12, 1.2, 0.05); ln.rotation.x = 0.25; g.add(ln);
  return g;
}
