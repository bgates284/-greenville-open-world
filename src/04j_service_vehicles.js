// =====================================================================
// SERVICE VEHICLES — detailed modern emergency vehicles, built in code (no downloads):
//   • police: Ford Police Interceptor Utility–style SUV, black with white doors, LED light bar,
//     push bumper, spotlight
//   • engine: custom-cab fire pumper (Pierce-style), red over white roof, roll-up compartment
//     doors, ladders, chrome bumper, gold/red rear chevrons
//   • rescue: heavy rescue on the same custom cab with a tall walk-around body
//   • ambulance: Type III box ambulance on a van cutaway chassis, white with red stripe and
//     Star of Life
// Each is a THREE.Group, ground at y = 0, nose toward +z, driver's side toward +x. Wheels are
// separate spinning groups (front ones steer): userData.wheels = [{ spin, piv, front }]. Light-bar
// materials are in userData.flash for blinking.
// =====================================================================
const SV = {
  mats: {},
  mat(key, make) { return this.mats[key] || (this.mats[key] = make()); },
  paint(hex) { return this.mat('p' + hex, () => new THREE.MeshPhysicalMaterial({ color: hex, metalness: 0.35, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.08 })); },
  glass() { return this.mat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x1c2833, metalness: 0.55, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.6 })); },
  chrome() { return this.mat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xdde2e6, metalness: 1, roughness: 0.16 })); },
  alu() { return this.mat('alu', () => new THREE.MeshStandardMaterial({ color: 0xb9bec3, metalness: 0.85, roughness: 0.35 })); },
  black() { return this.mat('black', () => new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0.2, roughness: 0.6 })); },
  rubber() { return this.mat('rubber', () => new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.92 })); },
  glow(hex, k = 2) { return this.mat('g' + hex + k, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.3 })); },
  lens(hex) { return this.mat('l' + hex, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 })); },
  tex(key, w, h, draw) { return this.mat('t' + key, () => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }); },
};
// ---- geometry helpers ----
// a body side profile (in z/y), extruded across the width with rounded edges; nose toward +z
function svProfile(pts, width, arches, bevel = 0.06) {
  const s = new THREE.Shape(); const [z0, y0] = pts[0]; s.moveTo(z0, y0);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  // bottom edge back toward the start, stepping round the wheel arches (front first)
  const yb = pts[pts.length - 1][1]; const A = arches.slice().sort((a, b) => b.z - a.z);
  for (const a of A) { s.lineTo(a.z + a.r, yb); s.absarc(a.z, Math.max(yb, a.y), a.r, 0, Math.PI, false); s.lineTo(a.z - a.r, yb); }
  s.lineTo(z0, yb); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14, steps: 1 });
  g.rotateY(-Math.PI / 2); g.translate(width / 2 - bevel, 0, 0); g.computeVertexNormals(); return g;
}
function svBox(w, h, d, x, y, z, r = 0) { // rounded box (r = corner radius)
  let g; if (r > 0) { const s = new THREE.Shape(); const hw = w / 2 - r, hh = h / 2 - r; s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.absarc(hw, -hh, r, -Math.PI / 2, 0); s.lineTo(w / 2, hh); s.absarc(hw, hh, r, 0, Math.PI / 2); s.lineTo(-hw, h / 2); s.absarc(-hw, hh, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -hh); s.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5);
    g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: 0, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -(d - r * 2) / 2); }
  else g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z); return g;
}
function svMesh(parent, geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = false; parent.add(m); return m; }
function svQuad(parent, w, h, x, y, z, ry, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; }
// a wheel: tire (rounded), rim with spokes, hub; returns the spinning group
function svWheel(r, w, rimCol, dual) {
  const g = new THREE.Group();
  const prof = []; const n = 10; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; prof.push(new THREE.Vector2(r - w * 0.14 + Math.cos(a) * w * 0.14, Math.sin(a) * w / 2)); }
  prof.unshift(new THREE.Vector2(r * 0.66, -w / 2)); prof.push(new THREE.Vector2(r * 0.66, w / 2));
  const tireG = new THREE.LatheGeometry(prof, 28); tireG.rotateZ(Math.PI / 2);
  const offs = dual ? [-w * 0.52, w * 0.52] : [0];
  for (const o of offs) {
    const t = svMesh(g, tireG.clone(), SV.rubber()); t.position.x = o;
    const rim = new THREE.CylinderGeometry(r * 0.66, r * 0.66, w * 0.82, 24, 1, true); rim.rotateZ(Math.PI / 2); const rm = svMesh(g, rim, rimCol, false); rm.position.x = o;
  }
  // wheel face (both sides) with spokes painted on
  const faceT = SV.tex('rimface' + (rimCol === SV.chrome() ? 'c' : 'b'), 128, 128, (x, W) => { const c = W / 2; x.fillStyle = '#16181a'; x.fillRect(0, 0, W, W); x.fillStyle = rimCol === SV.chrome() ? '#d9dee2' : '#2a2d31'; x.beginPath(); x.arc(c, c, c * 0.98, 0, 7); x.fill(); x.fillStyle = '#0a0b0c'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; x.beginPath(); x.ellipse(c + Math.cos(a) * c * 0.58, c + Math.sin(a) * c * 0.58, c * 0.2, c * 0.11, a, 0, 7); x.fill(); } x.fillStyle = rimCol === SV.chrome() ? '#eef1f3' : '#3a3e43'; x.beginPath(); x.arc(c, c, c * 0.24, 0, 7); x.fill(); x.fillStyle = '#555'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * c * 0.14, c + Math.sin(a) * c * 0.14, c * 0.03, 0, 7); x.fill(); } });
  const faceM = SV.mat('rimfaceM' + faceT.uuid, () => new THREE.MeshStandardMaterial({ map: faceT, metalness: 0.7, roughness: 0.3 }));
  const fg = new THREE.CircleGeometry(r * 0.66, 24); fg.rotateY(Math.PI / 2);
  const ext = dual ? w * 1.04 : w * 0.41; for (const s of [-1, 1]) { const f = svMesh(g, fg.clone(), faceM, false); f.position.x = s * ext; if (s < 0) f.rotation.y = Math.PI; }
  return g;
}
function svAddWheels(G, axles, r, w, rimCol) { // axles: [{ z, track, front, dual }]
  const list = [];
  for (const a of axles) for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * a.track / 2, r, a.z); G.add(piv);
    const spin = svWheel(r, w, rimCol, a.dual); piv.add(spin); list.push({ spin, piv, front: !!a.front });
  }
  return list;
}
// emergency light bar along x (centre at x,y,z), alternating red and blue LED heads
function svLightBar(G, len, x, y, z, flash, cols = [0xff1a1a, 0x1a4dff]) {
  svMesh(G, svBox(len, 0.07, 0.34, x, y + 0.035, z, 0.03), SV.black());
  const n = Math.max(4, Math.round(len / 0.2)); const segW = (len - 0.06) / n;
  for (let i = 0; i < n; i++) { const left = i < n / 2; const col = cols[left ? 0 : 1]; const m = svFM(flash, col, left ? 0 : 1);
    svMesh(G, svBox(segW - 0.015, 0.09, 0.3, x - len / 2 + 0.03 + segW * (i + 0.5), y + 0.115, z, 0.02), m, false); }
}
// one flashing material per (colour, side) per vehicle, so the light heads merge into a few meshes
function svFM(flash, col, side) { let f = flash.find(e => e.col === col && e.side === side); if (!f) { f = { m: SV.lens(col).clone(), side, col }; flash.push(f); } return f.m; }
// lettering / graphics on a transparent canvas, as a decal plane
function svDecal(G, key, w, h, x, y, z, ry, draw, px = 1024) {
  const t = SV.tex(key, px, Math.round(px * h / w), (g, W, H) => { g.clearRect(0, 0, W, H); draw(g, W, H); });
  const m = SV.mat('dm' + key, () => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -4 }));
  return svQuad(G, w, h, x, y, z, ry, m);
}
function svMirrorDecals(G, key, w, h, xs, y, z, draw) { svDecal(G, key, w, h, xs, y, z, Math.PI / 2, draw); svDecal(G, key, w, h, -xs, y, z, -Math.PI / 2, draw); } // both sides, reading front-to-back correctly
function svHeadTail(G, W, zF, zR, yH, yT, wl = 0.34) {
  for (const s of [-1, 1]) { svMesh(G, svBox(wl, 0.13, 0.05, s * (W / 2 - wl / 2 - 0.08), yH, zF, 0.02), SV.glow(0xfff6e0, 1.2), false); svMesh(G, svBox(0.22, 0.24, 0.05, s * (W / 2 - 0.16), yT, zR, 0.02), SV.lens(0xc40d0d), false); }
}
// ---------------------------------------------------------------------
function makeSvcPolice() {
  const G = new THREE.Group(), flash = []; const W = 2.0, L = 5.05, r = 0.375, wb = 3.03, tr = 1.72;
  const arches = [{ z: wb / 2 + 0.05, y: r, r: r + 0.07 }, { z: -wb / 2 + 0.05, y: r, r: r + 0.07 }];
  const low = [[-2.5, 0.42], [-2.55, 0.98], [-2.52, 1.24], [1.32, 1.24], [2.25, 1.05], [2.5, 0.87], [2.53, 0.62], [2.46, 0.36]];
  svMesh(G, svProfile(low, W, arches, 0.1), SV.paint(0x111214));
  const gh = [[-2.42, 1.2], [-2.34, 1.64], [-2.2, 1.78], [-0.4, 1.8], [0.42, 1.77], [1.36, 1.2]];
  svMesh(G, svProfile(gh, W - 0.18, [], 0.08), SV.glass());
  const P = SV.paint(0x111214), gw = (W - 0.18) / 2 + 0.01;
  svMesh(G, svBox(W - 0.26, 0.05, 2.65, 0, 1.79, -0.9, 0.02), P, false); // roof skin
  const strut = (z0, y0, z1, y1, t = 0.09) => { const L2 = Math.hypot(z1 - z0, y1 - y0); for (const sd of [-1, 1]) { const g = new THREE.BoxGeometry(0.03, t, L2); g.rotateX(-Math.atan2(y1 - y0, z1 - z0)); g.translate(sd * gw, (y0 + y1) / 2, (z0 + z1) / 2); svMesh(G, g, P, false); } };
  strut(0.42, 1.77, 1.36, 1.2, 0.11); strut(0.18, 1.78, 0.18, 1.22, 0.12); strut(-1.05, 1.79, -1.05, 1.22, 0.1); strut(-2.2, 1.78, -2.42, 1.2, 0.16); strut(-2.42, 1.22, 1.36, 1.22, 0.04);
  // white front & rear doors (the classic two-tone)
  for (const s of [-1, 1]) { const p = svMesh(G, new THREE.PlaneGeometry(2.3, 0.66), SV.paint(0xf3f3f1), false); p.position.set(s * (W / 2 + 0.002), 0.88, 0.1); p.rotation.y = s * Math.PI / 2; }
  // grille, push bumper, lights, mirrors, spotlight
  svMesh(G, svBox(1.3, 0.3, 0.06, 0, 0.82, 2.5, 0.04), SV.black(), false);
  svMesh(G, svBox(1.5, 0.08, 0.1, 0, 0.5, 2.68), SV.black()); for (const s of [-0.55, 0.55]) svMesh(G, svBox(0.08, 0.6, 0.1, s, 0.72, 2.66), SV.black()); svMesh(G, svBox(1.2, 0.08, 0.1, 0, 0.98, 2.64), SV.black());
  svHeadTail(G, W, 2.5, -2.56, 0.98, 1.08, 0.42);
  for (const s of [-1, 1]) svMesh(G, svBox(0.06, 0.34, 0.5, s * (W / 2 - 0.02), 1.06, -2.3, 0.02), SV.lens(0xc40d0d), false); // wrap-around tail lamps
  svMesh(G, svBox(W - 0.1, 0.22, 0.12, 0, 0.5, -2.56, 0.04), SV.black()); svMesh(G, svBox(0.52, 0.26, 0.02, 0, 0.86, -2.575), SV.paint(0xf2f0e6), false);
  for (const s of [-1, 1]) { svMesh(G, svBox(0.24, 0.16, 0.12, s * (W / 2 + 0.1), 1.3, 1.05, 0.04), SV.black()); }
  svMesh(G, new THREE.CylinderGeometry(0.07, 0.06, 0.16, 12).rotateX(Math.PI / 2).translate(W / 2 + 0.02, 1.42, 1.0), SV.chrome(), false);
  // roof rails + light bar, front & rear flashers in the grille / rear glass
  for (const s of [-1, 1]) svMesh(G, svBox(0.04, 0.04, 2.2, s * 0.74, 1.84, -1.0), SV.black(), false);
  svLightBar(G, 1.5, 0, 1.81, 0.1, flash);
  for (const s of [-1, 1]) { const m = svFM(flash, s > 0 ? 0xff1a1a : 0x1a4dff, s > 0 ? 0 : 1); svMesh(G, svBox(0.18, 0.05, 0.04, s * 0.32, 0.82, 2.54), m, false); }
  // graphics: POLICE on the white doors, WINTERVILLE above, stripe, unit number on the roof
  svMirrorDecals(G, 'pol-door', 2.2, 0.56, W / 2 + 0.006, 0.86, 0.12, (g, Wd, Hd) => {
    g.fillStyle = '#1d3f7a'; g.fillRect(0, Hd * 0.72, Wd, Hd * 0.1); g.fillStyle = '#c8a24a'; g.fillRect(0, Hd * 0.84, Wd, Hd * 0.04);
    g.font = `900 ${Hd * 0.42}px Arial Black, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#16181b'; g.fillText('POLICE', Wd * 0.5, Hd * 0.36);
    g.font = `700 ${Hd * 0.12}px Arial, sans-serif`; g.fillStyle = '#1d3f7a'; g.fillText('WINTERVILLE  ·  NORTH CAROLINA', Wd * 0.5, Hd * 0.63); });
  svMirrorDecals(G, 'pol-911', 0.7, 0.18, W / 2 + 0.006, 1.02, -1.75, (g, Wd, Hd) => { g.font = `800 ${Hd * 0.8}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f2f2f2'; g.fillText('DIAL 911', Wd / 2, Hd / 2); }, 256);
  svDecal(G, 'pol-roof', 0.9, 0.5, 0, 1.802, -1.2, 0, (g, Wd, Hd) => { g.font = `900 ${Hd * 0.8}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f2f2f2'; g.fillText('12', Wd / 2, Hd / 2); }, 256).rotation.x = -Math.PI / 2;
  G.userData.wheels = svAddWheels(G, [{ z: wb / 2 + 0.05, track: tr, front: true }, { z: -wb / 2 + 0.05, track: tr }], r, 0.26, SV.black());
  G.userData.flash = flash; G.userData.size = { len: L, width: W, height: 1.9, cz: 0, y0: 0 }; return G;
}
// shared custom fire cab (Pierce-style): flat face, big windshield, raised crew roof
function svFireCab(G, W, zF, flash, red) {
  const cab = [[zF - 3.15, 0.75], [zF - 3.15, 3.05], [zF - 1.45, 3.05], [zF - 1.2, 2.88], [zF - 0.18, 2.88], [zF, 2.7], [zF + 0.04, 1.6], [zF, 0.75]];
  svMesh(G, svProfile(cab, W, [{ z: zF - 1.45, y: 0.55, r: 0.62 }], 0.1), red);
  svMesh(G, svBox(W - 0.04, 0.08, 3.1, 0, 3.08, zF - 1.6, 0.03), SV.paint(0xf4f4f2), false); // white roof
  // windshield (two-piece), side windows, crew windows
  const ws = svMesh(G, new THREE.PlaneGeometry(W - 0.3, 0.95), SV.glass(), false); ws.position.set(0, 2.22, zF + 0.035); ws.rotation.x = -0.05;
  svMesh(G, svBox(0.06, 0.95, 0.03, 0, 2.22, zF + 0.05), SV.black(), false);
  for (const s of [-1, 1]) { svQuad(G, 0.85, 0.85, s * (W / 2 + 0.003), 2.25, zF - 0.62, s * Math.PI / 2, SV.glass()); svQuad(G, 0.8, 0.7, s * (W / 2 + 0.003), 2.4, zF - 2.0, s * Math.PI / 2, SV.glass()); svQuad(G, 0.6, 0.7, s * (W / 2 + 0.003), 2.4, zF - 2.8, s * Math.PI / 2, SV.glass()); }
  // chrome front bumper, grille, headlight clusters, mirrors, roof light bar, grille flashers
  svMesh(G, svBox(W + 0.04, 0.34, 0.3, 0, 0.72, zF + 0.18, 0.06), SV.chrome());
  svMesh(G, svBox(1.3, 0.75, 0.05, 0, 1.25, zF + 0.04, 0.03), SV.chrome(), false);
  for (let k = 0; k < 6; k++) svMesh(G, svBox(1.2, 0.04, 0.02, 0, 0.96 + k * 0.11, zF + 0.07), SV.black(), false);
  for (const s of [-1, 1]) { svMesh(G, svBox(0.42, 0.24, 0.05, s * (W / 2 - 0.32), 1.18, zF + 0.04, 0.03), SV.chrome(), false); for (const d of [-0.1, 0.1]) svMesh(G, new THREE.CircleGeometry(0.08, 14).translate(s * (W / 2 - 0.32) + d, 1.18, zF + 0.07), SV.glow(0xfff4dc, 1.2), false);
    const m = svFM(flash, s > 0 ? 0xff1a1a : 0xffffff, s > 0 ? 0 : 1); svMesh(G, svBox(0.3, 0.12, 0.05, s * (W / 2 - 0.32), 1.48, zF + 0.04, 0.02), m, false);
    svMesh(G, svBox(0.06, 0.55, 0.3, s * (W / 2 + 0.28), 2.1, zF - 0.35, 0.02), SV.chrome()); svMesh(G, svBox(0.04, 0.04, 0.5, s * (W / 2 + 0.14), 2.35, zF - 0.4), SV.chrome(), false); }
  svLightBar(G, W - 0.25, 0, 3.1, zF - 0.35, flash, [0xff1a1a, 0xff1a1a]);
  for (const s of [-1, 1]) { const m = svFM(flash, 0xff1a1a, s > 0 ? 0 : 1); svMesh(G, svBox(0.05, 0.16, 0.34, s * (W / 2 + 0.01), 2.95, zF - 0.4), m, false); }
  // door lettering
  svMirrorDecals(G, 'fire-cab', 1.6, 0.62, W / 2 + 0.006, 1.42, zF - 1.6, (g, Wd, Hd) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f1d27a'; g.strokeStyle = '#2a0c0c'; g.lineWidth = Hd * 0.03;
    g.font = `900 ${Hd * 0.26}px Georgia, serif`; g.strokeText('WINTERVILLE', Wd / 2, Hd * 0.28); g.fillText('WINTERVILLE', Wd / 2, Hd * 0.28);
    g.font = `800 ${Hd * 0.17}px Arial, sans-serif`; g.strokeText('FIRE · RESCUE · EMS', Wd / 2, Hd * 0.58); g.fillText('FIRE · RESCUE · EMS', Wd / 2, Hd * 0.58);
    g.fillStyle = '#f4f4f2'; g.fillRect(Wd * 0.05, Hd * 0.82, Wd * 0.9, Hd * 0.06); });
}
function svRollDoors(G, W, z0, z1, y0, y1, n) { // roll-up compartment doors on both sides
  const t = SV.tex('rolldoor', 128, 256, (g, Wd, Hd) => { for (let y = 0; y < Hd; y += 8) { const v = 196 + ((y / 8) % 2) * 22; g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(0, y, Wd, 8); } g.fillStyle = '#888'; g.fillRect(0, Hd - 14, Wd, 14); g.fillStyle = '#333'; g.fillRect(Wd * 0.35, Hd - 11, Wd * 0.3, 7); });
  const m = SV.mat('rolldoorM', () => new THREE.MeshStandardMaterial({ map: t, metalness: 0.75, roughness: 0.32 }));
  const span = (z1 - z0) / n;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const zc = z0 + span * (i + 0.5); svQuad(G, span - 0.12, y1 - y0, s * (W / 2 + 0.004), (y0 + y1) / 2, zc, s * Math.PI / 2, m); }
}
function svChevrons(G, W, z, y0, y1) { // red/yellow rear chevrons (NFPA)
  svDecal(G, 'chev', W - 0.2, y1 - y0, 0, (y0 + y1) / 2, z, Math.PI, (g, Wd, Hd) => { g.save(); g.beginPath(); g.rect(0, 0, Wd, Hd); g.clip(); const st = Hd * 0.5; for (let x = -Hd * 2, k = 0; x < Wd + Hd * 2; x += st, k++) { g.fillStyle = k % 2 ? '#d4141b' : '#f0d21a'; g.beginPath(); g.moveTo(x, Hd); g.lineTo(x + st, Hd); g.lineTo(x + st + Hd * 0.8, 0); g.lineTo(x + Hd * 0.8, 0); g.closePath(); g.fill(); } g.restore(); }, 512);
}
function makeSvcEngine() {
  const G = new THREE.Group(), flash = []; const W = 2.5, r = 0.55; const red = SV.paint(0xb3121a); const zF = 5.15;
  svFireCab(G, W, zF, flash, red);
  // pump panel & body
  svMesh(G, svBox(W, 2.25, 1.25, 0, 1.75, 1.35, 0.05), red); svMesh(G, svBox(W + 0.02, 1.2, 1.1, 0, 1.6, 1.35, 0.03), SV.alu());
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) svMesh(G, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10).rotateZ(Math.PI / 2).translate(s * (W / 2 + 0.06), 1.25 + (k % 3) * 0.3, 1.05 + Math.floor(k / 3) * 0.5), k % 2 ? SV.glow(0x2c63d6, 0.3) : SV.glow(0xd2b21c, 0.3), false);
  const body = [[-4.95, 0.75], [-4.95, 2.75], [0.72, 2.75], [0.72, 0.75]];
  svMesh(G, svProfile(body, W, [{ z: -2.2, y: 0.55, r: 0.66 }], 0.06), red);
  svRollDoors(G, W, -4.75, 0.6, 1.05, 2.55, 4);
  for (const s of [-1, 1]) { svMesh(G, svBox(0.03, 0.12, 5.6, s * (W / 2 + 0.01), 0.92, -2.15), SV.paint(0xf4f4f2), false); svMesh(G, svBox(0.03, 0.05, 5.6, s * (W / 2 + 0.012), 0.99, -2.15), SV.glow(0xd8b234, 0.15), false); }
  // hose bed, ladders on the side rack, rear step and chevrons, tail lights, rear flashers
  svMesh(G, svBox(W - 0.3, 0.22, 4.2, 0, 2.86, -2.5, 0.03), SV.black(), false);
  for (const c of [0xc82020, 0xe8e8e8, 0x2a5fc8]) { const i = [0xc82020, 0xe8e8e8, 0x2a5fc8].indexOf(c); svMesh(G, svBox(0.5, 0.18, 4.0, -0.7 + i * 0.7, 2.98, -2.5, 0.08), SV.mat('hose' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })), false); }
  for (const yy of [2.95, 3.25]) svMesh(G, svBox(0.06, 0.06, 5.2, W / 2 - 0.1, yy, -2.3), SV.alu(), false);
  for (let k = 0; k < 16; k++) svMesh(G, svBox(0.04, 0.34, 0.04, W / 2 - 0.1, 3.1, -4.8 + k * 0.33), SV.alu(), false);
  svMesh(G, svBox(W - 0.2, 0.12, 0.5, 0, 0.62, -5.15), SV.alu());
  svChevrons(G, W, -4.96, 0.85, 2.0);
  svHeadTail(G, W, zF + 0.05, -4.97, 1.18, 2.2);
  for (const s of [-1, 1]) { const m = svFM(flash, 0xff1a1a, s > 0 ? 0 : 1); svMesh(G, svBox(0.2, 0.2, 0.05, s * (W / 2 - 0.2), 2.5, -4.97, 0.03), m, false); }
  svMirrorDecals(G, 'fire-eng', 1.0, 0.19, W / 2 + 0.008, 2.65, -2.0, (g, Wd, Hd) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Hd * 0.7}px Arial, sans-serif`; g.fillStyle = '#f1d27a'; g.strokeStyle = '#2a0c0c'; g.lineWidth = Hd * 0.05; g.strokeText('ENGINE 1', Wd / 2, Hd / 2); g.fillText('ENGINE 1', Wd / 2, Hd / 2); }, 512);
  G.userData.wheels = svAddWheels(G, [{ z: zF - 1.45, track: 2.06, front: true }, { z: -2.2, track: 1.86, dual: true }], r, 0.32, SV.chrome());
  G.userData.flash = flash; G.userData.size = { len: 10.45, width: W, height: 3.3, cz: 0.1, y0: 0 }; return G;
}
function makeSvcRescue() {
  const G = new THREE.Group(), flash = []; const W = 2.5, r = 0.55; const red = SV.paint(0xb3121a); const zF = 4.85;
  svFireCab(G, W, zF, flash, red);
  const body = [[-4.85, 0.7], [-4.85, 3.25], [1.6, 3.25], [1.6, 0.7]];
  svMesh(G, svProfile(body, W + 0.06, [{ z: -2.0, y: 0.55, r: 0.66 }], 0.07), red);
  svMesh(G, svBox(W + 0.04, 0.1, 6.4, 0, 3.3, -1.62, 0.03), SV.paint(0xf4f4f2), false);
  svRollDoors(G, W + 0.06, -4.6, 1.45, 1.0, 3.0, 5);
  for (const s of [-1, 1]) svMesh(G, svBox(0.03, 0.16, 6.4, s * (W / 2 + 0.04), 0.86, -1.62), SV.paint(0xf4f4f2), false);
  svLightBar(G, W - 0.3, 0, 3.35, -4.6, flash, [0xff1a1a, 0xffb000]);
  for (const s of [-1, 1]) for (const z of [-4.75, 1.45]) { const m = svFM(flash, 0xff1a1a, (s > 0) ^ (z > 0) ? 0 : 1); svMesh(G, svBox(0.05, 0.2, 0.2, s * (W / 2 + 0.04), 3.05, z), m, false); }
  // light tower and scene lights on the roof
  svMesh(G, svBox(0.12, 0.6, 0.12, 0, 3.6, -0.5), SV.alu()); svMesh(G, svBox(1.2, 0.2, 0.15, 0, 3.95, -0.5, 0.03), SV.alu()); for (let k = -2; k <= 2; k++) svMesh(G, svBox(0.18, 0.14, 0.02, k * 0.22, 3.95, -0.42), SV.glow(0xfffbe8, 0.4), false);
  svChevrons(G, W, -4.88, 0.85, 2.4); svHeadTail(G, W, zF + 0.05, -4.88, 1.18, 2.6);
  svMirrorDecals(G, 'fire-res', 3.2, 0.48, W / 2 + 0.04, 3.0, -1.6, (g, Wd, Hd) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Hd * 0.7}px Arial, sans-serif`; g.fillStyle = '#f1d27a'; g.strokeStyle = '#2a0c0c'; g.lineWidth = Hd * 0.05; g.strokeText('HEAVY RESCUE', Wd / 2, Hd / 2); g.fillText('HEAVY RESCUE', Wd / 2, Hd / 2); }, 768);
  G.userData.wheels = svAddWheels(G, [{ z: zF - 1.45, track: 2.06, front: true }, { z: -2.0, track: 1.86, dual: true }], r, 0.32, SV.chrome());
  G.userData.flash = flash; G.userData.size = { len: 9.9, width: W + 0.06, height: 3.5, cz: 0, y0: 0 }; return G;
}
function makeSvcAmbulance() {
  const G = new THREE.Group(), flash = []; const r = 0.42; const white = SV.paint(0xf6f6f4); const Wc = 2.05, Wb = 2.36; const zF = 3.55;
  // van cutaway cab: hood + windshield + doors
  const cab = [[1.25, 0.55], [1.25, 2.35], [1.85, 2.38], [2.35, 2.25], [2.95, 1.42], [3.45, 1.28], [zF, 1.0], [zF, 0.62], [3.5, 0.45]];
  svMesh(G, svProfile(cab, Wc, [{ z: 2.75, y: r, r: r + 0.08 }], 0.08), white);
  { const m = svMesh(G, new THREE.PlaneGeometry(Wc - 0.2, 0.95), SV.glass(), false); m.position.set(0, 1.85, 2.66); m.rotation.x = -0.88; }
  for (const s of [-1, 1]) svQuad(G, 0.75, 0.62, s * (Wc / 2 + 0.003), 1.86, 2.0, s * Math.PI / 2, SV.glass());
  svMesh(G, svBox(1.4, 0.32, 0.06, 0, 1.0, zF + 0.01, 0.04), SV.chrome(), false); svMesh(G, svBox(Wc + 0.04, 0.24, 0.24, 0, 0.6, zF + 0.05, 0.05), SV.alu());
  svHeadTail(G, Wc, zF + 0.01, -3.7, 1.18, 1.0, 0.32);
  for (const s of [-1, 1]) svMesh(G, svBox(0.06, 0.3, 0.24, s * (Wc / 2 + 0.16), 1.92, 2.15, 0.02), SV.black());
  // the box module: rounded corners, red stripe, light bars, rear doors
  const box = svMesh(G, svBox(Wb, 2.45, 4.95, 0, 0.62 + 1.225 + 0.2, -1.25, 0.1), white); box.castShadow = true;
  for (const s of [-1, 1]) { svMesh(G, svBox(0.02, 0.3, 4.95, s * (Wb / 2 + 0.005), 1.35, -1.25), SV.paint(0xc81c22), false); svMesh(G, svBox(0.02, 0.06, 4.95, s * (Wb / 2 + 0.006), 1.58, -1.25), SV.paint(0x1d3f7a), false); }
  svMesh(G, svBox(2.0, 0.3, 0.02, 0, 1.35, 1.26), SV.paint(0xc81c22), false);
  for (const s of [-1, 1]) for (const z of [1.2, -3.7]) { const m = svFM(flash, 0xff1a1a, (s > 0) ^ (z < 0) ? 0 : 1); svMesh(G, svBox(0.32, 0.14, 0.06, s * (Wb / 2 - 0.25), 2.96, z + (z > 0 ? 0.04 : -0.04), 0.03), m, false); }
  svLightBar(G, 1.6, 0, 3.07, 1.08, flash, [0xff1a1a, 0xffffff]);
  for (const s of [-1, 1]) { const m = svFM(flash, 0xff1a1a, s > 0 ? 0 : 1); svMesh(G, svBox(0.02, 0.14, 0.32, s * (Wb / 2 + 0.01), 2.7, -0.2), m, false); svMesh(G, svBox(0.02, 0.14, 0.32, s * (Wb / 2 + 0.01), 2.7, -3.4), m, false); }
  svMesh(G, svBox(1.8, 2.05, 0.02, 0, 1.62, -3.735), SV.paint(0xe9e9e6), false); svMesh(G, svBox(0.02, 2.0, 0.03, 0, 1.62, -3.75), SV.black(), false); for (const s of [-1, 1]) svQuad(G, 0.62, 0.55, s * 0.45, 2.15, -3.75, Math.PI, SV.glass());
  svMesh(G, svBox(Wb - 0.3, 0.12, 0.4, 0, 0.55, -3.85), SV.alu());
  const star = (g, cx, cy, R) => { g.fillStyle = '#1f56d6'; for (let k = 0; k < 3; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI / 3); g.fillRect(-R * 0.22, -R, R * 0.44, R * 2); g.restore(); } g.fillStyle = '#fff'; g.fillRect(cx - R * 0.05, cy - R * 0.62, R * 0.1, R * 1.24); g.beginPath(); g.arc(cx, cy - R * 0.62, R * 0.1, 0, 7); g.fill(); };
  svMirrorDecals(G, 'amb-side', 4.6, 0.95, Wb / 2 + 0.01, 2.2, -1.25, (g, Wd, Hd) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Hd * 0.42}px Arial, sans-serif`; g.fillStyle = '#c81c22'; g.fillText('AMBULANCE', Wd * 0.42, Hd * 0.42); g.font = `700 ${Hd * 0.16}px Arial, sans-serif`; g.fillStyle = '#1d3f7a'; g.fillText('PITT COUNTY EMS', Wd * 0.42, Hd * 0.82); star(g, Wd * 0.88, Hd * 0.5, Hd * 0.42); });
  svDecal(G, 'amb-rear', 1.2, 0.6, 0, 2.62, -3.75, Math.PI, (g, Wd, Hd) => { star(g, Wd / 2, Hd / 2, Hd * 0.44); }, 256);
  svChevrons(G, Wb, -3.76, 0.75, 1.15);
  G.userData.wheels = svAddWheels(G, [{ z: 2.75, track: 1.76, front: true }, { z: -2.05, track: 1.68, dual: true }], r, 0.24, SV.chrome());
  G.userData.flash = flash; G.userData.size = { len: 7.45, width: Wb, height: 3.2, cz: -0.1, y0: 0 }; return G;
}
// blink every vehicle's light bar (call each frame with the game clock); on = true for full flash
function svFlash(G, t, on) {
  const F = G.userData.flash; if (!F) return;
  for (const f of F) { const ph = Math.floor(t * 3.2 + f.side * 1) % 2 === 0; const burst = Math.sin(t * 40) > 0; f.m.emissiveIntensity = on ? (ph && burst ? 9 : 0.3) : 0.25; }
}

// ---- one merged template per kind, cheap copies for every parked vehicle ----
// static parts are merged by material (a handful of draw calls per vehicle); wheels stay separate so
// they can spin and steer; each copy gets its own light-bar materials so only yours flashes.
const SVC_BUILD = { police: makeSvcPolice, engine: makeSvcEngine, rescue: makeSvcRescue, ambulance: makeSvcAmbulance };
const SVC_TPL = {};
function svMergeStatic(G) {
  const keep = new Set(); for (const w of G.userData.wheels) keep.add(w.piv); 
  const groups = new Map(); G.updateMatrixWorld(true); const drop = [];
  G.traverse(o => { if (!o.isMesh) return; let p = o.parent; while (p && p !== G) { if (keep.has(p)) return; p = p.parent; }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!/^(position|normal|uv)$/.test(k)) g.deleteAttribute(k);
    const key = o.material.uuid + (o.castShadow ? 's' : ''); if (!groups.has(key)) groups.set(key, { m: o.material, shadow: o.castShadow, gs: [] }); groups.get(key).gs.push(g); drop.push(o); });
  for (const o of drop) o.removeFromParent();
  for (const { m, shadow, gs } of groups.values()) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let k = 0;
    for (const g of gs) { P.set(g.attributes.position.array, k * 3); if (g.attributes.normal) N.set(g.attributes.normal.array, k * 3); U.set(g.attributes.uv.array, k * 2); k += g.attributes.position.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.computeBoundingSphere(); geo.userData.shared = true;
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = shadow; G.add(mesh);
  }
  G.userData.wheels.forEach((w, i) => { w.piv.name = 'svw' + i; w.spin.name = 'svs' + i; });
  G.userData.flash.forEach((f, i) => { f.m.name = 'svf' + i; });
  return G;
}
function makeServiceVehicle(kind) {
  const T = SVC_TPL[kind] || (SVC_TPL[kind] = svMergeStatic(SVC_BUILD[kind]()));
  const G = T.clone(true); const mats = new Map();
  G.traverse(o => { if (o.isMesh && o.material && /^svf/.test(o.material.name)) { if (!mats.has(o.material)) mats.set(o.material, o.material.clone()); o.material = mats.get(o.material); } });
  G.userData = { size: T.userData.size, kind, svc: true,
    wheels: T.userData.wheels.map((w, i) => ({ piv: G.getObjectByName('svw' + i), spin: G.getObjectByName('svs' + i), front: w.front })),
    flash: T.userData.flash.map(f => ({ m: mats.get(f.m) || f.m, side: f.side })) };
  return G;
}
