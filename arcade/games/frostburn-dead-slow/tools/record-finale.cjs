'use strict';
// Authoring: only ordinary pushes/shield commands are sent into the real game.
// Waypoints are not loaded at runtime and never replace a pose or objective.
const fs=require('node:fs'),path=require('node:path');
const {create}=require('../tests/headless.cjs'),L=require('../src/levels.js'),R=require('../src/rampage.js');
const stop=(x,y)=>({x,y,stop:true});
function record(id,write=false){
 const idx=L.findIndex(l=>l.id===id&&l.rampage);if(idx<0)throw Error('Unknown Rampage course');
 const t=create();t.load(idx);const c=t.state.level.rampage;
 const routes={
  'gerbo-prickly-business':[...c.controls.slice(0,1),stop(1770,1080),c.controls[1],stop(1750,225),c.controls[2],stop(700,200),stop(620,600),stop(300,790),c.finish],
  'gerbo-rolling-threat':[...c.controls,c.finish],
  'gerbo-long-way-home':[c.controls[0],stop(1250,1020),c.controls[1],'intercept',stop(2050,760),c.finish]
 };
 const route=routes[id];if(!route)throw Error('No authored policy for '+id);
 let leg=0,prev={rudder:0,thruster:0,winch:0};const events=[],trace=[];
 for(let n=0;n<4000&&t.state.status==='running';n++){
  const run=t.state.run,st=run.rampage,s=run.ship,time=n/4;
  while(leg<route.length-1){const wp=route[leg];if(wp==='intercept'){if(st.monsters.some(m=>!m.invulnerable&&m.health>0))break;leg++;continue;}const d=Math.hypot(wp.x-s.x,wp.y-s.y),v=Math.hypot(s.vx,s.vy);
   if(d<(wp.stop?14:wp.r*.7)&&(!wp.stop||v<1.3))leg++;else break;}
  const target=route[leg]==='intercept'?{...st.monsters.find(m=>!m.invulnerable&&m.health>0),ram:true}:route[leg],final=leg===route.length-1;
  const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),v=Math.hypot(s.vx,s.vy);
  let speed=target.ram?30:Math.min(c.authorSpeed||24,Math.sqrt(2*1.2*Math.max(0,d-4)),d*.4);
  if(id==='gerbo-rolling-threat'&&!final)speed=c.authorSpeed || 45;
  // Keep the walking escort within sight; the leader does not teleport her.
  if(st.lady&&!st.rescued&&!target.ram){const gap=Math.hypot(s.x-st.lady.x,s.y-st.lady.y);speed=Math.min(speed,gap>240?2:gap>170?10:17);}
  const slope=R.terrain(c,s.x,s.y),drag=c.resistance+R.woodland(c,s)*.11;
  let ax=(dx/(d||1)*speed-s.vx)*.8+drag*s.vx+7.007*slope.dx;
  let ay=(dy/(d||1)*speed-s.vy)*.8+drag*s.vy+7.007*slope.dy;
  const norm=Math.max(c.drive,Math.hypot(ax,ay));const controls={rudder:+(ax/norm).toFixed(2),thruster:+(ay/norm).toFixed(2),winch:0};
  if(final&&d<c.finish.r-c.radius-12&&(run.dockHold>0||v<.38)){controls.rudder=controls.thruster=0;}
  let danger=false;
  for(const m of st.monsters.filter(m=>m.released&&m.health>0)){
   const x=m.x-s.x,y=m.y-s.y,vx=m.vx-s.vx,vy=m.vy-s.vy;
   const dist=Math.hypot(x,y),closing=-(x*vx+y*vy)/(dist||1);
   if(closing>0 && dist-m.r-c.radius<closing*.8+4)danger=true;
  }
  for(const b of st.strikes)if(b.x!==null){const dt=b.impactAt-run.time;
   if(dt>0&&dt<.7&&Math.hypot(s.x+s.vx*dt-b.x,s.y+s.vy*dt-b.y)<b.r+c.radius+4)danger=true;}
  const e={time};for(const key in controls)if(controls[key]!==prev[key])e[key]=controls[key];
  if(danger&&time+1e-7>=st.shieldReady){t.lineAction();e.line=true;}
  if(Object.keys(e).length>1)events.push(e);Object.assign(t.state.input,controls);prev=controls;t.advance(.25);
  if(n%12===0)trace.push({t:time,x:Math.round(s.x),y:Math.round(s.y),v:+v.toFixed(1),leg,hp:s.hull,
   monsters:st.monsters.map(m=>({x:Math.round(m.x),y:Math.round(m.y),hp:m.health,state:m.state,released:m.released})),lady:st.lady&&{x:Math.round(st.lady.x),y:Math.round(st.lady.y),hp:st.lady.health,trail:st.breadcrumbs.length}});
 }
 const run=t.state.run,result={status:t.state.status,time:run.time,damage:run.rampage.stats.damage,stats:run.rampage.stats,failure:run.failure,ship:run.ship,trace};
 fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../reports',id+'-trace.json'),JSON.stringify(result,null,2));
 if(write){if(result.status!=='complete'||result.damage!==0)throw Error(id+': not a clean completion');
  fs.writeFileSync(path.join(__dirname,'../tests/fixtures',id+'-controls.json'),JSON.stringify({level:id,description:'Timed directional and shield inputs through the production game. No repositioning, altered physics or objective shortcuts. Authored with tools/record-finale.cjs; reference route, not an optimal time.',events,duration:Math.ceil(run.time)+3,expectedTime:Math.round(run.time*120)/120},null,2)+'\n');}
 delete result.trace;return result;
}
if(require.main===module)console.log(JSON.stringify(record(process.argv[2],process.argv.includes('--write')),null,2));
module.exports={record};
