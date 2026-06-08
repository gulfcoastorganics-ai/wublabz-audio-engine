import type {
  ProducerBrainOutput,
  RemixBlueprint,
  RemixBlueprintSection,
  SongDNA,
  StemDescriptor,
  StemManifest
} from './types.js';
import { clamp, roundTo } from './seeded-rng.js';

function selectStemId(role: string, stemManifest: StemManifest): string | undefined {
  const match = stemManifest.stems.find((stem) => stem.enabled && stem.role === role);
  return match?.id;
}

function buildStemInstructions(
  section: ProducerBrainOutput['sections'][number],
  stemManifest: StemManifest
): RemixBlueprintSection['stemInstructions'] {
  return [...section.activeStemRoles, ...section.placeholderStemRoles].map((role, index) => {
    const sourceStemId = selectStemId(role, stemManifest);

    const instruction: RemixBlueprintSection['stemInstructions'][number] = {
      role,
      intensity: roundTo(clamp(section.energyLevel * (role === 'drums' ? 1 : role === 'bass' ? 0.92 : 0.82), 0.05, 1)),
      enabled: true
    };

    if (sourceStemId) {
      instruction.sourceStemId = sourceStemId;
    } else {
      instruction.placeholderLabel = `placeholder-${section.id}-${role}-${index}`;
    }

    return instruction;
  });
}

function buildTransitionInstructions(
  section: ProducerBrainOutput['sections'][number]
): RemixBlueprintSection['transitionInstructions'] {
  return section.transitionTypes.map((type, index) => ({
    type,
    barOffset: type === 'silence' ? 0 : Math.max(0, index),
    durationBars: type === 'silence' ? 1 : type === 'fill' ? 1 : 2,
    probability: type === 'silence' ? 1 : type === 'transition' ? 0.9 : 0.75,
    intensity: roundTo(clamp(section.energyLevel * (type === 'impact' ? 1.1 : 0.85), 0.05, 1)),
    label: `${section.type}-${type}-${index + 1}`
  }));
}

export class RemixBlueprintGenerator {
  generate(strategy: ProducerBrainOutput, songDNA: SongDNA, stemManifest: StemManifest): RemixBlueprint {
    const sections = strategy.sections.map<RemixBlueprintSection>((section) => ({
      id: section.id,
      type: section.type,
      startBar: section.startBar,
      endBar: section.endBar,
      energyLevel: section.energyLevel,
      motifId: section.primaryMotif,
      stemInstructions: buildStemInstructions(section, stemManifest),
      transitionInstructions: buildTransitionInstructions(section),
      markerLabels: [
        `${section.type}-start`,
        `${section.type}-energy-${Math.round(section.energyLevel * 100)}`,
        `${section.primaryMotif}`
      ]
    }));

    const blueprint: RemixBlueprint = {
      id: `${songDNA.id}-blueprint`,
      sourceSongId: songDNA.id,
      seed: strategy.id,
      sections,
      motifPlan: strategy.motifPlan,
      metadata: {
        sourceBpm: songDNA.bpm,
        energy: songDNA.energy,
        generatedAt: 'deterministic'
      }
    };

    const targetGenre = strategy.targetGenre ?? songDNA.genre;
    if (targetGenre) {
      blueprint.targetGenre = targetGenre;
    }

    return blueprint;
  }
}
