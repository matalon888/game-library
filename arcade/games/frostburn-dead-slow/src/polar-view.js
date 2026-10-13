/* Pale Reach chart and bridge UI. All collision geometry comes from the simulation. */
(function(root){
    'use strict';
    const P=typeof module!=='undefined'&&module.exports?require('./physics.js'):root.HarborPhysics;
    const I=typeof module!=='undefined'&&module.exports?require('./polar.js'):root.PaleReach;
    const G=typeof module!=='undefined'&&module.exports?require('./polar-grid.js'):root.PaleReachGrid;
    const U=typeof module!=='undefined'&&module.exports?require('./submarine-view.js'):root.PaleReachSubmarineView;
    const L=typeof module!=='undefined'&&module.exports?require('./polar-labels.js'):root.PaleReachLabels;
    let convoyOrder,bridgeOrder;
    const $=id=>document.getElementById(id);
    const set=(id,v)=>{const node=$(id),text=String(v);if(node.textContent!==text)node.textContent=text;};
    const html=(id,v)=>{const node=$(id);if(node.innerHTML!==v)node.innerHTML=v;};
    const iceLayers=new WeakMap(),CHUNK=96,SLUSH_BANDS=32;
    function iceBand(st,k){return !st.ice.thickness[k]?-2:st.ice.opened[k]<0?-1:Math.round(I.slushAt(st,k)*SLUSH_BANDS);}
    function paintIce(cache,ice,b){
        const ctx=cache.ctx;
        ctx.save();ctx.beginPath();ctx.rect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);ctx.clip();
        // Repaint from opaque water so fading slush cannot accumulate opacity.
        ctx.fillStyle='#173e4a';ctx.fillRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
        G.each(ice,{minX:b.minX-1,minY:b.minY-1,maxX:b.maxX+1,maxY:b.maxY+1},(k,{x,y,poly})=>{
            const band=cache.bands[k],t=ice.thickness[k];if(band===-2)return;
            ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
            if(band>=0){
                const density=band/SLUSH_BANDS;
                ctx.fillStyle=`rgba(154,195,199,${.08+density*.49})`;ctx.fill();
                ctx.strokeStyle=`rgba(154,195,199,${.06+density*.18})`;ctx.lineWidth=.65;ctx.stroke();
                if(density>.12){ctx.fillStyle=`rgba(215,232,225,${density*.8})`;ctx.fillRect(x-3,y-3,2,1.6);ctx.fillRect(x+1,y+2,2.5,1.6);}
            }else{
                ctx.fillStyle=t>=1?'#cbd0bd':t>.7?'#bad1d1':t>.4?'#8eb8c2':'#648f9f';ctx.fill();
                ctx.strokeStyle=t>=1?'#929b8755':'#345e7048';ctx.lineWidth=.8;ctx.stroke();
                if(k%7===0){
                    ctx.beginPath();for(let a=0;a<3;a++){
                        const dx=Math.cos(a*Math.PI/3)*3,dy=Math.sin(a*Math.PI/3)*3;
                        ctx.moveTo(x-dx,y-dy);ctx.lineTo(x+dx,y+dy);
                    }
                    ctx.strokeStyle=t>=1?'#929b87':'#47708088';ctx.lineWidth=.7;ctx.stroke();
                }
                if(t>=1&&k%3===0){ctx.beginPath();ctx.moveTo(x-3,y+3);ctx.lineTo(x,y-3);ctx.lineTo(x+3,y+3);ctx.strokeStyle='#89927d';ctx.lineWidth=1;ctx.stroke();}
            }
        });
        ctx.restore();
    }
    function paintChunk(cache,ice,k,cols){
        const x=k%cols*CHUNK,y=Math.floor(k/cols)*CHUNK;
        paintIce(cache,ice,{minX:x,minY:y,maxX:Math.min(x+CHUNK,ice.width),maxY:Math.min(y+CHUNK,ice.height)});
    }
    function iceSurface(st,resolution){
        const ice=st.ice;let cache=iceLayers.get(ice);
        if(!cache||cache.resolution!==resolution){
            const surface=document.createElement('canvas');surface.width=Math.ceil(ice.width*resolution);surface.height=Math.ceil(ice.height*resolution);
            const ctx=surface.getContext('2d');ctx.setTransform(resolution,0,0,resolution,0,0);
            cache={surface,ctx,resolution,bands:Int8Array.from(ice.thickness,(_,k)=>iceBand(st,k)),revision:ice.revision,hasSlush:ice.opened.some(t=>t>=0),nextRefresh:st.time+.125};
            // Use identical clipping for the first paint and later dirty regions;
            // rasterizers can round clipped hex edges differently otherwise.
            const cols=Math.ceil(ice.width/CHUNK),rows=Math.ceil(ice.height/CHUNK);
            for(let k=0;k<cols*rows;k++)paintChunk(cache,ice,k,cols);
            iceLayers.set(ice,cache);
        }else if(cache.revision!==ice.revision||cache.hasSlush&&st.time>=cache.nextRefresh){
            const dirty=new Set(),cols=Math.ceil(ice.width/CHUNK),rows=Math.ceil(ice.height/CHUNK),pad=ice.radius+1;
            for(let k=0;k<ice.thickness.length;k++){
                const band=iceBand(st,k);if(band===cache.bands[k])continue;
                cache.bands[k]=band;if(band>=0)cache.hasSlush=true;
                const {x,y}=ice.tiles[k];
                for(let j=Math.max(0,Math.floor((y-pad)/CHUNK));j<=Math.min(rows-1,Math.floor((y+pad)/CHUNK));j++)
                    for(let i=Math.max(0,Math.floor((x-pad)/CHUNK));i<=Math.min(cols-1,Math.floor((x+pad)/CHUNK));i++)dirty.add(j*cols+i);
            }
            for(const k of dirty)paintChunk(cache,ice,k,cols);
            cache.revision=ice.revision;cache.nextRefresh=st.time+.125;
        }
        return cache.surface;
    }
    function splitRows(run,format){
        return I.progress(run).map(o=>{
            const split=run.splits.find(p=>p.name===o.text),done=!!split;
            return `<div class="split-row ${done?'done':''}"><span>${o.text}</span><span>${done?format(split.time):'—'}</span></div>`;
        }).join('');
    }
    function prepare(level,command,action){
        convoyOrder=command;bridgeOrder=action;$('polar-phase').hidden=!level.polar?.finale;
        const entering=$('polar-info').hidden,c=level.polar;
        $('polar-info').hidden=!c;$('horn-btn').hidden=!!c?.underwater;
        $('polar-sub-controls').hidden=true;
        const controls=!!(c&&(c.underwater||c.survey||c.gun||c.fleet?.some(f=>!f.leader)));
        $('polar-panel').hidden=!controls;document.body.dataset.polarControls=String(controls);
        if(!c)return;
        if(entering)$('polar-info').open=!(root.matchMedia?.('(max-width:820px), (max-height:530px)').matches);
        $('polar-sub-status').hidden=!c.underwater;$('polar-surface-status').hidden=!!c.underwater;
        $('polar-tow-readout').hidden=!c.survey;$('polar-gun-readout').hidden=!c.gun;
        set('polar-brief',level.brief);set('polar-tip',level.tip);
        if(level.polar.underwater)return U.prepare(level,action);
        document.title='DEAD SLOW — Race for the Pale Reach';
        set('courses-btn','World map');set('check-objectives','Passage objectives');
        if(level.polar.mission==='defense'){
            set('dock-list-label','EVACUATION STATUS');set('check-objectives','Essential cargo ashore');
            set('check-inside','Hearth safe');set('check-aligned','Pantry safe');set('check-slow','Base intact');
        }
        $('chart-section').setAttribute('aria-label','Polar passage chart and vessels');
        $('sea').setAttribute('aria-label','Polar passage chart: blue thin ice, cream pressure ridges, closing slush and solid drifting ice.');
        $('polar-fleet').innerHTML=(level.polar.fleet||[]).filter(f=>!f.leader).map(f=>`<div class="polar-order"><strong>${f.name}</strong><div><button data-convoy="${f.id}" data-order="hold">Hold</button><button data-convoy="${f.id}" data-order="proceed">Proceed</button></div></div>`).join('');
        $('polar-fleet-readouts').innerHTML=(c.fleet||[]).filter(f=>!f.leader).map(f=>`<div><strong>${f.name}</strong><span id="polar-${f.id}-status"></span></div>`).join('');
        $('polar-fleet').onclick=e=>{const b=e.target.closest('[data-convoy]');if(b&&!b.disabled)command(b.dataset.convoy,b.dataset.order);};
        $('polar-actions').hidden=!['survey','defense','strike','rescue'].includes(level.polar.mission);
        $('polar-tow-controls').hidden=!level.polar.survey;$('polar-gun-controls').hidden=!level.polar.gun;
        $('polar-actions').onclick=e=>{const b=e.target.closest('[data-polar-action],[data-polar-target]');if(b&&!b.disabled)action(b.dataset.polarTarget?'target':b.dataset.polarAction,b.dataset.polarTarget);};
        set('polar-dispatch',level.polar.dispatch[0]);
        set('polar-legend','BLUE · thin sheet / CREAM · pressure ridge / SPECKLED · closing slush / WHITE · solid drifting ice');
    }
    function update(level,run,status,format,race=null){
        if(run.polar.rebridge){prepare(run.polar.level,convoyOrder,bridgeOrder);run.polar.rebridge=false;set('ship-name',run.ship.name);set('brief',run.polar.config.dispatch[1]);set('hint','Kestrel has the watch. Reopen the aging lead and use Hold / Proceed to bring all three relief ships through.');}
        set('polar-summary',run.ship.name.split(' · ').at(-1));
        $('race-banner').hidden=!race;
        if(race)set('race-banner',`${race.id==='grand-tour'?'GRAND TOUR':'PALE REACH'} ${race.position+1}/${race.route.length} · ${format(race.total+(status==='complete'?0:run.time))}${race.practice?' · PRACTICE':''}`);
        if(run.finalJourney){const w=run.finalJourney.watch;$('polar-phase').hidden=false;set('polar-phase',`${w.phase==='underwater'?'LEG 1 / PETREL':'LEG 2 / KESTREL'} · ${format(Math.max(0,w.deadline-run.time))} WEATHER REMAINING`);}
        if(run.polar.submarine)return U.update(level,run,status,format);
        const s=run.ship,st=run.polar,o=st.operation,m=P.groundMotion(s),h=Math.max(0,Math.ceil(s.hull)),g=I.gap(run);
        set('speed',(m.surge<0?'−':'')+(m.speed*1.94384).toFixed(1));set('mobile-speed',$('speed').textContent);
        set('speed-direction',m.direction.toUpperCase());set('mobile-direction',m.direction.toUpperCase());
        set('heading',String(Math.round((s.a*180/Math.PI+450)%360)).padStart(3,'0'));
        set('drift',`SIDE DRIFT ${(Math.abs(m.sway)*1.94384).toFixed(1)} kn`);
        set('shelter-status',st.slush>.15?'CHANNEL THICKENING':'POLAR PASSAGE');set('local-set','ICE DRIFT · WATCH THE FLOES');
        set('weather-text','PALE REACH · VISIBILITY GOOD · ICE UNDER PRESSURE');
        set('hull-label',h+'%');set('mobile-hull',h);set('contacts',run.contacts);set('mobile-hits',run.contacts);set('engine-read',Math.round(s.engine*100));
        $('hull-bar').style.width=h+'%';$('hull-bar').style.background=h<35?'var(--red)':'var(--green)';
        $('rudder-indicator').style.left=`calc(${50+s.rudder*47}% - 3px)`;
        const names=['FULL ASTERN','HALF ASTERN','DEAD SLOW ASTERN','STOP','DEAD SLOW','SLOW AHEAD','HALF AHEAD','FULL AHEAD'];
        set('telegraph-name',names[s.throttle+3]);set('telegraph-detail',s.throttle===0?'NEUTRAL · STILL COASTING':s.iceClass?'ICEBREAKING BOW · KEEP ROOM TO BRAKE':'LADEN HULL · CANNOT BREAK SHEET');
        html('notches',Array.from({length:8},(_,i)=>`<span class="notch ${i<3?'reverse':i===3?'zero':''} ${i===s.throttle+3?'active':''}"></span>`).join(''));
        set('mission-status',status==='paused'?'Paused · unranked practice':I.message(run));
        set('polar-notice',$('mission-status').textContent);
        set('mobile-extra',g?`GAP ${Math.round(g.metres)}m`:`SLUSH ${Math.round(st.slush*100)}%`);
        set('polar-readout',g?`${Math.round(g.metres)} m HULL GAP · ${g.closing>0?'CLOSING':'OPENING'} ${Math.abs(g.closing).toFixed(1)} m/s`:
            o?.kind==='rescue'?`${st.fleet.filter(f=>f.rescued).length}/3 GROUPS CONTACTED · ${st.stats.safeReturns}/3 SAFE · ORIEL ${o.survey.safeNow?'IN REFUGE':'NEEDS A TOW'}`:
            o?.kind==='transit'?`${st.stats.safeReturns}/${st.fleet.length} RELIEF SHIPS THROUGH · DENIAL SYSTEM ISOLATED`:
            o?.kind==='survey'?`RECORDERS ${o.survey.recovered?'ABOARD':Math.floor(o.survey.recorders)+' / 8 s'} · CALIPER ${Math.ceil(o.survey.ship.hull)}%`:o?.kind==='strike'?`${o.assets.filter(a=>a.team==='hostile'&&a.ship.hull<=0).length}/2 INSTALLATIONS DISABLED`:
            st.config.mission==='pocket'?`TURNING POCKET ${Math.floor(I.pocketClear(st)*100)}% / 86%`:`${st.stats.deliveries}/2 DELIVERED · ${st.stats.safeReturns}/2 RETURNED`);
        $('polar-readout').classList.toggle('warning',!!g&&(g.metres<22||g.metres>70));
        set('polar-ice',`SLUSH LOAD ${Math.round(st.slush*100)}% · ${(st.stats.sheetArea/1000).toFixed(1)}k m² OPENED`);
        for(const f of st.fleet.filter(f=>!f.leader)){
            set('polar-'+f.id+'-status',`${f.waiting} · hull ${Math.ceil(f.ship.hull)}% · ${(I.speed(f.ship)*1.94384).toFixed(1)} kn`);
            for(const b of $('polar-fleet').querySelectorAll(`[data-convoy="${f.id}"]`)){
                b.disabled=status!=='running'||f.returned||f.leg==='unloading';b.classList.toggle('selected',f.order===b.dataset.order);b.setAttribute('aria-pressed',String(f.order===b.dataset.order));
            }
        }
        if(o?.survey)set('polar-tow-readout',o.line?`${Math.round(o.line.length)} m LINE · ${Math.round(o.line.tension*100)}% TENSION`:'STERN TO BOW · 55 m MAX · SLOW RELATIVE MOTION');
        if(o?.gun){
            const g=o.gun,targets=I.operations.targets(st),target=targets.find(t=>t.id===g.target);
            html('polar-targets',targets.map(t=>`<button data-polar-target="${t.id}" class="${t.id===g.target?'selected':''}" aria-pressed="${t.id===g.target}">${t.name} · ${Math.ceil(t.ship.hull/(t.ship.maxHull||100)*100)}%</button>`).join(''));
            const ready=g.solution>=g.hold&&g.cooldown===0&&g.ammo>0;
            set('polar-gun-readout',`${target?target.name+' · '+Math.round(Math.hypot(target.ship.x-s.x,target.ship.y-s.y))+' m':'SELECT A HOSTILE CONTACT'} / ${g.ammo} ROUNDS · ${g.cooldown>0?'RELOAD '+g.cooldown.toFixed(1)+' s':ready?'SOLUTION READY':g.reason+' · '+g.solution.toFixed(1)+' / '+g.hold+' s'}`);
            $('polar-fire').disabled=status!=='running'||!ready;
        }
        html('splits',splitRows(run,format));
        $('check-objectives').classList.toggle('ok',I.ready(run));
        for(const k of ['inside','aligned','slow'])$('check-'+k).classList.toggle('ok',!!run.dock[k]);
        $('dock-bar').style.width=Math.min(100,run.dockHold*50)+'%';
        if(o?.kind==='defense'){
            $('check-objectives').classList.toggle('ok',st.fleet.every(f=>f.unloaded));
            $('check-inside').classList.toggle('ok',st.fleet[0].returned);$('check-aligned').classList.toggle('ok',st.fleet[1].returned);
            $('check-slow').classList.toggle('ok',o.assets[0].ship.hull>0);$('dock-bar').style.width=st.stats.safeReturns*50+'%';
        }
        if(o?.kind==='rescue'||o?.kind==='transit'){
            set('dock-list-label',o.kind==='rescue'?'RESCUE STATUS':'RELIEF PASSAGE');set('check-objectives',o.kind==='rescue'?'All groups contacted':'Engineers recovered');set('check-inside','First ship safe');set('check-aligned','Every ship safe');set('check-slow',o.kind==='rescue'?'Oriel in refuge':'Weather window open');
            $('check-objectives').classList.toggle('ok',st.fleet.every(f=>f.rescued));$('check-inside').classList.toggle('ok',st.fleet.some(f=>f.returned));$('check-aligned').classList.toggle('ok',st.fleet.every(f=>f.returned));$('check-slow').classList.toggle('ok',o.kind==='rescue'?o.survey.safeNow:run.time<st.journey.deadline);$('dock-bar').style.width=st.stats.safeReturns/st.fleet.length*100+'%';
        }
        set('clock',format(run.time));set('clock-label',run.pausedUsed?'PRACTICE · UNRANKED':'PASSAGE TIME · IGT');$('clock-label').classList.toggle('practice',run.pausedUsed);
        set('delta','ALL REQUIRED HULLS MUST SURVIVE');set('scale-label','100 METRES');
    }
    function dialog(kind,level,run,format,hasNext=false,race=null,actions=''){
        if(kind==='result'&&race)actions=`<div class="race-banner">${race.id==='grand-tour'?'GRAND TOUR':'PALE REACH CAMPAIGN'} · ${race.stages}/${race.route.length} · ${format(race.total)} · ${race.retries} retries${race.practice?' · PRACTICE':''}</div>`+actions;
        if(run.polar.submarine)return U.dialog(kind,level,run,format,hasNext,race,actions);
        if(run.finalJourney)level=run.polar.level;
        const st=run.polar,c=level.polar,eyebrow=`<div class="eyebrow">WORLD 7 · PASSAGE SERVICE · ${String(level.stageNumber).padStart(2,'0')} / 12</div>`;
        const retry='<button data-action="retry">Retry<span class="key-hint"> · Shift+R</span></button><button data-action="courses">World map</button>';
        if(kind==='intro')return `${eyebrow}<h1>${level.name}</h1><p>${level.brief}</p><div class="polar-message"><strong>${c.dispatch[0]}</strong><p>${c.dispatch[1]}</p></div><p class="subtle">${level.tip}</p><div class="control-summary">Engine telegraph, rudder and bow thruster below.<span class="keyboard-only"><br>W / S engine · A / D rudder · Q / E bow thruster · Space neutral</span><br>${c.mission==='survey'?'F: towline · J/K: winch. Eight steady seconds nearby transfers the recorders.':c.gun?'T: select hostile target · B: fire after the solution is ready. Slow below 2.4 kn and steady the bow.':c.mission==='convoy'?'Hold and Proceed orders control each supply captain. Both return legs are required.':'Neutral does not brake. Use astern thrust early.'}</div><div class="dialog-actions"><button class="primary" data-action="begin" autofocus>Take the watch →</button><button data-action="help">Ice pilot’s notes</button><button data-action="courses">World map</button></div>`;
        if(kind==='pause')return `${eyebrow}<h1>The watch is held.</h1><p>Vessels, drift and channel closure are paused together. This attempt is now unranked practice.</p><div class="dialog-actions"><button class="primary" data-action="resume" autofocus>Resume watch</button>${retry}</div>`;
        if(kind==='failed')return `${eyebrow}<h1>The assignment could not be completed.</h1><p>${st.failure||'The assignment could not be completed.'}</p><div class="result-time">${format(run.time)}</div><div class="dialog-actions">${retry}</div>`;
        if(kind==='result'&&['rescue','transit'].includes(c.mission))return `${eyebrow}<h1>${c.mission==='rescue'?'No flag on the lifeboats.':'The route is open.'}</h1><p>${c.mission==='rescue'?'All three stranded groups are in neutral anchorage, and Oriel is clear of the turning pocket. Every required crew survived. The gunboats can count their own claims.':'The engineers are back, the denial installation is isolated, and the final relief ship has cleared the passage. The political settlement remains fragile. The route is open, and the relief ships are through.'}</p><div class="result-time">${format(run.time)}</div><div class="section-label">SPLITS · ELAPSED IGT</div><div class="splits">${splitRows(run,format)}</div>${actions}`;
        const operationEnding={survey:['The recorders and their crew are safe.','Caliper is home, the monitoring station is intact, and the Council has the survey record. The buoys remain disputed.'],defense:['The essential cargo is ashore.','Both transports have cleared the base. The icebreaker has bought the harbor the time it needed. Surviving attackers do not change that result.'],strike:['The military transfer is stopped.','The coastal battery and fuel-transfer machinery are disabled. Kestrel has withdrawn with her crew. The route used to enter is already changing.']}[c.mission];
        if(kind==='result'&&operationEnding)return `${eyebrow}<h1>${operationEnding[0]}</h1><p>${operationEnding[1]}</p><div class="result-time">${format(run.time)}</div><div class="result-badge">${run.pausedUsed?'UNRANKED PRACTICE':run.pb?'NEW PERSONAL BEST':'ASSIGNMENT COMPLETE'}${run.result?.clean?' · CLEAN':''}</div><div class="section-label">SPLITS · ELAPSED IGT</div><div class="splits">${splitRows(run,format)}</div>${actions}`;
        if(kind==='result')return `${eyebrow}<h1>${c.mission==='convoy'?'Both crews are home.':c.mission==='follow'?'The cargo is ashore.':'A harbor, not just a channel.'}</h1><p>${c.mission==='convoy'?'Tern and Cinder have their supplies. The Council records two returning crews; the rival charts still disagree.':c.mission==='follow'?'Glass Quay’s crew can begin unloading Lantern. Rime holds clear while the lead thickens behind you.':'Thawmark now has turning room and a supply berth. The Council’s harbor master accepts the route as usable.'}</p><div class="result-time">${format(run.time)}</div><div class="result-badge">${run.pausedUsed?'UNRANKED PRACTICE':run.pb?'NEW PERSONAL BEST':'PASSAGE COMPLETE'}${run.result?.clean?' · CLEAN':''}</div><div class="section-label">SPLITS · ELAPSED IGT</div><div class="splits">${splitRows(run,format)}</div>${actions}`;
        return `${eyebrow}<h1>Read the water you make.</h1>${c.mission==='rescue'?'<p><b>Neutral rescue.</b> Moth, Reed and Bracken carry required survivors. Make rescue contact for four seconds within 72 m at low speed, then use Hold and Proceed. Their captains need connected water and stopping room. F makes or releases Oriel’s tow; bring her whole hull to the refuge outside the turning pocket. The short lead crosses visible gunboat fire; the marked southern lead is protected and longer. There are no player weapons or kill objectives.</p>':c.mission==='transit'?'<p><b>Final relief passage.</b> The engineers are home and the denial system is isolated. Kestrel now has the watch on the same clock. Rime opened only the first lead; cut the last section and reopen the aging slush before releasing the convoy. The final required relief ship clearing the far passage completes the campaign.</p>':''}<p><b>Sheet ice.</b> Blue is thinner; pale sheet needs more momentum. Meet it bow first at 3–5 kn in Kestrel. The bow fractures sheet a little wider than the hull. Sideways or stern-first contact does not cut a new route. A loaded supply hull cannot break sheet. Cream pressure ridges are impassable.</p><p><b>Closing channels.</b> Broken water steadily fills with speckled slush. More slush means more drag, not an invisible gate. It never solidifies underneath a hull. Passing an icebreaker through it clears it again. Watch the whole stern, especially on bends.</p><p><b>Solid moving ice.</b> A few substantial floes remain after breaking. The large striped iceberg moves independently and cannot be broken; leave room for its projected drift. Floe and hull collisions transfer momentum and damage vessels.</p><p><b>Working separation.</b> In Borrowed Water, keep roughly 25–65 m between hulls. Closing rate matters as much as gap. The leader slows physically against compressed ice and never waits just to preserve your spacing. Pass the marked bends in order. Rime finishing the lead does not fail the assignment; she waits at Glass Quay. A late arrival through heavy slush still counts.</p><p><b>Two supply captains.</b> Dashed outbound and return routes are requests for cleared water, not guaranteed safe tracks. Captains choose connected cleared water toward their destination and brake for intact ice, ships and icebergs. Hold also takes time to stop. Unloading needs a slow, stable hull; after it finishes, the captain waits for another Proceed before returning. You can reopen slushy return leads. Both supply ships must regain safe water before Kestrel docks.</p><p><b>Survey rescue.</b> No weapons are authorized. Bring the tug’s stern within 55 m of Caliper’s bow at low relative speed; F makes or releases the line. J/K winch it. A slack line cannot push, and an overloaded line can part. Hold within 65 m with little relative motion for eight seconds to recover the recorders. Return the whole survey hull to the green safe-water ellipse and stop it, then moor Kestrel. Protect the civilian station.</p><p><b>Surface combat.</b> T cycles hostile contacts; target buttons select directly. Kestrel’s forward gun reaches 290 m within its amber bow arc. Hold below 2.4 kn with little turn for 2.5 seconds; B fires one shell, followed by a nine-second reload. Intact sheet and pressure ridges block the firing line; opened slush permits fire. Shells have flight time and can strike intervening hulls or solid ice. Red solution lines and impact marks warn of enemy fire. Maneuvering to defend can cost your firing solution. Destroyed installations remain solid obstacles.</p><p><b>Changing approaches.</b> Dashed cutter routes show intentions, not cleared water. Watch the labeled icebreakers: only their advancing bows or your own can fracture sheet. A disabled cutter coasts to a stop; stationary hulls open no more ice. Their wakes visibly thicken with slush. Openings admit hostile boats as well as your own ship. In Home Ice, cargo crews unload automatically; give Proceed when each transport is ready to leave. The final transport reaching safe water completes defense. At Ravel Shelf, disable both marked installations and return to your home berth.</p><p>Individual records and ghosts are saved. All twelve Pale Reach assignments have their own campaign circuit and join the 84-stage Grand Tour.</p><div class="dialog-actions"><button class="primary" data-action="back" autofocus>Back to the bridge</button></div>`;
    }
    function render(canvas,level,run,zoom,options={}){
        if(run.polar.submarine)return U.render(canvas,level,run,zoom,options);
        const box=canvas.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,2),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
        const W=box.width,H=box.height,st=run.polar,c=st.config,ice=st.ice;
        const scale=Math.min((W-32)/level.world[0],(H-64)/level.world[1])*zoom;
        let ox=(W-level.world[0]*scale)/2,oy=(H-level.world[1]*scale)/2+12;
        if(zoom>1){ox=W/2-run.ship.x*scale;oy=H/2-run.ship.y*scale;}
        ctx.fillStyle='#102d38';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
        const line=(points,color,width=1,dash=[])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);};
        const labels=L.create(ctx,W,H,ox,oy,scale),label=labels.add;
        // The changing chart is one bitmap per frame; new fractures dirty nearby
        // chunks immediately, while slow slush ageing is sampled at 8 Hz.
        const surface=iceSurface(st,Math.min(4,Math.max(1,Math.ceil(scale*dpr))));
        ctx.drawImage(surface,0,0,ice.width,ice.height);
        const op=st.operation;
        if(op){
            for(const n of op.npcs.filter(n=>n.cutter)){
                line(n.route,n.team==='hostile'?'#e6a18c88':'#9ddde0bb',2,[4,7]);
                label(n.status,n.ship.x,n.ship.y-n.ship.beam-12,n.team==='hostile'?'#ffc2a2':'#b6e7de',9);
            }
            if(c.exclusion){
                const points=c.exclusion.slice(0,Math.min(c.exclusion.length,1+Math.floor(st.time/18)));line(points,'#edaf76',2,[3,5]);
                for(const p of points){ctx.beginPath();ctx.arc(p[0],p[1],4,0,Math.PI*2);ctx.fillStyle='#ffc887';ctx.fill();}
            }
            if(op.survey){
                const e=op.survey.safe;ctx.beginPath();ctx.ellipse(e.x,e.y,e.rx,e.ry,0,0,Math.PI*2);ctx.strokeStyle='#8ce0b877';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.stroke();ctx.setLineDash([]);
                if(op.line){const ends=P.towEndpoints(run.ship,op.survey.ship);line([[ends.a.x,ends.a.y],[ends.b.x,ends.b.y]],op.line.tension>1?'#f68d79':'#e9ce98',2);}
                label(op.kind==='rescue'?(op.survey.safeNow?'SAFE IN REFUGE':'DISABLED · CLEAR THE POCKET'):op.survey.recovered?'RECORDERS ABOARD':'RECOVER RECORDERS',op.survey.ship.x,op.survey.ship.y-32,'#f1d69b',9);
                if(op.survey.pocket){const p=op.survey.pocket;ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);ctx.strokeStyle='#efc27b99';ctx.setLineDash([5,6]);ctx.stroke();ctx.setLineDash([]);}
            }
            for(const a of op.assets){
                ctx.fillStyle=a.ship.hull<=0?'#46504c':a.team==='hostile'?'#966c60':a.team==='civilian'?'#b5c8bc':'#647e77';ctx.fillRect(a.x,a.y,a.w,a.h);
                ctx.strokeStyle=a.team==='hostile'?'#f3a785':'#b9ddd0';ctx.lineWidth=2;ctx.strokeRect(a.x,a.y,a.w,a.h);
                label(a.name+(a.ship.hull<=0||a.ship.disabled?' · DISABLED':' · '+Math.ceil(a.ship.hull/a.hp*100)+'%'),a.ship.x,a.y-13,a.team==='hostile'?'#ffc2a2':'#d3ebe0',9);
            }
            if(op.gun){
                const g=op.gun,s=run.ship;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.arc(s.x,s.y,g.range,s.a-g.arc,s.a+g.arc);ctx.closePath();ctx.fillStyle='#efc67b0a';ctx.fill();ctx.strokeStyle='#f3c78040';ctx.lineWidth=1;ctx.stroke();
                const target=I.operations.targets(st).find(t=>t.id===g.target);
                if(target){ctx.beginPath();ctx.arc(target.ship.x,target.ship.y,Math.max(target.ship.length,target.ship.beam)*.7,0,Math.PI*2);ctx.strokeStyle='#ffd290';ctx.lineWidth=2;ctx.stroke();if(g.aim)line([[s.x,s.y],[g.aim.x,g.aim.y]],g.solution>=g.hold?'#b8e4ad':'#e3bd7177',1.5,[5,7]);}
            }
            for(const n of [...op.npcs.filter(n=>n.active),...op.assets])if(n.gun?.aim&&n.gun.solution>0&&n.ship.hull>0){
                const g=n.gun;line([[n.ship.x,n.ship.y],[g.aim.x,g.aim.y]],'#ed9274aa',1+g.solution/g.hold,[3,6]);label('FIRING SOLUTION '+Math.floor(g.solution/g.hold*100)+'%',n.ship.x,n.ship.y-25,'#ffc09d',8);
            }
            for(const shot of op.shells){
                line([[shot.x-shot.vx*.12,shot.y-shot.vy*.12],[shot.x,shot.y]],shot.team==='friendly'?'#fff0b9':'#ffad94',2);
                if(shot.team!=='friendly'){ctx.beginPath();ctx.arc(shot.aim.x,shot.aim.y,9,0,Math.PI*2);ctx.strokeStyle='#f1957988';ctx.lineWidth=1;ctx.stroke();}
            }
            for(const b of op.bursts){ctx.beginPath();ctx.arc(b.x,b.y,3+(1.4-b.until+st.time)*8,0,Math.PI*2);ctx.strokeStyle='#ffd394';ctx.lineWidth=2;ctx.stroke();}
        }
        // Open-water contours are chart marks, never collision borders.
        for(const e of c.water){if(e.poly){line([...e.poly,e.poly[0]],'#6d9caa30');continue;}ctx.beginPath();ctx.ellipse(e.x,e.y,e.rx,e.ry,0,0,Math.PI*2);ctx.strokeStyle='#6d9caa30';ctx.lineWidth=1;ctx.stroke();}
        const route=(r,color)=>{line(r,color,1.3,[6,7]);for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,ang=Math.atan2(b[1]-a[1],b[0]-a[0]);line([[x-6*Math.cos(ang-.5),y-6*Math.sin(ang-.5)],[x,y],[x-6*Math.cos(ang+.5),y-6*Math.sin(ang+.5)]],color,1);}};
        if(c.mission!=='convoy')route(c.route,'#f0d394a0');
        if(c.rescue)route(c.rescue.protectedRoute,'#9fddb8cc');
        for(const f of st.fleet.filter(f=>!f.leader)){route(f.route,'#eec98db0');route(f.home,'#7ed5c19a');}
        if(c.pocket){const e=c.pocket;ctx.beginPath();ctx.ellipse(e.x,e.y,e.rx,e.ry,0,0,Math.PI*2);ctx.fillStyle='#edc27310';ctx.fill();ctx.setLineDash([5,5]);ctx.lineWidth=2;ctx.strokeStyle=I.pocketClear(st)>=e.required?'#8cdbc5':'#f3cc89';ctx.stroke();ctx.setLineDash([]);label('TURNING POCKET',e.x,e.y-e.ry-10,'#ffe0a5',10);}
        for(const dock of c.docks){ctx.fillStyle='#41525a';ctx.fillRect(dock.x,dock.y,dock.w,dock.h);ctx.strokeStyle='#a1aea8';ctx.lineWidth=2;ctx.strokeRect(dock.x,dock.y,dock.w,dock.h);label(dock.name,dock.x-25,dock.y-14,'#ecdfb6',10);}
        if(['defense','rescue','transit'].includes(c.mission)){
            for(const f of st.fleet){const p=f.home.at(-1);ctx.beginPath();ctx.arc(p[0],p[1],16,0,Math.PI*2);ctx.strokeStyle='#8ce0b8';ctx.lineWidth=2;ctx.stroke();}
        }else{
            const b=level.berth;ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.a);ctx.strokeStyle='#8ce0b8';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(-b.l/2,-b.w/2,b.l,b.w);ctx.setLineDash([]);line([[-8,-5],[5,0],[-8,5]],'#8ce0b8',2);ctx.restore();
        }
        for(const mark of c.landmarks)label(mark.text,mark.x,mark.y,'#365b65',10,0);
        for(const iceBody of [...st.floes,...st.bergs]){
            if(iceBody.vessel==='iceberg'){
                const x=iceBody.x+iceBody.vx*90,y=iceBody.y+iceBody.vy*90;line([[iceBody.x,iceBody.y],[x,y]],'#efd29b',2,[4,4]);label('DRIFT · 90s',x+32,y,'#f7dbae',9);
                ctx.beginPath();ctx.ellipse(iceBody.x,iceBody.y,iceBody.length*.73,iceBody.beam*.83,iceBody.a,0,Math.PI*2);ctx.fillStyle='#9edbd133';ctx.fill();
            }
            const hull=P.hull(iceBody);ctx.beginPath();hull.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#e9f0e4';ctx.fill();ctx.strokeStyle='#a6c3c0';ctx.lineWidth=2;ctx.stroke();
            line([[iceBody.x-10,iceBody.y+4],[iceBody.x,iceBody.y-6],[iceBody.x+11,iceBody.y+2]],'#9bbbbb',1.5);
        }
        function vessel(s,player=false){
            const hull=P.hull(s);ctx.beginPath();hull.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=s.hull<=0?'#495957':player?'#f2bb76':s.hostile?'#df8e78':s.required===false?'#bbbbb0':s.iceClass?'#dae7dd':'#93c4b1';ctx.fill();ctx.strokeStyle='#16313b';ctx.lineWidth=1.5;ctx.stroke();
            ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.fillStyle='#324f59';ctx.fillRect(-s.length*.2,-s.beam*.29,s.length*.25,s.beam*.58);line([[s.length*.17,0],[s.length*.35,0]],'#233e47',1);ctx.restore();
            if(player){ctx.beginPath();ctx.arc(s.x,s.y,Math.max(s.length,s.beam)*.7,0,Math.PI*2);ctx.strokeStyle='#fbd69a70';ctx.lineWidth=1;ctx.stroke();}
            label(player?'KESTREL'===s.name?'KESTREL':s.name.split(' · ').at(-1):s.name,s.x,s.y+s.beam+16,player?'#ffe1b3':'#eef2da',10,player?3:2);
            if(I.speed(s)>.3)line([[s.x,s.y],[s.x+s.vx*12,s.y+s.vy*12]],'#f5e4b866',1,[3,3]);
        }
        const ghost=options.ghost;
        if(options.settings?.ghost&&ghost?.length&&run.time<=ghost.at(-1)[0]){
            let lo=0,hi=ghost.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(ghost[mid][0]<=run.time)lo=mid;else hi=mid-1;}
            const a=ghost[lo],b=ghost[Math.min(lo+1,ghost.length-1)],t=b[0]===a[0]?0:P.clamp((run.time-a[0])/(b[0]-a[0]),0,1);
            const s={...run.ship,x:a[1]+(b[1]-a[1])*t,y:a[2]+(b[2]-a[2])*t,a:a[3]+P.wrap(b[3]-a[3])*t};
            ctx.save();ctx.globalAlpha=.28;const h=P.hull(s);ctx.beginPath();h.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#d4fbe0';ctx.fill();ctx.restore();
        }
        for(const f of st.fleet)vessel(f.ship);for(const s of I.operations.bodies(st))vessel(s);vessel(run.ship,true);
        ctx.restore();labels.draw();ctx.fillStyle='#abc5c9';ctx.font='10px ui-monospace, monospace';ctx.textAlign='left';
        ctx.fillText('PALE REACH / COUNCIL PASSAGE CHART',16,H-17);
        ctx.strokeStyle='#abc5c9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W-120,H-22);ctx.lineTo(W-120+100*scale,H-22);ctx.stroke();
    }
    const api={prepare,update,render,dialog,splitRows};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachView=api;
})(globalThis);
