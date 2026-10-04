// =====================================================================
// CAR / PLANE RADIO — the real stations you can pick up around Greenville, streamed live
// The streams are the "listen live" links on worldradiomap.com's Greenville, NC page (Oct 2026), kept
// to the ones that play in a browser over https. Translators that rebroadcast another station share
// its stream. It plays while you're in a vehicle (car, plane or helicopter) and goes quiet when you
// get out. Keys: O on / off · , and . tune down / up · - and = volume. The panel is clickable too.
// =====================================================================
const RADIO_STATIONS = [ // [frequency, band, call sign, name, stream]
  ['88.1', 'FM', 'W201AO', 'PRE Classical', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WZNBFM.mp3'],
  ['88.7', 'FM', 'WAGO', 'GoMix Radio', 'https://streaming.live365.com/a22636'],
  ['89.3', 'FM', 'WTEB', 'PRE News & Ideas', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WTEBFM.mp3'],
  ['89.5', 'FM', 'W208AO', 'FBN Radio', 'https://ice8.securenetsystems.net/WOTJ'],
  ['89.7', 'FM', 'WCPE', 'The Classical Station', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WCPE_FM.mp3'],
  ['89.9', 'FM', 'W210CF', 'PRE News & Ideas', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WTEBFM.mp3'],
  ['90.3', 'FM', 'WKNS', 'PRE Classical', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WZNBFM.mp3'],
  ['90.5', 'FM', 'WTGX', 'GoMix Radio', 'https://streaming.live365.com/a22636'],
  ['90.9', 'FM', 'WRQM', 'WUNC Public Radio', 'https://wunc-ice.streamguys1.com/wunc-128-mp3'],
  ['91.3', 'FM', 'WZMB', 'East Carolina University', 'https://ice41.securenetsystems.net/WZMB'],
  ['91.9', 'FM', 'W220BW', 'FBN Radio', 'https://ice8.securenetsystems.net/WOTJ'],
  ['93.3', 'FM', 'WERO', 'Bob 93.3', 'https://dbc.streamguys1.com/wero-fm.aac'],
  ['94.3', 'FM', 'WRHD', 'The Game', 'https://live.innerbanksmedia.com:8080/wrhd'],
  ['95.1', 'FM', 'WRNS', 'Your Country', 'https://dbc.streamguys1.com/wrns-fm.aac'],
  ['95.5', 'FM', 'WPWZ', 'Power 95.5', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WPWZFM.mp3'],
  ['97.3', 'FM', 'W247BG', 'The Classical Station', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WCPE_FM.mp3'],
  ['97.5', 'FM', 'WZUP', 'La Invasora', 'https://s9.voscast.com:8191/stream'],
  ['98.5', 'FM', 'WDWG', 'Big Dawg', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WDWGFM.mp3'],
  ['98.9', 'FM', 'WLXB', 'K-Love', 'https://maestro.emfcdn.com/stream_for/k-love/web/aac'],
  ['100.3', 'FM', 'WLGP', 'GNN Radio', 'https://ice7.securenetsystems.net/WLPE'],
  ['100.7', 'FM', 'WRDU', 'iHeartRadio', 'https://stream.revma.ihrhls.com/zc1645'],
  ['101.1', 'FM', 'WQZL', 'The River', 'https://dbc.streamguys1.com/wqsl-fm.aac'],
  ['101.5', 'FM', 'WRAL', 'Mix 101.5', 'https://ais-sa8.cdnstream1.com/2748_64.aac'],
  ['102.7', 'FM', 'W274CK', 'Oldies 94.1 / 102.7', 'https://live.innerbanksmedia.com:8080/wnbu'],
  ['103.7', 'FM', 'WTIB', 'Talk 96.3 / 103.7', 'https://live.innerbanksmedia.com:8080/wtib'],
  ['104.3', 'FM', 'WFXK', 'Foxy 107.1 / 104.3', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WFXCFM.mp3'],
  ['104.7', 'FM', 'WGTL', 'GoMix Early Light', 'https://streaming.live365.com/a83431'],
  ['106.9', 'FM', 'WBIS', 'Awesome Radio', 'https://streams.radio.co/s25554af3e/listen'],
  ['107.9', 'FM', 'WNCT', 'Greatest Hits', 'https://live.innerbanksmedia.com:8080/wnct'],
  ['680', 'AM', 'WPTF', 'NewsRadio 680', 'https://playerservices.streamtheworld.com/api/livestream-redirect/WPTFAM.mp3'],
  ['760', 'AM', 'WCPS', 'Gospel Music', 'https://us3.streamingpulse.com/ssl/7194'],
  ['1140', 'AM', 'WRVA', 'NewsRadio 1140', 'https://live.amperwave.net/direct/audacy-wrvaamaac-imc'],
];
const Radio = {
  on: false, idx: 11, vol: 0.6, el: null, audio: null, inVeh: false, live: false, state: '',
  init() {
    if (this.el) return;
    try { const s = JSON.parse(localStorage.getItem('gv-radio') || '{}'); if (s.idx >= 0 && s.idx < RADIO_STATIONS.length) this.idx = s.idx; if (s.vol >= 0 && s.vol <= 1) this.vol = s.vol; this.on = !!s.on; } catch (e) { }
    const a = this.audio = new Audio(); a.preload = 'none'; a.volume = this.vol;
    a.addEventListener('playing', () => this.setState('live'));
    a.addEventListener('waiting', () => { if (this.live) this.setState('tuning'); });
    a.addEventListener('error', () => { if (this.live) this.setState('nosignal'); });
    const el = this.el = document.createElement('div'); el.id = 'radio'; el.hidden = true;
    el.innerHTML = '<button class="rb pw" title="Radio on / off (O)" aria-label="Radio on or off">⏻</button>' +
      '<button class="rb" data-t="-1" title="Tune down (,)" aria-label="Previous station">◀</button>' +
      '<div class="rd"><div class="rf"></div><div class="rn"></div><div class="rs"></div></div>' +
      '<button class="rb" data-t="1" title="Tune up (.)" aria-label="Next station">▶</button>' +
      '<div class="rv"><button class="rb sm" data-v="-1" title="Volume down (-)" aria-label="Volume down">−</button><div class="rvb"><i></i></div><button class="rb sm" data-v="1" title="Volume up (=)" aria-label="Volume up">+</button></div>' +
      '<select class="rl" title="All stations" aria-label="Choose a station">' + RADIO_STATIONS.map((s, i) => `<option value="${i}">${s[0]} ${s[1]} · ${s[2]} ${s[3]}</option>`).join('') + '</select>';
    (document.getElementById('hud') || document.body).appendChild(el);
    el.querySelectorAll('button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault())); // don't take keyboard focus (Space must stay the brake)
    el.querySelector('.pw').onclick = () => this.power();
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => this.tune(+b.dataset.t));
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => this.volume(+b.dataset.v * 0.1));
    const sel = el.querySelector('.rl'); sel.onchange = () => { this.pick(+sel.value); sel.blur(); try { canvasEl.focus(); } catch (e) { } };
    el.querySelector('.rd').onclick = () => { if (this.state === 'tap') this.start(true); };
    addEventListener('keydown', e => this.onKey(e));
    setInterval(() => this.tick(), 250);
    this.render();
  },
  save() { try { localStorage.setItem('gv-radio', JSON.stringify({ on: this.on, idx: this.idx, vol: this.vol })); } catch (e) { } },
  tick() { // follow the player in and out of vehicles
    const inVeh = !!(typeof Game !== 'undefined' && Game.playing && typeof Player !== 'undefined' && /^(drive|fly|heli)$/.test(Player.mode));
    if (inVeh === this.inVeh) return; this.inVeh = inVeh; this.el.hidden = !inVeh;
    if (inVeh && this.on) this.start(); else if (!inVeh) this.stopAudio();
    this.render();
  },
  start(force) {
    const st = RADIO_STATIONS[this.idx]; const a = this.audio;
    if (!force && this.live && a.src === st[4] && !a.paused) return;
    this.live = true; this.setState('tuning'); this.static();
    a.src = st[4]; a.volume = this.vol;
    const p = a.play(); if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') this.setState('tap'); else if (this.live) this.setState('nosignal'); });
  },
  stopAudio() { this.live = false; const a = this.audio; a.pause(); a.removeAttribute('src'); a.load(); this.setState(''); }, // stop downloading the live stream too
  power() { this.on = !this.on; this.save(); if (this.on && this.inVeh) this.start(true); else this.stopAudio(); this.render(); if (typeof UI !== 'undefined') UI.toast(this.on ? 'Radio on — ' + this.label() : 'Radio off'); },
  pick(i) { this.idx = (i + RADIO_STATIONS.length) % RADIO_STATIONS.length; this.save(); if (!this.on) this.on = true; if (this.inVeh) this.start(true); this.render(); },
  tune(d) { this.pick(this.idx + d); },
  volume(d) { this.vol = Math.round(Math.max(0, Math.min(1, this.vol + d)) * 10) / 10; this.audio.volume = this.vol; this.save(); this.render(); },
  label() { const s = RADIO_STATIONS[this.idx]; return `${s[0]} ${s[1]} ${s[2]} · ${s[3]}`; },
  setState(s) { this.state = s; this.render(); },
  static() { // a short burst of tuning static between stations
    const A = typeof Sound !== 'undefined' && Sound.ctx; if (!A || !this.vol) return;
    try { const n = Math.floor(A.sampleRate * 0.35), b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = A.createBufferSource(); s.buffer = b; const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7; const g = A.createGain(); g.gain.value = 0.18 * this.vol;
      s.connect(f); f.connect(g); g.connect(A.destination); s.start(); } catch (e) { }
  },
  render() {
    const el = this.el; if (!el) return; const s = RADIO_STATIONS[this.idx];
    el.classList.toggle('off', !this.on);
    el.querySelector('.rf').textContent = this.on ? `${s[0]} ${s[1]}` : 'RADIO';
    el.querySelector('.rn').textContent = this.on ? `${s[2]} · ${s[3]}` : 'Off · press O';
    el.querySelector('.rs').textContent = !this.on ? '' : { tuning: 'Tuning…', live: '● Live', nosignal: 'No signal — try another station', tap: 'Click here to start' }[this.state] || '';
    el.querySelector('.rs').className = 'rs ' + this.state;
    el.querySelector('.rvb i').style.width = Math.round(this.vol * 100) + '%';
    const sel = el.querySelector('.rl'); if (+sel.value !== this.idx) sel.value = String(this.idx);
  },
  onKey(e) {
    if (!this.inVeh || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA'))) return;
    if (typeof Game !== 'undefined' && Game.paused) return;
    const c = e.code, k = (e.key || '').toLowerCase(); if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (c === 'KeyO' || k === 'o') this.power();
    else if (c === 'Comma' || k === ',' || k === '<') this.tune(-1);
    else if (c === 'Period' || k === '.' || k === '>') this.tune(1);
    else if (c === 'Minus' || c === 'NumpadSubtract' || k === '-' || k === '_') this.volume(-0.1);
    else if (c === 'Equal' || c === 'NumpadAdd' || k === '=' || k === '+') this.volume(0.1);
  },
};
Radio.init();
