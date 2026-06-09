import { describe, expect, it, vi } from 'vitest';
import { getWubLabzHttpUrl, getWubLabzWsUrl, isMockMode } from '../src/wubpad-integration/env.js';

describe('WubPad Integration Env', () => {
  it('should return default URLs when environment is missing', () => {
    // Clear env
    vi.stubGlobal('window', undefined);
    delete process.env.VITE_WUBLABZ_HTTP_URL;
    delete process.env.VITE_WUBLABZ_WS_URL;

    expect(getWubLabzHttpUrl()).toBe('http://localhost:3001');
    expect(getWubLabzWsUrl()).toBe('ws://localhost:3001');
  });

  it('should derive URLs from window.location when possible', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        hostname: '192.168.1.5',
      }
    });

    expect(getWubLabzHttpUrl()).toBe('http://192.168.1.5:3001');
    expect(getWubLabzWsUrl()).toBe('ws://192.168.1.5:3001');
  });

  it('should use VITE_ variables when present', () => {
    process.env.VITE_WUBLABZ_HTTP_URL = 'https://api.wub.ai';
    process.env.VITE_WUBLABZ_WS_URL = 'wss://ws.wub.ai';

    expect(getWubLabzHttpUrl()).toBe('https://api.wub.ai');
    expect(getWubLabzWsUrl()).toBe('wss://ws.wub.ai');
  });

  it('does not require process global for mock mode checks', () => {
    const originalProcess = globalThis.process;

    try {
      vi.stubGlobal('process', undefined);

      expect(() => isMockMode()).not.toThrow();
      expect(isMockMode()).toBe(false);
    } finally {
      vi.stubGlobal('process', originalProcess);
    }
  });
});
