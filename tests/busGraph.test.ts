import { describe, expect, it, beforeEach } from 'vitest';
import { BusGraph } from '../src/lib/audio/BusGraph.js';
import { MODULATION_REGISTRY } from '../src/lib/audio/modulationRegistry.js';

describe('BusGraph', () => {
  let busGraph: BusGraph;
  let mockToneRuntime: any;

  beforeEach(() => {
    busGraph = new BusGraph();
    mockToneRuntime = {
      Gain: class {
        gain = { value: 1, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        chain = () => {};
      },
      Filter: class {
        frequency = { value: 1000, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        Q = { value: 1, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
      },
      Distortion: class {
        distortion = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
      },
      FeedbackDelay: class {
        feedback = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        wet = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
      },
      Reverb: class {
        wet = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        generate = async () => {};
      },
      Channel: class {
        mute = false;
        connect = () => {};
      },
      Destination: {},
      getContext: () => ({ destination: {} })
    };
  });

  it('creates named buses and effect targets', async () => {
    await busGraph.initialize(mockToneRuntime);
    expect(busGraph.ready).toBe(true);
    
    // Buses
    expect(busGraph.getBus('drum')).toBeDefined();
    expect(busGraph.getBus('vocal')).toBeDefined();
    expect(busGraph.getBus('master')).toBeDefined();

    // Modulation Targets
    const count = busGraph.getRegisteredModulationTargetCount();
    expect(count).toBeGreaterThan(0);
  });

  it('getModulationTarget returns targets for all registry entries', () => {
    const target = busGraph.getModulationTarget('filter', 'cutoff');
    expect(target).toBeDefined();
    expect(target?.min).toBe(MODULATION_REGISTRY.filter.cutoff.min);
  });

  it('applyEffectParameter calls target automation', async () => {
    await busGraph.initialize(mockToneRuntime);
    
    const result = busGraph.applyEffectParameter('filter', 'cutoff', 500, 1);
    expect(result.success).toBe(true);
  });

  it('resetEffectParameter uses defaults', async () => {
    await busGraph.initialize(mockToneRuntime);
    
    const result = busGraph.resetEffectParameter('filter', 'cutoff', 800, 0);
    expect(result.success).toBe(true);
  });

  it('emergencyStopAudioGraph silences and resets', async () => {
    await busGraph.initialize(mockToneRuntime);
    
    const result = busGraph.emergencyStopAudioGraph();
    expect(result.success).toBe(true);
    expect(busGraph.getBus('drum').mute).toBe(true);
  });
});
