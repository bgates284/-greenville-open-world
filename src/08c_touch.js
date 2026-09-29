// =====================================================================
// TOUCH CONTROLS — phones and tablets
//   • left thumb: a floating joystick (walk / steer / fly); push it to the edge to run
//   • right thumb: drag anywhere to look around, pinch to zoom the camera
//   • buttons change with what you're doing: on foot (jump, E, camera), driving (gas & brake
//     pedals, handbrake, horn, lights), flying (throttle, rudder, brakes)
// The controls press the same keys the keyboard does, so every game system just works.
// =====================================================================
const Touch = {
  on: false, owned: new Set(), stick: null, looks: new Map(), pinch: null, mode: '',
  isTouchDevice() { try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch (e) { return 'ontouchstart' in window; } },
  press(code) { if (!Keys.has(code)) Pressed.add(code); Keys.add(code); this.owned.add(code); },
  release(code) { if (this.owned.has(code)) { Keys.delete(code); this.owned.delete(code); } },
  tap(code) { this.press(code); setTimeout(() => this.release(code), 120); },

  init() {
    if (this.root || !this.isTouchDevice()) return;
    this.on = true; document.body.classList.add('touch');
    const css = document.createElement('style'); css.textContent = `
      body.touch #loc{left:66px;top:12px}
      body.touch #minimap{left:12px;top:62px;bottom:auto;width:104px;height:104px}
      body.touch #speedo{right:auto;left:50%;transform:translateX(-50%);bottom:auto;top:10px}
      body.touch #hint{bottom:auto;top:118px}
      #tc{position:fixed;inset:0;z-index:12;touch-action:none;user-select:none;-webkit-user-select:none;display:none}
      #tc .stick{position:absolute;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
      #tc .knob{position:absolute;left:39px;top:39px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.55);box-shadow:0 2px 8px rgba(0,0,0,.4)}
      #tc .ghost{position:absolute;left:34px;bottom:44px;width:96px;height:96px;border-radius:50%;border:2px dashed rgba(255,255,255,.28);pointer-events:none}
      #tc .btns{position:absolute;right:14px;bottom:18px;display:grid;grid-template-columns:repeat(3,64px);gap:10px;justify-items:center;align-items:end}
      #tc .top{position:absolute;right:12px;top:62px;display:flex;flex-direction:column;gap:8px}
      #tc button{width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:rgba(20,16,32,.55);color:#fff;font:700 13px/1.1 system-ui,Segoe UI,Arial,sans-serif;touch-action:none;padding:0;backdrop-filter:blur(3px)}
      #tc button.big{width:78px;height:78px;font-size:15px}
      #tc button.pedal{width:70px;height:96px;border-radius:14px}
      #tc button.small{width:48px;height:48px;font-size:12px}
      #tc button.on{background:rgba(242,194,48,.75);color:#1a1022;border-color:#f2c230}
      #tc .menu{position:absolute;left:12px;top:12px;width:44px;height:44px;border-radius:10px;font-size:20px}
      #tc .thr{position:absolute;right:16px;top:180px;width:10px;height:120px;border-radius:5px;background:rgba(255,255,255,.2);overflow:hidden}
      #tc .thr i{position:absolute;left:0;right:0;bottom:0;background:#f2c230}`;
    document.head.appendChild(css);
    const d = document.createElement('div'); d.id = 'tc';
    d.innerHTML = `<div class="ghost"></div><div class="stick"><div class="knob"></div></div><button class="menu" data-act="menu">☰</button><div class="top"></div><div class="btns"></div><div class="thr" hidden><i></i></div>`;
    document.body.appendChild(d); this.root = d; this.stickEl = d.querySelector('.stick'); this.knob = d.querySelector('.knob'); this.btns = d.querySelector('.btns'); this.topEl = d.querySelector('.top'); this.thrEl = d.querySelector('.thr');
    d.addEventListener('pointerdown', e => this.down(e)); d.addEventListener('pointermove', e => this.move(e));
    for (const ev of ['pointerup', 'pointercancel']) d.addEventListener(ev, e => this.up(e));
    d.addEventListener('contextmenu', e => e.preventDefault());
    // the map: pinch/drag already work as mouse; add a close button feel via the menu handler
    // big map on a phone: zoom buttons and a close button (drag to pan and tap to travel work as with a mouse)
    const bm = $('bigmap'); const z = document.createElement('div'); z.style.cssText = 'position:absolute;right:14px;top:14px;display:flex;gap:8px;z-index:2';
    for (const [t, f] of [['＋', () => { UI.bm.scale = clamp(UI.bm.scale * 1.4, 0.03, 4); UI.drawBig(); }], ['－', () => { UI.bm.scale = clamp(UI.bm.scale / 1.4, 0.03, 4); UI.drawBig(); }], ['✕', () => UI.closeBig()]]) {
      const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'width:48px;height:48px;border-radius:10px;border:2px solid rgba(255,255,255,.45);background:rgba(20,16,32,.75);color:#fff;font:700 22px system-ui'; b.addEventListener('click', f); z.appendChild(b); }
    bm.appendChild(z);
    setInterval(() => this.sync(), 200);
  },

  // ---------- which buttons are showing ----------
  layout(mode) {
    this.mode = mode; const B = this.btns, T = this.topEl; B.innerHTML = ''; T.innerHTML = ''; this.thrEl.hidden = mode !== 'fly';
    const add = (el, label, act, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.dataset.act = act; if (cls) b.className = cls; el.appendChild(b); return b; };
    if (mode === 'walk') {
      add(B, 'Cam', 'tap:KeyC', 'small'); add(B, 'E', 'tap:KeyE', 'big'); add(B, 'Map', 'map', 'small');
      add(B, '', 'none').style.visibility = 'hidden'; add(B, 'Jump', 'hold:Space', 'big'); add(B, 'Run', 'toggle:run');
      add(T, 'Time', 'time', 'small'); add(T, 'Sky', 'weather', 'small');
    } else if (mode === 'drive') {
      add(B, 'Horn', 'hold:KeyH', 'small'); add(B, 'Lights', 'tap:KeyL', 'small'); add(B, 'E', 'tap:KeyE');
      add(B, 'Brake', 'hold:KeyS', 'pedal'); add(B, 'Gas', 'hold:KeyW', 'pedal'); add(B, 'Hand\nbrake', 'hold:Space', 'small');
      add(T, 'Cam', 'tap:KeyC', 'small'); add(T, 'Map', 'map', 'small'); add(T, 'Flip', 'tap:KeyY', 'small');
    } else if (mode === 'fly') {
      add(B, 'Rud ◀', 'hold:KeyZ', 'small'); add(B, 'Rud ▶', 'hold:KeyX', 'small'); add(B, 'E', 'tap:KeyE', 'small');
      add(B, 'Thr −', 'hold:KeyF', 'big'); add(B, 'Thr +', 'hold:KeyR', 'big'); add(B, 'Brake', 'hold:Space', 'small');
      add(T, 'Cam', 'tap:KeyC', 'small'); add(T, 'Map', 'map', 'small');
    }
    this.runBtn = B.querySelector('[data-act="toggle:run"]');
  },
  sync() { // show only while playing; switch layouts with the player's mode
    if (!this.root) return;
    const show = Game.playing && !Game.paused && $('bigmap').hidden && !(typeof Cine !== 'undefined' && Cine.active);
    this.root.style.display = show ? 'block' : 'none'; if (!show) { this.clearAll(); return; }
    const m = Player.mode === 'fly' ? 'fly' : Player.mode === 'drive' ? 'drive' : 'walk'; if (m !== this.mode) { this.clearAll(); this.layout(m); }
    if (m === 'fly' && typeof Plane !== 'undefined') this.thrEl.firstChild.style.height = Math.round((Plane.thr || 0) * 100) + '%';
  },
  clearAll() { for (const c of [...this.owned]) this.release(c); this.stick = null; this.looks.clear(); this.pinch = null; if (this.stickEl) this.stickEl.style.display = 'none'; },

  // ---------- pointers ----------
  down(e) {
    if (e.pointerType === 'mouse') return; e.preventDefault(); const t = e.target;
    const act = t.dataset && t.dataset.act;
    if (act) { this.button(t, act, true, e); return; }
    try { this.root.setPointerCapture(e.pointerId); } catch (x) { }
    if (e.clientX < innerWidth * 0.42 && !this.stick) { // joystick appears under the thumb
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY }; const s = this.stickEl.style; s.left = e.clientX + 'px'; s.top = e.clientY + 'px'; s.display = 'block'; this.knob.style.transform = ''; return;
    }
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.looks.size === 2) { const [a, b] = [...this.looks.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  },
  move(e) {
    if (e.pointerType === 'mouse') return;
    if (this.stick && e.pointerId === this.stick.id) {
      let dx = e.clientX - this.stick.x, dy = e.clientY - this.stick.y; const R = 56, l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`; this.steer(dx / R, dy / R, l / R); return;
    }
    const L = this.looks.get(e.pointerId); if (!L) return;
    if (this.looks.size >= 2 && this.pinch) { // pinch = camera zoom
      L.x = e.clientX; L.y = e.clientY; const [a, b] = [...this.looks.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(d - this.pinch) > 18) { Mouse.wheel += d < this.pinch ? 1 : -1; this.pinch = d; } return;
    }
    Mouse.dx += (e.clientX - L.x) * 1.6; Mouse.dy += (e.clientY - L.y) * 1.6; Mouse.lastMove = performance.now() / 1000; L.x = e.clientX; L.y = e.clientY;
  },
  up(e) {
    if (e.pointerType === 'mouse') return;
    const t = e.target; if (t.dataset && t.dataset.act) { this.button(t, t.dataset.act, false, e); }
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.stickEl.style.display = 'none'; this.steer(0, 0, 0); }
    this.looks.delete(e.pointerId); if (this.looks.size < 2) this.pinch = null;
  },
  steer(x, y, mag) { // joystick → the same keys as WASD (driving: steering only, the pedals do gas/brake)
    const want = new Set(), dead = 0.28;
    if (x < -dead) want.add('KeyA'); if (x > dead) want.add('KeyD');
    if (this.mode !== 'drive') { if (y < -dead) want.add('KeyW'); if (y > dead) want.add('KeyS'); }
    if (this.mode === 'walk' && (mag > 0.92 || this.runLatched) && want.size) want.add('ShiftLeft');
    for (const c of ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft']) { if (this.mode === 'drive' && (c === 'KeyW' || c === 'KeyS')) continue; if (want.has(c)) { if (!Keys.has(c)) this.press(c); } else if (this.owned.has(c) && !this.held.has(c)) this.release(c); }
  },
  held: new Set(),
  button(el, act, isDown, e) {
    e.preventDefault(); const [kind, code] = act.split(':');
    if (kind === 'hold') { if (isDown) { this.press(code); this.held.add(code); el.classList.add('on'); } else { this.held.delete(code); this.release(code); el.classList.remove('on'); } return; }
    if (!isDown) return;
    if (kind === 'tap') this.tap(code);
    else if (kind === 'toggle') { this.runLatched = !this.runLatched; el.classList.toggle('on', this.runLatched); }
    else if (act === 'map') { $('bigmap').hidden ? UI.openBig() : UI.closeBig(); }
    else if (act === 'menu') Game.pause();
    else if (act === 'time') { Env.hour = (Env.hour + 1) % 24; UI.toast('Time: ' + UI.fmtHour(Env.hour)); }
    else if (act === 'weather') { const order = ['clear', 'partly', 'overcast', 'rain']; Env.setWeather(order[(order.indexOf(Env.weather) + 1) % 4]); UI.toast('Weather: ' + Env.weather); }
  },
};
Touch.init();
