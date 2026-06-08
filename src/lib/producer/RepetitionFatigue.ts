export const FATIGUE_MAX_SCORE = 100;
export const FATIGUE_VARIATION_THRESHOLD = 60;
export const FAKEOUT_SUPPRESSION_THRESHOLD = 80;
export const REPEATED_SECTION_DEFAULT_PENALTY = 15;
export const REPEATED_BUILD_PENALTY = 25;
export const REPEATED_DROP_PENALTY = 20;
export const REPEATED_FAKEOUT_PENALTY = 90;
export const MOTIF_REUSE_THRESHOLD = 3;
export const MOTIF_REUSE_PENALTY = 5;
export const SCENE_REUSE_DEFAULT_THRESHOLD = 2;
export const SCENE_REUSE_DROP_THRESHOLD = 3;
export const SCENE_REUSE_PENALTY = 10;

function getRepeatedSectionPenalty(type: string): number {
  if (type === 'fakeout') return REPEATED_FAKEOUT_PENALTY;
  if (type === 'build' || type === 'build_2') return REPEATED_BUILD_PENALTY;
  if (type === 'drop' || type === 'second_drop') return REPEATED_DROP_PENALTY;
  return REPEATED_SECTION_DEFAULT_PENALTY;
}

export class RepetitionFatigue {
  private motifReuseFrequency: Map<string, number> = new Map();
  private macroReuseFrequency: Map<string, number> = new Map();
  private sceneReuseFrequency: Map<string, number> = new Map();
  
  private lastSectionType: string = '';
  private repeatedSectionCount = 0;

  trackMotif(id: string) {
    this.motifReuseFrequency.set(id, (this.motifReuseFrequency.get(id) || 0) + 1);
  }

  trackMacro(id: string) {
    this.macroReuseFrequency.set(id, (this.macroReuseFrequency.get(id) || 0) + 1);
  }

  trackScene(id: string) {
    this.sceneReuseFrequency.set(id, (this.sceneReuseFrequency.get(id) || 0) + 1);
  }

  trackSection(type: string) {
    if (this.lastSectionType === type) {
      this.repeatedSectionCount++;
    } else {
      this.repeatedSectionCount = 0;
    }
    this.lastSectionType = type;
  }

  getFatigueScore(): number {
    let score = 0;

    score += this.repeatedSectionCount * getRepeatedSectionPenalty(this.lastSectionType);

    // Penalty for overused motifs (used more than 3 times starts adding up quickly)
    for (const count of this.motifReuseFrequency.values()) {
      if (count > MOTIF_REUSE_THRESHOLD) {
        score += (count - MOTIF_REUSE_THRESHOLD) * MOTIF_REUSE_PENALTY;
      }
    }

    // Penalty for overused scenes
    for (const [scene, count] of this.sceneReuseFrequency.entries()) {
      // Drops are expected to repeat somewhat, but fakeouts/builds less so
      const threshold = scene.includes('DROP') ? SCENE_REUSE_DROP_THRESHOLD : SCENE_REUSE_DEFAULT_THRESHOLD;
      if (count > threshold) {
        score += (count - threshold) * SCENE_REUSE_PENALTY;
      }
    }

    return Math.min(FATIGUE_MAX_SCORE, Math.max(0, score));
  }

  getMitigationRecommendation(): string {
    const score = this.getFatigueScore();
    if (score < 30) return 'No mitigation needed.';
    if (score < FATIGUE_VARIATION_THRESHOLD) return 'Add variation: consider triggering a callback or altering the active stems.';
    if (score < FAKEOUT_SUPPRESSION_THRESHOLD) return 'High fatigue: strongly recommend a contrasting section (e.g., breakdown) or significant motif evolution.';
    return 'Critical fatigue: immediate pattern break required to maintain listener interest.';
  }
}
