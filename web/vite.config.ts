import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { QWEN_UPSTREAM_DEFAULT, allowPath, shapeBody } from './src/lib/qwenproxy';

// Dev-only sink for lib/devlog.ts: appends each POSTed JSON record (one line) to web/.debug/dev.log
// so runtime data (the real prompt fed to the LLM, ambient observations) is readable straight off disk.
function devlogSink(): Plugin {
  const file = fileURLToPath(new URL('.debug/dev.log', import.meta.url));
  return {
    name: 'devlog-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__devlog', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return void res.end(); }
        let body = '';
        req.on('data', c => (body += c));
        req.on('end', async () => {
          try { await mkdir(dirname(file), { recursive: true }); await appendFile(file, body + '\n'); } catch { /* never break dev over a log write */ }
          res.statusCode = 204; res.end();
        });
      });
    },
  };
}

// Dev-only proxy: browser → /api/qwen/v1/* → DashScope intl, with the key injected
// server-side from web/.env.local (QWEN_API_KEY — deliberately NOT VITE_-prefixed).
function qwenProxy(env: Record<string, string>): Plugin {
  const upstream = env.QWEN_BASE_URL || QWEN_UPSTREAM_DEFAULT;
  const key = env.QWEN_API_KEY || '';
  return {
    name: 'qwen-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/qwen/v1', (req, res) => {
        void (async () => {
          const path = (req.url ?? '').split('?')[0] ?? '';
          if (!key) { res.statusCode = 500; return void res.end('QWEN_API_KEY missing in web/.env.local'); }
          if (!allowPath(req.method ?? '', path)) { res.statusCode = 403; return void res.end('blocked'); }
          let body: string | undefined;
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const c of req) chunks.push(c as Buffer);
            const shaped = shapeBody(path, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
            if (shaped === null) { res.statusCode = 403; return void res.end('model not allowed'); }
            body = JSON.stringify(shaped);
          }
          const up = await fetch(`${upstream}${path}`, {
            method: req.method ?? 'GET',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            ...(body ? { body } : {}),
          });
          res.statusCode = up.status;
          res.setHeader('Content-Type', up.headers.get('content-type') ?? 'application/json');
          if (!up.body) return void res.end();
          for await (const chunk of up.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
          res.end();
        })().catch(err => { res.statusCode = 502; res.end(String(err)); });
      });
    },
  };
}

// The engine ships prebuilt ESM dist via its exports map; excluding it from
// pre-bundling avoids esbuild choking on the linked file: package.
// happy-dom gives the unit tests localStorage + DOM (fake-indexeddb covers IndexedDB).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname(fileURLToPath(import.meta.url)), '');
  return {
    plugins: [devlogSink(), qwenProxy(env)],
    optimizeDeps: { exclude: ['@nature-labs/living-memory-engine'] },
    test: { environment: 'happy-dom' },
  };
});
