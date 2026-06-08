import { gunzipSync } from 'node:zlib';
import { GeminiTransportError, MissingApiKeyError, RateLimitError, StructuredValidationError } from '../errors.js';
import { compressScreenshotArtifact } from '../screenshot.js';
import { normalizeActionPlanCandidate, validateActionPlan } from '../schema.js';
import type {
  ActionPlan,
  PlannerInput,
  PlannerRequestOptions,
  TokenUsage
} from '../types.js';
import type { PlannerTransport, PlannerTransportRequest, PlannerTransportResponse } from '../providers.js';

export interface GeminiTransportConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  model?: string;
  endpointBaseUrl?: string;
  systemInstruction?: string;
  debug?: boolean;
  debugLogger?: (message: string) => void;
}

interface GeminiApiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: GeminiApiUsageMetadata;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_ENDPOINT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Ghost Agent\'s planner. Return only a single JSON object that matches the provided schema. ' +
  'The "version" field must be the string "1", not a number. Do not include markdown, prose, or code fences. ' +
  'Do not include shell commands or executable code. Example: {"version":"1","goal":"...","observationSummary":"...","rationale":["..."],"steps":[{"id":"step-1","type":"wait","label":"Wait briefly","enabled":true,"payload":{"milliseconds":0},"waitAfterMs":0}]}';

export class GeminiTransport implements PlannerTransport {
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly model: string;
  private readonly endpointBaseUrl: string;
  private readonly systemInstruction: string;
  private readonly debug: boolean;
  private readonly debugLogger: ((message: string) => void) | undefined;

  constructor(config: GeminiTransportConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.GEMINI_API_KEY;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.model = config.model ?? DEFAULT_MODEL;
    this.endpointBaseUrl = config.endpointBaseUrl ?? DEFAULT_ENDPOINT_BASE_URL;
    this.systemInstruction = config.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION;
    this.debug = config.debug ?? false;
    this.debugLogger = config.debugLogger;
  }

  async send(request: PlannerTransportRequest): Promise<PlannerTransportResponse> {
    const apiKey = this.resolveApiKey();
    const model = request.model || this.model;
    const body = this.buildRequestBody(request);
    const url = `${this.endpointBaseUrl}/models/${encodeURIComponent(model)}:generateContent`;

    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      await this.throwForErrorResponse(response);
    }

    const json = (await response.json()) as GeminiApiResponse;
    const parsed = this.parseActionPlanResponse(json);

    return {
      payload: parsed.plan,
      tokenUsage: parsed.tokenUsage
    };
  }

  private resolveApiKey(): string {
    if (!this.apiKey) {
      throw new MissingApiKeyError('gemini', 'GEMINI_API_KEY');
    }

    return this.apiKey;
  }

  private buildRequestBody(request: PlannerTransportRequest) {
    const contentParts: Array<Record<string, unknown>> = [
      {
        text: this.buildPromptText(request.input, request.options)
      }
    ];

    if (request.screenshot) {
      const screenshotBytes = gunzipSync(Buffer.from(request.screenshot.data));
      contentParts.push({
        inlineData: {
          mimeType: request.screenshot.mimeType,
          data: Buffer.from(screenshotBytes).toString('base64')
        }
      });
    }

    return {
      systemInstruction: {
        parts: [
          {
            text: this.systemInstruction
          }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: contentParts
        }
      ],
      generationConfig: this.buildGenerationConfig(request.options)
    };
  }

  private buildPromptText(input: PlannerInput, options: PlannerRequestOptions): string {
    const context = input.context ? JSON.stringify(input.context) : '{}';
    const feedback = options.previousFailure ? `\nPrevious failure: ${options.previousFailure}` : '';

    return [
      `Goal: ${input.goal}`,
      `Observation: ${input.observation}`,
      `Context: ${context}`,
      'Return valid JSON only.',
      'The action plan must contain version exactly as the string "1", goal, observationSummary, rationale, steps, and metadata.',
      'Do not use markdown, prose, code fences, shell commands, or executable code.',
      'Valid compact example: {"version":"1","goal":"...","observationSummary":"...","rationale":["..."],"steps":[{"id":"step-1","type":"wait","label":"Wait briefly","enabled":true,"payload":{"milliseconds":0},"waitAfterMs":0}]}'
    ].join('\n') + feedback;
  }

  private buildGenerationConfig(options: PlannerRequestOptions) {
    return {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      responseMimeType: 'application/json',
      responseJsonSchema: actionPlanJsonSchema()
    };
  }

  private parseActionPlanResponse(json: GeminiApiResponse): { plan: ActionPlan; tokenUsage: TokenUsage } {
    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim();

    if (!text) {
      throw new StructuredValidationError(['Gemini response did not contain a JSON action plan']);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new StructuredValidationError(['Gemini response was not valid JSON']);
    }

    const normalized = normalizeActionPlanCandidate(parsed);

    try {
      const plan = validateActionPlan(normalized);

      return {
        plan,
        tokenUsage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: json.usageMetadata?.totalTokenCount ?? 0,
          ...(json.usageMetadata?.cachedContentTokenCount !== undefined
            ? { cachedInputTokens: json.usageMetadata.cachedContentTokenCount }
            : {})
        }
      };
    } catch (error) {
      if (this.debug && error instanceof StructuredValidationError) {
        this.debugLogger?.(`Gemini validation debug: ${JSON.stringify(sanitizeGeminiResponseForDebug(parsed), null, 2)}`);
      }

      throw error;
    }
  }

  private async throwForErrorResponse(response: Response): Promise<never> {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
    let message = `Gemini API request failed with status ${response.status}.`;

    try {
      const json = (await response.json()) as GeminiApiResponse;
      const apiMessage = json.error?.message;
      if (apiMessage) {
        message = apiMessage;
      }
    } catch {
      // Fall back to the status-based message.
    }

    if (response.status === 429) {
      throw new RateLimitError(message, retryAfterMs);
    }

    throw new GeminiTransportError(message);
  }
}

export function createGeminiTransport(config: GeminiTransportConfig = {}): GeminiTransport {
  return new GeminiTransport(config);
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function actionPlanJsonSchema() {
  return {
    type: 'object',
    properties: {
      version: { type: 'string', enum: ['1'] },
      goal: { type: 'string' },
      observationSummary: { type: 'string' },
      rationale: {
        type: 'array',
        items: { type: 'string' }
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['click', 'move_mouse', 'type_text', 'key_press', 'wait', 'scroll', 'type', 'press', 'navigate', 'extract', 'screenshot']
            },
            label: { type: 'string' },
            enabled: { type: 'boolean' },
            payload: { type: 'object' },
            waitAfterMs: { type: 'integer', minimum: 0 }
          },
          required: ['id', 'type', 'label', 'enabled', 'payload', 'waitAfterMs'],
          additionalProperties: true
        }
      },
      metadata: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
          model: { type: 'string' },
          attempt: { type: 'integer', minimum: 1 },
          feedback: { type: 'string' }
        },
        additionalProperties: true
      }
    },
    required: ['version', 'goal', 'observationSummary', 'rationale', 'steps'],
    additionalProperties: true
  };
}

function sanitizeGeminiResponseForDebug(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const response = value as GeminiApiResponse;
  return {
    usageMetadata: response.usageMetadata,
    candidateCount: response.candidates?.length ?? 0,
    firstCandidateText: truncateText(
      response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''
    )
  };
}

function truncateText(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}
