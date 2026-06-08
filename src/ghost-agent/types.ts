export type PlannerProviderKind = 'gemini' | 'openai' | 'local-rule';

export type ActionType =
  | 'click'
  | 'move_mouse'
  | 'type_text'
  | 'key_press'
  | 'wait'
  | 'scroll'
  | 'type'
  | 'press'
  | 'navigate'
  | 'extract'
  | 'screenshot';

export interface ScreenshotArtifact {
  mimeType: string;
  data: Uint8Array;
  description?: string;
}

export interface CompressedScreenshotArtifact {
  encoding: 'gzip';
  mimeType: string;
  originalBytes: number;
  compressedBytes: number;
  sha256: string;
  data: Uint8Array;
}

export interface PlannerInput {
  goal: string;
  observation: string;
  screenshot?: ScreenshotArtifact;
  context?: Record<string, unknown>;
}

export interface ActionStep {
  id: string;
  type: ActionType;
  label: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  waitAfterMs: number;
}

export interface PlannerMetadata {
  provider: PlannerProviderKind;
  model: string;
  attempt: number;
  feedback?: string;
}

export interface ActionPlan {
  version: '1';
  goal: string;
  observationSummary: string;
  rationale: string[];
  steps: ActionStep[];
  metadata?: PlannerMetadata;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
}

export interface PlannerRequestOptions {
  attempt: number;
  temperature?: number;
  maxOutputTokens?: number;
  previousFailure?: string;
}

export interface PlannerResult {
  provider: PlannerProviderKind;
  model: string;
  plan: ActionPlan;
  raw: unknown;
  tokenUsage: TokenUsage;
}

export interface ExecutionResult {
  ok: boolean;
  logs: string[];
  observedState: string;
  artifacts?: ExecutionArtifacts;
}

export interface ExecutionArtifacts {
  actionSummaries?: string[];
  beforeScreenshotHash?: string;
  afterScreenshotHash?: string;
  beforeScreenshotBytes?: number;
  afterScreenshotBytes?: number;
  beforeScreenshotMimeType?: string;
  afterScreenshotMimeType?: string;
}

export interface VerificationResult {
  ok: boolean;
  retryable: boolean;
  reason: string;
}

export interface PlannerProvider {
  readonly kind: PlannerProviderKind;
  plan(input: PlannerInput, options: PlannerRequestOptions): Promise<PlannerResult>;
}

export interface Executor {
  execute(plan: ActionPlan): Promise<ExecutionResult>;
}

export interface Verifier {
  verify(plan: ActionPlan, execution: ExecutionResult): Promise<VerificationResult>;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
}
