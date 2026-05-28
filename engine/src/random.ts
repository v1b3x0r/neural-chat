import type { Random } from './ports.js';

// mulberry32 — small, fast, deterministic PRNG
export class SeededRandom implements Random {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }

  float(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(this.float() * span);
  }
}
