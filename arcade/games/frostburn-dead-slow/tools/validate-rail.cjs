// @ts-check
'use strict';
/** Validate references that structural types cannot check.
 * @param {import('../src/rail-level-types.js').RailConfig} config
 * @param {string} id */
function validateRail(config,id) {
    /** @param {unknown} ok @param {string} message */
    const check=(ok,message)=>{if(!ok)throw Error(`${id}: ${message}`);};
    /** @param {{id:string}[]} rows @param {string} label */
    const unique=(rows,label)=>{
        const ids=new Set(rows.map(row=>row.id));
        check(ids.size===rows.length,`duplicate ${label} ID`);
        return ids;
    };
    const tracks=unique(config.tracks,'track'),zones=unique(config.zones,'zone');
    const tasks=unique(config.tasks,'task'),cars=unique(config.groups.flatMap(g=>g.cars),'vehicle');
    const traffic=unique(config.traffic||[],'traffic');
    const edges=new Map(config.tracks.map(edge=>[edge.id,edge]));
    check(cars.has('engine'),'missing driving engine');
    for(const edge of config.tracks) {
        check(config.nodes[edge.a]&&config.nodes[edge.b],`track ${edge.id} has an unknown endpoint`);
        check(edge.a!==edge.b&&edge.limit>0,`track ${edge.id} has invalid geometry or speed limit`);
    }
    check(new Set(config.switches.map(sw=>sw.node)).size===config.switches.length,'duplicate switch');
    for(const sw of config.switches) {
        check(sw.branches.length===sw.names.length&&sw.branches.length>0,`switch ${sw.node} needs named branches`);
        check(new Set([sw.stem,...sw.branches]).size===sw.branches.length+1,`switch ${sw.node} repeats a connection`);
        for(const name of [sw.stem,...sw.branches]) {
            const edge=edges.get(name);
            check(edge&&(edge.a===sw.node||edge.b===sw.node),`switch ${sw.node} references unconnected track ${name}`);
        }
    }
    for(const group of config.groups) {
        check(group.cars.length,'empty starting cut');
        for(const car of group.cars)check(tracks.has(car.edge)&&car.edge===group.cars[0].edge&&car.mass>0&&car.length>0,`invalid starting vehicle ${car.id}`);
    }
    for(const zone of config.zones)check(tracks.has(zone.edge)&&zone.to>zone.from,`invalid zone ${zone.id}`);
    for(const task of config.tasks) {
        if('zone' in task)check(zones.has(task.zone),`task ${task.id} references unknown zone ${task.zone}`);
        if('alternative' in task)check(zones.has(task.alternative),`task ${task.id} references unknown alternative`);
        if('traffic' in task)check(traffic.has(task.traffic),`task ${task.id} references unknown traffic`);
        const references=[...('cars' in task?task.cars:[]),...('exclude' in task?task.exclude||[]:[]),...('order' in task?task.order||[]:[])];
        for(const car of references)check(cars.has(car),`task ${task.id} references unknown vehicle ${car}`);
        const visited=new Set([task.id]);
        let after=task.after;
        while(after) {
            check(tasks.has(after)&&!visited.has(after),`task ${task.id} has a missing or cyclic prerequisite`);
            visited.add(after);after=config.tasks.find(t=>t.id===after)?.after;
        }
    }
    for(const train of config.traffic||[]) {
        let end;
        check(train.route.length,'empty passenger route');
        for(const [id,dir] of train.route) {
            const edge=edges.get(id);check(edge,`passenger ${train.id} references unknown track ${id}`);
            if(!edge)continue;
            const start=dir===1?edge.a:edge.b;
            check(end===undefined||start===end,`passenger ${train.id} has a disconnected route`);
            end=dir===1?edge.b:edge.a;
        }
    }
    for(const id of config.cargo?.cars||[])check(cars.has(id),`cargo references unknown vehicle ${id}`);
    for(const id of config.ferry?.decks||[])check(tracks.has(id),`ferry references unknown deck ${id}`);
    for(const flood of config.floods||[])check(tracks.has(flood.edge),`flood references unknown track ${flood.edge}`);
    return true;
}
module.exports={validateRail};
