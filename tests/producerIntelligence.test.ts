import { describe, expect, it } from 'vitest';
import { EngineDiagnosticsStore } from '../src/lib/diagnostics/EngineDiagnosticsStore.js';
import { ArrangementReconstructionEngine } from '../src/lib/producer/ArrangementReconstructionEngine.js';
import { MotifMemory } from '../src/lib/producer/MotifMemory.js';
import { ProducerBrain } from '../src/lib/producer/ProducerBrain.js';
import { RemixBlueprintGenerator } from '../src/lib/producer/RemixBlueprintGenerator.js';
import {
  FAKEOUT_SUPPRESSION_THRESHOLD,
  FATIGUE_VARIATION_THRESHOLD,
  RepetitionFatigue
} from '../src/lib/producer/RepetitionFatigue.js';
import type { SongDNA, StemManifest } from '../src/lib/producer/types.js';

const mockDNA: SongDNA = {
  id: 'test-song',
  sourceId: 'src-1',
  sourceName: 'Test Song',
  bpm: 120,
  key: 'C_MAJOR',
  beatsPerBar: 4,
  durationSeconds: 120,
  energy: 0.5,
  beatGrid: { bpm: 120, beatsPerBar: 4, bars: [], downbeats: [] },
  phraseGrid: { phrases: [] },
  sectionGrid: {
    sections: [
      { id: 'sec-1', type: 'intro', startBar: 0, endBar: 8, energyLevel: 0.3 },
      { id: 'sec-2', type: 'build', startBar: 8, endBar: 16, energyLevel: 0.6 },
      { id: 'sec-3', type: 'drop', startBar: 16, endBar: 32, energyLevel: 0.9 },
      { id: 'sec-4', type: 'fakeout', startBar: 32, endBar: 36, energyLevel: 0.4 },
      { id: 'sec-5', type: 'fakeout', startBar: 36, endBar: 40, energyLevel: 0.4 },
      { id: 'sec-6', type: 'second_drop', startBar: 40, endBar: 56, energyLevel: 1.0 },
      { id: 'sec-7', type: 'outro', startBar: 56, endBar: 64, energyLevel: 0.2 }
    ]
  },
  stemRoles: ['drums', 'bass', 'music', 'vocal', 'fx'],
  motifSeeds: ['seedA', 'seedB']
};

const stemManifest: StemManifest = {
  id: 'test-stem-manifest',
  sourceId: 'src-1',
  stems: [
    { id: 'drums-1', role: 'drums', label: 'Drums', sourceId: 'src-1', energyWeight: 1, enabled: true },
    { id: 'bass-1', role: 'bass', label: 'Bass', sourceId: 'src-1', energyWeight: 0.9, enabled: true },
    { id: 'music-1', role: 'music', label: 'Music', sourceId: 'src-1', energyWeight: 0.8, enabled: true },
    { id: 'fx-1', role: 'fx', label: 'FX', sourceId: 'src-1', energyWeight: 0.7, enabled: true }
  ]
};

function createDNA(id: string, sections: SongDNA['sectionGrid']['sections'], motifSeeds = mockDNA.motifSeeds): SongDNA {
  return {
    ...mockDNA,
    id,
    sectionGrid: { sections },
    motifSeeds: [...motifSeeds]
  };
}

describe('Producer Intelligence', () => {
  it('tracks motif memory', () => {
    const brain = new ProducerBrain();
    const strategy = brain.createStrategy(mockDNA);

    expect(brain.motifMemory.getMotifCount()).toBeGreaterThan(0);
    expect(brain.motifMemory.getMotifHistory().length).toBeGreaterThan(0);
  });

  it('returns defensive motif clones from recallMotif', () => {
    const memory = new MotifMemory();
    memory.registerMotif({
      id: 'motif-a',
      type: 'primary',
      phraseLength: 4,
      energy: 0.5,
      sectionOrigin: 'intro'
    });

    const recalled = memory.recallMotif('motif-a');
    expect(recalled).toBeDefined();

    recalled!.recurrenceCount = 99;
    recalled!.lastUsedBar = 128;
    recalled!.energy = 1;

    const stored = memory.recallMotif('motif-a');
    expect(stored?.recurrenceCount).toBe(0);
    expect(stored?.lastUsedBar).toBe(-1);
    expect(stored?.energy).toBe(0.5);
  });

  it('tracks phrase recall', () => {
    const brain = new ProducerBrain();
    brain.createStrategy(mockDNA);

    expect(brain.phraseRecall.getRecallCount()).toBeGreaterThan(0);
  });

  it('escalates drops', () => {
    const brain = new ProducerBrain();
    const strategy = brain.createStrategy(mockDNA);

    const firstDrop = strategy.sections.find(s => s.type === 'drop');
    const secondDrop = strategy.sections.find(s => s.type === 'second_drop');

    expect(firstDrop).toBeDefined();
    expect(secondDrop).toBeDefined();
    expect(secondDrop!.energyLevel).toBeGreaterThanOrEqual(firstDrop!.energyLevel);
  });

  it('applies drop escalation recommendations to the current drop in order', () => {
    const dropDNA = createDNA('drop-escalation-song', [
      { id: 'drop-sec-1', type: 'intro', startBar: 0, endBar: 8, energyLevel: 0.2 },
      { id: 'drop-sec-2', type: 'drop', startBar: 8, endBar: 16, energyLevel: 0.2 },
      { id: 'drop-sec-3', type: 'second_drop', startBar: 16, endBar: 24, energyLevel: 0.2 },
      { id: 'drop-sec-4', type: 'drop', startBar: 24, endBar: 32, energyLevel: 0.2 }
    ]);
    const strategy = new ProducerBrain().createStrategy(dropDNA, { seed: 'drop-order' });

    expect(strategy.sections.find(s => s.id === 'drop-sec-2')?.energyLevel).toBe(0.7);
    expect(strategy.sections.find(s => s.id === 'drop-sec-3')?.energyLevel).toBe(0.85);
    expect(strategy.sections.find(s => s.id === 'drop-sec-4')?.energyLevel).toBe(1);
  });

  it('triggers deterministic callback motifs when fatigue mitigation recalls a phrase', () => {
    const callbackDNA = createDNA('callback-song', [
      { id: 'callback-sec-1', type: 'build', startBar: 0, endBar: 8, energyLevel: 0.4 },
      { id: 'callback-sec-2', type: 'build', startBar: 8, endBar: 16, energyLevel: 0.4 },
      { id: 'callback-sec-3', type: 'build', startBar: 16, endBar: 24, energyLevel: 0.4 },
      { id: 'callback-sec-4', type: 'build', startBar: 40, endBar: 48, energyLevel: 0.4 }
    ]);
    const brain = new ProducerBrain();
    const strategy = brain.createStrategy(callbackDNA, { seed: 'callback-seed' });
    const callbackSection = strategy.sections.find(s => s.id === 'callback-sec-4');

    expect(callbackSection?.primaryMotif).toBe('callback-build-build-40:callback');
    expect(brain.motifMemory.recallMotif(callbackSection!.primaryMotif)).toBeDefined();
  });

  it('mitigates repetition fatigue (suppress repeated fakeout)', () => {
    const brain = new ProducerBrain();
    const originalTypes = mockDNA.sectionGrid.sections.map(s => s.type);
    const strategy = brain.createStrategy(mockDNA);

    const fakeouts = strategy.sections.filter(s => s.type === 'fakeout');
    // Original DNA had 2 fakeouts in a row. 
    // The fatigue logic should convert the second one to a breakdown.
    expect(fakeouts.length).toBeLessThan(2);
    const breakdown = strategy.sections.find(s => s.id === 'sec-5');
    expect(breakdown?.type).toBe('breakdown');
    expect(mockDNA.sectionGrid.sections.map(s => s.type)).toEqual(originalTypes);
  });

  it('scores repeated fakeouts higher than repeated drops or builds', () => {
    const fakeoutFatigue = new RepetitionFatigue();
    fakeoutFatigue.trackSection('fakeout');
    fakeoutFatigue.trackSection('fakeout');
    expect(fakeoutFatigue.getFatigueScore()).toBeGreaterThanOrEqual(FAKEOUT_SUPPRESSION_THRESHOLD);

    const dropFatigue = new RepetitionFatigue();
    dropFatigue.trackSection('drop');
    dropFatigue.trackSection('drop');
    expect(dropFatigue.getFatigueScore()).toBeGreaterThan(0);
    expect(dropFatigue.getFatigueScore()).toBeLessThan(FAKEOUT_SUPPRESSION_THRESHOLD);

    const buildFatigue = new RepetitionFatigue();
    buildFatigue.trackSection('build');
    buildFatigue.trackSection('build');
    buildFatigue.trackSection('build');
    buildFatigue.trackSection('build');
    expect(buildFatigue.getFatigueScore()).toBeGreaterThanOrEqual(FATIGUE_VARIATION_THRESHOLD);
    expect(buildFatigue.getFatigueScore()).toBeLessThan(FAKEOUT_SUPPRESSION_THRESHOLD);
  });

  it('handles empty motif seeds deterministically', () => {
    const emptyMotifDNA = createDNA('empty-motif-song', [
      { id: 'empty-sec-1', type: 'intro', startBar: 0, endBar: 8, energyLevel: 0.2 },
      { id: 'empty-sec-2', type: 'drop', startBar: 8, endBar: 16, energyLevel: 0.6 }
    ], []);

    const first = new ProducerBrain().createStrategy(emptyMotifDNA, { seed: 'empty-seed' });
    const second = new ProducerBrain().createStrategy(emptyMotifDNA, { seed: 'empty-seed' });

    expect(first.motifPlan).toEqual(second.motifPlan);
    expect(first.motifPlan.every(motif => motif.length > 0)).toBe(true);
    expect(first.motifPlan[0]).toContain('motif-empty-motif-song-fallback');
  });

  it('updates EngineDiagnosticsStore with explicit producer diagnostics', () => {
    const brain = new ProducerBrain();
    brain.createStrategy(mockDNA);
    const diagnostics = new EngineDiagnosticsStore();

    diagnostics.updateProducerDiagnostics(brain.getDiagnosticsSnapshot());

    expect(diagnostics.getDiagnostics().producerState).toBe('complete');
    expect(diagnostics.getDiagnostics().fatigueScore).toBeGreaterThan(0);
    expect(diagnostics.getDiagnostics().currentDropLevel).toBe(2);
    expect(diagnostics.getDiagnostics().motifCount).toBeGreaterThan(0);
    expect(diagnostics.getDiagnostics().recallCount).toBeGreaterThan(0);
  });

  it('propagates fakeout suppression through blueprint and reconstructed events', () => {
    const brain = new ProducerBrain();
    const strategy = brain.createStrategy(mockDNA, { seed: 'arrangement-seed' });
    const blueprint = new RemixBlueprintGenerator().generate(strategy, mockDNA, stemManifest);
    const timeline = new ArrangementReconstructionEngine().reconstruct(blueprint, mockDNA, stemManifest, {
      seed: 'arrangement-seed'
    });

    const strategySection = strategy.sections.find(s => s.id === 'sec-5');
    const blueprintSection = blueprint.sections.find(s => s.id === 'sec-5');
    const reconstructedEvents = timeline.filter(event => event.sectionId === 'sec-5');

    expect(strategySection?.type).toBe('breakdown');
    expect(blueprintSection?.type).toBe('breakdown');
    expect(reconstructedEvents.some(event => event.payload.fakeout === true)).toBe(false);
    expect(reconstructedEvents.some(event => event.payload.sectionType === 'fakeout')).toBe(false);
    expect(reconstructedEvents.some(event => event.payload.sectionType === 'breakdown')).toBe(true);
    expect(reconstructedEvents.some(event => event.type === 'marker' && event.payload.label === 'breakdown-start')).toBe(true);
  });
});
