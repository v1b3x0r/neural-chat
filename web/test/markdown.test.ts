import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/lib/markdown';

describe('renderMarkdown', () => {
  it('renders bold and italic', () => {
    expect(renderMarkdown('you like it **hot** and *milky*'))
      .toBe('you like it <strong>hot</strong> and <em>milky</em>');
  });

  it('renders inline code and fenced code blocks (content escaped, whitespace kept)', () => {
    expect(renderMarkdown('run `npm test` now')).toContain('<code class="md-code">npm test</code>');
    const out = renderMarkdown('```js\nconst x = 1 < 2;\n```');
    expect(out).toContain('<pre class="md-pre"><code>const x = 1 &lt; 2;</code></pre>');
  });

  it('is XSS-safe: never emits raw HTML/script from the model', () => {
    const out = renderMarkdown('<img src=x onerror=alert(1)> and <script>alert(2)</script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('only allows http(s) links; leaves javascript: as plain text', () => {
    expect(renderMarkdown('[site](https://example.com)'))
      .toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>');
    const bad = renderMarkdown('[x](javascript:alert(1))');
    expect(bad).not.toContain('<a ');
    expect(bad).toContain('[x]');
  });

  it('leaves plain text and unmatched markers untouched', () => {
    expect(renderMarkdown('just a normal reply, 2 * 3 = 6')).toBe('just a normal reply, 2 * 3 = 6');
  });

  it('a quote in a link URL cannot break out of the href attribute', () => {
    const out = renderMarkdown('[x](https://e.com"onmouseover="alert(1))');
    // the injected quote is escaped to &quot; inside the attribute — it stays inert, no real onmouseover attribute
    expect(out).not.toMatch(/"\s*onmouseover=/);
    expect(out).toContain('&quot;onmouseover=&quot;');
  });
});
