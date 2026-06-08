import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ModulationAdapter } from '../src/lib/audio/modulationAdapter.js';
import { WubLabzEngine } from '../src/lib/WubLabzEngine.js';
import { MODULATION_REGISTRY } from '../src/lib/audio/modulationRegistry.js';

// Mock the engine to avoid Tone.js dependency in Node tests
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

describe('ModulationAdapter', () => {
  let engine: WubLabzEngine;
  let adapter: ModulationAdapter;

  beforeEach(() => {
    engine = new WubLabzEngine();
    adapter = new ModulationAdapter(engine);
  });

  it('valid modulation calls engine hook with sanitized values', () => {
    const result = adapter.applyModulation({ effectId: 'filter', parameter: 'cutoff', value: 500, rampTime: 1 });
    expect(result.success).toBe(true);
    expect(result.sanitized?.value).toBe(500);
    expect(adapter.getActiveModulationCount()).toBe(1);
  });

  it('clamped values sent to engine are sanitized, not raw', () => {
    const result = adapter.applyModulation({ effectId: 'filter', parameter: 'cutoff', value: -100, rampTime: -1 });
    expect(result.success).toBe(true);
    expect(result.clamped).toBe(true);
    expect(result.sanitized?.value).toBe(MODULATION_REGISTRY.filter.cutoff.min);
    expect(result.sanitized?.rampTime).toBe(MODULATION_REGISTRY.filter.cutoff.rampMin);
  });

  it('unknown targets do not call engine hook', () => {
    const result = adapter.applyModulation({ effectId: 'unknown', parameter: 'target', value: 1 });
    expect(result.success).toBe(false);
    expect(adapter.getActiveModulationCount()).toBe(0);
  });

  it('resetAllModulation clears state', () => {
    adapter.applyModulation({ effectId: 'filter', parameter: 'cutoff', value: 500 });
    expect(adapter.getActiveModulationCount()).toBe(1);
    
    adapter.resetAllModulation();
    expect(adapter.getActiveModulationCount()).toBe(0);
  });
});
