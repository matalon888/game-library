/* Shared chart-edge geometry: open water is not an invisible collision wall. */
(function (root) {
    'use strict';
    const P = typeof module !== 'undefined' && module.exports ? require('./physics.js') : root.HarborPhysics;
    const SIDES = ['n', 'e', 's', 'w'];
    const NAMES = { n: 'north', e: 'east', s: 'south', w: 'west' };
    function coasts(level) {
        const [w, h] = level.world;
        const rectangles = {
            n: { x: 0, y: 0, w, h: 20 }, s: { x: 0, y: h - 20, w, h: 20 },
            w: { x: 0, y: 20, w: 20, h: h - 40 }, e: { x: w - 20, y: 20, w: 20, h: h - 40 }
        };
        return SIDES.filter(side => !level.openSides.includes(side)).map(side => ({
            ...rectangles[side], side, id: 'coast-' + side
        }));
    }
    function margins(level, body) {
        const hull = P.hull(body), [w, h] = level.world;
        return {
            n: Math.min(...hull.map(p => p.y)), s: h - Math.max(...hull.map(p => p.y)),
            w: Math.min(...hull.map(p => p.x)), e: w - Math.max(...hull.map(p => p.x))
        };
    }
    function exit(level, body) {
        const distances = margins(level, body);
        // Check the entire hull, including sideways drift. No clamping or bounce.
        return SIDES.find(side => distances[side] < 0) || null;
    }
    function warning(level, body, threshold = 30) {
        const distances = margins(level, body);
        const side = level.openSides.slice().sort((a, b) => distances[a] - distances[b])[0];
        return side && distances[side] < threshold ? { side, distance: Math.max(0, distances[side]) } : null;
    }
    const api = { SIDES, NAMES, coasts, margins, exit, warning };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HarborNavigation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
