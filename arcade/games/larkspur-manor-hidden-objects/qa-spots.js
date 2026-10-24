// QA only (?spots=1&room=<id>&o=P|W): paints every surface of one room with sample objects, to check placement by eye.
export default async function ({ ROOMS, OBJ, img, objSrc, roomSrc, tinted }) {
  const Q = new URLSearchParams(location.search), id = Q.get('room') || 'library', o = Q.get('o') || 'P', R = ROOMS[id];
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;overflow:auto;background:#000';
  const room = await img(roomSrc(id, o)), c = document.createElement('canvas'); c.width = room.naturalWidth; c.height = room.naturalHeight;
  c.style.width = c.width + 'px'; document.body.appendChild(c);
  const x = c.getContext('2d'); x.drawImage(room, 0, 0);
  let k = 0;
  for (const [si, s] of R[o].entries()) {
    const fits = R.pool.filter(p => OBJ[p][1] <= s[5]);
    for (const t of Q.has('lines') ? [] : [0.15, 0.85]) {
      const pid = fits[(k++ * 7) % fits.length], im = await img(objSrc(pid)), [, cm, sw, sh] = OBJ[pid];
      const size = Math.min(260, Math.max(50, cm / 10 * s[4]) * 1.18), sc = size / Math.max(sw, sh), w = sw * sc, h = sh * sc;
      let px = s[0] + (s[2] - s[0]) * t, py = s[1] + (s[3] - s[1]) * t; const rim = s[6];
      if (rim && py - rim > h * 0.45) py = rim + h * 0.42;
      x.save(); x.translate(px, py); x.shadowColor = 'rgba(40,25,10,.38)'; x.shadowBlur = 5; x.shadowOffsetY = 2;
      x.drawImage(tinted(im, pid, R.light), -w / 2, -h, w, h); x.restore();
      if (rim) { x.save(); x.beginPath(); x.rect(px - w, rim, w * 2, h + 20); x.clip(); x.drawImage(room, 0, 0); x.restore(); }
    }
    x.strokeStyle = s[6] ? '#0ff' : '#f0f'; x.lineWidth = 3; x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText(si, s[0], s[1] + 22); x.fillText(si, s[0], s[1] + 22);
  }
  window.__spotsDone = true;
}
