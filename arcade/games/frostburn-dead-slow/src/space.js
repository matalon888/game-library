/* Deterministic spacecraft mechanics. No DOM, clocks, audio or water-model calls. */
(function (root) {
    'use strict';
    const P = typeof module !== 'undefined' && module.exports ? require('./physics.js') : root.HarborPhysics;
    const TAU = 2 * Math.PI;
    const BEAM_RANGE = 170;
    const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
    const clone = value => JSON.parse(JSON.stringify(value));

    // Analytic ephemerides keep position, velocity and the drawing on one clock.
    function pose(object, time) {
        const m = object.motion || {}, w = TAU / (m.period || 240), phase = w * time + (m.phase || 0);
        return { ...object,
            x: object.x + (m.vx || 0) * time + (m.ax || 0) * Math.sin(phase),
            y: object.y + (m.vy || 0) * time + (m.ay || 0) * Math.sin(phase),
            a: (object.a || 0) + (m.spin || 0) * time,
            vx: (m.vx || 0) + (m.ax || 0) * w * Math.cos(phase),
            vy: (m.vy || 0) + (m.ay || 0) * w * Math.cos(phase), r: m.spin || 0
        };
    }
    function asteroid(object, time) {
        const b = pose(object, time);
        // The same convex silhouette casts light, collides and is drawn.
        const sides = b.planet ? 64 : 16;
        b.poly = Array.from({ length: sides }, (_, i) => {
            const a = b.a + i * TAU / sides;
            return { x: b.x + Math.cos(a) * b.radius, y: b.y + Math.sin(a) * b.radius };
        });
        return b;
    }
    function shadowAt(point, rocks) {
        return rocks.some(b => point.x > b.x - b.radius && Math.abs(point.y - b.y) <= b.radius &&
            P.segmentHitsPoly({ x: Math.min(-100, b.x - b.radius - 1), y: point.y }, point, b.poly));
    }
    function illumination(ship, rocks) {
        const probes = [...P.hull(ship), { x: ship.x, y: ship.y }];
        return probes.reduce((n, p) => n + (shadowAt(p, rocks) ? 0 : 1), 0) / probes.length;
    }
    function flareState(config, time) {
        if (!config) return { active: false, remaining: Infinity };
        if (config.continuous) return { active: true, remaining: Infinity, continuous: true };
        const phase = ((time + config.offset) % config.period + config.period) % config.period;
        const active = phase >= config.period - config.on;
        return { active, remaining: active ? config.period - phase : config.period - config.on - phase };
    }
    // Forecast physical cover of a whole stationary capture hull, not an unlock
    // timer. Five-second samples are labelled approximate in the flight UI.
    function shelterWindow(level, time, horizon = 1500) {
        const covered = t => {
            const target = pose(level.berth, t);
            const hull = { ...level.spec, ...target, length: level.spec.length, beam: level.spec.beam };
            return illumination(hull, level.space.asteroids.map(b => asteroid(b, t))) === 0;
        };
        let opens = null, closes = null;
        for (let t = time; t <= time + horizon; t += 5) {
            const safe = covered(t);
            if (safe && opens === null) opens = t;
            if (!safe && opens !== null) { closes = t; break; }
        }
        return { opens, closes, sampledAt: time };
    }
    function gates(config) {
        // Legacy single-gate configs remain usable by tools and custom levels.
        return config.chronogates || (config.chrono ? [{ ...config.chrono, id: 'A', destination: config.returnAt, replayLead: 0 }] : []);
    }
    function temporalStep(level, run, input, dt) {
        const st = run.space, cfg = level.space, itinerary = gates(cfg), gate = itinerary[st.phase];
        if (gate) {
            const elapsed = run.time - st.legStarted;
            if (elapsed >= cfg.maxLoop) {
                fail(run, 'temporal-window', 'The current recording window expired. Reach the next chronogate within fifteen minutes.'); return;
            }
            if (run.time >= st.loopAt) {
                const s = run.ship;
                st.loop.push([elapsed, s.x, s.y, s.a, s.vx, s.vy]); st.loopAt += 1 / 30;
            }
            st.capture = dock(run.ship, gate, true, input).ready ? st.capture + dt : 0;
            if (st.capture >= 2) {
                const s = run.ship;
                st.loop.push([elapsed, s.x, s.y, s.a, s.vx, s.vy]);
                st.histories.push({ loop: st.loop, loopDuration: elapsed, start: run.time,
                    lead: gate.replayLead || 0, id: gate.id });
                st.loopDuration = elapsed; st.loopStart = run.time;
                st.phase++; st.stats.jumps++; st.capture = 0;
                // The gate is the only position discontinuity. Preserve velocity,
                // attitude and fuel; never record a line across the jump itself.
                s.x = gate.destination[0]; s.y = gate.destination[1];
                st.legStarted = run.time; st.loopAt = run.time + 1 / 30;
                st.loop = [[0, s.x, s.y, s.a, s.vx, s.vy]];
                emit(st, `Gate ${gate.id} → ${gate.id}′ · ${st.histories.length} solid ${st.histories.length === 1 ? 'history' : 'histories'}`);
            }
        }
        st.echoes = st.histories.map(history => ({
            ...echoAt(history, (run.time - history.start + history.lead) % history.loopDuration), id: history.id
        }));
        st.echo = st.echoes[0] || null; // Read-only presentation compatibility.
        for (const echo of st.echoes) {
            if (P.sat(P.hull(run.ship), P.hull(echo))) {
                fail(run, 'paradox', `You collided with history ${echo.id}. Use a passing bay and let your past self go first.`); return;
            }
        }
    }
    function freeStep(s, dt) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.a = P.wrap(s.a + s.r * dt);
    }
    function integrate(s, state, config, input, dt) {
        const commanded = s.throttle < 0 ? s.throttle / 3 : s.throttle / 4;
        s.engine += P.clamp(commanded - s.engine, -3 * dt, 3 * dt);
        const light = config.solar ? state.light : 1;
        const power = state.inBlackout || state.fuel <= 0 ? 0 : light;
        const main = s.engine * power, side = P.clamp(finite(input.thruster), -1, 1) * power;
        const yaw = P.clamp(finite(input.rudder), -1, 1) * power;
        const mainForce = config.acceleration || .36, sideForce = config.lateral ?? mainForce * .62;
        const request = (Math.abs(main) * mainForce + Math.abs(side) * sideForce + Math.abs(yaw) * .06) * dt;
        const fraction = request > 0 ? Math.min(1, state.fuel / request) : 1;
        const used = request * fraction;
        state.fuel = Math.max(0, state.fuel - used);
        state.stats.fuelUsed += used;
        if (used > 0) state.stats.burnTime += dt;
        s.rudder = yaw * fraction;
        state.firingJets = { main: main * fraction, side: side * fraction, yaw: yaw * fraction };
        const angular = yaw * fraction * .035 / s.mass;
        const mid = s.a + s.r * dt / 2 + angular * dt * dt / 8;
        const ax = fraction * (Math.cos(mid) * main * mainForce - Math.sin(mid) * side * sideForce) / s.mass;
        const ay = fraction * (Math.sin(mid) * main * mainForce + Math.cos(mid) * side * sideForce) / s.mass;
        // Exact constant-acceleration drift per tick. No damping, velocity caps,
        // angle clamp or implicit stabilization; counterjets must remove spin.
        s.x += s.vx * dt + ax * dt * dt / 2;
        s.y += s.vy * dt + ay * dt * dt / 2;
        s.vx += ax * dt; s.vy += ay * dt;
        s.a = P.wrap(s.a + s.r * dt + angular * dt * dt / 2);
        s.r += angular * dt;
    }
    function dock(s, target, ready = true, input = {}) {
        // Relative velocity at the ship's centre includes the cradle's rotation.
        const dx = s.x - target.x, dy = s.y - target.y;
        const relative = { ...s, vx: s.vx - (target.vx || 0) + (target.r || 0) * dy,
            vy: s.vy - (target.vy || 0) - (target.r || 0) * dx, r: s.r - (target.r || 0) };
        const d = P.docking(relative, target, ready);
        const jetsOff = s.throttle === 0 && Math.abs(s.engine) < .02 &&
            Math.abs(input.rudder || 0) < .01 && Math.abs(input.thruster || 0) < .01 && Math.abs(input.winch || 0) < .01;
        d.slow = Math.hypot(relative.vx, relative.vy) <= (target.speed ?? .24) && Math.abs(relative.r) < .012;
        d.relativeSpeed = Math.hypot(relative.vx, relative.vy);
        d.ready = d.inside && d.aligned && d.slow && ready && jetsOff;
        d.jetsOff = jetsOff;
        return d;
    }
    function body(spec, id) {
        return P.ship(spec.x, spec.y, spec.a || 0, {
            id, name: spec.name, vessel: 'space', length: 22, beam: 11, mass: 1, draft: 0, ...spec
        });
    }
    function create(level, ship) {
        const cfg = level.space;
        ship.id = 'active'; ship.vessel = 'space';
        const state = {
            fuel: cfg.fuel, capacity: cfg.capacity, heat: 0, light: 1, inBlackout: false,
            rocks: [], port: pose(level.berth, 0), phase: 0, capture: 0, depotHold: 0,
            refuelled: false, surveyed: false, surveyHold: 0, rescued: false,
            beam: false, beamForce: 0, beamEver: false, rescueHold: 0,
            shots: [], charge: 0, targetHit: false, recoilAt: -100, lastShot: -100,
            loop: [], loopAt: 0, loopDuration: 0, loopStart: 0, echo: null,
            histories: [], echoes: [], legStarted: 0,
            structures: (cfg.station?.blocks || []).map(b => ({ ...b, poly: P.rect(b) })),
            events: [], finalReady: false, activeDock: null,
            firingJets: { main: 0, side: 0, yaw: 0 },
            stats: { fuelUsed: 0, fuelTaken: 0, burnTime: 0, beamTime: 0, shots: 0, hits: 0, captures: 0, jumps: 0 }
        };
        if (cfg.mission === 'time') {
            state.loop = [[0, ship.x, ship.y, ship.a, ship.vx, ship.vy]]; state.loopAt = 1 / 30;
        }
        if (cfg.mother) {
            state.mother = body(cfg.mother, 'mother');
            state.second = body(cfg.second, 'second');
            state.tenders = [];
        }
        if (cfg.friendly) state.friendly = body(cfg.friendly, 'friendly');
        refresh(level, { ship, space: state, time: 0 });
        return state;
    }
    function refresh(level, run) {
        const st = run.space, cfg = level.space, t = run.time;
        st.rocks = cfg.asteroids.map(b => asteroid(b, t));
        st.light = illumination(run.ship, st.rocks);
        st.inBlackout = !!cfg.blackout && !!P.sat(P.hull(run.ship), P.rect(cfg.blackout));
        st.flare = flareState(cfg.flare, t);
        if (cfg.flare?.continuous && (!st.shelterWindow || t >= st.shelterWindow.sampledAt + 5))
            st.shelterWindow = shelterWindow(level, t);
        st.port = pose(level.berth, t);
        if (cfg.landing) {
            const b = st.rocks.find(b => b.id === cfg.landing.asteroid);
            const off = cfg.landing.offset;
            const p = P.localPoint(b, off[0], off[1]);
            st.port = { ...st.port, ...p, a: b.a, vx: b.vx - b.r * (p.y - b.y), vy: b.vy + b.r * (p.x - b.x), r: b.r };
        }
        st.depot = cfg.depot ? pose(cfg.depot, t) : null;
        st.target = cfg.target ? pose(cfg.target, t) : null;
        if (cfg.firing && !st.targetHit) {
            // Iterated intercept includes target ephemeris and inherited ship velocity.
            let flight = Math.hypot(st.target.x - run.ship.x, st.target.y - run.ship.y) / 115;
            let p;
            for (let i = 0; i < 4; i++) {
                p = pose(cfg.target, t + flight);
                flight = Math.hypot(p.x - run.ship.x - run.ship.vx * flight, p.y - run.ship.y - run.ship.vy * flight) / 115;
            }
            st.lead = { x: p.x - run.ship.vx * flight, y: p.y - run.ship.vy * flight };
            st.aim = Math.atan2(st.lead.y - run.ship.y, st.lead.x - run.ship.x);
        }
    }
    function emit(st, name) { st.events.push(name); }
    function ready(st, cfg) {
        return (!cfg.depot || st.refuelled) && (!cfg.survey || st.surveyed) &&
            (!cfg.mother || st.phase === 2) && (!cfg.target || st.targetHit) &&
            (!cfg.friendly || st.rescued && !st.beam) && (cfg.mission !== 'time' || st.phase === gates(cfg).length);
    }
    function captureBerth(st) {
        const mother = st.mother, p = P.localPoint(mother, 0, st.phase === 0 ? -43 : 43);
        return { ...p, a: mother.a, l: 44, w: 25, speed: .2, angle: 7,
            vx: mother.vx - mother.r * (p.y - mother.y), vy: mother.vy + mother.r * (p.x - mother.x), r: mother.r };
    }
    function activeTarget(level, run) {
        const st = run.space, c = level.space;
        if (c.depot && !st.refuelled) return st.depot;
        if (c.mother && st.phase < 2) return captureBerth(st);
        if (c.target && !st.targetHit) return { ...c.firing, a: st.aim };
        if (c.mission === 'time' && st.phase < gates(c).length) return gates(c)[st.phase];
        if (c.friendly && !st.rescued) return c.rescue;
        return st.port;
    }
    function toggleBeam(level, run) {
        const st = run.space;
        if (!st.friendly || st.rescued) return { ok: false, message: 'No unmoored friendly craft to lock.' };
        if (st.beam) { st.beam = false; return { ok: true, message: 'Beam released. Both craft retain their velocity.' }; }
        const s = run.ship, b = st.friendly;
        if (Math.hypot(s.x - b.x, s.y - b.y) > BEAM_RANGE)
            return { ok: false, message: `Close within ${BEAM_RANGE} m to acquire beam lock.` };
        if (st.rocks.some(r => P.segmentHitsPoly(s, b, r.poly)))
            return { ok: false, message: 'Rock obstructs the beam.' };
        if (level.space.depot && !st.refuelled)
            return { ok: false, message: 'Take dispatch fuel before collecting the tender.' };
        st.beam = true;
        return { ok: true, message: 'Beam locked. Use Attract or Repel. Neither removes momentum for free.' };
    }
    function beamPhysics(run, input, dt) {
        const st = run.space, s = run.ship, b = st.friendly;
        st.beamForce = 0;
        if (!st.beam || !b || st.rescued) return;
        const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy);
        if (d > BEAM_RANGE || st.rocks.some(r => P.segmentHitsPoly(s, b, r.poly))) {
            st.beam = false; emit(st, 'Beam lost · range / obstruction'); return;
        }
        const direction = P.clamp(finite(input.winch), -1, 1); // J=-1: pull; K=+1: push.
        if (!direction || d < 1 || st.fuel <= 0 || st.inBlackout) return;
        const impulse = Math.min(.32 * dt * Math.abs(direction), st.fuel);
        st.fuel -= impulse; st.stats.fuelUsed += impulse; st.stats.beamTime += dt; st.beamEver = true;
        const jx = direction * impulse * dx / d, jy = direction * impulse * dy / d;
        b.vx += jx / b.mass; b.vy += jy / b.mass;
        s.vx -= jx / s.mass; s.vy -= jy / s.mass;
        st.beamForce = direction;
    }
    function echoAt(st, elapsed) {
        if (!st.loop.length) return null;
        const t = Math.min(elapsed, st.loopDuration);
        let lo = 0, hi = st.loop.length - 1;
        while (lo + 1 < hi) {
            const mid = (lo + hi) >> 1;
            if (st.loop[mid][0] <= t) lo = mid; else hi = mid;
        }
        const a = st.loop[lo], b = st.loop[hi], u = P.clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1);
        return { x: P.lerp(a[1], b[1], u), y: P.lerp(a[2], b[2], u), a: a[3] + P.wrap(b[3] - a[3]) * u,
            vx: P.lerp(a[4], b[4], u), vy: P.lerp(a[5], b[5], u), r: 0,
            length: 22, beam: 11, name: 'YOUR PAST SELF', vessel: 'space' };
    }
    function outside(level, s) {
        return P.hull(s).some(p => p.x < 0 || p.y < 0 || p.x > level.world[0] || p.y > level.world[1]);
    }
    function fail(run, type, message) { run.failure = { type, message }; }
    function contact(run, s, obstacle) {
        const h = P.contact(s, obstacle);
        if (!h || h.impact < .1) return;
        const key = `${s.id}:${obstacle.id}`;
        if (run.time - (run.lastHits[key] ?? -100) < .8) return;
        run.lastHits[key] = run.time;
        run.contacts++;
        s.hull = Math.max(0, s.hull - .5 - h.impact * h.impact * 5);
        run.effects.push({ x: h.point.x, y: h.point.y, t: run.time });
    }
    function assemble(run, input, dt) {
        const st = run.space;
        if (!st.mother || st.phase === 2) return;
        const target = captureBerth(st), s = run.ship, d = dock(s, target, true, input);
        st.capture = d.ready ? st.capture + dt : 0;
        if (st.capture < 2) return;
        const m = st.mother, total = m.mass + s.mass;
        m.vx = (m.vx * m.mass + s.vx * s.mass) / total;
        m.vy = (m.vy * m.mass + s.vy * s.mass) / total;
        // Terminal docking capture: the collar dissipates the small allowed relative motion.
        s.docked = true; st.tenders.push({ ...s, offset: st.phase === 0 ? -43 : 43 });
        m.mass = total; st.phase++; st.capture = 0; st.stats.captures++;
        emit(st, s.name + ' captured');
        if (st.phase === 1) run.ship = st.second;
        else {
            m.beam = 102; m.throttle = 0; m.engine = 0; m.r = 0;
            run.ship = m; emit(st, 'Waywarden flight control');
        }
        // No impulse or free fuel is granted to the newly selected craft.
        run.ship.throttle = 0; run.ship.engine = 0;
    }
    function gunnery(level, run, input, dt) {
        const st = run.space, cfg = level.space, s = run.ship;
        if (!cfg.target || st.targetHit) return;
        const inBox = P.hull(s).every(p => Math.abs(p.x - cfg.firing.x) < cfg.firing.w / 2 && Math.abs(p.y - cfg.firing.y) < cfg.firing.l / 2);
        const steady = Math.hypot(s.vx, s.vy) < .18 && Math.abs(s.r) < .012 && s.throttle === 0 &&
            Math.abs(s.engine) < .02 && !input.rudder && !input.thruster;
        const aimed = Math.abs(P.wrap(s.a - st.aim)) < .045;
        st.charge = inBox && steady && aimed && st.shots.length === 0 ? st.charge + dt : 0;
        if (st.charge >= 3) {
            const p = P.localPoint(s, s.length / 2 + 2, 0), f = P.axes(s).f;
            st.shots.push({ ...p, vx: s.vx + 115 * f.x, vy: s.vy + 115 * f.y, life: 12 });
            s.vx -= 1.3 * f.x / s.mass; s.vy -= 1.3 * f.y / s.mass;
            st.charge = 0; st.recoilAt = run.time; st.stats.shots++;
            emit(st, 'Cannon fired · recover recoil');
        }
        st.shots = st.shots.filter(shot => {
            const from = { x: shot.x, y: shot.y };
            shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
            if (P.segmentHitsPoly(from, shot, P.hull(st.target))) {
                st.targetHit = true; st.stats.hits++; emit(st, 'Target disabled · return home'); return false;
            }
            if (st.rocks.some(b => P.segmentHitsPoly(from, shot, b.poly))) return false;
            return shot.life > 0;
        });
    }
    function update(level, run, input, dt) {
        const st = run.space, cfg = level.space;
        st.events = [];
        refresh(level, run);
        const moving = run.ship, old = { x: moving.x, y: moving.y };
        integrate(moving, st, cfg, input, dt);
        // Count travel before docking transfers or the physical chronogate jump.
        const travelled = Math.hypot(moving.x - old.x, moving.y - old.y);
        if (st.friendly && !st.rescued) freeStep(st.friendly, dt);
        if (st.mother && st.phase < 2) freeStep(st.mother, dt);
        if (st.second && st.phase === 0) freeStep(st.second, dt);
        beamPhysics(run, input, dt);
        const free = [run.ship];
        if (st.friendly && !st.rescued) free.push(st.friendly);
        if (st.mother && st.phase < 2) free.push(st.mother);
        if (st.second && st.phase === 0) free.push(st.second);
        const attached = st.phase < 2 && st.mother ? st.tenders.map(b => {
            const p = P.localPoint(st.mother, 0, b.offset);
            return { ...b, ...p, a: st.mother.a,
                vx: st.mother.vx - st.mother.r * (p.y - st.mother.y),
                vy: st.mother.vy + st.mother.r * (p.x - st.mother.x), r: st.mother.r };
        }) : [];
        for (const b of attached) if (outside(level, b)) {
            fail(run, 'out-of-sector', 'A docked tender left the navigation sector.'); return;
        }
        for (const s of free) {
            if (outside(level, s)) {
                fail(run, 'out-of-sector', `${s.name} left the navigation sector. No invisible wall will bring it back.`); return;
            }
            // P.contact expects velocity components under x/y, never a body's position.
            for (const b of st.rocks) {
                if (b.planet && P.sat(P.hull(s), b.poly)) {
                    fail(run, 'planet-impact', 'Surface impact on Erebune. There is no landing site here; clear the entire limb.'); return;
                }
                contact(run, s, { id: b.id, poly: b.poly, velocity: { x: b.vx, y: b.vy } });
            }
            for (const block of st.structures) contact(run, s, block);
            if (st.target && !st.targetHit) contact(run, s, { id: 'target-vessel', poly: P.hull(st.target), velocity: { x: st.target.vx, y: st.target.vy } });
            if (s !== st.mother) for (const b of attached) contact(run, s, { id: 'docked-' + b.id, poly: P.hull(b), velocity: { x: b.vx, y: b.vy } });
            if (st.rescued && s !== st.friendly) contact(run, s, { id: 'secured-friendly', poly: P.hull(st.friendly) });
        }
        for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
            const h = P.collideBodies(free[i], free[j]);
            if (h && h.impact > .1 && run.time - (run.lastHits[`pair-${i}-${j}`] ?? -100) > .8) {
                run.lastHits[`pair-${i}-${j}`] = run.time; run.contacts++;
                for (const s of [free[i], free[j]]) s.hull = Math.max(0, s.hull - 1 - h.impact * h.impact * 4);
            }
        }
        if (free.some(s => s.hull <= 0 || outside(level, s))) {
            fail(run, 'hull-loss', 'A spacecraft was lost. Retry the assignment.'); return;
        }
        refresh(level, run);
        if (cfg.flare) {
            st.heat = P.clamp(st.heat + (st.flare.active ? (1 - st.light) * -22 + st.light * 34 : -22) * dt, 0, 100);
            if (st.heat >= 100) { fail(run, 'radiation', 'Direct stellar radiation overwhelmed the shielding. Shelter the entire hull in an asteroid shadow.'); return; }
        }
        if (cfg.depot && !st.refuelled) {
            st.depotHold = dock(run.ship, st.depot, true, input).ready ? st.depotHold + dt : 0;
            if (st.depotHold >= (cfg.depot.hold || 6)) {
                st.stats.fuelTaken += st.capacity - st.fuel; st.fuel = st.capacity;
                st.refuelled = true; emit(st, 'Refuelling complete');
            }
        }
        if (cfg.survey && !st.surveyed) {
            const b = cfg.survey;
            st.surveyHold = Math.hypot(run.ship.x - b.x, run.ship.y - b.y) <= b.r ? st.surveyHold + dt : 0;
            if (st.surveyHold >= (b.hold || 1)) { st.surveyed = true; emit(st, b.name); }
        }
        assemble(run, input, dt);
        gunnery(level, run, input, dt);
        if (st.friendly && !st.rescued) {
            const d = dock({ ...st.friendly, engine: 0, throttle: 0 }, cfg.rescue, st.beamEver);
            st.rescueHold = d.ready ? st.rescueHold + dt : 0;
            if (st.rescueHold >= 2) {
                st.rescued = true; st.beam = false; st.friendly.vx = st.friendly.vy = st.friendly.r = 0;
                st.stats.captures++; emit(st, 'Friendly craft secured');
            }
        }
        if (cfg.mission === 'time') temporalStep(level, run, input, dt);
        const s = run.ship;
        st.finalReady = ready(st, cfg);
        st.activeDock = activeTarget(level, run);
        run.dock = dock(s, st.port, st.finalReady, input);
        run.dockHold = run.dock.ready ? run.dockHold + dt : 0;
        run.distance += travelled;
        run.maxSpeed = Math.max(run.maxSpeed, Math.hypot(s.vx, s.vy));
        run.thrusterTime += Math.abs(input.thruster) * dt;
        return st.events;
    }
    function message(level, run) {
        const st = run.space, cfg = level.space;
        if (run.failure) return run.failure.message;
        if (cfg.depot && !st.refuelled) return `REFUEL · match the amber tanker · ${st.depotHold.toFixed(1)} / ${cfg.depot.hold || 6} s`;
        if (cfg.mother && st.phase < 2) return `ASSEMBLY ${st.phase + 1}/2 · dock ${run.ship.name} at the amber cradle · ${st.capture.toFixed(1)} / 2 s`;
        if (cfg.target && !st.targetHit) return st.shots.length ? 'SHOT IN FLIGHT · recover recoil' : `FIRING SOLUTION · enter box · face lead diamond · steady ${st.charge.toFixed(1)} / 3 s`;
        if (cfg.friendly && !st.rescued) return st.beam ? 'BEAM LOCK · use Attract / Repel · settle the friendly in its green cradle' : 'RESCUE · approach the friendly craft · use Lock beam';
        if (cfg.mission === 'time' && st.phase < gates(cfg).length) {
            const gate = gates(cfg)[st.phase];
            return `CHRONOGATE ${gate.id} → ${gate.id}′ · capture ${st.capture.toFixed(1)}/2 s · ${st.histories.length} repeating histories`;
        }
        if (cfg.survey && !st.surveyed) return `${cfg.survey.name.toUpperCase()} · visit the amber survey circle`;
        if (run.dockHold > 0) return `CAPTURE · all jets off · ${(2 - run.dockHold).toFixed(1)} s`;
        return `DOCK · match the green cradle’s velocity and heading · REL ${run.dock.relativeSpeed.toFixed(2)} m/s`;
    }
    const api = { BEAM_RANGE, pose, asteroid, shadowAt, illumination, flareState, integrate, dock,
        shelterWindow, gates, temporalStep, create, refresh, update, ready, activeTarget, toggleBeam, beamPhysics, echoAt, outside, message, clone };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HarborSpace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
