/**
 * Safe environment variable resolution for WubPad.
 * Derives defaults from window.location if VITE_ variables are missing.
 */

export const getWubLabzHttpUrl = () => {
  const importMetaEnv = getImportMetaEnv();
  if (importMetaEnv?.VITE_WUBLABZ_HTTP_URL) {
    return importMetaEnv.VITE_WUBLABZ_HTTP_URL;
  }
  
  const processEnv = getProcessEnv();
  if (processEnv?.VITE_WUBLABZ_HTTP_URL) {
    return processEnv.VITE_WUBLABZ_HTTP_URL;
  }
  
  // Fallback to same host, port 3001
  const win = (globalThis as any).window;
  if (typeof win !== 'undefined') {
    const { protocol, hostname } = win.location;
    const resolvedHost = hostname === 'localhost' ? '127.0.0.1' : hostname;
    return `${protocol}//${resolvedHost}:3001`;
  }
  
  return 'http://127.0.0.1:3001';
};

export const getWubLabzWsUrl = () => {
  const importMetaEnv = getImportMetaEnv();
  if (importMetaEnv?.VITE_WUBLABZ_WS_URL) {
    return importMetaEnv.VITE_WUBLABZ_WS_URL;
  }
  
  const processEnv = getProcessEnv();
  if (processEnv?.VITE_WUBLABZ_WS_URL) {
    return processEnv.VITE_WUBLABZ_WS_URL;
  }
  
  // Fallback to same host, port 3001
  const win = (globalThis as any).window;
  if (typeof win !== 'undefined') {
    const { hostname } = win.location;
    const protocol = win.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const resolvedHost = hostname === 'localhost' ? '127.0.0.1' : hostname;
    return `${protocol}//${resolvedHost}:3001`;
  }
  
  return 'ws://127.0.0.1:3001';
};

export const isMockMode = () => {
  return getImportMetaEnv()?.VITE_WUBLABZ_MOCK === 'true' || getProcessEnv()?.VITE_WUBLABZ_MOCK === 'true';
};

function getImportMetaEnv(): Record<string, string | undefined> | undefined {
  try {
    return (import.meta as any).env;
  } catch {
    return undefined;
  }
}

function getProcessEnv(): NodeJS.ProcessEnv | undefined {
  return typeof process !== 'undefined' ? process.env : undefined;
}
