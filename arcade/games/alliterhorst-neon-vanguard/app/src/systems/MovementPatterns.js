// Biblioteca de padrões de movimento. Dono: enemy-ai-designer.
// FUNÇÕES PURAS: recebem (tSec, params, ctx) e devolvem um vetor de velocidade {vx, vy}.
// ctx (opcional) traz { x, y, playerX, playerY } para padrões que perseguem.
// Nenhum efeito colateral => testável com Vitest.

/** desce reto */
export function straightDown(tSec, p = {}) {
  return { vx: 0, vy: p.speed ?? 120 };
}

/** zigue-zague horizontal (senoidal) descendo */
export function sine(tSec, p = {}) {
  const amp = p.amp ?? 90;
  const freq = p.freq ?? 3;
  return { vx: Math.cos(tSec * freq) * amp, vy: p.speed ?? 90 };
}

/** entra devagar e mergulha acelerando para baixo */
export function dive(tSec, p = {}) {
  const base = p.speed ?? 70;
  const accel = p.accel ?? 160;
  return { vx: 0, vy: base + tSec * accel };
}

/** desliza para um lado enquanto desce (formação) */
export function strafe(tSec, p = {}) {
  return { vx: (p.dir ?? 1) * (p.amp ?? 70), vy: p.speed ?? 70 };
}

/** parado verticalmente perto do topo (atirador). Mantém posição-alvo. */
export function turret(tSec, p = {}, ctx = {}) {
  const targetY = p.holdY ?? 90;
  const y = ctx.y ?? targetY;
  const vy = y < targetY ? (p.speed ?? 90) : 0;
  return { vx: 0, vy };
}

/** persegue o player no eixo X, sempre MAIS LENTO que ele (regra da bíblia) */
export function hunter(tSec, p = {}, ctx = {}) {
  const speed = p.speed ?? 70;          // < velocidade do player
  const dx = (ctx.playerX ?? ctx.x ?? 0) - (ctx.x ?? 0);
  const vx = Math.sign(dx) * Math.min(Math.abs(dx) * 3, speed);
  return { vx, vy: p.descend ?? 40 };
}

/** kamikaze: trava direção rumo ao player uma vez e acelera */
export function kamikaze(tSec, p = {}, ctx = {}) {
  const speed = (p.speed ?? 120) + tSec * (p.accel ?? 120);
  const dx = (ctx.playerX ?? 0) - (ctx.x ?? 0);
  const dy = (ctx.playerY ?? 640) - (ctx.y ?? 0);
  const len = Math.hypot(dx, dy) || 1;
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}

export const PATTERNS = {
  straightDown, sine, dive, strafe, turret, hunter, kamikaze,
};

/** resolve um padrão pelo nome (usado por dados de fase/inimigo) */
export function getPattern(name) {
  return PATTERNS[name] || straightDown;
}
