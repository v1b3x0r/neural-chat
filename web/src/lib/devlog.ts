// Dev-only debug sink. POSTs one JSON record per call to the Vite dev middleware (/__devlog),
// which appends it to web/.debug/dev.log so the exact runtime data (e.g. the prompt actually fed
// to the LLM) can be read straight off disk while developing — faster than eyeballing the 🧠 pane.
// No-op in production builds (the middleware only exists under `vite dev`).
const isDev = (import.meta.env as { DEV?: boolean }).DEV ?? false;

export function devlog(tag: string, data: unknown): void {
  if (!isDev) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), tag, data });
  // fire-and-forget: never block a turn or surface a logging failure into the app
  void fetch('/__devlog', { method: 'POST', body: line }).catch(() => {});
}
