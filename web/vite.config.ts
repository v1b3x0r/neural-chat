/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// The engine ships prebuilt ESM dist via its exports map; excluding it from
// pre-bundling avoids esbuild choking on the linked file: package.
// happy-dom gives the unit tests localStorage + DOM (fake-indexeddb covers IndexedDB).
export default defineConfig({
  optimizeDeps: { exclude: ['@nature-labs/living-memory-engine'] },
  test: { environment: 'happy-dom' },
});
