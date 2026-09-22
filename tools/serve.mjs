import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (!fs.existsSync(path.join(root, 'index.html')))
    await import('./build.mjs');
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
http.createServer((req, res) => { try {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
}
catch {
    res.writeHead(400);
    res.end('Invalid request');
} }).listen(port, '0.0.0.0', () => console.log(`SkiJumpWeb: http://localhost:${port} (WebGPU needs localhost or HTTPS; WebGL2 works elsewhere).`));
