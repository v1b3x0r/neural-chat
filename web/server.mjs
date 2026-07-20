// Zero-dependency production server: serves the built web/dist and proxies /api/qwen/v1/* to Qwen Cloud
// (Alibaba Cloud Model Studio / DashScope) with the API key injected server-side. Pure Node (http + global
// fetch), so it runs on a tiny box with no npm install. Run: QWEN_API_KEY=... node server.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const DIST = fileURLToPath(new URL('./dist', import.meta.url));
const DIST_PREFIX = DIST.endsWith(sep) ? DIST : DIST + sep; // trailing sep so a sibling like dist-secret/ can't match the prefix
const PORT = Number(process.env.PORT) || 80;
const KEY = process.env.QWEN_API_KEY || '';
const UPSTREAM = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

// Proxy rules — canonical source is web/src/lib/qwenproxy.ts (unit-tested); mirrored here for the standalone server.
const ALLOWED = { '/models': 'GET', '/chat/completions': 'POST', '/embeddings': 'POST' };
const allowPath = (method, path) => ALLOWED[path] === method;
function shapeBody(path, body) {
  const b = body ?? {};
  const model = String(b.model ?? '');
  if (path === '/chat/completions') {
    if (!/^qwen/i.test(model)) return null;
    return { ...b, max_tokens: Math.min(Number(b.max_tokens) || 2048, 2048), enable_thinking: false };
  }
  if (path === '/embeddings') {
    if (model !== 'text-embedding-v4') return null;
    return { ...b, dimensions: 768 };
  }
  return b;
}

const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.mjs': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
};

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = normalize(join(DIST, urlPath));
  if (filePath !== DIST && !filePath.startsWith(DIST_PREFIX)) { res.statusCode = 403; return res.end('forbidden'); }
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) throw new Error('is dir');
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.end(await readFile(filePath));
  } catch {
    // SPA fallback: unknown path → index.html
    const html = await readFile(join(DIST, 'index.html')).catch(() => null);
    if (html) { res.statusCode = 200; res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html); }
    else { res.statusCode = 404; res.end('not found'); }
  }
}

async function proxyQwen(req, res) {
  const path = (req.url || '').slice('/api/qwen/v1'.length).split('?')[0] || '';
  if (!KEY) { res.statusCode = 500; return res.end('QWEN_API_KEY missing on server'); }
  if (!allowPath(req.method, path)) { res.statusCode = 403; return res.end('blocked'); }
  let body;
  if (req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const shaped = shapeBody(path, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
    if (shaped === null) { res.statusCode = 403; return res.end('model not allowed'); }
    body = JSON.stringify(shaped);
  }
  const up = await fetch(`${UPSTREAM}${path}`, {
    method: req.method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    ...(body ? { body } : {}),
  });
  res.statusCode = up.status;
  res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
  if (up.body) Readable.fromWeb(up.body).pipe(res);
  else res.end();
}

createServer((req, res) => {
  const done = (err) => { if (!res.headersSent) res.statusCode = 502; res.end(err ? String(err) : undefined); };
  if ((req.url || '').startsWith('/api/qwen/v1')) proxyQwen(req, res).catch(done);
  else serveStatic(req, res).catch(() => { if (!res.headersSent) res.statusCode = 500; res.end('error'); });
}).listen(PORT, '0.0.0.0', () => console.log(`memory-engine serving dist + /api/qwen on :${PORT}`));
