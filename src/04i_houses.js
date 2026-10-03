// =====================================================================
// HOUSES — detached homes built as real houses instead of textured boxes. The county record (year
// built, storeys, brick or siding — see styleFromParcel in 04c_neighborhoods.js) picks the style that
// matches what's actually standing in Greenville and Winterville:
//   • mill   (before 1945)  frame house on brick piers, clapboard, steep roof, full-width front porch
//   • ranch  (1945–1979)    long low brick ranch, low hipped roof, picture window, shutters, small stoop
//   • suburb (1980–1999)    brick-front or vinyl ranch / two-storey, attached garage, covered stoop
//   • new    (2000 on)      two-storey vinyl, double garage on the front, covered front porch
// Every house faces the street it sits on: front door and steps, windows with trim, sills and
// shutters, a brick crawlspace foundation, chimney, porch posts and garage doors. Windows light up at
// night. Only plain rectangular footprints are rebuilt (most houses); the rest keep the old look.
// =====================================================================
const HOUSE_COL = {
  siding: ['#f2f1ec', '#e9e6dc', '#dcd8cc', '#cfd4d3', '#c4cbbf', '#e3d7bd', '#b7c1c8', '#d3c6ae', '#a8b39f', '#c9c3b6', '#9fa7ab', '#e8e1d0', '#b9b2a2', '#8f9a8c'],
  millSiding: ['#f4f2ec', '#efe9d8', '#e9e2cf', '#dfe5e1', '#e6dcc2', '#f1ead6', '#d9e1e6', '#efe4dc'],
  newSiding: ['#e9e7e1', '#d9d6cd', '#c9c6bd', '#b5b2aa', '#a6a9a6', '#f0eee8', '#cdd0cc', '#7d8487', '#e4ddd0', '#8e938c'],
  brick: ['#ffffff', '#f2e6df', '#e7d5cc', '#f7ece2', '#d8c9c2', '#efd9c8', '#c9b8ae', '#ffe9dc'],
  shutter: ['#1f2428', '#20283a', '#22362a', '#3b2622', '#2f3d4f', '#444a4f', '#5b2c26', '#ffffff'],
  door: ['#7a1b1b', '#1f2f4a', '#24361f', '#2a2a2a', '#5a3a22', '#ffffff', '#8a6a3a', '#3d4b5c', '#6d1d2d'],
  trim: '#f6f5f0', foundation: '#ffffff', porchFloor: '#a9a49a', concrete: '#bdb8ae', garage: '#f3f2ee',
};
function houseEra(year, rng, area, levels) {
  if (year > 1800) return year < 1945 ? 'mill' : year < 1980 ? 'ranch' : year < 2000 ? 'suburb' : 'new';
  // no record: guess from size/storeys (Greenville's housing is mostly 1960–2010)
  const r = rng(); if (levels >= 2) return r < 0.6 ? 'new' : 'suburb';
  if (area < 95) return r < 0.5 ? 'mill' : 'ranch';
  return r < 0.42 ? 'ranch' : r < 0.78 ? 'suburb' : r < 0.9 ? 'new' : 'mill';
}
// can this building be rebuilt as a house?
const HOUSE_STATS = (window.GV_HOUSES = {}); // why buildings were (not) rebuilt as houses — for debugging
function houseCandidate(B, k) {
  const no = why => { HOUSE_STATS[why] = (HOUSE_STATS[why] || 0) + 1; return false; };
  if (B.units || B.fuel || B.part || B.holes.length) return no('special');
  const t = B.tags; if (t['building:part'] || parseLen(t.min_height) > 0) return no('part');
  if (!(k.fac === 'siding' || k.fac === 'brick')) return no('fac:' + k.fac);
  if (!(HOUSEY.has(k.bt) || (k.bt === 'yes' && k.area < 280 && (k.lu === 80 || B.parcel || (k.lu === 40 && k.area < 260))))) return no('type:' + k.bt + (k.bt === 'yes' ? ':lu' + k.lu : ''));
  if (/^(terrace|farm)$/.test(k.bt)) return no('terrace');
  if (!k.obb || k.rect < 0.8) return no('shape'); if (k.area < 48 || k.area > 520 || k.obb.W < 5.2) return no('size');
  const lv = parseFloat(t['building:levels']); if (lv > 2.5) return no('tall');
  HOUSE_STATS.candidate = (HOUSE_STATS.candidate || 0) + 1; return true;
}
// builds the house into the map square's buckets; returns the roof top height, or 0 to fall back
function buildHouse(B, k) {
  const { obb, rng, gavg, buckets, roofS, roofF, detail, glass, glassLit } = k; const t = B.tags; const lite = Q === QUALITY.low; // Low graphics: skip the finest trim
  const mat = (t['building:material'] || '').toLowerCase();
  const lvTag = parseFloat(t['building:levels']) || 0; const year = (B.parcel && B.parcel.year) || parseInt(t.start_date) || 0;
  const era = houseEra(year, rng, k.area, lvTag);
  // ---- which side faces the street ----
  const rd = nearestRoad(obb.cx, obb.cz, 90, r => r.car);
  let fx, fz;
  if (rd) { fx = rd.x - obb.cx; fz = rd.z - obb.cz; } else { fx = obb.vx; fz = obb.vz; }
  const du = fx * obb.ux + fz * obb.uz, dv = fx * obb.vx + fz * obb.vz;
  let Wf, D; // facade width (along e) and depth (along f)
  if (Math.abs(dv) >= Math.abs(du)) { const s = Math.sign(dv) || 1; fx = obb.vx * s; fz = obb.vz * s; Wf = obb.L; D = obb.W; }
  else { const s = Math.sign(du) || 1; fx = obb.ux * s; fz = obb.uz * s; Wf = obb.W; D = obb.L; }
  const ex = -fz, ez = fx; // along the facade (left → right seen from the street is −e → +e)
  const cx = obb.cx, cz = obb.cz;
  const PW = (x, y, z) => [cx + ex * x + fx * z, y, cz + ez * x + fz * z];
  const NW = (nx, ny, nz) => [ex * nx + fx * nz, ny, ez * nx + fz * nz];
  // ---- storeys, heights ----
  let levels = lvTag >= 2 ? 2 : lvTag >= 1 ? 1 : (era === 'new' ? (rng() < 0.75 ? 2 : 1) : era === 'suburb' ? (rng() < 0.35 ? 2 : 1) : 1);
  if (Wf * D > 300 && levels === 1 && era === 'new') levels = 2;
  const foundH = era === 'mill' ? 0.75 : era === 'ranch' ? 0.45 : 0.5;
  let gmin = 1e9, gmax = -1e9; for (const [x, z] of [[-Wf / 2, -D / 2], [Wf / 2, -D / 2], [Wf / 2, D / 2], [-Wf / 2, D / 2], [0, 0]]) { const p = PW(x, 0, z); const y = H(p[0], p[2]); gmin = Math.min(gmin, y); gmax = Math.max(gmax, y); }
  if (gmax - gmin > 2.5) { HOUSE_STATS.steep = (HOUSE_STATS.steep || 0) + 1; return 0; } // steep lot: leave it to the plain builder
  const floor = gmax + foundH; const storyH = era === 'mill' ? 3.2 : 2.85;
  const wallTop = floor + storyH * levels;
  // ---- materials & colours ----
  const brick = /brick/.test(mat) ? true : /vinyl|wood|siding/.test(mat) ? false : (era === 'ranch' ? rng() < 0.75 : era === 'mill' ? rng() < 0.15 : rng() < 0.35);
  const sidePal = era === 'mill' ? HOUSE_COL.millSiding : era === 'new' ? HOUSE_COL.newSiding : HOUSE_COL.siding;
  const wallKey = brick ? 'brickPlain' : 'sidingPlain'; const wallMB = buckets[wallKey]; if (!wallMB) return 0;
  let wallCol = new THREE.Color(pick(brick ? HOUSE_COL.brick : sidePal, rng()));
  if (t['building:colour']) try { wallCol = new THREE.Color(t['building:colour']); } catch (e) { }
  const sideKey = 'sidingPlain', sideCol = new THREE.Color(pick(HOUSE_COL.siding, rng())); // gables over brick
  const wainscot = !brick && era === 'suburb' && rng() < 0.4; // brick-front skirt on 80s/90s houses
  const trim = new THREE.Color(HOUSE_COL.trim);
  const shutterCol = new THREE.Color(pick(HOUSE_COL.shutter, rng())); const shutters = era !== 'mill' && rng() < (era === 'ranch' ? 0.75 : 0.6);
  const doorCol = new THREE.Color(pick(HOUSE_COL.door, rng()));
  let roofCol = new THREE.Color(pick(PAL.shingle, rng())); if (t['roof:colour']) try { roofCol = new THREE.Color(t['roof:colour']); } catch (e) { }
  const fCol = new THREE.Color(HOUSE_COL.foundation).multiplyScalar(0.82);
  // ---- helpers (local x along facade, z toward the street) ----
  const quad = (mb, a, b, c, d, n, col, uv) => { uv = uv || [[0, 0], [1, 0], [1, 1], [0, 1]]; mb.quad(PW(...a), PW(...b), PW(...c), PW(...d), uv[0], uv[1], uv[2], uv[3], NW(...n), col); };
  const tri = (mb, a, b, c, n, col, uv) => { uv = uv || [[0, 0], [1, 0], [0.5, 1]]; mb.tri(PW(...a), PW(...b), PW(...c), uv[0], uv[1], uv[2], NW(...n), col); };
  const T = 4; // plain wall textures: 4 m square
  // axis-aligned box in local coords; faces: which to emit (skip ones hidden against walls)
  function box(mb, x0, x1, y0, y1, z0, z1, col, skip = '', tex = false) {
    const u = (a, b) => tex ? [a / T, b / T] : [0, 0];
    if (!skip.includes('f')) quad(mb, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, [u(x0, y0), u(x1, y0), u(x1, y1), u(x0, y1)]);
    if (!skip.includes('b')) quad(mb, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, [u(-x1, y0), u(-x0, y0), u(-x0, y1), u(-x1, y1)]);
    if (!skip.includes('r')) quad(mb, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, [u(-z1, y0), u(-z0, y0), u(-z0, y1), u(-z1, y1)]);
    if (!skip.includes('l')) quad(mb, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, [u(z0, y0), u(z1, y0), u(z1, y1), u(z0, y1)]);
    if (!skip.includes('t')) quad(mb, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col, [u(x0, z1), u(x1, z1), u(x1, z0), u(x0, z0)]);
    if (skip.includes('B')) quad(mb, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col);
  }
  // a wall face: origin o (local x,z at its left end seen from outside), tangent t, outward normal n
  const W2 = Wf / 2, D2 = D / 2;
  const faces = {
    front: { o: [-W2, D2], t: [1, 0], n: [0, 1], len: Wf },
    back: { o: [W2, -D2], t: [-1, 0], n: [0, -1], len: Wf },
    right: { o: [W2, D2], t: [0, -1], n: [1, 0], len: D },
    left: { o: [-W2, -D2], t: [0, 1], n: [-1, 0], len: D },
  };
  const FP = (F, s, y, out) => [F.o[0] + F.t[0] * s + F.n[0] * out, y, F.o[1] + F.t[1] * s + F.n[1] * out];
  function fbox(mb, F, s0, s1, y0, y1, o0, o1, col) { // box on a wall face (s along, o outward)
    const c = [FP(F, s0, 0, o0), FP(F, s1, 0, o0), FP(F, s1, 0, o1), FP(F, s0, 0, o1)];
    const xs = c.map(p => p[0]), zs = c.map(p => p[2]);
    box(mb, Math.min(...xs), Math.max(...xs), y0, y1, Math.min(...zs), Math.max(...zs), col, F.n[1] > 0 ? 'b' : F.n[1] < 0 ? 'f' : F.n[0] > 0 ? 'l' : 'r');
  }
  function fquad(mb, F, s0, s1, y0, y1, o, col) { const a = FP(F, s0, y0, o), b = FP(F, s1, y0, o), c = FP(F, s1, y1, o), d = FP(F, s0, y1, o); quad(mb, a, b, c, d, [F.n[0], 0, F.n[1]], col); }
  // ---- foundation (brick skirt from the ground up to the floor) ----
  const fb = gmin - 0.6;
  for (const F of Object.values(faces)) { const a = FP(F, 0, 0, 0.04), b = FP(F, F.len, 0, 0.04); quad(buckets.brickPlain, [a[0], fb, a[2]], [b[0], fb, b[2]], [b[0], floor, b[2]], [a[0], floor, a[2]], [F.n[0], 0, F.n[1]], fCol, [[0, fb / T], [F.len / T, fb / T], [F.len / T, floor / T], [0, floor / T]]); }
  if (era === 'mill' && !lite) for (const F of Object.values(faces)) for (let s = 1.2; s < F.len - 0.6; s += 2.4) fquad(detail, F, s - 0.02, s + 0.02, fb, floor - 0.05, 0.05, new THREE.Color('#5d5952')); // pier shadows/lattice hint
  // ---- walls ----
  const wTop = wallTop;
  for (const F of Object.values(faces)) {
    let y0 = floor; const a = FP(F, 0, 0, 0), b = FP(F, F.len, 0, 0); const n = [F.n[0], 0, F.n[1]];
    if (wainscot && F === faces.front) { quad(buckets.brickPlain, [a[0], floor, a[2]], [b[0], floor, b[2]], [b[0], floor + 1.0, b[2]], [a[0], floor + 1.0, a[2]], n, new THREE.Color('#f1e3d8'), [[0, floor / T], [F.len / T, floor / T], [F.len / T, (floor + 1) / T], [0, (floor + 1) / T]]); fbox(detail, F, 0, F.len, floor + 0.98, floor + 1.05, 0, 0.05, trim); y0 = floor + 1.0; }
    quad(wallMB, [a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], wTop, b[2]], [a[0], wTop, a[2]], n, wallCol, [[0, y0 / T], [F.len / T, y0 / T], [F.len / T, wTop / T], [0, wTop / T]]);
    // corner boards on siding houses, frieze board under the eaves
    if (!brick) { fquad(detail, F, 0, 0.12, floor, wTop, 0.02, trim); fquad(detail, F, F.len - 0.12, F.len, floor, wTop, 0.02, trim); }
    fbox(detail, F, 0, F.len, wTop - 0.22, wTop, 0, 0.03, trim);
    if (levels === 2 && era === 'new' && !brick) fbox(detail, F, 0, F.len, floor + storyH - 0.1, floor + storyH + 0.08, 0, 0.04, trim);
  }
  // ---- roof ----
  const hip = era === 'ranch' ? rng() < 0.7 : era === 'mill' ? rng() < 0.25 : era === 'suburb' ? rng() < 0.3 : rng() < 0.15;
  let shape = (t['roof:shape'] || '').toLowerCase(); if (shape !== 'gabled' && shape !== 'hipped') shape = hip ? 'hipped' : 'gabled';
  const pitchDeg = era === 'ranch' ? 18 + rng() * 6 : era === 'mill' ? 34 + rng() * 10 : era === 'new' ? 30 + rng() * 8 : 24 + rng() * 8;
  const pitch = pitchDeg * Math.PI / 180;
  // ridge runs along the longer side (mill houses: front-gable when narrow and deep)
  const ridgeX = era === 'mill' && D > Wf * 1.15 ? false : Wf >= D;
  const o = era === 'mill' ? 0.45 : 0.4;
  const half = ridgeX ? D2 : W2, lenH = ridgeX ? W2 : D2; const rise = Math.min(6, half * Math.tan(pitch)); const ridgeY = wTop + rise; const eave = wTop - o * Math.tan(pitch);
  // map (along-ridge a, across c, y) → local (x, z)
  const R = (a, c, y) => ridgeX ? [a, y, c] : [c, y, -a];
  const rn = (na, nc, ny) => ridgeX ? [na, ny, nc] : [nc, ny, -na];
  const slopeLen = Math.hypot(half + o, rise + o * Math.tan(pitch));
  {
    const A = R(-lenH - o, -half - o, eave), Bq = R(lenH + o, -half - o, eave), C = R(lenH + o, half + o, eave), Dd = R(-lenH - o, half + o, eave);
    const ul = (2 * lenH + 2 * o) / 4, vl = slopeLen / 4;
    if (shape === 'gabled') {
      const R1 = R(-lenH - o, 0, ridgeY), R2 = R(lenH + o, 0, ridgeY);
      quad(roofS, A, Bq, R2, R1, rn(0, -1, 1.2), roofCol, [[0, 0], [ul, 0], [ul, vl], [0, vl]]);
      quad(roofS, C, Dd, R1, R2, rn(0, 1, 1.2), roofCol, [[ul, 0], [0, 0], [0, vl], [ul, vl]]);
      const gk = brick && rng() < 0.7 ? sideKey : wallKey, gc = gk === wallKey ? wallCol : sideCol;
      for (const s of [-1, 1]) {
        const g1 = R(s * lenH, -half, wTop), g2 = R(s * lenH, half, wTop), g3 = R(s * lenH, 0, ridgeY);
        tri(buckets[gk], g1, g2, g3, rn(s, 0, 0), gc, [[0, wTop / T], [2 * half / T, wTop / T], [half / T, ridgeY / T]]);
        // rake boards
        for (const side of [-1, 1]) { const p0 = R(s * (lenH + o) + s * 0.02, side * (half + o), eave), p1 = R(s * (lenH + o) + s * 0.02, 0, ridgeY + 0.02); const q0 = [p0[0], p0[1] - 0.2, p0[2]], q1 = [p1[0], p1[1] - 0.2, p1[2]]; quad(detail, q0, p0, p1, q1, rn(s, 0, 0), trim); }
        // gable vent
        const vc = R(s * (lenH + 0.03), 0, wTop + rise * 0.55); const va = R(s * (lenH + 0.03), -0.3, wTop + rise * 0.55 - 0.3), vb = R(s * (lenH + 0.03), 0.3, wTop + rise * 0.55 + 0.3);
        if (rise > 1.4 && !lite) box(detail, Math.min(va[0], vb[0]) - (ridgeX ? 0.02 : 0), Math.max(va[0], vb[0]) + (ridgeX ? 0.02 : 0), vc[1] - 0.3, vc[1] + 0.3, Math.min(va[2], vb[2]) - (ridgeX ? 0 : 0.02), Math.max(va[2], vb[2]) + (ridgeX ? 0 : 0.02), trim);
      }
    } else {
      const rr = Math.max(0, lenH - half); const R1 = R(-rr, 0, ridgeY), R2 = R(rr, 0, ridgeY); const wl = (2 * half + 2 * o) / 4;
      quad(roofS, A, Bq, R2, R1, rn(0, -1, 1.2), roofCol, [[0, 0], [ul, 0], [ul / 2 + rr / 4, vl], [ul / 2 - rr / 4, vl]]);
      quad(roofS, C, Dd, R1, R2, rn(0, 1, 1.2), roofCol, [[ul, 0], [0, 0], [ul / 2 - rr / 4, vl], [ul / 2 + rr / 4, vl]]);
      tri(roofS, Dd, A, R1, rn(-1, 0, 1.2), roofCol, [[0, 0], [wl, 0], [wl / 2, vl]]);
      tri(roofS, Bq, C, R2, rn(1, 0, 1.2), roofCol, [[0, 0], [wl, 0], [wl / 2, vl]]);
    }
    quad(roofF, A, Bq, C, Dd, [0, -1, 0], new THREE.Color(0.86, 0.86, 0.84)); // soffit
    // fascia boards along the eaves
    for (const side of [-1, 1]) { const p0 = R(-lenH - o, side * (half + o), eave), p1 = R(lenH + o, side * (half + o), eave); quad(detail, side > 0 ? p1 : p0, side > 0 ? p0 : p1, [(side > 0 ? p0 : p1)[0], eave - 0.2, (side > 0 ? p0 : p1)[2]], [(side > 0 ? p1 : p0)[0], eave - 0.2, (side > 0 ? p1 : p0)[2]], rn(0, side, 0), trim); }
  }
  // ---- garage, door, porch layout on the front ----
  const gSide = rng() < 0.5 ? -1 : 1; // garage end (seen along e)
  let garage = 0; // number of bays
  if (era === 'new' && Wf >= 12.5) garage = Wf >= 15 ? 2 : 1;
  else if (era === 'suburb' && Wf >= 13 && rng() < 0.65) garage = Wf >= 16 && rng() < 0.6 ? 2 : 1;
  else if (era === 'ranch' && Wf >= 15 && rng() < 0.3) garage = 1;
  const gW = garage === 2 ? 5.0 : garage === 1 ? 2.8 : 0; const gMargin = 0.6;
  const gS0 = gSide > 0 ? Wf - gMargin - gW : gMargin, gS1 = gS0 + gW; // along the front face (s from left end)
  const livingS0 = garage ? (gSide > 0 ? 0 : gS1 + 0.5) : 0, livingS1 = garage ? (gSide > 0 ? gS0 - 0.5 : Wf) : Wf;
  // front door: centred on mill houses, otherwise near the garage side of the living area
  let doorS = era === 'mill' ? Wf / 2 : garage ? (gSide > 0 ? livingS1 - 1.6 : livingS0 + 1.6) : (Wf / 2 + (rng() - 0.5) * Wf * 0.25);
  doorS = clamp(doorS, 1.2, Wf - 1.2);
  const F = faces.front; const doorW = 0.95, doorH = 2.1;
  // garage doors (slab on grade: garage floor is near the ground)
  if (garage) {
    const gy0 = Math.max(gmax + 0.05, floor - 0.35); const gdH = 2.15; const gCol = new THREE.Color(HOUSE_COL.garage);
    const bays = garage === 2 && rng() < 0.4 ? [[gS0, gS1]] : garage === 2 ? [[gS0, gS0 + 2.4], [gS1 - 2.4, gS1]] : [[gS0, gS1]];
    for (const [s0, s1] of bays) {
      fbox(detail, F, s0 - 0.12, s0, gy0, gy0 + gdH + 0.12, 0, 0.04, trim); fbox(detail, F, s1, s1 + 0.12, gy0, gy0 + gdH + 0.12, 0, 0.04, trim); fbox(detail, F, s0, s1, gy0 + gdH, gy0 + gdH + 0.12, 0, 0.04, trim);
      fquad(detail, F, s0, s1, gy0, gy0 + gdH, 0.045, gCol);
      if (!lite) { const gc2 = new THREE.Color('#cfcdc6'); for (let k = 1; k < 4; k++) fquad(detail, F, s0 + 0.05, s1 - 0.05, gy0 + k * gdH / 4 - 0.025, gy0 + k * gdH / 4 + 0.015, 0.05, gc2); }
      if (era === 'new' && !lite) for (let w = 0; w < 4; w++) { const ws = s0 + 0.2 + w * (s1 - s0 - 0.4) / 4; fquad(glass, F, ws + 0.05, ws + (s1 - s0 - 0.4) / 4 - 0.05, gy0 + gdH * 0.78, gy0 + gdH * 0.94, 0.07, trim); }
    }
    // foundation below the garage door is just a slab edge
    const ga = FP(F, gS0, 0, 0.05), gb = FP(F, gS1, 0, 0.05); quad(detail, [ga[0], fb, ga[2]], [gb[0], fb, gb[2]], [gb[0], gy0, gb[2]], [ga[0], gy0, ga[2]], [0, 0, 1], new THREE.Color(HOUSE_COL.concrete));
  }
  // door: trim, slab, small transom/sidelight glass on newer houses, knob
  fbox(detail, F, doorS - doorW / 2 - 0.12, doorS - doorW / 2, floor, floor + doorH + 0.14, 0, 0.05, trim); fbox(detail, F, doorS + doorW / 2, doorS + doorW / 2 + 0.12, floor, floor + doorH + 0.14, 0, 0.05, trim);
  fbox(detail, F, doorS - doorW / 2, doorS + doorW / 2, floor + doorH + 0.12, floor + doorH + 0.14 + 0.06, 0, 0.05, trim);
  fquad(detail, F, doorS - doorW / 2, doorS + doorW / 2, floor, floor + doorH, 0.055, doorCol);
  if (!lite) { const pc = doorCol.clone().multiplyScalar(0.85); for (const [a, b, c, d] of [[0.12, 0.42, 0.18, 1.0], [0.53, 0.83, 0.18, 1.0], [0.12, 0.42, 1.15, 1.95], [0.53, 0.83, 1.15, 1.95]]) fquad(detail, F, doorS - doorW / 2 + a * doorW, doorS - doorW / 2 + b * doorW, floor + c, floor + d, 0.062, pc); }
  fbox(detail, F, doorS + doorW / 2 - 0.14, doorS + doorW / 2 - 0.09, floor + 0.98, floor + 1.03, 0.06, 0.11, new THREE.Color('#c9a74a'));
  if (era === 'new' || era === 'suburb') fquad(glass, F, doorS - doorW / 2, doorS + doorW / 2, floor + doorH + 0.02, floor + doorH + 0.12, 0.052, trim);
  // ---- windows ----
  const winW = era === 'mill' ? 0.9 : 0.95, winH = era === 'mill' ? 1.65 : era === 'ranch' ? 1.2 : 1.45, sillY = era === 'ranch' ? 1.0 : 0.85;
  const lit = rng(); // share of this house's windows lit at night
  function windowAt(F, s, y0, w, h, opt = {}) {
    if (s - w / 2 < 0.35 || s + w / 2 > F.len - 0.35) return;
    const cw = 0.1; // casing: four boards around the opening
    fquad(detail, F, s - w / 2 - cw, s - w / 2, y0 - 0.08, y0 + h + cw, 0.035, trim); fquad(detail, F, s + w / 2, s + w / 2 + cw, y0 - 0.08, y0 + h + cw, 0.035, trim);
    fquad(detail, F, s - w / 2, s + w / 2, y0 + h, y0 + h + cw, 0.035, trim);
    fbox(detail, F, s - w / 2 - 0.16, s + w / 2 + 0.16, y0 - 0.12, y0 - 0.06, 0, 0.1, trim);    // sill
    const lt = rng() < lit * 0.8; fquad(lt ? glassLit : glass, F, s - w / 2, s + w / 2, y0, y0 + h, 0.03, trim);
    // sashes and muntins (colonial grids on newer houses, 2-over-2 on old ones)
    if (!lite) fquad(detail, F, s - w / 2, s + w / 2, y0 + h / 2 - 0.03, y0 + h / 2 + 0.03, 0.045, trim);
    const cols = lite ? 0 : opt.picture ? 4 : era === 'mill' ? 1 : era === 'ranch' ? 1 : 2; const rows = lite ? 1 : era === 'mill' ? 1 : era === 'ranch' ? 1 : 2;
    for (let c = 1; c <= cols; c++) fquad(detail, F, s - w / 2 + c * w / (cols + 1) - 0.012, s - w / 2 + c * w / (cols + 1) + 0.012, y0, y0 + h, 0.042, trim);
    if (rows > 1) for (const yy of [y0 + h * 0.25, y0 + h * 0.75]) fquad(detail, F, s - w / 2, s + w / 2, yy - 0.012, yy + 0.012, 0.042, trim);
    if (shutters && !opt.noShutter && F === faces.front) for (const sd of [-1, 1]) {
      const a = s + sd * (w / 2 + 0.12), b = a + sd * Math.min(0.45, w / 2); if (Math.min(a, b) < 0.2 || Math.max(a, b) > F.len - 0.2) continue;
      fbox(detail, F, Math.min(a, b), Math.max(a, b), y0 - 0.04, y0 + h + 0.04, 0.02, 0.06, shutterCol);
    }
  }
  const spans = (s0, s1, avoid) => { const out = []; const step = era === 'mill' ? 2.4 : 2.7; const n = Math.max(0, Math.floor((s1 - s0) / step)); for (let i = 0; i < n; i++) { const s = s0 + (i + 0.5) * (s1 - s0) / n; if (avoid.every(([a, b]) => s + winW / 2 + 0.25 < a || s - winW / 2 - 0.25 > b)) out.push(s); } return out; };
  for (let lv = 0; lv < levels; lv++) {
    const y0 = floor + lv * storyH + (lv === 0 ? sillY : sillY - 0.05);
    for (const [key, Fc] of Object.entries(faces)) {
      const avoid = [];
      if (Fc === F && lv === 0) { avoid.push([doorS - doorW / 2 - 0.2, doorS + doorW / 2 + 0.2]); if (garage) avoid.push([gS0 - 0.3, gS1 + 0.3]); }
      if (key === 'front' && lv === 0 && era === 'ranch' && !garage) { // a big picture window either side of the door
        const ps = doorS < Wf / 2 ? doorS + doorW / 2 + 1.8 : doorS - doorW / 2 - 1.8; windowAt(Fc, ps, y0 - 0.1, 2.2, 1.4, { picture: true }); avoid.push([ps - 1.3, ps + 1.3]);
      }
      let list = spans(0.4, Fc.len - 0.4, avoid);
      if (key !== 'front') list = list.filter((_, i) => (i + (key === 'back' ? 1 : 0)) % 2 === 0 || Fc.len < 9); // fewer on the sides/back
      if (key === 'front' && lv === 1 && garage) list = spans(0.4, Fc.len - 0.4, [[doorS - 0.3, doorS + 0.3]]);
      for (const s of list) windowAt(Fc, s, y0, winW, lv === 1 ? winH - 0.1 : winH);
    }
  }
  // ---- porch / stoop and steps ----
  const pd = era === 'mill' ? 2.4 : era === 'new' ? 2.0 : 1.5; // depth toward the street
  let pS0, pS1, porchRoof;
  if (era === 'mill') { pS0 = 0.1; pS1 = Wf - 0.1; porchRoof = 'shed'; }
  else if (era === 'new') { pS0 = garage ? livingS0 + 0.2 : 0.4; pS1 = garage ? livingS1 - 0.2 : Wf - 0.4; porchRoof = 'shed'; if (pS1 - pS0 < 3) { pS0 = doorS - 1.5; pS1 = doorS + 1.5; } }
  else { pS0 = doorS - 1.1; pS1 = doorS + 1.1; porchRoof = era === 'suburb' || rng() < 0.5 ? 'gable' : 'none'; }
  pS0 = clamp(pS0, 0.05, Wf - 1); pS1 = clamp(pS1, pS0 + 1, Wf - 0.05);
  const pc = FP(F, (pS0 + pS1) / 2, 0, pd); const okPorch = !onRoadSurface(...PW(pc[0], 0, pc[2]).filter((_, i) => i !== 1));
  if (okPorch) {
    const pz0 = D2, pz1 = D2 + pd, px0 = -W2 + pS0, px1 = -W2 + pS1; const floorCol = new THREE.Color(era === 'mill' ? '#8f8a80' : HOUSE_COL.porchFloor);
    box(detail, px0, px1, fb, floor - 0.02, pz0, pz1, floorCol, 'b');
    if (era !== 'mill') box(buckets.brickPlain, px0, px1, fb, floor - 0.12, pz0 + 0.02, pz1 + 0.02, fCol, 'bt', true);
    // steps down to the lawn in front of the door
    const nSteps = Math.max(1, Math.round((floor - gmin) / 0.18)); const sw = 1.3;
    for (let i = 0; i < nSteps && i < 6; i++) { const y1 = floor - (i + 1) * (floor - gmin) / (nSteps + 1) + 0.02; box(detail, -W2 + doorS - sw / 2, -W2 + doorS + sw / 2, fb, y1, pz1, pz1 + (i + 1) * 0.28, new THREE.Color(HOUSE_COL.concrete), 'b'); }
    if (porchRoof !== 'none') {
      const ph = floor + (era === 'mill' ? 2.75 : 2.6); const postCol = trim; const nPosts = Math.max(2, Math.round((px1 - px0) / 2.4) + 1);
      for (let i = 0; i < nPosts; i++) { const x = px0 + 0.15 + i * (px1 - px0 - 0.3) / (nPosts - 1); const r = era === 'mill' ? 0.08 : 0.11; box(detail, x - r, x + r, floor, ph, pz1 - 0.3, pz1 - 0.3 + 2 * r, postCol); }
      box(detail, px0, px1, ph, ph + 0.22, pz1 - 0.34, pz1 - 0.06, trim); // beam
      if (era === 'mill' || era === 'new') for (let i = 0; i < nPosts - 1; i++) { const xa = px0 + 0.15 + i * (px1 - px0 - 0.3) / (nPosts - 1) + 0.1, xb = px0 + 0.15 + (i + 1) * (px1 - px0 - 0.3) / (nPosts - 1) - 0.1; if (Math.abs((xa + xb) / 2 + W2 - doorS) < 1) continue; box(detail, xa, xb, floor + 0.85, floor + 0.92, pz1 - 0.26, pz1 - 0.18, trim); for (let x = xa + 0.1; x < xb && !lite; x += 0.2) { quad(detail, [x - 0.02, floor + 0.05, pz1 - 0.2], [x + 0.02, floor + 0.05, pz1 - 0.2], [x + 0.02, floor + 0.86, pz1 - 0.2], [x - 0.02, floor + 0.86, pz1 - 0.2], [0, 0, 1], trim); quad(detail, [x + 0.02, floor + 0.05, pz1 - 0.24], [x - 0.02, floor + 0.05, pz1 - 0.24], [x - 0.02, floor + 0.86, pz1 - 0.24], [x + 0.02, floor + 0.86, pz1 - 0.24], [0, 0, -1], trim); } }
      const oy = 0.3; // roof overhang
      if (porchRoof === 'shed') {
        const yIn = Math.min(wTop - 0.1, ph + 0.9), yOut = ph + 0.2;
        quad(roofS, [px0 - oy, yOut - 0.05, pz1 + oy], [px1 + oy, yOut - 0.05, pz1 + oy], [px1 + oy, yIn, pz0], [px0 - oy, yIn, pz0], [0, 1, 0.6], roofCol, [[0, 0], [(px1 - px0) / 4, 0], [(px1 - px0) / 4, pd / 4], [0, pd / 4]]);
        quad(roofF, [px0 - oy, yOut - 0.06, pz1 + oy], [px0 - oy, yIn - 0.01, pz0], [px1 + oy, yIn - 0.01, pz0], [px1 + oy, yOut - 0.06, pz1 + oy], [0, -1, 0], new THREE.Color(0.86, 0.86, 0.84));
        for (const sx of [-1, 1]) { const x = sx < 0 ? px0 - oy : px1 + oy; tri(detail, [x, ph + 0.2, pz1 + oy], [x, yIn, pz0], [x, ph + 0.2, pz0], [sx, 0, 0], trim); }
      } else {
        const gy = ph + 0.22, gr = gy + (px1 - px0) / 2 * 0.6, xm = (px0 + px1) / 2;
        quad(roofS, [px0 - oy, gy, pz1 + oy], [xm, gr, pz1 + oy], [xm, gr, pz0], [px0 - oy, gy, pz0], [-0.5, 1, 0], roofCol);
        quad(roofS, [xm, gr, pz1 + oy], [px1 + oy, gy, pz1 + oy], [px1 + oy, gy, pz0], [xm, gr, pz0], [0.5, 1, 0], roofCol);
        tri(detail, [px0, gy, pz1 + oy - 0.05], [px1, gy, pz1 + oy - 0.05], [xm, gr - 0.05, pz1 + oy - 0.05], [0, 0, 1], trim);
        quad(roofF, [px0 - oy, gy - 0.01, pz1 + oy], [px0 - oy, gy - 0.01, pz0], [px1 + oy, gy - 0.01, pz0], [px1 + oy, gy - 0.01, pz1 + oy], [0, -1, 0], new THREE.Color(0.86, 0.86, 0.84));
      }
      // porch light by the door
      fbox(glassLit, F, doorS + doorW / 2 + 0.25, doorS + doorW / 2 + 0.4, floor + 1.7, floor + 1.95, 0.05, 0.16, trim);
    }
  }
  // ---- chimney ----
  if ((era === 'ranch' || era === 'mill' || rng() < 0.35) && rise > 0.8) {
    const cw = era === 'mill' ? 0.7 : 1.4, cd = era === 'mill' ? 0.7 : 0.9; const cTop = ridgeY + 0.9; const cc = new THREE.Color(pick(HOUSE_COL.brick, rng()));
    if (era === 'mill') { const p = R(0, 0, 0); box(buckets.brickPlain, p[0] - cw / 2, p[0] + cw / 2, ridgeY - 1.2, cTop, p[2] - cd / 2, p[2] + cd / 2, cc, 'b'.slice(1), true); }
    else { // exterior chimney on a side wall, rising past the roof edge
      const Fs = ridgeX ? (gSide > 0 ? faces.left : faces.right) : faces.back; const s = Fs.len / 2 + (rng() - 0.5) * Fs.len * 0.2;
      const a = FP(Fs, s - cw / 2, 0, 0), b = FP(Fs, s + cw / 2, 0, cd); const xs = [a[0], b[0]], zs = [a[2], b[2]];
      const topY = ridgeX || Fs === faces.back ? (Fs === faces.back ? eave + 1.6 : ridgeY + 0.9) : ridgeY + 0.9;
      box(buckets.brickPlain, Math.min(...xs), Math.max(...xs), fb, Math.max(topY, wTop + 1.2), Math.min(...zs), Math.max(...zs), cc, '', true);
    }
  }
  HOUSE_STATS.built = (HOUSE_STATS.built || 0) + 1;
  return ridgeY;
}
