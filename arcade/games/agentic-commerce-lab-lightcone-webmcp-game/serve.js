/* LIGHTCONE · dev server — zero-dependency static file server on Bun.
   Usage: bun run start   (PORT env var overrides the default 4517) */
import { join, normalize } from 'node:path';

const ROOT = import.meta.dir;
const PORT = Number(process.env.PORT) || 4517;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    // Resolve inside ROOT only — refuse anything that escapes it.
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(file, {
      headers: { 'Cache-Control': 'no-cache' },
    });
  },
});

console.log(`LIGHTCONE running at http://localhost:${server.port}`);
