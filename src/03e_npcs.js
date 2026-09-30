
// =====================================================================
// REALISTIC NPCs — glTF characters (Ready Player Me gentleman, Mixamo "Michelle")
// • animations retargeted ONCE at load ("baked") onto each model's own skeleton, so every
//   pedestrian just runs a cheap AnimationMixer
// • per-person variety: outfit / skin / hat tints, beard on/off, height & build
// • head + eye tracking toward you (slerped), breathing & weight-shift micro-motion,
//   talking mouths (blend shapes) and nods in the crowd, distance-based LOD
// =====================================================================
const NPC_SRC = {
  rpm: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/readyplayer.me.glb',
  michelle: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Michelle.glb',
  soldier: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Soldier.glb',
};
// canonical (Mixamo-style) bone names for Mixamo, Ready Player Me and 3ds Max Biped (Rocketbox) rigs
const BIPED = { Pelvis: 'Hips', Spine: 'Spine', Spine1: 'Spine1', Spine2: 'Spine2', Neck: 'Neck', Head: 'Head', LEye: 'LeftEye', REye: 'RightEye', MJaw: 'Jaw',
  L_Clavicle: 'LeftShoulder', L_UpperArm: 'LeftArm', L_Forearm: 'LeftForeArm', L_Hand: 'LeftHand', R_Clavicle: 'RightShoulder', R_UpperArm: 'RightArm', R_Forearm: 'RightForeArm', R_Hand: 'RightHand',
  L_Thigh: 'LeftUpLeg', L_Calf: 'LeftLeg', L_Foot: 'LeftFoot', L_Toe0: 'LeftToeBase', R_Thigh: 'RightUpLeg', R_Calf: 'RightLeg', R_Foot: 'RightFoot', R_Toe0: 'RightToeBase' };
for (const s of ['L', 'R']) { const S = s === 'L' ? 'Left' : 'Right'; [['0', 'Thumb'], ['1', 'Index'], ['2', 'Middle'], ['3', 'Ring'], ['4', 'Pinky']].forEach(([d, f]) => { BIPED[`${s}_Finger${d}`] = `${S}Hand${f}1`; BIPED[`${s}_Finger${d}1`] = `${S}Hand${f}2`; BIPED[`${s}_Finger${d}2`] = `${S}Hand${f}3`; }); }
const stripMx = n => { const m = n.match(/^Bip0?1[ _](.+)$/); if (m) return BIPED[m[1].replace(/ /g, '_')] || ('Bip_' + m[1]); return n.replace(/^mixamorig:?/, ''); };
const CANON_CHILD = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandMiddle1',
  RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandMiddle1', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };

// retarget helper: copies the source skeleton's world-space rotation changes onto the target skeleton
function buildRetarget(tgtRoot, srcScene) {
  const B = {}, S = {}; tgtRoot.traverse(o => { if (o.isBone) B[stripMx(o.name)] = o; }); srcScene.traverse(o => { if (o.isBone) S[stripMx(o.name)] = o; });
  tgtRoot.updateMatrixWorld(true); srcScene.updateMatrixWorld(true); // models are loaded in their rest pose
  const names = []; tgtRoot.traverse(o => { if (o.isBone && S[stripMx(o.name)]) names.push(stripMx(o.name)); });
  const restT = {}, restSInv = {}, posT = {}, posS = {}, cinv = {};
  for (const n of names) { restT[n] = B[n].getWorldQuaternion(new THREE.Quaternion()); restSInv[n] = S[n].getWorldQuaternion(new THREE.Quaternion()).invert(); posT[n] = B[n].getWorldPosition(new THREE.Vector3()); posS[n] = S[n].getWorldPosition(new THREE.Vector3()); }
  const childOf = b => { const bn = stripMx(b.name); const pref = CANON_CHILD[bn]; if (pref && S[pref] && B[pref]) return pref;
    for (const c of b.children) if (c.isBone) { const n = stripMx(c.name); if (S[n] && B[n]) return n; } return null; };
  for (const n of names) { const cn = childOf(B[n]); if (!cn) { cinv[n] = new THREE.Quaternion(); continue; } cinv[n] = new THREE.Quaternion().setFromUnitVectors(posS[cn].clone().sub(posS[n]).normalize(), posT[cn].clone().sub(posT[n]).normalize()).invert(); }
  const tw = {}, pq = new THREE.Quaternion(), hipS = posS.Hips, hipT = posT.Hips, ratio = hipS ? hipT.y / hipS.y : 1;
  return {
    B, names,
    apply() {
      srcScene.updateMatrixWorld(true);
      for (const n of names) {
        const b = B[n]; const w = S[n].getWorldQuaternion(new THREE.Quaternion()).multiply(restSInv[n]).multiply(cinv[n]).multiply(restT[n]); tw[n] = w;
        const pn = stripMx(b.parent.name); if (b.parent.isBone && tw[pn]) pq.copy(tw[pn]); else b.parent.getWorldQuaternion(pq);
        b.quaternion.copy(pq.invert().multiply(w));
      }
      if (B.Hips && hipS) { const hp = S.Hips.getWorldPosition(new THREE.Vector3()); const wp = hipT.clone(); wp.y += (hp.y - hipS.y) * ratio; tgtRoot.updateMatrixWorld(true); B.Hips.parent.worldToLocal(wp); B.Hips.position.copy(wp); }
    },
  };
}
function bakeClip(tgtRoot, srcScene, clip, fps = 30) {
  const saved = []; tgtRoot.traverse(o => { if (o.isBone) saved.push([o, o.quaternion.clone(), o.position.clone()]); });
  const rt = buildRetarget(tgtRoot, srcScene); const mixer = new THREE.AnimationMixer(srcScene); mixer.clipAction(clip).play();
  const frames = Math.max(2, Math.round(clip.duration * fps)); const times = [], q = {}, hip = []; for (const n of rt.names) q[n] = [];
  for (let f = 0; f <= frames; f++) {
    const t = Math.min(clip.duration, f / fps); mixer.setTime(t); rt.apply(); times.push(t);
    for (const n of rt.names) rt.B[n].quaternion.toArray(q[n], q[n].length);
    if (rt.B.Hips) rt.B.Hips.position.toArray(hip, hip.length);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(srcScene);
  const tracks = rt.names.map(n => new THREE.QuaternionKeyframeTrack(rt.B[n].name + '.quaternion', times, q[n]));
  if (rt.B.Hips) tracks.push(new THREE.VectorKeyframeTrack(rt.B.Hips.name + '.position', times, hip));
  for (const [o, q, p] of saved) { o.quaternion.copy(q); o.position.copy(p); } tgtRoot.updateMatrixWorld(true);
  return new THREE.AnimationClip(clip.name.toLowerCase(), clip.duration, tracks);
}

const NPCKit = {
  ready: false, loading: null, tpl: {}, cloneFn: null,
  async load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const { clone } = await import('three/addons/utils/SkeletonUtils.js'); this.cloneFn = clone;
        const xbot = await parseGLB(await fetchCached('anims:xbot', AVATAR_SRC.anims)); // private copy used only for baking
        const want = { idle: 1, walk: 1, run: 1, agree: 1, headshake: 1 }; const srcClips = xbot.animations.filter(c => want[c.name.toLowerCase()]);
        for (const key of ['rpm', 'michelle']) {
          try {
            const g = await parseGLB(await fetchCached('npc:' + key, NPC_SRC[key]));
            const root = g.scene; root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root, true); const h = box.max.y - box.min.y; const s = (key === 'rpm' ? 1.8 : 1.74) / Math.max(0.1, h);
            const wrap = new THREE.Group(); root.scale.multiplyScalar(s); root.position.y = -box.min.y * s; wrap.add(root); wrap.updateMatrixWorld(true);
            let clips;
            if (key === 'soldier') clips = g.animations.filter(c => /^(idle|walk|run)$/i.test(c.name)).map(c => { const cc = c.clone(); cc.name = c.name.toLowerCase(); cc.tracks = cc.tracks.filter(t => !/\.position$/.test(t.name) || /Hips/.test(t.name)); return cc; });
            else clips = srcClips.map(c => bakeClip(wrap, xbot.scene, c));
            for (const c of clips) if (c.name === 'agree' || c.name === 'headshake') THREE.AnimationUtils.makeClipAdditive(c);
            // strip horizontal root motion from hips so people stay on their path
            for (const c of clips) for (const t of c.tracks) if (/Hips\.position$/.test(t.name) && c.name !== 'agree' && c.name !== 'headshake') { const v = t.values; const x0 = v[0], z0 = v[2]; for (let k = 0; k < v.length; k += 3) { v[k] = x0; v[k + 2] = z0; } }
            this.tpl[key] = { wrap, clips };
          } catch (e) { console.warn('npc model failed', key, e); }
        }
        this.ready = Object.keys(this.tpl).length > 0; return this.ready;
      } catch (e) { console.warn('npc kit unavailable', e); return false; }
    })();
    return this.loading;
  },
};

const OUTFIT_TINTS = [0xffffff, 0x9fb7d8, 0x2f3a55, 0x6d2f86, 0xf2c230, 0x8a2a2a, 0x3e6a4a, 0xd0d0d0, 0x505050, 0xc9a27a, 0x1f5e5a, 0xe0b0b8];
const PANT_TINTS = [0xffffff, 0x3a4a6a, 0x2a2a2a, 0x7a6a50, 0x55607a, 0xb9ab8c, 0x404850];
const SKIN_TINTS = [1.0, 0.92, 0.8, 0.66, 0.52, 0.42, 0.34];
class NpcAvatar {
  constructor(kind, seed, opt = {}) {
    const T = NPCKit.tpl[kind]; const r = mulberry32(seed * 7919 + 3);
    this.kind = kind; this.npc = true; this.rb = !!T.rb; this.g = new THREE.Group();
    const inst = NPCKit.cloneFn(T.wrap); this.g.add(inst);
    this.B = null; this.bones = {}; inst.traverse(o => { if (o.isBone) this.bones[stripMx(o.name)] = o; });
    this.mats = []; this.morph = [];
    inst.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nm = mats.map(m => { const c = m.clone(); this.mats.push(c); return c; }); o.material = Array.isArray(o.material) ? nm : nm[0];
      if (o.morphTargetDictionary && o.morphTargetDictionary.mouthOpen !== undefined) this.morph.push([o, o.morphTargetDictionary.mouthOpen, o.morphTargetDictionary.mouthSmile]);
    });
    // variety
    const skinK = pick(SKIN_TINTS, r()); const warm = new THREE.Color(1, 0.93, 0.86);
    for (const m of this.mats) {
      const n = m.name || '';
      if (kind === 'rpm') {
        if (/Skin|Body/.test(n)) m.color.setRGB(skinK, skinK * warm.g, skinK * warm.b);
        else if (/Outfit_Top/.test(n)) m.color.set(pick(OUTFIT_TINTS, r()));
        else if (/Outfit_Bottom/.test(n)) m.color.set(pick(PANT_TINTS, r()));
        else if (/Footwear/.test(n)) m.color.set(pick([0xffffff, 0x404040, 0x8a6a4a], r()));
        else if (/Headwear/.test(n)) m.color.set(pick([0xffffff, 0x3a2a5a, 0x2a2a2a, 0x6a5a40, 0x4b1f78], r()));
      } else if (kind === 'michelle') { const k = 0.82 + r() * 0.18; m.color.setRGB(k, k * (0.9 + r() * 0.1), k * (0.88 + r() * 0.12)); }
    }
    if (T.rb) { // Rocketbox: skin tone via shader uniform, hair darkening, slight outfit variety
      if (opt.bodyMap) for (const m of this.mats) if (m.userData.maskKind === 'body') m.map = opt.bodyMap; // re-dressed clothes
      if (opt.hat && T.hatLocal && this.bones.Head) { const hat = makeHat(opt.hat.kind, opt.hat.color); hat.matrix.copy(T.hatLocal); hat.matrix.decompose(hat.position, hat.quaternion, hat.scale); this.bones.Head.add(hat); this.hat = hat; }
      for (const m of this.mats) { if (m.userData.skinU) { m.userData.skinU = { value: new THREE.Color().copy(opt.skinMul || new THREE.Color(1, 1, 1)) }; patchSkin(m, T.masks[m.userData.maskKind] || T.masks.body); } if (m.userData.isHair && opt.hairMul) m.color.copy(opt.hairMul); }
    }
    if (kind === 'rpm') { const beard = r() < 0.55; const hat = r() < 0.6; inst.traverse(o => { if (o.isMesh && /Beard/.test(o.name)) o.visible = beard; if (o.isMesh && (o.material?.name || '').includes('Headwear')) o.visible = hat; }); }
    const s = 0.93 + r() * 0.13, w = 0.94 + r() * 0.12; this.g.scale.set(s * w, s, s * w);
    // animation
    this.mixer = new THREE.AnimationMixer(inst); this.act = {};
    for (const c of T.clips) { const a = this.mixer.clipAction(c); if (c.name === 'agree' || c.name === 'headshake') { a.blendMode = THREE.AdditiveAnimationBlendMode; a.setLoop(THREE.LoopOnce, 1); } else { a.play(); a.setEffectiveWeight(c.name === 'idle' ? 1 : 0); a.time = r() * c.duration; } this.act[c.name] = a; }
    // bones no clip drives (eyes, jaw, face) — reset to rest each frame so procedural motion can't accumulate
    const driven = new Set(); for (const c of T.clips) for (const tr of c.tracks) driven.add(tr.name.split('.')[0]);
    // (eyes and jaw always: some rigs have a second node with the same name, so the clip track never reaches the real bone)
    this.free = []; inst.traverse(o => { if (o.isBone && (!driven.has(o.name) || /Eye|Jaw/i.test(o.name))) this.free.push([o, o.quaternion.clone().normalize()]); });
    this.lookQ = new THREE.Quaternion(); this.eyeQ = new THREE.Quaternion(); this.t = r() * 20; this.talk = 0; this.acc = 0; this.phase = 0;
  }
  // body poses layered on top of the idle/walk animation, as world-space turns of the joints
  // (works on any rig): sit (chair), curb, push, lean, vape (hand to mouth), iv (hand on a pole), kick
  applyPose(P) {
    const B = this.bones; this.g.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.g.getWorldQuaternion(new THREE.Quaternion())); fwd.y = 0; fwd.normalize();
    const lat = new THREE.Vector3().crossVectors(up, fwd).normalize(); // points to the person's left
    const R = (n, axis, a) => { const b = B[n]; if (!b || !a) return; b.updateMatrixWorld(true); addWorldRotation(b, rotAxis(axis, a)); b.updateMatrixWorld(true); };
    const k = P.k == null ? 1 : P.k;
    const legs = (th, kn, side = 0) => { for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) { R(n + 'UpLeg', lat, -th); if (side) R(n + 'UpLeg', fwd, s * side); R(n + 'Leg', lat, kn); } };
    switch (P.name) {
      case 'sit': legs(1.5, 1.45, 0.05); R('LeftArm', lat, -0.35); R('RightArm', lat, -0.35); R('LeftForeArm', lat, -0.95); R('RightForeArm', lat, -0.95); break;
      case 'curb': R('Spine', lat, 0.3); legs(1.95, 2.3, 0.14); R('LeftArm', lat, -0.75); R('RightArm', lat, -0.75); R('LeftForeArm', lat, -0.8); R('RightForeArm', lat, -0.8); break;
      case 'push': R('Spine', lat, 0.12); R('LeftArm', lat, -0.95); R('RightArm', lat, -0.95); R('LeftForeArm', lat, -0.5); R('RightForeArm', lat, -0.5); break;
      case 'lean': R('LeftUpLeg', lat, -0.55); R('LeftLeg', lat, 1.2); R('LeftArm', fwd, 0.25); R('RightArm', fwd, -0.25); R('LeftArm', lat, -0.3); R('RightArm', lat, -0.3); R('LeftForeArm', lat, -1.5); R('RightForeArm', lat, -1.5); break;
      case 'iv': R('RightArm', lat, -0.45); R('RightArm', fwd, -0.3); R('RightForeArm', lat, -0.8); R('Spine', lat, 0.08); break;
      case 'kick': R('RightUpLeg', lat, -1.0 * k); R('RightUpLeg', fwd, -0.4 * k); R('RightLeg', lat, 1.2 * k); R('LeftArm', fwd, 0.35 + 0.3 * k); R('RightArm', fwd, -0.35 - 0.3 * k); break;
    }
    if (P.hand && P.hand > 0.01) { const h = P.hand; R('RightArm', lat, -0.35 * h); R('RightArm', fwd, 0.45 * h); R('RightForeArm', lat, -2.25 * h); } // vape / phone to the face
    if (P.talkArm && P.talkArm > 0.01) { R('LeftArm', lat, -0.45 * P.talkArm); R('LeftForeArm', lat, -1.0 * P.talkArm); }
  }
  nod(which = 'agree') { const a = this.act[which]; if (a) { a.reset(); a.setEffectiveWeight(0.8); a.play(); } }
  update(dt, speed, air) {
    const d = camera.position.distanceTo(this.g.position);
    // LOD: far people animate at a lower rate and skip the fine detail
    this.acc += dt; const step = d > 90 ? 0.12 : d > 45 ? 0.05 : 0; if (this.acc < step) return; const ddt = this.acc; this.acc = 0; this.t += ddt;
    const A = this.act; const wRun = smooth(2.6, 4.8, speed), wWalk = smooth(0.08, 0.9, speed) * (1 - wRun), wIdle = 1 - smooth(0.05, 0.6, speed);
    if (A.idle) A.idle.setEffectiveWeight(wIdle); if (A.walk) { A.walk.setEffectiveWeight(wWalk); A.walk.timeScale = clamp(speed / 1.35, 0.5, 2); } if (A.run) { A.run.setEffectiveWeight(wRun); A.run.timeScale = clamp(speed / 5, 0.6, 1.6); }
    this.mixer.update(ddt);
    for (const [b, q] of this.free) b.quaternion.copy(q);
    if (this.pose) this.applyPose(this.pose);
    if (d > 45) return;
    const B = this.bones; this.g.updateMatrixWorld(true);
    const up = _v1.set(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.g.getWorldQuaternion(_q3)), right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const idle = 1 - smooth(0.3, 1.5, speed), t = this.t;
    // breathing + weight shift (offset frequencies per person)
    if (B.Spine1) addWorldRotation(B.Spine1, rotAxis(right, Math.sin(t * 1.2) * 0.014 * (0.5 + idle)));
    if (B.Spine2) addWorldRotation(B.Spine2, rotAxis(right, Math.sin(t * 1.2 + 0.8) * 0.018 * (0.5 + idle)));
    if (B.Hips && idle > 0.05) addWorldRotation(B.Hips, rotAxis(fwd, Math.sin(t * 0.33) * 0.022 * idle));
    // head & eyes toward the player when close and in front
    const head = B.Head, neck = B.Neck;
    if (head && neck) {
      this.g.updateMatrixWorld(true);
      const F = Player.mode === 'drive' ? Player.car.pos : Player.pos; const tgt = _v2.set(F.x, F.y + (Player.mode === 'drive' ? 1.2 : 1.6), F.z);
      const hp = head.getWorldPosition(new THREE.Vector3()); const dir = tgt.sub(hp); const dist = dir.length(); dir.normalize();
      let yaw = Math.atan2(dir.dot(right), dir.dot(fwd)), pitch = Math.asin(clamp(dir.y, -1, 1));
      if (dist > 10 || Math.abs(yaw) > 1.7) { yaw = Math.sin(t * 0.27) * 0.25; pitch = Math.sin(t * 0.19) * 0.05; } // idle glances
      yaw = clamp(yaw, -1.1, 1.1); pitch = clamp(pitch, -0.4, 0.35);
      const target = new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(right, -pitch));
      this.lookQ.slerp(target, 1 - Math.exp(-ddt * 3.5));
      addWorldRotation(neck, new THREE.Quaternion().slerp(this.lookQ, 0.4)); this.g.updateMatrixWorld(true); addWorldRotation(head, new THREE.Quaternion().slerp(this.lookQ, 0.6));
      if (B.LeftEye && B.RightEye) { this.saccT = (this.saccT || 0) - ddt; if (this.saccT <= 0) { this.saccT = 0.6 + Math.random() * 2.2; this.saccQ = new THREE.Quaternion().setFromAxisAngle(up, (Math.random() - .5) * 0.12); } this.eyeQ.slerp(this.saccQ, 1 - Math.exp(-ddt * 18)); this.g.updateMatrixWorld(true); addWorldRotation(B.LeftEye, this.eyeQ); addWorldRotation(B.RightEye, this.eyeQ); }
    }
    // talking mouth (blend shapes) — syllable-like envelope
    if (B.Jaw) { const open = this.talk > 0 ? clamp(0.5 + 0.5 * Math.sin(t * 16) * Math.sin(t * 4.7 + 1), 0, 1) * 0.16 : 0; this.jaw = lerp(this.jaw || 0, open, 0.5); if (!this.morph.length) this.talk = Math.max(0, this.talk - ddt); if (this.jaw > 0.002) { this.g.updateMatrixWorld(true); addWorldRotation(B.Jaw, rotAxis(right, this.jaw)); } }
    if (this.morph.length) {
      const k = this.talk > 0 ? clamp(0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 5.3 + 1), 0, 1) * 0.7 : 0; this.talk = Math.max(0, this.talk - ddt);
      for (const [m, io, is] of this.morph) { m.morphTargetInfluences[io] = lerp(m.morphTargetInfluences[io], k, 0.5); if (is !== undefined) m.morphTargetInfluences[is] = 0.25 + 0.15 * Math.sin(t * 0.4); }
    }
  }
  dispose() { this.g.removeFromParent(); for (const m of this.mats) m.dispose(); this.mixer.stopAllAction(); }
}
// Greenville demographics (2020 census, city): ~49% White, ~40% Black, ~6% Hispanic, ~4% Asian; median age ~27 (ECU)
const DEMO = [['W', 0.487], ['B', 0.395], ['H', 0.058], ['A', 0.045], ['O', 0.015]];
const SKIN_TARGET = { W: ['#f1caa9', '#e8b996', '#dcaa89', '#f3d0b5'], B: ['#5e3b29', '#6f4632', '#80533a', '#8f6044', '#4c2f22', '#a0714f'], H: ['#c89272', '#b98363', '#d2a07d'], A: ['#e2b890', '#d7a880', '#caa07a'], O: ['#b88a66', '#9a6e50'] };
function makeNpc(seed, x, z) {
  if (!NPCKit.ready && !RB.count()) return null;
  const rr = mulberry32(seed * 131 + 7); const r = rr();
  const hosp = nearHospital(x, z);
  if (RB.count() > 0 && rr() < 0.92) {
    let u = rr(), eth = 'W'; for (const [k, w] of DEMO) { if (u < w) { eth = k; break; } u -= w; }
    const gender = rr() < 0.5 ? 'f' : 'm';
    const role = hosp ? (rr() < 0.55 ? 'medical' : 'casual') : (u = rr(), u < 0.8 ? 'casual' : u < 0.9 ? 'business' : u < 0.97 ? 'sports' : 'police');
    const n = RB.spawn(seed, gender, role, eth, rr); if (n) return n;
  }
  if (!NPCKit.ready) return null;
  if (hosp && r < 0.6) return null;
  let kind = r < 0.55 ? 'rpm' : 'michelle'; if (!NPCKit.tpl[kind]) kind = Object.keys(NPCKit.tpl).find(k => !NPCKit.tpl[k].rb); if (!kind) return null;
  const n = new NpcAvatar(kind, seed); return { g: n.g, npc: n };
}

// a realistic (people-pack) person for a given part: 'doctor', 'nurse', 'patient', 'visitor', 'stoner'.
// Returns null when the pack isn't loaded yet (callers then use the simple built-in people).
function realPerson(role, r) {
  if (typeof RB === 'undefined' || !RB.count()) return null;
  const seed = Math.floor(r() * 1e6); let u = r(), eth = 'W'; for (const [k, w] of DEMO) { if (u < w) { eth = k; break; } u -= w; }
  const has = (rl, g) => RB.loaded.some(k => NPCKit.tpl[k] && NPCKit.tpl[k].role === rl && NPCKit.tpl[k].gender === g);
  if (role === 'doctor' || role === 'nurse') {
    let g = role === 'nurse' ? (r() < 0.8 ? 'f' : 'm') : (r() < 0.5 ? 'f' : 'm'); if (!has('medical', g)) g = g === 'f' ? 'm' : 'f'; if (!has('medical', g)) return null;
    return RB.spawn(seed, g, 'medical', eth, r);
  }
  const g = role === 'stoner' ? (r() < 0.35 ? 'f' : 'm') : (r() < 0.5 ? 'f' : 'm');
  if (role === 'patient') return RB.spawn(seed, g, 'casual', eth, r, { dress: key => RBDress.gown(key) });
  if (role === 'stoner') {
    const pal = [0x3e5a3a, 0x5b2a86, 0x2a2a2a, 0x7a4a2a, 0x1f5e5a, 0x8a8f96]; const v = r();
    const dress = v < 0.45 ? key => RBDress.tiedye(key, seed) : v < 0.7 ? key => RBDress.solid(key, 'band', '#262628', null) : (() => { const c = pal[Math.floor(r() * pal.length)]; return key => RBDress.solid(key, 'hood' + c, c, r() < 0.5 ? '#6b6a4a' : null); })();
    const h = r(); const hat = h < 0.45 ? { kind: 'beanie', color: pick([0x3f7a3a, 0x7a2e1a, 0xd9a520, 0x2a2a2a, 0x5b2a86], r()) } : h < 0.6 ? { kind: 'bucket', color: pick([0xc9b99a, 0x3e5a3a, 0x2a2a2a], r()) } : null;
    return RB.spawn(seed, g, 'casual', eth, r, { dress, hat });
  }
  return RB.spawn(seed, g, 'casual', eth, r);
}
