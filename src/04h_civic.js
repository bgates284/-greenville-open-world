// =====================================================================
// FIRE, RESCUE & POLICE STATIONS — and a few civic buildings
//   Every fire station, rescue squad / EMS base and police department in and around Pitt County
//   (OpenStreetMap, Sep 2026) is dressed on its real building:
//     • fire stations: apparatus bays with red-framed roll-up doors facing the street, a concrete
//       apron, an engine nosing out of an open bay, a heavy-rescue truck, lettering over the doors
//     • rescue squads / EMS: bays and ambulances; Fire/Rescue stations get an ambulance too
//     • police: a blue sign band and entrance canopy, cruisers parked alongside, a flagpole
//   Winterville's Fire-Rescue-EMS and Police share the town's public-safety building on
//   Railroad Street, so that one building gets both.
//   A station mapped only as a point with no building gets a new brick station facing the road.
//   Civic buildings (town halls, libraries, post offices, museums) get their name on the front,
//   and Pitt Community College gets its entrance sign.
// Row: [name, what (f = fire, e = EMS/ambulance, r = rescue, p = police), lat, lon, osm ref]
// =====================================================================
const EMERGENCY = [
  ['Winterville Fire Station', 'fer', 35.528495, -77.401632, 'n367908484'], ['Winterville Police Department', 'p', 35.528289, -77.401736, 'n6237016700'],
  ['Greenville Fire/Rescue Station 1', 'fe', 35.611398, -77.375778, 'n2591109482'], ['Greenville Police Station', 'p', 35.611011, -77.375585, 'n2591109483'],
  ['Greenville Fire/Rescue Station 2', 'fe', 35.602262, -77.410141, 'n5521373073'], ['Greenville Fire/Rescue Station 3', 'fe', 35.583074, -77.361344, 'w1142990788'],
  ['Greenville Fire/Rescue Station 4', 'fe', 35.651437, -77.362501, 'w915224161'], ['Greenville Fire/Rescue Station 5', 'fe', 35.572959, -77.407212, 'n5521373074'],
  ['Greenville Fire/Rescue Station 6', 'fe', 35.598228, -77.326115, 'w269097673'], ['Greenville Police Department', 'p', 35.609771, -77.386238, 'n367910006'],
  ['Pitt County Sheriff\'s Office', 'p', 35.61323, -77.37261, 'n367909941'], ['Pitt County Sheriff\'s Office', 'p', 35.613187, -77.393403, 'n367910150'],
  ['Pitt County Sheriff\'s Department', 'p', 35.615123, -77.372338, 'w379617534'], ['East Carolina University Police', 'p', 35.605347, -77.368113, 'w253127018'],
  ['ECU University Police', 'p', 35.61099, -77.405862, 'n8416736299'], ['Pitt Community College Police', 'p', 35.549785, -77.407672, 'w697343041'],
  ['NC State Highway Patrol Troop A', 'p', 35.603438, -77.340461, 'w631685373'], ['NC State Bureau of Investigation', 'p', 35.583495, -77.360748, 'n367910599'],
  ['NC Alcohol Law Enforcement', 'p', 35.614191, -77.370893, 'n367910972'], ['Pitt-Greenville Airport Fire Department', 'f', 35.6329, -77.381532, 'w631729125'],
  ['Staton House Fire & Rescue', 'fr', 35.654738, -77.36574, 'w1037179960'], ['Eastern Pines EMS', 'e', 35.554199, -77.299109, 'w369541206'],
  ['Ayden Fire Department', 'f', 35.472342, -77.416624, 'w667848590'], ['Ayden Police Department', 'p', 35.471226, -77.41679, 'w667848591'],
  ['Farmville Fire Department', 'f', 35.597636, -77.584668, 'n9668390132'], ['Farmville Police Department', 'p', 35.599217, -77.584626, 'n367909701'],
  ['Farmville Rescue & EMS', 'er', 35.602848, -77.591213, 'n10255676597'], ['Bethel Police Department', 'p', 35.80942, -77.3746, 'n367909764'],
  ['Grifton Volunteer Fire Department', 'f', 35.374798, -77.439027, 'n6274741807'], ['Grifton Police Department', 'p', 35.374689, -77.439069, 'n367909889'],
  ['Grifton Rescue Squad', 'er', 35.372865, -77.435342, 'n6274741808'], ['Fountain Fire Department', 'f', 35.672144, -77.640895, 'n367908618'],
  ['Fountain Police Department', 'p', 35.673388, -77.64209, 'n367910518'], ['Falkland Fire Department', 'f', 35.699412, -77.516863, 'w695669678'],
  ['Falkland Rescue Squad', 'er', 35.697111, -77.511687, 'w695813127'], ['Grimesland Fire Department', 'f', 35.562067, -77.191658, 'n367908471'],
  ['Bell Arthur Fire Department', 'f', 35.591262, -77.513131, 'w881461956'], ['Belvoir Fire Department', 'f', 35.708551, -77.466714, 'n7334911776'],
  ['Pactolus Fire/Rescue Department', 'fr', 35.622773, -77.229545, 'n10271609658'], ['Scuffleton Fire Department', 'f', 35.458663, -77.506378, 'w319186343'],
  ['Gardnerville Volunteer Fire Department', 'f', 35.391538, -77.304392, 'n10683688760'], ['Sharp Point Volunteer Fire Department', 'f', 35.717344, -77.583146, 'n10253572601'],
  ['Maury Volunteer Fire & Rescue', 'fr', 35.481424, -77.58145, 'n9812819764'], ['Castoria Fire Department', 'f', 35.535631, -77.675603, 'n9823829645'],
  ['Hookerton Volunteer Fire Department', 'f', 35.424251, -77.586517, 'n7159882043'], ['Walstonburg Rural Fire Department', 'f', 35.599701, -77.697553, 'w926018587'],
  ['Clarks Neck Volunteer Fire Department', 'f', 35.605469, -77.118306, 'w301467831'], ['Chocowinity Fire and EMS', 'fe', 35.508691, -77.093155, 'w640430374'],
  ['Pinetops Fire & Rescue', 'fr', 35.790313, -77.638687, 'w515317548'], ['Pinetops Police Department', 'p', 35.791337, -77.637376, 'w515317549'],
  ['Robersonville Fire Department', 'f', 35.82279, -77.253435, 'n10262448106'], ['Washington Fire Station 1', 'f', 35.546477, -77.052546, 'n2568021519'],
];
// civic buildings that OpenStreetMap doesn't tag (the town hall node sits on the public-safety building)
const CIVIC_BUILDINGS = { 1144052962: 'WINTERVILLE TOWN HALL' };
// what the lettering says (the department's own name where OSM's differs)
function stationTitle(name) {
  if (/^Winterville Fire/.test(name)) return 'WINTERVILLE FIRE-RESCUE-EMS';
  if (/^Winterville Police/.test(name)) return 'WINTERVILLE POLICE';
  return name.toUpperCase().replace(/\bVOLUNTEER FIRE DEPARTMENT\b/, 'VOL. FIRE DEPT.').replace(/\bDEPARTMENT\b/, 'DEPT.').replace(/'/g, '’');
}
const Civic = {
  list: EMERGENCY.map(([name, what, lat, lon, ref]) => ({ name, fire: what.includes('f'), ems: what.includes('e'), rescue: what.includes('r'), police: what.includes('p'), lat, lon, ref, x: lonToX(lon), z: latToZ(lat) })),
  inBox(x0, z0, x1, z1) { return this.list.filter(s => s.x >= x0 && s.x < x1 && s.z >= z0 && s.z < z1); },
};

// ---- before the buildings are built: find each station's building (or add one) ----
function prepCivic(T, P) {
  const W = T.W; const here = Civic.inBox(W.x0, W.z0, W.x1, W.z1); if (!here.length) return;
  const cand = P.buildings.filter(B => !B.part && B.ring.length >= 3);
  for (const s of here) {
    let host = null;
    if (s.ref[0] === 'w') host = cand.find(B => 'w' + B.id === s.ref) || null;
    if (!host) { let best = 1e12; for (const B of cand) if (pointInPoly(s.x, s.z, B.ring)) { const a = Math.abs(signedArea(B.ring)); if (a < best) { best = a; host = B; } } }
    if (!host) { let bd = 30; for (const B of cand) { const a = Math.abs(signedArea(B.ring)); if (a < 80 || a > 6000) continue; const c = centroid(B.ring); const d = Math.hypot(c[0] - s.x, c[1] - s.z); if (d < bd) { bd = d; host = B; } } }
    if (!host) host = newStation(P, s);
    const C = host.civic || (host.civic = { fire: false, ems: false, rescue: false, police: false, names: [] });
    for (const k of ['fire', 'ems', 'rescue', 'police']) if (s[k]) C[k] = true;
    C.names.push(stationTitle(s.name)); if (s.fire) C.fireName = stationTitle(s.name); if (s.police) C.policeName = stationTitle(s.name); if (!s.fire && !s.police) C.emsName = stationTitle(s.name);
    host.food = null; host.units = null;
    // a station is brick and tall enough for the apparatus doors
    const t = host.tags = Object.assign({}, host.tags); if (!t.building || t.building === 'yes' || HOUSEY.has(t.building)) t.building = C.fire || C.ems ? 'fire_station' : 'public'; // (some are mapped as houses)
    delete t['building:material']; delete t['roof:shape'];
    if (!t.height && !(parseFloat(t['building:levels']) > 1) && (C.fire || C.ems)) { delete t['building:levels']; t.height = '6.8'; }
  }
}
// a brick station facing the nearest road, for stations mapped only as a point
function newStation(P, s) {
  const n = nearestRoad(s.x, s.z, 150, r => r.car); let ux = 1, uz = 0;
  if (n) { const dx = n.x - s.x, dz = n.z - s.z, l = Math.hypot(dx, dz) || 1; ux = -dz / l; uz = dx / l; } // along the road
  const L = s.fire ? 24 : s.ems ? 18 : 20, D = s.fire ? 17 : 14; const vx = -uz, vz = ux;
  let cx = s.x, cz = s.z; if (n && n.d < D / 2 + 9) { const dx = s.x - n.x, dz = s.z - n.z, l = Math.hypot(dx, dz) || 1; cx = n.x + dx / l * (D / 2 + 9); cz = n.z + dz / l * (D / 2 + 9); }
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + ux * a * L / 2 + vx * b * D / 2, cz + uz * a * L / 2 + vz * b * D / 2]);
  const B = { id: 9e9 + (hashStr(s.ref) % 1e6), tags: { building: s.fire ? 'fire_station' : 'public', height: s.fire ? '6.8' : '5', name: s.name }, ring, holes: [], part: false, made: true };
  P.buildings.push(B); return B;
}

// ---- after the buildings: bays, doors, signs, vehicles ----
function buildCivic(T, P) {
  const W = T.W; const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1; const mb = new MB(true);
  for (const B of P.buildings) {
    const [cx, cz] = centroid(B.ring); if (!own(cx, cz)) continue;
    try {
      if (B.civic) dressStation(T, B, mb);
      else { const t = B.tags || {}; const title = CIVIC_BUILDINGS[B.id] || (t.name && /^(townhall|library|post_office|courthouse|community_centre)$/.test(t.amenity || '') && !/Joyner/.test(t.name) ? t.name.toUpperCase() : t.name && t.tourism === 'museum' && B.ring.length >= 4 ? t.name.toUpperCase() : null); if (title) dressCivic(T, B, mb, title, !!CIVIC_BUILDINGS[B.id] || t.amenity === 'townhall' || t.amenity === 'courthouse'); }
    } catch (e) { console.warn('station skipped', B.id, e); }
  }
  try { pccEntrance(T, P, mb); } catch (e) { console.warn('PCC sign skipped', e); }
  addMB(T, mb, lmPlainMat());
}
// ground height + wall top of a finished building (from the collision record)
function bldTop(B) {
  let gs = 0; for (const p of B.ring) gs += H(p[0], p[1]); const g = gs / B.ring.length;
  const xs = B.ring.map(p => p[0]), zs = B.ring.map(p => p[1]);
  for (const it of World.bldHash.query(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs))) if (it.ring === B.ring) return { g, top: it.h };
  return { g, top: g + 6 };
}
// edges facing a street, best first
function streetEdges(ring) {
  const E = HM.edgesOf(ring);
  for (const e of E) { const n = nearestRoad(e.mx + e.nx * 6, e.mz + e.nz * 6, 160, r => r.car); e.road = n ? n.d : 160; e.score = -e.road + Math.min(e.L, 30) * 0.4; e.tx = (e.b[0] - e.a[0]) / e.L; e.tz = (e.b[1] - e.a[1]) / e.L; }
  return E.sort((a, b) => b.score - a.score);
}
const CV = { red: new THREE.Color('#b3161c'), door: new THREE.Color('#e4e6e8'), doorLine: new THREE.Color('#b9bdc2'), dark: new THREE.Color('#1c1e21'), glass: new THREE.Color('#2e4557'), conc: new THREE.Color('#bdb9b0'), blue: new THREE.Color('#1d3f7a'), white: new THREE.Color('#f4f3ef'), pole: new THREE.Color('#c9ccd0') };
function dressStation(T, B, mb) {
  const C = B.civic; const { g, top } = bldTop(B); const wallH = Math.max(3.2, top - g);
  const E = streetEdges(B.ring); if (!E.length) return;
  const bayEdge = C.fire || C.ems ? (E.find(e => e.L >= 9) || E[0]) : null;
  const polEdge = C.police ? (bayEdge ? E.find(e => e !== bayEdge && e.L >= 6 && e.road < 90) || bayEdge : E[0]) : null;
  const shared = polEdge && polEdge === bayEdge;
  // --- apparatus bays ---
  if (bayEdge) {
    const e = bayEdge; const span = shared ? e.L * 0.6 : e.L * 0.86; const s0 = shared ? e.L * 0.04 : (e.L - span) / 2;
    const want = C.fire ? (C.rescue || C.ems ? 3 : 2) : 2; const n = Math.max(1, Math.min(4, want, Math.floor(span / 4.7)));
    const dw = Math.min(4.3, span / n - 0.9), dh = Math.min(4.3, wallH - 0.9), pitch = span / n;
    const yaw = Math.atan2(e.nx, e.nz); const P0 = (s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o];
    const gy = s => H(...P0(s, 0));
    // concrete apron out to the street
    const clear = e.road + 0.5; // wall to the edge of the street
    const ad = Math.max(3, Math.min(14, clear)); const am = P0(s0 + span / 2, ad / 2);
    HM.box(mb, am[0], am[1], H(am[0], am[1]) - 0.3, H(am[0], am[1]) + 0.06, span / 2 + 1, ad / 2, yaw, CV.conc);
    const vehicles = []; if (C.fire) vehicles.push('engine'); if (C.rescue) vehicles.push('rescue'); if (C.ems) vehicles.push('ambulance'); if (C.fire && n > vehicles.length) vehicles.push('engine');
    for (let i = 0; i < n; i++) {
      const s = s0 + pitch * (i + 0.5), y0 = gy(s); const c = P0(s, 0.06);
      HM.box(mb, c[0], c[1], y0, y0 + dh + 0.35, dw / 2 + 0.35, 0.08, yaw, CV.red);                    // red frame
      const v = vehicles[i]; const len = v === 'ambulance' ? 6.6 : v === 'rescue' ? 9.4 : 10.2;
      const out = v ? Math.max(-len / 2 + 3, Math.min(len / 2 + 1.2, clear - len / 2 - 0.5)) : 0; // nose kept off the street
      const open = !!v && out < len / 2 + 0.3; const d = P0(s, 0.16);
      HM.box(mb, d[0], d[1], y0, y0 + dh, dw / 2, 0.06, yaw, open ? CV.dark : CV.door);               // door (open bays are dark inside)
      if (!open) { for (let k = 1; k < 7; k++) { const yy = y0 + dh * k / 7; const q = P0(s, 0.23); HM.box(mb, q[0], q[1], yy - 0.03, yy + 0.03, dw / 2, 0.01, yaw, CV.doorLine); } const w = P0(s, 0.24); HM.box(mb, w[0], w[1], y0 + dh * 0.58, y0 + dh * 0.72, dw / 2 - 0.25, 0.01, yaw, CV.glass); }
      if (!v) continue; const p = P0(s, out);
      const m = v === 'engine' ? makeFireEngine() : v === 'rescue' ? makeRescueTruck() : makeAmbulance();
      m.position.set(p[0], H(p[0], p[1]) + 0.05, p[1]); m.rotation.y = yaw; T.group.add(m);
      for (const f of [-0.3, 0.1, 0.4]) { const q = P0(s, out + f * len); HM.obstacle(T, q[0], q[1], 1.3); }
    }
    // lettering over the doors
    const title = C.fireName || C.emsName || C.names[0]; const sw = Math.min(span * 0.95, 26), sh = Math.min(sw / 8, Math.max(0.6, top - g - dh - 0.55)); const sy = Math.min(g + dh + 0.45 + sh / 2, top - sh / 2 - 0.1);
    const sign = signMesh(T, textTexture([[title, 96, '#ffffff', 64, 800]], { w: 1024, h: 128, bg: '#9c1318' }), sh * 8, sh, true); const sp = P0(s0 + span / 2, 0.12);
    sign.position.set(sp[0], sy, sp[1]); sign.rotation.y = yaw; T.group.add(sign);
  }
  // --- police entrance, sign band, cruisers, flag ---
  if (polEdge) {
    const e = polEdge; const yaw = Math.atan2(e.nx, e.nz); const at = shared ? e.L * 0.82 : e.L * 0.5; const P0 = (s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o];
    const c = P0(at, 0); const y0 = H(c[0], c[1]); const cw = Math.min(6, e.L * (shared ? 0.3 : 0.5));
    const k = P0(at, 1.6); HM.box(mb, k[0], k[1], y0 + 3.0, y0 + 3.35, cw / 2, 1.6, yaw, CV.blue);                    // entrance canopy
    for (const s of [-1, 1]) { const q = P0(at + s * (cw / 2 - 0.2), 3.0); HM.box(mb, q[0], q[1], y0, y0 + 3.0, 0.1, 0.1, yaw, CV.pole); }
    const d = P0(at, 0.1); HM.box(mb, d[0], d[1], y0, y0 + 2.5, 1.1, 0.06, yaw, CV.glass);                            // glass doors
    const sw = Math.min(e.L * (shared ? 0.34 : 0.8), 16); const band = plaque(T, C.policeName || 'POLICE', sw, '#ffffff', '#1d3f7a', true);
    const sp = P0(at, 0.14); band.position.set(sp[0], Math.max(y0 + 3.5 + sw / 16, Math.min(y0 + 4.2, top - sw / 16 - 0.1)), sp[1]); band.rotation.y = yaw; T.group.add(band);
    // cruisers nose-in along the building, a couple of metres out
    const nCars = Math.max(1, Math.min(3, Math.floor(e.L / 8)));
    for (let i = 0; i < nCars; i++) {
      const s = shared ? at - cw / 2 - 3 - i * 3.2 : at + cw / 2 + 2.2 + i * 3.2; if (s < 1.5 || s > e.L - 1.5) continue;
      const clear = e.road - 1.5, noseIn = clear - 4.8 >= 3.4; // nose-in if there's room before the sidewalk, else parked along the wall
      const p = P0(noseIn ? s : s + (shared ? -1 : 1) * (i * 2.4 + 0.6), noseIn ? Math.min(5.2, clear - 4.8) : 2.0); const m = makePoliceCar(); m.position.set(p[0], H(p[0], p[1]) + 0.02, p[1]); m.rotation.y = noseIn ? yaw + Math.PI : yaw + Math.PI / 2; T.group.add(m); HM.obstacle(T, p[0], p[1], 1.2);
    }
    flagpole(T, mb, P0(shared ? e.L * 0.97 : Math.max(1, at - cw / 2 - 3), 6.5));
  } else if (bayEdge) flagpole(T, mb, [bayEdge.a[0] + bayEdge.nx * 6.5 - bayEdge.tx * 2, bayEdge.a[1] + bayEdge.nz * 6.5 - bayEdge.tz * 2]);
}
function dressCivic(T, B, mb, title, flag) {
  const { g, top } = bldTop(B); const E = streetEdges(B.ring); const e = E.find(q => q.L >= 7) || E[0]; if (!e) return;
  const yaw = Math.atan2(e.nx, e.nz); const mx = e.a[0] + e.tx * e.L / 2, mz = e.a[1] + e.tz * e.L / 2; const y0 = H(mx, mz);
  const sw = Math.min(e.L * 0.75, 18); const s = plaque(T, title, sw, '#2b2622', '#efe9dc', false);
  s.position.set(mx + e.nx * 0.14, Math.max(y0 + 2.6 + sw / 16, Math.min(y0 + 3.6, top - sw / 16 - 0.15)), mz + e.nz * 0.14); s.rotation.y = yaw; T.group.add(s);
  if (flag) flagpole(T, mb, [mx + e.nx * 8 + e.tx * Math.min(8, e.L / 2 + 2), mz + e.nz * 8 + e.tz * Math.min(8, e.L / 2 + 2)]);
}
// Pitt Community College: a brick monument sign where the campus meets the main road
function pccEntrance(T, P, mb) {
  const W = T.W; const Z = P.zones || (P.zones = landmarkZones(P)); const q = Z.find(z => z.kind === 'pcc'); if (!q) return;
  let best = null, bd = 1e9; for (const r of q.a.rings) for (const p of r) { const n = nearestRoad(p[0], p[1], 200, rd => rd.car && rd.rank >= 3); if (n && n.d < bd) { bd = n.d; best = { p, n }; } }
  if (!best) return; const [px, pz] = best.p; if (!(px >= W.x0 && px < W.x1 && pz >= W.z0 && pz < W.z1)) return;
  const dx = best.n.x - px, dz = best.n.z - pz, l = Math.hypot(dx, dz) || 1; const nx = dx / l, nz = dz / l;
  const x = px + nx * Math.max(0, Math.min(bd - 7, 4)), z = pz + nz * Math.max(0, Math.min(bd - 7, 4)); const y = H(x, z); const yaw = Math.atan2(nx, nz);
  HM.box(mb, x, z, y - 0.3, y + 0.45, 4.6, 0.9, yaw, new THREE.Color('#cfc8b8'));          // planter base
  HM.box(mb, x, z, y + 0.45, y + 2.3, 4.1, 0.45, yaw, new THREE.Color('#9b6f4e'));         // brick wall
  HM.box(mb, x, z, y + 2.3, y + 2.5, 4.3, 0.55, yaw, new THREE.Color('#e3ddd0'));          // cap
  for (const sgn of [1, -1]) {
    const s = signMesh(T, textTexture([['PITT COMMUNITY', 122, '#ffffff', 90], ['COLLEGE', 122, '#ffffff', 190]], { w: 1024, h: 256, bg: '#1f3f73' }), 6.6, 1.65, true);
    s.position.set(x + nx * 0.47 * sgn, y + 1.4, z + nz * 0.47 * sgn); s.rotation.y = yaw + (sgn < 0 ? Math.PI : 0); T.group.add(s);
  }
  HM.obstacle(T, x, z, 2.2); HM.obstacle(T, x + nz * 3, z - nx * 3, 1.2); HM.obstacle(T, x - nz * 3, z + nx * 3, 1.2);
}
// an 8:1 lettered panel
function plaque(T, text, w, fg, bg, glow) { return signMesh(T, textTexture([[text, 96, fg, 64, 800]], { w: 1024, h: 128, bg }), w, w / 8, glow); }
// flagpole with the US flag
function flagpole(T, mb, p) {
  const [x, z] = p; const y = H(x, z);
  HM.box(mb, x, z, y - 0.2, y + 0.3, 0.7, 0.7, 0, CV.conc);
  HM.geo(mb, new THREE.CylinderGeometry(0.06, 0.1, 10, 8), CV.pole, x, y + 5, z); HM.geo(mb, new THREE.SphereGeometry(0.14, 8, 6), new THREE.Color('#d4b24a'), x, y + 10.1, z);
  if (!MAT.usFlag) {
    const c = cnv(190, 100), g = c.getContext('2d');
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, i * 100 / 13, 190, 100 / 13 + 0.5); }
    g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 76, 54); g.fillStyle = '#ffffff'; for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { g.beginPath(); g.arc(6 + k * 12.6 + (r % 2 ? 6.3 : 0), 4 + r * 5.6, 1.4, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; MAT.usFlag = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 });
  }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2, 6, 1), MAT.usFlag); const pa = f.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 1.15) * 2.4) * 0.12 * (pa.getX(i) + 1.15) / 2.3);
  f.geometry.computeVertexNormals(); f.position.set(x + 1.2, y + 9.2, z); f.castShadow = true; T.group.add(f);
  HM.obstacle(T, x, z, 0.5);
}

// ---- apparatus (merged, vertex-coloured; front of the vehicle is +z) ----
const _cvGeo = {};
function cvVehicle(key, build) {
  if (!_cvGeo[key]) { const mb = new MB(true); const bx = (x0, x1, y0, y1, z0, z1, c) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); addGeoTo(mb, g, c); };
    const wheel = (x, z, r = 0.5, w = 0.34) => { const g = new THREE.CylinderGeometry(r, r, w, 16); g.rotateZ(Math.PI / 2); g.translate(x, r, z); addGeoTo(mb, g, new THREE.Color('#1a1c1e')); const h = new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 12); h.rotateZ(Math.PI / 2); h.translate(x, r, z); addGeoTo(mb, h, new THREE.Color('#b8bcc0')); };
    build(bx, wheel); _cvGeo[key] = mb.geo(); _cvGeo[key].userData.shared = true; }
  const m = new THREE.Mesh(_cvGeo[key], MAT.cvVeh || (MAT.cvVeh = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15 }))); m.castShadow = true; m.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(m); return grp;
}
function makeFireEngine() {
  return cvVehicle('engine', (bx, wheel) => {
    const R = new THREE.Color('#b3161c'), Wt = new THREE.Color('#f2f2ee'), S = new THREE.Color('#c3c7cc'), K = new THREE.Color('#202326'), G = new THREE.Color('#2b3a47'), Y = new THREE.Color('#f0c419');
    bx(-1.25, 1.25, 0.75, 3.05, 1.9, 5.0, R);            // cab
    bx(-1.26, 1.26, 2.95, 3.12, 1.9, 5.0, Wt);           // white cab roof
    bx(-1.15, 1.15, 2.0, 2.85, 4.98, 5.04, G);           // windshield
    for (const s of [-1, 1]) bx(s * 1.26 - 0.01, s * 1.26 + 0.01, 1.95, 2.8, 2.2, 4.6, G);     // side windows
    bx(-1.25, 1.25, 0.75, 2.75, -5.0, 1.85, R);          // body
    for (const s of [-1, 1]) { for (let k = 0; k < 4; k++) bx(s * 1.27 - 0.02, s * 1.27 + 0.02, 1.05, 2.55, -4.6 + k * 1.55, -3.2 + k * 1.55, S); bx(s * 1.28 - 0.02, s * 1.28 + 0.02, 0.9, 1.0, -5.0, 5.0, Wt); } // compartments, white stripe
    bx(-1.1, 1.1, 2.75, 2.95, -4.8, 1.6, K);             // hose bed
    for (const s of [-1, 1]) bx(s * 0.95 - 0.06, s * 0.95 + 0.06, 3.05, 3.2, -5.2, 3.8, S);    // ladder rails
    for (let k = 0; k < 18; k++) bx(-0.95, 0.95, 3.08, 3.14, -5.1 + k * 0.5, -5.04 + k * 0.5, S); // rungs
    bx(-1.0, 1.0, 3.12, 3.3, 3.9, 4.6, R); bx(-0.3, 0.3, 3.12, 3.32, 3.9, 4.6, Wt);              // light bar
    bx(-1.2, 1.2, 0.55, 1.05, 5.0, 5.35, S);             // bumper
    bx(-0.7, 0.7, 1.2, 1.9, 5.0, 5.06, S);               // grille
    for (const s of [-1, 1]) bx(s * 1.0 - 0.18, s * 1.0 + 0.18, 1.25, 1.45, 5.02, 5.08, Y);
    wheel(-1.05, 3.6, 0.55, 0.4); wheel(1.05, 3.6, 0.55, 0.4); for (const z of [-2.4, -3.6]) { wheel(-1.05, z, 0.55, 0.5); wheel(1.05, z, 0.55, 0.5); }
  });
}
function makeRescueTruck() {
  return cvVehicle('rescue', (bx, wheel) => {
    const R = new THREE.Color('#b3161c'), Wt = new THREE.Color('#f2f2ee'), S = new THREE.Color('#c3c7cc'), G = new THREE.Color('#2b3a47');
    bx(-1.2, 1.2, 0.75, 2.9, 2.0, 4.6, R); bx(-1.21, 1.21, 2.8, 2.95, 2.0, 4.6, Wt); bx(-1.1, 1.1, 1.95, 2.7, 4.58, 4.64, G);
    for (const s of [-1, 1]) bx(s * 1.21 - 0.01, s * 1.21 + 0.01, 1.9, 2.65, 2.3, 4.3, G);
    bx(-1.28, 1.28, 0.7, 3.25, -4.7, 1.95, R);           // walk-around rescue body
    bx(-1.29, 1.29, 2.55, 2.75, -4.7, 1.95, Wt);         // white band
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) bx(s * 1.3 - 0.02, s * 1.3 + 0.02, 1.0, 2.45, -4.4 + k * 2.1, -2.6 + k * 2.1, S); // roll-up compartment doors
    bx(-1.0, 1.0, 2.95, 3.12, 3.6, 4.4, R); bx(-1.15, 1.15, 0.55, 1.0, 4.6, 4.95, S);
    wheel(-1.05, 3.3, 0.55, 0.4); wheel(1.05, 3.3, 0.55, 0.4); wheel(-1.05, -3.0, 0.55, 0.5); wheel(1.05, -3.0, 0.55, 0.5);
  });
}
function makePoliceCar() {
  return cvVehicle('police', (bx, wheel) => {
    const Wt = new THREE.Color('#f4f4f2'), K = new THREE.Color('#15171a'), B = new THREE.Color('#1d3f7a'), G = new THREE.Color('#26313b'), Rd = new THREE.Color('#d11f24'), Bl = new THREE.Color('#1f56d6');
    bx(-0.92, 0.92, 0.35, 1.0, -2.45, 2.45, Wt);         // lower body
    bx(-0.9, 0.9, 0.35, 0.95, 0.9, 2.45, K);             // black hood & front doors (two-tone)
    bx(-0.93, 0.93, 0.35, 0.95, -0.2, 0.9, K);
    bx(-0.94, 0.94, 0.62, 0.74, -2.2, 2.2, B);           // stripe
    bx(-0.82, 0.82, 1.0, 1.48, -1.2, 0.85, G);           // glasshouse
    bx(-0.8, 0.8, 1.46, 1.52, -1.1, 0.8, Wt);            // roof
    bx(-0.62, -0.02, 1.52, 1.66, -0.2, 0.1, Rd); bx(0.02, 0.62, 1.52, 1.66, -0.2, 0.1, Bl); // light bar
    bx(-0.7, 0.7, 0.3, 0.8, 2.45, 2.62, K);              // push bumper
    for (const [x, z] of [[-0.82, 1.5], [0.82, 1.5], [-0.82, -1.45], [0.82, -1.45]]) wheel(x, z, 0.36, 0.26);
  });
}
