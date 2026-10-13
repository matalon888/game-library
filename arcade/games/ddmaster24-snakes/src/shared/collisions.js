// Authoritative collision rules. Pure functions over snakes/particles.
(function (root) {
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./constants.js') : root;
  const CONSTANTS = C.CONSTANTS;

  function eatParticles(snakes, particles) {
    let eaten = 0;
    const living = snakes.filter((s) => !s.isDead);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      for (const s of living) {
        if (s.head.distance(p.position) < s.radius + p.radius) {
          s.eatParticleValue(p.value);
          particles.splice(i, 1);
          eaten++;
          break;
        }
      }
    }
    return eaten;
  }

  function hitsWorldEdge(snake) {
    const r = snake.radius;
    const x = snake.head.x, y = snake.head.y;
    const W = CONSTANTS.WORLD_SIZE;
    return (x - r <= 30 || x + r >= W - 30 || y - r <= 30 || y + r >= W - 30);
  }

  function hitsSelf(snake) {
    if (snake.length <= 20) return false;
    const head = snake.head;
    const r = snake.radius;
    for (let i = 10; i < snake.body.length; i++) {
      if (head.distance(snake.body[i]) < r * 1.5) return true;
    }
    return false;
  }

  function headHitsBody(headSnake, bodySnake) {
    const head = headSnake.head;
    const r = headSnake.radius;
    for (let i = 5; i < bodySnake.body.length; i++) {
      if (head.distance(bodySnake.body[i]) < r + bodySnake.radius * 0.8) return true;
    }
    return false;
  }

  function resolveSnakeCollisions(snakes) {
    const kills = [];
    const living = snakes.filter((s) => !s.isDead);

    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i], b = living[j];
        if (a.isDead || b.isDead) continue;

        // Head-to-head
        if (a.head.distance(b.head) < a.radius + b.radius) {
          if (a.mass > b.mass) {
            a.eatSnakeMass(b.mass); b.isDead = true;
            kills.push({ deadId: b.id, byName: a.name });
          } else {
            b.eatSnakeMass(a.mass); a.isDead = true;
            kills.push({ deadId: a.id, byName: b.name });
          }
          continue;
        }

        // a head into b body
        if (!a.isDead && headHitsBody(a, b)) {
          a.isDead = true; b.mass += a.mass * 0.3;
          kills.push({ deadId: a.id, byName: b.name });
        }
        // b head into a body
        if (!b.isDead && headHitsBody(b, a)) {
          b.isDead = true; a.mass += b.mass * 0.3;
          kills.push({ deadId: b.id, byName: a.name });
        }
      }
    }
    return kills;
  }

  const api = { eatParticles, resolveSnakeCollisions, hitsWorldEdge, hitsSelf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
