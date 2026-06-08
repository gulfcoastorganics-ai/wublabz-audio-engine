import type { ProducerDiagnosticsSnapshot } from '../producer/types.js';

export interface EngineDiagnostics {
  engineReady: boolean;
  transportState: 'stopped' | 'loading' | 'playing' | 'paused' | 'seeking' | 'rendering';
  bpm: number;
  currentBar: number;
  currentBeat: number;
  currentPhrase: string | number;
  currentScene: string;
  queuedScene: string;
  activeModulationCount: number;
  registeredBusCount: number;
  scheduledEventCount: number;
  latencyMs: number;
  emergencyStopped: boolean;
  lastSchedulerError: string | null;
  lastAudioError: string | null;
  lastModulationError: string | null;
  lastSceneError: string | null;
  lastMacroError: string | null;
  producerState?: ProducerDiagnosticsSnapshot['producerState'];
  fatigueScore?: number;
  currentDropLevel?: number;
  motifCount?: number;
  recallCount?: number;
}

export class EngineDiagnosticsStore {
  private state: EngineDiagnostics = {
    engineReady: false,
    transportState: 'stopped',
    bpm: 120,
    currentBar: 0,
    currentBeat: 0,
    currentPhrase: '',
    currentScene: '',
    queuedScene: '',
    activeModulationCount: 0,
    registeredBusCount: 0,
    scheduledEventCount: 0,
    latencyMs: 0,
    emergencyStopped: false,
    lastSchedulerError: null,
    lastAudioError: null,
    lastModulationError: null,
    lastSceneError: null,
    lastMacroError: null,
    producerState: 'idle',
    fatigueScore: 0,
    currentDropLevel: 0,
    motifCount: 0,
    recallCount: 0,
  };

  getDiagnostics(): EngineDiagnostics {
    return { ...this.state };
  }

  update(partial: Partial<EngineDiagnostics>) {
    this.state = { ...this.state, ...partial };
  }

  updateProducerDiagnostics(snapshot: ProducerDiagnosticsSnapshot) {
    this.update(snapshot);
  }
}

