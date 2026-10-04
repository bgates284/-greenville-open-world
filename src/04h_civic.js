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
    if (CIVIC_LOOK[host.id]) { delete t['building:levels']; t.height = String(CIVIC_LOOK[host.id].h); }
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
      if (B.civic) CIVIC_LOOK[B.id] ? dressWintervilleSafety(T, B, mb, CIVIC_LOOK[B.id]) : dressStation(T, B, mb);
      else if (CIVIC_LOOK[B.id] && CIVIC_LOOK[B.id].kind === 'library') dressWintervilleLibrary(T, B, mb);
      else if (CIVIC_LOOK[B.id] && CIVIC_LOOK[B.id].kind === 'mainmill') dressMainMill(T, B, mb);
      else { const t = B.tags || {}; const title = CIVIC_BUILDINGS[B.id] || (t.name && /^(townhall|library|post_office|courthouse|community_centre)$/.test(t.amenity || '') && !/Joyner/.test(t.name) ? t.name.toUpperCase() : t.name && t.tourism === 'museum' && B.ring.length >= 4 ? t.name.toUpperCase() : null); if (title) dressCivic(T, B, mb, title, !!CIVIC_BUILDINGS[B.id] || t.amenity === 'townhall' || t.amenity === 'courthouse'); }
    } catch (e) { console.warn('station skipped', B.id, e); }
  }
  try { pccEntrance(T, P, mb); } catch (e) { console.warn('PCC sign skipped', e); }
  try { paintMurals(T, P); } catch (e) { console.warn('mural skipped', e); }
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

// ---------- Winterville Public Safety (Fire-Rescue-EMS + Police), Railroad St at Main St ----------
// Light tan brick with darker banding and maroon-framed windows (its own facade, 'tanbrick'); a taller
// entry pavilion with a low hip roof at the Main Street end, a metal canopy hung on diagonal rods,
// a corner plaza with three flagpoles, three big terracotta planters and a memorial stone, red mulch
// beds with shrubs along the front, and the apparatus bays at the far end with red-framed glass doors.
const CIVIC_LOOK = { 666185236: { fac: 'tanbrick', h: 5.6, plaza: [35.52866, -77.40196] }, 1185828767: { kind: 'library', fac: 'brick', h: 4.8, wall: '#ffffff', roof: '#8f979c' }, 1185828764: { kind: 'mainmill', fac: 'shop', h: 8.4, wall: '#ffffff' } };
function flagTex(kind) {
  const key = 'flag_' + kind; if (MAT[key]) return MAT[key];
  const c = cnv(190, 100), g = c.getContext('2d');
  if (kind === 'us') { for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, i * 100 / 13, 190, 100 / 13 + 0.5); } g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 76, 54); g.fillStyle = '#fff'; for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { g.beginPath(); g.arc(6 + k * 12.6 + (r % 2 ? 6.3 : 0), 4 + r * 5.6, 1.4, 0, 7); g.fill(); } }
  else if (kind === 'nc') { g.fillStyle = '#ffffff'; g.fillRect(0, 50, 190, 50); g.fillStyle = '#bf0a30'; g.fillRect(0, 0, 190, 50); g.fillStyle = '#002868'; g.fillRect(0, 0, 64, 100); g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillText('N  C', 32, 66); g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14; g.lineTo(32 + Math.cos(a) * r, 46 + Math.sin(a) * r); } g.fill(); }
  else { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 190, 100); g.fillStyle = '#1f3f73'; g.beginPath(); g.arc(95, 50, 30, 0, 7); g.fill(); g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(95, 50, 22, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return MAT[key] = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 });
}
function flagpoleK(T, mb, x, z, kind, hgt = 9) {
  const y = H(x, z); HM.geo(mb, new THREE.CylinderGeometry(0.05, 0.09, hgt, 8), CV.pole, x, y + hgt / 2, z); HM.geo(mb, new THREE.SphereGeometry(0.12, 8, 6), new THREE.Color('#d4b24a'), x, y + hgt + 0.1, z);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0, 6, 1), flagTex(kind)); const pa = f.geometry.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin((pa.getX(i) + 0.95) * 2.6) * 0.1 * (pa.getX(i) + 0.95) / 1.9);
  f.geometry.computeVertexNormals(); f.position.set(x + 1.0, y + hgt - 0.65, z); f.castShadow = true; T.group.add(f); HM.obstacle(T, x, z, 0.3);
}
function dressWintervilleSafety(T, B, mb, look) {
  const C = B.civic; const { g, top } = bldTop(B); const wallH = Math.max(3.2, top - g);
  const E = streetEdges(B.ring).filter(e => e.L >= 6 && e.road < 60); if (!E.length) return dressStation(T, B, mb);
  const px = lonToX(look.plaza[1]), pz = latToZ(look.plaza[0]);
  const polEdge = E.slice().sort((a, b) => Math.hypot(a.mx - px, a.mz - pz) - Math.hypot(b.mx - px, b.mz - pz))[0];
  const same = E.filter(e => e !== polEdge && e.L >= 9 && e.nx * polEdge.nx + e.nz * polEdge.nz > 0.8);
  const bayEdge = (same.length ? same : E.filter(e => e !== polEdge && e.L >= 9)).sort((a, b) => Math.hypot(b.mx - px, b.mz - pz) - Math.hypot(a.mx - px, a.mz - pz))[0] || polEdge;
  const Co = h => new THREE.Color(h); const TAN = Co('#d9c6a3'), TAN2 = Co('#c4a982'), MAROON = Co('#6e2323'), METAL = Co('#8c9296'), ROOF = Co('#9aa1a6'), MULCH = Co('#8c3a28'), SHRUB = [Co('#3f6a2c'), Co('#4c7a33'), Co('#365f27')];
  const EP = (e, s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o];
  // --- entry pavilion at the Main Street end of the front ---
  { const e = polEdge, yaw = Math.atan2(e.nx, e.nz); const ps = Math.min(e.L * 0.5, Math.max(5, e.L - 5)); const pw = Math.min(9, e.L * 0.7);
    const [cx, cz] = EP(e, ps, 1.2); const y0 = H(cx, cz), ph = wallH + 2.4;
    { const tb = new MB(true), tf = TEX.facade.tanbrick, W1 = new THREE.Color(1, 1, 1); const c = Math.cos(yaw), sn = Math.sin(yaw); const P = (u, v) => [cx + u * c + v * sn, cz - u * sn + v * c]; // tower, in the building's brick
      const q = [P(-pw / 2, -1.3), P(pw / 2, -1.3), P(pw / 2, 1.3), P(-pw / 2, 1.3)]; let acc = 0;
      for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; const u0 = acc / (tf.bayW * 4), u1 = (acc + L) / (tf.bayW * 4); acc += L;
        tb.quad([a[0], y0 - 0.2, a[1]], [b[0], y0 - 0.2, b[1]], [b[0], y0 + ph, b[1]], [a[0], y0 + ph, a[1]], [u0, 0], [u1, 0], [u1, (ph + 0.2) / (tf.floorH * 4)], [u0, (ph + 0.2) / (tf.floorH * 4)], [-nx, 0, -nz], W1); }
      const m = new THREE.Mesh(tb.geo(), MAT.facade.tanbrick); m.castShadow = m.receiveShadow = true; T.group.add(m);
      HM.box(mb, cx, cz, y0 + ph - 0.05, y0 + ph, pw / 2 - 0.02, 1.28, yaw, TAN2); HM.solid(T, q, y0 + ph + 1.4, 'Winterville Public Safety'); }
    HM.box(mb, cx, cz, y0 + ph - 0.7, y0 + ph - 0.45, pw / 2 + 0.06, 1.36, yaw, TAN2);          // dark band
    { const c = Math.cos(yaw), s = Math.sin(yaw); const P = (u, v, y) => [cx + u * c + v * s, y, cz - u * s + v * c]; const hu = pw / 2 + 0.3, hv = 1.6, yb = y0 + ph, yt = yb + 1.4; // low hip roof
      const A = P(-hu, -hv, yb), Bq = P(hu, -hv, yb), Cq = P(hu, hv, yb), D = P(-hu, hv, yb), R1 = P(-hu + hv, 0, yt), R2 = P(hu - hv, 0, yt);
      mb.quad(Cq, D, R1, R2, [0, 0], [0, 0], [0, 0], [0, 0], [s * 0.6, 1, c * 0.6], ROOF); mb.quad(A, Bq, R2, R1, [0, 0], [0, 0], [0, 0], [0, 0], [-s * 0.6, 1, -c * 0.6], ROOF);
      mb.tri(D, A, R1, [0, 0], [0, 0], [0, 0], [-c, 1, s], ROOF); mb.tri(Bq, Cq, R2, [0, 0], [0, 0], [0, 0], [c, 1, -s], ROOF); }
    const [fx, fz] = EP(e, ps, 2.52); // front face of the pavilion
    HM.box(mb, fx, fz, y0 + wallH - 0.4, y0 + wallH + 1.6, 1.6, 0.04, yaw, MAROON);              // recessed maroon-framed panel
    const sg = plaque(T, 'WINTERVILLE', 3.0, '#f2e6c8', '#7a2a24', false); sg.position.set(fx + e.nx * 0.06, y0 + wallH + 0.6, fz + e.nz * 0.06); sg.rotation.y = yaw; T.group.add(sg);
    for (const k of [-1, 1]) { const [wx, wz] = EP(e, ps + k * pw * 0.3, 2.52); HM.box(mb, wx, wz, y0 + 0.3, y0 + 2.6, 0.75, 0.05, yaw, MAROON); HM.box(mb, wx + e.nx * 0.03, wz + e.nz * 0.03, y0 + 0.4, y0 + 2.5, 0.62, 0.04, yaw, CV.glass); }
    const [dx, dz] = EP(e, ps, 2.53); HM.box(mb, dx, dz, y0, y0 + 2.6, 0.95, 0.05, yaw, MAROON); HM.box(mb, dx + e.nx * 0.03, dz + e.nz * 0.03, y0, y0 + 2.5, 0.85, 0.04, yaw, CV.glass);
    // metal canopy along the front, hung from diagonal rods
    const cw = Math.min(e.L - 1, pw + 8), cs = Math.min(Math.max(cw / 2 + 0.5, ps), e.L - cw / 2 - 0.5), [kx, kz] = EP(e, cs, 1.3); const yc = y0 + 3.1;
    HM.box(mb, kx, kz, yc, yc + 0.18, cw / 2, 1.3, yaw, METAL);
    for (let u = -cw / 2 + 0.8; u <= cw / 2 - 0.5; u += 2.2) { const [ax, az] = EP(e, cs + u, 0.05), [bx, bz] = EP(e, cs + u, 2.5); const a = new THREE.Vector3(ax, y0 + 4.6, az), b = new THREE.Vector3(bx, yc + 0.18, bz); const len = a.distanceTo(b); const rod = new THREE.CylinderGeometry(0.03, 0.03, len, 5); rod.translate(0, len / 2, 0); rod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); rod.translate(a.x, a.y, a.z); addGeoTo(mb, rod, METAL); }
    // corner plaza: flagpoles, terracotta planters, memorial stone
    const [qx, qz] = EP(e, Math.min(e.L - 0.5, ps + pw / 2 + 4.5), 6.5); const qy = H(qx, qz);
    HM.box(mb, qx, qz, qy - 0.2, qy + 0.07, 4.5, 3.4, yaw, Co('#cfcac0'));
    const fl = ['us', 'nc', 'town']; fl.forEach((k, i) => { const [x, z] = EP(e, Math.min(e.L - 0.5, ps + pw / 2 + 2.6 + i * 1.9), 4.8); flagpoleK(T, mb, x, z, k, i === 0 ? 10 : 8.6); });
    for (let i = 0; i < 3; i++) { const [x, z] = EP(e, Math.min(e.L - 0.5, ps + pw / 2 + 2 + i * 2.2), 8.6); const y = H(x, z);
      HM.geo(mb, new THREE.CylinderGeometry(0.62, 0.45, 0.85, 14), Co('#b8613a'), x, y + 0.43, z); HM.geo(mb, new THREE.CylinderGeometry(0.66, 0.66, 0.08, 14), Co('#a5522f'), x, y + 0.86, z);
      for (let k = 0; k < 4; k++) HM.geo(mb, new THREE.IcosahedronGeometry(0.3, 0), SHRUB[k % 3], x + Math.cos(k * 1.6) * 0.25, y + 1.05 + (k % 2) * 0.12, z + Math.sin(k * 1.6) * 0.25); HM.obstacle(T, x, z, 0.7); }
    { const [x, z] = EP(e, Math.min(e.L - 0.5, ps + pw / 2 + 4.6), 5.6); const y = H(x, z); HM.box(mb, x, z, y, y + 1.3, 0.55, 0.2, yaw, Co('#b9b6b0')); HM.box(mb, x, z, y, y + 0.2, 0.75, 0.4, yaw, Co('#9a9792')); HM.obstacle(T, x, z, 0.6); }
    // red mulch beds with shrubs along the front
    const bed = (s0, s1) => { if (s1 - s0 < 1) return; const [bx, bz] = EP(e, (s0 + s1) / 2, 1.0); const y = H(bx, bz); HM.box(mb, bx, bz, y - 0.1, y + 0.08, (s1 - s0) / 2, 1.0, yaw, MULCH); const r = mulberry32(B.id % 9999 + Math.floor(s0)); for (let s = s0 + 0.6; s < s1 - 0.4; s += 1.3) { const [x, z] = EP(e, s, 0.9 + r() * 0.3); HM.geo(mb, new THREE.IcosahedronGeometry(0.45 + r() * 0.2, 0), SHRUB[Math.floor(r() * 3)], x, H(x, z) + 0.45, z); } };
    bed(0.5, ps - pw / 2 - 0.3);
    { const [x, z] = EP(e, Math.max(1, ps - pw / 2 - 3), 6.8); const y = H(x, z); HM.geo(mb, new THREE.CylinderGeometry(0.14, 0.16, 0.6, 10), Co('#c8202a'), x, y + 0.3, z); HM.geo(mb, new THREE.SphereGeometry(0.15, 8, 6), Co('#c8202a'), x, y + 0.62, z); HM.geo(mb, new THREE.CylinderGeometry(0.07, 0.07, 0.42, 6).rotateZ(Math.PI / 2), Co('#c8202a'), x, y + 0.42, z); HM.obstacle(T, x, z, 0.25); }
    HM.obstacle(T, cx + e.nx * 1.3, cz + e.nz * 1.3, 0.2);
  }
  // --- apparatus bays: red frames, glass-paneled doors, the trucks nosing out ---
  { const e = bayEdge, yaw = Math.atan2(e.nx, e.nz); const sameEdge = e === polEdge; const span = sameEdge ? e.L * 0.38 : Math.min(e.L * 0.86, 16); const s0 = sameEdge ? e.L - span - 0.4 : (e.L - span) / 2;
    const vehicles = ['engine', 'rescue', 'ambulance']; const n = Math.max(2, Math.min(3, Math.floor(span / 4.7))); const pitch = span / n, dw = Math.min(4.2, pitch - 0.9), dh = Math.min(4.3, wallH - 0.9); const clear = e.road + 0.5;
    const [ax, az] = EP(e, s0 + span / 2, Math.max(3, Math.min(14, clear)) / 2); HM.box(mb, ax, az, H(ax, az) - 0.3, H(ax, az) + 0.06, span / 2 + 1, Math.max(3, Math.min(14, clear)) / 2, yaw, CV.conc);
    for (let i = 0; i < n; i++) { const s = s0 + pitch * (i + 0.5); const [x0, z0] = EP(e, s, 0.06); const y0 = H(x0, z0);
      HM.box(mb, x0, z0, y0, y0 + dh + 0.35, dw / 2 + 0.35, 0.08, yaw, CV.red);
      const v = vehicles[i]; const len = v === 'ambulance' ? 6.6 : v === 'rescue' ? 9.4 : 10.2; const out = v ? Math.max(-len / 2 + 3, Math.min(len / 2 + 1.2, clear - len / 2 - 0.5)) : 0; const open = !!v && out < len / 2 + 0.3;
      const [dx, dz] = EP(e, s, 0.16); HM.box(mb, dx, dz, y0, y0 + dh, dw / 2, 0.06, yaw, open ? CV.dark : Co('#c9302c'));
      if (!open) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const [wx, wz] = EP(e, s - dw / 2 + (k + 0.5) * dw / 4, 0.24); const yy = y0 + dh * (0.2 + r * 0.2); HM.box(mb, wx, wz, yy, yy + dh * 0.15, dw / 8 - 0.06, 0.01, yaw, CV.glass); }
      if (v) { const [px2, pz2] = EP(e, s, out); const m = v === 'engine' ? makeFireEngine() : v === 'rescue' ? makeRescueTruck() : makeAmbulance(); m.position.set(px2, H(px2, pz2) + 0.05, pz2); m.rotation.y = yaw; T.group.add(m); for (const f of [-0.3, 0.1, 0.4]) { const [qx, qz] = EP(e, s, out + f * len); HM.obstacle(T, qx, qz, 1.3); } } }
    const sw = Math.min(span * 0.9, 14), sh = Math.min(sw / 8, Math.max(0.5, wallH - dh - 0.5)); const [sx2, sz2] = EP(e, s0 + span / 2, 0.12);
    const sign = signMesh(T, textTexture([['WINTERVILLE FIRE-RESCUE-EMS', 92, '#f2e6c8', 64, 800]], { w: 1024, h: 128, bg: '#7a2a24' }), sh * 8, sh, true); sign.position.set(sx2, g + dh + 0.4 + sh / 2, sz2); sign.rotation.y = yaw; T.group.add(sign);
    // a police cruiser parked beside the bays
    const ps2 = s0 - 3.2; if (ps2 > 2) { const [cx2, cz2] = EP(e, ps2, Math.min(5.2, Math.max(2.8, clear - 4.8))); const m = makePoliceCar(); m.position.set(cx2, H(cx2, cz2) + 0.02, cz2); m.rotation.y = yaw + Math.PI; T.group.add(m); HM.obstacle(T, cx2, cz2, 1.2); }
  }
}

// ---------- Winterville Library, 2613 Railroad St ----------
// Red brick under a grey standing-seam roof; a front-gabled entry with a wide white-trimmed gable,
// a cream stone band, a big arched window over white-framed glass doors (lit warm at night), wall
// sconces, "2613", broad concrete steps with handrails, the brick monument sign, a street lamp,
// shrub beds and a ribbon sculpture on the lawn.
function hmGlowMat() { return MAT.hmGlow || (MAT.hmGlow = new THREE.MeshStandardMaterial({ color: 0xf2d27a, emissive: 0xffc35a, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1 })); }
function hmRedBrickMat() {
  if (MAT.hmRedBrick) return MAT.hmRedBrick;
  const c = cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#c9c3b8'; g.fillRect(0, 0, 256, 256);
  const r = mulberry32(2613); for (let y = 0, row = 0; y < 256; y += 8, row++) for (let x = (row % 2) * -12; x < 256; x += 24) { const t = r(); g.fillStyle = `rgb(${148 + t * 30 | 0},${68 + t * 16 | 0},${50 + t * 12 | 0})`; g.fillRect(x + 1, y + 1, 22, 6); }
  return MAT.hmRedBrick = new THREE.MeshStandardMaterial({ map: ctex(c), vertexColors: true, roughness: 0.85 });
}
function dressWintervilleLibrary(T, B, mb) {
  const { g, top } = bldTop(B); const wallH = Math.max(3.5, top - g);
  const E = streetEdges(B.ring); const e = E.find(q => q.L >= 9) || E[0]; if (!e) return;
  const yaw = Math.atan2(e.nx, e.nz), C = h => new THREE.Color(h); const BRICK = C('#a9553f'), WHITE = C('#f6f4ee'), STONE = C('#e3d6b8'), METAL = C('#8f979c'), CONC = C('#c4c0b6'), RAIL = C('#d9dcdf');
  const EP = (s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o];
  const ms = e.L / 2, pw = Math.min(9, e.L * 0.6), pd = 2.6; const [mx, mz] = EP(ms, 0); const y0 = H(mx, mz); const yF = y0 + 0.75; // raised entry floor
  const glow = new MB(true); const box = (s, o, ya, yb, hs, ho, col, m = mb) => { const [x, z] = EP(s, o); HM.box(m, x, z, ya, yb, hs, ho, yaw, col); };
  // --- entry pavilion: brick walls, front gable, metal roof with white rakes ---
  const rb = new MB(true), W1 = new THREE.Color(1, 1, 1); // pavilion walls + gable in textured red brick
  const bq = (A, Bq, y0q, y1q, n) => { const L = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]); rb.quad([A[0], y0q, A[1]], [Bq[0], y0q, Bq[1]], [Bq[0], y1q, Bq[1]], [A[0], y1q, A[1]], [0, 0], [L / 2.6, 0], [L / 2.6, (y1q - y0q) / 2.6], [0, (y1q - y0q) / 2.6], n, W1); };
  { const c0 = EP(ms - pw / 2, 0), c1 = EP(ms - pw / 2, pd), c2 = EP(ms + pw / 2, pd), c3 = EP(ms + pw / 2, 0);
    bq(c0, c1, y0 - 0.3, y0 + wallH, [-e.tx, 0, -e.tz]); bq(c1, c2, y0 - 0.3, y0 + wallH, [e.nx, 0, e.nz]); bq(c2, c3, y0 - 0.3, y0 + wallH, [e.tx, 0, e.tz]); }
  { const c = Math.cos(yaw), sn = Math.sin(yaw); const P = (u, v, y) => { const [x, z] = EP(ms + u, v); return [x, y, z]; };
    const yE = y0 + wallH, rise = Math.min(3.0, pw * 0.34), hw = pw / 2 + 0.5, f0 = -0.6, f1 = pd + 0.55;
    const R0 = P(0, f0, yE + rise), R1 = P(0, f1, yE + rise);
    mb.quad(P(-hw, f1, yE - 0.15), P(-hw, f0, yE - 0.15), R0, R1, [0, 0], [0, 0], [0, 0], [0, 0], [-c * 0.7, 1, sn * 0.7], METAL);   // roof halves
    mb.quad(P(hw, f0, yE - 0.15), P(hw, f1, yE - 0.15), R1, R0, [0, 0], [0, 0], [0, 0], [0, 0], [c * 0.7, 1, -sn * 0.7], METAL);
    for (let k = -hw + 0.4; k < hw; k += 0.45) { const a = Math.abs(k) / hw; const y = yE - 0.15 + rise * (1 - a) + 0.02; mb.quad(P(k - 0.02, f0, y), P(k + 0.02, f0, y), P(k + 0.02, f1, y), P(k - 0.02, f1, y), [0, 0], [0, 0], [0, 0], [0, 0], [0, 1, 0], C('#7d8489')); } // standing seams
    rb.tri(P(-pw / 2, pd + 0.02, yE), P(pw / 2, pd + 0.02, yE), P(0, pd + 0.02, yE + rise - 0.25), [0, 0], [pw / 2.6, 0], [pw / 5.2, (rise - 0.25) / 2.6], [e.nx, 0, e.nz], W1);   // brick gable face
    for (const sg of [-1, 1]) { const A = P(sg * hw, f1 + 0.02, yE - 0.15), Bq = P(0, f1 + 0.02, yE + rise); // thick white rake trim
      mb.quad(A, Bq, [Bq[0], Bq[1] - 0.55, Bq[2]], [A[0], A[1] - 0.55, A[2]], [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], WHITE); }
    box(ms, pd + 0.05, yE - 0.55, yE - 0.15, hw, 0.08, WHITE);                                   // white eave at the gable foot
  }
  box(ms, pd + 0.03, y0 + 2.75, y0 + 2.95, pw / 2 + 0.02, 0.06, STONE);                          // stone band
  // arched window (segmental arch of glowing panes in a cream surround) over the doors and sidelights
  { const aw = pw * 0.72, yA = y0 + 2.95, ar = 1.15; const n = 10;
    for (let i = 0; i < n; i++) { const u0 = -aw / 2 + aw * i / n, u1 = -aw / 2 + aw * (i + 1) / n; const h = u => yA + ar * Math.sqrt(Math.max(0, 1 - (u / (aw / 2)) ** 2)) * 0.95;
      const A = EP(ms + u0, pd + 0.06), Bq = EP(ms + u1, pd + 0.06); glow.quad([A[0], yA, A[1]], [Bq[0], yA, Bq[1]], [Bq[0], h(u1), Bq[1]], [A[0], h(u0), A[1]], [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], C('#ffffff'));
      const A2 = EP(ms + u0, pd + 0.07), B2 = EP(ms + u1, pd + 0.07); mb.quad([A2[0], h(u0), A2[1]], [B2[0], h(u1), B2[1]], [B2[0], h(u1) + 0.22, B2[1]], [A2[0], h(u0) + 0.22, A2[1]], [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], STONE); }
    for (const k of [-aw / 6, aw / 6]) box(ms + k, pd + 0.09, yA, yA + ar * 0.9, 0.05, 0.03, WHITE);                       // muntins
    // lower glazing: sidelights + double doors, white frames on white base panels
    box(ms, pd + 0.06, yF, y0 + 2.75, aw / 2 + 0.1, 0.05, WHITE);
    for (const [u, w] of [[-aw * 0.33, aw * 0.27], [aw * 0.33, aw * 0.27]]) { const [x, z] = EP(ms + u, pd + 0.1); HM.box(glow, x, z, yF + 0.7, y0 + 2.6, w / 2, 0.02, yaw, C('#ffffff')); }
    for (const u of [-0.42, 0.42]) { const [x, z] = EP(ms + u, pd + 0.1); HM.box(glow, x, z, yF + 0.05, y0 + 2.6, 0.36, 0.02, yaw, C('#ffffff')); }
    box(ms, pd + 0.12, yF, y0 + 2.62, 0.03, 0.03, WHITE);
  }
  { const m = new THREE.Mesh(rb.geo(), hmRedBrickMat()); m.castShadow = m.receiveShadow = true; T.group.add(m); }
  { const q = [EP(ms - pw / 2, 0), EP(ms - pw / 2, pd), EP(ms + pw / 2, pd), EP(ms + pw / 2, 0)]; HM.solid(T, q, y0 + wallH + 3, "Winterville Library"); }
  // sconces and the address
  for (const sg of [-1, 1]) { const [x, z] = EP(ms + sg * (pw / 2 - 0.6), pd + 0.2); HM.geo(glow, new THREE.SphereGeometry(0.17, 10, 8), C('#ffffff'), x, y0 + 2.45, z); HM.box(mb, x - e.nx * 0.12, z - e.nz * 0.12, y0 + 2.3, y0 + 2.6, 0.06, 0.06, yaw, C('#2b2b2b')); }
  { const [x, z] = EP(ms, pd + 0.1); const s = signMesh(T, textTexture([['2613', 180, '#3a3a3a', 128, 700]], { w: 512, h: 256 }), 0.5, 0.25, false); s.position.set(x, y0 + 2.83, z); s.rotation.y = yaw; T.group.add(s); }
  // broad concrete steps with handrails
  { const sw = pw * 0.85; box(ms, pd + 1.0, y0 - 0.2, yF, sw / 2, 1.0, CONC);
    for (let k = 0; k < 4; k++) box(ms, pd + 2.0 + 0.32 * (k + 0.5), y0 - 0.2, yF - 0.18 * (k + 1), sw / 2, 0.16, CONC);
    for (const u of [-sw / 2 + 0.15, -0.9, 0.9, sw / 2 - 0.15]) { const a = new THREE.Vector3(...(([x, z]) => [x, yF + 0.9, z])(EP(ms + u, pd + 1.6))), b = new THREE.Vector3(...(([x, z]) => [x, y0 + 0.9, z])(EP(ms + u, pd + 3.4)));
      const len = a.distanceTo(b); const r = new THREE.CylinderGeometry(0.03, 0.03, len, 6); r.translate(0, len / 2, 0); r.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); r.translate(a.x, a.y, a.z); addGeoTo(mb, r, RAIL);
      for (const p of [a, b]) HM.geo(mb, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), RAIL, p.x, p.y - 0.45, p.z); } }
  // shrub beds either side of the entry
  const r = mulberry32(2613); for (const sg of [-1, 1]) { const s0 = ms + sg * (pw / 2 + 0.3), s1 = sg > 0 ? Math.min(e.L - 0.5, ms + pw / 2 + 7) : Math.max(0.5, ms - pw / 2 - 7); const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
    if (hi - lo < 1) continue; box((lo + hi) / 2, 1.0, y0 - 0.1, y0 + 0.07, (hi - lo) / 2, 1.0, C('#6b4a33')); for (let s = lo + 0.5; s < hi - 0.3; s += 1.1) { const [x, z] = EP(s, 0.9 + r() * 0.3); HM.geo(mb, new THREE.IcosahedronGeometry(0.42 + r() * 0.2, 0), [C('#3f6a2c'), C('#4c7a33'), C('#365f27')][Math.floor(r() * 3)], x, H(x, z) + 0.42, z); } }
  // brick monument sign near the front corner, a street lamp, the ribbon sculpture
  { const [x, z] = EP(Math.min(e.L + 3, ms + pw / 2 + 9), 7.5); const y = H(x, z); HM.box(mb, x, z, y - 0.2, y + 1.25, 1.35, 0.32, yaw, C('#9c4f3b')); HM.box(mb, x, z, y + 1.25, y + 1.38, 1.42, 0.38, yaw, STONE);
    for (const sg of [1, -1]) { const s = signMesh(T, textTexture([['WINTERVILLE', 120, '#e2b65a', 90, 700], ['LIBRARY', 120, '#e2b65a', 190, 700]], { w: 1024, h: 256, bg: '#c9b48b' }), 2.2, 0.62, true); s.position.set(x + e.nx * 0.33 * sg, y + 0.8, z + e.nz * 0.33 * sg); s.rotation.y = yaw + (sg < 0 ? Math.PI : 0); T.group.add(s); } HM.obstacle(T, x, z, 1.3); }
  { const [x, z] = EP(Math.min(e.L + 6, ms + pw / 2 + 12), 7.8); const y = H(x, z); HM.geo(mb, new THREE.CylinderGeometry(0.06, 0.1, 4.2, 8), C('#1d1f22'), x, y + 2.1, z); HM.geo(glow, new THREE.SphereGeometry(0.24, 12, 8), C('#ffffff'), x, y + 4.4, z); HM.obstacle(T, x, z, 0.3); }
  { const [x, z] = EP(Math.max(-2, ms - pw / 2 - 5), 4.5); const y = H(x, z); HM.box(mb, x, z, y, y + 0.12, 0.55, 0.55, yaw, C('#bdb9b0'));
    const cols = [C('#d8402f'), C('#ef8a3a'), C('#f2f0ea')]; cols.forEach((col, i) => { const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; const a = t * Math.PI * 3.2 + i * 2.1; pts.push(new THREE.Vector3(x + Math.cos(a) * (0.35 + 0.15 * Math.sin(t * 7 + i)), y + 0.15 + t * 1.8, z + Math.sin(a) * (0.35 + 0.15 * Math.sin(t * 7 + i)))); }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.045, 6, false); addGeoTo(mb, tube, col); }); HM.obstacle(T, x, z, 0.6); }
  { const m = new THREE.Mesh(glow.geo(), hmGlowMat()); m.name = 'lib-lamps'; T.group.add(m); }
  HM.obstacle(T, mx + e.nx * 2.5, mz + e.nz * 2.5, 0.2);
}

// ---------- Main & Mill Oyster Bar & Tavern, 204 Main St at Mill St, Winterville ----------
// Two-storey red brick corner building: the town's 'shop' facade (storefront glass below, windows
// above) with a black storefront cornice, brick pilasters and dentils under the corbelled cornice,
// the name over the Main Street storefront, and a round-arched doorway with dark doors on Mill Street.
function dressMainMill(T, B, mb) {
  const { g, top } = bldTop(B); const wallH = Math.max(6, top - g); const C = h => new THREE.Color(h);
  const E = HM.edgesOf(B.ring).filter(e => e.L >= 3); for (const e of E) { const n = nearestRoad(e.mx + e.nx * 7, e.mz + e.nz * 7, 30, r => r.car); e.rn = n ? n.road.name || '' : ''; e.rd = n ? n.d : 99; e.tx = (e.b[0] - e.a[0]) / e.L; e.tz = (e.b[1] - e.a[1]) / e.L; }
  const byLen = a => a.slice().sort((p, q) => q.L - p.L);
  const main = byLen(E.filter(e => /Main/.test(e.rn)))[0] || byLen(E.filter(e => e.rd < 20))[0] || byLen(E)[0]; if (!main) return;
  const mill = byLen(E.filter(e => e !== main && /Mill/.test(e.rn)))[0] || byLen(E.filter(e => e !== main && Math.abs(e.nx * main.nx + e.nz * main.nz) < 0.3 && e.rd < 20))[0];
  const BLACK = C('#1d1d1f'), PIL = C('#8e4632'), DENT = C('#7a3526');
  for (const e of [main, mill].filter(Boolean)) {
    const yaw = Math.atan2(e.nx, e.nz); const EP = (s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o];
    { const [x, z] = EP(e.L / 2, 0.12); HM.box(mb, x, z, g + 3.25, g + 4.15, e.L / 2 + 0.1, 0.14, yaw, BLACK); }   // storefront cornice (black, over the window heads)
    const np = Math.max(2, Math.round(e.L / 4.5)); for (let i = 0; i <= np; i++) { const [x, z] = EP(Math.min(e.L - 0.25, Math.max(0.25, e.L * i / np)), 0.06); HM.box(mb, x, z, g + 4.15, top - 0.75, 0.25, 0.08, yaw, PIL); } // pilasters
    for (let s = 0.3; s < e.L - 0.2; s += 0.55) { const [x, z] = EP(s, 0.16); HM.box(mb, x, z, top - 0.95, top - 0.78, 0.12, 0.1, yaw, DENT); } // dentils
  }
  // the name over the Main Street storefront
  { const e = main, yaw = Math.atan2(e.nx, e.nz); const w = Math.min(e.L * 0.55, 7.5); const [x, z] = [e.a[0] + e.tx * e.L * 0.45 + e.nx * 0.24, e.a[1] + e.tz * e.L * 0.45 + e.nz * 0.24];
    const s = signMesh(T, textTexture([['MAIN & MILL', 112, '#f1ece0', 60, 700], ['OYSTER BAR & TAVERN', 60, '#f1ece0', 140, 600]], { w: 1024, h: 180, bg: '#1d1d1f' }), w, w * 180 / 1024, true); s.position.set(x, g + 3.95, z); s.rotation.y = yaw; T.group.add(s); }
  // round-arched doorway on Mill Street, near the corner
  if (mill) { const e = mill, yaw = Math.atan2(e.nx, e.nz); const dMain = Math.hypot(e.a[0] - main.mx, e.a[1] - main.mz) < Math.hypot(e.b[0] - main.mx, e.b[1] - main.mz) ? 3.2 : e.L - 3.2;
    const EP = (s, o) => [e.a[0] + e.tx * s + e.nx * o, e.a[1] + e.tz * s + e.nz * o]; const ds = Math.min(e.L - 1.4, Math.max(1.4, dMain)); const y0 = H(...EP(ds, 0)); const hw = 0.95, hS = 2.35;
    { const [x, z] = EP(ds, 0.1); HM.box(mb, x, z, y0, y0 + hS, hw, 0.06, yaw, C('#2b1f1a')); HM.box(mb, x, z, y0 + 0.9, y0 + 2.1, 0.02, 0.07, yaw, C('#151515')); }
    for (let i = 0; i < 12; i++) { const a0 = Math.PI * i / 12, a1 = Math.PI * (i + 1) / 12; const P = (a, r, o) => { const [x, z] = EP(ds + Math.cos(a) * r, o); return [x, y0 + hS + Math.sin(a) * r, z]; };
      mb.quad(P(a0, 0, 0.11), P(a1, 0, 0.11), P(a1, hw, 0.11), P(a0, hw, 0.11), [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], C('#2b1f1a'));   // arched door top
      mb.quad(P(a0, hw, 0.13), P(a1, hw, 0.13), P(a1, hw + 0.32, 0.13), P(a0, hw + 0.32, 0.13), [0, 0], [0, 0], [0, 0], [0, 0], [e.nx, 0, e.nz], C('#7c3a2a')); } // brick arch ring
  }
}

// ---------- "Winterville Welcomes You" mural ----------
// Painted on the side of the Dollar General at West Main and Mill streets (8 ft × 20 ft): a cheerful
// garden scene — tiger lilies, roses, dogwood, forsythia, bees round a hive, birds — with the greeting.
// (An original painting in that spirit, not a copy of the artist's work.)
const MURALS = { 1144052972: { street: /Mill/, w: 6.1, h: 2.45, y: 0.9 } };
function muralTex() {
  if (MAT.wvMural) return MAT.wvMural;
  const W = 1024, Hh = 412, c = cnv(W, Hh), g = c.getContext('2d'); const r = mulberry32(28590);
  const sky = g.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, '#8fd0f0'); sky.addColorStop(0.6, '#d9f1fb'); sky.addColorStop(1, '#bfe3a1'); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#7cc25a'; g.beginPath(); g.moveTo(0, Hh); for (let x = 0; x <= W; x += 32) g.lineTo(x, Hh - 120 - Math.sin(x / 90) * 18); g.lineTo(W, Hh); g.fill();
  const branch = (x, y, len, a, col, blossom) => { g.strokeStyle = '#6b4b32'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y); const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; g.lineTo(ex, ey); g.stroke(); for (let i = 0; i < 9; i++) { const t = 0.3 + r() * 0.7; const px = x + (ex - x) * t + (r() - 0.5) * 30, py = y + (ey - y) * t + (r() - 0.5) * 30; g.fillStyle = col; for (let k = 0; k < (blossom ? 4 : 5); k++) { g.beginPath(); g.ellipse(px + Math.cos(k * 1.57 + 0.5) * 7, py + Math.sin(k * 1.57 + 0.5) * 7, 7, 4, k * 1.57, 0, 7); g.fill(); } g.fillStyle = '#d9b44a'; g.beginPath(); g.arc(px, py, 2.5, 0, 7); g.fill(); } };
  branch(0, 70, 230, 0.15, '#fbf6f2', true); branch(W, 60, 220, Math.PI - 0.2, '#fbf6f2', true);                 // dogwood
  for (let i = 0; i < 26; i++) { const x = 40 + r() * 180, y = Hh - 60 - r() * 160; g.strokeStyle = '#7a8a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 40); g.lineTo(x + (r() - 0.5) * 30, y); g.stroke(); g.fillStyle = '#f2c51a'; g.fillRect(x - 4, y - 3, 8, 6); } // forsythia
  const lily = (x, y) => { g.strokeStyle = '#3d7a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, Hh); g.quadraticCurveTo(x - 10, y + 60, x, y); g.stroke(); g.fillStyle = '#f07b1f'; for (let k = 0; k < 6; k++) { g.save(); g.translate(x, y); g.rotate(k * Math.PI / 3); g.beginPath(); g.ellipse(0, -16, 7, 18, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#7a2a10'; for (let k = 0; k < 8; k++) g.fillRect(x - 10 + r() * 20, y - 10 + r() * 20, 2, 2); };
  const rose = (x, y, col) => { g.strokeStyle = '#2f6a25'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, Hh); g.lineTo(x + 4, y); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x + 4, y, 15, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(x + 4, y, 15 - k * 4, k, k + 4); g.stroke(); } };
  for (let i = 0; i < 9; i++) lily(250 + i * 70 + r() * 30, Hh - 110 - r() * 60);
  for (let i = 0; i < 10; i++) rose(820 + (i % 5) * 38 + r() * 10, Hh - 70 - Math.floor(i / 5) * 55 - r() * 20, ['#d42a4a', '#e8577a', '#c21f3a'][i % 3]);
  // hive and bees, birds
  g.fillStyle = '#d9a43a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(120, 170 + k * 16, 34 - Math.abs(k - 2) * 6, 10, 0, 0, 7); g.fill(); g.strokeStyle = '#9a6b1f'; g.lineWidth = 2; g.stroke(); } g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(120, 222, 6, 0, 7); g.fill();
  for (let i = 0; i < 9; i++) { const x = 150 + r() * 220, y = 120 + r() * 120; g.fillStyle = '#f2c51a'; g.beginPath(); g.ellipse(x, y, 7, 5, 0, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.fillRect(x - 2, y - 5, 2, 10); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(x - 2, y - 7, 4, 3, 0, 0, 7); g.fill(); }
  const bird = (x, y, col, s) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 20 * s, 12 * s, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 17 * s, y - 8 * s, 9 * s, 0, 7); g.fill(); g.fillStyle = '#f2a01a'; g.beginPath(); g.moveTo(x + 25 * s, y - 9 * s); g.lineTo(x + 34 * s, y - 6 * s); g.lineTo(x + 25 * s, y - 4 * s); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + 19 * s, y - 10 * s, 1.8 * s, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(x - 4 * s, y - 4 * s); g.lineTo(x - 26 * s, y - 26 * s); g.lineTo(x + 8 * s, y - 6 * s); g.fill(); };
  bird(700, 90, '#c8202a', 1.2); bird(860, 140, '#2a6fd0', 1.0); bird(560, 60, '#e8a21a', 0.9);
  // the greeting
  g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 86px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif'; g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.strokeText('Winterville', W / 2, 150); g.fillStyle = '#1f4f9a'; g.fillText('Winterville', W / 2, 150);
  g.font = '800 52px "Trebuchet MS", Arial, sans-serif'; g.lineWidth = 9; g.strokeText('Welcomes You', W / 2, 228); g.fillStyle = '#c8202a'; g.fillText('Welcomes You', W / 2, 228);
  g.strokeStyle = '#5a3a22'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, Hh - 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return MAT.wvMural = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
}
function paintMurals(T, P) {
  const W = T.W;
  for (const B of P.buildings) { const M = MURALS[B.id]; if (!M) continue; const [cx, cz] = centroid(B.ring); if (!(cx >= W.x0 && cx < W.x1 && cz >= W.z0 && cz < W.z1)) continue;
    const E = HM.edgesOf(B.ring).filter(e => e.L >= M.w + 0.6); if (!E.length) continue;
    for (const e of E) { const n = nearestRoad(e.mx + e.nx * 8, e.mz + e.nz * 8, 40, r => r.car); e.rn = n ? n.road.name || '' : ''; e.rd = n ? n.d : 99; }
    const e = E.find(q => M.street.test(q.rn)) || E.slice().sort((a, b) => a.rd - b.rd)[1] || E[0];
    const { g } = bldTop(B); const m = new THREE.Mesh(new THREE.PlaneGeometry(M.w, M.h), muralTex()); m.position.set(e.mx + e.nx * 0.06, g + M.y + M.h / 2, e.mz + e.nz * 0.06); m.rotation.y = Math.atan2(e.nx, e.nz); m.receiveShadow = true; T.group.add(m); }
}
