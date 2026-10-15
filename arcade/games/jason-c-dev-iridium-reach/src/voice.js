// voice.js — the onboard computer speaks.
//
// ROUND 15, AND IT DELIBERATELY BREAKS THE ALL-PROCEDURAL AUDIO RULE.
// Every sound in this game up to now was synthesised in audio.js from
// oscillators and noise buffers, and that rule bought us a real property:
// headless runs never touched audio, never fetched a byte, never logged an
// autoplay error. Jason approved shipping 49 recorded lines against that rule.
// The rule was load-bearing for the HARNESS, not for the game, so the harness
// keeps it and only human play loses it. See MUTE, below, which is the whole
// contract in eight lines.
//
// WHAT THIS MODULE IS
//   * 16 event keys, 3 variants each (kill has 4), from assets/voice/MANIFEST.json
//   * one line at a time, ever — a short priority queue, not a mixer
//   * alert-class lines PREEMPT flavour lines mid-sentence
//   * per-event cooldowns plus a global "at most one line per ~8s" throttle,
//     which alert-class lines bypass (an alert that waits its turn is not an alert)
//   * uniform-random variant rotation with no immediate repeat per key
//   * window.__voiceLog: every play, with the RESOLVED FILENAME, start and end.
//     That log is the whole verification story — tools/r15-voice-talktest.mjs
//     asserts key->file correctness and non-overlap against it, and proves the
//     assertion falsifiable by swapping two keys in the map and re-running.
//
// MUTE — THE HARNESS CONTRACT, AND IT IS TWO INDEPENDENT LOCKS.
//   Lock 1: MUTED is true under any harness param (G.harness === session |
//     moment | harness) or ?novoice=1. play() returns before touching anything.
//   Lock 2: nothing here fetches or decodes until load() is called, and load()
//     is only ever called from audio.js's unlock(), which only runs on a real
//     user gesture. A headless boot makes no gesture.
//   Either lock alone is sufficient. Both are present because the posed-capture
//   path must be byte-identical and the fps harness must be untouched, and a
//   single lock on a property that matters this much is a single point of
//   failure. PROVEN: tools/r15-det-check.sh (5/5 byte-identical across the
//   change) and tools/r15-voice-fetchcheck.mjs (zero assets/voice/* entries in
//   performance.getEntriesByType('resource') on every harness path).
//
// DETERMINISM: variant choice and the kill dice use Math.random(), NEVER the
// seeded gameplay rng. Drawing from flight.js's `rng` stream would shift every
// AI decision downstream of a voice line, which is exactly the class of defect
// this project has spent fifteen rounds not shipping. Voice cannot move the sim.

const MANIFEST_URL = new URL('../assets/voice/MANIFEST.json', import.meta.url);
const CLIP_BASE = new URL('../assets/voice/', import.meta.url);

// Alert-class: preempts a playing flavour line and bypasses the global gap.
// Everything else is flavour or ceremony and waits its turn.
const ALERT = new Set(['shield-low', 'shield-down', 'hull-critical', 'wave-incoming', 'game-over']);

// Exempt from the global chattiness budget. ALERT is exempt because an alert
// that waits its turn is not an alert. The three added here are exempt for the
// opposite reason: game-start, high-score and restart fire AT MOST ONCE PER
// RUN, so they cannot contribute to nattering by construction, and each sits
// next to another line by design — high-score lands ~3s after game-over at the
// end of the destruction tumble, and under the budget it would be dropped
// every time, which would mean the one line that celebrates a personal best is
// the one line nobody ever hears. They are still subject to the single
// `playing` slot, so they queue rather than overlap.
const NO_GAP = new Set([...ALERT, 'game-start', 'high-score', 'restart']);

// Per-event cooldown in seconds — the "no line twice within its window" rule.
// Call sites carry their own semantic gates as well (shield-low is once per
// wave, gunship once per system); these are the backstop, not the only gate.
const COOLDOWN = {
  'game-start': 60,
  'wave-incoming': 6,
  'shield-low': 25,
  'shield-down': 20,
  'hull-critical': 20,
  'kill': 12,
  'wave-cleared': 6,
  'cannon-upgrade': 6,
  'gunship': 30,
  'overheat': 20,
  'warp-charge': 6,
  'arrival': 6,
  'asteroid-nearmiss': 15,
  'game-over': 60,
  'restart': 60,
  'high-score': 60,
};
const DEFAULT_COOLDOWN = 10;

// Global rule: at most one line per GLOBAL_GAP seconds. MEASURED START TO
// START, and that is a correction to how this was first written.
//   The first build measured the gap from the END of the previous line. It is
// the obvious reading of "one line per 8s" and it is wrong for this game,
// because it silently deletes lines the player would never otherwise hear. A
// wave clear in space fires the clear line at t=0 and the ARRIVAL line at
// t=10.0 (3.5s warp-charge + 6.5s tunnel). With a 4.5s line and an end-relative
// gap, arrival needs t>=12.5 and is dropped every single time — the player
// would complete a hyperspace jump in silence, forever, and nothing would say
// so. Start-relative, 10.0 >= 8.0 and it plays.
//   The no-overlap guarantee does NOT come from this number. It comes from
// there being exactly one `playing` slot. GLOBAL_GAP is a chattiness budget,
// not a safety property, and conflating the two is what produced the bug.
const GLOBAL_GAP = 8.0;
// A kill fires a line ~30% of the time. Same reason.
const KILL_CHANCE = 0.30;
// QUEUE_MAX and STALE_AFTER ARE BOTH DERIVED FROM A MEASUREMENT, and both
// moved once the measurement existed. tools/r15-voice-decode.mjs decoded all
// 49 clips: mean 6.01 s, range 3.762-9.056 s. The first draft guessed ~4 s and
// set STALE_AFTER 6.0 / QUEUE_MAX 2, which is incoherent against real clips —
// a request sitting behind ONE average line ages 6.0 s and would have been
// dropped as stale by the very gate meant to let it through, so the queue
// would have been decoration that never delivered anything. STALE_AFTER 9.0
// covers exactly one line ahead in the queue, up to the longest clip we own.
// QUEUE_MAX drops to 1 for the same reason: a second queued slot is 12-18 s of
// backlog against a 9 s staleness cut, i.e. a slot whose only possible
// outcome is a stale-drop later instead of a queue-full drop now.
const QUEUE_MAX = 1;
const STALE_AFTER = 11.0;   // MIN_SILENCE is added to every queued wait; see below

// MIN_SILENCE — MEASURED INTO EXISTENCE BY tools/r15-voice-chatter.mjs.
// An unsupervised 58s autopilot session produced 7 lines, 46s of speech, a
// 79.3% duty cycle and — the part that actually sounds wrong — a MINIMUM
// INTER-LINE GAP OF 0.00s. The queue was starting the next line on the exact
// sample the previous one ended, so two unrelated remarks ran together as one
// continuous monologue. GLOBAL_GAP could not prevent it: alert-class and
// once-per-run lines are exempt from the budget by design, and the budget is
// start-relative anyway, so a queued line released at the 8s mark lands
// immediately after a 6s line with nothing between them.
//   So there is now a floor on SILENCE, not just on rate, and unlike the
// budget NOTHING is exempt from it — an alert that PREEMPTS still cuts in
// instantly (that path replaces the line rather than following it), but an
// alert that merely follows waits its 2.5s like everything else. It costs no
// lines at all: a held request queues and starts later.
const MIN_SILENCE = 2.5;

// ...with exactly one exemption, and it is a scene change rather than a line.
// THE TALK TEST FOUND THIS: MIN_SILENCE queued the restart line behind the
// 2.5 s floor, ui.js's relaunch() holds the page reload only while the voice
// layer is busy up to a hard cap, and the reload landed BEFORE the held line
// ever started. Net effect of two of my own changes interacting: the restart
// line never played at all. The floor exists to stop two remarks running
// together as one monologue — but nothing follows restart, because the page
// is about to reload and take the AudioContext with it. So restart speaks
// immediately, cutting off whatever was still going, which is also the right
// read of a player who has just asked to start again.
const NO_SILENCE_FLOOR = new Set(['restart']);

const now = () => performance.now() / 1000;

export function initVoice(G, bus, opts = {}) {
  const MUTED = !!G.harness || !!opts.off;

  let manifest = null;            // key -> [{file, text}]
  const buffers = new Map();      // file -> AudioBuffer
  const pending = new Map();      // file -> Promise<AudioBuffer>
  let loadState = MUTED ? 'muted' : 'idle';
  let loadError = null;

  const lastVariant = new Map();  // key -> last variant index played
  const lastPlayed = new Map();   // key -> time the line last STARTED
  let lastStart = -1e9;           // when the last line STARTED (see GLOBAL_GAP)
  let lastEnd = -1e9;             // when the last line FINISHED (see MIN_SILENCE)
  let playing = null;             // { key, file, src, gain, entry }
  const queue = [];               // [{ key, at }]
  // THE PRE-LOAD SLOT, AND IT EXISTS BECAUSE THE TALK TEST FOUND A REAL BUG.
  // game-start is requested from ui.js's start() on the very click that
  // creates the AudioContext, and audio.js kicks load() from that same
  // handler. play() therefore ran with manifest === null and returned
  // 'not-loaded' — so the FIRST LINE A PLAYER WOULD EVER HEAR was dropped on
  // every single run, silently, and only the log said so. One slot is enough:
  // nothing else can be requested before the first frame of flight.
  let preload = null;             // { key, at } | null
  let seq = 0;

  // ---- instrumentation. Always present, even muted, so a tool can assert
  // ---- that the muted path logged NOTHING rather than inferring it.
  const log = [];
  const drops = [];
  window.__voiceLog = log;
  window.__voiceDrops = drops;
  window.__voiceState = () => ({
    muted: MUTED, loadState, loadError,
    playing: playing ? { key: playing.key, file: playing.file } : null,
    queue: queue.map(q => q.key),
    buffers: buffers.size,
    keys: manifest ? Object.keys(manifest).length : 0,
  });

  const drop = (key, reason) => {
    drops.push({ key, reason, t: Math.round(now() * 1000) / 1000 });
    return reason;
  };

  // ---------------- loading ----------------
  async function fetchManifest() {
    const r = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error('MANIFEST ' + r.status);
    return r.json();
  }

  async function decodeClip(file) {
    if (buffers.has(file)) return buffers.get(file);
    if (pending.has(file)) return pending.get(file);
    const p = (async () => {
      const r = await fetch(new URL(file, CLIP_BASE), { cache: 'force-cache' });
      if (!r.ok) throw new Error(file + ' HTTP ' + r.status);
      const bytes = await r.arrayBuffer();
      const ctx = bus.ctx();
      if (!ctx) throw new Error(file + ': no AudioContext');
      // decodeAudioData is the honest check — a truncated or corrupt mp3
      // rejects here rather than playing silence at the moment it is needed.
      const buf = await ctx.decodeAudioData(bytes);
      buffers.set(file, buf);
      return buf;
    })();
    pending.set(file, p);
    p.catch(() => {});
    return p;
  }

  // Called once, from audio.js's unlock(), i.e. only after a user gesture.
  async function load() {
    if (MUTED || loadState === 'loading' || loadState === 'ready') return loadState;
    loadState = 'loading';
    try {
      manifest = await fetchManifest();
      // flush the pre-load slot the moment the map exists, BEFORE the 49-clip
      // decode loop below — startNow() already knows how to wait for one clip.
      if (preload) {
        const p = preload; preload = null;
        if (now() - p.at <= STALE_AFTER) play(p.key); else drop(p.key, 'stale-preload');
      }
      // exposed ONLY so the talk-test's red run can swap two keys in the map
      // the module resolves against. The talk-test's PASS/FAIL reference is the
      // manifest read from disk by the tool, never this object — if the
      // assertion read the same object the mutation edits, the swap would
      // agree with itself and the check would be unfalsifiable.
      window.__voiceManifestRef = manifest;
      // Decode sequentially in the background. 49 clips at ~95 KB is not worth
      // a parallel storm on the frame the player just clicked "fly".
      for (const key of Object.keys(manifest)) {
        for (const v of manifest[key]) {
          try { await decodeClip(v.file); } catch (e) { loadError = String(e); }
        }
      }
      loadState = loadError ? 'partial' : 'ready';
    } catch (e) {
      loadError = String(e);
      loadState = 'failed';
    }
    return loadState;
  }

  // Used by tools/r15-voice-decode.mjs: decode EVERY manifest entry and report
  // per-file, so a corrupt mp3 fails loudly at the check instead of silently at
  // play time. Runs regardless of MUTED — it needs its own AudioContext, which
  // the tool provides by unlocking first.
  async function decodeAll() {
    if (!manifest) manifest = await fetchManifest();
    const out = [];
    for (const key of Object.keys(manifest)) {
      for (const v of manifest[key]) {
        const t0 = now();
        try {
          const b = await decodeClip(v.file);
          out.push({
            key, file: v.file, ok: true,
            seconds: Math.round(b.duration * 1000) / 1000,
            channels: b.numberOfChannels, sampleRate: b.sampleRate,
            decodeMs: Math.round((now() - t0) * 1000),
          });
        } catch (e) {
          out.push({ key, file: v.file, ok: false, error: String(e) });
        }
      }
    }
    return out;
  }

  // ---------------- variant rotation ----------------
  function pickVariant(key) {
    const vs = manifest[key];
    if (!vs || !vs.length) return -1;
    if (vs.length === 1) return 0;
    const last = lastVariant.has(key) ? lastVariant.get(key) : -1;
    // uniform over the variants that are not the one we just played
    let i = (Math.random() * (vs.length - (last >= 0 ? 1 : 0))) | 0;
    if (last >= 0 && i >= last) i++;
    if (i >= vs.length) i = vs.length - 1;
    return i;
  }

  // ---------------- playback ----------------
  function stopCurrent(reason) {
    if (!playing) return;
    const p = playing;
    playing = null;
    p.entry.ended = reason;
    p.entry.tEnd = Math.round(now() * 1000) / 1000;
    try { p.src.onended = null; p.src.stop(); } catch (e) {}
    lastEnd = now();
    bus.duck(false);
  }

  function startNow(key, requestedAt) {
    const vi = pickVariant(key);
    if (vi < 0) return drop(key, 'no-variants');
    const v = manifest[key][vi];
    const buf = buffers.get(v.file);
    const ctx = bus.ctx();
    if (!ctx) return drop(key, 'no-context');
    if (!buf) {
      // Not decoded yet (game-start races the first gesture by design). Wait
      // for this one clip, then replay the request if it has not gone stale.
      decodeClip(v.file).then(() => {
        if (now() - requestedAt > STALE_AFTER) { drop(key, 'stale-after-load'); return; }
        if (playing) { drop(key, 'busy-after-load'); return; }
        startNow(key, requestedAt);
      }).catch(() => drop(key, 'decode-failed'));
      return 'loading';
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1.0;
    src.connect(g);
    g.connect(bus.voiceNode());
    const entry = {
      i: seq++,
      key,
      file: v.file,
      variant: vi,
      variants: manifest[key].length,
      prio: ALERT.has(key) ? 'alert' : 'normal',
      requestedAt: Math.round(requestedAt * 1000) / 1000,
      tStart: Math.round(now() * 1000) / 1000,
      tEnd: null,
      duration: Math.round(buf.duration * 1000) / 1000,
      ended: null,
    };
    log.push(entry);
    lastStart = now();
    lastPlayed.set(key, now());
    playing = { key, file: v.file, src, gain: g, entry };
    lastVariant.set(key, vi);
    bus.duck(true);
    src.onended = () => {
      if (!playing || playing.src !== src) return;   // already stopped/preempted
      playing = null;
      entry.ended = 'complete';
      entry.tEnd = Math.round(now() * 1000) / 1000;
      lastEnd = now();
      bus.duck(false);
      pump();
    };
    try { src.start(); } catch (e) { stopCurrent('start-failed'); return drop(key, 'start-failed'); }
    return 'playing';
  }

  function pump() {
    if (playing || !queue.length) return;
    // drop anything that went stale while it waited
    while (queue.length && now() - queue[0].at > STALE_AFTER) {
      drop(queue.shift().key, 'stale-in-queue');
    }
    if (!queue.length) return;
    const nxt = queue[0];
    // two independent waits: the chattiness budget (which some keys skip) and
    // the silence floor (which nothing skips)
    let waitFor = 0;
    if (!NO_GAP.has(nxt.key)) waitFor = Math.max(waitFor, GLOBAL_GAP - (now() - lastStart));
    if (!NO_SILENCE_FLOOR.has(nxt.key)) waitFor = Math.max(waitFor, MIN_SILENCE - (now() - lastEnd));
    if (waitFor > 0) { setTimeout(pump, Math.max(50, waitFor * 1000)); return; }
    queue.shift();
    startNow(nxt.key, nxt.at);
  }

  function play(key) {
    if (MUTED) return 'muted';
    if (!manifest) {
      if (loadState === 'idle' || loadState === 'loading') {
        // hold it. An alert-class request outranks whatever is already held.
        if (!preload || (ALERT.has(key) && !ALERT.has(preload.key))) preload = { key, at: now() };
        return 'pre-load';
      }
      return drop(key, 'not-loaded');   // failed or never started: genuinely fatal
    }
    if (!(key in manifest)) return drop(key, 'unknown-key');
    const t = now();
    const alert = ALERT.has(key);

    // the ~30% kill dice, before every other gate so the drop reason is honest
    if (key === 'kill' && Math.random() >= KILL_CHANCE) return drop(key, 'chance');

    const cd = COOLDOWN[key] !== undefined ? COOLDOWN[key] : DEFAULT_COOLDOWN;
    if (t - (lastPlayed.get(key) || -1e9) < cd) return drop(key, 'cooldown');
    if (!NO_GAP.has(key) && t - lastStart < GLOBAL_GAP) return drop(key, 'global-gap');

    // kills never stack: one in flight or one waiting is the maximum
    if (key === 'kill' && ((playing && playing.key === 'kill') || queue.some(q => q.key === 'kill'))) {
      return drop(key, 'kill-already-queued');
    }

    if (!playing) {
      // inside the silence floor: hold it in the queue rather than butting it
      // up against the line that just ended
      if (!NO_SILENCE_FLOOR.has(key) && t - lastEnd < MIN_SILENCE) { queue.push({ key, at: t }); setTimeout(pump, Math.max(50, (MIN_SILENCE - (t - lastEnd)) * 1000)); return 'queued'; }
      return startNow(key, t);
    }

    if (NO_SILENCE_FLOOR.has(key)) {
      // scene change: stop the current line and speak now
      stopCurrent('preempted');
      return startNow(key, t);
    }
    if (alert && !ALERT.has(playing.key)) {
      // an alert cuts a flavour line off mid-word. That is the point of it.
      stopCurrent('preempted');
      return startNow(key, t);
    }
    if (queue.length >= QUEUE_MAX) return drop(key, 'queue-full');
    queue.push({ key, at: t });
    return 'queued';
  }

  const V = {
    play,
    load,
    decodeAll,
    stop: () => stopCurrent('stopped'),
    get muted() { return MUTED; },
    get state() { return loadState; },
    log,
    drops,
    // exposed so the talk-test can wait for a line to finish rather than sleep
    isBusy: () => !!playing || queue.length > 0 || !!preload,
    constants: { GLOBAL_GAP, MIN_SILENCE, KILL_CHANCE, QUEUE_MAX, STALE_AFTER, COOLDOWN, ALERT: [...ALERT], NO_GAP: [...NO_GAP] },
  };
  G.voice = V;
  return V;
}
