import type { AudioBus, AudioBusName } from '../playback/AudioGraph.js';
import { getModulationTarget, MODULATION_REGISTRY } from './modulationRegistry.js';

// Fallback Tone.js mock or access (since full types aren't available in this project setup)
const Tone = (globalThis as any).Tone || { now: () => Date.now() / 1000, Destination: {} };

export class BusGraph {
  public ready = false;

  private preMasterNode: any;
  private filterNode: any;
  private distortionNode: any;
  private delayNode: any;
  private reverbNode: any;
  private masterGainNode: any;

  private inputBuses: Record<AudioBusName, any>;

  constructor() {
    this.inputBuses = {} as Record<AudioBusName, any>;
  }

  async initialize(toneRuntime: any) {
    if (this.ready || !toneRuntime) return;

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

    if (this.reverbNode.generate) {
      await this.reverbNode.generate(); 
    }
    
    for (const busName in this.inputBuses) {
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

  getBus(name: AudioBusName): any {
    return this.inputBuses[name];
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

      if (effectId === 'filter' && parameter === 'cutoff') targetParam = this.filterNode.frequency;
      else if (effectId === 'filter' && parameter === 'resonance') targetParam = this.filterNode.Q;
      else if (effectId === 'reverb' && parameter === 'wet') targetParam = this.reverbNode.wet;
      else if (effectId === 'delay' && parameter === 'feedback') targetParam = this.delayNode.feedback;
      else if (effectId === 'delay' && parameter === 'wet') targetParam = this.delayNode.wet;
      else if (effectId === 'distortion' && parameter === 'drive') targetParam = this.distortionNode.distortion;

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

  emergencyStopAudioGraph(): { success: boolean } {
    if (!this.ready) return { success: false };

    try {
      // Silence all buses
      for (const busName in this.inputBuses) {
        if (this.inputBuses[busName as AudioBusName].mute !== undefined) {
          this.inputBuses[busName as AudioBusName].mute = true;
        }
      }
      
      const now = Tone.now();

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
    } catch (e) {
      return { success: false };
    }
  }

  private safeAutomation(param: any, value: number, rampTime: number) {
    if (!param) return;
    
    if (param.cancelScheduledValues) {
      param.cancelScheduledValues(Tone.now());
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
    } catch (e) {
      param.value = value;
    }
  }
}

