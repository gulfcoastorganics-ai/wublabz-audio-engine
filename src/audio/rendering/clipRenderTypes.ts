import type { AudioClipEdit } from '../../lib/project/projectSchema.js';

export type ClipRenderStatus = 'original' | 'cached' | 'rebuilding';

export type RenderedClipBuffer = {
  sourceAssetId: string;
  clipId: string;
  peaks: Float32Array;
  editHash: string;
};

export function hashClipEdit(edit: AudioClipEdit | undefined): string {
  if (!edit) return '';
  const keys = (Object.keys(edit) as (keyof AudioClipEdit)[]).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = edit[key];
  }
  return JSON.stringify(sorted);
}

export function makeCacheKey(clipId: string, assetId: string, edit: AudioClipEdit | undefined): string {
  return `${clipId}:${assetId}:${hashClipEdit(edit)}`;
}
