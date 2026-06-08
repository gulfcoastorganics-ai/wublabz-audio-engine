import { sanitizeModulationInput, getModulationTarget } from './modulationRegistry.js';
import type { WubLabzEngine } from '../WubLabzEngine.js';

export interface ModulationInput {
  effectId: string;
  parameter: string;
  value: number;
  rampTime?: number;
}

export class ModulationAdapter {
  private activeModulations: Map<string, number> = new Map();
  private lastError: string | null = null;

  constructor(private engine: WubLabzEngine) {}

  applyModulation(input: ModulationInput) {
    const { effectId, parameter, value, rampTime } = input;
    const validation = sanitizeModulationInput(effectId, parameter, value, rampTime);
    
    if (!validation.ok) {
      this.lastError = validation.error || 'Unknown error';
      return { success: false, reason: this.lastError };
    }

    const { sanitized, clamped } = validation;
    const targetKey = `${sanitized!.effectId}.${sanitized!.parameter}`;

    if (sanitized!.effectId === 'master' && sanitized!.parameter === 'volume') {
      this.engine.setMasterVolume(sanitized!.value, sanitized!.rampTime);
    } else {
      this.engine.applyEffectParameter(sanitized!.effectId, sanitized!.parameter, sanitized!.value, sanitized!.rampTime);
    }

    this.activeModulations.set(targetKey, sanitized!.value);
    this.lastError = null;

    return { success: true, clamped, sanitized };
  }

  resetModulationParameter(effectId: string, parameter: string) {
    const target = getModulationTarget(effectId, parameter);
    if (!target) return { success: false, reason: 'Unknown modulation target' };

    const targetKey = `${effectId}.${parameter}`;
    
    if (effectId === 'master' && parameter === 'volume') {
      this.engine.setMasterVolume(target.defaultValue, 0);
    } else {
      this.engine.resetEffectParameter(effectId, parameter, target.defaultValue);
    }
    
    this.activeModulations.delete(targetKey);
    return { success: true };
  }

  resetAllModulation() {
    for (const targetKey of this.activeModulations.keys()) {
      const [effectId, parameter] = targetKey.split('.');
      this.resetModulationParameter(effectId, parameter);
    }
    this.activeModulations.clear();
    this.lastError = null;
  }

  getActiveModulationCount() {
    return this.activeModulations.size;
  }

  getLastModulationError() {
    return this.lastError;
  }
}
