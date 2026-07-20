import { describe, it, expect } from 'vitest';
import { AMBIENT } from '../src/lib/config';
import {
  llmKind, classifyEmbeddings, classifyWorldFeed, isMemoryOld, fmtAge, DAY_MS, formatSelfState,
} from '../src/lib/selfstate';
import type { SelfState } from '../src/lib/selfstate';

const NOW = 1_000_000_000;

describe('llmKind', () => {
  it('local for localhost', () => expect(llmKind('http://localhost:11434/v1')).toBe('local'));
  it('local for 127.0.0.1', () => expect(llmKind('http://127.0.0.1:11434/v1')).toBe('local'));
  it('local for ::1', () => expect(llmKind('http://[::1]:11434/v1')).toBe('local'));
  it('remote for public https', () => expect(llmKind('https://api.openai.com/v1')).toBe('remote'));
  it('remote for unparseable (conservative)', () => expect(llmKind('')).toBe('remote'));
});

describe('classifyEmbeddings', () => {
  it('ready for a non-null vector', () => expect(classifyEmbeddings([0.1, 0.2])).toBe('ready'));
  it('degraded when latest embedding is null', () => expect(classifyEmbeddings(null)).toBe('degraded'));
  it('unavailable when no episodic at all', () => expect(classifyEmbeddings(undefined)).toBe('unavailable'));
});

describe('classifyWorldFeed', () => {
  it('fresh below boundary', () => expect(classifyWorldFeed(NOW - (AMBIENT.ambientRefreshMs - 1), NOW)).toBe('fresh'));
  it('fresh exactly at boundary', () => expect(classifyWorldFeed(NOW - AMBIENT.ambientRefreshMs, NOW)).toBe('fresh'));
  it('stale above boundary', () => expect(classifyWorldFeed(NOW - (AMBIENT.ambientRefreshMs + 1), NOW)).toBe('stale'));
  it('unavailable when null', () => expect(classifyWorldFeed(null, NOW)).toBe('unavailable'));
});

describe('isMemoryOld', () => {
  it('false when null (newborn)', () => expect(isMemoryOld(null)).toBe(false));
  it('false at one day boundary', () => expect(isMemoryOld(DAY_MS - 1)).toBe(false));
  it('true past one day', () => expect(isMemoryOld(DAY_MS + 1)).toBe(true));
});

describe('fmtAge', () => {
  it('null sentinel', () => expect(fmtAge(null)).toBe('none'));
  it('minutes bucket', () => expect(fmtAge(12 * 60_000)).toBe('12 min'));
  it('hours bucket', () => expect(fmtAge(3 * 60 * 60_000)).toBe('3 hr'));
  it('days bucket', () => expect(fmtAge(2 * DAY_MS)).toBe('2 days'));
  it('floors negative at 0', () => expect(fmtAge(-5)).toBe('0 min'));
});

const NOMINAL: SelfState = {
  online: true, llm: 'local', embeddings: 'ready',
  worldFeed: 'fresh', worldFeedAgeMs: 12 * 60_000, memoryAgeMs: 3 * 60 * 60_000,
};

describe('formatSelfState', () => {
  it('always shows all 5 facts labels', () => {
    const b = formatSelfState(NOMINAL);
    for (const cue of ['online', 'thinking on a local model', 'semantic memory ready', 'live surroundings feed', 'last memory']) {
      expect(b).toContain(cue);
    }
    expect(b.startsWith('[Self-state]')).toBe(true);
  });

  it('renders feed + memory ages via fmtAge', () => {
    const b = formatSelfState(NOMINAL);
    expect(b).toContain('updated ~12 min ago');
    expect(b).toContain('last memory ~3 hr ago');
  });

  it('stale feed renders hours, never the broken "hr min"', () => {
    const b = formatSelfState({ ...NOMINAL, worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 });
    expect(b).toContain('surroundings feed is stale (updated ~3 hr ago)');
    expect(b).not.toContain('hr min');
  });

  it('nominal → no directive line', () => {
    expect(formatSelfState(NOMINAL)).not.toContain('(adjust stance:');
  });

  it('remote llm alone is nominal — no stance change vs local', () => {
    expect(formatSelfState({ ...NOMINAL, llm: 'remote' })).not.toContain('(adjust stance:');
  });

  it('null memory age (newborn) is facts-only, not off-nominal', () => {
    const b = formatSelfState({ ...NOMINAL, memoryAgeMs: null });
    expect(b).toContain('no memories yet');
    expect(b).not.toContain('(adjust stance:');
  });

  it.each([
    ['offline',             { online: false },                                  'thinking alone on-device'],
    ['degraded embeddings', { embeddings: 'degraded' },                         'do not insist you remember it exactly'],
    ['no embeddings',       { embeddings: 'unavailable' },                      'recalling something old'],
    ['stale feed',          { worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 }, 'see it live'],
    ['no feed',             { worldFeed: 'unavailable', worldFeedAgeMs: null }, 'do not invent weather'],
    ['old memory',          { memoryAgeMs: DAY_MS + 1 },                        'still current'],
  ] as [string, Partial<SelfState>, string][])('off-nominal %s → directive present + its cue', (_name, patch, cue) => {
    const b = formatSelfState({ ...NOMINAL, ...patch });
    expect(b).toContain('(adjust stance:');
    expect(b).toContain(cue);
  });

  it('multiple off-nominal signals share one directive line', () => {
    const b = formatSelfState({ ...NOMINAL, online: false, embeddings: 'degraded' });
    expect(b).toContain('thinking alone on-device');
    expect(b).toContain('do not insist you remember it exactly');
    expect(b.match(/\(adjust stance:/g)).toHaveLength(1);
  });

  it('newborn: feed+embeddings clauses fire, memory clause does NOT', () => {
    const NEWBORN: SelfState = {
      online: true, llm: 'local', embeddings: 'unavailable',
      worldFeed: 'unavailable', worldFeedAgeMs: null, memoryAgeMs: null,
    };
    const b = formatSelfState(NEWBORN);
    expect(b).toContain('no semantic memory yet');
    expect(b).toContain('no surroundings feed');
    expect(b).toContain('no memories yet');
    expect(b).toContain('(adjust stance:');
    expect(b).toContain('do not invent weather');
    expect(b).toContain('recalling something old');
    expect(b).not.toContain('still current');
  });
});
