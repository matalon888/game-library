// Hand-drawn style art helpers (flat fills + thick ink outlines). All original.
// "Pip": our neutral cartoon kid — round head, messy tuft, teal tee. Feet at (0,0), ~175 units tall.
const INK = '#2b2b2b';
export const SKIN = '#ffd9b8', HAIR = '#6b4226', TEE = '#3fc1b0', PANTS = '#3d4f7a';

function face(m) {
  const cheeks = `<ellipse cx="-21" cy="-130" rx="6" ry="3.5" fill="#ff9f9f" opacity=".7"/><ellipse cx="21" cy="-130" rx="6" ry="3.5" fill="#ff9f9f" opacity=".7"/>`;
  switch (m) {
    case 'happy': return `${cheeks}<path d="M-18 -144 q6 -7 12 0 M6 -144 q6 -7 12 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M-13 -128 Q0 -126 13 -128 Q11 -112 0 -112 Q-11 -112 -13 -128Z" fill="#c83c4a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-6 -117 q6 -5 12 0" fill="#ff8a95"/>`;
    case 'sad': return `<path d="M-20 -156 l10 4 M20 -156 l-10 4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="-12" cy="-143" rx="3.6" ry="5" fill="${INK}"/><ellipse cx="12" cy="-143" rx="3.6" ry="5" fill="${INK}"/>
      <path d="M-11 -118 Q0 -128 11 -118" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M15 -137 q3 6 0 9 q-3 -3 0 -9z" fill="#7fd0ff" stroke="${INK}" stroke-width="1.5"/>`;
    case 'sleep': return `${cheeks}<path d="M-18 -142 q6 5 12 0 M6 -142 q6 5 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><ellipse cx="0" cy="-122" rx="4" ry="3" fill="${INK}"/>`;
    case 'wow': return `<circle cx="-12" cy="-144" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="12" cy="-144" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="-12" cy="-143" r="2.6" fill="${INK}"/><circle cx="12" cy="-143" r="2.6" fill="${INK}"/><ellipse cx="0" cy="-121" rx="6" ry="7.5" fill="#c83c4a" stroke="${INK}" stroke-width="3"/>`;
    case 'eat': return `${cheeks}<path d="M-18 -144 q6 -7 12 0 M6 -144 q6 -7 12 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/><path d="M-10 -124 q5 6 10 0 q5 6 10 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'none': return '';
    default: return `<ellipse cx="-12" cy="-143" rx="3.6" ry="5" fill="${INK}"/><ellipse cx="12" cy="-143" rx="3.6" ry="5" fill="${INK}"/>
      <path d="M-8 -124 Q0 -119 8 -124" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
}
function headParts(mood, flipHair) {
  return `<circle cx="-36" cy="-140" r="7" fill="${SKIN}" stroke="${INK}" stroke-width="3"/><circle cx="36" cy="-140" r="7" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
  <circle cx="0" cy="-140" r="36" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
  <path d="${flipHair ? 'M34 -150 Q38 -186 4 -182 Q-6 -196 -16 -184 Q-24 -194 -26 -180 Q-40 -170 -34 -152 Q-20 -164 -4 -160 Q10 -170 34 -150Z' : 'M-34 -150 Q-38 -186 -4 -182 Q6 -196 16 -184 Q24 -194 26 -180 Q40 -170 34 -152 Q20 -164 4 -160 Q-10 -170 -34 -150Z'}" fill="${HAIR}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <g class="face">${face(mood)}</g>`;
}
export const pipHead = (mood = 'happy', flip = false, s = 1) => `<g transform="scale(${s}) translate(0,140)">${headParts(mood, flip)}</g>`;
export function pip(mood = 'neutral', s = 1, wrap = false, flipHair = false) {
  const body = `<g transform="scale(${s})">
  <ellipse cx="0" cy="2" rx="36" ry="7" fill="rgba(0,0,0,.12)"/>
  <path d="M-15 -52 L-16 -8 M15 -52 L16 -8" stroke="${INK}" stroke-width="17" stroke-linecap="round"/>
  <path d="M-15 -52 L-16 -8 M15 -52 L16 -8" stroke="${PANTS}" stroke-width="11" stroke-linecap="round"/>
  <path d="M-30 -2 q0 -12 14 -12 q8 0 8 8 v4z M30 -2 q0 -12 -14 -12 q-8 0 -8 8 v4z" fill="#ff6b6b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M-30 -97 L-44 -64 M30 -97 L44 -64" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
  <path d="M-30 -97 L-44 -64 M30 -97 L44 -64" stroke="${SKIN}" stroke-width="7.5" stroke-linecap="round"/>
  <path d="M-28 -104 Q-36 -100 -40 -84 L-30 -80 L-28 -50 L28 -50 L30 -80 L40 -84 Q36 -100 28 -104 Q0 -112 -28 -104Z" fill="${TEE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M-28 -72 L28 -72" stroke="#fff" stroke-width="5" opacity=".6"/>
  <path d="M-10 -106 Q0 -98 10 -106" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  ${headParts(mood, flipHair)}</g>`;
  return wrap ? `<g>${body}</g>` : body;
}
pip.face = face;

// ---------------------------------------------------------------- props
export const star = (r = 12, fill = '#ffd84d') => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(1) + ' ' + (Math.sin(a) * rr).toFixed(1); } return `<path d="${d}Z" fill="${fill}" class="ink"/>`; };
export const cloud = (s = 1, fill = '#fff') => `<g transform="scale(${s})"><path d="M-50 18 Q-66 18 -64 2 Q-62 -12 -46 -10 Q-44 -32 -20 -30 Q-8 -46 12 -36 Q30 -44 38 -24 Q60 -24 58 -2 Q66 18 46 18Z" fill="${fill}" class="ink"/></g>`;
export const sun = (r = 30) => { let rays = ''; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; rays += `M${(Math.cos(a) * (r + 8)).toFixed(1)} ${(Math.sin(a) * (r + 8)).toFixed(1)} L${(Math.cos(a) * (r + 20)).toFixed(1)} ${(Math.sin(a) * (r + 20)).toFixed(1)} `; }
  return `<path d="${rays}" stroke="#ffb300" stroke-width="6" stroke-linecap="round"/><circle r="${r}" fill="#ffd84d" class="ink"/><path d="M${-r * .5} ${-r * .2} a${r * .5} ${r * .5} 0 0 1 ${r * .5} ${-r * .4}" stroke="#fff3a6" stroke-width="5" fill="none" stroke-linecap="round"/>`; };
export const shadow = (rx = 40, ry = 7, y = 0) => `<ellipse cy="${y}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,.1)"/>`;
export const ground = (y = 380, col = '#bfe6a0') => `<path d="M-20 ${y} Q90 ${y - 10} 180 ${y} T380 ${y} V560 H-20Z" fill="${col}" class="ink"/>`;
export const table = (x, y, w = 200, h = 70) => `<g transform="translate(${x},${y})"><rect x="${-w / 2}" y="0" width="${w}" height="14" rx="4" fill="#d79a5c" class="ink"/>
  <path d="M${-w / 2 + 16} 14 V${h} M${w / 2 - 16} 14 V${h}" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${-w / 2 + 16} 14 V${h} M${w / 2 - 16} 14 V${h}" stroke="#b97a40" stroke-width="7" stroke-linecap="round"/></g>`;
export const btn = (label, w = 70, h = 54, fill = '#ffd84d', fs = 30) => `<rect x="${-w / 2}" y="${-h / 2 + 4}" width="${w}" height="${h}" rx="14" fill="rgba(0,0,0,.18)"/>
  <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="14" fill="${fill}" class="ink"/><text y="${fs * 0.36}" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="${fs}" fill="${INK}">${label}</text>`;
export const coin = (label = '', r = 30, fill = '#f6c544') => `<circle r="${r}" fill="${fill}" class="ink"/><circle r="${r - 7}" fill="none" stroke="#c99a1e" stroke-width="2.5" stroke-dasharray="3 4"/>
  <text y="6" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="${r * .52}" fill="#7a5a00">${label}</text>`;
