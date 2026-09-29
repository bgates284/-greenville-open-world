
// =====================================================================
// TRAFFIC SIGNALS (span-wire signals, synchronized cycle)
// =====================================================================
const SIG_PERIOD = 38;
function sigState(axisA, t) { // 2 green, 1 yellow, 0 red
  const p = t % SIG_PERIOD;
  if (axisA) return p < 15 ? 2 : p < 18.5 ? 1 : 0;
  return p >= 19 && p < 34 ? 2 : p >= 34 && p < 37.5 ? 1 : 0;
}
function updateSignalLights(t) {
  for (const ax of ['A', 'B']) { const st = sigState(ax === 'A', t); MAT.sig[ax + 'r'].emissiveIntensity = st === 0 ? 4 : 0.03; MAT.sig[ax + 'y'].emissiveIntensity = st === 1 ? 4 : 0.03; MAT.sig[ax + 'g'].emissiveIntensity = st === 2 ? 4 : 0.03; }
}

// shared graph walking for cars and pedestrians
function segOf(a) { const r = a.road; const p0 = r.pts[a.i], p1 = r.pts[a.i + a.dir]; const dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const L = Math.hypot(dx, dz) || 0.001; return { p0, p1, dx: dx / L, dz: dz / L, L }; }
function nextOptions(a, allow) {
  const r = a.road, j = a.i + a.dir, nid = r.nodes[j]; const adj = World.nodeAdj.get(nid) || []; const out = [];
  const cur = segOf(a);
  for (const { road, idx } of adj) {
    if (!allow(road) || road.removed) continue;
    for (const d of [1, -1]) {
      if (idx + d < 0 || idx + d >= road.pts.length) continue;
      if (allow === carAllow && road.oneway && road.oneway !== d) continue;
      const uturn = road === r && idx === j && d === -a.dir; if (uturn) continue;
      const q0 = road.pts[idx], q1 = road.pts[idx + d]; let ex = q1[0] - q0[0], ez = q1[1] - q0[1]; const l = Math.hypot(ex, ez) || 1; ex /= l; ez /= l;
      out.push({ road, i: idx, dir: d, dot: ex * cur.dx + ez * cur.dz });
    }
  }
  return out;
}
const carAllow = r => r.ai;
const pedAllow = r => r.ped;
function chooseNext(a, allow, rnd) {
  const opts = nextOptions(a, allow);
  if (!opts.length) { // dead end: turn around if allowed
    const r = a.road; const j = a.i + a.dir;
    if (allow === pedAllow || !r.oneway) return { road: r, i: j, dir: -a.dir, dot: -1 };
    return null;
  }
  let best = null, bs = -1e9;
  for (const o of opts) { const sc = o.dot * 1.4 + (o.road === a.road ? 0.6 : 0) + (o.road.rank || 0) * 0.08 + rnd() * 1.6; if (sc > bs) { bs = sc; best = o; } }
  return best;
}

// =====================================================================
// TRAFFIC
// =====================================================================
const Traffic = {
  cars: [], honked: 0, rnd: mulberry32(1234), t: 0,
  laneOffset(c) { return laneCenterOffset(c.road, c.dir, c.lane); },
  spawn(focus) {
    const r = this.rnd; const ang = r() * Math.PI * 2, d = 90 + r() * 260;
    const x = focus.x + Math.cos(ang) * d, z = focus.z + Math.sin(ang) * d;
    const n = nearestRoad(x, z, 70, rd => rd.ai && !rd.removed); if (!n) return;
    const road = n.road; let dir = road.oneway ? road.oneway : (r() < 0.5 ? 1 : -1);
    let i = n.i, s = n.t; if (dir === -1) { i = n.i + 1; s = 1 - n.t; }
    const c = { road, i, dir, s: 0, speed: 0, lane: Math.floor(r() * 3), drive: 0.85 + r() * 0.25, wait: 0, stopped: null, bump: 0, yaw: 0, ox: 0, oz: 0, stuck: 0, next: null };
    const sg = segOf(c); c.s = s * sg.L;
    const px = sg.p0[0] + sg.dx * c.s, pz = sg.p0[1] + sg.dz * c.s;
    if (Math.hypot(px - focus.x, pz - focus.z) < 60) return;
    for (const o of this.cars) if (Math.hypot(o.x - px, o.z - pz) < 16) return;
    c.speed = road.v * 0.7; c.yaw = Math.atan2(sg.dx, sg.dz);
    const type = pick(CAR_TYPES, r()); const col = pick(CAR_COLORS, r());
    c.obj = makeCarMesh(type, col); c.len = GEO.car[type].len; dynRoot.add(c.obj);
    const lo = this.laneOffset(c); c.ox = -sg.dz * lo; c.oz = sg.dx * lo; c.x = px + c.ox; c.z = pz + c.oz;
    c.next = chooseNext(c, carAllow, r);
    this.cars.push(c);
  },
  remove(c) { c.obj.removeFromParent(); this.cars.splice(this.cars.indexOf(c), 1); },
  update(dt, focus, simT) {
    this.t = simT;
    const want = Math.round(Q.traffic * (Env.night > 0.6 ? 0.6 : 1));
    for (let k = 0; k < 3 && this.cars.length < want; k++) this.spawn(focus);
    const P = Player; const pc = P.car;
    for (let ci = this.cars.length - 1; ci >= 0; ci--) {
      const c = this.cars[ci];
      if (c.road.removed || Math.hypot(c.x - focus.x, c.z - focus.z) > 520 || (c.stuck > 40 && Math.hypot(c.x - focus.x, c.z - focus.z) > 80) || this.cars.length > want + 4 && Math.hypot(c.x - focus.x, c.z - focus.z) > 300) { this.remove(c); continue; }
      const sg = segOf(c); const remain = sg.L - c.s;
      let vDes = c.road.v * c.drive;
      // look ahead: gap to the vehicle in front
      let gap = 1e9;
      const x = c.x, z = c.z;
      for (const o of this.cars) { if (o === c) continue; const rx = o.x - x, rz = o.z - z; const al = rx * sg.dx + rz * sg.dz; if (al <= 0 || al > 45) continue; const lat = Math.abs(rx * sg.dz - rz * sg.dx); if (lat < 2.1) gap = Math.min(gap, al - (o.len + c.len) / 2); }
      { const rx = pc.pos.x - x, rz = pc.pos.z - z; const al = rx * sg.dx + rz * sg.dz; const lat = Math.abs(rx * sg.dz - rz * sg.dx); if (al > 0 && al < 45 && lat < 2.3) gap = Math.min(gap, al - 3.6); }
      if (P.mode === 'walk') { const rx = P.pos.x - x, rz = P.pos.z - z; const al = rx * sg.dx + rz * sg.dz; const lat = Math.abs(rx * sg.dz - rz * sg.dx); if (al > 0 && al < 30 && lat < 1.9) gap = Math.min(gap, al - 3); }
      for (const p of Peds.list) { if (p.state === 'walk' && !p.onRoad) continue; const rx = p.x - x, rz = p.z - z; const al = rx * sg.dx + rz * sg.dz; const lat = Math.abs(rx * sg.dz - rz * sg.dx); if (al > 0 && al < 25 && lat < 1.8) gap = Math.min(gap, al - 3); }
      if (gap < 60) vDes = Math.min(vDes, Math.max(0, gap - 3) * 0.75);
      // slow for sharp turns
      if (c.next && remain < 28) { const turn = 1 - clamp(c.next.dot, -1, 1); if (turn > 0.3) vDes = Math.min(vDes, lerp(12, 5, clamp(turn, 0, 1)) + remain * 0.25); }
      // traffic signals & stop signs at the upcoming node
      const nid = c.road.nodes[c.i + c.dir]; const sig = World.signals.get(nid);
      if (sig && remain < 60) {
        const st = sigState(Math.abs(sg.dx * sig.ax + sg.dz * sig.az) > 0.7071, simT);
        const stopD = remain - (c.road.w / 2 + 5);
        if ((st === 0 || (st === 1 && stopD > 10)) && stopD > -1.5) vDes = Math.min(vDes, stopD < 0.4 ? 0 : Math.sqrt(2 * 3.2 * stopD));
      } else if (World.stops.has(nid) && c.stopped !== nid && remain < 35) {
        const stopD = remain - 2.5; vDes = Math.min(vDes, stopD < 0.3 ? 0 : Math.sqrt(2 * 3 * stopD));
        if (c.speed < 0.3 && stopD < 1.5) { c.wait += dt; if (c.wait > 1.4) { c.stopped = nid; c.wait = 0; } }
      }
      if (c.bump > 0) { c.bump -= dt; vDes = 0; }
      if (c.speed < vDes) c.speed = Math.min(vDes, c.speed + 2.6 * dt); else c.speed = Math.max(vDes, c.speed - 9 * dt);
      c.stuck = c.speed < 0.2 ? c.stuck + dt : 0;
      c.braking = vDes < c.speed - 0.5 || c.speed < 0.2;
      // move along the graph
      c.s += c.speed * dt; let guard = 0;
      while (c.s >= segOf(c).L && guard++ < 8) {
        c.s -= segOf(c).L; const n = c.next || chooseNext(c, carAllow, this.rnd);
        if (!n) { c.stuck = 999; c.s = segOf(c).L; break; }
        c.road = n.road; c.i = n.i; c.dir = n.dir; c.next = chooseNext(c, carAllow, this.rnd); c.stopped = c.stopped === nid ? c.stopped : null;
      }
      const g2 = segOf(c); const px = g2.p0[0] + g2.dx * c.s, pz = g2.p0[1] + g2.dz * c.s;
      const lo = this.laneOffset(c); const k = Math.min(1, dt * 4);
      c.ox += (-g2.dz * lo - c.ox) * k; c.oz += (g2.dx * lo - c.oz) * k;
      c.x = px + c.ox; c.z = pz + c.oz;
      let y;
      if (c.road.bridge) { const iMin = Math.min(c.i, c.i + c.dir); const t = c.dir > 0 ? c.s / g2.L : 1 - c.s / g2.L; y = deckHeight(c.road, iMin, t) + 0.08; }
      else y = H(c.x, c.z) + 0.24;
      c.yaw += angleDiff(c.yaw, Math.atan2(g2.dx, g2.dz)) * Math.min(1, dt * 5);
      c.obj.position.set(c.x, y, c.z); c.obj.rotation.y = c.yaw;
      { const ud = c.obj.userData; ud.spin += c.speed * dt / ud.r; ud.wf.rotation.x = ud.wr.rotation.x = ud.spin;
        const acc = (c.speed - (c.lastV ?? c.speed)) / Math.max(dt, 1e-3); c.lastV = c.speed; c.pitch = lerp(c.pitch || 0, clamp(-acc * 0.006, -0.03, 0.03), Math.min(1, dt * 5)); ud.bodyG.rotation.x = c.pitch; }
      c.obj.userData.tail.material = c.braking ? Traffic.brakeMat() : MAT.taillight;
    }
    this.honked = 0;
  },
  brakeMat() { if (!this._bm) { this._bm = MAT.taillight.clone(); } this._bm.emissiveIntensity = 4 + Env.night * 2; return this._bm; },
  collidePlayerCar(C) {
    const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
    for (const c of this.cars) {
      if (Math.abs(c.x - C.pos.x) > 8 || Math.abs(c.z - C.pos.z) > 8) continue;
      const cf = [Math.sin(c.yaw), Math.cos(c.yaw)]; const half = c.len / 2 - 0.9;
      for (const k of [1.35, -1.35]) for (const kk of [half, -half]) {
        const ax = C.pos.x + fx * k, az = C.pos.z + fz * k, bx = c.x + cf[0] * kk, bz = c.z + cf[1] * kk;
        const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz);
        if (d < 1.95 && d > 1e-3) {
          const push = 1.95 - d; C.pos.x += dx / d * push; C.pos.z += dz / d * push;
          const imp = Math.abs(C.speed); C.speed *= 0.55; c.bump = 2.5; c.speed *= 0.3;
          if (imp > 4) { Sound.thud(imp); UI.shake(Math.min(1, imp / 25)); }
        }
      }
    }
  },
};

// =====================================================================
// PEDESTRIANS
// =====================================================================
const Peds = {
  list: [], rnd: mulberry32(777), seed: 10,
  offset(p) { const r = p.road; if (!r.car) return p.side * 0.4; return p.side * (r.w / 2 + (r.sidewalk ? 1.35 : 0.7)); },
  yOff(p) { const r = p.road; return r.car ? (r.sidewalk ? 0.33 : 0.2) : 0.03; },
  spawn(focus) {
    const r = this.rnd; const ang = r() * Math.PI * 2, d = 25 + r() * 120;
    const x = focus.x + Math.cos(ang) * d, z = focus.z + Math.sin(ang) * d;
    const n = nearestRoad(x, z, 50, rd => rd.ped && !rd.removed && (!rd.car || rd.sidewalk || rd.rank <= 3)); if (!n) return;
    const dir = r() < 0.5 ? 1 : -1; let i = n.i, s = n.t; if (dir === -1) { i = n.i + 1; s = 1 - n.t; }
    const p = { road: n.road, i, dir, s: 0, speed: 1.05 + r() * 0.55, side: r() < 0.5 ? 1 : -1, state: 'walk', t: 0, x: 0, z: 0, yaw: 0, ox: 0, oz: 0, lat: 0, latV: 0, hop: 0 };
    const sg = segOf(p); p.s = s * sg.L;
    const hr = nearHospital(x, z) ? mulberry32(this.seed * 31) : null; let hp = null;
    if (hr) { const u = hr(); try { hp = realPerson(u < 0.2 ? 'doctor' : u < 0.52 ? 'nurse' : u < 0.62 ? 'patient' : 'visitor', hr); } catch (e) { } } // hospital: staff, patients in gowns, visitors
    p.person = hp || makeNpc(this.seed, x, z) || makePerson(this.seed, hr ? hospitalLook(mulberry32(this.seed * 31)) : undefined); this.seed++; dynRoot.add(p.person.g);
    const lo = this.offset(p); const fdx = p.road.pts[Math.min(p.i, p.i + p.dir) + 1][0] - p.road.pts[Math.min(p.i, p.i + p.dir)][0], fdz = p.road.pts[Math.min(p.i, p.i + p.dir) + 1][1] - p.road.pts[Math.min(p.i, p.i + p.dir)][1]; const fl = Math.hypot(fdx, fdz) || 1;
    p.ox = -fdz / fl * lo; p.oz = fdx / fl * lo;
    p.x = sg.p0[0] + sg.dx * p.s + p.ox; p.z = sg.p0[1] + sg.dz * p.s + p.oz;
    if (insideBuilding(p.x, p.z)) { disposePerson(p.person); return; }
    this.list.push(p);
  },
  crowd: [],
  spawnCrowd(x, z, n) {
    for (const c of this.crowd) disposePerson(c.person); this.crowd = [];
    // a loose group standing together a few metres from you, on open ground
    let cx = x, cz = z; const r = this.rnd;
    for (let k = 0; k < 12; k++) { const a = r() * Math.PI * 2, d = 4 + r() * 3; const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (!insideBuilding(px, pz) && !onRoadSurface(px, pz)) { cx = px; cz = pz; break; } }
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + r() * 0.4, d = 1.1 + r() * 0.6; let px = cx + Math.sin(a) * d, pz = cz + Math.cos(a) * d;
      const f = freeSpot(px, pz); px = f[0]; pz = f[1];
      const p = { crowd: true, x: px, z: pz, yaw: Math.atan2(cx - px, cz - pz), state: 'idle', t: 0, gest: r() * 5, lat: 0, dodgeX: 0, dodgeZ: 0 };
      p.person = makeNpc(this.seed, px, pz) || makePerson(this.seed); this.seed++; dynRoot.add(p.person.g); this.crowd.push(p);
    }
  },
  upgradeCrowd(force) { // swap simple people for detailed ones once the character models have loaded
    for (const p of this.crowd) if (!p.person.npc || (force && !p.person.npc.rb)) { const n = makeNpc(this.seed++, p.x, p.z); if (n) { disposePerson(p.person); p.person = n; dynRoot.add(n.g); } }
  },
  updateCrowd(dt, focus) {
    const C = Player.car, sp = Player.mode === 'drive' ? C.speed : 0;
    for (let i = this.crowd.length - 1; i >= 0; i--) {
      const p = this.crowd[i]; const P = p.person;
      if (Math.hypot(p.x - focus.x, p.z - focus.z) > 190) { disposePerson(P); this.crowd.splice(i, 1); continue; }
      p.t += dt;
      // step away from a moving car
      const rx = p.x - C.pos.x, rz = p.z - C.pos.z, d = Math.hypot(rx, rz);
      if (Math.abs(sp) > 2 && d < 7 && d > 0.01) { p.x += rx / d * dt * 4; p.z += rz / d * dt * 4; }
      if (Player.mode === 'walk') { const dx = p.x - Player.pos.x, dz = p.z - Player.pos.z, dd = Math.hypot(dx, dz); if (dd < 0.7 && dd > 1e-3) { p.x = Player.pos.x + dx / dd * 0.7; p.z = Player.pos.z + dz / dd * 0.7; } }
      const g = P.g; g.position.set(p.x, groundY(p.x, p.z, H(p.x, p.z) + 1), p.z); g.rotation.set(0, p.yaw, 0);
      animatePerson(P, 0, dt); npcLook(P, p.yaw, p.x, p.z, dt);
      // talking gestures: raise a forearm now and then
      p.gest -= dt; if (p.gest < 0) { p.gest = 3 + this.rnd() * 6; p.gT = 1.2; }
      if (p.gT > 0) {
        p.gT -= dt;
        if (P.npc) { if (!p.spoke) { p.spoke = true; P.npc.talk = 1.5 + this.rnd() * 2; if (this.rnd() < 0.4) P.npc.nod(this.rnd() < 0.75 ? 'agree' : 'headshake'); } }
        else if (P.B) { const k = Math.sin((1.2 - p.gT) / 1.2 * Math.PI); P.B.uArmR.rotation.x = -0.5 * k; P.B.lArmR.rotation.x = -1.1 * k - 0.12; }
      } else p.spoke = false;
    }
  },
  remove(p) { disposePerson(p.person); this.list.splice(this.list.indexOf(p), 1); },
  update(dt, focus) {
    const want = Math.round(Q.peds * (Env.night > 0.6 ? 0.45 : 1) * (Env.rain > 0.5 ? 0.35 : 1));
    for (let k = 0; k < 2 && this.list.length < want; k++) this.spawn(focus);
    const P = Player, C = P.car; const drive = P.mode === 'drive';
    const cfx = Math.sin(C.yaw), cfz = Math.cos(C.yaw);
    for (let pi = this.list.length - 1; pi >= 0; pi--) {
      const p = this.list[pi];
      if (p.road.removed || Math.hypot(p.x - focus.x, p.z - focus.z) > 190 || this.list.length > want + 3 && Math.hypot(p.x - focus.x, p.z - focus.z) > 110) { this.remove(p); continue; }
      // react to the player's car
      if (p.state !== 'down') {
        const rx = p.x - C.pos.x, rz = p.z - C.pos.z; const al = rx * cfx + rz * cfz * 1; const lat = rx * cfz - rz * cfx; const sp = C.speed;
        const d = Math.hypot(rx, rz);
        if (d < 1.6 && Math.abs(sp) > 3.5) { p.state = 'down'; p.t = 0; p.fallDir = Math.sign(sp) ; Sound.thud(8); UI.toast('Watch out for pedestrians!'); }
        else if ((p.state === 'walk' || p.state === 'idle') && Math.abs(sp) > 2.5 && al * Math.sign(sp) > 0 && Math.abs(al) < 4 + Math.abs(sp) * 0.9 && Math.abs(lat) < 2.2) { p.state = 'dodge'; p.t = 0; p.latV = (lat >= 0 ? 1 : -1) * 5.5; p.hop = 3.2; }
      }
      p.t += dt;
      if (p.state === 'walk' && this.rnd() < dt * 0.012) { p.state = 'idle'; p.t = 0; p.idleT = 2 + this.rnd() * 6; }
      if (p.state === 'idle' && p.t > p.idleT) { p.state = 'walk'; p.t = 0; }
      if (p.state === 'down') { if (p.t > 3.2) { p.state = 'walk'; p.t = 0; } }
      else if (p.state === 'idle') { }
      else {
        if (p.state === 'dodge') { if (p.t > 0.55) { p.state = 'walk'; } }
        // walk along the path
        const sg = segOf(p); const sp = p.state === 'dodge' ? p.speed * 1.8 : p.speed;
        p.s += sp * dt; let guard = 0;
        while (p.s >= segOf(p).L && guard++ < 6) {
          p.s -= segOf(p).L; const n = chooseNext(p, pedAllow, this.rnd); if (!n) { p.dir = -p.dir; p.i += -p.dir; break; }
          p.road = n.road; p.i = n.i; p.dir = n.dir;
          if (this.rnd() < 0.08) { p.dir = -p.dir; p.i = p.i - p.dir; if (p.i < 0 || p.i >= p.road.pts.length || p.i + p.dir < 0 || p.i + p.dir >= p.road.pts.length) { p.i = n.i; p.dir = n.dir; } }
        }
      }
      const g2 = segOf(p);
      const lo0 = Math.min(p.i, p.i + p.dir); const a0 = p.road.pts[lo0], a1 = p.road.pts[lo0 + 1]; let fx = a1[0] - a0[0], fz = a1[1] - a0[1]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const lo = this.offset(p); const k = Math.min(1, dt * 3);
      p.ox += (-fz * lo - p.ox) * k; p.oz += (fx * lo - p.oz) * k;
      if (p.state === 'dodge') { p.lat += p.latV * dt; } else p.lat *= Math.max(0, 1 - dt * 0.6);
      const bx = g2.p0[0] + g2.dx * p.s + p.ox, bz = g2.p0[1] + g2.dz * p.s + p.oz;
      let nx = bx + (-cfz) * p.lat * 0 + (-g2.dz) * p.lat, nz = bz + g2.dx * p.lat;
      // keep out of buildings & away from the walking player
      if (P.mode === 'walk') { const dx = nx - P.pos.x, dz = nz - P.pos.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-3) { nx = P.pos.x + dx / d * 0.7; nz = P.pos.z + dz / d * 0.7; } }
      p.x = nx; p.z = nz; p.onRoad = p.road.car && !p.road.sidewalk && Math.abs(p.lat) > 0.5;
      p.hop = Math.max(0, p.hop - dt * 12);
      let y = p.road.bridge ? deckHeight(p.road, lo0, p.dir > 0 ? p.s / g2.L : 1 - p.s / g2.L) + 0.05 : groundY(p.x, p.z, H(p.x, p.z) + 1);
      const hopY = p.state === 'dodge' ? Math.sin(Math.min(1, p.t / 0.55) * Math.PI) * 0.45 : 0;
      const g = p.person.g; g.position.set(p.x, y + hopY, p.z);
      if (p.state === 'down') {
        const f = Math.min(1, p.t / 0.35); g.rotation.set(-Math.PI / 2 * f * (p.t < 2.6 ? 1 : Math.max(0, 1 - (p.t - 2.6) / 0.6)), p.yaw, 0, 'YXZ'); g.position.y = y + 0.15 * f;
        animatePerson(p.person, 0, dt);
      } else {
        const wy = Math.atan2(g2.dx, g2.dz); p.yaw += angleDiff(p.yaw, wy) * Math.min(1, dt * 6);
        g.rotation.set(0, p.yaw, 0); animatePerson(p.person, p.state === 'dodge' ? 3 : p.state === 'idle' ? 0 : p.speed, dt, p.state === 'dodge'); npcLook(p.person, p.yaw, p.x, p.z, dt);
      }
    }
  },
};
