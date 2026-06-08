import type { SectionType } from './types.js';

export type CallbackType = 'intro' | 'build' | 'hook' | 'bass' | 'vocal';

export interface PhraseAppearance {
  sectionType: SectionType;
  bar: number;
}

export class PhraseRecall {
  private appearances: Map<CallbackType, PhraseAppearance[]> = new Map();

  trackAppearance(type: CallbackType, sectionType: SectionType, bar: number) {
    if (!this.appearances.has(type)) {
      this.appearances.set(type, []);
    }
    this.appearances.get(type)!.push({ sectionType, bar });
  }

  getFirstAppearance(type: CallbackType): PhraseAppearance | undefined {
    const list = this.appearances.get(type);
    if (!list || list.length === 0) return undefined;
    return list[0];
  }

  getLastAppearance(type: CallbackType): PhraseAppearance | undefined {
    const list = this.appearances.get(type);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  getDistanceSinceAppearance(type: CallbackType, currentBar: number): number | undefined {
    const last = this.getLastAppearance(type);
    if (!last) return undefined;
    return Math.max(0, currentBar - last.bar);
  }

  getRecallSuggestion(currentBar: number): CallbackType | null {
    let bestCandidate: CallbackType | null = null;
    let maxDistance = -1;

    for (const type of this.appearances.keys()) {
      const distance = this.getDistanceSinceAppearance(type, currentBar);
      if (distance !== undefined && distance > 16) { // Suggest if it hasn't been heard in a while (e.g. >16 bars)
        if (distance > maxDistance) {
          maxDistance = distance;
          bestCandidate = type;
        }
      }
    }
    
    return bestCandidate;
  }
  
  getRecallCount(): number {
      let total = 0;
      for (const list of this.appearances.values()) {
          total += list.length;
      }
      return total;
  }
}
