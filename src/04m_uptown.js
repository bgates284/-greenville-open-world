// =====================================================================
// UPTOWN GREENVILLE LANDMARKS — modelled from photos (Wikimedia Commons, see CREDITS.md) and the National Register
// descriptions:
//   • Pitt County Courthouse (1910, Milburn & Heister): three storeys of tan brick, a tall white Ionic portico with a
//     pediment naming it, a white cornice, a grey hip roof and a three-stage white cupola with clock faces
//   • the old U.S. Post Office on Evans Street (1914): two storeys of cream stucco on a limestone base, a three-arch
//     loggia across the front, a low terra-cotta tile hip roof with deep eaves
// Both are found by their OpenStreetMap ids (HANDBUILT in 04g_handmade.js); the generic building is skipped.
// =====================================================================
function hmTanBrickMat() {
  if (MAT.hmTanBrick) return MAT.hmTanBrick;
  const c = cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#d9d1c1'; g.fillRect(0, 0, 256, 256);
  const r = mulberry32(9183); for (let y = 0, row = 0; y < 256; y += 8, row++) for (let x = (row % 2) * -12; x < 256; x += 24) { const t = r(); g.fillStyle = `rgb(${194 + t * 26 | 0},${158 + t * 22 | 0},${108 + t * 18 | 0})`; g.fillRect(x + 1, y + 1, 22, 6); }
  return MAT.hmTanBrick = new THREE.MeshStandardMaterial({ map: ctex(c), vertexColors: true, roughness: 0.85 });
}
// the shared pieces: walls with windows, cornice, a hip-roof band, and boxes placed in wall coordinates
function uptownShell(T, B, mb, o) {
  const ring = B.ring, E = HM.edgesOf(ring); if (E.length < 3) return null; const C = h => new THREE.Color(h); const Z0 = [0, 0];
  let g0 = 1e9; for (const [x, z] of ring) g0 = Math.min(g0, H(x, z)); const top = g0 + o.h;
  const wb = new MB(true); const k = 1 / 2.6; const wallCol = C(o.wallTint || '#ffffff');
  const frame = (e) => { const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L; return { tx, tz, Q: (s, out, y) => [e.a[0] + tx * s + e.nx * out, y, e.a[1] + tz * s + e.nz * out] }; };
  const box = (e, s0, s1, o0, o1, y0, y1, col) => { const { tx, tz } = frame(e); const sc = (s0 + s1) / 2, oc = (o0 + o1) / 2; HM.box(mb, e.a[0] + tx * sc + e.nx * oc, e.a[1] + tz * sc + e.nz * oc, y0, y1, Math.abs(s1 - s0) / 2, Math.abs(o1 - o0) / 2, Math.atan2(tx, tz) + Math.PI / 2, col); };
  // the front: the longest wall facing the named street
  const re = o.street; let front = null, fs = -1;
  for (const e of E) { // long, and looking straight at the street
    if (e.L < 6) continue; const nr = nearestRoad(e.mx, e.mz, 34, r => r.car && re.test(r.name || (r.tags && r.tags.name) || '')); if (!nr) continue;
    const dx = nr.x - e.mx, dz = nr.z - e.mz, dl = Math.hypot(dx, dz) || 1; const face = (dx * e.nx + dz * e.nz) / dl; if (face < 0.75) continue;
    const s = e.L * face - dl * 0.8; if (s > fs) { fs = s; front = e; }
  }
  if (!front || fs <= 0) front = E.slice().sort((a, b) => b.L - a.L)[0];
  for (const e of E) {
    const { Q } = frame(e);
    if (o.textured) wb.quad(Q(0, 0, g0 - 0.4), Q(e.L, 0, g0 - 0.4), Q(e.L, 0, top), Q(0, 0, top), [0, (g0 - 0.4) * k], [e.L * k, (g0 - 0.4) * k], [e.L * k, top * k], [0, top * k], [e.nx, 0, e.nz], wallCol);
    else mb.quad(Q(0, 0, g0 - 0.4), Q(e.L, 0, g0 - 0.4), Q(e.L, 0, top), Q(0, 0, top), Z0, Z0, Z0, Z0, [e.nx, 0, e.nz], wallCol);
    if (o.base) box(e, -0.1, e.L + 0.1, -0.05, 0.12, g0 - 0.4, g0 + o.base[1], C(o.base[0]));                      // base course
    box(e, -0.2, e.L + 0.2, -0.05, o.cornice[1], top - 0.7, top, C(o.cornice[0]));                                // cornice
    if (o.belt) box(e, -0.1, e.L + 0.1, -0.05, 0.1, g0 + o.belt - 0.15, g0 + o.belt + 0.15, C(o.cornice[0]));      // belt course
    if (e.L < 3) continue;
    // windows on every floor, skipping where the portico / loggia goes
    const nW = Math.max(1, Math.floor((e.L - 1.5) / o.bay)); const step = e.L / nW;
    for (let i = 0; i < nW; i++) { const s = (i + 0.5) * step;
      if (e === front && Math.abs(s - e.L / 2) < (o.frontGap || 0) / 2) continue;
      for (let f = 0; f < o.floors; f++) { const y0 = g0 + (o.base ? o.base[1] : 0) + f * o.floorH + o.floorH * 0.22, y1 = y0 + o.floorH * (f === 0 && o.tallFirst ? 0.68 : 0.58);
        box(e, s - o.winW / 2 - 0.12, s + o.winW / 2 + 0.12, 0, 0.08, y0 - 0.12, y1 + 0.12, C(o.winFrame || '#f2f0ea'));
        box(e, s - o.winW / 2, s + o.winW / 2, 0.05, 0.1, y0, y1, C('#2b3540'));
        box(e, s - 0.04, s + 0.04, 0.1, 0.14, y0, y1, C(o.winFrame || '#f2f0ea')); box(e, s - o.winW / 2, s + o.winW / 2, 0.1, 0.14, (y0 + y1) / 2 - 0.04, (y0 + y1) / 2 + 0.04, C(o.winFrame || '#f2f0ea'));
        if (o.sill) box(e, s - o.winW / 2 - 0.2, s + o.winW / 2 + 0.2, 0, 0.18, y0 - 0.25, y0 - 0.1, C(o.sill)); } }
  }
  // flat roof inside a hip-roof band (overhanging eaves)
  { const ct = ring.map(p => new THREE.Vector2(p[0], p[1])); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(ct, []); } catch (e) { }
    const rc = C(o.roof); for (const t of tris) { const [A, Bv, Cc] = t.map(i => ct[i]); mb.tri([A.x, top + o.rise, A.y], [Bv.x, top + o.rise, Bv.y], [Cc.x, top + o.rise, Cc.y], Z0, Z0, Z0, [0, 1, 0], rc); }
    const n = ring.length, sa = signedArea(ring); const N = []; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6; let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } N.push([nx, nz, L]); }
    const O = [], I = []; for (let i = 0; i < n; i++) { const n1 = N[(i + n - 1) % n], n2 = N[i]; let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const kk = Math.min(1.8, 1 / Math.max(0.4, mx * n2[0] + mz * n2[1])); const p = ring[i]; O.push([p[0] + mx * o.eave * kk, p[1] + mz * o.eave * kk]); I.push([p[0] - mx * o.inset * kk, p[1] - mz * o.inset * kk]); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (N[i][2] < 0.05) continue;
      mb.quad([O[i][0], top - 0.15, O[i][1]], [O[j][0], top - 0.15, O[j][1]], [I[j][0], top + o.rise, I[j][1]], [I[i][0], top + o.rise, I[i][1]], Z0, Z0, Z0, Z0, [N[i][0], 1.3, N[i][1]], rc);
      mb.quad([ring[i][0], top - 0.15, ring[i][1]], [ring[j][0], top - 0.15, ring[j][1]], [O[j][0], top - 0.15, O[j][1]], [O[i][0], top - 0.15, O[i][1]], Z0, Z0, Z0, Z0, [0, -1, 0], C(o.soffit || o.cornice[0])); } } // soffit under the eaves
  if (o.textured) { const m = new THREE.Mesh(wb.geo(), o.textured()); m.castShadow = m.receiveShadow = true; T.group.add(m); }
  HM.solid(T, ring, top, o.name);
  return { E, front, g0, top, box, frame };
}

function hmCourthouse(T, B, P, mb) {
  const S = uptownShell(T, B, mb, { name: 'Pitt County Courthouse', street: /3rd/i, h: 15.5, floors: 3, floorH: 4.6, bay: 3.4, winW: 1.3, frontGap: 18, tallFirst: true,
    textured: hmTanBrickMat, base: ['#d8d0bf', 1.1], cornice: ['#f4f2ec', 0.45], belt: 5.6, sill: '#e9e4d8', roof: '#6b7177', rise: 2.6, eave: 0.6, inset: 4.5 });
  if (!S) return; const { front: e, g0, top, box, frame } = S; const C = h => new THREE.Color(h); const W = C('#f4f2ec');
  const { tx, tz, Q } = frame(e); const yaw = Math.atan2(e.nx, e.nz); const sc = e.L / 2, wP = Math.min(e.L - 1, 16), D = 4.6;
  // steps + podium, six tall Ionic columns, entablature with the name, pediment
  const gF = H(...(([x, , z]) => [x, z])(Q(sc, D, 0)));
  for (let k = 0; k < 6; k++) box(e, sc - wP / 2 - 1.2 + k * 0.05, sc + wP / 2 + 1.2 - k * 0.05, D + 2.4 - k * 0.45, 0, gF - 0.3, gF + 0.2 + k * 0.2, C('#d9d3c6'));
  const yb = gF + 1.4, colH = top - yb - 2.2, n = 6;
  for (let i = 0; i < n; i++) { const s = sc - wP / 2 + 0.7 + i * (wP - 1.4) / (n - 1); const [x, , z] = Q(s, D - 0.7, 0);
    HM.geo(mb, new THREE.CylinderGeometry(0.42, 0.5, colH, 16), W, x, yb + colH / 2, z); HM.geo(mb, new THREE.BoxGeometry(1.15, 0.3, 1.15), W, x, yb + 0.15, z); HM.geo(mb, new THREE.BoxGeometry(1.25, 0.35, 0.9), W, x, yb + colH - 0.1, z, 0, yaw, 0); HM.obstacle(T, x, z, 0.55); }
  const yE = yb + colH; box(e, sc - wP / 2, sc + wP / 2, 0, D, yE, yE + 1.6, W);
  const sg = HM.sign(T, 'PITT COUNTY COURT HOUSE', wP * 0.8, wP * 0.8 / 4, { col: '#4a4a48', size: 120 }); const [sx, , sz] = Q(sc, D + 0.03, 0); sg.position.set(sx, yE + 0.8, sz); sg.rotation.y = yaw; T.group.add(sg);
  const pk = yE + 1.6 + wP * 0.2; const P2 = (s, out, y) => Q(s, out, y);
  mb.tri(P2(sc - wP / 2 - 0.3, D + 0.05, yE + 1.6), P2(sc + wP / 2 + 0.3, D + 0.05, yE + 1.6), P2(sc, D + 0.05, pk), [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], W);
  for (const sgn of [-1, 1]) mb.quad(P2(sc + sgn * (wP / 2 + 0.5), D + 0.4, yE + 1.5), P2(sc, D + 0.4, pk + 0.15), P2(sc, -1, pk + 0.15), P2(sc + sgn * (wP / 2 + 0.5), -1, yE + 1.5), [0, 0], [0, 0], [0, 0], [0, 0], [sgn * tx * 0.5, 1, sgn * tz * 0.5], C('#6b7177'));
  box(e, sc - 1.4, sc + 1.4, 0.02, 0.12, gF + 1.4, gF + 4.6, C('#3a2a1e'));                                                    // front doors
  addDeck(T, [Q(sc - wP / 2 - 1.2, 0, 0), Q(sc + wP / 2 + 1.2, 0, 0), Q(sc + wP / 2 + 1.2, D + 2.4, 0), Q(sc - wP / 2 - 1.2, D + 2.4, 0)].map(p => [p[0], p[2]]), gF + 1.4);
  // the cupola, over the middle of the old building behind the portico
  const [cx, , cz] = Q(sc, -11, 0); const y0 = top + 2.6;
  HM.box(mb, cx, cz, top, y0 + 2.4, 2.4, 2.4, yaw, W); HM.box(mb, cx, cz, y0 + 2.4, y0 + 2.8, 2.7, 2.7, yaw, W);                       // square base
  const oct = new THREE.CylinderGeometry(1.7, 1.8, 3.2, 8); HM.geo(mb, oct, W, cx, y0 + 4.4, cz, 0, yaw + Math.PI / 8, 0);                // clock stage
  for (let i = 0; i < 4; i++) { const a = yaw + i * Math.PI / 2; const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), pccClockMat()); m.position.set(cx + Math.sin(a) * 1.78, y0 + 4.4, cz + Math.cos(a) * 1.78); m.rotation.y = a; T.group.add(m); }
  HM.geo(mb, new THREE.CylinderGeometry(1.95, 1.95, 0.3, 8), W, cx, y0 + 6.15, cz, 0, yaw + Math.PI / 8, 0);
  for (let i = 0; i < 8; i++) { const a = yaw + (i + 0.5) / 8 * Math.PI * 2; HM.geo(mb, new THREE.CylinderGeometry(0.1, 0.12, 2.0, 8), W, cx + Math.sin(a) * 1.25, y0 + 7.3, cz + Math.cos(a) * 1.25); } // open belfry
  HM.geo(mb, new THREE.CylinderGeometry(1.45, 1.45, 0.3, 8), W, cx, y0 + 8.45, cz, 0, yaw + Math.PI / 8, 0);
  const dome = new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); HM.geo(mb, dome, W, cx, y0 + 8.6, cz);
  HM.geo(mb, new THREE.CylinderGeometry(0.05, 0.1, 1.4, 6), C('#c9a227'), cx, y0 + 10.4, cz);
}

function hmOldPostOffice(T, B, P, mb) {
  const S = uptownShell(T, B, mb, { name: 'U.S. Post Office (1914)', street: /Evans/i, h: 10.2, floors: 2, floorH: 4.2, bay: 4.2, winW: 1.5, frontGap: 17, tallFirst: true,
    wallTint: '#efe6d2', base: ['#d6ccb8', 1.3], cornice: ['#f4efe3', 0.3], sill: '#d6ccb8', roof: '#b5523b', rise: 1.8, eave: 1.3, inset: 4, soffit: '#d9cfbb', winFrame: '#f7f4ec' });
  if (!S) return; const { front: e, g0, box, frame } = S; const C = h => new THREE.Color(h);
  const { Q } = frame(e); const yaw = Math.atan2(e.nx, e.nz); const sc = e.L / 2;
  // the three-arch loggia: deep shadowed arches on Tuscan columns, keystones, steps up to it
  const aw = 4.0, ah = 6.4, yA = g0 + 1.3;
  for (let i = -1; i <= 1; i++) { const s = sc + i * (aw + 0.9);
    const sh = new THREE.Shape(); sh.moveTo(-aw / 2, 0); sh.lineTo(aw / 2, 0); sh.lineTo(aw / 2, ah - aw / 2); sh.absarc(0, ah - aw / 2, aw / 2, 0, Math.PI, false); sh.lineTo(-aw / 2, 0);
    const g = new THREE.ShapeGeometry(sh, 12); g.rotateY(yaw); const [x, , z] = Q(s, 0.06, 0); HM.geo(mb, g, C('#2a2c2e'), x, yA, z);
    box(e, s - 0.35, s + 0.35, 0, 0.35, yA + ah - 0.55, yA + ah + 0.15, C('#f4efe3'));                                             // keystone
    box(e, s - aw / 2 + 0.2, s + aw / 2 - 0.2, 0.08, 0.14, yA + 0.4, yA + ah - aw / 2 - 0.3, C('#3d4a52'));                        // glazing behind
  }
  for (let i = -2; i <= 1; i++) { const s = sc + (i + 0.5) * (aw + 0.9); const [x, , z] = Q(s, 0.45, 0); HM.geo(mb, new THREE.CylinderGeometry(0.32, 0.38, ah - aw / 2, 12), C('#f4efe3'), x, yA + (ah - aw / 2) / 2, z); }
  for (let k = 0; k < 5; k++) box(e, sc - 8 + k * 0.1, sc + 8 - k * 0.1, 3.4 - k * 0.6, 0, g0 - 0.3, g0 + 0.3 + k * 0.25, C('#d6ccb8')); // steps
  const sg = HM.sign(T, 'UNITED STATES POST OFFICE', 10, 1.1, { col: '#6a5f4e', size: 110 }); const [sx, , sz] = Q(sc, 0.16, 0); sg.position.set(sx, yA + ah + 0.9, sz); sg.rotation.y = yaw; T.group.add(sg);
}
