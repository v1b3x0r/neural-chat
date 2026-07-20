import { describe, it, expect } from 'vitest';
import { allowPath, shapeBody, QWEN_UPSTREAM_DEFAULT } from '../src/lib/qwenproxy';

describe('allowPath', () => {
  it('allows exactly the three OpenAI-compat routes with correct methods', () => {
    expect(allowPath('GET', '/models')).toBe(true);
    expect(allowPath('POST', '/chat/completions')).toBe(true);
    expect(allowPath('POST', '/embeddings')).toBe(true);
    expect(allowPath('POST', '/models')).toBe(false);
    expect(allowPath('GET', '/chat/completions')).toBe(false);
    expect(allowPath('POST', '/files')).toBe(false);
  });
});

describe('shapeBody', () => {
  it('chat: rejects non-qwen models', () => {
    expect(shapeBody('/chat/completions', { model: 'gpt-4o-mini' })).toBeNull();
  });
  it('chat: caps max_tokens at 2048 and disables thinking', () => {
    const b = shapeBody('/chat/completions', { model: 'qwen3.7-plus', max_tokens: 999999 })!;
    expect(b.max_tokens).toBe(2048);
    expect(b.enable_thinking).toBe(false);
  });
  it('chat: defaults max_tokens when absent', () => {
    expect(shapeBody('/chat/completions', { model: 'qwen3.6-flash' })!.max_tokens).toBe(2048);
  });
  it('embeddings: only text-embedding-v4, forces 768 dims', () => {
    expect(shapeBody('/embeddings', { model: 'nomic-embed-text' })).toBeNull();
    const b = shapeBody('/embeddings', { model: 'text-embedding-v4', input: 'x' })!;
    expect(b.dimensions).toBe(768);
  });
  it('exports the verified upstream default', () => {
    expect(QWEN_UPSTREAM_DEFAULT).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
  });
});
