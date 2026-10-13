(function(root) {
    'use strict';
    const R=typeof module!=='undefined'&&module.exports?require('./rail.js'):root.Railway;
    const indicatorStates=new WeakMap();
    function indicators(st) {
        let state=indicatorStates.get(st);
        if(!state){state={slideUntil:new Map(),slipUntil:-Infinity};indicatorStates.set(st,state);}
        // Clear warnings only after a quiet interval. Never feed display
        // persistence back into adhesion or braking forces.
        if(st.slip)state.slipUntil=st.time+.45;
        const sliding=new Set();
        for(const g of st.groups)for(const c of g.cars) {
            const alreadyLit=st.time<(state.slideUntil.get(c.id)??-Infinity);
            if(c.sliding&&Math.abs(c.v)>(alreadyLit?.1:.5))state.slideUntil.set(c.id,st.time+.45);
            if(st.time<(state.slideUntil.get(c.id)??-Infinity))sliding.add(c.id);
        }
        return {sliding,slip:st.time<state.slipUntil};
    }
    const displayDirection=(st,c)=>st.reverser*c.face;
    const signedSpeed=st=>{const c=R.engineGroup(st).cars.find(c=>c.id==='engine');const speed=c.v*displayDirection(st,c)*3.6;return Math.abs(speed)<.05?'0.0':speed.toFixed(1);};
    const actionStates=new WeakMap();
    const adviceStates=new WeakMap();
    const couplingStates=new WeakMap();
    function couplingWarning(st,current) {
        let state=couplingStates.get(st);
        if(!state){state={warning:null,until:0};couplingStates.set(st,state);}
        if(current){state.warning=current;state.until=st.time+.6;}
        return st.time<state.until?state.warning:null;
    }
    function stableAdvice(st,help) {
        const key=help.action+':'+help.direction+':'+JSON.stringify(help.split);let state=adviceStates.get(st);
        if(!state){state={key,since:st.time,help};adviceStates.set(st,state);}
        if(key!==state.key){state.key=key;state.since=st.time;}
        if(st.time-state.since>=.4)state.help=help;
        return state.help;
    }
    function actionEnabled(st,name,value,raw) {
        let state=actionStates.get(st);
        const topology=st.groups.map(g=>g.cars.map(c=>c.id).join(',')).join('|')+':'+st.selected;
        if(!state||state.topology!==topology){state={topology,buttons:new Map()};actionStates.set(st,state);}
        const key=name+':'+JSON.stringify(value);let button=state.buttons.get(key);
        if(!button){button={ready:raw,since:st.time};state.buttons.set(key,button);}
        if(!raw){button.ready=false;button.since=st.time;}
        else if(st.time-button.since>=.4)button.ready=true;
        return raw&&button.ready;
    }
    // One projection supplies status, action eligibility and warning persistence
    // for a HUD update. UI history lives here, outside the simulated train.
    function snapshot(st) {
        const metrics=R.metrics(st),warning=R.danger(st),help=R.assistance(st);
        const actions=new Map(),put=(name,value)=>actions.set(name+':'+JSON.stringify(value),R.availability(st,name,value));
        const levers=R.commands.levers(!!st.config.helper);
        for(const lever of levers)put(lever.name,undefined);
        for(const name of ['stop','reverse','hand','couple','dispatch'])put(name,undefined);
        for(const group of st.groups)group.cars.forEach((car,i)=>{
            put('select',car.id);
            if(i<group.cars.length-1)put('uncouple',{after:car.id,before:group.cars[i+1].id});
        });
        for(const sw of st.net.switches)put('switch',sw.node);
        for(const t of st.traffic)put('dispatch',t.id);
        return {metrics,warning,help,signals:indicators(st),recommendation:stableAdvice(st,help),
            coupling:couplingWarning(st,warning.coupling),speed:signedSpeed(st),levers,
            action(name,value){return actions.get(name+':'+JSON.stringify(value))||{enabled:false,reason:'Unknown action.'};}};
    }
    function profile(st) {
        const train=R.engineGroup(st),engine=R.drivingEngine(st),bounds=R.bounds(train);
        const span=Math.max(400,bounds.hi-bounds.lo+240),center=(bounds.lo+bounds.hi)/2;
        const lo=center-span/2,hi=center+span/2,path=R.previewPath(st,train,lo,hi);
        const from=Math.max(lo,path.path[0].start),to=Math.min(hi,path.path.at(-1).end);
        const samples=Array.from({length:101},(_,i)=>{const q=from+(to-from)*i/100;return {q,z:R.locate(st,path,q).z};});
        const cars=[];
        for(const group of [...st.groups,...st.traffic.filter(t=>!t.finished)])for(const car of group.cars) {
            const position=R.locate(st,group,car.q);
            const candidates=path.path.filter(leg=>leg.id===position.edge).map(leg=>leg.dir===1?leg.start+position.s:leg.end-position.s);
            const q=group===train?car.q:candidates.sort((a,b)=>Math.abs(a-engine.q)-Math.abs(b-engine.q))[0];
            if(q===undefined||q+car.length/2<lo||q-car.length/2>hi)continue;
            cars.push({id:car.id,q,z:position.z,length:car.length,powered:!!car.powered,attached:group===train,secured:car.hand});
        }
        const junctions=path.path.flatMap(leg=>{
            const edge=st.net.edges[leg.id],node=leg.dir===1?edge.a:edge.b;
            return st.net.switches.some(sw=>sw.node===node)&&leg.start>=lo&&leg.start<=hi?[{q:leg.start,z:R.locate(st,path,leg.start).z}]:[];
        });
        return {lo,hi,engine:engine.q,samples,cars,junctions};
    }
    // Map-wide protection makes placement independent of current train motion
    // and notice text. Recompute only when the level, viewport or zoom changes.
    function statusPlacement(level,net,w,h,height=260) {
        const s=Math.min((w-42)/level.world[0],(h-25)/level.world[1]);
        const ox=(w-level.world[0]*s)/2,oy=(h-level.world[1]*s)/2;
        const point=p=>({x:ox+p.x*s,y:oy+p.y*s});
        const protectedAreas=[],pad=level.rail.cargo?30:21;
        const label=(p,text,offset=24)=>protectedAreas.push({x:p.x-text.length*3.2-8,y:p.y-offset-15,w:text.length*6.4+16,h:24});
        for(const edge of Object.values(net.edges)) {
            edge.samples.slice(1).forEach((b,i)=>{const a=point(edge.samples[i]);b=point(b);
                protectedAreas.push({x:Math.min(a.x,b.x)-pad,y:Math.min(a.y,b.y)-pad,w:Math.abs(a.x-b.x)+pad*2,h:Math.abs(a.y-b.y)+pad*2});});
            if(edge.tunnel)label(point(R.at(net,edge.id,edge.tunnel.from)),edge.tunnel.name,28);
        }
        for(const z of level.rail.zones)label(point(R.at(net,z.edge,(z.from+z.to)/2)),z.name);
        for(const sw of net.switches){const p=net.nodes[sw.node];label(point({x:p[0],y:p[1]}),sw.label,14);}
        for(const f of level.rail.floods||[])label(point(R.at(net,f.edge,(f.from+f.to)/2)),f.name+' · 999 s',22);
        // Preferred pockets: quarry NE, station south, descent NW, valley NE,
        // river NW, woods NE, bridge NW, terminal NW, summit NW, ferry NW,
        // floodplain NW, and the finale above its western plateau.
        const anchors=[[1,0],[.5,1],[0,0],[1,0],[0,0],[1,0],[0,0],[0,0],[0,0],[0,0],[0,0],[.15,0]];
        const anchor=anchors[Number(level.id.split('-').at(-1))-1]||[1,0];
        const width=Math.min(288,w-24),left=12,right=Math.max(left,w-width-12),top=54;
        let best=null;
        if(height<=h-top-44) {
            const bottom=h-height-44,preferred={x:left+(right-left)*anchor[0],y:top+(bottom-top)*anchor[1]};
            const candidates=[preferred];
            for(let row=0;row<=16;row++)for(let col=0;col<=20;col++)candidates.push({x:left+(right-left)*col/20,y:top+(bottom-top)*row/16});
            for(const p of candidates){const rect={...p,w:width,h:height};
                const blocked=protectedAreas.filter(b=>p.x<b.x+b.w&&p.x+width>b.x&&p.y<b.y+b.h&&p.y+height>b.y).length;
                const score=blocked*1e8+Math.hypot(p.x-preferred.x,p.y-preferred.y);
                if(!best||score<best.score)best={...rect,blocked,score,protectedAreas};
            }
        }
        return best?.blocked===0?{...best,fallback:false}:{x:right,y:top,w:width,h:height,fallback:true,protectedAreas};
    }
    const scenery=typeof module!=='undefined'&&module.exports?require('./rail-scenery.js'):root.RailScenery;
    const landscapes=new WeakMap();
    // Interpolation and river intersections are precomputed during the build.
    // Only expand this level's compact coordinates on its first visit.
    function landscape(level) {
        if(landscapes.has(level))return landscapes.get(level);
        const data=scenery[level.id];
        const result={...data,contours:data.contours.map(([x,y,u,v])=>[{x,y},{x:u,y:v}])};
        landscapes.set(level,result);return result;
    }
    const api={profile,landscape,statusPlacement,snapshot,indicators,displayDirection,signedSpeed,actionEnabled};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    root.RailPresentation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
