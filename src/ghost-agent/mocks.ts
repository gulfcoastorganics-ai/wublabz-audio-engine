import type { ActionPlan, ExecutionResult, Executor, PlannerInput, PlannerProvider, VerificationResult, Verifier } from './types.js';

export function createMockExecutor(result: ExecutionResult): Executor {
  return {
    async execute(): Promise<ExecutionResult> {
      return result;
    }
  };
}

export function createMockVerifier(result: VerificationResult): Verifier {
  return {
    async verify(): Promise<VerificationResult> {
      return result;
    }
  };
}

export function createMockPlannerProvider(plan: ActionPlan, providerName = 'local-rule' as const): PlannerProvider {
  return {
    kind: providerName,
    async plan(_input: PlannerInput) {
      return {
        provider: providerName,
        model: `${providerName}-mock`,
        plan,
        raw: { mock: true },
        tokenUsage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2
        }
      };
    }
  };
}

