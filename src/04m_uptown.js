// =====================================================================
// UPTOWN GREENVILLE LANDMARKS — modelled from photos (Wikimedia Commons, see CREDITS.md) and the National Register
// descriptions:
//   • Pitt County Courthouse (1910, Milburn & Heister): three storeys of buff brick, a copper-green hip roof, a tall white portico with a
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
  const { tx, tz, Q } = frame(e); const yaw = Math.atan2(e.nx, e.nz); const sc = o.sc != null ? o.sc : e.L / 2, wP = Math.min(e.L - 1, o.w), D = o.D;
  const gF = H(...(([x, , z]) => [x, z])(Q(sc, D, 0)));
  const steps = o.steps || 6; for (let k = 0; k < steps; k++) box(e, sc - wP / 2 - 1.2 + k * 0.05, sc + wP / 2 + 1.2 - k * 0.05, D + 2.4 - k * 0.45, 0, gF - 0.3, gF + 0.2 + k * 0.2, C('#d9d3c6'));
  const yb = gF + 0.2 + steps * 0.2, colH = (o.colTop || top) - yb - (o.entH || 2.2), n = o.n;
  for (let i = 0; i < n; i++) { const s = sc - wP / 2 + 0.7 + i * (wP - 1.4) / (n - 1); const [x, , z] = Q(s, D - 0.7, 0); const r = o.colR || 0.45;
    HM.geo(mb, new THREE.CylinderGeometry(r * 0.88, r, colH, 16), W, x, yb + colH / 2, z); HM.geo(mb, new THREE.BoxGeometry(r * 2.5, 0.3, r * 2.5), W, x, yb + 0.15, z); HM.geo(mb, new THREE.BoxGeometry(r * 2.8, 0.35, r * 2), W, x, yb + colH - 0.1, z, 0, yaw, 0); HM.obstacle(T, x, z, r + 0.1); }
  const yE = yb + colH, eH = o.entH ? o.entH * 0.7 : 1.6; box(e, sc - wP / 2, sc + wP / 2, 0, D, yE, yE + eH, W);
  if (o.text) { const sg = HM.sign(T, o.text, wP * 0.8, wP * 0.8 / 4, { col: '#4a4a48', size: 120 }); const [sx, , sz] = Q(sc, D + 0.03, 0); sg.position.set(sx, yE + eH / 2, sz); sg.rotation.y = yaw; T.group.add(sg); }
  if (o.flat) { box(e, sc - wP / 2 - 0.2, sc + wP / 2 + 0.2, 0, D + 0.2, yE + eH, yE + eH + 0.5, W); box(e, sc - (o.doorW || 1.4), sc + (o.doorW || 1.4), 0.02, 0.12, yb, yb + (o.doorH || 3.2), C('#3a2a1e')); return { sc, Q, yaw }; } // in antis on a side wall: entablature and a flat parapet, no pediment
  const pk = yE + eH + wP * 0.2;
  mb.tri(Q(sc - wP / 2 - 0.3, D + 0.05, yE + eH), Q(sc + wP / 2 + 0.3, D + 0.05, yE + eH), Q(sc, D + 0.05, pk), [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], o.tympanum ? C(o.tympanum) : W);
  if (o.oculus) { const [ox, , oz] = Q(sc, D + 0.1, 0); const r = Math.min(0.8, wP * 0.07); HM.geo(mb, new THREE.CylinderGeometry(r + 0.18, r + 0.18, 0.08, 20).rotateX(Math.PI / 2).rotateY(yaw), W, ox, yE + eH + (pk - yE - eH) * 0.4, oz); HM.geo(mb, new THREE.CylinderGeometry(r, r, 0.1, 20).rotateX(Math.PI / 2).rotateY(yaw), C('#2b3540'), ox + e.nx * 0.03, yE + eH + (pk - yE - eH) * 0.4, oz + e.nz * 0.03); }
  for (const sgn of [-1, 1]) mb.quad(Q(sc + sgn * (wP / 2 + 0.5), D + 0.4, yE + eH - 0.1), Q(sc, D + 0.4, pk + 0.15), Q(sc, -1, pk + 0.15), Q(sc + sgn * (wP / 2 + 0.5), -1, yE + eH - 0.1), [0, 0], [0, 0], [0, 0], [0, 0], [sgn * tx * 0.5, 1, sgn * tz * 0.5], C(o.roof || '#6b7177'));
  box(e, sc - (o.doorW || 1.4), sc + (o.doorW || 1.4), 0.02, 0.12, yb, yb + (o.doorH || 3.2), C('#3a2a1e'));                         // front doors
  addDeck(T, [Q(sc - wP / 2 - 1.2, 0, 0), Q(sc + wP / 2 + 1.2, 0, 0), Q(sc + wP / 2 + 1.2, D + 2.4, 0), Q(sc - wP / 2 - 1.2, D + 2.4, 0)].map(p => [p[0], p[2]]), yb);
  return { sc, Q, yaw };
}

// Pitt County Courthouse (1910): a buff-brick block of three storeys with a copper-green hip roof, a pedimented
// six-column portico on Third Street, a second colonnade on the Evans Street side, and the tall white clock
// cupola — square base, clock stage with four faces, open belfry, dark ribbed dome. The plainer later wings
// spread behind it (the county's footprint takes in the whole complex). The Confederate monument on the Evans Street lawn (removed in 2020; shown as it stood), a flag either side.
function hmCourthouse(T, B, P, mb) {
  const C = h => new THREE.Color(h), W = C('#f4f2ec');
  // the 1910 block's front wall: the long wall facing 3rd Street (the portico juts out from its middle)
  // the footprint takes in the portico: find its face (the wall nearest 3rd Street), then the main front wall just behind it
  const E0 = HM.edgesOf(B.ring); let pe = null, pd = 1e9;
  for (const e of E0) { if (e.L < 10) continue; const nr = nearestRoad(e.mx, e.mz, 45, r => r.car && /3rd/i.test(r.name || '')); if (!nr) continue; const dx = nr.x - e.mx, dz = nr.z - e.mz, dl = Math.hypot(dx, dz) || 1; if ((dx * e.nx + dz * e.nz) / dl > 0.7 && dl < pd) { pd = dl; pe = e; } }
  if (!pe) { hmCourthouseSimple(T, B, P, mb); return; }
  let fe;
  { const ptx = (pe.b[0] - pe.a[0]) / pe.L, ptz = (pe.b[1] - pe.a[1]) / pe.L, UV = B.ring.map(([x, z]) => [(x - pe.a[0]) * ptx + (z - pe.a[1]) * ptz, -((x - pe.a[0]) * pe.nx + (z - pe.a[1]) * pe.nz)]);
    let vF = 1e9; for (const [, v] of UV) if (v > 1.5 && v < 12) vF = Math.min(vF, v); if (vF > 1e8) vF = 0;
    let u0 = 0, u1 = pe.L; for (const [u, v] of UV) if (Math.abs(v - vF) < 1.2) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
    const A = [pe.a[0] + ptx * u0 - pe.nx * vF, pe.a[1] + ptz * u0 - pe.nz * vF], Bq = [pe.a[0] + ptx * u1 - pe.nx * vF, pe.a[1] + ptz * u1 - pe.nz * vF];
    fe = { a: A, b: Bq, L: u1 - u0, nx: pe.nx, nz: pe.nz, mx: (A[0] + Bq[0]) / 2, mz: (A[1] + Bq[1]) / 2 }; }
  const tx = (fe.b[0] - fe.a[0]) / fe.L, tz = (fe.b[1] - fe.a[1]) / fe.L, DEP = Math.min(30, fe.L * 0.85);
  const at = (s, v) => [fe.a[0] + tx * s - fe.nx * v, fe.a[1] + tz * s - fe.nz * v]; // s along the front, v back into the block
  let main = [at(0, 0), at(fe.L, 0), at(fe.L, DEP), at(0, DEP)]; if (signedArea(main) < 0) main.reverse();
  // which end of the front is the Evans Street corner (the side colonnade)
  const ev = nearestRoad(...at(fe.L + 4, DEP / 2), 30, r => r.car && /Evans/i.test(r.name || '')), ew = nearestRoad(...at(-4, DEP / 2), 30, r => r.car && /Evans/i.test(r.name || ''));
  const evansAtB = !ew || (ev && ev.d <= ew.d);
  // the later wings: the rest of the footprint, kept just inside the old block's walls (and off the porticoes)
  const big = 400; let win = [at(-big, 0.45), at(evansAtB ? fe.L - 0.45 : big, 0.45), at(evansAtB ? fe.L - 0.45 : big, big), at(-big, big)];
  if (!evansAtB) win = [at(0.45, 0.45), at(big, 0.45), at(big, big), at(0.45, big)];
  if (signedArea(win) < 0) win.reverse(); let rest = clipConvex(B.ring, win); if (signedArea(rest) < 0) rest = rest.slice().reverse();
  if (rest.length >= 3 && Math.abs(signedArea(rest)) > 200)
    uptownShell(T, { ring: rest }, mb, { name: 'Pitt County Courthouse', street: /2nd|Washington|3rd/i, h: 11.5, floors: 2, floorH: 4.4, bay: 3.6, winW: 1.4, frontGap: 0,
      textured: hmTanBrickMat, base: ['#d8d0bf', 0.8], cornice: ['#efe8d8', 0.3], sill: '#e9e4d8', roof: '#8d9093', rise: 0.01, eave: 0.05, inset: 0.05 });
  const S = uptownShell(T, { ring: main }, mb, { name: 'Pitt County Courthouse', street: /3rd/i, h: 15.5, floors: 3, floorH: 4.6, bay: 3.4, winW: 1.3, frontGap: 18, tallFirst: true,
    textured: hmTanBrickMat, base: ['#d8d0bf', 1.1], cornice: ['#f4f2ec', 0.45], belt: 5.6, sill: '#e9e4d8', roof: '#5f8f86', rise: 6.5, eave: 0.7, inset: Math.min(12, DEP / 2 - 2) });
  if (!S) return;
  const { Q, yaw } = uptownPortico(T, mb, S, { n: 6, w: 16, D: 4.6, text: 'PITT COUNTY COURT HOUSE', roof: '#5f8f86' });
  // the Evans Street colonnade: six columns between the side wall's ends, toward the front
  let monAt = null;
  { const side = S.E.filter(e => e !== S.front && Math.abs(e.nx * S.front.nx + e.nz * S.front.nz) < 0.3).sort((p, q) => { const px = (evansAtB ? fe.b : fe.a); return Math.hypot(p.mx - px[0], p.mz - px[1]) - Math.hypot(q.mx - px[0], q.mz - px[1]); })[0];
    if (side) { const nearFront = Math.hypot(side.a[0] - fe.mx, side.a[1] - fe.mz) < Math.hypot(side.b[0] - fe.mx, side.b[1] - fe.mz); const sc = nearFront ? Math.min(side.L - 8, 3 + 7.5) : Math.max(8, side.L - 3 - 7.5);
      uptownPortico(T, mb, { ...S, front: side }, { n: 6, w: 14, D: 3.8, steps: 6, sc, roof: '#5f8f86' }); { const { Q: Qs } = S.frame(side); monAt = { Q: Qs, sc, yaw: Math.atan2(side.nx, side.nz) }; } // pedimented too, up a flight of steps
      for (const sg of [-1, 1]) { const { Q: Qs } = S.frame(side); for (let k = 0; k < 4; k++) { const [x, , z] = Qs(sc + sg * 8.3, 6.0 - k * 1.3, 0); HM.geo(mb, new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), C('#3a3d40'), x, H(x, z) + 0.6 + k * 0.28, z); } } } } // stair railings
  // rusticated ground storey (banded joints) and stone quoins at the corners, as in the photos
  { const RJ = C('#b9a888'), QN = C('#e6dcc6');
    for (const e of S.E) { if (e.L < 3) continue; for (let y = S.g0 + 1.7; y < S.g0 + 5.4; y += 0.62) S.box(e, 0, e.L, -0.02, 0.06, y, y + 0.07, RJ);
      for (let k = 0; ; k++) { const y0 = S.g0 + 5.6 + k * 0.9; if (y0 + 0.75 > S.top - 0.7) break; const w = k % 2 ? 0.7 : 1.1; S.box(e, 0, w, -0.04, 0.08, y0, y0 + 0.75, QN); S.box(e, e.L - w, e.L, -0.04, 0.08, y0, y0 + 0.75, QN); } } }
  // the cupola over the middle of the old block
  const top = S.top, [cx, , cz] = Q(fe.L / 2, -DEP / 2, 0), y0 = top + 6.3, DOME = C('#3d4954');
  HM.box(mb, cx, cz, top + 2, y0 + 2.2, 3.1, 3.1, yaw, W); HM.box(mb, cx, cz, y0 + 2.2, y0 + 2.7, 3.4, 3.4, yaw, W);                                 // square base on the roof
  HM.box(mb, cx, cz, y0 + 2.7, y0 + 6.6, 2.6, 2.6, yaw, W);                                                                                         // clock stage
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) HM.box(mb, cx + Math.cos(yaw) * sx * 2.45 + Math.sin(yaw) * sz * 2.45, cz - Math.sin(yaw) * sx * 2.45 + Math.cos(yaw) * sz * 2.45, y0 + 2.7, y0 + 6.6, 0.35, 0.35, yaw, C('#ffffff')); // corner pilasters
  for (let i = 0; i < 4; i++) { const a = yaw + i * Math.PI / 2; const m = new THREE.Mesh(new THREE.CircleGeometry(1.05, 28), pccClockMat()); m.position.set(cx + Math.sin(a) * 2.64, y0 + 4.8, cz + Math.cos(a) * 2.64); m.rotation.y = a; T.group.add(m); }
  HM.box(mb, cx, cz, y0 + 6.6, y0 + 7.1, 2.95, 2.95, yaw, W);                                                                                       // cornice
  HM.geo(mb, new THREE.CylinderGeometry(2.2, 2.3, 0.4, 8), W, cx, y0 + 7.3, cz, 0, yaw + Math.PI / 8, 0);
  for (let i = 0; i < 8; i++) { const a = yaw + (i + 0.5) / 8 * Math.PI * 2; HM.geo(mb, new THREE.CylinderGeometry(0.16, 0.19, 3.0, 10), W, cx + Math.sin(a) * 1.85, y0 + 9.0, cz + Math.cos(a) * 1.85); } // open belfry
  HM.geo(mb, new THREE.CylinderGeometry(1.3, 1.3, 3.0, 8), C('#2a3036'), cx, y0 + 9.0, cz, 0, yaw + Math.PI / 8, 0);                              // shadowed interior
  HM.geo(mb, new THREE.CylinderGeometry(2.25, 2.25, 0.5, 8), W, cx, y0 + 10.75, cz, 0, yaw + Math.PI / 8, 0);
  const dome = new THREE.SphereGeometry(1.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 1.15, 1); HM.geo(mb, dome, DOME, cx, y0 + 11.0, cz);
  for (let i = 0; i < 8; i++) { const a = yaw + i / 8 * Math.PI * 2; const rib = new THREE.TorusGeometry(1.92, 0.05, 4, 12, Math.PI / 2); rib.scale(1, 1.15, 1); rib.rotateY(-a); HM.geo(mb, rib, W, cx, y0 + 11.0, cz, 0, 0, 0); } // ribs
  HM.geo(mb, new THREE.SphereGeometry(0.25, 10, 6), W, cx, y0 + 13.3, cz); HM.geo(mb, new THREE.CylinderGeometry(0.04, 0.09, 1.6, 6), C('#c9a227'), cx, y0 + 14.2, cz);
  // the Confederate monument (1914, removed 2020 — shown here as it stood) on the Evans Street lawn, a flag either side
  const fm = new MB(true);
  if (monAt) { const [x, , z] = monAt.Q(monAt.sc, 13, 0); if (!onRoadSurface(x, z)) { courthouseMonument(T, mb, x, z, monAt.yaw); const tx = Math.cos(monAt.yaw), tz = -Math.sin(monAt.yaw);
      for (const [o, kind] of [[-6.5, 'us'], [6.5, 'nc']]) { const fx = x + tx * o, fz = z + tz * o; if (!onRoadSurface(fx, fz)) flagpoleK(T, fm, fx, fz, kind, 12); } } }
  else for (const [s, kind] of [[fe.L / 2 - 12, 'us'], [fe.L / 2 + 12, 'nc']]) { const [x, , z] = Q(s, 9, 0); if (!onRoadSurface(x, z)) flagpoleK(T, fm, x, z, kind, 11); }
  addMB(T, fm, lmPlainMat());
}
// granite base in three steps, a die with the inscription and a round medallion, a tall shaft with a cap, and a
// bronze soldier standing at parade rest on top
function courthouseMonument(T, mb, x, z, yaw) {
  const C = h => new THREE.Color(h), GR = C('#d6d2c8'), GR2 = C('#c8c3b8'), BZ = C('#4f5a4e'), g = H(x, z);
  HM.box(mb, x, z, g - 0.3, g + 0.35, 2.4, 2.4, yaw, GR2); HM.box(mb, x, z, g + 0.35, g + 0.75, 1.9, 1.9, yaw, GR); HM.box(mb, x, z, g + 0.75, g + 1.15, 1.45, 1.45, yaw, GR2);
  HM.box(mb, x, z, g + 1.15, g + 3.0, 1.05, 1.05, yaw, GR); HM.box(mb, x, z, g + 3.0, g + 3.35, 1.2, 1.2, yaw, GR2);                      // die and its cap
  HM.box(mb, x, z, g + 3.35, g + 4.0, 0.85, 0.85, yaw, GR);
  const sh = new THREE.CylinderGeometry(0.42, 0.62, 6.2, 4); sh.rotateY(Math.PI / 4); HM.geo(mb, sh, GR, x, g + 7.1, z, 0, yaw, 0);           // tapering shaft
  HM.box(mb, x, z, g + 10.2, g + 10.55, 0.75, 0.75, yaw, GR2); HM.box(mb, x, z, g + 10.55, g + 10.8, 0.55, 0.55, yaw, GR);
  // the soldier (about 2 m), facing out over the lawn
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), y = g + 10.8;
  HM.geo(mb, new THREE.CylinderGeometry(0.2, 0.26, 0.95, 10), BZ, x, y + 0.48, z);                          // legs & coat skirt
  HM.geo(mb, new THREE.CylinderGeometry(0.22, 0.2, 0.7, 10), BZ, x, y + 1.3, z);                             // body
  HM.geo(mb, new THREE.SphereGeometry(0.13, 10, 8), BZ, x, y + 1.82, z);                                      // head
  HM.geo(mb, new THREE.CylinderGeometry(0.12, 0.14, 0.12, 10), BZ, x, y + 1.96, z);                           // kepi
  HM.geo(mb, new THREE.BoxGeometry(0.06, 1.5, 0.06), BZ, x + fx * 0.28 + rx * 0.08, y + 0.85, z + fz * 0.28 + rz * 0.08); // rifle, butt on the plinth
  for (const sg of [-1, 1]) HM.geo(mb, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), BZ, x + fx * 0.16 + rx * sg * 0.12, y + 1.35, z + fz * 0.16 + rz * sg * 0.12, 0.5, yaw, 0); // arms forward to the muzzle
  // the inscription and medallion on the die's front
  const sg = HM.sign(T, 'OUR CONFEDERATE DEAD', 1.7, 0.42, { col: '#6a665d', size: 110 }); sg.position.set(x + fx * 1.07, g + 1.75, z + fz * 1.07); sg.rotation.y = yaw; T.group.add(sg);
  HM.geo(mb, new THREE.CylinderGeometry(0.32, 0.32, 0.06, 20).rotateX(Math.PI / 2).rotateY(yaw), C('#b9b4a8'), x + fx * 1.08, g + 2.5, z + fz * 1.08);
  HM.obstacle(T, x, z, 2.5);
}
function hmCourthouseSimple(T, B, P, mb) {
  const S = uptownShell(T, B, mb, { name: 'Pitt County Courthouse', street: /3rd/i, h: 15.5, floors: 3, floorH: 4.6, bay: 3.4, winW: 1.3, frontGap: 18, tallFirst: true,
    textured: hmTanBrickMat, base: ['#d8d0bf', 1.1], cornice: ['#f4f2ec', 0.45], belt: 5.6, sill: '#e9e4d8', roof: '#5f8f86', rise: 2.6, eave: 0.6, inset: 4.5 });
  if (S) uptownPortico(T, mb, S, { n: 6, w: 16, D: 4.6, text: 'PITT COUNTY COURT HOUSE', roof: '#5f8f86' });
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

// Sup Dogs, 213 E 5th Street (from a photo taken from the 5th Street car park): the one-storey red-brick bar with a
// standing-seam metal hip awning carrying the name over two big shopfront windows, and on its east end a tan
// stucco addition — an open, wood-lined ground-floor patio with a TV, wood louvres upstairs, a covered rooftop
// pavilion with a metal hip roof and an open roof terrace behind cable railings, reached by wooden stairs from a
// raised wooden deck along the front.
function hmSupDogs(T, B, P, mb) {
  const C = h => new THREE.Color(h), E = HM.edgesOf(B.ring); if (E.length < 3) return;
  // the front: the long wall facing 5th Street, running west → east
  let fe = null, fs = -1; for (const e of E) { if (e.L < 12) continue; const nr = nearestRoad(e.mx, e.mz, 70, r => r.car && /5th/i.test(r.name || '')); if (!nr) continue; const dx = nr.x - e.mx, dz = nr.z - e.mz, dl = Math.hypot(dx, dz) || 1, f = (dx * e.nx + dz * e.nz) / dl; if (f > 0.6 && e.L * f > fs) { fs = e.L * f; fe = e; } }
  if (!fe) fe = E.slice().sort((a, b) => b.L - a.L)[0];
  let a = fe.a, b = fe.b; const east = lonToX(-77.37) ; if (a[0] > b[0]) [a, b] = [b, a]; void east;
  const L = fe.L, tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, nx = fe.nx, nz = fe.nz, yaw = Math.atan2(nx, nz);
  const g0 = Math.min(...B.ring.map(p => H(p[0], p[1]))), at = (s, o) => [a[0] + tx * s + nx * o, a[1] + tz * s + nz * o];
  const bx = (s0, s1, o0, o1, y0, y1, col) => { const [x, z] = at((s0 + s1) / 2, (o0 + o1) / 2); HM.box(mb, x, z, g0 + y0, g0 + y1, Math.abs(s1 - s0) / 2, Math.abs(o1 - o0) / 2, yaw + Math.PI / 2 - Math.PI / 2, col); };
  // HM.box's half-widths run (hw along the wall's tangent, hd along its normal) when yaw = atan2(nx, nz)
  const WOOD = C('#a8693c'), WOOD2 = C('#8a5530'), TAN = C('#d6c7ab'), WH = C('#f2f1ec'), MET = C('#b9bec2'), DK = C('#22282d'), RAIL = C('#9aa0a5');
  const split = Math.min(L - 8, Math.max(10, L * 0.6)), hB = 5.3, hT = 7.8;
  // ---- the brick bar: walls of the whole footprint, flat roof ----
  { const wb = new MB(true), k = 1 / 2.6; const sa = signedArea(B.ring);
    for (const e of E) wb.quad([e.a[0], g0 - 0.3, e.a[1]], [e.b[0], g0 - 0.3, e.b[1]], [e.b[0], g0 + hB, e.b[1]], [e.a[0], g0 + hB, e.a[1]], [0, (g0 - 0.3) * k], [e.L * k, (g0 - 0.3) * k], [e.L * k, (g0 + hB) * k], [0, (g0 + hB) * k], [e.nx, 0, e.nz], C('#ffffff'));
    const m = new THREE.Mesh(wb.geo(), hmRedBrickMat()); m.castShadow = m.receiveShadow = true; T.group.add(m);
    const ct = B.ring.map(p => new THREE.Vector2(p[0], p[1])); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(ct, []); } catch (e) { }
    for (const t of tris) { const [A, Bv, Cc] = t.map(i => ct[i]); mb.tri([A.x, g0 + hB, A.y], [Bv.x, g0 + hB, Bv.y], [Cc.x, g0 + hB, Cc.y], [0, 0], [0, 0], [0, 0], [0, 1, 0], C('#55595d')); }
    for (const e of E) { const [x, z] = [e.mx, e.mz]; HM.box(mb, x - e.nx * 0.1, z - e.nz * 0.1, g0 + hB, g0 + hB + 0.35, e.L / 2, 0.15, Math.atan2(e.nx, e.nz), C('#8f8a84')); void sa; } }
  // ---- shopfront: two big windows, doors, the metal hip awning with the name ----
  const w0 = 1.2, w1 = split - 1.0;
  for (const [s0, s1] of [[w0 + 1.6, (w0 + w1) / 2 - 0.5], [(w0 + w1) / 2 + 0.5, w1 - 1.6]]) {
    bx(s0 - 0.15, s1 + 0.15, 0, 0.1, 0.7, 3.25, C('#d8d0bd'));
    bx(s0, s1, 0.05, 0.14, 0.85, 3.1, C('#3a2a1f')); const m = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0 - 0.2, 2.1), MAT.supWin || (MAT.supWin = new THREE.MeshStandardMaterial({ color: 0x2d3640, emissive: 0xffb15a, emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.3 })));
    const [x, z] = at((s0 + s1) / 2, 0.16); m.position.set(x, g0 + 1.97, z); m.rotation.y = yaw; T.group.add(m);
    for (let q = 1; q < 4; q++) bx(s0 + (s1 - s0) * q / 4 - 0.04, s0 + (s1 - s0) * q / 4 + 0.04, 0.15, 0.2, 0.85, 3.1, C('#1c1612'));
    bx(s0, s1, 0.15, 0.2, 2.18, 2.26, C('#1c1612')); }
  for (const s of [0.6, w1 - 1.0]) { bx(s, s + 1.0, 0.05, 0.16, 0, 2.6, C('#d8d0bd')); bx(s + 0.08, s + 0.92, 0.12, 0.2, 0.05, 2.5, C('#2a3540')); }
  { const S0 = w0 + 0.4, S1 = w1 - 0.2, D = 2.0, yLo = 3.55, yHi = 5.75, aw = new MB(true);
    const P3 = (s, o, y) => { const [x, z] = at(s, o); return [x, g0 + y, z]; };
    aw.quad(P3(S0 + D, 0, yHi), P3(S1 - D, 0, yHi), P3(S1, D, yLo), P3(S0, D, yLo), [0, 0], [0, 0], [0, 0], [0, 0], [nx, 1.1, nz], MET);
    aw.tri(P3(S0, 0, yHi), P3(S0 + D, 0, yHi), P3(S0, D, yLo), [0, 0], [0, 0], [0, 0], [-tx, 1.1, -tz], MET); aw.tri(P3(S1 - D, 0, yHi), P3(S1, 0, yHi), P3(S1, D, yLo), [0, 0], [0, 0], [0, 0], [tx, 1.1, tz], MET);
    aw.tri(P3(S0, 0, yHi), P3(S0, D, yLo), P3(S0, 0, yLo), [0, 0], [0, 0], [0, 0], [-tx, 0, -tz], MET); aw.tri(P3(S1, 0, yHi), P3(S1, 0, yLo), P3(S1, D, yLo), [0, 0], [0, 0], [0, 0], [tx, 0, tz], MET);
    for (let s = S0 + 0.5; s < S1; s += 0.5) aw.quad(P3(s - 0.02, Math.max(0, Math.min(D, (S0 + D - s) > 0 ? 0 : 0)) + 0.0, yHi + 0.01), P3(s + 0.02, 0, yHi + 0.01), P3(s + 0.02, D, yLo + 0.01), P3(s - 0.02, D, yLo + 0.01), [0, 0], [0, 0], [0, 0], [0, 0], [nx, 1.1, nz], C('#a3a8ad')); // standing seams
    addMB(T, aw, MAT.supMetal || (MAT.supMetal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide })));
    bx(S0, S1, D - 0.05, D + 0.05, yLo - 0.2, yLo, C('#c9ced2'));
    // the name on the awning: blue letters edged in white, "GREENVILLE - NC" beneath
    const c = cnv(1024, 320), g = c.getContext('2d'); g.clearRect(0, 0, 1024, 320); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 170px "Arial Black", Impact, Arial, sans-serif'; g.lineJoin = 'round'; g.lineWidth = 26; g.strokeStyle = '#ffffff'; g.strokeText('SUP DOGS', 512, 120); g.lineWidth = 12; g.strokeStyle = '#0b1f5c'; g.strokeText('SUP DOGS', 512, 120); g.fillStyle = '#2a4fd0'; g.fillText('SUP DOGS', 512, 120);
    g.font = '800 64px Arial, sans-serif'; g.fillStyle = '#16181a'; g.fillText('GREENVILLE  -  NC', 512, 262);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; const sw = Math.min(7.2, (S1 - S0) * 0.6);
    const sg = signMesh(T, tex, sw, sw * 320 / 1024, false); const [x, z] = at((S0 + S1) / 2, D * 0.5 + 0.12); sg.position.set(x, g0 + (yLo + yHi) / 2 + 0.05, z); sg.rotation.set(0, yaw, 0); sg.rotateX(-Math.atan2(yHi - yLo, D)); T.group.add(sg); }
  // ---- the tan addition at the east end ----
  const s0 = split, s1 = L, dep = 11;
  bx(s0, s1, -dep, 0, -0.3, hT, TAN); bx(s0 - 0.1, s1 + 0.1, -dep - 0.1, 0.1, hT, hT + 0.3, C('#c8b99c'));                           // stucco block + coping
  bx(s0 + 0.4, s0 + 5.6, 0.0, 0.12, 0, 3.4, WOOD); const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.85), MAT.supTv || (MAT.supTv = new THREE.MeshStandardMaterial({ color: 0x1d6a2e, emissive: 0x2f8f3f, emissiveIntensity: 0.6 })));
  { const [x, z] = at(s0 + 3.0, 0.14); tv.position.set(x, g0 + 2.6, z); tv.rotation.y = yaw; T.group.add(tv); }
  bx(s0 + 5.8, s1 - 0.3, 0.0, 0.12, 0, 3.4, C('#3a2c22'));                                                                             // open patio, shadowed
  for (const [p0, p1] of [[s0 + 0.5, s0 + 4.6], [s1 - 4.4, s1 - 0.5]]) { bx(p0, p1, 0, 0.12, 4.3, 6.9, WOOD); for (let y = 4.5; y < 6.9; y += 0.32) bx(p0, p1, 0.12, 0.2, y, y + 0.06, WOOD2); } // louvres
  // rooftop: covered pavilion (white posts, metal hip roof) on the west half, open terrace east, cable railings all round
  { const pS0 = s0 + 0.2, pS1 = s0 + Math.min(6.5, (s1 - s0) * 0.6), pO0 = -6.5, pO1 = 0.2, y0 = hT + 0.3, y1 = y0 + 2.9;
    for (const s of [pS0, pS1]) for (const o of [pO0, pO1]) bx(s - 0.12, s + 0.12, o - 0.12, o + 0.12, y0, y1, WH);
    bx(pS0 - 0.3, pS1 + 0.3, pO0 - 0.3, pO1 + 0.3, y1, y1 + 0.35, WH);
    const rf = new MB(true), P3 = (s, o, y) => { const [x, z] = at(s, o); return [x, g0 + y, z]; }, ov = 0.8, rt = y1 + 0.35, rk = y1 + 1.6, ms = (pS0 + pS1) / 2, mo = (pO0 + pO1) / 2;
    const A = P3(pS0 - ov, pO1 + ov, rt), Bq = P3(pS1 + ov, pO1 + ov, rt), Cq = P3(pS1 + ov, pO0 - ov, rt), Dq = P3(pS0 - ov, pO0 - ov, rt), R1 = P3(ms - 0.6, mo, rk), R2 = P3(ms + 0.6, mo, rk);
    rf.quad(A, Bq, R2, R1, [0, 0], [0, 0], [0, 0], [0, 0], [nx, 1, nz], MET); rf.quad(Cq, Dq, R1, R2, [0, 0], [0, 0], [0, 0], [0, 0], [-nx, 1, -nz], MET); rf.tri(Dq, A, R1, [0, 0], [0, 0], [0, 0], [-tx, 1, -tz], MET); rf.tri(Bq, Cq, R2, [0, 0], [0, 0], [0, 0], [tx, 1, tz], MET);
    addMB(T, rf, MAT.supMetal);
    // cable railing round the roof edge
    const rail = (sA, oA, sB, oB, yB, h) => { const len = Math.hypot(sB - sA, oB - oA), n = Math.max(1, Math.round(len / 1.3)); for (let i = 0; i <= n; i++) { const s = sA + (sB - sA) * i / n, o = oA + (oB - oA) * i / n; bx(s - 0.04, s + 0.04, o - 0.04, o + 0.04, yB, yB + h, RAIL); }
      for (const f of [0.35, 0.6, 0.85, 1.0]) { const [xa, za] = at(sA, oA), [xb, zb] = at(sB, oB), yy = g0 + yB + h * f; const ln = Math.hypot(xb - xa, zb - za), gg = new THREE.BoxGeometry(ln, f === 1 ? 0.06 : 0.015, f === 1 ? 0.08 : 0.015); gg.rotateY(-Math.atan2(zb - za, xb - xa)); gg.translate((xa + xb) / 2, yy, (za + zb) / 2); addGeoTo(mb, gg, RAIL); } };
    rail(s0 + 0.1, 0.05, s1 - 0.1, 0.05, y0, 1.1); rail(s1 - 0.1, 0.05, s1 - 0.1, -dep + 0.1, y0, 1.1); rail(s0 + 0.1, -dep + 0.1, s1 - 0.1, -dep + 0.1, y0, 1.1);
    // the stairs: a raised wooden deck along the front, a flight up to a landing, then on up to the roof
    const deckS0 = s0 - 0.3, deckS1 = s1 + 6, dO = 4.2, dY = 0.6;
    bx(deckS0, deckS1, 0, dO, -0.2, dY, WOOD); bx(deckS0, deckS1, dO - 0.05, dO + 0.05, -0.2, dY, C('#6d4426'));
    rail(deckS0, dO, deckS1, dO, dY, 1.0); rail(deckS1, 0.2, deckS1, dO, dY, 1.0);
    const lY = 4.0, lS0 = s1 - 3.2, lS1 = s1 + 0.6, lO = 3.0;
    bx(lS0, lS1, 0, lO, lY - 0.25, lY, WOOD); for (const s of [lS0 + 0.2, lS1 - 0.2]) bx(s - 0.18, s + 0.18, lO - 0.38, lO - 0.02, dY, lY - 0.25, TAN);
    rail(lS0, lO, lS1, lO, lY, 1.0);
    const flight = (sA, sB, yA, yB, o0, o1) => { const n = Math.round(Math.abs(yB - yA) / 0.18); for (let i = 0; i < n; i++) { const s = sA + (sB - sA) * (i + 0.5) / n, y = yA + (yB - yA) * (i + 1) / n; bx(s - Math.abs(sB - sA) / n / 2 - 0.02, s + Math.abs(sB - sA) / n / 2 + 0.02, o0, o1, y - 0.18, y, WOOD); }
      const [xa, za] = at(sA, o1), [xb, zb] = at(sB, o1); for (const f of [0.0]) { void f; } rail(sA, o1, sB, o1, Math.min(yA, yB), 0.01); // (a stringer line)
      const ln = Math.hypot(xb - xa, zb - za, yB - yA), gg = new THREE.BoxGeometry(0.06, 0.06, ln); gg.lookAt(new THREE.Vector3(xb - xa, yB - yA, zb - za)); gg.translate((xa + xb) / 2, g0 + (yA + yB) / 2 + 1.0, (za + zb) / 2); addGeoTo(mb, gg, RAIL); };
    flight(deckS1 - 0.2, lS1, dY, lY, 0.3, 1.6);                                                                                            // deck → landing (rising west)
    flight(lS0, lS0 - (y0 - lY) / 0.18 * 0.27, lY, y0, 0.3, 1.6);                                                                   // landing → roof
    addDeck(T, [at(deckS0, 0), at(deckS1, 0), at(deckS1, dO), at(deckS0, dO)], g0 + dY);
    addDeck(T, [at(lS0, 0), at(lS1, 0), at(lS1, lO), at(lS0, lO)], g0 + lY);
  }
  HM.solid(T, B.ring, g0 + hT, 'Sup Dogs');
}
