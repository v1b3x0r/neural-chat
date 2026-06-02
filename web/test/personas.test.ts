import { describe, it, expect, beforeEach } from 'vitest';
import { CHIANGMAI, listPersonas, addPersona, getActivePersona, setActivePersona, subscribeActivePersona } from '../src/lib/personas';

beforeEach(() => localStorage.clear());

describe('personas', () => {
  it('seeds เชียงใหม่ as the default ambient persona', () => {
    expect(listPersonas()[0]).toEqual(CHIANGMAI);
    expect(CHIANGMAI.ambient).toBe(true);
    expect(getActivePersona().id).toBe('chiangmai');
  });

  it('adds a non-ambient friend with isolated id', () => {
    const p = addPersona('หมอ', 'คุณคือหมอ');
    expect(p.id).toMatch(/^p_/);
    expect(p.ambient).toBeUndefined();
    expect(listPersonas().map(x => x.name)).toContain('หมอ');
  });

  it('notifies subscribers on active change, and stops after unsubscribe', () => {
    let hits = 0;
    const off = subscribeActivePersona(() => hits++);
    const p = addPersona('เพื่อน', '');
    setActivePersona(p.id);
    expect(hits).toBe(1);
    expect(getActivePersona().id).toBe(p.id);
    off();
    setActivePersona('chiangmai');
    expect(hits).toBe(1);
  });
});
