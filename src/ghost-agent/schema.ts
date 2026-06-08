import { StructuredValidationError } from './errors.js';
import type { ActionPlan, ActionStep, PlannerMetadata, PlannerProviderKind } from './types.js';

const STEP_TYPES = new Set<ActionStep['type']>([
  'click',
  'move_mouse',
  'type_text',
  'key_press',
  'wait',
  'scroll',
  'type',
  'press',
  'navigate',
  'extract',
  'screenshot'
]);

const PROVIDERS = new Set<PlannerProviderKind>(['gemini', 'openai', 'local-rule']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function normalizeActionPlanCandidate(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = { ...value };
  if ('version' in normalized) {
    normalized.version = normalizeActionPlanVersion(normalized.version);
  }

  return normalized;
}

function normalizeActionPlanVersion(value: unknown): unknown {
  if (value === 1) {
    return '1';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value;
}

function validateMetadata(value: unknown): PlannerMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new StructuredValidationError(['metadata must be an object when present']);
  }

  const issues: string[] = [];

  if (!PROVIDERS.has(value.provider as PlannerProviderKind)) {
    issues.push('metadata.provider must be one of gemini, openai, or local-rule');
  }

  if (!isNonEmptyString(value.model)) {
    issues.push('metadata.model must be a non-empty string');
  }

  if (!isNonNegativeInteger(value.attempt) || value.attempt === 0) {
    issues.push('metadata.attempt must be a positive integer');
  }

  if (value.feedback !== undefined && !isNonEmptyString(value.feedback)) {
    issues.push('metadata.feedback must be a non-empty string when present');
  }

  if (issues.length > 0) {
    throw new StructuredValidationError(issues);
  }

  return {
    provider: value.provider as PlannerProviderKind,
    model: value.model as string,
    attempt: value.attempt as number,
    ...(value.feedback !== undefined ? { feedback: value.feedback as string } : {})
  };
}

function validateStep(step: unknown, index: number): ActionStep {
  if (!isRecord(step)) {
    throw new StructuredValidationError([`steps[${index}] must be an object`]);
  }

  const issues: string[] = [];

  if (!isNonEmptyString(step.id)) {
    issues.push(`steps[${index}].id must be a non-empty string`);
  }

  if (!STEP_TYPES.has(step.type as ActionStep['type'])) {
    issues.push(`steps[${index}].type must be a supported action type`);
  }

  if (!isNonEmptyString(step.label)) {
    issues.push(`steps[${index}].label must be a non-empty string`);
  }

  if (typeof step.enabled !== 'boolean') {
    issues.push(`steps[${index}].enabled must be a boolean`);
  }

  if (!isRecord(step.payload)) {
    issues.push(`steps[${index}].payload must be an object`);
  }

  if (!isNonNegativeInteger(step.waitAfterMs)) {
    issues.push(`steps[${index}].waitAfterMs must be a non-negative integer`);
  }

  if (issues.length > 0) {
    throw new StructuredValidationError(issues);
  }

  return {
    id: step.id as string,
    type: step.type as ActionStep['type'],
    label: step.label as string,
    enabled: step.enabled as boolean,
    payload: step.payload as Record<string, unknown>,
    waitAfterMs: step.waitAfterMs as number
  };
}

export function validateActionPlan(value: unknown): ActionPlan {
  const normalizedValue = normalizeActionPlanCandidate(value);

  if (!isRecord(normalizedValue)) {
    throw new StructuredValidationError(['actionPlan must be an object']);
  }

  const issues: string[] = [];

  if (normalizedValue.version !== '1') {
    issues.push('version must be "1"');
  }

  if (!isNonEmptyString(normalizedValue.goal)) {
    issues.push('goal must be a non-empty string');
  }

  if (!isNonEmptyString(normalizedValue.observationSummary)) {
    issues.push('observationSummary must be a non-empty string');
  }

  if (!Array.isArray(normalizedValue.rationale) || normalizedValue.rationale.some((entry) => !isNonEmptyString(entry))) {
    issues.push('rationale must be an array of non-empty strings');
  }

  if (!Array.isArray(normalizedValue.steps)) {
    issues.push('steps must be an array');
  }

  if (issues.length > 0) {
    throw new StructuredValidationError(prefixIssues('actionPlan', issues));
  }

  let steps: ActionStep[];
  try {
    steps = (normalizedValue.steps as unknown[]).map((step, index) => validateStep(step, index));
  } catch (error) {
    if (error instanceof StructuredValidationError) {
      throw new StructuredValidationError(prefixIssues('actionPlan', error.issues));
    }

    throw error;
  }

  let metadata: PlannerMetadata | undefined;
  try {
    metadata = validateMetadata(normalizedValue.metadata);
  } catch (error) {
    if (error instanceof StructuredValidationError) {
      throw new StructuredValidationError(prefixIssues('actionPlan', error.issues));
    }

    throw error;
  }

  return {
    version: '1',
    goal: normalizedValue.goal as string,
    observationSummary: normalizedValue.observationSummary as string,
    rationale: normalizedValue.rationale as string[],
    steps,
    ...(metadata !== undefined ? { metadata } : {})
  };
}

function prefixIssues(scope: string, issues: string[]): string[] {
  return issues.map((issue) => (issue.startsWith(`${scope}.`) ? issue : `${scope}.${issue}`));
}
