
// =====================================================================
// PARCELS — Pitt County tax parcels (boundaries + land use, year built, number of structures,
// building value, site address, subdivision). Pitt County publishes these in OPIS; the county's own
// server does not allow direct access from a web page, so the game reads the same county-produced
// parcels from NC OneMap's statewide parcel service (updated from each county's data), one map
// square at a time, and saves them on this PC like the map data.
// =====================================================================
const PARCEL_SRC = 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query';
const Parcels = {
  enabled: true, errors: 0, hash: new SpatialHash(40), inflight: 0,
  async get(tx, ty) {
    if (!this.enabled) return null;
    const key = 'parcels:v1:' + tileKey(tx, ty);
    try { const buf = await Store.get('meta', key); if (buf) return JSON.parse(await gunzip(buf)); } catch (e) { }
    while (this.inflight >= 2) await sleep(150);
    this.inflight++;
    try {
      const b = tileBBox(tx, ty); const rows = []; let off = 0;
      for (let page = 0; page < 12; page++) {
        const q = new URLSearchParams({
          where: "cntyname='Pitt'", geometry: `${b.w},${b.s},${b.e},${b.n}`, geometryType: 'esriGeometryEnvelope', inSR: 4326, outSR: 4326,
          spatialRel: 'esriSpatialRelIntersects', outFields: 'parno,struct,structno,structyear,parusedesc,improvval,gisacres,siteadd,subdivisio',
          returnGeometry: true, geometryPrecision: 6, maxAllowableOffset: 0.000004, resultOffset: off, resultRecordCount: 2000, orderByFields: 'objectid', f: 'json',
        });
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
        const r = await fetch(PARCEL_SRC + '?' + q, { signal: ctl.signal }); clearTimeout(to);
        if (!r.ok) throw new Error('parcels ' + r.status);
        const j = await r.json(); if (j.error) throw new Error(j.error.message || 'parcel query failed');
        for (const f of j.features || []) {
          const a = f.attributes, g = f.geometry; if (!g || !g.rings || !g.rings.length) continue;
          const ring = g.rings[0]; const flat = []; for (const p of ring) flat.push(+p[1].toFixed(6), +p[0].toFixed(6));
          rows.push([a.parno, a.parusedesc || '', a.structyear || 0, a.structno || (a.struct === 'Y' ? 1 : 0), Math.round(a.improvval || 0), a.gisacres || 0, a.siteadd || '', a.subdivisio || '', flat]);
        }
        if (!j.exceededTransferLimit) break; off += (j.features || []).length; if (!(j.features || []).length) break;
      }
      const out = { v: 1, rows };
      try { await Store.put('meta', key, await gzip(JSON.stringify(out))); } catch (e) { }
      return out;
    } catch (e) { this.errors++; console.warn('parcels unavailable for tile', tx, ty, e.message || e); return null; }
    finally { this.inflight--; }
  },
  // the parcel under a point (for the HUD: address + subdivision)
  at(x, z) { for (const p of this.hash.query(x, z, x, z)) if (pointInPoly(x, z, p.ring)) return p; return null; },
};
// land-use class from the county's use code, e.g. "R6 01-SFR-CONST(01-SFR)" → the part in brackets
function parcelClass(desc) {
  const m = /\((\d\d)-([^)]+)\)\s*$/.exec(desc || ''); if (!m) return '';
  const d = m[2].toUpperCase();
  if (d === 'SFRS/L') return 'split';
  if (/^(SFR|PATIOHM|RURALHMST|SFR\/MOD)$/.test(d)) return d === 'PATIOHM' ? 'patio' : 'sfr';
  if (/TWNHSE|COND\/TWN|1\/2-DUP/.test(d)) return 'town';
  if (/DUPLEX|TRIPLEX/.test(d)) return 'duplex';
  if (/MANUF|MANFHM/.test(d)) return 'mh';
  if (d === 'HIGHRSCND') return 'tower';
  if (/GARDENAPT|APRT|STUDENTHOUSING/.test(d)) return 'apt';
  if (d === 'CHURCHES') return 'church';
  if (/PUBLICSCHL|PUBLICCLG|PVTSCH|OTHERSTATE|OTHERFED|OTHERCOUNTY|OTHERMUNICP|HSPTL|UTILITIES|EDUCATION|PASSENGER|COUNTRYCLB/.test(d)) return 'inst';
  if (/OFFICE|OFCCONDO|MEDBLDG|MEDCONDO|BANKS|DAYCR|FUNERAL/.test(d)) return 'office';
  if (/WHSE|WH$|INDUSTRIAL|MFG|LMBR|MINIWHSE|CARWASH|PARKINGDK/.test(d)) return 'whse';
  return 'comm';
}
