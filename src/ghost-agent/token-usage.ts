import type { TokenUsage } from './types.js';

export function zeroTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

export class TokenUsageTracker {
  private usage: TokenUsage = zeroTokenUsage();

  record(next: TokenUsage): void {
    this.usage = {
      inputTokens: this.usage.inputTokens + next.inputTokens,
      outputTokens: this.usage.outputTokens + next.outputTokens,
      totalTokens: this.usage.totalTokens + next.totalTokens,
      ...(this.usage.cachedInputTokens !== undefined || next.cachedInputTokens !== undefined
        ? {
            cachedInputTokens: (this.usage.cachedInputTokens ?? 0) + (next.cachedInputTokens ?? 0)
          }
        : {})
    };
  }

  snapshot(): TokenUsage {
    return {
      inputTokens: this.usage.inputTokens,
      outputTokens: this.usage.outputTokens,
      totalTokens: this.usage.totalTokens,
      ...(this.usage.cachedInputTokens !== undefined ? { cachedInputTokens: this.usage.cachedInputTokens } : {})
    };
  }
}
