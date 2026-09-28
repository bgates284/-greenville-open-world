// =====================================================================
// PEOPLE — one skinned mesh per person, detailed parts + a shared texture atlas
// (faces, printed shirts, denim, sneakers). Atlas: 2048px, 8x8 cells of 256px.
// =====================================================================
const PCELL = 256, PGRID = 8;
const OUTFITS = {
  tee: { cell: [0, 1], fixed: false, sleeve: 'short' }, polo: { cell: [1, 1], fixed: false, sleeve: 'short', collar: true },
  button: { cell: [2, 1], fixed: false, sleeve: 'long', collar: true }, hoodie: { cell: [3, 1], fixed: false, sleeve: 'long', hood: true },
  tank: { cell: [4, 1], fixed: false, sleeve: 'none' }, jacket: { cell: [5, 1], fixed: false, sleeve: 'long', collar: true },
  ecu: { cell: [6, 1], fixed: true, sleeve: 'short', tint: 0x4b1f78 }, pirates: { cell: [7, 1], fixed: true, sleeve: 'short', tint: 0xf2c230 },
  flannelR: { cell: [0, 2], fixed: true, sleeve: 'long', collar: true, tint: 0x9a2a2a }, flannelB: { cell: [1, 2], fixed: true, sleeve: 'long', collar: true, tint: 0x2a4a7a },
  stripes: { cell: [2, 2], fixed: true, sleeve: 'short', tint: 0x1f2a44 }, gville: { cell: [3, 2], fixed: true, sleeve: 'short', tint: 0x9a9a9a },
  jersey: { cell: [4, 2], fixed: true, sleeve: 'short', tint: 0x4b1f78 }, scrubs: { cell: [5, 2], fixed: true, sleeve: 'short', tint: 0x2a7f86, pants: 'scrubs' },
  floral: { cell: [6, 2], fixed: true, sleeve: 'none', dress: true, tint: 0xd86a7a }, labcoat: { cell: [7, 2], fixed: true, sleeve: 'long', coat: true, tint: 0xf4f4f2, pants: 'chino' },
  // hospital: scrubs in any colour (top + matching pants), patient gown
  scrubsT: { cell: [0, 5], fixed: false, sleeve: 'short', pants: 'scrubsT' }, gown: { cell: [1, 5], fixed: true, sleeve: 'short', dress: true, gown: true },
};
const PANTS_KIND = { jeans: [0, 3, true, 0x3d5a88], darkjeans: [1, 3, true, 0x1f2a44], chino: [2, 3, false], shorts: [3, 3, false], leggings: [4, 3, true, 0x1b1b1d], sweats: [5, 3, true, 0x8f9296], skirt: [6, 3, false], scrubs: [7, 3, true, 0x2a7f86], scrubsT: [2, 5, false] };
const HOSPITAL = [35.6075, -77.4031];
function nearHospital(x, z) { return Math.hypot(x - lonToX(HOSPITAL[1]), z - latToZ(HOSPITAL[0])) < 450; }
const CELL = { skin: [0, 4], hair: [1, 4], sneakW: [2, 4], sneakB: [3, 4], boots: [4, 4], plain: [5, 4], capECU: [6, 4], pack: [7, 4], grip: [3, 5], clog: [4, 5] };
// real scrub colours (ECU Health nurses wear navy / ceil blue / wine; techs & students other colours)
const SCRUB = [0x22345c, 0x22345c, 0x6f9fd0, 0x6f9fd0, 0x2a7f86, 0x6b2437, 0x2f5a44, 0x4a5058, 0x5b2a86, 0x1d1f24];
function buildPersonAtlas() {
  const S = PCELL * PGRID; const c = cnv(S, S), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
  const r = mulberry32(2024);
  const at = (col, row, fn) => { g.save(); g.translate(col * PCELL, row * PCELL); g.beginPath(); g.rect(0, 0, PCELL, PCELL); g.clip(); fn(g); g.restore(); };
  const grain = (a = 0.06, dens = 900) => { for (let i = 0; i < dens; i++) { g.fillStyle = `rgba(0,0,0,${r() * a})`; g.fillRect(r() * PCELL, r() * PCELL, 1 + r() * 2, 1 + r() * 2); } };
  const font = (w, px) => `${w} ${px}px "Big Shoulders Display","Arial Narrow",Impact,sans-serif`;
  // ---------- faces (row 0). Head sphere: face centre at u=0.25 -> x=64; equator at y=128 ----------
  const face = (i) => at(i, 0, g => {
    const fem = i >= 4; const cx = 64;
    // soft skin shading: cheeks, under-brow, jaw
    const shade = (x, y, rx, ry, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120); g.restore(); };
    shade(cx, 150, 28, 10, 'rgba(120,70,60,.12)');           // under-nose / philtrum
    shade(cx - 20, 136, 10, 8, fem ? 'rgba(220,90,90,.22)' : 'rgba(200,90,80,.08)'); shade(cx + 20, 136, 10, 8, fem ? 'rgba(220,90,90,.22)' : 'rgba(200,90,80,.08)');
    shade(cx, 108, 30, 6, 'rgba(90,50,40,.10)');             // brow ridge shadow
    // eyebrows
    g.strokeStyle = i === 7 ? 'rgba(140,130,120,.9)' : 'rgba(40,24,16,.85)'; g.lineCap = 'round';
    g.lineWidth = fem ? 2.2 : (i === 3 ? 5 : 3.4);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 7, 110); g.quadraticCurveTo(cx + s * 13, fem ? 104 : 106, cx + s * 20, fem ? 108 : 109); g.stroke(); }
    // eyelid line / lashes
    g.strokeStyle = 'rgba(30,18,14,.75)'; g.lineWidth = fem ? 2.2 : 1.4;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 8.5, 119); g.quadraticCurveTo(cx + s * 13, 115.5, cx + s * 18, 119); g.stroke(); if (fem) { g.beginPath(); g.moveTo(cx + s * 18, 119); g.lineTo(cx + s * 20.5, 117); g.stroke(); } }
    // under-eye
    g.strokeStyle = 'rgba(90,50,40,.18)'; g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 9, 126); g.quadraticCurveTo(cx + s * 13, 128, cx + s * 17, 126); g.stroke(); }
    // nose shading
    g.strokeStyle = 'rgba(100,55,45,.22)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 3, 120); g.quadraticCurveTo(cx - 5, 134, cx - 6, 140); g.stroke();
    g.fillStyle = 'rgba(60,30,25,.35)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 3.5, 143, 2, 1.2, 0, 0, 7); g.fill(); }
    // mouth
    const lip = fem ? (i === 5 ? 'rgba(170,20,40,.95)' : 'rgba(200,95,105,.85)') : 'rgba(150,80,75,.55)';
    g.fillStyle = lip; g.beginPath(); g.moveTo(cx - 9, 156); g.quadraticCurveTo(cx - 4, 151.5, cx, 153.5); g.quadraticCurveTo(cx + 4, 151.5, cx + 9, 156); g.quadraticCurveTo(cx, 158, cx - 9, 156); g.fill();
    g.beginPath(); g.moveTo(cx - 9, 156); g.quadraticCurveTo(cx, 163, cx + 9, 156); g.quadraticCurveTo(cx, 158.5, cx - 9, 156); g.fill();
    g.strokeStyle = 'rgba(70,30,28,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 9, 156); g.quadraticCurveTo(cx, 158.5, cx + 9, 156); g.stroke();
    // chin / jaw definition
    g.strokeStyle = 'rgba(100,60,50,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, 170); g.quadraticCurveTo(cx, 174, cx + 8, 170); g.stroke();
    if (i === 1 || i === 2) { // stubble / beard shadow
      for (let k = 0; k < (i === 2 ? 2200 : 1100); k++) { const a = r() * Math.PI, rr = 20 + r() * 26; const x = cx + Math.cos(a) * rr * 1.1, y = 150 + Math.sin(a) * rr * 0.75 - 6; if (y < 145 && Math.abs(x - cx) < 14) continue; g.fillStyle = `rgba(35,25,20,${0.25 + r() * 0.35})`; g.fillRect(x, y, 1.3, 1.3); }
      for (let k = 0; k < 300; k++) { g.fillStyle = 'rgba(35,25,20,.45)'; g.fillRect(cx - 10 + r() * 20, 147 + r() * 4, 1.2, 1.2); }
    }
    if (i === 6) for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(150,80,50,${0.3 + r() * 0.3})`; g.beginPath(); g.arc(cx + (r() - .5) * 44, 128 + (r() - .5) * 18, 0.9, 0, 7); g.fill(); }
    if (i === 7) { g.strokeStyle = 'rgba(90,55,45,.28)'; g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 11, 146); g.quadraticCurveTo(cx + s * 15, 154, cx + s * 13, 162); g.stroke(); g.beginPath(); g.moveTo(cx + s * 20, 116); g.lineTo(cx + s * 25, 114); g.stroke(); } g.beginPath(); g.moveTo(cx - 10, 98); g.lineTo(cx + 10, 98); g.stroke(); }
  });
  for (let i = 0; i < 8; i++) face(i);
  // ---------- shirts (rows 1–2). Torso lathe: front centre x=128; chest ~y 100; hem ~y 180 ----------
  const shirtBase = (col, row, bg, fn) => at(col, row, g => { g.fillStyle = bg; g.fillRect(0, 0, PCELL, 185); grain(0.05, 1500);
    // fabric folds
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); const x = r() * 256; g.moveTo(x, 120 + r() * 30); g.quadraticCurveTo(x + 10, 150, x + (r() - .5) * 20, 182); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 178, PCELL, 7); // hem
    g.fillStyle = '#fff'; g.fillRect(0, 185, PCELL, 71);         // below hem: left white so pants colour shows
    fn && fn(g); });
  const collarV = (g, col = 'rgba(0,0,0,.25)') => { g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(104, 26); g.quadraticCurveTo(128, 50, 152, 26); g.stroke(); };
  shirtBase(0, 1, '#f2f2f2', g => collarV(g));
  shirtBase(1, 1, '#f2f2f2', g => { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(122, 22, 12, 46); g.fillStyle = 'rgba(255,255,255,.9)'; for (const y of [34, 50]) { g.beginPath(); g.arc(128, y, 3, 0, 7); g.fill(); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(140, 70, 20, 3); });
  shirtBase(2, 1, '#f4f4f4', g => { g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(125, 20, 6, 165); g.fillStyle = '#fafafa'; for (let y = 36; y < 180; y += 24) { g.beginPath(); g.arc(128, y, 2.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke(); } g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(146, 70, 22, 22); });
  shirtBase(3, 1, '#ededed', g => { g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.moveTo(92, 120); g.lineTo(164, 120); g.lineTo(172, 172); g.lineTo(84, 172); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2.5; for (const x of [118, 138]) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + (x < 128 ? -2 : 2), 80); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 172, 256, 13); });
  shirtBase(4, 1, '#f2f2f2', g => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(96, 20); g.quadraticCurveTo(128, 70, 160, 20); g.lineTo(160, 0); g.lineTo(96, 0); g.fill(); });
  shirtBase(5, 1, '#e6e6e6', g => { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(126, 16, 4, 170); g.fillStyle = 'rgba(200,200,200,.9)'; g.fillRect(124, 16, 8, 6); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; for (const x of [96, 160]) { g.beginPath(); g.moveTo(x, 110); g.lineTo(x, 150); g.stroke(); } });
  const printTee = (col, row, bg, ink, lines, sizes, ys) => shirtBase(col, row, bg, g => { collarV(g, 'rgba(0,0,0,.3)'); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((t, k) => { g.font = font(800, sizes[k]); g.fillText(t, 128, ys[k], 110); }); });
  printTee(6, 1, '#4b1f78', '#f2c230', ['ECU'], [58], [96]);
  printTee(7, 1, '#f2c230', '#4b1f78', ['PIRATES', 'EAST CAROLINA'], [40, 16], [90, 118]);
  const plaid = (col, row, base, c1, c2) => shirtBase(col, row, base, g => { g.globalAlpha = 0.55; for (let x = 0; x < 256; x += 32) { g.fillStyle = c1; g.fillRect(x, 0, 12, 185); } for (let y = 0; y < 185; y += 32) { g.fillStyle = c1; g.fillRect(0, y, 256, 12); } g.globalAlpha = 0.6; for (let x = 20; x < 256; x += 32) { g.fillStyle = c2; g.fillRect(x, 0, 3, 185); } for (let y = 20; y < 185; y += 32) { g.fillStyle = c2; g.fillRect(0, y, 256, 3); } g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(125, 20, 6, 165); });
  plaid(0, 2, '#9a2a2a', '#3a1010', '#e8d8b0'); plaid(1, 2, '#2a4a7a', '#101c33', '#d8e0f0');
  shirtBase(2, 2, '#f4f4f0', g => { g.fillStyle = '#1f2a44'; for (let y = 8; y < 178; y += 18) g.fillRect(0, y, 256, 8); collarV(g, 'rgba(0,0,0,.35)'); });
  printTee(3, 2, '#9a9a9a', '#f4f4f4', ['GREENVILLE', 'N.C.  EST. 1774'], [36, 15], [92, 118]);
  shirtBase(4, 2, '#4b1f78', g => { g.fillStyle = '#f2c230'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(800, 70); g.fillText('1', 128, 110); g.font = font(800, 18); g.fillText('PIRATES', 128, 64); g.fillStyle = '#f2c230'; g.fillRect(0, 0, 256, 8); g.fillStyle = 'rgba(255,255,255,.2)'; for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 185); });
  shirtBase(5, 2, '#2a7f86', g => { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(100, 18); g.lineTo(128, 64); g.lineTo(156, 18); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(146, 80, 26, 26); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(150, 76, 3, 12); });
  shirtBase(6, 2, '#d86a7a', g => { for (let k = 0; k < 110; k++) { const x = r() * 256, y = r() * 185; const pc = pick(['#fff2c8', '#fbe2ea', '#f7c948', '#ffffff'], r()); g.fillStyle = pc; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 4, y + Math.sin(p * 1.26) * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#7a3a1a'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 70, 256, 5); });
  shirtBase(7, 2, '#f7f7f5', g => { g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(100, 16); g.lineTo(122, 110); g.lineTo(134, 110); g.lineTo(156, 16); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.strokeRect(150, 70, 26, 22); g.fillStyle = '#4b1f78'; g.font = font(600, 12); g.textAlign = 'center'; g.fillText('ECU HEALTH', 96, 82); });
  // ---------- legs (row 3). Leg capsules wrap the whole cell ----------
  const denim = (col, row, base, thread) => at(col, row, g => { g.fillStyle = base; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`; g.fillRect(0, y, 256, 1); } for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 2, 1); }
    g.strokeStyle = thread; g.setLineDash([4, 3]); g.lineWidth = 1.5; for (const x of [62, 66, 190, 194]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.setLineDash([]);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(0.45, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
  denim(0, 3, '#3d5a88', 'rgba(210,160,70,.7)'); denim(1, 3, '#1f2a44', 'rgba(210,160,70,.55)');
  at(2, 3, g => { grain(0.07, 2500); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5; for (const x of [64, 192]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 240, 256, 16); });
  at(3, 3, g => { grain(0.07, 2500); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 244, 256, 12); });
  at(4, 3, g => { g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, 256, 256); const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
  at(5, 3, g => { g.fillStyle = '#8f9296'; g.fillRect(0, 0, 256, 256); grain(0.12, 4000); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(58, 0, 4, 256); g.fillRect(194, 0, 4, 256); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 236, 256, 20); });
  at(6, 3, g => { grain(0.06, 2000); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; for (let x = 0; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 256); g.stroke(); } });
  at(7, 3, g => { g.fillStyle = '#2a7f86'; g.fillRect(0, 0, 256, 256); grain(0.1, 2500); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; for (const x of [64, 192]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } });
  // ---------- misc (row 4) ----------
  at(0, 4, g => { for (let k = 0; k < 5000; k++) { g.fillStyle = `rgba(${r() < .5 ? '150,80,70' : '255,255,255'},${r() * 0.05})`; g.fillRect(r() * 256, r() * 256, 2, 2); } });
  at(1, 4, g => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 900; k++) { const x = r() * 256; g.strokeStyle = r() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.35)'; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - .5) * 20, 80, x + (r() - .5) * 20, 170, x + (r() - .5) * 10, 256); g.stroke(); } });
  const shoeCell = (col, upper, sole, laces) => at(col, 4, g => { g.fillStyle = upper; g.fillRect(0, 0, 256, 256); grain(0.1, 1500); g.fillStyle = sole; g.fillRect(0, 196, 256, 60); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 192, 256, 5); if (laces) { g.strokeStyle = laces; g.lineWidth = 5; for (let y = 30; y < 150; y += 26) { g.beginPath(); g.moveTo(96, y); g.lineTo(160, y + 10); g.stroke(); } } g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(20, 150); g.quadraticCurveTo(128, 120, 236, 150); g.stroke(); });
  shoeCell(2, '#f2f2f2', '#dcdcdc', '#fafafa'); shoeCell(3, '#1d1d1f', '#f0f0f0', '#dddddd'); shoeCell(4, '#6a4428', '#2a1a10', '#3a2416');
  at(5, 4, g => { grain(0.05, 1500); });
  at(6, 4, g => { g.fillStyle = '#4b1f78'; g.fillRect(0, 0, 256, 256); grain(0.1, 1500); g.fillStyle = '#f2c230'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(800, 60); g.fillText('ECU', 64, 150); });
  at(7, 4, g => { grain(0.12, 2500); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.strokeRect(40, 60, 176, 120); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(60, 60, 136, 6); });
  // ---------- hospital (row 5) ----------
  shirtBase(0, 5, '#f2f2f2', g => { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 4; g.beginPath(); g.moveTo(100, 18); g.lineTo(128, 66); g.lineTo(156, 18); g.stroke(); // V-neck scrub top
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; g.strokeRect(146, 84, 28, 26); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(150, 80, 2, 12); g.fillRect(156, 80, 2, 10); g.fillRect(0, 170, 256, 4); });
  shirtBase(1, 5, '#b9d3e6', g => { g.fillStyle = '#b9d3e6'; g.fillRect(0, 0, 256, 256); // patient gown: pale blue with a small navy diamond print
    for (let y = 6; y < 256; y += 18) for (let x = (y / 18 & 1) * 9; x < 256; x += 18) { g.fillStyle = 'rgba(40,60,110,.55)'; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { const x = 20 + k * 44; g.beginPath(); g.moveTo(x, 150); g.quadraticCurveTo(x + 6, 200, x - 4, 256); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(96, 18); g.quadraticCurveTo(128, 34, 160, 18); g.stroke(); });
  at(2, 5, g => { grain(0.08, 2500); g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 2; for (const x of [64, 192]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 0, 256, 10); });
  at(3, 5, g => { g.fillStyle = '#f2dd6a'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,.85)'; for (let y = 14; y < 256; y += 22) for (let x = 8; x < 256; x += 22) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } }); // yellow non-slip socks
  at(4, 5, g => { g.fillStyle = '#e9e9ec'; g.fillRect(0, 0, 256, 256); grain(0.08, 900); g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 40; y < 180; y += 30) for (let x = 60; x < 200; x += 30) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); } }); // clogs
  const t = ctex(c, { wrap: false }); t.anisotropy = MAX_ANISO; return t;
}
// who you meet at the hospital: role → look overrides for makePerson
function hospitalLook(r, role) {
  if (!role) { const u = r(); role = u < 0.2 ? 'doctor' : u < 0.55 ? 'nurse' : u < 0.67 ? 'patient' : 'visitor'; }
  const L = { role }; const fem = role === 'nurse' ? r() < 0.82 : r() < 0.5; L.fem = fem;
  L.face = fem ? 4 + Math.floor(r() * 3) : Math.floor(r() * 4); L.beard = !fem && r() < 0.15; L.earrings = fem && r() < 0.4;
  L.hairStyle = fem ? pick(['bun', 'bun', 'pony', 'bob', 'long', 'curly', 'braids'], r()) : pick(['short', 'short', 'fade', 'buzz', 'bald', 'curly'], r());
  L.scale = (fem ? 0.93 : 1.0) * (0.94 + r() * 0.12);
  if (role === 'nurse' || (role === 'doctor' && r() < 0.35)) { // scrubs (surgeons / residents wear them too)
    const c = pick(SCRUB, r()); L.top = 'scrubsT'; L.shirt = c; L.pants = c; L.pantsKind = 'scrubsT';
    L.shoe = r() < 0.4 ? 'clog' : pick(['sneakW', 'sneakW', 'sneakB'], r());
    L.surgCap = r() < (role === 'doctor' ? 0.5 : 0.2); L.capC = r() < 0.5 ? c : pick([0x6f9fd0, 0x2f5a44, 0x8a3a6a, 0x223a6a], r());
    L.mask = r() < 0.12; L.badge = true; L.stetho = role === 'doctor' || r() < 0.45; L.backpack = false;
    if (role === 'doctor' && r() < 0.5) { L.top = 'labcoat'; L.pantsKind = 'scrubsT'; } // white coat over scrubs
  } else if (role === 'doctor') {
    L.top = 'labcoat'; L.pantsKind = 'chino'; L.pants = pick([0x2a2a2a, 0x3a4a5a, 0x5a4a3a, 0x1f2a44, 0x7a6a50], r()); L.shoe = pick(['boots', 'sneakB', 'sneakB'], r());
    L.stetho = true; L.badge = true; L.backpack = false; L.glasses = r() < 0.35;
  } else if (role === 'patient') {
    L.top = 'gown'; L.pantsKind = null; L.shoe = 'grip'; L.backpack = false; L.belt = false; L.band = true; L.watch = false;
    if (r() < 0.5) L.hairStyle = fem ? pick(['bob', 'bun', 'curly'], r()) : pick(['short', 'bald', 'buzz'], r());
  } else { L.backpack = false; if (r() < 0.3) L.badge = true; } // visitors
  return L;
}
// remap a geometry's uv (0..1) into atlas cell [col,row], optional sub-rect [u0,v0,w,h] in cell space
function toCell(g, cell, sub) {
  const uv = g.attributes.uv; if (!uv || !cell) return; const [col, row] = cell; const cw = 1 / PGRID;
  const [su, sv, sw, sh] = sub || [0, 0, 1, 1];
  for (let i = 0; i < uv.count; i++) {
    const u = su + clamp(uv.getX(i), 0, 1) * sw, v = sv + clamp(uv.getY(i), 0, 1) * sh;
    uv.setXY(i, col * cw + (0.004 + u * 0.992) * cw, 1 - (row + 1) * cw + (0.004 + v * 0.992) * cw);
  }
}

const SKIN = [0x3b271c, 0x4a2f22, 0x6b4630, 0x8d5f3d, 0xa8744f, 0xc08a64, 0xd4a07a, 0xdcae8a, 0xe8b894, 0xf0c9a8];
const SHIRT = [0xf2f2f2, 0x2f2f2f, 0x223a6a, 0x9a1f2a, 0x3e6a3a, 0xd97a2a, 0x6aa0c8, 0xb04a7a, 0x8a8a8a, 0x1f5e5a, 0xc9b99a, 0x5b2a86, 0xe8d24a];
const PANTS = [0x1f2a44, 0x2a2a2a, 0x5a4a3a, 0x3a4a5a, 0x7a6a50, 0x1a1a1a, 0x4a5a70, 0xb9ab8c, 0x33405e, 0x6b3a3a];
const HAIR = [0x120d0a, 0x1a1410, 0x2e2018, 0x4a3020, 0x6b4a2a, 0x9a7440, 0xc9a86a, 0x7a7a7a, 0xd8d0c0, 0x7a2e1a];
const EYES = [0x3a2414, 0x4a2c16, 0x2a1a10, 0x3d6a8a, 0x4f7a4a, 0x6a5a30];
const BONE_REST = [
  ['hips', -1, 0, 0.95, 0], ['spine', 0, 0, 1.07, 0], ['chest', 1, 0, 1.27, 0], ['neck', 2, 0, 1.47, 0], ['head', 3, 0, 1.55, 0],
  ['uArmL', 2, 0.2, 1.43, 0], ['lArmL', 5, 0.2, 1.15, 0], ['uArmR', 2, -0.2, 1.43, 0], ['lArmR', 7, -0.2, 1.15, 0],
  ['uLegL', 0, 0.095, 0.93, 0], ['lLegL', 9, 0.095, 0.5, 0], ['footL', 10, 0.095, 0.08, 0],
  ['uLegR', 0, -0.095, 0.93, 0], ['lLegR', 12, -0.095, 0.5, 0], ['footR', 13, -0.095, 0.08, 0],
];
const BI = {}; BONE_REST.forEach((b, i) => BI[b[0]] = i);
function randomLook(r, near) {
  const fem = r() < 0.5;
  const L = { fem };
  L.skin = pick(SKIN, r()); L.hair = pick(HAIR, r()); L.eyes = pick(EYES, r());
  const tops = near === 'hospital' ? ['scrubs', 'scrubs', 'labcoat', 'polo', 'tee'] : ['tee', 'tee', 'polo', 'button', 'hoodie', 'tank', 'jacket', 'ecu', 'ecu', 'pirates', 'flannelR', 'flannelB', 'stripes', 'gville', 'jersey', ...(fem ? ['floral', 'floral'] : [])];
  L.top = pick(tops, r()); L.shirt = pick(SHIRT, r());
  const o = OUTFITS[L.top];
  L.pantsKind = o.pants || (o.dress ? null : pick(fem ? ['jeans', 'jeans', 'darkjeans', 'leggings', 'shorts', 'skirt', 'chino', 'sweats'] : ['jeans', 'jeans', 'darkjeans', 'chino', 'chino', 'shorts', 'shorts', 'sweats'], r()));
  L.pants = pick(PANTS, r());
  L.shoe = pick(['sneakW', 'sneakW', 'sneakB', 'boots'], r());
  L.hairStyle = fem ? pick(['long', 'long', 'bob', 'bun', 'pony', 'curly', 'braids'], r()) : pick(['short', 'short', 'short', 'buzz', 'bald', 'curly', 'cap', 'cap', 'fade'], r());
  L.face = fem ? 4 + Math.floor(r() * 3) : Math.floor(r() * 4); if (r() < 0.12) L.face = 7;
  L.beard = !fem && (L.face === 2 || r() < 0.12); L.glasses = r() < 0.2; L.watch = r() < 0.35; L.earrings = fem && r() < 0.5;
  L.backpack = near !== 'hospital' && r() < 0.3; L.belt = r() < 0.6; L.packC = pick([0x1a1a1a, 0x5b2a86, 0x223a6a, 0x8a1c1c, 0x3e5a3a, 0x7a6a50], r());
  L.hatC = r() < 0.55 ? 'ecu' : pick([0x1a1a1a, 0x223a6a, 0x8a8a8a, 0x7a1418], r());
  L.scale = (fem ? 0.93 : 1.0) * (0.94 + r() * 0.12); L.width = 0.9 + r() * 0.22;
  return L;
}
function makePerson(seed, look) {
  const r = mulberry32(seed * 977 + 13);
  const L = Object.assign(randomLook(r), look || {});
  const o = OUTFITS[L.top] || OUTFITS.tee; const fem = L.fem;
  const shirtC = o.fixed ? 0xffffff : L.shirt; const shirtCell = o.cell;
  const pk = PANTS_KIND[L.pantsKind] || PANTS_KIND.jeans; const pantsC = pk[2] ? 0xffffff : L.pants; const pantsCell = [pk[0], pk[1]];
  const shorts = L.pantsKind === 'shorts', skirt = L.pantsKind === 'skirt', dress = !!o.dress;
  const sleeveCol = o.fixed ? 0xffffff : L.shirt;
  const parts = [];
  const part = (geo, bone, col, cell, sub, fnBone, fnCol) => {
    const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    toCell(g, cell || CELL.plain, sub);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), ca = new Float32Array(n * 3); const c0 = new THREE.Color(col), c1 = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const y = g.attributes.position.getY(i); si[4 * i] = fnBone ? fnBone(y) : bone; sw[4 * i] = 1;
      const c = fnCol ? c1.set(fnCol(y)) : c0; ca[3 * i] = c.r; ca[3 * i + 1] = c.g; ca[3 * i + 2] = c.b;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'color'].includes(k)) g.deleteAttribute(k);
    parts.push(g);
  };
  const cap = (rad, len, x, y, z, seg = 8) => { const g = new THREE.CapsuleGeometry(rad, len, 3, seg); g.translate(x, y, z); return g; };
  const sph = (rad, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 9) => { const g = new THREE.SphereGeometry(rad, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
  const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const cyl = (r1, r2, h, x, y, z, seg = 10, open = false) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg, 1, open); g.translate(x, y, z); return g; };
  const skin = L.skin, skinC = CELL.skin;
  // ---------- torso ----------
  const prof = fem
    ? [[0, 0.86], [0.155, 0.87], [0.178, 0.93], [0.162, 1.0], [0.128, 1.09], [0.14, 1.2], [0.158, 1.3], [0.152, 1.4], [0.11, 1.46], [0.05, 1.5], [0, 1.5]]
    : [[0, 0.86], [0.15, 0.87], [0.162, 0.93], [0.153, 1.02], [0.143, 1.1], [0.158, 1.22], [0.178, 1.34], [0.172, 1.42], [0.12, 1.47], [0.05, 1.5], [0, 1.5]];
  const torso = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 18); torso.rotateY(Math.PI); torso.scale(1, 1, 0.62);
  part(torso, 0, shirtC, shirtCell, null, y => y < 1.0 ? BI.hips : y < 1.2 ? BI.spine : BI.chest, y => (y < 0.99 && !dress && !o.coat) ? (pk[2] ? pk[3] : L.pants) : shirtC);
  if (o.tint && o.fixed && !dress) { /* fixed designs carry colour in the texture */ }
  // shoulders (rounded deltoids) follow the arms
  for (const [s, up] of [[1, BI.uArmL], [-1, BI.uArmR]]) part(sph(0.062, s * 0.19, 1.415, 0, 1, 0.9, 1, 10, 8), up, o.sleeve === 'none' ? skin : sleeveCol, o.sleeve === 'none' ? skinC : shirtCell, [0, 0.4, 0.2, 0.2]);
  // neck, head, face
  part(cap(0.047, 0.08, 0, 1.49, 0, 10), BI.neck, skin, skinC);
  const head = new THREE.SphereGeometry(0.104, 20, 16); head.scale(0.9, 1.12, 1.0); head.translate(0, 1.625, 0.005);
  part(head, BI.head, skin, [L.face, 0]);
  part(sph(0.05, 0, 1.57, 0.045, 1.05, 0.7, 0.9, 10, 8), BI.head, skin, skinC); // jaw / chin volume
  // nose
  { const n = new THREE.ConeGeometry(0.017, 0.045, 6); n.rotateX(-0.35); n.translate(0, 1.614, 0.1); part(n, BI.head, skin, skinC); part(sph(0.012, 0, 1.597, 0.11, 1.2, 0.9, 1, 8, 6), BI.head, skin, skinC); }
  // eyes: white, iris, pupil
  for (const s of [-1, 1]) {
    part(sph(0.0145, s * 0.034, 1.641, 0.086, 1, 0.85, 1, 10, 8), BI.head, 0xf4f1ea, CELL.plain);
    part(sph(0.0078, s * 0.034, 1.641, 0.0985, 1, 1, 0.5, 8, 6), BI.head, L.eyes, CELL.plain);
    part(sph(0.0036, s * 0.034, 1.641, 0.1022, 1, 1, 0.4, 6, 4), BI.head, 0x050505, CELL.plain);
    part(sph(0.016, s * 0.034, 1.651, 0.088, 1.05, 0.45, 1, 10, 6), BI.head, skin, skinC); // upper eyelid
  }
  // lips
  part(sph(0.021, 0, 1.582, 0.093, 1, 0.33, 0.5, 10, 6), BI.head, new THREE.Color(skin).lerp(new THREE.Color(fem ? 0xb04050 : 0x9a5048), 0.45).getHex(), CELL.plain);
  // ears
  for (const s of [-1, 1]) { part(sph(0.024, s * 0.096, 1.625, -0.005, 0.45, 1, 0.75, 8, 6), BI.head, skin, skinC); if (L.earrings) part(sph(0.006, s * 0.1, 1.598, 0, 1, 1, 1, 6, 4), BI.head, 0xe8c860, CELL.plain); }
  // beard / mustache
  if (L.beard) { const b = new THREE.SphereGeometry(0.101, 14, 8, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.52, Math.PI * 0.4); b.scale(0.93, 1.12, 1.03); b.translate(0, 1.622, 0.008); part(b, BI.head, L.hair, CELL.hair); part(bx(0.05, 0.012, 0.014, 0, 1.593, 0.1), BI.head, L.hair, CELL.hair); }
  // glasses
  if (L.glasses) { for (const s of [-1, 1]) { const t = new THREE.TorusGeometry(0.019, 0.003, 5, 14); t.translate(s * 0.034, 1.641, 0.106); part(t, BI.head, 0x1a1a1a, CELL.plain); part(bx(0.004, 0.004, 0.1, s * 0.058, 1.645, 0.058), BI.head, 0x1a1a1a, CELL.plain); } part(bx(0.03, 0.004, 0.004, 0, 1.645, 0.107), BI.head, 0x1a1a1a, CELL.plain); }
  // ---------- hair ----------
  const hairCap = (h = 0.52, extra = 1) => { const g = new THREE.SphereGeometry(0.113 * extra, 18, 10, 0, Math.PI * 2, 0, Math.PI * h); g.scale(0.94, 1.1, 1.04); g.translate(0, 1.632, -0.008); return g; };
  const H1 = (g) => part(g, BI.head, L.hair, CELL.hair);
  const hs = L.hairStyle;
  if (hs === 'short') { H1(hairCap(0.5)); H1(bx(0.17, 0.05, 0.03, 0, 1.54, -0.09)); }
  if (hs === 'fade') { H1(hairCap(0.36, 1.02)); H1(hairCap(0.5, 0.995)); }
  if (hs === 'buzz') H1(hairCap(0.44, 0.995));
  if (hs === 'curly') { H1(hairCap(0.52)); const rr = mulberry32(seed); for (let k = 0; k < 16; k++) { const a = rr() * Math.PI * 2, e = rr() * 0.9; H1(sph(0.038, Math.cos(a) * 0.09 * Math.cos(e), 1.66 + Math.sin(e) * 0.08, Math.sin(a) * 0.095 * Math.cos(e) - 0.015, 1, 1, 1, 7, 5)); } }
  if (hs === 'long' || hs === 'bob' || hs === 'braids') {
    H1(hairCap(0.55));
    const len = hs === 'bob' ? 0.15 : 0.3; const back = new THREE.CylinderGeometry(0.108, 0.118, len, 16, 1, true, Math.PI * 0.28, Math.PI * 1.44); back.scale(0.95, 1, 0.95); back.translate(0, 1.62 - len / 2 + 0.02, -0.005); H1(back);
    if (hs === 'braids') for (let k = 0; k < 7; k++) { const a = Math.PI * (0.7 + k * 0.1); H1(cap(0.012, 0.3, Math.cos(a) * 0.1, 1.45, Math.sin(a) * 0.1 - 0.02, 5)); }
  }
  if (hs === 'bun') { H1(hairCap(0.52)); H1(sph(0.05, 0, 1.73, -0.07)); }
  if (hs === 'pony') { H1(hairCap(0.52)); H1(cap(0.03, 0.18, 0, 1.55, -0.125, 6)); }
  if (hs === 'cap') {
    H1(hairCap(0.5, 0.99));
    const hc = L.hatC === 'ecu' ? 0xffffff : L.hatC, cell = L.hatC === 'ecu' ? CELL.capECU : CELL.plain;
    const crown = new THREE.SphereGeometry(0.118, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.45); crown.scale(0.95, 1.0, 1.04); crown.rotateY(Math.PI / 2); crown.translate(0, 1.645, -0.005); part(crown, BI.head, hc, cell);
    const brim = new THREE.CylinderGeometry(0.075, 0.075, 0.008, 12, 1, false, -Math.PI / 2, Math.PI); brim.scale(1.1, 1, 1.25); brim.translate(0, 1.69, 0.085); part(brim, BI.head, L.hatC === 'ecu' ? 0x4b1f78 : L.hatC, CELL.plain);
  }
  // ---------- clothing extras ----------
  if (o.collar) { const t = new THREE.TorusGeometry(0.066, 0.014, 6, 16); t.rotateX(Math.PI / 2); t.scale(1, 1, 0.8); t.translate(0, 1.475, 0.005); part(t, BI.chest, sleeveCol, shirtCell, [0, 0.35, 0.2, 0.1]); }
  if (o.hood) { const h = new THREE.SphereGeometry(0.12, 14, 8, Math.PI * 0.7, Math.PI * 1.6, 0, Math.PI * 0.6); h.scale(1, 0.75, 0.8); h.translate(0, 1.47, -0.08); part(h, BI.chest, sleeveCol, shirtCell, [0, 0.3, 0.2, 0.2]); for (const s of [-1, 1]) part(cap(0.005, 0.12, s * 0.035, 1.38, 0.1, 4), BI.chest, 0xf4f4f4, CELL.plain); }
  if (o.coat) { const c = cyl(0.19, 0.25, 0.5, 0, 0.78, 0, 16, true); c.scale(1, 1, 0.75); part(c, BI.hips, 0xffffff, shirtCell, [0, 0.4, 1, 0.4]); }
  if (dress) { const d = cyl(0.165, 0.27, 0.48, 0, 0.72, 0, 16, true); part(d, BI.hips, 0xffffff, shirtCell, [0, 0.3, 1, 0.4]); }
  if (skirt) { const d = cyl(0.17, 0.23, 0.36, 0, 0.78, 0, 16, true); part(d, BI.hips, pantsC, pantsCell); }
  if (L.belt && !dress && !skirt && !o.coat) { const t = new THREE.TorusGeometry(0.156, 0.013, 5, 20); t.rotateX(Math.PI / 2); t.scale(1, 1, 0.64); t.translate(0, 0.985, 0); part(t, BI.hips, 0x3a2416, CELL.plain); part(bx(0.035, 0.028, 0.01, 0, 0.985, 0.103), BI.hips, 0xc8b070, CELL.plain); }
  // ---------- arms & hands ----------
  for (const [s, up, lo] of [[1, BI.uArmL, BI.lArmL], [-1, BI.uArmR, BI.lArmR]]) {
    const x = s * 0.2; const longS = o.sleeve === 'long', noS = o.sleeve === 'none';
    part(cap(0.047, 0.19, x, 1.3, 0, 10), up, longS ? sleeveCol : skin, longS ? shirtCell : skinC, longS ? [0, 0.2, 0.2, 0.5] : null);
    if (!longS && !noS) part(cyl(0.059, 0.055, 0.15, x, 1.375, 0, 12), up, sleeveCol, shirtCell, [0, 0.35, 0.2, 0.3]);
    part(cap(0.04, 0.18, x, 1.03, 0, 10), lo, longS ? sleeveCol : skin, longS ? shirtCell : skinC, longS ? [0, 0.2, 0.2, 0.5] : null);
    if (longS) part(cyl(0.043, 0.043, 0.03, x, 0.935, 0, 10), lo, sleeveCol, shirtCell, [0, 0.9, 0.2, 0.1]);
    if (L.watch && s === 1) part(cyl(0.041, 0.041, 0.02, x, 0.925, 0, 10), lo, 0x222222, CELL.plain);
    // hand: palm + four fingers + thumb (palm faces the thigh)
    part(bx(0.028, 0.075, 0.072, x, 0.875, 0.004), lo, skin, skinC);
    for (let f = 0; f < 4; f++) part(cap(0.0085, 0.04 + (f === 1 || f === 2 ? 0.008 : 0), x - s * 0.002, 0.815, 0.028 - f * 0.0185, 4), lo, skin, skinC);
    { const t = cap(0.01, 0.035, 0, 0, 0, 4); t.rotateX(0.6); t.translate(x - s * 0.012, 0.855, 0.043); part(t, lo, skin, skinC); }
  }
  // ---------- legs & shoes ----------
  for (const [s, up, lo, ft] of [[1, BI.uLegL, BI.lLegL, BI.footL], [-1, BI.uLegR, BI.lLegR, BI.footR]]) {
    const x = s * 0.095; const bareUpper = shorts || dress || skirt; const bareLower = shorts || dress || skirt;
    part(cap(0.072, 0.3, x, 0.71, 0, 10), up, bareUpper ? skin : pantsC, bareUpper ? skinC : pantsCell);
    if (shorts) part(cyl(0.085, 0.082, 0.26, x, 0.8, 0, 12), up, pantsC, pantsCell);
    part(sph(0.058, x, 0.5, 0.012, 1, 1, 1, 8, 6), lo, bareLower ? skin : pantsC, bareLower ? skinC : pantsCell); // knee
    part(cap(0.054, 0.3, x, 0.29, -0.004, 10), lo, bareLower ? skin : pantsC, bareLower ? skinC : pantsCell);
    if (bareLower) part(cyl(0.05, 0.048, L.shoe === 'grip' ? 0.14 : 0.06, x, L.shoe === 'grip' ? 0.13 : 0.1, 0, 8), lo, L.shoe === 'grip' ? 0xffffff : 0xf2f2f2, L.shoe === 'grip' ? CELL.grip : CELL.plain); // socks
    const sc = CELL[L.shoe] || CELL.sneakW;
    const upper = new THREE.CapsuleGeometry(0.045, 0.16, 3, 8); upper.rotateX(Math.PI / 2); upper.scale(1.05, 0.8, 1); upper.translate(x, 0.055, 0.035); part(upper, ft, 0xffffff, sc);
    part(bx(0.1, 0.022, 0.265, x, 0.011, 0.035), ft, L.shoe === 'boots' ? 0x2a1a10 : L.shoe === 'grip' ? 0xe8d360 : L.shoe === 'clog' ? 0xd8d8dc : 0xeeeeee, CELL.plain);
  }
  // ---------- hospital extras ----------
  if (L.surgCap) { part(hairCap(0.5, 1.045), BI.head, L.capC || 0x6f9fd0, CELL.plain); part(bx(0.21, 0.02, 0.02, 0, 1.69, -0.105), BI.head, L.capC || 0x6f9fd0, CELL.plain); }
  if (L.mask) { part(sph(0.062, 0, 1.588, 0.062, 1.2, 0.85, 0.72, 12, 8), BI.head, 0x9cc8e6, CELL.plain); for (const s of [-1, 1]) part(bx(0.004, 0.004, 0.09, s * 0.094, 1.61, 0.03), BI.head, 0xf4f4f4, CELL.plain); }
  if (L.stetho) {
    const t = new THREE.TorusGeometry(0.078, 0.007, 5, 22, Math.PI * 1.25); t.rotateX(Math.PI / 2); t.rotateY(-Math.PI * 0.875); t.translate(0, 1.465, -0.005); part(t, BI.chest, 0x1c1c1e, CELL.plain);
    const zf = fem ? 0.104 : 0.114; for (const s of [-1, 1]) part(cap(0.007, 0.15, s * 0.062, 1.37, zf, 4), BI.chest, 0x1c1c1e, CELL.plain);
    { const d = cyl(0.02, 0.02, 0.012, 0, 0, 0, 10); d.rotateX(Math.PI / 2); d.translate(0.062, 1.27, zf + 0.012); part(d, BI.chest, 0xc8c8cc, CELL.plain); }
  }
  if (L.badge) { part(bx(0.045, 0.062, 0.006, -0.085, 1.31, fem ? 0.1 : 0.106), BI.chest, 0xf8f8f8, CELL.plain); part(bx(0.045, 0.014, 0.007, -0.085, 1.334, fem ? 0.1 : 0.106), BI.chest, 0x4b1f78, CELL.plain); }
  if (L.band) part(cyl(0.042, 0.042, 0.018, 0.2, 0.93, 0, 10), BI.lArmL, 0xf4f4f4, CELL.plain); // hospital wristband
  if (L.backpack) {
    part(bx(0.27, 0.36, 0.13, 0, 1.24, -0.165), BI.chest, L.packC, CELL.pack);
    part(bx(0.2, 0.12, 0.05, 0, 1.13, -0.24), BI.chest, L.packC, CELL.pack);
    for (const s of [-1, 1]) part(bx(0.04, 0.3, 0.02, s * 0.09, 1.32, 0.1), BI.chest, 0x1a1a1a, CELL.plain);
  }
  const geo = mergeGeometries(parts);
  const bones = BONE_REST.map(b => { const bn = new THREE.Bone(); bn.name = b[0]; return bn; });
  BONE_REST.forEach((b, i) => { const p = b[1]; const px = p >= 0 ? BONE_REST[p][2] : 0, py = p >= 0 ? BONE_REST[p][3] : 0, pz = p >= 0 ? BONE_REST[p][4] : 0; bones[i].position.set(b[2] - px, b[3] - py, b[4] - pz); if (p >= 0) bones[p].add(bones[i]); });
  const mesh = new THREE.SkinnedMesh(geo, MAT.person); mesh.castShadow = true; mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;
  const g = new THREE.Group(); g.add(mesh);
  g.scale.set(L.scale * L.width, L.scale, L.scale * L.width);
  const B = {}; bones.forEach(b => B[b.name] = b);
  return { g, mesh, B, phase: r() * 6, fem, geo, look: L };
}
function disposePerson(p) { if (!p) return; if (p.avatar) { p.g.removeFromParent(); return; } if (p.npc) { p.npc.dispose(); return; } p.g.removeFromParent(); p.geo.dispose(); if (p.mesh.skeleton) p.mesh.skeleton.dispose(); }
function animatePerson(p, speed, dt, air = false) {
  if (p.avatar) { p.avatar.update(dt, speed, air, camera); return; }
  if (p.npc) { p.npc.update(dt, speed, air); return; }
  const B = p.B; const run = clamp((speed - 2.2) / 3, 0, 1); const k = clamp(speed / 1.4, 0, 1.25);
  p.phase += dt * (speed > 0.05 ? (4.2 + speed * 1.55) : 0);
  const ph = p.phase, s = Math.sin(ph), c = Math.cos(ph);
  p.t2 = (p.t2 || 0) + dt;
  if (air) {
    B.uLegL.rotation.x = -0.6; B.lLegL.rotation.x = 1.0; B.uLegR.rotation.x = -0.2; B.lLegR.rotation.x = 0.6;
    B.uArmL.rotation.set(-0.6, 0, 0.35); B.uArmR.rotation.set(-0.6, 0, -0.35); B.lArmL.rotation.x = B.lArmR.rotation.x = -0.6; B.hips.position.y = 0.95; return;
  }
  if (speed < 0.05) {
    const b = Math.sin(p.t2 * 1.6) * 0.012;
    B.uLegL.rotation.x = B.uLegR.rotation.x = 0; B.lLegL.rotation.x = B.lLegR.rotation.x = 0.04; B.footL.rotation.x = B.footR.rotation.x = 0;
    B.uArmL.rotation.set(0.05 + b, 0, 0.09); B.uArmR.rotation.set(0.05 - b, 0, -0.09); B.lArmL.rotation.x = B.lArmR.rotation.x = -0.12;
    B.chest.rotation.set(b, 0, 0); B.spine.rotation.set(0, 0, 0); B.hips.rotation.set(0, 0, Math.sin(p.t2 * 0.5) * 0.02); B.hips.position.y = 0.95;
    B.head.rotation.set(Math.sin(p.t2 * 0.21) * 0.06, Math.sin(p.t2 * 0.3) * 0.35, 0); return;
  }
  const swing = (0.5 + run * 0.35) * Math.min(1, k);
  B.uLegL.rotation.x = -s * swing; B.uLegR.rotation.x = s * swing;
  B.lLegL.rotation.x = (0.12 + (0.9 + run * 0.7) * Math.max(0, c)) * Math.min(1, k);
  B.lLegR.rotation.x = (0.12 + (0.9 + run * 0.7) * Math.max(0, -c)) * Math.min(1, k);
  B.footL.rotation.x = -B.lLegL.rotation.x * 0.25 + Math.max(0, -s) * 0.2; B.footR.rotation.x = -B.lLegR.rotation.x * 0.25 + Math.max(0, s) * 0.2;
  const aw = (0.42 + run * 0.5) * Math.min(1, k);
  B.uArmL.rotation.set(s * aw, 0, 0.08 + run * 0.1); B.uArmR.rotation.set(-s * aw, 0, -0.08 - run * 0.1);
  B.lArmL.rotation.x = -(0.25 + run * 1.1 + Math.max(0, -s) * 0.2); B.lArmR.rotation.x = -(0.25 + run * 1.1 + Math.max(0, s) * 0.2);
  B.hips.rotation.set(0, s * 0.09 * k, c * 0.04 * k * (p.fem ? 1.6 : 1));
  B.spine.rotation.set(run * 0.18, 0, 0); B.chest.rotation.set(0, -s * 0.13 * k, 0); B.head.rotation.set(0, s * 0.05, 0);
  B.hips.position.y = 0.95 - 0.025 * k + Math.abs(c) * (0.035 + run * 0.04) * Math.min(1, k);
}

// NPCs glance at you when you're close
function npcLook(pp, bodyYaw, x, z, dt) {
  if (!pp.B) return; const F = Player.mode === 'drive' ? Player.car.pos : Player.pos;
  const dx = F.x - x, dz = F.z - z, d = Math.hypot(dx, dz); let want = 0;
  if (d < 9 && d > 0.3) { want = angleDiff(bodyYaw, Math.atan2(dx, dz)); if (Math.abs(want) > 1.7) want = 0; want = clamp(want, -1.1, 1.1); }
  pp.lookY = lerp(pp.lookY || 0, want, 1 - Math.exp(-dt * 4));
  pp.B.head.rotation.y += pp.lookY * 0.65; pp.B.neck.rotation.y = pp.lookY * 0.35;
}
