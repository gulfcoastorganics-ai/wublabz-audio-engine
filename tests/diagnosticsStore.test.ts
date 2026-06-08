import { describe, expect, it } from 'vitest';
import { EngineDiagnosticsStore } from '../src/lib/diagnostics/EngineDiagnosticsStore.js';

describe('EngineDiagnosticsStore', () => {
  it('returns serializable diagnostics only', () => {
    const store = new EngineDiagnosticsStore();

    store.update({
      engineReady: true,
      registeredBusCount: 8,
      registeredModulationTargetCount: 7,
      pendingMacroCount: 2,
      lastRouteError: 'Unsupported timeline event type: metadata'
    });

    expect(() => JSON.stringify(store.getDiagnostics())).not.toThrow();
    expect(JSON.parse(JSON.stringify(store.getDiagnostics()))).toMatchObject({
      engineReady: true,
      registeredBusCount: 8,
      registeredModulationTargetCount: 7,
      pendingMacroCount: 2,
      lastRouteError: 'Unsupported timeline event type: metadata'
    });
  });

  it('preserves unrelated fields on partial update', () => {
    const store = new EngineDiagnosticsStore();

    store.update({
      engineReady: true,
      transportState: 'playing',
      bpm: 140,
      currentScene: 'DROP_A'
    });
    store.update({ lastSchedulerError: 'No timeline loaded' });

    expect(store.getDiagnostics()).toMatchObject({
      engineReady: true,
      transportState: 'playing',
      bpm: 140,
      currentScene: 'DROP_A',
      lastSchedulerError: 'No timeline loaded'
    });
  });

  it('can represent emergency stop diagnostics without clearing unrelated counts', () => {
    const store = new EngineDiagnosticsStore();

    store.update({
      registeredBusCount: 8,
      registeredModulationTargetCount: 7,
      emergencyStopped: true,
      transportState: 'stopped',
      activeModulationCount: 0,
      pendingMacroCount: 0,
      queuedScene: '',
      currentScene: ''
    });

    expect(store.getDiagnostics()).toMatchObject({
      emergencyStopped: true,
      transportState: 'stopped',
      activeModulationCount: 0,
      pendingMacroCount: 0,
      registeredBusCount: 8,
      registeredModulationTargetCount: 7
    });
  });
});
