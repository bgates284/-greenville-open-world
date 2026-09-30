
// =====================================================================
// STREETS — detail built on top of the road ribbons:
//   • lane markings as real geometry, laid out from the OSM lane counts: double-yellow centre
//     lines, a centre two-way-turn lane on 3/5-lane arterials (Memorial Dr, Arlington Blvd…),
//     dashed lane lines, white edge lines; markings stop short of intersections
//   • intersection surfaces shaped from the incoming roads (not circles), with curbs and
//     sidewalk corners that wrap round the block, crosswalks at signals and mapped crossings,
//     stop bars at signals and stop signs
//   • lane layout shared with the traffic AI so cars drive in the painted lanes
// =====================================================================
World.walkHash = new SpatialHash(20);
const MARK_W = new THREE.Color('#e9e9e2'), MARK_Y = new THREE.Color('#e0b12a');
function roadLanes(r) {
  if (r._lanes) return r._lanes;
  const t = r.tags || {}; const n = Math.max(1, r.lanes || 1); const m = r.rank >= 6 ? 0.55 : 0.3;
  let F, B, T = 0;
  if (r.oneway) { F = n; B = 0; }
  else {
    const lf = parseInt(t['lanes:forward']), lb = parseInt(t['lanes:backward']), both = parseInt(t['lanes:both_ways']);
    if (lf > 0 && lb > 0) { F = lf; B = lb; T = both > 0 ? 1 : 0; }
    else if (n >= 3 && n % 2 === 1 && r.rank >= 5) { T = 1; F = B = (n - 1) / 2; }
    else { F = Math.max(1, Math.ceil(n / 2)); B = Math.max(1, n - F); }
  }
  const N = F + B + T; const lw = Math.max(2.4, (r.w - 2 * m) / N);
  const pos = j => -r.w / 2 + m + (j + 0.5) * lw; // lane centre, measured to the right of the road's drawing direction
  return r._lanes = { F, B, T, N, m, lw, pos, marked: r.rank >= 5 || (r.rank === 4 && r.w >= 6) || (r.oneway && n >= 2 && r.rank >= 3) };
}
// lane centre for a car travelling along (dir=+1) or against (dir=-1) the drawing direction; lane 0 = curb lane
function laneCenterOffset(r, dir, lane) {
  const L = roadLanes(r);
  if (r.oneway) { const n = L.F; const j = dir > 0 ? n - 1 - Math.min(lane, n - 1) : Math.min(lane, n - 1); return dir * L.pos(j); }
  if (dir > 0) { const j = Math.max(L.B + L.T, L.N - 1 - lane); return L.pos(j); }
  const j = Math.min(L.B - 1, lane); return -L.pos(Math.max(0, j));
}

// ---- junctions: shape, clearance and controls, computed before the road ribbons ----
function buildJunctions(T, P) {
  const J = new Map();
  for (const id of T.roadIds) {
    const road = World.roads.get(id); if (!road || !road.mesh || road.bridge) continue;
    for (let i = 0; i < road.nodes.length; i++) {
      const nid = road.nodes[i]; if (J.has(nid) || !isJunction(nid, P)) continue;
      const adj = (World.nodeAdj.get(nid) || []).filter(a => a.road.mesh && !a.road.bridge);
      const [cx, cz] = road.pts[i]; const arms = [];
      for (const { road: r, idx } of adj) for (const k of [-1, 1]) {
        const j = idx + k; if (j < 0 || j >= r.pts.length) continue;
        const dx = r.pts[j][0] - cx, dz = r.pts[j][1] - cz, l = Math.hypot(dx, dz); if (l < 0.5) continue;
        // incoming = traffic on this arm drives toward the junction
        const incoming = r.oneway ? (r.oneway * (-k) > 0) : true, outgoing = r.oneway ? !incoming : true;
        arms.push({ road: r, idx, k, dx: dx / l, dz: dz / l, w: r.w, ang: Math.atan2(dz, dx), incoming, outgoing, segLen: l });
      }
      if (arms.length < 2) continue;
      arms.sort((a, b) => a.ang - b.ang);
      let wmax = 0, rmax = 0; for (const a of arms) { wmax = Math.max(wmax, a.w); rmax = Math.max(rmax, a.road.rank); }
      const e = Math.max(3.2, wmax / 2 + (rmax >= 5 ? 4.2 : rmax >= 3 ? 3.0 : 1.6)); // where the curb return starts
      const signal = World.signals.has(nid) || arms.some(a => { for (let q = 1; q <= 2; q++) { const n2 = a.road.nodes[a.idx + a.k * q]; if (n2 != null && World.signals.has(n2) && Math.hypot(a.road.pts[a.idx + a.k * q][0] - cx, a.road.pts[a.idx + a.k * q][1] - cz) < 30) return true; } return false; });
      for (const a of arms) { a.stop = false; for (let q = 0; q <= 2; q++) { const n2 = a.road.nodes[a.idx + a.k * q]; if (n2 != null && World.stops.has(n2) && Math.hypot(a.road.pts[a.idx + a.k * q][0] - cx, a.road.pts[a.idx + a.k * q][1] - cz) < 20) a.stop = true; } }
      J.set(nid, { id: nid, x: cx, z: cz, arms, e, wmax, rmax, signal, y: H(cx, cz) + 0.15 + rmax * 0.012 + 0.03 });
    }
  }
  return J;
}

function buildStreetDetail(T, P, J, R_of, mk, disc, sw) {
  // ---- lane markings along each road ----
  for (const id of T.roadIds) {
    const road = World.roads.get(id); if (!road || !road.mesh) continue; const L = roadLanes(road); if (!L.marked) continue;
    const RR = R_of.get(id); if (!RR) continue; const { R, Ry } = RR;
    // stretches clear of junctions (plus room for a crosswalk / stop bar)
    const blocks = [];
    for (let i = 0; i < road.nodes.length; i++) { const j = J.get(road.nodes[i]); if (j) blocks.push([road.cum[i] - j.e - (j.signal ? 5 : 1.5), road.cum[i] + j.e + (j.signal ? 5 : 1.5)]); }
    const clearAt = s => !blocks.some(b => s > b[0] && s < b[1]);
    const lines = []; const w = road.w;
    const solid = (o, col, lw = 0.13) => lines.push({ o, col, lw, dash: null });
    const dashed = (o, col, lw = 0.12) => lines.push({ o, col, lw, dash: [3, 9] });
    const left = -w / 2 + L.m, right = w / 2 - L.m;
    if (road.oneway) {
      const yl = road.oneway > 0 ? left : right, wr = road.oneway > 0 ? right : left;
      if (road.rank >= 4) { solid(yl, MARK_Y, 0.14); solid(wr, MARK_W, 0.15); }
      for (let j = 1; j < L.N; j++) dashed(left + j * L.lw, MARK_W);
    } else {
      if (road.rank >= 6 || L.N >= 4) { solid(left, MARK_W, 0.15); solid(right, MARK_W, 0.15); }
      for (let j = 1; j < L.B; j++) dashed(left + j * L.lw, MARK_W);
      const c0 = left + L.B * L.lw;
      if (L.T) { const c1 = c0 + L.lw; solid(c0 - 0.1, MARK_Y); dashed(c0 + 0.1, MARK_Y); dashed(c1 - 0.1, MARK_Y); solid(c1 + 0.1, MARK_Y); for (let j = 1; j < L.F; j++) dashed(c1 + j * L.lw, MARK_W); }
      else { solid(c0 - 0.1, MARK_Y); solid(c0 + 0.1, MARK_Y); for (let j = 1; j < L.F; j++) dashed(c0 + j * L.lw, MARK_W); }
    }
    for (const ln of lines) paintLine(R, Ry, ln, clearAt, mk);
  }
  // ---- mapped pedestrian crossings away from junctions ----
  for (const c of P.crossings || []) {
    const adj = (World.nodeAdj.get(c.id) || []).filter(a => a.road.mesh && a.road.car && !a.road.bridge); if (!adj.length) continue;
    const { road, idx } = adj[0]; if ([...J.values()].some(j => Math.hypot(j.x - c.x, j.z - c.z) < j.e + 3)) continue;
    const a = road.pts[Math.max(0, idx - 1)], b = road.pts[Math.min(road.pts.length - 1, idx + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const nx = -dz, nz = dx; const hw = road.w / 2;
    const yAt = (x, z) => H(x, z) + 0.15 + road.rank * 0.012 + 0.012;
    for (let o = -hw + 0.35; o < hw - 0.3; o += 1.0) { const P4 = (d, oo) => [c.x + dx * d + nx * oo, c.z + dz * d + nz * oo]; const A = P4(-1.5, o), B = P4(1.5, o), C = P4(1.5, o + 0.5), D = P4(-1.5, o + 0.5); mk.quad([A[0], yAt(A[0], A[1]), A[1]], [B[0], yAt(B[0], B[1]), B[1]], [C[0], yAt(C[0], C[1]), C[1]], [D[0], yAt(D[0], D[1]), D[1]], [0, 0], [0, 0], [0, 0], [0, 0], UPN, MARK_W); }
  }
  // ---- intersections: surface, crosswalks, stop bars, curb returns + sidewalk corners ----
  for (const j of J.values()) {
    const A = j.arms, n = A.length; const e = j.e;
    const sideV = a => [-a.dz, a.dx]; // toward the next arm (counter-clockwise in angle order)
    const mouth = a => { const d = Math.min(e, a.segLen); const s = sideV(a); const c = [j.x + a.dx * d, j.z + a.dz * d]; return { prev: [c[0] - s[0] * a.w / 2, c[1] - s[1] * a.w / 2], next: [c[0] + s[0] * a.w / 2, c[1] + s[1] * a.w / 2], d }; };
    const M = A.map(mouth);
    const hasWalk = (a, towardNext) => { const sw = a.road.sidewalk; if (!sw) return false; if (sw === 'both') return true; const right = (a.k > 0) === towardNext; return sw === (right ? 'right' : 'left'); };
    // the curb line between each pair of neighbouring arms: a rounded return, a straight run, or a sharp outer corner
    const ring = []; const curbs = [];
    for (let i = 0; i < n; i++) {
      const a = A[i], b = A[(i + 1) % n]; const ma = M[i], mb = M[(i + 1) % n];
      ring.push(ma.prev, ma.next);
      let gap = b.ang - a.ang; if (i === n - 1) gap += Math.PI * 2; if (n === 1) gap = Math.PI * 2;
      const P0 = ma.next, P2 = mb.prev; let pts;
      // where the two curb lines meet
      const den = a.dx * b.dz - a.dz * b.dx; let C = null;
      if (Math.abs(den) > 0.08) { const t = ((P2[0] - P0[0]) * b.dz - (P2[1] - P0[1]) * b.dx) / den; C = [P0[0] + a.dx * t, P0[1] + a.dz * t]; if (Math.hypot(C[0] - j.x, C[1] - j.z) > e * 2.2) C = null; }
      const deg = gap * 180 / Math.PI;
      if (C && deg < 165) { pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; pts.push([u * u * P0[0] + 2 * u * t * C[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * C[1] + t * t * P2[1]]); } }
      else if (C && deg > 195) pts = [P0, C, P2];
      else pts = [P0, P2];
      for (let k = 1; k < pts.length - 1; k++) ring.push(pts[k]);
      const short = a.segLen < e + 1 || b.segLen < e + 1;
      if (!short && (hasWalk(a, true) || hasWalk(b, false))) curbs.push(pts);
    }
    // surface: fan from the centre across the mouths and curb returns
    // (subdivided so it follows the ground as closely as the road ribbons underneath it do)
    const yv = p => H(p[0], p[1]) + 0.15 + j.rmax * 0.012 + 0.045;
    if (ring.length >= 3) addDeck(T, ring.slice(), null, 0.15 + j.rmax * 0.012 + 0.045); // people stand on the plate, not under it
    const RS = 4; const L = (p, t) => [j.x + (p[0] - j.x) * t, j.z + (p[1] - j.z) * t];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length]; if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) continue;
      for (let r = 0; r < RS; r++) {
        const t0 = r / RS, t1 = (r + 1) / RS; const a0 = L(p, t0), b0 = L(q, t0), a1 = L(p, t1), b1 = L(q, t1);
        const V = c => [c[0], yv(c), c[1]], U = c => [c[0] / 12, c[1] / 12];
        if (r === 0) disc.tri(V(a0), V(a1), V(b1), U(a0), U(a1), U(b1), UPN);
        else disc.quad(V(a0), V(a1), V(b1), V(b0), U(a0), U(a1), U(b1), U(b0), UPN);
      }
    }
    // crosswalks and stop bars
    for (const a of A) {
      if (a.segLen < e + 6) continue; // too short a stub to mark
      const nx = -a.dz, nz = a.dx; const hw = a.w / 2;
      const at = (d, o) => [j.x + a.dx * d + nx * o, j.z + a.dz * d + nz * o];
      const yAt = p => H(p[0], p[1]) + 0.15 + a.road.rank * 0.012 + 0.012;
      const quad = (d0, d1, o0, o1, col) => { const P = at(d0, o0), B = at(d1, o0), C = at(d1, o1), D = at(d0, o1); mk.quad([P[0], yAt(P), P[1]], [B[0], yAt(B), B[1]], [C[0], yAt(C), C[1]], [D[0], yAt(D), D[1]], [0, 0], [0, 0], [0, 0], [0, 0], UPN, col); };
      const cw0 = e + 0.4, cw1 = cw0 + 3.0;
      const walkHere = j.signal || A.some(x => x.road.sidewalk);
      if (walkHere && (j.signal || (a.road.rank >= 5 && j.rmax >= 5)) && a.road.rank >= 3) for (let o = -hw + 0.35; o < hw - 0.3; o += 1.0) quad(cw0, cw1, o, o + 0.5, MARK_W); // zebra crosswalk
      if ((j.signal || a.stop) && a.incoming && a.road.rank >= 3) {
        const d = (j.signal ? cw1 : e) + 0.9; const o0 = a.road.oneway ? -hw + 0.3 : 0.15, o1 = hw - 0.3;
        // traffic heading into the junction keeps right: that is the -n side of this arm
        quad(d, d + 0.45, a.road.oneway ? -o1 : -o1, a.road.oneway ? o1 : -o0, MARK_W);
      }
    }
    // sidewalk corners following the curb returns
    const SW = 2.25, sy = p => H(p[0], p[1]) + 0.3;
    for (const pts of curbs) {
      const m = pts.length; const N = [];
      for (let k = 0; k < m - 1; k++) { const p = pts[k], q = pts[k + 1]; let ex = q[0] - p[0], ez = q[1] - p[1]; const l = Math.hypot(ex, ez) || 1; let nx = ez / l, nz = -ex / l; const mx = (p[0] + q[0]) / 2 - j.x, mz = (p[1] + q[1]) / 2 - j.z; if (mx * nx + mz * nz < 0) { nx = -nx; nz = -nz; } N.push([nx, nz]); }
      const O = pts.map((p, k) => { const a = N[Math.max(0, k - 1)], b = N[Math.min(N.length - 1, k)]; let x = a[0] + b[0], z = a[1] + b[1]; const l = Math.hypot(x, z) || 1; x /= l; z /= l; const c = Math.max(0.5, x * b[0] + z * b[1]); return [p[0] + x * SW / c, p[1] + z * SW / c]; });
      let v = 0;
      for (let k = 0; k < m - 1; k++) {
        const a0 = pts[k], a1 = pts[k + 1], b0 = O[k], b1 = O[k + 1]; const l = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]); if (l < 0.02) continue;
        const mx = (a0[0] + a1[0] + b0[0] + b1[0]) / 4, mz = (a0[1] + a1[1] + b0[1] + b1[1]) / 4;
        if (insideBuilding(mx, mz)) { v += l; continue; }
        const nx = N[k][0], nz = N[k][1];
        sw.quad([a0[0], sy(a0), a0[1]], [a1[0], sy(a1), a1[1]], [b1[0], sy(b1), b1[1]], [b0[0], sy(b0), b0[1]], [0, v / 6], [0, (v + l) / 6], [1, (v + l) / 6], [1, v / 6], UPN);
        sw.quad([a0[0], sy(a0), a0[1]], [a1[0], sy(a1), a1[1]], [a1[0], H(a1[0], a1[1]) - 0.1, a1[1]], [a0[0], H(a0[0], a0[1]) - 0.1, a0[1]], [0, 0], [0, 0], [0.05, 0], [0.05, 0], [-nx, 0.2, -nz]); // curb face
        sw.quad([b0[0], sy(b0), b0[1]], [b1[0], sy(b1), b1[1]], [b1[0], H(b1[0], b1[1]) - 0.1, b1[1]], [b0[0], H(b0[0], b0[1]) - 0.1, b0[1]], [0, 0], [0, 0], [0.05, 0], [0.05, 0], [nx, 0.2, nz]); // back edge
        const poly = [a0, a1, b1, b0]; const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
        T.hashItems.push([World.walkHash, World.walkHash.insert({ poly }, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))]);
        v += l;
      }
    }
  }
}

// a piece of a resampled path between two distances along it (endpoints interpolated exactly)
function clipPath(R, s0, s1) {
  const out = []; const lerpAt = (i, s) => { const a = R[i], b = R[i + 1]; const t = clamp((s - a[2]) / ((b[2] - a[2]) || 1), 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, s]; };
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1]; if (b[2] < s0 || a[2] > s1) continue;
    if (!out.length) out.push(a[2] >= s0 ? a : lerpAt(i, s0));
    if (b[2] <= s1) { if (b[2] > out[out.length - 1][2] + 0.05) out.push(b); } else { out.push(lerpAt(i, s1)); break; }
  }
  return out;
}

// one painted line along a road: offset o (right of the drawing direction), colour, width, optional dash
function paintLine(R, Ry, ln, clearAt, mk) {
  const total = R[R.length - 1][2]; const step = 2.0;
  const at = s => { let lo = 0, hi = R.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m][2] <= s) lo = m; else hi = m - 1; } const i = lo; const a = R[i], b = R[i + 1]; const t = clamp((s - a[2]) / ((b[2] - a[2]) || 1), 0, 1); const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [x, z, dx / l, dz / l, Ry[i] + (Ry[i + 1] - Ry[i]) * t]; };
  const emit = (s0, s1) => {
    for (let s = s0; s < s1 - 0.01; s += step) {
      const e = Math.min(s1, s + step); if (!clearAt(s) || !clearAt(e)) continue;
      const A = at(s), B = at(e); const ha = ln.lw / 2;
      const a0 = [A[0] + -A[3] * (ln.o - ha), A[4] + 0.012, A[1] + A[2] * (ln.o - ha)], a1 = [A[0] + -A[3] * (ln.o + ha), A[4] + 0.012, A[1] + A[2] * (ln.o + ha)];
      const b0 = [B[0] + -B[3] * (ln.o - ha), B[4] + 0.012, B[1] + B[2] * (ln.o - ha)], b1 = [B[0] + -B[3] * (ln.o + ha), B[4] + 0.012, B[1] + B[2] * (ln.o + ha)];
      mk.quad(a0, a1, b1, b0, [0, 0], [0, 0], [0, 0], [0, 0], UPN, ln.col);
    }
  };
  if (!ln.dash) emit(0, total);
  else for (let s = 1.5; s < total; s += ln.dash[0] + ln.dash[1]) emit(s, Math.min(total, s + ln.dash[0]));
}

// ---- walkable ground height: terrain, road deck, sidewalk top ----
function groundY(x, z, yRef) {
  let y = surfaceY(x, z, yRef);
  // porches, plinths and steps you can walk up onto
  for (const it of World.deckHash.query(x, z, x, z)) { const top = it.off != null ? H(x, z) + it.off : it.top; if ((yRef === undefined || top <= yRef + 1.2) && pointInPoly(x, z, it.poly)) y = Math.max(y, top); }
  const n = nearestRoad(x, z, 18, r => r.mesh && !r.bridge);
  if (!n) return y;
  const r = n.road, hw = r.w / 2;
  // the road and sidewalk meshes take their height from their own centre line, so measure there too
  if (n.d < hw + 0.2) return Math.max(y, H(n.x, n.z) + 0.15 + r.rank * 0.012);
  if (r.sidewalk && n.d < hw + 2.3) {
    // which side of the road, and is there a sidewalk there (and not in the gap at a junction)?
    const a = r.pts[n.i], b = r.pts[n.i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const side = ((x - n.x) * -dz + (z - n.z) * dx) > 0 ? 1 : -1;
    const ok = r.sidewalk === 'both' || (r.sidewalk === 'right' && side > 0) || (r.sidewalk === 'left' && side < 0);
    if (ok) { const l = Math.hypot(dx, dz) || 1, o = hw + 1.125; const sx = n.x + (-dz / l) * o * side, sz = n.z + (dx / l) * o * side; return Math.max(y, H(sx, sz) + 0.3); }
  }
  // sidewalk corners at intersections
  if (World.walkHash) for (const it of World.walkHash.query(x, z, x, z)) if (pointInPoly(x, z, it.poly)) return Math.max(y, H(x, z) + 0.3);
  return y;
}
// register a raised walkable surface (poly in x/z, top height); removed with the map square
// top: a fixed height, or off: a height above the ground that follows the terrain (sidewalks, lots)
function addDeck(T, poly, top, off) { const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]); T.hashItems.push([World.deckHash, World.deckHash.insert({ poly, top, off }, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))]); }
function boxPoly(cx, cz, ux, uz, hl, hw) { const vx = -uz, vz = ux; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + ux * hl * s + vx * hw * t, cz + uz * hl * s + vz * hw * t]); }

// ---- parking lots: painted stall lines laid out on the same rows buildParked fills with cars ----
function buildParkingLines(T, P, mk) {
  const W = T.W; let n = 0; const col = new THREE.Color('#dcdcd2');
  const put = (x0, z0, x1, z1, w) => {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1; const nx = -dz / l * w / 2, nz = dx / l * w / 2;
    const y0 = H(x0, z0) + 0.085, y1 = H(x1, z1) + 0.085; // just above the lot asphalt (buildLots)
    mk.quad([x0 + nx, y0, z0 + nz], [x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 + nx, y1, z1 + nz], [0, 0], [0, 0], [0, 0], [0, 0], UPN, col);
  };
  const ok = (x, z, ring) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1 && pointInPoly(x, z, ring) && !insideBuilding(x, z) && !onRoadSurface(x, z);
  for (const a of P.areas) {
    if (a.kind !== 'parking' || !a.rings.length) continue; const ring = a.rings[0]; if (ring.length < 3) continue;
    if (a.tags && (a.tags.parking === 'multi-storey' || a.tags.parking === 'underground' || /gravel|grass|dirt|unpaved/.test(a.tags.surface || ''))) continue;
    const ob = minAreaRect(ring); if (!ob || ob.L * ob.W > 60000 || ob.W < 8) continue;
    const P2 = (u, v) => [ob.cx + u * ob.ux + v * ob.vx, ob.cz + u * ob.uz + v * ob.vz];
    for (let v = -ob.W / 2 + 2.8; v < ob.W / 2 - 2.5; v += 18) {
      const rows = v + 5.6 < ob.W / 2 - 2.5 ? 2 : 1; const v0 = v - 2.7, v1 = v + (rows === 2 ? 5.6 : 0) + 2.7;
      for (let u = -ob.L / 2 + 2 - 1.4; u < ob.L / 2 - 1.5 + 1.4; u += 2.8) {
        // one stall line per row, only where both ends are on the lot
        for (let k = 0; k < rows; k++) {
          const a0 = P2(u, k ? v + 2.8 : v0), a1 = P2(u, k ? v1 : v + 2.8);
          if (ok(a0[0], a0[1], ring) && ok(a1[0], a1[1], ring)) { put(a0[0], a0[1], a1[0], a1[1], 0.12); n++; }
        }
        if (rows === 2) { const c0 = P2(u, v + 2.8), c1 = P2(u + 2.8, v + 2.8); if (ok(c0[0], c0[1], ring) && ok(c1[0], c1[1], ring)) put(c0[0], c0[1], c1[0], c1[1], 0.12); }
        if (n > 6000) return;
      }
    }
  }
}

// =====================================================================
// PARKING LOTS & BUSINESS SIDEWALKS
//   • every mapped surface lot becomes real asphalt (following the ground) with a concrete curb
//     round the edge — the stall lines from buildParkingLines sit on top
//   • shops, restaurants, offices and other businesses get a concrete sidewalk apron with a curb
//     along their walls (not where a wall meets a road or another building)
// =====================================================================
function subdivTri(a, b, c, maxL, out) {
  const l = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
  if (l <= maxL || out.length > 40000) { out.push([a, b, c]); return; }
  const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2], ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
  subdivTri(a, ab, ca, maxL, out); subdivTri(ab, b, bc, maxL, out); subdivTri(ca, bc, c, maxL, out); subdivTri(ab, bc, ca, maxL, out);
}
function buildLots(T, P) {
  const W = T.W, asph = new MB(), curb = new MB(); const LOT = 0.06;
  for (const a of P.areas) {
    if (a.kind !== 'parking' || !a.rings.length) continue; const ring = a.rings[0]; if (ring.length < 3) continue;
    const t = a.tags || {}; if (t.parking === 'multi-storey' || t.parking === 'underground' || t.amenity === 'fuel' || /gravel|grass|dirt|unpaved|ground/.test(t.surface || '')) continue;
    const [cx, cz] = centroid(ring); if (cx < W.x0 || cx >= W.x1 || cz < W.z0 || cz >= W.z1) continue; // each lot once, by the square it's centred in
    const area = Math.abs(signedArea(ring)); if (area < 40 || area > 120000) continue;
    const contour = ring.map(p => new THREE.Vector2(p[0], p[1])), holes = (a.holes || []).map(h => h.map(p => new THREE.Vector2(p[0], p[1])));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(contour, holes); } catch (e) { continue; }
    const all = contour.concat(...holes).map(v => [v.x, v.y]); const pieces = [];
    for (const tr of tris) subdivTri(all[tr[0]], all[tr[1]], all[tr[2]], 7, pieces);
    const Y = p => [p[0], H(p[0], p[1]) + LOT, p[1]], U = p => [p[0] / 12, p[1] / 12];
    for (const [p, q, r] of pieces) asph.tri(Y(p), Y(q), Y(r), U(p), U(q), U(r), UPN);
    addDeck(T, ring.slice(), null, LOT);
    // curb round the edge, except where a road or driveway comes in
    const sa = signedArea(ring);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.8) continue;
      let nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; }
      const k = Math.max(1, Math.round(L / 3));
      for (let j = 0; j < k; j++) {
        const a0 = [p[0] + (q[0] - p[0]) * j / k, p[1] + (q[1] - p[1]) * j / k], a1 = [p[0] + (q[0] - p[0]) * (j + 1) / k, p[1] + (q[1] - p[1]) * (j + 1) / k];
        const m = [(a0[0] + a1[0]) / 2 + nx * 1.2, (a0[1] + a1[1]) / 2 + nz * 1.2]; if (onRoadSurface(m[0], m[1]) || nearestRoad(m[0], m[1], 3, r => r.paintOnly || (r.hw === 'service'))) continue;
        const o = [nx * 0.28, nz * 0.28], t0 = H(a0[0], a0[1]) + 0.18, t1 = H(a1[0], a1[1]) + 0.18;
        curb.quad([a0[0], t0, a0[1]], [a1[0], t1, a1[1]], [a1[0] + o[0], t1, a1[1] + o[1]], [a0[0] + o[0], t0, a0[1] + o[1]], [0, 0], [0.3, 0], [0.3, 0.1], [0, 0.1], UPN);
        curb.quad([a0[0], t0 - 0.24, a0[1]], [a1[0], t1 - 0.24, a1[1]], [a1[0], t1, a1[1]], [a0[0], t0, a0[1]], [0, 0], [0.3, 0], [0.3, 0.1], [0, 0.1], [-nx, 0, -nz]);
        curb.quad([a0[0] + o[0], t0 - 0.24, a0[1] + o[1]], [a1[0] + o[0], t1 - 0.24, a1[1] + o[1]], [a1[0] + o[0], t1, a1[1] + o[1]], [a0[0] + o[0], t0, a0[1] + o[1]], [0, 0], [0.3, 0], [0.3, 0.1], [0, 0.1], [nx, 0, nz]);
      }
    }
  }
  const add = (mb, mat) => { const g = mb.geo(); if (!g) return; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; T.group.add(m); };
  add(asph, MAT.road.plain || Object.values(MAT.road)[0]); add(curb, MAT.concrete);
}
const BIZ_BT = /^(retail|commercial|supermarket|kiosk|office|restaurant|fast_food|bank|hotel|hospital|civic|public|government|library|college|university|school|church|mall|shop|store|warehouse_store)$/;
function buildBusinessWalks(T, P) {
  const W = T.W, walk = new MB(); const TOP = 0.14;
  for (const B of P.buildings) {
    if (B.skip || B.part || !B.ring || B.ring.length < 3) continue;
    const t = B.tags || {}, bt = t.building || 'yes';
    const biz = B.food || B.units || B.fuel || BIZ_BT.test(bt) || t.shop || t.amenity || t.office || (bt === 'yes' && (t.name || '').length > 0 && !/house|residential|apartments/.test(bt));
    if (!biz || /^(house|detached|residential|apartments|garage|garages|shed|roof|carport|barn|farm_auxiliary|hangar|industrial|manufacture|stadium|grandstand|parking)$/.test(bt)) continue;
    const ring = B.ring; const area = Math.abs(signedArea(ring)); if (area < 60 || area > 60000) continue;
    const [cx, cz] = centroid(ring); if (cx < W.x0 || cx >= W.x1 || cz < W.z0 || cz >= W.z1) continue;
    const sa = signedArea(ring); const w = area < 400 ? 1.8 : 2.6;
    const nrm = ring.map((p, i) => { const q = ring[(i + 1) % ring.length]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; let nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } return [nx, nz, L]; });
    const Y = p => [p[0], H(p[0], p[1]) + TOP, p[1]], U = p => [p[0] / 2, p[1] / 2];
    const edgeOk = []; 
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length]; const [nx, nz, L] = nrm[i]; if (L < 1.2) { edgeOk.push(false); continue; }
      const m = [(p[0] + q[0]) / 2 + nx * w * 0.8, (p[1] + q[1]) / 2 + nz * w * 0.8];
      const blocked = onRoadSurface(m[0], m[1]) || (() => { const b = insideBuilding(m[0], m[1]); return b && b.ring !== ring; })();
      edgeOk.push(!blocked); if (blocked) continue;
      const P2 = [p[0] + nx * w, p[1] + nz * w], Q2 = [q[0] + nx * w, q[1] + nz * w];
      walk.quad(Y(p), Y(q), Y(Q2), Y(P2), U(p), U(q), U(Q2), U(P2), UPN);
      // curb face on the outside edge
      const yb = [P2[0], H(P2[0], P2[1]) - 0.08, P2[1]], yc = [Q2[0], H(Q2[0], Q2[1]) - 0.08, Q2[1]];
      walk.quad(yb, yc, Y(Q2), Y(P2), [0, 0], [L / 2, 0], [L / 2, 0.1], [0, 0.1], [nx, 0, nz]);
      addDeck(T, [p, q, Q2, P2], null, TOP);
    }
    // corners: fill the wedge between two walked edges
    for (let i = 0; i < ring.length; i++) {
      const j = (i + ring.length - 1) % ring.length; if (!edgeOk[i] || !edgeOk[j]) continue;
      const p = ring[i], [ax, az] = nrm[j], [bx, bz] = nrm[i]; if (ax * bz - az * bx > 0 === sa > 0) continue; // concave corner: the strips already overlap
      const A = [p[0] + ax * w, p[1] + az * w], Bp = [p[0] + bx * w, p[1] + bz * w];
      walk.tri(Y(p), Y(A), Y(Bp), U(p), U(A), U(Bp), UPN); addDeck(T, [p, A, Bp], null, TOP);
    }
  }
  const g = walk.geo(); if (g) { const m = new THREE.Mesh(g, MAT.sidewalk); m.receiveShadow = true; T.group.add(m); }
}
