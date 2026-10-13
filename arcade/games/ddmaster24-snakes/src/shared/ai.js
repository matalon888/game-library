(function (root) {
  const V = (typeof module !== 'undefined' && module.exports) ? require('./vector2.js') : root;
  const R = (typeof module !== 'undefined' && module.exports) ? require('./random.js') : root;
  const C = (typeof module !== 'undefined' && module.exports) ? require('./constants.js') : root;
  const Vector2 = V.Vector2;
  const randomRange = R.randomRange;
  const CONSTANTS = C.CONSTANTS;

  function pickTarget(bot, particles, others) {
    const head = bot.head;
    const skill = bot.skill;
    const W = CONSTANTS.WORLD_SIZE;

    // 1. Avoid own body.
    const safe = bot.radius * 4;
    for (let i = 15; i < bot.body.length; i++) {
      const seg = bot.body[i];
      if (head.distance(seg) < safe * 2) {
        const ang = Math.atan2(head.y - seg.y, head.x - seg.x);
        return { x: head.x + Math.cos(ang) * 400, y: head.y + Math.sin(ang) * 400 };
      }
    }

    // 2. Proactive wall avoidance.
    const wallMargin = 250;
    if (head.x < wallMargin || head.x > W - wallMargin || head.y < wallMargin || head.y > W - wallMargin) {
      return { x: W / 2, y: W / 2 };
    }

    // 3. Flee bigger snakes within a skill-scaled range.
    const fleeRange = 250 + 150 * skill;
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass > bot.mass * 1.15 && head.distance(s.head) < fleeRange) {
        const ang = Math.atan2(head.y - s.head.y, head.x - s.head.x);
        return { x: head.x + Math.cos(ang) * 350, y: head.y + Math.sin(ang) * 350, boost: head.distance(s.head) < fleeRange * 0.5 };
      }
    }

    // 4. Hunt smaller snakes; lead the target.
    const huntRange = 300 + 250 * skill;
    let prey = null, preyDist = Infinity;
    for (const s of others) {
      if (s === bot || s.isDead) continue;
      if (s.mass < bot.mass * 0.75) {
        const d = head.distance(s.head);
        if (d < huntRange && d < preyDist) { prey = s; preyDist = d; }
      }
    }
    if (prey) {
      const lead = Math.min(preyDist, 300) * skill;
      const px = prey.head.x + Math.cos(prey.currentAngle) * lead;
      const py = prey.head.y + Math.sin(prey.currentAngle) * lead;
      return { x: px, y: py, boost: preyDist < huntRange * 0.4 };
    }

    // 5. Nearest food.
    const foodRange = 600 + 200 * skill;
    let food = null, foodDist = Infinity;
    for (const p of particles) {
      const d = head.distance(p.position);
      if (d < foodRange && d < foodDist) { foodDist = d; food = p; }
    }
    if (food) return { x: food.position.x, y: food.position.y };

    // 6. Wander near center.
    const c = W / 2;
    return { x: randomRange(c - 600, c + 600), y: randomRange(c - 600, c + 600) };
  }

  function computeAiAim(bot, particles, allSnakes, dt) {
    if (bot.skill === undefined) bot.skill = 0.6 + Math.random() * 0.4;
    bot.aiChangeTargetTimer += dt;
    if (!bot.targetPosition || bot.aiChangeTargetTimer > bot.aiChangeTargetInterval * (1.5 - bot.skill)) {
      bot.aiChangeTargetTimer = 0;
      const t = pickTarget(bot, particles, allSnakes);
      bot.targetPosition = new Vector2(t.x, t.y);
      bot._wantBoost = !!t.boost;
    }
    return { x: bot.targetPosition.x, y: bot.targetPosition.y, boost: !!bot._wantBoost };
  }

  const api = { computeAiAim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
