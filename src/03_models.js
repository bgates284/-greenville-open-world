
// =====================================================================
// MODELS (low-poly, built from primitives)
// =====================================================================
function colorGeo(geo, hex) {
  const c = new THREE.Color(hex); const n = geo.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[3 * i] = c.r; a[3 * i + 1] = c.g; a[3 * i + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function prep(geo) { // make geometries mergeable: non-indexed, only position/normal/color/uv
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
function jitter(geo, amt, seed) { // deterministic per-position so shared corners stay welded
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = Math.round(x * 97) * 73856093 ^ Math.round(y * 97) * 19349663 ^ Math.round(z * 97) * 83492791 ^ seed;
    p.setXYZ(i, x + (hashN(k) - .5) * amt, y + (hashN(k + 1) - .5) * amt, z + (hashN(k + 2) - .5) * amt);
  }
  return geo;
}

const GEO = {};
function buildModels() {
  // --- Loblolly pine: tall bare trunk, crown clustered near the top ---
  {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.16, 0.32, 13, 6); trunk.translate(0, 6.5, 0); parts.push(colorGeo(prep(trunk), 0x5a4332));
    const r = mulberry32(5);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.IcosahedronGeometry(1.7 + r() * 1.1, 0); jitter(s, 0.6, i + 3); s.scale(1.25, 0.72, 1.25);
      const a = r() * 6.28, d = 0.6 + r() * 1.4; s.translate(Math.cos(a) * d, 10.4 + r() * 3.6, Math.sin(a) * d);
      parts.push(colorGeo(prep(s), pick([0x2f4a24, 0x35502a, 0x2a4220], r())));
    }
    GEO.pine = mergeGeometries(parts); GEO.pine.computeVertexNormals();
  }
  // --- Oak / maple: broad rounded canopy ---
  {
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.22, 0.4, 5, 6); trunk.translate(0, 2.5, 0); parts.push(colorGeo(prep(trunk), 0x4f3d2e));
    const r = mulberry32(9);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.IcosahedronGeometry(2.0 + r() * 1.2, 1); jitter(s, 0.5, i + 20);
      const a = r() * 6.28, d = i === 0 ? 0 : 1.6 + r() * 1.2; s.translate(Math.cos(a) * d, 6.2 + r() * 2.2 + (i === 0 ? 1.2 : 0), Math.sin(a) * d);
      parts.push(colorGeo(prep(s), pick([0x3f6a2a, 0x4a7430, 0x3a5f26, 0x557a34], r())));
    }
    GEO.oak = mergeGeometries(parts); GEO.oak.computeVertexNormals();
  }
  // --- Crape myrtle / ornamental ---
  {
    const parts = [];
    for (let i = 0; i < 3; i++) { const t = new THREE.CylinderGeometry(0.06, 0.1, 2.6, 5); t.rotateZ((i - 1) * 0.25); t.translate((i - 1) * 0.25, 1.3, 0); parts.push(colorGeo(prep(t), 0x8b7a6a)); }
    const r = mulberry32(31);
    for (let i = 0; i < 4; i++) { const s = new THREE.IcosahedronGeometry(1.0 + r() * .5, 0); jitter(s, 0.3, i + 40); s.translate((r() - .5) * 1.6, 2.9 + r() * .8, (r() - .5) * 1.6); parts.push(colorGeo(prep(s), pick([0x5b7a3a, 0x6a8a44, 0x9a5a7a], r()))); }
    GEO.myrtle = mergeGeometries(parts); GEO.myrtle.computeVertexNormals();
  }
  // --- Street lamp (cobra-head style on a pole) ---
  {
    const pole = new THREE.CylinderGeometry(0.09, 0.14, 8, 6); pole.translate(0, 4, 0);
    const arm = new THREE.BoxGeometry(0.12, 0.12, 2.2); arm.translate(0, 7.9, 1.05);
    GEO.lampPole = mergeGeometries([prep(pole), prep(arm)]);
    const head = new THREE.BoxGeometry(0.45, 0.18, 0.9); head.translate(0, 7.8, 2.1); GEO.lampHead = prep(head);
    GEO.lampHeadY = 7.7; GEO.lampHeadZ = 2.1;
  }
  buildCars();
}

// =====================================================================
// =====================================================================
// CARS — fully procedural, built like the "Procedural GT" showcase:
//   • lower body = sculpted side profile (bumpers, nose, bonnet, shoulder, tail, wheel arches)
//     extruded across the width with rounded bevels, plus flared arches and a shoulder crease
//   • greenhouse = tinted-glass volume with body-coloured pillar frames and chrome window surrounds
//   • LED headlight clusters, full-width rear light bar, gloss-black grille with slats
//   • lathe-turned tyres with tread grooves, twin-spoke alloys, hub, lug nuts, brake discs
// Three shapes (sedan / SUV / pickup), each in two detail levels: full detail for traffic and the
// player's car, and a light version for the hundreds of instanced parked cars.
// Profiles are drawn with +x = front, then turned so the car faces +z like the rest of the game.
// =====================================================================
const CAR_SPECS = {
  sedan: {
    W: 1.86, WC: 1.68, R: 0.34, ax: [1.40, -1.40], arch: 0.46, yb: 0.30, track: 0.80,
    lower: s => { s.moveTo(2.12, 0.30); s.quadraticCurveTo(2.40, 0.31, 2.40, 0.50); s.quadraticCurveTo(2.40, 0.66, 2.24, 0.72); s.bezierCurveTo(1.75, 0.84, 1.20, 0.93, 0.80, 0.95); s.lineTo(-1.30, 0.98); s.quadraticCurveTo(-1.95, 0.99, -2.22, 0.90); s.quadraticCurveTo(-2.34, 0.84, -2.33, 0.60); s.lineTo(-2.30, 0.36); s.quadraticCurveTo(-2.28, 0.30, -2.15, 0.30); },
    endX: 2.12,
    cabin: c => { c.moveTo(1.02, 0.90); c.quadraticCurveTo(0.55, 1.12, 0.05, 1.36); c.quadraticCurveTo(-0.10, 1.40, -0.35, 1.40); c.lineTo(-0.70, 1.39); c.bezierCurveTo(-1.10, 1.36, -1.50, 1.12, -1.82, 0.97); c.lineTo(-1.82, 0.90); },
    windows: [
      p => { p.moveTo(0.78, 0.99); p.quadraticCurveTo(0.42, 1.15, 0.02, 1.30); p.lineTo(-0.30, 1.32); p.lineTo(-0.30, 0.99); },
      p => { p.moveTo(-0.38, 0.99); p.lineTo(-0.38, 1.32); p.lineTo(-0.70, 1.315); p.bezierCurveTo(-1.00, 1.29, -1.28, 1.13, -1.52, 0.99); },
    ],
    crease: 0.78, handles: [0.25, -0.75], seams: [0.92, -0.33, -1.02], seamY: [0.34, 0.92],
    head: { p: [2.395, 0.645, 0.60], r: [0, 0.30, -0.55], w: 0.42 }, grille: { x: 2.40, y: 0.42, w: 1.24, h: 0.16 }, slot: { x: 2.425, y: 0.585, w: 0.62 },
    tail: { bar: [-2.345, 0.84, 1.5], corner: [-2.33, 0.80, 0.72] }, mirror: [0.72, 1.05, 0.97], exhaust: [-2.34, 0.33, 0.52], plateR: [-2.39, 0.62],
    splitter: [2.30, 0.245], diffuser: [-2.26, 0.30],
  },
  suv: {
    W: 1.96, WC: 1.80, R: 0.40, ax: [1.45, -1.45], arch: 0.53, yb: 0.40, track: 0.86,
    lower: s => { s.moveTo(2.30, 0.40); s.quadraticCurveTo(2.50, 0.42, 2.50, 0.72); s.quadraticCurveTo(2.50, 0.98, 2.30, 1.04); s.bezierCurveTo(1.90, 1.10, 1.50, 1.14, 1.20, 1.15); s.lineTo(-2.20, 1.19); s.quadraticCurveTo(-2.45, 1.19, -2.46, 1.00); s.lineTo(-2.46, 0.56); s.quadraticCurveTo(-2.45, 0.40, -2.30, 0.40); },
    endX: 2.30,
    cabin: c => { c.moveTo(1.32, 1.08); c.quadraticCurveTo(0.95, 1.42, 0.55, 1.74); c.lineTo(-2.02, 1.79); c.quadraticCurveTo(-2.34, 1.78, -2.40, 1.56); c.lineTo(-2.42, 1.08); },
    windows: [
      p => { p.moveTo(1.10, 1.21); p.quadraticCurveTo(0.84, 1.43, 0.52, 1.67); p.lineTo(-0.36, 1.69); p.lineTo(-0.36, 1.21); },
      p => { p.moveTo(-0.46, 1.21); p.lineTo(-0.46, 1.69); p.lineTo(-1.44, 1.70); p.lineTo(-1.44, 1.21); },
      p => { p.moveTo(-1.54, 1.21); p.lineTo(-1.54, 1.70); p.lineTo(-2.06, 1.70); p.quadraticCurveTo(-2.26, 1.68, -2.30, 1.50); p.lineTo(-2.32, 1.21); },
    ],
    crease: 0.98, handles: [0.35, -0.85], seams: [1.05, -0.41, -1.49], seamY: [0.45, 1.12],
    head: { p: [2.52, 0.92, 0.64], r: [0, 0.28, -0.35], w: 0.48, h: 0.11 }, grille: { x: 2.53, y: 0.70, w: 1.24, h: 0.32 }, slot: { x: 2.535, y: 0.93, w: 0.62 },
    tail: { bar: [-2.47, 1.10, 1.56], corner: [-2.44, 1.00, 0.76] }, mirror: [1.05, 1.28, 1.04], exhaust: [-2.45, 0.44, 0.55], plateR: [-2.49, 0.78],
    splitter: [2.40, 0.36], diffuser: [-2.38, 0.42], rails: [1.84, -0.9, 2.3, 0.70],
  },
  pickup: {
    W: 2.02, WC: 1.86, R: 0.42, ax: [1.85, -1.75], arch: 0.55, yb: 0.44, track: 0.90,
    lower: s => { s.moveTo(2.75, 0.44); s.quadraticCurveTo(2.90, 0.46, 2.90, 0.80); s.quadraticCurveTo(2.90, 1.10, 2.72, 1.16); s.bezierCurveTo(2.20, 1.20, 1.70, 1.24, 1.35, 1.25); s.lineTo(-2.74, 1.30); s.quadraticCurveTo(-2.88, 1.30, -2.88, 1.15); s.lineTo(-2.88, 0.62); s.quadraticCurveTo(-2.86, 0.44, -2.74, 0.44); },
    endX: 2.75,
    cabin: c => { c.moveTo(1.42, 1.18); c.quadraticCurveTo(1.06, 1.55, 0.76, 1.88); c.lineTo(-0.54, 1.90); c.quadraticCurveTo(-0.66, 1.89, -0.68, 1.75); c.lineTo(-0.70, 1.18); },
    windows: [
      p => { p.moveTo(1.24, 1.32); p.quadraticCurveTo(1.00, 1.56, 0.73, 1.80); p.lineTo(0.02, 1.81); p.lineTo(0.02, 1.32); },
      p => { p.moveTo(-0.07, 1.32); p.lineTo(-0.07, 1.81); p.lineTo(-0.52, 1.81); p.quadraticCurveTo(-0.58, 1.80, -0.59, 1.70); p.lineTo(-0.60, 1.32); },
    ],
    crease: 1.02, handles: [0.40, -0.40], seams: [1.20, -0.03, -0.66], seamY: [0.50, 1.22],
    head: { p: [2.935, 0.98, 0.70], r: [0, 0.18, -0.2], w: 0.44, h: 0.15 }, grille: { x: 2.93, y: 0.79, w: 1.34, h: 0.44 }, slot: null,
    tail: { bar: null, corner: [-2.89, 0.96, 0.90], tallTail: true }, mirror: [1.32, 1.36, 1.08], exhaust: [-2.86, 0.47, 0.60], plateR: [-2.90, 0.70],
    splitter: [2.80, 0.42], diffuser: null, bed: [-0.72, -2.80, 1.315],
  },
};

// ---- geometry helpers: every part is normalised (non-indexed position/normal/uv[/color]) so parts merge ----
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _s4 = new THREE.Vector3(1, 1, 1), _p4 = new THREE.Vector3();
function norm(geo, hex) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (hex !== undefined) colorGeo(g, hex);
  return g;
}
function xf(geo, p = [0, 0, 0], r = [0, 0, 0]) { _m4.compose(_p4.set(p[0], p[1], p[2]), _q4.setFromEuler(_e4.set(r[0], r[1], r[2])), _s4); geo.applyMatrix4(_m4); return geo; }
const rb = (w, h, d, r, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
function sweep(shape, width, bevel, segs, curveSegs) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: curveSegs });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return m;
}
function lowerShape(S) {
  const s = new THREE.Shape(); S.lower(s);
  for (const x of [...S.ax].sort((a, b) => a - b)) { // wheel arches, rear to front along the sill
    s.lineTo(x - S.arch, S.yb); s.lineTo(x - S.arch, S.R); s.absarc(x, S.R, S.arch, Math.PI, 0, true); s.lineTo(x + S.arch, S.yb);
  }
  s.lineTo(S.endX, S.yb); return s;
}
function cabinShape(S) { const c = new THREE.Shape(); S.cabin(c); c.closePath(); return c; }
function windowPaths(S) { return S.windows.map(f => { const p = new THREE.Path(); f(p); p.closePath(); return p; }); }

// ---- wheels (built with the axle along z, outer face +z, then turned to face ±x) ----
function wheelParts(R, lite) {
  const tyre = [], rim = [];
  const rr = R * 0.72; // rim radius
  if (lite) {
    const t = new THREE.CylinderGeometry(R, R, 0.24, 14); t.rotateX(Math.PI / 2); tyre.push(norm(t, 0x1b1c1f));
    const d = new THREE.CylinderGeometry(rr, rr, 0.02, 14); d.rotateX(Math.PI / 2); d.translate(0, 0, 0.115); tyre.push(norm(d, 0xb9bec4));
    return { tyre: mergeGeometries(tyre), rim: null };
  }
  const tp = []; const P = (r, y) => tp.push(new THREE.Vector2(r, y));
  P(rr, -0.105); P(R * 0.84, -0.122); P(R * 0.94, -0.118); P(R * 0.985, -0.104); P(R, -0.086);
  for (const gz of [-0.035, 0.035]) { P(R, gz - 0.011); P(R - 0.008, gz - 0.007); P(R - 0.008, gz + 0.007); P(R, gz + 0.011); }
  P(R, 0.086); P(R * 0.985, 0.104); P(R * 0.94, 0.118); P(R * 0.84, 0.122); P(rr, 0.105);
  const t = new THREE.LatheGeometry(tp, 28); t.rotateX(Math.PI / 2); tyre.push(norm(t, 0x1d1f22));
  const barrel = new THREE.CylinderGeometry(rr - 0.002, rr - 0.002, 0.2, 24, 1, true); barrel.rotateX(Math.PI / 2); barrel.translate(0, 0, -0.01); rim.push(norm(barrel, 0x3a3e44));
  const lip = new THREE.TorusGeometry(rr - 0.004, 0.01, 4, 28); lip.translate(0, 0, 0.09); rim.push(norm(lip, 0xd0d5da));
  const sp = new THREE.Shape(); sp.moveTo(R * 0.18, -0.02); sp.lineTo(rr - 0.008, -0.012); sp.lineTo(rr - 0.008, 0.012); sp.lineTo(R * 0.18, 0.02); sp.closePath();
  const spG = new THREE.ExtrudeGeometry(sp, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1 });
  for (let i = 0; i < 10; i++) { const g = spG.clone(); g.rotateZ((Math.floor(i / 2) / 5) * Math.PI * 2 + (i % 2 ? 0.16 : -0.16)); g.translate(0, 0, 0.055); rim.push(norm(g, 0xc9ced4)); }
  const hub = new THREE.CylinderGeometry(R * 0.2, R * 0.22, 0.05, 16); hub.rotateX(Math.PI / 2); hub.translate(0, 0, 0.07); rim.push(norm(hub, 0xc9ced4));
  const cap = new THREE.CylinderGeometry(R * 0.1, R * 0.1, 0.012, 16); cap.rotateX(Math.PI / 2); cap.translate(0, 0, 0.098); rim.push(norm(cap, 0x121316));
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.63; const n = new THREE.CylinderGeometry(0.0095, 0.0095, 0.02, 6); n.rotateX(Math.PI / 2); n.translate(Math.cos(a) * R * 0.155, Math.sin(a) * R * 0.155, 0.098); rim.push(norm(n, 0xe8ecf0)); }
  const disc = new THREE.CylinderGeometry(rr * 0.78, rr * 0.78, 0.026, 24); disc.rotateX(Math.PI / 2); rim.push(norm(disc, 0x8b8f94));
  return { tyre: mergeGeometries(tyre), rim: mergeGeometries(rim) };
}
function wheelSet(R, xs, lite) { // xs: x offsets; a wheel at x>0 faces +x, x<0 faces -x
  const base = wheelParts(R, lite); const out = { tyre: [], rim: [] };
  for (const x of xs) for (const k of ['tyre', 'rim']) { if (!base[k]) continue; const g = base[k].clone(); g.rotateY(x >= 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(x, 0, 0); out[k].push(g); }
  return { tyre: mergeGeometries(out.tyre), rim: base.rim ? mergeGeometries(out.rim) : null };
}

function buildCarType(S, lite) {
  const body = [], glass = [], trim = [], chrome = [], head = [], tail = [], plate = [];
  const cs = lite ? 6 : 12, bs = lite ? 1 : 3;
  body.push(norm(sweep(lowerShape(S), S.W, 0.06, bs, cs)));
  const cab = cabinShape(S);
  glass.push(norm(sweep(cab, S.WC, lite ? 0.05 : 0.08, lite ? 1 : 3, cs)));
  const zc = S.WC / 2, zb = S.W / 2;
  // pillar frames (body colour) with the window openings cut out, both sides
  const wins = windowPaths(S);
  const frame = new THREE.Shape(cab.getPoints(lite ? 8 : 16)); frame.holes.push(...wins);
  const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.014, bevelEnabled: false, curveSegments: lite ? 4 : 8 });
  for (const sg of [1, -1]) body.push(norm(fg.clone().translate(0, 0, sg > 0 ? zc - 0.004 : -zc - 0.010)));
  // wheel-arch liners
  for (const x of S.ax) { const l = new THREE.CylinderGeometry(S.arch - 0.066, S.arch - 0.066, S.W - 0.12, lite ? 10 : 24, 1, true, -Math.PI / 2, Math.PI); l.rotateX(Math.PI / 2); l.translate(x, S.R, 0); const n = norm(l); const back = n.clone(); flipGeo(back); trim.push(n, back); }
  trim.push(norm(xf(rb(Math.abs(S.ax[0] - S.ax[1]) + 1.6, 0.08, S.W - 0.3, 0.03, 1), [(S.ax[0] + S.ax[1]) / 2, S.yb - 0.04, 0])));
  if (!lite) {
    // fender flares + shoulder crease
    const fl = new THREE.Shape(); fl.absarc(0, 0, S.arch + 0.075, Math.PI * 0.97, Math.PI * 0.03, true); fl.absarc(0, 0, S.arch + 0.004, Math.PI * 0.03, Math.PI * 0.97, false);
    const flG = new THREE.ExtrudeGeometry(fl, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
    for (const x of S.ax) for (const zs of [1, -1]) { const g = flG.clone(); if (zs < 0) g.rotateY(Math.PI); g.translate(x, S.R, zs * (zb - 0.03)); body.push(norm(g)); }
    const cx0 = S.ax[1] + S.arch + 0.12, cx1 = S.ax[0] - S.arch - 0.02;
    for (const zs of [1, -1]) body.push(norm(xf(rb(cx1 - cx0, 0.028, 0.03, 0.012), [(cx0 + cx1) / 2, S.crease, zs * (zb - 0.005)])));
    // chrome window surrounds
    for (const zs of [1, -1]) for (const w of wins) { const pts = w.getPoints(16).map(p => new THREE.Vector3(p.x, p.y, zs * (zc + 0.012))); chrome.push(norm(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.05), 28, 0.0065, 3, true))); }
    // door handles (chrome) & shut-lines
    for (const zs of [1, -1]) {
      for (const x of S.handles) chrome.push(norm(xf(rb(0.17, 0.024, 0.014, 0.007, 1), [x, S.crease + 0.08, zs * (zb + 0.002)])));
      for (const x of S.seams) trim.push(norm(xf(new THREE.BoxGeometry(0.005, S.seamY[1] - S.seamY[0], 0.004), [x, (S.seamY[0] + S.seamY[1]) / 2, zs * (zb + 0.001)])));
    }
    // side skirts, splitter, diffuser
    for (const zs of [1, -1]) trim.push(norm(xf(rb(Math.abs(S.ax[0] - S.ax[1]) - S.arch * 2 - 0.1, 0.07, 0.07, 0.025, 1), [(S.ax[0] + S.ax[1]) / 2, S.yb - 0.03, zs * (zb - 0.015)])));
    trim.push(norm(xf(rb(0.16, 0.025, S.W - 0.2, 0.01, 1), [S.splitter[0], S.splitter[1], 0])));
    if (S.diffuser) { trim.push(norm(xf(rb(0.32, 0.1, 1.3, 0.02, 1), [S.diffuser[0], S.diffuser[1], 0]))); for (let i = -3; i <= 3; i++) trim.push(norm(xf(new THREE.BoxGeometry(0.26, 0.08, 0.012), [S.diffuser[0] - 0.04, S.diffuser[1], i * 0.16]))); }
    // exhaust tips
    for (const zs of [1, -1]) { const e = new THREE.CylinderGeometry(0.048, 0.044, 0.18, 14, 1, true); e.rotateZ(Math.PI / 2); e.translate(S.exhaust[0], S.exhaust[1], zs * S.exhaust[2]); const n = norm(e); const b = n.clone(); flipGeo(b); chrome.push(n, b); const d = new THREE.CircleGeometry(0.043, 12); d.rotateY(-Math.PI / 2); d.translate(S.exhaust[0] - 0.05, S.exhaust[1], zs * S.exhaust[2]); trim.push(norm(d)); }
  }
  // grille: gloss-black frame with horizontal slats (+ upper slot)
  const G = S.grille;
  trim.push(norm(xf(rb(0.1, G.h, G.w, 0.05, lite ? 1 : 2), [G.x, G.y, 0])));
  if (!lite) {
    const n = Math.max(2, Math.round(G.h / 0.06));
    for (let i = 0; i < n; i++) chrome.push(norm(xf(rb(0.02, 0.012, G.w - 0.1, 0.005, 1), [G.x + 0.045, G.y - G.h / 2 + (i + 0.5) * G.h / n, 0])));
    if (S.bed) for (const dy of [-1, 1]) chrome.push(norm(xf(rb(0.03, 0.03, G.w + 0.04, 0.012, 1), [G.x + 0.04, G.y + dy * (G.h / 2 + 0.01), 0])));
    if (S.slot) trim.push(norm(xf(rb(0.05, 0.03, S.slot.w, 0.012, 1), [S.slot.x, S.slot.y, 0])));
    for (const zs of [1, -1]) trim.push(norm(xf(rb(0.08, G.h * 0.75, 0.2, 0.035, 1), [G.x - 0.03, G.y, zs * (G.w / 2 + 0.16)])));
  }
  // headlights: housing (trim) + LED blade and two projectors (emissive) + lens (glass)
  const Hd = S.head;
  for (const zs of [1, -1]) {
    const p = [Hd.p[0], Hd.p[1], zs * Hd.p[2]], r = [Hd.r[0], zs * Hd.r[1], Hd.r[2]];
    const place = (g, off) => { g.translate(off[0], off[1], off[2] * zs); return xf(g, p, r); };
    const hh = Hd.h || 0.085; trim.push(norm(place(rb(0.07, hh, Hd.w, 0.03, 1), [0, 0, 0])));
    head.push(norm(place(rb(0.02, 0.014, Hd.w - 0.02, 0.006, 1), [0.03, hh * 0.35, 0])));
    if (!lite) for (const oz of [-0.07, -0.15]) { const pr = new THREE.CylinderGeometry(hh * 0.35, hh * 0.35, 0.03, 12); pr.rotateZ(Math.PI / 2); head.push(norm(place(pr, [0.03, -0.005, oz]))); }
    else head.push(norm(place(new THREE.BoxGeometry(0.03, 0.04, Hd.w * 0.5), [0.03, -0.01, -0.1])));
  }
  // tail lights
  const T = S.tail;
  if (T.bar) tail.push(norm(xf(rb(0.05, 0.035, T.bar[2], 0.014, 1), [T.bar[0], T.bar[1], 0])));
  for (const zs of [1, -1]) {
    if (T.tallTail) tail.push(norm(xf(rb(0.06, 0.34, 0.12, 0.03, 1), [T.corner[0], T.corner[1], zs * T.corner[2]])));
    else tail.push(norm(xf(rb(0.08, 0.1, 0.3, 0.03, 1), [T.corner[0], T.corner[1], zs * T.corner[2]], [0, zs * -0.2, 0])));
  }
  // mirrors: body-colour caps on black stalks, chrome glass
  const Mi = S.mirror;
  for (const zs of [1, -1]) {
    body.push(norm(xf(rb(0.2, 0.1, 0.16, 0.045, 1), [Mi[0], Mi[1], zs * Mi[2]])));
    trim.push(norm(xf(rb(0.07, 0.03, 0.12, 0.012, 1), [Mi[0] + 0.02, Mi[1] - 0.05, zs * (Mi[2] - 0.09)])));
    if (!lite) chrome.push(norm(xf(rb(0.012, 0.075, 0.13, 0.004, 1), [Mi[0] - 0.1, Mi[1], zs * Mi[2]])));
  }
  // roof rails / tonneau cover
  if (S.rails) for (const zs of [1, -1]) trim.push(norm(xf(rb(S.rails[2], 0.04, 0.05, 0.015, 1), [S.rails[1], S.rails[0], zs * S.rails[3]])));
  if (S.bed) trim.push(norm(xf(rb(Math.abs(S.bed[0] - S.bed[1]), 0.03, S.W - 0.18, 0.012, 1), [(S.bed[0] + S.bed[1]) / 2, S.bed[2], 0])));
  // rear plate
  plate.push(norm(xf(rb(0.012, 0.15, 0.3, 0.008, 1), [S.plateR[0], S.plateR[1], 0])));

  // turn the car to face +z (profile +x → world +z, width z → -x)
  const turn = arr => { const g = mergeGeometries(arr.filter(Boolean)); if (g) g.rotateY(-Math.PI / 2); return g; };
  const o = { body: turn(body), glass: turn(glass), trim: turn(trim), chrome: chrome.length ? turn(chrome) : null, head: turn(head), tail: turn(tail), plate: turn(plate) };
  const len = (() => { o.body.computeBoundingBox(); const b = o.body.boundingBox; return b.max.z - b.min.z; })();
  return Object.assign(o, { len, wid: S.W, wheelR: S.R, axle: S.ax, track: S.track });
}
function flipGeo(g) { // reverse winding + normals (for open, double-sided parts inside merged single-sided meshes)
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i += 3) for (const a of [p, n]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); }
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}
function buildCars() {
  GEO.car = {};
  MAT.tyre = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 });
  MAT.rim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 1.0 });
  MAT.carChrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.08, metalness: 1.0 });
  MAT.lampOff = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.1 });
  MAT.carGlass.color.set(0x05080b); MAT.carGlass.roughness = 0.06;
  MAT.carTrim.color.set(0x0c0d0f); MAT.carTrim.roughness = 0.35; MAT.carTrim.metalness = 0.2;
  for (const type in CAR_SPECS) {
    const S = CAR_SPECS[type]; const o = buildCarType(S, false); const lo = buildCarType(S, true);
    const pair = wheelSet(S.R, [S.track, -S.track], false);
    const L = wheelSet(S.R, [0.0001], false), Rr = wheelSet(S.R, [-0.0001], false);
    const lp = wheelSet(S.R, [S.track, -S.track], true).tyre;
    // wheel pairs are built with the axle across the car (x) already
    const ws = []; for (const z of S.ax) { const g = lp.clone(); g.translate(0, S.R, z); ws.push(g); }
    Object.assign(o, {
      pairTyre: pair.tyre, pairRim: pair.rim, oneLTyre: L.tyre, oneLRim: L.rim, oneRTyre: Rr.tyre, oneRRim: Rr.rim,
      liteBody: lo.body, liteGlass: lo.glass, liteTrim: lo.trim, liteLamps: mergeGeometries([colorGeo(colorless(lo.head), 0xdfe4ea), colorGeo(colorless(lo.tail), 0x7a0c10)]), wheelsStatic: mergeGeometries(ws), litePair: lp,
    });
    GEO.car[type] = o;
  }
}
function makeCarMeshLite(type, color) { // low graphics setting: the parked-car detail level, still with spinning wheels
  const G = GEO.car[type]; const g = new THREE.Group(); const bodyG = new THREE.Group(); g.add(bodyG);
  const add = (parent, geo, mat, shadow = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; parent.add(m); return m; };
  add(bodyG, G.liteBody, carPaint(color), true); add(bodyG, G.liteGlass, MAT.carGlass); add(bodyG, G.liteTrim, MAT.carTrim);
  g.userData.head = add(bodyG, G.head, MAT.headlight); g.userData.tail = add(bodyG, G.tail, MAT.taillight);
  const wf = add(g, G.litePair, MAT.wheel); wf.position.set(0, G.wheelR, G.axle[0]);
  const wr = add(g, G.litePair, MAT.wheel); wr.position.set(0, G.wheelR, G.axle[1]);
  Object.assign(g.userData, { type, bodyG, wf, wr, r: G.wheelR, spin: 0 });
  return g;
}
function colorless(g) { const c = g.clone(); if (c.attributes.color) c.deleteAttribute('color'); return c; }
const CAR_COLORS = [0xf2f2f0, 0xf2f2f0, 0xe9e9e6, 0x15161a, 0x15161a, 0x9ea3a8, 0x9ea3a8, 0x5a5f66, 0x1f3d6e, 0x7a1418, 0xb8b0a0, 0x2c4a33, 0x3a2a5a, 0x8a1c1c, 0x31445a, 0x4a525c, 0x6e0a16, 0x0f1d3f];
const CAR_TYPES = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'suv', 'pickup', 'pickup'];
// a wheel pair (tyres + alloys) as one object so it can spin as a unit
function wheelObj(tyreG, rimG) { const w = new THREE.Group(); const t = new THREE.Mesh(tyreG, MAT.tyre); t.castShadow = true; w.add(t); if (rimG) { const r = new THREE.Mesh(rimG, MAT.rim); r.castShadow = true; w.add(r); } return w; }
function makeCarMesh(type, color) {
  const G = GEO.car[type]; if (Q.traffic <= 12) return makeCarMeshLite(type, color); const g = new THREE.Group(); const bodyG = new THREE.Group(); g.add(bodyG);
  const add = (parent, geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; parent.add(m); return m; };
  add(bodyG, G.body, carPaint(color)); add(bodyG, G.glass, MAT.carGlass, false); add(bodyG, G.trim, MAT.carTrim); add(bodyG, G.chrome, MAT.carChrome, false); add(bodyG, G.plate, MAT.plate, false);
  g.userData.head = add(bodyG, G.head, MAT.headlight, false); g.userData.tail = add(bodyG, G.tail, MAT.taillight, false);
  const wf = wheelObj(G.pairTyre, G.pairRim); wf.position.set(0, G.wheelR, G.axle[0]); g.add(wf);
  const wr = wheelObj(G.pairTyre, G.pairRim); wr.position.set(0, G.wheelR, G.axle[1]); g.add(wr);
  Object.assign(g.userData, { type, bodyG, wf, wr, r: G.wheelR, spin: 0 });
  return g;
}

// ---------- the player's sports car: an original low mid-engine coupe (lofted body, glass canopy) ----------
function buildSportsCar(paintHex) {
  const g = new THREE.Group();
  const FA = 1.42, RA = -1.40, WR = 0.36;           // axles and wheel radius
  // stations along the car (z, rear → front): half-width, sill, belt, deck, arch (1 = wheel opening here)
  const S = [
    [-2.30, 0.86, 0.26, 0.62, 0.74, 0], [-2.12, 0.96, 0.2, 0.72, 0.84, 0], [-1.88, 0.99, 0.18, 0.8, 0.88, 0],
    [-1.84, 1.00, 0.18, 0.84, 0.9, 1], [-1.40, 1.00, 0.18, 0.86, 0.92, 1], [-0.96, 0.99, 0.18, 0.82, 0.92, 1],
    [-0.92, 0.99, 0.17, 0.76, 0.92, 0], [-0.4, 0.96, 0.17, 0.72, 0.9, 0], [0.3, 0.95, 0.17, 0.7, 0.86, 0], [0.98, 0.97, 0.17, 0.72, 0.8, 0],
    [1.02, 0.98, 0.17, 0.8, 0.8, 1], [1.42, 0.99, 0.17, 0.82, 0.78, 1], [1.82, 0.97, 0.18, 0.76, 0.7, 1],
    [1.86, 0.96, 0.2, 0.66, 0.68, 0], [2.14, 0.9, 0.22, 0.56, 0.58, 0], [2.3, 0.78, 0.26, 0.46, 0.48, 0],
  ];
  // body section (right half, bottom → top). Over the wheels the lower side is pulled in to open the wheel arch.
  const sec = ([z, w, sill, belt, deck, arch]) => arch
    ? [[0, 0.24], [w * 0.58, 0.24], [w * 0.6, Math.max(0.3, belt - 0.12)], [w, belt - 0.06], [w, belt], [w * 0.86, deck - 0.02], [w * 0.5, deck], [0, deck + 0.012]]
    : [[0, sill], [w * 0.88, sill], [w * 0.97, sill + 0.14], [w, (sill + belt) / 2], [w, belt], [w * 0.86, deck - 0.02], [w * 0.5, deck], [0, deck + 0.012]];
  const loft = (secs, zs, closeEnds) => {
    const pos = [], idx = [];
    const ring = (sc, z) => sc.map(([x, y]) => [x, y, z]).concat(sc.slice().reverse().map(([x, y]) => [-x, y, z]));
    const R = secs.map((sc, i) => ring(sc, zs[i])); const m = R[0].length;
    for (const r of R) for (const p of r) pos.push(...p);
    for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < m - 1; k++) { const a = i * m + k, b = a + 1, c = a + m, d = c + 1; idx.push(a, b, c, b, d, c); }
    if (closeEnds) for (const i of [0, R.length - 1]) { const base = i * m; for (let k = 1; k < m - 1; k++) i === 0 ? idx.push(base, base + k, base + k + 1) : idx.push(base, base + k + 1, base + k); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  };
  const paint = new THREE.MeshPhysicalMaterial({ color: paintHex, roughness: 0.34, metalness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
  const bm = new THREE.Mesh(loft(S.map(sec), S.map(q => q[0]), true), paint); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
  const dark = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.6, metalness: 0.15 }), carbon = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.35, metalness: 0.5 });
  const box = (w, h, d, x, y, z, m, rx = 0, ry = 0, rz = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.set(rx, ry, rz); b.castShadow = true; g.add(b); return b; };
  // wheel-arch liners and a black lip around each opening
  for (const az of [FA, RA]) for (const sx of [-1, 1]) {
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(WR + 0.1, WR + 0.1, 0.42, 20, 1, true, Math.PI / 2, Math.PI), dark); liner.rotation.z = Math.PI / 2; liner.rotation.y = 0; liner.position.set(sx * 0.78, WR + 0.02, az); liner.material.side = THREE.DoubleSide; g.add(liner);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(WR + 0.1, 0.035, 6, 20, Math.PI), carbon); lip.rotation.y = Math.PI / 2; lip.position.set(sx * 0.985, WR + 0.02, az); g.add(lip);
  }
  // glass canopy over the cabin, set a little rearward
  const CZ = [[-1.2, 0.66, 0.9, 0.93], [-0.95, 0.9, 0.92, 1.03], [-0.5, 0.94, 0.9, 1.15], [0.05, 0.94, 0.88, 1.14], [0.5, 0.95, 0.84, 0.97], [0.85, 0.72, 0.8, 0.82]];
  const csec = ([z, w, deck, top]) => [[w * 0.8, deck - 0.01], [w * 0.7, (deck + top) / 2 + 0.03], [w * 0.5, top - 0.02], [0, top]];
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1118, roughness: 0.05, metalness: 0.4, clearcoat: 1, side: THREE.DoubleSide });
  const cm = new THREE.Mesh(loft(CZ.map(csec), CZ.map(q => q[0]), false), glass); cm.castShadow = true; g.add(cm);
  // front bumper: body-coloured fascia, black grille and carbon splitter
  box(1.72, 0.22, 0.22, 0, 0.33, 2.28, paint); box(1.64, 0.1, 0.16, 0, 0.2, 2.3, paint);
  box(1.1, 0.14, 0.05, 0, 0.3, 2.395, dark); for (const s of [-1, 1]) box(0.26, 0.12, 0.05, s * 0.66, 0.3, 2.37, dark, 0, -s * 0.3);
  box(1.8, 0.04, 0.34, 0, 0.14, 2.3, carbon);
  // rear bumper: body-coloured bar, diffuser with fins, twin exhausts
  box(1.78, 0.26, 0.2, 0, 0.44, -2.33, paint); box(1.7, 0.08, 0.14, 0, 0.6, -2.34, paint);
  box(1.46, 0.16, 0.26, 0, 0.24, -2.3, carbon); for (let k = -2; k <= 2; k++) box(0.03, 0.14, 0.24, k * 0.27, 0.24, -2.33, dark);
  for (const s of [-1, 1]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0x8c8c8c, metalness: 0.9, roughness: 0.25 })); ex.rotation.x = Math.PI / 2; ex.position.set(s * 0.16, 0.33, -2.42); g.add(ex); }
  box(1.56, 0.04, 0.28, 0, 0.8, -2.16, carbon, -0.18);                                                     // ducktail
  // rounded side intakes behind the doors
  for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 4, 10), dark); v.rotation.x = Math.PI / 2; v.position.set(s * 0.955, 0.5, -0.68); v.scale.set(1, 1, 0.55); g.add(v); }
  // headlights: a smoked housing each side with two round projectors and an LED strip underneath
  const housing = new THREE.MeshPhysicalMaterial({ color: 0x0d1115, roughness: 0.08, metalness: 0.3, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const hx = s * 0.6, hz = 2.1;
    box(0.46, 0.13, 0.26, hx, 0.55, hz, housing, -0.25, -s * 0.28);
    for (const k of [0, 1]) { const pr = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), MAT.headlight); pr.rotation.x = Math.PI / 2 - 0.25; pr.position.set(hx - s * 0.08 + s * k * 0.15, 0.56, hz + 0.13 - k * 0.04); g.add(pr); }
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.018, 0.03), MAT.headlight); drl.position.set(hx, 0.48, hz + 0.1); drl.rotation.y = -s * 0.28; g.add(drl);
  }
  const tailMat = MAT.taillight.clone(); const tail = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 0.04), tailMat); tail.position.set(0, 0.7, -2.29); g.add(tail);
  for (const s of [-1, 1]) { box(0.08, 0.05, 0.1, s * 0.93, 0.88, 0.62, paint); box(0.16, 0.1, 0.06, s * 1.02, 0.91, 0.58, paint); }   // mirrors
  // wheels: pushed out to the arches so rims and tyres show
  const G = GEO.car.sedan; const wheels = [];
  for (const [x, z, front, sc] of [[0.9, FA, 1, 1.02], [-0.9, FA, 1, 1.02], [0.92, RA, 0, 1.08], [-0.92, RA, 0, 1.08]]) {
    const piv = new THREE.Group(); piv.position.set(x, G.wheelR * sc, z); const w = x > 0 ? wheelObj(G.oneLTyre, G.oneLRim) : wheelObj(G.oneRTyre, G.oneRRim); w.scale.setScalar(sc);
    const spin = new THREE.Group(); spin.add(w); piv.add(spin); g.add(piv); wheels.push({ piv, spin, front });
  }
  return { g, wheels, tailMat };
}
