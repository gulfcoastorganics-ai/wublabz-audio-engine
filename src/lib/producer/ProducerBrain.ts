import type {
  ProducerDiagnosticsSnapshot,
  ProducerBrainOptions,
  ProducerBrainOutput,
  ProducerSectionStrategy,
  ProducerState,
  SectionType,
  SongDNA,
  StemRole
} from './types.js';
import { clamp, createSeededRng, pickWeightedIndex, roundTo } from './seeded-rng.js';
import { MotifMemory } from './MotifMemory.js';
import { PhraseRecall, type CallbackType } from './PhraseRecall.js';
import { DropEscalation } from './DropEscalation.js';
import {
  FAKEOUT_SUPPRESSION_THRESHOLD,
  FATIGUE_VARIATION_THRESHOLD,
  RepetitionFatigue
} from './RepetitionFatigue.js';

export interface MotifDecisionMetadata {
  motifId: string;
  source: 'motif-memory' | 'stable-evolution';
}

export interface CallbackDecisionMetadata extends MotifDecisionMetadata {
  callbackType: CallbackType;
  sectionType: SectionType;
  currentBar: number;
}

export interface DensityDecisionMetadata {
  dropCount: number;
  intensity: number;
  density: number;
  description: string;
}

export interface VariationDecisionMetadata {
  variationId: string;
  sectionType: SectionType;
  currentBar: number;
  source: 'stable-evolution';
}

export interface FakeoutSuppressionDecisionMetadata {
  from: 'fakeout';
  to: 'breakdown';
  fatigueScore: number;
  threshold: number;
}

type ProducerDecisionWithoutMetadata =
  | 'reuse motif'
  | 'add bass fill'
  | 'insert fakeout'
  | 'reduce density'
  | 'add variation'
  | 'none';

export type ProducerDecision =
  | { action: ProducerDecisionWithoutMetadata; reason: string }
  | { action: 'trigger callback'; reason: string; metadata: CallbackDecisionMetadata }
  | { action: 'suppress fakeout'; reason: string; metadata: FakeoutSuppressionDecisionMetadata }
  | { action: 'increase drop density'; reason: string; metadata: DensityDecisionMetadata }
  | { action: 'evolve motif'; reason: string; metadata: VariationDecisionMetadata };

const ROLE_PRIORITY: StemRole[] = ['drums', 'bass', 'music', 'lead', 'vocal', 'fx', 'texture', 'perc', 'noise'];

function weightedRoles(activeRoles: StemRole[], preferred: StemRole[]): StemRole[] {
  const ordered: StemRole[] = [];
  for (const role of preferred) {
    if (activeRoles.includes(role) && !ordered.includes(role)) {
      ordered.push(role);
    }
  }
  for (const role of activeRoles) {
    if (!ordered.includes(role)) {
      ordered.push(role);
    }
  }
  return ordered;
}

function createFallbackMotifSeed(songDNA: SongDNA): string {
  return `motif-${songDNA.id || songDNA.sourceId || 'fallback'}-fallback`;
}

function getMotifSeeds(songDNA: SongDNA): string[] {
  return songDNA.motifSeeds.length ? songDNA.motifSeeds : [createFallbackMotifSeed(songDNA)];
}

function callbackOrigin(callbackType: CallbackType): SectionType | undefined {
  if (callbackType === 'intro') return 'intro';
  if (callbackType === 'build') return 'build';
  return undefined;
}

function createStableCallbackMotifId(callbackType: CallbackType, sectionType: SectionType, currentBar: number, target: string): string {
  return `callback-${callbackType}-${sectionType}-${currentBar}:${target}`;
}

function createStableVariationId(sectionType: SectionType, currentBar: number): string {
  return `variation-${sectionType}-${currentBar}`;
}

export class ProducerBrain {
  public motifMemory = new MotifMemory();
  public phraseRecall = new PhraseRecall();
  public dropEscalation = new DropEscalation();
  public fatigue = new RepetitionFatigue();
  private producerState: ProducerState = 'idle';

  private buildSectionPlan(songDNA: SongDNA, options: ProducerBrainOptions): ProducerSectionStrategy[] {
    const rng = createSeededRng(options.seed ?? songDNA.id, 'producer-brain');
    const baseSections = songDNA.sectionGrid.sections;
    const activeRoles = songDNA.stemRoles.length ? songDNA.stemRoles : ['drums', 'bass', 'music', 'fx'];
    const preferredTarget = options.targetGenre ? `${options.targetGenre}` : songDNA.genre ?? 'hybrid';
    const motifSeeds = getMotifSeeds(songDNA);

    // Register initial motifs from DNA
    motifSeeds.forEach((seed) => {
      this.motifMemory.registerMotif({
        id: `${seed}:${preferredTarget}`,
        type: 'primary',
        phraseLength: 4,
        energy: 0.5,
        sectionOrigin: 'intro'
      });
    });

    return baseSections.map((section, index) => {
      const motifIndex = pickWeightedIndex([2, 3, 1, 4], rng);
      const rawSeed = motifSeeds[motifIndex % motifSeeds.length] ?? `motif-${index + 1}`;
      let primaryMotif = `${rawSeed}:${preferredTarget}`;
      
      const preferredRoles = weightedRoles(activeRoles, ROLE_PRIORITY);
      const sectionRoles: StemRole[] = [];

      const inputSectionType = section.type;
      this.fatigue.trackSection(inputSectionType);

      let decision = this.getGuidance(inputSectionType, section.startBar);
      let sectionType = inputSectionType;

      // Apply Guidance
      if (decision.action === 'suppress fakeout' && inputSectionType === 'fakeout') {
        sectionType = 'breakdown';
      }

      const dropRecommendation =
        sectionType === 'drop' || sectionType === 'second_drop'
          ? this.dropEscalation.getEscalationRecommendation()
          : undefined;

      if (sectionType === 'drop' || sectionType === 'second_drop') {
        this.dropEscalation.trackDrop({
          bar: section.startBar,
          intensity: dropRecommendation?.intensity ?? section.energyLevel,
          density: dropRecommendation?.density ?? 1,
          macroUsageCount: 0,
          motifReuseCount: 0
        });
      }

      if (sectionType === 'intro' || sectionType === 'breakdown' || sectionType === 'outro') {
        sectionRoles.push(...preferredRoles.filter((role) => role === 'texture' || role === 'fx' || role === 'music'));
        if (sectionRoles.includes('vocal')) this.phraseRecall.trackAppearance('vocal', sectionType, section.startBar);
      } else if (sectionType === 'fakeout') {
        sectionRoles.push(...preferredRoles.filter((role) => role === 'fx' || role === 'drums'));
      } else if (sectionType === 'build' || sectionType === 'build_2') {
        sectionRoles.push(...preferredRoles.filter((role) => role === 'drums' || role === 'fx' || role === 'bass'));
        this.phraseRecall.trackAppearance('build', sectionType, section.startBar);
      } else {
        sectionRoles.push(...preferredRoles.filter((role) => role === 'drums' || role === 'bass' || role === 'music' || role === 'lead'));
        if (sectionRoles.includes('hook')) this.phraseRecall.trackAppearance('hook', sectionType, section.startBar);
        if (sectionRoles.includes('bass')) this.phraseRecall.trackAppearance('bass', sectionType, section.startBar);
      }

      if (!sectionRoles.length) {
        sectionRoles.push(...preferredRoles.slice(0, 2));
      }

      // Handle motif callbacks or evolution
      if (decision.action === 'trigger callback') {
         primaryMotif = decision.metadata.motifId;
      } else if (decision.action === 'evolve motif') {
         primaryMotif = `${primaryMotif}-${decision.metadata.variationId}`;
         this.motifMemory.registerMotif({
            id: primaryMotif,
            type: 'evolved',
            phraseLength: 4,
            energy: section.energyLevel + 0.1,
            sectionOrigin: sectionType
         });
      }

      this.motifMemory.markMotifUsed(primaryMotif, section.startBar);
      this.fatigue.trackMotif(primaryMotif);

      const placeholderRoles = activeRoles.length
        ? activeRoles.filter((role) => !sectionRoles.includes(role)).slice(0, 2)
        : ['drums', 'bass'];

      let baseEnergy = section.energyLevel + (sectionType === 'second_drop' ? 0.08 : sectionType === 'fakeout' ? -0.05 : 0);
      
      // Apply drop escalation intensity
      if (dropRecommendation) {
          baseEnergy = Math.max(baseEnergy, dropRecommendation.intensity);
      }

      const energyCurve = clamp(baseEnergy, 0.05, 1);

      const transitionTypes: ProducerSectionStrategy['transitionTypes'] =
        sectionType === 'intro'
          ? ['transition']
          : sectionType === 'fakeout'
            ? ['silence', 'transition']
            : sectionType === 'drop' || sectionType === 'second_drop'
              ? ['impact', 'fill']
              : ['riser', 'transition', 'fill'];

      return {
        id: section.id,
        type: sectionType,
        startBar: section.startBar,
        endBar: section.endBar,
        energyLevel: roundTo(energyCurve),
        primaryMotif,
        activeStemRoles: sectionRoles,
        placeholderStemRoles: placeholderRoles,
        transitionTypes
      };
    });
  }

  private buildEnergyCurve(sections: ProducerSectionStrategy[]): number[] {
    return sections.map((section) => roundTo(section.energyLevel));
  }

  private createCallbackDecision(callbackType: CallbackType, sectionType: SectionType, currentBar: number): ProducerDecision {
    const preferredTarget = 'callback';
    const origin = callbackOrigin(callbackType);
    const existingMotif = origin ? this.motifMemory.findMostRecentMotif(origin) : undefined;

    if (existingMotif) {
      return {
        action: 'trigger callback',
        reason: `Fatigue mitigation: recall ${callbackType}`,
        metadata: {
          callbackType,
          currentBar,
          motifId: existingMotif.id,
          sectionType,
          source: 'motif-memory'
        }
      };
    }

    const motifId = createStableCallbackMotifId(callbackType, sectionType, currentBar, preferredTarget);
    this.motifMemory.registerMotif({
      id: motifId,
      type: 'callback',
      phraseLength: 4,
      energy: 0.6,
      sectionOrigin: sectionType
    });

    return {
      action: 'trigger callback',
      reason: `Fatigue mitigation: recall ${callbackType}`,
      metadata: {
        callbackType,
        currentBar,
        motifId,
        sectionType,
        source: 'stable-evolution'
      }
    };
  }

  getGuidance(sectionType: SectionType, currentBar: number): ProducerDecision {
    const fatigueScore = this.fatigue.getFatigueScore();
    
    if (fatigueScore >= FAKEOUT_SUPPRESSION_THRESHOLD && sectionType === 'fakeout') {
        return {
          action: 'suppress fakeout',
          reason: 'High fatigue, avoiding repeated fakeouts',
          metadata: {
            fatigueScore,
            from: 'fakeout',
            threshold: FAKEOUT_SUPPRESSION_THRESHOLD,
            to: 'breakdown'
          }
        };
    }

    if (fatigueScore >= FATIGUE_VARIATION_THRESHOLD) {
        const suggestion = this.phraseRecall.getRecallSuggestion(currentBar);
        if (suggestion) {
            return this.createCallbackDecision(suggestion, sectionType, currentBar);
        }
        const variationId = createStableVariationId(sectionType, currentBar);
        return {
          action: 'evolve motif',
          reason: 'Fatigue mitigation: motif evolution required',
          metadata: {
            currentBar,
            sectionType,
            source: 'stable-evolution',
            variationId
          }
        };
    }

    if (sectionType === 'drop' || sectionType === 'second_drop') {
        const drops = this.dropEscalation.getDropCount();
        const recommendation = this.dropEscalation.getEscalationRecommendation();
        if (drops > 0) {
            return {
              action: 'increase drop density',
              reason: 'Escalating subsequent drops',
              metadata: {
                density: recommendation.density,
                description: recommendation.description,
                dropCount: drops,
                intensity: recommendation.intensity
              }
            };
        }
    }

    return { action: 'none', reason: 'Normal operation' };
  }

  getDiagnosticsSnapshot(): ProducerDiagnosticsSnapshot {
    return {
      producerState: this.producerState,
      fatigueScore: this.fatigue.getFatigueScore(),
      currentDropLevel: this.dropEscalation.getCurrentDropLevel(),
      motifCount: this.motifMemory.getMotifCount(),
      recallCount: this.phraseRecall.getRecallCount()
    };
  }

  createStrategy(songDNA: SongDNA, options: ProducerBrainOptions = {}): ProducerBrainOutput {
    // Reset state for new strategy creation
    this.producerState = 'generating';
    this.motifMemory = new MotifMemory();
    this.phraseRecall = new PhraseRecall();
    this.dropEscalation = new DropEscalation();
    this.fatigue = new RepetitionFatigue();

    const sections = this.buildSectionPlan(songDNA, options);
    const motifPlan = sections.map((section) => section.primaryMotif);

    const output: ProducerBrainOutput = {
      id: `${songDNA.id}-brain`,
      sourceSongId: songDNA.id,
      goal: `Remix ${songDNA.sourceName}`,
      sections,
      energyCurve: this.buildEnergyCurve(sections),
      motifPlan,
      notes: [
        `Sections mapped deterministically from ${songDNA.sectionGrid.sections.length} section blocks.`,
        `Target genre: ${options.targetGenre ?? songDNA.genre ?? 'unspecified'}.`
      ]
    };

    const targetGenre = options.targetGenre ?? songDNA.genre;
    if (targetGenre) {
      output.targetGenre = targetGenre;
    }

    this.producerState = 'complete';

    return output;
  }
}
