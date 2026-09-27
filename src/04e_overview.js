
// =====================================================================
// OVERVIEW — a light road/water sketch of every saved map square, so the big map shows the
// whole downloaded city (not only the squares currently built in 3D around the player).
// Built from the saved map data once per square and kept in 'meta' as 'ov:<tile>'.
// =====================================================================
const Overview = {
  tiles: new Map(), // key → { roads: [[rank, Float32Array xz]], water: [Float32Array], parks: [Float32Array], paths?: {Path2D by style} }
  building: false,
  fromOSM(k, c) {
    const roads = [], water = [], parks = [], rivers = [];
    const pts = g => { const a = []; for (let i = 0; i < g.length; i += 2) if (g[i] != null) a.push(Math.round(lonToX(g[i + 1])), Math.round(latToZ(g[i]))); return a; };
    for (const e of c.els) {
      const t = e.tags || {};
      if (e.t === 'w') {
        if (t.highway && RC[t.highway] && t.area !== 'yes') roads.push([RC[t.highway].rank, pts(e.g)]);
        else if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || t.landuse === 'basin') water.push(pts(e.g));
        else if (t.waterway === 'river' || t.waterway === 'stream' || t.waterway === 'canal') rivers.push([t.waterway === 'river' ? 1 : 0, pts(e.g)]);
        else if (t.leisure === 'park' || t.leisure === 'golf_course' || t.leisure === 'pitch' || t.landuse === 'forest' || t.natural === 'wood') parks.push(pts(e.g));
      } else if (e.t === 'r' && (t.natural === 'water' || t.waterway === 'riverbank')) {
        for (const m of e.m) if (m.r !== 'inner') rivers.push([2, pts(m.g)]);
      }
    }
    const o = { roads, water, parks, rivers };
    this.tiles.set(k, o); this._dirty = true;
    Store.put('meta', 'ov:' + k, o).catch(() => { });
    return o;
  },
  // load (or build from saved map data) the sketches of all saved squares; calls back as it goes
  async ensure(keys, onProgress) {
    if (this.building) return; this.building = true;
    try {
      let n = 0;
      for (const k of keys) {
        if (this.tiles.has(k)) continue;
        let o = null; try { o = await Store.get('meta', 'ov:' + k); } catch (e) { }
        if (!o) { try { const buf = await Store.get('osm', k); if (buf) o = this.fromOSM(k, JSON.parse(await gunzip(buf))); } catch (e) { } }
        if (o) this.tiles.set(k, o);
        if (++n % 6 === 0) { onProgress && onProgress(); await sleep(0); }
      }
    } finally { this.building = false; onProgress && onProgress(); }
  },
  paths(o) {
    if (o.P) return o.P;
    const line = (P, a) => { if (a.length < 4) return; P.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) P.lineTo(a[i], a[i + 1]); };
    const P = { major: new Path2D(), mid: new Path2D(), minor: new Path2D(), svc: new Path2D(), water: new Path2D(), parks: new Path2D(), river: new Path2D(), stream: new Path2D() };
    for (const [rank, a] of o.roads) line(rank >= 7 ? P.major : rank >= 5 ? P.mid : rank >= 2 ? P.minor : P.svc, a);
    for (const a of o.water) { line(P.water, a); P.water.closePath(); }
    for (const a of o.parks) { line(P.parks, a); P.parks.closePath(); }
    for (const [k, a] of o.rivers) line(k ? P.river : P.stream, a);
    return o.P = P;
  },
  // draw every saved square that isn't currently built (the live world draws itself on top)
  draw(g, s, view) {
    for (const [k, o] of this.tiles) {
      { const T = Tiles.map.get(k); if (T && T.state === 'ready') continue; }
      const [tx, ty] = k.split(',').map(Number); const W = tileWorld(tx, ty);
      if (W.x1 < view.x0 || W.x0 > view.x1 || W.z1 < view.z0 || W.z0 > view.z1) continue;
      const P = this.paths(o);
      g.fillStyle = '#2f4a2c'; g.fill(P.parks);
      g.fillStyle = '#3e6478'; g.fill(P.water);
      g.strokeStyle = '#3e6478'; g.lineWidth = Math.max(1.5 / s, 30); g.stroke(P.river); g.lineWidth = Math.max(1 / s, 4); g.stroke(P.stream);
      if (s > 0.12) { g.strokeStyle = 'rgba(200,196,185,.45)'; g.lineWidth = Math.max(0.6 / s, 3.5); g.stroke(P.svc); }
      g.strokeStyle = 'rgba(230,226,215,.8)'; g.lineWidth = Math.max(1 / s, 5.6); g.stroke(P.minor);
      g.strokeStyle = '#e8d9a0'; g.lineWidth = Math.max(1.2 / s, 8); g.stroke(P.mid);
      g.strokeStyle = '#f2c230'; g.lineWidth = Math.max(1.6 / s, 10.5); g.stroke(P.major);
    }
  },
};
