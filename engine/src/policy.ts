import type { CrystallizePolicy } from './ports.js';

export function fixedK(k: number): CrystallizePolicy {
  return { shouldCrystallize: (e) => e.recurrence >= k };
}

export function randomK(min: number, max: number): CrystallizePolicy {
  return { shouldCrystallize: (e, rng) => e.recurrence >= rng.int(min, max) };
}

export function gamble(baseP: number): CrystallizePolicy {
  return {
    shouldCrystallize: (e, rng) => rng.float() < baseP * (e.avgImportance / 10),
  };
}
