import { LEVELS, parsePath } from './levels.js';
for (const l of LEVELS) {
  const t = parsePath(l.p), occ = new Map(); let bad = [];
  t.forEach((x, i) => { const k = x.gx + ',' + x.gz; if (occ.has(k)) bad.push('overlap@' + i); occ.set(k, i); });
  t.forEach((x, i) => { for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const j = occ.get((x.gx+dx)+','+(x.gz+dz)); if (j !== undefined && Math.abs(j - i) > 1) bad.push(`touch ${i}-${j}`); } });
  t.forEach((x, i) => { if (x.obst && (i < 2 || i >= t.length - 1 || t[i-1].d !== x.d || t[i-1].type==="land" || x.type !== 'plain')) bad.push('hazard@' + i); if (x.surf && (x.type === 'ramp' || x.type === 'gap' || x.type==='cup' || i<1)) bad.push('surf@' + i); });
  console.log(l.i, l.n, t.length, 'coins', t.filter(x => x.coin).length, bad.join(' ') || 'ok');
}
