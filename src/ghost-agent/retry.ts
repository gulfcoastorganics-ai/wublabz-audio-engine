import { RateLimitError } from './errors.js';
import type { RetryPolicy } from './types.js';

export interface RetryHooks {
  onRetry?: (event: { attempt: number; delayMs: number; error: unknown }) => void;
  sleep?: (delayMs: number) => Promise<void>;
}

export function defaultRetryPolicy(): RetryPolicy {
  return {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 1_000,
    multiplier: 2
  };
}

function computeDelayMs(error: unknown, attempt: number, policy: RetryPolicy): number {
  if (error instanceof RateLimitError && error.retryAfterMs !== undefined) {
    return Math.min(error.retryAfterMs, policy.maxDelayMs);
  }

  const delayMs = policy.baseDelayMs * policy.multiplier ** Math.max(attempt - 1, 0);
  return Math.min(delayMs, policy.maxDelayMs);
}

export async function retryWithPolicy<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  shouldRetry: (error: unknown, attempt: number) => boolean,
  hooks: RetryHooks = {}
): Promise<T> {
  const sleep = hooks.sleep ?? ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= policy.maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delayMs = computeDelayMs(error, attempt, policy);
      hooks.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

