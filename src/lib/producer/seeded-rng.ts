export function hashSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRng(seed: string | number | undefined, scope = ''): () => number {
  const baseSeed = `${seed ?? 'wublabz'}::${scope}`;
  let state = hashSeed(baseSeed) || 1;

  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, precision = 1000): number {
  return Math.round(value * precision) / precision;
}

export function pickWeightedIndex(weights: number[], rng: () => number): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);

  if (total <= 0) {
    return 0;
  }

  let cursor = rng() * total;

  for (let index = 0; index < weights.length; index += 1) {
    cursor -= Math.max(weights[index] ?? 0, 0);
    if (cursor <= 0) {
      return index;
    }
  }

  return Math.max(weights.length - 1, 0);
}
