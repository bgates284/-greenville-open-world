// =====================================================================
// SMOKE-SHOP REGULARS — a few laid-back characters hang out in front of every smoke, vape,
// hookah and head shop: chatting in a loose circle, leaning on the wall, sitting on the curb,
// kicking a hacky sack, and blowing big vape clouds now and then.
// Looks come from stonerLook() in 03c_people.js; the shops from SMOKE_SHOPS in 03h_retail.js.
// =====================================================================
const Hangouts = {
  sets: new Map(), rnd: mulberry32(4207), puffs: [],
  update(dt, focus) {
    const near = [];
    for (const f of Food.list) { if (!f.look || !f.look.smoke) continue; const d = Math.hypot(f.x - focus.x, f.z - focus.z); if (d < 230) near.push([d, f]); }
    near.sort((a, b) => a[0] - b[0]); const want = new Set(near.slice(0, 4).map(n => n[1]));
    for (const [f, set] of this.sets) if (!want.has(f) && Math.hypot(f.x - focus.x, f.z - focus.z) > 270) { this.drop(set); this.sets.delete(f); }
    for (const f of want) if (!this.sets.has(f) && Tiles.readyAround(f.x, f.z, 0)) { const s = this.cast(f); if (s) this.sets.set(f, s); }
    for (const set of this.sets.values()) for (const a of set.actors) this.step(a, dt, set);
    this.stepPuffs(dt);
  },
  clear() { for (const s of this.sets.values()) this.drop(s); this.sets.clear(); for (const p of this.puffs) { p.s.removeFromParent(); p.s.material.dispose(); } this.puffs = []; },
  drop(set) { for (const a of set.actors) disposePerson(a.person); for (const p of set.props) p.removeFromParent(); },

  // ---------- where they stand ----------
  spot(f) {
    // the shop's building: the one it sits in, or the one built for it nearby (it carries the shop's name)
    let b = insideBuilding(f.x, f.z);
    if (!b) { let bd = 60; for (const it of World.bldHash.query(f.x - 60, f.z - 60, f.x + 60, f.z + 60)) { if (it.name !== f.name) continue; const d = Math.hypot(it.cx - f.x, it.cz - f.z); if (d < bd) { bd = d; b = it; } } }
    const cands = [];
    if (f._front) { const F = f._front; for (const o of [0, -3, 3, -6, 6]) { const tx = -F.nz, tz = F.nx; cands.push([Math.abs(o), [F.x + tx * o + F.nx * 0.3, F.z + tz * o + F.nz * 0.3], F.nx, F.nz]); } }
    if (b) { // walls of that building, nearest to the shop first (that's where its storefront and sign are)
      const ring = b.ring, sa = signedArea(ring); const w = [];
      for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 3) continue; const sd = segDist(f.x, f.z, p[0], p[1], q[0], q[1]); let nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } const t = clamp(sd.t, 1.5 / L, 1 - 1.5 / L); w.push([sd.d, [p[0] + (q[0] - p[0]) * t + nx * 0.3, p[1] + (q[1] - p[1]) * t + nz * 0.3], nx, nz]); }
      w.sort((a, c) => a[0] - c[0]); cands.push(...w.slice(0, 4));
    } if (!cands.length) { const r = nearestRoad(f.x, f.z, 120, q => q.car); if (r && r.d > 1) { const dx = (r.x - f.x) / r.d, dz = (r.z - f.z) / r.d; cands.push([0, [f.x, f.z], dx, dz]); } }
    for (const [, wall, dx, dz] of cands) {
      if (insideBuilding(wall[0], wall[1])) continue;
      let room = 0; for (let s = 0.5; s <= 8; s += 0.5) { const x = wall[0] + dx * s, z = wall[1] + dz * s; if (insideBuilding(x, z) || onRoadSurface(x, z)) break; room = s; }
      if (room < 2) continue;
      const out = Math.min(3.2, room * 0.55); return { c: [wall[0] + dx * out, wall[1] + dz * out], wall, dx, dz, tx: -dz, tz: dx };
    }
    return null;
  },
  cast(f) {
    const S = this.spot(f); if (!S) return { actors: [], props: [] };
    let h = 0; for (const ch of f.name) h = (h * 31 + ch.charCodeAt(0)) | 0; const r = mulberry32(h);
    const actors = [], props = []; const faceRoad = Math.atan2(S.dx, S.dz);
    const person = () => { const p = makePerson(Math.floor(r() * 1e6), stonerLook(r)); dynRoot.add(p.g); return p; };
    const free = (x, z) => !insideBuilding(x, z) && !onRoadSurface(x, z);
    const add = (kind, x, z, yaw, extra) => { if (!free(x, z)) return null; const a = Object.assign({ kind, x, z, yaw, person: person(), t: r() * 10, puffT: 2 + r() * 8, gest: r() * 4 }, extra || {}); actors.push(a); return a; };
    // a loose circle of two or three
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + r() * 0.5; const x = S.c[0] + Math.sin(a) * 1.0, z = S.c[1] + Math.cos(a) * 1.0; add('chill', x, z, Math.atan2(S.c[0] - x, S.c[1] - z)); }
    // someone leaning on the shop wall, facing the street
    if (r() < 0.8) { const s = (r() < 0.5 ? -1 : 1) * (2 + r() * 2); add('lean', S.wall[0] + S.tx * s + S.dx * 0.32, S.wall[1] + S.tz * s + S.dz * 0.32, faceRoad); }
    // someone sitting on the curb
    if (r() < 0.6) { const s = (r() < 0.5 ? -1 : 1) * (3 + r() * 2); const x = S.c[0] + S.tx * s + S.dx * 0.8, z = S.c[1] + S.tz * s + S.dz * 0.8; add('sit', x, z, faceRoad + (r() - 0.5) * 0.6); }
    // two kicking a hacky sack
    if (r() < 0.55) {
      const s = (r() < 0.5 ? -1 : 1) * 5.5; const mx = S.c[0] + S.tx * s, mz = S.c[1] + S.tz * s;
      const A = add('sack', mx - S.tx * 0.9, mz - S.tz * 0.9, Math.atan2(S.tx, S.tz)), B = A && add('sack', mx + S.tx * 0.9, mz + S.tz * 0.9, Math.atan2(-S.tx, -S.tz));
      if (A && B) { const ball = new THREE.Mesh(this.ballGeo || (this.ballGeo = new THREE.IcosahedronGeometry(0.035, 1)), MAT.sack || (MAT.sack = new THREE.MeshStandardMaterial({ color: 0xd9722b, roughness: 0.95 }))); ball.castShadow = true; dynRoot.add(ball); props.push(ball); const game = { ball, A, B, t: 0, from: A, dur: 0.9 }; A.game = game; B.game = game; A.kicker = true; }
      else if (A) A.kind = 'chill';
    }
    return { actors, props };
  },

  // ---------- per frame ----------
  step(a, dt, set) {
    const P = a.person; a.t += dt;
    const y = groundY(a.x, a.z, H(a.x, a.z) + 1);
    if (Player.mode === 'walk' && a.kind !== 'sit') { const dx = a.x - Player.pos.x, dz = a.z - Player.pos.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-3) { a.x = Player.pos.x + dx / d * 0.7; a.z = Player.pos.z + dz / d * 0.7; } }
    P.g.position.set(a.x, y, a.z); P.g.rotation.set(0, a.yaw, 0); animatePerson(P, 0, dt);
    const B = P.B; if (!B) return;
    // slow, easy body sway and head bob for everyone
    const sw = Math.sin(a.t * 0.9); B.hips.rotation.z = sw * 0.035; B.spine.rotation.z = -sw * 0.02; B.head.rotation.x = 0.04 + Math.max(0, Math.sin(a.t * 2.1)) * 0.05;
    if (a.kind === 'lean') { // back against the wall, one foot up on it, arms folded
      P.g.rotation.set(-0.11, a.yaw, 0, 'YXZ'); B.uLegL.rotation.set(-0.55, 0, 0.05); B.lLegL.rotation.x = 1.25; B.footL.rotation.x = -0.2;
      B.uArmL.rotation.set(-0.35, 0, 0.35); B.uArmR.rotation.set(-0.35, 0, -0.35); B.lArmL.rotation.set(-1.55, 0.5, 0); B.lArmR.rotation.set(-1.55, -0.5, 0);
    }
    if (a.kind === 'sit') { // on the curb, knees up, elbows on knees
      B.hips.position.y = 0.2; B.spine.rotation.x = 0.28; B.uLegL.rotation.set(-1.25, 0, 0.12); B.uLegR.rotation.set(-1.25, 0, -0.12); B.lLegL.rotation.x = B.lLegR.rotation.x = 2.05; B.footL.rotation.x = B.footR.rotation.x = -0.5;
      B.uArmL.rotation.set(-0.7, 0, 0.1); B.uArmR.rotation.set(-0.7, 0, -0.1); B.lArmL.rotation.x = B.lArmR.rotation.x = -0.9;
    }
    if (a.kind === 'chill') { // chatting: a gesture now and then
      a.gest -= dt; if (a.gest < 0) { a.gest = 3 + this.rnd() * 6; a.gT = 1.4; }
      if (a.gT > 0) { a.gT -= dt; const k = Math.sin((1.4 - a.gT) / 1.4 * Math.PI); B.uArmL.rotation.x = -0.45 * k; B.lArmL.rotation.x = -1.0 * k - 0.12; }
    }
    if (a.kind === 'sack' && a.game) this.sack(a, B, dt);
    // a slow drag on the vape, then a cloud
    if (a.kind !== 'sack') {
      a.puffT -= dt;
      if (a.puffT < 1.3 && a.puffT > 0) { const k = Math.sin(Math.min(1, (1.3 - a.puffT) / 0.5) * Math.PI / 2); B.uArmR.rotation.set(-0.3 * k - (a.kind === 'sit' ? 0.7 : 0), 0, -0.55 * k); B.lArmR.rotation.set(-2.15 * k - 0.12, 0, 0); }
      if (a.puffT <= 0) { a.puffT = 6 + this.rnd() * 10; const hy = a.kind === 'sit' ? 1.0 : a.kind === 'lean' ? 1.58 : 1.6; this.cloud(a.x + Math.sin(a.yaw) * 0.18, y + hy * (P.look ? P.look.scale : 1), a.z + Math.cos(a.yaw) * 0.18, Math.sin(a.yaw), Math.cos(a.yaw)); }
    }
  },
  sack(a, B, dt) {
    const G = a.game; if (a !== G.A) { this.kickPose(a, B, G); return; } // one of the pair runs the ball
    G.t += dt; if (G.t > G.dur) { G.t = 0; G.from = G.from === G.A ? G.B : G.A; G.dur = 0.8 + this.rnd() * 0.4; }
    const fr = G.from, to = G.from === G.A ? G.B : G.A; const k = G.t / G.dur;
    const fx = fr.x + Math.sin(fr.yaw) * 0.35, fz = fr.z + Math.cos(fr.yaw) * 0.35, tx = to.x + Math.sin(to.yaw) * 0.35, tz = to.z + Math.cos(to.yaw) * 0.35;
    const gy = groundY(fx, fz, H(fx, fz) + 1); G.ball.position.set(fx + (tx - fx) * k, gy + 0.45 + Math.sin(k * Math.PI) * 1.1, fz + (tz - fz) * k); G.ball.rotation.x += dt * 9;
    this.kickPose(a, B, G);
  },
  kickPose(a, B, G) { // knee comes up just as the ball arrives
    const arriving = (G.from !== a) && G.t > G.dur * 0.75, leaving = G.from === a && G.t < G.dur * 0.2;
    const k = arriving ? (G.t - G.dur * 0.75) / (G.dur * 0.25) : leaving ? 1 - G.t / (G.dur * 0.2) : 0;
    B.uLegR.rotation.set(-1.0 * k, 0, 0.45 * k); B.lLegR.rotation.x = 1.3 * k; B.footR.rotation.x = 0; B.uArmL.rotation.set(0, 0, 0.3 + 0.3 * k); B.uArmR.rotation.set(0, 0, -0.3 - 0.3 * k); B.spine.rotation.x = 0.15;
  },

  // ---------- vape clouds ----------
  cloud(x, y, z, fx, fz) {
    if (this.puffs.length > 60) return;
    if (!this.puffTex) { const c = cnv(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(240,240,245,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.puffTex = new THREE.CanvasTexture(c); }
    for (let k = 0; k < 7; k++) {
      const m = new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0.6, color: 0xf4f4f8 }); const s = new THREE.Sprite(m);
      s.position.set(x, y, z); s.scale.setScalar(0.12); dynRoot.add(s);
      const sp = 0.5 + this.rnd() * 0.6; this.puffs.push({ s, t: -k * 0.07, life: 3.2 + this.rnd() * 1.5, vx: fx * sp + (this.rnd() - 0.5) * 0.25, vy: 0.12 + this.rnd() * 0.2, vz: fz * sp + (this.rnd() - 0.5) * 0.25, g: 0.9 + this.rnd() * 0.6 });
    }
  },
  stepPuffs(dt) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]; p.t += dt; if (p.t < 0) continue; const k = p.t / p.life;
      if (k >= 1) { p.s.removeFromParent(); p.s.material.dispose(); this.puffs.splice(i, 1); continue; }
      const drag = Math.exp(-p.t * 1.4); p.s.position.x += p.vx * drag * dt; p.s.position.z += p.vz * drag * dt; p.s.position.y += p.vy * dt;
      p.s.scale.setScalar(0.15 + p.g * Math.sqrt(k) * 1.3); p.s.material.opacity = 0.55 * (1 - k) * Math.min(1, p.t * 6);
    }
  },
};
