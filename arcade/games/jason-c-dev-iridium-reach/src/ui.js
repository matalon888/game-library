// ui.js — start / pause / settings overlay for HUMAN play only.
// HARNESS TRANSPARENCY: this module is only ever loaded via a dynamic import
// in main.js that is gated on (!session && !moment && !harness). Harness boots
// never fetch this file: no DOM injected, no listeners, no localStorage reads.
//
// Visual grammar is lifted from the game's own cockpit MFDs (see moment-2):
// warm near-black glass, a LEFT-ALIGNED amber LED cluster in the panel head,
// bold warm-white type over quiet grey secondaries, amber for the live value,
// cyan reserved for data headers, and a cut corner so the panel is cockpit
// hardware rather than a web rectangle.

const TITLE = 'IRIDIUM REACH';
const LS_KEY = 'iridium-reach.settings';
const LS_HS = 'iridium-reach.highscore';
const S_MIN = 0.3, S_MAX = 3.0;
const pct = (v) => ((v - S_MIN) / (S_MAX - S_MIN)) * 100;
const fmt = (n) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const readHighScore = () => {
  try {
    const v = parseInt(localStorage.getItem(LS_HS) || '0', 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) { return 0; }
};
const writeHighScore = (v) => {
  try { localStorage.setItem(LS_HS, String(Math.round(v))); } catch (e) {}
};

export function initUI(G) {
  const canvas = G.renderer.domElement;

  // ---------------- settings: load + persist ----------------
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (typeof s.sensitivity === 'number' && isFinite(s.sensitivity)) {
      G.settings.sensitivity = Math.min(S_MAX, Math.max(S_MIN, s.sensitivity));
    }
    if (typeof s.invertY === 'boolean') G.settings.invertY = s.invertY;
  } catch (e) { /* corrupted storage: keep defaults */ }
  const saveSettings = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(G.settings)); } catch (e) {}
  };

  // ---------------- styles ----------------
  const style = document.createElement('style');
  style.textContent = `
#ir-ui, #ir-ui * { margin: 0; padding: 0; box-sizing: border-box; }
#ir-ui {
  position: fixed; inset: 0; z-index: 40;
  font-family: "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif;
  color: #f6ece0; -webkit-font-smoothing: antialiased; user-select: none;
}
/* scrim: warm, and light enough that the cockpit stays legible hardware */
/* panels are TOP-anchored, not centred: opening settings or the controls list
   grows the panel downward instead of sliding the button under the cursor */
#ir-ui .ir-layer {
  position: absolute; inset: 0; overflow: auto;
  display: flex; align-items: flex-start; justify-content: center;
  background: radial-gradient(ellipse at 50% 46%,
    rgba(10,6,3,0.30) 0%, rgba(8,5,3,0.50) 58%, rgba(4,2,1,0.66) 100%);
}
#ir-ui #ir-start { padding-top: 118px; }
#ir-ui #ir-pause { padding-top: 250px; }
/* ---- panel: cut corner, warm glass, blurred backdrop ---- */
#ir-ui .ir-panel {
  position: relative;
  background: rgba(13,11,9,0.90);
  -webkit-backdrop-filter: blur(7px) saturate(0.75);
  backdrop-filter: blur(7px) saturate(0.75);
  border: 1px solid rgba(255,206,150,0.30);
  /* hardware bezel, not a web drop shadow: hard dark edge + inner warm bevel */
  box-shadow: inset 0 1px 0 rgba(255,214,170,0.16), inset 0 0 90px rgba(0,0,0,0.5),
              0 0 0 3px rgba(6,4,3,0.55), 0 0 34px rgba(0,0,0,0.5);
  clip-path: polygon(26px 0, 100% 0, 100% calc(100% - 26px),
                     calc(100% - 26px) 100%, 0 100%, 0 26px);
  padding: 0 0 26px;
  display: flex; flex-direction: column;
}
/* panel head: amber LED cluster + label, LEFT aligned (HUD MFD grammar) */
#ir-ui .ir-head {
  display: flex; align-items: center; gap: 14px;
  padding: 11px 26px 10px 30px;
  border-bottom: 1px solid rgba(255,206,150,0.20);
  background: linear-gradient(180deg, rgba(255,168,84,0.10), rgba(255,168,84,0.0));
}
#ir-ui .ir-leds { display: flex; gap: 4px; }
#ir-ui .ir-leds i { width: 5px; height: 5px; background: #ffa23c; }
#ir-ui .ir-leds i:nth-child(4) { opacity: 0.45; }
#ir-ui .ir-leds i:nth-child(5) { opacity: 0.28; }
#ir-ui .ir-headtxt {
  font-size: 10px; font-weight: 600; letter-spacing: 0.30em;
  color: rgba(246,236,224,0.66); text-transform: uppercase;
}
#ir-ui .ir-headtxt b { color: #ffa23c; font-weight: 700; }
#ir-ui .ir-headr { margin-left: auto; font-size: 9px; letter-spacing: 0.26em; color: rgba(120,214,232,0.7); }
#ir-ui .ir-body { padding: 22px 34px 0; }
/* ---- type ---- */
/* HUD titling is heavy, warm and tightly set (see "Photon Cannon" /
   "Crimson Songbird") — match the weight and colour, not a landing-page hero */
#ir-ui .ir-title {
  text-align: center; white-space: nowrap;
  font-size: 42px; font-weight: 800; letter-spacing: 0.055em; text-indent: 0.055em;
  color: #ffd7a3; text-transform: uppercase;
  text-shadow: 0 0 24px rgba(255,150,60,0.30);
}
#ir-ui .ir-sub {
  margin-top: 9px; text-align: center;
  font-size: 10px; font-weight: 600; letter-spacing: 0.24em; text-indent: 0.24em;
  color: rgba(246,236,224,0.52); text-transform: uppercase;
}
#ir-ui .ir-rule {
  margin: 20px 0 18px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,206,150,0.26) 14%,
    rgba(255,206,150,0.26) 86%, transparent);
}
/* ---- control listing: fixed key column, clean left edge ---- */
#ir-ui .ir-controls {
  display: grid; grid-template-columns: 210px 1fr; gap: 9px 26px;
  align-items: center; margin: 0 auto; width: max-content;
}
#ir-ui .ir-keys { display: flex; gap: 6px; align-items: center; }
/* key chips wear the HUD's dark-tag-with-amber-dash grammar, not <kbd> */
#ir-ui .ir-key {
  position: relative; display: inline-block; min-width: 52px; text-align: center;
  border: 1px solid rgba(255,206,150,0.22); border-left: 3px solid rgba(255,162,60,0.85);
  background: rgba(0,0,0,0.45);
  padding: 4px 10px 4px 11px; font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.12em; text-indent: 0.12em;
  color: #ffe6c8; text-transform: uppercase; white-space: nowrap;
}
#ir-ui .ir-act {
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.20em;
  color: rgba(246,236,224,0.80); text-transform: uppercase;
}
/* ---- one button language everywhere ---- */
#ir-ui .ir-btn {
  position: relative; display: block; width: 320px; margin: 0 auto 9px;
  padding: 12px 0 12px 18px;
  border: 1px solid rgba(255,206,150,0.30);
  background: rgba(255,206,150,0.05);
  color: #f6ece0; font-family: inherit; font-size: 11.5px; font-weight: 600;
  letter-spacing: 0.28em; text-indent: 0.28em; text-transform: uppercase;
  text-align: center; cursor: pointer;
}
#ir-ui .ir-btn i {           /* chevron sits outside the centring box */
  position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
  font-style: normal; color: #ffa23c; letter-spacing: 0;
}
#ir-ui .ir-btn:hover { border-color: rgba(255,162,60,0.85); background: rgba(255,162,60,0.13); color: #fff3e2; }
/* the 90%-case action is filled and taller — not a border tint apart */
#ir-ui .ir-btn.primary {
  border-color: rgba(255,178,86,0.95);
  background: linear-gradient(180deg, rgba(255,162,60,0.34), rgba(255,132,36,0.20));
  color: #fff3e0; font-size: 13.5px; font-weight: 700; padding: 16px 0 16px 18px;
  box-shadow: inset 0 0 24px rgba(255,150,60,0.18);
}
#ir-ui .ir-btn.primary i { color: #fff3e0; }
#ir-ui .ir-btn.primary.pulse { animation: ir-pulse 1.9s ease-in-out infinite; }
#ir-ui .ir-btn.active { border-color: rgba(255,162,60,0.85); background: rgba(255,162,60,0.18); color: #fff3e2; }
@keyframes ir-pulse { 0%,100% { border-color: rgba(255,162,60,0.75); } 50% { border-color: rgba(255,162,60,0.28); } }
#ir-ui .ir-foot {
  margin-top: 14px; text-align: center;
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.24em; text-indent: 0.24em;
  color: rgba(246,236,224,0.38); text-transform: uppercase;
}
#ir-ui .ir-foot b { color: rgba(255,162,60,0.9); font-weight: 700; }
/* ---- settings ---- */
#ir-settings { width: 320px; margin: 14px auto 0; }
#ir-settings .ir-row { margin-bottom: 20px; }
#ir-settings .ir-lab {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 10px; font-weight: 600; letter-spacing: 0.22em;
  color: rgba(246,236,224,0.72); text-transform: uppercase; margin-bottom: 9px;
}
#ir-settings .ir-lab .val { color: #ffa23c; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; }
#ir-settings .ir-rail { position: relative; }
#ir-ui input.ir-range {
  -webkit-appearance: none; appearance: none; width: 100%; height: 18px;
  background: transparent; cursor: pointer; display: block;
}
#ir-ui input.ir-range::-webkit-slider-runnable-track {
  height: 3px; background: linear-gradient(90deg, rgba(255,162,60,0.75), rgba(255,162,60,0.20));
}
#ir-ui input.ir-range::-webkit-slider-thumb {
  -webkit-appearance: none; width: 12px; height: 16px; margin-top: -7px;
  background: #ffa23c; clip-path: polygon(0 0, 100% 0, 100% 58%, 50% 100%, 0 58%);
}
#ir-ui input.ir-range::-moz-range-track { height: 3px; background: linear-gradient(90deg, rgba(255,162,60,0.75), rgba(255,162,60,0.20)); }
#ir-ui input.ir-range::-moz-range-thumb {
  width: 12px; height: 16px; border: none; border-radius: 0;
  background: #ffa23c; clip-path: polygon(0 0, 100% 0, 100% 58%, 50% 100%, 0 58%);
}
/* ticks + captions sit at their REAL values (thumb travel is inset 6px each
   side by the 12px thumb, so the scale is inset to match) */
#ir-settings .ir-scale { position: relative; height: 16px; margin: 1px 6px 0; }
#ir-settings .ir-scale span {
  position: absolute; top: 0; transform: translateX(-50%);
  font-size: 8.5px; font-weight: 600; letter-spacing: 0.1em;
  color: rgba(246,236,224,0.42); white-space: nowrap;
}
#ir-settings .ir-scale span::before {
  content: ''; position: absolute; left: 50%; top: -5px; width: 1px; height: 4px;
  background: rgba(246,236,224,0.35);
}
#ir-settings .ir-scale span.def { color: rgba(255,162,60,0.85); }
#ir-settings .ir-scale span.def::before { background: rgba(255,162,60,0.85); height: 6px; top: -7px; }
/* segmented two-state switch — the active cell is unmistakable */
#ir-ui .ir-seg { display: flex; border: 1px solid rgba(255,206,150,0.30); width: max-content; }
#ir-ui .ir-seg button {
  font-family: inherit; font-size: 10px; font-weight: 700;
  letter-spacing: 0.22em; text-indent: 0.22em; text-transform: uppercase;
  padding: 7px 20px; border: none; cursor: pointer;
  background: transparent; color: rgba(246,236,224,0.48);
}
#ir-ui .ir-seg button + button { border-left: 1px solid rgba(255,206,150,0.22); }
#ir-ui .ir-seg button.on {
  background: linear-gradient(180deg, rgba(255,162,60,0.42), rgba(255,132,36,0.26));
  color: #fff3e0; box-shadow: inset 0 0 0 1px rgba(255,178,86,0.9);
}
#ir-ui .ir-seg button:hover { color: #ffe6c8; }
#ir-ui .hidden { display: none !important; }
/* ---- game over ---- */
#ir-ui #ir-gameover { padding-top: 150px; }
/* stat listing: WHITE-first values (the in-world HUD's data grammar — white
   numbers, dim white labels, amber reserved for the record callout) */
#ir-ui .ir-stats {
  width: 330px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr auto; gap: 9px 22px;
  align-items: baseline;
}
#ir-ui .ir-stats .k {
  font-size: 10px; font-weight: 600; letter-spacing: 0.24em;
  color: rgba(246,236,224,0.55); text-transform: uppercase;
}
#ir-ui .ir-stats .v {
  font-size: 16px; font-weight: 700; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.93); text-align: right;
  font-family: Futura, "Avenir Next", "Century Gothic", "Trebuchet MS", sans-serif;
}
#ir-ui .ir-stats .v.big { font-size: 27px; }
#ir-ui .ir-newrec {
  display: inline-block; margin-left: 10px; padding: 2px 7px;
  border: 1px solid rgba(255,162,60,0.85); color: #ffa23c;
  font-size: 8.5px; font-weight: 700; letter-spacing: 0.22em; text-indent: 0.22em;
  vertical-align: 3px;
}
/* ---- in-flight score readout (outside #ir-ui: lives during play) ----
   Register matches the cockpit HUD's data grammar: Futura family, WHITE-first
   values over dim white labels, a thin white rule — no web-page chrome. */
#ir-hudscore {
  position: fixed; top: 24px; right: 30px; z-index: 30;
  pointer-events: none; text-align: right; user-select: none;
  /* r9: same condensed geometric face as the repainted cockpit MFDs, so the
     score readout keeps one register with the in-world HUD */
  font-family: "Avenir Next Condensed", "Arial Narrow", "Avenir Next", sans-serif;
  text-shadow: 0 0 10px rgba(0,0,0,0.55);
}
#ir-hudscore .lab {
  font-size: 10px; font-weight: 700; letter-spacing: 0.34em;
  color: rgba(255,255,255,0.55);
}
#ir-hudscore .val {
  margin-top: 2px; padding-top: 3px;
  border-top: 1px solid rgba(255,255,255,0.35);
  font-size: 24px; font-weight: 700; letter-spacing: 0.10em;
  color: rgba(255,255,255,0.93);
}
#ir-hudscore .best {
  margin-top: 3px; font-size: 9px; font-weight: 600; letter-spacing: 0.22em;
  color: rgba(255,255,255,0.42);
}
`;
  document.head.appendChild(style);

  // ---------------- DOM ----------------
  const root = document.createElement('div');
  root.id = 'ir-ui';
  const head = (label, right) => `<div class="ir-head">
      <span class="ir-leds"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="ir-headtxt">${label}</span>
      <span class="ir-headr">${right}</span>
    </div>`;
  const key = (k) => `<span class="ir-key">${k}</span>`;
  const controlRows = [
    [key('MOUSE') + key('HOLD LMB'), 'STEER &nbsp;&middot;&nbsp; FIRE'],
    [key('W') + key('S'), 'THRUST &nbsp;&middot;&nbsp; BRAKE'],
    [key('A') + key('D'), 'ROLL'],
    [key('ARROW KEYS'), 'PITCH &nbsp;&middot;&nbsp; YAW'],
    [key('SHIFT'), 'BOOST'],
    [key('SPACE') + key('CTRL'), 'BRAKE-TURN'],
    [key('F'), 'FIRE'],
    [key('ESC'), 'PAUSE'],
  ].map(([k, a]) => `<div class="ir-keys">${k}</div><div class="ir-act">${a}</div>`).join('');

  root.innerHTML = `
  <div class="ir-layer hidden" id="ir-start">
    <div class="ir-panel" style="width:690px">
      ${head('<b>&#9632;</b> FLIGHT DECK &middot; PRE-LAUNCH', 'COM.7')}
      <div class="ir-body">
        <div class="ir-title">${TITLE}</div>
        <div class="ir-sub" id="ir-shipline"></div>
        <div class="ir-sub" id="ir-bestline" style="margin-top:5px"></div>
        <div class="ir-rule"></div>
        <div class="ir-controls">${controlRows}</div>
        <div class="ir-rule"></div>
        <button class="ir-btn primary pulse" id="ir-fly"><i>&#8250;&#8250;</i>CLICK TO FLY</button>
        <button class="ir-btn" id="ir-start-set"><i>&#8250;&#8250;</i>FLIGHT SETTINGS</button>
        <div id="ir-start-settings-host"></div>
        <div class="ir-foot">CLICK THE CANOPY TO LAUNCH &middot; <b>ESC</b> HOLDS FLIGHT IN-FLIGHT</div>
      </div>
    </div>
  </div>
  <div class="ir-layer hidden" id="ir-pause">
    <div class="ir-panel" style="width:470px">
      ${head('<b>&#9632;</b> ' + TITLE + ' &middot; FLIGHT SYSTEMS', 'HOLD')}
      <div class="ir-body">
        <div class="ir-title" style="font-size:30px">FLIGHT HELD</div>
        <div class="ir-sub">SIMULATION SUSPENDED</div>
        <div class="ir-rule"></div>
        <button class="ir-btn primary" id="ir-resume"><i>&#8250;&#8250;</i>RESUME FLIGHT</button>
        <button class="ir-btn" id="ir-settings-btn"><i>&#8250;&#8250;</i>FLIGHT SETTINGS</button>
        <button class="ir-btn" id="ir-ctl-btn"><i>&#8250;&#8250;</i>CONTROLS</button>
        <div id="ir-pause-settings-host"></div>
        <div class="ir-controls hidden" id="ir-pause-controls" style="margin-top:16px">${controlRows}</div>
        <div class="ir-foot"><b>ESC</b> RESUMES AND RE-ENGAGES THE STICK</div>
      </div>
    </div>
  </div>
  <div class="ir-layer hidden" id="ir-gameover">
    <div class="ir-panel" style="width:520px">
      ${head('<b>&#9632;</b> FLIGHT TELEMETRY &middot; FINAL', 'LOSS')}
      <div class="ir-body">
        <div class="ir-title" style="font-size:32px">SHIP DESTROYED</div>
        <div class="ir-sub" id="ir-go-shipline">HULL INTEGRITY ZERO</div>
        <div class="ir-rule"></div>
        <div class="ir-stats">
          <span class="k">FINAL SCORE</span><span class="v big" id="ir-go-score">0</span>
          <span class="k">BEST SCORE<span class="ir-newrec hidden" id="ir-go-newrec">NEW RECORD</span></span><span class="v" id="ir-go-best">0</span>
          <span class="k">WAVES CLEARED</span><span class="v" id="ir-go-waves">0</span>
          <span class="k">SYSTEMS REACHED</span><span class="v" id="ir-go-systems">1</span>
          <span class="k">HOSTILES DOWNED</span><span class="v" id="ir-go-kills">0</span>
        </div>
        <div class="ir-rule"></div>
        <button class="ir-btn primary" id="ir-restart"><i>&#8250;&#8250;</i>RELAUNCH</button>
        <div class="ir-foot"><b>R</b> RELAUNCHES THE VESSEL</div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(root);

  // in-flight score readout — separate node so it lives OUTSIDE the overlay
  // root (visible during play, pointer-transparent, killed with the layer)
  const scoreHud = document.createElement('div');
  scoreHud.id = 'ir-hudscore';
  scoreHud.innerHTML = '<div class="lab">SCORE</div><div class="val">0</div><div class="best"></div>';
  scoreHud.style.display = 'none';
  document.body.appendChild(scoreHud);

  // settings block — one node, hosted by whichever overlay is open
  const settingsEl = document.createElement('div');
  settingsEl.id = 'ir-settings';
  settingsEl.className = 'hidden';
  settingsEl.innerHTML = `
    <div class="ir-row">
      <div class="ir-lab"><span>STICK SENSITIVITY</span><span class="val" id="ir-sens-val"></span></div>
      <div class="ir-rail">
        <input class="ir-range" id="ir-sens" type="range" min="${S_MIN}" max="${S_MAX}" step="0.05">
        <div class="ir-scale">
          <span style="left:${pct(0.3)}%">0.3&times;</span>
          <span class="def" style="left:${pct(1.0)}%">1.0&times;</span>
          <span style="left:${pct(2.0)}%">2.0&times;</span>
          <span style="left:${pct(3.0)}%">3.0&times;</span>
        </div>
      </div>
    </div>
    <div class="ir-row">
      <div class="ir-lab"><span>INVERT Y AXIS</span></div>
      <div class="ir-seg" id="ir-invert">
        <button type="button" data-v="0">OFF</button><button type="button" data-v="1">ON</button>
      </div>
    </div>`;

  const el = (id) => root.querySelector('#' + id);
  const startLayer = el('ir-start');
  const pauseLayer = el('ir-pause');
  const pauseControls = el('ir-pause-controls');
  const sens = settingsEl.querySelector('#ir-sens');
  const sensVal = settingsEl.querySelector('#ir-sens-val');
  const segBtns = settingsEl.querySelectorAll('#ir-invert button');

  // in-fiction context line from the game's own procedural names
  el('ir-shipline').textContent =
    `VESSEL ${G.names.ship} · SYSTEM ${G.names.system}`.toUpperCase();
  // persistent flight record (localStorage high score)
  const bootHS = readHighScore();
  el('ir-bestline').textContent = bootHS > 0 ? `BEST SCORE ${fmt(bootHS)}` : 'NO FLIGHT RECORD ON FILE';
  const hudBest = scoreHud.querySelector('.best');
  const hudVal = scoreHud.querySelector('.val');
  if (bootHS > 0) hudBest.textContent = `BEST ${fmt(bootHS)}`;
  startLayer.classList.remove('hidden');

  // score readout refresh — cheap poll; DOM only touched on change.
  // r10: the visibility flip is a FUNCTION the state transitions call
  // directly. r9 left it to the 150ms poll alone, so the in-flight score
  // readout was still painted over the game-over panel when a check looked
  // (hudGone: false) — a poll race dressed as a layout bug.
  let shownScore = -1;
  const paintScoreHud = () => {
    const flying = G.uiState === 'running';
    if (scoreHud.style.display !== (flying ? 'block' : 'none')) {
      scoreHud.style.display = flying ? 'block' : 'none';
    }
    if (!flying) return;
    const sc = G.telemetryData.score;
    if (sc !== shownScore) { shownScore = sc; hudVal.textContent = fmt(sc); }
  };
  setInterval(paintScoreHud, 150);

  // ---------------- settings widgets ----------------
  function paintSettings() {
    sens.value = String(G.settings.sensitivity);
    sensVal.textContent = G.settings.sensitivity.toFixed(2) + '×';
    segBtns.forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === G.settings.invertY));
  }
  sens.addEventListener('input', () => {
    G.settings.sensitivity = Math.min(S_MAX, Math.max(S_MIN, parseFloat(sens.value) || 1));
    paintSettings();
    saveSettings();
  });
  segBtns.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    G.settings.invertY = b.dataset.v === '1';
    paintSettings();
    saveSettings();
  }));
  paintSettings();

  const settingsBtnFor = { 'ir-start-settings-host': 'ir-start-set', 'ir-pause-settings-host': 'ir-settings-btn' };
  let settingsOpenBtn = null;
  function openSettings(hostId) {
    el(hostId).appendChild(settingsEl);
    settingsEl.classList.remove('hidden');
    settingsOpenBtn = el(settingsBtnFor[hostId]);
    settingsOpenBtn.classList.add('active');
  }
  function closeSettings() {
    settingsEl.classList.add('hidden');
    if (settingsOpenBtn) settingsOpenBtn.classList.remove('active');
    settingsOpenBtn = null;
  }
  function toggleSettings(hostId) {
    if (settingsEl.classList.contains('hidden')) openSettings(hostId);
    else closeSettings();
  }
  settingsEl.addEventListener('click', (e) => e.stopPropagation());

  // ---------------- pointer lock helpers ----------------
  // Chrome imposes a short lockout after an Esc-initiated exit and requires a
  // fresh gesture; a rejected request is normal, and the canvas mousedown
  // handler in main.js re-requests on the player's next click. Headless has no
  // real lock at all — the game must run either way, so failures are silent.
  function tryLock() {
    try {
      const p = canvas.requestPointerLock && canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  // ---------------- state machine ----------------
  let pausedAt = 0;

  function start() {
    if (G.uiState !== 'start') return;
    G.uiState = 'running';
    G.uiHold = false;
    startLayer.classList.add('hidden');
    closeSettings();
    paintScoreHud();  // readout up on the same frame as the launch
    G.post.whiteout = 1; // arrival-style fade into flight (game's own grammar)
    tryLock();           // audio unlocks itself off this same click (audio.js)
    // r15 game-start. THIS IS THE GESTURE THAT UNLOCKS AUDIO — the pointerdown
    // listener in audio.js fires on the same click and creates the
    // AudioContext, then kicks voice.load(). So this play() lands before a
    // single clip is decoded, which is exactly the race voice.js's
    // startNow() handles: it awaits that one clip and replays the request if
    // it is still fresh. Any browser autoplay block is therefore moot — we
    // are inside a user gesture by construction.
    if (G.audio && G.audio.say) G.audio.say('game-start');
  }

  function pause() {
    if (G.uiState !== 'running') return;
    G.uiState = 'paused';
    G.uiHold = true;
    pausedAt = performance.now();
    closeSettings();
    pauseControls.classList.add('hidden');
    el('ir-ctl-btn').classList.remove('active');
    paintScoreHud();  // readout down with the sim, not 150ms later
    pauseLayer.classList.remove('hidden');
    // klaxon runs on a wall-clock interval — silence it while the sim holds
    if (G.audio && G.audio.klaxonOff) G.audio.klaxonOff();
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function resume() {
    if (G.uiState !== 'paused') return;
    G.uiState = 'running';
    G.uiHold = false;
    closeSettings();
    pauseLayer.classList.add('hidden');
    paintScoreHud();
    if (G.state === 'red-alert' && G.audio && G.audio.klaxonOn) G.audio.klaxonOn();
    tryLock();
  }

  // ---------------- game over ----------------
  // main.js runs the destruction sequence (explosion + tumble) and calls
  // this when it freezes the frame. uiState is already 'gameover' by then.
  const gameoverLayer = el('ir-gameover');

  G.onGameOver = (stats) => {
    paintScoreHud(); // final earned value on the readout before it goes
    scoreHud.style.display = 'none'; // no poll race: the HUD leaves with the ship
    const prev = readHighScore();
    const isRecord = stats.score > prev;
    if (isRecord) writeHighScore(stats.score);
    // r15 high-score — hung off the RECORD WRITE, not off the panel opening,
    // so the line and the persisted number cannot disagree.
    if (isRecord && G.audio && G.audio.say) G.audio.say('high-score');
    el('ir-go-score').textContent = fmt(stats.score);
    el('ir-go-best').textContent = fmt(Math.max(prev, stats.score));
    el('ir-go-newrec').classList.toggle('hidden', !isRecord);
    el('ir-go-waves').textContent = String(stats.wavesCleared);
    el('ir-go-systems').textContent = String(stats.systemsReached);
    el('ir-go-kills').textContent = String(stats.enemiesKilled);
    el('ir-go-shipline').textContent =
      `HULL INTEGRITY ZERO · VESSEL ${G.names.ship} LOST`.toUpperCase();
    closeSettings();
    pauseLayer.classList.add('hidden');
    gameoverLayer.classList.remove('hidden');
    if (G.audio && G.audio.klaxonOff) G.audio.klaxonOff();
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  };

  // relaunch = full reload: guarantees a clean state reset (fresh seed run,
  // fresh prewarm) and re-reads the persisted high score on the start screen
  //
  // r15: the reload is now held for the restart line. A page reload destroys
  // the AudioContext mid-word, so "play then reload immediately" would ship a
  // line nobody ever hears — the asset would be dead weight. The hold is
  // bounded three ways: it only waits while the voice layer is actually busy,
  // it hard-caps at RELAUNCH_HOLD_MS, and a SECOND press reloads at once, so
  // a player who does not want the quip is never more than one click from the
  // start screen. Muted (harness, ?novoice=1) reloads immediately, unchanged.
  // Long enough for the longest restart clip (restart.mp3 is 8.034 s, measured
  // by tools/r15-voice-decode.mjs). The first value was 4500, picked before
  // anything had measured a clip, and it cut the longest line off at 56%.
  const RELAUNCH_HOLD_MS = 8300;
  let relaunchArmed = false;
  function relaunch() {
    if (relaunchArmed) { location.reload(); return; }
    relaunchArmed = true;
    const V = G.audio && G.audio.voice;
    const r = G.audio && G.audio.say ? G.audio.say('restart') : 'muted';
    if (!V || V.muted || (r !== 'playing' && r !== 'loading' && r !== 'queued')) {
      location.reload();
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      if (!V.isBusy() || performance.now() - t0 > RELAUNCH_HOLD_MS) { location.reload(); return; }
      setTimeout(tick, 100);
    };
    setTimeout(tick, 120);
  }
  el('ir-restart').addEventListener('click', (e) => { e.stopPropagation(); relaunch(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && G.uiState === 'gameover') relaunch();
  });

  // start overlay: any click launches, except clicks on its own controls
  startLayer.addEventListener('click', () => {
    if (!settingsEl.classList.contains('hidden')) return; // settings open: explicit launch only
    start();
  });
  el('ir-fly').addEventListener('click', (e) => { e.stopPropagation(); closeSettings(); start(); });
  el('ir-start-set').addEventListener('click', (e) => { e.stopPropagation(); toggleSettings('ir-start-settings-host'); });

  el('ir-resume').addEventListener('click', (e) => { e.stopPropagation(); resume(); });
  el('ir-settings-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleSettings('ir-pause-settings-host'); });
  el('ir-ctl-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const showing = pauseControls.classList.toggle('hidden');
    el('ir-ctl-btn').classList.toggle('active', !showing);
  });

  // Esc: pauses when running (this is the path when no lock is held — with a
  // lock the browser eats Esc for the lock exit and pointerlockchange below
  // catches it). In the menu Esc resumes, guarded so the browser's lock-exit
  // Esc cannot pause and resume within one press.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (G.uiState === 'running') {
      pause();
    } else if (G.uiState === 'paused' && performance.now() - pausedAt > 350) {
      resume();
    }
  });

  // browser-reserved Esc during pointer lock: lock drops -> pause
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && G.uiState === 'running') pause();
  });

  return { start, pause, resume };
}
