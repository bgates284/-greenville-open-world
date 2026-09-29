
// =====================================================================
// PEOPLE PACK — Microsoft Rocketbox avatars (MIT licence, github.com/microsoft/Microsoft-Rocketbox)
// Realistic scanned-style adults and professionals. Each is downloaded once (FBX + 2048px TGA
// textures ≈ 40 MB), converted in the browser to small WebP textures with a skin mask in the
// alpha channel, and saved in IndexedDB (≈1 MB each) — later sessions load instantly.
// Skin tone is set per person with a shader uniform, so the crowd can match Greenville's
// demographics even though the source library skews light-skinned.
// =====================================================================
const RB_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/Microsoft-Rocketbox@master/Assets/Avatars/';
// [path, gender, natural skin tone (L light, M medium, D dark), role]  — ordered so variety arrives early
const RB_POOL = [
  ['Professions/Business_Female_01', 'f', 'D', 'business'], ['Adults/Male_Adult_04', 'm', 'D', 'casual'], ['Adults/Female_Adult_01', 'f', 'L', 'casual'],
  ['Adults/Male_Adult_12', 'm', 'D', 'casual'], ['Adults/Female_Adult_08', 'f', 'L', 'casual'], ['Adults/Male_Adult_02', 'm', 'L', 'casual'],
  ['Adults/Female_Adult_12', 'f', 'L', 'casual'], ['Adults/Male_Adult_18', 'm', 'D', 'casual'], ['Adults/Female_Adult_03', 'f', 'L', 'casual'],
  ['Adults/Male_Adult_10', 'm', 'M', 'casual'], ['Adults/Female_Adult_07', 'f', 'L', 'casual'], ['Professions/Business_Male_05', 'm', 'D', 'business'],
  ['Professions/Medical_Female_01', 'f', 'L', 'medical'], ['Professions/Medical_Male_02', 'm', 'L', 'medical'],
  ['Adults/Female_Adult_17', 'f', 'L', 'casual'], ['Adults/Male_Adult_06', 'm', 'L', 'casual'], ['Adults/Female_Adult_14', 'f', 'L', 'casual'],
  ['Adults/Male_Adult_17', 'm', 'M', 'casual'], ['Adults/Female_Adult_04', 'f', 'L', 'casual'], ['Adults/Male_Adult_09', 'm', 'L', 'casual'],
  ['Professions/Medical_Female_02', 'f', 'L', 'medical'], ['Professions/Medical_Male_04', 'm', 'L', 'medical'], ['Adults/Female_Adult_13', 'f', 'L', 'casual'],
  ['Adults/Male_Adult_16', 'm', 'L', 'casual'], ['Professions/Sports_Female_02', 'f', 'L', 'sports'], ['Adults/Male_Adult_20', 'm', 'L', 'casual'],
  ['Professions/Business_Female_04', 'f', 'L', 'business'], ['Professions/Business_Male_02', 'm', 'M', 'business'], ['Adults/Male_Adult_14', 'm', 'L', 'casual'],
  ['Adults/Female_Adult_02', 'f', 'L', 'casual'], ['Professions/Police_Male_01', 'm', 'M', 'police'], ['Professions/Medical_Male_01', 'm', 'L', 'medical'],
  ['Adults/Male_Adult_11', 'm', 'L', 'casual'], ['Adults/Female_Adult_15', 'f', 'L', 'casual'], ['Professions/Sports_Male_04', 'm', 'L', 'sports'],
  ['Adults/Male_Adult_03', 'm', 'L', 'casual'], ['Professions/Business_Female_02', 'f', 'L', 'business'], ['Adults/Female_Adult_05', 'f', 'L', 'casual'],
  ['Professions/Medical_Female_03', 'f', 'L', 'medical'], ['Professions/Medical_Male_03', 'm', 'L', 'medical'], ['Professions/Medical_Male_05', 'm', 'L', 'medical'],
];

// ---- shader patch: multiply skin pixels (separate greyscale mask texture) by a per-person tone ----
function patchSkin(m, mask) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uSkinMul = m.userData.skinU; sh.uniforms.uSkinMask = { value: mask };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSkinMul;\nuniform sampler2D uSkinMask;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        sampledDiffuseColor.rgb *= mix( vec3(1.0), uSkinMul, smoothstep( 0.3, 0.8, texture2D( uSkinMask, vMapUv ).r ) );
        diffuseColor.rgb *= sampledDiffuseColor.rgb;
      #endif`);
  };
  m.customProgramCacheKey = () => 'rb-skin';
  m.needsUpdate = true;
}

// ---- tiny TGA decoder (types 2 & 10, 24/32-bit) -> RGBA, top row first ----
function decodeTGA(buf) {
  const d = new Uint8Array(buf); const idLen = d[0], type = d[2], w = d[12] | (d[13] << 8), h = d[14] | (d[15] << 8), bpp = d[16] >> 3, desc = d[17];
  const out = new Uint8ClampedArray(w * h * 4); let p = 18 + idLen; const topFirst = (desc & 0x20) !== 0; let i = 0; const n = w * h;
  const put = (k, b, g, r, a) => { const x = k % w, y = Math.floor(k / w); const row = topFirst ? y : h - 1 - y; const o = (row * w + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a; };
  if (type === 2) { for (; i < n; i++, p += bpp) put(i, d[p], d[p + 1], d[p + 2], bpp === 4 ? d[p + 3] : 255); }
  else if (type === 10) { while (i < n) { const c = d[p++]; const cnt = (c & 0x7f) + 1; if (c & 0x80) { const b = d[p], g = d[p + 1], r = d[p + 2], a = bpp === 4 ? d[p + 3] : 255; p += bpp; for (let k = 0; k < cnt; k++) put(i++, b, g, r, a); } else { for (let k = 0; k < cnt; k++, p += bpp) put(i++, d[p], d[p + 1], d[p + 2], bpp === 4 ? d[p + 3] : 255); } } }
  else throw new Error('TGA type ' + type);
  return { w, h, data: out };
}
function toCanvas(img, size) {
  const src = cnv(img.w, img.h); src.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  const c = cnv(size, size); const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, size, size); return c;
}
// skin reference colour = dominant chroma of the head texture
function skinReference(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const H = new Map();
  for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], s = r + g + b; if (s < 150 || s > 720 || r < g || r < b) continue; const k = Math.round(r / s * 80) * 100 + Math.round(g / s * 80); H.set(k, (H.get(k) || 0) + 1); }
  let bk = 0, bc = -1; for (const [k, c2] of H) if (c2 > bc) { bc = c2; bk = k; }
  const cr = Math.floor(bk / 100) / 80, cg = (bk % 100) / 80; let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], b = d[i + 2], s = r + g + b; if (s < 150) continue; if (Math.abs(r / s - cr) < 0.02 && Math.abs(g / s - cg) < 0.02) { R += r; G += g; B += b; n++; } }
  return { cr, cg, rgb: n ? [R / n, G / n, B / n] : [200, 150, 120] };
}
// greyscale skin mask as its own canvas (canvas alpha is premultiplied, so the mask can't live in the colour texture's alpha)
function skinMask(c, ref, size) {
  const im = c.getContext('2d').getImageData(0, 0, c.width, c.height); const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], s = r + gg + b;
    if (s < 60) { d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255; continue; }
    const dist = Math.hypot(r / s - ref.cr, gg / s - ref.cg); const lum = s / 3;
    let m = 1 - smooth(0.022, 0.055, dist); m *= smooth(25, 55, lum);
    d[i] = d[i + 1] = d[i + 2] = Math.round(m * 255); d[i + 3] = 255;
  }
  const full = cnv(c.width, c.height); full.getContext('2d').putImageData(im, 0, 0);
  const out = cnv(size, size); out.getContext('2d').drawImage(full, 0, 0, size, size); return out;
}
const blobOf = (c, type = 'image/webp', q = 0.9) => new Promise(res => c.toBlob(res, type, q));
async function texFromBlob(blob, color = true) {
  const url = URL.createObjectURL(blob); const t = await new THREE.TextureLoader().loadAsync(url); URL.revokeObjectURL(url);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.flipY = true; return t;
}

const RB = {
  loaded: [], state: 'idle', done: 0, target: 24, paused: false, err: 0, FBX: null,
  count() { return this.loaded.length; },
  async fbxLoader() { if (!this.FBX) this.FBX = (await import('three/addons/loaders/FBXLoader.js')).FBXLoader; return this.FBX; },
  // private loading manager: FBX-embedded texture paths are ignored (we supply our own textures).
  // Never touch THREE.DefaultLoadingManager — that would redirect every other loader in the game.
  quietMgr() { const m = new THREE.LoadingManager(); m.setURLModifier(() => 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); return m; },
  async fetchAvatar(path) {
    const key = 'rb:' + path; const cached = await Store.get('models', key); if (cached && cached.v === 2) return cached;
    const name = path.split('/').pop(); const base = RB_BASE + path;
    const fr = await fetch(`${base}/Export/${name}.fbx`); if (!fr.ok) throw new Error('model ' + fr.status); const fbx = await fr.arrayBuffer();
    // texture prefix (e.g. "f001") comes from the FBX material names
    const Loader = await this.fbxLoader(); const probe = new Loader(this.quietMgr());
    const obj = probe.parse(fbx, ''); let prefix = null; const extras = new Set(); obj.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { const mm = /^(\w+?)_(body|head|opacity)/.exec(m.name); if (mm) prefix = mm[1]; const mx = /^[a-z]\d+_([a-z]+)/i.exec(m.name); if (mx && !/^(body|head|opacity)$/i.test(mx[1])) extras.add(mx[1].toLowerCase()); } });
    if (!prefix) throw new Error('no texture prefix for ' + name);
    const get = async (suffix) => { const r = await fetch(`${base}/Textures/${prefix}_${suffix}.tga`); if (!r.ok) throw new Error('tex ' + r.status); return decodeTGA(await r.arrayBuffer()); };
    const headC = toCanvas(await get('head_color'), 1024); const ref = skinReference(headC); const headM = skinMask(headC, ref, 256);
    let bodyRaw; try { bodyRaw = await get('body_color'); } catch (e) { bodyRaw = await get('body_color_blue'); } // a few medical models only ship a "_blue" variant
    const bodyC = toCanvas(bodyRaw, 512); const bodyM = skinMask(bodyC, ref, 128);
    const extra = {}; for (const x of extras) { try { extra[x] = await blobOf(toCanvas(await get(x + '_color'), 256)); } catch (e) { } } // stethoscopes, face shields…
    let opC = null; try { opC = toCanvas(await get('opacity_color'), 512); } catch (e) { }
    const rec = { v: 2, fbx, head: await blobOf(headC), body: await blobOf(bodyC), headMask: await blobOf(headM), bodyMask: await blobOf(bodyM), opacity: opC ? await blobOf(opC) : null, skin: ref.rgb, extra };
    await Store.put('models', key, rec); return rec;
  },
  async buildTemplate(entry, rec, xbot) {
    const [path, gender, tone, role] = entry; const Loader = await this.fbxLoader(); const l = new Loader(this.quietMgr());
    const obj = l.parse(rec.fbx, ''); obj.animations = [];
    const tex = { head: await texFromBlob(rec.head), body: await texFromBlob(rec.body), opacity: rec.opacity ? await texFromBlob(rec.opacity) : null };
    const masks = { head: await texFromBlob(rec.headMask, false), body: await texFromBlob(rec.bodyMask, false) };
    const extraTex = {}; for (const k in rec.extra || {}) try { extraTex[k] = await texFromBlob(rec.extra[k]); } catch (e) { }
    obj.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
      const conv = m => {
        const mx = /^[a-z]\d+_([a-z]+)/i.exec(m.name || ''); const ex = mx && !/^(body|head|opacity)$/i.test(mx[1]) ? mx[1].toLowerCase() : null;
        if (ex) { const t = extraTex[ex]; const e = new THREE.MeshStandardMaterial({ name: m.name, map: t || null, roughness: 0.5, metalness: 0.2, alphaTest: 0.4, side: THREE.DoubleSide }); if (!t) e.visible = false; return e; } // accessories keep their own texture (or hide)
        const kind = /opacity/.test(m.name) ? 'opacity' : /head/.test(m.name) ? 'head' : 'body';
        const nm = new THREE.MeshStandardMaterial({ name: m.name, map: tex[kind], roughness: kind === 'head' ? 0.62 : 0.8, metalness: 0 });
        if (kind === 'opacity') { nm.alphaTest = 0.45; nm.side = THREE.DoubleSide; nm.userData.isHair = true; if (!tex.opacity) nm.visible = false; }
        else { nm.userData.skinU = { value: new THREE.Color(1, 1, 1) }; nm.userData.maskKind = kind; }
        return nm;
      };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
    const wrap = new THREE.Group(); obj.scale.multiplyScalar(0.01); wrap.add(obj); wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(wrap, true); obj.position.y -= box.min.y; wrap.updateMatrixWorld(true);
    const want = { idle: 1, walk: 1, run: 1, agree: 1, headshake: 1 };
    const clips = xbot.animations.filter(c => want[c.name.toLowerCase()]).map(c => bakeClip(wrap, xbot.scene, c));
    for (const c of clips) if (c.name === 'agree' || c.name === 'headshake') THREE.AnimationUtils.makeClipAdditive(c);
    for (const c of clips) for (const t of c.tracks) if (/\.position$/.test(t.name) && c.name !== 'agree' && c.name !== 'headshake') { const v = t.values; const x0 = v[0], z0 = v[2]; for (let k = 0; k < v.length; k += 3) { v[k] = x0; v[k + 2] = z0; } }
    const skinLin = new THREE.Color().setRGB(rec.skin[0] / 255, rec.skin[1] / 255, rec.skin[2] / 255, THREE.SRGBColorSpace);
    // where a hat sits: on top of the head, in the head bone's space (same for every copy of this model)
    let hatLocal = null; { let hb = null; obj.traverse(q => { if (q.isBone && stripMx(q.name) === 'Head') hb = q; }); if (hb) { wrap.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(wrap, true); const hp = hb.getWorldPosition(new THREE.Vector3()); const m = new THREE.Matrix4().makeTranslation(hp.x, bx.max.y - 0.062, hp.z + 0.01); hatLocal = m.premultiply(new THREE.Matrix4().copy(hb.matrixWorld).invert()); } }
    const key = 'rb:' + path; NPCKit.tpl[key] = { wrap, clips, rb: true, gender, tone, role, skinLin, masks, bodyTex: tex.body, hatLocal };
    this.loaded.push(key);
  },
  async start() {
    if (this.state === 'running') return; this.state = 'running'; this.paused = false;
    try {
      await NPCKit.load(); if (!NPCKit.cloneFn) return;
      const xbot = await parseGLB(await fetchCached('anims:xbot', AVATAR_SRC.anims));
      for (const entry of RB_POOL.slice(0, this.target)) {
        if (this.paused) break; const key = 'rb:' + entry[0]; if (NPCKit.tpl[key]) continue;
        try { const rec = await this.fetchAvatar(entry[0]); await this.buildTemplate(entry, rec, xbot); this.done = this.loaded.length; UI.peoplePack && UI.peoplePack(); if (this.loaded.length === 3) Peds.upgradeCrowd(true); }
        catch (e) { console.warn('people pack: skipped', entry[0], e); this.err++; }
        await sleep(50);
      }
    } catch (e) { console.warn('people pack unavailable', e); this.err++; }
    finally { this.state = this.paused ? 'paused' : 'done'; UI.peoplePack && UI.peoplePack(); }
  },
  pause() { this.paused = true; },
  spawn(seed, gender, role, eth, rr, more) {
    const pool = k => NPCKit.tpl[k];
    let cands = this.loaded.filter(k => pool(k).gender === gender && pool(k).role === role);
    if (!cands.length) cands = this.loaded.filter(k => pool(k).gender === gender && (pool(k).role === 'casual' || role === 'casual'));
    if (!cands.length) cands = this.loaded.slice(); if (!cands.length) return null;
    // Black characters: prefer avatars that are naturally dark-skinned (better hair & features)
    if (eth === 'B') { const dark = cands.filter(k => pool(k).tone === 'D'); if (dark.length && rr() < 0.7) cands = dark; }
    else { const light = cands.filter(k => pool(k).tone !== 'D'); if (light.length) cands = light; }
    const key = cands[Math.floor(rr() * cands.length)]; const T = pool(key);
    // skin multiplier = target tone / the avatar's own skin tone (linear), hair darkened for non-white targets
    const target = new THREE.Color(pick(SKIN_TARGET[eth] || SKIN_TARGET.W, rr()));
    let mul = new THREE.Color(target.r / Math.max(0.02, T.skinLin.r), target.g / Math.max(0.02, T.skinLin.g), target.b / Math.max(0.02, T.skinLin.b));
    mul.setRGB(clamp(mul.r, 0.2, 2.4), clamp(mul.g, 0.2, 2.4), clamp(mul.b, 0.2, 2.4));
    if (eth === 'B' && T.tone === 'D') { const k = 0.85 + rr() * 0.3; mul = new THREE.Color(k, k, k); }
    const hair = (eth === 'W') ? new THREE.Color().setScalar(0.75 + rr() * 0.35) : new THREE.Color().setScalar(0.22 + rr() * 0.12);
    const o = { skinMul: mul, hairMul: T.tone === 'D' ? null : hair };
    if (more) { if (more.dress) try { o.bodyMap = more.dress(key); } catch (e) { console.warn('re-dress failed', e); } if (more.hat) o.hat = more.hat; }
    const n = new NpcAvatar(key, seed, o);
    return { g: n.g, npc: n };
  },
};

// =====================================================================
// PLAYER OUTFIT — the main character is a Rocketbox athlete model re-dressed in the browser:
// the kit texture is repainted as a plain T-shirt, shorts, bare lower legs with ankle socks and
// white sneakers, and a baseball cap is modelled and attached to the head bone.
// =====================================================================
const PLAYER_SRC = ['Professions/Sports_Male_02', 'm', 'L', 'player'];
const PLAYER_OUTFITS = {
  casual: { tee: '#8d9399', shorts: '#b59f76', cap: '#1d2a47', brim: '#1d2a47', sock: '#f2f2f2', logo: null },
  ecu: { tee: '#4b1f78', shorts: '#2b2b30', cap: '#4b1f78', brim: '#f2c230', sock: '#f2f2f2', logo: '#f2c230' },
};
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// UV layout of Sports_Male_02's body texture (u mirrored left/right): shorts top corners, thigh skin,
// socks, arms/hands down the sides; the shirt and sleeves fill the middle column; boots near the bottom middle.
function paintOutfit(src, o) {
  const W = src.width, Hh = src.height; const c = cnv(W, Hh); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, W, Hh), d = im.data;
  // broad shading (stripes & logos blurred away, folds/edge darkening kept)
  const sm = cnv(20, 20), sg = sm.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high'; sg.drawImage(src, 0, 0, 20, 20);
  const bl = cnv(W, Hh), bg = bl.getContext('2d', { willReadFrequently: true }); bg.imageSmoothingQuality = 'high'; bg.drawImage(sm, 0, 0, W, Hh); const B = bg.getImageData(0, 0, W, Hh).data;
  let meanL = 0, n = 0; for (let i = 0; i < B.length; i += 16) { meanL += B[i] + B[i + 1] + B[i + 2]; n++; } meanL /= n;
  // leg skin colour from the thigh area
  let sr = 0, sgc = 0, sb = 0, sn = 0; for (let y = Math.floor(Hh * 0.23); y < Hh * 0.29; y++) for (let x = 4; x < W * 0.25; x += 2) { const i = (y * W + x) * 4; sr += d[i]; sgc += d[i + 1]; sb += d[i + 2]; sn++; }
  const skin = [sr / sn, sgc / sn, sb / sn];
  const col = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const T = col(o.tee), S = col(o.shorts), K = col(o.sock);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / Hh, uu = Math.min(u, 1 - u), i = (y * W + x) * 4;
    const shade = clamp(0.86 + 0.35 * ((B[i] + B[i + 1] + B[i + 2]) / meanL - 1), 0.7, 1.08);
    const weave = 0.965 + 0.07 * hash2(x, y) + 0.02 * Math.sin(x * 2.1) * Math.sin(y * 1.7);
    let base = null;
    if (uu < 0.285) {
      if (v < 0.215) base = S;                                  // shorts
      else if (v < 0.31) continue;                              // thigh / knee skin (keep)
      else if (v < 0.575 && uu < 0.257) {                       // was knee-high socks → shin skin + ankle sock
        if (v > 0.535) base = K; else { const k = 0.95 + 0.07 * hash2(x * 3, y * 7); d[i] = skin[0] * k; d[i + 1] = skin[1] * k; d[i + 2] = skin[2] * k; continue; }
      } else if (v < 0.575) base = T;                           // sleeve trim strip
      else continue;                                            // arms & hands
    } else {
      if (uu < 0.325 && v > 0.70) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; const w = l > 90 ? 245 : 60; d[i] = d[i + 1] = d[i + 2] = w * (0.9 + 0.1 * hash2(x, y)); continue; } // sneakers: white upper, dark sole
      base = T;                                                 // T-shirt body & sleeves
    }
    const k = shade * weave; d[i] = base[0] * k; d[i + 1] = base[1] * k; d[i + 2] = base[2] * k;
  }
  g.putImageData(im, 0, 0);
  if (o.logo) { // simple chest print on the front of the shirt
    g.save(); g.translate(W * 0.5, Hh * 0.635); g.fillStyle = o.logo; g.font = `bold ${Math.round(W * 0.03)}px Arial`; g.textAlign = 'center'; g.fillText('GREENVILLE', 0, 0); g.restore();
  }
  return c;
}
function makeCap(color, brimColor) {
  const cap = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), mb = new THREE.MeshStandardMaterial({ color: brimColor, roughness: 0.8, side: THREE.DoubleSide });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); crown.scale.set(0.102, 0.085, 0.112); cap.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), m); band.scale.set(0.102, 0.018, 0.112); band.position.y = -0.009; cap.add(band);
  const brim = new THREE.Mesh(new THREE.CircleGeometry(1, 24, 0, Math.PI), mb);
  brim.rotation.x = Math.PI / 2 + 0.12; brim.scale.set(0.098, 0.115, 1); brim.position.set(0, -0.014, 0.075); cap.add(brim);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), m); btn.position.y = 0.084; cap.add(btn);
  cap.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return cap;
}
RB.playerModel = async function (outfit = 'casual') {
  const o = PLAYER_OUTFITS[outfit] || PLAYER_OUTFITS.casual;
  const rec = await this.fetchAvatar(PLAYER_SRC[0]); const Loader = await this.fbxLoader();
  const obj = new Loader(this.quietMgr()).parse(rec.fbx, ''); obj.animations = [];
  const bodyImg = await createImageBitmap(rec.body); const bc = cnv(bodyImg.width, bodyImg.height); bc.getContext('2d').drawImage(bodyImg, 0, 0);
  const bodyTex = new THREE.CanvasTexture(paintOutfit(bc, o)); bodyTex.colorSpace = THREE.SRGBColorSpace; bodyTex.anisotropy = 4;
  const headTex = await texFromBlob(rec.head);
  obj.traverse(q => {
    if (!q.isMesh) return; q.castShadow = true; q.receiveShadow = true; q.frustumCulled = false;
    const conv = m => { const head = /head/.test(m.name); if (/opacity/.test(m.name)) { const x = new THREE.MeshStandardMaterial(); x.visible = false; return x; } return new THREE.MeshStandardMaterial({ name: m.name, map: head ? headTex : bodyTex, roughness: head ? 0.6 : 0.85, metalness: 0 }); };
    q.material = Array.isArray(q.material) ? q.material.map(conv) : conv(q.material);
  });
  const root = new THREE.Group(); obj.scale.multiplyScalar(0.01); root.add(obj); root.updateMatrixWorld(true);
  // cap: sits on top of the head, brim forward (+z), parented to the head bone so it follows every motion
  let headBone = null; obj.traverse(q => { if (q.isBone && stripMx(q.name) === 'Head') headBone = q; });
  const box = new THREE.Box3().setFromObject(root, true);
  if (headBone) {
    const hp = headBone.getWorldPosition(new THREE.Vector3());
    const cap = makeCap(o.cap, o.brim); cap.name = 'cap';
    cap.position.set(hp.x, box.max.y - 0.064, hp.z + 0.012); cap.updateMatrix();
    const inv = new THREE.Matrix4().copy(headBone.matrixWorld).invert(); cap.matrix.premultiply(inv); cap.matrix.decompose(cap.position, cap.quaternion, cap.scale);
    headBone.add(cap);
  }
  return root;
};

// =====================================================================
// RE-DRESSING NPCs — a Rocketbox person's clothes can be repainted in the browser (hospital gown,
// tie-dye, band tee, hoodie colours). Which texture pixels are shirt, sleeves, trousers or shoes is
// found by drawing the model's own triangles into texture space, coloured by where they sit on the
// body; skin (from the skin mask) is left alone, and the original folds and shading are kept.
// =====================================================================
const RBDress = {
  cache: new Map(),
  regions(T) { // per model: Uint8Array over the body texture, 0 none · 1 top · 2 arms · 3 legs · 4 feet
    if (T.regionMap) return T.regionMap;
    const img = T.bodyTex.image, W = img.width, Hh = img.height; const c = cnv(W, Hh), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    T.wrap.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(T.wrap, true); const h = box.max.y - box.min.y, cx = (box.min.x + box.max.x) / 2;
    const v = new THREE.Vector3(); const cols = ['#000', '#010000', '#020000', '#030000', '#040000'];
    T.wrap.traverse(o => {
      if (!o.isMesh) return; const mats = [].concat(o.material); const geo = o.geometry, pos = geo.attributes.position, uv = geo.attributes.uv; if (!uv) return;
      const idx = geo.index ? geo.index.array : null; const groups = geo.groups.length ? geo.groups : [{ start: 0, count: idx ? idx.length : pos.count, materialIndex: 0 }];
      for (const gr of groups) {
        const m = mats[gr.materialIndex || 0]; if (!m || m.userData.maskKind !== 'body') continue;
        for (let k = gr.start; k < gr.start + gr.count; k += 3) {
          const ids = [0, 1, 2].map(j => idx ? idx[k + j] : k + j); let yy = 0, xx = 0;
          for (const i of ids) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); yy += v.y; xx += Math.abs(v.x - cx); } yy = (yy / 3 - box.min.y) / h; xx = xx / 3 / h;
          const reg = yy < 0.055 ? 4 : (xx > 0.13 && yy > 0.42) ? 2 : yy > 0.52 ? 1 : 3;
          g.fillStyle = cols[reg]; g.strokeStyle = cols[reg]; g.lineWidth = 2; g.beginPath();
          ids.forEach((i, j) => { const px = uv.getX(i) * W, py = (1 - uv.getY(i)) * Hh; j ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill(); g.stroke();
        }
      }
    });
    const d = g.getImageData(0, 0, W, Hh).data; const R = new Uint8Array(W * Hh); for (let i = 0; i < R.length; i++) R[i] = d[i * 4];
    return (T.regionMap = R);
  },
  // style: { top, arms, legs, feet } — each a function (u, v, x, y) → [r,g,b] or null to keep
  texture(key, name, style) {
    const ck = key + '|' + name; if (this.cache.has(ck)) return this.cache.get(ck);
    const T = NPCKit.tpl[key]; if (!T || !T.bodyTex || !T.bodyTex.image) return null;
    const img = T.bodyTex.image, W = img.width, Hh = img.height; const R = this.regions(T);
    const c = cnv(W, Hh), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const im = g.getImageData(0, 0, W, Hh), d = im.data;
    const mc = cnv(W, Hh), mg = mc.getContext('2d', { willReadFrequently: true }); mg.drawImage(T.masks.body.image, 0, 0, W, Hh); const M = mg.getImageData(0, 0, W, Hh).data;
    // average brightness of each region's cloth, so shading is relative (keeps folds, drops the old colour)
    const sum = [0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0];
    for (let i = 0; i < R.length; i++) { const r = R[i]; if (!r || M[i * 4] > 110) continue; sum[r] += d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]; cnt[r]++; }
    const fns = [null, style.top, style.arms || style.top, style.legs, style.feet];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, r = R[i]; const fn = fns[r]; if (!fn || M[i * 4] > 110) continue;
      const col = fn(x / W, y / Hh, x, y); if (!col) continue;
      const l = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / Math.max(1, sum[r] / cnt[r]); const sh = clamp(0.55 + 0.45 * l, 0.62, 1.12);
      d[i * 4] = clamp(col[0] * sh, 0, 255); d[i * 4 + 1] = clamp(col[1] * sh, 0, 255); d[i * 4 + 2] = clamp(col[2] * sh, 0, 255);
    }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = T.bodyTex.flipY; t.anisotropy = 4;
    this.cache.set(ck, t); return t;
  },
  rgb(h) { const n = typeof h === 'number' ? h : parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; },
  // ---- ready-made looks ----
  gown(key) { const B = [185, 211, 230], N = [52, 74, 128], S = [242, 221, 106]; return this.texture(key, 'gown', {
    top: (u, v, x, y) => ((x + y) % 14 < 2 && (x - y + 1000) % 14 < 2) ? N : B, legs: (u, v, x, y) => ((x + y) % 14 < 2 && (x - y + 1000) % 14 < 2) ? N : B, feet: () => S }); },
  tiedye(key, seed) { const P = [[232, 65, 60], [243, 154, 43], [245, 214, 58], [76, 196, 99], [47, 143, 224], [138, 79, 216]]; const r = mulberry32(seed); const cx = 0.3 + r() * 0.4, cy = 0.2 + r() * 0.3, tw = 14 + r() * 10;
    return this.texture(key, 'tiedye' + (seed % 3), { top: (u, v) => { const a = Math.atan2(v - cy, u - cx), d = Math.hypot(u - cx, v - cy); const k = Math.floor(((a / (Math.PI * 2) + 1) * 6 + d * tw)) % 6; return P[(k + 6) % 6]; } }); },
  solid(key, name, top, legs) { const T = top && this.rgb(top), L = legs && this.rgb(legs); return this.texture(key, name, { top: T ? () => T : null, legs: L ? () => L : null }); },
};
// a knit beanie (optionally with a rasta band) or a bucket hat, in the head bone's space
function makeHat(kind, color) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  if (kind === 'beanie') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m); crown.scale.set(0.108, 0.115, 0.118); crown.position.y = -0.012; g.add(crown);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.95, side: THREE.DoubleSide })); cuff.scale.set(0.11, 0.045, 0.12); cuff.position.y = -0.02; g.add(cuff);
  } else {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.105, 0.085, 20), m); top.position.y = 0.012; g.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.01, 24), m); brim.position.y = -0.03; g.add(brim);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
