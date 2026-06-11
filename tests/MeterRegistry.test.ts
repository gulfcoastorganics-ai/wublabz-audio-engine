import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeterRegistry } from '../src/audio/metering/MeterRegistry.js';

describe('MeterRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('subscribes and exposes the current snapshot', async () => {
    let now = 0;
    const registry = new MeterRegistry({
      now: () => now,
      requestFrame: (callback) => setTimeout(() => callback(now), 16) as unknown as number,
      cancelFrame: (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
    });

    registry.registerChannel('track-1', { label: 'Track 1' });

    const calls: number[] = [];
    const unsubscribe = registry.subscribe(() => {
      calls.push(calls.length + 1);
    });

    registry.updateLevel({
      channelId: 'track-1',
      peak: 1,
      rms: 0.8,
      clipping: true,
    });

    await vi.advanceTimersByTimeAsync(16);

    expect(calls).toHaveLength(1);
    const snapshot = registry.getSnapshot();
    expect(snapshot.levels['track-1']?.peak).toBeCloseTo(1);
    expect(snapshot.levels['track-1']?.clipping).toBe(true);

    unsubscribe();
  });

  it('decays peak and rms over time', () => {
    let now = 0;
    const registry = new MeterRegistry({ now: () => now });

    registry.registerChannel('track-1');
    registry.updateLevel({
      channelId: 'track-1',
      peak: 1,
      rms: 0.75,
      clipping: true,
    });

    now = 500;
    const mid = registry.getSnapshot(now).levels['track-1'];
    expect(mid?.peak).toBeLessThan(1);
    expect(mid?.rms).toBeLessThan(0.75);

    now = 5000;
    const late = registry.getSnapshot(now).levels['track-1'];
    expect(late?.peak).toBe(0);
    expect(late?.rms).toBe(0);
  });
});
