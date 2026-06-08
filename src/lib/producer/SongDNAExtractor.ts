import type {
  AnalysisSnapshot,
  BeatGrid,
  PhraseGrid,
  SectionGrid,
  SectionType,
  SongDNA,
  StemManifest
} from './types.js';
import { clamp, hashSeed, roundTo } from './seeded-rng.js';

const DEFAULT_BEATS_PER_BAR = 4;
const DEFAULT_SECTION_ORDER: SectionType[] = [
  'intro',
  'build',
  'fakeout',
  'drop',
  'breakdown',
  'build_2',
  'second_drop',
  'outro'
];

function createBeatGrid(bpm: number, durationSeconds: number, beatsPerBar: number): BeatGrid {
  const secondsPerBeat = 60 / bpm;
  const bars = Math.max(1, Math.ceil(durationSeconds / (secondsPerBeat * beatsPerBar)));
  const entries = Array.from({ length: bars }, (_, barIndex) => {
    const startBeat = barIndex * beatsPerBar;
    const endBeat = startBeat + beatsPerBar;
    const startTime = roundTo(startBeat * secondsPerBeat);
    const endTime = roundTo(endBeat * secondsPerBeat);

    return {
      barIndex,
      startBeat,
      endBeat,
      startTime,
      endTime
    };
  });
  const downbeats = entries.map((entry) => entry.startBeat);

  return {
    bpm,
    beatsPerBar,
    bars: entries,
    downbeats
  };
}

function createPhraseGrid(totalBars: number): PhraseGrid {
  const arrangementBars = Math.max(totalBars, 32);
  const phraseSize = arrangementBars >= 32 ? 8 : 4;
  const phraseCount = Math.max(1, Math.ceil(arrangementBars / phraseSize));

  return {
    phrases: Array.from({ length: phraseCount }, (_, index) => {
      const startBar = index * phraseSize;
      return {
        id: `phrase-${index + 1}`,
        startBar,
        endBar: startBar + phraseSize,
        label: `Phrase ${index + 1}`
      };
    })
  };
}

function createSectionGrid(totalBars: number, energy: number): SectionGrid {
  const arrangementBars = Math.max(totalBars, 32);
  const sectionShape = DEFAULT_SECTION_ORDER;
  const sectionCount = sectionShape.length;
  let cursor = 0;

  return {
    sections: sectionShape.map((type, index) => {
      const remainingSections = sectionCount - index;
      const remainingBars = Math.max(arrangementBars - cursor, remainingSections);
      const size = index === sectionCount - 1 ? remainingBars : Math.max(1, Math.floor(remainingBars / remainingSections));
      const startBar = cursor;
      const endBar = startBar + size;
      cursor = endBar;

      const sectionEnergy = clamp(
        energy * (0.45 + index / Math.max(sectionCount - 1, 1) * 0.5),
        0.05,
        1
      );

      return {
        id: `${type}-${index + 1}`,
        type,
        startBar,
        endBar,
        energyLevel: roundTo(sectionEnergy),
        label: `${type.replace('_', ' ')} ${index + 1}`
      };
    })
  };
}

function createSectionGridFromBoundaries(snapshot: AnalysisSnapshot, totalBars: number): SectionGrid {
  const boundaries = snapshot.sectionBoundaries ?? [];
  if (!boundaries.length) {
    return createSectionGrid(totalBars, snapshot.energy);
  }

  return {
    sections: boundaries.map((boundary, index) => ({
      id: boundary.id,
      type: boundary.type,
      startBar: Math.max(0, roundTo(boundary.startBar)),
      endBar: Math.max(roundTo(boundary.startBar) + 0.25, roundTo(boundary.endBar)),
      energyLevel: roundTo(boundary.energy),
      label: `${boundary.type.replace('_', ' ')} ${index + 1}`
    }))
  };
}

function createMotifSeeds(sourceName: string, key: string, bpm: number): string[] {
  const base = hashSeed(`${sourceName}|${key}|${bpm}`);
  return [
    `motif-${base.toString(16)}`,
    `motif-${(base ^ 0x9e3779b9).toString(16)}`,
    `motif-${(base ^ 0x85ebca6b).toString(16)}`
  ];
}

export class SongDNAExtractor {
  extract(snapshot: AnalysisSnapshot, stemManifest?: StemManifest): SongDNA {
    const beatsPerBar = snapshot.beatsPerBar || DEFAULT_BEATS_PER_BAR;
    const beatGrid = snapshot.beatGrid ?? createBeatGrid(snapshot.bpm, snapshot.durationSeconds, beatsPerBar);
    const phraseGrid = createPhraseGrid(beatGrid.bars.length);
    const sectionGrid = createSectionGridFromBoundaries(snapshot, beatGrid.bars.length);

    const songDNA: SongDNA = {
      id: `${snapshot.id}-songdna`,
      sourceId: snapshot.id,
      sourceName: snapshot.sourceName,
      durationSeconds: snapshot.durationSeconds,
      bpm: snapshot.bpm,
      beatsPerBar,
      key: snapshot.key,
      energy: clamp(snapshot.energy, 0, 1),
      beatGrid,
      phraseGrid,
      sectionGrid,
      stemRoles:
        snapshot.stemHints?.length
          ? [...snapshot.stemHints]
          : stemManifest?.stems.map((stem) => stem.role) ?? ['drums', 'bass', 'music', 'fx'],
      motifSeeds: createMotifSeeds(snapshot.sourceName, snapshot.key, snapshot.bpm)
    };

    if (snapshot.genre) {
      songDNA.genre = snapshot.genre;
    }

    return songDNA;
  }
}
