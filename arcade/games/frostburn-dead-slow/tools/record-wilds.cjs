'use strict';
// Authoring only: record ordinary directional/shield/fire inputs through the real game.
// Policy waypoints are not loaded by the game. No ship/monster/objective setters.
const fs=require('node:fs'),path=require('node:path');
const {create}=require('../tests/headless.cjs'),L=require('../src/levels.js'),R=require('../src/rampage.js');
function record(id,write=false){
 const t=create();t.load(L.findIndex(l=>l.id===id));const c=t.state.level.rampage;
 let leg=0,prev={rudder:0,thruster:0,winch:0};const events=[],trace=[];
 const stop=(x,y)=>({x,y,stop:true});
 const route=id==='gerbo-whiskerdoom' ? [stop(540,1220),stop(1060,1210),'monster',stop(1510,870),'locks',stop(1500,760),stop(1540,460),{x:1735,y:460,greet:true},stop(1530,460),stop(1510,780),stop(1080,780),stop(1060,1210),stop(700,1330),c.finish] :
 id==='gerbo-pepperbreath' ? [c.controls[0],{...stop(760,540),burn:'sugar'},stop(770,230),{...stop(1240,230),burn:'mallow'},stop(1230,130),stop(1720,130),{...stop(1690,740),burn:'fluff'},stop(1680,1200),stop(1030,1230),stop(530,1230),c.finish] :
 id==='gerbo-forest-slalom' ? [...c.controls,c.finish] :
 [c.controls[0],'monster',stop(670,1010),stop(270,820),c.finish];
 for(let n=0;n<6000&&t.state.status==='running';n++){
  const run=t.state.run,st=run.rampage,s=run.ship,time=n/4;let target;
  while(leg<route.length){
   const item=route[leg];
   if(item==='monster'){target=st.monsters.find(m=>m.health>0);if(!target){leg++;continue;}target={...target,ram:true,monster:true};break;}
   if(item==='locks'){target=st.districts.find(d=>d.health>0);if(!target){leg++;continue;}target={...target,ram:true};break;}
   if(item.burn&&st.districts.find(d=>d.id===item.burn).health<=0){leg++;continue;}
   const dist=Math.hypot(item.x-s.x,item.y-s.y),v=Math.hypot(s.vx,s.vy);
   if(item.greet&&st.lady.following){leg++;continue;}
   if(leg<route.length-1&&!item.burn&&!item.greet&&dist<(item.stop?14:item.r*.7)&&(!item.stop||v<1.3)){leg++;continue;}
   target=item;break;
  }
  target=target||c.finish;const final=target===c.finish;
  const dx=target.x-s.x,dy=target.y-s.y,d=Math.hypot(dx,dy),v=Math.hypot(s.vx,s.vy);
  let speed=target.ram?30:Math.min(final?17:23,Math.sqrt(2*1.25*Math.max(0,d-4)),d*.4);
  const slope=R.terrain(c,s.x,s.y),drag=c.resistance+R.woodland(c,s)*.11;
  let ax=(dx/(d||1)*speed-s.vx)*.8+drag*s.vx+7.007*slope.dx;
  let ay=(dy/(d||1)*speed-s.vy)*.8+drag*s.vy+7.007*slope.dy;
  const norm=Math.max(c.drive,Math.hypot(ax,ay));let controls={rudder:+(ax/norm).toFixed(2),thruster:+(ay/norm).toFixed(2),winch:0};
  if(target.burn&&d<32&&v<.7){
   const city=st.districts.find(city=>city.id===target.burn),a=Math.atan2(city.y-s.y,city.x-s.x);
   controls={rudder:+(.065*Math.cos(a)).toFixed(3),thruster:+(.065*Math.sin(a)).toFixed(3),winch:st.breath>.03?1:0};
  }
  // These cores need less than one full breath each; travel refills between them.
  if(final&&d<c.finish.r-c.radius-12&&(run.dockHold>0||v<.38)){controls.rudder=0;controls.thruster=0;}
  const e={time};for(const k of Object.keys(controls))if(controls[k]!==prev[k])e[k]=controls[k];
  let danger=false;
  for(const b of [...st.monsters.filter(m=>m.health>0),...st.districts.filter(d=>d.health>0)]){
   const x=b.x-s.x,y=b.y-s.y,vx=(b.vx||0)-s.vx,vy=(b.vy||0)-s.vy;
   const distance=Math.hypot(x,y),closing=-(x*vx+y*vy)/(distance||1);
   if(closing>0&&distance-b.r-c.radius<closing*.9+4)danger=true;
  }
  for(const b of st.shots){const x=b.x-s.x,y=b.y-s.y,vx=b.vx-s.vx,vy=b.vy-s.vy,tt=-(x*vx+y*vy)/(vx*vx+vy*vy);
   if(tt>=0&&tt<.55&&Math.hypot(x+vx*tt,y+vy*tt)<c.radius+5)danger=true;}
  if(danger&&time+1e-7>=st.shieldReady){t.lineAction();e.line=true;}
  if(Object.keys(e).length>1)events.push(e);Object.assign(t.state.input,controls);prev=controls;t.advance(.25);
  if(n%12===0)trace.push({time,x:Math.round(s.x),y:Math.round(s.y),v:+v.toFixed(1),hp:s.hull,leg,target:target.name||target.burn,monsters:st.monsters.map(m=>({x:Math.round(m.x),y:Math.round(m.y),hp:m.health,state:m.state})),lady:st.lady&&{x:Math.round(st.lady.x),y:Math.round(st.lady.y),hp:st.lady.health,trail:st.breadcrumbs.length},districts:st.districts.map(d=>Math.round(d.health))});
 }
 const run=t.state.run,result={status:t.state.status,time:run.time,damage:run.rampage.stats.damage,stats:run.rampage.stats,failure:run.failure,ship:run.ship,trace};
 fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../reports',id+'-wilds-trace.json'),JSON.stringify(result,null,2));
 if(write){if(result.status!=='complete'||result.damage!==0)throw Error(id+': not clean and complete');
  fs.writeFileSync(path.join(__dirname,'../tests/fixtures',id+'-controls.json'),JSON.stringify({level:id,description:'Timed directional, shield and fire inputs authored with tools/record-wilds.cjs, executed through the production game. No pose changes or objective shortcuts. A reference, not an optimal run.',events,duration:Math.ceil(run.time)+3,expectedTime:Math.round(run.time*120)/120},null,2)+'\n');}
 delete result.trace;return result;
}
if(require.main===module)console.log(JSON.stringify(record(process.argv[2],process.argv.includes('--write')),null,2));
module.exports={record};
