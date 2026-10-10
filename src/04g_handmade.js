// =====================================================================
// HAND-BUILT LANDMARKS — places everyone recognises get their own models instead of generated boxes:
//   • the ECU Cupola on the Mall (white columns, drum and grey dome)
//   • (the Main Campus Student Center and its E C U letters are in 04k_ecu.js)
//   • Wright Fountain in the middle of Wright Circle: a round pool in stepped stone rings, one tall jet
//   • Joyner Library's glass entrance pavilion and lettering, facing the Mall
//   • the Town Common: Tar River promenade with railing, lamps and benches, the amphitheater's
//     arched shell over its stage, and a brick entrance sign
//   • Greenville Mall's gabled glass entrances with canopies and signs
// (Dowdy-Ficklen's press box and the hospital tower crown are in 04f_landmarks.js)
// Each is found by its OpenStreetMap name in the map square being built.
// =====================================================================
const HM = {
  box(mb, cx, cz, y0, y1, hw, hd, yaw, col) {
    const c = Math.cos(yaw), s = Math.sin(yaw); const P = (u, v, y) => [cx + u * c + v * s, y, cz - u * s + v * c];
    const q = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (let i = 0; i < 4; i++) { const [u0, v0] = q[i], [u1, v1] = q[(i + 1) % 4]; const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2; mb.quad(P(u0, v0, y0), P(u1, v1, y0), P(u1, v1, y1), P(u0, v0, y1), [0, 0], [0, 0], [0, 0], [0, 0], [mu * c + mv * s, 0, -mu * s + mv * c], col); }
    mb.quad(P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], col);
  },
  geo(mb, g, col, x, y, z, rx = 0, ry = 0, rz = 0) { if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))); g.translate(x, y, z); addGeoTo(mb, g, col); },
  obstacle(T, x, z, r) { T.hashItems.push([World.obsHash, World.obsHash.insert({ x, z, r }, x - r, z - r, x + r, z + r)]); },
  solid(T, ring, top, name) { const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]); T.hashItems.push([World.bldHash, World.bldHash.insert({ ring, holes: [], minY: -1e9, maxY: top, name, cx: xs.reduce((a, b) => a + b) / xs.length, cz: zs.reduce((a, b) => a + b) / zs.length, h: 8 }, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))]); },
  sign(T, text, w, h, opt) { return signMesh(T, textTexture([[text, opt && opt.size || 150, opt && opt.col || '#ffffff', 128, 800]], { w: 1024, h: 256, bg: opt && opt.bg }), w, h, opt && opt.glow); },
  edgesOf(ring) { const sa = signedArea(ring); const out = []; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } out.push({ a, b, L, nx, nz, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2 }); } return out; },
};
const HM_WHITE = new THREE.Color('#f4f2ec'), HM_BRICK = new THREE.Color('#9a4a36'), HM_BRICK2 = new THREE.Color('#a8705e'), HM_STONE = new THREE.Color('#d9d3c6'), HM_GLASS = new THREE.Color('#2e4557'), HM_DARK = new THREE.Color('#2b2d30'), HM_METAL = new THREE.Color('#8e959b');

// the Cupola: brick plinth, 8 white columns, entablature, octagonal drum, copper dome, gold finial
function hmCupola(T, B, mb) {
  const [cx, cz] = centroid(B.ring); const g = H(cx, cz); const R = 2.3;
  // paved circle around it
  HM.geo(mb, new THREE.CylinderGeometry(6.5, 6.5, 0.12, 40), HM_BRICK2, cx, g + 0.04, cz);
  HM.geo(mb, new THREE.CylinderGeometry(R + 0.6, R + 0.75, 0.7, 8), HM_BRICK, cx, g + 0.35, cz, 0, Math.PI / 8, 0);
  HM.geo(mb, new THREE.CylinderGeometry(R + 0.5, R + 0.6, 0.18, 8), HM_STONE, cx, g + 0.79, cz, 0, Math.PI / 8, 0);
  const y0 = g + 0.88, colH = 3.1;
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; HM.geo(mb, new THREE.CylinderGeometry(0.15, 0.18, colH, 12), HM_WHITE, x, y0 + colH / 2, z); HM.geo(mb, new THREE.BoxGeometry(0.42, 0.14, 0.42), HM_WHITE, x, y0 + 0.07, z); HM.geo(mb, new THREE.BoxGeometry(0.44, 0.16, 0.44), HM_WHITE, x, y0 + colH - 0.08, z); }
  const ye = y0 + colH;
  HM.geo(mb, new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.55, 8, 1, false), HM_WHITE, cx, ye + 0.27, cz, 0, Math.PI / 8, 0);            // entablature
  HM.geo(mb, new THREE.CylinderGeometry(R + 0.5, R + 0.4, 0.2, 8), HM_WHITE, cx, ye + 0.64, cz, 0, Math.PI / 8, 0);                      // cornice
  HM.geo(mb, new THREE.CylinderGeometry(R * 0.78, R * 0.82, 1.2, 8), HM_WHITE, cx, ye + 1.34, cz, 0, Math.PI / 8, 0);                    // drum
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; HM.geo(mb, new THREE.BoxGeometry(0.4, 0.75, 0.05), HM_DARK, cx + Math.cos(a) * R * 0.76, ye + 1.34, cz + Math.sin(a) * R * 0.76, 0, -a + Math.PI / 2, 0); } // louvred openings
  const dome = new THREE.SphereGeometry(R * 0.86, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 1.15, 1); HM.geo(mb, dome, new THREE.Color('#8b9294'), cx, ye + 1.94, cz); // weathered grey dome
  HM.geo(mb, new THREE.CylinderGeometry(0.06, 0.1, 1.3, 8), new THREE.Color('#c9a227'), cx, ye + 1.94 + R * 0.99 + 0.6, cz);
  HM.geo(mb, new THREE.SphereGeometry(0.16, 10, 8), new THREE.Color('#e0b72d'), cx, ye + 1.94 + R * 0.99 + 1.3, cz);
  addDeck(T, Array.from({ length: 16 }, (_, k) => [cx + Math.cos(k / 16 * 6.283) * (R + 0.7), cz + Math.sin(k / 16 * 6.283) * (R + 0.7)]), g + 0.88);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; HM.obstacle(T, cx + Math.cos(a) * R, cz + Math.sin(a) * R, 0.25); }
}

// Wright Fountain: stone basin, two tiers, a jet of water
function hmFountain(T, x, z, mb) {
  const g = H(x, z);
  HM.geo(mb, new THREE.CylinderGeometry(11, 11, 0.1, 56), HM_BRICK2, x, g + 0.06, z);                                       // brick plaza
  for (const [r, h] of [[7.4, 0.22], [6.8, 0.44], [6.2, 0.66]]) HM.geo(mb, new THREE.CylinderGeometry(r, r, h, 56), HM_STONE, x, g + h / 2, z); // stepped stone rings to sit on
  HM.geo(mb, new THREE.CylinderGeometry(5.7, 5.7, 0.9, 56, 1, true), HM_STONE, x, g + 0.45, z);                             // inner basin wall
  HM.geo(mb, new THREE.CylinderGeometry(1.1, 1.3, 0.5, 20), HM_STONE, x, g + 0.5, z);                                       // nozzle drum
  const water = new THREE.Mesh(new THREE.CircleGeometry(5.68, 56), MAT.hmWater || (MAT.hmWater = new THREE.MeshStandardMaterial({ color: 0x3b6d82, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })));
  water.rotation.x = -Math.PI / 2; water.position.set(x, g + 0.55, z); T.group.add(water);
  const sprayM = MAT.hmSpray || (MAT.hmSpray = new THREE.MeshStandardMaterial({ color: 0xe8f4fa, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false }));
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 8.5, 14, 1, true), sprayM); jet.position.set(x, g + 0.75 + 4.25, z); T.group.add(jet); // the tall jet
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 8), sprayM); crown.scale.set(1, 1.6, 1); crown.position.set(x, g + 9.0, z); T.group.add(crown);
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, 2.2, 28, 1, true), sprayM); fall.position.set(x, g + 1.6, z); T.group.add(fall); // spray falling back
  HM.obstacle(T, x, z, 6.0); (T.noTrees || (T.noTrees = [])).push([x, z, 9]);
}

// Joyner Library: glass entrance pavilion + canopy + lettering on the side facing the Mall
function hmJoyner(T, B, P, mb) {
  const E = HM.edgesOf(B.ring); if (!E.length) return;
  const mall = P.areas.find(a => a.tags && a.tags.name === 'The Mall'); const tgt = mall ? centroid(mall.rings[0]) : null;
  let e = null, bs = -1e9;
  for (const q of E) { if (q.L < 14) continue; let s = q.L * 0.3; if (tgt) { const dx = tgt[0] - q.mx, dz = tgt[1] - q.mz, d = Math.hypot(dx, dz) || 1; s += (dx * q.nx + dz * q.nz) / d * 60 - d * 0.1; } if (s > bs) { bs = s; e = q; } }
  if (!e) return;
  const g = H(e.mx, e.mz), yaw = Math.atan2(e.nx, e.nz); const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L;
  const W = Math.min(22, e.L * 0.5), D = 7, Hh = 11;
  const cx = e.mx + e.nx * D / 2, cz = e.mz + e.nz * D / 2;
  HM.box(mb, cx, cz, g - 0.3, g + 0.35, W / 2 + 3, D / 2 + 4, yaw, HM_STONE);                          // steps / terrace
  HM.box(mb, cx, cz, g + 0.35, g + Hh, W / 2, D / 2, yaw, HM_GLASS);                                   // glass pavilion
  for (let k = -3; k <= 3; k++) { const f = k * W / 6.2; HM.box(mb, cx + tx * f + e.nx * (D / 2 + 0.02), cz + tz * f + e.nz * (D / 2 + 0.02), g + 0.35, g + Hh, 0.08, 0.06, yaw, HM_METAL); } // mullions
  for (const y of [g + 3.8, g + 7.4]) HM.box(mb, cx + e.nx * (D / 2 + 0.03), cz + e.nz * (D / 2 + 0.03), y, y + 0.12, W / 2, 0.05, yaw, HM_METAL);
  for (const s of [-1, 1]) HM.box(mb, cx + tx * s * (W / 2 + 1), cz + tz * s * (W / 2 + 1), g + 0.35, g + Hh + 1.5, 1.0, D / 2 + 0.5, yaw, HM_BRICK); // brick piers
  HM.box(mb, cx + e.nx * 1, cz + e.nz * 1, g + Hh, g + Hh + 0.6, W / 2 + 2.2, D / 2 + 3, yaw, HM_WHITE);     // flat roof / canopy
  for (const s of [-1, 1]) for (const f of [0.35, 0.8]) { const x = cx + tx * s * W * f / 2 + e.nx * (D / 2 + 2.4), z = cz + tz * s * W * f / 2 + e.nz * (D / 2 + 2.4); HM.geo(mb, new THREE.CylinderGeometry(0.22, 0.22, Hh - 0.35, 12), HM_WHITE, x, g + 0.35 + (Hh - 0.35) / 2, z); HM.obstacle(T, x, z, 0.3); }
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + tx * u * W / 2 + e.nx * v * D / 2, cz + tz * u * W / 2 + e.nz * v * D / 2]); HM.solid(T, ring, g + Hh, 'Joyner Library');
  HM.box(mb, cx + e.nx * (D / 2 + 2.2), cz + e.nz * (D / 2 + 2.2), g + Hh + 0.6, g + Hh + 2.8, W / 2 + 1.6, 0.35, yaw, HM_BRICK); // lettering band over the canopy
  const sg = HM.sign(T, 'J. Y. JOYNER LIBRARY', 22, 5.5, { col: '#f4f2ec', size: 130 }); sg.position.set(cx + e.nx * (D / 2 + 2.6), g + Hh + 1.7, cz + e.nz * (D / 2 + 2.6)); sg.rotation.y = yaw; T.group.add(sg);
}

// Town Common: river promenade, amphitheater shell, entrance sign
function hmTownCommon(T, P, a, mb) {
  const ring = a.rings[0]; if (!ring) return; const W = T.W;
  const water = P.areas.filter(q => q.kind === 'water'); const riverLines = P.lines.filter(l => l.kind === 'water' && l.w >= 20);
  const nearRiver = (x, z) => water.some(q => q.rings.some(r => pointInPoly(x, z, r))) || riverLines.some(l => { for (let i = 0; i < l.pts.length - 1; i++) if (segDist(x, z, l.pts[i][0], l.pts[i][1], l.pts[i + 1][0], l.pts[i + 1][1]).d < l.w / 2 + 2) return true; return false; });
  const E = HM.edgesOf(ring); let lampK = 0, benchK = 0; const lampM = MAT.hmLamp || (MAT.hmLamp = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffe2a0, emissiveIntensity: 1.2 }));
  for (const e of E) {
    if (e.mx < W.x0 || e.mx >= W.x1 || e.mz < W.z0 || e.mz >= W.z1) continue;
    if (!nearRiver(e.mx + e.nx * 18, e.mz + e.nz * 18)) continue;          // this side of the park faces the Tar River
    const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L; const steps = Math.max(1, Math.floor(e.L / 3));
    for (let k = 0; k < steps; k++) {
      const s0 = k * e.L / steps, s1 = (k + 1) * e.L / steps; const p = s => [e.a[0] + tx * s - e.nx * 4, e.a[1] + tz * s - e.nz * 4];
      const A = p(s0), Bp = p(s1); const ya = H(A[0], A[1]) + 0.12, yb = H(Bp[0], Bp[1]) + 0.12;
      // 5 m promenade
      mb.quad([A[0] - e.nx * 2.5, ya, A[1] - e.nz * 2.5], [Bp[0] - e.nx * 2.5, yb, Bp[1] - e.nz * 2.5], [Bp[0] + e.nx * 2.5, yb, Bp[1] + e.nz * 2.5], [A[0] + e.nx * 2.5, ya, A[1] + e.nz * 2.5], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], k % 6 === 0 ? HM_BRICK2 : HM_STONE);
      addDeck(T, [[A[0] - e.nx * 2.5, A[1] - e.nz * 2.5], [Bp[0] - e.nx * 2.5, Bp[1] - e.nz * 2.5], [Bp[0] + e.nx * 2.5, Bp[1] + e.nz * 2.5], [A[0] + e.nx * 2.5, A[1] + e.nz * 2.5]], null, 0.12);
      // railing on the river side
      const rx = e.nx * 2.6, rz = e.nz * 2.6; HM.box(mb, A[0] + rx, A[1] + rz, ya, ya + 1.05, 0.05, 0.05, 0, HM_DARK);
      mb.quad([A[0] + rx, ya + 1.0, A[1] + rz], [Bp[0] + rx, yb + 1.0, Bp[1] + rz], [Bp[0] + rx, yb + 1.08, Bp[1] + rz], [A[0] + rx, ya + 1.08, A[1] + rz], [0, 0], [0, 0], [0, 0], [0, 0], null, HM_DARK);
      mb.quad([A[0] + rx, ya + 0.5, A[1] + rz], [Bp[0] + rx, yb + 0.5, Bp[1] + rz], [Bp[0] + rx, yb + 0.55, Bp[1] + rz], [A[0] + rx, ya + 0.55, A[1] + rz], [0, 0], [0, 0], [0, 0], [0, 0], null, HM_DARK);
      HM.obstacle(T, (A[0] + Bp[0]) / 2 + rx, (A[1] + Bp[1]) / 2 + rz, 0.15);
      // acorn lamps and benches along the walk
      if ((lampK++ % 8) === 0) { const x = A[0] - e.nx * 2.9, z = A[1] - e.nz * 2.9; HM.geo(mb, new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), HM_DARK, x, ya + 1.8, z); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), lampM); bulb.position.set(x, ya + 3.85, z); T.group.add(bulb); T.lampPos.push([x, ya + 3.85, z]); HM.obstacle(T, x, z, 0.15); }
      if ((benchK++ % 13) === 6) { const x = A[0] - e.nx * 3.1, z = A[1] - e.nz * 3.1, yaw = Math.atan2(e.nx, e.nz); HM.box(mb, x, z, ya + 0.42, ya + 0.48, 0.8, 0.22, yaw + Math.PI / 2, new THREE.Color('#6b4a2e')); HM.box(mb, x - e.nx * 0.22, z - e.nz * 0.22, ya + 0.48, ya + 0.9, 0.8, 0.03, yaw + Math.PI / 2, new THREE.Color('#6b4a2e')); for (const s of [-0.7, 0.7]) HM.box(mb, x + tx * s, z + tz * s, ya, ya + 0.42, 0.04, 0.2, yaw + Math.PI / 2, HM_DARK); }
    }
  }
  // brick entrance sign at the corner nearest a street junction
  let best = null, bd = 1e9; for (const p of ring) { if (p[0] < W.x0 || p[0] >= W.x1 || p[1] < W.z0 || p[1] >= W.z1) continue; const r = nearestRoad(p[0], p[1], 40, q => q.car); if (r && r.d < bd && !nearRiver(p[0], p[1])) { bd = r.d; best = { p, r }; } }
  if (best) {
    const [c0, c1] = centroid(ring); let dx = c0 - best.p[0], dz = c1 - best.p[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = best.p[0] + dx * 7, z = best.p[1] + dz * 7, g = H(x, z), yaw = Math.atan2(-dx, -dz);
    HM.box(mb, x, z, g, g + 1.6, 3.4, 0.45, yaw, HM_BRICK); HM.box(mb, x, z, g + 1.6, g + 1.75, 3.55, 0.55, yaw, HM_STONE);
    for (const s of [-1, 1]) HM.box(mb, x + Math.cos(yaw) * s * 3.7, z - Math.sin(yaw) * s * 3.7, g, g + 2.1, 0.45, 0.6, yaw, HM_BRICK);
    const sg = HM.sign(T, 'TOWN COMMON', 5.6, 1.4, { col: '#f4f2ec', size: 150 }); sg.position.set(x - dx * 0.47, g + 0.95, z - dz * 0.47); sg.rotation.y = yaw; T.group.add(sg);
    HM.obstacle(T, x, z, 2.0);
  }
}
function hmAmphitheater(T, B, mb, P) { // band shell: a white half-dome over the stage, open toward the lawn
  const ob = minAreaRect(B.ring); if (!ob) return; const g = H(ob.cx, ob.cz);
  let ux = ob.ux, uz = ob.uz, L = ob.L, D = ob.W; if (D > L) { ux = ob.vx; uz = ob.vz; [L, D] = [D, L]; }
  const tc = P.areas.find(a => a.tags && a.tags.name === 'Town Common'); let lx = -uz, lz = ux;
  if (tc) { const c = centroid(tc.rings[0]); if ((c[0] - ob.cx) * lx + (c[1] - ob.cz) * lz < 0) { lx = -lx; lz = -lz; } }
  const sx = ob.cx - lx * D * 0.2, sz = ob.cz - lz * D * 0.2, sL = L * 0.8, sD = D * 0.55;
  HM.box(mb, sx, sz, g, g + 1.1, sL / 2, sD / 2, Math.atan2(-uz, ux), HM_STONE); // stage deck under the shell
  addDeck(T, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [sx + ux * s * sL / 2 - uz * t * sD / 2, sz + uz * s * sL / 2 + ux * t * sD / 2]), g + 1.1);
  const R = Math.max(6, L / 2 + 1); const geo = new THREE.SphereGeometry(R, 32, 14, 0, Math.PI, 0, Math.PI / 2); geo.scale(1, 0.85, Math.max(0.55, D / R));
  const m = new THREE.Mesh(geo, MAT.hmShell || (MAT.hmShell = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.6, side: THREE.DoubleSide })));
  m.position.set(ob.cx - lx * D * 0.3, g + 1.1, ob.cz - lz * D * 0.3); m.rotation.y = Math.atan2(-lx, -lz); m.castShadow = true; m.receiveShadow = true; T.group.add(m);
  // ring of rib arches on the front edge
  const ribs = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 8, 32, Math.PI), MAT.hmShell); ribs.position.copy(m.position); ribs.rotation.y = m.rotation.y; ribs.scale.set(1, 0.85, 1); T.group.add(ribs);
  for (const s of [-1, 1]) HM.obstacle(T, m.position.x + ux * s * R, m.position.z + uz * s * R, 0.6);
}

// Greenville Mall: gabled glass entrances with canopy and sign on the two longest walls
function hmMall(T, B, mb) {
  const E = HM.edgesOf(B.ring).filter(e => e.L > 30).sort((a, b) => b.L - a.L).slice(0, 3);
  const top = (parseFloat(B.tags['building:levels']) || 1) * 5 + 3;
  for (const e of E) {
    const g = H(e.mx, e.mz), yaw = Math.atan2(e.nx, e.nz), tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L;
    const W = 16, D = 5, Hh = top + 4; const cx = e.mx + e.nx * D / 2, cz = e.mz + e.nz * D / 2;
    HM.box(mb, cx, cz, g, g + Hh, W / 2, D / 2, yaw, new THREE.Color('#d8cfbf'));                 // entrance block
    HM.box(mb, cx + e.nx * (D / 2 + 0.02), cz + e.nz * (D / 2 + 0.02), g + 0.1, g + Hh - 2.2, W / 2 - 1.2, 0.05, yaw, HM_GLASS); // glass front
    // gable
    const P = (u, v, y) => [cx + tx * u + e.nx * v, y, cz + tz * u + e.nz * v];
    mb.tri(P(-W / 2 - 0.5, D / 2 + 0.1, g + Hh), P(W / 2 + 0.5, D / 2 + 0.1, g + Hh), P(0, D / 2 + 0.1, g + Hh + 4.5), [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], new THREE.Color('#c9bfae'));
    for (const s of [-1, 1]) mb.quad(P(s * (W / 2 + 0.5), D / 2 + 0.1, g + Hh), P(0, D / 2 + 0.1, g + Hh + 4.5), P(0, -D / 2, g + Hh + 4.5), P(s * (W / 2 + 0.5), -D / 2, g + Hh), [0, 0], [0, 0], [0, 0], [0, 0], [s * tx * 0.5, 1, s * tz * 0.5], new THREE.Color('#6b7176'));
    // canopy on columns
    HM.box(mb, cx + e.nx * (D / 2 + 3), cz + e.nz * (D / 2 + 3), g + 4.4, g + 4.8, W / 2 + 1, 3.2, yaw, HM_WHITE);
    for (const s of [-1, 1]) { const x = cx + tx * s * W / 2 + e.nx * (D / 2 + 5.6), z = cz + tz * s * W / 2 + e.nz * (D / 2 + 5.6); HM.geo(mb, new THREE.CylinderGeometry(0.25, 0.25, 4.4, 12), HM_WHITE, x, g + 2.2, z); HM.obstacle(T, x, z, 0.3); }
    const sg = HM.sign(T, 'GREENVILLE MALL', 13, 3.2, { col: '#ffffff', size: 140, glow: true, bg: '#1f3a5f' }); sg.position.set(cx + e.nx * (D / 2 + 0.08), g + Hh - 1.3, cz + e.nz * (D / 2 + 0.08)); sg.rotation.y = yaw; T.group.add(sg);
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + tx * u * W / 2 + e.nx * v * D / 2, cz + tz * u * W / 2 + e.nz * v * D / 2]); HM.solid(T, ring, g + Hh, 'Greenville Mall');
  }
}

function buildHandmade(T, P) {
  const W = T.W; const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1; const mb = new MB(true);
  for (const B of P.buildings) {
    if (HANDBUILT[B.id]) { const [cx, cz] = centroid(B.ring); if (own(cx, cz)) try { if (HANDBUILT[B.id] === 'localOak') hmLocalOak(T, B, P, mb); else if (HANDBUILT[B.id] === 'wvRow') hmWvRow(T, B, mb); else if (HANDBUILT[B.id] === 'studentCenter') hmStudentCenter(T, B, P, mb); else if (HANDBUILT[B.id] === 'courthouse') hmCourthouse(T, B, P, mb); else if (HANDBUILT[B.id] === 'oldPostOffice') hmOldPostOffice(T, B, P, mb); } catch (e) { console.warn(HANDBUILT[B.id] + ' skipped', e); } continue; }
    const n = (B.tags && B.tags.name) || ''; if (!n) continue; const [cx, cz] = centroid(B.ring); if (!own(cx, cz)) continue;
    try {
      if (n === 'The Cupola') hmCupola(T, B, mb);
      else if (n === 'Joyner Library') hmJoyner(T, B, P, mb);
      else if (n === 'Greenville Amphitheater') hmAmphitheater(T, B, mb, P);
      else if (n === 'Greenville Mall') hmMall(T, B, mb);
    } catch (e) { console.warn('landmark', n, 'skipped', e); }
  }
  for (const r of P.roads) if (r.tags && r.tags.name === 'Wright Circle' && r.pts.length > 5) { const c = centroid(r.pts); if (own(c[0], c[1])) try { hmFountain(T, c[0], c[1], mb); } catch (e) { console.warn('fountain skipped', e); } break; }
  for (const a of P.areas) if (a.tags && a.tags.name === 'Town Common') try { hmTownCommon(T, P, a, mb); } catch (e) { console.warn('Town Common skipped', e); }
  for (const a of P.areas) if (a.tags && a.tags.name === 'Pitt Community College' && /college|university/.test(a.tags.amenity || '')) try { pccGrounds(T, P, a, mb); } catch (e) { console.warn('PCC grounds skipped', e); }
  addMB(T, mb, lmPlainMat());
}

// ---------- the Main Street row across the tracks from the police station, Winterville ----------
// One long one-storey block of shops behind their own false fronts, facing the tracks with angled
// parking in front. North to south: Tie Breakers Sports Bar & Grill (wide, white with black pilasters,
// black bands and dark windows), Railroad Cigar (narrow, wood slats), Coopers Cup (charcoal board and
// batten over a cream shopfront), a sage-green board-and-batten front, Marlins Bar (khaki lap siding),
// Taqueria Tere (brown brick with a corbelled cornice over a cream shopfront), a white shop with big
// windows and a green awning, then plain red brick to the end of the block.
const WV_ROW = [
  { w: 24, h: 5.4, up: '#f2f1ed', low: '#f2f1ed', trim: '#141517', style: 'tiebreakers', name: 'TIE BREAKERS' },
  { w: 5, h: 6.1, up: '#9a6a43', low: '#86593a', trim: '#2a2420', style: 'slats', name: 'RAILROAD CIGAR', bg: '#141414' },
  { w: 10, h: 6.7, up: '#3d4044', low: '#e2d6bd', trim: '#18191b', style: 'batten', name: 'COOPERS CUP', bg: '#141414' },
  { w: 7, h: 6.3, up: '#93a594', low: '#4a4f55', trim: '#24272a', style: 'batten' },
  { w: 6, h: 5.9, up: '#a89c7c', low: '#a89c7c', trim: '#1e1f21', style: 'siding', name: 'MARLINS BAR', bg: '#1e2f4a' },
  { w: 7, h: 6.5, up: '#8b5a3c', low: '#efe7dc', trim: '#6b3e27', style: 'cornice', name: 'TAQUERIA TERE', bg: '#7a1f1f', awn: '#f4f1ec' },
  { w: 8, h: 6.0, up: '#ece7dc', low: '#ece7dc', trim: '#c9c2b4', style: 'plain', awn: '#3f6b4a' },
  { w: 999, h: 5.6, up: '#a4513d', low: '#a4513d', trim: '#7a3526', style: 'brick' },
];
function hmWvRow(T, B, mb) {
  const ring = B.ring; const E = HM.edgesOf(ring); if (!E.length) return; const C = h => new THREE.Color(h);
  const fe = E.slice().sort((p, q) => q.L - p.L)[0];                       // the long street front (faces the tracks)
  const north = fe.a[1] < fe.b[1]; const st = north ? fe.a : fe.b, en = north ? fe.b : fe.a; const L = fe.L;
  const tx = (en[0] - st[0]) / L, tz = (en[1] - st[1]) / L, nx = fe.nx, nz = fe.nz, yaw = Math.atan2(nx, nz);
  const P2 = (sv, o) => [st[0] + tx * sv + nx * o, st[1] + tz * sv + nz * o];
  let g0 = 1e9; for (const [x, z] of ring) g0 = Math.min(g0, H(x, z)); const body = 4.6;
  const GLASS = C('#2b3640'), BLACK = C('#151618');
  // --- the block behind the fronts: brick walls, flat roof ---
  const wb = new MB(true); const W1 = C('#ffffff');
  for (const e of E) { if (e === fe) continue; const nearN = Math.hypot(e.a[0] - st[0], e.a[1] - st[1]) < 1 || Math.hypot(e.b[0] - st[0], e.b[1] - st[1]) < 1;
    if (nearN) { HM.box(mb, e.mx - e.nx * 0.12, e.mz - e.nz * 0.12, g0 - 0.3, g0 + 5.4, e.L / 2 + 0.12, 0.14, Math.atan2(e.nx, e.nz), C('#f2f1ed')); HM.box(mb, e.mx, e.mz, g0 + 5.0, g0 + 5.45, e.L / 2 + 0.15, 0.06, Math.atan2(e.nx, e.nz), BLACK); continue; } // Tie Breakers' white side wall
    wb.quad([e.a[0], g0 - 0.3, e.a[1]], [e.b[0], g0 - 0.3, e.b[1]], [e.b[0], g0 + body, e.b[1]], [e.a[0], g0 + body, e.a[1]], [0, 0], [e.L / 2.6, 0], [e.L / 2.6, (body + 0.3) / 2.6], [0, (body + 0.3) / 2.6], [e.nx, 0, e.nz], W1); }
  { const m = new THREE.Mesh(wb.geo(), hmRedBrickMat()); m.castShadow = m.receiveShadow = true; T.group.add(m); }
  { const ct = ring.map(p => new THREE.Vector2(p[0], p[1])); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(ct, []); } catch (e) { }
    const rc = C('#8d8f91'); for (const t of tris) { const [A, Bv, Cc] = t.map(i => ct[i]); mb.tri([A.x, g0 + body, A.y], [Bv.x, g0 + body, Bv.y], [Cc.x, g0 + body, Cc.y], [0, 0], [0, 0], [0, 0], [0, 1, 0], rc); } }
  HM.solid(T, ring, g0 + body, 'Main Street shops');
  // --- the false fronts ---
  let s0 = 0;
  for (const sg of WV_ROW) {
    const s1 = Math.min(s0 + sg.w, L); if (s1 - s0 < 1.5) break; const sc = (s0 + s1) / 2, hw = (s1 - s0) / 2; const g = H(...P2(sc, 1)); const top = g + sg.h, mid = g + 3.35;
    const up = C(sg.up), low = C(sg.low), trim = C(sg.trim), dark = up.clone().multiplyScalar(0.8);
    const bx = (sv, o, y0, y1, a, d, col) => { const [x, z] = P2(sv, o); HM.box(mb, x, z, y0, y1, a, d, yaw, col); };
    bx(sc, 0.16, mid, top, hw - 0.01, 0.16, up);                                     // upper false front
    bx(sc, 0.06, g0 - 0.3, mid, hw - 0.01, 0.07, low);                               // shopfront wall
    bx(sc, 0.2, top - 0.22, top, hw, 0.22, trim);                                     // cap
    // shopfront: big windows either side of a glass door, black frames
    const dS = sg.style === 'tiebreakers' ? s0 + hw * 1.55 : sc + hw * 0.35; const ww0 = s0 + 0.6, ww1 = s1 - 0.6;
    const pane = (a, b, y0, y1) => { if (b - a < 0.6) return; bx((a + b) / 2, 0.15, y0 - 0.06, y1 + 0.06, (b - a) / 2 + 0.06, 0.03, BLACK); bx((a + b) / 2, 0.17, y0, y1, (b - a) / 2, 0.03, GLASS); const k = Math.max(1, Math.round((b - a) / 1.8)); for (let i = 1; i < k; i++) bx(a + (b - a) * i / k, 0.2, y0, y1, 0.035, 0.03, BLACK); };
    if (sg.style === 'tiebreakers') { // dark screened windows between black pilasters, black bands
      const nb = Math.max(3, Math.round(hw * 2 / 3.6)); for (let i = 0; i <= nb; i++) bx(s0 + 0.3 + (hw * 2 - 0.6) * i / nb, 0.3, g - 0.3, top + (i === Math.round(nb * 0.62) ? 1.6 : 0), i === Math.round(nb * 0.62) ? 0.45 : 0.28, 0.3, BLACK);
      for (let i = 0; i < nb; i++) { const a = s0 + 0.3 + (hw * 2 - 0.6) * i / nb + 0.35, b = s0 + 0.3 + (hw * 2 - 0.6) * (i + 1) / nb - 0.35; if (Math.abs((a + b) / 2 - dS) < 1.8) { bx((a + b) / 2, 0.17, g, g + 2.5, 0.95, 0.03, GLASS); bx((a + b) / 2, 0.19, g, g + 2.5, 0.03, 0.03, BLACK); continue; } bx((a + b) / 2, 0.17, g + 0.25, g + 2.95, (b - a) / 2, 0.03, C('#3a3d41')); }
      bx(sc, 0.22, mid - 0.05, mid + 0.3, hw, 0.22, BLACK);
      // the logo sign on the tall pilaster
      const ps = s0 + 0.3 + (hw * 2 - 0.6) * Math.round(nb * 0.62) / nb; const [x, z] = P2(ps, 0.66);
      const sm = signMesh(T, textTexture([['TIE', 120, '#f4efe4', 70, 800], ['BREAKERS', 120, '#f4efe4', 190, 800]], { w: 512, h: 256, bg: '#b3202a' }), 2.6, 1.3, true); sm.position.set(x, top + 0.2, z); sm.rotation.y = yaw; T.group.add(sm);
    } else {
      pane(ww0, dS - 0.75, g + 0.55, g + 2.85); pane(dS + 0.75, ww1, g + 0.55, g + 2.85);
      bx(dS, 0.15, g, g + 2.6, 0.6, 0.03, BLACK); bx(dS, 0.17, g + 0.05, g + 2.5, 0.5, 0.03, GLASS);   // door
      bx(sc, 0.18, mid - 0.12, mid + 0.04, hw, 0.18, trim);                                           // band over the shopfront
    }
    // texture of the upper front
    if (sg.style === 'batten' || sg.style === 'slats') { const step = sg.style === 'slats' ? 0.16 : 0.45; for (let sv = s0 + 0.2; sv < s1 - 0.1; sv += step) bx(sv, 0.34, mid + 0.1, top - 0.22, sg.style === 'slats' ? 0.035 : 0.03, 0.03, dark);
      for (const sv of [s0 + 0.08, s1 - 0.08]) bx(sv, 0.34, mid, top, 0.08, 0.04, trim); }
    if (sg.style === 'siding') for (let y = mid + 0.25; y < top - 0.3; y += 0.24) bx(sc, 0.33, y, y + 0.03, hw - 0.05, 0.02, dark);
    if (sg.style === 'cornice') { bx(sc, 0.36, top - 0.9, top - 0.75, hw, 0.06, trim); for (let sv = s0 + 0.25; sv < s1 - 0.1; sv += 0.5) bx(sv, 0.38, top - 0.75, top - 0.45, 0.12, 0.07, trim); bx(sc, 0.4, top - 0.45, top - 0.22, hw, 0.08, trim); }
    if (sg.style === 'brick') for (let sv = s0 + 3; sv < s1 - 1; sv += 6) bx(sv, 0.25, g - 0.3, top - 0.2, 0.25, 0.1, trim); // brick piers
    if (sg.awn) bx(sc, 0.75, g + 2.95, g + 3.12, hw - 0.4, 0.7, C(sg.awn));
    if (sg.name && sg.style !== 'tiebreakers') { const sw = Math.min(hw * 2 * 0.8, 6), sh = sw * 180 / 1024; const [x, z] = P2(sc, 0.4);
      const sm = signMesh(T, textTexture([[sg.name, sg.name.length > 12 ? 92 : 110, '#f4efe4', 92, 800]], { w: 1024, h: 180, bg: sg.bg || '#141414' }), sw, sh, true); sm.position.set(x, (mid + top) / 2 + 0.1, z); sm.rotation.y = yaw; T.group.add(sm); }
    s0 = s1; if (s0 >= L - 0.5) break;
  }
}

// ---------- Local Oak Brewing Co., 2564 Railroad St, Winterville ----------
// One-storey white-painted brick with a flat roof, black canvas awning over black-framed glass doors
// and a big storefront window, a lantern, "2564", a whiskey-barrel planter, the name painted on the
// side wall (plain lettering), and the fenced beer garden beside it: a big live oak strung with
// lights over a gravel yard, Adirondack chairs around the tree and picnic tables along the fence.
const HANDBUILT = { 1144052978: 'localOak', 1144052969: 'wvRow', 575376082: 'studentCenter', 1140389745: 'courthouse', 201594204: 'oldPostOffice' }; // OSM building id → builder (the generic building is skipped)
function hmWhiteBrickMat() {
  if (MAT.hmWhiteBrick) return MAT.hmWhiteBrick;
  const c = cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#dcdcd6'; g.fillRect(0, 0, 256, 256);
  const r = mulberry32(77); for (let y = 0, row = 0; y < 256; y += 8, row++) for (let x = (row % 2) * -12; x < 256; x += 24) { const t = r(); g.fillStyle = `rgb(${240 + t * 12 | 0},${240 + t * 12 | 0},${236 + t * 12 | 0})`; g.fillRect(x + 1, y + 1, 22, 6); }
  const t = ctex(c); return MAT.hmWhiteBrick = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}
function hmBulbMat() { return MAT.hmBulbs || (MAT.hmBulbs = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffc96a, emissiveIntensity: 0.5, roughness: 0.4 })); }
function hmLocalOak(T, B, P, mb) {
  const ring = B.ring; const o = minAreaRect(ring); if (!o) return;
  // front = the side facing the street
  const E = streetEdges(ring); const fe = E.find(e => e.L >= 5) || E[0]; if (!fe) return;
  const fx = fe.nx, fz = fe.nz, sx = fz, sz = -fx; const yaw = Math.atan2(fx, fz);
  let mins = 1e9, maxs = -1e9, minf = 1e9, maxf = -1e9; for (const [x, z] of ring) { const s = (x - o.cx) * sx + (z - o.cz) * sz, f = (x - o.cx) * fx + (z - o.cz) * fz; mins = Math.min(mins, s); maxs = Math.max(maxs, s); minf = Math.min(minf, f); maxf = Math.max(maxf, f); }
  const cx = o.cx + sx * (mins + maxs) / 2 + fx * (minf + maxf) / 2, cz = o.cz + sz * (mins + maxs) / 2 + fz * (minf + maxf) / 2;
  const hw = (maxs - mins) / 2, hd = (maxf - minf) / 2;
  const P2 = (s, f) => [cx + sx * s + fx * f, cz + sz * s + fz * f];
  let g0 = 1e9; for (const [x, z] of ring) g0 = Math.min(g0, H(x, z)); const Hb = 5.0;
  const C = h => new THREE.Color(h); const BLACK = C('#1b1c1e'), GLASS = C('#2a3a46'), WHITE = C('#f3f2ee'), WOOD = C('#c99f6e'), WOOD2 = C('#b88d5c'), POST = C('#9c7448');
  const box = (s, f, y0, y1, hs, hf, col, yw = yaw) => { const [x, z] = P2(s, f); HM.box(mb, x, z, g0 + y0, g0 + y1, hs, hf, yw, col); };
  // --- building: white brick walls, roof, parapet cap ---
  const wb = new MB(); const cr = [P2(-hw, hd), P2(hw, hd), P2(hw, -hd), P2(-hw, -hd)];
  for (let i = 0; i < 4; i++) { const a = cr[i], b = cr[(i + 1) % 4]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; wb.quad([a[0], g0 - 0.3, a[1]], [b[0], g0 - 0.3, b[1]], [b[0], g0 + Hb, b[1]], [a[0], g0 + Hb, a[1]], [0, 0], [L / 2.6, 0], [L / 2.6, (Hb + 0.3) / 2.6], [0, (Hb + 0.3) / 2.6], [-nx, 0, -nz], null); }
  { const m = new THREE.Mesh(wb.geo(), hmWhiteBrickMat()); m.castShadow = m.receiveShadow = true; T.group.add(m); }
  box(0, 0, Hb - 0.25, Hb - 0.2, hw - 0.05, hd - 0.05, C('#8d8f91'));                                    // roof
  for (const [s, f, a, b] of [[0, hd, hw + 0.08, 0.12], [0, -hd, hw + 0.08, 0.12], [hw, 0, 0.12, hd], [-hw, 0, 0.12, hd]]) box(s, f, Hb, Hb + 0.12, a, b, C('#e9e8e2')); // cap
  HM.solid(T, cr, g0 + Hb + 0.2, 'Local Oak Brewing Co.');
  // --- storefront: double glass doors with transom, big window, black frames ---
  const ds = -hw * 0.18, ws = Math.min(hw - 2.2, hw * 0.45), ww = Math.min(3.4, hw * 0.75);
  box(ds, hd + 0.03, 0, 3.25, 1.15, 0.07, BLACK); box(ds, hd + 0.08, 0.05, 2.65, 1.0, 0.03, GLASS); box(ds, hd + 0.08, 2.78, 3.15, 1.0, 0.03, GLASS);
  box(ds, hd + 0.1, 0, 2.7, 0.04, 0.04, BLACK); box(ds, hd + 0.1, 2.68, 2.76, 1.05, 0.04, BLACK);         // mullions
  for (const k of [-0.12, 0.12]) box(ds + k, hd + 0.13, 0.9, 1.6, 0.015, 0.03, C('#c6c9cc'));            // pulls
  box(ws, hd + 0.03, 0.3, 3.2, ww / 2 + 0.12, 0.07, BLACK); box(ws, hd + 0.08, 0.38, 3.12, ww / 2, 0.03, GLASS);
  box(ws, hd + 0.1, 2.6, 2.66, ww / 2, 0.035, BLACK); box(ws - ww * 0.22, hd + 0.1, 2.66, 3.12, 0.03, 0.035, BLACK); box(ws + ww * 0.22, hd + 0.1, 2.66, 3.12, 0.03, 0.035, BLACK);
  // --- black canvas awning ---
  { const a0 = -hw + 0.4, a1 = hw - 0.2, out = 1.6, yT = 3.85, yB = 3.3; const A = (s, f, y) => { const [x, z] = P2(s, f); return [x, g0 + y, z]; };
    const n = [fx * 0.5, 0.86, fz * 0.5];
    mb.quad(A(a0, hd, yT), A(a1, hd, yT), A(a1, hd + out, yB), A(a0, hd + out, yB), [0, 0], [0, 0], [0, 0], [0, 0], n, BLACK);
    mb.quad(A(a0, hd + out, yB), A(a1, hd + out, yB), A(a1, hd, yT), A(a0, hd, yT), [0, 0], [0, 0], [0, 0], [0, 0], [-n[0], -n[1], -n[2]], BLACK);
    box((a0 + a1) / 2, hd + out, yB - 0.28, yB, (a1 - a0) / 2, 0.02, BLACK);                            // valance
    for (const s of [a0, a1]) { mb.tri(A(s, hd, yT), A(s, hd + out, yB), A(s, hd + out, yB - 0.28), [0, 0], [0, 0], [0, 0], [sx, 0, sz], BLACK); } }
  // --- lantern, "2564", barrel planter ---
  const ls = ds + 1.75; box(ls, hd + 0.18, 2.25, 2.7, 0.11, 0.11, BLACK); box(ls, hd + 0.18, 2.32, 2.6, 0.08, 0.12, C('#e8e1c8'));
  { const [x, z] = P2(ls, hd + 0.04); const s = signMesh(T, textTexture([['2564', 200, '#2a2f3a', 128, 700]], { w: 512, h: 256 }), 0.62, 0.31, false); s.position.set(x, g0 + 1.95, z); s.rotation.y = yaw; T.group.add(s); }
  { const bs = ws - ww / 2 - 0.65; const [x, z] = P2(bs, hd + 0.55); const y = H(x, z);
    HM.geo(mb, new THREE.CylinderGeometry(0.34, 0.3, 0.85, 14), C('#7a5532'), x, y + 0.42, z); for (const h of [0.15, 0.7]) HM.geo(mb, new THREE.CylinderGeometry(0.35, 0.35, 0.05, 14), C('#3a3a3a'), x, y + h, z);
    const fl = [C('#7b3fa0'), C('#c2283a'), C('#e8c33a'), C('#7b3fa0'), C('#d74f8a')]; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.12 + (i % 3) * 0.07; HM.geo(mb, new THREE.IcosahedronGeometry(i % 2 ? 0.1 : 0.13, 0), i % 3 === 0 ? C('#3f6f2d') : fl[i % 5], x + Math.cos(a) * r, y + 0.92 + (i % 2) * 0.06, z + Math.sin(a) * r); }
    HM.obstacle(T, x, z, 0.4); }
  // --- beer garden on the open side ---
  const Wg = 20, fF = hd - 1.0, fB = -hd - 5;
  const gs = sz > 0 ? 1 : -1; // the beer garden is on the Depot Street (south) side of the building
  const S = t => gs * (hw + t); // t = distance out from the building's side wall
  // gravel yard
  { const A = (t, f) => { const [x, z] = P2(S(t), f); return [x, H(x, z) + 0.04, z]; }; const q = [A(0, fF), A(Wg, fF), A(Wg, fB), A(0, fB)]; if (gs < 0) q.reverse(); mb.quad(q[0], q[1], q[2], q[3], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], C('#cdc6b6')); }
  // privacy fence: front (with a gate by the building), outer side, back
  const fence = (t0, f0, t1, f1, gate) => { const L = Math.hypot(t1 - t0, f1 - f0); const nb = Math.floor(L / 0.15);
    for (let i = 0; i < nb; i++) { const u0 = i / nb, u1 = (i + 1) / nb; if (gate && u0 * L > gate[0] && u1 * L < gate[1]) continue;
      const [xa, za] = P2(S(t0 + (t1 - t0) * u0), f0 + (f1 - f0) * u0), [xb, zb] = P2(S(t0 + (t1 - t0) * u1), f0 + (f1 - f0) * u1); const y = H(xa, za);
      const col = i % 3 === 0 ? WOOD2 : i % 3 === 1 ? WOOD : C('#d2ab7c'); const nx = (zb - za), nz = -(xb - xa), nl = Math.hypot(nx, nz) || 1;
      mb.quad([xa, y - 0.1, za], [xb, y - 0.1, zb], [xb, y + 1.85, zb], [xa, y + 1.85, za], [0, 0], [0, 0], [0, 0], [0, 0], [nx / nl, 0, nz / nl], col);
      mb.quad([xb, y - 0.1, zb], [xa, y - 0.1, za], [xa, y + 1.85, za], [xb, y + 1.85, zb], [0, 0], [0, 0], [0, 0], [0, 0], [-nx / nl, 0, -nz / nl], col);
      if (i % 6 === 0) HM.obstacle(T, (xa + xb) / 2, (za + zb) / 2, 0.35); }
    for (let d = 0; d <= L + 0.01; d += 2.4) { const u = Math.min(1, d / L); const [x, z] = P2(S(t0 + (t1 - t0) * u), f0 + (f1 - f0) * u); HM.geo(mb, new THREE.BoxGeometry(0.1, 2.0, 0.1), POST, x, H(x, z) + 0.9, z); } };
  fence(0, fF, Wg, fF, [1.2, 2.6]); fence(Wg, fF, Wg, fB); fence(Wg, fB, 0, fB);
  // the live oak: thick trunk, spreading limbs, a broad low crown, mulch ring with timber edging
  const tt = Wg * 0.5, tf = (fF + fB) / 2 - 0.5; const [tx, tz] = P2(S(tt), tf); const ty = H(tx, tz);
  HM.geo(mb, new THREE.CylinderGeometry(4.6, 4.6, 0.12, 28), C('#7a5b3e'), tx, ty + 0.06, tz);
  HM.geo(mb, new THREE.CylinderGeometry(4.75, 4.75, 0.22, 28, 1, true), C('#6b4a2f'), tx, ty + 0.11, tz);
  const BARK = C('#4f4135'); HM.geo(mb, new THREE.CylinderGeometry(0.55, 0.85, 2.8, 10), BARK, tx, ty + 1.4, tz);
  const rr = mulberry32(2564); const tips = [];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + rr() * 0.5, len = 4.2 + rr() * 1.8, rise = 1.8 + rr() * 1.2; const ex = tx + Math.cos(a) * len, ez = tz + Math.sin(a) * len, ey = ty + 2.6 + rise;
    const g = new THREE.CylinderGeometry(0.16, 0.38, Math.hypot(len, rise), 7); g.translate(0, Math.hypot(len, rise) / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ex - tx, ey - ty - 2.6, ez - tz).normalize()); g.applyQuaternion(q); g.translate(tx, ty + 2.6, tz); addGeoTo(mb, g, BARK); tips.push([ex, ey, ez, a]); }
  const LEAF = [C('#3d5a2a'), C('#47672f'), C('#355024')];
  for (const [ex, ey, ez] of tips) for (let j = 0; j < 2; j++) { const g = new THREE.IcosahedronGeometry(2.4 + rr() * 1.2, 1); g.scale(1.25, 0.62, 1.25); g.translate(ex + (rr() - 0.5) * 1.5, ey + 0.8 + j * 0.7, ez + (rr() - 0.5) * 1.5); addGeoTo(mb, g, LEAF[((j + Math.floor(ex)) % 3 + 3) % 3]); }
  { const g = new THREE.IcosahedronGeometry(4.2, 1); g.scale(1.2, 0.55, 1.2); g.translate(tx, ty + 7.6, tz); addGeoTo(mb, g, LEAF[0]); }
  HM.obstacle(T, tx, tz, 0.95);
  // string lights: swagged from the limbs out to the fence posts
  const bulbs = new MB(), wire = BLACK; const anchors = []; for (let d = 0; d <= Wg; d += 4) anchors.push([S(d), fF], [S(d), fB]); for (let f = fB + 4; f < fF; f += 4) anchors.push([S(Wg), f]);
  for (const [as, af] of anchors) { const [axp, azp] = P2(as, af); const ay = H(axp, azp) + 2.2; let best = tips[0], bd = 1e9; for (const t of tips) { const d = Math.hypot(t[0] - axp, t[2] - azp); if (d < bd) { bd = d; best = t; } }
    const sx0 = best[0], sy0 = best[1] - 0.6, sz0 = best[2]; const L = Math.hypot(axp - sx0, azp - sz0); const n = Math.max(4, Math.floor(L / 0.7)); let prev = null;
    for (let i = 0; i <= n; i++) { const u = i / n; const x = sx0 + (axp - sx0) * u, z = sz0 + (azp - sz0) * u, y = sy0 + (ay - sy0) * u - Math.sin(u * Math.PI) * Math.min(1.1, L * 0.08);
      const g = new THREE.SphereGeometry(0.065, 6, 4); g.translate(x, y - 0.08, z); addGeoTo(bulbs, g, null);
      if (prev) { const len = Math.hypot(x - prev[0], y - prev[1], z - prev[2]); const w = new THREE.CylinderGeometry(0.012, 0.012, len, 3); w.translate(0, len / 2, 0); w.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x - prev[0], y - prev[1], z - prev[2]).normalize())); w.translate(prev[0], prev[1], prev[2]); addGeoTo(mb, w, wire); }
      prev = [x, y, z]; } }
  { const m = new THREE.Mesh(bulbs.geo(), hmBulbMat()); T.group.add(m); }
  // Adirondack chairs around the tree, facing it
  const chair = (x, z, face, col) => { const y = H(x, z); const c = Math.cos(face), s = Math.sin(face); const L = (u, v) => [x + u * c + v * s, z - u * s + v * c];
    const part = (u, v, y0, y1, a, b, tilt = 0) => { const g = new THREE.BoxGeometry(a * 2, y1 - y0, b * 2); if (tilt) g.rotateX(tilt); const [px, pz] = L(u, v); g.rotateY(face); g.translate(px, y + (y0 + y1) / 2, pz); addGeoTo(mb, g, col); };
    part(0, 0.05, 0.36, 0.42, 0.33, 0.33, -0.12); part(0, -0.36, 0.45, 1.05, 0.3, 0.04, 0.45); for (const u of [-0.38, 0.38]) { part(u, 0.02, 0.58, 0.62, 0.06, 0.38); part(u, 0.28, 0, 0.6, 0.04, 0.04); part(u, -0.25, 0, 0.42, 0.04, 0.04); } HM.obstacle(T, x, z, 0.45); };
  for (let k = 0; k < 4; k++) { const a = (k + 0.3) / 4 * Math.PI * 2 + 0.4; const x = tx + Math.cos(a) * 5.6, z = tz + Math.sin(a) * 5.6; chair(x, z, Math.atan2(tx - x, tz - z), C('#a7abad')); }
  // picnic tables along the outer fence and the back
  const table = (x, z, face) => { const y = H(x, z); const W2 = C('#a8794e'); const c = Math.cos(face), s = Math.sin(face); const L = (u, v) => [x + u * c + v * s, z - u * s + v * c];
    const part = (u, v, y0, y1, a, b) => { const [px, pz] = L(u, v); HM.box(mb, px, pz, y + y0, y + y1, a, b, face, W2); };
    part(0, 0, 0.72, 0.78, 0.9, 0.38); for (const v of [-0.68, 0.68]) part(0, v, 0.42, 0.47, 0.9, 0.14); for (const u of [-0.7, 0.7]) { part(u, -0.3, 0, 0.72, 0.05, 0.05); part(u, 0.3, 0, 0.72, 0.05, 0.05); part(u, 0, 0.38, 0.42, 0.05, 0.75); }
    HM.obstacle(T, x, z, 0.95); };
  const tyaw = Math.atan2(sx * gs, sz * gs);
  for (const f of [fF - 3, (fF + fB) / 2, fB + 3]) { const [x, z] = P2(S(Wg - 1.6), f); table(x, z, tyaw); }
  for (const t of [4, 15]) { const [x, z] = P2(S(t), fB + 1.6); table(x, z, Math.atan2(fx, fz) + Math.PI / 2); }
  // the name painted on the garden-side wall, near the front
  { const s = signMesh(T, textTexture([['LOCAL OAK', 190, '#1f2d55', 96, 800], ['BREWING CO.', 96, '#1f2d55', 200, 700]], { w: 1024, h: 256 }), Math.min(hd * 1.1, 6.4), Math.min(hd * 1.1, 6.4) / 4, false);
    const [x, z] = P2(gs * (hw + 0.04), hd * 0.35); s.position.set(x, g0 + 3.2, z); s.rotation.y = Math.atan2(sx * gs, sz * gs); T.group.add(s); }
}
