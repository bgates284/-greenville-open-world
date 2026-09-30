
// =====================================================================
// REALISTIC AVATAR — glTF character with:
//   • skeletal animation (idle / walk / run, retargeted Mixamo clips)
//   • morph targets (blend shapes) for expressions + audio-driven visemes (lip-sync)
//   • head, neck & eye tracking toward the camera (slerped)
//   • procedural micro-movements: breathing, weight shift, saccades, blinks
//   • two-bone foot IK so feet plant on uneven ground
// Models are fetched once and cached in IndexedDB so they work offline afterwards.
// =====================================================================
const AVATAR_SRC = {
  model: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/readyplayer.me.glb',
  anims: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Xbot.glb',
};
async function fetchCached(key, url) {
  let buf = await Store.get('models', key);
  if (buf) return buf;
  const r = await fetch(url, { mode: 'cors' }); if (!r.ok) throw new Error('model download ' + r.status);
  buf = await r.arrayBuffer(); await Store.put('models', key, buf); return buf;
}
function parseGLB(buf) { return new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)); }

// ---- viseme → blend-shape tables (works with Oculus visemes, ARKit shapes, or a basic mouthOpen/mouthSmile rig) ----
const VISEMES = ['sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'];
const VIS_ARKIT = {
  sil: {}, PP: { mouthClose: .5, mouthPress_L: .5, mouthPress_R: .5 }, FF: { mouthRollLower: .6, jawOpen: .08, mouthUpperUp_L: .2, mouthUpperUp_R: .2 },
  TH: { jawOpen: .15, tongueOut: .25 }, DD: { jawOpen: .25, mouthShrugUpper: .2 }, kk: { jawOpen: .3, mouthStretch_L: .15, mouthStretch_R: .15 },
  CH: { mouthFunnel: .45, jawOpen: .2 }, SS: { mouthStretch_L: .35, mouthStretch_R: .35, jawOpen: .08, mouthSmile_L: .15, mouthSmile_R: .15 },
  nn: { jawOpen: .15, mouthClose: .1 }, RR: { mouthFunnel: .3, mouthPucker: .2, jawOpen: .2 }, aa: { jawOpen: .7, mouthLowerDown_L: .3, mouthLowerDown_R: .3 },
  E: { jawOpen: .35, mouthStretch_L: .35, mouthStretch_R: .35 }, I: { jawOpen: .2, mouthSmile_L: .45, mouthSmile_R: .45 },
  O: { jawOpen: .45, mouthFunnel: .65 }, U: { jawOpen: .18, mouthPucker: .85, mouthFunnel: .2 },
};
const VIS_LITE = {
  sil: {}, PP: {}, FF: { mouthOpen: .1 }, TH: { mouthOpen: .18 }, DD: { mouthOpen: .28 }, kk: { mouthOpen: .32 }, CH: { mouthOpen: .25, mouthSmile: .1 },
  SS: { mouthOpen: .12, mouthSmile: .35 }, nn: { mouthOpen: .16 }, RR: { mouthOpen: .28 }, aa: { mouthOpen: .9 }, E: { mouthOpen: .5, mouthSmile: .35 },
  I: { mouthOpen: .3, mouthSmile: .6 }, O: { mouthOpen: .65 }, U: { mouthOpen: .32 },
};

// ---- audio analysis: microphone or a built-in "talking" voice synth, both feed one AnalyserNode ----
const Voice = {
  ctx: null, analyser: null, mode: 'off', data: null, micStream: null, babbleOn: false,
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.ctx = Sound.ctx || new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.35;
    this.data = new Float32Array(this.analyser.frequencyBinCount);
    this.out = this.ctx.createGain(); this.out.gain.value = 0.28; this.out.connect(this.ctx.destination);
  },
  async startMic() {
    this.ensure(); this.stop();
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.micSrc = this.ctx.createMediaStreamSource(this.micStream); this.micSrc.connect(this.analyser); this.mode = 'mic';
      UI.toast('Microphone on — talk and your character lip-syncs (V to stop)'); return true;
    } catch (e) { UI.toast('Microphone not available — using the built-in voice instead'); this.startBabble(); return false; }
  },
  startBabble() {
    this.ensure(); this.stop(); const A = this.ctx; this.mode = 'babble'; this.babbleOn = true;
    // source: glottal buzz (sawtooth) through three formant band-pass filters, plus noise for consonants
    const osc = A.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 140;
    const env = A.createGain(); env.gain.value = 0; const mix = A.createGain(); mix.gain.value = 1;
    const F = [0, 1, 2].map(i => { const f = A.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [6, 9, 11][i]; const g = A.createGain(); g.gain.value = [1, 0.6, 0.3][i]; osc.connect(f); f.connect(g); g.connect(mix); return f; });
    const nb = A.createBuffer(1, A.sampleRate, A.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = A.createBufferSource(); noise.buffer = nb; noise.loop = true; const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500; const ng = A.createGain(); ng.gain.value = 0;
    noise.connect(hp); hp.connect(ng); ng.connect(this.analyser); ng.connect(this.out);
    mix.connect(env); env.connect(this.analyser); env.connect(this.out); osc.start(); noise.start();
    this.babbleNodes = [osc, noise, env, ng];
    const V = { a: [800, 1200, 2500], e: [500, 1900, 2500], i: [300, 2300, 3000], o: [500, 850, 2450], u: [330, 800, 2350] };
    let t = A.currentTime + 0.05;
    const schedule = () => {
      if (!this.babbleOn) return;
      while (t < A.currentTime + 0.6) {
        const phrase = Math.random() < 0.12; if (phrase) { t += 0.35 + Math.random() * 0.4; continue; }
        const dur = 0.12 + Math.random() * 0.14; const v = V['aeiou'[Math.floor(Math.random() * 5)]];
        F.forEach((f, k) => f.frequency.setTargetAtTime(v[k] * (0.95 + Math.random() * 0.1), t, 0.02));
        osc.frequency.setTargetAtTime(115 + Math.random() * 55, t, 0.05);
        if (Math.random() < 0.25) { ng.gain.setValueAtTime(0.22, t); ng.gain.setTargetAtTime(0, t + 0.06, 0.02); t += 0.07; }
        env.gain.setTargetAtTime(0.9, t, 0.02); env.gain.setTargetAtTime(Math.random() < 0.3 ? 0 : 0.15, t + dur * 0.7, 0.025);
        t += dur;
      }
      this.babbleTimer = setTimeout(schedule, 200);
    };
    schedule(); UI.toast('Your character is talking (B to stop) — press F for a face close-up');
  },
  stop() {
    this.babbleOn = false; clearTimeout(this.babbleTimer);
    if (this.babbleNodes) { for (const n of this.babbleNodes) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { } } this.babbleNodes = null; }
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; try { this.micSrc.disconnect(); } catch (e) { } }
    this.mode = 'off';
  },
  // classify the current audio frame into a viseme + loudness from formant-band energies
  analyse() {
    if (this.mode === 'off' || !this.analyser) return { vis: 'sil', amt: 0 };
    this.analyser.getFloatFrequencyData(this.data);
    const hz = this.ctx.sampleRate / this.analyser.fftSize; const band = (a, b) => { let s = 0; for (let i = Math.floor(a / hz); i <= Math.min(this.data.length - 1, Math.ceil(b / hz)); i++) s += Math.pow(10, this.data[i] / 20); return s; };
    const e1 = band(150, 450), e2 = band(450, 1000), e3 = band(1000, 2400), e4 = band(2400, 4500), e5 = band(4500, 9000);
    const tot = e1 + e2 + e3 + e4 + e5;
    // automatic gain: loudness relative to the recent peak, so any mic level works
    this.peak = Math.max(tot, (this.peak || tot) * 0.996, 1e-4);
    const rel = tot / this.peak; if (rel < 0.12 || tot < 1e-3) return { vis: 'sil', amt: 0 };
    const amt = clamp((rel - 0.12) / 0.6, 0, 1);
    const r5 = e5 / tot, r4 = e4 / tot, f1 = e2 / (e1 + e2 + 1e-6), f2 = e3 / (e1 + e2 + e3 + 1e-6);
    let vis;
    if (r5 > 0.35) vis = 'SS'; else if (r5 + r4 > 0.45) vis = r4 > r5 ? 'CH' : 'FF';
    else if (f1 > 0.55 && f2 < 0.45) vis = 'aa';
    else if (f2 > 0.5) vis = f1 < 0.35 ? 'I' : 'E';
    else if (f1 < 0.3) vis = f2 < 0.25 ? 'U' : 'nn';
    else vis = 'O';
    return { vis, amt };
  },
};

// ---- helpers: rotate a bone by a WORLD-space rotation (axis-agnostic additive offsets) ----
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
function addWorldRotation(bone, qWorld) { // local' = P^-1 * R * P * local
  // a parent with non-uniform scale (people are scaled a little wider/narrower than tall) gives a
  // slightly non-unit world quaternion; unnormalized, that scaled the bone — eyes ballooned
  bone.parent.getWorldQuaternion(_q1); _q1.normalize(); _q2.copy(_q1).invert();
  bone.quaternion.premultiply(_q1).premultiply(qWorld).premultiply(_q2).normalize();
}
function rotAxis(axis, ang, out = new THREE.Quaternion()) { return out.setFromAxisAngle(axis, ang); }
// analytic two-bone IK (after Daniel Holden). a=root(thigh), b=mid(knee), c=end(foot), t=target world position
function twoBoneIK(A, B, C, t) {
  const a = A.getWorldPosition(new THREE.Vector3()), b = B.getWorldPosition(new THREE.Vector3()), c = C.getWorldPosition(new THREE.Vector3());
  const eps = 1e-4, lab = b.distanceTo(a), lcb = b.distanceTo(c), lat = clamp(t.distanceTo(a), eps, lab + lcb - eps);
  const ac = c.clone().sub(a).normalize(), ab = b.clone().sub(a).normalize(), ba = a.clone().sub(b).normalize(), bc = c.clone().sub(b).normalize(), at = t.clone().sub(a).normalize();
  const acab0 = Math.acos(clamp(ac.dot(ab), -1, 1)), babc0 = Math.acos(clamp(ba.dot(bc), -1, 1)), acat0 = Math.acos(clamp(ac.dot(at), -1, 1));
  const acab1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const babc1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  const axis0 = new THREE.Vector3().crossVectors(ac, ab); if (axis0.lengthSq() < 1e-8) return; axis0.normalize();
  const axis1 = new THREE.Vector3().crossVectors(ac, at); const has1 = axis1.lengthSq() > 1e-10; if (has1) axis1.normalize();
  const aW = A.getWorldQuaternion(new THREE.Quaternion()).invert(), bW = B.getWorldQuaternion(new THREE.Quaternion()).invert();
  const r0 = new THREE.Quaternion().setFromAxisAngle(axis0.clone().applyQuaternion(aW), acab1 - acab0);
  const r1 = new THREE.Quaternion().setFromAxisAngle(axis0.clone().applyQuaternion(bW), babc1 - babc0);
  const r2 = has1 ? new THREE.Quaternion().setFromAxisAngle(axis1.clone().applyQuaternion(aW), acat0) : new THREE.Quaternion();
  A.quaternion.multiply(r0.multiply(r2)); B.quaternion.multiply(r1);
}

class Avatar {
  constructor() { this.ready = false; this.lookQ = new THREE.Quaternion(); this.eyeQ = new THREE.Quaternion(); this.morphs = new Map(); this.mcur = {}; this.expr = { smile: 0 }; this.t = Math.random() * 10; this.blinkT = 2; this.saccT = 1; this.sacc = new THREE.Vector2(); }
  async load(model) { // model: a glTF/GLB ArrayBuffer, or an already-built Object3D (the Rocketbox player)
    const [root, ag] = await Promise.all([model.isObject3D ? model : parseGLB(model).then(g => g.scene), fetchCached('anims:xbot', AVATAR_SRC.anims).then(parseGLB)]); root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.9; } });
    // normalise height to ~1.75 m, feet on the ground
    const box = new THREE.Box3().setFromObject(root, true); const h = box.max.y - box.min.y; if (h > 0.1) { const s = 1.8 / h; root.scale.setScalar(s); root.position.y = -box.min.y * s; }
    this.root = new THREE.Group(); this.root.add(root); this.model = root;
    // bones by (sanitised, prefix-free) name
    this.bones = {}; root.traverse(o => { if (o.isBone) this.bones[stripMx(o.name)] = o; });
    const B = this.bones; this.B = B;
    // morph targets
    root.traverse(o => { if (o.isMesh && o.morphTargetDictionary) for (const [n, i] of Object.entries(o.morphTargetDictionary)) { if (!this.morphs.has(n)) this.morphs.set(n, []); this.morphs.get(n).push([o, i]); } });
    this.visTable = this.morphs.has('viseme_aa') ? null : (this.morphs.has('jawOpen') ? VIS_ARKIT : VIS_LITE);
    // --- runtime retargeting: animate the Mixamo source skeleton, then copy each bone's WORLD-space
    //     rotation change (relative to its rest pose, with a bone-direction correction for T-pose vs A-pose)
    //     onto the avatar's matching bone. Works for any Mixamo-named rig (Ready Player Me, Mixamo, etc.).
    const src = ag.scene; const S = {}; src.traverse(o => { if (o.isBone) S[stripMx(o.name)] = o; });
    src.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const names = []; root.traverse(o => { if (o.isBone) { const n = stripMx(o.name); if (S[n]) names.push(n); } });
    const restT = {}, restS = {}, posT = {}, posS = {}, cinv = {};
    for (const n of names) { restT[n] = B[n].getWorldQuaternion(new THREE.Quaternion()); restS[n] = S[n].getWorldQuaternion(new THREE.Quaternion()); posT[n] = B[n].getWorldPosition(new THREE.Vector3()); posS[n] = S[n].getWorldPosition(new THREE.Vector3()); }
    const childOf = (bone) => { const pref = CANON_CHILD[stripMx(bone.name)]; if (pref && S[pref] && B[pref]) return pref; for (const c of bone.children) if (c.isBone) { const n = stripMx(c.name); if (S[n] && B[n]) return n; } return null; };
    for (const n of names) { const cn = childOf(B[n]); if (!cn) { cinv[n] = new THREE.Quaternion(); continue; } const ds = posS[cn].clone().sub(posS[n]).normalize(), dt = posT[cn].clone().sub(posT[n]).normalize(); cinv[n] = new THREE.Quaternion().setFromUnitVectors(ds, dt).invert(); }
    for (const n of names) restS[n] = restS[n].clone().invert(); // store inverse
    // bones the clips never drive (eyes, jaw, face) are reset to rest every frame, so the procedural
    // eye/jaw motion added on top can never accumulate
    const driven = new Set(names); this.free = []; root.traverse(o => { if (o.isBone && (!driven.has(stripMx(o.name)) || /Eye|Jaw/i.test(o.name))) this.free.push([o, o.quaternion.clone().normalize(), o.position.clone()]); });
    this.mouthMorph = [...this.morphs.keys()].some(k => /^(viseme_|jawOpen|mouthOpen)/.test(k)); this.jawV = 0;
    this.rt = { src, S, names, restT, restSInv: restS, cinv, hipS: posS.Hips, hipT: posT.Hips, ratio: posS.Hips ? posT.Hips.y / posS.Hips.y : 1, tw: {} };
    this.mixer = new THREE.AnimationMixer(src); this.actions = {};
    for (const c of ag.animations) {
      const name = c.name.toLowerCase();
      if (name === 'agree' || name === 'headshake') { const clip = c.clone(); THREE.AnimationUtils.makeClipAdditive(clip); const a = this.mixer.clipAction(clip); a.blendMode = THREE.AdditiveAnimationBlendMode; a.setLoop(THREE.LoopOnce, 1); this.actions[name] = a; continue; }
      if (/^(idle|walk|run)$/.test(name)) { const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(name === 'idle' ? 1 : 0); this.actions[name] = a; }
    }
    // foot IK bookkeeping (rest ankle height above the ground)
    this.ready = true;
    return this;
  }
  retarget() {
    const R = this.rt, B = this.B; R.src.updateMatrixWorld(true); this.root.updateMatrixWorld(true); const pq = new THREE.Quaternion();
    const rootInv = this.root.getWorldQuaternion(new THREE.Quaternion()).invert(); // retarget in the avatar's own (un-yawed) frame
    for (const n of R.names) {
      const b = B[n]; const w = R.S[n].getWorldQuaternion(new THREE.Quaternion()).multiply(R.restSInv[n]).multiply(R.cinv[n]).multiply(R.restT[n]); R.tw[n] = w;
      const pn = stripMx(b.parent.name); if (b.parent.isBone && R.tw[pn]) pq.copy(R.tw[pn]); else pq.copy(rootInv).multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
      b.quaternion.copy(pq.invert().multiply(w));
    }
    if (B.Hips && R.hipS) { const hp = R.S.Hips.getWorldPosition(new THREE.Vector3()); const wp = R.hipT.clone(); wp.y += (hp.y - R.hipS.y) * R.ratio; B.Hips.parent.worldToLocal(wp.applyMatrix4(this.root.matrixWorld)); B.Hips.position.copy(wp); }
  }
  setMorph(name, v) { const l = this.morphs.get(name); if (!l) return false; for (const [m, i] of l) m.morphTargetInfluences[i] = v; return true; }
  gesture(name) { const a = this.actions[name]; if (a) { a.reset(); a.setEffectiveWeight(1); a.play(); } }
  update(dt, speed, air, cam) {
    if (!this.ready) return; this.t += dt; const B = this.B;
    // --- locomotion blend ---
    const A = this.actions; const wRun = smooth(2.6, 4.8, speed), wWalk = smooth(0.08, 0.9, speed) * (1 - wRun), wIdle = 1 - smooth(0.05, 0.6, speed);
    if (A.idle) A.idle.setEffectiveWeight(wIdle); if (A.walk) { A.walk.setEffectiveWeight(wWalk); A.walk.timeScale = clamp(speed / 1.5, 0.5, 1.8); } if (A.run) { A.run.setEffectiveWeight(wRun); A.run.timeScale = clamp(speed / 5, 0.6, 1.5); }
    this.mixer.update(dt);
    for (const [b, q, p] of this.free) { b.quaternion.copy(q); b.position.copy(p); }
    this.retarget();
    this.root.updateMatrixWorld(true);
    const up = _v1.set(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(_q3)), right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    // --- breathing & weight shift (small sines at offset frequencies) ---
    const idle = 1 - smooth(0.3, 1.5, speed); const t = this.t;
    if (B.Spine) addWorldRotation(B.Spine, rotAxis(right, Math.sin(t * 1.25) * 0.012 * (0.5 + idle)));
    if (B.Spine1) addWorldRotation(B.Spine1, rotAxis(right, Math.sin(t * 1.25 + 0.5) * 0.016 * (0.5 + idle)));
    if (B.Spine2) addWorldRotation(B.Spine2, rotAxis(right, Math.sin(t * 1.25 + 0.9) * 0.02 * (0.5 + idle)));
    if (B.LeftShoulder) addWorldRotation(B.LeftShoulder, rotAxis(fwd, Math.sin(t * 1.25 + 1.2) * 0.02 * idle));
    if (B.RightShoulder) addWorldRotation(B.RightShoulder, rotAxis(fwd, -Math.sin(t * 1.25 + 1.2) * 0.02 * idle));
    if (B.Hips && idle > 0.01) { addWorldRotation(B.Hips, rotAxis(fwd, Math.sin(t * 0.37) * 0.025 * idle)); if (B.Spine) addWorldRotation(B.Spine, rotAxis(fwd, -Math.sin(t * 0.37) * 0.02 * idle)); }
    this.root.updateMatrixWorld(true);
    // --- head / neck / eye tracking toward the camera (clamped, slerped) ---
    const head = B.Head, neck = B.Neck;
    if (head && neck && cam) {
      const hp = head.getWorldPosition(_v2); let dir = _v3.copy(cam.position).sub(hp); let dist = dir.length(); dir.normalize();
      let yaw = Math.atan2(dir.dot(right), dir.dot(fwd)), pitch = Math.asin(clamp(dir.y, -1, 1));
      // camera behind us? then glance at a nearby person instead (if any)
      if ((Math.abs(yaw) > 1.9 || dist > 25) && this.lookAt) { dir = _v3.copy(this.lookAt).sub(hp); dist = dir.length(); dir.normalize(); yaw = Math.atan2(dir.dot(right), dir.dot(fwd)); pitch = Math.asin(clamp(dir.y, -1, 1)); }
      const behind = Math.abs(yaw) > 1.9 || dist > 25; if (behind) { yaw = 0; pitch = 0; }
      // micro-movements: slow head drift + saccades
      yaw += Math.sin(t * 0.43) * 0.04 + Math.sin(t * 1.7) * 0.01; pitch += Math.sin(t * 0.31 + 1) * 0.03;
      yaw = clamp(yaw, -1.15, 1.15); pitch = clamp(pitch, -0.45, 0.4);
      const target = new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(right, -pitch));
      this.lookQ.slerp(target, 1 - Math.exp(-dt * 4.5));
      addWorldRotation(neck, new THREE.Quaternion().slerp(this.lookQ, 0.4));
      this.root.updateMatrixWorld(true);
      addWorldRotation(head, new THREE.Quaternion().slerp(this.lookQ, 0.6));
      // eyes: finish the remaining angle quickly, plus saccades
      this.saccT -= dt; if (this.saccT < 0) { this.saccT = 0.4 + Math.random() * 1.8; this.sacc.set((Math.random() - .5) * 0.08, (Math.random() - .5) * 0.05); }
      const ey = clamp((behind ? 0 : Math.atan2(dir.dot(right), dir.dot(fwd)) - yaw) + this.sacc.x, -0.35, 0.35), ep = clamp((behind ? 0 : Math.asin(dir.y) - pitch) + this.sacc.y, -0.25, 0.25);
      const et = new THREE.Quaternion().setFromAxisAngle(up, ey).multiply(new THREE.Quaternion().setFromAxisAngle(right, -ep));
      this.eyeQ.slerp(et, 1 - Math.exp(-dt * 18));
      this.root.updateMatrixWorld(true);
      for (const e of [B.LeftEye, B.RightEye]) if (e) addWorldRotation(e, this.eyeQ);
    }
    // --- two-bone foot IK: plant each foot on the actual ground under it ---
    if (!air && B.LeftUpLeg && B.LeftLeg && B.LeftFoot && B.RightUpLeg) {
      this.root.updateMatrixWorld(true);
      const rootY = this.root.position.y; const legs = [[B.LeftUpLeg, B.LeftLeg, B.LeftFoot], [B.RightUpLeg, B.RightLeg, B.RightFoot]];
      const deltas = legs.map(([, , f]) => { const p = f.getWorldPosition(new THREE.Vector3()); const g = groundY(p.x, p.z, rootY + 0.5); return clamp(g - rootY, -0.35, 0.35); });
      const drop = Math.max(0, -Math.min(deltas[0], deltas[1]));
      if (drop > 0.005 && B.Hips) { const wp = B.Hips.getWorldPosition(new THREE.Vector3()); wp.y -= drop; B.Hips.parent.worldToLocal(wp); B.Hips.position.copy(wp); this.root.updateMatrixWorld(true); }
      legs.forEach(([a, b, c], k) => {
        if (Math.abs(deltas[k]) < 0.01 && drop < 0.005) return;
        const p = c.getWorldPosition(new THREE.Vector3()); p.y += deltas[k] + drop; twoBoneIK(a, b, c, p); this.root.updateMatrixWorld(true);
      });
    }
    // --- face: blinks, expression, lip-sync from audio ---
    this.blinkT -= dt; let blink = 0; if (this.blinkT < 0) { if (this.blinkT < -0.14) this.blinkT = 2 + Math.random() * 4.5; else blink = Math.sin((-this.blinkT / 0.14) * Math.PI); }
    this.setMorph('eyeBlink_L', blink); this.setMorph('eyeBlink_R', blink); this.setMorph('eyesClosed', blink);
    const want = {};
    const { vis, amt } = Voice.analyse(); this.vis = vis;
    if (this.visTable === null) { for (const v of VISEMES) want['viseme_' + v] = 0; want['viseme_' + vis] = amt; }
    else { const tbl = this.visTable[vis] || {}; for (const k in tbl) want[k] = (want[k] || 0) + tbl[k] * amt; }
    const smile = this.expr.smile; if (smile) { want.mouthSmile = Math.max(want.mouthSmile || 0, smile * 0.8); want.mouthSmile_L = Math.max(want.mouthSmile_L || 0, smile * 0.7); want.mouthSmile_R = Math.max(want.mouthSmile_R || 0, smile * 0.7); want.cheekSquint_L = smile * 0.3; want.cheekSquint_R = smile * 0.3; }
    // no mouth blend shapes (e.g. the Rocketbox rig)? open the jaw bone from the same audio analysis
    if (!this.mouthMorph && B.Jaw) {
      const open = { sil: 0, PP: 0.05, FF: 0.25, TH: 0.35, DD: 0.45, kk: 0.5, CH: 0.45, SS: 0.3, nn: 0.4, RR: 0.45, aa: 1, E: 0.7, I: 0.55, O: 0.85, U: 0.6 }[vis] ?? 0.5;
      const tgt = clamp(amt, 0, 1) * open * 0.2 + (this.expr.smile ? 0.015 : 0); this.jawV += (tgt - this.jawV) * Math.min(1, dt * (tgt > this.jawV ? 25 : 12));
      if (this.jawV > 0.002) { this.root.updateMatrixWorld(true); addWorldRotation(B.Jaw, rotAxis(right, this.jawV)); }
    }
    for (const name of this.morphs.keys()) {
      if (/eyeBlink|eyesClosed/.test(name)) continue;
      const tgt = want[name] || 0, cur = this.mcur[name] || 0; const rate = tgt > cur ? 22 : 12;
      const v = cur + (tgt - cur) * Math.min(1, dt * rate); this.mcur[name] = v; this.setMorph(name, v);
    }
  }
}
const AvatarMgr = {
  av: null, loading: null, want: 'realistic', outfit: 'casual',
  // default: the casual player (T-shirt, shorts, ball cap, sneakers); a .glb you load replaces it
  async ensure(custom, outfit) {
    if (this.loading) return this.loading;
    if (outfit) this.outfit = outfit;
    this.loading = (async () => {
      try {
        let model = custom || (await Store.get('models', 'avatar:custom'));
        this.custom = !!model;
        if (!model) {
          // the tee/shorts/cap player; a damaged saved copy is thrown away and downloaded again
          for (let attempt = 0; attempt < 3 && !model; attempt++) {
            try { model = await RB.playerModel(this.outfit); }
            catch (e) { console.warn('player model attempt ' + (attempt + 1) + ' failed', e); await Store.del('models', 'rb:' + PLAYER_SRC[0]); await sleep(1500 * (attempt + 1)); }
          }
          if (!model) { // keep the built-in character (dressed the same) and try again shortly
            this.retryT = setTimeout(() => { if (this.want === 'realistic' && !this.av) this.ensure().then(av => { if (av && this.want === 'realistic' && typeof Player !== 'undefined') Player.useAvatar(av); }); }, 45000);
            UI.toast('Player model is still downloading — retrying shortly'); return null;
          }
        }
        const av = new Avatar(); await av.load(model); this.av = av; return av;
      } catch (e) { console.warn('avatar unavailable', e); UI.toast('Realistic avatar could not load — using the built-in character'); return null; }
      finally { this.loading = null; }
    })();
    return this.loading;
  },
};
