
// =====================================================================
// RENDERER / SCENE
// =====================================================================
const canvasEl = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc3cfda, 0.0009);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 9000);
camera.position.set(0, 30, 30);

const worldRoot = new THREE.Group(); scene.add(worldRoot);
const dynRoot = new THREE.Group(); scene.add(dynRoot);

// Shared shader clock
const U = { uTime: { value: 0 }, uNight: { value: 0 }, uWet: { value: 0 } };

// =====================================================================
// PROCEDURAL TEXTURES (all drawn on canvas — nothing to download)
// =====================================================================
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c, { srgb = true, wrap = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAX_ANISO; t.generateMipmaps = mips; t.needsUpdate = true; return t;
}
function noiseFill(g, w, h, base, amt, seed, scales = [8, 32, 96]) {
  const n = tileNoise(Math.max(w, h), scales, seed); const img = g.createImageData(w, h); const S = Math.max(w, h);
  const r0 = mulberry32(seed * 7 + 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (n[(y % S) * S + (x % S)] - 0.5) * amt + (r0() - 0.5) * amt * 0.5; const i = (y * w + x) * 4;
    img.data[i] = clamp(base[0] + v, 0, 255); img.data[i + 1] = clamp(base[1] + v, 0, 255); img.data[i + 2] = clamp(base[2] + v, 0, 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const TEX = {};
function buildTextures() {
  // ---- asphalt with lane markings; u runs across the road, v along it (512px = 12 m) ----
  const asph = (kind) => {
    const c = cnv(256, 512), g = c.getContext('2d');
    const light = kind === 'plain' ? 8 : 0;
    noiseFill(g, 256, 512, [62 + light, 63 + light, 66 + light], 26, 11 + kind.length);
    // tar-sealed cracks and patches
    const r = mulberry32(99 + kind.length);
    g.globalAlpha = 0.25; g.strokeStyle = '#1d1d1f'; g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) { g.beginPath(); let x = r() * 256, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - .5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 0.12; g.fillStyle = '#222'; for (let i = 0; i < 3; i++) g.fillRect(r() * 200, r() * 480, 30 + r() * 50, 20 + r() * 60);
    g.globalAlpha = 0.9;
    const line = (u, col, w, dash) => { g.fillStyle = col; if (!dash) g.fillRect(u * 256 - w / 2, 0, w, 512); else for (let y = 0; y < 512; y += dash[0] + dash[1]) g.fillRect(u * 256 - w / 2, y, w, dash[0]); };
    const Y = '#d9ae2c', Wt = '#e4e4de';
    if (kind === 'two') { line(.485, Y, 4); line(.515, Y, 4); line(.035, Wt, 4); line(.965, Wt, 4); }
    if (kind === 'multi') { line(.49, Y, 3); line(.51, Y, 3); line(.25, Wt, 3, [128, 384]); line(.75, Wt, 3, [128, 384]); line(.03, Wt, 3); line(.97, Wt, 3); }
    if (kind === 'oneway') { line(.5, Wt, 4, [128, 384]); line(.04, Y, 4); line(.96, Wt, 4); }
    if (kind === 'highway') { line(.34, Wt, 3, [128, 384]); line(.67, Wt, 3, [128, 384]); line(.03, Y, 4); line(.97, Wt, 4); }
    g.globalAlpha = 1;
    // darker edges (curb shadow / wear)
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(.06, 'rgba(0,0,0,0)'); gr.addColorStop(.94, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    return ctex(c);
  };
  TEX.road = { plain: asph('plain'), two: asph('two'), multi: asph('multi'), oneway: asph('oneway'), highway: asph('highway') };

  // concrete sidewalk: 512px = 6 m, joints every 1.5 m
  { const c = cnv(128, 512), g = c.getContext('2d'); noiseFill(g, 128, 512, [184, 181, 173], 18, 5);
    g.fillStyle = 'rgba(60,58,55,.55)'; for (let y = 0; y < 512; y += 128) g.fillRect(0, y, 128, 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 5, 512); TEX.sidewalk = ctex(c); }
  { const c = cnv(128, 128), g = c.getContext('2d'); noiseFill(g, 128, 128, [150, 148, 142], 22, 6); TEX.concrete = ctex(c); }

  // grass / ground detail (grayscale, multiplied in the terrain shader)
  { const S = 256, c = cnv(S, S), g = c.getContext('2d'); const n = tileNoise(S, [16, 64, 128], 21); const img = g.createImageData(S, S); const r = mulberry32(3);
    for (let i = 0; i < S * S; i++) { const v = clamp(128 + (n[i] - .5) * 150 + (r() - .5) * 70, 0, 255); img.data[4 * i] = v; img.data[4 * i + 1] = clamp(128 + (tileNoiseCache(i) - .5) * 180, 0, 255); img.data[4 * i + 2] = v; img.data[4 * i + 3] = 255; }
    g.putImageData(img, 0, 0); TEX.detail = ctex(c, { srgb: false }); }

  // ---- facades (4 bays x 4 floors per texture). Bottom row of canvas = ground floor. ----
  TEX.facade = {};
  const mk = (name, bayW, floorH, draw) => {
    const c = cnv(512, 512), e = cnv(512, 512), g = c.getContext('2d'), ge = e.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 512);
    const r = mulberry32(name.length * 131 + 7);
    draw(g, ge, r);
    TEX.facade[name] = { map: ctex(c), emi: ctex(e), bayW, floorH };
  };
  const litColor = r => { const x = r(); return x < .12 ? '#9fb6ff' : x < .55 ? '#ffd28a' : '#ffe9c2'; };
  const win = (g, ge, r, x, y, w, h, frame, glassTop, glassBot, litP) => {
    if (frame) { g.fillStyle = frame; g.fillRect(x - 4, y - 4, w + 8, h + 8); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, glassTop); gr.addColorStop(1, glassBot); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * .45, y); g.lineTo(x, y + h * .6); g.fill();
    if (r() < litP) { ge.fillStyle = litColor(r); ge.fillRect(x, y, w, h); ge.fillStyle = 'rgba(0,0,0,.35)'; ge.fillRect(x + r() * w * .5, y, w * .3, h); }
  };
  // Vinyl siding house (tinted per building)
  mk('siding', 3.4, 3.0, (g, ge, r) => {
    g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 9) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, 512, 2); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y + 2, 512, 1); }
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const x0 = b * 128, y0 = 512 - (f + 1) * 128;
      if (f === 0 && b === 1) { g.fillStyle = '#f4f4f0'; g.fillRect(x0 + 40, y0 + 34, 48, 94); g.fillStyle = pick(['#4b2a1e', '#1f3550', '#6d1d1d', '#2d3b2a'], r()); g.fillRect(x0 + 45, y0 + 39, 38, 89); g.fillStyle = '#c9a74a'; g.fillRect(x0 + 75, y0 + 84, 4, 4); if (r() < .6) { ge.fillStyle = '#ffcf87'; ge.fillRect(x0 + 50, y0 + 30, 28, 4); } continue; }
      win(g, ge, r, x0 + 40, y0 + 32, 48, 62, '#f7f7f4', '#39434f', '#6e7c8a', .42);
      g.fillStyle = '#f7f7f4'; g.fillRect(x0 + 62, y0 + 32, 4, 62); g.fillRect(x0 + 40, y0 + 60, 48, 4);
      if (r() < .6) { const sc = pick(['#26303a', '#1e3a2a', '#3a2320', '#20283e'], r()); g.fillStyle = sc; g.fillRect(x0 + 22, y0 + 28, 14, 70); g.fillRect(x0 + 92, y0 + 28, 14, 70); }
    }
  });
  // Red brick (ECU campus, older Uptown, brick ranch houses)
  mk('brick', 3.4, 3.4, (g, ge, r) => {
    g.fillStyle = '#c9c3b8'; g.fillRect(0, 0, 512, 512);
    for (let y = 0, row = 0; y < 512; y += 7, row++) for (let x = (row % 2) * -9; x < 512; x += 18) {
      const t = r(); g.fillStyle = `rgb(${150 + t * 40 | 0},${62 + t * 20 | 0},${44 + t * 14 | 0})`; g.fillRect(x + 1, y + 1, 16, 5);
    }
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) {
      const x0 = b * 128, y0 = 512 - (f + 1) * 128;
      g.fillStyle = '#d9d4c9'; g.fillRect(x0 + 34, y0 + 100, 60, 7);
      win(g, ge, r, x0 + 38, y0 + 26, 52, 72, '#f2efe8', '#2f3844', '#5d6b79', .38);
      g.fillStyle = '#f2efe8'; g.fillRect(x0 + 62, y0 + 26, 4, 72); g.fillRect(x0 + 38, y0 + 58, 52, 4);
      g.fillStyle = 'rgba(80,40,30,.6)'; g.fillRect(x0 + 34, y0 + 18, 60, 6);
    }
  });
  // Uptown brick storefront: ground floor glass, brick above
  mk('shop', 4.2, 3.8, (g, ge, r) => {
    g.fillStyle = '#bdb6aa'; g.fillRect(0, 0, 512, 512);
    for (let y = 0, row = 0; y < 384; y += 7, row++) for (let x = (row % 2) * -9; x < 512; x += 18) { const t = r(); g.fillStyle = `rgb(${138 + t * 44 | 0},${70 + t * 22 | 0},${50 + t * 16 | 0})`; g.fillRect(x + 1, y + 1, 16, 5); }
    for (let f = 1; f < 4; f++) for (let b = 0; b < 4; b++) { const x0 = b * 128, y0 = 512 - (f + 1) * 128; win(g, ge, r, x0 + 36, y0 + 24, 56, 80, '#ebe6dc', '#2c3440', '#58657a', .35); g.fillStyle = '#e6e0d4'; g.fillRect(x0 + 30, y0 + 14, 68, 8); }
    // ground floor storefronts
    g.fillStyle = '#2b2622'; g.fillRect(0, 384, 512, 128);
    for (let b = 0; b < 4; b++) {
      const x0 = b * 128; const aw = pick(['#1f4a3a', '#6a1f24', '#2c3558', '#4b2a6a', '#8a6a1f', '#303030'], r());
      g.fillStyle = aw; g.fillRect(x0 + 4, 388, 120, 16); g.fillStyle = 'rgba(255,255,255,.18)'; for (let s = 0; s < 120; s += 16) g.fillRect(x0 + 4 + s, 388, 8, 16);
      const gr = g.createLinearGradient(0, 410, 0, 506); gr.addColorStop(0, '#46525e'); gr.addColorStop(1, '#1b2128'); g.fillStyle = gr; g.fillRect(x0 + 10, 410, 108, 96);
      g.fillStyle = '#2b2622'; g.fillRect(x0 + 62, 410, 4, 96);
      ge.fillStyle = r() < .8 ? '#ffe2a8' : '#cfe0ff'; ge.fillRect(x0 + 10, 410, 108, 96);
    }
  });
  // Office / hospital: concrete bands + ribbon windows
  mk('office', 3.2, 3.9, (g, ge, r) => {
    noiseFill(g, 512, 512, [200, 196, 188], 14, 44);
    for (let f = 0; f < 4; f++) { const y0 = 512 - (f + 1) * 128; for (let b = 0; b < 4; b++) win(g, ge, r, b * 128 + 8, y0 + 30, 112, 70, null, '#3d5569', '#7e97ab', .3); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y0 + 100, 512, 3); }
    for (let b = 0; b <= 4; b++) { g.fillStyle = '#b8b3aa'; g.fillRect(b * 128 - 4, 0, 8, 512); }
  });
  // Strip-mall / big box: stucco, glass entry
  mk('store', 5.0, 4.5, (g, ge, r) => {
    noiseFill(g, 512, 512, [222, 214, 196], 16, 55);
    g.fillStyle = 'rgba(0,0,0,.15)'; for (let f = 0; f < 4; f++) g.fillRect(0, 512 - (f + 1) * 128, 512, 10);
    for (let b = 0; b < 4; b++) {
      const x0 = b * 128;
      if (b % 2 === 0) { const gr = g.createLinearGradient(0, 400, 0, 512); gr.addColorStop(0, '#4c5a66'); gr.addColorStop(1, '#1d242b'); g.fillStyle = '#3a3a3a'; g.fillRect(x0 + 6, 396, 116, 116); g.fillStyle = gr; g.fillRect(x0 + 10, 400, 108, 112); ge.fillStyle = '#ffeccc'; ge.fillRect(x0 + 10, 400, 108, 112); }
      for (let f = 1; f < 4; f++) if (r() < .5) win(g, ge, r, x0 + 44, 512 - (f + 1) * 128 + 40, 40, 40, '#cfc6b3', '#3a4450', '#627080', .2);
    }
    g.fillStyle = pick(['#7a1f2a', '#1f4e7a', '#2e6a3a', '#5b2a86'], r()); g.fillRect(0, 380, 512, 12);
  });
  // Metal building: ribbed panels
  mk('metal', 4.0, 4.0, (g, ge, r) => {
    noiseFill(g, 512, 512, [196, 200, 204], 10, 66);
    for (let x = 0; x < 512; x += 10) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, 0, 2, 512); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 2, 0, 1, 512); }
    g.fillStyle = '#6f7478'; g.fillRect(270, 400, 100, 112); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 400; y < 512; y += 8) g.fillRect(270, y, 100, 2);
    win(g, ge, r, 60, 420, 50, 40, '#8a8f93', '#3a4450', '#627080', .5);
  });
  // Roofs
  { const c = cnv(256, 256), g = c.getContext('2d'); g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, 256, 256); const r = mulberry32(8);
    for (let y = 0, row = 0; y < 256; y += 16, row++) for (let x = (row % 2) * -12; x < 256; x += 24) { const t = r(); g.fillStyle = `rgb(${160 + t * 60 | 0},${160 + t * 60 | 0},${160 + t * 60 | 0})`; g.fillRect(x + 1, y + 1, 22, 14); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + 13, 24, 3); }
    TEX.shingle = ctex(c); }
  { const c = cnv(256, 256), g = c.getContext('2d'); noiseFill(g, 256, 256, [200, 200, 198], 30, 9); g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 2, 256);
    const r = mulberry32(4); for (let i = 0; i < 4; i++) { g.fillStyle = '#9a9a98'; const x = r() * 220, y = r() * 220; g.fillRect(x, y, 22, 16); g.fillStyle = '#6b6b69'; g.fillRect(x + 3, y + 3, 16, 10); }
    TEX.flatroof = ctex(c); }

  // Clouds
  TEX.clouds = [];
  for (let k = 0; k < 4; k++) {
    const c = cnv(256, 256), g = c.getContext('2d'); const r = mulberry32(300 + k);
    for (let i = 0; i < 38; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), .7) * 78; const x = 128 + Math.cos(a) * d * 1.35, y = 140 + Math.sin(a) * d * .45 - r() * 30; const rad = 22 + r() * 44;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); const sh = 255 - (y - 90) * .5;
      gr.addColorStop(0, `rgba(${sh},${sh},${sh},.55)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    TEX.clouds.push(ctex(c, { wrap: false }));
  }
  // Grass tuft (alpha)
  { const c = cnv(64, 128), g = c.getContext('2d'); const r = mulberry32(12);
    for (let i = 0; i < 16; i++) { const x = 8 + r() * 48, h = 60 + r() * 64, bend = (r() - .5) * 26; const t = r();
      g.strokeStyle = `rgb(${70 + t * 50 | 0},${105 + t * 50 | 0},${40 + t * 20 | 0})`; g.lineWidth = 2.5 + r() * 2; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + bend * .3, 128 - h * .5, x + bend, 128 - h); g.stroke(); }
    TEX.tuft = ctex(c, { wrap: false }); }
  // Moon
  { const c = cnv(128, 128), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(.62, 'rgba(255,250,235,1)'); gr.addColorStop(.66, 'rgba(255,250,235,.25)'); gr.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const r = mulberry32(77); g.fillStyle = 'rgba(150,150,160,.35)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(40 + r() * 48, 40 + r() * 48, 4 + r() * 10, 0, 7); g.fill(); }
    TEX.moon = ctex(c, { wrap: false }); }
}
let _tnc = null;
function tileNoiseCache(i) { if (!_tnc) _tnc = tileNoise(256, [4, 12], 91); return _tnc[i]; }

// =====================================================================
// MATERIALS
// =====================================================================
const MAT = {};
function terrainPatch(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uDetail = { value: TEX.detail }; sh.uniforms.uWet = U.uWet;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform float uWet;\nuniform sampler2D uDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float waterM = 1.0 - texture2D(roughnessMap, vRoughnessMapUv).g;
        float waterK = smoothstep(0.55, 0.85, waterM);
        vec4 dt1 = texture2D(uDetail, vWPos.xz * 0.23);
        vec4 dt2 = texture2D(uDetail, vWPos.xz * 0.013);
        diffuseColor.rgb *= mix(0.62 + dt1.r * 0.76, 1.0, waterK) * (0.84 + dt2.g * 0.32);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (waterK > 0.01) {
          vec2 p = vWPos.xz * 0.35;
          float t = uTime;
          vec3 wn = vec3(sin(p.x*1.7 + t*1.1) * 0.5 + sin(p.y*2.3 - t*0.9 + p.x*0.7) * 0.5 + sin((p.x+p.y)*4.1 + t*2.0)*0.25, 0.0,
                         cos(p.y*1.9 + t*1.3) * 0.5 + cos(p.x*2.7 + t*0.8 - p.y*0.5) * 0.5 + cos((p.x-p.y)*3.7 - t*1.7)*0.25);
          normal = normalize(normal + (viewMatrix * vec4(wn * 0.09 * waterK, 0.0)).xyz);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.06, waterK);`);
  };
  mat.customProgramCacheKey = () => 'terrain-v2';
}
function wetPatch(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = U.uWet;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, uWet);\ndiffuseColor.rgb *= (1.0 - 0.35*uWet);');
  };
  mat.customProgramCacheKey = () => 'wet-' + key;
}
function buildMaterials() {
  MAT.road = {};
  for (const k in TEX.road) { const m = new THREE.MeshStandardMaterial({ map: TEX.road[k], roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }); wetPatch(m, 'road'); MAT.road[k] = m; }
  MAT.sidewalk = new THREE.MeshStandardMaterial({ map: TEX.sidewalk, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }); wetPatch(MAT.sidewalk, 'sw');
  MAT.concrete = new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: 0.9 });
  MAT.facade = {};
  for (const k in TEX.facade) MAT.facade[k] = new THREE.MeshStandardMaterial({ map: TEX.facade[k].map, emissiveMap: TEX.facade[k].emi, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughness: 0.88 });
  MAT.shingle = new THREE.MeshStandardMaterial({ map: TEX.shingle, vertexColors: true, roughness: 0.95 });
  MAT.flatroof = new THREE.MeshStandardMaterial({ map: TEX.flatroof, vertexColors: true, roughness: 0.9 });
  MAT.tree = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  MAT.lampPole = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.6, metalness: 0.5 });
  MAT.lampHead = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
  MAT.signalBody = new THREE.MeshStandardMaterial({ color: 0x2f3a2a, roughness: 0.7, metalness: 0.2 });
  MAT.wire = new THREE.MeshBasicMaterial({ color: 0x151515 });
  MAT.sig = {};
  for (const ax of ['A', 'B']) for (const [c, hex] of [['r', 0xff2a1a], ['y', 0xffb300], ['g', 0x22ff77]]) MAT.sig[ax + c] = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: hex, emissiveIntensity: 0.05, roughness: 0.3 });
  MAT.stopRed = new THREE.MeshStandardMaterial({ color: 0xb3161b, roughness: 0.5 });
  MAT.carGlass = new THREE.MeshPhysicalMaterial({ color: 0x0e151d, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 });
  MAT.carTrim = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.7 });
  MAT.carChrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.9 });
  MAT.headlight = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, emissive: 0xfff4dc, emissiveIntensity: 0.1, roughness: 0.2 });
  MAT.taillight = new THREE.MeshStandardMaterial({ color: 0x7a0a0a, emissive: 0xff1a10, emissiveIntensity: 0.25, roughness: 0.3 });
  MAT.carBodyWhite = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.12 });
  MAT.wheel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 });
  MAT.plate = new THREE.MeshStandardMaterial({ color: 0xf1f1ee, roughness: 0.5 });
  MAT.person = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, map: buildPersonAtlas() });
  MAT.bodyCache = new Map();
  MAT.personCache = new Map();
}
function carPaint(hex) { let m = MAT.bodyCache.get(hex); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.4, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.1 }); MAT.bodyCache.set(hex, m); } return m; }
function personMat(hex) { let m = MAT.personCache.get(hex); if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }); MAT.personCache.set(hex, m); } return m; }
