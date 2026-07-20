// Minimal, XSS-safe markdown → HTML for chat bubbles. Zero-dependency (the app's discipline).
// Strategy: escape ALL HTML first, then add back ONLY a known-safe set of tags (pre/code/strong/em/a).
// Raw HTML from the model is never interpreted, and link hrefs are restricted to http(s).

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, c => ESC[c]!);

export function renderMarkdown(src: string): string {
  const blocks: string[] = [];
  // 1) fenced code blocks ```lang\n...``` — pull out first, escape their content, whitespace preserved.
  //    Sentinel uses \x00 (never present in model output, never touched by escapeHtml).
  let s = src.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_m, code: string) => {
    blocks.push(`<pre class="md-pre"><code>${escapeHtml(code.replace(/\n+$/, ''))}</code></pre>`);
    return `\x00${blocks.length - 1}\x00`;
  });
  // 2) escape everything else (the model's text is now inert)
  s = escapeHtml(s);
  // 3) inline code `...`
  s = s.replace(/`([^`\n]+)`/g, (_m, c: string) => `<code class="md-code">${c}</code>`);
  // 4) bold  **...** / __...__   (before italic, so ** isn't eaten as two *)
  s = s.replace(/\*\*(?!\s)([^\n*]+?)\*\*/g, '<strong>$1</strong>')
       .replace(/__(?!\s)([^\n_]+?)__/g, '<strong>$1</strong>');
  // 5) italic *...* / _..._
  s = s.replace(/(^|[^*\w])\*(?!\s)([^\n*]+?)\*(?!\w)/g, '$1<em>$2</em>')
       .replace(/(^|[^_\w])_(?!\s)([^\n_]+?)_(?!\w)/g, '$1<em>$2</em>');
  // 6) links [text](http...) — safe scheme only; text kept as-is (already escaped)
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, t: string, u: string) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  // 7) restore code blocks
  s = s.replace(/\x00(\d+)\x00/g, (_m, i: string) => blocks[+i]!);
  return s;
}
