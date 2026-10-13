(function (root) {
    'use strict';
    const P = root.HarborPhysics, N = root.HarborNavigation, J = root.HarborJobs;
    const DAY = {
        water: '#123641', grid: '#315762', land: '#597175', edge: '#9aa9a0', green: '#7ce7b9', amber: '#ffbc75', muted: '#95b6bd', white: '#e6eeee', red: '#ff817a'
    };
    const NIGHT = {
        water: '#142338', grid: '#354568', land: '#525d75', edge: '#a0b2cc', green: '#85deef', amber: '#ffc383', muted: '#a8b5d1', white: '#e6edf7', red: '#ff8586'
    };
    const ARCHIPELAGO = {
        water: '#487f85', grid: '#79a5a3', land: '#858f78', edge: '#d6d8b9', green: '#d7edac', amber: '#ffe2a0', muted: '#d6e4d4', white: '#f6f1dc', red: '#ffc0a3'
    };
    function create(canvas) {
        const spaceRenderer = root.HarborSpaceRenderer.create(canvas);
        const gerboRenderer = root.GerboView.createRenderer(canvas);
        let inSpace = false, inRampage = false;
        const ctx = canvas.getContext('2d', { alpha: false });
        let C = DAY, night = false, islands = false;
        let width = 1, height = 1, dpr = 1, scale = 1, ox = 0, oy = 0;
        function resize() {
            const r = canvas.getBoundingClientRect(), p = Math.min(root.devicePixelRatio || 1, 2);
            if (r.width !== width || r.height !== height || p !== dpr || canvas.width !== Math.round(r.width*p) || canvas.height !== Math.round(r.height*p)) {
                width = r.width;
                height = r.height;
                dpr = p;
                canvas.width = Math.round(width * p);
                canvas.height = Math.round(height * p);
            }
        }
        function line(points, color, lineWidth = 1, dash = []) {
            ctx.beginPath();
            points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.setLineDash(dash);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        function polygon(points, fill, stroke = null, lw = .5) {
            ctx.beginPath();
            points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.closePath();
            if (fill) {
                ctx.fillStyle = fill;
                ctx.fill();
            }
            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.stroke();
            }
        }
        function text(t, x, y, color = C.muted, size = 4, align = 'center') {
            ctx.fillStyle = color;
            ctx.font = `500 ${size}px ui-monospace,Consolas,monospace`;
            ctx.textAlign = align;
            ctx.textBaseline = 'middle';
            ctx.fillText(t, x, y);
        }
        function circle(x, y, r, fill, stroke = null, lw = .6) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, P.TAU);
            if (fill) {
                ctx.fillStyle = fill;
                ctx.fill();
            }
            if (stroke) {
                ctx.strokeStyle = stroke;
                ctx.lineWidth = lw;
                ctx.stroke();
            }
        }
        function hatch(r, color, spacing = 6) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            ctx.strokeStyle = color;
            ctx.lineWidth = .6;
            ctx.beginPath();
            for (let i = -r.h; i < r.w + r.h; i += spacing) {
                ctx.moveTo(r.x + i, r.y + r.h);
                ctx.lineTo(r.x + i + r.h, r.y);
            }
            ctx.stroke();
            ctx.restore();
        }
        function pier(r) {
            if (islands && r.material === 'wood') {
                ctx.fillStyle = '#264e4666';
                ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
                ctx.fillStyle = '#b0a67e';
                ctx.fillRect(r.x, r.y, r.w, r.h);
                ctx.strokeStyle = '#e6d9ad';
                ctx.lineWidth = .65;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
                hatch(r, '#7d826333', 3);
                ctx.save();
                ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
                if (r.h > r.w * 1.3)
                    ctx.rotate(-Math.PI / 2);
                text(r.label || 'PIER', 0, 0, '#344e45', Math.min(3, Math.min(r.w, r.h) * .25));
                ctx.restore();
                return;
            }
            ctx.fillStyle = '#06233077';
            ctx.fillRect(r.x + 2, r.y + 2, r.w, r.h);
            ctx.fillStyle = C.land;
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = C.edge;
            ctx.lineWidth = .6;
            ctx.strokeRect(r.x + .25, r.y + .25, r.w - .5, r.h - .5);
            ctx.strokeStyle = night ? '#7984a2' : '#72878a';
            ctx.lineWidth = .3;
            ctx.beginPath();
            if (r.w > r.h) {
                for (let x = r.x + 12; x < r.x + r.w; x += 12) {
                    ctx.moveTo(x, r.y + 1);
                    ctx.lineTo(x, r.y + r.h - 1);
                }
            }
            else {
                for (let y = r.y + 12; y < r.y + r.h; y += 12) {
                    ctx.moveTo(r.x + 1, y);
                    ctx.lineTo(r.x + r.w - 1, y);
                }
            }
            ctx.stroke();
            if (r.w > r.h) {
                for (let x = r.x + 5; x < r.x + r.w - 2; x += 13) {
                    circle(x, r.y + 1.8, .85, '#1d3d43');
                    circle(x, r.y + r.h - 1.8, .85, '#1d3d43');
                }
            }
            else {
                for (let y = r.y + 5; y < r.y + r.h - 2; y += 13) {
                    circle(r.x + 1.8, y, .85, '#1d3d43');
                    circle(r.x + r.w - 1.8, y, .85, '#1d3d43');
                }
            }
            if (night) {
                // Dock floodlights are decorative; all concrete still uses the same geometry.
                const lamps = r.w > r.h ? Math.floor(r.w / 28) : Math.floor(r.h / 28);
                for (let i = 0; i < lamps; i++) {
                    const x = r.w > r.h ? r.x + 14 + i * 28 : r.x + 1.8, y = r.w > r.h ? r.y + 1.8 : r.y + 14 + i * 28;
                    circle(x, y, 4, '#ffe4ac12');
                    circle(x, y, 1.5, '#ffd38f44');
                    circle(x, y, .65, '#ffe1a2');
                }
                if (r.label && r.w > 46 && r.h < 24) {
                    ctx.save();
                    ctx.globalAlpha = .45;
                    hatch({ x: r.x + r.w - 9, y: r.y + 1, w: 7, h: r.h - 2 }, '#eacb8b', 4);
                    ctx.restore();
                }
            }
            if (r.label) {
                ctx.save();
                ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
                if (r.h > r.w * 2)
                    ctx.rotate(-Math.PI / 2);
                text(r.label, 0, 0, '#d6ddd1', Math.min(3.1, Math.min(r.w, r.h) * .25));
                ctx.restore();
            }
        }
        function buoy(b, i, run) {
            const done = i < run.buoyIndex, active = i === run.buoyIndex, color = done ? C.green : active ? C.amber : '#75969f';
            ctx.save();
            ctx.globalAlpha = done ? .37 : active ? .85 : .45;
            ctx.setLineDash([2.4, 2.4]);
            circle(b.x, b.y, b.r, done ? '#70e9b509' : '#ffc07507', color, .5);
            ctx.setLineDash([]);
            circle(b.x, b.y, 2.8, '#0b2c37', color, .6);
            text(done ? '✓' : String(i + 1), b.x, b.y + .1, color, 3.1);
            text(b.cargo ? 'LOAD' : b.hold ? 'PILOT' : 'COURSE', b.x, b.y - b.r - 3, color, 3);
            if (active && b.hold && run.buoyHold > 0) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + P.TAU * run.buoyHold / b.hold);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
            ctx.restore();
        }
        function vessel(s, { ghost = false, traffic = false, loaded = false, engine = 0, work = null } = {}) {
            if (ghost) {
                polygon(P.hull(s), null, '#7ce7b988', .55);
                line([P.localPoint(s, -s.length / 2, 0), P.localPoint(s, s.length / 2, 0)], '#7ce7b955', .4, [1, 2]);
                return;
            }
            if (!ghost && s.vessel) {
                workVessel(s, work);
                return;
            }
            ctx.save();
            ctx.translate(1.3, 1.5);
            polygon(P.hull(s), '#021b2766');
            ctx.restore();
            polygon(P.hull(s), traffic ? '#c0b695' : '#d9ddd0', traffic ? '#eee0b9' : '#f0f0de', .6);
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.a);
            const l = s.length, b = s.beam;
            polygon([
                { x: -l * .44, y: -b * .36 }, { x: l * .2, y: -b * .38 }, { x: l * .40, y: 0 }, { x: l * .2, y: b * .38 }, { x: -l * .44, y: b * .36 }
            ], traffic ? '#7a8a7c' : '#3f6366');
            if (!traffic) {
                for (let row = -1; row <= 1; row += 2)
                    for (let j = 0; j < (loaded ? 3 : 2); j++) {
                        const x = -2.5 + j * 4.2, y = row < 0 ? -3.15 : .4, w = 3.4, h = 2.75;
                        ctx.fillStyle = j === 2 ? '#d7b877' : row < 0 ? '#db8e66' : '#cfaa70';
                        ctx.fillRect(x, y, w, h);
                        ctx.strokeStyle = '#624f3844';
                        ctx.lineWidth = .35;
                        for (let k = 1; k < 4; k++) {
                            ctx.beginPath();
                            ctx.moveTo(x + k * .7, y + .3);
                            ctx.lineTo(x + k * .7, y + h - .3);
                            ctx.stroke();
                        }
                    }
            }
            ctx.fillStyle = '#eeeade';
            ctx.fillRect(-l * .37, -b * .38, l * .19, b * .76);
            ctx.fillStyle = '#274553';
            ctx.fillRect(-l * .205, -b * .3, l * .025, b * .6);
            ctx.fillStyle = '#93a6a4';
            ctx.fillRect(-l * .34, -b * .2, l * .09, b * .4);
            ctx.fillStyle = traffic ? '#d0a568' : '#df9267';
            ctx.fillRect(-l * .31, -b * .12, l * .04, b * .24);
            ctx.strokeStyle = '#f1ecce';
            ctx.lineWidth = .35;
            ctx.beginPath();
            ctx.moveTo(l * .31, -b * .17);
            ctx.lineTo(l * .31, b * .17);
            ctx.moveTo(l * .26, 0);
            ctx.lineTo(l * .4, 0);
            ctx.stroke();
            circle(-l * .43, 0, .8, '#293f43');
            const speed = Math.hypot(s.vx || 0, s.vy || 0);
            if (speed > .3) {
                ctx.strokeStyle = `rgba(225,241,229,${Math.min(.5, speed * .10)})`;
                ctx.lineWidth = .45;
                for (const sign of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(l * .52, sign * .6);
                    ctx.quadraticCurveTo(l * .35, sign * b * .65, l * .10, sign * b * .65);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
        function berth(b, run, index) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.a);
            ctx.fillStyle = run.dockHold > 0 ? C.green + '22' : C.green + '0b';
            ctx.fillRect(-b.l / 2, -b.w / 2, b.l, b.w);
            ctx.strokeStyle = run.dock.ready ? C.green : C.green + '8a';
            ctx.lineWidth = .7;
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(-b.l / 2, -b.w / 2, b.l, b.w);
            ctx.setLineDash([]);
            for (const sx of [-1, 1])
                for (const sy of [-1, 1])
                    line([
                        { x: sx * (b.l / 2 - 3), y: sy * b.w / 2 }, { x: sx * b.l / 2, y: sy * b.w / 2 }, { x: sx * b.l / 2, y: sy * (b.w / 2 - 3) }
                    ], C.green, 1);
            line([
                { x: -6, y: 0 }, { x: 8, y: 0 }, { x: 5, y: -2 }
            ], '#82cfa5bb', .5);
            line([
                { x: 8, y: 0 }, { x: 5, y: 2 }
            ], '#82cfa5bb', .5);
            const ghostShip = {
                x: 0, y: 0, a: 0, length: run.ship.length, beam: run.ship.beam, vessel: run.ship.vessel
            };
            polygon(P.hull(ghostShip), null, '#79ac8e55', .35);
            ctx.restore();
            text(islands ? 'YOUR FINAL BERTH' : `BERTH ${String(index + 1).padStart(2, '0')}`, b.x, b.y - b.w / 2 - 7, C.green, 3.5);
            if (run.dockHold > 0) {
                circle(b.x, b.y, b.l * .6, null, '#75e6ba30', .6);
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.l * .6, -Math.PI / 2, -Math.PI / 2 + P.TAU * run.dockHold / 2);
                ctx.strokeStyle = C.green;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        function tree(x, y, r = 3) {
            circle(x + .8, y + 1, r, '#244a4244');
            polygon([
                { x: x, y: y - r * 1.5 }, { x: x + r * .8, y: y + r * .6 }, { x: x - r * .8, y: y + r * .6 }
            ], '#345e4c');
            polygon([
                { x: x, y: y - r * .95 }, { x: x + r * .65, y: y + r * .8 }, { x: x - r * .65, y: y + r * .8 }
            ], '#4b7156');
        }
        function cabin(x, y, w = 9, h = 6, a = 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);
            ctx.fillStyle = '#294d4140';
            ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w, h);
            ctx.fillStyle = '#a95645';
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeStyle = '#f5dfb9';
            ctx.lineWidth = .65;
            ctx.strokeRect(-w / 2, -h / 2, w, h);
            line([
                { x: -w / 2, y: 0 }, { x: w / 2, y: 0 }
            ], '#723f39', .9);
            ctx.fillStyle = '#eadbbb';
            ctx.fillRect(w / 2 - 2, -h / 2 + .7, 1, 1.3);
            ctx.fillRect(w / 2 - 2, h / 2 - 2, 1, 1.3);
            ctx.fillStyle = '#5b6256';
            ctx.fillRect(-2, -h / 2 - 1, 1.6, 1.4);
            ctx.restore();
        }
        function drawIsland(z) {
            const outer = z.poly.map(p => ({ x: z.x + (p.x - z.x) * 1.07, y: z.y + (p.y - z.y) * 1.07 }));
            polygon(outer, '#c9d7bd13', '#e9ecd05c', .6);
            polygon(z.poly, '#a4ab93', '#d9dec1', 1.1);
            const inner = z.poly.map(p => ({ x: z.x + (p.x - z.x) * .80, y: z.y + (p.y - z.y) * .78 }));
            polygon(inner, '#748a68');
            let seed = z.seed || 1;
            const random = () => {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed / 4294967296;
            };
            for (let k = 0; k < 32; k++) {
                const theta = random() * P.TAU, rad = Math.sqrt(random()) * .67, x = z.x + Math.cos(theta) * z.rx * rad, y = z.y + Math.sin(theta) * z.ry * rad;
                if (k % 5 === 0) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.scale(1, .7);
                    circle(0, 0, 1.5 + random() * 1.7, '#b9bca0', '#d3d3b3', .3);
                    ctx.restore();
                }
                else
                    tree(x, y, 2.2 + random() * 1.8);
            }
            if (z.name) {
                cabin(z.x + z.rx * .33, z.y + z.ry * .29, 9, 6, .12);
                cabin(z.x - z.rx * .2, z.y + z.ry * .38, 7, 5, -.09);
                text(z.name.toUpperCase(), z.x, z.y - z.ry * .31, '#f6f0d4', 3.2);
            }
        }
        function car(x, y, a, v, alpha = 1) {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y);
            ctx.rotate(a);
            const l = v.length || 4.6, w = v.kind === 'bus' ? 2.8 : 2.3;
            ctx.fillStyle = '#263d3c';
            ctx.fillRect(-l / 2 + .6, -w / 2 - .3, 1, .5);
            ctx.fillRect(l / 2 - 1.6, -w / 2 - .3, 1, .5);
            ctx.fillRect(-l / 2 + .6, w / 2 - .2, 1, .5);
            ctx.fillRect(l / 2 - 1.6, w / 2 - .2, 1, .5);
            ctx.fillStyle = v.color || '#ead2a4';
            ctx.fillRect(-l / 2, -w / 2, l, w);
            ctx.fillStyle = '#31515c';
            ctx.fillRect(-l * .22, -w * .39, l * .4, w * .78);
            ctx.fillStyle = '#e6e4cc';
            ctx.fillRect(l * .42, -w * .4, .4, .5);
            ctx.fillRect(l * .42, w * .2, .4, .5);
            ctx.restore();
        }
        function workVessel(s, work) {
            ctx.save();
            ctx.translate(1.2, 1.8);
            polygon(P.hull(s), '#143d465c');
            ctx.restore();
            const ferry = s.vessel === 'ferry', tug = s.vessel === 'tug', sauna = s.vessel === 'sauna', barge = s.vessel === 'barge';
            polygon(P.hull(s), ferry ? '#ecd184' : tug ? '#cf6650' : barge ? '#687d73' : '#f0e8cb', ferry ? '#fff0bb' : '#fff2d2', .6);
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.a);
            const l = s.length, b = s.beam;
            ctx.fillStyle = ferry ? '#737e75' : tug ? '#385951' : barge ? '#8d9581' : '#a29f84';
            ctx.fillRect(-l * .4, -b * .37, l * .75, b * .74);
            if (ferry) {
                for (const y of [-b * .29, b * .29])
                    line([
                        { x: -l * .42, y }, { x: l * .42, y }
                    ], '#e8dba044', .3, [1, 1.2]);
                ctx.fillStyle = '#e9d59a';
                ctx.fillRect(-l * .26, -b * .47, l * .24, b * .16);
                ctx.fillStyle = '#435d5d';
                ctx.fillRect(-l * .2, -b * .45, l * .14, b * .1);
                for (const end of [-1, 1]) {
                    ctx.fillStyle = '#caad64';
                    ctx.fillRect(end > 0 ? l * .44 : -l * .53, -b * .26, l * .09, b * .52);
                    line([
                        { x: end * l * .47, y: -b * .24 }, { x: end * l * .47, y: b * .24 }
                    ], '#fff1bd', .7);
                }
                const unloading = work?.ramp === 1 && work.transfer > 0 && !work.closing && work.activeRamp?.type === 'unload';
                (work?.onboard || []).forEach((v, i) => {
                    // The departing vehicle is drawn on the ramp, not twice.
                    if (unloading && i === 0) return;
                    car(-l * .24 + Math.floor(i / 2) * l * .24, i % 2 === 0 ? -b * .16 : b * .19, 0, v);
                });
                if (work?.ramp > 0) {
                    const end = work.activeRamp?.rampEnd || 1;
                    ctx.fillStyle = '#ddd097';
                    ctx.fillRect(end > 0 ? l * .48 : -l * .48 - 5 * work.ramp, -b * .26, 5 * work.ramp, b * .52);
                }
                // The next car actually moves along the end ramp as its transfer timer runs.
                if (work?.ramp === 1 && work.transfer > 0 && !work.closing) {
                    const job = work.activeRamp, k = work.transfer / 1.05, load = job.type === 'load', end = job.rampEnd || 1;
                    const v = load ? { kind: job.vehicles[work.transferred], ...(J.VEHICLES[job.vehicles[work.transferred]] || J.VEHICLES.car), color: J.COLORS[work.stats.vehiclesLoaded % 6] } : work.onboard[0];
                    if (v)
                        car(end * (l * .63 - (load ? k : 1 - k) * l * .25), 0, end === 1 ? Math.PI : 0, v);
                }
            }
            else if (tug) {
                ctx.fillStyle = '#f3e3b7';
                ctx.fillRect(-l * .02, -b * .32, l * .28, b * .64);
                ctx.fillStyle = '#365761';
                ctx.fillRect(l * .21, -b * .27, l * .04, b * .54);
                circle(-l * .30, 0, 2.1, '#303d3e', '#d2b879', .65);
                line([
                    { x: -l * .33, y: 0 }, { x: -l * .47, y: 0 }
                ], '#e4cd95', .8);
                for (const x of [-l * .35, l * .24])
                    for (const y of [-b * .47, b * .47])
                        circle(x, y, 1, '#263938');
            }
            else if (sauna) {
                cabin(-1, 0, l * .49, b * .66);
                ctx.fillStyle = '#d9c490';
                ctx.fillRect(l * .28, -b * .30, l * .1, b * .60);
                for (let y = -b * .26; y < b * .28; y += 1.3)
                    line([
                        { x: l * .28, y }, { x: l * .38, y }
                    ], '#756b50', .3);
            }
            else if (barge) {
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = i % 2 ? '#bbc0a4' : '#778f83';
                    ctx.fillRect(-l * .29 + i * l * .16, -b * .27, l * .12, b * .54);
                    line([
                        { x: -l * .29 + i * l * .16, y: -b * .27 }, { x: -l * .17 + i * l * .16, y: b * .27 }
                    ], '#c8cfb1', .45);
                }
            }
            else {
                ctx.fillStyle = '#f1e7ca';
                ctx.fillRect(-l * .20, -b * .32, l * .39, b * .64);
                ctx.fillStyle = '#4c727a';
                ctx.fillRect(l * .11, -b * .24, l * .05, b * .48);
                ctx.fillStyle = '#c6bea2';
                ctx.fillRect(-l * .14, -b * .22, l * .17, b * .44);
                if (s.vessel === 'fishing') {
                    for (let i = 0; i < 4; i++)
                        circle(-l * .35 + i * 2, -b * .12, 1.9, '#897b59', '#c8b989', .25);
                }
            }
            circle(-l * .46, 0, .85, '#334c46');
            circle(l * .46, 0, .8, '#a07a45');
            ctx.restore();
        }
        function jobOutline(j, color, active, hold = 0) {
            ctx.save();
            ctx.translate(j.x, j.y);
            ctx.rotate(j.a);
            ctx.globalAlpha = active ? 1 : .38;
            ctx.fillStyle = color + '13';
            ctx.fillRect(-j.l / 2, -j.w / 2, j.l, j.w);
            ctx.strokeStyle = color;
            ctx.lineWidth = active ? 1 : .55;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(-j.l / 2, -j.w / 2, j.l, j.w);
            ctx.setLineDash([]);
            line([
                { x: -8, y: 0 }, { x: 8, y: 0 }, { x: 4, y: -2 }
            ], color, .7);
            line([
                { x: 8, y: 0 }, { x: 4, y: 2 }
            ], color, .7);
            ctx.restore();
            if (active && hold > 0) {
                circle(j.x, j.y, j.l * .56, null, color + '35', .7);
                ctx.beginPath();
                ctx.arc(j.x, j.y, j.l * .56, -Math.PI / 2, -Math.PI / 2 + P.TAU * Math.min(1, hold / 2));
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        function drawJobs(l, r) {
            const active = J.current(l, r.jobs), groups = new Map();
            l.jobs.forEach((job, index) => {
                const key = [job.x, job.y, job.a, job.type === 'tow'].join('/');
                if (!groups.has(key))
                    groups.set(key, []);
                groups.get(key).push({ job, index });
            });
            for (const group of groups.values()) {
                const chosen = group.find(v => v.job === active) || group.find(v => v.index >= r.jobs.index) || group[group.length - 1];
                const j = chosen.job, isActive = j === active, done = group.every(v => v.index < r.jobs.index);
                if (done && j.x === l.berth.x && j.y === l.berth.y && J.ready(l, r.jobs))
                    continue;
                const color = j.type === 'tow' ? C.green : C.amber;
                jobOutline(j, color, isActive, isActive && j.type === 'tow' ? r.jobs.towHold : 0);
                text(done ? 'CALL COMPLETE' : j.type === 'tow' ? 'TOW BERTH' : isActive ? (j.type === 'load' ? 'BOARDING' : 'UNLOADING') : 'FERRY RAMP', j.x, j.y - j.w / 2 - 6, done ? C.green : color, isActive ? 3.8 : 3);
                if (j.type === 'load') {
                    const remain = done ? 0 : j.vehicles.length - (isActive ? r.jobs.transferred : 0), end = j.rampEnd || -1;
                    for (let n = 0; n < remain; n++) {
                        if (n === 0 && isActive && r.jobs.ramp === 1 && r.jobs.transfer > 0 && !r.jobs.closing) continue;
                        const p = P.localPoint({ x: j.x, y: j.y, a: j.a }, end * (l.spec.length / 2 + 12 + (n % 3) * 6), -4 + Math.floor(n / 3) * 5);
                        const kind = j.vehicles[j.vehicles.length - remain + n];
                        car(p.x, p.y, j.a, { kind, ...J.VEHICLES[kind], color: J.COLORS[n % 6] }, isActive ? 1 : .48);
                    }
                }
            }
        }
        function coupledGuide(l, r) {
            const a = { ...r.ship, throttle: 0 }, b = { ...J.target(r.jobs, r.jobs.line.bodyId) }, rope = { ...r.jobs.line }, ap = [
                { x: a.x, y: a.y }
            ], bp = [
                { x: b.x, y: b.y }
            ];
            for (let k = 0; k < 120; k++) {
                const time = r.time + (k + 1) * .1;
                P.integrate(a, {}, P.environmentAt(l, a, time), .1);
                P.integrate(b, {}, P.environmentAt(l, b, time), .1);
                P.towForce(a, b, rope, .1);
                if (k % 3 === 0) {
                    ap.push({ x: a.x, y: a.y });
                    bp.push({ x: b.x, y: b.y });
                }
            }
            line(ap, '#f4f1cfaa', .5, [1.5, 2]);
            line(bp, '#f9d89588', .5, [1.5, 2]);
            text('12s TOW COAST', b.x, b.y + 8, C.amber, 2.8);
        }
        function ghostAt(frames, t) {
            if (!frames.length)
                return null;
            if (t > frames[frames.length - 1][0])
                return null;
            let low = 0, high = frames.length - 1;
            while (low + 1 < high) {
                const mid = (low + high) >> 1;
                if (frames[mid][0] < t)
                    low = mid;
                else
                    high = mid;
            }
            const a = frames[low], b = frames[high], k = P.clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1);
            return { x: P.lerp(a[1], b[1], k), y: P.lerp(a[2], b[2], k), a: a[3] + P.wrap(b[3] - a[3]) * k };
        }
        function render(view) {
            inRampage = !!view.level.rampage;
            if (inRampage) return gerboRenderer.render(view);
            inSpace = !!view.level.space;
            if (inSpace) return spaceRenderer.render(view);
            resize();
            const { level: l, run: r, zoom, settings, ghost, index } = view;
            const W = l.world[0], H = l.world[1];
            night = l.theme === 'night';
            islands = l.theme === 'archipelago';
            C = night ? NIGHT : islands ? ARCHIPELAGO : DAY;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = C.water;
            ctx.fillRect(0, 0, width, height);
            const top = height < 330 ? (islands ? 40 : 17) : (islands ? 148 : 54), bottom = height < 330 ? 26 : 60;
            const base = Math.min((width - 30) / W, (height - top - bottom) / H);
            scale = Math.max(.1, base * zoom);
            const fx = width / 2, fy = top + (height - top - bottom) / 2;
            let cx = W / 2, cy = H / 2;
            if (zoom > 1) {
                const halfW = (width - 20) / scale / 2, halfH = (height - top - bottom) / scale / 2;
                cx = halfW > W / 2 ? W / 2 : P.clamp(r.ship.x, halfW, W - halfW);
                cy = halfH > H / 2 ? H / 2 : P.clamp(r.ship.y, halfH, H - halfH);
            }
            ox = fx - cx * scale;
            oy = fy - cy * scale;
            ctx.translate(ox, oy);
            ctx.scale(scale, scale);
            // Fine chart grid and a quiet, deterministic water texture.
            const visualTime = view.visualTime;
            ctx.strokeStyle = night ? '#7180ad26' : islands ? '#dce7c61c' : '#40637130';
            ctx.lineWidth = .35;
            ctx.beginPath();
            for (let x = -400; x < 800; x += 20) {
                ctx.moveTo(x, -400);
                ctx.lineTo(x, 700);
            }
            for (let y = -400; y < 700; y += 20) {
                ctx.moveTo(-400, y);
                ctx.lineTo(800, y);
            }
            ctx.stroke();
            ctx.strokeStyle = night ? '#b0c8f019' : '#87b4bd14';
            ctx.lineWidth = .6;
            ctx.beginPath();
            for (let y = 30; y < H - 20; y += 17)
                for (let x = 30; x < W - 20; x += 29) {
                    const offset = Math.sin(x * 7.3 + y * 3.1) * 7, drift = (visualTime * .18) % 6;
                    ctx.moveTo(x + offset + drift, y);
                    ctx.lineTo(x + offset + drift + 3, y - .4);
                }
            ctx.stroke();
            // Shelters and current lanes share exactly the same field as the physics.
            for (const z of l.shelters) {
                ctx.fillStyle = night ? '#94ddff0c' : '#80e6bb0e';
                ctx.fillRect(z.x, z.y, z.w, z.h);
                ctx.strokeStyle = C.green + '55';
                ctx.lineWidth = .5;
                ctx.setLineDash([2, 3]);
                ctx.strokeRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([]);
                text(z.label || 'LEE WATER', z.x + z.w / 2, z.y + 8, C.green, 3.4);
                const f = z.feather || 18;
                ctx.strokeStyle = C.green + '18';
                ctx.strokeRect(z.x + f / 2, z.y + f / 2, Math.max(0, z.w - f), Math.max(0, z.h - f));
            }
            for (const z of l.currentZones) {
                ctx.fillStyle = '#a89bdd09';
                ctx.fillRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = '#aaa9e355';
                ctx.lineWidth = .5;
                ctx.strokeRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([]);
                text(z.label || 'CURRENT LANE', z.x + z.w / 2, z.y + 9, '#c1c3f0', 3.3);
                if (z.pulse) {
                    const phase = ((r.time / z.pulse.period + ((z.pulse.phase || 0) / P.TAU)) % 1 + 1) % 1;
                    text('PULSE ' + Math.round((z.pulse.min + (1 - z.pulse.min) * (.5 + .5 * Math.sin(phase * P.TAU))) * 100) + '%', z.x + z.w / 2, z.y + 16, '#c1c3f0', 3);
                }
            }
            if (Math.hypot(...l.current) > .02 || l.currentZones.length) {
                for (let x = 45; x < W - 22; x += 35)
                    for (let y = 42; y < H - 25; y += 39) {
                        const e = P.fieldAt(l, x, y, r.time), strength = Math.hypot(e.current.x, e.current.y);
                        if (strength < .035)
                            continue;
                        const angle = Math.atan2(e.current.y, e.current.x), len = P.clamp(strength * 11, 3, 10);
                        ctx.save();
                        ctx.globalAlpha = P.clamp(strength * .7, .12, .58);
                        ctx.translate(x, y);
                        ctx.rotate(angle);
                        line([
                            { x: -len / 2, y: 0 }, { x: len / 2, y: 0 }, { x: len / 2 - 2, y: -1.6 }
                        ], C.muted, .6);
                        line([
                            { x: len / 2, y: 0 }, { x: len / 2 - 2, y: 1.6 }
                        ], C.muted, .6);
                        ctx.restore();
                    }
            }
            // Only closed edges have coast. Archipelago water continues past all four edges.
            for (const coast of N.coasts(l)) pier(coast);
            if (!islands) {
                for (let x = 37; x < W - 40; x += 35) {
                    for (const side of ['n', 's']) {
                        if (l.openSides.includes(side)) continue;
                        const y = side === 'n' ? 5 : H - 13;
                        ctx.fillStyle = night ? '#383d57' : '#455f63';
                        ctx.fillRect(x, y, 23, 8);
                        ctx.strokeStyle = '#809592';
                        ctx.lineWidth = .3;
                        ctx.strokeRect(x, y, 23, 8);
                    }
                }
                if (!l.openSides.includes('s'))
                    text(night ? 'N O R T H W A T C H   /   N I G H T   S H I F T' : 'H A R B O R   A U T H O R I T Y', W / 2, H - 9, night ? '#c7c9e4' : '#c4cfbf', 2.9);
            }
            // A local warning only near danger, never a permanent frame around the islands.
            const edge = [r.ship, ...r.jobs.bodies].map(body => {
                const warning = N.warning(l, body);
                return warning ? { ...warning, body } : null;
            }).filter(Boolean).sort((a, b) => a.distance - b.distance)[0];
            if (edge && view.status === 'running') {
                const x = edge.side === 'w' ? 0 : edge.side === 'e' ? W : edge.body.x;
                const y = edge.side === 'n' ? 0 : edge.side === 's' ? H : edge.body.y;
                text('CHART LIMIT · ' + Math.floor(edge.distance) + ' m', x, y - 5, C.amber, 4.5);
                line(edge.side === 'n' || edge.side === 's' ? [{x: x - 25, y}, {x: x + 25, y}] : [{x, y: y - 25}, {x, y: y + 25}], C.amber, .6, [2, 3]);
            }
            if (night) {
                // Fixed industrial silhouettes and warm lights distinguish the night world.
                for (let x = 54; x < W - 42; x += 103) {
                    line([
                        { x: x - 5, y: 18 }, { x: x - 5, y: 4 }, { x: x + 12, y: 4 }, { x: x + 16, y: 9 }
                    ], '#a3a8c1', .7);
                    line([
                        { x: x - 10, y: 18 }, { x: x + 2, y: 18 }, { x: x - 5, y: 7 }, { x: x - 10, y: 18 }
                    ], '#727e9e', .65);
                    line([
                        { x: x + 12, y: 4 }, { x: x + 12, y: 15 }
                    ], '#d7bc92', .35);
                    circle(x + 12, 15, .8, '#ffd99b');
                }
                const lx = W - 10, ly = 29, angle = -Math.PI + Math.sin(visualTime * .075) * .75;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.arc(lx, ly, 93, angle - .11, angle + .11);
                ctx.closePath();
                const light = ctx.createRadialGradient(lx, ly, 0, lx, ly, 93);
                light.addColorStop(0, '#fff0bc18');
                light.addColorStop(1, '#fff0bc00');
                ctx.fillStyle = light;
                ctx.fill();
                ctx.restore();
                circle(lx, ly, 4.5, '#31374a', '#abafc5', .5);
                circle(lx, ly, 2, '#ffe8b5');
            }
            text('N', 9, 32, '#d7e4d6', 3.8);
            line([
                { x: 9, y: 49 }, { x: 9, y: 37 }, { x: 6.8, y: 41 }
            ], '#d7e4d6', .65);
            line([
                { x: 9, y: 37 }, { x: 11.2, y: 41 }
            ], '#d7e4d6', .65);
            for (const z of l.speedZones) {
                ctx.fillStyle = '#ffc1790b';
                ctx.fillRect(z.x, z.y, z.w, z.h);
                ctx.strokeStyle = '#deb77c80';
                ctx.lineWidth = .5;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([]);
                text(`NO WAKE · ${(z.limit * 1.94384).toFixed(1)} kn`, z.x + z.w / 2, z.y + 8, C.amber, 3.4);
            }
            if (l.tide) {
                const depth = P.tideDepth(l.tide, r.time), safe = depth >= r.ship.draft;
                for (const z of l.tide.areas) {
                    ctx.fillStyle = safe ? '#c9c19a12' : '#b6a1703b';
                    ctx.fillRect(z.x, z.y, z.w, z.h);
                    hatch(z, safe ? '#d7c89c22' : '#d7c89c66', 7);
                    ctx.setLineDash([2, 2]);
                    ctx.strokeStyle = '#c8b58b';
                    ctx.lineWidth = .45;
                    ctx.strokeRect(z.x, z.y, z.w, z.h);
                    ctx.setLineDash([]);
                    text('SANDBAR', z.x + z.w / 2, z.y + 9, C.amber, 3.4);
                    text(`${depth.toFixed(1)} m`, z.x + z.w / 2, z.y + 16, safe ? C.green : C.amber, 4.6);
                }
            }
            for (const island of l.islands)
                drawIsland(island);
            for (const p of l.obstacles)
                pier(p);
            if (l.lock) {
                const z = l.lock;
                ctx.fillStyle = r.lock.phase === 'cycling' ? '#ffc17919' : '#7ce7b90b';
                ctx.fillRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([2, 2]);
                ctx.strokeStyle = '#8ccbbb77';
                ctx.lineWidth = .5;
                ctx.strokeRect(z.x, z.y, z.w, z.h);
                ctx.setLineDash([]);
                const label = r.lock.phase === 'cycling' ? `EQUALIZING ${Math.max(0, z.cycle - r.lock.clock).toFixed(1)}s` : r.lock.phase === 'exit' ? 'LOCK CLEAR' : 'STOP + NEUTRAL';
                text(label, z.x + z.w / 2, z.y + 7, r.lock.phase === 'cycling' ? C.amber : C.green, 3.2);
                if (r.lock.hold > 0 && r.lock.phase === 'entry') {
                    ctx.fillStyle = C.green;
                    ctx.fillRect(z.x + 7, z.y + z.h - 6, (z.w - 14) * r.lock.hold / z.hold, 1.5);
                }
            }
            for (const g of l.gates) {
                const st = r.gateStates[g.id] || { open: false, until: 0 };
                if (st.open) {
                    ctx.strokeStyle = '#7ce7b960';
                    ctx.lineWidth = .5;
                    ctx.setLineDash([2, 2]);
                    ctx.strokeRect(g.x, g.y, g.w, g.h);
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#62897b';
                    ctx.fillRect(g.x - 1, g.y, g.w + 2, 3);
                    ctx.fillRect(g.x - 1, g.y + g.h - 3, g.w + 2, 3);
                }
                else {
                    ctx.fillStyle = '#534b39';
                    ctx.fillRect(g.x, g.y, g.w, g.h);
                    hatch(g, '#f4bb79', 7);
                    ctx.strokeStyle = '#f1c78e';
                    ctx.lineWidth = .6;
                    ctx.strokeRect(g.x, g.y, g.w, g.h);
                }
                circle(g.x + g.w / 2, g.y - 4, 2.3, '#0b2630', st.open ? C.green : C.red, .7);
                circle(g.x + g.w / 2, g.y - 4, 1.2, st.open ? C.green : C.red);
                const label = st.held ? 'SAFETY HOLD' : g.kind === 'timed' ? `${st.open ? 'GREEN' : 'RED'} ${Math.ceil(st.until)}s` : g.kind === 'key' ? (st.open ? 'CLEARED' : 'LOCKED') : (st.open ? 'OPEN' : 'CLOSED');
                text(label, g.x + g.w / 2, g.y + g.h + 7, st.open ? C.green : C.amber, 3.4);
            }
            for (const t of l.traffic) {
                line([
                    { x: t.from[0], y: t.from[1] }, { x: t.to[0], y: t.to[1] }
                ], '#e8c68b46', .5, [2, 3]);
                const s = P.trafficState(t, r.time);
                vessel(s, { traffic: true });
            }
            l.buoys.forEach((b, i) => buoy(b, i, r));
            if (l.jobs.length)
                drawJobs(l, r);
            if (J.ready(l, r.jobs) || !l.jobs.some(j => j.x === l.berth.x && j.y === l.berth.y))
                berth(l.berth, r, l.stageNumber - 1);
            if (settings.ghost && ghost?.length) {
                const points = ghost.filter((p, i) => i % 4 === 0).map(p => ({ x: p[1], y: p[2] }));
                line(points, '#7ce7b923', .4, [1, 2]);
                const g = ghostAt(ghost, r.time);
                if (g)
                    vessel({ ...g, length: r.ship.length, beam: r.ship.beam, vessel: r.ship.vessel }, { ghost: true });
            }
            // A sampled stern track gives inertia a visible history.
            if (r.trail.length > 1) {
                for (let i = 1; i < r.trail.length; i++) {
                    const p = r.trail[i - 1], q = r.trail[i];
                    const alpha = .16 * i / r.trail.length;
                    line([p, q], `rgba(173,217,218,${alpha})`, Math.max(.5, i / r.trail.length * 2.6));
                }
            }
            const s = r.ship;
            if (settings.guide && r.jobs.line && Math.hypot(s.vx, s.vy) > .25)
                coupledGuide(l, r);
            if (settings.guide && !r.jobs.line && Math.hypot(s.vx, s.vy) > .25) {
                const clone = { ...s, throttle: 0 }, points = [
                    { x: s.x, y: s.y }
                ];
                for (let j = 0; j < 40; j++) {
                    P.integrate(clone, { rudder: 0, thruster: 0 }, P.environmentAt(l, clone, r.time + (j + 1) * .3), .3);
                    points.push({ x: clone.x, y: clone.y });
                }
                line(points, '#d7e9e277', .45, [1.5, 2]);
                circle(clone.x, clone.y, 1.6, null, '#e5eedd88', .45);
                text('12s COAST', clone.x, clone.y - 4, '#afccc2', 2.8);
                const bow = P.localPoint(s, s.length / 2 + 2, 0);
                line([
                    bow, { x: bow.x + s.vx * 5, y: bow.y + s.vy * 5 }
                ], '#f1e8d3b0', .55);
            }
            if (r.dockHold > 0) {
                for (const along of [-s.length * .31, s.length * .28]) {
                    const center = P.localPoint(s, along, 0);
                    let best = null, dist = Infinity;
                    for (const pier of l.obstacles) {
                        const q = { x: P.clamp(center.x, pier.x, pier.x + pier.w), y: P.clamp(center.y, pier.y, pier.y + pier.h) }, d = Math.hypot(q.x - center.x, q.y - center.y);
                        if (d < dist) {
                            dist = d;
                            best = q;
                        }
                    }
                    if (best && dist < 24) {
                        line([center, best], '#ecddb9cc', .45);
                        circle(best.x, best.y, .75, '#edcc8e');
                    }
                }
            }
            for (const body of r.jobs.bodies) {
                vessel(body);
                text(body.name, body.x, body.y - body.beam / 2 - 7, body.delivered ? C.green : C.white, 3);
                if (body.delivered)
                    text('SECURED', body.x, body.y + body.beam / 2 + 6, C.green, 2.8);
            }
            if (r.jobs.line) {
                const body = J.target(r.jobs, r.jobs.line.bodyId), ends = P.towEndpoints(s, body), distance = Math.hypot(ends.a.x - ends.b.x, ends.a.y - ends.b.y), slack = Math.max(0, r.jobs.line.length - distance);
                ctx.beginPath();
                ctx.moveTo(ends.a.x, ends.a.y);
                ctx.quadraticCurveTo((ends.a.x + ends.b.x) / 2, (ends.a.y + ends.b.y) / 2 + Math.min(12, slack * .7), ends.b.x, ends.b.y);
                ctx.lineWidth = .9;
                ctx.strokeStyle = r.jobs.line.tension > 1 ? '#ff977f' : '#f6dda4';
                ctx.stroke();
                circle(ends.a.x, ends.a.y, 1, '#f4ddb0');
                circle(ends.b.x, ends.b.y, 1, '#f4ddb0');
            }
            else if (l.jobs.length) {
                const pick = J.canAttach(l, r.jobs, s, r.static);
                if (pick.body) {
                    const ends = pick.ends;
                    line([ends.a, ends.b], pick.ok ? '#fff1b494' : '#edf0ce35', .6, [2, 3]);
                    if (pick.ok)
                        text('F · MAKE FAST', (ends.a.x + ends.b.x) / 2, (ends.a.y + ends.b.y) / 2 - 5, C.amber, 3.5);
                }
            }
            vessel(s, { loaded: r.loaded, engine: s.engine, work: r.jobs });
            if (Math.abs(view.input.thruster) > .1 && view.status === 'running') {
                const p = P.localPoint(s, s.length * .31, view.input.thruster > 0 ? -s.beam / 2 : s.beam / 2);
                const k = (visualTime * 2) % 1;
                circle(p.x, p.y, 1.6 + k * 3, null, `rgba(160,220,231,${.6 - k * .5})`, .6);
            }
            if (r.grounded) {
                circle(s.x, s.y, s.length * .68, null, C.amber, .6);
                text('AGROUND', s.x, s.y + s.length * .76, C.amber, 4);
            }
            for (const fx of r.effects) {
                const age = r.time - fx.t;
                ctx.globalAlpha = Math.max(0, 1 - age);
                circle(fx.x, fx.y, 2 + age * 9, null, C.amber, .65);
                ctx.globalAlpha = 1;
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Soft edge vignette leaves labels and the center chart clear.
            const vignette = ctx.createLinearGradient(0, 0, 0, height);
            vignette.addColorStop(0, night ? '#0c0d2455' : '#04182455');
            vignette.addColorStop(.14, '#04182400');
            vignette.addColorStop(.8, '#04182400');
            vignette.addColorStop(1, night ? '#0c0d2455' : '#04182455');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);
        }
        return { render, get scale() {
                return inRampage ? gerboRenderer.scale : inSpace ? spaceRenderer.scale : scale;
            }, ghostAt };
    }
    root.HarborRenderer = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
