// =====================================================================
// DETAILED CARS — real 3D models (built in Blender and other modelling tools; see
// public-data/vehicles/CREDITS.md) for the player's car and part of the traffic.
//   • each .glb is downloaded once and then kept in the browser (IndexedDB, like the map data), so
//     later games start without downloading them again
//   • the files are pre-converted (tools in the repo history): body + wheel_fl/fr/rl/rr groups whose
//     origin is the wheel centre, wheels on y = 0, facing +z, paint material named "paint"
//   • traffic uses the simplified *_lod.glb copies; the procedural sedans/SUVs/pickups fill the rest
// =====================================================================
const CAR_MODELS = {
  ferrari: { name: 'Ferrari 458 Spider', file: 'ferrari', paint: 0xb3121a, tail: /taillight/i, share: 0.04 },
  p911: { name: 'Porsche 911 Carrera 4S', file: 'p911', paint: 0x9aa0a6, tail: /^lights$/i, share: 0.06 },
  concept: { name: 'Concept supercar', file: 'concept', paint: 0x1a1d22, tail: /brakelight/i, share: 0.03 },
  lexus: { name: 'Lexus RX SUV', file: 'lexus', paint: 0xe9e9e6, tail: null, share: 0.3 },
};
const CAR_MODEL_VERSION = 1; // bump when the files in public-data/vehicles change (re-downloads them once)
const CarModels = {
  cache: {}, ready: {}, failed: {},
  bases() {
    const b = [window.GV_DATA ? window.GV_DATA + 'vehicles/' : 'public-data/vehicles/'];
    b.push('https://raw.githubusercontent.com/bgates284/-greenville-open-world/main/public-data/vehicles/'); // the double-clickable build reads them from GitHub
    return b;
  },
  async bytes(file) {
    const key = `car:v${CAR_MODEL_VERSION}:${file}`;
    try { const b = await Store.get('models', key); if (b && b.byteLength > 1000) return b; } catch (e) { }
    let err;
    for (const base of this.bases()) {
      try { const r = await fetch(base + file + '.glb'); if (!r.ok) throw new Error(r.status + ' ' + base); const buf = await r.arrayBuffer(); Store.put('models', key, buf).catch(() => { }); return buf; }
      catch (e) { err = e; }
    }
    throw err || new Error('car model unavailable');
  },
  // → Promise of { scene, info }
  load(file) {
    if (!this.cache[file]) this.cache[file] = this.bytes(file).then(buf => new Promise((res, rej) => {
      const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
      l.parse(buf, '', g => {
        const root = g.scene.getObjectByName('car') || g.scene; const info = root.userData.gvCar || {};
        root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; const m = o.material; if (m && m.name === 'paint') o.userData.paint = true; } });
        this.ready[file] = { scene: root, info }; res(this.ready[file]);
      }, rej);
    })).catch(e => { this.failed[file] = true; console.warn('car model', file, 'unavailable:', e.message || e); throw e; });
    return this.cache[file];
  },
  paintMats: new Map(),
  paintFor(src, hex) { // one paint material per (model paint, colour)
    const k = src.uuid + ':' + hex; let m = this.paintMats.get(k);
    if (!m) { m = src.clone(); m.color.set(hex); if (m.isMeshPhysicalMaterial) { m.clearcoat = Math.max(m.clearcoat, 0.8); m.clearcoatRoughness = 0.08; } m.roughness = Math.min(m.roughness, 0.38); this.paintMats.set(k, m); }
    return m;
  },
  // a copy of a loaded model with its own paint colour; meshes share geometry with the original
  instance(file, hex) {
    const R = this.ready[file]; if (!R) return null;
    const g = R.scene.clone(true); g.name = 'car-' + file;
    g.traverse(o => { if (o.isMesh && o.userData.paint) o.material = this.paintFor(o.material, hex); });
    const W = {}; for (const k of ['fl', 'fr', 'rl', 'rr']) W[k] = g.getObjectByName('wheel_' + k);
    return { g, W, info: R.info };
  },
  // traffic car: same userData as makeCarMesh (03_models.js): bodyG, wf/wr axle groups, r, tail
  trafficMesh(id, hex) {
    const M = CAR_MODELS[id]; const I = this.instance(M.file + '_lod', hex); if (!I) return null;
    const { g: src, W, info } = I; const g = new THREE.Group(); const bodyG = src; g.add(bodyG);
    const axle = (a, b) => { const ax = new THREE.Group(); if (!a || !b) return ax; ax.position.set(0, (a.position.y + b.position.y) / 2, (a.position.z + b.position.z) / 2); for (const w of [a, b]) { const p = w.position.clone(); w.removeFromParent(); ax.add(w); w.position.set(p.x, p.y - ax.position.y, p.z - ax.position.z); } g.add(ax); return ax; };
    const wf = axle(W.fl, W.fr), wr = axle(W.rl, W.rr);
    let tail = null; bodyG.traverse(o => { if (!tail && o.isMesh && M.tail && M.tail.test(o.material.name || '')) tail = o; });
    if (!tail) { tail = new THREE.Mesh(new THREE.BoxGeometry(info.width ? info.width * 0.7 : 1.4, 0.05, 0.03), MAT.taillight); tail.position.set(0, (info.height || 1.4) * 0.62, -(info.len || 4.6) / 2 + 0.02); bodyG.add(tail); }
    const r = (W.fl && info.wheels && info.wheels.fl && info.wheels.fl.r) || 0.36;
    Object.assign(g.userData, { type: id, bodyG, wf, wr, r, spin: 0, tail, head: null, detailed: true });
    return { obj: g, len: info.len || 4.6 };
  },
  // start loading the traffic copies (medium/high graphics)
  preloadTraffic() { if (this._pre) return; this._pre = true; for (const id in CAR_MODELS) this.load(CAR_MODELS[id].file + '_lod').catch(() => { }); },
  // pick a detailed traffic car for random number u (or null → use a procedural one)
  pickTraffic(u) {
    let acc = 0; for (const id in CAR_MODELS) { acc += CAR_MODELS[id].share; if (u < acc) return this.ready[CAR_MODELS[id].file + '_lod'] ? id : null; }
    return null;
  },
};

// ---------- the player's garage ----------
const Garage = {
  choices: [['classic', 'Blue coupe (original)'], ...Object.entries(CAR_MODELS).map(([id, m]) => [id, m.name])],
  colors: [['Factory', 0], ['Rosso red', 0xb3121a], ['Ocean blue', 0x1745c4], ['ECU purple', 0x4b1f78], ['Pirate gold', 0xd9a520], ['Black', 0x0d0e10], ['Silver', 0xa7acb1], ['White', 0xefefec], ['British green', 0x1f4a32], ['Sunset orange', 0xe2621b]],
  pick() { try { return { id: localStorage.getItem('gv-car') || 'ferrari', color: +(localStorage.getItem('gv-car-color') || 0) }; } catch (e) { return { id: 'ferrari', color: 0 }; } },
  save(id, color) { try { localStorage.setItem('gv-car', id); localStorage.setItem('gv-car-color', String(color)); } catch (e) { } },
  // builds { g, wheels: [{piv, spin, front}], tailMat, wheelR } for the player (same shape as buildSportsCar)
  async build(id, color) {
    if (id === 'classic' || !CAR_MODELS[id]) { const SC = buildSportsCar(color || 0x1745c4); SC.wheelR = 0.36; return SC; }
    const M = CAR_MODELS[id]; const file = Q === QUALITY.low ? M.file + '_lod' : M.file; // Low graphics: the simplified copy
    await CarModels.load(file);
    const I = CarModels.instance(file, color || M.paint); const { g, W, info } = I;
    const wheels = [];
    for (const k of ['fl', 'fr', 'rl', 'rr']) { const w = W[k]; if (!w) continue; const piv = new THREE.Group(); piv.position.copy(w.position); w.removeFromParent(); w.position.set(0, 0, 0); const spin = new THREE.Group(); spin.add(w); piv.add(spin); g.add(piv); wheels.push({ piv, spin, front: k[0] === 'f' }); }
    // brake/tail lights: a clone of the model's own tail-light material (or a light bar) that the game can brighten
    let tailMat = null; g.traverse(o => { if (o.isMesh && M.tail && M.tail.test(o.material.name || '')) { if (!tailMat) { tailMat = o.material.clone(); tailMat.emissive = new THREE.Color(0xff1a10); } o.material = tailMat; } });
    if (!tailMat) { tailMat = MAT.taillight.clone(); const bar = new THREE.Mesh(new THREE.BoxGeometry((info.width || 1.9) * 0.72, 0.05, 0.03), tailMat); bar.position.set(0, (info.height || 1.4) * 0.62, -(info.len || 4.6) / 2 + 0.01); g.add(bar); }
    return { g, wheels, tailMat, wheelR: (info.wheels && info.wheels.fl && info.wheels.fl.r) || 0.36, info };
  },
};
