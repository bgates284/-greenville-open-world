// =====================================================================
// HAND-BUILT LANDMARKS — places everyone recognises get their own models instead of generated boxes:
//   • the ECU Cupola on the Mall (white columns, drum and copper dome)
//   • Wright Fountain in the middle of Wright Circle
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
  const dome = new THREE.SphereGeometry(R * 0.86, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 1.15, 1); HM.geo(mb, dome, new THREE.Color('#7fa293'), cx, ye + 1.94, cz);
  HM.geo(mb, new THREE.CylinderGeometry(0.06, 0.1, 1.3, 8), new THREE.Color('#c9a227'), cx, ye + 1.94 + R * 0.99 + 0.6, cz);
  HM.geo(mb, new THREE.SphereGeometry(0.16, 10, 8), new THREE.Color('#e0b72d'), cx, ye + 1.94 + R * 0.99 + 1.3, cz);
  addDeck(T, Array.from({ length: 16 }, (_, k) => [cx + Math.cos(k / 16 * 6.283) * (R + 0.7), cz + Math.sin(k / 16 * 6.283) * (R + 0.7)]), g + 0.88);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; HM.obstacle(T, cx + Math.cos(a) * R, cz + Math.sin(a) * R, 0.25); }
}

// Wright Fountain: stone basin, two tiers, a jet of water
function hmFountain(T, x, z, mb) {
  const g = H(x, z);
  HM.geo(mb, new THREE.CylinderGeometry(9, 9, 0.1, 48), HM_BRICK2, x, g + 0.06, z);                                        // brick plaza
  HM.geo(mb, new THREE.CylinderGeometry(4.8, 4.9, 0.6, 40, 1, true), HM_STONE, x, g + 0.3, z);                              // basin wall
  HM.geo(mb, new THREE.CylinderGeometry(5.1, 5.1, 0.12, 40), HM_STONE, x, g + 0.62, z);                                      // coping
  HM.geo(mb, new THREE.CylinderGeometry(0.5, 0.7, 1.6, 16), HM_STONE, x, g + 1.0, z);                                        // pedestal
  const bowl = new THREE.CylinderGeometry(1.8, 0.6, 0.45, 28); HM.geo(mb, bowl, HM_STONE, x, g + 1.9, z);
  HM.geo(mb, new THREE.CylinderGeometry(0.25, 0.35, 0.9, 12), HM_STONE, x, g + 2.5, z);
  HM.geo(mb, new THREE.CylinderGeometry(0.9, 0.3, 0.3, 20), HM_STONE, x, g + 3.0, z);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.75, 40), MAT.hmWater || (MAT.hmWater = new THREE.MeshStandardMaterial({ color: 0x3b6d82, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })));
  water.rotation.x = -Math.PI / 2; water.position.set(x, g + 0.5, z); T.group.add(water);
  const sprayM = MAT.hmSpray || (MAT.hmSpray = new THREE.MeshStandardMaterial({ color: 0xe8f4fa, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false }));
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 12, 1, true), sprayM); jet.position.set(x, g + 4.3, z); jet.rotation.x = Math.PI; T.group.add(jet);
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 1.3, 28, 1, true), sprayM); fall.position.set(x, g + 1.15, z); T.group.add(fall);
  HM.obstacle(T, x, z, 5.0);
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
  addMB(T, mb, lmPlainMat());
}
