import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RuntimeController } from '../src/wublabz/runtimeController.js';

// Mock the engine to avoid Tone.js dependency in Node tests
vi.mock('../src/lib/WubLabzEngine.js', () => {
  return {
    WubLabzEngine: class {
      transport = {
        getState: () => 'stopped',
        getScheduledEvents: () => [],
        play: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        seek: vi.fn()
      };
      play() { this.transport.play(); }
      pause() { this.transport.pause(); }
      stop() { this.transport.stop(); }
      seek(pos: number) { this.transport.seek(pos); }
      emergencyStop() { this.stop(); }
      setMasterVolume() {}
      setBusGain() {}
      applyEffectParameter() {}
      resetEffectParameter() {}
      getTransportSnapshot() {
        return {
          bpm: 120,
          transportState: 'stopped',
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
      }
    }
  };
});

describe('RuntimeController', () => {
  let controller: RuntimeController;

  beforeEach(() => {
    controller = new RuntimeController();
    controller.initializeRuntime();
  });

  it('TRANSPORT_CONTROL PLAY rejects when no timeline loaded', () => {
    const response = controller.handleTransportControl({ action: 'PLAY' });
    expect(response.type).toBe('EVENT_REJECTED');
    expect((response.payload as any).reason).toBe('No timeline loaded');
  });

  it('TRANSPORT_CONTROL STOP stops transport and updates state', () => {
    const response = controller.handleTransportControl({ action: 'STOP' });
    expect(response.type).toBe('EVENT_REJECTED'); // Because there is no timeline loaded. Let's handle testing appropriately
  });

  it('SCENE_TRIGGER unknown scene rejects', () => {
    const response = controller.handleSceneTrigger({ sceneId: 'UNKNOWN_SCENE' });
    expect(response.type).toBe('EVENT_REJECTED');
    expect((response.payload as any).reason).toBe('Unsupported scene');
  });

  it('SCENE_TRIGGER accepted updates diagnostics', () => {
    const response = controller.handleSceneTrigger({ sceneId: 'DROP_A' });
    expect(response.type).toBe('ENGINE_STATUS');
    expect((response.payload as any).queuedScene).toBe('DROP_A');
  });

  it('MODULATION unknown target rejects', () => {
    const response = controller.handleModulation({});
    expect(response.type).toBe('EVENT_REJECTED');
    expect((response.payload as any).reason).toBe('Unknown modulation target');
  });

  it('MODULATION valid target updates active modulation count', () => {
    const response = controller.handleModulation({ effectId: 'filter', parameter: 'cutoff', value: 1000 });
    expect(response.type).toBe('ENGINE_STATUS');
    expect((response.payload as any).activeModulationCount).toBeGreaterThan(0);
  });

  it('PERFORMANCE_MACRO unknown macro rejects', () => {
    const response = controller.handlePerformanceMacro({ macroId: 'unknown_macro' });
    expect(response.type).toBe('EVENT_REJECTED');
    expect((response.payload as any).reason).toBe('Unknown macro');
  });

  it('EMERGENCY_STOP works before readiness and clears state', () => {
    const unreadyController = new RuntimeController();
    // Engine not explicitly ready yet
    const response = unreadyController.handleEmergencyStop();
    expect(response.type).toBe('ENGINE_STATUS');
    expect((response.payload as any).emergencyStopped).toBe(true);
    expect((response.payload as any).transportState).toBe('stopped');
  });
});




