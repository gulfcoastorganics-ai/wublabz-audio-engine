import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RemixBlueprint } from '../producer/types.js';
import { StorageManager } from './StorageManager.js';

export interface BlueprintCacheStats {
  namespace: string;
  rootPath: string;
  fileCount: number;
  validFileCount: number;
  invalidFileCount: number;
  totalBytes: number;
}

interface BlueprintCacheEnvelope<T> {
  version: 1;
  kind: 'blueprint';
  createdAt: string;
  payload: T;
}

export class BlueprintCache {
  private readonly rootPath: string;

  constructor(cacheRoot?: string) {
    const storage = new StorageManager();
    this.rootPath = cacheRoot ? path.join(cacheRoot, 'blueprints') : path.dirname(storage.getCachePath('blueprints', 'default'));
  }

  async read(key: string): Promise<RemixBlueprint | undefined> {
    try {
      const raw = await readFile(this.filePath(key), 'utf8');
      const parsed = JSON.parse(raw) as BlueprintCacheEnvelope<RemixBlueprint>;
      if (!isValidBlueprintEnvelope(parsed)) {
        return undefined;
      }

      return parsed.payload;
    } catch {
      return undefined;
    }
  }

  async write(key: string, blueprint: RemixBlueprint): Promise<string> {
    await mkdir(this.rootPath, { recursive: true });
    const filePath = this.filePath(key);
    const envelope: BlueprintCacheEnvelope<RemixBlueprint> = {
      version: 1,
      kind: 'blueprint',
      createdAt: new Date().toISOString(),
      payload: blueprint
    };
    await writeFile(filePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    return filePath;
  }

  async cleanupCache(maxAgeMs = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    return cleanupCacheDirectory(this.rootPath, maxAgeMs);
  }

  async getCacheStats(): Promise<BlueprintCacheStats> {
    return getCacheStatsForDirectory(this.rootPath);
  }

  private filePath(key: string): string {
    return path.join(this.rootPath, `${sanitizeCacheKey(key)}.json`);
  }
}

function isValidBlueprintEnvelope(value: unknown): value is BlueprintCacheEnvelope<RemixBlueprint> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const envelope = value as Partial<BlueprintCacheEnvelope<RemixBlueprint>>;
  return envelope.version === 1 && envelope.kind === 'blueprint' && typeof envelope.createdAt === 'string';
}

async function cleanupCacheDirectory(rootPath: string, maxAgeMs: number): Promise<number> {
  let removed = 0;
  await mkdir(rootPath, { recursive: true });

  let entries: string[] = [];
  try {
    entries = await readdir(rootPath);
  } catch {
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(rootPath, entry);
    let keep = true;
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as BlueprintCacheEnvelope<RemixBlueprint>;
      if (!isValidBlueprintEnvelope(parsed)) {
        keep = false;
      } else {
        const createdAt = Date.parse(parsed.createdAt);
        if (Number.isFinite(createdAt) && createdAt < cutoff) {
          keep = false;
        }
      }
    } catch {
      keep = false;
    }

    if (!keep) {
      await unlink(filePath).catch(() => undefined);
      removed += 1;
    }
  }

  return removed;
}

async function getCacheStatsForDirectory(rootPath: string): Promise<BlueprintCacheStats> {
  await mkdir(rootPath, { recursive: true });

  let entries: string[] = [];
  try {
    entries = await readdir(rootPath);
  } catch {
    entries = [];
  }

  let fileCount = 0;
  let validFileCount = 0;
  let invalidFileCount = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    fileCount += 1;
    const filePath = path.join(rootPath, entry);
    try {
      const fileStat = await stat(filePath);
      totalBytes += fileStat.size;
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as BlueprintCacheEnvelope<RemixBlueprint>;
      if (isValidBlueprintEnvelope(parsed)) {
        validFileCount += 1;
      } else {
        invalidFileCount += 1;
      }
    } catch {
      invalidFileCount += 1;
    }
  }

  return {
    namespace: 'blueprint',
    rootPath,
    fileCount,
    validFileCount,
    invalidFileCount,
    totalBytes
  };
}

function sanitizeCacheKey(key: string): string {
  const cleaned = key.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return cleaned || 'default';
}
