export interface LoadedClip<TBuffer = unknown> {
  id: string;
  sourcePath: string;
  duration: number;
  buffer: TBuffer;
  loadedAt: number;
  refCount: number;
  lastUsedAt: number;
  byteLength?: number;
}

export interface ClipLoadResult<TBuffer = unknown> {
  buffer: TBuffer;
  duration?: number;
  byteLength?: number;
}

export interface ClipLoader<TBuffer = unknown> {
  (sourcePath: string): Promise<ClipLoadResult<TBuffer>>;
}

export class AudioClipManager<TBuffer = unknown> {
  private readonly clipsBySourcePath = new Map<string, LoadedClip<TBuffer>>();
  private readonly sourcePathById = new Map<string, string>();
  private readonly usageCountById = new Map<string, number>();
  private readonly pendingBySourcePath = new Map<string, Promise<LoadedClip<TBuffer>>>();

  constructor(private readonly loader: ClipLoader<TBuffer>) {}

  async loadClip(id: string, sourcePath: string): Promise<LoadedClip<TBuffer>> {
    const existingSourcePath = this.sourcePathById.get(id);
    if (existingSourcePath && existingSourcePath !== sourcePath) {
      this.releaseClip(id);
    }

    const existing = this.clipsBySourcePath.get(sourcePath);
    if (existing) {
      this.attachAlias(id, sourcePath);
      existing.refCount += 1;
      existing.lastUsedAt = Date.now();
      return existing;
    }

    const pending = this.pendingBySourcePath.get(sourcePath);
    if (pending) {
      const clip = await pending;
      this.attachAlias(id, sourcePath);
      clip.refCount += 1;
      clip.lastUsedAt = Date.now();
      return clip;
    }

    const promise = this.loader(sourcePath).then((loaded) => {
      const now = Date.now();
      const clip: LoadedClip<TBuffer> = {
        id,
        sourcePath,
        duration: loaded.duration ?? estimateDuration(loaded.buffer),
        buffer: loaded.buffer,
        loadedAt: now,
        refCount: 1,
        lastUsedAt: now,
        byteLength: loaded.byteLength ?? estimateByteLength(loaded.buffer)
      };
      this.clipsBySourcePath.set(sourcePath, clip);
      this.attachAlias(id, sourcePath);
      return clip;
    });

    this.pendingBySourcePath.set(sourcePath, promise);

    try {
      const clip = await promise;
      return clip;
    } finally {
      this.pendingBySourcePath.delete(sourcePath);
    }
  }

  releaseClip(id: string): void {
    const sourcePath = this.sourcePathById.get(id);
    if (!sourcePath) {
      return;
    }

    const usageCount = this.usageCountById.get(id) ?? 0;
    if (usageCount <= 1) {
      this.sourcePathById.delete(id);
      this.usageCountById.delete(id);
    } else {
      this.usageCountById.set(id, usageCount - 1);
    }

    const clip = this.clipsBySourcePath.get(sourcePath);
    if (!clip) {
      return;
    }

    clip.refCount = Math.max(0, clip.refCount - 1);
    clip.lastUsedAt = Date.now();
  }

  async preloadRegion(id: string, sourcePath: string): Promise<LoadedClip<TBuffer>> {
    return this.loadClip(id, sourcePath);
  }

  clearUnused(maxAgeMs = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [sourcePath, clip] of this.clipsBySourcePath.entries()) {
      if (clip.refCount > 0 || now - clip.lastUsedAt < maxAgeMs) {
        continue;
      }

      this.disposeBuffer(clip.buffer);
      this.clipsBySourcePath.delete(sourcePath);

      for (const [id, aliasSourcePath] of this.sourcePathById.entries()) {
        if (aliasSourcePath !== sourcePath) {
          continue;
        }

        this.sourcePathById.delete(id);
        this.usageCountById.delete(id);
      }
    }
  }

  getMemoryUsageBytes(): number {
    let total = 0;
    for (const clip of this.clipsBySourcePath.values()) {
      total += clip.byteLength ?? estimateByteLength(clip.buffer);
    }
    return total;
  }

  getLoadedClip(id: string): LoadedClip<TBuffer> | undefined {
    const sourcePath = this.sourcePathById.get(id);
    if (!sourcePath) {
      return undefined;
    }

    return this.clipsBySourcePath.get(sourcePath);
  }

  getLoadedClips(): LoadedClip<TBuffer>[] {
    return [...this.clipsBySourcePath.values()];
  }

  getLoadedClipCount(): number {
    return this.clipsBySourcePath.size;
  }

  private attachAlias(id: string, sourcePath: string): void {
    this.sourcePathById.set(id, sourcePath);
    this.usageCountById.set(id, (this.usageCountById.get(id) ?? 0) + 1);
  }

  private disposeBuffer(buffer: TBuffer): void {
    if (buffer && typeof buffer === 'object' && 'dispose' in buffer && typeof buffer.dispose === 'function') {
      buffer.dispose();
    }
  }
}

function estimateDuration(buffer: unknown): number {
  if (buffer && typeof buffer === 'object' && 'duration' in buffer) {
    const duration = (buffer as { duration?: number }).duration;
    if (typeof duration === 'number' && Number.isFinite(duration)) {
      return duration;
    }
  }

  return 0;
}

function estimateByteLength(value: unknown): number {
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }

  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }

  if (value && typeof value === 'object') {
    if ('get' in value && typeof (value as { get?: () => DecodedAudioBufferLike | undefined }).get === 'function') {
      const audioBuffer = (value as { get?: () => DecodedAudioBufferLike | undefined }).get?.();
      if (audioBuffer) {
        return audioBuffer.length * audioBuffer.numberOfChannels * 4;
      }
    }

    if ('byteLength' in value && typeof (value as { byteLength?: number }).byteLength === 'number') {
      return (value as { byteLength: number }).byteLength;
    }

    if ('duration' in value && typeof (value as { duration?: number }).duration === 'number') {
      return Math.round(((value as { duration: number }).duration ?? 0) * 44100 * 4);
    }
  }

  return 0;
}

interface DecodedAudioBufferLike {
  length: number;
  numberOfChannels: number;
}
