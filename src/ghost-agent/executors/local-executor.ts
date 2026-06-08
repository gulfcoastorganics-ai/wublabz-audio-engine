import { performance } from 'node:perf_hooks';
import {
  ExecutionBackendUnavailableError,
  ExecutionLimitError,
  ExecutionTimeoutError,
  UnsafeActionError
} from '../errors.js';
import type { ActionPlan, ActionStep, ExecutionResult, Executor } from '../types.js';

export interface Point {
  x: number;
  y: number;
}

export interface ScrollDelta {
  x: number;
  y: number;
}

export interface LocalExecutionBackend {
  moveMouse(point: Point): Promise<void> | void;
  click(point?: Point): Promise<void> | void;
  typeText(text: string): Promise<void> | void;
  keyPress(key: string): Promise<void> | void;
  scroll(delta: ScrollDelta): Promise<void> | void;
  wait(milliseconds: number): Promise<void> | void;
}

export interface LocalExecutorConfig {
  backend: LocalExecutionBackend;
  dryRun?: boolean;
  maxActionsPerRun?: number;
  maxTextLength?: number;
  maxRunDurationMs?: number;
  now?: () => number;
}

const ALLOWLIST = new Set<ActionStep['type']>(['wait', 'move_mouse', 'click', 'type_text', 'key_press', 'scroll']);

const DEFAULTS = {
  dryRun: true,
  maxActionsPerRun: 25,
  maxTextLength: 120,
  maxRunDurationMs: 30_000
} as const;

export class LocalExecutor implements Executor {
  private readonly backend: LocalExecutionBackend;
  private readonly dryRun: boolean;
  private readonly maxActionsPerRun: number;
  private readonly maxTextLength: number;
  private readonly maxRunDurationMs: number;
  private readonly now: () => number;

  constructor(config: LocalExecutorConfig) {
    this.backend = config.backend;
    this.dryRun = config.dryRun ?? DEFAULTS.dryRun;
    this.maxActionsPerRun = config.maxActionsPerRun ?? DEFAULTS.maxActionsPerRun;
    this.maxTextLength = config.maxTextLength ?? DEFAULTS.maxTextLength;
    this.maxRunDurationMs = config.maxRunDurationMs ?? DEFAULTS.maxRunDurationMs;
    this.now = config.now ?? (() => performance.now());
  }

  async execute(plan: ActionPlan): Promise<ExecutionResult> {
    const startedAt = this.now();
    const logs: string[] = [];
    const actionSummaries: string[] = [];
    let executedActions = 0;

    for (const step of plan.steps) {
      this.ensureWithinDuration(startedAt);

      if (!step.enabled) {
        const summary = summarizeStep(step, true);
        logs.push(summary);
        actionSummaries.push(summary);
        continue;
      }

      if (!ALLOWLIST.has(step.type)) {
        throw new UnsafeActionError(`Unsupported action type: ${step.type}`);
      }

      if (executedActions >= this.maxActionsPerRun) {
        throw new ExecutionLimitError(`Execution limit exceeded: max ${this.maxActionsPerRun} actions per run`);
      }

      const summary = summarizeStep(step, false);
      logs.push(summary);
      actionSummaries.push(summary);

      if (!this.dryRun) {
        await this.dispatchStep(step);
      }

      executedActions += 1;
      this.ensureWithinDuration(startedAt);
    }

    return {
      ok: true,
      logs,
      observedState: this.dryRun ? 'dry-run' : 'executed',
      artifacts: {
        actionSummaries
      }
    };
  }

  private ensureWithinDuration(startedAt: number): void {
    const elapsed = this.now() - startedAt;
    if (elapsed > this.maxRunDurationMs) {
      throw new ExecutionTimeoutError(`Execution exceeded max duration of ${this.maxRunDurationMs}ms`);
    }
  }

  private async dispatchStep(step: ActionStep): Promise<void> {
    switch (step.type) {
      case 'wait':
        await this.backend.wait(readMilliseconds(step.payload));
        return;
      case 'move_mouse':
        await this.backend.moveMouse(readPoint(step.payload, 'x', 'y'));
        return;
      case 'click':
        await this.backend.click(readOptionalPoint(step.payload));
        return;
      case 'type_text':
        await this.backend.typeText(this.readSafeText(step));
        return;
      case 'key_press':
        await this.backend.keyPress(readRequiredString(step.payload, 'key'));
        return;
      case 'scroll':
        await this.backend.scroll(readScrollDelta(step.payload));
        return;
      default:
        throw new UnsafeActionError(`Unsupported action type: ${step.type}`);
    }
  }

  private readSafeText(step: ActionStep): string {
    if (step.payload.safeToType !== true) {
      throw new UnsafeActionError('type_text actions require payload.safeToType === true');
    }

    const text = readRequiredString(step.payload, 'text');
    if (text.length > this.maxTextLength) {
      throw new ExecutionLimitError(`Text input exceeds max length of ${this.maxTextLength} characters`);
    }

    return text;
  }
}

export function createLocalExecutor(config: LocalExecutorConfig): LocalExecutor {
  return new LocalExecutor(config);
}

function summarizeStep(step: ActionStep, skipped: boolean): string {
  const prefix = skipped ? '[skipped]' : '[action]';
  switch (step.type) {
    case 'wait':
      return `${prefix} wait ${readMilliseconds(step.payload)}ms`;
    case 'move_mouse':
      return `${prefix} move_mouse (${readNumber(step.payload, 'x')}, ${readNumber(step.payload, 'y')})`;
    case 'click':
      return `${prefix} click${hasCoordinates(step.payload) ? ` (${readNumber(step.payload, 'x')}, ${readNumber(step.payload, 'y')})` : ''}`;
    case 'type_text':
      return `${prefix} type_text len=${String(readRequiredString(step.payload, 'text').length)} safeToType=${step.payload.safeToType === true}`;
    case 'key_press':
      return `${prefix} key_press ${readRequiredString(step.payload, 'key')}`;
    case 'scroll':
      return `${prefix} scroll (${readNumber(step.payload, 'deltaX', readNumber(step.payload, 'x', 0))}, ${readNumber(step.payload, 'deltaY', readNumber(step.payload, 'y', 0))})`;
    default:
      return `${prefix} ${step.type}`;
  }
}

function readRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UnsafeActionError(`Missing required string payload.${key}`);
  }
  return value;
}

function readNumber(payload: Record<string, unknown>, key: string, fallback = 0): number {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function readMilliseconds(payload: Record<string, unknown>): number {
  const milliseconds = readNumber(payload, 'milliseconds', readNumber(payload, 'ms', 0));
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
    throw new UnsafeActionError('wait actions require a non-negative integer milliseconds payload');
  }
  return milliseconds;
}

function readPoint(payload: Record<string, unknown>, xKey: string, yKey: string): Point {
  const x = readNumber(payload, xKey);
  const y = readNumber(payload, yKey);
  return { x, y };
}

function readOptionalPoint(payload: Record<string, unknown>): Point | undefined {
  if (typeof payload.x === 'number' && typeof payload.y === 'number') {
    return { x: payload.x, y: payload.y };
  }
  return undefined;
}

function hasCoordinates(payload: Record<string, unknown>): boolean {
  return typeof payload.x === 'number' && typeof payload.y === 'number';
}

function readScrollDelta(payload: Record<string, unknown>): ScrollDelta {
  return {
    x: readNumber(payload, 'deltaX', readNumber(payload, 'x', 0)),
    y: readNumber(payload, 'deltaY', readNumber(payload, 'y', 0))
  };
}

export function createUnavailableLocalExecutionBackend(): LocalExecutionBackend {
  const unavailable = (): never => {
    throw new ExecutionBackendUnavailableError('Local desktop backend is not implemented yet.');
  };

  return {
    moveMouse: unavailable,
    click: unavailable,
    typeText: unavailable,
    keyPress: unavailable,
    scroll: unavailable,
    wait: unavailable
  };
}
