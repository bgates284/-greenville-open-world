// =====================================================================
// ECU MAIN CAMPUS STUDENT CENTER — the 2019 student center on 10th Street, the building on most
// ECU postcards: three storeys of tall glass between red-brick piers, and its trademark "porches" —
// huge cantilevered gable canopies (pale metal roof, warm wood underside, white fascia) that lean
// up and out over glass entrance halls on slender white steel struts. In front, facing the street,
// the giant cream E · C · U letters stand in a bed of purple flowers on a brick-paved plaza.
// The building is found by its OpenStreetMap id (HANDBUILT in 04g_handmade.js).
// =====================================================================
function ecuGlassMat() { return MAT.ecuGlass || (MAT.ecuGlass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.6 })); }

function hmStudentCenter(T, B, P, mb) {
  const ring = B.ring, E = HM.edgesOf(ring); if (E.length < 3) return; const C = h => new THREE.Color(h); const Z0 = [0, 0];
  let g0 = 1e9; for (const [x, z] of ring) g0 = Math.min(g0, H(x, z));
  const HB = 16.5, top = g0 + HB, FLOORS = [5.6, 11.2];
  const WHITE = C('#c86c56'), GLASS = C('#6f93b3'), GLASS2 = C('#557a99'), MUL = C('#3a4046'), SPAN = C('#cfd2d4'), COPE = C('#e9e6df'), STEEL = C('#f3f3f1');
  const wb = new MB(true), gb = new MB(true); // brick (textured) and glass buckets
  // ---- which walls get the porches: the one facing 10th Street, and the longest one on the far side ----
  const roadD = e => { const nr = nearestRoad(e.mx + e.nx * 22, e.mz + e.nz * 22, 70, r => r.car && /^(primary|secondary|tertiary)$/.test(r.hw || '')); return nr ? nr.d : 99; };
  let main = null, ms = -1e9; for (const e of E) { if (e.L < 22) continue; const s = e.L - roadD(e) * 0.9; if (s > ms) { ms = s; main = e; } }
  if (!main) main = E.slice().sort((a, b) => b.L - a.L)[0];
  let back = null; for (const e of E) if (e.L > 18 && e.nx * main.nx + e.nz * main.nz < -0.55 && (!back || e.L > back.L)) back = e;
  const glassy = e => e === main || e === back || (e.L > 14 && e.nx * main.nx + e.nz * main.nz > 0.45);
  // a brick box in wall coordinates (s along the wall, o outward), textured in metres
  const brickBox = (e, s0, s1, o0, o1, y0, y1) => {
    const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L; const Q = (s, o, y) => [e.a[0] + tx * s + e.nx * o, y, e.a[1] + tz * s + e.nz * o]; const k = 1 / 2.6;
    wb.quad(Q(s0, o1, y0), Q(s1, o1, y0), Q(s1, o1, y1), Q(s0, o1, y1), [s0 * k, y0 * k], [s1 * k, y0 * k], [s1 * k, y1 * k], [s0 * k, y1 * k], [e.nx, 0, e.nz], WHITE);
    for (const [s, sg] of [[s0, -1], [s1, 1]]) wb.quad(Q(s, o0, y0), Q(s, o1, y0), Q(s, o1, y1), Q(s, o0, y1), [0, y0 * k], [(o1 - o0) * k, y0 * k], [(o1 - o0) * k, y1 * k], [0, y1 * k], [tx * sg, 0, tz * sg], WHITE);
    wb.quad(Q(s0, o0, y1), Q(s1, o0, y1), Q(s1, o1, y1), Q(s0, o1, y1), Z0, Z0, Z0, Z0, [0, 1, 0], WHITE);
  };
  const wbox = (e, s0, s1, o0, o1, y0, y1, col, bucket) => { // plain box in wall coordinates
    const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L; const sc = (s0 + s1) / 2, oc = (o0 + o1) / 2;
    HM.box(bucket || mb, e.a[0] + tx * sc + e.nx * oc, e.a[1] + tz * sc + e.nz * oc, y0, y1, (s1 - s0) / 2, (o1 - o0) / 2, Math.atan2(tx, tz) + Math.PI / 2, col);
  };
  const pane = (e, s0, s1, y0, y1, o, col) => { const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L; const Q = (s, y) => [e.a[0] + tx * s + e.nx * o, y, e.a[1] + tz * s + e.nz * o]; gb.quad(Q(s0, y0), Q(s1, y0), Q(s1, y1), Q(s0, y1), Z0, Z0, Z0, Z0, [e.nx, 0, e.nz], col); };
  const mullions = (e, s0, s1, y0, y1, o) => { const n = Math.max(1, Math.round((s1 - s0) / 1.6)); for (let i = 1; i < n; i++) { const s = s0 + (s1 - s0) * i / n; wbox(e, s - 0.05, s + 0.05, o, o + 0.12, y0, y1, MUL); } wbox(e, s0, s1, o, o + 0.1, y0 - 0.08, y0 + 0.04, MUL); wbox(e, s0, s1, o, o + 0.1, y1 - 0.04, y1 + 0.08, MUL); };
  // ---- walls ----
  for (const e of E) {
    brickBox(e, 0, e.L, -0.3, 0, g0 - 0.3, top);                                                   // the wall itself
    wbox(e, -0.3, e.L + 0.3, -0.2, 0.45, top, top + 0.55, COPE);                                     // metal coping
    if (e.L < 3) continue;
    const nb = Math.max(1, Math.round(e.L / 8.5)), pw = Math.min(0.75, e.L / 8);
    for (let k = 0; k <= nb; k++) { const s = e.L * k / nb; brickBox(e, Math.max(0, s - pw), Math.min(e.L, s + pw), 0, 0.4, g0 - 0.3, top + 0.35); } // brick piers
    for (let k = 0; k < nb; k++) {
      const s0 = e.L * k / nb + pw + 0.15, s1 = e.L * (k + 1) / nb - pw - 0.15; if (s1 - s0 < 1.2) continue;
      if (glassy(e)) { // full-height glass between the piers, light spandrel bands at the floors
        pane(e, s0, s1, g0 + 0.2, top - 0.9, 0.06, (k % 2) ? GLASS : GLASS2); mullions(e, s0, s1, g0 + 0.2, top - 0.9, 0.06);
        for (const f of FLOORS) wbox(e, s0, s1, 0.06, 0.3, g0 + f - 0.35, g0 + f + 0.35, SPAN);
      } else { // brick with a glass ribbon on each floor
        for (const f of [0, ...FLOORS]) { const y0 = g0 + f + 1.0, y1 = g0 + f + 4.0; pane(e, s0 + 0.4, s1 - 0.4, y0, y1, 0.03, GLASS2); mullions(e, s0 + 0.4, s1 - 0.4, y0, y1, 0.03); wbox(e, s0 + 0.3, s1 - 0.3, 0, 0.3, y0 - 0.25, y0 - 0.05, SPAN); }
      }
    }
  }
  // ---- roof + rooftop plant ----
  { const ct = ring.map(p => new THREE.Vector2(p[0], p[1])); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(ct, []); } catch (e) { }
    const rc = C('#a3a7a9'); for (const t of tris) { const [A, Bv, Cc] = t.map(i => ct[i]); mb.tri([A.x, top, A.y], [Bv.x, top, Bv.y], [Cc.x, top, Cc.y], Z0, Z0, Z0, [0, 1, 0], rc); }
    const [cx, cz] = centroid(ring); const yaw = Math.atan2(main.nx, main.nz); HM.box(mb, cx, cz, top, top + 3.2, 9, 6, yaw, C('#b8bcbe')); HM.box(mb, cx - main.nx * 14, cz - main.nz * 14, top, top + 2.2, 5, 4, yaw, C('#aeb2b4')); }
  HM.solid(T, ring, top, 'Main Campus Student Center');
  // ---- a porch: glass hall under a leaning, cantilevered gable canopy ----
  const porch = (e, big) => {
    const L = e.L, tx = (e.b[0] - e.a[0]) / L, tz = (e.b[1] - e.a[1]) / L, nx = e.nx, nz = e.nz;
    const W = Math.min(L * 0.62, big ? 36 : 26), sc = L / 2 + (big ? -L * 0.08 : 0), Dp = big ? 19 : 14, bk = 5, hall = big ? 8 : 6;
    const Q = (s, o, y) => [e.a[0] + tx * s + nx * o, y, e.a[1] + tz * s + nz * o];
    const gq = H(...(([x, , z]) => [x, z])(Q(sc, Dp * 0.6, 0)));
    const sL = sc - W / 2, sR = sc + W / 2, sP = sc - W * 0.12;                // eaves and the (off-centre) ridge
    const eave = o => top + 0.6 + (o + bk) / (Dp + bk) * 2.8, ridge = o => top + 5.0 + (o + bk) / (Dp + bk) * 5.0; // both rise toward the outer end
    const roofY = (s, o) => s < sP ? eave(o) + (ridge(o) - eave(o)) * (s - sL) / (sP - sL) : ridge(o) + (eave(o) - ridge(o)) * (s - sP) / (sR - sP);
    const TH = 0.75, METAL = C('#dde0e1'), WOOD = C('#b98858'), FASCIA = C('#f4f4f2');
    const slab = (s0, s1) => { // one sloped half of the canopy: metal top, wood soffit, white fascia
      const pts = [[s0, -bk], [s1, -bk], [s1, Dp], [s0, Dp]].map(([s, o]) => Q(s, o, roofY(s, o)));
      const dn = pts.map(p => [p[0], p[1] - TH, p[2]]);
      const u = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], v = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (n[1] < 0) n = n.map(x => -x);
      mb.quad(pts[0], pts[1], pts[2], pts[3], Z0, Z0, Z0, Z0, n, METAL); mb.quad(dn[0], dn[1], dn[2], dn[3], Z0, Z0, Z0, Z0, n.map(x => -x), WOOD);
      const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cz = pts.reduce((a, p) => a + p[2], 0) / 4;
      for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4], A = dn[i], Bd = dn[(i + 1) % 4]; mb.quad(a, b, Bd, A, Z0, Z0, Z0, Z0, [(a[0] + b[0]) / 2 - cx, 0, (a[2] + b[2]) / 2 - cz], FASCIA); }
      // wood slats on the soffit
      for (let o = -bk + 1; o < Dp; o += 1.1) { const a = Q(s0 + 0.3, o, roofY(s0 + 0.3, o) - TH - 0.06), b = Q(s1 - 0.3, o, roofY(s1 - 0.3, o) - TH - 0.06); const a2 = [a[0] + tx * 0, a[1], a[2]]; mb.quad([a[0] - nx * 0.2, a[1], a[2] - nz * 0.2], [b[0] - nx * 0.2, b[1], b[2] - nz * 0.2], [b[0] + nx * 0.2, b[1], b[2] + nz * 0.2], [a2[0] + nx * 0.2, a2[1], a2[2] + nz * 0.2], Z0, Z0, Z0, Z0, [0, -1, 0], C('#9c6c40')); }
    };
    slab(sL, sP); slab(sP, sR);
    // white steel: tapered "tree" struts from the plaza up to the soffit, a ridge beam and tie rods
    const strut = (p, q, r0, r1) => { const d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const len = d.length(); const g = new THREE.CylinderGeometry(r1, r0, len, 10); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(p[0], p[1], p[2]); addGeoTo(mb, g, STEEL); };
    const under = (s, o) => Q(s, o, roofY(s, o) - TH - 0.05);
    for (const [s, o] of [[sc - W * 0.3, Dp * 0.62], [sc + W * 0.28, Dp * 0.62], [sP, Dp * 0.86]]) {
      const base = Q(s, o, gq - 0.1); const knee = Q(s, o, gq + 6.5);
      strut(base, knee, 0.42, 0.3); HM.obstacle(T, base[0], base[2], 0.6);
      for (const [ds, dO] of [[-3.2, 2.2], [3.2, 2.2], [-2.6, -3], [2.6, -3]]) strut(knee, under(s + ds, o + dO), 0.22, 0.14);
    }
    { const a = under(sP, -bk + 0.5), b = under(sP, Dp - 0.3); strut([a[0], a[1] - 0.3, a[2]], [b[0], b[1] - 0.3, b[2]], 0.28, 0.28); }       // ridge beam
    for (const o of [Dp * 0.3, Dp * 0.95]) strut(under(sL + 0.6, o), under(sR - 0.6, o), 0.09, 0.09);                                       // tie rods
    // the glass entrance hall under the canopy
    const h0 = sc - W * 0.3, h1 = sc + W * 0.3, hy = top - 2.2;
    const he = { a: Q(h0, hall, 0).filter((_, i) => i !== 1), b: Q(h1, hall, 0).filter((_, i) => i !== 1), L: h1 - h0, nx, nz };
    pane(he, 0, he.L, g0, hy, 0, GLASS); mullions(he, 0, he.L, g0, hy, 0); for (const f of FLOORS) wbox(he, 0, he.L, 0, 0.25, g0 + f - 0.2, g0 + f + 0.2, SPAN);
    wbox(he, he.L / 2 - 2.5, he.L / 2 + 2.5, 0.02, 0.12, g0, g0 + 3.2, C('#1d2a33')); wbox(he, he.L / 2 - 3, he.L / 2 + 3, 0, 1.6, g0 + 3.2, g0 + 3.5, FASCIA); // doors + little canopy
    for (const [s, sg] of [[h0, -1], [h1, 1]]) { const se = { a: Q(s, sg < 0 ? hall : 0, 0).filter((_, i) => i !== 1), b: Q(s, sg < 0 ? 0 : hall, 0).filter((_, i) => i !== 1), L: hall, nx: tx * sg, nz: tz * sg }; pane(se, 0, hall, g0, hy, 0, GLASS2); mullions(se, 0, hall, g0, hy, 0); }
    HM.box(mb, ...(([x, , z]) => [x, z])(Q(sc, hall / 2, 0)), hy, hy + 0.5, W * 0.3 + 0.2, hall / 2 + 0.2, Math.atan2(tx, tz) + Math.PI / 2, FASCIA);
    HM.solid(T, [Q(h0, 0, 0), Q(h1, 0, 0), Q(h1, hall, 0), Q(h0, hall, 0)].map(p => [p[0], p[2]]), hy, 'Main Campus Student Center');
    // brick-paved plaza under and in front of the porch
    const pz = [[sc - W / 2 - 4, 0], [sc + W / 2 + 4, 0], [sc + W / 2 + 4, Dp + 7], [sc - W / 2 - 4, Dp + 7]].map(([s, o]) => Q(s, o, 0));
    const py = Math.max(...pz.map(p => H(p[0], p[2]))) + 0.05; const k = 1 / 1.6;
    wb.quad(...pz.map(p => [p[0], py, p[2]]), [pz[0][0] * k, pz[0][2] * k], [pz[1][0] * k, pz[1][2] * k], [pz[2][0] * k, pz[2][2] * k], [pz[3][0] * k, pz[3][2] * k], [0, 1, 0], C('#e8d9d2'));
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) wb.quad([pz[a][0], py, pz[a][2]], [pz[b][0], py, pz[b][2]], [pz[b][0], py - 0.6, pz[b][2]], [pz[a][0], py - 0.6, pz[a][2]], Z0, Z0, Z0, Z0, null, C('#e8d9d2'));
    addDeck(T, pz.map(p => [p[0], p[2]]), py); { const c = Q(sc, Dp / 2, 0); (T.noTrees || (T.noTrees = [])).push([c[0], c[2], W / 2 + 3]); }
    return { sc, W, Dp, Q, py, tx, tz };
  };
  const pm = porch(main, true); if (back && back !== main) try { porch(back, false); } catch (err) { console.warn('student center back porch skipped', err); }
  // ---- the E C U letters in their flower bed, out toward the street beside the main porch ----
  const LA = pm.Q(pm.sc + pm.W * 0.5 - 3, pm.Dp + 11, 0); ecuLetters(T, mb, LA, main.nx, main.nz, 1);
  addMB(T, mb, lmPlainMat());
  { const g = wb.geo(); if (g) { const m = new THREE.Mesh(g, hmRedBrickMat()); m.castShadow = m.receiveShadow = true; T.group.add(m); } }
  { const g = gb.geo(); if (g) { const m = new THREE.Mesh(g, ecuGlassMat()); m.receiveShadow = true; T.group.add(m); } }
}

// the giant precast E · C · U, standing staggered in a raised bed of purple and gold flowers; they face (nx, nz)
function ecuLetters(T, mb, at, nx, nz, scale = 1) {
  const C = h => new THREE.Color(h); const x0 = at[0], z0 = at[2]; const g = H(x0, z0);
  const LH = 3.7 * scale, LW = 2.9 * scale, t = 0.8 * scale, DEP = 0.85 * scale, CREAM = C('#e7dcc5');
  const shapeOf = ch => {
    const s = new THREE.Shape();
    if (ch === 'E') { const pts = [[0, 0], [LW, 0], [LW, t], [t, t], [t, (LH - t) / 2], [LW * 0.86, (LH - t) / 2], [LW * 0.86, (LH + t) / 2], [t, (LH + t) / 2], [t, LH - t], [LW, LH - t], [LW, LH], [0, LH]]; s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); }
    else if (ch === 'C') { const rx = LW / 2, ry = LH / 2, a0 = 0.62, N = 28; for (let i = 0; i <= N; i++) { const a = a0 + (Math.PI * 2 - 2 * a0) * i / N; const p = [rx + Math.cos(a) * rx, ry + Math.sin(a) * ry]; i ? s.lineTo(...p) : s.moveTo(...p); } for (let i = N; i >= 0; i--) { const a = a0 + (Math.PI * 2 - 2 * a0) * i / N; s.lineTo(rx + Math.cos(a) * (rx - t), ry + Math.sin(a) * (ry - t)); } }
    else { const r = LW / 2, N = 16; s.moveTo(0, LH); s.lineTo(0, r); for (let i = 0; i <= N; i++) { const a = Math.PI + Math.PI * i / N; s.lineTo(r + Math.cos(a) * r, r + Math.sin(a) * r); } s.lineTo(LW, LH); s.lineTo(LW - t, LH); s.lineTo(LW - t, r); for (let i = N; i >= 0; i--) { const a = Math.PI + Math.PI * i / N; s.lineTo(r + Math.cos(a) * (r - t), r + Math.sin(a) * (r - t)); } s.lineTo(t, LH); }
    return s;
  };
  (T.noTrees || (T.noTrees = [])).push([x0, z0, 11 * scale]);
  const rx = nz, rz = -nx, yaw = Math.atan2(nx, nz); // reading direction (left → right for someone facing the letters)
  const bedA = 9.5 * scale, bedB = 4.2 * scale;
  // the raised bed: brick curb, mulch, flowers
  const bed = new THREE.CylinderGeometry(1, 1, 0.45, 40); bed.scale(bedA + 0.3, 1, bedB + 0.3); bed.rotateY(yaw); HM.geo(mb, bed, C('#9a4a36'), x0, g + 0.2, z0);
  const mul = new THREE.CylinderGeometry(1, 1, 0.1, 40); mul.scale(bedA, 1, bedB); mul.rotateY(yaw); HM.geo(mb, mul, C('#4a3426'), x0, g + 0.44, z0);
  const R = mulberry32(4110); const FL = ['#6b3fa3', '#7d4fb8', '#8a5cc4', '#5b2d8e', '#9b6fd1', '#6b3fa3', '#f2c230', '#f4f1ea'];
  for (let i = 0; i < 230; i++) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.95; const u = Math.cos(a) * rr * bedA, v = Math.sin(a) * rr * bedB; if (Math.abs(v) < 1.0 * scale && Math.abs(u) < 5.6 * scale) continue; // keep the letters' footprint clear
    const px = x0 + rx * u + nx * v, pz = z0 + rz * u + nz * v; const s = 0.28 + R() * 0.22; const fg = new THREE.IcosahedronGeometry(s, 0); fg.scale(1, 0.7, 1); HM.geo(mb, fg, C(FL[(R() * FL.length) | 0]), px, g + 0.5 + s * 0.4, pz); }
  for (let i = 0; i < 9; i++) { const u = (i / 8 - 0.5) * bedA * 1.7, v = -bedB * 0.75; const s = 0.5 + R() * 0.25; HM.geo(mb, new THREE.IcosahedronGeometry(s, 1), C('#3f6b34'), x0 + rx * u + nx * v, g + 0.5 + s * 0.6, z0 + rz * u + nz * v); } // low shrubs at the back
  // the letters
  ['E', 'C', 'U'].forEach((ch, i) => {
    const geo = new THREE.ExtrudeGeometry(shapeOf(ch), { depth: DEP, bevelEnabled: false, curveSegments: 4 }); geo.translate(-LW / 2, 0, -DEP / 2);
    const tw = [0.06, -0.04, 0.1][i], fwd = [0.5, -0.4, 0.2][i] * scale; geo.rotateY(yaw + tw);
    const off = (i - 1) * (LW + 0.9 * scale); const px = x0 + rx * off + nx * fwd, pz = z0 + rz * off + nz * fwd;
    HM.geo(mb, new THREE.BoxGeometry(LW + 0.5, 0.35, DEP + 0.5).rotateY(yaw + tw), C('#cfc6b3'), px, g + 0.5, pz); // plinth
    HM.geo(mb, geo, CREAM, px, g + 0.67, pz); HM.obstacle(T, px, pz, LW * 0.55);
  });
}
