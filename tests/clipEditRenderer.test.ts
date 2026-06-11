import { describe, expect, it } from 'vitest';
import {
  applyFadeIn,
  applyFadeOut,
  applyGain,
  applyNormalize,
  applyReverse,
  renderClipEdits,
} from '../src/audio/rendering/clipEditRenderer.js';

// ─── applyGain ────────────────────────────────────────────────────────────────

describe('applyGain', () => {
  it('multiplies every sample by the given gain', () => {
    const peaks = new Float32Array([0.2, 0.4, 0.6]);
    applyGain(peaks, 2);
    expect(peaks[0]).toBeCloseTo(0.4);
    expect(peaks[1]).toBeCloseTo(0.8);
    expect(peaks[2]).toBeCloseTo(1.2);
  });

  it('is a no-op when gain is 1', () => {
    const peaks = new Float32Array([0.5, 0.7]);
    applyGain(peaks, 1);
    expect(peaks[0]).toBeCloseTo(0.5);
    expect(peaks[1]).toBeCloseTo(0.7);
  });

  it('attenuates when gain < 1', () => {
    const peaks = new Float32Array([1.0]);
    applyGain(peaks, 0.5);
    expect(peaks[0]).toBeCloseTo(0.5);
  });
});

// ─── applyNormalize ───────────────────────────────────────────────────────────

describe('applyNormalize', () => {
  it('scales peaks so the maximum is 1.0', () => {
    const peaks = new Float32Array([0, 0.5, 0.25]);
    applyNormalize(peaks);
    expect(Math.max(...peaks)).toBeCloseTo(1.0);
  });

  it('returns the normalization factor applied', () => {
    const peaks = new Float32Array([0.5, 0.25]);
    const factor = applyNormalize(peaks);
    expect(factor).toBeCloseTo(2.0);
  });

  it('does nothing when all peaks are zero', () => {
    const peaks = new Float32Array([0, 0]);
    const factor = applyNormalize(peaks);
    expect(factor).toBe(1);
    expect(peaks[0]).toBe(0);
  });

  it('handles an already-normalized signal', () => {
    const peaks = new Float32Array([1.0, 0.8]);
    const factor = applyNormalize(peaks);
    expect(factor).toBeCloseTo(1.0);
    expect(peaks[0]).toBeCloseTo(1.0);
  });
});

// ─── applyReverse ─────────────────────────────────────────────────────────────

describe('applyReverse', () => {
  it('reverses the array in place', () => {
    const peaks = new Float32Array([0.1, 0.5, 0.9]);
    applyReverse(peaks);
    expect(peaks[0]).toBeCloseTo(0.9);
    expect(peaks[1]).toBeCloseTo(0.5);
    expect(peaks[2]).toBeCloseTo(0.1);
  });

  it('is an involution (reversing twice restores original)', () => {
    const peaks = new Float32Array([0.2, 0.7, 0.3, 0.9]);
    applyReverse(peaks);
    applyReverse(peaks);
    expect(peaks[0]).toBeCloseTo(0.2);
    expect(peaks[3]).toBeCloseTo(0.9);
  });
});

// ─── applyFadeIn ─────────────────────────────────────────────────────────────

describe('applyFadeIn', () => {
  it('ramps the first N samples from 0 to 1', () => {
    const peaks = new Float32Array([1, 1, 1, 1, 1]);
    applyFadeIn(peaks, 4);
    expect(peaks[0]).toBeCloseTo(0); // 0/4
    expect(peaks[1]).toBeCloseTo(0.25); // 1/4
    expect(peaks[2]).toBeCloseTo(0.5); // 2/4
    expect(peaks[3]).toBeCloseTo(0.75); // 3/4
    expect(peaks[4]).toBeCloseTo(1); // untouched
  });

  it('is a no-op when fadeSamples is 0', () => {
    const peaks = new Float32Array([1, 1, 1]);
    applyFadeIn(peaks, 0);
    expect(peaks[0]).toBeCloseTo(1);
  });

  it('clamps to array length if fadeSamples > length', () => {
    const peaks = new Float32Array([1, 1]);
    applyFadeIn(peaks, 100);
    // Should not throw and should apply partial fade
    expect(peaks[0]).toBeDefined();
  });
});

// ─── applyFadeOut ─────────────────────────────────────────────────────────────

describe('applyFadeOut', () => {
  it('ramps the last N samples from 1 to 0', () => {
    const peaks = new Float32Array([1, 1, 1, 1, 1]);
    applyFadeOut(peaks, 4);
    expect(peaks[4]).toBeCloseTo(0); // (5-5)/4 = 0/4
    expect(peaks[3]).toBeCloseTo(0.25); // (5-4)/4 = 1/4
    expect(peaks[2]).toBeCloseTo(0.5); // (5-3)/4 = 2/4
    expect(peaks[1]).toBeCloseTo(0.75); // (5-2)/4 = 3/4
    expect(peaks[0]).toBeCloseTo(1); // untouched
  });

  it('is a no-op when fadeSamples is 0', () => {
    const peaks = new Float32Array([1, 1, 1]);
    applyFadeOut(peaks, 0);
    expect(peaks[2]).toBeCloseTo(1);
  });
});

// ─── renderClipEdits pipeline ─────────────────────────────────────────────────

describe('renderClipEdits pipeline', () => {
  const SOURCE = [0.25, 0.5, 0.75, 1.0];

  it('returns a Float32Array copy when no edits are active', () => {
    const result = renderClipEdits(SOURCE, {}, 1);
    expect(result).toBeInstanceOf(Float32Array);
    expect(Array.from(result)).toEqual(SOURCE);
  });

  it('applies gain', () => {
    const result = renderClipEdits(SOURCE, { gain: 2 }, 1);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[3]).toBeCloseTo(2.0);
  });

  it('applies normalize before gain (normalize → gain order)', () => {
    // normalized: peaks become [0.25, 0.5, 0.75, 1.0] → max=1.0 → factor=1.0 (no change)
    const result = renderClipEdits(SOURCE, { normalized: true, gain: 0.5 }, 1);
    expect(result[3]).toBeCloseTo(0.5);
  });

  it('normalize with non-unit peak boosts signal to 1.0 then gain applies', () => {
    // source max = 0.5
    const result = renderClipEdits([0.1, 0.3, 0.5], { normalized: true, gain: 1 }, 1);
    expect(Math.max(...result)).toBeCloseTo(1.0);
  });

  it('reverses samples', () => {
    const result = renderClipEdits(SOURCE, { reverse: true }, 1);
    expect(result[0]).toBeCloseTo(1.0);
    expect(result[3]).toBeCloseTo(0.25);
  });

  it('applies fade in', () => {
    const flat = [1, 1, 1, 1];
    const result = renderClipEdits(flat, { fadeInSeconds: 0.5 }, 1); // 50% of 4 = 2 samples
    expect(result[0]).toBeCloseTo(0); // 0/2
    expect(result[1]).toBeCloseTo(0.5); // 1/2
    expect(result[2]).toBeCloseTo(1);
    expect(result[3]).toBeCloseTo(1);
  });

  it('applies fade out', () => {
    const flat = [1, 1, 1, 1];
    const result = renderClipEdits(flat, { fadeOutSeconds: 0.5 }, 1); // 50% of 4 = 2 samples
    expect(result[3]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0.5);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(1);
  });

  it('does not modify the source array', () => {
    const source = [0.5, 0.8, 1.0];
    renderClipEdits(source, { gain: 2, reverse: true }, 1);
    expect(source).toEqual([0.5, 0.8, 1.0]);
  });

  it('combines normalize + gain + reverse + fades deterministically', () => {
    const first = renderClipEdits([0.2, 0.4, 0.6, 0.4], { normalized: true, gain: 0.8, reverse: true, fadeInSeconds: 0.1, fadeOutSeconds: 0.1 }, 1);
    const second = renderClipEdits([0.2, 0.4, 0.6, 0.4], { normalized: true, gain: 0.8, reverse: true, fadeInSeconds: 0.1, fadeOutSeconds: 0.1 }, 1);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('ignores fades when clipDurationSeconds is 0', () => {
    const flat = [1, 1, 1];
    const result = renderClipEdits(flat, { fadeInSeconds: 0.5 }, 0);
    expect(result[0]).toBeCloseTo(1);
  });
});
