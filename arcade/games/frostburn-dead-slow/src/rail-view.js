(function(root) {
    'use strict';
    const R=typeof module!=='undefined'&&module.exports?require('./rail.js'):root.Railway;
    const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    let act=null,signature='',levelNow=null,stateNow=null,transform=null,clearanceCache=null,clearanceKey='',placementKey='',placementState='',placementHeight=0;
    const Presentation=typeof module!=='undefined'&&module.exports?require('./rail-presentation.js'):root.RailPresentation;
    const {indicators,displayDirection,signedSpeed,actionEnabled}=Presentation;
    function swept(st) {
        const key=Math.floor(st.time*4)+':'+st.reverser+':'+st.net.switches.map(s=>s.selected).join()+':'+R.engineGroup(st).cars.map(c=>c.id).join();
        if(key!==clearanceKey){clearanceKey=key;clearanceCache=R.clearance(st);}
        return clearanceCache;
    }
    function prepare(level,command) {
        levelNow=level;stateNow=null;act=command;signature='';clearanceKey='';clearanceCache=null;placementKey='';placementState='';
        $('rail-panel').hidden=!level.rail;
        $('rail-info').hidden=!level.rail;
        $('rail-helm').innerHTML='';
        if(!level.rail)return;
        document.title='DEAD SLOW — The Long Grade';
        $('courses-btn').textContent='Worlds';
        $('chart-section').setAttribute('aria-label','Railway network and freight train');
        $('helm-controls').setAttribute('aria-label','Train controls');
        $('rail-helm').innerHTML=R.commands.levers(!!level.rail.helper).map(({name,label})=>`<div class="rail-telegraph"><span>${label}</span><div><button data-rail="${name}" data-rail-step="-1" aria-label="Decrease ${label.toLowerCase()}">−</button><button data-rail="${name}" data-rail-step="1" aria-label="Increase ${label.toLowerCase()}">+</button></div></div>`).join('');
        $('rail-helm').onclick=e=>{
            const button=e.target.closest('[data-rail-step]');
            if(!button||button.disabled||!stateNow)return;
            const lever=R.commands.levers(!!level.rail.helper).find(l=>l.name===button.dataset.rail);
            const current=lever.name==='brake'?R.engineGroup(stateNow).brake:stateNow[lever.name];
            act(lever.name,clamp(current+Number(button.dataset.railStep)*lever.step,lever.min,lever.max));
        };
        $('sea').setAttribute('aria-label','Railway map. Head and tail markers show the moving ends. Change points using the route buttons.');
        $('rail-info-body').innerHTML=`<div id="rail-alert" class="rail-alert"></div><p id="rail-notice" role="status"></p>
            <div class="rail-summary" id="rail-summary"></div><div id="rail-heat" class="rail-summary"></div>
            <details class="rail-details"><summary>Details</summary><div id="rail-operations" class="rail-operations"></div>
            <p id="rail-cut-status" class="rail-caption"></p><p id="rail-pickup" class="rail-caption"></p></details>`;
        $('rail-panel').innerHTML=`<div class="rail-readings"><div><strong id="rail-speed">0.0</strong><span>km/h</span></div><div><b id="rail-stop">0 m</b><span>estimated stop</span></div></div>
            ${(level.rail.traffic||[]).map(t=>`<button class="rail-dispatch" data-rail="dispatch" data-value="${t.id}">Signal departure<span class="key-hint"> · H</span></button>`).join('')}
            <div class="rail-levers">${R.commands.levers(!!level.rail.helper).map(({name:id,label,keys,min,max,step})=>`<div class="rail-lever"><label for="rail-${id}">${label}<output id="rail-${id}-value"></output><small class="key-hint">${keys}</small></label><input id="rail-${id}" data-rail="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${id==='brake'?1:0}" aria-label="${label}"></div>`).join('')}</div>
            <div class="rail-actions"><button data-rail="reverse" id="rail-reverse" title="Change travel direction (X)">Reverse<span class="key-hint"> · X</span></button><button data-rail="stop">Full brake<span class="key-hint"> · Space</span></button><button data-rail="couple">Couple<span class="key-hint"> · F</span></button><button data-rail="hand" id="rail-hand">Handbrakes<span class="key-hint"> · B</span></button></div>
            <div id="rail-consist" class="rail-consist"></div>
            <div id="rail-switches" class="rail-switches"></div><div class="section-label">SECTOR SPLITS</div><div id="rail-tasks" class="splits rail-tasks"></div>
            <div class="rail-actions"><button data-rail="retry">Retry <kbd>Shift+R</kbd></button><button data-rail="help">Controls</button></div>`;
        $('rail-panel').onclick=e=>{const b=e.target.closest('[data-rail]');if(b&&!b.disabled&&b.tagName!=='INPUT')act(b.dataset.rail,b.dataset.rail==='uncouple'?{after:b.dataset.value,before:b.dataset.next}:b.dataset.value);};
        $('rail-panel').oninput=e=>{if(e.target.dataset.rail)act(e.target.dataset.rail,Number(e.target.value));};
        $('sea').onclick=e=>{
            if(!levelNow?.rail||!transform)return;
            const rect=$('sea').getBoundingClientRect(),x=(e.clientX-rect.left-transform.x)/transform.s,y=(e.clientY-rect.top-transform.y)/transform.s;
            const nearest=level.rail.switches.find(sw=>Math.hypot(level.rail.nodes[sw.node][0]-x,level.rail.nodes[sw.node][1]-y)<18/transform.s);
            if(nearest)act('switch',nearest.node);
        };
    }
    function key(e,st) {
        const command=R.commands.keyboard(e.code,{power:st.power,helper:st.helper,brake:R.engineGroup(st).brake,independent:st.independent},!!st.config.helper,st.traffic.some(t=>!t.released&&!t.finished));
        if(!command)return false;
        e.preventDefault();if(!e.repeat)act(...command);return true;
    }
    function update(level,run,status,format,race=null) {
        const st=run.rail,projection=Presentation.snapshot(st),m=projection.metrics,g=R.engineGroup(st),selected=R.groupFor(st,st.selected)||g;
        stateNow=st;
        const signals=projection.signals;
        $('rail-speed').textContent=projection.speed;
        $('rail-speed').classList.toggle('rail-danger',Math.abs(m.speed)>m.limit);
        $('rail-stop').textContent=Number.isFinite(m.stopping)?Math.ceil(m.stopping)+' m':'No reserve';
        $('rail-summary').textContent=`${Math.round(m.length)} m · ${Math.round(m.mass/1000)} t · limit ${Math.round(m.limit*3.6)} km/h`;
        $('rail-heat').textContent=(level.rail.thermal?`Brakes ${Math.round(m.temperature)}°C${m.temperature>180?' · fading':''} · `:'')+(signals.slip?'Wheelspin · ease power':'Wheels gripping');
        $('rail-heat').classList.toggle('rail-danger',m.temperature>180);
        const operations=[];
        if(st.config.helper) {
            operations.push(g.cars.some(c=>c.helper)?'Rear helper connected':'Rear helper detached');
            operations.push(`Coupler pull limit ${(st.config.helper.workingPull||120000)/1000} kN`, `Curve push limit ${Math.round(st.config.compressionLimit/1000)} kN`);
        }
        const deck=R.ferry(st);
        if(deck)operations.push(`Port ${Math.round(deck.loads[0]/1000)} t · Starboard ${Math.round(deck.loads[1]/1000)} t`,
            `Ramp heel ${Math.abs(deck.heel).toFixed(1)}° / 4° · balance reserve ${Math.max(0,Math.round((deck.maxDifference-Math.abs(deck.balance))/1000))} t`);
        for(const f of R.forecast(st))operations.push(`${f.name} · ${f.closed?'CLOSED':`closes in ${Math.floor(f.remaining/60)}:${String(Math.floor(f.remaining%60)).padStart(2,'0')}`}`);
        for(const t of st.traffic)operations.push(t.name,`${t.finished?'Clear':t.waiting} · ${Math.round(t.v*3.6)} km/h`);
        if(st.traffic.length)operations.push('Blocks: amber freight · blue passenger · green clear');
        if(st.config.weather==='rain')operations.push(signals.sliding.size?'Wheels sliding — ease the train brake.':signals.slip?'Wheelspin — reduce power.':'Rain · wet leaves in the shaded cutting');
        for(const b of R.bridges(st))operations.push(`${b.name}: ${Math.round(b.mass/1000)} / ${b.maxMass/1000} t · ${b.loads} / ${b.maxLoads} transformers`);
        const envelope=swept(st);
        if(envelope)operations.push(envelope.collision?`${envelope.collision.hit} fouled in ${Math.round(envelope.collision.distance)} m`:'Selected route clears the vessel');
        if(st.config.tasks.some(t=>t.type==='rescue')) {
            const cut=R.groupFor(st,'R1'),wagon=cut.cars.find(c=>c.id==='R1');
            operations.push(st.caught?'Wagons in the gravel catch · rough finish':`Stone wagons · ${(Math.abs(wagon.v)*3.6).toFixed(1)} km/h${cut===g?' · coupled':' · rolling free'}`);
        }
        $('rail-operations').textContent=operations.join('\n');
        $('rail-operations').hidden=!operations.length;
        $('rail-operations').classList.toggle('rail-danger',!!envelope?.collision||signals.sliding.size>0);
        for(const {name} of projection.levers) {
            const value=name==='brake'?g.brake:st[name];$('rail-'+name).value=value;
            $('rail-'+name+'-value').textContent=['power','helper'].includes(name)?`${value} / 4`:Math.round(value*100)+'%';
        }
        $('rail-reverse').innerHTML='Reverse<span class="key-hint"> · X</span>';
        $('rail-reverse').title='Change direction · currently '+(st.reverser===1?'forward':'reverse');
        const warning=projection.warning,alert=$('rail-alert'),worst=warning.cars.reduce((a,c)=>!a||c.ratio>a.ratio?c:a,null);
        const coupling=projection.coupling;
        alert.hidden=false;alert.classList.toggle('critical',warning.severity===2||!!(coupling&&coupling.ratio>1));
        alert.classList.toggle('caution',!!warning.severity||!!coupling);
        alert.textContent=worst?.ratio>=1.2?'Derailment risk\nBrake now':coupling?`Coupler ${coupling.kind} · ${Math.round(Math.abs(coupling.force)/1000)} kN\n${coupling.kind==='push'?'Ease rear assistance.':'Share power; ease the front.'}`:worst?`${worst.id==='engine'?'Locomotive':worst.id} over ${Math.round(worst.limit*3.6)} km/h\nEase the train below the limit.`:warning.ahead?`Slow to ${Math.round(warning.ahead.limit*3.6)} km/h\n${Math.round(warning.ahead.distance)} m ahead`:st.config.helper?'Couplers within limits\nEase each engine over the crest.':'Speed within limit\nKeep room to stop.';
        if(envelope?.collision){alert.classList.add('caution');alert.textContent=`${envelope.collision.hit} · ${Math.round(envelope.collision.distance)} m ahead\n${envelope.collision.hit.includes('parked wagon')?'The vessel’s end swings across the siding. Shunt the flats clear.':'Choose a route with room for the cargo.'}`;}
        $('rail-info-title').textContent=alert.classList.contains('caution')||alert.classList.contains('critical')?alert.textContent.split('\n')[0]:'Train status';
        $('rail-info-title').classList.toggle('rail-danger',alert.classList.contains('caution')||alert.classList.contains('critical'));
        $('rail-hand').innerHTML=(selected.cars.some(c=>c.hand)?'Release handbrakes':'Set handbrakes')+'<span class="key-hint"> · B</span>';
        const sig=st.groups.map(cut=>cut.cars.map(c=>c.id).join(',')).join('|');
        if(sig!==signature) {
            signature=sig;
            $('rail-consist').innerHTML=st.groups.map(cut=>`<div class="rail-cut">${cut.cars.map((c,i)=>`<button data-rail="select" data-value="${c.id}" id="rail-car-${c.id}" title="${c.powered?'Locomotive':c.id+' · '+Math.round(c.mass/1000)+' t'}">${c.helper?'Helper':c.powered?'Loco':c.id}<span></span></button>${i<cut.cars.length-1?`<button class="rail-link" data-rail="uncouple" data-value="${c.id}" data-next="${cut.cars[i+1].id}" aria-label="Uncouple between ${c.id} and ${cut.cars[i+1].id}" title="Uncouple">✂</button>`:''}`).join('')}</div>`).join('');
        }
        for(const cut of st.groups)for(const c of cut.cars) {
            const b=$('rail-car-'+c.id),p=R.locate(st,cut,c.q),grade=p.grade*displayDirection(st,c);
            b.classList.toggle('selected',cut===selected);b.classList.toggle('secured',c.hand);
            b.classList.toggle('at-risk',signals.sliding.has(c.id)||warning.cars.some(v=>v.id===c.id));
            b.classList.toggle('sliding',signals.sliding.has(c.id)||(!!c.powered&&signals.slip));
            b.style.borderBottomColor=c.destination==='mill'?'#8cbccf':c.destination==='foundry'?'#e7a25d':'';
            b.querySelector('span').textContent=(grade>.003?'↗':grade<-.003?'↘':'→')+(c.hand?' P':'');
            b.title=`${c.powered?'Locomotive':c.id}: ${Math.abs(grade*100).toFixed(1)}% ${grade>=0?'uphill':'downhill'}${c.hand?', handbrakes set':''}`;
        }
        const switchSig=st.net.switches.map(sw=>sw.selected+':'+R.occupied(st,sw.node)).join();
        if($('rail-switches').dataset.signature!==switchSig) {
            $('rail-switches').dataset.signature=switchSig;
            $('rail-switches').innerHTML=st.net.switches.map(sw=>{
                const edge=st.net.edges[sw.branches[sw.selected]],grade=Math.max(...edge.samples.slice(1).map((p,i)=>Math.abs(p.z-edge.samples[i].z)/(p.s-edge.samples[i].s)))*100;
                return `<button data-rail="switch" data-value="${sw.node}" ${R.occupied(st,sw.node)?'disabled':''}><span>${sw.label}</span><b>${sw.names[sw.selected]}</b>${level.rail.thermal?`<small>${Math.round(edge.length)} m · ${grade.toFixed(1)}% max grade</small>`:''}${R.occupied(st,sw.node)?'<small>occupied</small>':''}</button>`;
            }).join('');
        }
        const nextSplit=st.config.tasks.find(t=>!st.completed.includes(t.id)&&(!t.after||st.completed.includes(t.after)));
        $('rail-tasks').innerHTML=st.config.tasks.map(t=>{
            const done=st.completed.includes(t.id),split=run.splits?.find(s=>s.name===t.text);
            return `<div class="split-row ${done?'done':t===nextSplit?'active':''} ${split&&!done?'invalidated':''}"${split&&!done?' title="Objective no longer satisfied; first split time retained"':''}><span>${t.text}</span><span>${split?format(split.time):status==='complete'&&t.milestone?'Skipped':'—'}</span></div>`;
        }).join('');
        const help=projection.help;
        const recommendation=projection.recommendation;
        $('rail-cut-status').textContent=help.cut;
        $('rail-pickup').textContent=help.pickup;
        $('rail-notice').textContent=help.next;
        $('clock-label').classList.toggle('practice',run.pausedUsed);
        $('clock-label').textContent=(run.pausedUsed?'PRACTICE · ':race?'CIRCUIT · ':'RUN TIME')+(race?`${race.position+1} / ${race.route.length}`:run.pausedUsed?'UNRANKED':'');
        $('clock').textContent=format(race?race.total+(status==='complete'?0:run.time):run.time);
        $('mission-name').textContent=level.name;$('brief').textContent=level.brief;
        $('weather-text').textContent=st.config.weather==='rain'?'RAIN · WET LEAVES':'THE LONG GRADE';
        $('rail-panel').querySelectorAll('button,input').forEach(b=>{
            const name=b.dataset.rail;if(['help','retry'].includes(name))return;
            const value=name==='uncouple'?{after:b.dataset.value,before:b.dataset.next}:b.dataset.value;
            const state=projection.action(name,value);
            const enabled=['uncouple','hand','reverse'].includes(name)?actionEnabled(st,name,value,state.enabled):state.enabled;
            b.disabled=status!=='running'||!enabled;
            if(name==='dispatch')b.innerHTML=st.traffic.find(t=>t.id===value)?.released?'Departure signalled':'Signal departure<span class="key-hint"> · H</span>';
            if(['uncouple','couple','hand'].includes(name))b.title=state.reason||(name==='uncouple'?b.getAttribute('aria-label'):name==='hand'?help.cut:'Couple the adjacent cut');
            b.classList.toggle('rail-relevant',!b.disabled&&name===recommendation.action&&(name!=='uncouple'||(value.after===recommendation.split?.after&&value.before===recommendation.split?.before)));
        });
        $('rail-helm').querySelectorAll('[data-rail-step]').forEach(button=>{
            const lever=projection.levers.find(l=>l.name===button.dataset.rail),step=Number(button.dataset.railStep);
            const value=lever.name==='brake'?g.brake:st[lever.name];
            button.disabled=status!=='running'||!projection.action(lever.name).enabled||(step<0?value<=lever.min:value>=lever.max);
            button.classList.toggle('rail-relevant',!button.disabled&&recommendation.action===lever.name&&(!recommendation.direction||step===recommendation.direction));
        });
    }
    function render(canvas,level,run,zoom=1) {
        const st=run.rail,ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),dpr=root.devicePixelRatio||1;
        const signals=indicators(st);
        const w=rect.width,h=rect.height;if(!w||!h)return;
        if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#d6d1b5';ctx.fillRect(0,0,w,h);
        const warning=R.danger(st),m=R.metrics(st),mapHeight=h,scale=Math.min((w-42)/level.world[0],(mapHeight-25)/level.world[1])*zoom;
        const train=R.engineGroup(st),ends=R.bounds(train),direction=displayDirection(st,train.cars.find(c=>c.id==='engine'));
        m.head=R.locate(st,train,direction>0?ends.hi:ends.lo);m.tail=R.locate(st,train,direction>0?ends.lo:ends.hi);
        const x=zoom===1?(w-level.world[0]*scale)/2:w/2-m.head.x*scale,y=zoom===1?(mapHeight-level.world[1]*scale)/2:mapHeight/2-m.head.y*scale;
        transform={x,y,s:scale};ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
        const panel=$('rail-info'),layoutState=level.id+':'+w+':'+h+':'+zoom+':'+panel.open+':'+$('rail-info-body').querySelector('.rail-details').open;
        if(layoutState!==placementState){placementState=layoutState;placementHeight=0;}
        // Reserve the full natural height. Keep the largest observed height
        // until an explicit layout change so changing notices cannot oscillate
        // the window between map pockets.
        placementHeight=Math.max(placementHeight,260,Math.ceil(panel.getBoundingClientRect().height));
        const layoutKey=layoutState+':'+placementHeight;
        if(layoutKey!==placementKey) {
            placementKey=layoutKey;
            const box=zoom===1?Presentation.statusPlacement(level,st.net,w,h,placementHeight):{x:w-Math.min(288,w-24)-12,y:54,w:Math.min(288,w-24),fallback:true};
            Object.assign(panel.style,{left:box.x+'px',right:'auto',top:box.y+'px',width:box.w+'px'});
            panel.dataset.fallback=String(box.fallback);
        }
        const stroke=(points,color,width)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
        const landscape=Presentation.landscape(level,st.net);
        ctx.lineCap='round';ctx.lineJoin='round';
        ctx.beginPath();
        for(const [a,b] of landscape.contours){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
        ctx.strokeStyle='#bdbb9e';ctx.lineWidth=1/scale;ctx.stroke();
        for(let i=0;i<150;i++) {
            const tx=(Math.sin(i*43.1)*43758.5%1+1)%1*level.world[0],ty=(Math.sin(i*19.3)*9645.2%1+1)%1*level.world[1];
            if(Object.values(st.net.edges).some(e=>e.samples.some(p=>Math.hypot(p.x-tx,p.y-ty)<36)))continue;
            ctx.fillStyle=i%3?'#929d7b':'#a2a988';ctx.beginPath();ctx.ellipse(tx,ty,8+i%8,12+i%9,-.35,0,Math.PI*2);ctx.fill();
        }
        if(st.config.scenery==='valley') {
            const water=landscape.river;
            stroke(water,'#b5bfa3',45);stroke(water,'#83aaa9',28);stroke(water,'#adcbc1',2);
        }
        if(st.config.ferry) {
            const deck=R.ferry(st),points=deck.decks.flatMap(id=>st.net.edges[id].samples.filter(p=>p.s>=deck.start));
            const left=Math.min(...points.map(p=>p.x))-12,right=Math.max(...points.map(p=>p.x))+35;
            const top=Math.min(...points.map(p=>p.y))-42,bottom=Math.max(...points.map(p=>p.y))+42;
            // The quay widens south of the ramps to carry the run-around loop.
            ctx.fillStyle='#7da3ac';ctx.beginPath();ctx.moveTo(left-20,0);ctx.lineTo(level.world[0],0);
            ctx.lineTo(level.world[0],level.world[1]);ctx.lineTo(left+50,level.world[1]);
            ctx.lineTo(left+50,bottom+25);ctx.lineTo(left+20,top+100);ctx.lineTo(left-20,top+60);ctx.closePath();ctx.fill();
            ctx.fillStyle='#48605b';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(right-35,top);ctx.quadraticCurveTo(right+25,(top+bottom)/2,right-35,bottom);ctx.lineTo(left,bottom);ctx.closePath();ctx.fill();
            ctx.strokeStyle='#e2d3a5';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#a5afa0';ctx.fillRect(left+8,top+9,right-left-42,bottom-top-18);
            ctx.fillStyle='#526c64';ctx.fillRect(right-100,top+25,48,bottom-top-50);
            // The ramp edge rises and falls with unequal deck load.
            stroke([{x:left-38,y:(top+bottom)/2},{x:left+8,y:(top+bottom)/2+deck.heel*4}],Math.abs(deck.heel)>3?'#d59a4d':'#d7c5a1',28);
        }
        const buildings=st.config.scenery==='yard'?[[90,490,43,76],[135,540,20,34],[830,150,65,33],[830,95,42,24]]:
            st.config.scenery==='valley'?[[1450,1030,80,28],[1550,1050,66,25]]:[[700,95,48,26],[200,390,45,32]];
        for(const [bx,by,bw,bh] of buildings) {
            if(Object.values(st.net.edges).some(e=>e.samples.some(p=>p.x>bx-24&&p.x<bx+bw+24&&p.y>by-24&&p.y<by+bh+24)))continue;
            ctx.fillStyle='#9a9780';ctx.fillRect(bx+4,by+5,bw,bh);ctx.fillStyle='#786958';ctx.fillRect(bx,by,bw,bh);
            stroke([{x:bx+4,y:by+bh/2},{x:bx+bw-4,y:by+bh/2}],'#b2a183',2);
        }
        if(st.config.scenery==='quarry'||st.config.scenery==='valley')for(let i=0;i<4;i++) {
            const qx=st.config.scenery==='quarry'?95:115,qy=st.config.scenery==='quarry'?560:40;
            stroke([{x:qx-i*8,y:qy+i*13},{x:qx+75+i*6,y:qy+i*13+10},{x:qx+160+i*12,y:qy+i*13-7}],'#a39d85',7);
        }
        for(const edge of Object.values(st.net.edges)) {
            if(st.config.ferry?.decks.includes(edge.id)) {
                const deck=R.ferry(st),side=st.config.ferry.decks.indexOf(edge.id)?-1:1;
                const points=edge.samples.filter(p=>p.s>=deck.start);
                stroke(points,'#929f90',37);
                stroke(points.map(p=>({x:p.x,y:p.y+side*32})),Math.abs(deck.heel)>3?'#d39345':'#ded6b0',3);
            }
            if(st.traffic.length) {
                const passenger=st.traffic.some(t=>!t.finished&&R.segments(st,t).some(p=>p.edge===edge.id)),freight=st.groups.some(g=>R.segments(st,g).some(p=>p.edge===edge.id));
                stroke(edge.samples,passenger?'#75a9c3':freight?'#d0a465':'#9eaf8b',24);
            }
            const spans=edge.bridge?[{from:0,to:edge.length}]:landscape.bridges.filter(b=>b.edge===edge.id);
            for(const span of spans) {
                const points=Array.from({length:Math.ceil((span.to-span.from)/6)+1},(_,i)=>i);
                const deck=points.map((_,i)=>R.at(st.net,edge.id,span.from+(span.to-span.from)*i/(points.length-1)));
                stroke(deck,'#5c665f',38);stroke(deck,'#e1d8bb',30);
                for(const s of [span.from,span.to]){const p=R.at(st.net,edge.id,s),dx=Math.sin(p.a)*23,dy=Math.cos(p.a)*23;
                    stroke([{x:p.x-dx,y:p.y+dy},{x:p.x+dx,y:p.y-dy}],'#666655',10);}
            }
            if(edge.adhesion<.06)stroke(edge.samples,'#68785a',30);
            stroke(edge.samples,'#b4ad97',17);stroke(edge.samples,'#78796e',10);
            for(let s=0;s<edge.length;s+=9){const p=R.at(st.net,edge.id,s),dx=Math.sin(p.a)*7,dy=Math.cos(p.a)*7;stroke([{x:p.x-dx,y:p.y+dy},{x:p.x+dx,y:p.y-dy}],'#574e43',2);}
            for(const sign of [-1,1])stroke(edge.samples.map((p,i,a)=>{const n=a[Math.min(i+1,a.length-1)],prev=a[Math.max(0,i-1)],angle=Math.atan2(n.y-prev.y,n.x-prev.x);return{x:p.x+Math.sin(angle)*3*sign,y:p.y-Math.cos(angle)*3*sign};}),'#dbd4bc',1.5);
            for(const restriction of [{from:.12,limit:edge.limit},...edge.restrictions||[]]) {
                const p=R.at(st.net,edge.id,edge.length*restriction.from);ctx.fillStyle='#f5dd9d';ctx.beginPath();ctx.arc(p.x+18,p.y,12/scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#554130';ctx.font=`bold ${11/scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(Math.round(restriction.limit*3.6),p.x+18,p.y+4/scale);
            }
            if(edge.closedFrom!==undefined) {
                const a=R.at(st.net,edge.id,edge.closedFrom),b=R.at(st.net,edge.id,edge.length);stroke([a,b],'#754534',32);
                stroke([{x:a.x-12,y:a.y-15},{x:a.x+12,y:a.y+15}],'#e7b29b',4);stroke([{x:a.x-12,y:a.y+15},{x:a.x+12,y:a.y-15}],'#e7b29b',4);
            }
            if(edge.catchFrom!==undefined)stroke(edge.samples.filter(p=>p.s>=edge.catchFrom),'#c2ad82',21);
            const flood=R.forecast(st).find(f=>f.edge===edge.id);
            if(flood) {
                const points=Array.from({length:25},(_,i)=>R.at(st.net,edge.id,flood.from+(flood.to-flood.from)*i/24));
                stroke(points,flood.closed?'#547f9ddd':flood.remaining<120?'#ce884c88':'#6492a54d',40);
                const p=points[12];ctx.font=`bold ${11/scale}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=flood.closed?'#863d2d':'#354f55';
                ctx.fillText(flood.closed?'FLOODED':`${flood.name} · ${Math.ceil(flood.remaining)} s`,p.x,p.y-22/scale);
            }
        }
        for(const o of st.config.obstacles||[]) {
            ctx.fillStyle='#817567';ctx.fillRect(o.x+4,o.y+5,o.w,o.h);ctx.fillStyle='#66594c';ctx.fillRect(o.x,o.y,o.w,o.h);
            ctx.strokeStyle='#ebd6a4';ctx.lineWidth=1/scale;ctx.strokeRect(o.x,o.y,o.w,o.h);
        }
        const polygon=(pts,fill,color,width)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
        const envelope=swept(st);
        if(envelope) {
            // A route ribbon and a few silhouettes are readable at map scale;
            // overlapping rectangles at every sample obscure the actual cargo.
            const centers=envelope.previews.map(p=>({x:p.polygon.reduce((n,v)=>n+v.x,0)/4,y:p.polygon.reduce((n,v)=>n+v.y,0)/4}));
            stroke(centers,'#aa914766',8);
            for(const p of envelope.previews.filter(p=>p.distance>0&&p.distance<=480&&p.distance%120===0))polygon(p.polygon,'#e6d5a622','#9a7d4588',1/scale);
            if(envelope.collision){
                polygon(envelope.collision.polygon,'#c34e3944','#b6402a',2/scale);
                for(const body of envelope.collision.bodies)polygon(body,'#70babb33','#356d76',1.5/scale);
            }
        }
        for(const z of st.config.zones) {
            const pts=[];for(let s=z.from;s<=z.to;s+=3)pts.push(R.at(st.net,z.edge,s));
            ctx.globalAlpha=.38;stroke(pts,z.color||'#679a83',28);ctx.globalAlpha=1;
            const p=R.at(st.net,z.edge,(z.from+z.to)/2);ctx.font=`600 ${12/scale}px sans-serif`;ctx.fillStyle='#344b40';ctx.textAlign='center';ctx.fillText(z.name,p.x,p.y-24/scale);
        }
        for(const sw of st.net.switches) {
            const node=st.net.nodes[sw.node];
            for(const id of [sw.stem,sw.branches[sw.selected]]) {
                const edge=st.net.edges[id],from=edge.a===sw.node;
                const pts=Array.from({length:13},(_,i)=>R.at(st.net,id,from?i*3:edge.length-i*3));stroke(pts,'#e2bb68',5);
            }
            ctx.beginPath();ctx.arc(node[0],node[1],6/scale,0,Math.PI*2);ctx.fillStyle=R.occupied(st,sw.node)?'#b66d46':'#ffdb85';ctx.fill();ctx.strokeStyle='#68533c';ctx.lineWidth=1/scale;ctx.stroke();
            ctx.fillStyle='#514c39';ctx.font=`600 ${11/scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(sw.label,node[0],node[1]-14/scale);
        }
        const restriction=warning.ahead||warning.cars[0];
        if(restriction) {
            const edge=st.net.edges[restriction.edge],section=Array.from({length:25},(_,i)=>R.at(st.net,edge.id,clamp(restriction.s-35+i*4,0,edge.length)));
            ctx.globalAlpha=.65;stroke(section,warning.severity===2?'#dc382b':'#df922d',24);ctx.globalAlpha=1;
        }
        for(const group of [...st.groups,...st.traffic.filter(t=>!t.finished)]) {
            const cars=group.cars.filter(c=>!group.route||c.q-c.length/2<group.exitQ);
            stroke(cars.map(c=>R.locate(st,group,group.route?Math.min(c.q,group.exitQ):c.q)),'#413a31',2);
            for(const c of cars) {
                const p=R.locate(st,group,c.q),front=R.locate(st,group,c.q+c.length*.35),back=R.locate(st,group,c.q-c.length*.35);
                ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(front.y-back.y,front.x-back.x));
                if(group.route){ctx.beginPath();ctx.rect(-c.length/2,-8,Math.min(c.length,group.exitQ-c.q+c.length/2),16);ctx.clip();}
                const danger=warning.cars.find(v=>v.id===c.id);
                if(danger){ctx.strokeStyle=danger.ratio>=1.2?'#d33124':'#df852c';ctx.lineWidth=2.5/scale;ctx.strokeRect(-c.length/2-3,-8,c.length+6,16);}
                else if(signals.sliding.has(c.id)||(c.powered&&signals.slip)){ctx.strokeStyle='#dfa342';ctx.lineWidth=2/scale;ctx.strokeRect(-c.length/2-3,-8,c.length+6,16);}
                ctx.fillStyle='#454338';ctx.fillRect(-c.length/2, -5.5,c.length,11);
                ctx.fillStyle=group.route?'#507f9d':c.powered?'#486b61':c.heavy?'#756c82':c.id[0]==='E'?'#b6a57e':c.destination==='mill'?'#7d9eae':c.destination==='foundry'?'#be824b':'#a45f48';ctx.fillRect(-c.length/2+1,-4.5,c.length-2,9);
                if(c.powered){ctx.fillStyle='#e5d398';ctx.fillRect(c.face>0?2:-8,-3,6,6);}else{ctx.fillStyle='#514e41';ctx.fillRect(-c.length/2+3,-2.5,c.length-6,5);}
                if(c.hand){ctx.fillStyle='#f4d897';ctx.fillRect(-2,-4,4,8);}ctx.restore();
            }
        }
        // Rock covers the underground track and each entering vehicle. The
        // passenger clears the route only when its last body enters the portal.
        for(const edge of Object.values(st.net.edges).filter(e=>e.tunnel)) {
            const p=R.at(st.net,edge.id,edge.tunnel.from),length=edge.length-edge.tunnel.from+35;
            ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
            ctx.beginPath();ctx.moveTo(0,-22);ctx.bezierCurveTo(35,-75,length*.7,-100,length+20,-40);
            ctx.bezierCurveTo(length+85,20,length*.65,100,25,65);ctx.quadraticCurveTo(5,45,0,22);ctx.closePath();
            ctx.fillStyle='#9b9b7b';ctx.fill();ctx.strokeStyle='#81896c';ctx.lineWidth=3;ctx.stroke();
            for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(22+i*24,-25-i*7);ctx.bezierCurveTo(length*.65,-62+i*14,length+12-i*22,-16,length*.65,45-i*12);ctx.strokeStyle='#b5b397';ctx.lineWidth=1.5;ctx.stroke();}
            ctx.fillStyle='#282f2a';ctx.fillRect(-5,-13,21,26);
            stroke([{x:-10,y:-17},{x:17,y:-17},{x:17,y:17},{x:-10,y:17}],'#d8ccab',6);
            ctx.restore();ctx.fillStyle='#38473a';ctx.font=`600 ${11/scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(edge.tunnel.name,p.x,p.y-28/scale);
        }
        if(st.config.cargo) {
            const shape=R.cargoShape(st,R.groupFor(st,st.config.cargo.cars[0]));
            if(shape)polygon(shape,'#d6cbaa','#6b6152',1.5/scale);
        }
        for(const t of st.traffic.filter(t=>!t.finished)) {
            const head=R.bounds(t).hi,leg=t.path.find(p=>p.end>head),p=head<t.exitQ&&leg&&R.locate(st,t,Math.min(t.exitQ,leg.end)-22);
            if(p){ctx.fillStyle=t.waiting==='Running'?'#75a976':'#c55336';ctx.beginPath();ctx.arc(p.x,p.y-13,6/scale,0,Math.PI*2);ctx.fill();}
        }
        for(const [p,label,color,offset] of [[m.head,'HEAD','#f7edc2',-22],[m.tail,'TAIL','#f5c386',25]]) {
            ctx.fillStyle='#333e35';ctx.beginPath();ctx.arc(p.x,p.y,4/scale,0,Math.PI*2);ctx.fill();
            const tx=p.x-Math.sin(p.a)*offset/scale,ty=p.y+Math.cos(p.a)*offset/scale;
            ctx.font=`bold ${10/scale}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillRect(tx-22/scale,ty-10/scale,44/scale,15/scale);ctx.fillStyle='#333e35';ctx.fillText(label,tx,ty+1/scale);
        }
        ctx.restore();
        if(st.config.weather==='snow') {
            ctx.fillStyle='#fff8de80';for(let i=0;i<95;i++){ctx.beginPath();ctx.arc((i*137+st.time*9)%w,(i*79+st.time*17)%mapHeight,1.5,0,Math.PI*2);ctx.fill();}
        }
        if(st.config.weather==='rain') {
            ctx.strokeStyle='#d1dee33b';ctx.lineWidth=1;
            for(let i=0;i<85;i++){const rx=(i*137+st.time*25)%w,ry=(i*79+st.time*110)%mapHeight;ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx-4,ry+13);ctx.stroke();}
        }
        renderGrade(st,m);
    }
    function renderGrade(st,m) {
        const canvas=$('rail-grade'),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
        if(!w||!h)return;
        const dpr=root.devicePixelRatio||1,ctx=canvas.getContext('2d');
        if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
        ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
        const profile=Presentation.profile(st),{lo,hi,samples,cars}=profile;
        const low=Math.floor(Math.min(...samples.map(p=>p.z))/5)*5-2,high=Math.max(low+8,Math.ceil(Math.max(...samples.map(p=>p.z))/5)*5+2);
        const x=q=>8+(q-lo)/(hi-lo)*(w-16),y=z=>h-14-(z-low)/(high-low)*(h-32);
        ctx.save();ctx.beginPath();ctx.rect(0,18,w,h-18);ctx.clip();
        ctx.beginPath();ctx.moveTo(x(samples[0].q),h-10);samples.forEach(p=>ctx.lineTo(x(p.q),y(p.z)));ctx.lineTo(x(samples.at(-1).q),h-10);ctx.closePath();ctx.fillStyle='#60765b55';ctx.fill();
        ctx.beginPath();samples.forEach((p,i)=>i?ctx.lineTo(x(p.q),y(p.z)):ctx.moveTo(x(p.q),y(p.z)));ctx.strokeStyle='#a6b89a';ctx.lineWidth=2;ctx.stroke();
        for(const p of profile.junctions){ctx.fillStyle='#edd18e';ctx.beginPath();ctx.arc(x(p.q),y(p.z),3,0,Math.PI*2);ctx.fill();}
        for(const c of cars){
            const width=Math.max(3,c.length/(hi-lo)*(w-16)),height=c.powered?9:6;
            ctx.fillStyle=c.powered?'#edcd88':c.attached?'#b87b60':'#91c9d2';
            ctx.fillRect(x(c.q)-width/2,y(c.z)-height-2,width,height);
            ctx.fillStyle='#182b24';for(const offset of [-.3,.3]){ctx.beginPath();ctx.arc(x(c.q)+width*offset,y(c.z)-1,1.5,0,Math.PI*2);ctx.fill();}
            if(c.secured){ctx.strokeStyle='#e8cb83';ctx.strokeRect(x(c.q)-width/2,y(c.z)-height-2,width,height);}
        }
        ctx.restore();ctx.fillStyle='#d6ddca';ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillText('TRACK PROFILE',8,13);
        ctx.textAlign='right';ctx.fillText(`${Math.round(hi-lo)} m · height exaggerated`,w-8,13);
        ctx.font='10px sans-serif';ctx.textAlign='left';ctx.fillText(`${Math.round(lo-profile.engine)} m`,8,h-1);ctx.textAlign='right';ctx.fillText(`+${Math.round(hi-profile.engine)} m`,w-8,h-1);

    }

    function dialog(kind,level,run,format,hasNext=false,race=null,completionActions=null) {
        const st=run.rail,actions=(primary,label)=>`<div class="dialog-actions"><button class="primary" data-action="${primary}" autofocus>${label}</button><button data-action="courses">World map</button>${kind!=='intro'?'<button data-action="retry">Retry<span class="key-hint"> · Shift+R</span></button>':'<button data-action="help">Controls</button>'}</div>`;
        if(kind==='intro')return `<div class="eyebrow">${level.tag}</div><h1>${level.name}</h1><p>${level.brief}</p><p class="subtle">${level.tip}</p>${actions('begin','Take the controls')}`;
        if(kind==='pause')return `<div class="eyebrow">PRACTICE</div><h1>Train held.</h1><p>Pausing makes this attempt unranked. Retry for a recorded run.</p><div class="result-time">${format(run.time)}</div>${actions('resume','Resume practice')}`;
        if(kind==='failed')return `<div class="eyebrow">RUN ENDED</div><h1>Freight stopped.</h1><p>${st.failure}</p>${actions('retry','Try again')}`;
        if(kind==='result')return `<div class="eyebrow">${run.pausedUsed?'PRACTICE COMPLETE':run.pb?'PERSONAL BEST':'DELIVERY COMPLETE'}</div><h1>${race&&!hasNext?'The whole line delivered.':'Every wagon accounted for.'}</h1><div class="result-badge">${run.pausedUsed?'UNRANKED PRACTICE':run.pb?'NEW PERSONAL BEST':'DELIVERY COMPLETE'}${run.result?.clean?' · CLEAN':''}</div><div class="result-time">${format(run.time)}</div>${race?`<p>${race.name} · ${race.stages} / ${race.route.length} · total ${format(race.total)} · ${race.retries} retries</p>`:''}<div class="result-grid"><div><strong>${Math.round(st.stats.distance)} m</strong><span>DISTANCE</span></div><div><strong>${st.stats.couplings}</strong><span>COUPLINGS</span></div><div><strong>${level.rail.thermal?Math.round(st.stats.peakTemperature)+'°C':st.stats.contacts}</strong><span>${level.rail.thermal?'PEAK BRAKES':'CONTACTS'}</span></div></div>${completionActions||actions(hasNext?'next':'courses',hasNext?'Next assignment':'World map')}<p class="subtle">${run.pausedUsed?'Practice time was not saved to the leaderboards.':'Time saved to your logbook. Clean means no buffer impacts or rough finishes.'}</p>`;
        return `<div class="eyebrow">RAILWAY CONTROLS</div><h1>Give the tail time.</h1><p class="keyboard-only">W / S changes ${st.config.helper?'front ':''}power. A / D releases / applies the train brake. ${st.config.helper?'E / Q raises / lowers rear assistance.':'Q / E releases / applies the locomotive brake.'} Space cuts power and applies full train brake. Stop before reversing with X.</p><p>Use the power and brake sliders or the + / − telegraphs. Stop before using Reverse. Full brake cuts power and applies the train brake.</p><p>Click points or a route button to change the connection. Occupied points stay locked until the whole train clears.${st.traffic.length?' Use Signal departure to release the passenger. Set its route yourself; red signals hold it until the track and points are clear.':''}</p><p>Approach within 3 m at less than 2 km/h, then use Couple. Stop with brakes applied and power off before cutting a link in the train strip. Select a cut and use Handbrakes to set or release them. Detached air brakes slowly leak away.</p><p>The track profile shows elevation and wagons along the selected route. Blue wagons are detached or belong to another train; gold outlines indicate handbrakes. Height is exaggerated. Stopping distance estimates full train braking, including brake delay and current temperature. Brake before a lower speed limit; it applies until the tail clears.</p><p><span class="keyboard-only">Shift+R retries. Escape pauses. </span> Focus-loss pausing is optional in the logbook.</p>${actions('back','Back')}`;
    }
    const api={prepare,key,update,render,dialog,indicators,displayDirection,signedSpeed,actionEnabled};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.RailView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
