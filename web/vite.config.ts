import { defineConfig, type Plugin } from 'vitest/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

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

// The engine ships prebuilt ESM dist via its exports map; excluding it from
// pre-bundling avoids esbuild choking on the linked file: package.
// happy-dom gives the unit tests localStorage + DOM (fake-indexeddb covers IndexedDB).
export default defineConfig({
  plugins: [devlogSink()],
  optimizeDeps: { exclude: ['@nature-labs/living-memory-engine'] },
  test: { environment: 'happy-dom' },
});
