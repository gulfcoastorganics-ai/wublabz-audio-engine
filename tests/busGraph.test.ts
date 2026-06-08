import { describe, expect, it, beforeEach } from 'vitest';
import { BusGraph } from '../src/lib/audio/BusGraph.js';
import { MODULATION_REGISTRY } from '../src/lib/audio/modulationRegistry.js';

describe('BusGraph', () => {
  let busGraph: BusGraph;
  let mockToneRuntime: any;
  let counters: { gain: number; channel: number; dispose: number };

  beforeEach(() => {
    busGraph = new BusGraph();
    counters = { gain: 0, channel: 0, dispose: 0 };
    mockToneRuntime = {
      Gain: class {
        gain = { value: 1, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        chain = () => {};
        constructor() { counters.gain += 1; }
        dispose = () => { counters.dispose += 1; };
      },
      Filter: class {
        frequency = { value: 1000, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        Q = { value: 1, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        dispose = () => { counters.dispose += 1; };
      },
      Distortion: class {
        distortion = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        dispose = () => { counters.dispose += 1; };
      },
      FeedbackDelay: class {
        feedback = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        wet = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        dispose = () => { counters.dispose += 1; };
      },
      Reverb: class {
        wet = { value: 0, cancelScheduledValues: () => {}, exponentialRampTo: () => {}, linearRampTo: () => {} };
        generate = async () => {};
        dispose = () => { counters.dispose += 1; };
      },
      Channel: class {
        mute = false;
        connect = () => {};
        constructor() { counters.channel += 1; }
        dispose = () => { counters.dispose += 1; };
      },
      Meter: class {
        getValue = () => 0;
        dispose = () => { counters.dispose += 1; };
      },
      Destination: {},
      getContext: () => ({ destination: {} }),
      now: () => 0
    };
  });

  it('creates named buses and effect targets', async () => {
    await busGraph.initialize(mockToneRuntime);
    expect(busGraph.ready).toBe(true);
    
    // Buses
    expect(busGraph.getBus('drum')).toBeDefined();
    expect(busGraph.getBus('vocal')).toBeDefined();
    expect(busGraph.getBus('master')).toBeDefined();
    expect(busGraph.getBus('drums')).toBe(busGraph.getBus('drum'));
    expect(busGraph.getBus('music')).toBe(busGraph.getBus('melody'));
    expect(busGraph.getBus('vocals')).toBe(busGraph.getBus('vocal'));
    expect(busGraph.getRegisteredBusCount()).toBe(8);

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

  it('initialize is idempotent and does not duplicate buses', async () => {
    await busGraph.initialize(mockToneRuntime);
    await busGraph.initialize(mockToneRuntime);

    expect(busGraph.ready).toBe(true);
    expect(counters.channel).toBe(8);
    expect(counters.gain).toBe(2);
    expect(busGraph.getRegisteredBusCount()).toBe(8);
  });

  it('reset unmutes buses without creating node churn', async () => {
    await busGraph.initialize(mockToneRuntime);
    const drumBus = busGraph.getBus('drum');

    busGraph.emergencyStopAudioGraph();
    expect(drumBus.mute).toBe(true);

    const result = busGraph.reset();

    expect(result.success).toBe(true);
    expect(busGraph.getBus('drum')).toBe(drumBus);
    expect(busGraph.getBus('drum').mute).toBe(false);
    expect(counters.channel).toBe(8);
  });

  it('dispose clears graph references and registered buses', async () => {
    await busGraph.initialize(mockToneRuntime);

    const result = busGraph.dispose();

    expect(result.success).toBe(true);
    expect(busGraph.ready).toBe(false);
    expect(busGraph.getRegisteredBusCount()).toBe(0);
    expect(counters.dispose).toBeGreaterThan(0);
  });
});
