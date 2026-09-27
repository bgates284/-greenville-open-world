
// =====================================================================
// NEIGHBORHOODS FROM PARCELS — run for each map square after the roads are known:
//   • every OpenStreetMap building is matched to its tax parcel; houses take their era, size and
//     storeys from the county record (brick ranches from the 1950s–70s, older frame houses with
//     clapboard, newer two-storey vinyl, duplexes, garden apartments, townhouse rows…)
//   • parcels the county lists with a structure but that have no building on the map get one,
//     sized from the recorded building value, set back from the street the lot faces, with a
//     driveway and a mailbox at the curb
//   • lawns are drawn inside residential lots; the HUD shows the address and subdivision
// =====================================================================
function applyParcels(T, P, data) {
  T.driveways = []; T.mailboxes = []; T.lawns = [];
  if (!data || !data.rows || !data.rows.length) return 0;
  const W = T.W; const local = new SpatialHash(30); const list = [];
  const seen = new Set();
  for (const r of data.rows) {
    const [parno, desc, year, nstruct, improv, acres, addr, sub, flat] = r;
    const ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([lonToX(flat[i + 1]), latToZ(flat[i])]);
    if (ring.length < 3) continue;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const p of ring) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
    const [cx, cz] = centroid(ring); const area = Math.abs(signedArea(ring));
    const dupKey = Math.round(cx) + ',' + Math.round(cz) + ',' + Math.round(area); // stacked condo units share one outline
    const p = { parno, cls: parcelClass(desc), year, nstruct, improv, acres, addr: titleCase(addr), sub: titleCase(sub), ring, bb: [x0, z0, x1, z1], cx, cz, area, bld: 0, dup: seen.has(dupKey) };
    seen.add(dupKey);
    const own = cx >= W.x0 && cx < W.x1 && cz >= W.z0 && cz < W.z1; p.own = own;
    local.insert(p, x0, z0, x1, z1); list.push(p);
    if (own) T.hashItems.push([Parcels.hash, Parcels.hash.insert({ ring, addr: p.addr, sub: p.sub, cls: p.cls, year }, x0, z0, x1, z1)]);
  }
  const parcelAt = (x, z) => { let best = null; for (const p of local.query(x, z, x, z)) if (pointInPoly(x, z, p.ring) && (!best || p.area < best.area)) best = p; return best; };

  // ---- 1) give mapped buildings their county record ----
  const bl = new SpatialHash(30);
  for (const B of P.buildings) {
    if (B.part || B.ring.length < 3) continue;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const q of B.ring) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); }
    bl.insert(B, x0, z0, x1, z1);
    const [bx, bz] = centroid(B.ring); const p = parcelAt(bx, bz); if (!p) continue;
    if (Math.abs(signedArea(B.ring)) >= 40) p.bld++; B.parcel = p; styleFromParcel(B, p);
  }
  const hitsBuilding = (x, z) => { for (const B of bl.query(x, z, x, z)) if (pointInPoly(x, z, B.ring)) return true; return insideBuilding(x, z); };

  // ---- 2) build what the county lists but the map is missing ----
  let added = 0;
  for (const p of list) {
    if (!p.own || p.dup || p.bld > 0 || !(p.nstruct > 0 || p.improv > 8000) || !p.cls) continue;
    if (p.cls === 'inst' || p.area < 45 || p.area > 60000) continue;
    const B = synthBuilding(p); if (!B) continue;
    P.buildings.push(B); bl.insert(B, ...ringBB(B.ring)); p.bld++; added++;
  }
  // residential lots: lawns (painted in paintTerrain)
  for (const p of list) if (p.own && /sfr|split|patio|duplex|mh/.test(p.cls) && p.area < 8000) T.lawns.push(p.ring);
  return added;

  function synthBuilding(p) {
    const rd = nearestRoad(p.cx, p.cz, 140, r => r.car); if (!rd) return null;
    let fx = rd.x - p.cx, fz = rd.z - p.cz; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl; const ux = -fz, uz = fx;
    let front = -1e9, back = 1e9, left = 1e9, right = -1e9;
    for (const q of p.ring) { const a = (q[0] - p.cx) * fx + (q[1] - p.cz) * fz, b = (q[0] - p.cx) * ux + (q[1] - p.cz) * uz; front = Math.max(front, a); back = Math.min(back, a); left = Math.min(left, b); right = Math.max(right, b); }
    const depthLot = front - back, widthLot = right - left; const rng = mulberry32(hashStr(p.parno));
    // footprint area (m²) from the recorded building value and use
    let area, w, d, tags = {};
    const houseArea = clamp(70 + p.improv / 1250, 75, 340);
    switch (p.cls) {
      case 'sfr': case 'split': case 'patio': area = p.cls === 'patio' ? clamp(houseArea * 0.8, 70, 170) : houseArea; w = Math.sqrt(area * 1.45); d = area / w; tags.building = 'house'; break;
      case 'duplex': area = clamp(150 + p.improv / 2500, 150, 320); w = Math.sqrt(area * 1.6); d = area / w; tags.building = 'semidetached_house'; break;
      case 'town': area = clamp(p.area * 0.42, 45, 140); w = Math.min(widthLot * 0.96, 9); d = area / w; tags.building = 'terrace'; break;
      case 'mh': w = 5 + (p.improv > 45000 ? 3.6 : 0); d = 20; area = w * d; tags.building = 'static_caravan'; break;
      case 'apt': case 'tower': area = clamp(p.area * 0.22, 250, 1600); w = Math.min(Math.sqrt(area * 3.2), widthLot * 0.8); d = area / w; tags.building = 'apartments'; break;
      case 'church': area = clamp(p.area * 0.2, 200, 1200); w = Math.sqrt(area * 0.7); d = area / w; tags.building = 'church'; break;
      case 'office': area = clamp(p.area * 0.25, 150, 2500); w = Math.sqrt(area * 1.6); d = area / w; tags.building = 'office'; break;
      case 'whse': area = clamp(p.area * 0.35, 200, 8000); w = Math.sqrt(area * 1.3); d = area / w; tags.building = 'warehouse'; break;
      default: area = clamp(p.area * 0.3, 150, 3000); w = Math.sqrt(area * 1.8); d = area / w; tags.building = 'commercial';
    }
    w = Math.min(w, widthLot * 0.86); d = Math.min(d, depthLot * 0.8); if (w < 3.5 || d < 3.5) return null;
    // set back from the street, centred on the lot
    const setback = p.cls === 'town' ? 4 : p.cls === 'mh' ? 6 : /sfr|split|patio|duplex/.test(p.cls) ? clamp(depthLot * 0.22, 6, 14) : clamp(depthLot * 0.2, 6, 22);
    for (let tries = 0; tries < 5; tries++) {
      const along = front - setback - d / 2 - tries * 2, lat = (left + right) / 2;
      const cx = p.cx + fx * along + ux * lat, cz = p.cz + fz * along + uz * lat;
      const ring = [[cx - ux * w / 2 + fx * d / 2, cz - uz * w / 2 + fz * d / 2], [cx + ux * w / 2 + fx * d / 2, cz + uz * w / 2 + fz * d / 2], [cx + ux * w / 2 - fx * d / 2, cz + uz * w / 2 - fz * d / 2], [cx - ux * w / 2 - fx * d / 2, cz - uz * w / 2 - fz * d / 2]];
      const probes = ring.concat([[cx, cz]]);
      if (!probes.every(q => pointInPoly(q[0], q[1], p.ring))) { if (tries === 4) return null; w *= 0.9; d *= 0.9; continue; }
      if (probes.some(q => hitsBuilding(q[0], q[1]) || onRoadSurface(q[0], q[1]))) return null;
      const B = { id: 800000000 + (hashStr(p.parno) % 100000000), tags, ring, holes: [], part: false, synth: true, parcel: p };
      styleFromParcel(B, p, rng);
      // driveway to the street + mailbox at the curb (houses, duplexes, mobile homes, townhouses)
      if (/sfr|split|patio|duplex|mh|town/.test(p.cls) && rd.d < 70) {
        const side = rng() < 0.5 ? -1 : 1; const off = side * Math.max(0, w / 2 - 1.6);
        const s0 = [cx + ux * off + fx * d / 2, cz + uz * off + fz * d / 2];
        const rr = nearestRoad(s0[0], s0[1], 90, r => r.car);
        if (rr) { const hw = rr.road.w / 2; const dx = rr.x - s0[0], dz = rr.z - s0[1], dl = Math.hypot(dx, dz) || 1; T.driveways.push([s0, [rr.x - dx / dl * (hw - 0.3), rr.z - dz / dl * (hw - 0.3)]]);
          if (p.cls !== 'town') T.mailboxes.push([rr.x - dx / dl * (hw + 0.9) + (-dz / dl) * 1.3 * side, rr.z - dz / dl * (hw + 0.9) + (dx / dl) * 1.3 * side, Math.atan2(dx, dz)]); }
      }
      return B;
    }
    return null;
  }
}
function ringBB(r) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const q of r) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[1]); } return [x0, z0, x1, z1]; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < (s || '').length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function titleCase(s) { return (s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Nc|Us|Sr)\b/g, m => m.toUpperCase()).trim(); }
// era-appropriate materials, storeys and roofs for Greenville houses (only where OSM gives no detail)
function styleFromParcel(B, p, rng) {
  const t = B.tags; rng = rng || mulberry32(hashStr(p.parno) ^ (B.id | 0));
  const y = p.year || 0; const r1 = rng(), r2 = rng(), r3 = rng();
  const res = /sfr|split|patio|duplex|town|mh/.test(p.cls); if (!res && !/apt|tower|church/.test(p.cls)) return;
  if (!/^(yes|house|residential|detached|semidetached_house|bungalow|terrace|apartments|duplex|static_caravan|church)$/.test(t.building || 'yes') || Math.abs(signedArea(B.ring)) < 35) return; // leave sheds, garages etc. alone
  if (t.building === 'yes' || !t.building) t.building = p.cls === 'apt' || p.cls === 'tower' ? 'apartments' : p.cls === 'church' ? 'church' : p.cls === 'town' ? 'terrace' : p.cls === 'duplex' ? 'semidetached_house' : 'house';
  const area = Math.abs(signedArea(B.ring));
  if (!t['building:material']) {
    let brick;
    if (p.cls === 'mh') brick = 0;
    else if (y && y < 1945) brick = 0.25;        // early 20th-c. frame houses (clapboard)
    else if (y && y < 1980) brick = 0.78;        // post-war brick ranches
    else if (y && y < 2000) brick = 0.45;
    else brick = 0.22;                           // newer vinyl-sided houses
    if (p.cls === 'apt' || p.cls === 'tower') brick = 0.6; if (p.cls === 'church') brick = 0.85;
    t['building:material'] = r1 < brick ? 'brick' : 'vinyl';
  }
  if (!t['building:levels'] && !t.height && p.cls !== 'church') {
    let lv = 1;
    if (p.cls === 'tower') lv = 6; else if (p.cls === 'apt') lv = r2 < 0.65 ? 3 : 2;
    else if (p.cls === 'town') lv = 2;
    else if (p.cls === 'mh') lv = 1;
    else if (p.cls === 'split') lv = 2;
    else { const two = (y >= 1985 ? 0.5 : y >= 1960 ? 0.12 : 0.35) + (p.improv > 220000 ? 0.3 : 0) - (area > 220 ? 0.2 : 0); lv = r2 < two ? 2 : 1; }
    t['building:levels'] = String(lv);
  }
  if (!t['roof:shape'] && p.cls !== 'apt' && p.cls !== 'tower' && p.cls !== 'church') t['roof:shape'] = p.cls === 'mh' ? 'gabled' : (y >= 1950 && y < 1985 ? (r3 < 0.6 ? 'hipped' : 'gabled') : (r3 < 0.3 ? 'hipped' : 'gabled'));
  if (p.cls === 'mh') t['roof:angle'] = '12';
}
// mailboxes at the curb (one merged mesh per map square)
function buildMailboxes(T) {
  if (!T.mailboxes || !T.mailboxes.length) return;
  const mb = new MB(true); const post = new THREE.Color('#e6e2d8'), box = new THREE.Color('#2a2c2f');
  const q = (cx, cz, a, hx, hz, y0, y1, col) => { const c = Math.cos(a), s = Math.sin(a); const P4 = (u, v) => [cx + u * c + v * s, cz - u * s + v * c]; const k = [P4(-hx, -hz), P4(hx, -hz), P4(hx, hz), P4(-hx, hz)];
    for (let i = 0; i < 4; i++) { const A = k[i], B = k[(i + 1) % 4]; const nx = (A[0] + B[0]) / 2 - cx, nz = (A[1] + B[1]) / 2 - cz; mb.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [0, 0], [0, 0], [0, 0], [0, 0], [nx, 0, nz], col); }
    mb.quad([k[0][0], y1, k[0][1]], [k[1][0], y1, k[1][1]], [k[2][0], y1, k[2][1]], [k[3][0], y1, k[3][1]], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], col); };
  for (const [x, z, a] of T.mailboxes) { if (insideBuilding(x, z) || onRoadSurface(x, z)) continue; const g = H(x, z); q(x, z, a, 0.05, 0.05, g - 0.1, g + 1.0, post); q(x, z, a, 0.12, 0.26, g + 1.0, g + 1.26, box); }
  const geo = mb.geo(); if (!geo) return; if (!MAT.mailbox) MAT.mailbox = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  const m = new THREE.Mesh(geo, MAT.mailbox); m.castShadow = true; T.group.add(m);
}
