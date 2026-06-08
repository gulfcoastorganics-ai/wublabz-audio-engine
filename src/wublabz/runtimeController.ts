import { WubLabzEngine } from '../lib/WubLabzEngine.js';
import { EngineDiagnosticsStore } from '../lib/diagnostics/EngineDiagnosticsStore.js';
import { ModulationAdapter } from '../lib/audio/modulationAdapter.js';
import { runPerformanceMacro, cancelAllPendingMacros } from '../lib/audio/performanceMacros.js';
import { SceneScheduler } from '../lib/playback/sceneScheduler.js';
import type {
  ModulationPayload,
  PerformanceMacroPayload,
  SceneTriggerPayload,
  TransportControlPayload
} from './protocol.js';

export class RuntimeController {
  private engine: WubLabzEngine;
  private diagnostics: EngineDiagnosticsStore;
  private modulationAdapter: ModulationAdapter;
  private sceneScheduler: SceneScheduler;

  constructor() {
    this.engine = new WubLabzEngine();
    this.diagnostics = new EngineDiagnosticsStore();
    this.modulationAdapter = new ModulationAdapter(this.engine);
    this.sceneScheduler = new SceneScheduler();
  }

  initializeRuntime() {
    this.diagnostics.update({ engineReady: true, emergencyStopped: false });
  }

  getRuntimeDiagnostics() {
    // Try to advance scenes if playback is happening
    this.sceneScheduler.applyQueuedSceneIfBoundary(this.engine.transport.getState());
    
    // Engine automatically updates its internal BPM if needed, get a fresh snapshot
    const snapshot = this.engine.getTransportSnapshot();

    this.diagnostics.update({
      transportState: snapshot.transportState,
      bpm: snapshot.bpm,
      currentBeat: snapshot.currentBeat,
      currentBar: snapshot.currentBar,
      currentPhrase: snapshot.currentPhrase,
      scheduledEventCount: this.engine.transport.getScheduledEvents().length,
      activeModulationCount: this.modulationAdapter.getActiveModulationCount(),
      currentScene: this.sceneScheduler.getCurrentScene(),
      queuedScene: this.sceneScheduler.getQueuedScene(),
      // Track pending macros if you want to extend EngineDiagnostics in the future
    });
    return this.diagnostics.getDiagnostics();
  }

  handleTransportControl(payload: TransportControlPayload) {
    if (!this.diagnostics.getDiagnostics().engineReady) {
      return { type: 'EVENT_REJECTED', payload: { originalType: 'TRANSPORT_CONTROL', reason: "Engine not ready", timestamp: Date.now() } };
    }
    const events = this.engine.transport.getScheduledEvents();
    const requiresTimeline = payload.action === 'PLAY' || payload.action === 'SEEK';
    if (requiresTimeline && (!events || events.length === 0)) {
      this.diagnostics.update({ lastSchedulerError: "No timeline loaded" });
      return { type: 'EVENT_REJECTED', payload: { originalType: 'TRANSPORT_CONTROL', reason: "No timeline loaded", suggestedAction: "Upload/analyze/generate a remix first", timestamp: Date.now() } };
    }

    try {
      switch (payload.action) {
        case 'PLAY':
          this.engine.play();
          break;
        case 'PAUSE':
          this.engine.pause();
          break;
        case 'STOP':
          this.engine.stop();
          break;
        case 'SEEK':
          this.engine.seek(payload.positionSeconds || 0);
          break;
        case 'RESET':
          this.engine.stop();
          this.engine.seek(0);
          break;
        default:
          return { type: 'EVENT_REJECTED', payload: { originalType: 'TRANSPORT_CONTROL', reason: "Unknown transport action", timestamp: Date.now() } };
      }
      this.diagnostics.update({ transportState: this.engine.transport.getState() });
      return { type: 'ENGINE_STATUS', payload: this.getRuntimeDiagnostics() };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Transport command failed';
      this.diagnostics.update({ lastSchedulerError: reason });
      return { type: 'EVENT_REJECTED', payload: { originalType: 'TRANSPORT_CONTROL', reason, timestamp: Date.now() } };
    }
  }

  handleSceneTrigger(payload: SceneTriggerPayload) {
    if (!this.diagnostics.getDiagnostics().engineReady) {
      return { type: 'EVENT_REJECTED', payload: { originalType: 'SCENE_TRIGGER', reason: "Engine not ready", timestamp: Date.now() } };
    }

    const result = this.sceneScheduler.queueScene(payload.sceneId, payload.quantize);
    if (!result.success) {
      this.diagnostics.update({ lastSceneError: result.reason });
      return { type: 'EVENT_REJECTED', payload: { originalType: 'SCENE_TRIGGER', reason: result.reason, timestamp: Date.now() } };
    }

    return { type: 'ENGINE_STATUS', payload: this.getRuntimeDiagnostics() };
  }

  handleModulation(payload: ModulationPayload) {
    if (!this.diagnostics.getDiagnostics().engineReady) {
      return { type: 'EVENT_REJECTED', payload: { originalType: 'MODULATION', reason: "Engine not ready", timestamp: Date.now() } };
    }
    
    const result = this.modulationAdapter.applyModulation({
      effectId: payload.effectId,
      parameter: payload.parameter,
      value: payload.value,
      rampTime: payload.rampTime
    });

    if (!result.success) {
      this.diagnostics.update({ lastModulationError: result.reason });
      return { type: 'EVENT_REJECTED', payload: { originalType: 'MODULATION', reason: result.reason, timestamp: Date.now() } };
    }

    return { type: 'ENGINE_STATUS', payload: { ...this.getRuntimeDiagnostics(), sanitizedModulation: result.sanitized } };
  }

  handlePerformanceMacro(payload: PerformanceMacroPayload) {
    if (!this.diagnostics.getDiagnostics().engineReady) {
      return { type: 'EVENT_REJECTED', payload: { originalType: 'PERFORMANCE_MACRO', reason: "Engine not ready", timestamp: Date.now() } };
    }

    const snapshot = this.engine.getTransportSnapshot();

    const result = runPerformanceMacro(payload.macroId, { 
      intensity: payload.intensity,
      quantize: payload.quantize,
      durationBeats: payload.durationBeats,
      durationBars: payload.durationBars,
      transportSnapshot: snapshot
    }, this.modulationAdapter);
    
    if (!result.success) {
      const reason = result.reason || 'Unknown macro failure';
      this.diagnostics.update({ lastMacroError: reason });
      return { type: 'EVENT_REJECTED', payload: { originalType: 'PERFORMANCE_MACRO', reason: reason, timestamp: Date.now() } };
    }

    return { type: 'ENGINE_STATUS', payload: this.getRuntimeDiagnostics() };
  }

  handleEmergencyStop() {
    this.engine.emergencyStop();
    this.modulationAdapter.resetAllModulation();
    this.sceneScheduler.emergencyStopScenes();
    cancelAllPendingMacros();

    this.diagnostics.update({
      emergencyStopped: true,
      transportState: 'stopped',
      queuedScene: '',
      currentScene: '',
      activeModulationCount: 0,
      lastSchedulerError: null,
      lastAudioError: null,
      lastModulationError: null,
      lastSceneError: null,
      lastMacroError: null
    });

    return { type: 'ENGINE_STATUS', payload: this.getRuntimeDiagnostics() };
  }

  disposeRuntime() {
    this.engine.stop();
    cancelAllPendingMacros();
  }
}

