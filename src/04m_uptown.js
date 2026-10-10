// =====================================================================
// UPTOWN GREENVILLE LANDMARKS — modelled from photos (Wikimedia Commons, see CREDITS.md) and the National Register
// descriptions:
//   • Pitt County Courthouse (1910, Milburn & Heister): three storeys of tan brick, a tall white Ionic portico with a
//     pediment naming it, a white cornice, a grey hip roof and a three-stage white cupola with clock faces
//   • the old U.S. Post Office on Evans Street (1914): two storeys of cream stucco on a limestone base, a three-arch
//     loggia across the front, a low terra-cotta tile hip roof with deep eaves
//   • Bethel Baptist Church: red brick, white Ionic portico with an oculus in the pediment
//   • Clark-LeClair Stadium's brick clock tower with its purple pyramid roof
// They're found by their OpenStreetMap ids (HANDBUILT in 04g_handmade.js); the generic building is skipped.
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

// a classical portico on the front wall: steps, n columns, entablature (optionally lettered), pediment (optionally with an oculus)
function uptownPortico(T, mb, S, o) {
  const { front: e, top, box, frame } = S; const C = h => new THREE.Color(h); const W = C('#f4f2ec');
  const { tx, tz, Q } = frame(e); const yaw = Math.atan2(e.nx, e.nz); const sc = e.L / 2, wP = Math.min(e.L - 1, o.w), D = o.D;
  const gF = H(...(([x, , z]) => [x, z])(Q(sc, D, 0)));
  const steps = o.steps || 6; for (let k = 0; k < steps; k++) box(e, sc - wP / 2 - 1.2 + k * 0.05, sc + wP / 2 + 1.2 - k * 0.05, D + 2.4 - k * 0.45, 0, gF - 0.3, gF + 0.2 + k * 0.2, C('#d9d3c6'));
  const yb = gF + 0.2 + steps * 0.2, colH = (o.colTop || top) - yb - (o.entH || 2.2), n = o.n;
  for (let i = 0; i < n; i++) { const s = sc - wP / 2 + 0.7 + i * (wP - 1.4) / (n - 1); const [x, , z] = Q(s, D - 0.7, 0); const r = o.colR || 0.45;
    HM.geo(mb, new THREE.CylinderGeometry(r * 0.88, r, colH, 16), W, x, yb + colH / 2, z); HM.geo(mb, new THREE.BoxGeometry(r * 2.5, 0.3, r * 2.5), W, x, yb + 0.15, z); HM.geo(mb, new THREE.BoxGeometry(r * 2.8, 0.35, r * 2), W, x, yb + colH - 0.1, z, 0, yaw, 0); HM.obstacle(T, x, z, r + 0.1); }
  const yE = yb + colH, eH = o.entH ? o.entH * 0.7 : 1.6; box(e, sc - wP / 2, sc + wP / 2, 0, D, yE, yE + eH, W);
  if (o.text) { const sg = HM.sign(T, o.text, wP * 0.8, wP * 0.8 / 4, { col: '#4a4a48', size: 120 }); const [sx, , sz] = Q(sc, D + 0.03, 0); sg.position.set(sx, yE + eH / 2, sz); sg.rotation.y = yaw; T.group.add(sg); }
  const pk = yE + eH + wP * 0.2;
  mb.tri(Q(sc - wP / 2 - 0.3, D + 0.05, yE + eH), Q(sc + wP / 2 + 0.3, D + 0.05, yE + eH), Q(sc, D + 0.05, pk), [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], o.tympanum ? C(o.tympanum) : W);
  if (o.oculus) { const [ox, , oz] = Q(sc, D + 0.1, 0); const r = Math.min(0.8, wP * 0.07); HM.geo(mb, new THREE.CylinderGeometry(r + 0.18, r + 0.18, 0.08, 20).rotateX(Math.PI / 2).rotateY(yaw), W, ox, yE + eH + (pk - yE - eH) * 0.4, oz); HM.geo(mb, new THREE.CylinderGeometry(r, r, 0.1, 20).rotateX(Math.PI / 2).rotateY(yaw), C('#2b3540'), ox + e.nx * 0.03, yE + eH + (pk - yE - eH) * 0.4, oz + e.nz * 0.03); }
  for (const sgn of [-1, 1]) mb.quad(Q(sc + sgn * (wP / 2 + 0.5), D + 0.4, yE + eH - 0.1), Q(sc, D + 0.4, pk + 0.15), Q(sc, -1, pk + 0.15), Q(sc + sgn * (wP / 2 + 0.5), -1, yE + eH - 0.1), [0, 0], [0, 0], [0, 0], [0, 0], [sgn * tx * 0.5, 1, sgn * tz * 0.5], C(o.roof || '#6b7177'));
  box(e, sc - (o.doorW || 1.4), sc + (o.doorW || 1.4), 0.02, 0.12, yb, yb + (o.doorH || 3.2), C('#3a2a1e'));                         // front doors
  addDeck(T, [Q(sc - wP / 2 - 1.2, 0, 0), Q(sc + wP / 2 + 1.2, 0, 0), Q(sc + wP / 2 + 1.2, D + 2.4, 0), Q(sc - wP / 2 - 1.2, D + 2.4, 0)].map(p => [p[0], p[2]]), yb);
  return { sc, Q, yaw };
}

function hmCourthouse(T, B, P, mb) {
  const S = uptownShell(T, B, mb, { name: 'Pitt County Courthouse', street: /3rd/i, h: 15.5, floors: 3, floorH: 4.6, bay: 3.4, winW: 1.3, frontGap: 18, tallFirst: true,
    textured: hmTanBrickMat, base: ['#d8d0bf', 1.1], cornice: ['#f4f2ec', 0.45], belt: 5.6, sill: '#e9e4d8', roof: '#6b7177', rise: 2.6, eave: 0.6, inset: 4.5 });
  if (!S) return; const C = h => new THREE.Color(h); const W = C('#f4f2ec');
  const { Q, yaw } = uptownPortico(T, mb, S, { n: 6, w: 16, D: 4.6, text: 'PITT COUNTY COURT HOUSE' });
  const { front: e, top } = S;
  // the cupola, over the middle of the old building behind the portico
  const [cx, , cz] = Q(e.L / 2, -11, 0); const y0 = top + 2.6;
  HM.box(mb, cx, cz, top, y0 + 2.4, 2.4, 2.4, yaw, W); HM.box(mb, cx, cz, y0 + 2.4, y0 + 2.8, 2.7, 2.7, yaw, W);                       // square base
  const oct = new THREE.CylinderGeometry(1.7, 1.8, 3.2, 8); HM.geo(mb, oct, W, cx, y0 + 4.4, cz, 0, yaw + Math.PI / 8, 0);                // clock stage
  for (let i = 0; i < 4; i++) { const a = yaw + i * Math.PI / 2; const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), pccClockMat()); m.position.set(cx + Math.sin(a) * 1.78, y0 + 4.4, cz + Math.cos(a) * 1.78); m.rotation.y = a; T.group.add(m); }
  HM.geo(mb, new THREE.CylinderGeometry(1.95, 1.95, 0.3, 8), W, cx, y0 + 6.15, cz, 0, yaw + Math.PI / 8, 0);
  for (let i = 0; i < 8; i++) { const a = yaw + (i + 0.5) / 8 * Math.PI * 2; HM.geo(mb, new THREE.CylinderGeometry(0.1, 0.12, 2.0, 8), W, cx + Math.sin(a) * 1.25, y0 + 7.3, cz + Math.cos(a) * 1.25); } // open belfry
  HM.geo(mb, new THREE.CylinderGeometry(1.45, 1.45, 0.3, 8), W, cx, y0 + 8.45, cz, 0, yaw + Math.PI / 8, 0);
  const dome = new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); HM.geo(mb, dome, W, cx, y0 + 8.6, cz);
  HM.geo(mb, new THREE.CylinderGeometry(0.05, 0.1, 1.4, 6), C('#c9a227'), cx, y0 + 10.4, cz);
}

// Bethel Baptist Church: red brick with tall arched windows, a white Ionic portico and an oculus in the pediment
function hmBethelBaptist(T, B, P, mb) {
  const S = uptownShell(T, B, mb, { name: 'Bethel Baptist Church', street: /./, h: 9.5, floors: 1, floorH: 7.5, bay: 3.6, winW: 1.5, frontGap: 9, tallFirst: true,
    textured: hmRedBrickMat, base: ['#cfc6b3', 0.7], cornice: ['#f4f2ec', 0.35], sill: '#e9e4d8', roof: '#4c5257', rise: 3.2, eave: 0.5, inset: 5 });
  if (!S) return; uptownPortico(T, mb, S, { n: 4, w: Math.min(10, S.front.L * 0.8), D: 3.6, steps: 4, entH: 1.6, oculus: true, tympanum: '#cfd3d6', colR: 0.38, doorW: 1.1, doorH: 3.0 });
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

// Clark-LeClair Stadium: the square brick clock tower behind the home-plate stands, purple pyramid roof, cream bands, lettering
function hmClarkTower(T, P, a, mb) {
  const W = T.W; const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1; const C = h => new THREE.Color(h);
  const ring = a.rings && a.rings[0]; if (!ring) return; const [acx, acz] = centroid(ring);
  // the main grandstand inside the stadium: the tower stands behind the middle of its back edge
  let gs = null, ga = 0; for (const B of P.buildings) { const t = B.tags || {}; if (!/grandstand|stadium/.test(t.building || '')) continue; const [x, z] = centroid(B.ring); if (!pointInPoly(x, z, ring)) continue; const ar = Math.abs(signedArea(B.ring)); if (ar > ga) { ga = ar; gs = B; } }
  let x, z, yaw;
  if (gs) { const E = HM.edgesOf(gs.ring).filter(e => e.L > 6); let best = null, bd = -1; for (const e of E) { const d = Math.hypot(e.mx - acx, e.mz - acz); if (d > bd && (e.mx - acx) * e.nx + (e.mz - acz) * e.nz > 0) { bd = d; best = e; } }
    if (!best) return; x = best.mx + best.nx * 3.5; z = best.mz + best.nz * 3.5; yaw = Math.atan2(best.nx, best.nz); }
  else { let far = ring[0], fd = -1; const nr = nearestRoad(acx, acz, 400, r => r.car && r.rank >= 4); for (const p of ring) { const d = nr ? -Math.hypot(p[0] - nr.x, p[1] - nr.z) : Math.hypot(p[0] - acx, p[1] - acz); if (d > fd) { fd = d; far = p; } } x = far[0]; z = far[1]; yaw = Math.atan2(x - acx, z - acz); }
  if (!own(x, z)) return; const g = H(x, z), BR = C('#8d4a35'), CR = C('#e6dcc6'), PU = C('#4b1f78');
  HM.box(mb, x, z, g - 0.3, g + 17, 2.6, 2.6, yaw, BR);                                                    // brick shaft
  for (const y of [g + 1.2, g + 6.5, g + 12.2]) HM.box(mb, x, z, y, y + 0.45, 2.7, 2.7, yaw, CR);              // cream bands
  for (const s of [-1, 1]) for (const t of [-1, 1]) HM.box(mb, x + Math.cos(yaw) * s * 2.35 + Math.sin(yaw) * t * 2.35, z - Math.sin(yaw) * s * 2.35 + Math.cos(yaw) * t * 2.35, g, g + 17, 0.35, 0.35, yaw, CR); // quoins
  HM.box(mb, x, z, g + 17, g + 17.5, 2.95, 2.95, yaw, CR);
  const cap = new THREE.ConeGeometry(3.9, 4.6, 4, 1); cap.rotateY(Math.PI / 4 + yaw); HM.geo(mb, cap, PU, x, g + 19.8, z);                   // purple pyramid roof
  HM.geo(mb, new THREE.CylinderGeometry(0.05, 0.1, 1.6, 6), C('#f2c230'), x, g + 22.8, z);
  for (let i = 0; i < 4; i++) { const a2 = yaw + i * Math.PI / 2; const m = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28), pccClockMat()); m.position.set(x + Math.sin(a2) * 2.64, g + 14.6, z + Math.cos(a2) * 2.64); m.rotation.y = a2; T.group.add(m); }
  const sg = HM.sign(T, 'CLARK-LeCLAIR STADIUM', 4.6, 1.4, { col: '#f2ead6', size: 110 }); sg.position.set(x + Math.sin(yaw) * 2.66, g + 10.2, z + Math.cos(yaw) * 2.66); sg.rotation.y = yaw; T.group.add(sg);
  HM.solid(T, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + Math.cos(yaw) * u * 2.7 + Math.sin(yaw) * v * 2.7, z - Math.sin(yaw) * u * 2.7 + Math.cos(yaw) * v * 2.7]), g + 17.5, 'Clark-LeClair clock tower');
}

// Queen Anne turrets: a round corner tower with a conical roof on houses whose photo-read look asks for one
// (public-data/facades.json "turret": { colour, roof }), on the corner nearest the street
function hmTurrets(T, P, mb) {
  const W = T.W; const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1; const C = h => new THREE.Color(h);
  for (const B of P.buildings) {
    const f = B.facade; if (!f || !f.turret || !B.ring || B.ring.length < 3) continue; const [cx, cz] = centroid(B.ring); if (!own(cx, cz)) continue;
    const nr = nearestRoad(cx, cz, 80, r => r.car); let v = B.ring[0], bd = 1e9;
    for (const p of B.ring) { const d = nr ? Math.hypot(p[0] - nr.x, p[1] - nr.z) : -Math.hypot(p[0] - cx, p[1] - cz); if (d < bd) { bd = d; v = p; } }
    const dx = cx - v[0], dz = cz - v[1], dl = Math.hypot(dx, dz) || 1; const x = v[0] + dx / dl * 1.2, z = v[1] + dz / dl * 1.2; // tucked into the corner
    let g = 1e9; for (const p of B.ring) g = Math.min(g, H(p[0], p[1])); const h = (f.levels || 2) * 3.1 + 1.6, r = f.turret.r || 2.1;
    HM.geo(mb, new THREE.CylinderGeometry(r, r, h + 0.4, 10), C(f.turret.colour || f.colour || '#e8e2d6'), x, g + h / 2 - 0.2, z);
    HM.geo(mb, new THREE.CylinderGeometry(r + 0.15, r + 0.15, 0.25, 10), C('#f4f2ec'), x, g + h, z);
    for (let lv = 0; lv < (f.levels || 2); lv++) for (let k = 0; k < 3; k++) { const a = Math.atan2(-dx, -dz) + (k - 1) * 0.7; HM.geo(mb, new THREE.BoxGeometry(0.75, 1.5, 0.08).rotateY(a), C('#2b3540'), x + Math.sin(a) * (r + 0.02), g + 1.6 + lv * 3.1, z + Math.cos(a) * (r + 0.02)); }
    HM.geo(mb, new THREE.ConeGeometry(r + 0.35, r * 2.2, 10), C(f.turret.roof || f.roof || '#5a5f66'), x, g + h + 0.12 + r * 1.1, z);
    HM.geo(mb, new THREE.CylinderGeometry(0.03, 0.06, 0.9, 6), C('#3a3a3a'), x, g + h + r * 2.2 + 0.5, z);
    HM.obstacle(T, x, z, r);
  }
}

// the street-facing wall of a building (long, and looking straight at a car road)
function hmStreetEdge(B, minL = 8) {
  let best = null, bs = -1e9;
  for (const e of HM.edgesOf(B.ring)) { if (e.L < minL) continue; const nr = nearestRoad(e.mx, e.mz, 120, r => r.car && r.hw !== 'service'); if (!nr) continue;
    const dx = nr.x - e.mx, dz = nr.z - e.mz, dl = Math.hypot(dx, dz) || 1; const face = (dx * e.nx + dz * e.nz) / dl; const s = e.L * Math.max(0, face) - dl * 0.5; if (s > bs) { bs = s; best = e; } }
  return best || HM.edgesOf(B.ring).sort((a, b) => b.L - a.L)[0];
}
// ECU Student Recreation Center: the round brick drum at the entrance, dark brick bands, a white cap, glass at its foot
function hmRecDrum(T, B, mb) {
  const e = hmStreetEdge(B, 20); if (!e) return; const C = h => new THREE.Color(h); const R = 8.5, x = e.mx + e.nx * 2.5, z = e.mz + e.nz * 2.5, g = H(x, z), h = 15;
  HM.geo(mb, new THREE.CylinderGeometry(R, R, h, 32), C('#9c4b36'), x, g + h / 2 - 0.3, z);
  for (const y of [3.6, 7.6, 11.6]) HM.geo(mb, new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.5, 32), C('#6e3226'), x, g + y, z);
  HM.geo(mb, new THREE.CylinderGeometry(R + 0.4, R + 0.4, 1.1, 32), C('#f1eee6'), x, g + h + 0.2, z);
  const glass = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 3.1, 32, 1, true, Math.atan2(e.nx, e.nz) - 1.0, 2.0); HM.geo(mb, glass, C('#2f4250'), x, g + 1.6, z);
  for (let k = 0; k < 10; k++) { const a = Math.atan2(e.nx, e.nz) - 1.0 + k * 0.2 + 0.1; HM.geo(mb, new THREE.BoxGeometry(0.4, 1.2, 0.08).rotateY(a), C('#2b3540'), x + Math.sin(a) * (R + 0.03), g + 9.6, z + Math.cos(a) * (R + 0.03)); } // band of windows
  HM.solid(T, Array.from({ length: 12 }, (_, k) => [x + Math.cos(k / 12 * 6.283) * R, z + Math.sin(k / 12 * 6.283) * R]), g + h, 'Student Recreation Center');
}
// ECU Health Sciences Campus Student Center: the brick clock tower with stone bands and a lit glass lantern, and its own E C U letters
function hmHSClock(T, B, mb) {
  const e = hmStreetEdge(B, 15); if (!e) return; const C = h => new THREE.Color(h); const tx = (e.b[0] - e.a[0]) / e.L, tz = (e.b[1] - e.a[1]) / e.L;
  const x = e.b[0] - tx * 4 + e.nx * 4.5, z = e.b[1] - tz * 4 + e.nz * 4.5, g = H(x, z), yaw = Math.atan2(e.nx, e.nz), s = 2.7;
  HM.box(mb, x, z, g - 0.3, g + 22, s, s, yaw, C('#8f4a36'));
  for (const y of [1.0, 6, 11, 16, 21.2]) HM.box(mb, x, z, g + y, g + y + 0.5, s + 0.12, s + 0.12, yaw, C('#e2d8c4'));
  HM.box(mb, x, z, g + 22, g + 27, s - 0.25, s - 0.25, yaw, C('#4f7fa8'));                                                     // glass lantern
  for (const a of [-1, 1]) for (const b of [-1, 1]) HM.box(mb, x + Math.cos(yaw) * a * (s - 0.3) + Math.sin(yaw) * b * (s - 0.3), z - Math.sin(yaw) * a * (s - 0.3) + Math.cos(yaw) * b * (s - 0.3), g + 22, g + 27, 0.18, 0.18, yaw, C('#f2f0ea'));
  HM.box(mb, x, z, g + 27, g + 27.7, s + 0.3, s + 0.3, yaw, C('#e2d8c4'));
  for (let i = 0; i < 4; i++) { const a = yaw + i * Math.PI / 2; const m = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), pccClockMat()); m.position.set(x + Math.sin(a) * (s + 0.02), g + 18.8, z + Math.cos(a) * (s + 0.02)); m.rotation.y = a; T.group.add(m); }
  HM.solid(T, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + Math.cos(yaw) * u * s + Math.sin(yaw) * v * s, z - Math.sin(yaw) * u * s + Math.cos(yaw) * v * s]), g + 27.7, 'Health Sciences clock tower');
  ecuLetters(T, mb, [e.mx + e.nx * 16, 0, e.mz + e.nz * 16], e.nx, e.nz, 0.85);
}
