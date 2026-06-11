import type { AudioClipEdit } from '../../lib/project/projectSchema.js';

export function applyGain(peaks: Float32Array, gain: number): void {
  if (gain === 1) return;
  for (let i = 0; i < peaks.length; i++) {
    peaks[i] *= gain;
  }
}

export function applyNormalize(peaks: Float32Array): number {
  let maxVal = 0;
  for (let i = 0; i < peaks.length; i++) {
    const abs = Math.abs(peaks[i] ?? 0);
    if (abs > maxVal) maxVal = abs;
  }
  const factor = maxVal > 0 ? 1 / maxVal : 1;
  if (factor !== 1) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] *= factor;
    }
  }
  return factor;
}

export function applyReverse(peaks: Float32Array): void {
  const len = peaks.length;
  for (let i = 0; i < Math.floor(len / 2); i++) {
    const tmp = peaks[i]!;
    peaks[i] = peaks[len - 1 - i]!;
    peaks[len - 1 - i] = tmp;
  }
}

export function applyFadeIn(peaks: Float32Array, fadeSamples: number): void {
  const end = Math.min(fadeSamples, peaks.length);
  if (end <= 0 || fadeSamples <= 0) return;
  for (let i = 0; i < end; i++) {
    peaks[i] *= i / fadeSamples;
  }
}

export function applyFadeOut(peaks: Float32Array, fadeSamples: number): void {
  const len = peaks.length;
  if (fadeSamples <= 0) return;
  const start = Math.max(0, len - fadeSamples);
  for (let i = start; i < len; i++) {
    const k = i - start;
    peaks[i] *= (fadeSamples - 1 - k) / fadeSamples;
  }
}

/**
 * Run the full deterministic edit pipeline: normalize → gain → reverse → fade in → fade out.
 * Returns a new Float32Array without modifying the source.
 */
export function renderClipEdits(
  sourcePeaks: readonly number[],
  edit: AudioClipEdit,
  clipDurationSeconds: number
): Float32Array {
  const processed = Float32Array.from(sourcePeaks);

  if (edit.normalized) {
    applyNormalize(processed);
  }

  if (typeof edit.gain === 'number' && edit.gain !== 1) {
    applyGain(processed, edit.gain);
  }

  if (edit.reverse) {
    applyReverse(processed);
  }

  if (edit.fadeInSeconds && edit.fadeInSeconds > 0 && clipDurationSeconds > 0) {
    const fadeSamples = Math.floor((edit.fadeInSeconds / clipDurationSeconds) * processed.length);
    applyFadeIn(processed, fadeSamples);
  }

  if (edit.fadeOutSeconds && edit.fadeOutSeconds > 0 && clipDurationSeconds > 0) {
    const fadeSamples = Math.floor((edit.fadeOutSeconds / clipDurationSeconds) * processed.length);
    applyFadeOut(processed, fadeSamples);
  }

  return processed;
}
