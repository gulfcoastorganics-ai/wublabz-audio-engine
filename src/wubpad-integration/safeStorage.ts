type BrowserStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ValueGuard<T> = (value: unknown) => value is T;

export function readStorageValue(key: string, fallback: string | null = null): string | null {
  const storage = getLocalStorage();
  if (!storage) return fallback;

  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageValue(key: string, value: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorageValue(key: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStorageJson<T>(key: string, fallback: T, guard?: ValueGuard<T>): T {
  const raw = readStorageValue(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    return !guard || guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key: string, value: unknown): boolean {
  try {
    return writeStorageValue(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

function getLocalStorage(): BrowserStorage | null {
  try {
    const storage = (globalThis as { localStorage?: BrowserStorage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}
