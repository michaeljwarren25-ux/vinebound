// Zero-dependency static server for local development.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(root, '.' + path);
  if (!file.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

// If the port is taken (e.g. another copy is already running), try the next one.
let attemptsLeft = 10;
server.on('error', (err) => {
  const p = server.attemptedPort;
  if (err.code === 'EADDRINUSE' && attemptsLeft-- > 0) {
    console.log(`Port ${p} is busy, trying ${p + 1}...`);
    listen(p + 1);
  } else {
    console.error(`Could not start server: ${err.message}`);
    process.exit(1);
  }
});
server.on('listening', () => {
  console.log(`Vinebound running at http://localhost:${server.address().port}`);
});

function listen(p) {
  server.attemptedPort = p;
  server.listen(p);
}

listen(port);
