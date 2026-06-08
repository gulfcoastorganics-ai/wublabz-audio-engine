export type SceneQuantize = 'immediate' | 'nextBeat' | 'nextBar' | 'nextPhrase';

export interface TransportSnapshot {
  bpm: number;
  transportState: 'stopped' | 'playing' | 'paused' | 'seeking' | 'rendering' | 'loading';
  currentBeat: number;
  currentBar: number;
  currentPhrase: number;
  secondsPerBeat: number;
  secondsPerBar: number;
  phraseLengthBars: number;
  secondsUntilNextBeat?: number;
  secondsUntilNextBar?: number;
  secondsUntilNextPhrase?: number;
}

export function calculateSecondsPerBeat(bpm: number): number {
  if (bpm <= 0) return 0.5; // fallback to 120 bpm
  return 60 / bpm;
}

export function calculateSecondsPerBar(bpm: number, beatsPerBar: number = 4): number {
  return calculateSecondsPerBeat(bpm) * beatsPerBar;
}

export function calculateSecondsPerPhrase(bpm: number, phraseLengthBars: number = 4, beatsPerBar: number = 4): number {
  return calculateSecondsPerBar(bpm, beatsPerBar) * phraseLengthBars;
}

export function getSecondsUntilBoundary(snapshot: TransportSnapshot, quantize?: SceneQuantize): number {
  if (!quantize || quantize === 'immediate') return 0;

  if (quantize === 'nextBeat') {
    return snapshot.secondsUntilNextBeat ?? 0;
  }
  if (quantize === 'nextBar') {
    return snapshot.secondsUntilNextBar ?? 0;
  }
  if (quantize === 'nextPhrase') {
    return snapshot.secondsUntilNextPhrase ?? 0;
  }

  return 0;
}
