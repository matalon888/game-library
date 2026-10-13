export type Name = 'power'|'helper'|'brake'|'independent'|'stop'|'reverse'|'switch'|'select'|'hand'|'uncouple'|'couple'|'dispatch';
export interface Link {after:string;before:string}
export type Value = number|string|Link|undefined;
export type Command = ['power'|'helper'|'brake'|'independent',number]|['switch'|'select',string]|['uncouple',string|Link]|['dispatch',string?]|['stop'|'reverse'|'hand'|'couple'];
export interface Definition {kind:'notch'|'fraction'|'id'|'link'|'optional-id'|'none';cue?:string}
export interface Level {id:string;simulation?:string;rail?:unknown;rampage?:unknown;space?:unknown}
export interface Adapter<Run> {
    id:string;
    create(level:Level):Partial<Run>;
    step(run:Run,dt:number):void;
    ready(run:Run):boolean;
    clean(run:Run):boolean;
}

export interface Focus { x:number; y:number; a:number }
export interface RailState {
    time:number;
    stats: {contacts:number; distance:number; [name:string]:number};
    config: {tasks: {id:string;text:string;milestone?:boolean}[]};
    completed:string[];
    failure:string|null;
    finishHold:number;
}
export interface RailRun {
    splits:{name:string;time:number}[];
    rail:RailState;
    time:number;
    contacts:number;
    distance:number;
    maxSpeed:number;
    throttleOrders:number;
    sampleAt:number;
    ghost:number[][];
    focus:Focus;
}
// Ports describe only what the adapter needs. Physics objects stay inside the engine.
export interface RailwayPort {
    create(level:Level):RailState;
    update(state:RailState,dt:number):void;
    command(state:RailState,name:Name,value?:Value):boolean;
    drivingEngine(state:RailState):{q:number;v:number};
    engineGroup(state:RailState):{brake:number};
    locate(state:RailState,group:{brake:number},q:number):Focus;
    commands:{definitions:Readonly<Record<Name,Definition>>};
}
export type Format = (time:number)=>string;
export interface RailViewPort {
    key(event:KeyboardEvent,state:RailState):boolean;
    prepare(level:Level,command:(name:Name,value?:Value)=>unknown):void;
    update(level:Level,run:RailRun,status:string,format:Format,race?:unknown):void;
    render(canvas:HTMLCanvasElement,level:Level,run:RailRun,zoom:number):void;
    dialog(kind:string,level:Level,run:RailRun,format:Format,hasNext?:boolean,race?:unknown,completionActions?:string):string;
}
export interface RailAdapter extends Adapter<RailRun> {
    command(run:RailRun,name:Name,value?:Value):boolean;
    key(event:KeyboardEvent,run:RailRun):boolean;
    prepare:RailViewPort['prepare'];
    update:RailViewPort['update'];
    render:RailViewPort['render'];
    dialog:RailViewPort['dialog'];
    result(run:RailRun):{rail:RailState['stats']};
}
export interface RailServices {
    railway:RailwayPort;
    audio:{railEvent(cue:string):void;horn():void};
    view:RailViewPort;
    finish():void;
    fail():void;
}

export type PolarAction = 'tow'|'target'|'fire'|'ping'|'identify'|'team'|'ascend'|'descend'|'depth'|'rendezvous';
export interface PolarInput {rudder:number;thruster:number;winch?:number}
export interface PolarState {
    submarine?:boolean;
    level:Level;
    contacts:number;
    fleet:{ship:{hull:number}}[];
    failure:string|null;
    complete:boolean;
    stats:Record<string,number>;
}
export interface PolarRun {
    polar:PolarState;ship:{hull:number};time?:number;contacts?:number;
    finalJourney?:{subState:PolarState;watch:{handoffAt:number|null}};
}
export interface PolarPort {
    create(level:Level):PolarRun;
    step(level:Level,run:PolarRun,input:PolarInput,dt:number):void;
    ready(run:PolarRun):boolean;
    command(run:PolarRun,id:string,order:'hold'|'proceed'):boolean;
    action(run:PolarRun,name:PolarAction,value?:string):boolean;
}
export interface PolarViewPort {
    update(level:Level,run:PolarRun,status:string,format:Format,race?:unknown):void;
    render(canvas:HTMLCanvasElement,level:Level,run:PolarRun,zoom:number,options?:unknown):void;
    dialog(kind:string,level:Level,run:PolarRun,format:Format,hasNext?:boolean,race?:unknown,actions?:string):string;
}
export interface PolarAdapter extends Adapter<PolarRun> {
    command:PolarPort['command'];
    action:PolarPort['action'];
    key(event:KeyboardEvent,run:PolarRun):boolean;
    update:PolarViewPort['update'];
    render:PolarViewPort['render'];
    dialog:PolarViewPort['dialog'];
    result(run:PolarRun):{polar:Record<string,number>};
}
export interface PolarServices {
    polar:PolarPort;
    view:PolarViewPort;
    input:PolarInput;
    finish():void;
    fail():void;
}
