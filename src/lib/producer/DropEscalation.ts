export interface DropData {
  bar: number;
  intensity: number;
  density: number;
  macroUsageCount: number;
  motifReuseCount: number;
}

export class DropEscalation {
  private drops: DropData[] = [];

  trackDrop(drop: DropData) {
    this.drops.push(drop);
  }

  getDropCount(): number {
    return this.drops.length;
  }

  getCurrentDropLevel(): number {
    return this.getDropCount(); // 0-indexed internally, but visually level 1, 2, 3
  }

  getEscalationRecommendation(): { intensity: number; density: number; description: string } {
    const count = this.getDropCount();
    
    if (count === 0) {
      return {
        intensity: 0.7,
        density: 0.6,
        description: 'Drop A: simpler, cleaner, establishes the hook'
      };
    } else if (count === 1) {
      return {
        intensity: 0.85,
        density: 0.8,
        description: 'Drop B: more dense, more modulation'
      };
    } else {
      return {
        intensity: 1.0,
        density: 1.0,
        description: `Drop ${String.fromCharCode(65 + count)}: highest energy, maximum density`
      };
    }
  }
}
