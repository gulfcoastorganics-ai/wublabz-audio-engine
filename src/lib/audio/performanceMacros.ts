import type { ModulationAdapter } from './modulationAdapter.js';
import { getSecondsUntilBoundary, type TransportSnapshot, type SceneQuantize } from '../playback/transportSnapshot.js';

export interface PerformanceMacroDefinition {
  id: string;
  description: string;
}

export const MACRO_REGISTRY: Record<string, PerformanceMacroDefinition> = {
  'filter_sweep_up': { id: 'filter_sweep_up', description: 'Filter cutoff sweep up over 4 beats' },
  'filter_sweep_down': { id: 'filter_sweep_down', description: 'Filter cutoff sweep down over 4 beats' },
  'delay_throw': { id: 'delay_throw', description: 'Delay feedback and wet burst' },
  'reverb_bloom': { id: 'reverb_bloom', description: 'Reverb wet increase over 1 bar' },
  'distortion_push': { id: 'distortion_push', description: 'Distortion drive increase over 2 beats' },
  'drop_impact': { id: 'drop_impact', description: 'Volume burst and reverb' },
  'fakeout_silence': { id: 'fakeout_silence', description: 'Mute master briefly' },
  'riser_build': { id: 'riser_build', description: 'Filter and reverb build over 1 bar' }
};

export function isKnownMacro(macroId: string): boolean {
  return !!MACRO_REGISTRY[macroId];
}

export function getMacroDefinitions() {
  return Object.values(MACRO_REGISTRY);
}

export interface MacroOptions {
  intensity?: number;
  quantize?: SceneQuantize;
  durationBeats?: number;
  durationBars?: number;
  transportSnapshot?: TransportSnapshot;
}

const pendingMacros: Map<string, ReturnType<typeof setTimeout>> = new Map();

export function cancelPendingMacro(macroId: string) {
  const timer = pendingMacros.get(macroId);
  if (timer) {
    clearTimeout(timer);
    pendingMacros.delete(macroId);
  }
}

export function cancelAllPendingMacros() {
  for (const timer of pendingMacros.values()) {
    clearTimeout(timer);
  }
  pendingMacros.clear();
}

export function getPendingMacroCount() {
  return pendingMacros.size;
}

export function runPerformanceMacro(macroId: string, options: MacroOptions, adapter: ModulationAdapter) {
  if (!isKnownMacro(macroId)) {
    return { success: false, reason: 'Unknown macro' };
  }

  let intensity = options.intensity ?? 1;
  if (intensity < 0) intensity = 0;
  if (intensity > 1) intensity = 1;

  const snapshot = options.transportSnapshot;
  let delaySeconds = 0;

  if (snapshot && options.quantize && options.quantize !== 'immediate') {
    delaySeconds = getSecondsUntilBoundary(snapshot, options.quantize);
  }

  if (delaySeconds > 0) {
    cancelPendingMacro(macroId); // Prevent duplicate build-up for the exact same macro target
    
    const timer = setTimeout(() => {
      pendingMacros.delete(macroId);
      executeMacroLogic(macroId, intensity, options, adapter);
    }, delaySeconds * 1000);

    pendingMacros.set(macroId, timer);
    return { success: true, delayed: true, delaySeconds };
  } else {
    return executeMacroLogic(macroId, intensity, options, adapter);
  }
}

function executeMacroLogic(macroId: string, intensity: number, options: MacroOptions, adapter: ModulationAdapter) {
  const results: any[] = [];
  const snapshot = options.transportSnapshot;
  
  // Default to 120 bpm values if no snapshot is provided
  const secPerBeat = snapshot?.secondsPerBeat ?? 0.5;
  const secPerBar = snapshot?.secondsPerBar ?? 2.0;

  const apply = (effectId: string, parameter: string, value: number, rampTime: number) => {
    results.push(adapter.applyModulation({ effectId, parameter, value, rampTime }));
  };

  switch (macroId) {
    case 'filter_sweep_up': {
      const duration = (options.durationBeats ?? 4) * secPerBeat;
      apply('filter', 'cutoff', 800 + (11200 * intensity), duration);
      break;
    }
    case 'filter_sweep_down': {
      const duration = (options.durationBeats ?? 4) * secPerBeat;
      apply('filter', 'cutoff', 800 - (550 * intensity), duration);
      break;
    }
    case 'delay_throw': {
      // 1 beat attack
      apply('delay', 'wet', 0.15 + (0.5 * intensity), 1 * secPerBeat);
      apply('delay', 'feedback', 0.25 + (0.4 * intensity), 1 * secPerBeat);
      break;
    }
    case 'reverb_bloom': {
      const duration = (options.durationBars ?? 1) * secPerBar;
      apply('reverb', 'wet', 0.2 + (0.65 * intensity), duration);
      break;
    }
    case 'distortion_push': {
      const duration = (options.durationBeats ?? 2) * secPerBeat;
      apply('distortion', 'drive', 0.75 * intensity, duration);
      break;
    }
    case 'drop_impact': {
      apply('master', 'volume', 0.85 + (0.15 * intensity), 0.05); // sub-beat impact
      apply('reverb', 'wet', 0.2 + (0.15 * intensity), 0.5 * secPerBeat);
      break;
    }
    case 'fakeout_silence': {
      apply('master', 'volume', 0, 0.05);
      // Determine restore time based on quantize or default to 1 beat
      let restoreDelay = 1 * secPerBeat;
      if (snapshot && options.quantize && options.quantize !== 'immediate') {
        restoreDelay = getSecondsUntilBoundary(snapshot, options.quantize);
      }
      
      cancelPendingMacro('fakeout_restore');
      const timer = setTimeout(() => {
        adapter.resetModulationParameter('master', 'volume');
        pendingMacros.delete('fakeout_restore');
      }, restoreDelay * 1000);
      pendingMacros.set('fakeout_restore', timer);
      break;
    }
    case 'riser_build': {
      // Build over 1 bar or until next phrase boundary
      let duration = 1 * secPerBar;
      if (snapshot && options.quantize === 'nextPhrase' && snapshot.secondsUntilNextPhrase) {
        duration = snapshot.secondsUntilNextPhrase;
      } else if (options.durationBars) {
        duration = options.durationBars * secPerBar;
      }
      
      apply('filter', 'cutoff', 800 + (6000 * intensity), duration);
      apply('reverb', 'wet', 0.2 + (0.4 * intensity), duration);
      break;
    }
  }

  return { success: true, delayed: false, results };
}
