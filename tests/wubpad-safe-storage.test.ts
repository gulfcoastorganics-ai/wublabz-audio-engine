import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readStorageJson,
  readStorageValue,
  removeStorageValue,
  writeStorageJson,
  writeStorageValue
} from '../src/wubpad-integration/safeStorage.js';

describe('WubPad safe storage helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(readStorageValue('missing', 'fallback')).toBe('fallback');
    expect(readStorageJson('missing', ['fallback'])).toEqual(['fallback']);
    expect(writeStorageValue('key', 'value')).toBe(false);
    expect(removeStorageValue('key')).toBe(false);
  });

  it('falls back when stored JSON is corrupt or has the wrong shape', () => {
    const store = new Map<string, string>([
      ['corrupt', '{bad-json'],
      ['wrong-shape', '{"url":"ws://127.0.0.1:3001"}']
    ]);

    vi.stubGlobal('localStorage', createStorageStub(store));

    expect(readStorageJson('corrupt', [] as string[])).toEqual([]);
    expect(readStorageJson('wrong-shape', [] as string[], isStringArray)).toEqual([]);
  });

  it('reads and writes JSON when storage is available', () => {
    const store = new Map<string, string>();

    vi.stubGlobal('localStorage', createStorageStub(store));

    expect(writeStorageJson('history', ['ws://127.0.0.1:3001'])).toBe(true);
    expect(readStorageJson('history', [] as string[], isStringArray)).toEqual(['ws://127.0.0.1:3001']);
  });
});

function createStorageStub(store: Map<string, string>) {
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    })
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
