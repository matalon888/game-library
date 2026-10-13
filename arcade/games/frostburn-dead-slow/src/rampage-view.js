/* Orienteering-paper chart and a twelve-course World 4 interface. */
(function(root) {
    'use strict';
    const R = root.GerboRampage, TAU = Math.PI*2;
    const $ = id => root.document.getElementById(id);
    const set = (id, v) => { const e=$(id); if(e) e.textContent=v; };
    const esc = v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function prepare(level) {
        set('engine-output-label', level.rampage ? 'PAW POWER' : 'ENGINE OUTPUT');
        set('hull-state-label', level.rampage ? 'BALL INTEGRITY' : 'HULL INTEGRITY');
        set('contact-count-label', level.rampage ? 'DAMAGE EVENTS' : 'CONTACTS');
        $('gerbo-fire').hidden=!level.rampage?.fire;
        if (!level.rampage) return;
        root.document.title = 'DEAD SLOW — Gerbozilla’s Rampage';
        $('chart-section').setAttribute('aria-label','Topographic rampage course');
        $('helm-controls').setAttribute('aria-label','Hamster ball directional pushes and shield');
        $('sea').setAttribute('aria-label',`Top-down orienteering map of ${level.rampage.sheet}, with contour hills, lakes, black boulders and marked objectives. Push with WASD or arrows; Space activates the shield; H breathes fire on pepper courses.`);
        $('work-panel').setAttribute('aria-label','Rampage objectives and shield charge');
        $('manifest').setAttribute('aria-label','Terrain and damage counters');
        $('manifest').hidden = false; // Tow duty may have hidden this shared panel.
        $('work-panel').classList.remove('tow-mode');
        for (const [id,v] of Object.entries({
            'courses-btn':'Worlds','speed-unit':'m/s','mobile-speed-unit':'m/s','speed-frame-label':'ROLLING SPEED',
            'heading-label':'DIRECTION OF TRAVEL','chart-frame-label':'N ↑ · CONTOURS 5 m',
            'dock-list-label':'COURSE CONTROL CARD','check-objectives':'Course controls','check-inside':'In recovery meadow',
            'check-aligned':'Mission objectives complete','check-slow':'Slow + paws off','helm-warning':'BIG PAWS. LONG BRAKING DISTANCE.'
        })) set(id,v);
        $('radar-btn').hidden=true; $('tow-controls').hidden=true;
    }
    function update(level,run,status,format,practiceLabel,previous=[],best=null,race=null) {
        const st=run.rampage,s=run.ship,c=level.rampage,speed=Math.hypot(s.vx,s.vy);
        const up=R.protectedAt(run), wait=Math.max(0,st.shieldReady-run.time);
        const shield = up ? 'SHIELD '+(st.shieldUntil-run.time).toFixed(1)+' s' : wait>0 ? 'RECHARGE '+wait.toFixed(1)+' s' : 'SHIELD READY';
        set('world-label','WORLD 4 · GERBOZILLA’S RAMPAGE');
        set('speed',speed.toFixed(1)); set('mobile-speed',speed.toFixed(1));
        set('mobile-direction',st.wet>.5?'WET':'ROLL'); set('speed-direction',st.wet>.5?'NO TRACTION':st.effort?'RUNNING':'COASTING');
        $('speed').style.color='var(--green)'; $('mobile-speed').style.color='var(--green)';
        set('drift',`E ${s.vx.toFixed(1)} · S ${s.vy.toFixed(1)} m/s`);
        set('heading',String(Math.round((s.a*180/Math.PI+450)%360)).padStart(3,'0'));
        set('contacts',run.contacts);set('mobile-hits',run.contacts);
        set('engine-read',Math.round(st.effort*100));
        const hp=Math.ceil(s.hull); set('hull-label',hp+'%');set('mobile-hull',hp);$('hull-bar').style.width=hp+'%';
        $('hull-bar').style.background=hp<35?'var(--red)':'var(--green)';
        set('shelter-status',st.wet>.5?'LAKE · PAWS SLIP':st.forest>0?'DENSE FOREST':'FIRM GROUND');set('local-set',Math.round(st.elevation)+' m ASL');
        set('ship-name','GERBOZILLA · 48 m EXERCISE BALL');
        set('weather-text',`${c.sheet} · FIELD SHEET ${String(level.stageNumber).padStart(2,'0')}`);
        $('work-panel').hidden=false;
        const tally=[c.districts.length?`${st.stats.districts}/${c.districts.length} ${c.rescue?'LOCKS':'CORES'}`:'',st.monsters.some(R.requiredMonster)?`${st.stats.monsters}/${st.monsters.filter(R.requiredMonster).length} PETS`:''].filter(Boolean).join(' · ') || `${st.control}/${c.controls.length} CONTROLS`;
        set('work-order',`${tally} · ${shield}`);
        set('work-readout',`CONTROL ${st.control}/${c.controls.length} · ELEVATION ${st.elevation.toFixed(0)} m · ${st.wet>.5?'WATER: NO TRACTION':st.forest>0?'FOREST: ROLLING RESISTANCE':'CLEAR: PUSH TO STEER'}`);
        const vents=st.volcanoes || [];
        if(vents.length) set('work-readout',vents.map(v=>v.name+' · '+(v.state.active?'ERUPTING ':v.state.phase==='warning'?'WARNING ':'QUIET ')+v.state.remaining.toFixed(1)+' s').join(' / '));
        if(st.monsters.some(m=>m.invulnerable) && !vents.length) set('work-readout','NEEDLESWORTH IS INVULNERABLE · EVADE OR SHIELD · NO DEFEAT REQUIRED');
        if(st.lady)set('work-readout',`LADY WHISKERDOOM · ${Math.ceil(st.lady.health)}% · ${st.rescued?'SAFE':st.lady.following?'FOLLOWING YOUR TRAIL':st.unlocked?'GATE OPEN · GREET HER':'FREE BOTH LOCKS'}`);
        if(c.fire){set('work-readout',`${st.control<c.fire.unlockControl?'COLLECT THE PEPPER':st.wet>.5?'TOO WET TO BREATHE FIRE':st.fireActive?'FIRE BREATH':st.breath<.1?'RELEASE FIRE TO REFILL':'HOLD FIRE · AIM WITH A PUSH'} · BREATH ${st.breath.toFixed(1)} / ${c.fire.capacity} s`);$('gerbo-fire').innerHTML=`FIRE · ${st.breath.toFixed(1)} s<span class="key-hint"> · HOLD H</span>`;}
        if(st.strikes.length) { const next=st.strikes[0]; set('work-readout',`RETALIATION${next.target==='lady'?' · LADY TARGETED':''} · ${st.strikes.length} INBOUND · IMPACT ${Math.max(0,next.impactAt-run.time).toFixed(1)} s · AVOID RED CIRCLES`); }
        $('work-progress').style.width=(up?100:100*Math.max(0,1-wait/6))+'%';
        $('work-progress').style.background=up?'#9a3b7f':'var(--green)';
        $('manifest').hidden=false;
        $('manifest').innerHTML=`<span>${Math.round(run.distance)} m ROLLED</span><span>${st.stats.blocked} HITS BLOCKED${st.stats.needleBlocks?` · ${st.stats.needleBlocks} NEEDLES BLOCKED`:''}${st.stats.salvos ? ` · ${st.stats.strikeDodges} STRIKES EVADED` : ''}</span>`;
        set('mobile-extra',shield); $('gerbo-shield').innerHTML=shield+'<span class="key-hint"> · SPACE</span>';
        $('gerbo-shield').classList.toggle('shield-on',up);
        $('gerbo-shield').disabled=wait>0;
        set('mission-status',status==='complete'?'COURSE COMPLETE · GERBOZILLA NEEDS A SNACK':status==='paused'?'PAUSED · UNRANKED PRACTICE':status==='ready'?'Awaiting the starting squeak.':R.message(level,run));
        $('check-objectives').classList.toggle('ok',st.control===c.controls.length);
        $('check-aligned').classList.toggle('ok',R.ready(run));
        $('check-inside').classList.toggle('ok',run.dock.inside);
        $('check-slow').classList.toggle('ok',run.dock.slow);
        $('dock-bar').style.width=run.dockHold*50+'%';
        $('splits').innerHTML=run.splits.map((sp,i)=>`<div class="split-row done"><span>${esc(sp.name)}</span><span>${format(sp.time)}${Number.isFinite(previous[i])?' <small>'+((sp.time-previous[i])>=0?'+':'')+(sp.time-previous[i]).toFixed(2)+'</small>':''}</span></div>`).join('');
        set('clock-label',run.pausedUsed?practiceLabel:race?`${race.name.toUpperCase()} · ${race.position+1}/${race.length}`:'RUN TIME · IGT');
        set('delta', best ? 'PB ' + format(best.time) : 'NO RECORD');
        $('clock-label').classList.toggle('practice',run.pausedUsed);
        $('race-banner').hidden=!race;
        if(race)set('race-banner',`${race.name.toUpperCase()} ${race.position+1}/${race.length} · ${format(race.total+(status==='complete'?0:run.time))}${race.practice?' · PRACTICE':''}`);
        set('scale-label','CONTOURS 5 m');
    }
    function dialog(kind,level,run,format,records=[],settings={},archived=null,context={}) {
        const c=level.rampage, count=c.districts.length, race=context.race;
        const archives=Array.isArray(archived)?archived:archived?[archived]:[];
        const taskCount=count+(c.monsters||[]).filter(R.requiredMonster).length+(c.rescue?1:0)+c.controls.length;
        const resultTitle=race?.done?(race.id==='grand-tour'?'Seven worlds.<br>Every crew home.':'Twelve courses.<br>Home at last.'):c.rescue?'Two hamsters.<br>Home at last.':(c.monsters||[]).some(R.requiredMonster)?'Nap time.<br>Territory reclaimed.':count?`${['Zero','One','Two','Three'][count] || count} ${count===1?'district':'districts'}.<br>One tired hamster.`:c.monsters?.some(m=>m.invulnerable)?'Still prickly.<br>Not our problem.':'All controls.<br>One tired hamster.';
        const intro=`<div class="eyebrow">WORLD 4 · GERBOZILLA’S RAMPAGE · COURSE ${level.stageNumber} / ${R.levels.length}</div>`;
        const next=kind==='result'&&(race ? race.hasNext : level.stageNumber<R.levels.length);
        const circuitNext=next&&race&&!race.done;
        const actions=(kind==='result'&&context.completionActions)||`<div class="dialog-actions">${circuitNext?'<button class="primary" data-action="next" autofocus>Next course →</button>':''}<button${circuitNext?'':' class="primary"'} data-action="retry"${circuitNext?'':' autofocus'}>Roll again<span class="key-hint"> · Shift+R</span></button>${next&&!circuitNext?'<button data-action="next">Next course →</button>':''}<button data-action="courses">World map</button><button data-action="log">Field log</button></div>`;
        if(kind==='intro') return `${intro}<h1>${level.stageNumber===1?'A small pet.<br>A very large problem.':esc(level.name)}</h1><p>${level.brief}</p><div class="intro-details"><div><strong>48 m</strong><span>EXERCISE BALL</span></div><div><strong>${String(taskCount).padStart(2,'0')}</strong><span>MISSION OBJECTIVES</span></div><div><strong>03 s</strong><span>SHIELD DURATION</span></div></div><p class="subtle">${level.tip}</p><div class="control-summary">Hold the direction buttons<span class="key-hint"> (WASD / arrows)</span> to push in map directions. Release to coast.<br>Use Shield<span class="key-hint"> (Space / F)</span>, Retry<span class="key-hint"> (Shift+R)</span> and Zoom<span class="key-hint"> (Z)</span><br>Cross numbered markers in order. Coast through water, steer around rocks, and avoid orange lava beds.${c.fire?'<br>Hold Fire<span class="key-hint"> (H)</span> to breathe toward your last push; release to refill.':''}</div><div class="dialog-actions"><button class="primary" data-action="begin" autofocus>Let the hamster out →</button><button data-action="help">Field guide</button><button data-action="courses">World map</button></div>`;
        if(kind==='help') return `${intro}<h1>Weight wins.<br>Until it doesn’t.</h1><p><b>Push, don’t point.</b> The direction buttons<span class="key-hint"> (WASD / arrows)</span> accelerate north, west, south and east on the map. Diagonal pushes have the same total strength. Counter-push early to brake; releasing a control does not remove momentum.</p><p><b>Read the contours.</b> Brown contours show the hills. Closed mountain rings enclose fortified towns: a standing push cannot overcome the steep rim, so back away and build a run-up. Carry enough speed to cross the moat. Downhill builds speed; the first ridge needs a run-up. Cross every numbered magenta control in order. Their count varies by course.</p><p><b>The lake removes traction.</b> Running spins the ball and squeaks its bearings, but applies no useful push in deep water. Existing motion coasts through with water resistance. Gravity still pulls downhill even when your paws cannot grip. Retry rather than waiting forever after a poor run-up.</p><p><b>Ram the city cores.</b> Speed deals damage to both structures and your shell. Slow nudging cannot flatten a district. Shield<span class="key-hint"> (Space / F)</span> gives 3 seconds of protection followed by 6 seconds recharging. Shielded rams still lose momentum. A dashed red line warns of a local defensive shot; local guns stop when their district falls. On retaliation courses, off-map batteries keep firing after demolition. Red circles mark fixed impact points with a countdown. Steer away after they lock, or shield at impact. Recovery cannot finish while a salvo remains inbound.</p><p><b>Woodland and boulders.</b> Darker green forest increases rolling resistance; pale clearings are faster. Go around black boulders. A shield prevents damage but will not get you through. Rocks also stop defensive shots and fire; low gray walls stop the ball but can be fired over.</p><p><b>Volcanic crossings.</b> Fissures and steam vents are quiet, then warn amber, then erupt inside the marked footprint. Their independent cycles repeat on the course clock. Quiet channels are traversable. A shield protects for only three seconds; hot water still removes traction. Keep a way to leave before the next eruption.</p><p><b>Giant pets.</b> Cavyclasm and Sir Flops-a-Lot mark their charges, commit to one direction, then rest. Ramming exchanges momentum and deals damage to both pets. Shield just before impact. Sleeping defeated pets are no longer dangerous. <b>Sir Needlesworth is invulnerable:</b> ramming, boulders and shields cannot injure him. His charge warning locks a direction. Evade it or time the shield; even a shielded impact changes your momentum. You only need to get past him.</p><p><b>Fire breath.</b> On pepper courses, collect the pepper control, then hold the FIRE button<span class="key-hint"> (H)</span>. Your last directional push aims the fan; velocity does not aim it. Release to refill its three-second breath meter. Deep water stops the flame. Armored cores inside the keep can only be burned.</p><p><b>Lady Whiskerdoom.</b> Break both lock pylons to open the gate, defeat the sentry, then approach her to start the escort. She follows your trail and needs room to turn, so clear the gate before stopping. Ramming her or leading her into rock damages her shell. Your shield protects you, not her. Wait for her to enter the meadow and settle too. In <b>The Long Way Home</b> she starts free beside you: no cage or locks. Route beacons release pursuers and off-map strikes targeting both of you. Circles lock once and give ten seconds to move her clear. Optional mortal enemies can be knocked aside; the hedgehog cannot be defeated. Keep moving toward home.</p><p><b>Finish in the meadow.</b> Complete every course objective, return to the double-ring finish, and stay below 0.8 m/s with no push for two seconds. A clean run means zero damage to either hamster—not zero destruction.</p><p class="subtle">Play individual courses, the twelve-course World 4 championship or the 84-stage Grand Tour. Circuit clocks retain retries; practice never overwrites ranked records.</p><div class="dialog-actions"><button class="primary" data-action="back" autofocus>Back to the ball</button></div>`;
        if(kind==='pause') return `${intro}<h1>The hamster is<br>on a snack break.</h1><p>The ball and course clock are frozen. This attempt is now unranked practice; a fresh retry is record-eligible.</p><div class="result-time">${format(run.time)}</div><div class="dialog-actions"><button class="primary" data-action="resume" autofocus>Resume practice</button><button data-action="retry">Fresh run<span class="key-hint"> · Shift+R</span></button><button data-action="courses">World map</button></div>`;
        if(kind==='failed') return `${intro}<h1>${run.failure?.type==='off-map'?'Beyond the paper.':'Exercise ball recalled.'}</h1><p>${esc(run.failure?.message||'The shell could not take another hit.')}</p><div class="result-time">${format(run.time)}</div>${actions}`;
        if(kind==='result') return `${intro}<h1>${resultTitle}</h1><div class="result-badge">${run.pausedUsed?'UNRANKED PRACTICE':run.pb?'NEW PERSONAL BEST':'COURSE COMPLETE'}${run.result.clean?' · CLEAN':''}</div><div class="result-time">${format(run.time)}</div><div class="result-grid"><div><strong>${taskCount} / ${taskCount}</strong><span>MISSION OBJECTIVES</span></div><div><strong>${Math.ceil(run.ship.hull)}%</strong><span>BALL INTEGRITY</span></div><div><strong>${run.rampage.stats.blocked}</strong><span>HITS BLOCKED</span></div></div><p>${run.pausedUsed?'Practice never replaces records or ghosts.':'Your field log keeps overall and zero-damage times separately.'} ${c.rescue?.free?'No cages. No encore. Just two hamsters home.':c.rescue?'Lady Whiskerdoom is safe. There will be snacks.':'The giant wheel squeak was entirely necessary.'}</p>${race?`<div class="race-banner">${esc(race.name.toUpperCase())} ${race.stages}/${race.length} · ${format(race.total)} · ${race.retries} retries${race.practice?' · PRACTICE':''}</div>`:''}${actions}`;
        if(kind==='log') return `${intro}<h1>Gerbozilla’s field log.</h1>${context.comparison||`<table class="log-table"><thead><tr><th>TIME / IGT</th><th>DAMAGE EVENTS</th><th>CLASS</th></tr></thead><tbody>${records.length?records.map(r=>`<tr><td>${format(r.time)}</td><td>${r.contacts}</td><td>${r.clean?'CLEAN':'OPEN'}</td></tr>`).join(''):'<tr><td colspan="3">No completed course yet.</td></tr>'}</tbody></table>`}<p class="subtle">Clean means zero shell damage. Records and ghosts are local. The twelve-course World 4 circuit and 84-stage Grand Tour have separate overall and clean records.</p>${archives.filter(a=>a.runs?.length).map(a=>`<details><summary>${a.id?.endsWith('-preview')?'Preview field map':'Earlier terrain'} records (archived)</summary><p class="subtle">This layout differs from the active course. Its own ghost and splits remain in exports.</p>${a.runs.map(r=>`<p>${format(r.time)} · ${r.clean?'CLEAN':'OPEN'}</p>`).join('')}</details>`).join('')}
${(context.layoutRaces||[]).map(a=>`<p class="subtle">${esc(a.name)} (archived): overall ${format(a.overall)} · clean ${format(a.clean)}</p>`).join('')}
${context.boards?.length?`<h3 class="circuit-heading">Circuit records</h3><table class="log-table"><thead><tr><th>ROUTE</th><th>OVERALL</th><th>CLEAN</th></tr></thead><tbody>${context.boards.map(b=>`<tr><td>${esc(b.name)}</td><td>${format(b.overall)}</td><td>${format(b.clean)}</td></tr>`).join('')}</tbody></table>`:''}
${context.archived48?.length?`<details><summary>48-stage Grand Tour (archived)</summary>${context.archived48.map(r=>`<p>${format(r.time)} · ${r.clean?'CLEAN':'OPEN'}</p>`).join('')}</details>`:''}<p><button data-action="toggle-focus-pause" aria-pressed="${settings.pauseOnBlur}">Pause when window loses focus: ${settings.pauseOnBlur?'ON':'OFF'}</button></p><p class="subtle">When off, the run continues while you use another window. Hiding this tab still pauses the run. Any pause makes the attempt unranked.</p><div class="dialog-actions"><button data-action="toggle-sound">Sound: ${settings.sound?'ON':'OFF'}</button><button data-action="toggle-ghost">Ghost: ${settings.ghost?'ON':'OFF'}</button><button data-action="export">Export</button><button data-action="import">Import</button><button class="primary" data-action="back" autofocus>Back to the ball</button></div>`;
    }
    function createRenderer(canvas) {
        const ctx=canvas.getContext('2d'); let scale=1, cache=null, cachedLevel=null;
        const ink='#2c443a', brown='#ab7953', magenta='#a03780';
        function circle(g,x,y,r,fill,stroke,width=1) {g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}}
        function text(g,s,x,y,size=12,color=ink,align='center') {g.font=`600 ${size}px ui-monospace,monospace`;g.textAlign=align;g.fillStyle=color;g.fillText(s,x,y);}
        function shoreline(g,l,scale=1) {
            g.beginPath();
            if(l.poly) {
                for(const [i,p] of l.poly.entries()) {
                    if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
                }
                g.closePath();return;
            }
            for(let i=0;i<=120;i++) {
                const p=R.lakePoint(l,i*TAU/120,scale);
                if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
            }
            g.closePath();
            if(l.inner) {
                for(let i=120;i>=0;i--) {
                    const p=R.lakePoint(l,i*TAU/120,scale*l.inner);
                    if(i===120)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
                }
                g.closePath();
            }
        }
        function map(level) {
            const [w,h]=level.world,c=level.rampage;
            const out=root.document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d');
            g.fillStyle='#f6f1db';g.fillRect(0,0,w,h);
            // White/pale forest is open ground; green hatching is slow woodland.
            let seed=29;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
            for(const f of c.forests || []) {
                g.save();shoreline(g,f);g.fillStyle=f.density>.7?'#97bc80':'#c2d5a2';g.fill();g.clip();
                g.strokeStyle='#60885e';g.lineWidth=1.2;
                for(let x=f.x-f.rx*1.4;x<f.x+f.rx*1.4;x+=17){g.beginPath();g.moveTo(x,f.y-f.ry*1.4);g.lineTo(x,f.y+f.ry*1.4);g.stroke();}
                for(let i=0;i<45;i++){const x=f.x+(rnd()*2-1)*f.rx*1.25,y=f.y+(rnd()*2-1)*f.ry*1.25;
                    g.fillStyle='#588457';g.beginPath();g.moveTo(x,y-8);g.lineTo(x-5,y+3);g.lineTo(x+5,y+3);g.closePath();g.fill();}
                g.restore();text(g,f.name || 'SLOW WOODLAND',f.x,f.y+8,10,'#365b40');
            }
            // A little sparse vegetation remains decorative on the unchanged courses.
            for(let i=0;i<140;i++){const x=rnd()*w,y=rnd()*h;g.strokeStyle='#a5b390';g.lineWidth=.8;g.beginPath();g.moveTo(x-2,y);g.lineTo(x+2,y);g.moveTo(x,y-2);g.lineTo(x,y+2);g.stroke();}
            // Cache real elevation contours once; no repeated per-frame terrain meshing.
            const step=14,nx=Math.ceil(w/step),ny=Math.ceil(h/step),zs=[];
            for(let j=0;j<=ny;j++){zs[j]=[];for(let i=0;i<=nx;i++)zs[j][i]=R.terrain(c,i*step,j*step).height;}
            for(let z=5,max=Math.ceil(Math.max(...zs.map(row=>Math.max(...row)))/5)*5;z<=max;z+=5){g.beginPath();for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
                const v=[zs[j][i],zs[j][i+1],zs[j+1][i+1],zs[j+1][i]],p=[[i*step,j*step],[(i+1)*step,j*step],[(i+1)*step,(j+1)*step],[i*step,(j+1)*step]],cross=[];
                for(let k=0;k<4;k++){const n=(k+1)%4;if((v[k]<z)!==(v[n]<z)){const u=(z-v[k])/(v[n]-v[k]);cross.push([p[k][0]+u*(p[n][0]-p[k][0]),p[k][1]+u*(p[n][1]-p[k][1])]);}}
                for(let k=0;k+1<cross.length;k+=2){g.moveTo(...cross[k]);g.lineTo(...cross[k+1]);}
            }g.strokeStyle=brown;g.lineWidth=z%25===0?1.8:.8;g.stroke();}
            for(const hill of c.hills){text(g,Math.round(R.terrain(c,hill.x,hill.y).height)+' m',hill.x,hill.y,12,brown);circle(g,hill.x,hill.y+9,2,brown);}
            for(const rim of c.rims || []) {
                text(g,rim.name,rim.x,rim.y-rim.r-52,12,brown);
                text(g,'RUN-UP REQUIRED',rim.x,rim.y-rim.r-34,9,brown);
            }
            for(const l of c.lakes){
                shoreline(g,l);g.fillStyle='#b7dce3';g.strokeStyle='#6195ac';g.lineWidth=2;g.fill('evenodd');g.stroke();
                g.save();g.clip('evenodd');
                const minX=l.poly?Math.min(...l.poly.map(p=>p.x)):l.x-l.rx*1.5;
                const maxX=l.poly?Math.max(...l.poly.map(p=>p.x)):l.x+l.rx*1.5;
                const minY=l.poly?Math.min(...l.poly.map(p=>p.y)):l.y-l.ry*1.4;
                const maxY=l.poly?Math.max(...l.poly.map(p=>p.y)):l.y+l.ry*1.4;
                for(let yy=minY;yy<maxY;yy+=23){
                    g.beginPath();g.moveTo(minX,yy);g.lineTo(maxX,yy);g.strokeStyle='#8abcc9';g.lineWidth=.6;g.stroke();
                }g.restore();const ly=l.inner?l.y+l.ry*(1+l.inner)/2:l.y; text(g,l.name,l.x,ly-4,12,'#416f86');text(g,'NO TRACTION',l.x,ly+14,9,'#416f86');
            }
            // Roads are cosmetic; the ball still crosses real slopes and water.
            // Never draw a cosmetic bridge across a functional moat.
            if(c.districts.length && !c.rocks?.length && !(c.rims?.length || c.lakes.some(l=>l.inner))) {
            g.strokeStyle='#d9c9a7';g.lineWidth=10;g.beginPath();
            for(const [i,d] of c.districts.entries()){if(i===0)g.moveTo(d.x-85,d.y+45);g.lineTo(d.x,d.y);}
            g.lineTo(c.finish.x,c.finish.y);g.stroke();g.strokeStyle='#fdf9e8';g.lineWidth=5;g.stroke();
            }
            for(const [i,p] of c.controls.entries()){circle(g,p.x,p.y,p.r,null,magenta,2.2);text(g,String(p.number || i+1).padStart(2,'0'),p.x-p.r-11,p.y-16,17,magenta);if(p.after)text(g,'AFTER CORE',p.x,p.y+p.r+18,9,magenta);}
            g.strokeStyle=magenta;g.lineWidth=2.5;g.beginPath();g.moveTo(level.start[0]-20,level.start[1]-30);g.lineTo(level.start[0]-20,level.start[1]+30);g.lineTo(level.start[0]+24,level.start[1]);g.closePath();g.stroke();
            const f=c.finish;circle(g,f.x,f.y,f.r,null,magenta,2);circle(g,f.x,f.y,f.r-9,null,magenta,2);text(g,'RECOVERY',f.x,f.y+f.r+24,11,magenta);
            text(g,c.sheet,w*.62,h-112,23,ink);text(g,c.rescue?.free?'ESCORT IN PROGRESS · BOTH HAMSTERS MUST ARRIVE':c.monsters?.some(m=>m.invulnerable)?'PROTECTED WILDLIFE · DO NOT ENGAGE':'EVACUATION COMPLETE · DEFENCES AUTOMATED',w*.62,h-89,10,ink);
            // Magnetic north lines and a compact map margin, not a physical world wall.
            g.strokeStyle='#9eac9b66';g.lineWidth=.6;for(let x=100;x<w;x+=200){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
            text(g,'N',52,109,16);g.strokeStyle=ink;g.lineWidth=2;g.beginPath();g.moveTo(52,160);g.lineTo(52,119);g.lineTo(46,132);g.moveTo(52,119);g.lineTo(58,132);g.stroke();
            text(g,'GERBOZILLA / FIELD SHEET '+String(level.stageNumber).padStart(2,'0'),65,h-48,16,ink,'left');text(g,'5 m CONTOURS · GREEN: SLOW FOREST · BLACK: IMPASSABLE · BLUE: NO GRIP',65,h-27,11,ink,'left');
            return out;
        }
        let ghostLayer = null;
        function ghostBall(g,x,y,r,roll,heading,alpha) {
            // Reuse one tightly bounded sprite canvas. Opaque belly pixels hide
            // the paws before the entire group is faded onto the map once.
            if (!ghostLayer) { ghostLayer = root.document.createElement('canvas'); ghostLayer.width = ghostLayer.height = 256; }
            const q = ghostLayer.getContext('2d'), extent = r * 1.55;
            q.setTransform(1,0,0,1,0,0); q.clearRect(0,0,256,256);
            q.setTransform(128/extent,0,0,128/extent,128,128);
            ball(q,0,0,r,roll,heading,1);
            g.save(); g.globalAlpha *= alpha;
            g.drawImage(ghostLayer,x-extent,y-extent,extent*2,extent*2);
            g.restore();
        }
        function ball(g,x,y,r,roll,heading,alpha=1,shield=false,pawPhase=0,effort=0,lady=false){
            if (alpha < 1) { ghostBall(g,x,y,r,roll,heading,alpha); return; }
            g.save();g.translate(x,y);
            g.save();g.scale(1,.37);circle(g,4,r*1.95,r*1.05,'#36483f30');g.restore();
            // Transparent shell; upright tiny pet inside, moving bearings outside.
            circle(g,0,0,r,'#d4ebd87a','#375d59',1.8);
            g.save();g.rotate(heading*.12);circle(g,-r*.29,-r*.3,r*.23,'#b78052','#765a40',.8);circle(g,r*.29,-r*.3,r*.23,'#b78052','#765a40',.8);
            circle(g,-r*.29,-r*.3,r*.13,'#e3b5a0');circle(g,r*.29,-r*.3,r*.13,'#e3b5a0');
            // Two plush hind legs, out of phase. The planted paw presses the
            // inside of the shell while the other lifts and reaches forward.
            for(const side of [-1,1]){
                const stride=Math.sin(pawPhase+(side===1?Math.PI:0))*Math.min(1,effort);
                const lift=Math.max(0,stride), hipX=side*r*.34, hipY=r*.47;
                const footX=side*r*(.43+.04*lift), footY=r*(.64+.10*stride);
                circle(g,hipX,hipY,r*.22,'#bc8655','#795c42',.65);
                g.strokeStyle='#9f714d';g.lineWidth=r*.13;g.lineCap='round';
                g.beginPath();g.moveTo(hipX,hipY);g.quadraticCurveTo(side*r*.54,r*.57,footX,footY);g.stroke();
                g.save();g.translate(footX,footY);g.rotate(side*(.18-.3*lift));
                g.fillStyle='#e5b3a0';g.strokeStyle='#805b50';g.lineWidth=.7;
                g.beginPath();g.ellipse(0,0,r*.19,r*(.115+.025*lift),0,0,TAU);g.fill();g.stroke();
                for(const toe of [-1,0,1]){g.beginPath();g.moveTo(toe*r*.065,r*.04);g.lineTo(toe*r*.065,r*.085);g.stroke();}
                g.restore();
            }
            // The plush belly occludes the hips; only reaching feet peek out.
            g.fillStyle=lady?'#ded4bd':'#c89765';g.beginPath();g.ellipse(0,r*.12,r*.59,r*.64,0,0,TAU);g.fill();g.fillStyle=lady?'#fff1d8':'#f4dfb4';g.beginPath();g.ellipse(0,r*.27,r*.4,r*.43,0,0,TAU);g.fill();
            circle(g,-r*.21,-r*.03,r*.065,'#262f2a');circle(g,r*.21,-r*.03,r*.065,'#262f2a');circle(g,0,r*.17,r*.07,'#805455');
            g.strokeStyle='#775e46';g.lineWidth=.65;for(const sy of [-1,1]){g.beginPath();g.moveTo(sy*r*.1,r*.19);g.lineTo(sy*r*.52,r*.13);g.moveTo(sy*r*.1,r*.24);g.lineTo(sy*r*.51,r*.29);g.stroke();}g.restore();
            if(lady){g.fillStyle='#a03780';g.beginPath();g.moveTo(0,-r*.45);g.lineTo(-r*.32,-r*.65);g.lineTo(-r*.3,-r*.25);g.closePath();g.fill();g.beginPath();g.moveTo(0,-r*.45);g.lineTo(r*.32,-r*.65);g.lineTo(r*.3,-r*.25);g.closePath();g.fill();circle(g,0,-r*.45,r*.09,'#f0abc4');}
            // Projected great-circle ribs track travelled distance / ball radius.
            g.save();g.rotate(heading);g.strokeStyle='#2e66608c';g.lineWidth=1.5;
            for(let i=0;i<3;i++){g.beginPath();g.ellipse(0,0,Math.max(.1,Math.abs(Math.cos(roll+i*Math.PI/3))*r),r,0,0,TAU);g.stroke();}g.restore();
            g.strokeStyle='#ffffffc4';g.lineWidth=2.8;g.beginPath();g.arc(0,0,r*.81,3.65,4.7);g.stroke();
            if(shield){circle(g,0,0,r+7,'#bd51b222','#a03780',2);g.setLineDash([3,4]);circle(g,0,0,r+11,null,'#a03780',1);}
            g.restore();
        }
        function rocks(g,st) {
            for(const b of R.solids(st)) {
                const p=b.poly;g.beginPath();g.moveTo(p[0].x,p[0].y);p.slice(1).forEach(v=>g.lineTo(v.x,v.y));g.closePath();
                g.fillStyle=b.gate?'#a03780':b.lowWall?'#777c69':'#303d35';g.fill();g.strokeStyle='#192c25';g.lineWidth=2;g.stroke();
                if(!b.lowWall){const cx=p.reduce((n,v)=>n+v.x,0)/p.length,cy=p.reduce((n,v)=>n+v.y,0)/p.length;
                    g.beginPath();g.moveTo(p[0].x,p[0].y);g.lineTo(cx,cy);g.lineTo(p[2].x,p[2].y);g.strokeStyle='#869287';g.lineWidth=2;g.stroke();
                }
            }
        }
        function monster(g,m,time) {
            if (!m.released) {
                circle(g,m.x,m.y,m.r+12,'#a0378012',magenta,1.5);
                text(g,m.name.toUpperCase(),m.x,m.y,12,magenta);
                return;
            }
            if (m.kind === 'hedgehog') {
                if(m.state==='warning') {
                    g.setLineDash([14,8]);g.strokeStyle='#b33642';g.lineWidth=3;
                    g.beginPath();g.moveTo(m.x,m.y);g.lineTo(m.aim.x,m.aim.y);g.stroke();g.setLineDash([]);
                    text(g,'CHARGE '+Math.max(0,m.until-time).toFixed(1)+' s',m.x,m.y-m.r-24,14,'#b33642');
                }
                const curled=m.state==='charge'||m.state==='warning';
                g.save();g.translate(m.x,m.y);g.rotate(curled?(m.roll||0):Math.atan2(m.vy,m.vx));
                circle(g,5,9,m.r,'#35453333');
                // The collision silhouette is a circle; short dark quills sit inside it.
                g.beginPath();
                for(let i=0;i<64;i++) {const a=i*TAU/64,r=m.r*(i%2?.84:1);if(i===0)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
                g.closePath();g.fillStyle='#725844';g.fill();g.strokeStyle='#433c30';g.lineWidth=2;g.stroke();
                circle(g,0,0,m.r*.76,'#947356');
                for(let ring=0;ring<2;ring++)for(let i=0;i<15;i++) {
                    const a=i*TAU/15+ring*.35,r=m.r*(ring?.60:.35);
                    g.beginPath();g.moveTo(Math.cos(a)*r,Math.sin(a)*r);g.lineTo(Math.cos(a+.14)*(r+8),Math.sin(a+.14)*(r+8));
                    g.strokeStyle='#d7b587';g.lineWidth=2;g.stroke();
                }
                if(!curled) {
                    circle(g,m.r*.54,0,m.r*.35,'#e1cda6');
                    circle(g,m.r*.65,-m.r*.18,m.r*.045,'#302f29');circle(g,m.r*.65,m.r*.18,m.r*.045,'#302f29');
                    circle(g,m.r*.94,0,m.r*.075,'#4c3638');
                } else circle(g,0,0,m.r*.13,'#caae85');
                g.restore();
                text(g,m.name.toUpperCase(),m.x,m.y+m.r+25,13,ink);
                text(g,'INVULNERABLE · '+m.state.toUpperCase(),m.x,m.y+m.r+44,11,'#9b3747');
                return;
            }
            const asleep=m.health<=0;
            if(m.state==='warning'&&!asleep){g.setLineDash([14,8]);g.strokeStyle='#b33642';g.lineWidth=3;g.beginPath();g.moveTo(m.x,m.y);g.lineTo(m.x+Math.cos(m.angle)*440,m.y+Math.sin(m.angle)*440);g.stroke();g.setLineDash([]);text(g,'CHARGE '+Math.max(0,m.until-time).toFixed(1)+' s',m.x,m.y-m.r-35,13,'#b33642');}
            g.save();g.translate(m.x,m.y);const a=asleep?0:Math.atan2(m.vy,m.vx);g.rotate(a);
            g.fillStyle='#3b483533';g.beginPath();g.ellipse(6,8,m.r*1.06,m.r*.83,0,0,TAU);g.fill();
            if(m.kind==='rabbit')for(const y of [-1,1]){g.fillStyle='#bba998';g.beginPath();g.ellipse(m.r*.2,y*m.r*.64,m.r*.75,m.r*.2,-y*.5,0,TAU);g.fill();g.fillStyle='#e2b6af';g.beginPath();g.ellipse(m.r*.2,y*m.r*.64,m.r*.5,m.r*.1,-y*.5,0,TAU);g.fill();}
            if(m.kind==='mouse'){g.strokeStyle='#c09493';g.lineWidth=5;g.beginPath();g.moveTo(-m.r*.8,0);g.quadraticCurveTo(-m.r*1.6,-m.r*.4,-m.r*1.45,m.r*.6);g.stroke();}
            g.fillStyle=m.kind==='rabbit'?'#cdbbaa':m.kind==='mouse'?'#b8b6aa':'#a4774c';g.strokeStyle='#775d42';g.lineWidth=2;g.beginPath();g.ellipse(0,0,m.r,m.r*.78,0,0,TAU);g.fill();g.stroke();
            circle(g,-m.r*.38,-m.r*.15,m.r*.47,m.kind==='rabbit'?'#e1d6bc':'#efe1b5');
            if(m.kind!=='rabbit')for(const y of [-1,1]){circle(g,m.r*.15,y*m.r*.58,m.r*.18,'#ad8060');circle(g,m.r*.15,y*m.r*.58,m.r*.10,'#dca69c');}
            for(const y of [-1,1]){if(asleep){g.strokeStyle='#2c352c';g.beginPath();g.moveTo(m.r*.5,y*m.r*.3-3);g.lineTo(m.r*.65,y*m.r*.3+3);g.stroke();}else circle(g,m.r*.5,y*m.r*.3,m.r*.06,'#2c352c');}
            circle(g,m.r*.91,0,m.r*.08,'#815856');g.restore();
            text(g,m.name.toUpperCase(),m.x,m.y+m.r+23,13,ink);
            text(g,asleep?'ZZZ · NAP TIME':Math.ceil(100*m.health/m.maxHealth)+'% · '+m.state.toUpperCase(),m.x,m.y+m.r+42,11,asleep?magenta:'#914d42');
        }
        function flame(g,run,c) {
            const st=run.rampage,s=run.ship,fire=c.fire;if(!fire||st.control<fire.unlockControl)return;
            if(!st.fireActive){g.strokeStyle='#c6754699';g.setLineDash([7,5]);g.lineWidth=1.5;g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x+Math.cos(st.aim)*85,s.y+Math.sin(st.aim)*85);g.stroke();g.setLineDash([]);return;}
            const gradient=g.createRadialGradient(s.x,s.y,0,s.x,s.y,fire.range);gradient.addColorStop(0,'#fff2a1dd');gradient.addColorStop(.45,'#ee9b39bb');gradient.addColorStop(1,'#d8553622');
            g.beginPath();g.moveTo(s.x,s.y);
            for(let i=0;i<=18;i++){
                const a=st.aim-fire.spread+2*fire.spread*i/18;let range=fire.range*(.96+.04*Math.sin(i*3+run.time*15));
                const point=r=>({x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r});
                if(R.blocked(st,s,point(range))){let lo=0,hi=range;for(let n=0;n<7;n++){const mid=(lo+hi)/2;if(R.blocked(st,s,point(mid)))hi=mid;else lo=mid;}range=lo;}
                const p=point(range);g.lineTo(p.x,p.y);
            }g.closePath();g.fillStyle=gradient;g.fill();
            for(let i=0;i<14;i++){const u=(run.time*1.8+i*.127)%1,a=st.aim+Math.sin(i*4)*fire.spread*.75;
                const x=s.x+Math.cos(a)*fire.range*u,y=s.y+Math.sin(a)*fire.range*u;
                if(!R.blocked(st,s,{x,y})){g.globalAlpha=(1-u)*.7;circle(g,x,y,4+u*12,i%2?'#ffbd56':'#e96e37');g.globalAlpha=1;}}
        }
        function volcanoes(g,st,time) {
            // Follow the shared high-resolution contour exactly, so the
            // winding visible banks agree with the damaging footprint.
            function outline(poly) {
                g.beginPath();
                poly.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));
                g.closePath();
            }
            for(const v of st.volcanoes || []) {
                const state=R.volcanoState(v,time),hot=state.active,warn=state.phase==='warning';
                const color=hot?'#c94e2e':warn?'#aa7625':'#77654e';
                g.save();g.lineJoin='round';g.lineCap='round';
                const apron=g.createRadialGradient(v.x,v.y,v.r*.5,v.x,v.y,v.r+65);
                apron.addColorStop(0,'#65594eff');apron.addColorStop(.6,'#8b796f90');apron.addColorStop(1,'#8b796f00');
                circle(g,v.x,v.y,v.r+65,apron);
                for(const poly of v.zones) {
                    const c=poly.reduce((a,p)=>({x:a.x+p.x/poly.length,y:a.y+p.y/poly.length}),{x:0,y:0});
                    // A cooled feeder joins the channel to the crater, including
                    // the safe gap on Muesli Furnace. It never glows like hot lava.
                    const mouth=poly.reduce((a,p)=>Math.hypot(p.x-v.x,p.y-v.y)<Math.hypot(a.x-v.x,a.y-v.y)?p:a);
                    g.beginPath();g.moveTo(v.x,v.y);g.quadraticCurveTo(v.x,mouth.y,mouth.x,mouth.y);
                    g.strokeStyle='#8b796f90';g.lineWidth=v.r*1.5;g.stroke();
                    outline(poly);g.strokeStyle='#ad98826b';g.lineWidth=22;g.stroke();
                    g.fillStyle='#776858';g.fill();g.strokeStyle='#706357';g.lineWidth=7;g.stroke();
                    outline(poly);g.fillStyle=hot?(v.steam?'#dedcccaa':'#d8683280'):warn?'#dcb44f55':'#a38b6328';g.fill();
                    g.save();g.clip();
                    const bed=g.createRadialGradient(v.x,v.y,0,v.x,v.y,Math.hypot(c.x-v.x,c.y-v.y)*2+v.r);
                    bed.addColorStop(0,hot?(v.steam?'#fff2d8':'#fff09a'):warn?'#dcb663':'#544d46');
                    bed.addColorStop(1,hot?(v.steam?'#abaeaa':'#9b3925'):warn?'#977341':'#897360');
                    outline(poly);g.fillStyle=bed;g.fill();
                    const angle=Math.atan2(c.y-v.y,c.x-v.x),length=Math.max(...poly.map(p=>Math.hypot(p.x-v.x,p.y-v.y)));
                    g.translate(v.x,v.y);g.rotate(angle);
                    for(let lane=-2;lane<=2;lane++) {
                        g.beginPath();
                        for(let x=0;x<=length+12;x+=12) {
                            const y=lane*13+Math.sin(x*.035+lane*2)*5+Math.sin(x*.013-lane)*7;
                            if(x)g.lineTo(x,y);else g.moveTo(x,y);
                        }
                        g.strokeStyle=hot?(v.steam?'#f9f5e680':lane%2?'#ffcf728c':'#742e2870'):'#d4b48745';
                        g.lineWidth=hot?4:1.5;g.stroke();
                    }
                    if(hot)for(let i=0;i<18;i++) {
                        const u=(time*(v.steam?.13:.09)+i*.137)%1;
                        const x=u*length,y=Math.sin(i*7)*30+Math.sin(x*.035)*5;
                        circle(g,x,y,v.steam?8+u*13:2+u*3,v.steam?'#faf3df50':'#ffe9a899');
                    }
                    g.restore();
                }
                const cone=g.createRadialGradient(v.x-v.r*.25,v.y-v.r*.3,v.r*.15,v.x,v.y,v.r+8);
                cone.addColorStop(0,'#a68c70');cone.addColorStop(.6,'#78685c');cone.addColorStop(1,'#554c46');
                circle(g,v.x,v.y,v.r+8,cone);
                circle(g,v.x,v.y,v.r*.68,'#433e39','#b09a7a',3);
                circle(g,v.x,v.y,v.r*.5,hot?(v.steam?'#f4e7cf':'#ffc26c'):warn?'#d79b49':'#776859');
                text(g,v.name,v.x,v.y-v.r-30,12,color);
                text(g,(hot?'ERUPTING · ':warn?'ERUPTION IN ':'QUIET · ERUPTION IN ')+state.remaining.toFixed(1)+' s',v.x,v.y-v.r-13,10,color);
                g.restore();
            }
        }
        function render(v){
            const {level,run,zoom,settings,ghost}=v,c=level.rampage,st=run.rampage,s=run.ship;
            const box=canvas.getBoundingClientRect(),w=box.width,h=box.height,dpr=Math.min(2,root.devicePixelRatio||1);
            if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
            if(cachedLevel!==level){cache=map(level);cachedLevel=level;}
            const availableH=Math.max(120,h-170),base=Math.min(w/level.world[0],availableH/level.world[1]);
            // Portrait starts closer in; zoom-out still permits the whole field sheet.
            const factor=zoom===1?(w<650?1.85:1):zoom===1.65?2.5:1;
            scale=base*factor;
            const cw=w/scale,ch=availableH/scale;
            const cx=factor===1?level.world[0]/2:Math.max(cw/2,Math.min(level.world[0]-cw/2,s.x+90));
            const cy=factor===1?level.world[1]/2:Math.max(ch/2,Math.min(level.world[1]-ch/2,s.y));
            const tx=w/2-cx*scale,ty=105+availableH/2-cy*scale;
            ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#eae8d5';ctx.fillRect(0,0,w,h);
            ctx.translate(tx,ty);ctx.scale(scale,scale);ctx.drawImage(cache,0,0);rocks(ctx,st);volcanoes(ctx,st,run.time);
            if(c.fire)text(ctx,'LOW WALLS · FIRE OVER, NOT THROUGH',1190,316,12,ink);
            for(const [i,p] of c.controls.entries())if(i<st.control)text(ctx,'✓',p.x,p.y+10,30,magenta);
            for(const [i,d] of st.districts.entries()){
                // Small architectural clusters are cosmetic; the striped central core is solid.
                for(let j=0;j<8;j++){const a=j*TAU/8,xx=d.x+Math.cos(a)*64,yy=d.y+Math.sin(a)*61;ctx.save();ctx.translate(xx,yy);ctx.rotate(j*.35);ctx.fillStyle=d.health>0?'#b6b7a6':'#cbbfa3';ctx.fillRect(-8,-5,16,10);ctx.strokeStyle='#535e4e';ctx.lineWidth=.8;ctx.strokeRect(-8,-5,16,10);ctx.restore();}
                if(d.health>0){circle(ctx,d.x,d.y,d.r,'#c58c78',ink,2);ctx.fillStyle='#4d544c';ctx.fillRect(d.x-16,d.y-17,32,34);ctx.fillStyle='#f2d3a1';ctx.fillRect(d.x-10,d.y-11,20,22);
                    text(ctx,String(d.number || i+c.controls.length+1).padStart(2,'0'),d.x,d.y+5,15,ink);text(ctx,d.name.toUpperCase(),d.x,d.y-89,14);text(ctx,Math.ceil(100*d.health/d.maxHealth)+(d.fireOnly?'% · BURN CORE':'% · RAM CORE'),d.x,d.y+92,11,'#984d46');
                    if(d.aim){ctx.setLineDash([9,6]);ctx.strokeStyle='#b04342';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.aim.x,d.aim.y);ctx.stroke();ctx.setLineDash([]);circle(ctx,d.aim.x,d.aim.y,15,null,'#b04342',1.5);text(ctx,'FIRE '+Math.max(0,d.shotAt-run.time).toFixed(1)+' s',d.x,d.y-65,11,'#b04342');}
                }else{circle(ctx,d.x,d.y,d.r+10,'#8d77622b');for(let j=0;j<7;j++){ctx.fillStyle=j%2?'#8d8473':'#b69d7e';ctx.fillRect(d.x+Math.sin(j*3)*25-8,d.y+Math.cos(j*3)*26-4,16,8);}text(ctx,d.name.toUpperCase()+' ✓',d.x,d.y-84,13,magenta);}
            }
            for(const m of st.monsters)monster(ctx,m,run.time);
            if(st.lady){const l=st.lady;ball(ctx,l.x,l.y,l.r,l.roll||0,l.a,1,false,(l.roll||0)*2,l.following&&!st.rescued?1:0,true);text(ctx,'LADY WHISKERDOOM',l.x,l.y-l.r-27,12,magenta);text(ctx,st.rescued?'SAFE ♥':Math.ceil(l.health)+'% · '+(l.following?'FOLLOWING':st.unlocked?'GREET HER':'CAGED'),l.x,l.y+l.r+27,11,magenta);}
            flame(ctx,run,c);
            for(const b of st.strikes || []) if(b.x!==null) {
                const countdown=Math.max(0,b.impactAt-run.time), red='#b33642';
                circle(ctx,b.x,b.y,b.r,'#cc334420',red,2.5);
                circle(ctx,b.x,b.y,b.r*Math.min(1,countdown/(b.impactAt-b.launchAt)),null,red,1);
                ctx.strokeStyle=red;ctx.lineWidth=2;ctx.beginPath();
                ctx.moveTo(b.x-b.r-12,b.y);ctx.lineTo(b.x+b.r+12,b.y);
                ctx.moveTo(b.x,b.y-b.r-12);ctx.lineTo(b.x,b.y+b.r+12);ctx.stroke();
                text(ctx,(b.target==='lady'?'LADY TARGETED · ':'LONG-RANGE ')+countdown.toFixed(1)+' s',b.x,b.y-b.r-20,12,red);
                if(countdown<1.2) {
                    // Descending shell is above the ground until the timed blast.
                    const q=countdown/1.2, x=b.x+160*q,y=b.y-320*q;
                    ctx.strokeStyle='#cf6b33';ctx.lineWidth=3;
                    ctx.beginPath();ctx.moveTo(x+13,y-26);ctx.lineTo(x,y);ctx.stroke();
                    circle(ctx,x,y,4,'#a63037','#f9d296',1.5);
                }
            }
            for(const b of st.shots){circle(ctx,b.x,b.y,5,'#b44538','#f8d4a2',2);}
            if(settings.guide&&Math.hypot(s.vx,s.vy)>.3){ctx.setLineDash([8,5]);ctx.strokeStyle='#45685088';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x+s.vx*4,s.y+s.vy*4);ctx.stroke();ctx.setLineDash([]);}
            if(settings.ghost&&ghost?.length){let a=ghost[0];for(const b of ghost){if(b[0]>run.time)break;a=b;}ball(ctx,a[1],a[2],c.radius,run.time,a[3],.18);}
            for(const f of st.flashes){const u=(run.time-f.t)/1.5;ctx.globalAlpha=1-u;circle(ctx,f.x,f.y,f.strike?f.r*(.7+u*.4):15+u*65,null,f.strike?'#b33642':magenta,f.strike?5:2);ctx.globalAlpha=1;}
            ball(ctx,s.x,s.y,c.radius,st.roll,s.a,1,R.protectedAt(run),st.pawPhase,st.effort);
            if(st.wet>.5){text(ctx,'SPIN ≠ TRACTION',s.x,s.y-c.radius-19,10,'#416f86');}
            ctx.setTransform(dpr,0,0,dpr,0,0);
        }
        return {render,get scale(){return scale;}};
    }
    root.GerboView={prepare,update,dialog,createRenderer};
})(typeof globalThis!=='undefined'?globalThis:this);
