// =====================================================================
// DRIVE ANYTHING — walk up to any car in traffic, or a parked police car, fire engine, rescue truck
// or ambulance, and press E to take it. The car you were in stays parked where you left it (you can
// go back and drive it again), and whatever you take drives like your own car — bigger trucks are a
// little slower and wider.
// =====================================================================
const Rides = {
  parked: [], left: [],
  KINDS: { car: 'car', police: 'police car', engine: 'fire engine', rescue: 'rescue truck', ambulance: 'ambulance' },
  add(obj, kind) { obj.userData.ride = { kind }; this.parked.push(obj); }, // a parked service vehicle anyone can take
  inScene(o) { for (let p = o; p; p = p.parent) if (p === scene) return true; return false; },
  // the closest vehicle you're standing next to (not your current car — Player.toggleCar handles that)
  nearest(pos) {
    let best = null, bd = 1e9; const tryOne = (x, z, yaw, len, wid, item) => {
      const dx = pos.x - x, dz = pos.z - z, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const along = Math.abs(dx * fx + dz * fz) - len / 2, across = Math.abs(dx * fz - dz * fx) - wid / 2; const d = Math.max(along, across, 0);
      if (d < 1.6 && d < bd) { bd = d; best = item; } };
    for (const c of Traffic.cars) { if (c.bus || c.removed || c.wreck) continue; if (Math.abs(c.x - pos.x) > 9 || Math.abs(c.z - pos.z) > 9) continue; tryOne(c.x, c.z, c.yaw, c.len || 4.6, 1.9, { type: 'traffic', c }); }
    for (let i = this.parked.length - 1; i >= 0; i--) { const o = this.parked[i]; if (!o.parent) { this.parked.splice(i, 1); continue; }
      const w = o.getWorldPosition(new THREE.Vector3()); if (Math.abs(w.x - pos.x) > 12 || Math.abs(w.z - pos.z) > 12) continue; if (!this.inScene(o)) continue;
      const S = this.sizeOf(o); const yaw = o.getWorldQuaternion(new THREE.Quaternion()); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(yaw); const cx = w.x + f.x * S.cz, cz = w.z + f.z * S.cz;
      tryOne(cx, cz, Math.atan2(f.x, f.z), S.len, S.width, { type: 'parked', o }); }
    for (const L of this.left) tryOne(L.holder.position.x, L.holder.position.z, L.holder.rotation.y, (L.SC.info && L.SC.info.len) || 4.6, (L.SC.info && L.SC.info.width) || 1.9, { type: 'left', L });
    return best;
  },
  sizeOf(o) { // local-space size of a vehicle model (cached)
    if (o.userData.size) return o.userData.size;
    const b = new THREE.Box3(); o.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    o.traverse(m => { if (m.isMesh && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); b.union(bb); } });
    const s = b.isEmpty() ? { len: 4.6, width: 1.9, height: 1.5, cz: 0, y0: 0 } : { len: b.max.z - b.min.z, width: Math.min(2.6, b.max.x - b.min.x), height: b.max.y - b.min.y, cz: (b.max.z + b.min.z) / 2, y0: b.min.y };
    return o.userData.size = s;
  },
  label(it) { if (it.type === 'traffic') return 'car'; if (it.type === 'left') return it.L.name || 'car'; return this.KINDS[it.o.userData.ride.kind] || 'vehicle'; },
  // swap: park the car you're in (or just left) and take this one
  take(it) {
    const P = Player; let obj, SC, x, z, yaw, kind = 'car', name = 'car';
    if (it.type === 'traffic') {
      const c = it.c; obj = c.obj; x = c.x; z = c.z; yaw = c.yaw; c.removed = true; try { Phys.forget(c); } catch (e) { } Traffic.cars.splice(Traffic.cars.indexOf(c), 1); obj.removeFromParent();
      const ud = obj.userData; const tail = MAT.taillight.clone(); if (ud.tail) ud.tail.material = tail; if (ud.bodyG) ud.bodyG.rotation.x = 0;
      const wheels = []; if (ud.wf) wheels.push({ spin: ud.wf, piv: new THREE.Object3D(), front: true }); if (ud.wr) wheels.push({ spin: ud.wr, piv: new THREE.Object3D(), front: false });
      obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); const S = this.sizeOf(obj);
      SC = { g: obj, wheels, tailMat: tail, wheelR: ud.r || 0.34, info: { len: S.len, width: S.width, height: S.height } };
      UI.toast('You took the car — the driver jumps out and runs off!', 3500);
    } else if (it.type === 'parked') {
      const o = it.o; kind = o.userData.ride.kind; name = this.KINDS[kind]; const w = o.getWorldPosition(new THREE.Vector3()); const q = o.getWorldQuaternion(new THREE.Quaternion()); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const S = this.sizeOf(o); x = w.x + f.x * S.cz; z = w.z + f.z * S.cz; yaw = Math.atan2(f.x, f.z); o.removeFromParent(); this.parked.splice(this.parked.indexOf(o), 1);
      const g = new THREE.Group(); o.position.set(0, -0.17, -S.cz); o.rotation.set(0, 0, 0); g.add(o);
      SC = { g, wheels: [], tailMat: MAT.taillight.clone(), wheelR: 0.5, info: { len: S.len, width: S.width, height: S.height }, kind };
      UI.toast(`You're driving the ${name}` + (kind === 'police' || kind === 'engine' || kind === 'rescue' || kind === 'ambulance' ? ' — N for lights & siren' : ''), 4000);
    } else {
      const L = it.L; SC = L.SC; kind = L.kind; name = L.name; x = L.holder.position.x; z = L.holder.position.z; yaw = L.holder.rotation.y;
      L.holder.remove(SC.g); L.holder.removeFromParent(); this.left.splice(this.left.indexOf(L), 1);
      UI.toast('Back in your ' + name, 2500);
    }
    // leave the current one parked where it is
    const C = P.car; const old = { g: P.carVis, wheels: P.wheels, tailMat: P.tailMat, wheelR: P.wheelR, info: P.carInfo }; P.carVis = null;
    if (old.g) { old.g.removeFromParent(); const h = new THREE.Group(); h.position.copy(C.pos); h.rotation.y = C.yaw; h.add(old.g); dynRoot.add(h); old.tailMat.emissiveIntensity = 0.3;
      this.left.push({ holder: h, SC: old, kind: P.carKind || 'car', name: P.carName || 'car' });
      while (this.left.length > 4) { const D = this.left.shift(); D.holder.removeFromParent(); } }
    P.useCarVisual(SC); P.carKind = kind; P.carName = name === 'car' && it.type !== 'left' ? 'car' : name;
    C.pos.set(x, surfaceY(x, z) + 0.22, z); C.yaw = yaw; C.speed = 0; C.steer = 0; C.vy = 0; C.pitch = C.roll = 0; C.gear = 'D';
    C.vmax = { engine: 34, rescue: 36, ambulance: 42, police: 60 }[kind] || null;
    P.syncCar(0); P.enterCar();
  },
  // flashing light bar while driving a service vehicle with the siren on
  siren: false, sirenT: 0,
  tick(dt) {
    const P = Player; this.pruneT = (this.pruneT || 0) + dt; if (this.pruneT > 5) { this.pruneT = 0; this.parked = this.parked.filter(o => o.parent && this.inScene(o)); } const svc = P.mode === 'drive' && /^(police|engine|rescue|ambulance)$/.test(P.carKind || '');
    if (!svc) { if (this.siren) this.stopSiren(); return; }
    if (this.siren) { this.sirenT += dt; if (!this.light) { this.light = new THREE.PointLight(0xff2020, 0, 26, 2); dynRoot.add(this.light); }
      const ph = Math.floor(this.sirenT * 4) % 2; this.light.color.set(ph ? 0x2050ff : 0xff2020); this.light.intensity = 40;
      const f = new THREE.Vector3(Math.sin(P.car.yaw), 0, Math.cos(P.car.yaw)); this.light.position.copy(P.car.pos).addScaledVector(f, 0.5); this.light.position.y += ((P.carInfo && P.carInfo.height) || 1.6) + 0.4;
      if (this.osc && Sound.ctx) { const t = Sound.ctx.currentTime; this.osc.frequency.setTargetAtTime(P.carKind === 'engine' ? 600 + Math.sin(this.sirenT * 1.6) * 250 : (Math.floor(this.sirenT * 1.4) % 2 ? 960 : 720), t, 0.05); } }
  },
  toggleSiren() {
    this.siren = !this.siren; if (!this.siren) { this.stopSiren(); return; }
    this.sirenT = 0; const A = Sound.ctx; if (A) { try { const o = A.createOscillator(); o.type = 'square'; const g = A.createGain(); g.gain.value = 0.02; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; o.connect(lp); lp.connect(g); g.connect(A.destination); o.start(); this.osc = o; this.sg = g; } catch (e) { } }
  },
  stopSiren() { this.siren = false; if (this.osc) { try { this.osc.stop(); } catch (e) { } this.osc = null; } if (this.light) this.light.intensity = 0; },
};
