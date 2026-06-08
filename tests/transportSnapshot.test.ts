import { describe, expect, it } from 'vitest';
import { calculateSecondsPerBeat, calculateSecondsPerBar, calculateSecondsPerPhrase, getSecondsUntilBoundary, type TransportSnapshot } from '../src/lib/playback/transportSnapshot.js';

describe('TransportSnapshot', () => {
  it('calculates beats correctly', () => {
    expect(calculateSecondsPerBeat(120)).toBe(0.5);
    expect(calculateSecondsPerBeat(60)).toBe(1.0);
    expect(calculateSecondsPerBeat(0)).toBe(0.5); // Fallback
  });

  it('calculates bars correctly', () => {
    expect(calculateSecondsPerBar(120, 4)).toBe(2.0);
    expect(calculateSecondsPerBar(60, 4)).toBe(4.0);
  });

  it('calculates phrases correctly', () => {
    expect(calculateSecondsPerPhrase(120, 4, 4)).toBe(8.0);
  });

  it('gets seconds until boundary', () => {
    const snapshot: TransportSnapshot = {
      bpm: 120,
      transportState: 'playing',
      currentBeat: 0,
      currentBar: 0,
      currentPhrase: 0,
      secondsPerBeat: 0.5,
      secondsPerBar: 2.0,
      phraseLengthBars: 4,
      secondsUntilNextBeat: 0.25,
      secondsUntilNextBar: 1.25,
      secondsUntilNextPhrase: 5.25
    };

    expect(getSecondsUntilBoundary(snapshot, 'immediate')).toBe(0);
    expect(getSecondsUntilBoundary(snapshot, 'nextBeat')).toBe(0.25);
    expect(getSecondsUntilBoundary(snapshot, 'nextBar')).toBe(1.25);
    expect(getSecondsUntilBoundary(snapshot, 'nextPhrase')).toBe(5.25);
  });
});
