export class GhostAgentError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class TransportUnavailableError extends GhostAgentError {
  constructor(provider: string) {
    super('transport_unavailable', `No transport is configured for ${provider}.`);
  }
}

export class MissingApiKeyError extends GhostAgentError {
  constructor(provider: string, envVarName: string) {
    super(
      'missing_api_key',
      `Missing ${envVarName} for ${provider} transport. Set ${envVarName} in the environment or pass an apiKey explicitly.`
    );
  }
}

export class RateLimitError extends GhostAgentError {
  readonly retryAfterMs: number | undefined;

  constructor(message = 'Rate limited', retryAfterMs?: number) {
    super('rate_limited', message);
    this.retryAfterMs = retryAfterMs;
  }
}

export class StructuredValidationError extends GhostAgentError {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('structured_validation_failed', 'Action plan JSON failed validation.');
    this.issues = issues;
  }
}

export class VerificationFailureError extends GhostAgentError {
  constructor(message: string) {
    super('verification_failed', message);
  }
}

export class GeminiTransportError extends GhostAgentError {
  constructor(message: string) {
    super('gemini_transport_error', message);
  }
}

export class UnsafeActionError extends GhostAgentError {
  constructor(message: string) {
    super('unsafe_action', message);
  }
}

export class ExecutionLimitError extends GhostAgentError {
  constructor(message: string) {
    super('execution_limit', message);
  }
}

export class ExecutionTimeoutError extends GhostAgentError {
  constructor(message: string) {
    super('execution_timeout', message);
  }
}

export class ExecutionBackendUnavailableError extends GhostAgentError {
  constructor(message: string) {
    super('execution_backend_unavailable', message);
  }
}

export class PlannerDailyLimitError extends GhostAgentError {
  readonly limit: number;
  readonly current: number;

  constructor(limit: number, current: number, message?: string) {
    super('planner_daily_limit', message ?? `Planner daily limit of ${limit} calls reached.`);
    this.limit = limit;
    this.current = current;
  }
}
