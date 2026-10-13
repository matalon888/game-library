(function () {
    'use strict';
    const B = GerboRampage, G = GerboView, R = Railway, V = RailView;
    const P = HarborPhysics, N = HarborNavigation, J = HarborJobs, X = HarborSpace, LEVELS = HarborLevels, WORLDS = HarborWorlds, $ = id => document.getElementById(id);
    const store = HarborStorage.create({ getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) });
    const audio = HarborAudio.create(), renderer = HarborRenderer.create($('sea'));
    let developer = null;
    const DT = 1 / 120, KNOTS = 1.9438444924406;
    let index = 0, level = LEVELS[0], run, status = 'ready', modal = 'intro', zoom = 1, accumulator = 0, lastFrame = null, lastHud = 0, marathon = null, selectedWorld = 1;
    let toastUntil = 0, focusBeforeModal = null, pressed = new Map(), pointers = new Map(), hiddenAt = 0;
    const input = { rudder: 0, thruster: 0, winch: 0 };
    const railSimulation = RailSimulation.create({railway:R, audio, view:V, finish,
        fail() { status='failed'; clearInput(); audio.tick(null,false); showFailure(); }});
    const simulations = DeadSlowSimulations.registry([
        {id:'marine', create:createMarineState, step:(_run,dt)=>advanceMarine(dt),
            ready:()=>run.buoyIndex===level.buoys.length&&(!level.lock||run.lock.phase==='exit')&&J.ready(level,run.jobs),
            clean:()=>run.contacts===0&&run.wakes===0&&run.groundings===0&&run.jobs.stats.lineBreaks===0},
        {id:'space', create(l) { const state=createMarineState(l); state.space=X.create(l,state.ship);
            state.space.activeDock=X.activeTarget(l,state); state.dock=X.dock(state.ship,state.space.port,false); return state; },
            step:(_run,dt)=>advanceSpace(dt), ready:()=>X.ready(run.space,level.space),
            clean:()=>run.contacts===0&&run.wakes===0&&run.groundings===0&&run.jobs.stats.lineBreaks===0},
        {id:'rolling', create(l) { const state=createMarineState(l); state.rampage=B.create(l,state.ship); return state; },
            step:(_run,dt)=>advanceRampage(dt), ready:()=>B.ready(run), clean:()=>run.rampage.stats.damage===0},
        railSimulation,
        PolarSimulation.create({polar:PaleReach,view:PaleReachView,input,finish,fail(){status='failed';clearInput();audio.tick(run.ship,false);showFailure();}})
    ]);
    let simulation;
    function createMarineState(l) {
        const ship=P.ship(...l.start,l.spec);
        return {ship,jobs:J.create(l,ship),env:P.environmentAt(l,ship,0),
            dock:P.docking(ship,l.berth,false),static:staticObstacles()};
    }
    const format = t => {
        if (!Number.isFinite(t))
            return '—';
        const centis = Math.max(0, Math.floor((t + 1e-7) * 100)), m = Math.floor(centis / 6000), s = Math.floor(centis / 100) % 60, c = centis % 100;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
    };
    const deltaFormat = t => `${t > 0 ? '+' : '−'}${Math.abs(t).toFixed(2)}`;
    let settings = store.data.settings;
    audio.enabled = settings.sound;
    // Keep marine copy intact; shared menus choose flight terminology per mission.
    const wording = (marine, flight) => level.space ? flight : marine;
    function esc(t) {
        return String(t).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function worldOf(l = level) {
        return WORLDS.find(w => w.id === l.campaign);
    }
    function applyTheme() {
        document.body.dataset.theme = level.theme;
        $('world-label').textContent = `WORLD ${level.worldNumber} · ${level.polar ? 'THE PALE REACH' : level.rail ? 'THE LONG GRADE' : level.rampage ? 'GERBOZILLA’S RAMPAGE' : level.space ? 'THE BLACK MERIDIAN' : level.theme === 'night' ? 'NIGHT SHIFT' : level.theme === 'archipelago' ? 'SUMMER SERVICE' : 'DAY WATCH'}`;
    }
    function hasNext() {
        return marathon ? marathon.position + 1 < marathon.route.length : LEVELS[index + 1]?.campaign === level.campaign && !LEVELS[index + 1]?.bonus;
    }
    function raceLabel() {
        return marathon?.name || 'World run';
    }
    function clean() { return simulation.clean(run); }
    function objectiveReady() { return simulation.ready(run); }
    function clearInput() {
        pressed.clear();
        pointers.clear();
        input.rudder = 0;
        input.thruster = 0;
        input.winch = 0;
        document.querySelectorAll('.held').forEach(b => b.classList.remove('held'));
    }
    function readInput() {
        const vals = new Set([...pressed.values(), ...pointers.values()]);
        input.rudder = (vals.has('starboard') || vals.has('rolleast') ? 1 : 0) - (vals.has('port') || vals.has('rollwest') ? 1 : 0);
        input.thruster = (vals.has('bowstarboard') || vals.has('rollsouth') ? 1 : 0) - (vals.has('bowport') || vals.has('rollnorth') ? 1 : 0);
        input.winch = (vals.has('lineout') || vals.has('breathe') ? 1 : 0) - (vals.has('linein') ? 1 : 0);
        for (const b of document.querySelectorAll('[data-hold]'))
            b.classList.toggle('held', vals.has(b.dataset.hold));
    }
    function toast(text, warning = false, duration = 3500) {
        $('toast').textContent = text;
        $('toast').classList.toggle('warning', warning);
        $('toast').classList.add('visible');
        toastUntil = performance.now() + duration;
    }
    function staticObstacles() {
        return [...N.coasts(level), ...level.obstacles.map((r, i) => ({ ...r, id: `pier-${i}` }))]
            .map(r => ({ ...r, poly: r.poly || P.rect(r) }))
            .concat(level.islands.map((island, i) => ({ id: `island-${i}`, poly: island.poly })));
    }
    function checkChartExit() {
        for (const body of [run.ship, ...run.jobs.bodies]) {
            const side = N.exit(level, body);
            if (side) {
                run.failure = { type: 'out-of-bounds', side, vessel: body.name || 'Your ship' };
                status = 'failed';
                clearInput();
                showFailure();
                updateHud();
                return true;
            }
        }
        return false;
    }
    function loadStage(i, start = false) {
        if (!Number.isInteger(i) || !LEVELS[i]) throw new RangeError('This assignment is not playable. Choose an available stage from the world map.');
        index = i;
        level = LEVELS[index];
        selectedWorld = level.worldNumber;
        applyTheme();
        audio.setSpace(!!level.space);
        audio.setRampage(!!level.rampage);
        audio.setRail(!!level.rail);
        clearInput();
        accumulator = 0;
        lastFrame = null;
        zoom = 1;
        $('zoom-btn').textContent = '1×';
        simulation = simulations.forLevel(level);
        const [x,y,a] = level.start;
        run = {
            time:0, contacts:0, wakes:0, groundings:0, grounded:false,
            dockHold:0, buoyIndex:0, buoyHold:0, splits:[], sampleAt:0, trailAt:0,
            ghost:[[0,x,y,a]], trail:[], effects:[], focus:{x,y,a},
            gateStates:{}, lock:{phase:'entry',hold:0,clock:0}, wakeTimers:{}, wakeActive:{}, lastHits:{},
            pausedUsed:false, practiceReason:'', loaded:false, throttleOrders:0, thrusterTime:0,
            distance:0, maxSpeed:0, pb:false, result:null, radarPulse:null,
            ...simulation.create(level)
        };
        HarborSpaceUI.prepare(level);
        G.prepare(level);
        (simulation.prepare || V.prepare)(level, railCommand);
        PaleReachView.prepare(level,convoyCommand,polarAction);
        // An assisted circuit stays assisted at 1× too, before begin() records
        // a departure. Otherwise later individual PBs could leak out of a tour.
        if (marathon?.practice) markPractice('Practice circuit');
        developer?.onLoad();
        toastUntil = 0;
        $('toast').classList.remove('visible');
        document.body.dataset.work = level.jobs.length || level.space || level.rampage ? 'true' : 'false';
        $('ship-name').textContent = run.ship?.name || level.spec?.name || 'MV LONG PAUSE';
        $('work-panel').hidden = !level.jobs.length && !level.space && !level.rampage;
        status = 'ready';
        $('stage-tag').textContent = level.tag;
        $('chart-title').textContent = level.name;
        $('mission-name').textContent = level.name;
        $('brief').textContent = level.brief;
        $('hint').textContent = level.tip;
        $('weather-text').textContent = 'LOCAL SET 0.0 kn';
        updateGates();
        refreshRecords();
        updateHud();
        if (start)
            begin();
        else
            showIntro();
    }
    function begin() {
        if (status === 'running')
            return;
        audio.init();
        status = 'running';
        modal = null;
        $('overlay').hidden = true;
        clearInput();
        accumulator = 0;
        lastFrame = null;
        if (!run.pausedUsed) store.attempt(level.id);
        updateHud();
    }
    function resume() {
        if (status !== 'paused')
            return;
        status = 'running';
        modal = null;
        $('overlay').hidden = true;
        clearInput();
        accumulator = 0;
        lastFrame = null;
        audio.init();
        focusBeforeModal?.blur?.();
        updateHud();
    }
    function markPractice(reason) {
        run.pausedUsed = true;
        run.practiceReason = reason;
        if (marathon)
            marathon.practice = true;
    }
    function pauseForMenu(reason = 'Menu opened during the run') {
        if (status === 'running') {
            markPractice(reason);
            status = 'paused';
            clearInput();
            accumulator = 0;
        }
        audio.tick(run.ship, false);
    }
    function retry() {
        if (marathon && status !== 'complete' && run.time > 0) {
            marathon.total += run.time;
            marathon.sectorTime += run.time;
            marathon.contacts += run.contacts;
            marathon.wakes += run.wakes;
            marathon.groundings += run.groundings;
            marathon.lineBreaks += (run.jobs?.stats.lineBreaks || 0);
            marathon.retries++;
            if (run.pausedUsed)
                marathon.practice = true;
        }
        if (marathon && status === 'complete') {
            marathon = null;
            toast(run.rampage ? 'Restarting this course as an individual run.' : wording('Restarting this harbor as an individual trial.', 'Restarting this sector as an individual flight.'));
        }
        loadStage(index, true);
    }
    function throttle(delta, neutral = false) {
        if (status !== 'running' || run.rampage || !run.ship)
            return;
        const prev = run.ship.throttle;
        run.ship.throttle = neutral ? 0 : P.clamp(prev + delta, -3, 4);
        if (prev !== run.ship.throttle) {
            run.throttleOrders++;
            audio.order();
            updateTelegraph();
        }
    }
    function occupiedByFleet(g) {
        const all = [run.ship, ...run.jobs.bodies];
        if (all.some(s => P.sat(P.hull(s, 3), P.rect(g))))
            return true;
        const rope = run.jobs.line;
        if (rope) {
            const body = J.target(run.jobs, rope.bodyId), ends = P.towEndpoints(run.ship, body);
            return P.segmentHitsPoly(ends.a, ends.b, P.rect(g));
        }
        return false;
    }
    function updateGates() {
        for (const g of level.gates) {
            const old = run.gateStates[g.id];
            const occupied = !!old?.open && occupiedByFleet(g);
            run.gateStates[g.id] = P.signal(g, run.time, run.buoyIndex, run.lock.phase, occupied);
        }
    }
    function hitEvent(body, obstacle, hit) {
        if (!hit)
            return;
        const key = (body.id || 'player') + ':' + obstacle.id;
        if (hit.impact > .19 && run.time - (run.lastHits[key] ?? -100) > .85) {
            run.lastHits[key] = run.time;
            run.contacts++;
            const damage = hit.impact > .30 ? .45 + Math.pow(hit.impact - .2, 2) * 4.6 : 0;
            body.hull = Math.max(0, body.hull - damage);
            run.effects.push({ x: hit.point.x, y: hit.point.y, t: run.time });
            toast((body.id ? body.name + ' · ' : '') + (damage > 1 ? `Hull contact · −${Math.round(damage)}% integrity` : 'Fender contact · clean run lost'), true, 2300);
            audio.impact();
        }
    }
    function collision(obstacle, body = run.ship) {
        if (!body.moored)
            hitEvent(body, obstacle, P.contact(body, obstacle));
    }
    function signal() {
        if (run.polar?.submarine) return false;
        if (run.rampage) return lineAction();
        if (run.rail && R.availability(run.rail,'dispatch').enabled) return railCommand('dispatch');
        if (!run.space) return audio.horn();
        if (status !== 'running') return false;
        const now = performance.now() / 1000;
        if (run.radarPulse && now - run.radarPulse.at < 1.1) return false;
        // Presentation time only: no input event, fuel, clock or scoring changes.
        run.radarPulse = { x: run.ship.x, y: run.ship.y, at: now };
        audio.radar(); // The visual pulse remains available with sound muted/unavailable.
        return true;
    }
    function lineAction() {
        if(run.polar)return polarAction('tow');
        if (!run.jobs) return false;
        if (status !== 'running')
            return;
        if (run.rampage) {
            if (B.shield(run)) { audio.order(); toast('Shield up · three seconds of protection'); }
            updateHud(); return;
        }
        if (run.space) {
            const result = X.toggleBeam(level, run);
            toast(result.message, !result.ok, 4500); updateHud(); return;
        }
        const obstacles = [...run.static, ...level.gates.filter(g => !run.gateStates[g.id].open).map(g => ({ ...g, poly: P.rect(g) }))];
        const result = J.toggleLine(level, run.jobs, run.ship, obstacles);
        toast(result.message, !result.ok, 4500);
        updateHud();
    }
    function addSplit(name) {
        run.splits.push({ name, time: run.time });
        const prev = store.stage(level.id).bestSplits[run.splits.length - 1];
        toast(`${name} · ${format(run.time)}${Number.isFinite(prev) ? ` (${deltaFormat(run.time - prev)} vs PB)` : ''}`);
        audio.checkpoint();
    }
    function railCommand(name, value) {
        if (name === 'help') return showHelp();
        if (name === 'retry') return retry();
        if (status !== 'running' || !run.rail) return false;
        const ok = simulation.command(run,name,value);
        updateHud(); return ok;
    }
    function convoyCommand(id,order) {
        if(status!=='running'||!run.polar)return false;
        const ok=simulation.command(run,id,order);updateHud();return ok;
    }
    function polarAction(name,value) {
        if(status!=='running'||!run.polar)return false;
        const ok=simulation.action(run,name,value);updateHud();return ok;
    }
    function advance(dt) {
        if (status !== 'running')
            return;
        simulation.step(run,dt);
    }
    function advanceMarine(dt) {
        run.time += dt;
        const s = run.ship, oldX = s.x, oldY = s.y;
        let grounded = false;
        if (level.tide && P.tideDepth(level.tide, run.time) < s.draft) {
            const poly = P.hull(s);
            grounded = level.tide.areas.some(a => P.sat(poly, P.rect(a)));
        }
        if (grounded && !run.grounded) {
            run.groundings++;
            toast('Aground. Wait for the tide to restore under-keel clearance.', true, 5000);
            audio.impact();
        }
        run.grounded = grounded;
        if (grounded)
            s.hull = Math.max(0, s.hull - .45 * dt);
        s.grounded = grounded;
        run.env = P.environmentAt(level, s, run.time);
        P.integrate(s, input, { ...run.env, grounded, propulsionDisabled: run.jobs.ramp > .01 }, dt);
        updateGates();
        const obstacles = [...run.static];
        for (const g of level.gates)
            if (!run.gateStates[g.id].open)
                obstacles.push({ ...g, poly: P.rect(g) });
        for (const event of J.physics(level, run.jobs, s, input, run.time, dt, obstacles)) {
            if (event.type === 'line-break') {
                toast(event.message, true, 5500);
                audio.impact();
            }
            if (event.type === 'grounding') {
                run.groundings++;
                toast(event.body.name + ' is aground.', true, 4500);
            }
        }
        if (checkChartExit()) return;
        for (const t of level.traffic) {
            const f = P.trafficState(t, run.time);
            obstacles.push({ id: t.id, poly: P.hull(f), velocity: { x: f.vx, y: f.vy } });
        }
        // Two position/impulse sweeps prevent corner leaks without large time steps.
        for (let sweep = 0; sweep < 2; sweep++) {
            for (const o of obstacles) {
                collision(o);
                for (const body of run.jobs.bodies)
                    collision(o, body);
            }
            const fleet = [s, ...run.jobs.bodies];
            for (let a = 0; a < fleet.length; a++)
                for (let b = a + 1; b < fleet.length; b++) {
                    const hit = P.collideBodies(fleet[a], fleet[b]);
                    if (hit) {
                        hitEvent(fleet[a], { id: fleet[b].id || 'player' }, hit);
                        if (!fleet[b].moored && hit.impact > .3)
                            fleet[b].hull = Math.max(0, fleet[b].hull - .45 - (hit.impact - .2) ** 2 * 4.6);
                    }
                }
        }
        if (checkChartExit()) return;
        const speed = Math.hypot(s.vx, s.vy);
        run.maxSpeed = Math.max(run.maxSpeed, speed);
        run.distance += Math.hypot(s.x - oldX, s.y - oldY);
        run.thrusterTime += Math.abs(input.thruster) * dt;
        for (let i = 0; i < level.speedZones.length; i++) {
            const z = level.speedZones[i], inside = !!P.sat(P.hull(s), P.rect(z)), over = inside && speed > z.limit + .04;
            run.wakeTimers[i] = over ? (run.wakeTimers[i] || 0) + dt : 0;
            if (run.wakeTimers[i] > .4 && !run.wakeActive[i]) {
                run.wakeActive[i] = true;
                run.wakes++;
                toast('Wake violation · overall clock unchanged; clean run lost.', true, 3800);
            }
            if (!over)
                run.wakeActive[i] = false;
        }
        const b = level.buoys[run.buoyIndex];
        if (b) {
            const inZone = Math.hypot(s.x - b.x, s.y - b.y) <= b.r, slow = b.speed === undefined || speed <= b.speed;
            run.buoyHold = inZone && slow ? run.buoyHold + dt : 0;
            if (run.buoyHold >= (b.hold || dt)) {
                run.buoyIndex++;
                run.buoyHold = 0;
                if (b.cargo) {
                    run.loaded = true;
                    s.mass = b.mass || 1.8;
                }
                addSplit(b.cargo ? 'Cargo aboard · mass increased' : b.name);
            }
        }
        if (level.lock) {
            const z = level.lock;
            if (run.lock.phase === 'entry') {
                const inside = P.hull(s).every(p => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
                run.lock.hold = inside && speed < .4 && s.throttle === 0 ? run.lock.hold + dt : 0;
                if (run.lock.hold >= z.hold) {
                    run.lock.phase = 'cycling';
                    run.lock.clock = 0;
                    addSplit('Chamber secured');
                }
            }
            else if (run.lock.phase === 'cycling') {
                run.lock.clock += dt;
                if (run.lock.clock >= z.cycle) {
                    run.lock.phase = 'exit';
                    addSplit('Lock equalized');
                }
            }
        }
        for (const event of J.update(level, run.jobs, s, dt))
            if (event.type === 'job')
                addSplit(event.name);
        run.dock = P.docking(s, level.berth, objectiveReady());
        const neutral = s.throttle === 0 && Math.abs(s.engine) < .15;
        run.dock.ready = run.dock.ready && neutral && !grounded;
        run.dockHold = run.dock.ready ? run.dockHold + dt : 0;
        if (run.time >= run.sampleAt) {
            run.sampleAt += level.worldNumber === 3 ? .2 : .1;
            if (run.ghost.length < 12000)
                run.ghost.push([Math.round(run.time * 1000) / 1000, Math.round(s.x * 100) / 100, Math.round(s.y * 100) / 100, Math.round(s.a * 10000) / 10000]);
        }
        if (run.time >= run.trailAt) {
            run.trailAt += .22;
            run.trail.push(P.localPoint(s, -s.length * .51, 0));
            if (run.trail.length > 58)
                run.trail.shift();
        }
        run.effects = run.effects.filter(e => run.time - e.t < 1);
        if (s.hull <= 0 || run.jobs.bodies.some(b => b.hull <= 0)) {
            status = 'failed';
            clearInput();
            showFailure();
            return;
        }
        if (run.dockHold >= 2) {
            finish();
        }
    }
    function advanceRampage(dt) {
        run.time += dt;
        const damage = run.rampage.stats.damage;
        for (const name of B.update(level, run, input, dt)) addSplit(name);
        if (run.rampage.stats.damage > damage) audio.impact();
        if (run.failure) { status = 'failed'; clearInput(); showFailure(); updateHud(); return; }
        if (run.time >= run.sampleAt) {
            run.sampleAt += .2;
            if (run.ghost.length < 12000) run.ghost.push([run.time, run.ship.x, run.ship.y, run.ship.a]);
        }
        if (run.dockHold >= 2) finish();
    }
    function advanceSpace(dt) {
        run.time += dt;
        const contacts = run.contacts;
        const events = X.update(level, run, input, dt) || [];
        if (run.contacts > contacts) audio.impact();
        for (const name of events) addSplit(name);
        run.effects = run.effects.filter(e => run.time - e.t < 1);
        if (run.failure) {
            status = 'failed'; clearInput(); showFailure(); updateHud(); return;
        }
        const s = run.ship;
        if (run.time >= run.sampleAt) {
            run.sampleAt += level.space.century ? 1 : .2;
            if (run.ghost.length < 12000) run.ghost.push([Math.round(run.time * 1000) / 1000, s.x, s.y, s.a]);
        }
        if (run.dockHold >= 2) finish();
    }
    function finish() {
        status = 'complete';
        clearInput();
        run.dockHold = 2;
        const result = {
            time: Math.round(run.time * 120) / 120, contacts: run.contacts, wakes: run.wakes, groundings: run.groundings, clean: clean(), hull: Math.round(run.ship?.hull ?? 100), commands: run.throttleOrders, thruster: Math.round(run.thrusterTime * 10) / 10, distance: Math.round(run.distance), work: { ...run.jobs?.stats }, space: run.space ? { ...run.space.stats } : undefined, rampage: run.rampage ? { ...run.rampage.stats } : undefined, lineBreaks: run.jobs?.stats.lineBreaks || 0, date: new Date().toISOString()
        };
        Object.assign(result,simulation.result?.(run));
        run.result = result;
        if (!run.pausedUsed)
            run.pb = store.record(level.id, result, run.ghost, run.splits.map(s => s.time));
        if (marathon) {
            marathon.total += run.time;
            marathon.contacts += run.contacts;
            marathon.wakes += run.wakes;
            marathon.groundings += run.groundings;
            marathon.lineBreaks += (run.jobs?.stats.lineBreaks || 0);
            marathon.splits.push({ name: level.name, time: marathon.total, sector: marathon.sectorTime + run.time });
            marathon.sectorTime = 0;
            marathon.stages++;
            if (run.pausedUsed)
                marathon.practice = true;
            if (!hasNext() && !marathon.practice) {
                const m = {
                    time: marathon.total, contacts: marathon.contacts, wakes: marathon.wakes, groundings: marathon.groundings, clean: marathon.contacts === 0 && marathon.wakes === 0 && marathon.groundings === 0 && marathon.lineBreaks === 0, lineBreaks: marathon.lineBreaks, retries: marathon.retries, date: result.date
                };
                store.recordRace(marathon.id, { ...m, stages: marathon.stages });
            }
        }
        refreshRecords();
        audio.success();
        showResult();
        updateHud();
    }
    function refreshRecords() {
        const overall = store.best(level.id), cleanRun = store.best(level.id, true);
        $('best-overall').textContent = overall ? format(overall.time) : '—';
        $('best-clean').textContent = cleanRun ? format(cleanRun.time) : '—';
    }
    function nextHarbor() {
        if (status !== 'complete') return;
        if (hasNext()) {
            if (marathon) {
                marathon.position++;
                loadStage(marathon.route[marathon.position], true);
            }
            else
                loadStage(index + 1);
        }
        else {
            marathon = null;
            showCourses();
        }
    }
    function openDialog(type, html, wide = false) {
        if(type==='log')html+=revisionArchives();
        if(['log','result'].includes(type)&&!store.available&&!html.includes('storage-warning'))html+='<div class="storage-warning">Persistent storage is unavailable. Export your logbook to preserve these records.</div>';
        focusBeforeModal = document.activeElement;
        modal = type;
        $('dialog').dataset.theme = level.theme;
        $('dialog').classList.toggle('wide', wide);
        $('dialog').innerHTML = html + (html.includes('class="support-link"') ? '' : '<p class="support-link">Found a bug? <a href="https://github.com/frostburn/dead-slow/issues/" target="_blank" rel="noopener noreferrer">Report it on GitHub</a>. Feature requests welcome too!</p>');
        $('overlay').hidden = false;
        clearInput();
        requestAnimationFrame(() => {
            $('dialog').querySelector('[autofocus]')?.focus({ preventScroll: true });
        });
    }
    function topModal(title, eyebrow = wording('DEAD SLOW · HARBOR AUTHORITY', 'MERIDIAN FLIGHT AUTHORITY')) {
        return `<div class="modal-top"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button data-action="back" aria-label="Close dialog">×</button></div>`;
    }
    function showIntro() {
        if (simulation.dialog) return openDialog('intro', simulation.dialog('intro', level, run, format));
        if (level.rampage) return openDialog('intro', G.dialog('intro', level, run, format));
        if (level.space) {
            openDialog('intro', `<div class="eyebrow">WORLD 6 · THE BLACK MERIDIAN · ${level.bonus ? 'BONUS / OUTSIDE MARATHONS' : level.stageNumber + ' / 12'}</div><h1>${level.name}</h1><p>${level.brief}</p><div class="intro-details"><div><strong>${run.ship.length} m</strong><span>${esc(run.ship.name)}</span></div><div><strong>${level.space.fuel} Δv</strong><span>INITIAL PROPELLANT</span></div><div><strong>02 sec</strong><span>RELATIVE CAPTURE HOLD</span></div></div><p class="subtle">${level.tip}</p><div class="control-summary"><span class="keyboard-only"><kbd>W</kbd><kbd>S</kbd> fore/aft thrust · <kbd>Space</kbd> cut thrust<br><kbd>A</kbd><kbd>D</kbd> rotational jets · <kbd>Q</kbd><kbd>E</kbd> sideways jets<br>${level.space.friendly ? '<kbd>F</kbd> lock / release beam · hold <kbd>J</kbd> attract / <kbd>K</kbd> repel<br>' : ''}</span>Counterfire to stop rotation. Cutting thrust does not brake. Touch controls support simultaneous holds.</div><p class="subtle">Keep every free spacecraft inside the navigation sector. Space is open; the assignment is not infinite.</p><div class="dialog-actions"><button class="primary" data-action="begin" autofocus>Release clamps →</button><button data-action="courses">Choose sector</button><button data-action="help">Flight manual</button></div>`);
            return;
        }
        const first = index === 0;
        openDialog('intro', `
 <div class="eyebrow">WORLD ${level.worldNumber} · ${worldOf().name.toUpperCase()} · ${String(level.stageNumber).padStart(2, '0')} / 12</div><h1>${first ? 'Good ships.<br>Bad stopping distances.' : level.name}</h1>
 <p>${level.brief}</p><div class="intro-details"><div><strong>${run.ship.length} m</strong><span>${esc(run.ship.name || 'MV LONG PAUSE')}</span></div><div><strong>${String(level.stageNumber).padStart(2, '0')} / 12</strong><span>WORLD ${level.worldNumber} HARBOR</span></div><div><strong>02 sec</strong><span>NEUTRAL MOORING HOLD</span></div></div>
 <p class="subtle">${level.tip}</p>
 <p class="subtle">${level.worldNumber === 3 ? "Open water on every side." : "The western fairway is open water."} Keep every hull on the chart: crossing an edge ends the attempt.</p>
 <div class="control-summary"><span class="keyboard-only"><kbd>W</kbd><kbd>S</kbd> change throttle · <kbd>A</kbd><kbd>D</kbd> hold rudder<br><kbd>Q</kbd><kbd>E</kbd> hold bow thruster · <kbd>Space</kbd> neutral · <kbd>Shift+R</kbd> retry<br>${level.towables.length ? '<kbd>F</kbd> make / release towline · <kbd>J</kbd><kbd>K</kbd> hold winch<br>' : ''}</span>Touch helm below. The engine telegraph stays where you leave it.</div>
 <div class="dialog-actions"><button class="primary" data-action="begin" autofocus>Cast off <span aria-hidden="true">→</span></button><button data-action="courses">Choose harbor</button><button class="secondary small" data-action="help">How to dock</button></div>
 <p class="subtle" style="margin:16px 0 0">No installs. No accounts. Records stay in this browser.</p>${!store.available ? '<div class="storage-warning">Browser storage is unavailable. Records will last for this session only; export them from the logbook.</div>' : ''}`);
    }
    function showPause(reason = wording('The harbor can wait.', 'Flight control on standby.')) {
        pauseForMenu();
        if (simulation.dialog) return openDialog('pause', simulation.dialog('pause', level, run, format));
        if (level.rampage) return openDialog('pause', G.dialog('pause', level, run, format));
        openDialog('pause', `
 <div class="eyebrow">PAUSED · PRACTICE RUN</div><h1>${reason}</h1><p>${wording('Your ship and the harbor clock are stopped.', 'Your spacecraft and the mission clock are suspended.')} This attempt is now practice and will not overwrite your records. A retry starts a record-eligible attempt.</p>
 <div class="result-time">${format(run.time)}</div><div class="dialog-actions"><button class="primary" data-action="resume" autofocus>Resume practice</button><button data-action="retry">Retry fresh<span class="key-hint"> · Shift+R</span></button><button class="secondary" data-action="courses">${wording("Harbors", "Sectors")}</button></div>`);
    }
    function completionActions() {
        const next=hasNext(),label=level.rail||level.polar?'Next assignment →':level.rampage?'Next course →':run.space?'Next sector →':'Next harbor →';
        return `<div class="dialog-actions"><button class="primary" data-action="${next?'next':'courses'}" autofocus>${next?label:'World map'}</button><button data-action="retry">Retry<span class="key-hint"> · Shift+R</span></button><button class="secondary small" data-action="log">Logbook</button>${next?'<button class="secondary small" data-action="courses">World map</button>':''}</div>`;
    }
    function runComparison(runs,filter) {
        const rows=runs.filter(r=>filter!=='clean'||r.clean).slice(0,10);
        return `<div class="dialog-actions"><button class="${filter==='overall'?'primary':'secondary'} small" data-filter="overall">Overall</button><button class="${filter==='clean'?'primary':'secondary'} small" data-filter="clean">Clean only</button></div>
            <table class="log-table run-comparison"><thead><tr><th>#</th><th>TIME / IGT</th><th>${level.rampage?'DAMAGE EVENTS':'CONTACTS'}</th><th>CLASS</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${format(r.time)}</td><td>${r.contacts}</td><td class="${r.clean?'clean':''}">${r.clean?'CLEAN':'OPEN'}</td></tr>`).join(''):'<tr><td colspan="4">No ranked runs in this category yet.</td></tr>'}</tbody></table>`;
    }
    function showResult() {
        const r = run.result;
        if (r && simulation.dialog) return openDialog('result', simulation.dialog('result', level, run, format, hasNext(), marathon, completionActions()));
        if (r && run.rampage) return openDialog('result', G.dialog('result', level, run, format, [], settings, null, {...fieldContext(),completionActions:completionActions()}));
        if (!r)
            return;
        const rank = r.time <= level.pace[0] ? 'GOLD PACE' : r.time <= level.pace[1] ? 'SILVER PACE' : r.time <= level.pace[2] ? 'BRONZE PACE' : wording('SAFELY MOORED', 'CAPTURE SECURED');
        const marathonDone = marathon && !hasNext();
        openDialog('result', `<div class="eyebrow">${run.pausedUsed ? 'PRACTICE COMPLETE' : run.pb ? 'NEW PERSONAL BEST' : wording('LINES ASHORE', 'CAPTURE CONFIRMED')} · ${level.name.toUpperCase()}</div>
 <h1>${marathonDone ? (marathon.id === 'grand-tour' ? 'Seven worlds. Every load home.' : wording('One world. All fast.', 'Twelve sectors. Mission complete.')) : run.space ? 'Capture confirmed.' : 'All fast. At last.'}</h1><div class="result-badge">${run.pausedUsed ? 'UNRANKED PRACTICE' : rank}${r.clean ? ' · CLEAN' : ''}</div><div class="result-time">${format(r.time)}</div>
 <p class="subtle">${run.pausedUsed ? esc(run.practiceReason || 'Practice attempt') + '. This time was not saved to the leaderboards.' : run.pb ? wording('Your new best line is saved as the ghost for this harbor.', 'Your best flight is saved as the ghost for this sector.') : wording('A harbor conquered. A braking point learned.', 'Rendezvous complete. Counterburn mastered.')}</p>
 <div class="result-grid"><div><strong>${r.contacts}</strong><span>HULL CONTACTS</span></div><div><strong>${r.hull}%</strong><span>HULL REMAINING</span></div><div><strong>${r.commands}</strong><span>ENGINE ORDERS</span></div></div>
 <p class="subtle">${r.space ? `${r.distance} m traveled · ${r.space.fuelUsed.toFixed(2)} Δv propellant used · ${r.space.shots} shots · ${r.space.captures} captures<br>Clean = no hull contacts. Moving cradles require relative rest, not absolute rest.` : `${r.distance} m traveled · ${r.thruster.toFixed(1)} s bow thrust · ${r.wakes} wake violations · ${r.groundings} groundings<br>Clean = no contacts, wake violations, grounding or parted towlines.`}</p>
 ${run.space ? `<div class="work-summary">${r.space.fuelUsed.toFixed(2)} Δv propellant expended · ${r.space.burnTime.toFixed(1)} s burning<br>${r.space.shots} shots · ${r.space.hits} hits · ${r.space.captures} captures · ${r.space.jumps} temporal insertions</div>` : ''}
 ${level.jobs.length ? `<div class="work-summary">${r.work.vehiclesDelivered} vehicles delivered · ${r.work.vesselsDelivered} vessels secured · ${r.work.lineBreaks} lines parted<br>${Math.round(r.work.towDistance)} m towed · ${r.work.lineChanges} line operations · ${r.work.winchTime.toFixed(1)} s winch</div>` : ''}
 ${marathon ? `<div class="race-banner">${esc(raceLabel().toUpperCase())} ${marathon.stages}/${marathon.route.length} · ${format(marathon.total)} · ${marathon.retries} retries${marathon.practice ? ' · PRACTICE' : ''}</div>` : ''}
 ${completionActions()}
 ${!store.available ? '<div class="storage-warning">Save failed: export your logbook to keep these records.</div>' : ''}`);
    }
    function showFailure() {
        if (simulation.dialog) return openDialog('failed', simulation.dialog('failed', level, run, format));
        audio.tick(run.ship, false);
        if (run.rampage) return openDialog('failed', G.dialog('failed', level, run, format));
        if (run.space) {
            openDialog('failed', `<div class="eyebrow">${esc((run.failure?.type || 'FLIGHT LOST').toUpperCase())}</div><h1>${run.failure?.type === 'paradox' ? 'Two captains.<br>One contradiction.' : 'Flight terminated.'}</h1><p>${esc(run.failure?.message || 'The spacecraft was lost.')}</p><div class="result-time">${format(run.time)}</div><p class="subtle">Failed attempts do not enter the leaderboard. Retry resets every ephemeris and timeline.</p><div class="dialog-actions"><button class="primary" data-action="retry" autofocus>Retry<span class="key-hint"> · Shift+R</span></button><button data-action="courses">Choose sector</button></div>`); return;
        }
        if (run.failure?.type === 'out-of-bounds') {
            const f = run.failure;
            openDialog('failed', `<div class="eyebrow">OUT OF BOUNDS · ${N.NAMES[f.side].toUpperCase()} EDGE</div><h1>Beyond the chart.</h1><p>${esc(f.vessel)} crossed the ${N.NAMES[f.side]} limit of the assignment. The sea is open, but this watch is over. Keep the whole hull—and any tow—inside the chart.</p><div class="result-time">${format(run.time)}</div><p class="subtle">No invisible wall, no bounce. Failed attempts never enter the leaderboard.</p><div class="dialog-actions"><button class="primary" data-action="retry" autofocus>Retry<span class="key-hint"> · Shift+R</span></button><button data-action="courses">Choose harbor</button></div>`);
            return;
        }
        openDialog('failed', `<div class="eyebrow">HULL INTEGRITY LOST</div><h1>The paperwork<br>will be substantial.</h1><p>The ship can take a gentle fender touch, but not a full-speed argument with concrete. Use opposite thrust earlier.</p><div class="result-time">${format(run.time)}</div><p class="subtle">${run.contacts} contacts · ${run.groundings} groundings. Failed attempts never enter the stage leaderboard.</p><div class="dialog-actions"><button class="primary" data-action="retry" autofocus>Retry<span class="key-hint"> · Shift+R</span></button><button data-action="courses">Choose harbor</button></div>`);
    }
    function showCourses(world = selectedWorld) {
        if (typeof world !== 'number')
            world = selectedWorld;
        selectedWorld = P.clamp(Math.round(world) || 1, 1, WORLDS.length);
        pauseForMenu();
        const w = WORLDS[selectedWorld - 1], stages = w.stages || LEVELS.filter(l => l.campaign === w.id);
        const sectors = stages.filter(l => !l.bonus && !l.comingSoon), bonuses = stages.filter(l => l.bonus);
        const arrivals = sectors.filter(l => store.best(l.id)).length;
        const bonusArrivals = bonuses.filter(l => store.best(l.id)).length;
        openDialog('courses', `${topModal(w.name, `WORLD ${w.number} · ${w.subtitle}`)}
 <div class="world-tabs" role="tablist" aria-label="Select world">${WORLDS.map(v => `<button role="tab" aria-selected="${v.number === selectedWorld}" class="world-tab ${v.comingSoon ? 'coming-soon' : ''} ${v.number === selectedWorld ? 'active' : ''}" data-world="${v.number}"><span>WORLD ${v.number}</span><strong>${v.name}</strong><small>${v.subtitle}</small></button>`).join('')}</div>
 <p>${w.description}</p><div class="world-progress">${w.comingSoon ? '<span>12 PLANNED ASSIGNMENTS · COMING SOON</span><span>NOT YET PLAYABLE</span>' : `<span>${arrivals} / ${sectors.length} ${w.theme === 'polar' ? 'ASSIGNMENTS COMPLETE' : w.theme === 'rail' ? 'DELIVERIES COMPLETE' : w.theme === 'rampage' ? 'COURSES COMPLETE' : w.theme === 'space' ? 'SECTORS CLEARED' : 'HARBORS MOORED'}</span>${bonuses.length ? `<span>${bonusArrivals} / ${bonuses.length} BONUS CLEARED</span>` : ''}<span>${w.partial ? sectors.length+' OF 12 AVAILABLE' : 'ALL STAGES AVAILABLE'}</span>`}</div>
 ${marathon ? '<p class="subtle">Selecting an assignment starts an individual trial and ends your current circuit.</p>' : ''}
 <div class="level-grid">${stages.map(l => {
            if (l.comingSoon) return `<button class="level-card coming-soon" disabled aria-disabled="true"><span class="number">W${l.worldNumber} · ${String(l.stageNumber).padStart(2,'0')}</span><span class="name">${esc(l.name)}</span><span class="kind">Planned assignment</span><span class="pb">COMING SOON</span></button>`;
            const i = LEVELS.indexOf(l), b = store.best(l.id);
            return `<button class="level-card ${i === index ? 'selected' : ''}" data-stage="${i}"><span class="number">W${l.worldNumber} · ${l.bonus ? 'BONUS' : (l.polar ? 'ASSIGNMENT ' : l.rail ? 'FREIGHT ' : l.rampage ? 'COURSE ' : l.space ? 'SECTOR ' : 'HARBOR ') + String(l.stageNumber).padStart(2, '0')}${store.best(l.id, true) ? ' · CLEAN' : ''}</span><span class="name">${l.name}</span><span class="kind">${l.kind}</span><span class="pb">${b ? 'PB ' + format(b.time) : 'NO TIME ON FILE'}</span></button>`;
        }).join('')}</div>
 <div class="dialog-actions"><button class="primary" data-action="marathon" ${w.comingSoon || w.partial ? 'disabled aria-disabled="true"' : ''}>${w.comingSoon || w.partial ? 'Coming soon · ' : ''}World ${w.number} run · 12 ${w.theme === 'rail' || w.theme === 'polar' ? 'assignments' : w.theme === 'rampage' ? 'courses' : w.theme === 'space' ? 'sectors' : 'harbors'} →</button><button data-action="grand-tour">Grand Tour · all ${LEVELS.filter(l => !l.bonus && !l.standalone).length}</button><button class="secondary small" data-action="back">Back</button><button class="secondary small" data-action="log">Logbook</button></div>
 <p class="subtle" style="margin-top:13px">Each circuit has overall and clean records. Retries count toward your time; between-stage menus do not. Pausing makes the circuit practice.</p>`, true);
        $('dialog').dataset.theme = w.theme;
    }
    function fieldContext(log = false) {
        return {
            race: marathon ? { name: raceLabel(), id: marathon.id, position: marathon.position,
                total: marathon.total, stages: marathon.stages, length: marathon.route.length,
                retries: marathon.retries, practice: marathon.practice, done: !hasNext(), hasNext: hasNext() } : null,
            boards: log ? [...WORLDS.filter(w=>!w.comingSoon && !w.partial).map(w=>[w.id,`World ${w.number} · ${w.name}`]),
                ['grand-tour','Grand Tour · 84 stages']].map(([id,name])=>({ name,
                    overall:store.bestRace(id)?.time, clean:store.bestRace(id,true)?.time })) : [],
            archived48: log ? store.data.archivedRaces['grand-tour-48'] : [],
            layoutRaces: log ? layoutRaceArchives() : []
        };
    }
    function layoutRaceArchives() {
        const older = [['archipelago', 'World 3 · inline barge'], ['gerbozilla', 'World 4 · earlier lake'],
            ['grand-tour', 'Grand Tour · earlier barge/lake']].map(([id, name]) => {
                const rows = store.data.archivedRaces[id + '-layout-v2'] || [];
                return { name, overall: rows[0]?.time, clean: rows.find(r => r.clean)?.time };
            }).concat([['northwatch', 'World 2 · straight Backwater'], ['archipelago', 'World 3 · same-axis exchange'], ['grand-tour', 'Grand Tour · earlier approaches']].map(([id, name]) => {
                const rows = store.data.archivedRaces[id + '-approach-v1'] || [];
                return { name, overall: rows[0]?.time, clean: rows.find(r => r.clean)?.time };
            })).filter(row => Number.isFinite(row.overall));
        return older.concat([
            ['long-grade-dispatch-v1','World 5 · earlier helper and passenger routes'],
            ['grand-tour-dispatch-v1','Grand Tour · earlier helper and passenger routes'],
            ['gerbozilla-topography-v1','World 4 · before volcanic hills'],
            ['grand-tour-60','Grand Tour · earlier 60-stage route'],
            ['gerbozilla-contour-v1','World 4 · angular volcanic banks'],
            ['grand-tour-contour-v1','Grand Tour · angular volcanic banks'],
            ['gerbozilla-volcano-v1','World 4 · before volcanic crossings'],
            ['grand-tour-order-v1','Grand Tour · earlier world order']
        ].map(([id,name])=>{
            const rows=store.data.archivedRaces[id] || [];
            return {name,overall:rows[0]?.time,clean:rows.find(r=>r.clean)?.time};
        }).filter(row=>Number.isFinite(row.overall)));
    }
    function revisionArchives() {
        const stages=Object.entries(store.data.archivedStages)
            .filter(([id,stage])=>id.startsWith(level.id+'-rev-')&&stage.runs.length)
            .map(([,stage])=>`<p>${esc(level.name)} · ${stage.runs.map(row=>format(row.time)).join(' · ')}</p>`);
        const races=Object.entries(store.data.archivedRaces)
            .filter(([id,rows])=>/-rev-[a-f0-9]{8}$/.test(id)&&rows.length)
            .map(([id,rows])=>{
                const route=id.replace(/-rev-[a-f0-9]{8}$/,'');
                const name=route==='grand-tour'?'Grand Tour':WORLDS.find(w=>w.id===route)?.name||route;
                return `<p>${esc(name)} · overall ${format(rows[0].time)} · clean ${format(rows.find(r=>r.clean)?.time)}</p>`;
            });
        return stages.length||races.length?`<details><summary>Earlier course records</summary>${stages.join('')}${races.join('')}</details>`:'';
    }
    function circuitRecords(ids=null) {
        const routes=[...WORLDS.filter(w=>!w.comingSoon&&!w.partial).map(w=>[w.id,`World ${w.number} · ${w.name}`]),
            ['grand-tour',`Grand Tour · ${LEVELS.filter(l=>!l.bonus&&!l.standalone).length}`]].filter(([id])=>!ids||ids.includes(id));
        return `<h3 class="circuit-heading">Circuit records</h3><table class="log-table"><thead><tr><th>ROUTE</th><th>OVERALL</th><th>CLEAN</th></tr></thead><tbody>${routes.map(([id,name])=>`<tr><td>${name}</td><td>${format(store.bestRace(id)?.time)}</td><td class="clean">${format(store.bestRace(id,true)?.time)}</td></tr>`).join('')}</tbody></table>`;
    }
    function showLog(filter = 'overall') {
        if (level.rail) {
            pauseForMenu();
            const stage=store.stage(level.id);
            return openDialog('log', `${topModal('Railway logbook','THE LONG GRADE')}<p>${level.name} · ${stage.attempts} attempts</p>
                <p>Best ${format(store.best(level.id)?.time)} · clean ${format(store.best(level.id,true)?.time)}</p>
                ${runComparison(stage.runs,filter)}
                ${circuitRecords(['long-grade','grand-tour'])}
                ${store.data.archivedStages[level.id+'-dispatch-v1']?.runs.length?`<p class="subtle">Earlier route (archived): ${store.data.archivedStages[level.id+'-dispatch-v1'].runs.map(r=>format(r.time)).join(' · ')}</p>`:''}
                ${layoutRaceArchives().filter(a=>a.name.startsWith('Grand Tour')||a.name.startsWith('World 5')).map(a=>`<p class="subtle">${esc(a.name)} (archived): overall ${format(a.overall)} · clean ${format(a.clean)}</p>`).join('')}
                <div class="dialog-actions"><button data-action="toggle-focus-pause" aria-pressed="${settings.pauseOnBlur}">Pause when window loses focus: ${settings.pauseOnBlur?'ON':'OFF'}</button><button data-action="toggle-sound">Sound: ${settings.sound?'ON':'OFF'}</button><button data-action="export">Export records</button><button data-action="import">Import records</button><button data-action="back">Back</button></div>
                <p class="subtle">Pausing makes a run practice. Hiding the tab always pauses.</p>`);
        }
        if (level.rampage) { pauseForMenu(); return openDialog('log', G.dialog('log', level, run, format, store.stage(level.id).runs, settings, [level.id+'-topography-v1',level.id+'-contour-v1',level.id+'-volcano-v1',level.id+'-layout-v1',level.id+'-preview',level.id,level.rampage.retiredId].filter(Boolean).filter(id=>store.data.archivedStages[id]).map(id=>({id,...store.data.archivedStages[id]})), {...fieldContext(true),comparison:runComparison(store.stage(level.id).runs,filter)})); }
        pauseForMenu();
        const s = store.stage(level.id);
        openDialog('log', `${topModal(wording('The captain’s logbook.', 'The flight logbook.'))}
 <p>World ${level.worldNumber} / ${level.bonus ? "BONUS" : level.stageNumber} · ${level.name} · ${s.attempts} ${wording("departures", "launches")} · ${s.clears} ranked ${wording("arrivals", "captures")}</p>
 ${runComparison(s.runs,filter)}
 ${circuitRecords()}<p class="subtle">${store.data.archivedRaces?.['grand-tour-48']?.length ? '48-stage Grand Tour (archived): ' + format(store.data.archivedRaces['grand-tour-48'][0].time) + '<br>' : ''}${store.data.archivedRaces?.['grand-tour-24']?.length ? '24-stage Grand Tour (archived): ' + format(store.data.archivedRaces['grand-tour-24'][0].time) + '<br>' : ''}${store.data.archivedRaces?.['grand-tour-36']?.length ? '36-stage Grand Tour (archived): ' + format(store.data.archivedRaces['grand-tour-36'][0].time) + '<br>' : ''}${store.data.marathon.length ? '12-stage circuit (archived): ' + format(store.data.marathon[0].time) + '<br>' : ''}Paused runs are unranked. Beat the course targets to earn gold, silver or bronze.</p>
 ${store.data.archivedStages[level.id+'-layout-v1']?.runs.length ? `<details><summary>Earlier layout records (archived)</summary><p class="subtle">The barge now starts broadside. Earlier inline-tow times, ghosts and splits remain in exports, not on this route’s board.</p><table class="log-table"><thead><tr><th>TIME / IGT</th><th>CONTACTS</th><th>CLASS</th></tr></thead><tbody>${store.data.archivedStages[level.id+'-layout-v1'].runs.map(r => `<tr><td>${format(r.time)}</td><td>${r.contacts}</td><td>${r.clean ? 'CLEAN' : 'OPEN'}</td></tr>`).join('')}</tbody></table></details>` : ''}
 ${store.data.archivedStages[level.id + '-approach-v1']?.runs.length ? `<details><summary>Earlier straight-approach records (archived)</summary><p class="subtle">These times belong to the earlier approach. Its ghost and splits remain in exports.</p>${store.data.archivedStages[level.id + '-approach-v1'].runs.map(r => `<p>${format(r.time)} · ${r.clean ? 'CLEAN' : 'OPEN'}</p>`).join('')}</details>` : ''}
 ${layoutRaceArchives().map(a=>`<p class="subtle">${esc(a.name)} (archived): overall ${format(a.overall)} · clean ${format(a.clean)}</p>`).join('')}
 ${store.data.archivedStages[level.id]?.runs.length ? `<details><summary>${run.space ? 'Archived sector layout records' : 'Archived dock-side departure records'}</summary><p class="subtle">These runs use a different layout or starting position. Their ghosts and splits are preserved in exports, not compared with this route.</p><table class="log-table"><thead><tr><th>TIME / IGT</th><th>CONTACTS</th><th>CLASS</th></tr></thead><tbody>${store.data.archivedStages[level.id].runs.map(r => `<tr><td>${format(r.time)}</td><td>${r.contacts}</td><td>${r.clean ? 'CLEAN' : 'OPEN'}</td></tr>`).join('')}</tbody></table></details>` : ''}
 ${['archipelago', 'grand-tour'].some(id => store.data.archivedRaces[id + '-dock-starts']?.length) ? `<details><summary>Archived dock-side island circuits</summary><p class="subtle">Approach legs change these routes. Earlier records are retained separately.</p>${['archipelago', 'grand-tour'].map(id => { const rows = store.data.archivedRaces[id + '-dock-starts']; return rows.length ? `<p>${id === 'archipelago' ? 'World 3' : 'Grand Tour'} · ${format(rows[0].time)}</p>` : ''; }).join('')}</details>` : ''}
 ${['meridian', 'grand-tour'].some(id => store.data.archivedRaces[id + '-layout-v1']?.length) ? `<details><summary>Archived Meridian-layout circuits</summary><p class="subtle">Mission geometry has changed. Earlier circuit records remain separate.</p>${['meridian', 'grand-tour'].map(id => { const rows = store.data.archivedRaces[id + '-layout-v1']; return rows.length ? `<p>${id === 'meridian' ? 'World 6' : 'Grand Tour'} · ${format(rows[0].time)}</p>` : ''; }).join('')}</details>` : ''}
 <p><button data-action="toggle-focus-pause" aria-pressed="${settings.pauseOnBlur}">Pause when window loses focus: ${settings.pauseOnBlur ? 'ON' : 'OFF'}</button></p><p class="subtle">When off, the run continues while you use another window. Hiding this tab still pauses the run. Any pause makes the attempt unranked.</p>
<div class="dialog-actions"><button data-action="toggle-ghost" class="small">Ghost: ${settings.ghost ? 'ON' : 'OFF'}</button><button data-action="toggle-guide" class="small">${wording("Coast guide", "Drift vector")}: ${settings.guide ? 'ON' : 'OFF'}</button><button data-action="toggle-sound" class="small">Sound: ${settings.sound ? 'ON' : 'OFF'}</button></div>
 <div class="dialog-actions"><button class="primary" data-action="back" autofocus>${wording("Back to harbor", "Back to flight")}</button><button class="secondary small" data-action="export">Export records</button><button class="secondary small" data-action="import">Import records</button><button class="secondary small danger" data-action="reset">Erase</button></div>
 <p class="subtle" style="margin-top:13px">Records are local, not tamper-proof. File copies and browsers can have separate storage. Export before moving the game. Earlier logbooks are accepted. Existing stage records stay with their courses; circuits of different lengths are kept separate.</p>${!store.available ? '<div class="storage-warning">Persistent storage is unavailable. Export to preserve this session’s records.</div>' : ''}`);
    }
    function showHelp() {
        if (simulation.dialog) { pauseForMenu(); return openDialog('help', simulation.dialog('help', level, run, format)); }
        if (level.rampage) { pauseForMenu(); return openDialog('help', G.dialog('help', level, run, format)); }
        if (level.space) {
            pauseForMenu();
            openDialog('help', `${topModal('Flight manual.', 'MERIDIAN FLIGHT AUTHORITY')}<div class="help-grid"><div><h3>No free brakes</h3><p>The thrust telegraph selects persistent fore/aft thrust<span class="key-hint"> (W/S)</span>, from full retro to full forward. Cut thrust<span class="key-hint"> (Space)</span> stops main thrust. Velocity persists when engines stop. The rotation buttons<span class="key-hint"> (A/D)</span> fire rotational jets: rotation also persists after release, so counterfire. RADAR PULSE<span class="key-hint"> (H)</span> sends a visual scan with an electronic ping; Audio<span class="key-hint"> (M)</span> mutes the sound but not the scan. Lateral jets<span class="key-hint"> (Q/E)</span> translate sideways without turning. The controls and touch buttons work simultaneously.</p><h3>Capture is relative</h3><p>Fit the whole hull in the cradle, match its nose arrow and velocity, reduce relative spin below 0.69°/s, cut every jet, and hold for two seconds. Fuel and assembly collars show their own progress. Moving cradles do not stop while you dock.</p><h3>Propellant</h3><p>All jets and the rescue beam share your fuel supply. Heavier craft need more fuel to change speed. Solar craft cannot fire jets in full shadow; scanners also inhibit power. Leave enough fuel to slow down.</p></div><div><h3>Special assignments</h3><p>The beam button<span class="key-hint"> (F)</span> acquires/releases a rescue beam within 170 m and with clear line of sight. Hold Attract<span class="key-hint"> (J)</span> or Repel<span class="key-hint"> (K)</span>. Forces are equal and opposite. Friendly craft must settle in their own capture cradle; then dock the tug.</p><p>For gunnery, move into the firing box, face the lead diamond and hold still with all jets off for three seconds. Firing and projectile flight are automatic; recoil pushes your ship backward. A confirmed hit unlocks the home cradle.</p><p>Stellar radiation heats exposed hulls. Use asteroids for shade; cover the whole hull for full protection. The solar assignment reverses that rule: darkness removes thrust, not momentum.</p><p>Two chronogates send you to their marked destinations and add each recorded leg as a repeating solid history. Use the station’s passing bays to avoid your past selves. Your clock never rewinds. The Century Ship is a separate 30+ minute bonus, excluded from the 84-stage Grand Tour.</p></div></div><div class="dialog-actions"><button class="primary" data-action="back" autofocus>Back to flight</button></div>`, true); return;
        }
        pauseForMenu();
        openDialog('help', `${topModal('It handles like a ship.')}
 <div class="help-grid"><div><h3>The helm</h3><div class="key-row"><kbd>W</kbd> / <kbd>↑</kbd> one notch ahead<br><kbd>S</kbd> / <kbd>↓</kbd> one notch astern<br><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> hold rudder<br><kbd>Q</kbd><kbd>E</kbd> hold bow thruster<br><kbd>Space</kbd> neutral, not a brake<br><kbd>Shift+R</kbd> retry · <kbd>Esc</kbd> pause<br><kbd>G</kbd> ghost · <kbd>V</kbd> coast guide<br><kbd>Z</kbd> zoom · <kbd>M</kbd> audio · <kbd>H</kbd> horn<br><kbd>F</kbd> make / release towline<br><kbd>J</kbd><kbd>K</kbd> reel in / pay out (hold)</div><p style="margin-top:12px">The touch helm supports simultaneous fingers. Rudder and thruster return to center on release; throttle stays at its selected notch. Use the chart’s zoom button to follow the ship more closely.</p></div>
 <div><h3>Anticipate, don’t twitch</h3><p>Engine output spools over several seconds. Neutral leaves momentum intact. Order astern to brake an ahead-moving ship, then return to neutral before it starts backing away.</p><p>The rudder needs water flow and reverses its steering effect astern. The bow thruster both turns and pushes the bow sideways; it loses authority at speed. The dashed white line predicts 12 seconds after ordering neutral, with centered rudder, no thruster and no collisions.</p>
 <h3>Read the motion, not the throttle</h3><p>The ground-speed number shows + AHEAD when your velocity points toward the bow and − ASTERN when it points toward the stern. It can still read AHEAD while your engine is in reverse. ABEAM means almost pure sideways motion. The separate drift line shows port or starboard motion relative to the hull. All are measured over ground.</p>
 <h3>Open water, finite assignment</h3><p>The archipelago has no perimeter seawall. Other harbors open west onto the fairway. A brief chart-limit warning appears near an open edge. If any part of your hull or a casualty crosses the chart edge, the attempt ends immediately. The sea does not bounce you back.</p>
 <h3>Find the lee</h3><p>Shaded LEE WATER basins reduce the local current and wind. The change fades in along the hull, so entering shelter never stops you instantly. Current arrows, the LOCAL SET instrument and the coast guide use the same spatial water model. Northwatch also has marked pulsing current lanes.</p>
 <h3>What counts as docked?</h3><p>Finish the marked tasks. Put the entire hull inside the green berth, with the bow matching the arrow. Slow below ${(level.berth.speed || .62) * KNOTS < 1 ? ((level.berth.speed || .62) * KNOTS).toFixed(2) : ((level.berth.speed || .62) * KNOTS).toFixed(1)} knots, reduce turn rate, set neutral, let engine output fall below 15%, and hold for two uninterrupted seconds.</p>
 <h3>Island ferry duty</h3><p>Match the amber loading or unloading outline with the entire hull, stop below 0.4 knots and select neutral. After the settle hold, the ramp opens and vehicles transfer automatically, one at a time. Cars, vans and buses add different masses. Propulsion is inhibited while a ramp is down. Ordering thrust aborts transfer and closes the ramp; transferred vehicles stay aboard. Re-enter the same slip to finish the call.</p>
 <h3>Towing</h3><p>Use your stern towing point and the casualty’s bow. Come within 44 metres at less than 1.6 knots relative speed; use Make fast to make fast. Hold Reel in or Pay out (12–64 metres). A line pulls only when taut, and both vessels retain momentum. Keep its load below 100%; sustained overload or dragging the line over rock parts it and loses the clean run. Reconnect to recover. The casualty must settle inside its own marked berth for two seconds; shore crew then secure it and release your line. You still need to moor your own vessel. The dashed coast guide accounts for an attached tow, but never predicts collisions.</p>
 <h3>Times and records</h3><p>Traffic, gates, tides and sluice pulses reset on retry. The main clock is in-game time. All contact types count against a clean run; wake violations and grounding do too. Pausing or opening menus mid-run marks that attempt as practice. Window focus pausing is optional in Logbook & settings; hiding the tab always pauses.</p></div></div>
 <div class="dialog-actions"><button class="primary" data-action="back" autofocus>${wording("Back to harbor", "Back to flight")}</button><button class="secondary" data-action="log">Logbook & settings</button></div>`, true);
    }
    function back() {
        if (status === 'paused')
            resume();
        else if (status === 'ready')
            showIntro();
        else if (status === 'complete')
            showResult();
        else if (status === 'failed')
            showFailure();
        else {
            $('overlay').hidden = true;
            modal = null;
        }
    }
    function startMarathon(id = WORLDS[selectedWorld - 1].id) {
        if (id !== 'grand-tour' && !WORLDS.some(w => w.id === id && !w.comingSoon && !w.partial))
            throw new RangeError('This world is coming soon or does not exist.');
        const route = LEVELS.map((l, i) => i).filter(i => !LEVELS[i].bonus && !LEVELS[i].standalone && (id === 'grand-tour' || LEVELS[i].campaign === id));
        const name = id === 'grand-tour' ? 'Grand Tour' : `World ${WORLDS.find(w => w.id === id).number}`;
        marathon = {
            id, name, route, position: 0, total: 0, sectorTime: 0, contacts: 0, wakes: 0, groundings: 0, lineBreaks: 0, retries: 0, stages: 0, splits: [], practice: false
        };
        loadStage(route[0], true);
        toast(`${name} started · ${route.length} stages, one clock.`);
    }
    function toggleSetting(key) {
        settings[key] = !settings[key];
        store.save();
        audio.enabled = settings.sound;
        updateSettings();
        if (modal === 'log')
            showLog();
    }
    function updateSettings() {
        $('sound-btn').classList.toggle('off', !settings.sound);
        $('sound-btn').setAttribute('aria-pressed', String(settings.sound));
        $('ghost-btn').classList.toggle('off', !settings.ghost);
        $('ghost-btn').setAttribute('aria-pressed', String(settings.ghost));
    }
    function exportRecords() {
        const blob = new Blob([store.export()], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = 'dead-slow-logbook.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    function zoomChart() {
        zoom = zoom === 1 ? 1.65 : zoom === 1.65 ? 2.3 : 1;
        $('zoom-btn').textContent = zoom === 1 ? '1×' : zoom === 1.65 ? '1.7×' : '2.3×';
    }
    function missionText() {
        if (run.rampage) return B.message(level, run);
        if (run.space && status === 'running') return X.message(level, run);
        if (status === 'ready')
            return wording('Awaiting departure. The clock starts when you cast off.', 'Clamps engaged. The clock starts when you release them.');
        if (status === 'complete')
            return run.space ? 'Capture complete. All thrusters secured.' : 'Mooring complete. All lines secured.';
        if (status === 'failed')
            return wording('Hull lost. Use Retry to try again.', 'Flight terminated. Use Retry to try again.');
        if (status === 'paused')
            return 'Paused. This attempt is now practice.';
        if (run.grounded)
            return `AGROUND · bar ${P.tideDepth(level.tide, run.time).toFixed(1)} m / draft ${run.ship.draft.toFixed(1)} m. Wait for rising water.`;
        if (run.dockHold > 0)
            return `Lines ashore · hold position ${(2 - run.dockHold).toFixed(1)} s`;
        const b = level.buoys[run.buoyIndex];
        if (b) {
            const near = Math.hypot(run.ship.x - b.x, run.ship.y - b.y) < b.r;
            if (near && b.speed !== undefined && Math.hypot(run.ship.vx, run.ship.vy) > b.speed)
                return `${b.name} · slow below ${(b.speed * KNOTS).toFixed(1)} kn to ${b.cargo ? 'load' : 'receive clearance'}.`;
            if (run.buoyHold > 0 && b.hold)
                return `${b.name} · keep steady ${(b.hold - run.buoyHold).toFixed(1)} s`;
            return `NEXT ${run.buoyIndex + 1}/${level.buoys.length} · ${b.name}${level.tide ? ` · bar ${P.tideDepth(level.tide, run.time).toFixed(1)} m` : ''}`;
        }
        if (level.lock && run.lock.phase !== 'exit')
            return run.lock.phase === 'entry' ? 'Enter chamber · stop in the dashed box · neutral for 3 s.' : `Lock equalizing · ${(level.lock.cycle - run.lock.clock).toFixed(1)} s to upper gate opening.`;
        if (!J.ready(level, run.jobs))
            return J.message(level, run.jobs, run.ship);
        const d = run.dock, near = Math.hypot(run.ship.x - level.berth.x, run.ship.y - level.berth.y) < 58;
        if (near) {
            if (!d.aligned)
                return 'Match the berth arrow: your bow is pointing the wrong way.';
            if (!d.inside)
                return 'Bring the whole hull inside the green mooring outline.';
            if (!d.slow)
                return 'Inside berth · reduce speed and turn rate.';
            if (run.ship.throttle !== 0)
                return 'Set NEUTRAL to secure the mooring.';
            if (Math.abs(run.ship.engine) >= .15)
                return 'Wait for engine thrust to wind down below 15%.';
        }
        return 'Approach the green berth · match its bow arrow · stop in neutral.';
    }
    function updateTelegraph() {
        const n = run.ship.throttle, names = {
            '-3': 'FULL ASTERN', '-2': 'HALF ASTERN', '-1': 'DEAD SLOW ASTERN', '0': 'STOP', '1': 'DEAD SLOW AHEAD', '2': 'SLOW AHEAD', '3': 'HALF AHEAD', '4': 'FULL AHEAD'
        };
        const st = run.space;
        if (st) {
            $('telegraph-name').textContent = n < 0 ? 'RETRO BURN' : n > 0 ? 'FORWARD BURN' : 'COAST';
            $('telegraph-detail').textContent = st.fuel <= 0 ? 'TANK EMPTY · COASTING'
                : st.inBlackout || level.space.solar && st.light < .01 ? 'NO POWER · COASTING'
                : n ? 'THRUST PERSISTS UNTIL CUT' : 'NO DRAG · NO AUTO-STOP';
        } else {
            $('telegraph-name').textContent = names[n];
            $('telegraph-detail').textContent = n === 0 ? 'NEUTRAL · STILL COASTING'
                : `${n > 0 ? '+' : ''}${n} / ${n > 0 ? 4 : 3} · ${run.loaded ? 'LOADED' : 'TELEGRAPH'}`;
        }
        $('telegraph-name').style.color = n < 0 ? 'var(--amber)' : 'var(--green)';
        $('notches').innerHTML = Array.from({ length: 8 }, (_, i) => {
            const v = i - 3;
            return `<span class="notch ${v < 0 ? 'reverse' : v === 0 ? 'zero' : ''} ${v === n ? 'active' : ''}"></span>`;
        }).join('');
    }
    function updateHud() {
        $('review-controls').hidden = !developer?.unlocked;
        if (developer?.unlocked) {
            if (developer.rate > 0) reviewResumeRate = developer.rate;
            const custom = $('review-custom');
            custom.hidden = [0, 1, 2, 4, 8, 16, 32].includes(developer.rate);
            if (!custom.hidden) { custom.value = String(developer.rate); custom.textContent = developer.rate + '×'; }
            $('review-rate').value = String(developer.rate);
            $('review-freeze').textContent = developer.rate === 0 ? 'Resume time' : 'Freeze';
        }
        if (run && simulation.update) { simulation.update(level, run, status, format, marathon); return; }
        if (run?.rampage) {
            const label = (developer?.rate === 0 ? 'FROZEN' : developer?.rate !== 1 ? developer?.rate + '× PRACTICE' : 'PRACTICE') + ' · UNRANKED';
            G.update(level, run, status, format, label, store.stage(level.id).bestSplits, store.best(level.id), fieldContext().race); return;
        }
        if (!run)
            return;
        const s = run.ship, motion = P.groundMotion(s), units = run.space ? 1 : KNOTS, speed = motion.speed * units, heading = (s.a * 180 / Math.PI + 450) % 360;
        const direction = motion.direction, sign = direction === 'ahead' ? '+' : direction === 'astern' ? '−' : '';
        const speedText = direction === 'stopped' ? '0.0' : sign + speed.toFixed(1), color = direction === 'astern' ? 'var(--amber)' : direction === 'abeam' ? 'var(--ice, var(--muted))' : 'var(--green)';
        $('speed').textContent = speedText;
        $('mobile-speed').textContent = speedText;
        $('speed').style.color = color;
        $('mobile-speed').style.color = color;
        $('speed-direction').textContent = run.space ? { ahead: 'FORWARD', astern: 'REVERSE', abeam: 'LATERAL', stopped: 'STOPPED' }[direction] : direction.toUpperCase();
        $('speed-direction').style.color = color;
        $('mobile-direction').textContent = (run.space ? { ahead: 'FWD', astern: 'REV', abeam: 'LAT', stopped: 'STOP' } : { ahead: 'AHD', astern: 'AST', abeam: 'BEAM', stopped: 'STOP' })[direction];
        $('mobile-direction').style.color = color;
        $('drift').textContent = Math.abs(motion.sway) < .025 ? 'NO SIDEWAYS DRIFT' : `${motion.sway < 0 ? wording('← PORT', '← LEFT') : wording('STBD →', 'RIGHT →')} DRIFT ${(Math.abs(motion.sway) * units).toFixed(1)} ${run.space ? 'm/s' : 'kn'}`;
        const env = P.environmentAt(level, s, run.time), set = Math.hypot(env.current.x, env.current.y), lee = env.shelter > .8;
        $('shelter-status').textContent = lee ? 'IN THE LEE' : env.shelter > .08 ? 'ENTERING / LEAVING LEE' : 'OPEN WATER';
        $('shelter-status').classList.toggle('sheltered', lee);
        $('local-set').textContent = `SET ${(set * KNOTS).toFixed(1)} kn`;
        $('weather-text').textContent = `${lee ? 'LEE WATER' : 'LOCAL SET'} · ${(set * KNOTS).toFixed(1)} kn${set > .015 ? ' · ' + Math.round((Math.atan2(env.current.y, env.current.x) * 180 / Math.PI + 450) % 360).toString().padStart(3, '0') + '°' : ''}`;
        $('heading').textContent = Math.round(heading).toString().padStart(3, '0');
        $('contacts').textContent = run.contacts;
        $('mobile-hits').textContent = run.contacts;
        $('engine-read').textContent = Math.round(s.engine * 100);
        const hull = Math.max(0, Math.ceil(s.hull));
        $('hull-label').textContent = hull + '%';
        $('mobile-hull').textContent = hull;
        $('hull-bar').style.width = hull + '%';
        $('hull-bar').style.background = hull < 35 ? 'var(--red)' : hull < 70 ? 'var(--amber)' : 'var(--green)';
        $('check-objectives').classList.toggle('ok', objectiveReady());
        for (const k of ['inside', 'aligned'])
            $('check-' + k).classList.toggle('ok', run.dock[k]);
        $('check-slow').classList.toggle('ok', run.dock.slow && s.throttle === 0 && Math.abs(s.engine) < .15);
        $('dock-bar').style.width = (run.dockHold / 2 * 100) + '%';
        $('rudder-indicator').style.left = `calc(${50 + s.rudder * 47}% - 3px)`;
        $('mobile-extra').textContent = level.tide ? `BAR ${P.tideDepth(level.tide, run.time).toFixed(1)}m` : run.pausedUsed ? 'PRACTICE' : clean() ? 'CLEAN' : 'OPEN';
        $('mobile-extra').style.color = clean() && !run.pausedUsed ? 'var(--green)' : 'var(--amber)';
        $('mission-status').textContent = missionText();
        updateWorkHud();
        updateTelegraph();
        const names = level.buoys.map(b => b.cargo ? 'Cargo aboard' : b.name);
        if (level.lock)
            names.push('Chamber secured', 'Lock equalized');
        names.push(...level.jobs.map(j => j.name));
        names.push(run.space ? 'Final capture' : 'Lines ashore');
        // Jobs and pilot clearances may interleave. Completed split labels follow the actual order.
        const pending = names.filter(n => !run.splits.some(sp => sp.name === n || (n === 'Cargo aboard' && sp.name.startsWith('Cargo aboard'))));
        names.splice(0, names.length, ...run.splits.map(sp => sp.name), ...pending);
        const previous = store.stage(level.id).bestSplits;
        $('splits').innerHTML = names.map((name, i) => {
            const sp = run.splits[i], end = i === names.length - 1, complete = end && status === 'complete', t = sp?.time ?? (complete ? run.time : null);
            return `<div class="split-row ${t !== null ? 'done' : i === run.splits.length ? 'active' : ''}"><span>${esc(name)}</span><span>${t !== null ? format(t) : '—'}${sp && Number.isFinite(previous[i]) ? ` <small>${deltaFormat(t - previous[i])}</small>` : ''}</span></div>`;
        }).join('');
        const last = run.splits[run.splits.length - 1], prev = previous[run.splits.length - 1], best = store.best(level.id);
        $('delta').textContent = last && Number.isFinite(prev) ? `${deltaFormat(last.time - prev)} SPLIT` : best ? 'PB ' + format(best.time) : 'NO RECORD';
        $('delta').style.color = last && prev && last.time > prev ? 'var(--amber)' : 'var(--green)';
        $('clock-label').textContent = run.pausedUsed ? `${developer?.rate === 0 ? 'FROZEN' : developer && developer.rate !== 1 ? developer.rate + '× PRACTICE' : 'PRACTICE'} · UNRANKED` : marathon ? `${raceLabel().toUpperCase()} · ${marathon.position + 1}/${marathon.route.length}` : 'RUN TIME · IGT';
        $('clock-label').classList.toggle('practice', run.pausedUsed);
        $('race-banner').hidden = !marathon;
        if (marathon)
            $('race-banner').textContent = `${raceLabel().toUpperCase()} ${marathon.position + 1}/${marathon.route.length} · ${format(marathon.total + (status === 'complete' ? 0 : run.time))}${marathon.practice ? ' · PRACTICE' : ''}`;
        const guideScale = 25 * renderer.scale;
        $('scale-label').style.setProperty('--scale-width', guideScale + 'px');
        $('scale-label').textContent = '25 METRES';
        HarborSpaceUI.update(level, run, status);
    }
    function updateWorkHud() {
        if (!level.jobs.length)
            return;
        const state = run.jobs, job = J.current(level, state), isTow = job?.type === 'tow', line = state.line;
        $('work-order').textContent = job ? `JOB ${state.index + 1}/${level.jobs.length} · ${job.name}` : 'ISLAND SERVICE COMPLETE';
        $('work-readout').textContent = isTow ? (line ? `${line.length.toFixed(1)} m LINE · ${Math.round(line.tension * 100)}% LOAD · TOW HULL ${Math.ceil(J.target(state, line.bodyId).hull)}%` : 'MAKE FAST · REEL IN / PAY OUT') : `${state.onboard.length} / ${run.ship.capacity || 6} ABOARD · ${state.stats.vehiclesDelivered} DELIVERED · ${run.ship.mass.toFixed(2)} MASS`;
        $('tow-controls').hidden = !isTow;
        $('line-action').innerHTML = '<span class="key-hint">F · </span>' + (line ? 'CAST OFF' : 'MAKE FAST');
        const progress = isTow ? (state.towHold / (job.hold || 2)) : (state.transferred / (job?.type === 'load' ? job.vehicles.length : job?.count || 1));
        $('work-progress').style.width = `${P.clamp(progress, 0, 1) * 100}%`;
        $('work-readout').classList.toggle('overload', !!line && (line.tension > 1 || line.chafe > 0));
        $('manifest').hidden = isTow;
        $('manifest').innerHTML = state.onboard.map(v => `<span class="manifest-vehicle ${v.kind}" style="--car-color:${v.color}" title="${v.kind}" aria-label="${v.kind}"></span>`).join('') + (state.onboard.length ? '' : '<small>DECK CLEAR</small>');
        $('work-panel').classList.toggle('tow-mode', isTow);
    }
    const actions = {
        begin, resume, retry, courses: showCourses, log: () => showLog(), help: showHelp, back, next: nextHarbor, marathon: () => startMarathon(), 'grand-tour': () => startMarathon('grand-tour'), export: exportRecords, import: () => $('import-file').click(),
        'toggle-ghost': () => toggleSetting('ghost'), 'toggle-guide': () => toggleSetting('guide'), 'toggle-sound': () => toggleSetting('sound'), 'toggle-focus-pause': () => toggleSetting('pauseOnBlur'), reset: () => {
            openDialog('erase', `${topModal('Clear the logbook?')}<p>This erases all local times, ghosts and arrival counts. Export first to keep a copy.</p><div class="dialog-actions"><button data-action="confirm-reset" class="danger">Erase all records</button><button class="primary" data-action="log" autofocus>Keep my records</button></div>`);
        }, 'confirm-reset': () => {
            store.reset();
            settings = store.data.settings;
            audio.enabled = settings.sound;
            updateSettings();
            refreshRecords();
            showLog();
        }
    };
    $('dialog').addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b)
            return;
        if (b.dataset.stage !== undefined) {
            marathon = null;
            loadStage(Number(b.dataset.stage));
        }
        else if (b.dataset.world)
            showCourses(Number(b.dataset.world));
        else if (b.dataset.filter)
            showLog(b.dataset.filter);
        else if (actions[b.dataset.action])
            actions[b.dataset.action]();
    });
    $('courses-btn').onclick = showCourses;
    $('log-btn').onclick = () => showLog();
    $('help-btn').onclick = showHelp;
    $('pause-btn').onclick = () => {
        if (status === 'running')
            showPause();
        else if (status === 'paused')
            resume();
    };
    $('retry-btn').onclick = retry;
    $('quick-retry-btn').onclick = retry;
    let reviewResumeRate = 8;
    $('review-rate').onchange = () => {
        const value = Number($('review-rate').value);
        if (value > 0) reviewResumeRate = value;
        developer.menu.speed(value);
        $('review-rate').blur?.();
    };
    $('review-freeze').onclick = () => {
        const rate = developer.rate;
        if (rate > 0) { reviewResumeRate = rate; clearInput(); }
        developer.menu.speed(rate === 0 ? reviewResumeRate : 0);
    };
    $('horn-btn').onclick = signal;
    $('gerbo-shield').onclick = lineAction;
    $('radar-btn').onclick = signal;
    $('sound-btn').onclick = () => toggleSetting('sound');
    $('ghost-btn').onclick = () => toggleSetting('ghost');
    $('zoom-btn').onclick = zoomChart;
    $('sea').ondblclick = e => e.preventDefault();
    $('line-action').onclick = lineAction;
    $('throttle-up').onclick = () => throttle(1);
    $('throttle-down').onclick = () => throttle(-1);
    $('neutral-btn').onclick = () => throttle(0, true);
    for (const b of document.querySelectorAll('[data-hold]')) {
        b.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (status !== 'running')
                return;
            b.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, b.dataset.hold);
            readInput();
            audio.init();
        });
        const up = e => {
            pointers.delete(e.pointerId);
            readInput();
        };
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', e => e.preventDefault());
    }
    const keyHolds = {
        KeyJ: 'linein', KeyK: 'lineout', KeyA: 'port', ArrowLeft: 'port', KeyD: 'starboard', ArrowRight: 'starboard', KeyQ: 'bowport', KeyE: 'bowstarboard'
    };
    document.addEventListener('keydown', e => {
        // Ignore text/IME and virtual keyboard input; remember hardware use for
        // this session so touching a hybrid screen does not make hints flicker.
        if (!e.isComposing && e.code && e.code !== 'Unidentified' && !e.target?.matches?.('input:not([type="range"]), textarea, [contenteditable="true"]'))
            document.body.classList.add('keyboard-used');
        if (e.ctrlKey || e.metaKey || e.altKey)
            return;
        if (e.code === 'Enter' && e.target?.tagName === 'A') return;
        // Railway sliders are also game controls. Keep WASD/QE, Space and
        // Escape alive after a click, while preserving native slider arrows.
        const railSlider=!!run.rail&&e.target?.matches?.('#rail-panel input[type="range"][data-rail]');
        if(railSlider&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.code))return;
        if(!railSlider&&(e.target?.matches?.('select, input, textarea')||e.target?.isContentEditable))return;
        if (status === 'running' && simulation.key?.(e, run)) return;
        if (developer?.unlocked && ['BracketLeft', 'BracketRight', 'Backslash'].includes(e.code)) {
            e.preventDefault();
            if (e.repeat) return;
            if (e.code === 'Backslash') $('review-freeze').onclick();
            else {
                const steps = [1, 2, 4, 8, 16, 32], value = developer.rate;
                const next = e.code === 'BracketRight' ? steps.find(x => x > value) ?? 32
                    : steps.slice().reverse().find(x => x < value) ?? 1;
                reviewResumeRate = next; developer.menu.speed(next);
            }
            return;
        }
        // Modal focus stays inside the dialog, including on touch/browser keyboards.
        if (e.code === 'Tab' && !$('overlay').hidden) {
            const items = [...$('dialog').querySelectorAll('button:not([disabled]),input,a')];
            if (items.length) {
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && (document.activeElement === first || !$('dialog').contains(document.activeElement))) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && (document.activeElement === last || !$('dialog').contains(document.activeElement))) {
                    e.preventDefault();
                    first.focus();
                }
            }
            return;
        }
        const recognized = ['Space', 'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyR', 'Escape', 'Enter', 'KeyG', 'KeyV', 'KeyM', 'KeyH', 'KeyZ', 'KeyF', 'F1', ...Object.keys(keyHolds)];
        if (!recognized.includes(e.code))
            return;
        e.preventDefault();
        const hold = run.rampage ? ({KeyH:'breathe',KeyW:'rollnorth',ArrowUp:'rollnorth',KeyS:'rollsouth',ArrowDown:'rollsouth',KeyA:'rollwest',ArrowLeft:'rollwest',KeyD:'rolleast',ArrowRight:'rolleast'})[e.code] : keyHolds[e.code];
        if (hold) {
            if (status === 'running') {
                pressed.set(e.code, hold);
                readInput();
            }
            return;
        }
        if (e.repeat)
            return;
        if (e.code === 'KeyR') {
            if (e.shiftKey) retry();
            return;
        }
        if (e.code === 'Escape') {
            if (status === 'running')
                showPause();
            else
                back();
            return;
        }
        if (e.code === 'F1') {
            showHelp();
            return;
        }
        if (e.code === 'Enter') {
            if (document.activeElement?.tagName === 'BUTTON' && $('dialog').contains(document.activeElement)) {
                document.activeElement.click();
                return;
            }
            if (status === 'ready')
                begin();
            else if (status === 'paused')
                resume();
            else if (status === 'complete')
                nextHarbor();
            else if (status === 'failed')
                retry();
            return;
        }
        if (e.code === 'KeyM') {
            toggleSetting('sound');
            return;
        }
        if (e.code === 'KeyG') {
            toggleSetting('ghost');
            return;
        }
        if (e.code === 'KeyV') {
            toggleSetting('guide');
            return;
        }
        if (e.code === 'KeyZ') {
            zoomChart();
            return;
        }
        if (e.code === 'KeyH') {
            signal();
            return;
        }
        if (status !== 'running')
            return;
        if (e.code === 'KeyF')
            lineAction();
        if (e.code === 'Space') {
            if (run.rampage) lineAction(); else throttle(0, true);
        }
        if (e.code === 'KeyW' || e.code === 'ArrowUp')
            throttle(1);
        if (e.code === 'KeyS' || e.code === 'ArrowDown')
            throttle(-1);
    });
    document.addEventListener('keyup', e => {
        if (pressed.has(e.code)) {
            pressed.delete(e.code);
            readInput();
        }
    });
    window.addEventListener('blur', () => {
        clearInput();
        if (settings.pauseOnBlur && status === 'running') {
            markPractice('Window lost focus');
            showPause(wording('The bridge is unattended.', 'The flight deck is unattended.'));
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            hiddenAt = performance.now();
            clearInput();
            if (status === 'running') {
                markPractice('Tab hidden');
                showPause(wording('The bridge is unattended.', 'The flight deck is unattended.'));
            }
        }
        else {
            lastFrame = null;
            hiddenAt = 0;
        }
    });
    $('import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        try {
            if (file.size > 5 * 1024 * 1024)
                throw Error('This logbook is too large (maximum 5 MB).');
            store.import(await file.text());
            settings = store.data.settings;
            audio.enabled = settings.sound;
            updateSettings();
            refreshRecords();
            showLog();
            toast('Logbook imported.');
        }
        catch (err) {
            toast(err.message || 'The logbook could not be read.', true, 6000);
        }
        finally {
            e.target.value = '';
        }
    });
    window.addEventListener('contextmenu', e => {
        if (e.target.closest('.helm'))
            e.preventDefault();
    });
    function simulationStep() {
        if (status !== 'running') return false;
        developer?.beforeStep();
        advance(DT);
        return developer?.afterStep() !== false;
    }
    function advanceSeconds(seconds) {
        for (let i = 0; i < Math.round(seconds / DT) && status === 'running'; i++)
            if (!simulationStep()) break;
        updateHud();
    }
    function frame(now) {
        if (lastFrame === null)
            lastFrame = now;
        let elapsed = (now - lastFrame) / 1000;
        lastFrame = now;
        if (status === 'running') {
            if (elapsed > 1 && developer?.rate !== 0) {
                markPractice('Long rendering interruption');
                showPause(wording('A watchkeeping interruption.', 'A flight-control interruption.'));
                accumulator = 0;
            }
            else {
                accumulator += elapsed * (developer?.rate ?? 1);
                let steps = 0;
                while (accumulator >= DT && status === 'running' && steps < 480) {
                    const keepStepping = simulationStep();
                    accumulator -= DT;
                    steps++;
                    if (!keepStepping) { accumulator = 0; break; }
                }
            }
        }
        const time = marathon ? marathon.total + (status === 'complete' ? 0 : run.time) : run.time;
        $('clock').textContent = format(time);
        if (now - lastHud > 80) {
            updateHud();
            lastHud = now;
        }
        if (now > toastUntil)
            $('toast').classList.remove('visible');
        if (simulation.render) simulation.render($('sea'),level,run,zoom,{settings,ghost:store.stage(level.id).ghost});
        else renderer.render({
            level, run, index, status, input, zoom, settings, ghost: store.stage(level.id).ghost, visualTime: now / 1000
        });
        audio.tick(run.ship, status === 'running' && developer?.rate !== 0, run.space, run.rampage, run.rail);
        requestAnimationFrame(frame);
    }
    updateSettings();
    loadStage(0);
    developer = HarborConsole.create({
        levels: LEVELS,
        quiet: new URLSearchParams(location.search).has('test'),
        state: () => ({ index, level, status, run, input }),
        load(i) { marathon = null; loadStage(i, true); },
        circuit: startMarathon,
        progress() {
            if (!marathon) return null;
            return { id: marathon.id, position: marathon.position + 1, length: marathon.route.length,
                completed: marathon.stages, retries: marathon.retries, practice: marathon.practice,
                time: marathon.total + (status === 'complete' ? 0 : run.time),
                splits: marathon.splits.map(s => ({ ...s })) };
        },
        practice: markPractice, advance: advanceSeconds, throttle, line: lineAction, rail: railCommand, convoy:convoyCommand,
        input(values) {
            for (const key of ['rudder', 'thruster', 'winch'])
                if (values[key] !== undefined) input[key] = values[key];
        },
        clearInput, hud: updateHud,
        resetClock() { accumulator = 0; lastFrame = null; },
        warp(x, y, a) {
            Object.assign(run.ship, { x, y, a: P.wrap(a), vx: 0, vy: 0, r: 0, engine: 0, throttle: 0, rudder: 0 });
            run.dockHold = 0; run.buoyHold = 0;
        },
        repair() { for (const body of [run.ship, ...(run.jobs?.bodies || []), run.space?.friendly, run.space?.mother, run.space?.second].filter(Boolean)) body.hull = 100; }
    });
    window.DeadSlow = developer.menu;
    requestAnimationFrame(frame);
    // Test-only harness, absent on normal launches. All shipped mechanics remain the same.
    if (new URLSearchParams(location.search).has('test')) {
        window.DeadSlowTest = {
            get state() {
                return {
                    index, level, status, modal, run, marathon, input, settings, storage: store.data
                };
            }, load(i, start = true) {
                marathon = null;
                loadStage(i, start);
            }, start: begin, advance: advanceSeconds, cheats: developer.menu, frame,
            setShip(values) {
                Object.assign(run.ship, values);
            }, railCommand, convoyCommand, polarAction, throttle, lineAction, signal, finish, pause: showPause, retry, requestRetry: retry, marathon: startMarathon, next: nextHarbor, format, zoom: zoomChart, hud: updateHud, courses: showCourses
        };
    }
})();
