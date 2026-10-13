'use strict';
// Small local development server. No dependencies and no directory listing.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function createServer({ root = ROOT } = {}) {
    root = path.resolve(root);
    return http.createServer(async (req, res) => {
        const reply = (code, message) => {
            res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(message);
        };
        if (!['GET', 'HEAD'].includes(req.method)) {
            res.setHeader('Allow', 'GET, HEAD');
            reply(405, 'Method not allowed');
            return;
        }
        let relative;
        try {
            relative = decodeURIComponent((req.url || '/').split('?')[0]);
            if (relative.includes('\0') || relative.includes('\\'))
                throw new Error('Invalid path');
        }
        catch {
            reply(400, 'Invalid path');
            return;
        }
        if (relative.split('/').some(part => part.startsWith('.'))) {
            reply(403, 'Private path');
            return;
        }
        if (relative.endsWith('/'))
            relative += 'index.html';
        const file = path.resolve(root, '.' + relative);
        if (!file.startsWith(root + path.sep) || !TYPES[path.extname(file)]) {
            reply(404, 'Not found');
            return;
        }
        try {
            const real = await fs.realpath(file);
            if (!real.startsWith(root + path.sep)) {
                reply(403, 'Path leaves project');
                return;
            }
            const bytes = await fs.readFile(real);
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(req.method === 'HEAD' ? undefined : bytes);
        }
        catch (err) {
            if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(err.code))
                reply(404, 'Not found');
            else {
                console.error('Asset error:', err.message);
                reply(500, 'Could not read asset');
            }
        }
    });
}
if (require.main === module) {
    const port = Number(process.env.PORT || 8080), host = process.env.HOST || '127.0.0.1';
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('PORT must be an integer from 1 to 65535.');
        process.exit(1);
    }
    const server = createServer();
    server.on('error', err => {
        console.error(`Server failed: ${err.message}`);
        process.exitCode = 1;
    });
    server.listen(port, host, () => console.log(`DEAD SLOW: http://${host}:${port}\nSingle-file build: http://${host}:${port}/dist/\nPress Ctrl+C to stop.`));
    for (const signal of ['SIGINT', 'SIGTERM'])
        process.on(signal, () => server.close());
}
module.exports = { createServer };
