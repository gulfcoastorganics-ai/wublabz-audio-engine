import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PlannerDailyLimitError } from './errors.js';

export type RateLimitProfileName = 'free';

export interface PlannerRateLimitState {
  version: 1;
  dayKey: string;
  plannerCallsToday: number;
  lastPlannerCallAtMs?: number;
  lastPlannerModel?: string;
}

export interface PlannerRateLimitConfig {
  profile?: RateLimitProfileName;
  model: string;
  storePath: string;
  maxPlannerCalls?: number;
  force?: boolean;
  now?: () => number;
}

export interface PlannerRateLimitDecision {
  warning?: string;
  delayMs: number;
  limit: number;
  callsTodayBefore: number;
  callsTodayAfter: number;
  minimumDelayMs: number;
  state: PlannerRateLimitState;
}

const FREE_DAILY_LIMIT = 19;
const WARNING_THRESHOLD = 15;
const FREE_MODEL_MINIMUM_DELAYS: Record<string, number> = {
  'gemini-2.5-flash-lite': 6000,
  'gemini-2.5-flash': 12000
};

export function getDefaultPlannerModel(profile: RateLimitProfileName = 'free'): string {
  switch (profile) {
    case 'free':
      return 'gemini-2.5-flash-lite';
    default:
      return 'gemini-2.5-flash-lite';
  }
}

export function getMinimumPlannerCallDelayMs(model: string, profile: RateLimitProfileName = 'free'): number {
  if (profile !== 'free') {
    return 6000;
  }

  return FREE_MODEL_MINIMUM_DELAYS[model] ?? 6000;
}

export async function preparePlannerRateLimit(config: PlannerRateLimitConfig): Promise<PlannerRateLimitDecision> {
  const now = config.now?.() ?? Date.now();
  const dayKey = formatLocalDayKey(now);
  const limit = Math.min(config.maxPlannerCalls ?? FREE_DAILY_LIMIT, FREE_DAILY_LIMIT);
  const state = await loadPlannerRateLimitState(config.storePath);
  const normalizedState = normalizeStateForDay(state, dayKey);
  const callsTodayBefore = normalizedState.plannerCallsToday;
  const callsTodayAfter = callsTodayBefore + 1;

  if (!config.force && callsTodayBefore >= limit) {
    throw new PlannerDailyLimitError(limit, callsTodayBefore, `Planner daily limit of ${limit} calls reached for ${dayKey}.`);
  }

  const minimumDelayMs = getMinimumPlannerCallDelayMs(config.model, config.profile ?? 'free');
  const delayMs = normalizedState.lastPlannerCallAtMs === undefined ? 0 : Math.max(0, minimumDelayMs - (now - normalizedState.lastPlannerCallAtMs));
  const nextState: PlannerRateLimitState = {
    version: 1,
    dayKey,
    plannerCallsToday: callsTodayAfter,
    lastPlannerCallAtMs: now,
    lastPlannerModel: config.model
  };

  await savePlannerRateLimitState(config.storePath, nextState);

  return {
    delayMs,
    limit,
    callsTodayBefore,
    callsTodayAfter,
    minimumDelayMs,
    state: nextState,
    ...(callsTodayAfter === WARNING_THRESHOLD
      ? { warning: `Warning: planner call ${callsTodayAfter}/${FREE_DAILY_LIMIT} today.` }
      : {})
  };
}

export async function loadPlannerRateLimitState(storePath: string): Promise<PlannerRateLimitState> {
  try {
    const raw = await readFile(storePath, 'utf8');
    return normalizeLoadedPlannerRateLimitState(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        version: 1,
        dayKey: formatLocalDayKey(Date.now()),
        plannerCallsToday: 0
      };
    }

    throw error;
  }
}

export async function savePlannerRateLimitState(storePath: string, state: PlannerRateLimitState): Promise<void> {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function normalizeStateForDay(state: PlannerRateLimitState, dayKey: string): PlannerRateLimitState {
  if (state.dayKey !== dayKey) {
    return {
      version: 1,
      dayKey,
      plannerCallsToday: 0
    };
  }

  return state;
}

function normalizeLoadedPlannerRateLimitState(value: unknown): PlannerRateLimitState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      version: 1,
      dayKey: formatLocalDayKey(Date.now()),
      plannerCallsToday: 0
    };
  }

  const record = value as Record<string, unknown>;
  const plannerCallsToday = typeof record.plannerCallsToday === 'number' && Number.isInteger(record.plannerCallsToday) && record.plannerCallsToday >= 0 ? record.plannerCallsToday : 0;
  const lastPlannerCallAtMs = typeof record.lastPlannerCallAtMs === 'number' && Number.isFinite(record.lastPlannerCallAtMs) ? record.lastPlannerCallAtMs : undefined;
  const lastPlannerModel = typeof record.lastPlannerModel === 'string' && record.lastPlannerModel.trim().length > 0 ? record.lastPlannerModel : undefined;
  const dayKey = typeof record.dayKey === 'string' && record.dayKey.trim().length > 0 ? record.dayKey.trim() : formatLocalDayKey(Date.now());

  return {
    version: 1,
    dayKey,
    plannerCallsToday,
    ...(lastPlannerCallAtMs !== undefined ? { lastPlannerCallAtMs } : {}),
    ...(lastPlannerModel !== undefined ? { lastPlannerModel } : {})
  };
}

function formatLocalDayKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
}
