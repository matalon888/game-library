'use strict';
// Deliberately no bundler dependency: the browser modules also run from source.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function readAsset(root, file) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(file))
        throw new Error(`Invalid local asset: ${file}`);
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep))
        throw new Error(`Asset leaves the project: ${file}`);
    return fs.readFileSync(absolute, 'utf8');
}
function bundle(root = ROOT) {
    root = path.resolve(root);
    let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    let sheets = 0;
    const scripts = new Set();
    html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?\s*>/g, (_, file) => {
        sheets++;
        return '<style>\n' + readAsset(root, file) + '\n</style>';
    });
    html = html.replace(/<script\s+src="([^"]+)"\s*>\s*<\/script>/g, (_, file) => {
        if (scripts.has(file)) throw new Error(`Duplicate source module: ${file}`);
        scripts.add(file);
        return '<script>\n' + readAsset(root, file).replace(/<\/script/gi, '<\\/script') + '\n</script>';
    });
    if (sheets !== 1 || [...scripts].at(-1) !== 'src/game.js')
        throw new Error('Expected one stylesheet and the game entry point as the last module.');
    if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["']stylesheet/i.test(html))
        throw new Error('Build still has external code assets.');
    return html;
}
function build(root = ROOT) {
    require('./build-rail-scenery.cjs').write(root);
    const html = bundle(root);
    const dist = path.join(root, 'dist');
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(dist, 'index.html'), html);
    fs.writeFileSync(path.join(dist, '.nojekyll'), '');
    return html;
}
if (require.main === module) {
    const html = build();
    console.log(`Built dist/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB); no external assets.`);
}
module.exports = { bundle, build };
