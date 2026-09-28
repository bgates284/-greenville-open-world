
// =====================================================================
// LANDMARKS — ECU campus, ECU Health Medical Center, stadiums
//   • ECU campus: Georgian-revival red brick, white trim & cornices, slate hip roofs,
//     a columned portico on Wright Auditorium / Joyner Library / Spilman, brick walks
//   • Hospital: precast + ribbon glass towers, glass heart & cancer institutes, rooftop
//     mechanical penthouses, a helipad, the Emergency entrance canopy with ambulances
//   • Dowdy-Ficklen Stadium: seating bowl built from the OSM outline, painted field with end zones,
//     suite tower, scoreboard, light towers, goal posts
//   • Grandstands everywhere (Clark-LeClair, softball, soccer, Guy Smith): stepped seating, not boxes
//   • Baseball/softball diamonds painted on their fields
// All of it is driven by OpenStreetMap tags and names, so it lands where the real things are.
// =====================================================================
World.hospitalSpots = World.hospitalSpots || new Map(); // tile → [{type,x,z,yaw}]
const ECU_PURPLE = '#4b1f78', ECU_GOLD = '#f2c230';

function inArea(a, x, z) { return a.rings.some(r => pointInPoly(x, z, r)) && !(a.holes || []).some(h => pointInPoly(x, z, h)); }
function landmarkZones(P) {
  const Z = [];
  for (const a of P.areas) {
    const t = a.tags || {}, n = t.name || '';
    if (/Health Sciences/i.test(n)) Z.push({ kind: 'medcampus', a });
    else if (t.amenity === 'hospital' || t.healthcare === 'hospital') Z.push({ kind: 'hospital', a });
    else if (t.amenity === 'university' || t.amenity === 'college') Z.push({ kind: /Athletic/i.test(n) ? 'athletic' : 'campus', a });
    else if (t.leisure === 'stadium') Z.push({ kind: 'stadium', a, football: /american_football/.test(t.sport || '') || /Dowdy/i.test(n), name: n });
  }
  return Z;
}
const zoneAt = (Z, kind, x, z) => Z.find(q => q.kind === kind && inArea(q.a, x, z));

// ---------- per-building style ----------
function landmarkStyle(B, cx, cz, area, obb, Z) {
  const t = B.tags, bt = t.building || t['building:part'] || 'yes', n = t.name || '';
  const lv = parseFloat(t['building:levels']); const rect = obb ? area / (obb.L * obb.W) : 0;
  if (/^(parking|garage|garages|shed|roof|carport|service)$/.test(bt)) return null;
  // stands inside a football stadium are replaced by the seating bowl; other grandstands become stepped seating
  if (bt === 'grandstand' || bt === 'stadium' || bt === 'bleachers') {
    const st = Z.find(q => q.kind === 'stadium' && q.football && inArea(q.a, cx, cz));
    return st ? { kind: 'skip' } : { kind: 'grandstand' };
  }
  const hosp = bt === 'hospital' || t.amenity === 'hospital' || t.healthcare === 'hospital' || /Medical Center|Hospital|Heart Institute|Cancer/i.test(n) || zoneAt(Z, 'hospital', cx, cz) || zoneAt(Z, 'medcampus', cx, cz);
  if (hosp) {
    const glass = /Heart Institute|Cancer/i.test(n);
    let h = lv > 0 ? lv * 4.2 + 1 : /ECU Health Medical Center/.test(n) ? 30 : /Heart Institute/.test(n) ? 22 : /Children/.test(n) ? 18 : area > 6000 ? 22 : area > 2500 ? 17 : 12.5;
    return { kind: 'hospital', fac: glass ? 'medglass' : 'hospital', h, shape: 'flat', wall: glass ? '#ffffff' : pick(['#ffffff', '#f6f1e8', '#efe9de'], (B.id % 7) / 7), roof: '#cfcfca', main: /^ECU Health Medical Center$/.test(n) || (!n && bt === 'hospital' && area > 8000), name: n, er: t.emergency === 'yes' };
  }
  const campus = zoneAt(Z, 'campus', cx, cz) || zoneAt(Z, 'athletic', cx, cz) || bt === 'university' || bt === 'college' || /\bECU\b|East Carolina/.test(n);
  if (campus) {
    let h = lv > 0 ? lv * 4.2 + 0.9 : /Joyner Library/.test(n) ? 21 : /Colliseum|Coliseum/.test(n) ? 17 : /Recreation/.test(n) ? 12 : area < 600 ? 9.3 : area < 2600 ? 13.5 : 17.7;
    const hip = rect > 0.72 && obb && obb.W < 26 && area < 3200 && h < 19;
    return { kind: 'campus', fac: 'campus', h, shape: hip ? 'hipped' : 'flat', wall: pick(['#ffffff', '#fbeee8', '#f4e6de', '#fff4ee'], (B.id % 11) / 11), roof: hip ? '#4f5856' : '#b9b7b1',
      portico: /Wright Auditorium|Joyner Library|Spilman|Ragsdale|Whichard Building/.test(n), name: n };
  }
  return null;
}

// ---------- extra details on a landmark building ----------
function landmarkExtras(LM, B, T, ctx) {
  const { ring, base, wallTop, gavg, obb, decor, area } = ctx;
  const sa = signedArea(ring);
  const edges = []; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue; let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; if (sa < 0) { nx = -nx; nz = -nz; } edges.push({ a, b, L, nx, nz }); }
  const box = (x, z, y0, y1, hw, hd, yaw, col) => { // oriented box into decor
    const c = Math.cos(yaw), s = Math.sin(yaw); const P = (u, v, y) => [x + u * c + v * s, y, z - u * s + v * c];
    const q = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (let i = 0; i < 4; i++) { const [u0, v0] = q[i], [u1, v1] = q[(i + 1) % 4]; const mx = (u0 + u1) / 2, mv = (v0 + v1) / 2; decor.quad(P(u0, v0, y0), P(u1, v1, y0), P(u1, v1, y1), P(u0, v0, y1), [0, 0], [0, 0], [0, 0], [0, 0], [mx * c + mv * s, 0, -mx * s + mv * c], col); }
    decor.quad(P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], col);
  };
  const band = (y0, y1, out, col) => { for (const e of edges) { const o = [e.nx * out, e.nz * out]; decor.quad([e.a[0] + o[0], y0, e.a[1] + o[1]], [e.b[0] + o[0], y0, e.b[1] + o[1]], [e.b[0] + o[0], y1, e.b[1] + o[1]], [e.a[0] + o[0], y1, e.a[1] + o[1]], [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], col); if (out > 0) decor.quad([e.a[0], y1, e.a[1]], [e.b[0], y1, e.b[1]], [e.b[0] + o[0], y1, e.b[1] + o[1]], [e.a[0] + o[0], y1, e.a[1] + o[1]], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], col); } };
  // the edge that faces the nearest real street (for entrances)
  const frontEdge = () => {
    let best = null, bs = -1e9;
    for (const e of edges) { if (e.L < 8) continue; const mx = (e.a[0] + e.b[0]) / 2 + e.nx * 6, mz = (e.a[1] + e.b[1]) / 2 + e.nz * 6; const nr = nearestRoad(mx, mz, 160, r => r.car); const d = nr ? nr.d : 160; const s = -d + e.L * 0.25 + (nr && nr.road.rank >= 3 ? 10 : 0); if (s > bs) { bs = s; best = e; } }
    return best;
  };
  const WHITE = new THREE.Color('#f4f1ea');
  if (LM.kind === 'campus') {
    band(wallTop - 0.55, wallTop, 0.28, WHITE);                  // cornice
    band(base + 0.35, base + 0.95, 0.08, new THREE.Color('#e3ddd0')); // stone water table
    if (LM.portico) {
      const e = frontEdge(); if (e) {
        const mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2; const yaw = Math.atan2(e.nx, e.nz);
        const w = Math.min(e.L * 0.6, 26), depth = 4.2, colH = Math.min(wallTop - base - 1.2, 12), n = Math.max(4, Math.round(w / 3.6) | 0);
        const ux = Math.cos(yaw), uz = -Math.sin(yaw); // along the wall
        const g0 = H(mx, mz);
        box(mx + e.nx * depth / 2, mz + e.nz * depth / 2, g0 - 0.3, g0 + 0.9, w / 2 + 0.6, depth / 2 + 0.6, yaw, WHITE); // steps / plinth
        for (let k = 0; k < n; k++) { const f = -w / 2 + (k + 0.5) * w / n; const x = mx + ux * f + e.nx * (depth - 0.6), z = mz + uz * f + e.nz * (depth - 0.6); const cg = new THREE.CylinderGeometry(0.42, 0.5, colH, 14); cg.translate(x, g0 + 0.9 + colH / 2, z); addGeoTo(decor, cg, WHITE); }
        const yT = g0 + 0.9 + colH; box(mx + e.nx * depth / 2, mz + e.nz * depth / 2, yT, yT + 1.1, w / 2 + 0.4, depth / 2 + 0.2, yaw, WHITE); // entablature
        // pediment
        const P = (u, v, y) => [mx + ux * u + e.nx * v, y, mz + uz * u + e.nz * v]; const pk = yT + 1.1 + Math.min(3.5, w * 0.16);
        decor.tri(P(-w / 2 - 0.4, depth + 0.2, yT + 1.1), P(w / 2 + 0.4, depth + 0.2, yT + 1.1), P(0, depth + 0.2, pk), [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], WHITE);
        for (const s of [-1, 1]) decor.quad(P(s * (w / 2 + 0.4), depth + 0.2, yT + 1.1), P(0, depth + 0.2, pk), P(0, 0, pk), P(s * (w / 2 + 0.4), 0, yT + 1.1), [0, 0], [0, 0], [0, 0], [0, 0], [s * ux * 0.5, 1, s * uz * 0.5], new THREE.Color('#4f5856'));
      }
    }
  }
  if (LM.kind === 'hospital') {
    band(wallTop - 0.2, wallTop + 0.9, 0.05, new THREE.Color(LM.fac === 'medglass' ? '#d8dcdf' : '#e6e1d6')); // parapet
    band(base + 0.2, base + 1.1, 0.06, new THREE.Color('#bfb8aa'));
    // rooftop mechanical penthouse
    if (area > 1500 && obb) { const pw = Math.min(obb.L * 0.35, 30), pd = Math.min(obb.W * 0.35, 18); box(obb.cx, obb.cz, wallTop, wallTop + 4.5, pw / 2, pd / 2, Math.atan2(obb.ux, obb.uz) + Math.PI / 2, new THREE.Color('#aeb2b4')); }
    if (LM.main) hospitalDetails(LM, T, ctx, edges, box, frontEdge);
  }
}
function addGeoTo(mb, geo, col) { // non-indexed copy of a three.js geometry into a mesh bucket
  const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i += 3) { const v = k => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]; mb.tri(v(0), v(1), v(2), [0, 0], [0, 0], [0, 0], n ? [n.getX(i), n.getY(i), n.getZ(i)] : null, col); }
}
function textTexture(lines, opt = {}) {
  const w = opt.w || 1024, h = opt.h || 256; const c = cnv(w, h), g = c.getContext('2d');
  g.fillStyle = opt.bg || 'rgba(0,0,0,0)'; if (opt.bg) g.fillRect(0, 0, w, h); else g.clearRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach(([txt, size, col, y, weight]) => { g.fillStyle = col; g.font = `${weight || 800} ${size}px "Arial Narrow", Arial, sans-serif`; g.fillText(txt, w / 2, y, w - 20); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signMesh(T, tex, wdt, hgt, emissive) {
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive ? 0.9 : 0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  (T.lmMats || (T.lmMats = [])).push(m); return new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt), m);
}
// ER canopy + ambulances, helipad, rooftop lettering on the main hospital
function hospitalDetails(LM, T, ctx, edges, box, frontEdge) {
  const { wallTop, obb, decor } = ctx;
  const spots = World.hospitalSpots.get(T.key) || []; World.hospitalSpots.set(T.key, spots);
  // helipad on the roof
  if (obb) {
    const c = cnv(512, 512), g = c.getContext('2d'); g.fillStyle = '#6f7275'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#f2c230'; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 200, 0, 7); g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(16, 16, 480, 480);
    g.fillStyle = '#ffffff'; g.fillRect(170, 150, 40, 212); g.fillRect(302, 150, 40, 212); g.fillRect(170, 236, 172, 40);
    g.fillStyle = '#d32020'; g.fillRect(226, 110, 60, 20);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8 }); (T.lmMats || (T.lmMats = [])).push(m);
    const s = Math.min(22, obb.W * 0.7, obb.L * 0.5); const pad = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m); pad.rotation.x = -Math.PI / 2;
    const px = obb.cx + obb.ux * obb.L * 0.25, pz = obb.cz + obb.uz * obb.L * 0.25; pad.position.set(px, wallTop + 0.95, pz); pad.receiveShadow = true; T.group.add(pad);
    box(px, pz, wallTop, wallTop + 0.9, s / 2 + 0.5, s / 2 + 0.5, Math.atan2(obb.ux, obb.uz), new THREE.Color('#9a9c9e'));
  }
  // Emergency entrance
  const e = frontEdge(); if (!e) return;
  const mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2; const g0 = H(mx, mz); const yaw = Math.atan2(e.nx, e.nz);
  const W = Math.min(18, e.L * 0.5), D = 11, Hc = 5.2;
  const ux = e.b[0] - e.a[0], uz = e.b[1] - e.a[1]; const ul = Math.hypot(ux, uz); const tx = ux / ul, tz = uz / ul;
  const cx = mx + e.nx * D / 2, cz = mz + e.nz * D / 2;
  box(cx, cz, g0 + Hc, g0 + Hc + 0.8, W / 2, D / 2, yaw, new THREE.Color('#e9e6df'));                       // canopy slab
  for (const s of [-1, 1]) box(cx + tx * s * (W / 2 - 0.5) + e.nx * (D / 2 - 0.6), cz + tz * s * (W / 2 - 0.5) + e.nz * (D / 2 - 0.6), g0, g0 + Hc, 0.3, 0.3, yaw, new THREE.Color('#d8d4cc'));
  box(mx + e.nx * 0.25, mz + e.nz * 0.25, g0, g0 + 3.2, 4, 0.2, yaw, new THREE.Color('#34495a'));           // sliding glass doors
  const sign = signMesh(T, textTexture([['EMERGENCY', 190, '#e02020', 128]], { w: 1024, h: 256, bg: '#ffffff' }), W * 0.5, W * 0.5 / 4, true);
  sign.position.set(cx + e.nx * (D / 2 + 0.03), g0 + Hc + 0.4, cz + e.nz * (D / 2 + 0.03)); sign.rotation.y = yaw; T.group.add(sign);
  // lettering high on the building
  const big = signMesh(T, textTexture([['ECU HEALTH', 150, '#ffffff', 90], ['MEDICAL CENTER', 92, '#ffffff', 200]], { w: 1024, h: 256 }), Math.min(e.L * 0.7, 36), Math.min(e.L * 0.7, 36) / 4, true);
  big.position.set(mx + e.nx * 0.35, wallTop - 4, mz + e.nz * 0.35); big.rotation.y = yaw; T.group.add(big);
  // ambulances
  for (const s of [-0.45, 0.45]) { const a = makeAmbulance(); a.position.set(cx + tx * s * W * 0.6 + e.nx * 2, H(cx, cz) + 0.05, cz + tz * s * W * 0.6 + e.nz * 2); a.rotation.y = yaw + Math.PI; T.group.add(a); }
  spots.push({ type: 'er', x: cx + e.nx * (D / 2 + 3), z: cz + e.nz * (D / 2 + 3), yaw, tx, tz }, { type: 'door', x: mx + e.nx * 2.5, z: mz + e.nz * 2.5, yaw, tx, tz });
  T.hashItems.push([World.obsHash, World.obsHash.insert({ x: cx, z: cz, r: 0.4 }, cx - 1, cz - 1, cx + 1, cz + 1)]);
}
let _ambGeo = null;
function makeAmbulance() {
  if (!_ambGeo) {
    const mb = new MB(true); const W = new THREE.Color('#f7f7f5'), R = new THREE.Color('#d42a24'), K = new THREE.Color('#1c1f22'), G = new THREE.Color('#2b3a47');
    const bx = (x0, x1, y0, y1, z0, z1, c) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); addGeoTo(mb, g, c); };
    bx(-1.05, 1.05, 0.55, 3.0, -3.3, 1.2, W);          // box body
    bx(-1.0, 1.0, 0.55, 2.2, 1.2, 3.2, W);             // cab
    bx(-0.98, 0.98, 1.45, 2.1, 2.4, 3.05, G);          // windshield area
    bx(-1.07, 1.07, 1.3, 1.6, -3.3, 1.2, R);           // red stripe
    bx(-0.9, 0.9, 3.0, 3.18, -1.0, 0.9, R);            // light bar
    for (const [x, z] of [[-0.95, 2.2], [0.95, 2.2], [-0.95, -2.3], [0.95, -2.3]]) { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14); g.rotateZ(Math.PI / 2); g.translate(x, 0.42, z); addGeoTo(mb, g, K); }
    _ambGeo = mb.geo(); _ambGeo.userData.shared = true;
  }
  const m = new THREE.Mesh(_ambGeo, MAT.amb || (MAT.amb = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }))); m.castShadow = true;
  const cross = new THREE.Group(); cross.add(m); return cross;
}

// ---------- grandstands: stepped seating facing the nearest field ----------
function buildGrandstand(B, T, P, seats, Z) {
  const ring = B.ring; const obb = minAreaRect(ring); if (!obb) return;
  const [cx, cz] = centroid(ring);
  let best = null, bd = 1e9; for (const a of P.areas) { if (a.kind !== 'pitch' && a.kind !== 'track' && a.kind !== 'court') continue; const c = centroid(a.rings[0]); const d = Math.hypot(c[0] - cx, c[1] - cz); if (d < bd) { bd = d; best = c; } }
  // rows run along the long side; the low front faces the field
  let ux = obb.ux, uz = obb.uz, vx = obb.vx, vz = obb.vz, L = obb.L, W = obb.W; if (W > L) { [ux, uz, vx, vz] = [vx, vz, ux, uz]; [L, W] = [W, L]; }
  let face = -1; if (best && ((best[0] - cx) * vx + (best[1] - cz) * vz) > 0) face = 1;
  const gy = H(cx, cz); const rows = Math.max(3, Math.min(40, Math.floor(W / 0.85))); const tread = W / rows, rise = 0.45;
  const purple = zoneAt(Z, 'campus', cx, cz) || zoneAt(Z, 'athletic', cx, cz) || /ECU|Clark|Dowdy|Minges/.test(B.tags.name || '');
  const SEAT = new THREE.Color(purple ? ECU_PURPLE : '#2e4a3a'), CON = new THREE.Color('#b9b3a8'), BACKC = SEAT.clone().multiplyScalar(0.72);
  const P3 = (u, v, y) => [obb.cx + u * ux + v * vx, y, obb.cz + u * uz + v * vz];
  const v0 = face * W / 2; // front edge (field side), rows climb toward -face
  for (let k = 0; k < rows; k++) {
    const va = v0 - face * k * tread, vb = v0 - face * (k + 1) * tread; const y0 = gy + 0.6 + k * rise, y1 = y0 + rise;
    seats.quad(P3(-L / 2, va, y0), P3(L / 2, va, y0), P3(L / 2, va, y1), P3(-L / 2, va, y1), [0, 0], [0, 0], [0, 0], [0, 0], [face * vx, 0, face * vz], k % 9 === 8 ? CON : BACKC);
    seats.quad(P3(-L / 2, va, y1), P3(L / 2, va, y1), P3(L / 2, vb, y1), P3(-L / 2, vb, y1), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], k % 9 === 8 ? CON : SEAT);
  }
  const top = gy + 0.6 + rows * rise, vBack = v0 - face * W;
  seats.quad(P3(-L / 2, vBack, gy - 0.3), P3(L / 2, vBack, gy - 0.3), P3(L / 2, vBack, top + 1.1), P3(-L / 2, vBack, top + 1.1), [0, 0], [0, 0], [0, 0], [0, 0], [-face * vx, 0, -face * vz], CON);
  seats.quad(P3(-L / 2, v0, gy - 0.3), P3(L / 2, v0, gy - 0.3), P3(L / 2, v0, gy + 0.6), P3(-L / 2, v0, gy + 0.6), [0, 0], [0, 0], [0, 0], [0, 0], [face * vx, 0, face * vz], CON);
  for (const s of [-1, 1]) seats.quad(P3(s * L / 2, v0, gy - 0.3), P3(s * L / 2, vBack, gy - 0.3), P3(s * L / 2, vBack, top + 1.1), P3(s * L / 2, v0, gy + 0.6), [0, 0], [0, 0], [0, 0], [0, 0], [s * ux, 0, s * uz], CON);
  if (L * W > 700) { // roof over the upper rows
    const vr = v0 - face * W * 0.35, rt = top + 3.2, RC = new THREE.Color('#d9d9d6');
    seats.quad(P3(-L / 2 - 0.5, vr, rt), P3(L / 2 + 0.5, vr, rt), P3(L / 2 + 0.5, vBack - face * 0.6, rt + 0.6), P3(-L / 2 - 0.5, vBack - face * 0.6, rt + 0.6), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], RC);
    seats.quad(P3(-L / 2 - 0.5, vr, rt - 0.02), P3(-L / 2 - 0.5, vBack - face * 0.6, rt + 0.58), P3(L / 2 + 0.5, vBack - face * 0.6, rt + 0.58), P3(L / 2 + 0.5, vr, rt - 0.02), [0, 0], [0, 0], [0, 0], [0, 0], [0, -1, 0], RC);
    for (let u = -L / 2; u <= L / 2 + 0.1; u += Math.max(8, L / 6)) { const [x, , z] = P3(u, vBack, 0); const cg = new THREE.CylinderGeometry(0.15, 0.15, rt + 0.6 - gy, 8); cg.translate(x, (rt + 0.6 + gy) / 2, z); addGeoTo(seats, cg, new THREE.Color('#9a9c9e')); }
  }
  const bb = ring.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
  T.hashItems.push([World.bldHash, World.bldHash.insert({ ring, holes: [], minY: -1e9, maxY: top + 1.1, name: B.tags.name || 'Grandstand', cx, cz, h: top - gy }, bb[0], bb[1], bb[2], bb[3])]);
}

// ---------- the football stadium bowl ----------
function buildStadiums(T, P, Z) {
  const W = T.W; const seats = new MB(true); let any = false;
  for (const st of Z.filter(q => q.kind === 'stadium' && q.football)) {
    const ring = st.a.rings[0]; if (!ring || ring.length < 3) continue;
    const [scx, scz] = centroid(ring); if (scx < W.x0 || scx >= W.x1 || scz < W.z0 || scz >= W.z1) continue;
    const pitch = P.areas.find(a => a.kind === 'pitch' && /american_football/.test(a.tags.sport || '') && pointInPoly(...centroid(a.rings[0]), ring)) || P.areas.find(a => a.kind === 'pitch' && pointInPoly(...centroid(a.rings[0]), ring));
    const ob = minAreaRect(pitch ? pitch.rings[0] : ring); if (!ob) continue; any = true;
    let ux = ob.ux, uz = ob.uz, vx = ob.vx, vz = ob.vz; if (ob.W > ob.L) { [ux, uz, vx, vz] = [vx, vz, ux, uz]; }
    const C = [ob.cx, ob.cz]; const gy = H(C[0], C[1]);
    const FL = 109.7, FW = 48.8; const A = FL / 2 + 8, Bh = FW / 2 + 10; // field + apron (inner edge of the stands)
    fieldMesh(T, C, ux, uz, vx, vz, gy, FL, FW);
    // ray-cast from the centre to the stadium outline for the depth of the stands
    const outDist = (dx, dz) => { let best = 1e9; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const ex = b[0] - a[0], ez = b[1] - a[1]; const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - C[0]) * ez - (a[1] - C[1]) * ex) / den, s = ((a[0] - C[0]) * dz - (a[1] - C[1]) * dx) / den; if (t > 0 && s >= 0 && s <= 1) best = Math.min(best, t); } return best; };
    const inDist = (cu, cv) => { // distance to the rounded-rectangle inner edge along direction (cu,cv) in field axes
      const r = 18, ax = A - r, bx = Bh - r; let lo = 0, hi = 400; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; const x = Math.abs(cu * m), y = Math.abs(cv * m); const dx = Math.max(0, x - ax), dy = Math.max(0, y - bx); if (Math.hypot(dx, dy) > r || (x > A) || (y > Bh)) hi = m; else lo = m; } return lo; };
    const N = 160, TREAD = 0.85, SEAT = new THREE.Color(ECU_PURPLE), SEAT2 = new THREE.Color('#5b2d8e'), GOLD = new THREE.Color(ECU_GOLD), CON = new THREE.Color('#bcb6ab'), WALL = new THREE.Color('#d6d0c4'), BACK = new THREE.Color('#3b1862');
    const prof = []; // per angle: inner r, rows
    for (let i = 0; i <= N; i++) {
      const th = i / N * Math.PI * 2; const cu = Math.cos(th), cv = Math.sin(th);
      const dx = cu * ux + cv * vx, dz = cu * uz + cv * vz; const rin = inDist(cu, cv); const rout = Math.min(outDist(dx, dz), rin + 48);
      let rows = Math.floor((rout - rin - 2) / TREAD); if (rows < 6) rows = 0; prof.push({ dx, dz, rin, rows: Math.min(rows, 52) });
    }
    // smooth row counts so the rim is continuous
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < N; i++) if (prof[i].rows) prof[i].rows = Math.round((prof[i - 1].rows + 2 * prof[i].rows + prof[i + 1].rows) / 4);
    const riseAt = k => k < 26 ? 0.44 : 0.56; const hAt = k => { let y = 0; for (let j = 0; j < k; j++) y += riseAt(j); return y; };
    const pt = (p, r, y) => [C[0] + p.dx * r, y, C[1] + p.dz * r];
    for (let i = 0; i < N; i++) {
      const p = prof[i], q = prof[i + 1]; const rows = Math.min(p.rows, q.rows); if (!rows) continue;
      const aisle = i % 8 === 0;
      for (let k = 0; k < rows; k++) {
        const y0 = gy + 1.4 + hAt(k), y1 = y0 + riseAt(k);
        const ra0 = p.rin + k * TREAD, ra1 = ra0 + TREAD, rb0 = q.rin + k * TREAD, rb1 = rb0 + TREAD;
        const col = aisle ? CON : k === 25 || k === 26 ? CON : (Math.floor(i / 4) + k) % 7 === 0 ? SEAT2 : SEAT;
        seats.quad(pt(p, ra0, y0), pt(q, rb0, y0), pt(q, rb0, y1), pt(p, ra0, y1), [0, 0], [0, 0], [0, 0], [0, 0], [-(p.dx + q.dx) / 2, 0, -(p.dz + q.dz) / 2], col === CON ? CON : BACK); // seat backs face the field
        seats.quad(pt(p, ra0, y1), pt(q, rb0, y1), pt(q, rb1, y1), pt(p, ra1, y1), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], col);
      }
      const top = gy + 1.4 + hAt(rows) + 1.2, ra = p.rin + rows * TREAD, rb = q.rin + rows * TREAD;
      seats.quad(pt(p, ra, gy - 0.5), pt(q, rb, gy - 0.5), pt(q, rb, top), pt(p, ra, top), [0, 0], [0, 0], [0, 0], [0, 0], [(p.dx + q.dx) / 2, 0, (p.dz + q.dz) / 2], WALL); // exterior wall
      seats.quad(pt(p, ra, top - 2.4), pt(q, rb, top - 2.4), pt(q, rb, top - 1.6), pt(p, ra, top - 1.6), [0, 0], [0, 0], [0, 0], [0, 0], [(p.dx + q.dx) / 2, 0, (p.dz + q.dz) / 2], GOLD); // gold band
      seats.quad(pt(p, p.rin, gy), pt(q, q.rin, gy), pt(q, q.rin, gy + 1.4), pt(p, p.rin, gy + 1.4), [0, 0], [0, 0], [0, 0], [0, 0], [-(p.dx + q.dx) / 2, 0, -(p.dz + q.dz) / 2], new THREE.Color(ECU_PURPLE)); // field wall
    }
    // suite tower on the deeper sideline
    const side = (s) => prof.filter((p, i) => Math.abs(Math.sin(i / N * Math.PI * 2) - s) < 0.15).reduce((m, p) => m + p.rows, 0);
    const sgn = side(1) >= side(-1) ? 1 : -1; const iMid = sgn > 0 ? N / 4 : 3 * N / 4; const pm = prof[iMid];
    if (pm.rows > 10) {
      const r = pm.rin + pm.rows * TREAD + 7, top = gy + 1.4 + hAt(pm.rows) + 14;
      const tx = C[0] + pm.dx * r, tz = C[1] + pm.dz * r; const L = 105, D = 13;
      const tower = new MB(true); const P3 = (u, v, y) => [tx + u * ux + v * pm.dx, y, tz + u * uz + v * pm.dz];
      const facesT = [[[-L / 2, -D / 2], [L / 2, -D / 2]], [[L / 2, -D / 2], [L / 2, D / 2]], [[L / 2, D / 2], [-L / 2, D / 2]], [[-L / 2, D / 2], [-L / 2, -D / 2]]];
      for (const [[u0, v0], [u1, v1]] of facesT) { const len = Math.hypot(u1 - u0, v1 - v0); const nu = (v1 - v0) / len, nv = -(u1 - u0) / len; tower.quad(P3(u0, v0, gy), P3(u1, v1, gy), P3(u1, v1, top), P3(u0, v0, top), [0, 0], [len / 6.4, 0], [len / 6.4, (top - gy) / 16.8], [0, (top - gy) / 16.8], [nu * ux + nv * pm.dx, 0, nu * uz + nv * pm.dz], new THREE.Color('#ffffff')); }
      const tm = new THREE.Mesh(tower.geo(), MAT.facade.medglass); tm.castShadow = true; T.group.add(tm);
      const cap = new MB(true); const q4 = [P3(-L / 2, -D / 2, top), P3(L / 2, -D / 2, top), P3(L / 2, D / 2, top), P3(-L / 2, D / 2, top)]; cap.quad(...q4, [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], new THREE.Color('#cfcfca'));
      for (const [[u0, v0], [u1, v1]] of facesT) cap.quad(P3(u0, v0, top - 2.6), P3(u1, v1, top - 2.6), P3(u1, v1, top - 1.4), P3(u0, v0, top - 1.4), [0, 0], [0, 0], [0, 0], [0, 0], [((v1 - v0)) * ux / 50 + ((u0 - u1)) * pm.dx / 50, 0, (v1 - v0) * uz / 50 + (u0 - u1) * pm.dz / 50], new THREE.Color(ECU_PURPLE));
      addMB(T, cap, lmPlainMat());
      const sign = signMesh(T, textTexture([['EAST CAROLINA', 170, ECU_GOLD, 128]], { w: 1024, h: 256 }), 60, 15, false);
      sign.position.set(tx - pm.dx * (D / 2 + 0.05), top - 7, tz - pm.dz * (D / 2 + 0.05)); sign.rotation.y = Math.atan2(-pm.dx, -pm.dz); T.group.add(sign);
      const bb = [[-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, D / 2], [-L / 2, D / 2]].map(([u, v]) => [tx + u * ux + v * pm.dx, tz + u * uz + v * pm.dz]);
      const b4 = bb.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
      T.hashItems.push([World.bldHash, World.bldHash.insert({ ring: bb, holes: [], minY: -1e9, maxY: top, name: 'Dowdy-Ficklen Stadium', cx: tx, cz: tz, h: top - gy }, ...b4)]);
    }
    // scoreboard at the shallower end
    const endRows = s => prof[s > 0 ? 0 : N / 2].rows; const endS = endRows(1) <= endRows(-1) ? 1 : -1; const pe = prof[endS > 0 ? 0 : N / 2];
    { const r = pe.rin + pe.rows * TREAD + 6, x = C[0] + pe.dx * r, z = C[1] + pe.dz * r; const g = new THREE.Group();
      const scr = signMesh(T, textTexture([['EAST CAROLINA', 110, ECU_GOLD, 60], ['ECU  0   ·   VISITOR  0', 96, '#ffffff', 150], ['QTR 1   15:00', 70, '#f2c230', 222]], { w: 1024, h: 256, bg: '#101014' }), 30, 7.5, true);
      scr.position.y = 22; g.add(scr);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(32, 9.5, 1.2), MAT.scoreFrame || (MAT.scoreFrame = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }))); frame.position.set(0, 22, -0.7); g.add(frame);
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), MAT.lampPole); post.position.set(s * 10, 11, -0.8); g.add(post); }
      g.position.set(x, H(x, z), z); g.rotation.y = Math.atan2(-pe.dx, -pe.dz); T.group.add(g); }
    // light towers
    for (const a of [0.7, Math.PI - 0.7, Math.PI + 0.7, -0.7]) {
      const cu = Math.cos(a), cv = Math.sin(a); const dx = cu * ux + cv * vx, dz = cu * uz + cv * vz; const r = inDist(cu, cv) + 52;
      const x = C[0] + dx * r, z = C[1] + dz * r; const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 48, 10), MAT.lampPole); pole.position.y = 24; g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 0.8), MAT.lampHead); head.position.set(0, 48, 0.6); head.rotation.x = -0.25; g.add(head);
      g.position.set(x, H(x, z), z); g.rotation.y = Math.atan2(-dx, -dz); T.group.add(g);
    }
    // goal posts
    for (const s of [-1, 1]) {
      const gx = C[0] + ux * s * (FL / 2 + 0.3), gz = C[1] + uz * s * (FL / 2 + 0.3); const g = new THREE.Group(); const Y = MAT.goalPost || (MAT.goalPost = new THREE.MeshStandardMaterial({ color: 0xf2d230, roughness: 0.4, metalness: 0.3 }));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.05, 8), Y); base.position.y = 1.52; g.add(base);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.64, 8), Y); bar.rotation.z = Math.PI / 2; bar.position.y = 3.05; g.add(bar);
      for (const t of [-1, 1]) { const up = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 8), Y); up.position.set(t * 2.82, 3.05 + 4.5, 0); g.add(up); }
      g.position.set(gx, gy + 0.05, gz); g.rotation.y = Math.atan2(vx, vz); T.group.add(g);
    }
  }
  if (any) addMB(T, seats, standsMat());
}
function lmPlainMat() { return MAT.lmPlain || (MAT.lmPlain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); }
function standsMat() { return MAT.stands || (MAT.stands = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); }
function addMB(T, mb, mat) { const g = mb.geo(); if (!g) return; const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; T.group.add(m); }
function fieldMesh(T, C, ux, uz, vx, vz, gy, FL, FW) {
  const c = cnv(2048, 1024), g = c.getContext('2d'); const sx = 2048 / (FL + 12), sy = 1024 / (FW + 12); const X = m => (m + 6) * sx, Y = m => (m + 6) * sy;
  for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? '#3f7d33' : '#468a38'; g.fillRect(X(-6 + k * 4.57), 0, 4.57 * sx + 1, 1024); }
  for (const s of [0, 1]) { g.fillStyle = ECU_PURPLE; g.fillRect(X(s ? FL - 9.14 : 0), Y(0), 9.14 * sx, FW * sy); g.save(); g.translate(X(s ? FL - 4.57 : 4.57), Y(FW / 2)); g.rotate(s ? Math.PI / 2 : -Math.PI / 2); g.fillStyle = ECU_GOLD; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 110px "Arial Narrow", Arial, sans-serif'; g.fillText(s ? 'PIRATES' : 'EAST CAROLINA', 0, 0, FW * sy * 0.92); g.restore(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.2 * sx; g.strokeRect(X(0), Y(0), FL * sx, FW * sy);
  for (let yd = 0; yd <= 100; yd += 5) { const x = X(9.14 + yd * 0.9144); g.lineWidth = yd % 10 ? 0.12 * sx : 0.16 * sx; g.beginPath(); g.moveTo(x, Y(0)); g.lineTo(x, Y(FW)); g.stroke();
  }
  for (let yd = 1; yd < 100; yd++) { if (yd % 5 === 0) continue; const x = X(9.14 + yd * 0.9144); for (const y of [0.6, FW - 0.6, FW / 2 - 2.8, FW / 2 + 2.8]) { g.beginPath(); g.moveTo(x, Y(y - 0.3)); g.lineTo(x, Y(y + 0.3)); g.stroke(); } }
  g.fillStyle = '#ffffff'; g.font = `700 ${1.8 * sy | 0}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let yd = 10; yd <= 90; yd += 10) { const n = String(yd > 50 ? 100 - yd : yd); const x = X(9.14 + yd * 0.9144); for (const [y, rot] of [[FW - 8.2, 0], [8.2, Math.PI]]) { g.save(); g.translate(x, Y(y)); g.rotate(rot); g.fillText(n.split('').join(' '), 0, 0); g.restore(); } }
  g.fillStyle = ECU_GOLD; g.beginPath(); g.arc(X(FL / 2), Y(FW / 2), 4.5 * sx, 0, 7); g.fill(); g.fillStyle = ECU_PURPLE; g.font = `800 ${3.6 * sy | 0}px "Arial Narrow", Arial, sans-serif`; g.fillText('ECU', X(FL / 2), Y(FW / 2) + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }); (T.lmMats || (T.lmMats = [])).push(m);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FL + 12, FW + 12), m); mesh.rotation.order = 'YXZ'; mesh.rotation.y = Math.atan2(ux, uz) - Math.PI / 2; mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(C[0], gy + 0.08, C[1]); mesh.receiveShadow = true; T.group.add(mesh);
}

// ---------- ground paint: baseball / softball diamonds, brick campus walks ----------
function paintDiamonds(g, P, Z) {
  for (const a of P.areas) {
    if (a.kind !== 'pitch' || !/baseball|softball/.test(a.tags.sport || '')) continue;
    const ring = a.rings[0]; if (!ring || ring.length < 4) continue; const soft = /softball/.test(a.tags.sport);
    const c = centroid(ring); let home = null, bs = -1;
    for (let i = 0; i < ring.length; i++) { const p = ring[i], pr = ring[(i + ring.length - 1) % ring.length], nx = ring[(i + 1) % ring.length]; const a1 = Math.atan2(pr[1] - p[1], pr[0] - p[0]), a2 = Math.atan2(nx[1] - p[1], nx[0] - p[0]); let ang = Math.abs(a1 - a2); if (ang > Math.PI) ang = 2 * Math.PI - ang; const l = Math.hypot(pr[0] - p[0], pr[1] - p[1]) + Math.hypot(nx[0] - p[0], nx[1] - p[1]); const s = l * (ang > 1.1 && ang < 2.0 ? 1 : 0.15); if (s > bs) { bs = s; home = p; } }
    if (!home) continue; let dx = c[0] - home[0], dz = c[1] - home[1]; const dl = Math.hypot(dx, dz); if (dl < 10) continue; dx /= dl; dz /= dl;
    const base = soft ? 18.3 : 27.4, mound = soft ? 13.1 : 18.4, arc = soft ? 18.3 : 29;
    const R = (fx, fz) => [home[0] + dx * fz - dz * fx, home[1] + dz * fz + dx * fx]; // fx: toward 1B side, fz: toward CF
    const d = base / Math.SQRT2; const H1 = R(d, d), H2 = R(0, 2 * d), H3 = R(-d, d);
    g.save(); ringsPath(g, [ring]); g.clip();
    g.fillStyle = '#b98a5c'; g.beginPath(); const m = R(0, mound); g.moveTo(home[0], home[1]);
    const ang0 = Math.atan2(dz, dx); for (let k = -45; k <= 45; k += 3) { const t = ang0 + k * Math.PI / 180; g.lineTo(m[0] + Math.cos(t) * arc, m[1] + Math.sin(t) * arc); } g.closePath(); g.fill();
    g.fillStyle = '#4f8a3a'; const ins = 1.4; g.beginPath(); const A = R(0, ins * 1.6), Bp = R(d - ins, d), Cp = R(0, 2 * d - ins * 1.6), Dp = R(-(d - ins), d); g.moveTo(A[0], A[1]); g.lineTo(Bp[0], Bp[1]); g.lineTo(Cp[0], Cp[1]); g.lineTo(Dp[0], Dp[1]); g.closePath(); g.fill();
    g.fillStyle = '#b98a5c'; g.beginPath(); g.arc(m[0], m[1], soft ? 2.4 : 2.9, 0, 7); g.fill(); g.beginPath(); g.arc(home[0], home[1], 4, 0, 7); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.35; for (const s of [1, -1]) { const e = R(s * 110, 110); g.beginPath(); g.moveTo(home[0], home[1]); g.lineTo(e[0], e[1]); g.stroke(); }
    g.fillStyle = '#ffffff'; for (const b of [H1, H2, H3, home]) g.fillRect(b[0] - 0.4, b[1] - 0.4, 0.8, 0.8);
    g.restore();
  }
}

// campus walks are brick; sports fields get their markings
function paintLandmarkGround(g, P) {
  const Z = P.zones || (P.zones = landmarkZones(P));
  if (Z.some(q => q.kind === 'campus' || q.kind === 'athletic' || q.kind === 'medcampus')) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rd of P.roads) {
      const hw = rd.tags.highway; if (!/^(footway|pedestrian|path|cycleway)$/.test(hw) || rd.pts.length < 2) continue;
      if (/dirt|ground|gravel|unpaved|grass/.test(rd.tags.surface || '')) continue;
      const m = rd.pts[rd.pts.length >> 1]; if (!(zoneAt(Z, 'campus', m[0], m[1]) || zoneAt(Z, 'athletic', m[0], m[1]) || zoneAt(Z, 'medcampus', m[0], m[1]))) continue;
      const w = hw === 'pedestrian' ? 5 : 2.6;
      linePath(g, rd.pts); g.strokeStyle = '#c9c2b4'; g.lineWidth = w + 0.5; g.stroke();   // concrete edging
      linePath(g, rd.pts); g.strokeStyle = '#a3715f'; g.lineWidth = w; g.stroke();         // red brick
    }
  }
  paintDiamonds(g, P, Z);
}
