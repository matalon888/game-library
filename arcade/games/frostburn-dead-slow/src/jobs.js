/* Island-service state machine. Pure simulation, shared by game and tests. */
(function (root) {
    'use strict';
    const P = typeof module !== 'undefined' && module.exports ? require('./physics.js') : root.HarborPhysics;
    const VEHICLES = { car: { mass: .115, length: 4.6 }, van: { mass: .18, length: 5.6 }, bus: { mass: .38, length: 8.2 } };
    const COLORS = ['#bf5549', '#ece4c9', '#70a0aa', '#e4b647', '#819365', '#9fabb4'];
    const current = (level, state) => level.jobs?.[state.index] || null;
    const target = (state, id) => state.bodies.find(b => b.id === id);
    function create(level, ship) {
        return {
            index: 0, hold: 0, transfer: 0, transferred: 0, closing: false, ramp: 0, activeRamp: null, baseMass: ship.mass, onboard: [], line: null, notice: '',
            bodies: (level.towables || []).map(t => P.ship(...t.start, {
                dragScale: t.length * t.beam / (28 * 9) * .65, ...t, disabled: true, moored: true, delivered: false, wasTowed: false, throttle: 0
            })),
            stats: {
                vehiclesLoaded: 0, vehiclesDelivered: 0, vesselsDelivered: 0, lineBreaks: 0, lineChanges: 0, winchTime: 0, towDistance: 0, peakTension: 0
            }, towHold: 0
        };
    }
    function canAttach(level, state, ship, obstacles = []) {
        const job = current(level, state), body = job?.type === 'tow' ? target(state, job.target) : null;
        if (!body || body.delivered)
            return { ok: false, message: 'Finish the active island call before taking a tow.' };
        const ends = P.towEndpoints(ship, body), distance = Math.hypot(ends.a.x - ends.b.x, ends.a.y - ends.b.y);
        if (distance > 44)
            return {
                ok: false, message: `Bring your stern within 44 m of ${body.name}’s bow.`, body, distance, ends
            };
        const a = P.pointVelocity(ship, ends.a), b = P.pointVelocity(body, ends.b);
        if (Math.hypot(a.x - b.x, a.y - b.y) > .82)
            return {
                ok: false, message: 'Slow below 1.6 kn relative speed to pass the line.', body, distance, ends
            };
        if (obstacles.some(o => P.segmentHitsPoly(ends.a, ends.b, o.poly || P.rect(o))))
            return {
                ok: false, message: 'There is rock or a closed structure between the towing points.', body, distance, ends
            };
        return { ok: true, body, distance, ends };
    }
    function toggleLine(level, state, ship, obstacles = []) {
        if (state.line) {
            state.line = null;
            state.stats.lineChanges++;
            state.notice = 'Towline released. The other vessel is still moving.';
            return { ok: true, message: state.notice };
        }
        const choice = canAttach(level, state, ship, obstacles);
        if (!choice.ok)
            return choice;
        const body = choice.body;
        body.moored = false;
        body.wasTowed = true;
        state.line = {
            bodyId: body.id, length: P.clamp(choice.distance + 1, 12, 64), min: 12, max: 64, tension: 0, strength: 1.65, overload: 0, chafe: 0
        };
        state.stats.lineChanges++;
        state.notice = `Made fast to ${body.name}. Take up the slack slowly.`;
        return { ok: true, message: state.notice };
    }
    function breakLine(state, message) {
        state.stats.lineBreaks++;
        state.line = null;
        state.notice = message;
        return { type: 'line-break', message };
    }
    function physics(level, state, ship, input, time, dt, obstacles = []) {
        const events = [];
        for (const body of state.bodies) {
            if (body.moored)
                continue;
            const x = body.x, y = body.y;
            let grounded = false;
            if (level.tide && P.tideDepth(level.tide, time) < body.draft)
                grounded = level.tide.areas.some(a => P.sat(P.hull(body), P.rect(a)));
            if (grounded && !body.grounded)
                events.push({ type: 'grounding', body });
            body.grounded = grounded;
            if (grounded)
                body.hull = Math.max(0, body.hull - .45 * dt);
            P.integrate(body, {}, { ...P.environmentAt(level, body, time), grounded }, dt);
            if (body.wasTowed && !body.delivered)
                state.stats.towDistance += Math.hypot(body.x - x, body.y - y);
        }
        const line = state.line;
        if (!line)
            return events;
        const body = target(state, line.bodyId);
        if (!body || body.delivered) {
            state.line = null;
            return events;
        }
        const winch = P.clamp(input.winch || 0, -1, 1), before = line.length;
        line.length = P.clamp(line.length + winch * .85 * dt, line.min, line.max);
        if (line.length !== before)
            state.stats.winchTime += dt;
        const force = P.towForce(ship, body, line, dt);
        line.tension = force.force / line.strength;
        state.stats.peakTension = Math.max(state.stats.peakTension, line.tension);
        line.overload = line.tension > 1 ? line.overload + dt : Math.max(0, line.overload - dt * 2);
        // A taut or slack line cannot be drawn straight through an island.
        line.chafe = obstacles.some(o => P.segmentHitsPoly(force.a, force.b, o.poly || P.rect(o))) ? line.chafe + dt : Math.max(0, line.chafe - dt * 2);
        if (line.overload > .65)
            events.push(breakLine(state, 'Towline parted under load. Slow down and make fast again.'));
        else if (line.chafe > .75)
            events.push(breakLine(state, 'Towline chafed through against a solid obstacle. Both hulls need a clear passage.'));
        return events;
    }
    function updateMass(state, ship) {
        ship.mass = state.baseMass + state.onboard.reduce((sum, v) => sum + v.mass, 0);
    }
    function complete(state, job, events) {
        events.push({ type: 'job', name: job.name });
        state.index++;
        state.hold = 0;
        state.transfer = 0;
        state.transferred = 0;
        state.closing = false;
        state.towHold = 0;
        state.activeRamp = null;
    }
    function update(level, state, ship, dt) {
        const events = [], job = current(level, state);
        if (!job) {
            state.ramp = Math.max(0, state.ramp - dt);
            return events;
        }
        if (job.type === 'tow') {
            const body = target(state, job.target);
            const dock = body && P.docking(body, job, true);
            const ready = body?.wasTowed && !body.grounded && body.hull > 0 && dock.ready;
            state.towHold = ready ? state.towHold + dt : 0;
            if (state.towHold >= (job.hold || 2)) {
                body.moored = true;
                body.delivered = true;
                body.vx = 0;
                body.vy = 0;
                body.r = 0;
                if (state.line?.bodyId === body.id)
                    state.line = null;
                state.stats.vesselsDelivered++;
                complete(state, job, events);
            }
            return events;
        }
        const dock = P.docking(ship, job, true), ready = dock.ready && ship.throttle === 0 && Math.abs(ship.engine) < .15 && !ship.grounded && !state.line;
        const count = job.type === 'load' ? job.vehicles.length : job.count;
        state.hold = ready ? state.hold + dt : 0;
        const open = ready && state.hold >= .8 && !state.closing;
        state.ramp = P.clamp(state.ramp + (open ? dt : -dt) / 1.1, 0, 1);
        state.activeRamp = job;
        if (!open || state.ramp < 1)
            state.transfer = 0;
        else {
            state.transfer += dt;
            if (state.transfer >= 1.05) {
                state.transfer = 0;
                if (job.type === 'load') {
                    if (state.onboard.length >= (ship.capacity || 6)) {
                        state.notice = 'Deck full. Check the manifest.';
                        return events;
                    }
                    const kind = job.vehicles[state.transferred] || 'car', spec = VEHICLES[kind] || VEHICLES.car;
                    state.onboard.push({ kind, ...spec, color: COLORS[state.stats.vehiclesLoaded % COLORS.length], id: state.stats.vehiclesLoaded });
                    state.stats.vehiclesLoaded++;
                }
                else {
                    if (!state.onboard.length) {
                        state.notice = 'No vehicle aboard for this delivery.';
                        return events;
                    }
                    state.onboard.shift();
                    state.stats.vehiclesDelivered++;
                }
                state.transferred++;
                updateMass(state, ship);
                if (state.transferred >= count)
                    state.closing = true;
            }
        }
        if (state.closing && state.ramp <= 0)
            complete(state, job, events);
        return events;
    }
    function ready(level, state) {
        return state.index >= (level.jobs?.length || 0) && state.onboard.length === 0 && !state.line;
    }
    function message(level, state, ship) {
        const job = current(level, state);
        if (!job)
            return 'All island jobs complete. Moor your vessel at the final green berth.';
        if (job.type === 'tow') {
            const b = target(state, job.target);
            if (state.towHold > 0)
                return `${b.name} · securing shore lines ${state.towHold.toFixed(1)} / ${job.hold || 2}s`;
            if (state.line)
                return `${b.name} → rescue berth · ${(state.line.tension * 100).toFixed(0)}% line load · Reel in / Pay out`;
            return `${b.name} · put your stern near her bow, slow down, use Make fast to attach the towline.`;
        }
        const count = job.type === 'load' ? job.vehicles.length : job.count;
        if (state.closing)
            return `${job.name} · ramp closing; ${state.onboard.length} aboard.`;
        if (state.ramp > 0)
            return `${job.name} · ${state.transferred}/${count} transferred · ramp ${state.ramp < 1 ? 'moving' : 'down'}`;
        return `${job.name} · match the amber ramp, stop in neutral; ${state.onboard.length} aboard.`;
    }
    const api = {
        VEHICLES, COLORS, create, current, target, canAttach, toggleLine, physics, update, ready, message, updateMass
    };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HarborJobs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
