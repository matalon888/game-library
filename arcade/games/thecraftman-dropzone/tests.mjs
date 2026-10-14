// Test suite for Stormfall Royale.
// Usage: node tests.mjs
// 1. Syntax-checks every <script> block in index.html.
// 2. Unit-tests the pure game logic (script id="pure-logic").

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');

// ---------- extract scripts ----------
const scripts = [...html.matchAll(/<script(?:\s+id="([^"]*)")?>([\s\S]*?)<\/script>/g)]
  .map((m) => ({ id: m[1] || 'main', code: m[2] }));
if (scripts.length < 2) {
  console.error('FAIL: expected at least 2 <script> blocks, found ' + scripts.length);
  process.exit(1);
}

// ---------- 1. syntax check ----------
const tmp = mkdtempSync(join(tmpdir(), 'stormfall-'));
for (const s of scripts) {
  const f = join(tmp, s.id + '.js');
  writeFileSync(f, s.code);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('syntax OK: <script id="' + s.id + '"> (' + s.code.length + ' chars)');
  } catch (e) {
    console.error('FAIL: syntax error in <script id="' + s.id + '">');
    console.error(String(e.stderr || e.stdout || e));
    process.exit(1);
  }
}

// ---------- 2. unit tests on pure logic ----------
const pureSrc = scripts.find((s) => s.id === 'pure-logic').code;
const mod = { exports: {} };
new Function('module', pureSrc)(mod);
const L = mod.exports;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + name); }
}
function near(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }

// --- clamp / dist / lerp ---
t('clamp below', L.clamp(-5, 0, 10) === 0);
t('clamp above', L.clamp(15, 0, 10) === 10);
t('clamp inside', L.clamp(7, 0, 10) === 7);
t('dist 3-4-5', near(L.dist(0, 0, 3, 4), 5));
t('lerp midpoint', near(L.lerp(10, 20, 0.5), 15));

// --- PRNG ---
{
  const a = L.mulberry32(42), b = L.mulberry32(42), c = L.mulberry32(43);
  const s1 = [a(), a(), a()], s2 = [b(), b(), b()];
  t('mulberry32 deterministic', s1.every((v, i) => v === s2[i]));
  t('mulberry32 different seeds differ', c() !== s1[0]);
  const r = L.mulberry32(7);
  let inRange = true;
  for (let i = 0; i < 1000; i++) { const v = r(); if (v < 0 || v >= 1) inRange = false; }
  t('mulberry32 output in [0,1)', inRange);
}

// --- weightedPick / loot tables ---
{
  const rig = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  t('weightedPick first bucket', L.weightedPick(rig([0.0]), [['a', 1], ['b', 1]]) === 'a');
  t('weightedPick second bucket', L.weightedPick(rig([0.99]), [['a', 1], ['b', 1]]) === 'b');
  t('weightedPick single entry', L.weightedPick(rig([0.5]), [['only', 3]]) === 'only');

  const r = L.mulberry32(99);
  let ok = true;
  const seen = new Set();
  for (let i = 0; i < 800; i++) {
    const it = L.rollLoot(r);
    seen.add(it.type);
    if (!['gun', 'ammo', 'medkit', 'shield', 'mats'].includes(it.type)) ok = false;
    if (it.type === 'gun') {
      if (!L.WEAPONS[it.kind] || it.kind === 'pickaxe') ok = false;
      if (!L.RARITIES.includes(it.rarity)) ok = false;
    } else if (typeof it.n !== 'number' || it.n <= 0) ok = false;
  }
  t('rollLoot always valid over 800 rolls', ok);
  t('rollLoot covers every item type', seen.size === 5);

  const r2 = L.mulberry32(5);
  let rarOk = true;
  for (let i = 0; i < 500; i++) if (!L.RARITIES.includes(L.rollRarity(r2))) rarOk = false;
  t('rollRarity always a valid rarity', rarOk);
}

// --- gun scoring ---
t('legendary beats common (same gun)', L.gunScore('rifle', 'legendary') > L.gunScore('rifle', 'common'));
t('gunDamage scales with rarity', L.gunDamage('pistol', 'legendary') > L.gunDamage('pistol', 'common'));
t('every gun has positive score', Object.keys(L.WEAPONS).filter((k) => k !== 'pickaxe').every((k) => L.gunScore(k, 'common') > 0));

// --- damage model ---
{
  const e = { hp: 100, shield: 50 };
  const r = L.applyDamage(e, 30);
  t('shield absorbs first', e.shield === 20 && e.hp === 100 && r.toShield === 30 && r.toHealth === 0);
  const r2 = L.applyDamage(e, 50);
  t('overflow spills to health', e.shield === 0 && e.hp === 70 && r2.toShield === 20 && r2.toHealth === 30);
  const r3 = L.applyDamage(e, 500);
  t('lethal damage kills, hp floors at 0', r3.died && e.hp === 0);
  const e2 = { hp: 10, shield: 0 };
  t('exact-kill damage kills', L.applyDamage(e2, 10).died && e2.hp === 0);
  const e3 = { hp: 50, shield: 100 };
  t('full shield tank, no death', !L.applyDamage(e3, 100).died && e3.hp === 50 && e3.shield === 0);
}

// --- storm damage bypasses shield ---
{
  const e = { hp: 5, shield: 100 };
  t('storm ignores shield', L.applyStormDamage(e, 3) === false && e.hp === 2 && e.shield === 100);
  t('storm can kill', L.applyStormDamage(e, 10) === true && e.hp === 0);
}

// --- pickups ---
{
  const p = { hp: 60, shield: 0, ammo: 230, mats: 490 };
  t('medkit heals capped at 100', L.pickupApply(p, { type: 'medkit', n: 50 }) && p.hp === 100);
  t('medkit refused at full hp', !L.pickupApply(p, { type: 'medkit', n: 50 }));
  t('shield potion applies', L.pickupApply(p, { type: 'shield', n: 50 }) && p.shield === 50);
  t('ammo capped at ' + L.AMMO_CAP, L.pickupApply(p, { type: 'ammo', n: 24 }) && p.ammo === L.AMMO_CAP);
  t('ammo refused at cap', !L.pickupApply(p, { type: 'ammo', n: 24 }));
  t('mats capped at ' + L.MATS_CAP, L.pickupApply(p, { type: 'mats', n: 30 }) && p.mats === L.MATS_CAP);
  t('unknown item type refused', !L.pickupApply(p, { type: 'mystery', n: 1 }));
}

// --- storm circles ---
{
  let containOk = true;
  for (let seed = 1; seed <= 30; seed++) {
    const rng = L.mulberry32(seed);
    const circles = L.computeCircles(rng, L.START_CIRCLE, L.STORM_SCHEDULE);
    if (circles.length !== L.STORM_SCHEDULE.length + 1) containOk = false;
    for (let i = 1; i < circles.length; i++) {
      const prev = circles[i - 1], cur = circles[i];
      if (L.dist(prev.x, prev.y, cur.x, cur.y) + cur.r > prev.r + 1e-6) containOk = false;
    }
  }
  t('every circle nests inside the previous (30 seeds)', containOk);

  const rng = L.mulberry32(11);
  const circles = L.computeCircles(rng, L.START_CIRCLE, L.STORM_SCHEDULE);
  const s0 = L.stormAt(circles, L.STORM_SCHEDULE, 0);
  t('t=0 is a full-size wait phase', s0.mode === 'wait' && s0.r === L.START_CIRCLE.r && near(s0.timeLeft, L.STORM_SCHEDULE[0].wait));

  const mid = L.stormAt(circles, L.STORM_SCHEDULE, L.STORM_SCHEDULE[0].wait + L.STORM_SCHEDULE[0].shrink / 2);
  t('mid-shrink radius is between bounds', mid.mode === 'shrink' && mid.r < L.START_CIRCLE.r && mid.r > L.STORM_SCHEDULE[0].radius);

  let total = 0;
  for (const ph of L.STORM_SCHEDULE) total += ph.wait + ph.shrink;
  const fin = L.stormAt(circles, L.STORM_SCHEDULE, total + 5);
  t('after schedule ends: final mode at last radius', fin.mode === 'final' && near(fin.r, L.STORM_SCHEDULE[L.STORM_SCHEDULE.length - 1].radius));
  t('final storm dps escalates', fin.dps > L.STORM_SCHEDULE[L.STORM_SCHEDULE.length - 1].dps);

  let mono = true, prevR = Infinity;
  for (let tt = 0; tt <= total + 10; tt += 0.5) {
    const s = L.stormAt(circles, L.STORM_SCHEDULE, tt);
    if (s.r > prevR + 1e-9) mono = false;
    prevR = s.r;
  }
  t('radius never grows over time', mono);
}

// --- grid / collision ---
{
  const c = L.worldToCell(130, 200);
  t('worldToCell', c.cx === Math.floor(130 / L.GRID) && c.cy === Math.floor(200 / L.GRID));
  const r = L.cellRect(2, 3);
  t('cellRect roundtrip', r.x === 2 * L.GRID && r.y === 3 * L.GRID && r.w === L.GRID && r.h === L.GRID);
  t('pointInRect inside', L.pointInRect(r.x + 5, r.y + 5, r));
  t('pointInRect outside', !L.pointInRect(r.x - 5, r.y, r));

  const rect = { x: 100, y: 100, w: 64, h: 64 };
  t('no overlap -> null', L.circleRectResolve(50, 50, 10, rect) === null);
  const push = L.circleRectResolve(95, 132, 10, rect); // circle poking the left edge
  t('side overlap pushes out', push !== null);
  if (push) {
    const nx = 95 + push.dx, ny = 132 + push.dy;
    t('after push, no longer overlapping', L.circleRectResolve(nx, ny, 10 - 1e-9, rect) === null);
  }
  const inside = L.circleRectResolve(110, 130, 10, rect); // center inside the rect
  t('center-inside still resolves', inside !== null);
  if (inside) {
    const nx = 110 + inside.dx, ny = 130 + inside.dy;
    t('center-inside push exits the rect', L.circleRectResolve(nx, ny, 10 - 1e-9, rect) === null);
  }
}

// --- config sanity (things the game assumes) ---
t('24-player lobby math: storm schedule non-empty', L.STORM_SCHEDULE.length >= 4);
t('wall cost affordable from one tree', L.WALL_COST <= 12 * 2);
t('all weapons define required fields', Object.values(L.WEAPONS).every((w) => w.damage > 0 && w.rate > 0 && w.pellets >= 1));
t('rarity colors defined for all rarities', L.RARITIES.every((r) => typeof L.RARITY_COLORS[r] === 'string'));
t('rarity multipliers ascend', L.RARITY_MULT.common < L.RARITY_MULT.uncommon && L.RARITY_MULT.uncommon < L.RARITY_MULT.rare && L.RARITY_MULT.rare < L.RARITY_MULT.epic && L.RARITY_MULT.epic < L.RARITY_MULT.legendary);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
