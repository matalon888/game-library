// @ts-check
(function (/** @type {typeof globalThis} */ root) {
    'use strict';
    /** @typedef {import('./contracts.js').Name} Name */
    /** @typedef {import('./contracts.js').Command} Command */
    /** @typedef {import('./contracts.js').Definition} Definition */
    /** @type {Readonly<Record<Name, Definition>>} */
    const definitions = Object.freeze({
        power: {kind:'notch'}, helper: {kind:'notch'},
        brake: {kind:'fraction'}, independent: {kind:'fraction'},
        stop: {kind:'none'}, reverse: {kind:'none',cue:'reverse'},
        switch: {kind:'id',cue:'switch'}, select: {kind:'id'},
        hand: {kind:'none',cue:'hand'}, uncouple: {kind:'link',cue:'uncouple'},
        couple: {kind:'none',cue:'couple'}, dispatch: {kind:'optional-id',cue:'horn'}
    });
    Object.values(definitions).forEach(Object.freeze);
    /** @param {unknown} value @returns {value is string} */
    const id = value => typeof value === 'string' && value.length > 0;
    /** Validate external payloads before touching simulation state. Queries may omit a lever value.
     * @param {string} name @param {unknown} value @param {boolean} [query] */
    function valid(name, value, query = false) {
        if (!Object.hasOwn(definitions, name)) return false;
        const spec = definitions[/** @type {Name} */(name)];
        switch (spec.kind) {
            case 'notch': return query && value === undefined || typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
            case 'fraction': return query && value === undefined || typeof value === 'number' && Number.isFinite(value);
            case 'id': return id(value);
            case 'optional-id': return value === undefined || id(value);
            case 'link': return id(value) || !!value && typeof value === 'object' && 'after' in value && 'before' in value && id(value.after) && id(value.before);
            case 'none': return value === undefined;
        }
    }
    /** @typedef {{name:Name,label:string,keys:string,min:number,max:number,step:number}} Lever */
    /** @param {boolean} helper @returns {Lever[]} */
    function levers(helper) {
        return [
            {name:'power',label:helper?'Front power':'Power',keys:'S / W',min:0,max:4,step:1},
            {name:'brake',label:'Train brake',keys:'A / D',min:0,max:1,step:.25},
            helper ? {name:'helper',label:'Rear assistance',keys:'Q / E',min:0,max:4,step:1}
                : {name:'independent',label:'Loco brake',keys:'Q / E',min:0,max:1,step:.25}
        ];
    }
    /** @param {string} code @param {{power:number,helper:number,brake:number,independent:number}} values
     * @param {boolean} helper @param {boolean} dispatch @returns {Command|null} */
    function keyboard(code, values, helper, dispatch) {
        /** @type {Record<string, Command>} */
        const keys = {
            KeyW:['power',values.power+1], KeyS:['power',values.power-1],
            KeyA:['brake',values.brake-.25], KeyD:['brake',values.brake+.25],
            KeyQ:helper?['helper',values.helper-1]:['independent',values.independent-.25],
            KeyE:helper?['helper',values.helper+1]:['independent',values.independent+.25],
            KeyX:['reverse'], KeyF:['couple'], KeyB:['hand'], Space:['stop']
        };
        if (dispatch) keys.KeyH = ['dispatch'];
        return keys[code] || null;
    }
    const api = Object.freeze({definitions, valid, levers, keyboard});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.RailCommands = api;
})(globalThis);
