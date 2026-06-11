import type { AudioClipEdit } from '../../lib/project/projectSchema.js';
import { type RenderedClipBuffer, makeCacheKey, hashClipEdit } from './clipRenderTypes.js';
import { renderClipEdits } from './clipEditRenderer.js';

export class ClipRenderCache {
  private readonly store = new Map<string, RenderedClipBuffer>();

  getOrRender(
    clipId: string,
    assetId: string,
    edit: AudioClipEdit | undefined,
    sourcePeaks: readonly number[],
    clipDurationSeconds: number
  ): RenderedClipBuffer {
    const key = makeCacheKey(clipId, assetId, edit);
    const cached = this.store.get(key);
    if (cached) return cached;

    const peaks = edit
      ? renderClipEdits(sourcePeaks, edit, clipDurationSeconds)
      : Float32Array.from(sourcePeaks);

    const entry: RenderedClipBuffer = {
      clipId,
      sourceAssetId: assetId,
      peaks,
      editHash: hashClipEdit(edit),
    };
    this.store.set(key, entry);
    return entry;
  }

  has(clipId: string, assetId: string, edit: AudioClipEdit | undefined): boolean {
    return this.store.has(makeCacheKey(clipId, assetId, edit));
  }

  invalidate(clipId: string): void {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(`${clipId}:`)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
