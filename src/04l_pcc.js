// =====================================================================
// PITT COMMUNITY COLLEGE (Winterville) — the grounds: the white clock tower on its brick base out
// on the lawn between the classroom buildings, and the curved brick "PITT COMMUNITY COLLEGE" sign
// with its flower bed at the campus entrance on the main road. (The buildings themselves — red brick,
// white trim, grey roofs, white columned porticos and glass entrance towers — are styled in
// 04f_landmarks.js.)
// =====================================================================
function pccClockMat() {
  if (MAT.pccClock) return MAT.pccClock;
  const c = cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill(); g.strokeStyle = '#1b1b1d'; g.lineWidth = 6; g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.lineWidth = i % 3 ? 4 : 8; g.beginPath(); g.moveTo(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); g.lineTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); g.stroke(); }
  const hand = (a, L, w) => { g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * L, 128 - Math.cos(a) * L); g.stroke(); };
  hand(-1.05, 56, 9); hand(1.05, 84, 6); g.fillStyle = '#1b1b1d'; g.beginPath(); g.arc(128, 128, 7, 0, 7); g.fill(); // ten past ten
  return MAT.pccClock = new THREE.MeshStandardMaterial({ map: ctex(c), roughness: 0.6 });
}

function pccGrounds(T, P, a, mb) {
  const W = T.W; const own = (x, z) => x >= W.x0 && x < W.x1 && z >= W.z0 && z < W.z1; const C = h => new THREE.Color(h);
  const ring = a.rings && a.rings[0]; if (!ring || ring.length < 3) return; const [acx, acz] = centroid(ring);
  const free = (x, z, r) => { if (nearestRoad(x, z, r, q => q.car) || nearestRoad(x, z, 3.5)) return false; for (const it of World.bldHash.query(x - r, z - r, x + r, z + r)) { const q = it.ring || (it.obj && it.obj.ring); if (!q) return false; let d = 1e9; for (let i = 0; i < q.length; i++) { const p = q[i], s = q[(i + 1) % q.length]; d = Math.min(d, segDist(x, z, p[0], p[1], s[0], s[1]).d); } if (d < r || pointInPoly(x, z, q)) return false; } return true; };
  // ---- the clock tower: on open lawn near the middle of the main classroom buildings ----
  const core = P.buildings.filter(B => /Reddrick|Fulford|Simon|Everett|Humber|Whichard|Vernon White/.test((B.tags && B.tags.name) || '')).map(B => centroid(B.ring));
  if (core.length >= 2) {
    const cx = core.reduce((s, p) => s + p[0], 0) / core.length, cz = core.reduce((s, p) => s + p[1], 0) / core.length;
    let spot = null; for (let r = 0; r <= 90 && !spot; r += 6) for (let k = 0; k < Math.max(1, r); k++) { const ang = k / Math.max(1, r) * Math.PI * 2; const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r; if (free(x, z, 10)) { spot = [x, z]; break; } }
    if (spot && own(spot[0], spot[1])) {
      const [x, z] = spot, g = H(x, z), BRICK = C('#9a4a36'), WHITE = C('#f6f5f1'), STONE = C('#d9d3c6');
      HM.geo(mb, new THREE.CylinderGeometry(6.5, 6.5, 0.1, 40), C('#c9c2b4'), x, g + 0.05, z);          // concrete plaza
      HM.box(mb, x, z, g, g + 3.4, 1.7, 1.7, 0, BRICK); HM.box(mb, x, z, g + 3.4, g + 3.7, 1.85, 1.85, 0, STONE);   // brick base, stone cap
      HM.box(mb, x, z, g + 3.7, g + 11.2, 1.35, 1.35, 0, WHITE);                                         // white shaft
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) HM.box(mb, x + dx * 1.3, z + dz * 1.3, g + 3.7, g + 11.2, 0.16, 0.16, 0, C('#e6e4de')); // corner pilasters
      HM.box(mb, x, z, g + 11.2, g + 13.4, 1.55, 1.55, 0, WHITE); HM.box(mb, x, z, g + 13.4, g + 13.7, 1.75, 1.75, 0, WHITE); // clock stage + cornice
      const cap = new THREE.ConeGeometry(1.6, 2.4, 4, 1); cap.rotateY(Math.PI / 4); HM.geo(mb, cap, C('#5b6166'), x, g + 14.9, z);
      HM.geo(mb, new THREE.CylinderGeometry(0.05, 0.08, 1.4, 6), C('#c9a227'), x, g + 16.6, z);
      const face = new THREE.PlaneGeometry(2.3, 2.3);
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(face, pccClockMat()); const ang = i * Math.PI / 2; m.position.set(x + Math.sin(ang) * 1.57, g + 12.3, z + Math.cos(ang) * 1.57); m.rotation.y = ang; T.group.add(m); }
      HM.solid(T, [[x - 1.85, z - 1.85], [x + 1.85, z - 1.85], [x + 1.85, z + 1.85], [x - 1.85, z + 1.85]], g + 13.7, 'PCC clock tower');
      (T.noTrees || (T.noTrees = [])).push([x, z, 8]);
    }
  }
  // ---- the entrance sign: where the campus meets the main road ----
  let best = null; for (const p of ring) { const nr = nearestRoad(p[0], p[1], 90, r => r.car && r.rank >= 5); if (nr && (!best || nr.d < best.nr.d)) best = { p, nr }; }
  if (best) {
    const tx = acx - best.p[0], tz = acz - best.p[1], tl = Math.hypot(tx, tz) || 1; let x = best.p[0], z = best.p[1];
    for (let k = 0; k < 12; k++) { x += tx / tl * 4; z += tz / tl * 4; if (!nearestRoad(x, z, 9) && free(x, z, 6)) break; }
    if (own(x, z)) {
      const nr = nearestRoad(x, z, 120, r => r.car && r.rank >= 5) || best.nr; const fx = nr.x - x, fz = nr.z - z, fl = Math.hypot(fx, fz) || 1; const nx = fx / fl, nz = fz / fl; // faces the road
      const yaw = Math.atan2(nx, nz), ux = nz, uz = -nx, g = H(x, z), BRICK = C('#9a4a36'), CAP = C('#e3dccb');
      for (let i = -6; i <= 6; i++) { const u = i * 0.75, bow = -(u * u) * 0.035; const px = x + ux * u + nx * bow, pz = z + uz * u + nz * bow; const h = 2.0 - Math.abs(i) * 0.06; // gently curved, a little taller in the middle
        HM.box(mb, px, pz, g - 0.2, g + h, 0.4, 0.3, yaw - Math.atan(u * 0.07), BRICK); HM.box(mb, px, pz, g + h, g + h + 0.18, 0.42, 0.36, yaw - Math.atan(u * 0.07), CAP); }
      for (const s of [-1, 1]) HM.box(mb, x + ux * s * 5.2 + nx * -0.95, z + uz * s * 5.2 + nz * -0.95, g - 0.2, g + 2.5, 0.45, 0.45, yaw, BRICK); // end piers
      const sg = signMesh(T, textTexture([['PITT', 150, '#f3ead8', 80, 800], ['COMMUNITY COLLEGE', 92, '#f3ead8', 190, 800]], { w: 1024, h: 256 }), 6.4, 1.6, false);
      sg.position.set(x + nx * 0.33, g + 1.15, z + nz * 0.33); sg.rotation.y = yaw; T.group.add(sg);
      const R = mulberry32(7123); const FL = ['#f2c230', '#d9352b', '#f4f1ea', '#e0782a', '#3f6b34', '#3f6b34'];
      for (let i = 0; i < 90; i++) { const u = (R() - 0.5) * 11, v = 0.7 + R() * 2.4; const s = 0.25 + R() * 0.2; HM.geo(mb, new THREE.IcosahedronGeometry(s, 0), C(FL[(R() * FL.length) | 0]), x + ux * u + nx * (v - u * u * 0.035), g + s * 0.5, z + uz * u + nz * (v - u * u * 0.035)); }
      HM.obstacle(T, x, z, 2.5); HM.obstacle(T, x + ux * 4, z + uz * 4, 1.8); HM.obstacle(T, x - ux * 4, z - uz * 4, 1.8);
      (T.noTrees || (T.noTrees = [])).push([x, z, 7]);
    }
  }
}
