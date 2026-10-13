/* Space presentation only. All geometry, shadows and target motion come from space.js. */
(function (root) {
    'use strict';
    const P = root.HarborPhysics, X = root.HarborSpace;
    const C = { ice: '#a6ece8', amber: '#efc27f', violet: '#bf9aef', white: '#e9edf1', dim: '#728298', rock: '#39414e', red: '#fa8a81' };
    function create(canvas) {
        const ctx = canvas.getContext('2d', { alpha: false });
        let scale = 1, width = 1, height = 1, dpr = 1, ox = 0, oy = 0;
        function path(points, fill, stroke, lw = 1, close = true) {
            ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            if (close) ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
        }
        function line(a, b, color, lw = 1) { path([a, b], null, color, lw, false); }
        function circle(x, y, r, fill, stroke, lw = 1) {
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
        }
        function text(str, x, y, color = C.dim, size = 9, align = 'center') {
            ctx.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
            ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x, y);
        }
        function arrow(a, b, color, lw = 1) {
            line(a, b, color, lw);
            const angle = Math.atan2(b.y - a.y, b.x - a.x), n = 5 / scale;
            path([b, { x: b.x - Math.cos(angle - .45) * n, y: b.y - Math.sin(angle - .45) * n },
                { x: b.x - Math.cos(angle + .45) * n, y: b.y - Math.sin(angle + .45) * n }], color, null);
        }
        function port(b, color, label) {
            if (!b) return;
            ctx.setLineDash([5 / scale, 5 / scale]);
            path(P.box(b.x, b.y, b.l, b.w, b.a || 0), color + '08', color + 'bb', 1.2 / scale);
            ctx.setLineDash([]);
            const a = P.localPoint(b, -b.l * .25, 0), z = P.localPoint(b, b.l * .27, 0);
            arrow(a, z, color + '99', .9 / scale);
            const q = P.localPoint(b, 0, b.w / 2 + 13 / scale);
            text(label, q.x, q.y, color, 9 / scale);
            if (Math.hypot(b.vx || 0, b.vy || 0) > .03) {
                const v = { x: b.x + (b.vx || 0) * 12, y: b.y + (b.vy || 0) * 12 };
                arrow(b, v, color + '55', .8 / scale);
            }
        }
        function vessel(s, color = C.white, jets = null, alpha = 1) {
            ctx.globalAlpha = alpha;
            const isMother = s.name?.includes('WAYWARDEN');
            if (isMother && s.beam > 40) path(P.hull(s), null, color + '66', .8 / scale);
            path(P.hull(isMother ? { ...s, beam: 28 } : s), '#171f32', color, 1.1 / scale);
            if (scale < .12) circle(s.x, s.y, 3 / scale, color, null);
            if (isMother) {
                for (const n of [-1, 1]) {
                    const p = P.localPoint(s, 0, n * 24);
                    path(P.box(p.x, p.y, s.length * .7, 12, s.a), '#54637c', C.ice + '88', .6 / scale);
                }
                path(P.box(s.x, s.y, s.length * .6, 13, s.a), '#717c8f', color, .8 / scale);
            } else {
                path([P.localPoint(s, -s.length * .2, -s.beam * .25), P.localPoint(s, s.length * .18, -s.beam * .28),
                    P.localPoint(s, s.length * .28, 0), P.localPoint(s, s.length * .18, s.beam * .28), P.localPoint(s, -s.length * .2, s.beam * .25)], '#90bdbd', null);
                for (const side of [-1, 1]) line(P.localPoint(s, -s.length * .43, side * s.beam * .4), P.localPoint(s, -s.length * .08, side * s.beam * .37), C.amber, 1 / scale);
            }
            if (jets) {
                const flame = (x, y, dx, dy, power) => {
                    if (Math.abs(power) < .01) return;
                    const p = P.localPoint(s, x, y), a = s.a + Math.atan2(dy, dx);
                    const len = 6 + 18 * Math.abs(power), side = 2.2;
                    path([{ x: p.x + Math.sin(a) * side, y: p.y - Math.cos(a) * side },
                        { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len },
                        { x: p.x - Math.sin(a) * side, y: p.y + Math.cos(a) * side }], '#efbc7baa', null);
                    circle(p.x, p.y, 1.7, C.white, null);
                };
                if (jets.main > 0) flame(-s.length / 2, 0, -1, 0, jets.main);
                else flame(s.length / 2, 0, 1, 0, jets.main);
                if (jets.side) flame(0, -Math.sign(jets.side) * s.beam / 2, 0, -Math.sign(jets.side), jets.side);
                if (jets.yaw) {
                    flame(s.length * .34, -Math.sign(jets.yaw) * s.beam / 2, 0, -Math.sign(jets.yaw), jets.yaw * .4);
                    flame(-s.length * .34, Math.sign(jets.yaw) * s.beam / 2, 0, Math.sign(jets.yaw), jets.yaw * .4);
                }
            }
            ctx.globalAlpha = 1;
        }
        function render(view) {
            const rect = canvas.getBoundingClientRect();
            width = Math.max(1, rect.width); height = Math.max(1, rect.height);
            dpr = Math.min(root.devicePixelRatio || 1, 2);
            if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
                canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
            }
            const { level: l, run: r } = view, st = r.space, cfg = l.space, s = r.ship;
            const top = height < 400 ? 107 : 146, bottom = cfg.century ? 96 : 64;
            const W = l.world[0], H = l.world[1], long = W > 2200;
            const overview = cfg.century && view.zoom === 2.3;
            const localW = overview ? W : Math.min(W, cfg.century ? 1600 : 2100);
            const localH = cfg.century && !overview ? 1050 : H;
            scale = Math.min((width - 48) / localW, (height - top - bottom) / localH) * (overview ? 1 : view.zoom);
            scale = Math.max(.002, scale);
            let cx = W / 2, cy = H / 2;
            if (long && !overview || view.zoom > 1 && !overview) {
                const halfW = (width - 36) / scale / 2, halfH = (height - top - bottom) / scale / 2;
                cx = halfW < W / 2 ? P.clamp(s.x + (long ? localW * .17 : 0), halfW, W - halfW) : W / 2;
                cy = halfH < H / 2 ? P.clamp(s.y, halfH, H - halfH) : H / 2;
            }
            ox = width / 2 - cx * scale; oy = top + (height - top - bottom) / 2 - cy * scale;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const background = ctx.createRadialGradient(width * .2, height * .4, 0, width * .4, height * .5, width);
            background.addColorStop(0, '#172339'); background.addColorStop(.52, '#101624'); background.addColorStop(1, '#070b14');
            ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
            for (let i = 0; i < 175; i++) {
                const x = ((Math.sin(i * 137.21 + 1) * 9371 - cx * .02) % width + width) % width;
                const y = ((Math.cos(i * 89.73 + 3) * 7173 - cy * .02) % height + height) % height;
                circle(x, y, i % 11 === 0 ? 1.05 : .55, i % 5 === 0 ? '#e8c58c70' : '#ccd8ee55', null);
            }
            ctx.translate(ox, oy); ctx.scale(scale, scale);
            const minX = -ox / scale, maxX = (width - ox) / scale;
            const minY = -oy / scale, maxY = (height - oy) / scale;
            const grid = overview ? 10000 : 100;
            for (let x = Math.floor(minX / grid) * grid; x < maxX; x += grid) line({ x, y: minY }, { x, y: maxY }, '#9aaec50b', .7 / scale);
            for (let y = Math.floor(minY / grid) * grid; y < maxY; y += grid) line({ x: minX, y }, { x: maxX, y }, '#9aaec50b', .7 / scale);
            if (cfg.flare || cfg.solar) {
                const ray = st.flare.active ? '#f9ba7045' : '#d6bd7512';
                for (let y = minY; y < maxY; y += 27 / scale) line({ x: minX, y }, { x: maxX, y }, ray, 1 / scale);
                for (const b of st.rocks) {
                    const topP = b.poly.reduce((a, p) => a.y < p.y ? a : p), botP = b.poly.reduce((a, p) => a.y > p.y ? a : p);
                    path([topP, { x: Math.max(maxX, W), y: topP.y }, { x: Math.max(maxX, W), y: botP.y }, botP], '#050a15c9', null);
                    line(topP, { x: W, y: topP.y }, '#7789b234', .6 / scale);
                    line(botP, { x: W, y: botP.y }, '#7789b234', .6 / scale);
                }
            }
            // The station's visible plates are precisely its collision rectangles.
            for (const b of st.structures || []) {
                path(b.poly, '#273348', '#7f92ab', 1 / scale);
                path(P.rect({x:b.x+5,y:b.y+5,w:b.w-10,h:b.h-10}), '#172235', '#40516c', .7 / scale);
                const horizontal = b.w > b.h;
                for (let u = 18; u < (horizontal ? b.w : b.h) - 8; u += 38) {
                    const x = b.x + (horizontal ? u : 9), y = b.y + (horizontal ? 9 : u);
                    line({x,y}, {x:x+(horizontal?10:0),y:y+(horizontal?0:10)}, '#85c7ca', 1.2 / scale);
                }
            }
            if (cfg.station) {
                text(cfg.station.name, W/2, 65, C.dim, 10/scale);
                for (const b of cfg.station.bays) {
                    ctx.setLineDash([3/scale,6/scale]);
                    path(P.box(b.x,b.y,100,62,0), '#a6ece806', '#a6ece83c', .8/scale);
                    ctx.setLineDash([]);
                    text(b.label,b.x,b.y+45,C.dim,8/scale);
                }
            }
            if (cfg.blackout) {
                const b = cfg.blackout;
                path(P.rect(b), '#9881d319', '#b799e56b', 1 / scale);
                for (let y = b.y + 15; y < b.y + b.h; y += 28) {
                    line({ x: b.x - 6, y }, { x: b.x + 7, y }, C.violet, 2 / scale);
                    line({ x: b.x + b.w - 7, y }, { x: b.x + b.w + 6, y }, C.violet, 2 / scale);
                }
                text('THRUSTER BLACKOUT', b.x + b.w / 2, b.y - 13, C.violet, 10 / scale);
            }
            for (const b of st.rocks) {
                // Outbound objects keep drifting off-chart; no wrap or reversal.
                if (b.x+b.radius < minX || b.x-b.radius > maxX || b.y+b.radius < minY || b.y-b.radius > maxY) continue;
                if (b.planet) {
                    ctx.save();
                    path(b.poly, null, null); ctx.clip();
                    const surface = ctx.createRadialGradient(b.x-b.radius*.62,b.y-b.radius*.36,b.radius*.03,b.x-b.radius*.4,b.y,b.radius*1.6);
                    surface.addColorStop(0,'#677185'); surface.addColorStop(.32,'#343b50');
                    surface.addColorStop(.6,'#141929'); surface.addColorStop(1,'#030710');
                    ctx.fillStyle=surface; ctx.fillRect(b.x-b.radius,b.y-b.radius,b.radius*2,b.radius*2);
                    ctx.restore();
                    path(b.poly,null,'#8497bb88',1/scale);
                    text(b.id,b.x,b.y+b.radius+20/scale,C.violet,11/scale);
                    continue;
                }
                path(b.poly, C.rock, '#808995', 1 / scale);
                if (Math.hypot(b.vx,b.vy) > .01) arrow(b, {x:b.x+b.vx*60,y:b.y+b.vy*60},C.dim+'88',.8/scale);
                // Small craters stay inside the actual collision silhouette.
                for (let i = 0; i < 5; i++) {
                    const a = i * 2.4 + b.x, d = b.radius * (.15 + (i % 3) * .16);
                    circle(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, b.radius * (.10 + (i % 2) * .045), '#232d3c', '#63707c88', .6 / scale);
                }
                if (b.drone) {
                    circle(b.x, b.y, b.radius * .43, '#c9a76d', null);
                    text('MAINT.', b.x, b.y + b.radius + 14 / scale, C.amber, 8 / scale);
                } else text((b.label || b.id).toUpperCase(), b.x, b.y + b.radius + 16 / scale, C.dim, 9 / scale);
            }
            if (cfg.landing) {
                const rock = st.rocks.find(b => b.id === cfg.landing.asteroid);
                // A recessed service mast joins the rock to its cantilevered landing cradle.
                line(rock, st.port, '#8a9bab66', 3 / scale);
                circle(st.port.x, st.port.y, 4 / scale, null, C.ice + '88', .8 / scale);
            }
            port(st.port, C.ice, cfg.landing ? 'SURVEY CRADLE · MATCH VELOCITY' : cfg.century ? 'NEAREST SYSTEM' : 'SPACEPORT');
            if (st.depot && !st.refuelled) port(st.depot, C.amber, st.depot.label || 'TANKER · SIX SECOND HOLD');
            if (cfg.rescue) port(cfg.rescue, st.rescued ? C.ice : C.amber, st.rescued ? 'FRIENDLY SECURED' : 'RESCUE CAPTURE');
            if (st.mother) {
                if (st.phase < 2) {
                    vessel(st.mother, C.dim);
                    port(X.activeTarget(l, r), C.amber, 'TENDER CAPTURE ' + (st.phase + 1));
                    if (st.phase === 0) vessel(st.second, C.dim);
                }
            }
            if (cfg.firing) {
                port({ ...cfg.firing, a: st.aim || cfg.firing.a }, st.targetHit ? C.dim : C.amber, 'FIRING POSITION');
                if (!st.targetHit) {
                    vessel(st.target, C.red);
                    const q = st.lead, size = 8 / scale;
                    path([{ x: q.x, y: q.y - size }, { x: q.x + size, y: q.y }, { x: q.x, y: q.y + size }, { x: q.x - size, y: q.y }], null, C.amber, 1 / scale);
                    ctx.setLineDash([4 / scale, 7 / scale]);
                    line(s, { x: s.x + Math.cos(s.a) * 410, y: s.y + Math.sin(s.a) * 410 }, '#efc27f50', 1 / scale);
                    ctx.setLineDash([]);
                    text('LEAD · ' + st.target.name, q.x, q.y - 18 / scale, C.red, 9 / scale);
                } else {
                    circle(st.target.x, st.target.y, 20, null, '#c8976e55', 1 / scale);
                    text('TARGET DISABLED', st.target.x, st.target.y - 30, C.dim, 9 / scale);
                }
                for (const shot of st.shots) {
                    line({ x: shot.x - shot.vx * .09, y: shot.y - shot.vy * .09 }, shot, C.amber, 2 / scale);
                    circle(shot.x, shot.y, 2 / scale, C.white, null);
                }
            }
            if (cfg.survey && !st.surveyed) {
                circle(cfg.survey.x, cfg.survey.y, cfg.survey.r, '#efc27f06', '#efc27f85', 1 / scale);
                text(cfg.survey.name.toUpperCase(), cfg.survey.x, cfg.survey.y - cfg.survey.r - 10 / scale, C.amber, 9 / scale);
            }
            if (X.gates(cfg).length) {
                for (const [i, gate] of X.gates(cfg).entries()) {
                    const color = i === st.phase ? C.amber : C.violet;
                    const destination = { ...gate, x:gate.destination[0], y:gate.destination[1] };
                    port(gate, color, `${gate.id} → ${gate.id}′${i < st.phase ? ' · RECORDED' : ''}`);
                    port(destination, C.violet, `${gate.id}′ · ARRIVAL`);
                    ctx.setLineDash([2/scale,12/scale]);
                    line(gate,destination,'#bf9aef28',.7/scale); ctx.setLineDash([]);
                    circle(destination.x,destination.y,6/scale,null,C.violet,1/scale);
                }
                for (const history of st.histories) {
                    ctx.setLineDash([2/scale,8/scale]);
                    path(history.loop.filter((_,i)=>i%30===0).map(p=>({x:p[1],y:p[2]})),null,'#ba91e92b',1/scale,false);
                    ctx.setLineDash([]);
                }
                for (const echo of st.echoes) {
                    vessel(echo,C.violet,null,.85);
                    text(`PAST ${echo.id} · SOLID`,echo.x,echo.y-23,C.violet,9/scale);
                    arrow(echo,{x:echo.x+echo.vx*10,y:echo.y+echo.vy*10},C.violet+'99',.8/scale);
                }
            }
            if (st.friendly) {
                vessel(st.friendly, st.rescued ? C.ice : C.amber);
                if (!st.rescued && Math.hypot(st.friendly.vx, st.friendly.vy) > .05) arrow(st.friendly, { x: st.friendly.x + st.friendly.vx * 8, y: st.friendly.y + st.friendly.vy * 8 }, C.ice, 1 / scale);
                if (st.beam) {
                    const color = st.beamForce > 0 ? C.violet : st.beamForce < 0 ? C.ice : C.dim;
                    line(s, st.friendly, color + '20', 9 / scale);
                    ctx.setLineDash(st.beamForce ? [] : [4 / scale, 5 / scale]);
                    line(s, st.friendly, color, 1.3 / scale); ctx.setLineDash([]);
                    if (st.beamForce > 0) arrow(s, st.friendly, color, 1 / scale);
                    else if (st.beamForce < 0) arrow(st.friendly, s, color, 1 / scale);
                }
                text(st.friendly.name, st.friendly.x, st.friendly.y - 22, C.amber, 9 / scale);
            }
            if (view.settings.guide) {
                ctx.setLineDash([3 / scale, 5 / scale]);
                line(s, { x: s.x + s.vx * 12, y: s.y + s.vy * 12 }, '#e9edf180', 1 / scale); ctx.setLineDash([]);
                circle(s.x + s.vx * 12, s.y + s.vy * 12, 2 / scale, C.white, null);
            }
            if (view.settings.ghost && view.ghost.length) {
                const frames = view.ghost, t = r.time;
                let lo = 0, hi = frames.length - 1;
                while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (frames[m][0] < t) lo = m; else hi = m; }
                if (t <= frames[hi][0]) {
                    const a = frames[lo], b = frames[hi], u = P.clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1);
                    vessel({ ...s, x: P.lerp(a[1], b[1], u), y: P.lerp(a[2], b[2], u), a: a[3] + P.wrap(b[3] - a[3]) * u }, C.ice, null, .2);
                }
            }
            // Radar is a cosmetic instrument pulse on presentation time. It never
            // changes ephemerides, collision state, fuel, objective progress or IGT.
            const pulse = r.radarPulse, age = pulse ? view.visualTime - pulse.at : -1;
            if (age >= 0 && age < 1.1) {
                const radius = age / 1.1 * Math.max(230, 280 / scale);
                ctx.save();
                ctx.globalAlpha = .65 * (1 - age / 1.1);
                circle(pulse.x, pulse.y, radius, null, C.ice, 1.6 / scale);
                if (radius > 14 / scale) {
                    ctx.globalAlpha *= .4;
                    circle(pulse.x, pulse.y, radius - 12 / scale, null, C.ice, .8 / scale);
                }
                for (const target of [...st.rocks, st.port, st.depot, st.target, st.friendly, st.mother, st.second].filter(Boolean)) {
                    const range = Math.hypot(target.x - pulse.x, target.y - pulse.y);
                    if (Math.abs(range - radius) < 28 / scale) {
                        ctx.globalAlpha = .7 * (1 - Math.abs(range - radius) * scale / 28);
                        circle(target.x, target.y, 7 / scale, null, C.ice, 1.2 / scale);
                    }
                }
                ctx.restore();
            }
            vessel(s, C.white, view.status === 'running' ? st.firingJets : null);
            for (const tender of st.tenders || []) {
                const p = P.localPoint(st.mother, 0, tender.offset);
                line(st.mother, p, C.dim, 2 / scale);
                vessel({ ...tender, ...p, a: st.mother.a }, C.ice);
            }
            if (Math.hypot(s.vx, s.vy) > .05) arrow(s, { x: s.x + s.vx * 5, y: s.y + s.vy * 5 }, C.ice, 1 / scale);
            for (const fx of r.effects) circle(fx.x, fx.y, 3 + (r.time - fx.t) * 15, null, C.red, 1 / scale);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Offscreen destination bearing, independent of chart zoom.
            const target = st.activeDock || st.port, tx = ox + target.x * scale, ty = oy + target.y * scale;
            if (tx < 25 || tx > width - 25 || ty < top || ty > height - bottom) {
                const x = P.clamp(tx, 28, width - 28), y = P.clamp(ty, top + 12, height - bottom - 12);
                circle(x, y, 6, null, C.amber, 1);
                text((Math.hypot(target.x - s.x, target.y - s.y) / 1000).toFixed(2) + ' km', x, y - 13, C.amber, 10,
                    x > width / 2 ? 'right' : 'left');
            }
            if (long) {
                const left = 34, right = width - 34, y = height - 73, ratio = P.clamp((s.x - l.start[0]) / (st.port.x - l.start[0]), 0, 1);
                line({ x: left, y }, { x: right, y }, '#8ea7bf55', 1);
                circle(left + (right - left) * ratio, y, 3.5, C.ice, null);
                circle(right, y, 4, null, C.amber, 1);
                const planet = st.rocks.find(b=>b.planet);
                if (planet) {
                    const px=left+(right-left)*(planet.x-l.start[0])/(st.port.x-l.start[0]);
                    circle(px,y,5,'#51546f',C.violet,1);
                    text('EREBUNE',px,y+16,C.violet,8);
                }
                text(`${(Math.max(0, st.port.x - s.x) / 1000).toFixed(2)} km REMAINING`, left, y - 12, C.dim, 9, 'left');
                text(cfg.century ? 'CENTURY · BONUS / NOT A MARATHON STAGE' : 'SECTOR TRACK', right, y - 12, C.dim, 9, 'right');
            }
            const edge = Math.min(s.x - s.length / 2, s.y - s.length / 2, W - s.x - s.length / 2, H - s.y - s.length / 2);
            if (edge < 35) text('SECTOR LIMIT · TURN BACK', width / 2, height - 48, C.red, 11);
        }
        return { render, get scale() { return scale; } };
    }
    root.HarborSpaceRenderer = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
