import { describe, expect, it } from 'vitest';
import { ClipRenderCache } from '../src/audio/rendering/ClipRenderCache.js';
import { hashClipEdit, makeCacheKey } from '../src/audio/rendering/clipRenderTypes.js';
import type { AudioClipEdit } from '../src/lib/project/projectSchema.js';

const SOURCE = [0.2, 0.5, 0.8, 1.0];
const DURATION = 2;

// ─── hashClipEdit ─────────────────────────────────────────────────────────────

describe('hashClipEdit', () => {
  it('returns empty string for undefined', () => {
    expect(hashClipEdit(undefined)).toBe('');
  });

  it('returns a stable string for the same edit', () => {
    const edit: AudioClipEdit = { gain: 1.5, reverse: true };
    expect(hashClipEdit(edit)).toBe(hashClipEdit(edit));
  });

  it('produces the same hash regardless of property insertion order', () => {
    const a: AudioClipEdit = { gain: 1.5, reverse: true };
    const b: AudioClipEdit = { reverse: true, gain: 1.5 };
    expect(hashClipEdit(a)).toBe(hashClipEdit(b));
  });

  it('produces different hashes for different edits', () => {
    expect(hashClipEdit({ gain: 1.5 })).not.toBe(hashClipEdit({ gain: 2.0 }));
    expect(hashClipEdit({ reverse: true })).not.toBe(hashClipEdit({ gain: 1 }));
  });
});

// ─── makeCacheKey ─────────────────────────────────────────────────────────────

describe('makeCacheKey', () => {
  it('includes clipId, assetId, and edit hash', () => {
    const key = makeCacheKey('clip-1', 'asset-1', { gain: 2 });
    expect(key).toContain('clip-1');
    expect(key).toContain('asset-1');
    expect(key).toContain(hashClipEdit({ gain: 2 }));
  });

  it('differs when only edit changes', () => {
    const a = makeCacheKey('clip-1', 'asset-1', { gain: 1 });
    const b = makeCacheKey('clip-1', 'asset-1', { gain: 2 });
    expect(a).not.toBe(b);
  });
});

// ─── ClipRenderCache ─────────────────────────────────────────────────────────

describe('ClipRenderCache', () => {
  it('returns a rendered buffer for unedited clips', () => {
    const cache = new ClipRenderCache();
    const entry = cache.getOrRender('clip-1', 'asset-1', undefined, SOURCE, DURATION);
    expect(entry.clipId).toBe('clip-1');
    expect(entry.sourceAssetId).toBe('asset-1');
    expect(entry.peaks).toBeInstanceOf(Float32Array);
    // Float32Array has lower precision than JS number; compare with tolerance
    SOURCE.forEach((v, i) => expect(entry.peaks[i]).toBeCloseTo(v, 4));
  });

  it('returns a processed buffer for edited clips', () => {
    const cache = new ClipRenderCache();
    const entry = cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    expect(entry.peaks[0]).toBeCloseTo(0.4); // 0.2 * 2
  });

  it('returns the same object on cache hit', () => {
    const cache = new ClipRenderCache();
    const first = cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    const second = cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    expect(first).toBe(second);
  });

  it('stores different entries for different edits', () => {
    const cache = new ClipRenderCache();
    const a = cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    const b = cache.getOrRender('clip-1', 'asset-1', { gain: 3 }, SOURCE, DURATION);
    expect(a).not.toBe(b);
    expect(a.peaks[0]).toBeCloseTo(0.4);
    expect(b.peaks[0]).toBeCloseTo(0.6);
  });

  it('has() returns true after a cache hit', () => {
    const cache = new ClipRenderCache();
    expect(cache.has('clip-1', 'asset-1', { gain: 2 })).toBe(false);
    cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    expect(cache.has('clip-1', 'asset-1', { gain: 2 })).toBe(true);
  });

  it('invalidate() removes entries for the given clipId', () => {
    const cache = new ClipRenderCache();
    cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    cache.getOrRender('clip-2', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    cache.invalidate('clip-1');
    expect(cache.has('clip-1', 'asset-1', { gain: 2 })).toBe(false);
    expect(cache.has('clip-2', 'asset-1', { gain: 2 })).toBe(true);
  });

  it('clear() empties the entire cache', () => {
    const cache = new ClipRenderCache();
    cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    cache.getOrRender('clip-2', 'asset-1', { reverse: true }, SOURCE, DURATION);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('size reflects the number of cached entries', () => {
    const cache = new ClipRenderCache();
    expect(cache.size).toBe(0);
    cache.getOrRender('clip-1', 'asset-1', undefined, SOURCE, DURATION);
    expect(cache.size).toBe(1);
    cache.getOrRender('clip-1', 'asset-1', { gain: 2 }, SOURCE, DURATION);
    expect(cache.size).toBe(2);
  });

  it('editHash in entry matches hashClipEdit output', () => {
    const edit: AudioClipEdit = { gain: 1.5, fadeInSeconds: 0.1 };
    const cache = new ClipRenderCache();
    const entry = cache.getOrRender('clip-1', 'asset-1', edit, SOURCE, DURATION);
    expect(entry.editHash).toBe(hashClipEdit(edit));
  });
});
