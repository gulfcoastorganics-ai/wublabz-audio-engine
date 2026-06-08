import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runPerformanceMacro, cancelPendingMacro, cancelAllPendingMacros, getPendingMacroCount } from '../src/lib/audio/performanceMacros.js';
import { ModulationAdapter } from '../src/lib/audio/modulationAdapter.js';
import { WubLabzEngine } from '../src/lib/WubLabzEngine.js';
import type { TransportSnapshot } from '../src/lib/playback/transportSnapshot.js';

vi.mock('../src/lib/WubLabzEngine.js', () => {
  return {
    WubLabzEngine: class {
      setMasterVolume() {}
      setBusGain() {}
      applyEffectParameter() {}
      resetEffectParameter() {}
    }
  };
});

describe('PerformanceMacros', () => {
  let adapter: ModulationAdapter;
  let engine: WubLabzEngine;

  const dummySnapshot: TransportSnapshot = {
    bpm: 120,
    transportState: 'playing',
    currentBeat: 0,
    currentBar: 0,
    currentPhrase: 0,
    secondsPerBeat: 0.5,
    secondsPerBar: 2.0,
    phraseLengthBars: 4,
    secondsUntilNextBeat: 0.5,
    secondsUntilNextBar: 2.0,
    secondsUntilNextPhrase: 8.0
  };

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new WubLabzEngine();
    adapter = new ModulationAdapter(engine);
    cancelAllPendingMacros();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediate macro without delay', () => {
    const result = runPerformanceMacro('filter_sweep_up', { transportSnapshot: dummySnapshot, quantize: 'immediate' }, adapter);
    expect(result.success).toBe(true);
    expect(result.delayed).toBe(false);
    expect(adapter.getActiveModulationCount()).toBeGreaterThan(0);
  });

  it('delays macro on nextBar quantize', () => {
    const result = runPerformanceMacro('filter_sweep_up', { transportSnapshot: dummySnapshot, quantize: 'nextBar' }, adapter);
    expect(result.success).toBe(true);
    expect(result.delayed).toBe(true);
    expect((result as any).delaySeconds).toBe(2.0);
    
    // Not executed yet
    expect(adapter.getActiveModulationCount()).toBe(0);

    // Fast-forward timers
    vi.advanceTimersByTime(2000);
    expect(adapter.getActiveModulationCount()).toBeGreaterThan(0);
  });

  it('cancelPendingMacro clears specific timer', () => {
    runPerformanceMacro('filter_sweep_up', { transportSnapshot: dummySnapshot, quantize: 'nextBar' }, adapter);
    expect(getPendingMacroCount()).toBe(1);
    
    cancelPendingMacro('filter_sweep_up');
    expect(getPendingMacroCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(adapter.getActiveModulationCount()).toBe(0);
  });

  it('cancelAllPendingMacros clears all timers', () => {
    runPerformanceMacro('filter_sweep_up', { transportSnapshot: dummySnapshot, quantize: 'nextBar' }, adapter);
    runPerformanceMacro('delay_throw', { transportSnapshot: dummySnapshot, quantize: 'nextBar' }, adapter);
    
    expect(getPendingMacroCount()).toBe(2);
    cancelAllPendingMacros();
    expect(getPendingMacroCount()).toBe(0);
  });

  it('intensity clamps between 0 and 1', () => {
    // 0 intensity sweep up
    const r1 = runPerformanceMacro('filter_sweep_up', { intensity: -5 }, adapter);
    expect((r1 as any).results[0].sanitized.value).toBe(800); // 800 + (11200 * 0)

    // 1 intensity sweep up
    const r2 = runPerformanceMacro('filter_sweep_up', { intensity: 5 }, adapter);
    expect((r2 as any).results[0].sanitized.value).toBe(12000); // 800 + (11200 * 1)
  });

  it('scales duration based on BPM', () => {
    // Slow BPM
    const slowSnapshot = { ...dummySnapshot, bpm: 60, secondsPerBeat: 1.0, secondsPerBar: 4.0 };
    const r1 = runPerformanceMacro('filter_sweep_up', { transportSnapshot: slowSnapshot }, adapter);
    // filter.cutoff rampTime is clamped to 2.0 max in ModulationRegistry
    expect((r1 as any).results[0].sanitized.rampTime).toBe(2.0); // 4 beats * 1s, clamped to 2.0

    // Fast BPM
    const fastSnapshot = { ...dummySnapshot, bpm: 240, secondsPerBeat: 0.25, secondsPerBar: 1.0 };
    const r2 = runPerformanceMacro('filter_sweep_up', { transportSnapshot: fastSnapshot }, adapter);
    expect((r2 as any).results[0].sanitized.rampTime).toBe(1.0); // 4 beats * 0.25s
  });
});


