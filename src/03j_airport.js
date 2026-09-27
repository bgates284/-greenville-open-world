
// =====================================================================
// PITT-GREENVILLE AIRPORT (KPGV) — runways from the FAA runway-end coordinates:
//   2/20: 7,175 × 150 ft, 02 end 35°37.552'N 77°23.148'W, 20 end 35°38.724'N 77°22.957'W
//   8/26: 4,997 × 150 ft, 08 end 35°37.984'N 77°23.497'W, 26 end 35°38.309'N 77°22.570'W
// plus a GA apron + hangar west of runway 2/20 where your plane is parked.
// =====================================================================
const Airport = {
  built: false, building: false, group: null,
  RWY: [
    { a: [35.625867, -77.385801], b: [35.645406, -77.382620], w: 45.7, nums: ['02', '20'], main: true },
    { a: [35.633067, -77.391620], b: [35.638490, -77.376172], w: 45.7, nums: ['08', '26'] },
  ],
  init() {
    if (this.rects) return;
    this.rects = []; this.clear = [];
    for (const R of this.RWY) {
      const A = [lonToX(R.a[1]), latToZ(R.a[0])], B = [lonToX(R.b[1]), latToZ(R.b[0])];
      const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz); const ux = dx / L, uz = dz / L;
      Object.assign(R, { A, B, L, ux, uz, rx: -uz, rz: ux });
      this.rects.push({ cx: (A[0] + B[0]) / 2, cz: (A[1] + B[1]) / 2, ux, uz, hl: L / 2 + 2, hw: R.w / 2, kind: 'rwy' });
      this.clear.push({ cx: (A[0] + B[0]) / 2, cz: (A[1] + B[1]) / 2, ux, uz, hl: L / 2 + 180, hw: 75 });
    }
    // GA apron west of runway 2/20, 600 m from the 02 end, with a taxiway to the runway
    const M = this.RWY[0]; const at = 600, off = -135;
    const ac = [M.A[0] + M.ux * at + M.rx * off, M.A[1] + M.uz * at + M.rz * off];
    this.apron = { cx: ac[0], cz: ac[1], ux: M.ux, uz: M.uz, hl: 42, hw: 32, kind: 'apron' };
    const t0 = off + 32, t1 = -M.w / 2; const tc = (t0 + t1) / 2;
    this.taxi = { cx: M.A[0] + M.ux * at + M.rx * tc, cz: M.A[1] + M.uz * at + M.rz * tc, ux: M.rx, uz: M.rz, hl: (t1 - t0) / 2 + 1, hw: 7.5, kind: 'taxi' };
    this.rects.push(this.apron, this.taxi);
    this.clear.push({ ...this.apron, hl: 70, hw: 60 });
    // parking spot: apron centre, nose toward the taxiway (east, toward the runway)
    this.stand = { x: ac[0] - M.ux * 8, z: ac[1] - M.uz * 8, yaw: Math.atan2(M.rx, M.rz) };
    this.carSpot = { x: ac[0] + M.ux * 22 - M.rx * 18, z: ac[1] + M.uz * 22 - M.rz * 18, yaw: Math.atan2(M.rx, M.rz) };
    this.hangar = { cx: ac[0] + M.ux * 64, cz: ac[1] + M.uz * 64 - 0, ux: M.ux, uz: M.uz };
    this.bb = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
    for (const r of this.clear) for (const s of [-1, 1]) for (const t of [-1, 1]) { const x = r.cx + r.ux * r.hl * s + -r.uz * r.hw * t, z = r.cz + r.uz * r.hl * s + r.ux * r.hw * t; this.bb.x0 = Math.min(this.bb.x0, x); this.bb.x1 = Math.max(this.bb.x1, x); this.bb.z0 = Math.min(this.bb.z0, z); this.bb.z1 = Math.max(this.bb.z1, z); }
  },
  inRect(r, x, z, pad = 0) { const dx = x - r.cx, dz = z - r.cz; const a = dx * r.ux + dz * r.uz, b = dx * -r.uz + dz * r.ux; return Math.abs(a) <= r.hl + pad && Math.abs(b) <= r.hw + pad; },
  corners(r, hl = r.hl, hw = r.hw) { const out = []; for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push([r.cx + r.ux * hl * s - r.uz * hw * t, r.cz + r.uz * hl * s + r.ux * hw * t]); return out; },
  // paved surface height (runways, taxiway, apron), or null
  surf(x, z) {
    if (!this.built) return null; const b = this.bb; if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return null;
    for (const r of this.rects) if (this.inRect(r, x, z)) return H(x, z) + 0.2;
    return null;
  },
  paved(x, z) { this.init(); for (const r of this.rects) if (this.inRect(r, x, z)) return true; return false; },
  // ground texture: mown grass safety areas (no trees), dark pavement underneath the meshes
  paint(g, kg) {
    this.init();
    const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); };
    g.fillStyle = '#6a9143'; kg.fillStyle = '#000';
    for (const r of this.clear) { const c = this.corners(r); poly(g, c); poly(kg, c); }
    g.fillStyle = '#48494c'; for (const r of this.rects) poly(g, this.corners(r));
  },
  async ensure() {
    this.init(); if (this.built || this.building) return; this.building = true;
    try {
      const b = this.bb; await ensureDEM({ w: xToLon(b.x0), e: xToLon(b.x1), n: zToLat(b.z0), s: zToLat(b.z1) }, 5);
      this.build(); this.built = true;
    } catch (e) { console.warn('airport build failed', e); }
    finally { this.building = false; }
  },
  build() {
    const g = this.group = new THREE.Group(); g.name = 'airport';
    const pave = new MB(true), mk = new MB(true), lights = new MB(true);
    const ASPH = new THREE.Color('#3b3c3f'), ASPH2 = new THREE.Color('#4a4a48'), CONC = new THREE.Color('#9d9c96'), WHITE = new THREE.Color('#ecece6'), YEL = new THREE.Color('#e3b021');
    const UP = [0, 1, 0]; const Y = (x, z, k = 0) => H(x, z) + 0.2 + k;
    // a paved rectangle, as a grid that follows the ground
    const slab = (r, col) => {
      const nA = Math.max(1, Math.ceil(r.hl * 2 / 12)), nB = Math.max(1, Math.ceil(r.hw * 2 / 12));
      const P = (i, j) => { const a = -r.hl + 2 * r.hl * i / nA, b = -r.hw + 2 * r.hw * j / nB; const x = r.cx + r.ux * a - r.uz * b, z = r.cz + r.uz * a + r.ux * b; return [x, Y(x, z), z]; };
      for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) { const p = P(i, j), q = P(i + 1, j), s = P(i + 1, j + 1), t = P(i, j + 1); pave.quad(p, q, s, t, [p[0] / 20, p[2] / 20], [q[0] / 20, q[2] / 20], [s[0] / 20, s[2] / 20], [t[0] / 20, t[2] / 20], UP, col); }
      // edge skirt so the slab doesn't float
      for (const [s0, t0, s1, t1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
        const n = Math.max(1, Math.ceil(Math.hypot((s1 - s0) * r.hl, (t1 - t0) * r.hw) / 12));
        for (let k = 0; k < n; k++) {
          const f0 = k / n, f1 = (k + 1) / n; const pt = f => { const a = r.hl * (s0 + (s1 - s0) * f), b = r.hw * (t0 + (t1 - t0) * f); return [r.cx + r.ux * a - r.uz * b, r.cz + r.uz * a + r.ux * b]; };
          const A = pt(f0), B = pt(f1); pave.quad([A[0], Y(A[0], A[1]), A[1]], [B[0], Y(B[0], B[1]), B[1]], [B[0], H(B[0], B[1]) - 0.3, B[1]], [A[0], H(A[0], A[1]) - 0.3, A[1]], [0, 0], [0, 0], [0, 0], [0, 0], null, col);
        }
      }
    };
    // a painted box in a runway's frame: along a0..a1 from end A, across b0..b1 (b toward the right)
    const paint = (R, a0, a1, b0, b1, col, fromB) => {
      const ux = fromB ? -R.ux : R.ux, uz = fromB ? -R.uz : R.uz, O = fromB ? R.B : R.A; const rx = -uz, rz = ux;
      const P = (a, b) => { const x = O[0] + ux * a + rx * b, z = O[1] + uz * a + rz * b; return [x, Y(x, z, 0.02), z]; };
      const n = Math.max(1, Math.ceil((a1 - a0) / 12));
      for (let k = 0; k < n; k++) { const s0 = a0 + (a1 - a0) * k / n, s1 = a0 + (a1 - a0) * (k + 1) / n; mk.quad(P(s0, b0), P(s1, b0), P(s1, b1), P(s0, b1), [0, 0], [0, 0], [0, 0], [0, 0], UP, col); }
    };
    // 7-segment runway numbers, 18 m tall, read by a pilot on approach
    const SEG = { a: [0, 16.2, 9, 18], b: [7.2, 9, 9, 18], c: [7.2, 0, 9, 9], d: [0, 0, 9, 1.8], e: [0, 0, 1.8, 9], f: [0, 9, 1.8, 18], g: [0, 8.1, 9, 9.9] };
    const DIG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const number = (R, txt, fromB, at) => {
      const W = 9, gap = 3, total = txt.length * W + (txt.length - 1) * gap; let x0 = -total / 2;
      for (const ch of txt) { for (const s of DIG[ch]) { const [sx0, sy0, sx1, sy1] = SEG[s]; paint(R, at + sy0, at + sy1, x0 + sx0, x0 + sx1, WHITE, fromB); } x0 += W + gap; }
    };
    for (const R of this.RWY) {
      slab(this.rects[this.RWY.indexOf(R)], R.main ? ASPH : ASPH2);
      const hw = R.w / 2;
      for (const fromB of [false, true]) {
        for (let k = 0; k < 6; k++) for (const s of [-1, 1]) { const c = s * (3.6 + k * 3.3); paint(R, 6, 51, c - 0.9, c + 0.9, WHITE, fromB); } // threshold bars
        number(R, R.nums[fromB ? 1 : 0], fromB, 63);
        if (R.main) { for (const s of [-1, 1]) paint(R, 305, 350, s * 6.5 - 4.5, s * 6.5 + 4.5, WHITE, fromB); } // aiming point
        for (const s of [-1, 1]) for (const d of [150, 450]) paint(R, d, d + 22, s * 8.5 - 1, s * 8.5 + 1, WHITE, fromB); // touchdown zone
      }
      for (let a = 100; a < R.L - 100; a += 60) paint(R, a, Math.min(a + 36, R.L - 100), -0.45, 0.45, WHITE); // centreline
      for (const s of [-1, 1]) paint(R, 0, R.L, s * (hw - 1.4) - 0.45, s * (hw - 1.4) + 0.45, WHITE); // edge stripes
      // edge lights every 60 m, green/red at the ends
      const light = (x, z, col) => { const y = Y(x, z); const s = 0.18; lights.quad([x - s, y + 0.45, z], [x + s, y + 0.45, z], [x + s, y + 0.1, z], [x - s, y + 0.1, z], [0, 0], [0, 0], [0, 0], [0, 0], null, col); lights.quad([x, y + 0.45, z - s], [x, y + 0.45, z + s], [x, y + 0.1, z + s], [x, y + 0.1, z - s], [0, 0], [0, 0], [0, 0], [0, 0], null, col); };
      const LW = new THREE.Color('#fff4d0'), LG = new THREE.Color('#35ff6a'), LR = new THREE.Color('#ff3a2a');
      for (let a = 0; a <= R.L + 0.1; a += R.L / Math.round(R.L / 60)) for (const s of [-1, 1]) { const x = R.A[0] + R.ux * a + R.rx * s * (hw + 1.5), z = R.A[1] + R.uz * a + R.rz * s * (hw + 1.5); light(x, z, a < 1 ? LG : a > R.L - 1 ? LR : LW); }
    }
    slab(this.apron, CONC); slab(this.taxi, ASPH);
    // taxiway centreline + hold-short bars, apron lead-in line and tie-down marks
    { const T = this.taxi; const P = (a, b) => { const x = T.cx + T.ux * a - T.uz * b, z = T.cz + T.uz * a + T.ux * b; return [x, Y(x, z, 0.02), z]; };
      const box = (a0, a1, b0, b1, col) => mk.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), [0, 0], [0, 0], [0, 0], [0, 0], UP, col);
      box(-T.hl, T.hl, -0.2, 0.2, YEL);
      const hs = T.hl - 22; for (const o of [0, 0.5]) box(hs + o, hs + o + 0.25, -T.hw, T.hw, YEL); for (const o of [1.4, 1.9]) for (let b = -T.hw; b < T.hw; b += 1.8) box(hs + o, hs + o + 0.25, b, b + 1.0, YEL);
    }
    { const A = this.apron; const P = (a, b) => { const x = A.cx + A.ux * a - A.uz * b, z = A.cz + A.uz * a + A.ux * b; return [x, Y(x, z, 0.02), z]; };
      const box = (a0, a1, b0, b1, col) => mk.quad(P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1), [0, 0], [0, 0], [0, 0], [0, 0], UP, col);
      box(-8.2, -7.8, -A.hw, A.hw, YEL); // lead-in line to the parking spot
      for (const a of [-30, -8, 14]) for (const s of [-1, 1]) { const b = s * 5.5; box(a - 0.6, a + 0.6, b - 0.06, b + 0.06, YEL); box(a - 0.06, a + 0.06, b - 0.6, b + 0.6, YEL); }
    }
    const pm = new THREE.Mesh(pave.geo(), new THREE.MeshStandardMaterial({ map: TEX.concrete || null, vertexColors: true, roughness: 0.92 }));
    pm.receiveShadow = true; g.add(pm);
    if (!MAT.marking) MAT.marking = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 });
    const mm = new THREE.Mesh(mk.geo(), MAT.marking); mm.receiveShadow = true; g.add(mm);
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
    g.add(new THREE.Mesh(lights.geo(), this.lightMat));
    // hangar (unless the county's map already has a building there)
    { const Hh = this.hangar; const L = 30, W = 26, h = 8.5;
      const free = [[0, 0], [L / 2, W / 2], [-L / 2, W / 2], [L / 2, -W / 2], [-L / 2, -W / 2]].every(([a, b]) => !insideBuilding(Hh.cx + Hh.ux * a - Hh.uz * b, Hh.cz + Hh.uz * a + Hh.ux * b));
      if (free) {
        const hg = new THREE.Group(); const y0 = H(Hh.cx, Hh.cz);
        const wall = new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.6, metalness: 0.35 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(W, h, L), wall); body.position.y = h / 2; hg.add(body);
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 * 1.02, W / 2 * 1.02, L, 24, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.5, metalness: 0.5 }));
        roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.35); roof.position.y = h; hg.add(roof);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.84, h * 0.86), new THREE.MeshStandardMaterial({ color: 0x5b6168, roughness: 0.7, metalness: 0.4 }));
        door.position.set(0, h * 0.43, -L / 2 - 0.02); door.rotation.y = Math.PI; hg.add(door);
        hg.position.set(Hh.cx, y0, Hh.cz); hg.rotation.y = Math.atan2(Hh.ux, Hh.uz);
        hg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(hg);
        const c = this.corners({ cx: Hh.cx, cz: Hh.cz, ux: Hh.ux, uz: Hh.uz, hl: L / 2, hw: W / 2 });
        this._hangarItem = World.bldHash.insert({ ring: c, holes: [], name: 'Hangar', cx: Hh.cx, cz: Hh.cz, h: h + W * 0.18, maxY: y0 + h + W * 0.18, minY: -1e9 }, Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1])));
      }
    }
    // windsock by the 02 end
    { const R = this.RWY[0]; const x = R.A[0] + R.ux * 300 - R.rx * 60, z = R.A[1] + R.uz * 300 - R.rz * 60; const y = H(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.set(x, y + 3, z); g.add(pole);
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 3, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a1a, side: THREE.DoubleSide, roughness: 0.8 }));
      sock.rotation.z = Math.PI / 2 - 0.25; sock.position.set(x - 1.5, y + 5.6, z); this.sock = sock; g.add(sock); }
    scene.add(g);
  },
  tick(dt, focus) {
    this.init();
    if (!this.built && !this.building) { const b = this.bb; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (Math.hypot(focus.x - cx, focus.z - cz) < 4500) this.ensure(); }
    if (this.lightMat) { const on = Env.night > 0.3 || Env.rain > 0.5; this.lightMat.visible = true; this.lightMat.color.setScalar(on ? 1.6 : 0.55); }
  },
};

// ---------------------------------------------------------------------
// A four-seat high-wing trainer (Cessna 172-class), built procedurally.
// Origin on the ground under the centre of gravity; nose toward +z, left wing toward +x.
// ---------------------------------------------------------------------
function buildPlaneModel() {
  const g = new THREE.Group(); const parts = { glass: [] };
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f1, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const purple = new THREE.MeshPhysicalMaterial({ color: 0x4b1f78, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.35, metalness: 0.5 });
  const goldP = new THREE.MeshPhysicalMaterial({ color: 0xffc21a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x2a3f52, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.5, clearcoat: 1, depthWrite: false });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
  const tyre = MAT.tyre || new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  // fuselage loft: [z, half width, bottom y, top y]
  const S = [[2.32, 0.40, 0.98, 1.52], [2.05, 0.47, 0.90, 1.58], [1.60, 0.52, 0.84, 1.63], [1.10, 0.56, 0.80, 1.68], [0.62, 0.58, 0.78, 2.04], [-0.40, 0.58, 0.78, 2.07], [-1.20, 0.52, 0.86, 1.96], [-2.20, 0.36, 1.00, 1.64], [-3.40, 0.21, 1.14, 1.47], [-4.45, 0.09, 1.25, 1.40]];
  const N = 20; const ring = s => { const [z, hw, yb, yt] = s; const ym = (yb + yt) / 2, hh = (yt - yb) / 2; const out = []; for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; const c = Math.cos(t), sn = Math.sin(t); out.push([hw * Math.sign(c) * Math.abs(c) ** 0.55, ym + hh * Math.sign(sn) * Math.abs(sn) ** 0.7, z]); } return out; };
  const pos = []; const R = S.map(ring);
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < N; i++) { const a = R[k][i], b = R[k][(i + 1) % N], c = R[k + 1][(i + 1) % N], d = R[k + 1][i]; pos.push(...a, ...c, ...b, ...a, ...d, ...c); }
  for (const [k, flip] of [[0, false], [R.length - 1, true]]) { const r = R[k]; const cz = r[0][2]; const cy = (S[k][2] + S[k][3]) / 2; for (let i = 0; i < N; i++) { const a = r[i], b = r[(i + 1) % N]; if (flip) pos.push(0, cy, cz, ...a, ...b); else pos.push(0, cy, cz, ...b, ...a); } }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.computeVertexNormals();
  g.add(new THREE.Mesh(fg, white));
  // cheat line: purple band + gold pinstripe along each side
  const band = (y0, y1, mat, z0 = 2.2, z1 = -4.0) => { for (const s of [1, -1]) { const geo = new THREE.BufferGeometry(); const p = []; const n = 14; for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n; const w = z => { let k = 0; while (k < S.length - 2 && S[k + 1][0] > z) k++; const t = (S[k][0] - z) / (S[k][0] - S[k + 1][0]); return (S[k][1] + (S[k + 1][1] - S[k][1]) * t) * 0.985 + 0.012; }; const ya = y => y + (za < -1 ? (-1 - za) * 0.13 : 0), yb2 = y => y + (zb < -1 ? (-1 - zb) * 0.13 : 0); const A = [s * w(za), ya(y0), za], B = [s * w(zb), yb2(y0), zb], C = [s * w(zb), yb2(y1), zb], D = [s * w(za), ya(y1), za]; if (s > 0) p.push(...A, ...C, ...B, ...A, ...D, ...C); else p.push(...A, ...B, ...C, ...A, ...C, ...D); } geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals(); g.add(new THREE.Mesh(geo, mat)); } };
  band(0.97, 1.2, purple); band(1.22, 1.28, goldP);
  // windows
  const quad = (a, b, c, d, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); g.add(m); if (mat === glass) parts.glass.push(m); return m; };
  quad([0.5, 1.69, 1.12], [-0.5, 1.69, 1.12], [-0.53, 2.03, 0.64], [0.53, 2.03, 0.64], glass); quad([0.5, 1.69, 1.12], [0.53, 2.03, 0.64], [-0.53, 2.03, 0.64], [-0.5, 1.69, 1.12], glass);
  for (const s of [1, -1]) {
    const x = s * 0.592; const win = (z0, z1, y0, y1, y1b) => { quad([x, y0, z0], [x, y0, z1], [x, y1b, z1], [x, y1, z0], glass); quad([x, y0, z0], [x, y1, z0], [x, y1b, z1], [x, y0, z1], glass); };
    win(0.55, -0.35, 1.48, 1.96, 1.98); win(-0.45, -1.1, 1.5, 1.96, 1.82);
  }
  // registration number on the tail
  { const c = cnv(512, 96), x = c.getContext('2d'); x.clearRect(0, 0, 512, 96); x.fillStyle = '#4b1f78'; x.font = 'bold 72px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N252GV', 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.25), m); p.position.set(s * 0.31, 1.42, -2.75); p.rotation.y = s * Math.PI / 2; g.add(p); } }
  // wing: airfoil extruded span-wise, slight dihedral, struts, ailerons
  const foil = new THREE.Shape(); { const c = 1.5, t = 0.15; const pts = []; for (let i = 0; i <= 16; i++) { const x = i / 16; pts.push([x, 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)]); }
    pts.forEach(([x, y], i) => i ? foil.lineTo(-0.55 + x * c, y * c * 0.9) : foil.moveTo(-0.55 + x * c, y * c * 0.9)); for (let i = 16; i >= 0; i--) { const x = i / 16; foil.lineTo(-0.55 + x * c, -0.012 * c * Math.sin(x * Math.PI)); } }
  for (const s of [1, -1]) {
    const wgeo = new THREE.ExtrudeGeometry(foil, { depth: 5.45, bevelEnabled: false, steps: 1 }); wgeo.rotateY(Math.PI / 2);
    if (s < 0) wgeo.translate(-5.45, 0, 0);
    const w = new THREE.Mesh(wgeo, purple); w.position.set(s * 0.05, 2.06, 0); w.rotation.z = s * 0.03; g.add(w);
    // gold wingtips (seen easily against the sky)
    { const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 1.56), goldP); tip.position.set(s * 4.97, 2.13 + 0.03 * 4.97, -0.2); tip.rotation.z = s * 0.03; g.add(tip); }
    // wingtip light
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: s > 0 ? 0xff2020 : 0x20ff50 })); nav.position.set(s * 5.5, 2.24, 0.25); g.add(nav);
    const str = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); str.position.set(s * 5.52, 2.24, -0.35); g.add(str); (parts.strobes ||= []).push(str);
    // strut
    const a = new THREE.Vector3(s * 0.56, 1.0, 0.05), b = new THREE.Vector3(s * 2.6, 2.1, 0.05); const L = a.distanceTo(b);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, L, 8), white); st.position.copy(a).lerp(b, 0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); st.scale.set(1.8, 1, 0.7); g.add(st);
    // aileron (hinged on the trailing edge, outboard)
    const ail = new THREE.Group(); ail.position.set(s * 4.25, 2.06 + s * 0.03 * 4.2, -0.62); const am = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.34), goldP); am.position.z = -0.17; ail.add(am); g.add(ail); parts[s > 0 ? 'ailL' : 'ailR'] = ail;
    // flap line (visual)
    const fl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.03, 0.02), dark); fl.position.set(s * 1.9, 2.07, -0.62); g.add(fl);
  }
  // wing centre section over the cabin
  { const cg = new THREE.ExtrudeGeometry(foil, { depth: 0.12, bevelEnabled: false }); cg.rotateY(Math.PI / 2); const c = new THREE.Mesh(cg, purple); c.position.set(-0.06, 2.06, 0); g.add(c); }
  // tail
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.07, 0.62), purple); stab.position.set(0, 1.36, -3.92); g.add(stab);
  const elev = new THREE.Group(); elev.position.set(0, 1.36, -4.23); const em = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.05, 0.42), goldP); em.position.z = -0.21; elev.add(em); g.add(elev); parts.elev = elev;
  const finShape = new THREE.Shape(); finShape.moveTo(-3.0, 1.42); finShape.lineTo(-4.3, 1.42); finShape.lineTo(-4.45, 2.72); finShape.lineTo(-4.05, 2.72); finShape.lineTo(-3.55, 1.72); finShape.lineTo(-3.0, 1.52);
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false }); fin.rotateY(-Math.PI / 2); fin.translate(0.04, 0, 0); g.add(new THREE.Mesh(fin, purple));
  const finStripe = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-4.3, 1.9); s.lineTo(-4.36, 2.3); s.lineTo(-3.75, 2.3); s.lineTo(-3.55, 1.9); return s; })(), { depth: 0.09, bevelEnabled: false }); finStripe.rotateY(-Math.PI / 2); finStripe.translate(0.045, 0, 0); g.add(new THREE.Mesh(finStripe, goldP));
  const rud = new THREE.Group(); rud.position.set(0, 1.42, -4.3); const rm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.28, 0.34), goldP); rm.position.set(0, 0.64, -0.2); rud.add(rm); g.add(rud); parts.rud = rud;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); beacon.position.set(0, 2.76, -4.25); g.add(beacon); parts.beacon = beacon;
  // engine: cowling intake, spinner, 2-blade propeller
  const prop = new THREE.Group(); prop.position.set(0, 1.25, 2.36);
  const spin = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 16), goldP); spin.rotation.x = Math.PI / 2; spin.position.z = 0.18; prop.add(spin);
  for (const s of [1, -1]) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.9, 0.03), dark); bl.position.y = s * 0.47; bl.rotation.y = s * 0.35; prop.add(bl); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.031), new THREE.MeshStandardMaterial({ color: 0xf2c230 })); tip.position.y = s * 0.88; tip.rotation.y = s * 0.35; prop.add(tip); }
  g.add(prop); parts.prop = prop;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); disc.position.set(0, 1.25, 2.4); g.add(disc); parts.disc = disc;
  for (const s of [1, -1]) { const intake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.05), dark); intake.position.set(s * 0.2, 1.0, 2.32); g.add(intake); }
  // landing gear
  const wheel = (x, y, z, r, w) => { const wg = new THREE.Group(); wg.position.set(x, y, z); const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), tyre); t.rotation.z = Math.PI / 2; wg.add(t); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.01, 12), metal); hub.rotation.z = Math.PI / 2; wg.add(hub); g.add(wg); return wg; };
  parts.wheels = [wheel(1.25, 0.3, -0.25, 0.3, 0.15), wheel(-1.25, 0.3, -0.25, 0.3, 0.15), wheel(0, 0.25, 1.78, 0.25, 0.12)];
  for (const s of [1, -1]) {
    const a = new THREE.Vector3(s * 0.5, 0.86, -0.25), b = new THREE.Vector3(s * 1.2, 0.3, -0.25); const L = a.distanceTo(b);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, L, 0.04), white); leg.position.copy(a).lerp(b, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(leg);
    const pant = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), white); pant.scale.set(0.42, 0.95, 1.9); pant.position.set(s * 1.25, 0.36, -0.2); g.add(pant);
  }
  { const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), metal); strut.position.set(0, 0.62, 1.78); g.add(strut); const np = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), white); np.scale.set(0.45, 0.9, 1.6); np.position.set(0, 0.3, 1.8); g.add(np); }
  // cockpit: panel, yoke, seats (seen from the first-person view)
  { const panel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.28, 0.12), dark); panel.position.set(0, 1.32, 1.02); g.add(panel);
    const c = cnv(512, 160), x = c.getContext('2d'); x.fillStyle = '#1b1c1f'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#d9d9d9'; x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(46 + (i % 3) * 84 + (i > 2 ? 0 : 0), 42 + Math.floor(i / 3) * 76, 30, 0, 7); x.stroke(); } x.fillStyle = '#243a55'; x.fillRect(300, 12, 190, 130);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.26), new THREE.MeshBasicMaterial({ map: t })); face.position.set(0, 1.32, 0.955); face.rotation.y = Math.PI; g.add(face); parts.panelTex = { c, t };
    for (const s of [1, -1]) { const yk = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 16, Math.PI), dark); yk.position.set(s * 0.3, 1.2, 0.8); g.add(yk); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.12), new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.9 })); seat.position.set(s * 0.3, 1.25, -0.2); seat.rotation.x = -0.15; g.add(seat); } }
  g.traverse(o => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, ...parts };
}
