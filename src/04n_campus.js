// =====================================================================
// ECU MAIN CAMPUS GROUNDS — what you walk through between the buildings:
//   • brick-paver walks (raised a few cm, with a thin concrete edge) along every campus footway,
//     concrete where OpenStreetMap says the walk is a concrete sidewalk
//   • big willow oaks lining the walks and spread over the Mall and the lawns, like the real campus
//   • black acorn lamp posts with white globes along the walks (lit at night) and wooden benches
// Driven by the campus area (amenity=university) and the footways in OpenStreetMap.
// =====================================================================
function campusPaverMat() {
  if (MAT.campusPaver) return MAT.campusPaver;
  // running-bond red brick pavers, 512 px = 2 m (a paver is 20 x 10 cm), dark sand joints
  const c = cnv(512, 512), g = c.getContext('2d'); g.fillStyle = '#7d6b5b'; g.fillRect(0, 0, 512, 512); const r = mulberry32(912);
  for (let y = 0, row = 0; y < 512; y += 26, row++) for (let x = (row % 2) * -26; x < 512; x += 52) {
    const t = r(), u = r(); g.fillStyle = `rgb(${142 + t * 38 | 0},${62 + t * 18 + u * 10 | 0},${48 + t * 12 | 0})`; g.fillRect(x + 2, y + 2, 48, 22);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2, y + 2, 48, 3);
  }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 4); } // wear
  const tex = ctex(c);
  MAT.campusPaver = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 }); wetPatch(MAT.campusPaver, 'paver');
  return MAT.campusPaver;
}
function campusGlobeMat() { return MAT.campusGlobe || (MAT.campusGlobe = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, emissive: 0xffe6b0, emissiveIntensity: 0, roughness: 0.35 })); }

function buildCampusGrounds(T, P) {
  const Z = P.zones || (P.zones = landmarkZones(P));
  if (!Z.some(q => q.kind === 'campus')) return;
  const W = T.W, inTile = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1;
  const onCampus = (x, z) => zoneAt(Z, 'campus', x, z);
  const mask = (x, z) => { if (!T.treeR) return 1; const u = Math.floor((x - W.x0) / (W.x1 - W.x0) * 512), v = Math.floor((z - W.z0) / (W.z1 - W.z0) * 512); if (u < 0 || v < 0 || u > 511 || v > 511) return 0; return T.treeR[v * 512 + u]; };
  const brick = new MB(), conc = new MB(), deco = new MB(true);
  const r = mulberry32(T.tx * 7919 + T.ty * 31);
  const walks = []; // [{R, w, brick}]
  for (const rd of P.roads) {
    const t = rd.tags, hw = t.highway; if (!/^(footway|pedestrian|cycleway|path)$/.test(hw) || rd.pts.length < 2) continue;
    if (t.footway === 'crossing' || t.tunnel || t.bridge || t.area === 'yes' || t.indoor === 'yes' || t.level && +t.level !== 0) continue;
    const surf = t.surface || '';
    if (/dirt|ground|gravel|unpaved|grass|sand|wood/.test(surf) || (hw === 'path' && !surf)) continue;
    const m = rd.pts[rd.pts.length >> 1]; if (!onCampus(m[0], m[1]) && !onCampus(rd.pts[0][0], rd.pts[0][1])) continue;
    const side = t.footway === 'sidewalk';
    const isBrick = /brick|paving_stones|sett/.test(surf) || (!surf && !side) || (!/concrete|asphalt/.test(surf) && !side);
    const w = hw === 'pedestrian' ? 5.5 : hw === 'cycleway' ? 3 : side ? 2.0 : 2.6;
    walks.push({ R: resample(rd.pts, 2.5), w, brick: isBrick, side });
  }
  // ---- the walks: ribbons with world-space paver texture, discs at the joints so walks meet cleanly ----
  const Y = (x, z) => H(x, z) + 0.07, UVk = 0.5;
  const ribbon = (mb, R, w, uvAlong) => {
    const L = [], Rr = [];
    for (let i = 0; i < R.length; i++) {
      const p = R[i], a = R[Math.max(0, i - 1)], b = R[Math.min(R.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const sx = -tz, sz = tx; let k = 1;
      if (i > 0 && i < R.length - 1) { const a2 = R[i - 1]; let dx = p[0] - a2[0], dz = p[1] - a2[1]; const l1 = Math.hypot(dx, dz) || 1; k = 1 / Math.max(0.6, sx * -dz / l1 + sz * dx / l1); }
      L.push([p[0] - sx * w / 2 * k, p[1] - sz * w / 2 * k, p[2]]); Rr.push([p[0] + sx * w / 2 * k, p[1] + sz * w / 2 * k, p[2]]);
    }
    const V = q => [q[0], Y(q[0], q[1]), q[1]];
    const uv = (q, side) => uvAlong ? [side, q[2] / 6] : [q[0] * UVk, q[1] * UVk];
    for (let i = 0; i < L.length - 1; i++) mb.quad(V(L[i]), V(Rr[i]), V(Rr[i + 1]), V(L[i + 1]), uv(L[i], 0), uv(Rr[i], 1), uv(Rr[i + 1], 1), uv(L[i + 1], 0), UPN, null);
  };
  const disc = (mb, x, z, rad, uvAlong) => { const N = 12, y = Y(x, z), c = [x, y, z]; for (let i = 0; i < N; i++) { const a0 = i / N * 6.2832, a1 = (i + 1) / N * 6.2832; const p0 = [x + Math.cos(a0) * rad, 0, z + Math.sin(a0) * rad], p1 = [x + Math.cos(a1) * rad, 0, z + Math.sin(a1) * rad]; p0[1] = Y(p0[0], p0[2]); p1[1] = Y(p1[0], p1[2]); const U = q => uvAlong ? [0.5, 0] : [q[0] * UVk, q[2] * UVk]; mb.tri(c, p0, p1, U(c), U(p0), U(p1), UPN, null); } };
  for (const wk of walks) {
    if (!wk.R.some(p => inTile(p[0], p[1]))) continue;
    ribbon(wk.brick ? brick : conc, wk.R, wk.w, !wk.brick);
    if (wk.brick) ribbon(conc, wk.R, wk.w + 0.36, true); // thin concrete edge showing either side (the pavers draw on top)
    for (const i of [0, wk.R.length - 1]) disc(wk.brick ? brick : conc, wk.R[i][0], wk.R[i][1], wk.w / 2, !wk.brick);
    for (let i = 1; i < wk.R.length - 1; i++) { const a = wk.R[i - 1], p = wk.R[i], b = wk.R[i + 1]; const t1 = Math.atan2(p[1] - a[1], p[0] - a[0]), t2 = Math.atan2(b[1] - p[1], b[0] - p[0]); let d = Math.abs(t1 - t2); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 0.5) disc(wk.brick ? brick : conc, p[0], p[1], wk.w / 2, !wk.brick); }
  }
  { const g = brick.geo(); if (g) { const m = new THREE.Mesh(g, campusPaverMat()); m.receiveShadow = true; T.group.add(m); } }
  { const g = conc.geo(); if (g) { const m = new THREE.Mesh(g, MAT.sidewalk); m.receiveShadow = true; T.group.add(m); } }

  // ---- oaks along the walks and over the lawns ----
  const extra = T.extraTrees || (T.extraTrees = []); const base = treeBaseH('oak');
  const okTree = (x, z) => inTile(x, z) && onCampus(x, z) && decodeCls(mask(x, z)) && !insideBuilding(x, z) && !(nearestRoad(x, z, 6, q => q.car) || null) && !extra.some(t => (t[0] - x) ** 2 + (t[1] - z) ** 2 < 81);
  const oak = (x, z, big) => { if (okTree(x, z)) extra.push([x, z, (big ? 15 + r() * 7 : 11 + r() * 6) / base, r() * 6.28, 'oak']); };
  const CAP = Q === QUALITY.low ? 220 : Q === QUALITY.medium ? 520 : 800;
  for (const wk of walks) {
    if (wk.side) continue; let k = 0;
    for (let i = 3; i < wk.R.length - 2; i += 6, k++) { // ~15 m apart, alternating sides (both sides on the wide walks)
      const p = wk.R[i], a = wk.R[i - 1], b = wk.R[i + 1]; let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const off = wk.w / 2 + 3.5 + r() * 1.5;
      for (const sg of (wk.w > 4 ? [-1, 1] : [k % 2 ? 1 : -1])) oak(p[0] - tz * off * sg, p[1] + tx * off * sg, true);
      if (extra.length > CAP * 0.6) break;
    }
  }
  // the Mall and the other campus lawns: a loose grove of big oaks
  const mall = P.areas.filter(a => a.tags && /park|garden/.test(a.tags.leisure || '') && a.rings[0] && onCampus(...centroid(a.rings[0])));
  for (let x = W.x0 + 9; x < W.x1; x += 19) for (let z = W.z0 + 9; z < W.z1; z += 19) {
    if (extra.length >= CAP) break;
    const jx = x + (r() - 0.5) * 12, jz = z + (r() - 0.5) * 12; if (!onCampus(jx, jz)) continue;
    const inMall = mall.some(a => inArea(a, jx, jz));
    if (r() < (inMall ? 0.62 : 0.2)) oak(jx, jz, inMall || r() < 0.5);
  }

  // ---- acorn lamps and benches along the brick walks ----
  const lamps = [], benches = [];
  for (const wk of walks) {
    if (!wk.brick) continue; let k = 0;
    for (let i = 5; i < wk.R.length - 2; i += 11, k++) { // ~28 m apart
      const p = wk.R[i], a = wk.R[i - 1], b = wk.R[i + 1]; if (!inTile(p[0], p[1])) continue; let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const sg = k % 2 ? 1 : -1, off = wk.w / 2 + 0.75; const x = p[0] - tz * off * sg, z = p[1] + tx * off * sg;
      if (insideBuilding(x, z) || nearestRoad(x, z, 4, q => q.car)) continue;
      lamps.push([x, z]);
      if (k % 3 === 1) { const bo = wk.w / 2 + 1.1, bx = p[0] + tz * bo * sg + tx * 3, bz = p[1] - tx * bo * sg + tz * 3; if (!insideBuilding(bx, bz) && !nearestRoad(bx, bz, 4, q => q.car)) benches.push([bx, bz, Math.atan2(-tz * sg, tx * sg)]); }
    }
  }
  if (lamps.length) {
    const pole = new MB(true), DARK = new THREE.Color('#1f2224');
    const globe = new THREE.SphereGeometry(0.3, 14, 10); globe.scale(1, 1.15, 1); globe.translate(0, 4.35, 0);
    const im = new THREE.InstancedMesh(globe, campusGlobeMat(), lamps.length); const o = new THREE.Object3D();
    lamps.forEach(([x, z], i) => {
      const y = H(x, z); HM.geo(pole, new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), DARK, x, y + 0.25, z); HM.geo(pole, new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8), DARK, x, y + 2.2, z);
      HM.geo(pole, new THREE.CylinderGeometry(0.16, 0.08, 0.22, 8), DARK, x, y + 4.06, z); HM.geo(pole, new THREE.ConeGeometry(0.12, 0.25, 8), DARK, x, y + 4.82, z);
      o.position.set(x, y, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); T.lampPos.push([x, y + 4.35, z]); HM.obstacle(T, x, z, 0.2);
    });
    addMB(T, pole, lmPlainMat()); im.userData.detail = true; T.group.add(im);
  }
  if (benches.length) {
    const WOOD = new THREE.Color('#6e4c30'), IRON = new THREE.Color('#25282a');
    for (const [x, z, yaw] of benches) {
      const y = H(x, z), c = Math.cos(yaw), s = Math.sin(yaw); const P = (u, v) => [x + u * c + v * s, z - u * s + v * c];
      for (let k = 0; k < 3; k++) { const q = P(0, -0.18 + k * 0.17); HM.box(deco, q[0], q[1], y + 0.43, y + 0.47, 0.85, 0.07, yaw, WOOD); }        // seat slats
      for (let k = 0; k < 2; k++) { const q = P(0, -0.32); HM.box(deco, q[0], q[1], y + 0.58 + k * 0.17, y + 0.7 + k * 0.17, 0.85, 0.025, yaw, WOOD); } // back slats
      for (const u of [-0.72, 0.72]) { const q = P(u, -0.05); HM.box(deco, q[0], q[1], y, y + 0.43, 0.04, 0.27, yaw, IRON); const q2 = P(u, -0.33); HM.box(deco, q2[0], q2[1], y, y + 0.92, 0.035, 0.03, yaw, IRON); }
      HM.obstacle(T, x, z, 0.6);
    }
    addMB(T, deco, lmPlainMat());
  }
}

// the wall a campus building's main door is on: the long one facing the nearest campus walk or street
function campusFrontEdge(edges) {
  let best = null, bs = -1e9;
  for (const e of edges) {
    if (e.L < 7) continue; const mx = (e.a[0] + e.b[0]) / 2 + e.nx * 8, mz = (e.a[1] + e.b[1]) / 2 + e.nz * 8;
    const w = nearestRoad(mx, mz, 40, r => !r.car && /^(footway|pedestrian)$/.test(r.hw) && r.tags.footway !== 'crossing'), c = nearestRoad(mx, mz, 70, r => r.car && r.hw !== 'service');
    const s = -Math.min(w ? w.d * 0.8 : 99, c ? c.d : 99) + Math.min(e.L, 40) * 0.25; if (s > bs) { bs = s; best = e; }
  }
  return best;
}

// details on an ECU hall: a slate roof band round the edge (the real roofs are hipped slate; from the
// ground this reads the same on any footprint), a white Georgian doorway with steps and the building's
// name in a stone panel over it, and clipped shrubs along the foundations
function campusDetails(LM, B, T, ctx, edges, box, sa) {
  const { ring, base, wallTop, decor, area } = ctx; const C = h => new THREE.Color(h); const WHITE = C('#f4f1ea'), STONE = C('#ddd6c8');
  if (LM.band && ring.length >= 3) {
    const n = ring.length, RISE = Math.min(3.4, 1.2 + Math.sqrt(area) * 0.055), IN = Math.min(4.2, 2.4 + Math.sqrt(area) * 0.03), RC = C('#4c5355');
    const N = []; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6; let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } N.push([nx, nz, L]); }
    const O = [], I = []; for (let i = 0; i < n; i++) { const n1 = N[(i + n - 1) % n], n2 = N[i]; let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const k = Math.min(1.8, 1 / Math.max(0.4, mx * n2[0] + mz * n2[1])); const p = ring[i]; O.push([p[0] + mx * 0.5 * k, p[1] + mz * 0.5 * k]); I.push([p[0] - mx * IN * k, p[1] - mz * IN * k]); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (N[i][2] < 0.05) continue; decor.quad([O[i][0], wallTop + 0.05, O[i][1]], [O[j][0], wallTop + 0.05, O[j][1]], [I[j][0], wallTop + RISE, I[j][1]], [I[i][0], wallTop + RISE, I[i][1]], [0, 0], [0, 0], [0, 0], [0, 0], [N[i][0], 1.3, N[i][1]], RC); }
    // a couple of brick chimneys on the bigger halls
    if (area > 700 && B.id % 3 !== 0) { const e = edges.slice().sort((a, b) => b.L - a.L)[0]; for (const f of [0.2, 0.8]) { const x = e.a[0] + (e.b[0] - e.a[0]) * f - e.nx * IN * 0.6, z = e.a[1] + (e.b[1] - e.a[1]) * f - e.nz * IN * 0.6; box(x, z, wallTop, wallTop + RISE + 1.6, 0.9, 0.55, Math.atan2(e.nx, e.nz), C('#8f4433')); box(x, z, wallTop + RISE + 1.6, wallTop + RISE + 1.8, 1.0, 0.65, Math.atan2(e.nx, e.nz), STONE); } }
  }
  const e = campusFrontEdge(edges); let door = null;
  if (e && !LM.portico && wallTop - base > 5) {
    const mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2, yaw = Math.atan2(e.nx, e.nz), g0 = H(mx + e.nx * 2, mz + e.nz * 2), ux = e.nz, uz = -e.nx;
    const P = (u, v) => [mx + ux * u + e.nx * v, mz + uz * u + e.nz * v]; const at = (u, v, y0, y1, hw, hd, col) => { const q = P(u, v); box(q[0], q[1], y0, y1, hw, hd, yaw, col); };
    door = [mx, mz];
    at(0, 0.8, g0 - 0.4, g0 + 0.15, 2.6, 0.8, STONE); at(0, 0.5, g0 + 0.15, g0 + 0.45, 2.3, 0.5, STONE);            // steps
    const yb = g0 + 0.45, DH = 3.0;
    at(0, 0.05, yb, yb + DH, 1.05, 0.06, C('#24312b'));                                                            // double doors (dark green)
    at(0, 0.09, yb + 1.45, yb + 1.5, 1.0, 0.03, C('#b08d3c'));                                                     // brass push bar
    at(0, 0.05, yb + DH + 0.08, yb + DH + 0.75, 1.05, 0.05, C('#6d8597'));                                         // transom light
    for (const s of [-1, 1]) at(s * 1.35, 0.22, yb, yb + DH + 0.9, 0.24, 0.22, WHITE);                              // pilasters
    at(0, 0.3, yb + DH + 0.9, yb + DH + 1.45, 1.85, 0.32, WHITE);                                                   // entablature
    { const a = P(-1.95, 0.63), b = P(1.95, 0.63), y = yb + DH + 1.45, pk = y + 1.0; decor.tri([a[0], y, a[1]], [b[0], y, b[1]], [mx + e.nx * 0.63, pk, mz + e.nz * 0.63], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], WHITE);
      for (const s of [-1, 1]) { const o = P(s * 1.95, 0.63), o2 = P(s * 1.95, 0); decor.quad([o[0], y, o[1]], [mx + e.nx * 0.63, pk, mz + e.nz * 0.63], [mx, pk, mz], [o2[0], y, o2[1]], [0, 0], [0, 0], [0, 0], [0, 0], [s * ux, 1, s * uz], WHITE); } }
    for (const s of [-1, 1]) { at(s * 2.0, 0.25, yb + 2.2, yb + 2.75, 0.13, 0.13, C('#1d1f21')); at(s * 2.0, 0.25, yb + 2.3, yb + 2.65, 0.1, 0.14, C('#ffe2a8')); } // lanterns
    if (LM.name && LM.name.length < 48) { // name in a stone panel over the door
      const sw = Math.min(e.L * 0.55, Math.max(5, LM.name.length * 0.33)), sh = sw * 96 / 1024, y = Math.min(wallTop - 0.9, yb + DH + 2.9);
      at(0, 0.03, y - sh / 2 - 0.1, y + sh / 2 + 0.1, sw / 2 + 0.25, 0.05, STONE);
      const s = signMesh(T, textTexture([[LM.name.toUpperCase(), 64, '#3d3a35', 50, 700]], { w: 1024, h: 96, bg: '#ddd6c8' }), sw, sh, false); const q = P(0, 0.1); s.position.set(q[0], y, q[1]); s.rotation.y = yaw; T.group.add(s);
    }
  }
  // clipped shrubs along the foundations (not in front of the door)
  if (area < 9000) {
    const R = mulberry32(B.id % 100000), GR = ['#2f5a2c', '#3a6a33', '#2a4f2a', '#45753a']; let n = 0;
    for (const ed of edges) {
      if (ed.L < 3) continue; const tx = (ed.b[0] - ed.a[0]) / ed.L, tz = (ed.b[1] - ed.a[1]) / ed.L;
      for (let s = 1.0; s < ed.L - 0.8; s += 1.9) {
        const x = ed.a[0] + tx * s + ed.nx * 1.0, z = ed.a[1] + tz * s + ed.nz * 1.0;
        if (door && (x - door[0]) ** 2 + (z - door[1]) ** 2 < 12) continue;
        if (nearestRoad(x, z, 2.5, r => r.car || r.hw === 'footway' || r.hw === 'pedestrian') || insideBuilding(x, z)) continue;
        const r0 = 0.42 + R() * 0.2, g = new THREE.IcosahedronGeometry(r0, 1); g.scale(1.3, 0.75, 1.3); g.translate(x, H(x, z) + r0 * 0.6, z); addGeoTo(decor, g, C(GR[(R() * GR.length) | 0]));
        if (++n > 110) return;
      }
    }
  }
}
