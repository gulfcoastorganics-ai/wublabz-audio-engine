import type { SectionType } from './types.js';

export interface MotifData {
  id: string;
  type: string;
  phraseLength: number;
  energy: number;
  sectionOrigin: SectionType;
  recurrenceCount: number;
  lastUsedBar: number;
}

export class MotifMemory {
  private motifs: Map<string, MotifData> = new Map();
  private history: string[] = [];

  registerMotif(motif: Omit<MotifData, 'recurrenceCount' | 'lastUsedBar'>): MotifData {
    if (this.motifs.has(motif.id)) {
      return this.motifs.get(motif.id)!;
    }
    
    const newMotif: MotifData = {
      ...motif,
      recurrenceCount: 0,
      lastUsedBar: -1
    };
    this.motifs.set(motif.id, newMotif);
    return newMotif;
  }

  recallMotif(id: string): MotifData | undefined {
    const motif = this.motifs.get(id);
    return motif ? { ...motif } : undefined;
  }

  getMotifs(): MotifData[] {
    return Array.from(this.motifs.values()).map((motif) => ({ ...motif }));
  }

  findMostRecentMotif(sectionOrigin?: SectionType): MotifData | undefined {
    const candidates = this.getMotifs()
      .filter((motif) => sectionOrigin === undefined || motif.sectionOrigin === sectionOrigin)
      .sort((left, right) => {
        if (left.lastUsedBar !== right.lastUsedBar) {
          return right.lastUsedBar - left.lastUsedBar;
        }
        if (left.recurrenceCount !== right.recurrenceCount) {
          return right.recurrenceCount - left.recurrenceCount;
        }
        return left.id.localeCompare(right.id);
      });

    return candidates[0];
  }

  markMotifUsed(id: string, currentBar: number): MotifData | undefined {
    const motif = this.motifs.get(id);
    if (!motif) return undefined;

    motif.recurrenceCount++;
    motif.lastUsedBar = currentBar;
    this.history.push(id);
    return motif;
  }

  getMotifHistory(): string[] {
    return [...this.history];
  }
  
  getMotifCount(): number {
    return this.motifs.size;
  }
}
