/**
 * Safe environment variable resolution for WubPad.
 * Derives defaults from window.location if VITE_ variables are missing.
 */

export const getWubLabzHttpUrl = () => {
  const meta = import.meta as any;
  if (meta.env?.VITE_WUBLABZ_HTTP_URL) {
    return meta.env.VITE_WUBLABZ_HTTP_URL;
  }
  
  if (typeof process !== 'undefined' && process.env?.VITE_WUBLABZ_HTTP_URL) {
    return process.env.VITE_WUBLABZ_HTTP_URL;
  }
  
  // Fallback to same host, port 3001
  const win = (globalThis as any).window;
  if (typeof win !== 'undefined') {
    const { protocol, hostname } = win.location;
    return `${protocol}//${hostname}:3001`;
  }
  
  return 'http://localhost:3001';
};

export const getWubLabzWsUrl = () => {
  const meta = import.meta as any;
  if (meta.env?.VITE_WUBLABZ_WS_URL) {
    return meta.env.VITE_WUBLABZ_WS_URL;
  }
  
  if (typeof process !== 'undefined' && process.env?.VITE_WUBLABZ_WS_URL) {
    return process.env.VITE_WUBLABZ_WS_URL;
  }
  
  // Fallback to same host, port 3001
  const win = (globalThis as any).window;
  if (typeof win !== 'undefined') {
    const { hostname } = win.location;
    const protocol = win.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${hostname}:3001`;
  }
  
  return 'ws://localhost:3001';
};

export const isMockMode = () => {
  const meta = import.meta as any;
  return meta.env?.VITE_WUBLABZ_MOCK === 'true' || process.env?.VITE_WUBLABZ_MOCK === 'true';
};


