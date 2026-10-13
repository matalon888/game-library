'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { bundle } = require('./build.cjs');
const root = path.resolve(__dirname, '..');
if(fs.readFileSync(path.join(root,'src/rail-scenery.js'),'utf8')!==require('./build-rail-scenery.cjs').source(root))
    throw new Error('Railway scenery is stale. Run npm run build and commit src/rail-scenery.js.');
const {validateRail}=require('./validate-rail.cjs');
for(const level of require('../src/rail-levels.js'))validateRail(level.rail,level.id);
let total = 0;
for (const directory of ['src', 'tools', 'tests']) {
    for (const file of fs.readdirSync(path.join(root, directory))) {
        if (!/\.(?:c?js)$/.test(file))
            continue;
        const result = spawnSync(process.execPath, ['--check', path.join(root, directory, file)], { stdio: 'inherit' });
        if (result.status !== 0)
            process.exit(result.status || 1);
        total++;
    }
}
const a = bundle(), b = bundle();
if (a !== b)
    throw new Error('Build is not deterministic.');
console.log(`${total} JavaScript files parse; the offline build is reproducible.`);
