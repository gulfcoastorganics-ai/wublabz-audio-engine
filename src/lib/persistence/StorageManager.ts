import os from 'node:os';
import path from 'node:path';

export type StorageNamespace =
  | 'projects'
  | 'analysis'
  | 'waveform'
  | 'song-dna'
  | 'blueprints'
  | 'exports'
  | 'cache'
  | 'logs';

export interface StorageManagerOptions {
  rootDir?: string;
}

export class StorageManager {
  readonly rootDir: string;

  constructor(options: StorageManagerOptions = {}) {
    this.rootDir = options.rootDir ?? resolveDefaultRootDir();
  }

  getRootPath(...segments: string[]): string {
    return path.join(this.rootDir, ...segments);
  }

  getProjectPath(projectId: string, fileName = 'project.json'): string {
    return this.getRootPath('projects', sanitizeSegment(projectId), fileName);
  }

  getProjectDirectory(projectId: string): string {
    return this.getRootPath('projects', sanitizeSegment(projectId));
  }

  getAnalysisPath(analysisId: string, fileName = 'analysis.json'): string {
    return this.getRootPath('analysis', sanitizeSegment(analysisId), fileName);
  }

  getAnalysisDirectory(analysisId: string): string {
    return this.getRootPath('analysis', sanitizeSegment(analysisId));
  }

  getSongDNAPath(songDNAId: string, fileName = 'song-dna.json'): string {
    return this.getRootPath('song-dna', sanitizeSegment(songDNAId), fileName);
  }

  getSongDNADirectory(songDNAId: string): string {
    return this.getRootPath('song-dna', sanitizeSegment(songDNAId));
  }

  getBlueprintPath(blueprintId: string, fileName = 'blueprint.json'): string {
    return this.getRootPath('blueprints', sanitizeSegment(blueprintId), fileName);
  }

  getBlueprintDirectory(blueprintId: string): string {
    return this.getRootPath('blueprints', sanitizeSegment(blueprintId));
  }

  getExportPath(exportId: string, fileName = 'project-export.json'): string {
    return this.getRootPath('exports', sanitizeSegment(exportId), fileName);
  }

  getExportDirectory(exportId: string): string {
    return this.getRootPath('exports', sanitizeSegment(exportId));
  }

  getCachePath(namespace: Exclude<StorageNamespace, 'cache'>, key: string, fileName?: string): string;
  getCachePath(namespace: 'cache', key: string, fileName?: string): string;
  getCachePath(namespace: StorageNamespace, key: string, fileName?: string): string {
    if (namespace === 'cache') {
      return this.getRootPath('cache', sanitizeSegment(key), fileName ?? `${sanitizeSegment(key)}.json`);
    }

    return this.getRootPath('cache', namespace, fileName ?? `${sanitizeSegment(key)}.json`);
  }

  getLogPath(logId: string, fileName = 'log.txt'): string {
    return this.getRootPath('logs', sanitizeSegment(logId), fileName);
  }

  getLogDirectory(logId: string): string {
    return this.getRootPath('logs', sanitizeSegment(logId));
  }

  getNamespacePath(namespace: StorageNamespace): string {
    return this.getRootPath(namespace);
  }
}

export function resolveDefaultRootDir(): string {
  const home = os.homedir?.();
  if (home) {
    return path.join(home, '.wublabz');
  }

  return path.join(process.cwd(), '.wublabz');
}

function sanitizeSegment(segment: string): string {
  const cleaned = segment.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return cleaned || 'default';
}
