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
  it('null sentinel', () => expect(fmtAge(null)).toBe('ยังไม่มี'));
  it('minutes bucket', () => expect(fmtAge(12 * 60_000)).toBe('12 นาที'));
  it('hours bucket', () => expect(fmtAge(3 * 60 * 60_000)).toBe('3 ชั่วโมง'));
  it('days bucket', () => expect(fmtAge(2 * DAY_MS)).toBe('2 วัน'));
  it('floors negative at 0', () => expect(fmtAge(-5)).toBe('0 นาที'));
});

const NOMINAL: SelfState = {
  online: true, llm: 'local', embeddings: 'ready',
  worldFeed: 'fresh', worldFeedAgeMs: 12 * 60_000, memoryAgeMs: 3 * 60 * 60_000,
};

describe('formatSelfState', () => {
  it('always shows all 5 facts labels', () => {
    const b = formatSelfState(NOMINAL);
    for (const cue of ['ออนไลน์', 'คิดด้วยสมองในเครื่อง', 'ความจำเชิงความหมายพร้อม', 'ข่าวสภาพแวดล้อมสด', 'ความทรงจำล่าสุด']) {
      expect(b).toContain(cue);
    }
    expect(b.startsWith('[Self-state]')).toBe(true);
  });

  it('renders feed + memory ages via fmtAge', () => {
    const b = formatSelfState(NOMINAL);
    expect(b).toContain('อัปเดต ~12 นาทีก่อน');
    expect(b).toContain('ความทรงจำล่าสุด ~3 ชั่วโมงก่อน');
  });

  it('stale feed renders hours, never the broken "ชั่วโมง นาที"', () => {
    const b = formatSelfState({ ...NOMINAL, worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 });
    expect(b).toContain('ข่าวสภาพแวดล้อมเก่า (อัปเดต ~3 ชั่วโมงก่อน)');
    expect(b).not.toContain('ชั่วโมง นาที');
  });

  it('nominal → no directive line', () => {
    expect(formatSelfState(NOMINAL)).not.toContain('(ปรับท่าที:');
  });

  it('null memory age (newborn) is facts-only, not off-nominal', () => {
    const b = formatSelfState({ ...NOMINAL, memoryAgeMs: null });
    expect(b).toContain('ยังไม่มีความทรงจำ');
    expect(b).not.toContain('(ปรับท่าที:');
  });

  it.each([
    ['offline',             { online: false },                                  'คิดอยู่ลำพังในเครื่อง'],
    ['remote llm',          { llm: 'remote' },                                  'ความเป็นส่วนตัว'],
    ['degraded embeddings', { embeddings: 'degraded' },                         'อย่าฟันธงว่าจำได้เป๊ะ'],
    ['no embeddings',       { embeddings: 'unavailable' },                      'อย่าทำเหมือนนึกเรื่องเก่าออก'],
    ['stale feed',          { worldFeed: 'stale', worldFeedAgeMs: 3 * 60 * 60_000 }, 'อย่าพูดเหมือนเห็นสดๆ'],
    ['no feed',             { worldFeed: 'unavailable', worldFeedAgeMs: null }, 'อย่าแต่งสภาพอากาศ'],
    ['old memory',          { memoryAgeMs: DAY_MS + 1 },                        'อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน'],
  ] as [string, Partial<SelfState>, string][])('off-nominal %s → directive present + its cue', (_name, patch, cue) => {
    const b = formatSelfState({ ...NOMINAL, ...patch });
    expect(b).toContain('(ปรับท่าที:');
    expect(b).toContain(cue);
  });

  it('multiple off-nominal signals share one directive line', () => {
    const b = formatSelfState({ ...NOMINAL, online: false, embeddings: 'degraded' });
    expect(b).toContain('คิดอยู่ลำพังในเครื่อง');
    expect(b).toContain('อย่าฟันธงว่าจำได้เป๊ะ');
    expect(b.match(/\(ปรับท่าที:/g)).toHaveLength(1);
  });

  it('newborn: feed+embeddings clauses fire, memory clause does NOT', () => {
    const NEWBORN: SelfState = {
      online: true, llm: 'local', embeddings: 'unavailable',
      worldFeed: 'unavailable', worldFeedAgeMs: null, memoryAgeMs: null,
    };
    const b = formatSelfState(NEWBORN);
    expect(b).toContain('ยังไม่มีความจำเชิงความหมาย');
    expect(b).toContain('ไม่มีข่าวสภาพแวดล้อม');
    expect(b).toContain('ยังไม่มีความทรงจำ');
    expect(b).toContain('(ปรับท่าที:');
    expect(b).toContain('อย่าแต่งสภาพอากาศ');
    expect(b).toContain('อย่าทำเหมือนนึกเรื่องเก่าออก');
    expect(b).not.toContain('อย่าทึกทักว่าเรื่องในความจำยังเป็นปัจจุบัน');
  });
});
