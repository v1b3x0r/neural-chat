import { describe, it, expect } from 'vitest';
import { AMBIENT } from '../src/lib/config';
import {
  llmKind, classifyEmbeddings, classifyWorldFeed, isMemoryOld, fmtAge, DAY_MS,
} from '../src/lib/selfstate';

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
