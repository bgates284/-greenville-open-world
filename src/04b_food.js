
// =====================================================================
// RESTAURANT BUILDINGS — built per tile inside buildBuildings():
//   • a restaurant that has its own footprint is rebuilt in its brand's look (walls, fascia band,
//     roof, awnings, door, wall signs, road-side pylon sign, drive-in canopy / porch where fitting)
//   • a restaurant inside a larger building (strip mall, Uptown block, campus hall) gets a
//     storefront: coloured fascia panel, awning and sign on the wall nearest its mapped location
//   • a restaurant mapped only as a point with no building gets a new building facing the road
// Signs are plain lettering drawn into one texture atlas per tile; they glow at night.
// =====================================================================
MAT.foodSigns = new Set();
// lettering styles for signs (generic typefaces — no logos)
const SIGN_FONTS = {
  block: px => `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`,
  condensed: px => `800 ${px}px "Arial Narrow", "Roboto Condensed", Impact, sans-serif`,
  round: px => `800 ${px}px "Arial Rounded MT Bold", "Nunito", "Verdana", sans-serif`,
  serif: px => `700 ${px}px Georgia, "Times New Roman", serif`,
  slab: px => `800 ${px}px Rockwell, "Roboto Slab", Georgia, serif`,
  script: px => `italic 700 ${px}px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive`,
  italic: px => `italic 900 ${px}px "Arial Black", Arial, sans-serif`,
};
function foodBuilder(T, P, ctx) {
  const W = T.W; const foods = Food.inBox(W.x0, W.z0, W.x1, W.z1);
  const dress = new MB(true), glass = new MB(true), signs = new MB(false); const slots = [];
  const C = h => new THREE.Color(h);
  const out = { themed, storefronts, standalone, finish, canopy, count: 0 };
  if (!foods.length) { out.none = true; return out; }
  if (!MAT.foodDress) MAT.foodDress = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
  if (!MAT.foodGlass) MAT.foodGlass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.65, envMapIntensity: 1.2 });

  // ---- assign each place to the building that contains it ----
  const cand = P.buildings.filter(B => !B.skip && !B.part && B.ring.length >= 3);
  for (const B of cand) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of B.ring) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); } B._bb = [x0, z0, x1, z1]; }
  for (const f of foods) {
    if (f.kind === 'centre') { f._alone = true; continue; } // shopping centres: a road-side sign only
    let host = null;
    if (f.ref[0] === 'w') host = cand.find(B => 'w' + B.id === f.ref) || null;
    if (!host) { let best = 1e12; for (const B of cand) { const b = B._bb; if (f.x < b[0] || f.x > b[2] || f.z < b[1] || f.z > b[3]) continue; if (pointInPoly(f.x, f.z, B.ring)) { const a = Math.abs(signedArea(B.ring)); if (a < best) { best = a; host = B; } } } }
    if (f.kind === 'fuel') { // a mapped canopy gets branded; otherwise build one (never re-skin the store itself)
      const canopy = host && (/^(roof|canopy|carport)$/.test(host.tags.building || '') || host.tags.amenity === 'fuel');
      f._alone = !canopy; if (canopy) host.fuel = f; continue;
    }
    f._alone = !host; if (host) (host._foods || (host._foods = [])).push(f);
  }
  for (const B of cand) if (B._foods) {
    const area = Math.abs(signedArea(B.ring));
    if (B._foods.length === 1 && (area < 1300 || (B._foods[0].kind === 'shop' && area < 40000)) && !/^(university|college|school|dormitory|apartments|hospital)$/.test(B.tags.building || '')) B.food = B._foods[0];
    else B.units = B._foods;
  }

  // ---- helpers ----
  // sign faces: 'cab' = lit box with the brand background, 'let' = individual letters mounted on the wall,
  // 'price' = gas price display
  function slot(text, look, mode = 'cab') { slots.push({ text, bg: look.sign[0], fg: look.sign[1], mode, font: look.font || fontFor(look) }); return slots.length - 1; }
  function fontFor(L) { return L.fontDefault || 'block'; }
  const lumOf = h => { const c = new THREE.Color(h); return c.r * 0.3 + c.g * 0.59 + c.b * 0.11; };
  function letterLook(L, surface) { // pick the brand colour that reads best against the surface behind the letters
    const s = lumOf(surface); const opts = [L.sign[1], L.sign[0], L.trim2, '#ffffff', '#111111'];
    let fg = opts.find(o => Math.abs(lumOf(o) - s) > 0.35) || (s > 0.5 ? '#111111' : '#ffffff');
    const other = opts.find(o => o !== fg && Math.abs(lumOf(o) - lumOf(fg)) > 0.2) || '#333333';
    return Object.assign({}, L, { sign: [other, fg] });
  }
  function signQuad(i, a, b, y0, y1, n, off) { // sign face on a vertical plane, lettering reads correctly from the side n points to
    const rx = n[1], rz = -n[0]; if ((b[0] - a[0]) * rx + (b[1] - a[1]) * rz < 0) { const t = a; a = b; b = t; }
    const A = [a[0] + n[0] * off, y0, a[1] + n[1] * off], Bq = [b[0] + n[0] * off, y0, b[1] + n[1] * off];
    // uv carries slot*4+corner for now; finish() turns it into atlas coordinates
    signs.quad(A, Bq, [Bq[0], y1, Bq[2]], [A[0], y1, A[2]], [i * 4, 0], [i * 4 + 1, 0], [i * 4 + 2, 0], [i * 4 + 3, 0], [n[0], 0, n[1]], null);
  }
  function faceQ(a, b, y0, y1, n, off, col) { // vertical panel on a wall segment
    const A = [a[0] + n[0] * off, y0, a[1] + n[1] * off], Bq = [b[0] + n[0] * off, y0, b[1] + n[1] * off];
    dress.quad(A, Bq, [Bq[0], y1, Bq[2]], [A[0], y1, A[2]], [0, 0], [0, 0], [0, 0], [0, 0], [n[0], 0, n[1]], col);
  }
  function box(cx, cz, ux, uz, hl, hw, y0, y1, col) { // oriented box: half-length along (ux,uz), half-width across
    const vx = -uz, vz = ux; const P4 = (s, t) => [cx + ux * hl * s + vx * hw * t, cz + uz * hl * s + vz * hw * t];
    const c = [P4(-1, -1), P4(1, -1), P4(1, 1), P4(-1, 1)];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz; const l = Math.hypot(mx, mz) || 1; dress.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [0, 0], [0, 0], [0, 0], [0, 0], [mx / l, 0, mz / l], col); }
    dress.quad([c[0][0], y1, c[0][1]], [c[1][0], y1, c[1][1]], [c[2][0], y1, c[2][1]], [c[3][0], y1, c[3][1]], [0, 0], [0, 0], [0, 0], [0, 0], UPN, col);
    dress.quad([c[0][0], y0, c[0][1]], [c[1][0], y0, c[1][1]], [c[2][0], y0, c[2][1]], [c[3][0], y0, c[3][1]], [0, 0], [0, 0], [0, 0], [0, 0], [0, -1, 0], col);
  }
  function awning(a, b, n, yTop, depth, drop, col) { // slanted fabric awning with side cheeks
    const A = [a[0], yTop, a[1]], Bq = [b[0], yTop, b[1]];
    const A2 = [a[0] + n[0] * depth, yTop - drop, a[1] + n[1] * depth], B2 = [b[0] + n[0] * depth, yTop - drop, b[1] + n[1] * depth];
    dress.quad(A, Bq, B2, A2, [0, 0], [0, 0], [0, 0], [0, 0], [n[0] * 0.6, 0.8, n[1] * 0.6], col);
    dress.quad(A, Bq, B2, A2, [0, 0], [0, 0], [0, 0], [0, 0], [-n[0] * 0.6, -0.8, -n[1] * 0.6], col.clone().multiplyScalar(0.55));
    const val = [A2[0], A2[1] - 0.28, A2[2]], vbl = [B2[0], B2[1] - 0.28, B2[2]];
    dress.quad(A2, B2, vbl, val, [0, 0], [0, 0], [0, 0], [0, 0], [n[0], 0, n[1]], col); // valance
    const ux = b[0] - a[0], uz = b[1] - a[1], l = Math.hypot(ux, uz) || 1;
    dress.tri(A, A2, [A2[0], A2[1] - 0.28, A2[2]], [0, 0], [0, 0], [0, 0], [-ux / l, 0, -uz / l], col); dress.tri(Bq, B2, vbl, [0, 0], [0, 0], [0, 0], [ux / l, 0, uz / l], col);
  }
  function glassPane(a, b, n, y0, y1, off, frameCol, bays) { // storefront glazing with mullions and a head/sill frame
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.8 || y1 - y0 < 0.5) return;
    const A = [a[0] + n[0] * off, y0, a[1] + n[1] * off], Bq = [b[0] + n[0] * off, y0, b[1] + n[1] * off];
    const gc = new THREE.Color('#22323d'); glass.quad(A, Bq, [Bq[0], y1, Bq[2]], [A[0], y1, A[2]], [0, 0], [0, 0], [0, 0], [0, 0], [n[0], 0, n[1]], gc);
    const fc = frameCol || C('#2a2e33'); const k = bays || Math.max(1, Math.round(len / 1.6)); const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    for (let j = 0; j <= k; j++) { const s0 = j / k * len; const p = [a[0] + tx * s0, a[1] + tz * s0]; faceQ([p[0] - tx * 0.05, p[1] - tz * 0.05], [p[0] + tx * 0.05, p[1] + tz * 0.05], y0, y1, n, off + 0.02, fc); }
    faceQ(a, b, y1 - 0.08, y1 + 0.02, n, off + 0.02, fc); faceQ(a, b, y0 - 0.02, y0 + 0.08, n, off + 0.02, fc);
  }
  function ledge(a, b, n, y0, y1, out, col) { // projecting cornice / coping: front face + top + underside
    const o = [n[0] * out, n[1] * out];
    dress.quad([a[0] + o[0], y0, a[1] + o[1]], [b[0] + o[0], y0, b[1] + o[1]], [b[0] + o[0], y1, b[1] + o[1]], [a[0] + o[0], y1, a[1] + o[1]], [0, 0], [0, 0], [0, 0], [0, 0], [n[0], 0, n[1]], col);
    dress.quad([a[0], y1, a[1]], [b[0], y1, b[1]], [b[0] + o[0], y1, b[1] + o[1]], [a[0] + o[0], y1, a[1] + o[1]], [0, 0], [0, 0], [0, 0], [0, 0], UPN, col);
    dress.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0] + o[0], y0, b[1] + o[1]], [a[0] + o[0], y0, a[1] + o[1]], [0, 0], [0, 0], [0, 0], [0, 0], [0, -1, 0], col.clone().multiplyScalar(0.6));
  }
  function rooftopUnits(ring, y, area, seed) { // HVAC units on flat roofs
    const obb = minAreaRect(ring); if (!obb || area < 120) return; const r = mulberry32(seed | 0); const n = Math.min(7, Math.max(1, Math.round(area / 260)));
    for (let k = 0; k < n; k++) {
      const u = (r() - 0.5) * obb.L * 0.7, v = (r() - 0.5) * obb.W * 0.6; const x = obb.cx + obb.ux * u + obb.vx * v, z = obb.cz + obb.uz * u + obb.vz * v;
      if (!pointInPoly(x, z, ring)) continue; const big = area > 3000 && r() < 0.4;
      box(x, z, obb.ux, obb.uz, big ? 1.6 : 0.95, big ? 1.1 : 0.7, y, y + (big ? 1.3 : 0.95), C(r() < 0.5 ? '#a4a9ad' : '#b7bbbe'));
      box(x, z, obb.ux, obb.uz, 0.35, 0.35, y + (big ? 1.3 : 0.95), y + (big ? 1.4 : 1.02), C('#6f7479'));
    }
  }
  function patio(mid, ux, uz, n, len, g0, L, seed) { // outdoor tables with umbrellas beside the entrance
    const r = mulberry32(seed | 0); const col = C(L.awn), wood = C('#5a4636'), metal = C('#3a3d41'); let placed = 0;
    for (const side of [-1, 1]) for (let k = 0; k < 3 && placed < 4; k++) {
      const s = side * (2.4 + k * 2.3); if (Math.abs(s) > len / 2 - 0.6) continue; const x = mid[0] + ux * s + n[0] * 2.3, z = mid[1] + uz * s + n[1] * 2.3;
      if (insideBuilding(x, z) || onRoadSurface(x, z) || onRoadSurface(x + n[0] * 1.2, z + n[1] * 1.2)) continue;
      const g = H(x, z); box(x, z, ux, uz, 0.45, 0.45, g + 0.72, g + 0.76, wood); box(x, z, ux, uz, 0.05, 0.05, g, g + 0.72, metal);
      for (const t of [-1, 1]) { box(x + ux * t * 0.75, z + uz * t * 0.75, ux, uz, 0.2, 0.2, g + 0.44, g + 0.48, metal); box(x + ux * t * 0.93, z + uz * t * 0.93, ux, uz, 0.03, 0.2, g + 0.48, g + 0.9, metal); }
      if (r() < 0.8) { box(x, z, ux, uz, 0.025, 0.025, g + 0.76, g + 2.35, C('#d9d9d6'));
        const R = 1.25, top = [x, g + 2.55, z], ring4 = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [x + (ux * a - uz * b) * R * 0.707, g + 2.05, z + (uz * a + ux * b) * R * 0.707]);
        for (let i = 0; i < 4; i++) { const p = ring4[i], q = ring4[(i + 1) % 4]; const mx = (p[0] + q[0]) / 2 - x, mz = (p[2] + q[2]) / 2 - z; dress.tri(p, q, top, [0, 0], [0, 0], [0, 0], [mx, 1.2, mz], i % 2 ? col : C('#f4f1ea')); dress.tri(p, q, top, [0, 0], [0, 0], [0, 0], [-mx, -1, -mz], col.clone().multiplyScalar(0.5)); } }
      T.hashItems.push([World.obsHash, World.obsHash.insert({ x, z, r: 0.7 }, x - 1, z - 1, x + 1, z + 1)]); placed++;
    }
  }
  // neon signs in the shop windows: OPEN on one side, what they sell on the other
  function neonWindows(f, L, la, lb, ra, rb, n, g0) {
    const tag = { head_shop: 'GLASS · PIPES · CBD', 'e-cigarette': 'VAPE · E-JUICE · CBD', hookah: 'HOOKAH · LOUNGE', tobacco: /vape/i.test(f.name) ? 'TOBACCO · VAPE' : 'TOBACCO · CIGARS' }[f.amenity] || 'SMOKE SHOP';
    const put = (a, b, text, col, w) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 0.9) return; const W = Math.min(len * 0.9, w), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; const i = slot(text, { sign: ['#000000', col], font: L.font }, 'neonT'); signQuad(i, [m[0] - tx * W / 2, m[1] - tz * W / 2], [m[0] + tx * W / 2, m[1] + tz * W / 2], g0 + 1.55, g0 + 1.55 + W / 4.4, n, 0.13); };
    put(la, lb, 'OPEN', '#ff3b5c', 1.5); put(ra, rb, tag, L.neon, 2.6);
  }
  function outwardNormals(ring) { const sa = signedArea(ring); return ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; let nx = dz / L, nz = -dx / L; if (sa < 0) { nx = -nx; nz = -nz; } return [nx, nz, L]; }); }
  function roadDir(x, z) { const r = nearestRoad(x, z, 160, rd => rd.car); if (!r) return null; const dx = r.x - x, dz = r.z - z, d = Math.hypot(dx, dz) || 1; return { dx: dx / d, dz: dz / d, d, r }; }
  function pylon(f, L, cx, cz, rd) {
    if (!rd || rd.d < 6) return;
    let px = rd.r.x - rd.dx * (rd.r.road.w / 2 + 4.5), pz = rd.r.z - rd.dz * (rd.r.road.w / 2 + 4.5);
    if (insideBuilding(px, pz)) return;
    const g = H(px, pz); const tall = f._big ? 11 : f.kind === 'centre' ? 9.5 : L.style === 'diner' ? 9 : f.amenity === 'fast_food' || f.kind === 'fuel' ? 8 : 6.5;
    const ux = rd.dx, uz = rd.dz; // cabinet stands edge-on to the road so both faces are seen by passing traffic
    const hl = 2.1, cab = C(L.trim); const n1 = [-rd.dz, rd.dx], n2 = [rd.dz, -rd.dx];
    const a = [px - ux * hl, pz - uz * hl], b = [px + ux * hl, pz + uz * hl];
    // extra panels under the main cabinet: gas prices, or the stores in a shopping centre
    const extra = [];
    if (f.kind === 'fuel') extra.push({ text: 'REGULAR  ' + (2.89 + ((f.x * 7 + f.z * 3) & 7) * 0.1).toFixed(2), look: { sign: ['#111214', '#ffd23a'] }, mode: 'price' }, { text: 'DIESEL  ' + (3.49 + ((f.x * 3 + f.z * 5) & 7) * 0.1).toFixed(2), look: { sign: ['#111214', '#7dff6a'] }, mode: 'price' });
    if (f.kind === 'centre') for (const o of Food.list) { if (extra.length >= 4) break; if (o === f || o.kind === 'centre' || o.kind === 'fuel' || Math.hypot(o.x - f.x, o.z - f.z) > 260) continue; if (extra.some(e => e.text === o.name)) continue; extra.push({ text: o.name, look: o.look, mode: 'cab' }); }
    const ph = 0.72, top = g + tall + 0.12, stackBot = g + tall - 1.4 - extra.length * (ph + 0.08);
    box(px, pz, ux, uz, 0.2, 0.2, g + 0.5, stackBot, C('#5d6166')); if (f.kind === 'centre' || L.brand) box(px + ux * (hl - 0.4), pz + uz * (hl - 0.4), ux, uz, 0.16, 0.16, g + 0.5, stackBot, C('#5d6166'));
    box(px, pz, ux, uz, hl * 0.62, 0.42, g - 0.2, g + 0.9, C(L.wall).multiplyScalar(0.8)); box(px, pz, ux, uz, hl * 0.62 + 0.06, 0.46, g + 0.9, g + 1.02, C(L.trim2)); // masonry base + cap
    box(px, pz, ux, uz, hl + 0.08, 0.22, g + tall - 1.4, top, cab); box(px, pz, ux, uz, hl + 0.14, 0.26, top, top + 0.12, C(L.trim2));
    const i = slot(f.name, L);
    signQuad(i, a, b, g + tall - 1.3, g + tall + 0.02, n1, 0.23); signQuad(i, a, b, g + tall - 1.3, g + tall + 0.02, n2, 0.23);
    extra.forEach((e, k) => { const y1 = g + tall - 1.48 - k * (ph + 0.08), y0 = y1 - ph; box(px, pz, ux, uz, hl * 0.92, 0.2, y0 - 0.04, y1 + 0.04, C('#2a2d31')); const j = slot(e.text, e.look, e.mode); const a2 = [px - ux * hl * 0.88, pz - uz * hl * 0.88], b2 = [px + ux * hl * 0.88, pz + uz * hl * 0.88]; signQuad(j, a2, b2, y0, y1, n1, 0.21); signQuad(j, a2, b2, y0, y1, n2, 0.21); });
    T.hashItems.push([World.obsHash, World.obsHash.insert({ x: px, z: pz, r: 0.5 }, px - 1, pz - 1, px + 1, pz + 1)]);
  }
  function band(ring, nrm, y0, y1, L) { // fascia band around the roof line (solid, stripes or checker)
    const c1 = C(L.trim), c2 = C(L.trim2);
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]; const [nx, nz, len] = nrm[i]; if (len < 0.1) return; const n = [nx, nz];
      if (L.band === 'stripes' || L.band === 'checker') {
        const step = L.band === 'stripes' ? 0.9 : 0.45; const k = Math.max(1, Math.round(len / step));
        const rows = L.band === 'checker' ? 2 : 1;
        for (let j = 0; j < k; j++) for (let r = 0; r < rows; r++) {
          const t0 = j / k, t1 = (j + 1) / k; const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
          const yy0 = y0 + (y1 - y0) * r / rows, yy1 = y0 + (y1 - y0) * (r + 1) / rows;
          faceQ(p0, p1, yy0, yy1, n, 0.07, (j + r) % 2 ? c2 : c1);
        }
      } else faceQ(a, b, y0, y1, n, 0.07, c1);
      faceQ(b, a, y0 + 0.1, y1, [-nx, -nz], -0.02, c1.clone().multiplyScalar(0.7)); // inner face of the parapet
      // thin accent line under the band
      faceQ(a, b, y0 - 0.14, y0, n, 0.075, c2);
    });
  }

  // ---- a whole building in the brand's look ----
  function themedBuilding(ring, f, id, tagsH) {
    const L = f.look; const nrm = outwardNormals(ring);
    let gmin = 1e9, gsum = 0; for (const p of ring) { const y = H(p[0], p[1]); gmin = Math.min(gmin, y); gsum += y; } const gavg = gsum / ring.length;
    const area = Math.abs(signedArea(ring)); const [cx, cz] = centroid(ring);
    const big = area > 1300; const shop = f.kind !== 'food';
    const hw = tagsH > 0 ? Math.min(tagsH, 12) : shop ? (L.h || (big ? (area > 6000 ? 9.5 : 7.5) : 5.0)) : (L.h || (f.amenity === 'restaurant' ? 5.8 : 5.0)) + (area > 600 ? 0.6 : 0);
    const base = gmin - 0.4, wallTop = gavg + hw; const hip = L.roof === 'hip';
    // walls (facade texture, tinted)
    const fac = MAT.facade[L.mat] ? L.mat : 'shop'; const tf = TEX.facade[fac]; const texW = tf.bayW * 4, texH = tf.floorH * 4; const mbw = ctx.buckets[fac];
    const wallCol = C(L.wall); let acc = 0;
    ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; const [nx, nz, len] = nrm[i]; if (len < 0.05) return; const u0 = acc / texW, u1 = (acc + len) / texW; acc += len; mbw.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], wallTop, b[1]], [a[0], wallTop, a[1]], [u0, (base - gavg) / texH], [u1, (base - gavg) / texH], [u1, (wallTop - gavg) / texH], [u0, (wallTop - gavg) / texH], [nx, 0, nz], wallCol); });
    // stone / split-face block base course all the way round
    const baseCol = C(L.base || (L.mat === 'brick' ? '#8d8479' : '#9a948a'));
    ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; const [nx, nz, len] = nrm[i]; if (len < 0.3) return; const gA = Math.min(H(a[0], a[1]), H(b[0], b[1])); faceQ(a, b, base, gA + 0.75, [nx, nz], 0.05, baseCol); ledge(a, b, [nx, nz], gA + 0.75, gA + 0.82, 0.09, baseCol.clone().multiplyScalar(1.12)); });
    // which wall faces the street?
    const rd = roadDir(cx, cz); let fi = 0, fs = -1e9;
    nrm.forEach(([nx, nz, len], i) => { const s = (rd ? nx * rd.dx + nz * rd.dz : 0) * 2 + Math.min(len, 20) / 20; if (s > fs) { fs = s; fi = i; } });
    const fa = ring[fi], fb = ring[(fi + 1) % ring.length], [fnx, fnz, flen] = nrm[fi]; const fn = [fnx, fnz];
    // roof
    let topY = wallTop, towerFront = 0, towerW = 0, frontTower = 0;
    if (!hip) {
      const contour = ring.map(p => new THREE.Vector2(p[0], p[1])); let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { }
      const rc = new THREE.Color(0.55, 0.56, 0.57);
      for (const tr of tris) { const A = contour[tr[0]], Bv = contour[tr[1]], Cc = contour[tr[2]]; ctx.roofF.tri([A.x, wallTop, A.y], [Bv.x, wallTop, Bv.y], [Cc.x, wallTop, Cc.y], [A.x / 8, A.y / 8], [Bv.x / 8, Bv.y / 8], [Cc.x / 8, Cc.y / 8], UPN, rc); }
      const bh = L.style === 'diner' ? 0.6 : 1.0; band(ring, nrm, wallTop, wallTop + bh, L); topY = wallTop + bh;
      ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; const [nx, nz, len] = nrm[i]; if (len < 0.3) return; ledge(a, b, [nx, nz], topY, topY + 0.16, 0.22, C(L.cap || '#e8e6e1')); }); // metal coping
      rooftopUnits(ring, wallTop, area, id || (cx * 13 + cz * 7));
      // big boxes: pilasters break up the long walls
      if (big) ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; const [nx, nz, len] = nrm[i]; if (len < 18) return; const k = Math.floor(len / 9); const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; for (let j = 1; j < k; j++) { const s0 = j * len / k; const x = a[0] + tx * s0 + nx * 0.25, z = a[1] + tz * s0 + nz * 0.25; box(x, z, tx, tz, 0.35, 0.28, gavg - 0.3, wallTop, C(L.wall).multiplyScalar(0.86)); } });
      // a raised brand "tower" over the entrance for the bigger sit-down chains
      if (big && flen > 14) { // big-box entrance tower: projects from the facade and rises above the roof line
        const mx = (fa[0] + fb[0]) / 2, mz = (fa[1] + fb[1]) / 2; const ux = (fb[0] - fa[0]) / flen, uz = (fb[1] - fa[1]) / flen;
        const thl = Math.min(flen * 0.17, 11); box(mx + fnx * 0.8, mz + fnz * 0.8, ux, uz, thl, 1.8, gavg - 0.3, wallTop + 3.2, C(L.wall).multiplyScalar(0.92));
        box(mx + fnx * 0.82, mz + fnz * 0.82, ux, uz, thl + 0.05, 1.85, wallTop + 2.2, wallTop + 3.35, C(L.trim));
        towerFront = 2.62; towerW = thl * 2; topY = wallTop + 3.3;
      } else if (L.brand && f.amenity === 'restaurant' && flen > 8 && L.style !== 'porch') {
        const mx = (fa[0] + fb[0]) / 2, mz = (fa[1] + fb[1]) / 2; const ux = (fb[0] - fa[0]) / flen, uz = (fb[1] - fa[1]) / flen;
        box(mx - fnx * 1.2, mz - fnz * 1.2, ux, uz, 2.9, 1.6, wallTop - 0.2, wallTop + 2.4, C(L.trim)); ledge([mx - ux * 2.9 + fnx * 0.4, mz - uz * 2.9 + fnz * 0.4], [mx + ux * 2.9 + fnx * 0.4, mz + uz * 2.9 + fnz * 0.4], fn, wallTop + 2.4, wallTop + 2.55, 0.18, C(L.trim2));
        topY = wallTop + 2.4; frontTower = 0.4;
      }
    } else {
      const obb = minAreaRect(ring); if (obb) {
        const o = 0.6, pitch = 0.62; const { ux, uz, vx, vz } = obb; const W2 = obb.W / 2, L2 = obb.L / 2; const rise = Math.min(3.2, (W2 + o) * Math.tan(pitch));
        const P3 = (u, v, y) => [obb.cx + u * ux + v * vx, y, obb.cz + u * uz + v * vz]; const rr = Math.max(0, L2 - W2);
        const A = P3(-L2 - o, -W2 - o, wallTop), Bq = P3(L2 + o, -W2 - o, wallTop), Cc = P3(L2 + o, W2 + o, wallTop), D = P3(-L2 - o, W2 + o, wallTop);
        const R1 = P3(-rr, 0, wallTop + rise), R2 = P3(rr, 0, wallTop + rise); const rc = C(L.roofCol || L.trim);
        const nU = (u, v) => [u * ux + v * vx, 1.2, u * uz + v * vz];
        ctx.roofS.quad(A, Bq, R2, R1, [0, 0], [obb.L / 4, 0], [obb.L / 8, 1], [obb.L / 8 - 0.1, 1], nU(0, -1), rc);
        ctx.roofS.quad(Cc, D, R1, R2, [obb.L / 4, 0], [0, 0], [0.1, 1], [obb.L / 8, 1], nU(0, 1), rc);
        ctx.roofS.tri(D, A, R1, [0, 0], [obb.W / 4, 0], [obb.W / 8, 1], nU(-1, 0), rc); ctx.roofS.tri(Bq, Cc, R2, [0, 0], [obb.W / 4, 0], [obb.W / 8, 1], nU(1, 0), rc);
        ctx.roofF.quad(A, Bq, Cc, D, [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0], new THREE.Color(0.8, 0.8, 0.78));
        // eave trim
        const E = [A, Bq, Cc, D]; for (let i = 0; i < 4; i++) { const p = E[i], q = E[(i + 1) % 4]; const mx = (p[0] + q[0]) / 2 - obb.cx, mz = (p[2] + q[2]) / 2 - obb.cz; const l = Math.hypot(mx, mz) || 1; dress.quad([p[0], wallTop - 0.28, p[2]], [q[0], wallTop - 0.28, q[2]], [q[0], wallTop + 0.02, q[2]], [p[0], wallTop + 0.02, p[2]], [0, 0], [0, 0], [0, 0], [0, 0], [mx / l, 0, mz / l], C(L.trim2 === '#ffffff' ? L.trim : L.trim2)); }
        topY = wallTop + rise;
      }
    }
    // entrance: glass door with a dark frame
    const g0 = H((fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2); const ux = (fb[0] - fa[0]) / flen, uz = (fb[1] - fa[1]) / flen;
    const mid = [(fa[0] + fb[0]) / 2, (fa[1] + fb[1]) / 2];
    const dw = towerW ? Math.min(towerW * 0.35, 3.2) : 0.95; const doff = towerW ? towerFront + 0.03 : 0.04;
    const frame = C(L.frame || (L.mat === 'brick' ? '#2a2e33' : '#8f959b'));
    if (flen > 3 && L.style !== 'garage') {
      // storefront glass across most of the street face (not for the windowless big boxes, which get glass at the entrance)
      if (!big) { const m = Math.min(1.2, flen * 0.12); const gl0 = [fa[0] + ux * m, fa[1] + uz * m], gl1 = [fb[0] - ux * m, fb[1] - uz * m]; glassPane(gl0, [mid[0] - ux * (dw + 0.25), mid[1] - uz * (dw + 0.25)], fn, g0 + 0.82, g0 + 2.85, 0.06, frame); glassPane([mid[0] + ux * (dw + 0.25), mid[1] + uz * (dw + 0.25)], gl1, fn, g0 + 0.82, g0 + 2.85, 0.06, frame); }
      // side walls of restaurants get windows too
      if (!big && !shop) nrm.forEach(([nx, nz, len], i) => { if (i === fi || len < 6 || Math.abs(nx * fnx + nz * fnz) > 0.4) return; const a = ring[i], b = ring[(i + 1) % ring.length]; const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; const k = Math.floor((len - 1.5) / 3.2); for (let j = 0; j < k; j++) { const s0 = 1 + j * 3.2; glassPane([a[0] + tx * s0, a[1] + tz * s0], [a[0] + tx * (s0 + 2.2), a[1] + tz * (s0 + 2.2)], [nx, nz], g0 + 0.9, g0 + 2.6, 0.06, frame, 2); } });
      // doors: glass double doors, a projecting metal entrance canopy
      const d0 = [mid[0] - ux * dw, mid[1] - uz * dw], d1 = [mid[0] + ux * dw, mid[1] + uz * dw]; const dh = towerW ? 3.4 : 2.5;
      glassPane(d0, d1, fn, g0, g0 + dh, doff, frame, 2); faceQ(d0, d1, g0 + dh, g0 + dh + 0.5, fn, doff + 0.01, frame);
      if (towerW) { glassPane([mid[0] - ux * (towerW / 2 - 0.8), mid[1] - uz * (towerW / 2 - 0.8)], d0, fn, g0 + 0.2, g0 + dh + 1.2, doff, frame); glassPane(d1, [mid[0] + ux * (towerW / 2 - 0.8), mid[1] + uz * (towerW / 2 - 0.8)], fn, g0 + 0.2, g0 + dh + 1.2, doff, frame); }
      else { const cw = dw + 1.1, cdep = 1.7, cy = g0 + 3.0; box(mid[0] + fnx * (cdep / 2 + doff), mid[1] + fnz * (cdep / 2 + doff), ux, uz, cw, cdep / 2, cy, cy + 0.3, C(L.trim)); box(mid[0] + fnx * (cdep + doff) , mid[1] + fnz * (cdep + doff), ux, uz, cw + 0.02, 0.04, cy - 0.06, cy + 0.34, C(L.trim2)); }
    }
    if (L.style === 'garage' && flen > 6) { // roll-up service doors
      const n = Math.min(4, Math.floor((flen - 3) / 4)); for (let j = 0; j < n; j++) { const s0 = (j + 0.5) * flen / (n + 0.5) - 1.5; const p0 = [fa[0] + ux * s0, fa[1] + uz * s0], p1 = [fa[0] + ux * (s0 + 3), fa[1] + uz * (s0 + 3)]; if (Math.abs(s0 + 1.5 - flen / 2) < 2.2) continue; for (let r = 0; r < 6; r++) faceQ(p0, p1, g0 + r * 0.6, g0 + r * 0.6 + 0.58, fn, 0.05, C(r % 2 ? '#b8bcc0' : '#a9adb2')); faceQ(p0, p1, g0 + 3.6, g0 + 3.75, fn, 0.06, C(L.trim)); }
    }
    // awnings along the street-facing walls
    nrm.forEach(([nx, nz, len], i) => {
      if (len < 3.2 || !rd || big || L.style === 'garage' || L.style === 'showroom') return; if (i !== fi && nx * rd.dx + nz * rd.dz < 0.35) return;
      const a = ring[i], b = ring[(i + 1) % ring.length]; const k = Math.max(1, Math.floor((len - 0.6) / 3.2)); const seg = (len - 0.6) / k;
      const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; const deep = L.style === 'walkup' ? 1.8 : 1.0;
      for (let j = 0; j < k; j++) { const s0 = 0.3 + j * seg + 0.25, s1 = 0.3 + (j + 1) * seg - 0.25; if (i === fi && Math.abs((s0 + s1) / 2 - len / 2) < (towerW ? 1.2 : 2.6)) continue; awning([a[0] + tx * s0, a[1] + tz * s0], [a[0] + tx * s1, a[1] + tz * s1], [nx, nz], g0 + 3.0, deep, 0.45, C(L.awn)); }
    });
    if (!big && !shop && rd && flen > 9 && (/cafe|ice_cream/.test(f.amenity) || (f.amenity === 'restaurant' && !L.style) || /coffee|pizza|mexican|italian|sandwich|burger/.test(f.cuisine || ''))) patio(mid, ux, uz, fn, flen, g0, L, id || cx * 31 + cz);
    // wall signs: street face (+ one side face for chains)
    const sw = towerW ? Math.min(towerW * 0.92, 20) : frontTower ? 5.4 : big ? Math.min(flen * 0.4, 14) : Math.min(flen * 0.72, L.style === 'diner' ? 5.5 : 7.5), sh = sw / 4.4;
    const sy = towerW ? topY - 1.25 : hip ? Math.min(wallTop - 0.1, g0 + 3.6 + sh) : topY - 0.05;
    f._front = { x: mid[0], z: mid[1], nx: fnx, nz: fnz, w: flen };
    const lettersMode = L.neon ? 'neon' : (L.brand || big || f.kind === 'shop') && !L.band ? 'let' : 'cab'; // stripes/checks behind letters would hide them
    if (L.neon && flen > 4) neonWindows(f, L, [mid[0] - ux * (dw + 0.35), mid[1] - uz * (dw + 0.35)], [fa[0] + ux * 0.9, fa[1] + uz * 0.9], [mid[0] + ux * (dw + 0.35), mid[1] + uz * (dw + 0.35)], [fb[0] - ux * 0.9, fb[1] - uz * 0.9], fn, g0);
    const LL = lettersMode === 'let' ? letterLook(L, L.band ? L.trim2 : L.trim) : L; // letters must stand out from the band they sit on
    if (flen > 2.5) { const i0 = towerW || hip ? slot(f.name, L) : slot(f.name, LL, lettersMode); signQuad(i0, [mid[0] - ux * sw / 2, mid[1] - uz * sw / 2], [mid[0] + ux * sw / 2, mid[1] + uz * sw / 2], sy - sh - (frontTower ? 0.35 : 0), sy - (frontTower ? 0.35 : 0), fn, towerW ? towerFront + 0.08 : frontTower ? frontTower + 0.06 : 0.11); }
    if (L.brand && rd) {
      let si = -1, ss = 0.15; nrm.forEach(([nx, nz, len], i) => { if (i === fi || len < 6) return; const s = nx * rd.dx + nz * rd.dz; if (s > ss) { ss = s; si = i; } });
      if (si < 0) nrm.forEach(([nx, nz, len], i) => { if (i !== fi && len > 7 && si < 0 && Math.abs(nx * fnx + nz * fnz) < 0.3) si = i; });
      if (si >= 0) { const a = ring[si], b = ring[(si + 1) % ring.length]; const [nx, nz, len] = nrm[si]; const w2 = Math.min(len * 0.6, 6.5), h2 = w2 / 4.4; const m2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; const i1 = slot(f.name, LL, lettersMode); signQuad(i1, [m2[0] - tx * w2 / 2, m2[1] - tz * w2 / 2], [m2[0] + tx * w2 / 2, m2[1] + tz * w2 / 2], sy - h2, sy, [nx, nz], 0.11); }
    }
    // special structures
    if (L.style === 'drivein') { // covered drive-in stalls in front of the building
      const dx = fnx, dz = fnz; const len2 = Math.max(12, flen + 8); const ccx = mid[0] + dx * 6.5, ccz = mid[1] + dz * 6.5; const gg = H(ccx, ccz);
      box(ccx, ccz, ux, uz, len2 / 2, 2.2, gg + 3.1, gg + 3.45, C(L.trim2)); box(ccx, ccz, ux, uz, len2 / 2 + 0.02, 2.22, gg + 3.0, gg + 3.12, C(L.trim));
      for (let s = -len2 / 2 + 1; s <= len2 / 2 - 1 + 1e-3; s += 3.2) { const px = ccx + ux * s, pz = ccz + uz * s; box(px, pz, ux, uz, 0.09, 0.09, gg, gg + 3.05, C('#9aa0a6')); box(px + dx * 1.6, pz + dz * 1.6, ux, uz, 0.25, 0.06, gg + 1.0, gg + 1.9, C(L.trim2)); }
    }
    if (L.style === 'porch') { // long front porch with posts and rocking chairs
      const depth = 3.0; const yy = g0 + 3.1; const a = fa, b = fb;
      const A2 = [a[0] + fnx * depth, a[1] + fnz * depth], B2 = [b[0] + fnx * depth, b[1] + fnz * depth];
      dress.quad([a[0], yy + 0.5, a[1]], [b[0], yy + 0.5, b[1]], [B2[0], yy, B2[1]], [A2[0], yy, A2[1]], [0, 0], [0, 0], [0, 0], [0, 0], [fnx * 0.3, 1, fnz * 0.3], C('#4d463f'));
      dress.quad([a[0], yy + 0.5, a[1]], [b[0], yy + 0.5, b[1]], [B2[0], yy, B2[1]], [A2[0], yy, A2[1]], [0, 0], [0, 0], [0, 0], [0, 0], [-fnx * 0.3, -1, -fnz * 0.3], C('#d8cbb3'));
      box((a[0] + b[0]) / 2 + fnx * depth / 2, (a[1] + b[1]) / 2 + fnz * depth / 2, ux, uz, flen / 2, depth / 2, g0 - 0.3, g0 + 0.35, C('#8a6a4a'));
      for (let s = 0.4; s < flen; s += 2.6) { const px = a[0] + ux * s + fnx * (depth - 0.2), pz = a[1] + uz * s + fnz * (depth - 0.2); box(px, pz, ux, uz, 0.1, 0.1, g0 + 0.35, yy + 0.05, C('#efe8da')); }
      for (let s = 1.6; s < flen - 1; s += 1.9) { const px = a[0] + ux * s + fnx * 1.4, pz = a[1] + uz * s + fnz * 1.4; box(px, pz, ux, uz, 0.28, 0.3, g0 + 0.35, g0 + 0.8, C('#3f2c1f')); box(px - fnx * 0.25, pz - fnz * 0.25, ux, uz, 0.28, 0.05, g0 + 0.8, g0 + 1.45, C('#3f2c1f')); }
    }
    if (f.drive && rd) { // drive-thru menu board beside the building
      const sa = nrm.findIndex(([nx, nz], i) => i !== fi && Math.abs(nx * fnx + nz * fnz) < 0.4); if (sa >= 0) { const [nx, nz] = nrm[sa]; const a = ring[sa]; const px = a[0] + nx * 4.2, pz = a[1] + nz * 4.2; if (!insideBuilding(px, pz)) { const gg = H(px, pz); box(px, pz, -nz, nx, 0.9, 0.12, gg + 0.3, gg + 2.2, C('#2a2d31')); box(px, pz, -nz, nx, 0.08, 0.08, gg - 0.2, gg + 0.3, C('#5d6166')); } }
    }
    f._big = big; if (L.pylon && (f.amenity === 'fast_food' || L.brand)) pylon(f, L, cx, cz, rd);
    // collision + name for the HUD / minimap
    const bb = ring.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const item = { ring, holes: [], minY: -1e9, maxY: topY, name: f.name, cx, cz, h: topY };
    T.hashItems.push([World.bldHash, World.bldHash.insert(item, bb[0], bb[1], bb[2], bb[3])]);
    T.hashItems.push([World.mmHash, World.mmHash.insert({ bld: ring }, bb[0], bb[1], bb[2], bb[3])]);
    out.count++;
  }
  function themed(B) { const hTag = parseLen(B.tags.height) || (parseFloat(B.tags['building:levels']) > 1 ? parseFloat(B.tags['building:levels']) * 3.6 : 0); themedBuilding(B.ring, B.food, B.id, hTag); }

  // ---- a storefront inside a bigger building ----
  function storefronts(B, base, wallTop) {
    const ring = B.ring; const nrm = outwardNormals(ring);
    for (const f of B.units) {
      const L = f.look; let bi = -1, bd = 1e9, bt = 0;
      ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length]; if (nrm[i][2] < 3) return; const s = segDist(f.x, f.z, a[0], a[1], b[0], b[1]); if (s.d < bd) { bd = s.d; bi = i; bt = s.t; } });
      if (bi < 0) continue;
      const a = ring[bi], b = ring[(bi + 1) % ring.length]; const [nx, nz, len] = nrm[bi]; const n = [nx, nz];
      const w = Math.min(len - 0.4, f.amenity === 'restaurant' ? 11 : 8); const c = clamp(bt * len, w / 2 + 0.2, len - w / 2 - 0.2);
      const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len; const p0 = [a[0] + tx * (c - w / 2), a[1] + tz * (c - w / 2)], p1 = [a[0] + tx * (c + w / 2), a[1] + tz * (c + w / 2)];
      const g0 = H((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      const top = Math.min(wallTop - 0.15, g0 + 4.7), panelH = Math.min(1.3, Math.max(0.8, top - g0 - 2.9)), bot = top - panelH;
      if (bot < g0 + 2.2) continue;
      faceQ(p0, p1, bot, top, n, 0.08, C(L.trim));
      faceQ(p0, p1, bot - 0.1, bot, n, 0.085, C(L.trim2));
      // glass storefront with a centre door, piers either side
      { const fr = C(L.frame || '#2a2e33'); const cc0 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        glassPane([p0[0] + tx * 0.45, p0[1] + tz * 0.45], [cc0[0] - tx * 0.9, cc0[1] - tz * 0.9], n, g0 + 0.5, bot - 0.35, 0.07, fr);
        glassPane([cc0[0] + tx * 0.9, cc0[1] + tz * 0.9], [p1[0] - tx * 0.45, p1[1] - tz * 0.45], n, g0 + 0.5, bot - 0.35, 0.07, fr);
        glassPane([cc0[0] - tx * 0.9, cc0[1] - tz * 0.9], [cc0[0] + tx * 0.9, cc0[1] + tz * 0.9], n, g0, bot - 0.35, 0.07, fr, 2);
        faceQ([p0[0], p0[1]], [p0[0] + tx * 0.42, p0[1] + tz * 0.42], g0, top, n, 0.1, C(L.wall).multiplyScalar(0.8)); faceQ([p1[0] - tx * 0.42, p1[1] - tz * 0.42], p1, g0, top, n, 0.1, C(L.wall).multiplyScalar(0.8)); }
      awning(p0, p1, n, bot - 0.12, 1.1, 0.4, C(L.awn));
      const sw = Math.min(w * 0.85, panelH * 0.86 * 4.4), sh = sw / 4.4; const cc = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      f._front = { x: cc[0], z: cc[1], nx: n[0], nz: n[1], w }; // where the shop's door is (used by the people who hang out there)
      if (L.neon) neonWindows(f, L, [cc[0] - tx * 0.95, cc[1] - tz * 0.95], [p0[0] + tx * 0.5, p0[1] + tz * 0.5], [cc[0] + tx * 0.95, cc[1] + tz * 0.95], [p1[0] - tx * 0.5, p1[1] - tz * 0.5], n, g0);
      const i0 = slot(f.name, L, L.neon ? 'neon' : 'cab'); signQuad(i0, [cc[0] - tx * sw / 2, cc[1] - tz * sw / 2], [cc[0] + tx * sw / 2, cc[1] + tz * sw / 2], (bot + top) / 2 - sh / 2, (bot + top) / 2 + sh / 2, n, 0.12);
      out.count++;
    }
  }

  // ---- places mapped as a point with no building: build one facing the street ----
  function standalone() {
    for (const f of foods) {
      if (!f._alone) continue;
      if (f.kind === 'centre') { const rd = roadDir(f.x, f.z); if (rd) pylon(f, f.look, f.x, f.z, rd); continue; }
      if (f.kind === 'fuel') { fuelStation(f); continue; }
      const rd = roadDir(f.x, f.z);
      const dims = f.kind === 'shop' ? (/supermarket|department|wholesale|doityourself/.test(f.amenity) ? [36, 26] : [16, 12]) : f.amenity === 'restaurant' ? [20, 14] : f.amenity === 'fast_food' ? [15, 11] : /cafe|ice_cream/.test(f.amenity) ? [11, 8] : [13, 10];
      // which way the new building faces: toward the street; a place mapped right on the street (address estimates)
      // may go on either side of it, and can slide along the street to find a free lot
      const dirs = []; let along = [0];
      if (rd && rd.d >= 1.5) dirs.push([rd.dx, rd.dz]);
      else if (rd) { const pts = rd.r.road.pts, i = Math.min(rd.r.i, pts.length - 2); const sx = pts[i + 1][0] - pts[i][0], sz = pts[i + 1][1] - pts[i][1], sl = Math.hypot(sx, sz) || 1; dirs.push([-sz / sl, sx / sl], [sz / sl, -sx / sl]); along = [0, 14, -14, 28, -28]; }
      else dirs.push([0, 1]);
      let placed = null;
      search: for (const sh of along) for (const [fx, fz] of dirs) for (const sc of [1, 0.8, 0.62]) {
        const ux = -fz, uz = fx; const wx = dims[0] * sc / 2, wd = dims[1] * sc / 2; let cx = f.x + ux * sh, cz = f.z + uz * sh;
        if (rd) { const d0 = rd.d >= 1.5 ? rd.d : 0; const need = rd.r.road.w / 2 + wd + 3; if (d0 < need) { cx -= fx * (need - d0); cz -= fz * (need - d0); } }
        const ring = [[cx - ux * wx + fx * wd, cz - uz * wx + fz * wd], [cx - ux * wx - fx * wd, cz - uz * wx - fz * wd], [cx + ux * wx - fx * wd, cz + uz * wx - fz * wd], [cx + ux * wx + fx * wd, cz + uz * wx + fz * wd]];
        const probes = ring.concat([[cx, cz]], ring.map((p, i) => { const q = ring[(i + 1) % 4]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }));
        if (probes.some(p => insideBuilding(p[0], p[1]) || onRoadSurface(p[0], p[1]))) continue;
        placed = ring; break search;
      }
      if (placed) themedBuilding(placed, f, 0, 0);
    }
  }

  // ---- gas stations ----
  function pumps(cx, cz, ux, uz, len, g, L) { // pump islands under a canopy, laid out along (ux,uz)
    const n = Math.max(2, Math.min(4, Math.floor(len / 6))); const vx = -uz, vz = ux;
    for (let i = 0; i < n; i++) { const s = (i - (n - 1) / 2) * (len / n); const px = cx + ux * s, pz = cz + uz * s;
      box(px, pz, vx, vz, 2.2, 0.55, g - 0.1, g + 0.18, C('#b9b6ae'));                         // island curb
      for (const t of [-1.1, 1.1]) { box(px + vx * t, pz + vz * t, vx, vz, 0.3, 0.25, g + 0.18, g + 1.85, C('#e9e9e6')); box(px + vx * t, pz + vz * t, vx, vz, 0.31, 0.26, g + 1.55, g + 1.85, C(L.fuel ? L.fuel[0] : L.trim)); }
      T.hashItems.push([World.obsHash, World.obsHash.insert({ x: px, z: pz, r: 1.4 }, px - 2, pz - 2, px + 2, pz + 2)]);
    }
  }
  function canopyBand(ring, y0, y1, L) { const nrm = outwardNormals(ring); band(ring, nrm, y0, y1, Object.assign({}, L, { trim: L.fuel ? L.fuel[0] : L.trim, trim2: L.fuel ? L.fuel[1] : L.trim2, band: L.band === 'stripes' ? 'stripes' : 'solid' })); }
  function canopy(B, base, wallTop) { // a mapped canopy (building=roof): brand its fascia, add pumps and a price sign
    const f = B.fuel, L = f.look; canopyBand(B.ring, Math.max(base, wallTop - 1.0), wallTop + 0.05, L);
    const obb = minAreaRect(B.ring); if (obb) pumps(obb.cx, obb.cz, obb.ux, obb.uz, obb.L, H(obb.cx, obb.cz), L);
    pylon(f, L, obb ? obb.cx : f.x, obb ? obb.cz : f.z, roadDir(obb ? obb.cx : f.x, obb ? obb.cz : f.z)); out.count++;
  }
  function fuelStation(f) { // no canopy mapped: build one between the store and the street
    const L = f.look; const rd = roadDir(f.x, f.z); if (!rd) return; const fx = rd.dx, fz = rd.dz, ux = -fz, uz = fx;
    for (const sc of [1, 0.75]) {
      const wx = 11 * sc, wd = 5 * sc; let cx = f.x, cz = f.z; const need = rd.r.road.w / 2 + wd + 4; if (rd.d < need) { cx -= fx * (need - rd.d); cz -= fz * (need - rd.d); }
      const ring = [[cx - ux * wx + fx * wd, cz - uz * wx + fz * wd], [cx - ux * wx - fx * wd, cz - uz * wx - fz * wd], [cx + ux * wx - fx * wd, cz + uz * wx - fz * wd], [cx + ux * wx + fx * wd, cz + uz * wx + fz * wd]];
      if (ring.concat([[cx, cz]]).some(p => insideBuilding(p[0], p[1]) || onRoadSurface(p[0], p[1]))) continue;
      const g = H(cx, cz), y0 = g + 4.8, y1 = g + 5.7;
      box(cx, cz, ux, uz, wx, wd, y0, y1, C('#f2f2ef')); canopyBand(ring, y0 - 0.02, y1 + 0.02, L);
      for (let s = -wx + 2; s <= wx - 2; s += 4) for (const t of [-wd * 0.5, wd * 0.5]) box(cx + ux * s - uz * t, cz + uz * s + ux * t, ux, uz, 0.5, 0.5, y0 - 0.05, y0 + 0.01, C('#fffbe8')); // canopy lights
      for (const s of [-0.6, 0, 0.6]) box(cx + ux * wx * s, cz + uz * wx * s, ux, uz, 0.22, 0.22, g - 0.2, y0, C('#d9d9d6'));
      pumps(cx, cz, ux, uz, wx * 2, g, L); pylon(f, L, cx, cz, roadDir(cx, cz)); out.count++; return;
    }
  }

  // ---- signs atlas + meshes ----
  function finish() {
    const dg = dress.geo(); if (dg) { const m = new THREE.Mesh(dg, MAT.foodDress); m.castShadow = true; m.receiveShadow = true; T.group.add(m); }
    const gg = glass.geo(); if (gg) { const m = new THREE.Mesh(gg, MAT.foodGlass); m.receiveShadow = true; T.group.add(m); }
    if (!slots.length) return;
    const rows = Math.ceil(slots.length / 2), SW = 512, SH = 116; const cv = cnv(1024, rows * SH); const g = cv.getContext('2d');
    slots.forEach((s, i) => {
      const x = (i % 2) * SW, y = Math.floor(i / 2) * SH; const fontOf = px => SIGN_FONTS[s.font] ? SIGN_FONTS[s.font](px) : SIGN_FONTS.block(px);
      g.save(); g.beginPath(); g.rect(x, y, SW, SH); g.clip();
      if (s.mode === 'price') { // LED price display
        g.fillStyle = '#111214'; g.fillRect(x, y, SW, SH); const [label, num] = s.text.split(/\s{2,}/);
        g.fillStyle = '#e8e8e8'; g.font = `700 34px "Arial Narrow", Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 22, y + SH / 2 + 2, 190);
        g.fillStyle = s.fg; g.shadowColor = s.fg; g.shadowBlur = 12; g.font = `700 84px "Courier New", monospace`; g.textAlign = 'right'; g.fillText(num, x + SW - 20, y + SH / 2 + 4); g.shadowBlur = 0;
      } else if (s.mode === 'neon' || s.mode === 'neonT') { // glowing tube lettering (on a dark panel, or straight on the glass)
        if (s.mode === 'neon') { g.fillStyle = s.bg; g.fillRect(x, y, SW, SH); g.strokeStyle = s.fg; g.globalAlpha = 0.35; g.lineWidth = 3; g.strokeRect(x + 10, y + 10, SW - 20, SH - 20); g.globalAlpha = 1; }
        let fs = s.mode === 'neonT' ? 78 : 70; g.font = fontOf(fs); let tw = g.measureText(s.text).width; if (tw > SW - 40) { fs = Math.max(24, Math.floor(fs * (SW - 40) / tw)); g.font = fontOf(fs); }
        g.textAlign = 'center'; g.textBaseline = 'middle'; const cx = x + SW / 2, cy = y + SH / 2 + 2;
        g.shadowColor = s.fg; g.shadowBlur = 22; g.strokeStyle = s.fg; g.lineWidth = Math.max(3, fs * 0.08); g.lineJoin = 'round'; g.strokeText(s.text, cx, cy, SW - 30); g.shadowBlur = 10; g.fillStyle = s.fg; g.fillText(s.text, cx, cy, SW - 30);
        g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.75)'; g.font = fontOf(fs); g.globalAlpha = 0.6; g.fillText(s.text, cx, cy, SW - 30); g.globalAlpha = 1; // hot white core of the tubes
      } else if (s.mode === 'let') { // channel letters: just the lettering, with a darker return edge
        let fs = 92; g.font = fontOf(fs); let tw = g.measureText(s.text).width; if (tw > SW - 24) { fs = Math.max(26, Math.floor(fs * (SW - 24) / tw)); g.font = fontOf(fs); }
        g.textAlign = 'center'; g.textBaseline = 'middle'; const col = new THREE.Color(s.fg); const lum = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
        const ret = lum > 0.75 ? s.bg : '#' + col.clone().multiplyScalar(0.45).getHexString(); // letter returns: the brand's other colour on white letters
        g.lineJoin = 'round'; g.strokeStyle = ret; g.lineWidth = Math.max(4, fs * 0.09); g.strokeText(s.text, x + SW / 2 + 2, y + SH / 2 + 5, SW - 20);
        g.fillStyle = s.fg; g.fillText(s.text, x + SW / 2, y + SH / 2 + 2, SW - 20);
      } else { // lit sign cabinet
        const gr = g.createLinearGradient(0, y, 0, y + SH); const bg = new THREE.Color(s.bg); gr.addColorStop(0, '#' + bg.clone().lerp(new THREE.Color(1, 1, 1), 0.12).getHexString()); gr.addColorStop(1, '#' + bg.clone().multiplyScalar(0.86).getHexString());
        g.fillStyle = gr; g.fillRect(x, y, SW, SH);
        g.strokeStyle = s.fg; g.lineWidth = 4; g.globalAlpha = 0.8; g.strokeRect(x + 9, y + 9, SW - 18, SH - 18); g.globalAlpha = 1;
        const words = s.text.split(' '); let lines = [s.text]; let fs = 64; g.font = fontOf(fs); let tw = g.measureText(s.text).width;
        if (tw > SW - 50 && words.length > 1 && s.text.length > 14) { const h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(' '), words.slice(h).join(' ')]; fs = 44; g.font = fontOf(fs); tw = Math.max(...lines.map(l => g.measureText(l).width)); }
        if (tw > SW - 50) { fs = Math.max(20, Math.floor(fs * (SW - 50) / tw)); g.font = fontOf(fs); }
        g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
        lines.forEach((l, k) => g.fillText(l, x + SW / 2, y + SH / 2 + 2 + (k - (lines.length - 1) / 2) * fs * 1.02, SW - 40));
      }
      g.restore();
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    // resolve the slot/corner codes stored in the uv buffer into real atlas coordinates
    const u = signs.u; const Hc = rows * SH;
    for (let k = 0; k < u.length; k += 2) {
      const code = Math.round(u[k]); const i = code >> 2, corner = code & 3; const x = (i % 2) * SW, y = Math.floor(i / 2) * SH;
      const u0 = (x + 4) / 1024, u1 = (x + SW - 4) / 1024, vTop = 1 - (y + 3) / Hc, vBot = 1 - (y + SH - 3) / Hc;
      u[k] = corner === 0 || corner === 3 ? u0 : u1; u[k + 1] = corner === 0 || corner === 1 ? vBot : vTop;
    }
    const sg = signs.geo(); const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.05, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(sg, mat); m.receiveShadow = true; T.group.add(m);
    MAT.foodSigns.add(mat); T.foodMat = mat; T.foodTex = tex;
  }
  return out;
}
