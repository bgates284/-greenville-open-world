
// =====================================================================
// ENVIRONMENT: sun & moon, sky, clouds, stars, weather, lights
// =====================================================================
const Env = {
  hour: 10, speed: 60, weather: 'partly', night: 0, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(),
  cloudCover: 0.45, rain: 0, rainTarget: 0,
  init() {
    this.sky = new Sky(); this.sky.scale.setScalar(8000); this.sky.material.fog = false; scene.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 6.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.0045; u.mieDirectionalG.value = 0.82;
    // environment map scene (sky only)
    this.envScene = new THREE.Scene(); this.envSky = new Sky(); this.envSky.scale.setScalar(900); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer); this.lastEnvSun = new THREE.Vector3(0, -2, 0); this.envRT = null;

    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = Q.shadows > 0;
    this.sun.shadow.mapSize.set(Q.shadows || 1024, Q.shadows || 1024);
    const sc = this.sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 600;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd0ea, 0x3d4a2c, 0.8); scene.add(this.hemi);

    // stars
    const N = 2600, sp = new Float32Array(N * 3), sc2 = new Float32Array(N * 3); const r = mulberry32(42);
    for (let i = 0; i < N; i++) { const u1 = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u1 * u1); sp[3 * i] = Math.cos(a) * s * 5000; sp[3 * i + 1] = Math.abs(u1) * 5000; sp[3 * i + 2] = Math.sin(a) * s * 5000; const b = 0.5 + r() * 0.5; sc2[3 * i] = b; sc2[3 * i + 1] = b; sc2[3 * i + 2] = b * (0.9 + r() * 0.2); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc2, 3));
    this.starMat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.renderOrder = -1; scene.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.moon, transparent: true, fog: false, depthWrite: false, color: 0xffffff }));
    this.moon.scale.setScalar(260); scene.add(this.moon);

    // clouds
    this.clouds = []; const cr = mulberry32(7);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.SpriteMaterial({ map: TEX.clouds[i % 4], transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
      const s = new THREE.Sprite(m); const sz = 380 + cr() * 700; s.scale.set(sz * 1.6, sz * 0.62, 1);
      s.userData = { x: (cr() - .5) * 7000, z: (cr() - .5) * 7000, y: 650 + cr() * 500, k: cr() };
      scene.add(s); this.clouds.push(s);
    }
    // rain
    const RN = 5000, rp = new Float32Array(RN * 6); this.rainOff = new Float32Array(RN * 3);
    for (let i = 0; i < RN; i++) { this.rainOff[3 * i] = (cr() - .5) * 70; this.rainOff[3 * i + 1] = cr() * 36; this.rainOff[3 * i + 2] = (cr() - .5) * 70; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMesh = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.32, fog: true })); this.rainMesh.frustumCulled = false; this.rainMesh.visible = false; scene.add(this.rainMesh);

    // pooled lights for street lamps at night + headlights
    this.lampLights = [];
    this.makeLampLights();
    this.setWeather(this.weather);
  },
  makeLampLights() {
    for (const l of this.lampLights) l.removeFromParent();
    this.lampLights = [];
    for (let i = 0; i < Q.lampLights; i++) { const l = new THREE.PointLight(0xffc98a, 0, 28, 1.6); l.position.set(0, -500, 0); scene.add(l); this.lampLights.push(l); }
  },
  setWeather(w) {
    this.weather = w;
    this.cloudCover = { clear: 0.08, partly: 0.45, overcast: 0.95, rain: 1 }[w];
    this.rainTarget = w === 'rain' ? 1 : 0;
    this.envDirty = true;
  },
  sunPosition(hour) {
    const now = new Date(); const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const decl = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * Math.PI / 180; const lat = ORIGIN.lat * Math.PI / 180;
    // Greenville solar noon ~13:10 during daylight time
    const dst = now.getMonth() >= 2 && now.getMonth() <= 10 ? 1 : 0; const Ha = (hour - (12.17 + dst)) * 15 * Math.PI / 180;
    const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(Ha));
    const az = Math.atan2(-Math.sin(Ha), Math.tan(decl) * Math.cos(lat) - Math.sin(lat) * Math.cos(Ha));
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  },
  update(dt, focus) {
    this.hour = (this.hour + dt * this.speed / 3600) % 24;
    this.sunDir.copy(this.sunPosition(this.hour));
    this.moonDir.copy(this.sunPosition((this.hour + 12.4) % 24)); this.moonDir.y = Math.abs(this.moonDir.y) * 0.8 + 0.15; this.moonDir.normalize();
    const el = this.sunDir.y;
    const day = smooth(-0.1, 0.18, el); this.night = 1 - smooth(-0.14, 0.04, el); U.uNight.value = this.night;
    const golden = smooth(0.3, 0.02, el) * smooth(-0.1, 0.02, el);
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.4);
    U.uWet.value += ((this.rainTarget ? 1 : 0) - U.uWet.value) * Math.min(1, dt * (this.rainTarget ? 0.1 : 0.02));
    const oc = this.cloudCover;

    // sky shader
    const su = this.sky.material.uniforms;
    su.sunPosition.value.copy(this.sunDir);
    su.turbidity.value = lerp(5.5, 14, oc * 0.8); su.rayleigh.value = lerp(1.2, 3, golden) * (1 - oc * 0.5); su.mieCoefficient.value = lerp(0.004, 0.012, oc);
    this.sky.position.copy(focus);

    // lights
    const sunCol = new THREE.Color().setRGB(1, lerp(0.95, 0.62, golden), lerp(0.88, 0.38, golden));
    const dim = (1 - oc * 0.62) * (1 - this.rain * 0.3);
    if (el > -0.04) {
      this.sun.color.copy(sunCol); this.sun.intensity = 3.1 * smooth(-0.04, 0.2, el) * dim;
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 300);
    } else {
      this.sun.color.setRGB(0.62, 0.72, 1); this.sun.intensity = 0.22 * (1 - oc * 0.6);
      this.sun.position.copy(focus).addScaledVector(this.moonDir, 300);
    }
    this.sun.target.position.copy(focus);
    // snap shadow camera to texels to avoid shimmering
    this.sun.castShadow = Q.shadows > 0 && this.sun.intensity > 0.12;
    const skyC = new THREE.Color().setRGB(lerp(0.09, 0.72, day), lerp(0.11, 0.8, day), lerp(0.2, 0.92, day)).lerp(new THREE.Color(0.95, 0.66, 0.48), golden * 0.5).lerp(new THREE.Color(0.55, 0.57, 0.6).multiplyScalar(lerp(0.2, 1, day)), oc * 0.6);
    this.hemi.color.copy(skyC); this.hemi.groundColor.setRGB(lerp(0.05, 0.28, day), lerp(0.06, 0.3, day), lerp(0.05, 0.2, day));
    this.hemi.intensity = lerp(0.35, 1.0, day) * (1 - this.rain * 0.2) + oc * 0.25 * day;
    scene.environmentIntensity = lerp(0.12, 0.9, day) * (1 - oc * 0.35);
    renderer.toneMappingExposure = lerp(0.95, 0.56, day) * (1 + oc * 0.12 * day);

    // fog (humid eastern NC haze)
    const fogDay = new THREE.Color(0xbfcbd6).lerp(new THREE.Color(0x9da3a8), oc * 0.7).lerp(new THREE.Color(0xe2b494), golden * 0.55);
    const fogNight = new THREE.Color(0x0b1120);
    scene.fog.color.copy(fogNight).lerp(fogDay, day);
    scene.fog.density = lerp(0.0007, 0.0011, oc) + this.rain * 0.0016 + (1 - day) * 0.0002;
    renderer.setClearColor(scene.fog.color);

    // stars & moon
    this.starMat.opacity = this.night * (1 - oc * 0.9); this.stars.position.copy(camera.position);
    this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 4200); this.moon.material.opacity = this.night * (1 - oc * 0.8);

    // clouds drift and follow the player
    const cloudTint = new THREE.Color().setRGB(lerp(0.13, 1, day), lerp(0.14, 1, day), lerp(0.2, 1, day)).lerp(new THREE.Color(1, 0.72, 0.55), golden * 0.7).multiplyScalar(1 - oc * 0.35 - this.rain * 0.25);
    const need = Math.floor(this.clouds.length * clamp(oc + 0.05, 0, 1));
    this.clouds.forEach((c, i) => {
      const d = c.userData; d.x += dt * 6; if (d.x - focus.x > 3500) d.x -= 7000; if (d.x - focus.x < -3500) d.x += 7000; if (d.z - focus.z > 3500) d.z -= 7000; if (d.z - focus.z < -3500) d.z += 7000;
      c.position.set(d.x, d.y + (oc > 0.9 ? -150 : 0), d.z); c.material.color.copy(cloudTint);
      const target = i < need ? (oc > 0.9 ? 0.95 : 0.85) : 0; c.material.opacity += (target - c.material.opacity) * Math.min(1, dt * 0.5); c.visible = c.material.opacity > 0.01;
    });

    // rain streaks
    this.rainMesh.visible = this.rain > 0.02;
    if (this.rainMesh.visible) {
      const p = this.rainMesh.geometry.attributes.position.array; const o = this.rainOff; const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < o.length / 3; i++) {
        o[3 * i + 1] -= dt * 24; if (o[3 * i + 1] < -6) o[3 * i + 1] += 36;
        const x = cx + o[3 * i], y = cy + o[3 * i + 1] - 10, z = cz + o[3 * i + 2];
        p[6 * i] = x; p[6 * i + 1] = y; p[6 * i + 2] = z; p[6 * i + 3] = x + 0.05; p[6 * i + 4] = y + 0.7; p[6 * i + 5] = z + 0.02;
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true; this.rainMesh.material.opacity = 0.32 * this.rain;
    }

    // emissive city lights
    const n = this.night;
    for (const k in MAT.facade) MAT.facade[k].emissiveIntensity = n * 1.25;
    MAT.lampHead.emissiveIntensity = n * 6; if (MAT.hmBulbs) MAT.hmBulbs.emissiveIntensity = 0.35 + n * 3.5; if (MAT.hmGlow) MAT.hmGlow.emissiveIntensity = 0.25 + n * 1.8; for (const m of MAT.signMats) m.emissiveIntensity = 0.06 + n * 0.3; if (MAT.foodSigns) for (const m of MAT.foodSigns) m.emissiveIntensity = 0.22 + n * 1.1; MAT.headlight.emissiveIntensity = 0.1 + n * 4; MAT.taillight.emissiveIntensity = 0.3 + n * 2.2;

    // environment map refresh when the sun has moved
    if (this.envDirty || this.sunDir.distanceTo(this.lastEnvSun) > 0.03) {
      this.envDirty = false; this.lastEnvSun.copy(this.sunDir);
      const eu = this.envSky.material.uniforms; for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[k].value = su[k].value; eu.sunPosition.value.copy(this.sunDir);
      if (this.envRT) this.envRT.dispose(); this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 1, 2000); scene.environment = this.envRT.texture;
    }
  },
  // pooled point lights at the nearest street lamps (night only)
  updateLampLights(focus) {
    const n = this.night; const want = n > 0.3 ? Q.lampLights : 0;
    let cands = [];
    if (want) for (const T of Tiles.map.values()) { if (T.state !== 'ready') continue; for (const p of T.lampPos) { const d = (p[0] - focus.x) ** 2 + (p[2] - focus.z) ** 2; if (d < 120 * 120) cands.push([d, p]); } }
    cands.sort((a, b) => a[0] - b[0]); cands = cands.slice(0, want);
    this.lampLights.forEach((l, i) => { const c = cands[i]; if (c) { l.position.set(c[1][0], c[1][1] - 0.3, c[1][2]); l.intensity = 90 * n; } else l.intensity = 0; });
  },
};
