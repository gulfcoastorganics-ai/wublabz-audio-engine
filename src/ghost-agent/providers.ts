import { randomUUID } from 'node:crypto';
import { StructuredValidationError, TransportUnavailableError } from './errors.js';
import { compressScreenshotArtifact } from './screenshot.js';
import { validateActionPlan } from './schema.js';
import { zeroTokenUsage } from './token-usage.js';
import type {
  ActionPlan,
  PlannerInput,
  PlannerProvider,
  PlannerProviderKind,
  PlannerRequestOptions,
  PlannerResult,
  TokenUsage
} from './types.js';

export interface PlannerTransportRequest {
  provider: PlannerProviderKind;
  model: string;
  input: PlannerInput;
  options: PlannerRequestOptions;
  screenshot?: ReturnType<typeof compressScreenshotArtifact>;
}

export interface PlannerTransportResponse {
  payload: unknown;
  tokenUsage?: TokenUsage;
}

export interface PlannerTransport {
  send(request: PlannerTransportRequest): Promise<PlannerTransportResponse>;
}

export interface JsonPlannerProviderConfig {
  model: string;
  transport?: PlannerTransport;
  defaultTemperature?: number;
  defaultMaxOutputTokens?: number;
}

class MissingTransport implements PlannerTransport {
  constructor(private readonly provider: PlannerProviderKind) {}

  async send(): Promise<PlannerTransportResponse> {
    throw new TransportUnavailableError(this.provider);
  }
}

abstract class BaseJsonPlannerProvider implements PlannerProvider {
  readonly kind: PlannerProviderKind;
  protected readonly model: string;
  protected readonly transport: PlannerTransport;
  protected readonly defaultTemperature: number | undefined;
  protected readonly defaultMaxOutputTokens: number | undefined;

  protected constructor(kind: PlannerProviderKind, config: JsonPlannerProviderConfig) {
    this.kind = kind;
    this.model = config.model;
    this.transport = config.transport ?? new MissingTransport(kind);
    this.defaultTemperature = config.defaultTemperature;
    this.defaultMaxOutputTokens = config.defaultMaxOutputTokens;
  }

  async plan(input: PlannerInput, options: PlannerRequestOptions): Promise<PlannerResult> {
    const screenshot = input.screenshot ? compressScreenshotArtifact(input.screenshot) : undefined;
    const temperature = options.temperature ?? this.defaultTemperature;
    const maxOutputTokens = options.maxOutputTokens ?? this.defaultMaxOutputTokens;
    const requestOptions: PlannerRequestOptions = {
      attempt: options.attempt,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      ...(options.previousFailure !== undefined ? { previousFailure: options.previousFailure } : {})
    };

    const response = await this.transport.send({
      provider: this.kind,
      model: this.model,
      input,
      options: requestOptions,
      ...(screenshot ? { screenshot } : {})
    });

    const plan = validateActionPlan(response.payload);

    return {
      provider: this.kind,
      model: this.model,
      plan: enrichPlan(plan, this.kind, this.model, options, input),
      raw: response.payload,
      tokenUsage: response.tokenUsage ?? zeroTokenUsage()
    };
  }
}

function enrichPlan(
  plan: ActionPlan,
  provider: PlannerProviderKind,
  model: string,
  options: PlannerRequestOptions,
  input: PlannerInput
): ActionPlan {
  return {
    ...plan,
    goal: input.goal,
    metadata: {
      provider,
      model,
      attempt: options.attempt,
      ...(options.previousFailure !== undefined ? { feedback: options.previousFailure } : {})
    }
  };
}

export class GeminiPlannerProvider extends BaseJsonPlannerProvider {
  constructor(config: Omit<JsonPlannerProviderConfig, 'model'> & { model?: string } = {}) {
    super('gemini', {
      ...config,
      model: config.model ?? 'gemini-2.5-flash-lite'
    });
  }
}

export class OpenAIPlannerProvider extends BaseJsonPlannerProvider {
  constructor(config: Omit<JsonPlannerProviderConfig, 'model'> & { model?: string } = {}) {
    super('openai', {
      ...config,
      model: config.model ?? 'openai-planner'
    });
  }
}

export class LocalRulePlannerProvider implements PlannerProvider {
  readonly kind = 'local-rule' as const;

  async plan(input: PlannerInput, options: PlannerRequestOptions): Promise<PlannerResult> {
    const observation = input.observation.trim();
    const lower = observation.toLowerCase();
    const steps = buildLocalRuleSteps(input.goal, lower);

    const plan: ActionPlan = validateActionPlan({
      version: '1',
      goal: input.goal,
      observationSummary: observation.slice(0, 240),
      rationale: ['Local rule fallback generated a deterministic recovery plan.'],
      steps,
      metadata: {
        provider: this.kind,
        model: 'local-rule-fallback',
        attempt: options.attempt,
        ...(options.previousFailure !== undefined ? { feedback: options.previousFailure } : {})
      }
    });

    return {
      provider: this.kind,
      model: 'local-rule-fallback',
      plan,
      raw: { fallback: true, id: randomUUID() },
      tokenUsage: zeroTokenUsage()
    };
  }
}

function buildLocalRuleSteps(goal: string, observation: string) {
  if (observation.includes('click')) {
    return [
      {
        id: 'local-click-1',
        type: 'click' as const,
        label: `Click step for ${goal}`,
        enabled: true,
        payload: { target: 'inferred-from-observation' },
        waitAfterMs: 0
      }
    ];
  }

  if (observation.includes('open')) {
    return [
      {
        id: 'local-navigate-1',
        type: 'navigate' as const,
        label: `Navigate for ${goal}`,
        enabled: true,
        payload: { target: observation },
        waitAfterMs: 0
      }
    ];
  }

  return [
    {
      id: 'local-wait-1',
      type: 'wait' as const,
      label: `Pause and reassess ${goal}`,
      enabled: true,
      payload: { reason: 'fallback' },
      waitAfterMs: 250
    }
  ];
}

export function createMockPlannerTransport(response: PlannerTransportResponse | ((request: PlannerTransportRequest) => PlannerTransportResponse)) {
  return {
    async send(request: PlannerTransportRequest): Promise<PlannerTransportResponse> {
      return typeof response === 'function' ? response(request) : response;
    }
  } satisfies PlannerTransport;
}

export function createStructuredPlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return validateActionPlan({
    version: '1',
    goal: overrides.goal ?? 'Test goal',
    observationSummary: overrides.observationSummary ?? 'Test observation',
    rationale: overrides.rationale ?? ['Test rationale'],
    steps:
      overrides.steps ?? [
        {
          id: 'step-1',
          type: 'wait',
          label: 'Wait briefly',
          enabled: true,
          payload: { durationMs: 10 },
          waitAfterMs: 0
        }
      ],
    metadata: overrides.metadata
  });
}
