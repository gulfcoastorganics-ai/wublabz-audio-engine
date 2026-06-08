export interface ModulationTargetDefinition {
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  rampMin: number;
  rampMax: number;
}

export const MODULATION_REGISTRY: Record<string, Record<string, ModulationTargetDefinition>> = {
  filter: {
    cutoff: { min: 20, max: 20000, defaultValue: 800, unit: 'Hz', rampMin: 0, rampMax: 2 },
    resonance: { min: 0.1, max: 20, defaultValue: 1, unit: 'Q', rampMin: 0, rampMax: 2 },
    active: { min: 0, max: 1, defaultValue: 1, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  distortion: {
    drive: { min: 0, max: 1, defaultValue: 0, unit: 'normalized', rampMin: 0, rampMax: 2 },
    active: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  delay: {
    feedback: { min: 0, max: 0.85, defaultValue: 0.25, unit: 'normalized', rampMin: 0, rampMax: 3 },
    wet: { min: 0, max: 1, defaultValue: 0.15, unit: 'normalized', rampMin: 0, rampMax: 3 },
    active: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  reverb: {
    wet: { min: 0, max: 1, defaultValue: 0.2, unit: 'normalized', rampMin: 0, rampMax: 4 },
    active: { min: 0, max: 1, defaultValue: 1, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  master: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
  },
  drum: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
    mute: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
    solo: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  bass: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
    mute: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
    solo: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  melody: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
    mute: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
    solo: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  vocal: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
    mute: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
    solo: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  },
  fx: {
    volume: { min: 0, max: 1, defaultValue: 0.85, unit: 'normalized', rampMin: 0, rampMax: 1 },
    mute: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
    solo: { min: 0, max: 1, defaultValue: 0, unit: 'boolean', rampMin: 0, rampMax: 0 },
  }
};

export function getModulationTarget(effectId: string, parameter: string): ModulationTargetDefinition | undefined {
  return MODULATION_REGISTRY[effectId]?.[parameter];
}

export function isKnownModulationTarget(effectId: string, parameter: string): boolean {
  return !!getModulationTarget(effectId, parameter);
}

export function sanitizeModulationInput(effectId: string, parameter: string, value: number, rampTime?: number) {
  const target = getModulationTarget(effectId, parameter);
  if (!target) {
    return { ok: false, error: 'Unknown modulation target' };
  }

  let clampedValue = value;
  let clampedRampTime = rampTime ?? 0;
  let clamped = false;

  if (clampedValue < target.min) { clampedValue = target.min; clamped = true; }
  if (clampedValue > target.max) { clampedValue = target.max; clamped = true; }

  if (clampedRampTime < target.rampMin) { clampedRampTime = target.rampMin; clamped = true; }
  if (clampedRampTime > target.rampMax) { clampedRampTime = target.rampMax; clamped = true; }

  return {
    ok: true,
    sanitized: {
      effectId,
      parameter,
      value: clampedValue,
      rampTime: clampedRampTime
    },
    clamped
  };
}

export function getAllModulationTargets() {
  const targets: string[] = [];
  for (const effectId in MODULATION_REGISTRY) {
    for (const parameter in MODULATION_REGISTRY[effectId]) {
      targets.push(`${effectId}.${parameter}`);
    }
  }
  return targets;
}
