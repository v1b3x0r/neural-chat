import { describe, it, expect } from 'vitest';
import { fixedK, randomK, gamble } from '../src/policy.js';
import { SeededRandom } from '../src/random.js';

const ev = (recurrence: number, avgImportance = 8) =>
  ({ key: 'k', recurrence, avgImportance, spanDays: 2, memberIds: [] });

describe('fixedK', () => {
  it('crystallizes at or above k', () => {
    const p = fixedK(3); const r = new SeededRandom(1);
    expect(p.shouldCrystallize(ev(2), r)).toBe(false);
    expect(p.shouldCrystallize(ev(3), r)).toBe(true);
  });
});

describe('randomK', () => {
  const decide = (seed: number, rec: number) =>
    randomK(3, 7).shouldCrystallize(ev(rec), new SeededRandom(seed));
  it('never below min, always at/above max', () => {
    expect(decide(99, 2)).toBe(false);
    expect(decide(99, 7)).toBe(true);
  });
  it('is reproducible for a seed', () => {
    expect(decide(5, 5)).toBe(decide(5, 5));
  });
});

describe('gamble', () => {
  it('is reproducible for a seed', () => {
    const a = gamble(0.5).shouldCrystallize(ev(1, 10), new SeededRandom(7));
    const b = gamble(0.5).shouldCrystallize(ev(1, 10), new SeededRandom(7));
    expect(a).toBe(b);
  });
});
