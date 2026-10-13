'use strict';
// Rebuild the tutorial recording from ordinary controls, then validate it through
// the live game's replay path after running tools/sync-replays.cjs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const R=require('../src/rail.js'),L=require('../src/rail-levels.js'),{move,step}=require('../tests/rail-driver.cjs');
const number=Number(process.argv[2]||1);assert.ok([1,7,8,10,12].includes(number),'Choose recording 1, 7, 8, 10 or 12');
const selected=L[number-1],st=R.create(selected),events=[],command=R.command,update=R.update;
let expectedTime=null;
R.command=(state,name,value)=>{
    const old=name==='brake'?R.engineGroup(state).brake:state[name];
    const changed=['power','helper','brake','independent'].includes(name)?old!==value:name==='stop'?state.power!==0||state.helper!==0||R.engineGroup(state).brake!==1:true;
    const ok=command(state,name,value);
    if(ok&&changed&&expectedTime===null)events.push({time:Math.round(state.time*120)/120,rail:value===undefined?[name]:[name,value]});
    return ok;
};
R.update=(state,dt)=>{update(state,dt);if(expectedTime===null&&state.finishHold>=2)expectedTime=Math.round(state.time*120)/120;};
const cmd=(name,value)=>assert.ok(R.command(st,name,value),st.notice);
if(number===12)require('../tests/rail-final-routes.cjs').finale(st);
else if(number===10)require('../tests/rail-final-routes.cjs').ferry(st);
else if(number===8)require('../tests/rail-cargo-route.cjs').cargo(st);
else if(number===7)require('../tests/rail-routes.cjs').bridge(st);
else {
move(st,'engine','receiving',120,1);cmd('independent',1);step(st,2);
move(st,'engine','receiving',165,1,.45);cmd('couple');cmd('hand');step(st,2);
move(st,'R1','approach',335,-1,2);cmd('switch','j');move(st,'R1','siding',220,1,2);cmd('hand');step(st,4);
}
assert.ok(expectedTime);assert.equal(st.failure,null);
const recording={level:selected.id,description:number===12?'Share the mountain climb with a rear helper, leave it at the summit, descend under control, meet the coastal passenger and secure every winter-supply wagon. Ordinary controls; no relocation.':number===7?'Shuttle paired transformer loads over the bridge, use the return loop, and assemble load 2 ahead of load 1. Recorded controls only.':'Collect the waiting wagons, reverse clear of Quarry Junction and secure the complete train in the siding. Recorded power, brake, coupling and point commands; no repositioning.',duration:expectedTime+1,expectedTime,events};
recording.compatibility=`rail:${selected.courseRevision||1}:${selected.rulesRevision||1}`;
if(number===10)recording.description='Load pair A onto the port deck, run around pair B with the reach wagon, load starboard, and secure the locomotive ashore. Recorded controls only.';
if(number===8)recording.description='Leave the vessel secured, shunt the flats beyond its swept path, return for the carriers, and reverse into the export berth. Ordinary controls; no relocation.';
fs.writeFileSync(path.join(__dirname,`../tests/fixtures/long-grade-${number}-controls.json`),JSON.stringify(recording,null,2)+'\n');
console.log(`${events.length} input events; ${expectedTime.toFixed(3)} s; no vehicle relocation.`);
