import { describe, it, expect } from 'vitest';
import { assembleInject } from '../src/lib/labrespond';
import type { LabToggles } from '../src/lib/config';
import type { InjectionContext } from '@nature-labs/living-memory-engine';

const ctx: InjectionContext = {
  selfTier: [{ id: 's', statement: 'I am the city', kind: 'value', strength: 1, updatedAt: 0 }],
  episodic: [{ id: 'e', content: 'air is bad', embedding: null, importance: 5, strength: 0.5, createdAt: 0, lastRecalledAt: -1, tags: ['world'], crystallizeAt: 0, sourceMsgIds: [] }],
  prospective: [{ id: 'p', intent: 'ask about trip', status: 'pending', priority: 3, contextClue: '', createdAt: 0, clueEmbedding: null, strength: 0.6, lastTriggeredAt: -1 }],
  tail: [{ id: 'm', role: 'user', text: 'hi', ts: 0 }],
};
const ALL: LabToggles = { time: true, timePos: 'top', self: true, episodic: true, prospective: true, tail: true, selfState: true };

describe('assembleInject', () => {
  it('all-on includes time(top) + every tier + tail', () => {
    const { inject, tail } = assembleInject(ctx, ALL, 1000);
    expect(inject).toContain('[Current time:');
    expect(inject).toContain('[Who you are]');
    expect(inject).toContain('[Relevant memories]');
    expect(inject).toContain('[You are anticipating]');
    expect(tail).toHaveLength(1);
    expect(inject.indexOf('[Current time:')).toBeLessThan(inject.indexOf('[Who you are]'));
  });

  it('toggling off a tier removes it; tail off empties tail', () => {
    const { inject, tail } = assembleInject(ctx, { ...ALL, episodic: false, prospective: false, tail: false }, 1000);
    expect(inject).toContain('[Who you are]');
    expect(inject).not.toContain('[Relevant memories]');
    expect(inject).not.toContain('[You are anticipating]');
    expect(tail).toHaveLength(0);
  });

  it('time at end becomes a stronger directive after the body', () => {
    const { inject } = assembleInject(ctx, { ...ALL, timePos: 'end' }, 1000);
    expect(inject).toContain('do not guess');
    expect(inject.indexOf('[Who you are]')).toBeLessThan(inject.indexOf('It is now'));
  });

  it('time off omits time entirely', () => {
    const { inject } = assembleInject(ctx, { ...ALL, time: false }, 1000);
    expect(inject).not.toContain('Current time');
    expect(inject).not.toContain('It is now');
  });
});

const SELF_BLOCK = '[Self-state]\nสถานะตอนนี้: ออนไลน์';

describe('assembleInject — self-state block', () => {
  it('prepends the block at the very TOP when selfState on and block non-empty', () => {
    const { inject } = assembleInject(ctx, ALL, 1000, SELF_BLOCK);
    expect(inject.indexOf('[Self-state]')).toBe(0);
    expect(inject.indexOf('[Self-state]')).toBeLessThan(inject.indexOf('[Current time:'));
    expect(inject.indexOf('[Current time:')).toBeLessThan(inject.indexOf('[Who you are]'));
  });

  it('omits the block when selfState toggle is off (even if a block is passed)', () => {
    const { inject } = assembleInject(ctx, { ...ALL, selfState: false }, 1000, SELF_BLOCK);
    expect(inject).not.toContain('[Self-state]');
    expect(inject.indexOf('[Current time:')).toBe(0);
  });

  it('omits the block when the block string is empty', () => {
    const { inject } = assembleInject(ctx, ALL, 1000, '');
    expect(inject).not.toContain('[Self-state]');
  });

  it('3-arg call is unchanged (selfStateBlock defaults to "")', () => {
    const { inject } = assembleInject(ctx, ALL, 1000);
    expect(inject).not.toContain('[Self-state]');
    expect(inject.indexOf('[Current time:')).toBe(0);
  });
});
