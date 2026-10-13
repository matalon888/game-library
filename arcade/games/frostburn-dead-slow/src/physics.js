/* DEAD SLOW · deterministic, metre/second harbor model. No external dependencies. */
(function (root) {
    'use strict';
    const TAU = Math.PI * 2;
    const roundedCap=Array.from({length:7},(_,i)=>{const a=-Math.PI/2+i*Math.PI/6;return [Math.cos(a),Math.sin(a)];});
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const dot = (a, b) => a.x * b.x + a.y * b.y;
    const length = v => Math.hypot(v.x, v.y);
    function ship(x, y, angle = 0, spec = {}) {
        return {
            x, y, a: angle, vx: 0, vy: 0, r: 0, engine: 0, rudder: 0,
            throttle: 0, hull: 100, length: 28, beam: 9, mass: 1,
            draft: 4.6, ...spec
        };
    }
    function axes(s) {
        return { f: { x: Math.cos(s.a), y: Math.sin(s.a) }, n: { x: -Math.sin(s.a), y: Math.cos(s.a) } };
    }
    function localPoint(s, x, y) {
        const c = Math.cos(s.a), n = Math.sin(s.a);
        return { x: s.x + c * x - n * y, y: s.y + n * x + c * y };
    }
    function hull(s, margin = 0) {
        const l = s.length / 2 + margin, b = s.beam / 2 + margin;
        if (s.vessel === 'submarine') {
            // A rounded pressure hull, shared by collision, clearance and chart.
            const points=[],c=Math.cos(s.a),n=Math.sin(s.a);
            for(const sign of [1,-1])for(const [dx,dy] of roundedCap){
                const x=sign*(l-b+b*dx),y=sign*b*dy;
                points.push({x:s.x+c*x-n*y,y:s.y+n*x+c*y});
            }
            return points;
        }
        if (s.vessel === 'iceberg' || s.vessel === 'floe')
            return [[-l,-b*.25],[-l*.72,-b*.85],[-l*.1,-b],[l*.72,-b*.65],[l,b*.1],[l*.58,b*.83],[-l*.23,b],[-l*.9,b*.6]].map(p => localPoint(s,...p));
        if (s.vessel === 'ferry')
            return [[-l, -b * .65], [-l * .8, -b], [l * .8, -b], [l, -b * .65], [l, b * .65], [l * .8, b], [-l * .8, b], [-l, b * .65]].map(p => localPoint(s, ...p));
        return [[-l, -b * .86], [l * .5, -b], [l, 0], [l * .5, b], [-l, b * .86]].map(p => localPoint(s, ...p));
    }
    function box(x, y, w, h, a = 0) {
        const c = Math.cos(a), s = Math.sin(a);
        return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(p => ({ x: x + p[0] * c - p[1] * s, y: y + p[0] * s + p[1] * c }));
    }
    const rect = r => box(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, r.a || 0);
    function bounds(poly) {
        return { minX: Math.min(...poly.map(p => p.x)), maxX: Math.max(...poly.map(p => p.x)), minY: Math.min(...poly.map(p => p.y)), maxY: Math.max(...poly.map(p => p.y)) };
    }
    function sat(a, b) {
        const aa = bounds(a), bb = bounds(b);
        if (aa.maxX <= bb.minX || bb.maxX <= aa.minX || aa.maxY <= bb.minY || bb.maxY <= aa.minY)
            return null;
        let depth = Infinity, normal = null;
        for (const poly of [a, b])
            for (let i = 0; i < poly.length; i++) {
                const p = poly[i], q = poly[(i + 1) % poly.length], dx = q.x - p.x, dy = q.y - p.y, mag = Math.hypot(dx, dy);
                if (mag < 1e-8)
                    continue;
                const n = { x: -dy / mag, y: dx / mag };
                const da = a.map(v => dot(v, n)), db = b.map(v => dot(v, n));
                const amin = Math.min(...da), amax = Math.max(...da), bmin = Math.min(...db), bmax = Math.max(...db);
                if (amax <= bmin || bmax <= amin)
                    return null;
                // Minimum signed separation also works when one polygon contains another.
                const pos = bmax - amin, neg = amax - bmin;
                const d = Math.min(pos, neg), nn = pos < neg ? n : { x: -n.x, y: -n.y };
                if (d < depth) {
                    depth = d;
                    normal = nn;
                }
            }
        return normal ? { depth, normal } : null;
    }
    function contact(s, obstacle) {
        const poly = hull(s), hit = sat(poly, obstacle.poly || rect(obstacle));
        if (!hit)
            return null;
        const n = hit.normal, projections = poly.map(p => dot(p, n)), minimum = Math.min(...projections);
        const supports = poly.filter((p, i) => projections[i] < minimum + .65);
        const p = { x: supports.reduce((v, p) => v + p.x, 0) / supports.length, y: supports.reduce((v, p) => v + p.y, 0) / supports.length };
        const arm = { x: p.x - s.x, y: p.y - s.y };
        const ov = obstacle.velocity || { x: 0, y: 0 };
        const rel = { x: s.vx - s.r * arm.y - ov.x, y: s.vy + s.r * arm.x - ov.y };
        const vn = dot(rel, n), impact = Math.max(0, -vn);
        const invMass = 1 / s.mass, inertia = s.mass * (s.length * s.length + s.beam * s.beam) / 12;
        if (vn < 0) {
            const cross = arm.x * n.y - arm.y * n.x;
            const j = -(1.025) * vn / (invMass + cross * cross / inertia);
            s.vx += j * n.x * invMass;
            s.vy += j * n.y * invMass;
            s.r += j * cross / inertia;
            const tangent = { x: -n.y, y: n.x }, crossT = arm.x * tangent.y - arm.y * tangent.x;
            const vt = dot({ x: s.vx - s.r * arm.y - ov.x, y: s.vy + s.r * arm.x - ov.y }, tangent);
            const jt = clamp(-vt / (invMass + crossT * crossT / inertia), -j * .25, j * .25);
            s.vx += jt * tangent.x * invMass;
            s.vy += jt * tangent.y * invMass;
            s.r += jt * crossT / inertia;
        }
        s.x += n.x * (hit.depth + .002);
        s.y += n.y * (hit.depth + .002);
        return { impact, point: p, normal: n };
    }
    function integrate(s, input, env, dt) {
        const { f, n } = axes(s), current = env.current || { x: 0, y: 0 }, wind = env.wind || { x: 0, y: 0 };
        const water = { x: s.vx - current.x, y: s.vy - current.y };
        const u = dot(water, f), v = dot(water, n);
        const ahead = [0, .12, .35, .65, 1], astern = [0, -.18, -.5, -1];
        const target = s.throttle >= 0 ? ahead[clamp(Math.round(s.throttle), 0, 4)] : astern[clamp(-Math.round(s.throttle), 0, 3)];
        s.engine += (target - s.engine) * (1 - Math.exp(-dt / (Math.sign(target) !== Math.sign(s.engine) ? 3.3 : 2.4)));
        s.rudder += clamp((input.rudder || 0) - s.rudder, -dt * 1.6, dt * 1.6);
        const thruster = (s.disabled || env.propulsionDisabled ? 0 : (input.thruster || 0)) * clamp(1 - Math.abs(u) / 6, .18, 1);
        const thrust = s.disabled || env.propulsionDisabled ? 0 : s.engine * (s.engine >= 0 ? .245 : .185) * (s.propulsion ?? 1);
        const grounded = env.grounded ? 1 : 0;
        const surge = (thrust * (1 - grounded) - (.010 * u + .0063 * u * Math.abs(u)) * (s.dragScale ?? 1)) / s.mass;
        const sway = ((-.21 * v - .095 * v * Math.abs(v)) * (s.dragScale ?? 1) + .053 * thruster * (1 - grounded)) / s.mass;
        s.vx += (f.x * surge + n.x * sway + wind.x / s.mass) * dt;
        s.vy += (f.y * surge + n.y * sway + wind.y / s.mass) * dt;
        // Rudder lift reverses astern; a bow thruster also pushes the bow sideways.
        const rudderLift = (s.disabled ? 0 : .00082) * s.rudder * (u * Math.abs(u) + .35 * Math.max(0, s.engine));
        s.r += (rudderLift + .0055 * thruster - .19 * s.r - .36 * s.r * Math.abs(s.r)) * dt / s.mass;
        if (grounded) {
            const k = Math.exp(-2.8 * dt);
            s.vx *= k;
            s.vy *= k;
            s.r *= k;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.a = wrap(s.a + s.r * dt);
    }
    // Direction is measured from actual ground velocity, never the engine order.
    function groundMotion(s) {
        const { f, n } = axes(s), velocity = { x: s.vx, y: s.vy };
        const speed = length(velocity), surge = dot(velocity, f), sway = dot(velocity, n);
        const direction = speed < .025 ? 'stopped' : Math.abs(surge) < .025 ? 'abeam' : surge < 0 ? 'astern' : 'ahead';
        return {
            speed, surge, sway, direction, signedSpeed: direction === 'astern' ? -speed : speed
        };
    }
    const smoothstep = x => {
        const t = clamp(x, 0, 1);
        return t * t * (3 - 2 * t);
    };
    // A feathered entrance avoids a step change in force at a chart boundary.
    function zoneWeight(z, x, y) {
        const d = Math.min(x - z.x, z.x + z.w - x, y - z.y, z.y + z.h - y);
        return d <= 0 ? 0 : smoothstep(d / (z.feather || 18));
    }
    function fieldAt(level, x, y, time = 0) {
        let cx = level.current?.[0] || 0, cy = level.current?.[1] || 0;
        let wx = level.wind?.[0] || 0, wy = level.wind?.[1] || 0, shelter = 0;
        for (const z of level.currentZones || []) {
            const k = zoneWeight(z, x, y);
            const pulse = z.pulse ? z.pulse.min + (1 - z.pulse.min) * (.5 + .5 * Math.sin(TAU * time / z.pulse.period + (z.pulse.phase || 0))) : 1;
            cx = lerp(cx, z.current[0] * pulse, k);
            cy = lerp(cy, z.current[1] * pulse, k);
        }
        for (const z of level.shelters || []) {
            const k = zoneWeight(z, x, y);
            shelter = Math.max(shelter, k);
            cx *= lerp(1, z.currentScale ?? .04, k);
            cy *= lerp(1, z.currentScale ?? .04, k);
            wx *= lerp(1, z.windScale ?? .12, k);
            wy *= lerp(1, z.windScale ?? .12, k);
        }
        return { current: { x: cx, y: cy }, wind: { x: wx, y: wy }, shelter };
    }
    // Sample along the hull, so entering the lee happens gradually, bow to stern.
    // This changes the water/wind forces; it does NOT erase the ship's inertia.
    function environmentAt(level, s, time = 0) {
        if (!s.length)
            return fieldAt(level, s.x, s.y, time);
        const samples = [[-.4, .25], [0, .5], [.4, .25]];
        const env = { current: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, shelter: 0 };
        for (const [offset, weight] of samples) {
            const p = localPoint(s, s.length * offset, 0), e = fieldAt(level, p.x, p.y, time);
            for (const key of ['current', 'wind']) {
                env[key].x += e[key].x * weight;
                env[key].y += e[key].y * weight;
            }
            env.shelter += e.shelter * weight;
        }
        return env;
    }
    function docking(s, b, objectivesComplete = true) {
        const c = Math.cos(b.a), n = Math.sin(b.a), dx = s.x - b.x, dy = s.y - b.y;
        const along = dx * c + dy * n, across = -dx * n + dy * c, angle = Math.abs(wrap(s.a - b.a));
        const extL = Math.abs(Math.cos(angle)) * s.length / 2 + Math.abs(Math.sin(angle)) * s.beam / 2;
        const extB = Math.abs(Math.sin(angle)) * s.length / 2 + Math.abs(Math.cos(angle)) * s.beam / 2;
        const inside = Math.abs(along) + extL <= b.l / 2 && Math.abs(across) + extB <= b.w / 2;
        const aligned = angle <= (b.angle || 14) * Math.PI / 180;
        const speed = Math.hypot(s.vx, s.vy), slow = speed <= (b.speed || .62) && Math.abs(s.r) < .018;
        return {
            inside, aligned, slow, ready: inside && aligned && slow && objectivesComplete, along, across, angle, speed
        };
    }
    function trafficState(t, time) {
        const dx = t.to[0] - t.from[0], dy = t.to[1] - t.from[1], distance = Math.hypot(dx, dy), duration = distance / t.speed;
        const phase = ((time + (t.offset || 0)) % (2 * duration) + 2 * duration) % (2 * duration), back = phase > duration;
        const k = back ? 2 - phase / duration : phase / duration, sign = back ? -1 : 1;
        return {
            x: lerp(t.from[0], t.to[0], k), y: lerp(t.from[1], t.to[1], k), a: Math.atan2(dy * sign, dx * sign), length: t.length || 21, beam: t.beam || 7, vx: sign * dx / distance * t.speed, vy: sign * dy / distance * t.speed
        };
    }
    function signal(g, time, keys = 0, lock = 'entry', occupied = false) {
        let open = false, until = 0, desired = false;
        if (g.kind === 'lock-in')
            desired = lock === 'entry';
        else if (g.kind === 'lock-out')
            desired = lock === 'exit';
        else if (g.kind === 'key')
            desired = keys >= (g.keys || 1);
        else {
            const phase = ((time + (g.offset || 0)) % g.period + g.period) % g.period;
            desired = phase < g.open && keys >= (g.keys || 0);
            until = phase < g.open ? g.open - phase : g.period - phase;
        }
        open = desired || occupied;
        return { open, desired, held: occupied && !desired, until };
    }
    function tideDepth(tide, time) {
        return tide.mean + tide.amplitude * Math.sin(TAU * time / tide.period + (tide.phase || 0));
    }
    const cross = (a, b) => a.x * b.y - a.y * b.x;
    const inertia = s => s.mass * (s.length * s.length + s.beam * s.beam) / 12;
    function pointVelocity(s, p) {
        return { x: s.vx - s.r * (p.y - s.y), y: s.vy + s.r * (p.x - s.x) };
    }
    function impulseAt(s, p, j) {
        if (s.moored)
            return;
        s.vx += j.x / s.mass;
        s.vy += j.y / s.mass;
        s.r += ((p.x - s.x) * j.y - (p.y - s.y) * j.x) / inertia(s);
    }
    function towEndpoints(a, b) {
        return { a: localPoint(a, -a.length * .46, 0), b: localPoint(b, b.length * .46, 0) };
    }
    // Unilateral, implicit spring-damper: a slack line cannot push either hull.
    // Both ends receive equal/opposite impulses and their own off-centre torque.
    function towForce(a, b, line, dt) {
        const ends = towEndpoints(a, b), dx = ends.b.x - ends.a.x, dy = ends.b.y - ends.a.y, d = Math.hypot(dx, dy);
        const extension = d - line.length;
        if (extension <= 0 || d < 1e-8)
            return { force: 0, distance: d, extension, ...ends };
        const n = { x: dx / d, y: dy / d }, va = pointVelocity(a, ends.a), vb = pointVelocity(b, ends.b);
        const rate = dot({ x: vb.x - va.x, y: vb.y - va.y }, n);
        const aa = { x: ends.a.x - a.x, y: ends.a.y - a.y }, ab = { x: ends.b.x - b.x, y: ends.b.y - b.y };
        const inv = (a.moored ? 0 : 1 / a.mass + cross(aa, n) ** 2 / inertia(a)) + (b.moored ? 0 : 1 / b.mass + cross(ab, n) ** 2 / inertia(b));
        const stiffness = line.stiffness ?? 1.7, damping = line.damping ?? 1.6;
        const force = clamp((stiffness * extension + damping * rate) / (1 + dt * damping * inv + dt * dt * stiffness * inv), 0, (line.strength ?? 1.65) * 1.8);
        const j = { x: n.x * force * dt, y: n.y * force * dt };
        impulseAt(a, ends.a, j);
        impulseAt(b, ends.b, { x: -j.x, y: -j.y });
        return { force, distance: d, extension, ...ends };
    }
    // Convex segment clipping includes a line whose endpoints both lie inside.
    function segmentHitsPoly(a, b, poly) {
        let sign = 0, lo = 0, hi = 1;
        for (let i = 0; i < poly.length; i++)
            sign += cross(poly[i], poly[(i + 1) % poly.length]);
        const orientation = sign >= 0 ? 1 : -1;
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], edge = { x: q.x - p.x, y: q.y - p.y };
            const av = orientation * cross(edge, { x: a.x - p.x, y: a.y - p.y }), bv = orientation * cross(edge, { x: b.x - p.x, y: b.y - p.y });
            if (av < 0 && bv < 0)
                return false;
            if (av < 0)
                lo = Math.max(lo, av / (av - bv));
            else if (bv < 0)
                hi = Math.min(hi, av / (av - bv));
            if (lo > hi)
                return false;
        }
        return true;
    }
    function collideBodies(a, b) {
        const ah = hull(a), bh = hull(b), hit = sat(ah, bh);
        if (!hit)
            return null;
        const n = hit.normal, ma = a.moored ? 0 : 1 / a.mass, mb = b.moored ? 0 : 1 / b.mass;
        if (ma + mb === 0)
            return null;
        const pick = (poly, minimum) => {
            const ds = poly.map(p => dot(p, n)), bound = minimum ? Math.min(...ds) : Math.max(...ds), ps = poly.filter((p, i) => Math.abs(ds[i] - bound) < .65);
            return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
        };
        const ap = pick(ah, true), bp = pick(bh, false), p = { x: (ap.x + bp.x) / 2, y: (ap.y + bp.y) / 2 };
        const va = pointVelocity(a, p), vb = pointVelocity(b, p), vn = dot({ x: va.x - vb.x, y: va.y - vb.y }, n);
        const ca = cross({ x: p.x - a.x, y: p.y - a.y }, n), cb = cross({ x: p.x - b.x, y: p.y - b.y }, n);
        if (vn < 0) {
            const k = -1.025 * vn / (ma + mb + (ma ? ca * ca / inertia(a) : 0) + (mb ? cb * cb / inertia(b) : 0));
            impulseAt(a, p, { x: k * n.x, y: k * n.y });
            impulseAt(b, p, { x: -k * n.x, y: -k * n.y });
        }
        const separation = (hit.depth + .002) / (ma + mb);
        a.x += n.x * separation * ma;
        a.y += n.y * separation * ma;
        b.x -= n.x * separation * mb;
        b.y -= n.y * separation * mb;
        return { impact: Math.max(0, -vn), point: p, normal: n };
    }
    const api = {
        TAU, clamp, lerp, wrap, dot, length, ship, axes, localPoint, hull, box, rect, bounds, sat, contact, integrate, docking, trafficState, signal, tideDepth, groundMotion, smoothstep, zoneWeight, fieldAt, environmentAt, inertia, pointVelocity, impulseAt, towEndpoints, towForce, segmentHitsPoly, collideBodies
    };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HarborPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
