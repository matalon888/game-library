// Cardcairn art: every character is an inline SVG drawn here (no image files).
const sh = (hex, a) => { // lighten (a>0) / darken (a<0) a #rrggbb colour
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.round(a > 0 ? v + (255 - v) * a : v * (1 + a));
  return '#' + [f(r), f(g), f(b)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
};
const eye = (x, y, r = 7, dx = -1.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#2b2140" stroke-width="1.5"/><circle cx="${x + dx}" cy="${y + 1}" r="${r * 0.55}" fill="#2b2140"/><circle cx="${x + dx - 1.4}" cy="${y - 1.2}" r="${r * 0.2}" fill="#fff"/>`;
const smile = (x, y, w = 8, o = '#2b2140') => `<path d="M${x - w} ${y} Q${x} ${y + w * 0.8} ${x + w} ${y}" fill="none" stroke="${o}" stroke-width="2.6" stroke-linecap="round"/>`;
const shadow = (rx = 34) => `<ellipse cx="50" cy="95" rx="${rx}" ry="4.5" fill="rgba(0,0,0,.28)"/>`;
const crown = (y) => `<path d="M34 ${y + 16} L36 ${y + 2} L44 ${y + 10} L50 ${y} L56 ${y + 10} L64 ${y + 2} L66 ${y + 16} Z" fill="#ffd166" stroke="#a8741d" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="${y + 11}" r="2.6" fill="#ff5d8f"/>`;
const svg = (body, boss, cy) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}${boss ? crown(cy) : ''}</svg>`;

const K = {
  slime: (c, o) => shadow(38) + `<path d="M12 93 C5 62 24 26 50 24 C76 26 95 62 88 93 Z" fill="${c}" stroke="${o}" stroke-width="3"/>
    <path d="M18 88 C14 66 26 42 40 36" fill="none" stroke="${sh(c, 0.45)}" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="38" cy="40" rx="7" ry="4.5" fill="#fff" opacity=".6" transform="rotate(-30 38 40)"/>
    ${eye(38, 58, 8.5)}${eye(60, 58, 8.5)}${smile(48, 72, 7, o)}<path d="M74 90 q3 6 0 8 q-3 -2 0 -8" fill="${c}" stroke="${o}" stroke-width="2"/>`,
  crab: (c, o) => shadow(40) + `<g stroke="${o}" stroke-width="3" stroke-linecap="round"><path d="M26 82 l-10 12 M34 84 l-6 12 M66 84 l6 12 M74 82 l10 12"/><path d="M40 50 L36 30 M58 50 L62 30"/></g>
    <ellipse cx="50" cy="68" rx="36" ry="22" fill="${c}" stroke="${o}" stroke-width="3"/><path d="M22 62 Q50 40 78 62" fill="none" stroke="${sh(c, 0.4)}" stroke-width="4" opacity=".8"/>
    <circle cx="13" cy="50" r="12" fill="${c}" stroke="${o}" stroke-width="3"/><path d="M4 44 L13 50 L4 54" fill="${sh(c, -0.3)}"/><circle cx="87" cy="50" r="12" fill="${c}" stroke="${o}" stroke-width="3"/><path d="M96 44 L87 50 L96 54" fill="${sh(c, -0.3)}"/>
    ${eye(36, 28, 7)}${eye(62, 28, 7)}${smile(49, 74, 6, o)}<circle cx="34" cy="76" r="3" fill="#ff8fa3" opacity=".7"/><circle cx="64" cy="76" r="3" fill="#ff8fa3" opacity=".7"/>`,
  mush: (c, o) => shadow(30) + `<rect x="30" y="50" width="40" height="44" rx="14" fill="#fff1dc" stroke="${o}" stroke-width="3"/>
    ${eye(42, 68, 6.5)}${eye(58, 68, 6.5)}${smile(50, 80, 5, o)}
    <path d="M6 56 Q10 12 50 10 Q90 12 94 56 Q50 66 6 56 Z" fill="${c}" stroke="${o}" stroke-width="3"/>
    <circle cx="30" cy="34" r="7" fill="#fff" opacity=".9"/><circle cx="58" cy="24" r="5" fill="#fff" opacity=".9"/><circle cx="74" cy="42" r="6" fill="#fff" opacity=".9"/><circle cx="46" cy="46" r="4" fill="#fff" opacity=".9"/>`,
  bot: (c, o) => shadow(34) + `<line x1="50" y1="30" x2="50" y2="14" stroke="${o}" stroke-width="3"/><circle cx="50" cy="12" r="5" fill="#ff6b6b" stroke="${o}" stroke-width="2"/>
    <rect x="18" y="84" width="64" height="11" rx="5" fill="#4a4e69" stroke="${o}" stroke-width="2.5"/><circle cx="28" cy="89.5" r="3" fill="#9a8c98"/><circle cx="50" cy="89.5" r="3" fill="#9a8c98"/><circle cx="72" cy="89.5" r="3" fill="#9a8c98"/>
    <rect x="8" y="50" width="12" height="22" rx="6" fill="${sh(c, -0.2)}" stroke="${o}" stroke-width="2.5"/><rect x="80" y="50" width="12" height="22" rx="6" fill="${sh(c, -0.2)}" stroke="${o}" stroke-width="2.5"/>
    <rect x="18" y="30" width="64" height="56" rx="14" fill="${c}" stroke="${o}" stroke-width="3"/><rect x="26" y="38" width="48" height="28" rx="8" fill="#1f2340" stroke="${o}" stroke-width="2"/>
    <ellipse cx="40" cy="52" rx="5" ry="7" fill="#7fffd4"/><ellipse cx="60" cy="52" rx="5" ry="7" fill="#7fffd4"/><path d="M44 61 Q50 64 56 61" stroke="#7fffd4" stroke-width="2.4" fill="none"/>
    <circle cx="30" cy="76" r="3" fill="${sh(c, 0.5)}"/><circle cx="40" cy="76" r="3" fill="${sh(c, 0.5)}"/>`,
  fly: (c, o) => shadow(22) + `<ellipse cx="30" cy="32" rx="18" ry="11" fill="#e8f6ff" opacity=".85" stroke="${o}" stroke-width="2" transform="rotate(-20 30 32)"/><ellipse cx="70" cy="32" rx="18" ry="11" fill="#e8f6ff" opacity=".85" stroke="${o}" stroke-width="2" transform="rotate(20 70 32)"/>
    <circle cx="50" cy="56" r="25" fill="${c}" stroke="${o}" stroke-width="3"/><path d="M28 62 Q50 72 72 62" stroke="${sh(c, -0.35)}" stroke-width="5" fill="none"/>
    ${eye(41, 50, 8)}${eye(60, 50, 8)}<path d="M50 81 L46 90 L54 90 Z" fill="#4a4e69"/>`,
  yeti: (c, o) => shadow(40) + `<path d="M30 30 L22 12 L38 24 Z M70 30 L78 12 L62 24 Z" fill="#fff6e0" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M10 92 C2 60 14 22 50 20 C86 22 98 60 90 92 Z" fill="${c}" stroke="${o}" stroke-width="3"/>
    <path d="M14 60 l6 -4 l2 6 l6 -4 M80 58 l6 4 l-6 3 M70 84 l4 -6 l4 6" stroke="${sh(c, -0.25)}" stroke-width="2.5" fill="none"/>
    <ellipse cx="50" cy="56" rx="26" ry="22" fill="${sh(c, 0.55)}" stroke="${o}" stroke-width="2"/>${eye(40, 50, 7)}${eye(60, 50, 7)}
    <path d="M38 64 Q50 74 62 64 Z" fill="#fff" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="#2b2140"/>`,
  moth: (c, o) => shadow(26) + `<ellipse cx="26" cy="38" rx="24" ry="20" fill="${c}" stroke="${o}" stroke-width="2.5"/><ellipse cx="74" cy="38" rx="24" ry="20" fill="${c}" stroke="${o}" stroke-width="2.5"/>
    <ellipse cx="30" cy="70" rx="16" ry="14" fill="${sh(c, 0.3)}" stroke="${o}" stroke-width="2.5"/><ellipse cx="70" cy="70" rx="16" ry="14" fill="${sh(c, 0.3)}" stroke="${o}" stroke-width="2.5"/>
    <circle cx="22" cy="36" r="7" fill="#fff" opacity=".85"/><circle cx="78" cy="36" r="7" fill="#fff" opacity=".85"/><circle cx="22" cy="36" r="3.5" fill="${sh(c, -0.4)}"/><circle cx="78" cy="36" r="3.5" fill="${sh(c, -0.4)}"/>
    <path d="M44 24 Q38 8 30 8 M56 24 Q62 8 70 8" stroke="${o}" stroke-width="2.5" fill="none"/>
    <ellipse cx="50" cy="56" rx="13" ry="30" fill="${sh(c, -0.45)}" stroke="${o}" stroke-width="2.5"/>${eye(45, 40, 5.5)}${eye(56, 40, 5.5)}${smile(50, 50, 4, '#fff')}`,
  golem: (c, o) => shadow(38) + `<path d="M14 92 L10 56 L26 40 L74 40 L90 56 L86 92 Z" fill="${sh(c, -0.35)}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 40 L34 14 L66 14 L72 40 Z" fill="${sh(c, -0.2)}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 56 L4 34 L18 44 Z M90 56 L96 30 L82 44 Z M44 14 L50 2 L56 14 Z" fill="${c}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="37" y="23" width="9" height="6" rx="2" fill="#fff8a6"/><rect x="54" y="23" width="9" height="6" rx="2" fill="#fff8a6"/>
    <path d="M30 60 L44 52 L40 72 Z M60 64 L74 58 L70 80 Z" fill="${c}" opacity=".85"/><path d="M42 33 L58 33" stroke="${o}" stroke-width="2.5"/>`,
  owl: (c, o) => shadow(30) + `<path d="M24 26 L20 8 L36 20 Z M76 26 L80 8 L64 20 Z" fill="${sh(c, -0.25)}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="58" rx="32" ry="36" fill="${c}" stroke="${o}" stroke-width="3"/><ellipse cx="50" cy="70" rx="20" ry="20" fill="${sh(c, 0.55)}"/>
    <path d="M40 66 q4 4 8 0 q4 4 8 0 q4 4 8 0 M38 76 q4 4 8 0 q4 4 8 0 q4 4 8 0" stroke="${sh(c, -0.1)}" stroke-width="2" fill="none"/>
    <circle cx="37" cy="42" r="13" fill="#c0c8d8" stroke="${o}" stroke-width="2.5"/><circle cx="63" cy="42" r="13" fill="#c0c8d8" stroke="${o}" stroke-width="2.5"/>${eye(37, 42, 9)}${eye(63, 42, 9)}
    <path d="M46 54 L54 54 L50 62 Z" fill="#ffb703" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>`,
  worm: (c, o) => shadow(42) + `<circle cx="86" cy="78" r="10" fill="#fff6a6" stroke="${o}" stroke-width="2.5"/><circle cx="86" cy="78" r="16" fill="#fff6a6" opacity=".3"/>
    <circle cx="70" cy="74" r="14" fill="${c}" stroke="${o}" stroke-width="2.5"/><circle cx="52" cy="70" r="16" fill="${sh(c, -0.1)}" stroke="${o}" stroke-width="2.5"/>
    <circle cx="32" cy="62" r="22" fill="${c}" stroke="${o}" stroke-width="3"/><path d="M26 42 Q20 30 14 30 M36 42 Q38 28 46 26" stroke="${o}" stroke-width="2.5" fill="none"/>
    ${eye(26, 58, 7)}${eye(40, 58, 7)}${smile(33, 70, 5, o)}`,
  ram: (c, o) => shadow(42) + `<g fill="${c}" stroke="${o}" stroke-width="3"><circle cx="38" cy="50" r="22"/><circle cx="62" cy="46" r="22"/><circle cx="72" cy="66" r="20"/><circle cx="44" cy="70" r="22"/></g>
    <g fill="${c}"><circle cx="38" cy="50" r="19"/><circle cx="62" cy="46" r="19"/><circle cx="72" cy="66" r="17"/><circle cx="44" cy="70" r="19"/></g>
    <rect x="34" y="84" width="8" height="12" rx="3" fill="#4a3b52"/><rect x="62" y="84" width="8" height="12" rx="3" fill="#4a3b52"/>
    <ellipse cx="24" cy="58" rx="15" ry="18" fill="#5c4b6b" stroke="${o}" stroke-width="2.5"/>${eye(18, 54, 5.5)}${eye(30, 54, 5.5)}${smile(24, 66, 4, '#fff')}
    <path d="M18 40 C2 30 2 58 14 52" fill="none" stroke="#e9c46a" stroke-width="7" stroke-linecap="round"/><path d="M32 40 C46 30 50 52 38 50" fill="none" stroke="#e9c46a" stroke-width="7" stroke-linecap="round"/>
    <path d="M70 6 L62 22 L70 22 L64 36 L80 18 L72 18 L78 6 Z" fill="#fff36b" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>`,
  imp: (c, o) => shadow(26) + `<path d="M26 40 L8 22 L32 30 Z M74 40 L92 22 L68 30 Z" fill="${c}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 14 C80 30 80 92 50 92 C20 92 20 30 50 14 Z" fill="${c}" stroke="${o}" stroke-width="3"/>
    <path d="M40 20 L44 6 L48 18 M52 18 L57 4 L60 20" fill="#fff" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>
    ${eye(41, 50, 8)}${eye(60, 50, 8)}<path d="M42 68 Q50 76 58 68" fill="#fff" stroke="${o}" stroke-width="2.4"/><circle cx="35" cy="64" r="3.5" fill="#ff9ec4" opacity=".7"/><circle cx="66" cy="64" r="3.5" fill="#ff9ec4" opacity=".7"/>`,
};
const TOP = { slime: 10, crab: 4, mush: -2, bot: -4, fly: 14, yeti: 8, moth: -2, golem: -12, owl: 12, worm: 22, ram: 16, imp: 0 };
export function foeSVG(def) { return svg(K[def.k](def.c, sh(def.c, -0.6)), def.boss, TOP[def.k]); }

// Tumble, our hero: a mountain badger with a scarf, a backpack and a lantern (faces right)
export function heroSVG() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${shadow(32)}
  <rect x="10" y="42" width="24" height="34" rx="7" fill="#b07d4f" stroke="#3b2a20" stroke-width="3"/><rect x="12" y="38" width="20" height="8" rx="3" fill="#7a5233" stroke="#3b2a20" stroke-width="2"/><path d="M14 56 L30 56" stroke="#3b2a20" stroke-width="2"/>
  <ellipse cx="34" cy="92" rx="8" ry="5" fill="#2e2a3a"/><ellipse cx="58" cy="92" rx="8" ry="5" fill="#2e2a3a"/>
  <ellipse cx="46" cy="70" rx="26" ry="22" fill="#8d99ae" stroke="#2e2a3a" stroke-width="3"/><ellipse cx="50" cy="76" rx="15" ry="12" fill="#d9dde6"/>
  <line x1="66" y1="64" x2="80" y2="54" stroke="#2e2a3a" stroke-width="5" stroke-linecap="round"/><line x1="80" y1="54" x2="84" y2="62" stroke="#3b2a20" stroke-width="2"/>
  <circle cx="85" cy="74" r="16" fill="#ffd166" opacity=".28"/><rect x="78" y="62" width="14" height="18" rx="4" fill="#ffe08a" stroke="#6b4b1f" stroke-width="2.5"/><rect x="80" y="59" width="10" height="4" rx="2" fill="#6b4b1f"/><circle cx="85" cy="71" r="4" fill="#fff6c8"/>
  <path d="M30 52 Q50 62 68 50 L70 58 Q50 70 30 60 Z" fill="#ff5d5d" stroke="#7a1f2b" stroke-width="2"/><path d="M34 58 L28 72 L36 70 Z" fill="#ff5d5d" stroke="#7a1f2b" stroke-width="2"/>
  <circle cx="33" cy="22" r="7" fill="#8d99ae" stroke="#2e2a3a" stroke-width="2.5"/><circle cx="71" cy="22" r="7" fill="#8d99ae" stroke="#2e2a3a" stroke-width="2.5"/><circle cx="33" cy="22" r="3" fill="#ffb4c2"/><circle cx="71" cy="22" r="3" fill="#ffb4c2"/>
  <ellipse cx="52" cy="36" rx="24" ry="20" fill="#3a3546" stroke="#2e2a3a" stroke-width="3"/>
  <path d="M46 17 Q52 13 58 17 L61 40 Q54 48 47 40 Z" fill="#f4f1ea"/>
  <path d="M29 38 Q32 53 47 52 Q39 45 35 35 Z" fill="#f4f1ea"/><path d="M75 38 Q72 53 57 52 Q65 45 69 35 Z" fill="#f4f1ea"/>
  <ellipse cx="54" cy="46" rx="9" ry="7" fill="#f4f1ea"/>
  <circle cx="40" cy="33" r="5" fill="#fff"/><circle cx="66" cy="33" r="5" fill="#fff"/><circle cx="41.5" cy="33.5" r="3" fill="#1b1424"/><circle cx="67.5" cy="33.5" r="3" fill="#1b1424"/><circle cx="40.5" cy="32" r="1.1" fill="#fff"/><circle cx="66.5" cy="32" r="1.1" fill="#fff"/>
  <ellipse cx="56" cy="43" rx="4.5" ry="3.2" fill="#2e2a3a"/><circle cx="55" cy="42" r="1.2" fill="#fff" opacity=".7"/><path d="M50 49 Q55 53 60 49" stroke="#2e2a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="36" cy="46" r="3" fill="#ff8fa3" opacity=".6"/><circle cx="71" cy="46" r="3" fill="#ff8fa3" opacity=".6"/>
  </svg>`;
}
