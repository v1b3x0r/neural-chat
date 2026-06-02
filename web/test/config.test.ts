import { describe, it, expect, beforeEach } from 'vitest';
import { PROFILES, getActiveProfile, setActiveProfile, getChatCfg, getEmbedCfg, setKey, setChatModel } from '../src/lib/config';

beforeEach(() => localStorage.clear());

describe('config profiles', () => {
  it('defaults to the first profile (Local Ollama on this Mac)', () => {
    expect(getActiveProfile().id).toBe(PROFILES[0]!.id);
    expect(getActiveProfile().id).toBe('ollama');
  });

  it('switching profile changes resolved chat+embed cfg together', () => {
    setActiveProfile('openai');
    expect(getChatCfg().baseURL).toBe('https://api.openai.com/v1');
    expect(getEmbedCfg().model).toBe('text-embedding-3-small');
  });

  it('attaches the key only for profiles that need one', () => {
    setActiveProfile('ollama');
    expect(getChatCfg().apiKey).toBe('');     // local needs none
    setActiveProfile('openai');
    setKey('sk-test');
    expect(getChatCfg().apiKey).toBe('sk-test');
  });

  it('lets a picked model override the profile default (no hardcoded name wins)', () => {
    setActiveProfile('ollama');
    expect(getChatCfg().model).toBe('gemma4:e2b');   // profile fallback
    setChatModel('gemma3:12b');
    expect(getChatCfg().model).toBe('gemma3:12b');    // override from the fetched list
  });
});
