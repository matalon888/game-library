// @ts-check
(function (/** @type {typeof globalThis} */ root) {
    'use strict';
    /** @typedef {import('./contracts.js').Level} Level */
    /** @template Run @typedef {import('./contracts.js').Adapter<Run>} Adapter */
    /** Explicit registration keeps the shell independent of the next campaign's state shape.
     * @template Run @param {Adapter<Run>[]} adapters */
    function registry(adapters) {
        const entries = new Map(adapters.map(adapter => [adapter.id, adapter]));
        if (entries.size !== adapters.length) throw Error('Duplicate simulation registration.');
        return Object.freeze({
            /** @param {Level} level */
            forLevel(level) {
                const id = level.simulation || (level.rail?'rail':level.rampage?'rolling':level.space?'space':'marine');
                const adapter = entries.get(id);
                if (!adapter) throw Error('Unregistered simulation: '+id);
                return adapter;
            }
        });
    }
    const api = Object.freeze({registry});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.DeadSlowSimulations = api;
})(globalThis);
