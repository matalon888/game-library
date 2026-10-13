'use strict';
// Offline authoring helper. Produces ordinary, timestamped directional pushes
// and shield inputs; it never writes poses, objective state or physics values.
// The shipped player/console only replays the resulting fixed JSON recording.
const fs = require('node:fs');
const path = require('node:path');
const {create} = require('../tests/headless.cjs');
const L = require('../src/levels.js'), R = require('../src/rampage.js');
function record(id, write=false) {
    const index=L.findIndex(l=>l.id===id && l.rampage);
    if(index<0)throw new Error('Specify a World 5 course ID, such as gerbo-banking.');
    const t=create();t.load(index);
    const c=t.state.level.rampage, events=[], trace=[];
    let prev={rudder:0,thruster:0}, ended=false;
    for(let n=0;n<2400 && t.state.status==='running';n++) {
        const time=n/4, run=t.state.run,s=run.ship,st=run.rampage;
        const target=(R.controlAvailable(c,st) ? c.controls[st.control] : null) || st.districts.find(d=>d.health>0) || c.finish;
        const final=target===c.finish, dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy);
        const escaping=(c.rims || []).some(r=>Math.hypot(s.x-r.x,s.y-r.y)<r.r+r.width*2.5) || st.wet>0;
        const speed=final&&!escaping?Math.min(19,d*.3):(c.authorSpeed || 21);
        const slope=R.terrain(c,s.x,s.y),drag=c.resistance;
        let ax=(speed*dx/(d||1)-s.vx)*.75+drag*s.vx+7.007*slope.dx;
        let ay=(speed*dy/(d||1)-s.vy)*.75+drag*s.vy+7.007*slope.dy;
        let len=Math.max(c.drive,Math.hypot(ax,ay));
        const controls={rudder:+(ax/len).toFixed(2),thruster:+(ay/len).toFixed(2)};
        if(final&&d<c.finish.r-c.radius-10&&Math.hypot(s.vx,s.vy)<.38){controls.rudder=0;controls.thruster=0;ended=true;}
        if(ended && run.dockHold>0){controls.rudder=0;controls.thruster=0;}
        const e={time};
        for(const k of ['rudder','thruster'])if(controls[k]!==prev[k])e[k]=controls[k];
        let danger=false;
        for(const city of st.districts.filter(d=>d.health>0)) {
            const dd=Math.hypot(city.x-s.x,city.y-s.y)-city.r-c.radius;
            if(dd<Math.hypot(s.vx,s.vy)*.8)danger=true;
        }
        for(const b of st.shots) {
            const x=b.x-s.x,y=b.y-s.y,vx=b.vx-s.vx,vy=b.vy-s.vy;
            const tt=-(x*vx+y*vy)/(vx*vx+vy*vy);
            if(tt>=0&&tt<.6&&Math.hypot(x+vx*tt,y+vy*tt)<c.radius+5)danger=true;
        }
        for(const strike of st.strikes) if(strike.x!==null) {
            const dt=strike.impactAt-run.time;
            if(dt>0&&dt<.65&&Math.hypot(s.x+s.vx*dt-strike.x,s.y+s.vy*dt-strike.y)<strike.r+c.radius+3) danger=true;
        }
        if(danger && time+1e-7>=st.shieldReady){t.lineAction();e.line=true;}
        if(Object.keys(e).length>1)events.push(e);
        Object.assign(t.state.input,controls);prev=controls;
        t.advance(.25);
        if(n%8===0)trace.push({t:time,x:+s.x.toFixed(1),y:+s.y.toFixed(1),v:+Math.hypot(s.vx,s.vy).toFixed(1),control:st.control,hp:s.hull,cp:target.name,wet:st.wet});
    }
    const result={status:t.state.status,time:t.state.run.time,damage:t.state.run.rampage.stats.damage,stats:t.state.run.rampage.stats,ship:t.state.run.ship,trace};
    if(write) {
        if(result.status!=='complete'||result.damage!==0)throw Error(`${id}: author run is not clean and complete`);
        const fixture={level:id, description:'Recorded directional pushes and shield inputs through the production game, composed by tools/record-rampage.cjs. No repositioning, altered physics or objective shortcuts. Reference completion, not an optimal route.',events,duration:Math.ceil(result.time)+3,expectedTime:Math.round(result.time*120)/120};
        fs.writeFileSync(path.join(__dirname,'../tests/fixtures',id+'-controls.json'),JSON.stringify(fixture,null,2)+'\n');
    }
    return result;
}
if(require.main===module){const id=process.argv[2];const result=record(id,process.argv.includes('--write'));const reports=path.join(__dirname,'../reports');fs.mkdirSync(reports,{recursive:true});fs.writeFileSync(path.join(reports,id+'-trace.json'),JSON.stringify(result,null,2));delete result.trace;console.log(JSON.stringify(result,null,2));}
module.exports={record};
