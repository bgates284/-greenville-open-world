// =====================================================================
// DRONE CAMERA — no body, no car: a free camera that flies anywhere, fast.
//   mouse (or drag on a phone): look      W A S D (or the stick): fly where you're looking / strafe
//   Space / R: up      Q / C / F: down (not Ctrl — Ctrl+W would close the tab)      Shift: boost ×4      wheel (or pinch): cruise speed
//   E: land and walk from the spot below      the big map (M) still travels anywhere
// Started from the menu's "Fly as a drone" button. Never hits anything; stays just above the ground.
// =====================================================================
const Drone = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.3, speed: 60,
  dir: new THREE.Vector3(),
  enter(x, z, yaw) {
    const P = Player; P.unseat(); P.mode = 'drone'; P.person.g.visible = false; P.vel.set(0, 0, 0);
    const gx = x != null ? x : P.pos.x, gz = z != null ? z : P.pos.z;
    this.pos.set(gx, H(gx, gz) + 45, gz); this.vel.set(0, 0, 0);
    this.yaw = yaw != null ? yaw : P.camYaw; this.pitch = -0.3;
    UI.hint(''); UI.toast(Touch.on ? 'Drone camera — left thumb to fly, drag to look, Up / Down buttons, pinch for speed, Land to walk' : 'Drone camera — mouse to look, WASD to fly, Space / Q up & down, Shift to boost, wheel for speed, E to land', 6000);
  },
  land() { // drop to the street below and carry on walking
    const x = this.pos.x, z = this.pos.z; Player.placeAt(x, z, false); Player.camYaw = this.yaw; UI.toast('Landed — open the menu (Esc) and press “Fly as a drone” to take off again from here', 4000);
  },
  update(dt) {
    const sens = 0.0024;
    this.yaw -= Mouse.dx * sens; this.pitch = clamp(this.pitch - Mouse.dy * sens, -1.5, 1.4); Mouse.dx = Mouse.dy = 0;
    if (Mouse.wheel) { this.speed = clamp(this.speed * (1 - Mouse.wheel * 0.18), 4, 1500); Mouse.wheel = 0; UI.toast('Drone speed ' + Math.round(this.speed * 2.237) + ' mph', 1200); }
    if (hit('KeyE')) { this.land(); return; }
    if (hit('KeyL')) { Player.headlights = !Player.headlights; }
    const cp = Math.cos(this.pitch), f = this.dir.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); // where the camera points
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);                                                                   // its right-hand side
    let mx = 0, my = 0, mz = 0; const fw = (key('KeyW', 'ArrowUp') ? 1 : 0) - (key('KeyS', 'ArrowDown') ? 1 : 0), st = (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0);
    const up = (key('Space', 'KeyR', 'PageUp') ? 1 : 0) - (key('KeyQ', 'KeyF', 'KeyC', 'PageDown') ? 1 : 0);
    mx = f.x * fw + rx * st; my = f.y * fw + up; mz = f.z * fw + rz * st;
    const l = Math.hypot(mx, my, mz); const sp = this.speed * (key('ShiftLeft', 'ShiftRight') ? 4 : 1);
    const tx = l ? mx / l * sp : 0, ty = l ? my / l * sp : 0, tz = l ? mz / l * sp : 0;
    const k = 1 - Math.exp(-dt * (l ? 4 : 5)); // glide up to speed, settle quickly when you let go
    this.vel.x += (tx - this.vel.x) * k; this.vel.y += (ty - this.vel.y) * k; this.vel.z += (tz - this.vel.z) * k;
    this.pos.addScaledVector(this.vel, dt);
    const floor = H(this.pos.x, this.pos.z) + 1.4; if (this.pos.y < floor) { this.pos.y = floor; if (this.vel.y < 0) this.vel.y = 0; }
    if (this.pos.y > 4000) { this.pos.y = 4000; if (this.vel.y > 0) this.vel.y = 0; }
    camera.position.copy(this.pos); camera.lookAt(this.pos.x + f.x, this.pos.y + f.y, this.pos.z + f.z);
    Player.yaw = this.yaw + Math.PI; Player.camYaw = this.yaw; // (the minimap arrow)
  },
};
