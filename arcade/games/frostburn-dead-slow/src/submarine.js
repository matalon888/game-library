/* Slow underwater handling and mission state. Sensor estimates never steer hidden hulls. */
(function(root){
    'use strict';
    const P=typeof module!=='undefined'&&module.exports?require('./physics.js'):root.HarborPhysics;
    const Sonar=typeof module!=='undefined'&&module.exports?require('./sonar.js'):root.PaleReachSonar;
    const Geometry=typeof module!=='undefined'&&module.exports?require('./polar-operations.js'):root.PaleReachOperations;
    const Recovery=typeof module!=='undefined'&&module.exports?require('./submarine-recovery.js'):root.PaleReachRecovery;
    const covert=st=>['covert','recovery'].includes(st.config.mission);
    const access=st=>st.recovery?Recovery.access(st):st.config.access;
    const listenRange=st=>st.recovery?.search?360:300;
    const bands=[{name:'SHALLOW',depth:18},{name:'WORKING',depth:48},{name:'DEEP',depth:88}];
    const speed=s=>Math.hypot(s.vx,s.vy),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const weapon=(ammo,damage=60)=>({ammo,damage,cooldown:0,solution:0,hold:4,range:360,arc:.58,reason:'Identify a submerged contact',aim:null});
    function actor(c){return {...c,active:true,waypoint:0,route:c.route?.map(p=>p.slice()),fix:null,quietNow:false,nextDecoy:75,
        ship:P.ship(...c.start,{...c.spec,...(c.kind==='submarine'?{vessel:'submarine'}:{}),name:c.name||'ACOUSTIC SOURCE',id:c.id,depth:c.depth,depthTarget:c.depth,heave:0,hull:100,
            ...(c.kind==='decoy'?{length:5,beam:3,mass:.3,vx:c.vx,vy:c.vy,disabled:true}:{}),required:false}),
        gun:c.armed?weapon(6,c.torpedoDamage||60):null};}
    function create(level){
        const c=level.polar,ship=P.ship(...level.start,{...level.spec,vessel:'submarine',depth:c.depth,depthTarget:c.depth,heave:0});
        const st={submarine:true,level,config:c,time:0,player:ship,contacts:0,damage:0,lastHits:{},fleet:[],failure:null,complete:false,
            actors:c.actors.map(actor),shelves:c.shelves.map(s=>({...s,poly:s.poly.map(([x,y])=>({x,y}))})),
            platforms:c.platforms.map(p=>({...p,poly:P.rect(p)})),bergs:c.bergs.map(b=>P.ship(b.x,b.y,0,{...b,vessel:'iceberg',depth:0,mass:80})),
            tracks:[],trackSerial:0,selected:null,sensorAt:0,noise:0,pulseAt:-100,pulses:[],echoes:[],torpedoes:[],bursts:[],serial:0,
            gun:weapon(['covert','recovery'].includes(c.mission)?0:c.mission==='hunt'?8:6),notice:'Listen quietly. Plotted contacts are estimates.',noticeUntil:8,
            stats:{damageTaken:0,towBreaks:0,pulses:0,shots:0,identifications:0,hostilesDisabled:0,teamInserted:0,teamRecovered:0,maxSuspicion:0},
            mission:{identified:false,intercepted:false,team:'aboard',ordered:false,board:0,work:0,left:false,suspicion:0,alarm:false,mining:0,threatGone:false,homeHold:0,secured:false}};
        if(c.mission==='recovery')Recovery.create(st);
        return {ship,polar:st,dock:{inside:false,aligned:true,slow:true,ready:false}};
    }
    function obstacles(st,depth,height=5){
        return [...st.platforms,...st.shelves.filter(s=>depth+height>=s.floor-2),
            ...st.bergs.filter(b=>depth-height<=b.keel+2).map(b=>({id:b.id,poly:P.hull(b),velocity:{x:b.vx,y:b.vy}}))];
    }
    function blocked(st,a,b,depth,height=2){return obstacles(st,depth,height).some(o=>Geometry.segmentHit(a,b,o.poly)<1);}
    function space(st,s){
        const hull=P.hull(s);let floor=st.config.floor,ceiling=st.config.ceiling;
        for(const b of st.shelves)if(P.sat(hull,b.poly))floor=Math.min(floor,b.floor);
        for(const b of st.bergs)if(P.sat(hull,P.hull(b)))ceiling=Math.max(ceiling,b.keel);
        return {floor,ceiling};
    }
    function depthAllowed(st,s,depth){const water=space(st,s);return depth>water.ceiling+7&&depth<water.floor-7;}
    function noise(s,input={}){
        const surge=P.groundMotion(s).surge,counter=surge*s.engine<-.32?.55:0;
        return P.clamp(.06+speed(s)*.10+Math.abs(s.engine)**2*.48+counter+Math.abs(input.thruster||0)*.34+Math.abs(s.heave||0)*.05,0,1.5);
    }
    function say(st,text){st.notice=text;st.noticeUntil=st.time+6;}
    function action(run,name,value){
        const st=run.polar,s=run.ship,m=st.mission;
        if(name==='rendezvous'&&st.recovery){const ok=Recovery.select(st,value);if(ok)say(st,Recovery.message(st));return ok;}
        if(name==='depth'||name==='ascend'||name==='descend'){
            const current=bands.findIndex(b=>b.depth===s.depthTarget),index=name==='depth'?Number(value):P.clamp(current+(name==='ascend'?-1:1),0,2),band=bands[index];
            if(!band||!depthAllowed(st,s,band.depth)){say(st,'Depth order blocked here: check the keel and seabed clearance.');return false;}
            s.depthTarget=band.depth;say(st,`${band.name} ordered · ${band.depth} m. Depth changes take time.`);return true;
        }
        if(name==='target'){
            const tracks=st.tracks,track=value?tracks.find(t=>t.id===value):tracks[(tracks.findIndex(t=>t.id===st.selected)+1)%tracks.length];
            if(!track)return false;st.selected=track.id;st.gun.solution=0;return true;
        }
        if(name==='ping'){
            if(st.time-st.pulseAt<18){say(st,'Active sonar recharging. Keep listening.');return false;}
            st.pulseAt=st.time;st.stats.pulses++;st.pulses.push({x:s.x,y:s.y,at:st.time,range:720});
            let patrolHeard=false;
            for(const a of st.actors.filter(a=>a.active&&a.ship.hull>0)){
                const d=distance(s,a.ship);
                if(d<720&&!blocked(st,s,a.ship,(s.depth+a.ship.depth)/2))st.echoes.push({entity:a.id,due:st.time+d/210});
                if((a.hostile||a.kind==='patrol')&&d<900&&!blocked(st,s,a.ship,(s.depth+a.ship.depth)/2)){
                    a.fix={x:s.x,y:s.y,vx:s.vx,vy:s.vy,depth:s.depth,at:st.time,until:st.time+85};
                    if(a.kind==='patrol')patrolHeard=true;
                    if(a.decoys)a.nextDecoy=Math.min(a.nextDecoy,st.time+5);
                }
            }
            if(covert(st)&&patrolHeard){m.suspicion=Math.min(100,m.suspicion+32);m.alarm||=m.suspicion>=100;}
            say(st,'ACTIVE PULSE · echo in transit. Listeners within reach receive your emission position.');return true;
        }
        if(name==='identify'){
            const t=st.tracks.find(t=>t.id===st.selected);
            if(!t||t.category==='unknown'||Sonar.predict(t,st.time).age>18){say(st,'Identification needs a fresh, discriminated return. Listen longer or send a pulse.');return false;}
            if(!t.identified){t.identified=true;st.stats.identifications++;}
            if(t.category==='submarine')m.identified=true;
            say(st,`${t.id} identified: ${t.category==='submarine'?'unauthorized submarine':t.category==='service'?'friendly maintenance vessel':t.category==='decoy'?'acoustic decoy':'surface patrol'}.`);return true;
        }
        if(name==='fire'){
            const solution=firingSolution(st);if(!solution.ok||st.gun.solution<st.gun.hold||st.gun.cooldown>0||st.gun.ammo<=0){say(st,solution.reason);return false;}
            launch(st,{ship:s,id:'player'},st.gun,solution.aim);return true;
        }
        if(name==='team'&&covert(st)){
            if(!['aboard','waiting'].includes(m.team)){say(st,m.team==='working'?'The team is still inside. Clear the exposed area.':'Team recovered. Return to safe water.');return false;}
            const a=access(st);
            if(a.available===false){say(st,'The team is relocating on the ice. Wait for its rendezvous beacon.');return false;}
            if(distance(s,a)>a.radius||Math.abs(s.depth-a.depth)>5){say(st,st.recovery?`Recovery needs the selected moving beacon at ${a.depth} m.`:'Team transfer needs the marked hatch at working depth.');return false;}
            m.ordered=true;say(st,'Team transfer ordered. Hold quietly below 0.5 kn.');return true;
        }
        return false;
    }
    function firingSolution(st){
        const s=st.player,g=st.gun,t=st.tracks.find(t=>t.id===st.selected);
        if(covert(st))return {ok:false,reason:'Weapons sealed for the covert assignment'};
        if(!t?.identified||t.category!=='submarine')return {ok:false,reason:'Identify a hostile submarine before arming'};
        const fix=Sonar.predict(t,st.time),d=distance(s,fix);
        if(fix.age>12||fix.radius>36||fix.quality<55)return {ok:false,reason:'Uncertain solution · reacquire the track'};
        if(d>g.range||d<45)return {ok:false,reason:d>g.range?'Contact outside 360 m torpedo range':'Contact too close to arm'};
        if(t.depth===null||Math.abs(t.depth-s.depth)>9||Math.abs(s.depth-s.depthTarget)>3)return {ok:false,reason:'Match the observed depth and settle the dive'};
        const flight=d/11,aim={x:fix.x+t.vx*flight,y:fix.y+t.vy*flight};
        if(Math.abs(P.wrap(Math.atan2(aim.y-s.y,aim.x-s.x)-s.a))>g.arc)return {ok:false,reason:'Outside the forward torpedo arc'};
        if(speed(s)>1.25||Math.abs(s.r)>.018)return {ok:false,reason:'Slow and steady the hull'};
        if(blocked(st,P.localPoint(s,s.length*.6,0),aim,s.depth))return {ok:false,reason:'Seabed or ice keel blocks the run'};
        if(g.ammo<=0)return {ok:false,reason:'Torpedoes expended'};
        return {ok:true,reason:g.cooldown>0?'Torpedo tube reloading':'Stable torpedo solution',aim};
    }
    function launch(st,source,g,aim){
        const s=source.ship,p=P.localPoint(s,s.length*.6,0),dx=aim.x-p.x,dy=aim.y-p.y,d=Math.hypot(dx,dy);
        st.torpedoes.push({id:++st.serial,source:source.id,hostile:source.id!=='player',x:p.x,y:p.y,depth:s.depth,vx:dx/d*11,vy:dy/d*11,life:38,armed:0,damage:g.damage});
        g.ammo--;g.cooldown=17;g.solution=0;
        if(source.id==='player'){st.stats.shots++;P.impulseAt(s,p,{x:-dx/d*.08,y:-dy/d*.08});say(st,'TORPEDO AWAY · running on the plotted solution.');}
        else say(st,'TORPEDO TRANSIENT · maneuver or change depth. Your firing solution may be lost.');
    }
    function vertical(st,s,dt){
        const limits=space(st,s),lo=limits.ceiling+7,hi=limits.floor-7;
        if(s.depth<lo||s.depth>hi)return;
        const target=P.clamp(s.depthTarget,lo,hi),d=target-s.depth,wanted=P.clamp(d*.16,-1.4,1.4);
        s.heave+=(wanted-s.heave)*(1-Math.exp(-dt/3));s.depth=P.clamp(s.depth+s.heave*dt,lo,hi);
        if(s.depth===lo&&s.heave<0||s.depth===hi&&s.heave>0)s.heave=0;
    }
    function hit(st,s,id,impact){
        if(!impact||impact.impact<.22||st.time-(st.lastHits[id]??-100)<1.2)return;
        st.lastHits[id]=st.time;const damage=Math.max(.25,(impact.impact-.18)**2*2.4);s.hull=Math.max(0,s.hull-damage);
        if(s===st.player){st.contacts++;st.damage+=damage;st.stats.damageTaken+=damage;}
    }
    function moveActor(st,a,dt,I){
        const s=a.ship;if(!a.active)return;
        if(a.kind==='decoy'){s.x+=s.vx*dt;s.y+=s.vy*dt;if(st.time>(a.born||0)+a.life)a.active=false;return;}
        if(s.hull<=0){s.disabled=true;s.throttle=0;P.integrate(s,{}, {},dt);for(const o of obstacles(st,s.depth))P.contact(s,o);return;}
        const fix=a.fix&&st.time<a.fix.until?a.fix:null;
        const quiet=!!a.quiet&&st.time%100>52&&st.time%100<82&&!a.aborted&&!fix;
        let route=a.route,cruise=a.cruise,hold=false,wp=a.waypoint;
        if(a.aborted){route=[[s.x,s.y],[st.config.withdrawal.x,st.config.withdrawal.y]];wp=1;cruise=2;}
        else if(fix&&a.hostile){route=[[s.x,s.y],[fix.x,fix.y]];wp=1;cruise=distance(s,fix)<290?0:1.2;}
        const c=I.pilot(s,route,wp,cruise,hold,30);
        if(quiet){s.throttle=0;c.input={rudder:0,thruster:0};}
        if(!a.aborted&&!(fix&&a.hostile))a.waypoint=c.waypoint;
        if(c.arrived&&a.loop)a.waypoint=0;
        P.integrate(s,c.input,{},dt);
        a.quietNow=quiet&&Math.abs(s.engine)<.2;
        for(const o of obstacles(st,s.depth))hit(st,s,a.id+'-'+(o.name||o.id),P.contact(s,o));
        if(a.aborted&&distance(s,st.config.withdrawal)<st.config.withdrawal.radius){a.escaped=true;a.active=false;}
        if(a.decoys&&st.time>=a.nextDecoy&&!a.aborted){
            a.nextDecoy=st.time+70;
            if(st.actors.filter(n=>n.active&&n.kind==='decoy').length<4){
                const p=P.localPoint(s,-s.length*.55,0),d=actor({id:'decoy-'+(++st.serial),kind:'decoy',start:[p.x,p.y,s.a],depth:s.depth,vx:s.vx*.12,vy:s.vy*.12,life:110});d.born=st.time;st.actors.push(d);
            }
        }
        if(a.gun){
            const g=a.gun;g.cooldown=Math.max(0,g.cooldown-dt);
            const age=fix?st.time-fix.at:0,aim=fix?{x:fix.x+fix.vx*Math.min(age,20),y:fix.y+fix.vy*Math.min(age,20)}:null;
            const stable=aim&&distance(s,aim)<g.range&&distance(s,aim)>45&&Math.abs(fix.depth-s.depth)<10&&speed(s)<1.5&&Math.abs(s.r)<.023&&Math.abs(P.wrap(Math.atan2(aim.y-s.y,aim.x-s.x)-s.a))<g.arc&&!blocked(st,s,aim,s.depth);
            g.solution=stable&&g.cooldown===0?Math.min(g.hold,g.solution+dt):Math.max(0,g.solution-dt*3);
            if(g.solution>=g.hold&&g.ammo>0)launch(st,a,g,aim);
        }
    }
    function sensors(st){
        for(const a of st.actors.filter(a=>a.active&&a.ship.hull>0)){
            const s=a.ship,d=distance(st.player,s),volume=a.quietNow?.04:a.kind==='decoy'?.55:a.kind==='service'?.6:.35+speed(s)*.16;
            const reach=(140+volume*850)*P.clamp(1-st.noise*.65,.15,1);
            if(d<reach&&!blocked(st,st.player,s,(st.player.depth+s.depth)/2))Sonar.observe(st,a,st.player,st.time);
            if(a.hostile&&d<110+st.noise*440&&!blocked(st,st.player,s,(st.player.depth+s.depth)/2))a.fix={x:st.player.x,y:st.player.y,vx:st.player.vx,vy:st.player.vy,depth:st.player.depth,at:st.time,until:st.time+55};
        }
        Sonar.prune(st,st.time);
        st.actors=st.actors.filter(a=>a.kind!=='decoy'||a.active||st.time-(a.born||0)-a.life<150);
    }
    function projectiles(st,dt){
        for(const t of st.torpedoes){
            const a={x:t.x,y:t.y},b={x:t.x+t.vx*dt,y:t.y+t.vy*dt};t.life-=dt;t.armed+=dt;
            let first=Infinity,victim=null;
            for(const o of obstacles(st,t.depth,2)){const f=Geometry.segmentHit(a,b,o.poly);if(f<first){first=f;victim=null;}}
            for(const actor of [{id:'player',ship:st.player},...st.actors.filter(a=>a.active)]){
                if(actor.id===t.source||Math.abs(actor.ship.depth-t.depth)>9||t.armed<1.1)continue;
                const f=Geometry.segmentHit(a,b,P.hull(actor.ship,4));if(f<first){first=f;victim=actor;}
            }
            t.x=b.x;t.y=b.y;
            if(first<=1){
                t.life=0;st.bursts.push({x:a.x+(b.x-a.x)*first,y:a.y+(b.y-a.y)*first,until:st.time+2});
                if(victim){
                    const s=victim.ship,old=s.hull;s.hull=Math.max(0,s.hull-t.damage);
                    if(victim.id==='player')st.stats.damageTaken+=Math.min(t.damage,old);
                    else if(victim.hostile){
                        if(old>0&&s.hull===0)st.stats.hostilesDisabled++;
                        if(st.config.mission==='hunt'&&s.hull>0){victim.aborted=true;say(st,'Minelaying interrupted. The contact is withdrawing; guard the passage.');}
                    }else if(victim.kind==='service')st.failure='A friendly maintenance vessel was hit.';
                }
            }
        }
        st.torpedoes=st.torpedoes.filter(t=>t.life>0);st.bursts=st.bursts.filter(b=>b.until>st.time);
    }
    function mission(st,dt){
        const c=st.config,m=st.mission,s=st.player,hostile=st.actors.find(a=>a.hostile);
        if(covert(st)){
            let exposure=0;
            for(const a of st.actors.filter(a=>a.kind==='patrol')){
                const d=distance(s,a.ship),angle=Math.abs(P.wrap(Math.atan2(s.y-a.ship.y,s.x-a.ship.x)-a.ship.a)),depthFactor=s.depth>70?.58:1;
                const inArc=angle<1.05?1:.18;
                const range=listenRange(st),rayDepth=st.recovery?(s.depth+a.ship.depth)/2:s.depth;
                if(d<range&&!blocked(st,s,a.ship,rayDepth))exposure+=Math.max(0,(1-d/range)*st.noise*inArc*depthFactor*17-1.05);
            }
            const a=access(st),close=a.available!==false&&distance(s,a)<a.radius&&Math.abs(s.depth-a.depth)<5;
            m.suspicion=P.clamp(m.suspicion+(exposure>0?exposure:-1.25)*dt,0,100);
            st.stats.maxSuspicion=Math.max(st.stats.maxSuspicion,m.suspicion);
            if(m.alarm||m.suspicion>=100){m.alarm=true;st.failure='Confirmed alarm. The covert assignment and its recovery window are lost.';}
            if(m.ordered){
                m.board=close&&Math.hypot(s.vx-(a.vx||0),s.vy-(a.vy||0))<.25&&st.noise<.35?m.board+dt:Math.max(0,m.board-dt*2);
                if(m.board>=a.hold){m.ordered=false;m.board=0;if(m.team==='aboard'){m.team='working';st.stats.teamInserted=1;say(st,'TEAM INSERTED · clear the 125 m exposed area.');}else{m.team='recovered';st.stats.teamRecovered=1;say(st,'TEAM ABOARD · escape to home water without an alarm.');}}
            }
            if(m.team==='working'&&distance(s,a)>a.standOff){m.left=true;m.work=Math.min(a.work,m.work+dt);if(m.work>=a.work){m.team='waiting';say(st,'TEAM READY · return through a patrol gap and order recovery.');}}
            m.threatGone=m.team==='recovered'&&(!st.recovery||st.recovery.escaped);
        }else{
            if(c.mission==='intercept'){
                m.intercepted=hostile.ship.hull<=0;
                if(!m.intercepted&&distance(hostile.ship,c.installation)<c.installation.radius){m.mining+=dt;if(m.mining>=c.installation.hold)st.failure='The intruder reached the communications installation.';}
                else m.mining=Math.max(0,m.mining-dt);
                m.threatGone=m.intercepted;
            }else{
                if(!hostile.aborted&&hostile.ship.hull>0&&distance(hostile.ship,c.passage)<c.passage.radius&&speed(hostile.ship)<.3)m.mining+=dt;
                if(m.mining>=c.passage.lay)st.failure='The minelayer armed its charges in the relief passage.';
                m.threatGone=hostile.ship.hull<=0||!!hostile.escaped;
            }
            if(m.threatGone&&!m.identified)st.failure='The contact was lost before identification. The interception could not be verified.';
        }
        const home=distance(s,c.home)<c.home.radius&&speed(s)<.35&&Math.abs(s.heave)<.15&&m.suspicion<20;
        m.homeHold=ready({polar:st})&&home?m.homeHold+dt:0;m.secured=m.homeHold>=5;
        if(st.actors.some(a=>a.kind==='service'&&a.ship.hull<=0))st.failure='The friendly maintenance vessel was lost.';
        if(s.hull<=0)st.failure='Petrel was lost. The required crew must return.';
        if(P.hull(s).some(p=>p.x<0||p.y<0||p.x>st.level.world[0]||p.y>st.level.world[1]))st.failure='Petrel left the assignment. Guard the passage inside the chart.';
        st.complete=m.secured&&!st.failure;
    }
    function step(level,run,input,dt,I){
        const st=run.polar,s=run.ship,old={x:s.x,y:s.y};st.player=s;st.time+=dt;run.time=st.time;
        for(const b of st.externalIce?[]:st.bergs){
            b.x+=b.vx*dt;b.y+=b.vy*dt;
            if(b.range?.ry&&(b.y>b.range.y+b.range.ry&&b.vy>0||b.y<b.range.y-b.range.ry&&b.vy<0))b.vy=-b.vy;
            if(b.range?.rx&&(b.x>b.range.x+b.range.rx&&b.vx>0||b.x<b.range.x-b.range.rx&&b.vx<0))b.vx=-b.vx;
        }
        P.integrate(s,input,{},dt);
        for(const o of obstacles(st,s.depth))hit(st,s,'terrain-'+(o.name||o.id),P.contact(s,o));
        vertical(st,s,dt);st.noise=noise(s,input);if(st.recovery)Recovery.step(st,dt);
        for(const a of st.actors)moveActor(st,a,dt,I);
        const hulls=[s,...st.actors.filter(a=>a.active&&a.kind!=='decoy').map(a=>a.ship)];
        for(let i=0;i<hulls.length;i++)for(let j=i+1;j<hulls.length;j++)if(Math.abs(hulls[i].depth-hulls[j].depth)<10){const h=P.collideBodies(hulls[i],hulls[j]);hit(st,hulls[i],'hull-'+i+'-'+j,h);hit(st,hulls[j],'hull-'+j+'-'+i,h);}
        if(st.time>=st.sensorAt){sensors(st);st.sensorAt=st.time+1;}
        for(const e of st.echoes)if(st.time>=e.due){const a=st.actors.find(a=>a.id===e.entity&&a.active&&a.ship.hull>0);if(a)Sonar.observe(st,a,s,st.time,true);}
        st.echoes=st.echoes.filter(e=>st.time<e.due);st.pulses=st.pulses.filter(p=>st.time-p.at<4);
        const g=st.gun;g.cooldown=Math.max(0,g.cooldown-dt);const aim=firingSolution(st);g.reason=aim.reason;g.aim=aim.aim;
        g.solution=aim.ok&&g.cooldown===0?Math.min(g.hold,g.solution+dt):Math.max(0,g.solution-dt*3);
        projectiles(st,dt);mission(st,dt);
        run.contacts=st.contacts;run.distance+=distance(s,old);run.maxSpeed=Math.max(run.maxSpeed,speed(s));run.thrusterTime=(run.thrusterTime||0)+Math.abs(input.thruster||0)*dt;
        run.focus={x:s.x,y:s.y,a:s.a};run.dockHold=st.mission.homeHold;run.dock={inside:distance(s,st.config.home)<st.config.home.radius,aligned:true,slow:speed(s)<.35,ready:st.mission.secured};
        if(run.time>=run.sampleAt){run.sampleAt=run.time+.25;run.ghost.push([run.time,s.x,s.y,s.a]);if(run.ghost.length>16000)run.ghost.shift();}
        for(const o of progress(run))if(o.done&&!run.splits.some(p=>p.name===o.text))run.splits.push({name:o.text,time:run.time});
    }
    function ready(run){const st=run.polar;return st.mission.threatGone&&(covert(st)||st.mission.identified);}
    function progress(run){const st=run.polar,m=st.mission,done=st.recovery?Recovery.progress(st):st.config.mission==='covert'?[st.stats.teamInserted>0,m.work>=st.config.access.work,st.stats.teamRecovered>0,m.secured]:[m.identified,m.threatGone,m.secured];return st.config.objectives.map((text,i)=>({text,done:!!done[i]}));}
    function message(run){const st=run.polar,m=st.mission,c=st.config;
        if(st.failure)return st.failure;
        if(st.complete)return 'Assignment complete. Petrel and the required crew are secure.';
        if(st.noticeUntil>st.time)return st.notice;
        if(st.recovery)return Recovery.message(st);
        if(m.threatGone)return 'Assignment secured · return to home water, slow below 0.7 kn, and hold for five seconds.';
        if(c.mission==='covert')return m.ordered?`TEAM TRANSFER ${m.board.toFixed(1)} / 8 s · hold quietly at working depth`:m.team==='aboard'?'Approach the marked hatch quietly. F orders insertion.':m.team==='working'?`TEAM WORK ${Math.floor(m.work)} / ${c.access.work} s · stay outside the 125 m exposed area`:'Team waiting. Return quietly and press F to recover them.';
        if(c.mission==='hunt'&&st.actors.some(a=>a.aborted))return 'Minelayer withdrawing. Keep the passage clear; pursuing beyond the chart is unnecessary.';
        return m.mining>0?`PASSAGE THREAT · ${Math.floor(m.mining)} / ${c.mission==='hunt'?c.passage.lay:c.installation.hold} s`:'Listen, select a contact, and identify it before committing to an interception.';
    }
    const api={create,step,action,ready,progress,message,bands,space,depthAllowed,noise,obstacles,blocked,firingSolution,Sonar,Recovery,covert,access,listenRange};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachSubmarine=api;
})(globalThis);
