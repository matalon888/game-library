#!/usr/bin/env bun
/* LIGHTCONE · ElevenLabs audio generator
 *
 * Generates sound effects (eleven_text_to_sound_v2) and music (music_v1/v2)
 * for the game. The API key is read from `.env` at the project root
 * (ELEVENLABS_API_KEY=...) and is NEVER printed, logged, or echoed —
 * every error path redacts it before anything reaches stdout/stderr.
 *
 * Usage:
 *   bun run scripts/elevenlabs.js check
 *   bun run scripts/elevenlabs.js presets
 *   bun run scripts/elevenlabs.js sfx <preset|"prompt"> [--duration 1.2] [--influence 0.4] [--loop] [--out file]
 *   bun run scripts/elevenlabs.js batch [preset ...] [--force]
 *   bun run scripts/elevenlabs.js music "<prompt>" [--length-ms 60000] [--instrumental] [--model music_v2] [--out file]
 *   Add --dry-run to any command to print the request (minus auth) without calling the API.
 */
import { parseArgs } from 'node:util';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env');
const API = 'https://api.elevenlabs.io';
const OUT_SFX = join(ROOT, 'assets', 'audio', 'sfx');
const OUT_MUSIC = join(ROOT, 'assets', 'audio', 'music');

// ---------------------------------------------------------------------------
// Secret handling — the key lives in a closure and only ever enters a header.
// ---------------------------------------------------------------------------
function loadKey() {
  let key = process.env.ELEVENLABS_API_KEY;
  if (!key && existsSync(ENV_FILE)) {
    for (const raw of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const name = line.slice(0, eq).trim().replace(/^export\s+/, '');
      if (name !== 'ELEVENLABS_API_KEY') continue;
      key = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      break;
    }
  }
  if (!key) {
    die('ELEVENLABS_API_KEY not found. Add it to .env at the project root (never pass it on the command line).');
  }
  return key;
}

const KEY = loadKey();
// Belt and braces: make sure nothing downstream can read it off the env either.
delete process.env.ELEVENLABS_API_KEY;

/** Strip the key (and its base64 / url-encoded forms) from any string that might get printed. */
function redact(s) {
  if (typeof s !== 'string') s = String(s);
  const forms = new Set([KEY, encodeURIComponent(KEY), Buffer.from(KEY).toString('base64')]);
  for (const f of forms) if (f) s = s.split(f).join('[REDACTED]');
  return s;
}
function log(...a) { console.log(...a.map(redact)); }
function warn(...a) { console.error(...a.map(redact)); }
function die(msg, code = 1) { console.error(redact(msg)); process.exit(code); }

// ---------------------------------------------------------------------------
// Presets — one per HS.sfx event in js/sfx.js, tuned to the game's vibe:
// a dark, 2D-raytraced arena; the hider is a glowing light, the seeker an agent.
// ---------------------------------------------------------------------------
export const SFX_PRESETS = {
  count:   { text: 'short soft electronic countdown blip, single clean sine tick, minimal, dark sci-fi UI', duration: 0.5 },
  go:      { text: 'bright two-note rising synth chime signalling the round start, clean, glassy, quick', duration: 0.8 },
  wall:    { text: 'heavy energy barrier slamming into place, low thud with a crackling static hiss, dark sci-fi', duration: 1.0 },
  decoy:   { text: 'small holographic decoy light flickering on, quick shimmering double blip, glassy and sly', duration: 0.7 },
  scrub:   { text: 'short burst of digital static wiping something clean, airy white-noise sweep, sci-fi', duration: 0.8 },
  dash:    { text: 'fast whoosh dash of a glowing orb of light, rising sawtooth swish with air rush, quick', duration: 0.6 },
  ping:    { text: 'sonar ping echoing in a dark empty chamber, clear high sine with long decaying tail', duration: 1.5 },
  sniff:   { text: 'two quick mechanical sniffs, a robot sensor sampling the air, breathy filtered noise', duration: 0.6 },
  scan:    { text: 'brief electronic scanner sweep, rising triangle-wave blip, subtle sci-fi UI', duration: 0.5 },
  step:    { text: 'single soft muffled footstep of something heavy padding on a dark metal floor, very short', duration: 0.5 },
  pounce:  { text: 'predator pounce: deep sub-bass impact with a rushing whoosh of air, menacing, dark', duration: 1.0 },
  stun:    { text: 'electric stun zap descending into a fizzling buzz, sawtooth crackle, sci-fi', duration: 0.9 },
  capture: { text: 'dramatic game-over capture: descending distorted synth slam and a low rumbling drop, ominous', duration: 1.6 },
  escape:  { text: 'triumphant ascending four-note synth arpeggio, bright bell-like, victorious, clean', duration: 1.4 },
  taunt:   { text: 'cheeky two-tone electronic taunt, quick square-wave nah-nah, playful robotic', duration: 0.5 },
  deny:    { text: 'short low negative buzz, action denied UI error tone, dull square wave', duration: 0.5 },
  glyph:   { text: 'mystical glyph activating, high crystalline shimmer with a faint sparkling hiss, ethereal', duration: 1.0 },
  glitch:  { text: 'digital glitch stutter, harsh static burst with pitched square-wave artifacts, brief', duration: 0.5 },
  unlock:  { text: 'slow powerful rising synth swell unlocking something ancient, detuned sawtooths building to a bright resolve with air', duration: 2.0 },
  rise:    { text: 'light lifting upward, rising airy sine sweep with soft breath of noise, weightless', duration: 0.8 },
  sink:    { text: 'light sinking downward, falling airy sine sweep with soft low noise, heavy', duration: 0.8 },
  realize: { text: 'sudden realization, a bright rising two-note synth bell with a subtle glitchy shimmer tail, eureka moment, dark sci-fi UI', duration: 1.0 },
};

export const MUSIC_PRESETS = {
  ambient: {
    prompt: 'Dark minimal ambient electronic loop for a stealth hide-and-seek game in a black raytraced arena. Slow pulsing sub-bass, sparse glassy synth pads, faint sonar-like pings, tense but hypnotic, no drums, no vocals. Seamless loop.',
    lengthMs: 60000, instrumental: true,
  },
  hunt: {
    prompt: 'Tense driving electronic chase music, ticking hi-hats, throbbing analog bass, urgent arpeggios, dark cinematic sci-fi, the seeker is close, no vocals.',
    lengthMs: 45000, instrumental: true,
  },
  ascension: {
    prompt: 'Ethereal uplifting synth swell, shimmering choirs of light, slow cinematic build to a triumphant bright resolve, transcendent, no drums, no vocals.',
    lengthMs: 30000, instrumental: true,
  },
};

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
async function call(method, path, { query, body, dryRun, allowStatus = [] } = {}) {
  const url = new URL(path, API);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  if (dryRun) {
    log(`[dry-run] ${method} ${url}`);
    if (body) log(JSON.stringify(body, null, 2));
    return null;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'xi-api-key': KEY, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // Network errors can serialize request objects — only surface the message.
    die(`Request failed: ${e && e.message ? e.message : 'network error'}`);
  }

  if (!res.ok && !allowStatus.includes(res.status)) {
    const text = (await res.text().catch(() => '')).slice(0, 2000);
    die(`ElevenLabs ${res.status} ${res.statusText} for ${method} ${url.pathname}\n${text}`);
  }
  return res;
}

async function saveAudio(res, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  return buf.length;
}

function extFor(format) {
  if (!format || format === 'auto' || format.startsWith('mp3')) return 'mp3';
  if (format.startsWith('opus')) return 'opus';
  if (format.startsWith('pcm')) return 'pcm';
  return format.split('_')[0];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdCheck({ dryRun }) {
  log('ELEVENLABS_API_KEY: present (value withheld)');
  // Quota lookup needs the `user_read` scope. A restricted key (only
  // sound_generation / music) is still perfectly usable — report that instead.
  const res = await call('GET', '/v1/user/subscription', { dryRun, allowStatus: [401] });
  if (!res) return;
  if (res.status === 401) {
    const err = await res.json().catch(() => ({}));
    const d = err.detail || {};
    if (d.status === 'missing_permissions') {
      log('key accepted, but it is scoped without `user_read` — quota not shown.');
      log('(generation still works if the key has the sound_generation / music scopes; try `sfx count --dry-run` then for real)');
      return;
    }
    die(`ElevenLabs rejected the key: ${d.message || d.status || 'unauthorized'}`);
  }
  const s = await res.json();
  log(`tier: ${s.tier}  status: ${s.status}`);
  log(`characters: ${s.character_count} / ${s.character_limit} used` +
      (s.next_character_count_reset_unix ? `  (resets ${new Date(s.next_character_count_reset_unix * 1000).toISOString()})` : ''));
}

function cmdPresets() {
  log('Sound effects (assets/audio/sfx/<name>.mp3):');
  for (const [k, p] of Object.entries(SFX_PRESETS)) log(`  ${k.padEnd(8)} ${p.duration}s  ${p.text}`);
  log('\nMusic (assets/audio/music/<name>.mp3):');
  for (const [k, p] of Object.entries(MUSIC_PRESETS)) log(`  ${k.padEnd(10)} ${p.lengthMs / 1000}s  ${p.prompt}`);
}

async function generateSfx(name, { text, duration, influence, loop, format, out, dryRun, force }) {
  const outPath = out || join(OUT_SFX, `${name}.${extFor(format)}`);
  if (!force && !dryRun && existsSync(outPath)) { log(`skip ${name} (exists: ${outPath}) — use --force to regenerate`); return outPath; }
  const body = { text, model_id: 'eleven_text_to_sound_v2' };
  if (duration !== undefined) body.duration_seconds = duration;
  if (influence !== undefined) body.prompt_influence = influence;
  if (loop) body.loop = true;
  const res = await call('POST', '/v1/sound-generation', { query: { output_format: format }, body, dryRun });
  if (!res) return outPath;
  const bytes = await saveAudio(res, outPath);
  log(`sfx ${name} → ${outPath} (${(bytes / 1024).toFixed(1)} KB)`);
  return outPath;
}

async function cmdSfx(pos, o) {
  const arg = pos.join(' ');
  if (!arg) die('sfx: give a preset name or a prompt. See `presets`.');
  const preset = SFX_PRESETS[arg];
  const name = preset ? arg : slug(arg);
  const text = preset ? preset.text : arg;
  const duration = o.duration !== undefined ? Number(o.duration) : preset?.duration;
  if (duration !== undefined && (duration < 0.5 || duration > 30)) die('--duration must be 0.5–30 seconds');
  const influence = o.influence !== undefined ? Number(o.influence) : undefined;
  if (influence !== undefined && (influence < 0 || influence > 1)) die('--influence must be 0–1');
  await generateSfx(name, { text, duration, influence, loop: o.loop, format: o.format || 'mp3_44100_128', out: o.out, dryRun: o['dry-run'], force: true });
}

async function cmdBatch(pos, o) {
  const names = pos.length ? pos : Object.keys(SFX_PRESETS);
  for (const n of names) {
    const p = SFX_PRESETS[n];
    if (!p) { warn(`unknown preset: ${n}`); continue; }
    await generateSfx(n, { ...p, format: o.format || 'mp3_44100_128', dryRun: o['dry-run'], force: o.force });
  }
}

async function cmdMusic(pos, o) {
  const arg = pos.join(' ');
  if (!arg) die('music: give a preset name or a prompt. See `presets`.');
  const preset = MUSIC_PRESETS[arg];
  const name = preset ? arg : slug(arg);
  const prompt = preset ? preset.prompt : arg;
  const lengthMs = o['length-ms'] !== undefined ? Number(o['length-ms']) : (preset?.lengthMs ?? 30000);
  if (lengthMs < 3000 || lengthMs > 600000) die('--length-ms must be 3000–600000');
  const format = o.format || 'mp3_44100_128';
  const outPath = o.out || join(OUT_MUSIC, `${name}.${extFor(format)}`);
  if (!o.force && !o['dry-run'] && existsSync(outPath)) { log(`skip ${name} (exists: ${outPath}) — use --force to regenerate`); return; }
  const body = {
    prompt,
    music_length_ms: lengthMs,
    model_id: o.model || 'music_v1',
    force_instrumental: o.instrumental || preset?.instrumental || false,
  };
  const res = await call('POST', '/v1/music', { query: { output_format: format }, body, dryRun: o['dry-run'] });
  if (!res) return;
  const bytes = await saveAudio(res, outPath);
  log(`music ${name} → ${outPath} (${(bytes / 1024).toFixed(1)} KB)`);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'untitled';
}

function usage() {
  log(`LIGHTCONE · ElevenLabs audio generator

  bun run scripts/elevenlabs.js check                     verify the key works, show quota (key is never printed)
  bun run scripts/elevenlabs.js presets                   list game sfx/music presets
  bun run scripts/elevenlabs.js sfx <preset|"prompt">     one sound effect  [--duration s] [--influence 0-1] [--loop] [--out f]
  bun run scripts/elevenlabs.js batch [preset ...]        all (or given) sfx presets → assets/audio/sfx/  [--force]
  bun run scripts/elevenlabs.js music <preset|"prompt">   music track  [--length-ms n] [--instrumental] [--model music_v1|music_v2] [--out f]

  Global: --format <output_format> (default mp3_44100_128)  --dry-run  --force`);
}

// ---------------------------------------------------------------------------
const { values: o, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    duration: { type: 'string' }, influence: { type: 'string' }, loop: { type: 'boolean' },
    'length-ms': { type: 'string' }, instrumental: { type: 'boolean' }, model: { type: 'string' },
    format: { type: 'string' }, out: { type: 'string' }, force: { type: 'boolean' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});

const [cmd, ...pos] = positionals;
try {
  if (o.help || !cmd) usage();
  else if (cmd === 'check') await cmdCheck({ dryRun: o['dry-run'] });
  else if (cmd === 'presets') cmdPresets();
  else if (cmd === 'sfx') await cmdSfx(pos, o);
  else if (cmd === 'batch') await cmdBatch(pos, o);
  else if (cmd === 'music') await cmdMusic(pos, o);
  else { warn(`unknown command: ${cmd}\n`); usage(); process.exit(2); }
} catch (e) {
  die(`error: ${e && e.message ? e.message : e}`);
}
