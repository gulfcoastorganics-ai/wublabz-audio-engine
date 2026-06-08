import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ArrangementReconstructionEngine,
  EventScheduler,
  ProducerBrain,
  RemixBlueprintGenerator,
  SongDNAExtractor,
  StorageManager,
  createSeededRng
} from '../src/wublabz/index.js';
import type { AnalysisSnapshot, StemManifest } from '../src/lib/producer/types.js';

function createSnapshot(): AnalysisSnapshot {
  return {
    id: 'analysis-abc123',
    sourceName: 'fixture.wav',
    durationSeconds: 64,
    bpm: 128,
    beatsPerBar: 4,
    key: 'F minor',
    energy: 0.62,
    sectionBoundaries: [
      {
        id: 'intro-1',
        type: 'intro',
        startTime: 0,
        endTime: 8,
        startBeat: 0,
        endBeat: 16,
        startBar: 0,
        endBar: 4,
        energy: 0.2,
        transientDelta: 0.05
      },
      {
        id: 'drop-1',
        type: 'drop',
        startTime: 8,
        endTime: 24,
        startBeat: 16,
        endBeat: 48,
        startBar: 4,
        endBar: 12,
        energy: 0.8,
        transientDelta: 0.22
      }
    ],
    stemHints: ['drums', 'bass', 'music', 'fx']
  };
}

function createStemManifest(): StemManifest {
  return {
    id: 'stem-manifest-1',
    sourceId: 'analysis-abc123',
    stems: [
      {
        id: 'drums-1',
        role: 'drums',
        label: 'Drums',
        sourceId: 'analysis-abc123',
        energyWeight: 1,
        enabled: true
      },
      {
        id: 'bass-1',
        role: 'bass',
        label: 'Bass',
        sourceId: 'analysis-abc123',
        energyWeight: 0.9,
        enabled: true
      },
      {
        id: 'music-1',
        role: 'music',
        label: 'Music',
        sourceId: 'analysis-abc123',
        energyWeight: 0.85,
        enabled: true
      }
    ]
  };
}

describe('WubLabz harness', () => {
  it('imports the package entry and runs the deterministic core pipeline', () => {
    const snapshot = createSnapshot();
    const stemManifest = createStemManifest();

    const songDNA = new SongDNAExtractor().extract(snapshot, stemManifest);
    const strategy = new ProducerBrain().createStrategy(songDNA, { seed: 'harness-seed', targetGenre: 'electronic' });
    const blueprint = new RemixBlueprintGenerator().generate(strategy, songDNA, stemManifest);
    const timeline = new ArrangementReconstructionEngine().reconstruct(blueprint, songDNA, stemManifest, {
      seed: 'harness-seed'
    });
    const scheduled = new EventScheduler().schedule(timeline);

    expect(songDNA.sectionGrid.sections.map((section) => section.type)).toEqual(['intro', 'drop']);
    expect(strategy.sections).toHaveLength(songDNA.sectionGrid.sections.length);
    expect(blueprint.sections).toHaveLength(strategy.sections.length);
    expect(scheduled.length).toBeGreaterThan(0);
  });

  it('resolves storage paths and seeded randomness deterministically', () => {
    const storage = new StorageManager({ rootDir: '/tmp/wublabz-harness' });
    const rngA = createSeededRng('seed-a', 'scope');
    const rngB = createSeededRng('seed-a', 'scope');

    expect(storage.getExportDirectory('project-1')).toBe(path.join('/tmp/wublabz-harness', 'exports', 'project-1'));
    expect(rngA()).toBe(rngB());
  });
});
