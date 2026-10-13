export type Point = [number,number,number];
export interface Vehicle {
    id:string; edge:string; s:number; length:number; mass:number;
    powered?:boolean; helper?:boolean; name?:string; heavy?:boolean; destination?:string;
}
export interface Track {
    id:string; a:string; b:string; points?:Point[]; limit:number; adhesion?:number;
    tangentStart?:[number,number]; tangentEnd?:[number,number];
    restrictions?:{from:number;to:number;limit:number}[];
    closedFrom?:number; catchFrom?:number;
    tunnel?:{from:number;name:string};
    bridge?:{name:string;maxMass:number;maxLoads:number;pairs:[string,string][]};
}
export interface Zone {id:string;name:string;edge:string;from:number;to:number;color?:string}
interface TaskBase {id:string;text:string;after?:string;dwell?:number;milestone?:boolean}
export type Task = TaskBase & (
    {type:'stop';zone:string;independent?:boolean} |
    {type:'coupled';cars:string[]} |
    {type:'traffic';traffic:string} |
    {type:'crew';zone:string} |
    {type:'position'|'delivery'|'retire'|'ferry'|'park';zone:string;cars:string[];exclude?:string[];order?:string[]} |
    {type:'rescue';zone:string;alternative:string;cars:string[]}
);
export interface RailConfig {
    thermal:boolean; scenery:string; weather?:'rain'|'snow'; tractive?:number;
    helper?:{tractive:number;workingPull?:number;pullGrace?:number;compressionGrace?:number};
    couplerLimit?:number; compressionLimit?:number;
    nodes:Record<string,Point>; tracks:Track[];
    switches:{node:string;label:string;stem:string;branches:string[];names:string[]}[];
    groups:{cars:Vehicle[];secured?:boolean;brake?:number;speed?:number}[];
    zones:Zone[]; tasks:Task[];
    traffic?:{id:string;name:string;speed:number;route:[string,1|-1][];head:number;length:number}[];
    terrain?:{interval:number;heights:Point[]};
    river?:[number,number][];
    ferry?:{decks:string[];start:number;maxDifference:number};
    floods?:{name:string;edge:string;from:number;to:number;at:number}[];
    cargo?:{cars:string[];overhang:number;width:number;clearanceWagons?:string[]};
    obstacles?:{name:string;x:number;y:number;w:number;h:number}[];
}
