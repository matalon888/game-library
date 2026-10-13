/* Flight instruments reuse the helm without teaching spacecraft to act like boats. */
(function (root) {
    'use strict';
    const $ = id => root.document.getElementById(id);
    const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    function prepare(level) {
        const space = !!level.space;
        $('radar-btn').hidden = !space;
        root.document.title = space ? 'DEAD SLOW — The Black Meridian' : 'DEAD SLOW — Harbor Trials';
        $('chart-section').setAttribute('aria-label', space ? 'Navigation sector and spacecraft' : 'Harbor chart and ship');
        $('helm-controls').setAttribute('aria-label', space ? 'Spacecraft flight controls' : 'Ship helm controls');
        $('neutral-btn').setAttribute('title', space ? 'Cut main thrust (Space)' : 'Set neutral (Space)');
        $('throttle-down').setAttribute('title', space ? 'More reverse thrust (S)' : 'More astern (S)');
        $('throttle-up').setAttribute('title', space ? 'More forward thrust (W)' : 'More ahead (W)');
        $('horn-btn').innerHTML = (space ? 'RADAR PULSE' : 'SOUND HORN') + ' <kbd>H</kbd>';
        $('horn-btn').setAttribute('title', space ? 'Send radar pulse (H)' : 'Sound horn (H)');
        $('horn-btn').setAttribute('aria-label', space ? 'Send visual radar pulse with electronic ping (H)' : 'Sound horn (H)');
        set('neutral-btn', space ? 'CUT THRUST' : 'NEUTRAL');
        set('speed-frame-label', space ? 'SPEED / LOCAL FRAME' : 'SPEED / GROUND');
        set('heading-label', space ? 'NOSE HEADING' : 'BOW HEADING');
        set('chart-frame-label', space ? '+Y ↓ · LOCAL FRAME' : 'N ↑ · METRIC CHART');
        set('check-objectives', space ? 'Mission tasks' : 'Clearance');
        set('check-inside', space ? 'Inside cradle' : 'Inside berth');
        set('check-aligned', space ? 'Nose aligned' : 'Bow aligned');
        for (const [key, flight, sea] of [
            ['port', '<b>↶</b> CCW', '<b>←</b> PORT'], ['starboard', 'CW <b>↷</b>', 'STBD <b>→</b>'],
            ['bowport', '<b>«</b> LEFT', '<b>«</b> PORT'], ['bowstarboard', 'RIGHT <b>»</b>', 'STBD <b>»</b>']
        ]) {
            const button = root.document.querySelector(`[data-hold="${key}"]`);
            if (button) button.innerHTML = space ? flight : sea;
        }
        $('sea').setAttribute('aria-label', space ? 'Top-down spacecraft navigation chart. Fire main, lateral and rotational jets with the keyboard or flight helm.' : 'Top-down harbor chart. Use keyboard or the helm buttons below to control the ship.');
        $('work-panel').setAttribute('aria-label', space ? 'Spacecraft fuel, mission and beam instruments' : 'Island job instruments');
        $('manifest').setAttribute('aria-label', space ? 'Relative speed, spin and flight counters' : 'Vehicles aboard');
        for (const [id, flight, sea] of [['line-action','Lock or release rescue beam','Make or release towline'], ['line-in-label','Hold to attract friendly craft','Hold winch to reel in towline'], ['line-out-label','Hold to repel friendly craft','Hold winch to pay out towline']]) $(id).setAttribute('aria-label', space ? flight : sea);
        for (const [key, flight, sea] of [['port','Rotate counterclockwise','Hold port rudder'], ['starboard','Rotate clockwise','Hold starboard rudder'], ['bowport','Translate left relative to the spacecraft','Hold bow thruster to port'], ['bowstarboard','Translate right relative to the spacecraft','Hold bow thruster to starboard']]) root.document.querySelector(`[data-hold="${key}"]`)?.setAttribute('aria-label', space ? flight : sea);
        set('speed-unit', space ? 'm/s' : 'kn'); set('mobile-speed-unit', space ? 'm/s' : 'kn');
        set('helm-engine-label', space ? 'MAIN THRUST' : 'ENGINE TELEGRAPH');
        set('helm-rudder-label', space ? 'ROTATIONAL JETS' : 'RUDDER');
        set('helm-bow-label', space ? 'LATERAL JETS' : 'BOW THRUSTER');
        set('helm-caption', space ? 'Translation only · no free stabilization' : 'Most effective at low water speed');
        set('work-progress-label', space ? 'PROPELLANT RESERVE' : 'JOB PROGRESS');
        set('courses-btn', space ? 'Sectors' : 'Harbors');
        set('work-panel-label', space ? 'FLIGHT COMPUTER' : 'ISLAND SERVICE');
        $('line-action').innerHTML = space ? '<span class="key-hint">F · </span>LOCK BEAM' : '<span class="key-hint">F · </span>MAKE FAST';
        $('line-in-label').innerHTML = space ? '<span class="key-hint">J · </span>ATTRACT' : '<span class="key-hint">J · </span>REEL IN';
        $('line-out-label').innerHTML = space ? '<span class="key-hint">K · </span>REPEL' : '<span class="key-hint">K · </span>PAY OUT';
        set('dock-list-label', space ? 'FINAL CAPTURE CHECKLIST' : 'MOORING CHECKLIST');
        set('check-slow', space ? 'Relative drift + jets off' : 'Slow + neutral');
        set('helm-warning', space ? 'CUTTING THRUST IS NOT BRAKING' : 'NEUTRAL IS NOT A BRAKE');
    }
    function update(level, run, status) {
        if (!run.space) return;
        const st = run.space, s = run.ship, c = level.space;
        const target = st.activeDock || st.port;
        const range = Math.hypot(target.x - s.x, target.y - s.y);
        const relative = Math.hypot(s.vx - (target.vx || 0), s.vy - (target.vy || 0));
        set('ship-name', s.name);
        set('world-label', 'WORLD 6 · THE BLACK MERIDIAN');
        set('shelter-status', st.inBlackout ? 'POWER INHIBITED' : st.light < .01 ? 'FULL SHADOW' : st.light < .99 ? 'PARTIAL SHADOW' : 'IN SUNLIGHT');
        set('local-set', `SPIN ${(s.r * 180 / Math.PI).toFixed(2)} °/s`);
        set('weather-text', `VACUUM · REL ${relative.toFixed(2)} m/s · ${range >= 1000 ? (range / 1000).toFixed(2) + ' km' : Math.round(range) + ' m'} TO ACTIVE TARGET`);
        $('work-panel').hidden = false;
        set('work-order', run.failure ? 'FLIGHT TERMINATED' : st.targetHit ? 'TARGET DISABLED · RETURN HOME' : c.century ? 'CENTURY · DEEP-SPACE TRANSIT' : 'MERIDIAN FLIGHT COMPUTER');
        const warning = c.flare?.continuous ? ` · RADIATION · HEAT ${Math.round(st.heat)}%` : c.flare ? ` · ${st.flare.active ? 'FLARE' : 'FLARE IN'} ${Math.ceil(st.flare.remaining)}s · HEAT ${Math.round(st.heat)}%`
            : c.solar ? ` · SOLAR ${Math.round(st.light * 100)}%` : c.target && !st.targetHit ? ` · LOCK ${st.charge.toFixed(1)}/3s` : st.echo ? ` · ${st.echoes.length} SOLID HISTORIES` : '';
        set('work-readout', `FUEL ${st.fuel.toFixed(1)} / ${st.capacity} Δv${warning}`);
        $('work-progress').style.width = `${Math.max(0, st.fuel / st.capacity) * 100}%`;
        $('work-progress').style.background = st.fuel < st.capacity * .15 ? 'var(--amber)' : 'var(--green)';
        $('manifest').innerHTML = `<span>REL ${relative.toFixed(2)} m/s</span><span>SPIN ${(s.r * 180 / Math.PI).toFixed(2)}°/s</span><span>${c.target ? 'SHOTS ' + st.stats.shots + ' · HITS ' + st.stats.hits : st.friendly ? 'FRIEND ' + Math.hypot(st.friendly.vx, st.friendly.vy).toFixed(2) + ' m/s' : 'BURN ' + st.stats.burnTime.toFixed(1) + ' s'}</span>`;
        $('tow-controls').hidden = !c.friendly;
        $('line-action').innerHTML = st.beam ? '<span class="key-hint">F · </span>RELEASE BEAM' : st.rescued ? 'CRAFT SECURED' : '<span class="key-hint">F · </span>LOCK BEAM';
        $('line-in-label').innerHTML = '<span class="key-hint">J · </span>ATTRACT'; $('line-out-label').innerHTML = '<span class="key-hint">K · </span>REPEL';
        set('mobile-extra', `FUEL ${st.fuel.toFixed(0)}${c.flare ? ' · ' + (c.flare.continuous ? 'HEAT ' + Math.round(st.heat) + '%' : st.flare.active ? 'FLARE' : Math.ceil(st.flare.remaining) + 's') : ''}`);
        if (st.shelterWindow) {
            const w=st.shelterWindow, stamp=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
            set('work-order', w.opens === null ? 'CRADLE · NO COVER IN FORECAST' :
                `CRADLE SHADOW ≈ ${w.opens <= run.time ? 'NOW' : stamp(w.opens)} – ${w.closes === null ? 'LATER' : stamp(w.closes)} IGT`);
        }
        set('engine-read', Math.round(st.firingJets.main * 100));
        if (status === 'running') set('mission-status', root.HarborSpace.message(level, run));
        set('scale-label', c.century && root.document.getElementById('zoom-btn')?.textContent === '2.3×' ? 'SECTOR OVERVIEW' : '25 METRES');
    }
    root.HarborSpaceUI = { prepare, update };
})(typeof globalThis !== 'undefined' ? globalThis : this);
