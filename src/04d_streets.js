
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
  for (const it of World.deckHash.query(x, z, x, z)) if ((yRef === undefined || it.top <= yRef + 1.2) && pointInPoly(x, z, it.poly)) y = Math.max(y, it.top);
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
function addDeck(T, poly, top) { const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]); T.hashItems.push([World.deckHash, World.deckHash.insert({ poly, top }, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))]); }
function boxPoly(cx, cz, ux, uz, hl, hw) { const vx = -uz, vz = ux; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + ux * hl * s + vx * hw * t, cz + uz * hl * s + vz * hw * t]); }

// ---- parking lots: painted stall lines laid out on the same rows buildParked fills with cars ----
function buildParkingLines(T, P, mk) {
  const W = T.W; let n = 0; const col = new THREE.Color('#dcdcd2');
  const put = (x0, z0, x1, z1, w) => {
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1; const nx = -dz / l * w / 2, nz = dx / l * w / 2;
    const y0 = H(x0, z0) + 0.07, y1 = H(x1, z1) + 0.07;
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
