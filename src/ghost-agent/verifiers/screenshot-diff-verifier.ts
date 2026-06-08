import type { ActionPlan, ExecutionArtifacts, ExecutionResult, Verifier } from '../types.js';

export interface ScreenshotDiffVerifierConfig {
  threshold?: number;
}

export interface ScreenshotDiffVerificationResult {
  ok: boolean;
  retryable: boolean;
  reason: string;
}

export class ScreenshotDiffVerifier implements Verifier {
  private readonly threshold: number;

  constructor(config: ScreenshotDiffVerifierConfig = {}) {
    this.threshold = config.threshold ?? 0.1;
  }

  async verify(_plan: ActionPlan, execution: ExecutionResult): Promise<ScreenshotDiffVerificationResult> {
    const artifacts = execution.artifacts;
    if (!artifacts) {
      return {
        ok: false,
        retryable: false,
        reason: 'Missing execution artifacts for screenshot verification.'
      };
    }

    const before = artifacts.beforeScreenshotHash;
    const after = artifacts.afterScreenshotHash;

    if (!before || !after) {
      return {
        ok: false,
        retryable: false,
        reason: 'Missing before/after screenshot fingerprints.'
      };
    }

    const changeRatio = calculateHashDifferenceRatio(before, after);
    if (changeRatio >= this.threshold) {
      return {
        ok: true,
        retryable: false,
        reason: `Screenshot change ratio ${formatRatio(changeRatio)} met threshold ${formatRatio(this.threshold)}.`
      };
    }

    return {
      ok: false,
      retryable: false,
      reason: `Screenshot change ratio ${formatRatio(changeRatio)} did not meet threshold ${formatRatio(this.threshold)}.`
    };
  }
}

export function createScreenshotDiffVerifier(config: ScreenshotDiffVerifierConfig = {}): ScreenshotDiffVerifier {
  return new ScreenshotDiffVerifier(config);
}

export function createMockScreenshotDiffVerifier(result: ScreenshotDiffVerificationResult): Verifier {
  return {
    async verify(): Promise<ScreenshotDiffVerificationResult> {
      return result;
    }
  };
}

function calculateHashDifferenceRatio(before: string, after: string): number {
  if (before === after) {
    return 0;
  }

  const normalizedBefore = before.trim();
  const normalizedAfter = after.trim();
  const maxLength = Math.max(normalizedBefore.length, normalizedAfter.length);
  if (maxLength === 0) {
    return 0;
  }

  let differences = Math.abs(normalizedBefore.length - normalizedAfter.length);
  for (let index = 0; index < Math.min(normalizedBefore.length, normalizedAfter.length); index += 1) {
    if (normalizedBefore[index] !== normalizedAfter[index]) {
      differences += 1;
    }
  }

  return differences / maxLength;
}

function formatRatio(value: number): string {
  return value.toFixed(3);
}

export function normalizeExecutionArtifacts(artifacts: ExecutionArtifacts): ExecutionArtifacts {
  const normalized: ExecutionArtifacts = {};

  if (artifacts.beforeScreenshotHash !== undefined) {
    normalized.beforeScreenshotHash = artifacts.beforeScreenshotHash;
  }
  if (artifacts.afterScreenshotHash !== undefined) {
    normalized.afterScreenshotHash = artifacts.afterScreenshotHash;
  }
  if (artifacts.beforeScreenshotBytes !== undefined) {
    normalized.beforeScreenshotBytes = artifacts.beforeScreenshotBytes;
  }
  if (artifacts.afterScreenshotBytes !== undefined) {
    normalized.afterScreenshotBytes = artifacts.afterScreenshotBytes;
  }
  if (artifacts.beforeScreenshotMimeType !== undefined) {
    normalized.beforeScreenshotMimeType = artifacts.beforeScreenshotMimeType;
  }
  if (artifacts.afterScreenshotMimeType !== undefined) {
    normalized.afterScreenshotMimeType = artifacts.afterScreenshotMimeType;
  }
  if (artifacts.actionSummaries !== undefined) {
    normalized.actionSummaries = artifacts.actionSummaries;
  }

  return normalized;
}
