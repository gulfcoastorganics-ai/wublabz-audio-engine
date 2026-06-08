import type { AudioBus, AudioBusName } from '../playback/AudioGraph.js';
import { getModulationTarget, MODULATION_REGISTRY } from './modulationRegistry.js';

// Fallback Tone.js mock or access (since full types aren't available in this project setup)
const Tone = (globalThis as any).Tone || { now: () => Date.now() / 1000, Destination: {} };
export type PublicAudioBusName = AudioBusName | 'drums' | 'music' | 'vocals';

const PUBLIC_BUS_ALIASES: Record<'drums' | 'music' | 'vocals', AudioBusName> = {
  drums: 'drum',
  music: 'melody',
  vocals: 'vocal'
};

export class BusGraph {
  public ready = false;

  private preMasterNode: any;
  private filterNode: any;
  private distortionNode: any;
  private delayNode: any;
  private reverbNode: any;
  private masterGainNode: any;

  private inputBuses: Record<AudioBusName, any>;
  private busMeters: Record<AudioBusName, any>;
  private toneRuntime: any;

  constructor() {
    this.inputBuses = {} as Record<AudioBusName, any>;
    this.busMeters = {} as Record<AudioBusName, any>;
  }

  async initialize(toneRuntime: any) {
    if (this.ready || !toneRuntime) return;

    this.toneRuntime = toneRuntime;
    this.preMasterNode = new toneRuntime.Gain(1);
    this.filterNode = new toneRuntime.Filter({
      frequency: MODULATION_REGISTRY.filter.cutoff.defaultValue,
      Q: MODULATION_REGISTRY.filter.resonance.defaultValue,
      type: 'lowpass'
    });
    this.distortionNode = new toneRuntime.Distortion({
      distortion: MODULATION_REGISTRY.distortion.drive.defaultValue
    });
    this.delayNode = new toneRuntime.FeedbackDelay({
      feedback: MODULATION_REGISTRY.delay.feedback.defaultValue,
      wet: MODULATION_REGISTRY.delay.wet.defaultValue
    });
    this.reverbNode = new toneRuntime.Reverb({
      wet: MODULATION_REGISTRY.reverb.wet.defaultValue,
      decay: 2
    });
    this.masterGainNode = new toneRuntime.Gain({
      gain: MODULATION_REGISTRY.master.volume.defaultValue
    });

    this.inputBuses = {
      master: new toneRuntime.Channel(),
      drum: new toneRuntime.Channel(),
      bass: new toneRuntime.Channel(),
      melody: new toneRuntime.Channel(),
      vocal: new toneRuntime.Channel(),
      fx: new toneRuntime.Channel(),
      preview: new toneRuntime.Channel(),
      render: new toneRuntime.Channel()
    };

    this.busMeters = {
      master: new toneRuntime.Meter(),
      drum: new toneRuntime.Meter(),
      bass: new toneRuntime.Meter(),
      melody: new toneRuntime.Meter(),
      vocal: new toneRuntime.Meter(),
      fx: new toneRuntime.Meter(),
      preview: new toneRuntime.Meter(),
      render: new toneRuntime.Meter()
    };

    if (this.reverbNode.generate) {
      await this.reverbNode.generate(); 
    }
    
    for (const busName in this.inputBuses) {
      const bus = this.inputBuses[busName as AudioBusName];
      const meter = this.busMeters[busName as AudioBusName];
      
      if (bus && meter) {
        bus.connect(meter);
      }

      if (busName !== 'master') {
        this.inputBuses[busName as AudioBusName].connect(this.preMasterNode);
      }
    }

    this.inputBuses.master.connect(this.preMasterNode);

    this.preMasterNode.chain(
      this.filterNode,
      this.distortionNode,
      this.delayNode,
      this.reverbNode,
      this.masterGainNode,
      toneRuntime.Destination || toneRuntime.getContext().destination
    );

    this.ready = true;
  }

  getBus(name: PublicAudioBusName): any {
    return this.inputBuses[resolvePublicBusName(name)];
  }

  getBusLevels(): Record<string, number> {
    const levels: Record<string, number> = {};
    if (!this.ready) return levels;

    for (const busName in this.busMeters) {
      const meter = this.busMeters[busName as AudioBusName];
      if (meter) {
        try {
          const val = meter.getValue();
          levels[busName] = Array.isArray(val) ? val[0] : val;
        } catch {
          levels[busName] = -Infinity;
        }
      }
    }
    return levels;
  }

  getRegisteredBusCount(): number {
    return Object.keys(this.inputBuses).length;
  }

  getModulationTarget(effectId: string, parameter: string) {
    return getModulationTarget(effectId, parameter);
  }

  getRegisteredModulationTargetCount(): number {
    let count = 0;
    for (const effectId in MODULATION_REGISTRY) {
      count += Object.keys(MODULATION_REGISTRY[effectId]).length;
    }
    return count;
  }

  applyEffectParameter(effectId: string, parameter: string, value: number, rampTime: number = 0): { success: boolean, reason?: string } {
    if (!this.ready) return { success: false, reason: 'BusGraph not initialized' };

    try {
      let targetParam: any;

      if (effectId === 'filter') {
        if (parameter === 'cutoff') targetParam = this.filterNode.frequency;
        else if (parameter === 'resonance') targetParam = this.filterNode.Q;
        else if (parameter === 'active') {
          // Simplistic bypass: if active is 0, set frequency to max (open)
          const openFreq = 20000;
          this.safeAutomation(this.filterNode.frequency, value === 1 ? MODULATION_REGISTRY.filter.cutoff.defaultValue : openFreq, rampTime);
          return { success: true };
        }
      } else if (effectId === 'reverb') {
        if (parameter === 'wet') targetParam = this.reverbNode.wet;
        else if (parameter === 'active') {
          this.safeAutomation(this.reverbNode.wet, value === 1 ? MODULATION_REGISTRY.reverb.wet.defaultValue : 0, rampTime);
          return { success: true };
        }
      } else if (effectId === 'delay') {
        if (parameter === 'feedback') targetParam = this.delayNode.feedback;
        else if (parameter === 'wet') targetParam = this.delayNode.wet;
        else if (parameter === 'active') {
          this.safeAutomation(this.delayNode.wet, value === 1 ? MODULATION_REGISTRY.delay.wet.defaultValue : 0, rampTime);
          return { success: true };
        }
      } else if (effectId === 'distortion') {
        if (parameter === 'drive') targetParam = this.distortionNode.distortion;
        else if (parameter === 'active') {
          this.safeAutomation(this.distortionNode.distortion, value === 1 ? MODULATION_REGISTRY.distortion.drive.defaultValue : 0, rampTime);
          return { success: true };
        }
      } else if (this.inputBuses[effectId as AudioBusName]) {
        const bus = this.inputBuses[effectId as AudioBusName];
        if (parameter === 'volume') targetParam = bus.volume;
        else if (parameter === 'mute') {
          bus.mute = value === 1;
          return { success: true };
        } else if (parameter === 'solo') {
          bus.solo = value === 1;
          return { success: true };
        }
      }

      if (!targetParam) {
        return { success: false, reason: `No physical parameter mapped for ${effectId}.${parameter}` };
      }

      this.safeAutomation(targetParam, value, rampTime);
      return { success: true };
    } catch (err: any) {
      return { success: false, reason: err.message };
    }
  }

  resetEffectParameter(effectId: string, parameter: string, defaultValue: number, rampTime: number = 0): { success: boolean, reason?: string } {
    return this.applyEffectParameter(effectId, parameter, defaultValue, rampTime);
  }

  setMasterVolume(value: number, rampTime: number = 0): { success: boolean, reason?: string } {
    if (!this.ready) return { success: false, reason: 'BusGraph not initialized' };

    try {
      this.safeAutomation(this.masterGainNode.gain, value, rampTime);
      return { success: true };
    } catch (err: any) {
      return { success: false, reason: err.message };
    }
  }

  resetAllEffects(registryDefaults: Record<string, Record<string, any>>): { success: boolean } {
    for (const effectId in registryDefaults) {
      for (const parameter in registryDefaults[effectId]) {
        const def = registryDefaults[effectId][parameter];
        if (effectId === 'master' && parameter === 'volume') {
          this.setMasterVolume(def.defaultValue, 0);
        } else {
          this.resetEffectParameter(effectId, parameter, def.defaultValue, 0);
        }
      }
    }
    return { success: true };
  }

  reset(): { success: boolean; reason?: string } {
    if (!this.ready) return { success: false, reason: 'BusGraph not initialized' };

    for (const busName in this.inputBuses) {
      const bus = this.inputBuses[busName as AudioBusName];
      if (bus && bus.mute !== undefined) {
        bus.mute = false;
      }
      if (bus && bus.solo !== undefined) {
        bus.solo = false;
      }
    }

    this.resetAllEffects(MODULATION_REGISTRY);
    return { success: true };
  }

  dispose(): { success: boolean } {
    for (const busName in this.inputBuses) {
      disposeNode(this.inputBuses[busName as AudioBusName]);
    }

    for (const busName in this.busMeters) {
      disposeNode(this.busMeters[busName as AudioBusName]);
    }

    disposeNode(this.preMasterNode);
    disposeNode(this.filterNode);
    disposeNode(this.distortionNode);
    disposeNode(this.delayNode);
    disposeNode(this.reverbNode);
    disposeNode(this.masterGainNode);

    this.inputBuses = {} as Record<AudioBusName, any>;
    this.busMeters = {} as Record<AudioBusName, any>;
    this.preMasterNode = undefined;
    this.filterNode = undefined;
    this.distortionNode = undefined;
    this.delayNode = undefined;
    this.reverbNode = undefined;
    this.masterGainNode = undefined;
    this.toneRuntime = undefined;
    this.ready = false;

    return { success: true };
  }

  emergencyStopAudioGraph(): { success: boolean } {
    if (!this.ready) return { success: false };

    try {
      // Silence all buses
      for (const busName in this.inputBuses) {
        if (this.inputBuses[busName as AudioBusName].mute !== undefined) {
          this.inputBuses[busName as AudioBusName].mute = true;
        }
      }
      
      const now = this.now();

      // Reset master to 0
      this.safeAutomation(this.masterGainNode.gain, 0, 0);
      
      // Clear pending automation
      if (this.masterGainNode.gain.cancelScheduledValues) this.masterGainNode.gain.cancelScheduledValues(now);
      if (this.filterNode.frequency.cancelScheduledValues) this.filterNode.frequency.cancelScheduledValues(now);
      if (this.filterNode.Q.cancelScheduledValues) this.filterNode.Q.cancelScheduledValues(now);
      if (this.reverbNode.wet.cancelScheduledValues) this.reverbNode.wet.cancelScheduledValues(now);
      if (this.delayNode.feedback.cancelScheduledValues) this.delayNode.feedback.cancelScheduledValues(now);
      if (this.delayNode.wet.cancelScheduledValues) this.delayNode.wet.cancelScheduledValues(now);
      if (this.distortionNode.distortion.cancelScheduledValues) this.distortionNode.distortion.cancelScheduledValues(now);

      return { success: true };
    } catch {
      return { success: false };
    }
  }

  private safeAutomation(param: any, value: number, rampTime: number) {
    if (!param) return;
    
    if (param.cancelScheduledValues) {
      param.cancelScheduledValues(this.now());
    }
    
    if (rampTime <= 0) {
      param.value = value;
      return;
    }

    try {
      if (param === this.filterNode.frequency && value > 0 && param.value > 0 && param.exponentialRampTo) {
        param.exponentialRampTo(value, rampTime);
      } else if (param.linearRampTo) {
        param.linearRampTo(value, rampTime);
      } else {
        param.value = value;
      }
    } catch {
      param.value = value;
    }
  }

  private now(): number {
    if (this.toneRuntime && typeof this.toneRuntime.now === 'function') {
      return this.toneRuntime.now();
    }

    return Tone.now();
  }
}

function resolvePublicBusName(name: PublicAudioBusName): AudioBusName {
  if (name === 'drums' || name === 'music' || name === 'vocals') {
    return PUBLIC_BUS_ALIASES[name];
  }

  return name;
}

function disposeNode(node: any): void {
  if (node && typeof node.dispose === 'function') {
    node.dispose();
  }
}
