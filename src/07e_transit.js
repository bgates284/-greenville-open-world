// =====================================================================
// RAILWAYS & BUSES — from OpenStreetMap (public-data/transit.json, see tools/fetch-transit.mjs):
//   • 3D track (ballast, ties, rails, bridge decks) on every mapped railway in each map square
//   • freight trains running the real lines (the CSX / Carolina Coastal Parmele and Tarboro
//     subdivisions through Greenville), sounding the horn for crossings
//   • level crossings with crossbucks, flashing lights and gates that come down for the train;
//     traffic waits at the gates
//   • ECU Transit and Greenville Area Transit (GREAT) buses driving their real routes and pausing
//     at the stops (the mapped ones, or every few blocks where the route has none mapped)
// =====================================================================

// ---------- track, built per map square from the railway lines in its data ----------
function buildRails(T, P) {
  const rails = P.lines.filter(l => l.kind === 'rail'); if (!rails.length) return;
  const bal = new MB(true), steel = new MB(true), ties = [];
  const BAL = new THREE.Color('#7b736a'), BAL2 = new THREE.Color('#5f5a54'), RAIL = new THREE.Color('#8d877f'), RAILT = new THREE.Color('#b8b2a8'), DECK = new THREE.Color('#4f4b47');
  const W = T.W;
  for (const L of rails) {
    if (L.pts.length < 2) continue;
    const R = resample(L.pts, 2); const total = R[R.length - 1][2]; if (total < 2) continue;
    const y0 = H(L.pts[0][0], L.pts[0][1]), y1 = H(L.pts[L.pts.length - 1][0], L.pts[L.pts.length - 1][1]);
    const yAt = (x, z, s) => L.bridge ? y0 + (y1 - y0) * s / total + 0.2 : H(x, z);
    const light = L.service === 'yard' || L.service === 'siding' || L.service === 'spur';
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i], b = R[i + 1]; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (mx < W.x0 - 2 || mx > W.x1 + 2 || mz < W.z0 - 2 || mz > W.z1 + 2) continue;
      let dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len; const nx = -dz, nz = dx;
      const road = onRoadSurface(mx, mz); const ya = yAt(a[0], a[1], a[2]), yb = yAt(b[0], b[1], b[2]);
      const P3 = (p, o, y) => [p[0] + nx * o, y, p[1] + nz * o];
      if (road && !L.bridge) { // level crossing: rails flush with the road, no ballast or ties
        const ry = q => H(q[0], q[1]) + 0.15 + road.road.rank * 0.012 + 0.025;
        for (const o of [-0.72, 0.72]) steel.quad(P3(a, o - 0.04, ry(a)), P3(a, o + 0.04, ry(a)), P3(b, o + 0.04, ry(b)), P3(b, o - 0.04, ry(b)), [0, 0], [0, 0], [0, 0], [0, 0], UPN, RAILT);
        continue;
      }
      if (L.bridge) { // deck plate girder
        for (const [o0, o1] of [[-1.7, 1.7]]) steel.quad(P3(a, o0, ya + 0.2), P3(a, o1, ya + 0.2), P3(b, o1, yb + 0.2), P3(b, o0, yb + 0.2), [0, 0], [0, 0], [0, 0], [0, 0], UPN, DECK);
        for (const o of [-1.7, 1.7]) steel.quad(P3(a, o, ya - 1.3), P3(b, o, yb - 1.3), P3(b, o, yb + 0.2), P3(a, o, ya + 0.2), [0, 0], [0, 0], [0, 0], [0, 0], null, DECK);
      } else { // ballast shoulder
        const top = light ? 0.2 : 0.28, hw = light ? 1.15 : 1.35, bw = light ? 1.7 : 1.95;
        bal.quad(P3(a, -hw, ya + top), P3(a, hw, ya + top), P3(b, hw, yb + top), P3(b, -hw, yb + top), [0, 0], [0, 0], [0, 0], [0, 0], UPN, BAL);
        bal.quad(P3(a, -bw, ya - 0.05), P3(a, -hw, ya + top), P3(b, -hw, yb + top), P3(b, -bw, yb - 0.05), [0, 0], [0, 0], [0, 0], [0, 0], null, BAL2);
        bal.quad(P3(a, hw, ya + top), P3(a, bw, ya - 0.05), P3(b, bw, yb - 0.05), P3(b, hw, yb + top), [0, 0], [0, 0], [0, 0], [0, 0], null, BAL2);
      }
      const base = L.bridge ? 0.2 : (light ? 0.2 : 0.28);
      // ties every ~0.6 m
      for (let s = (a[2] % 0.62 === 0 ? 0 : 0.62 - (a[2] % 0.62)); s < len; s += 0.62) { const x = a[0] + dx * s, z = a[1] + dz * s; ties.push([x, ya + (yb - ya) * s / len + base + 0.07, z, Math.atan2(dx, dz)]); }
      // rails: head + web on each side
      for (const o of [-0.72, 0.72]) {
        const t0 = ya + base + 0.3, t1 = yb + base + 0.3;
        steel.quad(P3(a, o - 0.035, t0), P3(a, o + 0.035, t0), P3(b, o + 0.035, t1), P3(b, o - 0.035, t1), [0, 0], [0, 0], [0, 0], [0, 0], UPN, RAILT);
        for (const f of [-0.035, 0.035]) steel.quad(P3(a, o + f, t0 - 0.16), P3(b, o + f, t1 - 0.16), P3(b, o + f, t1), P3(a, o + f, t0), [0, 0], [0, 0], [0, 0], [0, 0], null, RAIL);
      }
    }
  }
  if (!MAT.rail) { MAT.rail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }); MAT.ballast = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }); MAT.tie = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.95 }); GEO.railTie = new THREE.BoxGeometry(2.6, 0.16, 0.24); }
  const gb = bal.geo(); if (gb) { const m = new THREE.Mesh(gb, MAT.ballast); m.receiveShadow = true; T.group.add(m); }
  const gs = steel.geo(); if (gs) { const m = new THREE.Mesh(gs, MAT.rail); m.receiveShadow = true; m.castShadow = true; T.group.add(m); }
  if (ties.length) { const im = new THREE.InstancedMesh(GEO.railTie, MAT.tie, ties.length); const o = new THREE.Object3D(); ties.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.rotation.set(0, t[3], 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.receiveShadow = true; im.computeBoundingSphere(); T.group.add(im); }
}

// ---------- vehicle models (each merged into one vertex-coloured mesh: one draw call per vehicle) ----------
class VB {
  constructor() { this.parts = []; }
  add(g, col, x, y, z, rx = 0, ry = 0, rz = 0) {
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z); const c = new THREE.Color(col); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.index) g = g.toNonIndexed(); this.parts.push(g); return this;
  }
  box(w, h, d, x, y, z, col, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, y, z, rx, ry, rz); }
  cyl(r, len, x, y, z, col, rx, ry, rz, seg = 14) { return this.add(new THREE.CylinderGeometry(r, r, len, seg), col, x, y, z, rx, ry, rz); }
  mesh() {
    if (!MAT.vcol) MAT.vcol = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
    const g = mergeGeometries(this.parts.map(p => { p.deleteAttribute('uv'); return p; })); const m = new THREE.Mesh(g, MAT.vcol); m.castShadow = true; m.receiveShadow = true; return m;
  }
}
function makeLoco() {
  const g = new THREE.Group(); const L = 21, v = new VB(), BLUE = 0x1f3552, GRAY = 0x9aa0a4, YEL = 0xf2c11b, DARK = 0x1c1c1e, GLASS = 0x223040;
  v.box(3.0, 0.35, L, 0, 1.25, 0, DARK).box(2.4, 2.4, L - 5.2, 0, 2.62, -2.1, GRAY).box(2.42, 0.7, L - 5.2, 0, 3.47, -2.1, BLUE)
    .box(2.9, 2.8, 3.4, 0, 2.82, L / 2 - 3.9, BLUE).box(2.92, 0.7, 2.2, 0, 3.4, L / 2 - 3.2, GLASS).box(2.6, 1.3, 1.6, 0, 2.05, L / 2 - 1.3, YEL).box(2.62, 0.5, 1.62, 0, 2.95, L / 2 - 1.3, BLUE)
    .box(0.9, 0.5, 1.2, 0, 4.1, -4, DARK).box(1.6, 0.25, 1.6, 0, 3.95, -7.5, DARK);
  for (const z of [-L / 2 + 3.6, L / 2 - 3.6]) v.box(2.6, 0.9, 4.2, 0, 0.75, z, DARK);
  g.add(v.mesh());
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4c8 })); hl.position.set(0, 2.6, L / 2 - 0.45); g.add(hl);
  g.userData.len = L; return g;
}
function makeRailcar(kind, col) {
  const g = new THREE.Group(); const v = new VB(); const DARK = 0x222222; let L = 17;
  if (kind === 'tank') { L = 18; v.cyl(1.45, L - 1.6, 0, 2.75, 0, col, Math.PI / 2, 0, 0, 16).box(2.4, 0.3, L - 1.2, 0, 1.3, 0, DARK).box(0.8, 0.5, 0.8, 0, 4.3, 0, DARK); }
  else if (kind === 'hopper') { L = 16.5; v.box(3.0, 2.9, L - 1.2, 0, 2.75, 0, col); for (const z of [-4, 0, 4]) v.add(new THREE.ConeGeometry(1.2, 1.0, 4), col, 0, 1.1, z, Math.PI, 0, 0); }
  else if (kind === 'gondola') { L = 16; v.box(3.0, 1.5, L - 1.2, 0, 2.0, 0, col).box(2.8, 0.2, L - 1.6, 0, 2.5, 0, DARK); }
  else { L = 17.5; v.box(3.0, 3.6, L - 1.2, 0, 3.05, 0, col).box(0.05, 2.6, 3.0, 1.52, 2.8, 0, DARK).box(0.05, 2.6, 3.0, -1.52, 2.8, 0, DARK); }
  for (const z of [-L / 2 + 2.2, L / 2 - 2.2]) v.box(2.4, 0.8, 2.6, 0, 0.72, z, DARK);
  g.add(v.mesh()); g.userData.len = L; return g;
}
function makeBus(op, label, colour) {
  const ecu = /carolina|ecu/i.test(op); const L = 12.2, g = new THREE.Group(), v = new VB();
  const bodyC = ecu ? 0x5b2c8e : 0xf2f2ee, stripe = ecu ? 0xfdc82f : new THREE.Color(colour && /^#?[0-9a-f]{6}$/i.test(colour) ? (colour[0] === '#' ? colour : '#' + colour) : '#1f5fae').getHex(), GLASS = 0x1b2632, DARK = 0x1a1a1a;
  v.box(2.55, 2.55, L, 0, 1.75, 0, bodyC).box(2.57, 1.05, L - 2.6, 0, 2.2, -0.6, GLASS).box(2.4, 1.3, 0.06, 0, 2.2, L / 2 + 0.01, GLASS).box(2.4, 1.0, 0.06, 0, 2.3, -L / 2 - 0.01, GLASS)
    .box(2.57, 0.35, L, 0, 1.0, 0, stripe).box(2.3, 0.18, L - 1, 0, 3.12, 0, DARK).box(2.6, 0.3, 0.2, 0, 0.55, L / 2 + 0.05, DARK).box(2.6, 0.3, 0.2, 0, 0.55, -L / 2 - 0.05, DARK);
  for (const z of [L / 2 - 2.6, -L / 2 + 3.0]) for (const x of [-1.1, 1.1]) v.cyl(0.5, 0.3, x, 0.5, z, DARK, 0, 0, Math.PI / 2);
  g.add(v.mesh());
  const tex = textTexture([[label, 150, '#ffb400', 128, 800]], { w: 1024, h: 256, bg: '#111111' });
  const sm = new THREE.MeshBasicMaterial({ map: tex }); const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.38), sm); sign.position.set(0, 2.98, L / 2 + 0.04); g.add(sign);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), sm); side.position.set(1.29, 2.95, 2.4); side.rotation.y = Math.PI / 2; g.add(side);
  g.userData.len = L; g.userData.mats = [sm, tex]; return g;
}

// ---------- the network ----------
const Transit = {
  data: null, loading: null, lines: [], routes: [], trains: [], buses: [], xings: new Map(), props: new Map(), t: 0,
  base() { return window.GV_DATA ? window.GV_DATA : 'public-data/'; },
  load() {
    if (this.loading) return this.loading;
    this.loading = fetch(this.base() + 'transit.json').then(r => r.ok ? r.json() : null).then(d => { if (d) this.prepare(d); }).catch(e => console.warn('transit data unavailable', e));
    return this.loading;
  },
  prepare(d) {
    this.data = d; World.levelX = World.levelX || new Map();
    // --- railway lines: stitch the main-line pieces end to end ---
    const main = d.rails.filter(w => !w.service || (w.service === 'spur' && /branch|main/.test(w.usage)));
    const ends = new Map(); const add = (id, w) => { if (!ends.has(id)) ends.set(id, []); ends.get(id).push(w); };
    for (const w of main) { w.xz = w.pts.map(([la, lo]) => [lonToX(lo), latToZ(la)]); add(w.nodes[0], w); add(w.nodes[w.nodes.length - 1], w); }
    const used = new Set();
    const dirAt = (pts, atEnd) => { const n = pts.length; const a = atEnd ? pts[n - 2] : pts[1], b = atEnd ? pts[n - 1] : pts[0]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    for (const w0 of main) {
      if (used.has(w0)) continue; used.add(w0);
      let pts = w0.xz.slice(), br = w0.xz.map(() => w0.bridge), head = w0.nodes[0], tail = w0.nodes[w0.nodes.length - 1];
      for (const side of ['tail', 'head']) {
        for (let guard = 0; guard < 400; guard++) {
          const nid = side === 'tail' ? tail : head; const d0 = dirAt(pts, side === 'tail');
          let best = null, bs = -2;
          for (const w of ends.get(nid) || []) { if (used.has(w)) continue; const fwd = w.nodes[0] === nid; const p = fwd ? w.xz : w.xz.slice().reverse(); const l = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) || 1; const sc = ((p[1][0] - p[0][0]) * d0[0] + (p[1][1] - p[0][1]) * d0[1]) / l; if (sc > bs) { bs = sc; best = { w, p, fwd }; } }
          if (!best || bs < 0.3) break;
          used.add(best.w); const other = best.fwd ? best.w.nodes[best.w.nodes.length - 1] : best.w.nodes[0];
          if (side === 'tail') { pts = pts.concat(best.p.slice(1)); br = br.concat(best.p.slice(1).map(() => best.w.bridge)); tail = other; }
          else { const q = best.p.slice().reverse(); pts = q.slice(0, -1).concat(pts); br = q.slice(0, -1).map(() => best.w.bridge).concat(br); head = other; }
        }
      }
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      if (cum[cum.length - 1] > 1500) this.lines.push({ pts, br, cum, len: cum[cum.length - 1], xs: [] });
    }
    // level crossings on each line (for horns and gates)
    for (const x of d.xings) {
      if (x.kind !== 'level_crossing') continue; x.x = lonToX(x.lon); x.z = latToZ(x.lat);
      for (const L of this.lines) { const s = this.project(L, x.x, x.z, 8); if (s != null) { L.xs.push({ s, x }); x.line = L; x.s = s; } }
    }
    for (const L of this.lines) L.xs.sort((a, b) => a.s - b.s);
    // --- bus routes: ways stitched in order, stops placed along them ---
    for (const r of d.routes) {
      let pts = [];
      for (const w of r.ways) {
        let p = w.map(([la, lo]) => [lonToX(lo), latToZ(la)]); if (p.length < 2) continue;
        if (pts.length) { const e = pts[pts.length - 1]; const dS = Math.hypot(p[0][0] - e[0], p[0][1] - e[1]), dE = Math.hypot(p[p.length - 1][0] - e[0], p[p.length - 1][1] - e[1]); if (dE < dS) p = p.reverse(); if (Math.min(dS, dE) < 1) p = p.slice(1); }
        else if (r.ways.length > 1) { const n = r.ways[1].map(([la, lo]) => [lonToX(lo), latToZ(la)]); const end = p[p.length - 1], st = p[0]; const dEnd = Math.min(...[n[0], n[n.length - 1]].map(q => Math.hypot(q[0] - end[0], q[1] - end[1]))), dSt = Math.min(...[n[0], n[n.length - 1]].map(q => Math.hypot(q[0] - st[0], q[1] - st[1]))); if (dSt < dEnd) p = p.reverse(); }
        for (const q of p) if (!pts.length || Math.hypot(q[0] - pts[pts.length - 1][0], q[1] - pts[pts.length - 1][1]) > 0.5) pts.push(q);
      }
      if (pts.length < 3) continue;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const R = { r, pts, cum, len: cum[cum.length - 1], stops: [], label: (/carolina|ecu/i.test(r.operator) ? 'ECU ' : 'GREAT ') + (r.ref || '') + (/carolina|ecu/i.test(r.operator) && r.name ? ' ' + r.name.replace(/^\d+\s*/, '').split(/[\s:]/)[0] : '') };
      for (const [la, lo] of r.stops || []) { const s = this.project(R, lonToX(lo), latToZ(la), 40); if (s != null) R.stops.push({ s, x: lonToX(lo), z: latToZ(la), real: true }); }
      if (!R.stops.length) for (let s = 160; s < R.len - 60; s += 460) { const p = this.at(R, s); R.stops.push({ s, x: p.x, z: p.z, real: false }); }
      R.stops.sort((a, b) => a.s - b.s); this.routes.push(R);
    }
    this.stops = d.stops.map(s => ({ x: lonToX(s.lon), z: latToZ(s.lat), name: s.name, shelter: s.shelter, bench: s.bench }));
    for (const R of this.routes) for (const st of R.stops) if (!st.real) { const p = this.at(R, st.s); st.synth = { x: p.x, z: p.z, dx: p.dx, dz: p.dz }; }
    console.log(`transit: ${this.lines.length} rail lines (${Math.round(this.lines.reduce((a, L) => a + L.len, 0) / 1000)} km), ${this.routes.length} bus routes`);
  },
  project(L, x, z, maxD) { // arc length of the closest point on a polyline, or null
    let best = null, bd = maxD;
    for (let i = 0; i < L.pts.length - 1; i++) { const a = L.pts[i], b = L.pts[i + 1]; if (Math.abs(a[0] - x) > 400 && Math.abs(b[0] - x) > 400) continue; const sd = segDist(x, z, a[0], a[1], b[0], b[1]); if (sd.d < bd) { bd = sd.d; best = L.cum[i] + sd.t * (L.cum[i + 1] - L.cum[i]); } }
    return best;
  },
  at(L, s) {
    s = clamp(s, 0, L.len); let lo = 0, hi = L.cum.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L.cum[m] <= s) lo = m; else hi = m - 1; }
    const a = L.pts[lo], b = L.pts[lo + 1]; const seg = L.cum[lo + 1] - L.cum[lo] || 1; const t = (s - L.cum[lo]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg, i: lo };
  },
  railY(L, s, x, z) { // top of rail: ground, or across a bridge span
    const p = this.at(L, s); if (!L.br[p.i]) return H(x, z) + 0.58;
    let i0 = p.i, i1 = p.i + 1; while (i0 > 0 && L.br[i0 - 1]) i0--; while (i1 < L.pts.length - 1 && L.br[i1]) i1++;
    const y0 = H(L.pts[i0][0], L.pts[i0][1]), y1 = H(L.pts[i1][0], L.pts[i1][1]); const k = clamp((s - L.cum[i0]) / ((L.cum[i1] - L.cum[i0]) || 1), 0, 1);
    return y0 + (y1 - y0) * k + 0.5;
  },

  // ---------- trains ----------
  spawnTrain(f) {
    const cand = []; for (const L of this.lines) { const s = this.project(L, f.x, f.z, 1400); if (s != null) cand.push([L, s]); }
    if (!cand.length) return; const [L, sN] = cand[Math.floor(Math.random() * cand.length)];
    const dir = Math.random() < 0.5 ? 1 : -1; const s0 = sN - dir * (900 + Math.random() * 400); if (s0 < 50 || s0 > L.len - 50) return;
    const g = new THREE.Group(); const cars = []; const loco = makeLoco(); g.add(loco); cars.push(loco);
    if (Math.random() < 0.6) { const l2 = makeLoco(); g.add(l2); cars.push(l2); }
    const kinds = ['box', 'hopper', 'tank', 'gondola'], cols = [0x7a3b26, 0x8c4a2f, 0x5d6166, 0x2b2b2b, 0x6f7a3a, 0x9a9486, 0x3a4a6a];
    const n = 8 + Math.floor(Math.random() * 18); let run = null;
    for (let k = 0; k < n; k++) { if (!run || Math.random() < 0.35) run = [kinds[Math.floor(Math.random() * kinds.length)], cols[Math.floor(Math.random() * cols.length)]]; const c = makeRailcar(run[0], run[0] === 'tank' ? 0x1e1e20 : run[1]); g.add(c); cars.push(c); }
    dynRoot.add(g);
    const tr = { L, s: s0, dir, speed: 0, vmax: 11 + Math.random() * 5, g, cars, horned: new Set(), len: cars.reduce((a, c) => a + c.userData.len + 1, 0) };
    this.trains.push(tr); this.placeTrain(tr);
  },
  placeTrain(tr) {
    let off = 0; tr.box = [];
    for (let k = 0; k < tr.cars.length; k++) {
      const c = tr.cars[k], L = c.userData.len; const sf = tr.s - tr.dir * (off + 0.2), sb = tr.s - tr.dir * (off + L - 0.2), sm = (sf + sb) / 2;
      const pf = this.at(tr.L, sf), pb = this.at(tr.L, sb); const x = (pf.x + pb.x) / 2, z = (pf.z + pb.z) / 2;
      const yf = this.railY(tr.L, sf, pf.x, pf.z), yb = this.railY(tr.L, sb, pb.x, pb.z);
      c.position.set(x, (yf + yb) / 2 - 0.2, z); c.rotation.set(0, 0, 0); c.rotation.order = 'YXZ';
      c.rotation.y = Math.atan2(pf.x - pb.x, pf.z - pb.z); c.rotation.x = -Math.atan2(yf - yb, L);
      c.visible = sm > -5 && sm < tr.L.len + 5; tr.box.push([x, z, Math.atan2(pf.x - pb.x, pf.z - pb.z), L]);
      off += L + 1.0;
    }
  },
  updateTrains(dt, f) {
    for (let i = this.trains.length - 1; i >= 0; i--) {
      const tr = this.trains[i]; tr.speed += clamp(tr.vmax - tr.speed, -2 * dt, 0.5 * dt); tr.s += tr.dir * tr.speed * dt;
      // horn for each crossing ahead: long, long, short, long
      for (const X of tr.L.xs) { const ahead = (X.s - tr.s) * tr.dir; if (ahead > 0 && ahead < 260 && !tr.horned.has(X.x.id)) { tr.horned.add(X.x.id); const p = this.at(tr.L, tr.s); if (Math.hypot(p.x - f.x, p.z - f.z) < 900) this.horn(Math.hypot(p.x - f.x, p.z - f.z)); } }
      this.placeTrain(tr);
      const tail = tr.s - tr.dir * tr.len, pt = this.at(tr.L, tail), ph = this.at(tr.L, tr.s);
      const gone = (tail < -10 || tail > tr.L.len + 10) || (Math.min(Math.hypot(pt.x - f.x, pt.z - f.z), Math.hypot(ph.x - f.x, ph.z - f.z)) > 2200);
      if (gone) { tr.g.removeFromParent(); tr.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.trains.splice(i, 1); }
    }
  },
  horn(dist) {
    const A = Sound.ctx; if (!A || !Sound.on) return; const t0 = A.currentTime; const vol = clamp(0.12 * (1 - dist / 900), 0.005, 0.12);
    const pat = [[0, 1.3], [1.6, 1.3], [3.2, 0.5], [4.0, 1.8]];
    for (const [st, du] of pat) for (const fq of [311, 370, 466]) { const o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.value = fq; g.gain.setValueAtTime(0, t0 + st); g.gain.linearRampToValueAtTime(vol / 3, t0 + st + 0.08); g.gain.setValueAtTime(vol / 3, t0 + st + du - 0.1); g.gain.linearRampToValueAtTime(0, t0 + st + du); o.connect(g); g.connect(Sound.master); o.start(t0 + st); o.stop(t0 + st + du + 0.05); }
  },
  crossingActive(x) { for (const tr of this.trains) { if (tr.L !== x.line) continue; const a = (x.s - tr.s) * tr.dir; if (a < 230 && a > -(tr.len + 25)) return true; } return false; },

  // ---------- level crossings: crossbucks, lights, gates ----------
  buildCrossing(x) {
    const rd = nearestRoad(x.x, x.z, 10, r => r.car && !r.bridge); if (!rd) return null;
    const r = rd.road, a = r.pts[rd.i], b = r.pts[rd.i + 1]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx;
    const g = new THREE.Group(); const lamps = [], arms = []; const hw = r.w / 2;
    for (const side of [1, -1]) { // one post on each side, facing the traffic that approaches on that side
      const back = 3.2 * side; const px = x.x + nx * (hw + 1.1) * side - dx * back, pz = x.z + nz * (hw + 1.1) * side - dz * back; const gy = H(px, pz);
      const post = new THREE.Group(); post.position.set(px, gy, pz); post.rotation.y = Math.atan2(dx * side, dz * side); g.add(post);
      const v = new VB(); v.box(0.12, 4.2, 0.12, 0, 2.1, 0, 0xc9c9c6).box(1.25, 0.22, 0.03, 0, 3.75, 0.08, 0xf2f2f0, 0, 0, Math.PI / 4).box(1.25, 0.22, 0.03, 0, 3.75, 0.1, 0xf2f2f0, 0, 0, -Math.PI / 4).box(1.1, 0.12, 0.1, 0, 2.95, 0.06, 0x151515).box(0.4, 0.5, 0.4, 0.25, 0.9, -0.25, 0x2a2a2a);
      post.add(v.mesh());
      for (const s of [-1, 1]) { const m = new THREE.MeshBasicMaterial({ color: 0x3a0505 }); const L = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 14), m); L.rotation.x = Math.PI / 2; L.position.set(s * 0.45, 2.95, 0.14); post.add(L); lamps.push(m); }
      // gate arm across the approach lane(s), pivoting at the post
      const pivot = new THREE.Group(); pivot.position.set(0.25, 1.05, -0.25); post.add(pivot);
      const armLen = Math.max(3, hw + 0.4); const va = new VB(); const n = Math.ceil(armLen / 0.6); for (let k = 0; k < n; k++) va.box(0.6, 0.1, 0.1, (k + 0.5) * 0.6 * -side * 0 + (k + 0.5) * 0.6, 0, 0, k % 2 ? 0xd11f1f : 0xf2f2f0);
      const am = va.mesh(); am.castShadow = false; pivot.add(am); pivot.userData.sign = 1; arms.push(pivot);
    }
    dynRoot.add(g); return { g, lamps, arms, down: 0, x };
  },
  updateCrossings(dt, f) {
    if ((this.t % 2) < dt) { // every couple of seconds: build nearby, drop far ones
      for (const x of this.data.xings) {
        if (x.kind !== 'level_crossing') continue; const d = Math.hypot(x.x - f.x, x.z - f.z);
        if (d < 650 && !this.xings.has(x.id)) { const [tx, ty] = tileOfXZ(x.x, x.z); const T = Tiles.map.get(tileKey(tx, ty)); if (!T || T.state !== 'ready') continue; const o = this.buildCrossing(x); this.xings.set(x.id, o || { none: true, x }); if (o) World.levelX.set(x.id, o); }
        else if (d > 900 && this.xings.has(x.id)) { const o = this.xings.get(x.id); if (o.g) { o.g.removeFromParent(); o.g.traverse(q => { if (q.geometry) q.geometry.dispose(); }); } this.xings.delete(x.id); World.levelX.delete(x.id); }
      }
    }
    const blink = (this.t % 1) < 0.5;
    for (const o of this.xings.values()) {
      if (!o.g) continue; o.active = !!o.x.line && this.crossingActive(o.x);
      o.down = clamp(o.down + (o.active ? dt / 6 : -dt / 5), 0, 1);
      o.lamps.forEach((m, k) => m.color.setHex(o.active && ((k % 2 === 0) === blink) ? 0xff2a1a : 0x3a0505));
      for (const a of o.arms) a.rotation.z = Math.PI / 2 * 0.97 * (1 - o.down);
    }
  },

  // ---------- buses ----------
  spawnBus(f) {
    const cand = []; for (const R of this.routes) { if (this.buses.some(b => b.R === R)) continue; const s = this.project(R, f.x, f.z, 1300); if (s != null) cand.push([R, s]); }
    if (!cand.length) return; const [R, sN] = cand[Math.floor(Math.random() * cand.length)];
    let s = sN - 250 - Math.random() * 300; if (s < 0) s += R.len;
    const obj = makeBus(R.r.operator, R.label.trim(), R.r.colour); dynRoot.add(obj);
    const b = { bus: true, R, s, speed: 0, x: 0, z: 0, yaw: 0, len: obj.userData.len, obj, wait: 0, next: R.stops.findIndex(st => st.s > s), road: { removed: false }, stuck: 0 };
    this.place(b, 0); this.buses.push(b); Traffic.cars.push(b);
  },
  place(b, dt) {
    const R = b.R; const p = this.at(R, b.s); const q = this.at(R, b.s + 6);
    let dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // keep right: offset from the route line (which follows the road centre) into the right-hand lane
    if (!b.laneT || b.laneT < 0) { b.laneT = 1; const n = nearestRoad(p.x, p.z, 12, r => r.car); b.off = n ? (n.road.oneway ? 0 : clamp(n.road.w / 4 + 0.2, 1.6, 3.4)) : 1.8; } b.laneT -= dt;
    b.offS = b.offS == null ? b.off : b.offS + (b.off - b.offS) * Math.min(1, dt * 2);
    const x = p.x - dz * b.offS, z = p.z + dx * b.offS; // right of travel is (-dz, dx), as in roadLanes()
    const yaw = Math.atan2(dx, dz); b.yaw = b.yaw ? b.yaw + angleDiff(b.yaw, yaw) * Math.min(1, dt * 4 || 1) : yaw;
    const y = surfaceY(x, z, (b.y || H(x, z)) + 1.2) + 0.2; b.y = y; b.x = x; b.z = z;
    b.obj.position.set(x, y, z); b.obj.rotation.y = b.yaw;
  },
  updateBuses(dt, f, simT) {
    const pc = Player.car;
    for (let i = this.buses.length - 1; i >= 0; i--) {
      const b = this.buses[i], R = b.R;
      if (Math.hypot(b.x - f.x, b.z - f.z) > 1700) { this.dropBus(b); continue; }
      let vDes = 11.5; const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
      // corners
      const a0 = this.at(R, b.s + 4), a1 = this.at(R, b.s + 22); const turn = 1 - (a0.dx * a1.dx + a0.dz * a1.dz); if (turn > 0.15) vDes = Math.min(vDes, lerp(9, 4, clamp(turn, 0, 1)));
      // stops
      if (b.wait > 0) { b.wait -= dt; vDes = 0; if (b.wait <= 0) b.next = (b.next + 1) % Math.max(1, R.stops.length); }
      else if (R.stops.length && b.next >= 0) { const st = R.stops[b.next]; let ds = st.s - b.s; if (ds < -5) { b.next = R.stops.findIndex(q => q.s > b.s); if (b.next < 0) b.next = 0; } else { if (ds < 45) vDes = Math.min(vDes, Math.sqrt(Math.max(0, 2 * 1.4 * ds))); if (ds < 1.2 && b.speed < 0.6) { b.wait = 9 + Math.random() * 7; } } }
      // whatever is ahead: cars, buses, the player
      let gap = 1e9;
      const look = (ox, oz, olen) => { const rx = ox - b.x, rz = oz - b.z; const al = rx * fx + rz * fz; if (al <= 0 || al > 50) return; const lat = Math.abs(rx * fz - rz * fx); if (lat < 2.3) gap = Math.min(gap, al - (b.len + olen) / 2); };
      for (const o of Traffic.cars) if (o !== b) look(o.x, o.z, o.len || 4.5);
      look(pc.pos.x, pc.pos.z, 4.6); if (Player.mode === 'walk') look(Player.pos.x, Player.pos.z, 0.6);
      if (gap < 60) vDes = Math.min(vDes, Math.max(0, gap - 3) * 0.7);
      // signals and railway gates ahead
      b.sigT = (b.sigT || 0) - dt; if (b.sigT <= 0) { b.sigT = 0.4; b.redAt = null;
        for (const s of World.signals.values()) { const rx = s.x - b.x, rz = s.z - b.z; const al = rx * fx + rz * fz; if (al < 6 || al > 45) continue; if (Math.abs(rx * fz - rz * fx) > 12) continue; const st = sigState(Math.abs(fx * s.ax + fz * s.az) > 0.7071, simT); if (st === 0 || (st === 1 && al > 20)) { b.redAt = al - 13; break; } }
        if (World.levelX) for (const o of World.levelX.values()) { if (!o.active) continue; const rx = o.x.x - b.x, rz = o.x.z - b.z; const al = rx * fx + rz * fz; if (al > 4 && al < 60 && Math.abs(rx * fz - rz * fx) < 10) { b.redAt = Math.min(b.redAt ?? 1e9, al - 9); } }
      }
      if (b.redAt != null) vDes = Math.min(vDes, b.redAt < 0.5 ? 0 : Math.sqrt(2 * 3 * b.redAt));
      if (b.speed < vDes) b.speed = Math.min(vDes, b.speed + 1.8 * dt); else b.speed = Math.max(vDes, b.speed - 6 * dt);
      b.s += b.speed * dt; if (b.redAt != null) b.redAt -= b.speed * dt;
      if (b.s > R.len - 1) { b.s = 0; b.next = 0; } // loop routes start over (most are round trips)
      this.place(b, dt);
    }
  },
  dropBus(b) { b.obj.removeFromParent(); b.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); for (const m of b.obj.userData.mats || []) m.dispose && m.dispose(); const i = this.buses.indexOf(b); if (i >= 0) this.buses.splice(i, 1); const j = Traffic.cars.indexOf(b); if (j >= 0) Traffic.cars.splice(j, 1); if (typeof Phys !== 'undefined' && Phys.ready) Phys.dropKin(b); },

  // ---------- bus stop signs & benches ----------
  updateStops(f) {
    const want = new Map();
    for (const R of this.routes) for (const st of R.stops) { const d = Math.hypot(st.x - f.x, st.z - f.z); if (d < 450) want.set(Math.round(st.x) + ',' + Math.round(st.z), st); }
    for (const s of this.stops || []) { const d = Math.hypot(s.x - f.x, s.z - f.z); if (d < 450) want.set(Math.round(s.x) + ',' + Math.round(s.z), s); }
    for (const [k, st] of want) if (!this.props.has(k)) { const [tx, ty] = tileOfXZ(st.x, st.z); const T = Tiles.map.get(tileKey(tx, ty)); if (!T || T.state !== 'ready') continue; this.props.set(k, this.buildStop(st)); }
    for (const [k, o] of this.props) if (!want.has(k)) { if (o) { o.removeFromParent(); o.traverse(q => { if (q.geometry && q.geometry !== GEO.stopPlate) q.geometry.dispose(); }); } this.props.delete(k); }
  },
  buildStop(st) {
    let x = st.x, z = st.z, yaw = 0;
    const rd = nearestRoad(x, z, 25, r => r.car); if (rd) { const r = rd.road, a = r.pts[rd.i], b = r.pts[rd.i + 1]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; let nx = x - rd.x, nz = z - rd.z; let nl = Math.hypot(nx, nz); if (nl < 0.5) { nx = dz; nz = -dx; nl = 1; if (st.synth) { nx = -st.synth.dz; nz = st.synth.dx; } } nx /= nl; nz /= nl; const o = r.w / 2 + 1.4; x = rd.x + nx * o; z = rd.z + nz * o; yaw = Math.atan2(nx, nz); }
    if (insideBuilding(x, z)) return null;
    const g = new THREE.Group(); g.position.set(x, groundY(x, z, H(x, z) + 1), z); g.rotation.y = yaw;
    const v = new VB(); v.box(0.07, 2.6, 0.07, 0, 1.3, 0, 0x9aa0a6).box(1.6, 0.06, 0.42, 1.2, 0.46, -0.2, 0x6b4a2e).box(1.6, 0.4, 0.05, 1.2, 0.7, -0.4, 0x6b4a2e);
    for (const s of [-0.7, 0.7]) v.box(0.05, 0.44, 0.4, 1.2 + s, 0.22, -0.2, 0x2b2d30);
    if (st.shelter) v.box(2.8, 0.08, 1.3, 1.2, 2.35, -0.2, 0x2b2d30).box(0.06, 2.3, 0.06, -0.1, 1.15, -0.8, 0x2b2d30).box(0.06, 2.3, 0.06, 2.5, 1.15, -0.8, 0x2b2d30);
    g.add(v.mesh());
    if (!Transit.stopTex) Transit.stopTex = new THREE.MeshStandardMaterial({ map: textTexture([['BUS', 120, '#ffffff', 90, 900], ['STOP', 120, '#ffffff', 200, 900]], { w: 256, h: 300, bg: '#1d5fae' }), roughness: 0.5 });
    if (!GEO.stopPlate) GEO.stopPlate = new THREE.BoxGeometry(0.46, 0.54, 0.03);
    const sign = new THREE.Mesh(GEO.stopPlate, Transit.stopTex); sign.position.set(0, 2.35, 0.05); g.add(sign);
    dynRoot.add(g); return g;
  },

  // ---------- per frame ----------
  update(dt, f, simT) {
    if (!this.data) { if (!this.loading) this.load(); return; }
    this.t += dt;
    const maxTrains = 1, maxBuses = Q === QUALITY.low ? 4 : Q === QUALITY.medium ? 6 : 9;
    this.spawnT = (this.spawnT || 0) - dt;
    if (this.spawnT <= 0) { this.spawnT = 3; if (this.trains.length < maxTrains && Math.random() < 0.35) this.spawnTrain(f); if (this.buses.length < maxBuses) this.spawnBus(f); this.updateStops(f); }
    this.updateTrains(dt, f); this.updateCrossings(dt, f); this.updateBuses(dt, f, simT);
    this.hitPlayer();
  },
  hitPlayer() { // trains are solid: shove the car / person out and crash
    const P = Player; const drive = P.mode === 'drive'; if (!drive && P.mode !== 'walk') return; const pos = drive ? P.car.pos : P.pos; const r = drive ? 1.6 : 0.4;
    for (const tr of this.trains) for (const [x, z, yaw, L] of tr.box || []) {
      if (Math.abs(x - pos.x) > L && Math.abs(z - pos.z) > L) continue;
      const fx = Math.sin(yaw), fz = Math.cos(yaw); const rx = pos.x - x, rz = pos.z - z; const al = rx * fx + rz * fz, lat = rx * fz - rz * fx;
      if (Math.abs(al) < L / 2 + r && Math.abs(lat) < 1.55 + r) { const push = (1.55 + r - Math.abs(lat)) * Math.sign(lat || 1); pos.x += fz * push; pos.z -= fx * push; if (drive) { const imp = Math.abs(P.car.speed) + tr.speed; if (imp > 3) { Sound.thud(Math.min(30, imp * 1.5)); UI.shake(1); } P.car.speed *= 0.2; } }
    }
  },
  clear() {
    for (const tr of this.trains) tr.g.removeFromParent(); this.trains = [];
    for (const b of [...this.buses]) this.dropBus(b);
    for (const o of this.xings.values()) if (o.g) o.g.removeFromParent(); this.xings.clear(); if (World.levelX) World.levelX.clear();
    for (const o of this.props.values()) if (o) o.removeFromParent(); this.props.clear();
  },
};
