'use strict';
// Development-only control-trajectory search. No teleports or assists in game.
const fs = require('node:fs'), path = require('node:path');
const P = require('../src/physics.js'), L = require('../src/levels.js');
const { create } = require('../tests/headless.cjs');
const DT = 1 / 120;
function simulate(id, values) {
    const l = L.find(l => l.id === id), s = P.ship(...l.start, l.spec);
    let time = 0, hold = 0, hit = 0;
    const [port, turn, startReverse, starboard, stop, timeEnd] = values;
    for (; time < timeEnd; time += DT) {
        s.throttle = time < startReverse ? 4 : time < stop ? -3 : 0;
        const input = { thruster: time < port ? -1 : time >= turn && time < turn + starboard ? 1 : 0, rudder: 0 };
        P.integrate(s, input, P.environmentAt(l, s, time), DT);
        // Navigation costs, not a replacement collision response.
        if (time > timeEnd - 3)
            hold = P.docking(s, l.berth).ready && s.throttle === 0 && Math.abs(s.engine) < .15 ? hold + DT : 0;
    }
    const d = P.docking(s, l.berth), speed = Math.hypot(s.vx, s.vy);
    const cost = (s.x - l.berth.x) ** 2 + (s.y - l.berth.y) ** 2 + 800 * P.wrap(s.a - l.berth.a) ** 2 + 150 * (s.r ** 2) + 20 * Math.max(0, speed - .5) ** 2;
    return { cost, s, time, hold };
}
function minimize(fn, initial, steps, max = 600) {
    let simplex = [initial, ...initial.map((_, i) => initial.map((v, j) => v + (i === j ? steps[i] : 0)))].map(v => ({ v, f: fn(v) }));
    const evalv = v => ({ v, f: fn(v) });
    let n = initial.length;
    for (let k = 0; k < max; k++) {
        simplex.sort((a, b) => a.f - b.f);
        const c = initial.map((_, i) => simplex.slice(0, n).reduce((s, p) => s + p.v[i], 0) / n), worst = simplex[n];
        const reflect = evalv(c.map((v, i) => v + (v - worst.v[i])));
        if (reflect.f < simplex[0].f) {
            const expand = evalv(c.map((v, i) => v + 2 * (reflect.v[i] - v)));
            simplex[n] = expand.f < reflect.f ? expand : reflect;
        }
        else if (reflect.f < simplex[n - 1].f)
            simplex[n] = reflect;
        else {
            const outside = reflect.f < worst.f, target = outside ? reflect : worst, contract = evalv(c.map((v, i) => v + .5 * (target.v[i] - v)));
            if (contract.f < (outside ? reflect.f : worst.f))
                simplex[n] = contract;
            else
                for (let j = 1; j <= n; j++)
                    simplex[j] = evalv(simplex[j].v.map((v, i) => (v + simplex[0].v[i]) / 2));
        }
        if (k > 150 && simplex[0].f < 1e-5)
            break;
    }
    return simplex.sort((a, b) => a.f - b.f)[0];
}
if (require.main === module) {
    const id = 'crosscurrent';
    const fn = v => {
        const [q, t, rev, e, stop, end] = v;
        if (q < 0 || q > 15 || t < q || rev < 30 || rev > 65 || e < 0 || e > 20 || stop < rev + 5 || end < stop + 7 || end > 110)
            return 1e9 + v.reduce((s, x) => s + x * x, 0);
        return simulate(id, v).cost;
    };
    const result = minimize(fn, [6, 49, 50, 7, 66, 77], [1, 4, 3, 1, 2, 2], 450);
    const out = simulate(id, result.v);
    console.log(result, out);
    const [q, t, rev, e, stop, end] = result.v, events = [
        { time: 0, throttle: 4, thruster: -1 }, { time: q, thruster: 0 }, { time: t, thruster: 1 }, { time: t + e, thruster: 0 }, { time: rev, throttle: -3 }, { time: stop, throttle: 0 }
    ].sort((a, b) => a.time - b.time);
    const test = create();
    test.load(L.findIndex(l => l.id === id));
    let index = 0;
    for (let time = 0; time < end + 3 && test.state.status === 'running'; time += DT) {
        while (index < events.length && events[index].time <= time) {
            const ev = events[index++];
            if (ev.throttle !== undefined)
                test.throttle(ev.throttle - test.state.run.ship.throttle);
            if (ev.thruster !== undefined)
                test.state.input.thruster = ev.thruster;
        }
        test.advance(DT);
    }
    console.log('ACTUAL', test.state.status, test.state.run.time, test.state.run.contacts, test.state.run.ship);
    if (test.state.status !== 'complete' || !test.state.run.result.clean)
        throw new Error('Candidate is not a clean completion; the checked-in recording was not changed.');
    fs.writeFileSync(path.join(__dirname, '../tests/exposed-crosscurrent-controls.json'), JSON.stringify({
        level: id, events, duration: end + 3, expectedTime: Math.round(test.state.run.time * 120) / 120,
        description: 'Fixed-time controls only; no repositioning or objective shortcuts.'
    }, null, 2) + '\n');
    console.log('Run npm run replays:sync to update the shipped recording.');
}
module.exports = { simulate, minimize };
