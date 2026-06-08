import { VerificationFailureError } from './errors.js';
import { RateLimitError } from './errors.js';
import { defaultRetryPolicy, retryWithPolicy } from './retry.js';
import { TokenUsageTracker } from './token-usage.js';
import type {
  ActionPlan,
  Executor,
  PlannerInput,
  PlannerProvider,
  RetryPolicy,
  VerificationResult,
  Verifier
} from './types.js';

export interface RunGhostAgentOptions {
  providers: PlannerProvider[];
  executor: Executor;
  verifier: Verifier;
  retryPolicy?: RetryPolicy;
  maxPlanAttemptsPerProvider?: number;
}

export interface GhostAgentRun {
  provider: string;
  plan: ActionPlan;
  verification: VerificationResult;
  tokenUsage: ReturnType<TokenUsageTracker['snapshot']>;
  executionLogs: string[];
}

export async function runGhostAgent(input: PlannerInput, options: RunGhostAgentOptions): Promise<GhostAgentRun> {
  const tokenUsage = new TokenUsageTracker();
  const retryPolicy = options.retryPolicy ?? defaultRetryPolicy();
  const maxPlanAttemptsPerProvider = options.maxPlanAttemptsPerProvider ?? 2;
  let lastFailure: string | undefined;

  for (const provider of options.providers) {
    let result;

    try {
      result = await retryWithPolicy(
        async (attempt) => {
          return provider.plan(input, {
            attempt,
            ...(lastFailure !== undefined ? { previousFailure: lastFailure } : {})
          });
        },
        retryPolicy,
        (error) => isRetryablePlannerError(error),
        {
          sleep: async () => undefined
        }
      );
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : 'Planner failed';
      continue;
    }

    tokenUsage.record(result.tokenUsage);

    for (let verificationAttempt = 1; verificationAttempt <= maxPlanAttemptsPerProvider; verificationAttempt += 1) {
      const execution = await options.executor.execute(result.plan);
      const verification = await options.verifier.verify(result.plan, execution);

      if (verification.ok) {
        return {
          provider: result.provider,
          plan: result.plan,
          verification,
          tokenUsage: tokenUsage.snapshot(),
          executionLogs: execution.logs
        };
      }

      lastFailure = verification.reason;
      if (!verification.retryable || verificationAttempt >= maxPlanAttemptsPerProvider) {
        break;
      }
    }
  }

  throw new VerificationFailureError(lastFailure ?? 'No provider produced a valid plan');
}

function isRetryablePlannerError(error: unknown): boolean {
  return error instanceof RateLimitError;
}
