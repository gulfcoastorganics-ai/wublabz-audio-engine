import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MissingApiKeyError, PlannerDailyLimitError, RateLimitError, StructuredValidationError } from './errors.js';
import { createLocalExecutor } from './executors/local-executor.js';
import { createDesktopExecutionBackend } from './executors/desktop-backend.js';
import { GeminiTransport, type GeminiTransportConfig } from './transports/gemini-transport.js';
import { compressScreenshotArtifact } from './screenshot.js';
import { validateActionPlan } from './schema.js';
import type { PlannerTransport } from './providers.js';
import { getDefaultPlannerModel, preparePlannerRateLimit } from './rate-limit.js';
import { createScreenshotDiffVerifier } from './verifiers/screenshot-diff-verifier.js';
import type { PlannerInput, PlannerRequestOptions } from './types.js';
import type { Executor, Verifier } from './types.js';

export interface GhostAgentCliArgs {
  provider: string;
  task: string;
  screenshotPath?: string;
  model?: string;
  json: boolean;
  dryRun: boolean;
  execute: boolean;
  confirm: boolean;
  debug: boolean;
  rateLimitProfile: string;
  maxPlannerCalls?: number;
  force: boolean;
}

export interface GhostAgentCliDeps {
  env?: NodeJS.ProcessEnv;
  transportFactory?: (config: GeminiTransportConfig) => PlannerTransport;
  executorFactory?: () => Executor;
  verifierFactory?: () => Verifier;
  rateLimitStorePath?: string;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  stdout?: Pick<Console, 'log'>;
  stderr?: Pick<Console, 'error'>;
}

export interface GhostAgentCliResult {
  exitCode: number;
}

const USAGE = [
  'Usage:',
  '  ghost-agent plan --provider gemini --task "Click the login button"',
  '  ghost-agent plan --provider gemini --task "Click the login button" --screenshot ./fixtures/screen.png',
  '',
  'Flags:',
  '  --provider gemini',
  '  --task string',
  '  --screenshot path',
  '  --model string',
  '  --json',
  '  --dry-run',
  '  --execute',
  '  --i-understand-this-will-control-my-computer',
  '  --debug',
  '  --rate-limit-profile free',
  '  --max-planner-calls number',
  '  --force',
  '',
  'Environment:',
  '  GEMINI_API_KEY=...'
].join('\n');

export function parseGhostAgentCliArgs(argv: string[]): GhostAgentCliArgs {
  const parsed: Partial<GhostAgentCliArgs> = {
    provider: 'gemini',
    json: false,
    dryRun: true,
    execute: false,
    confirm: false,
    debug: false,
    rateLimitProfile: 'free',
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined || !arg.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = arg.split('=', 2);
    const valueFromNext = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        return undefined;
      }
      index += 1;
      return next;
    };

    switch (flag) {
      case '--provider':
        parsed.provider = inlineValue ?? valueFromNext() ?? 'gemini';
        break;
      case '--task':
        parsed.task = inlineValue ?? valueFromNext() ?? '';
        break;
      case '--screenshot':
        {
          const screenshotPath = inlineValue ?? valueFromNext();
          if (screenshotPath !== undefined) {
            parsed.screenshotPath = screenshotPath;
          }
        }
        break;
      case '--model':
        {
          const model = inlineValue ?? valueFromNext();
          if (model !== undefined) {
            parsed.model = model;
          }
        }
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--no-dry-run':
        parsed.dryRun = false;
        break;
      case '--execute':
        parsed.execute = true;
        parsed.dryRun = false;
        break;
      case '--i-understand-this-will-control-my-computer':
        parsed.confirm = true;
        break;
      case '--debug':
        parsed.debug = true;
        break;
      case '--rate-limit-profile':
        parsed.rateLimitProfile = inlineValue ?? valueFromNext() ?? 'free';
        break;
      case '--max-planner-calls':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            const parsedValue = Number(value);
            if (!Number.isInteger(parsedValue) || parsedValue < 1) {
              parsed.maxPlannerCalls = NaN;
            } else {
              parsed.maxPlannerCalls = parsedValue;
            }
          }
        }
        break;
      case '--force':
        parsed.force = true;
        break;
      default:
        break;
    }
  }

  return {
    provider: parsed.provider ?? 'gemini',
    task: parsed.task ?? '',
    ...(parsed.screenshotPath !== undefined ? { screenshotPath: parsed.screenshotPath } : {}),
    ...(parsed.model !== undefined ? { model: parsed.model } : {}),
    json: parsed.json ?? false,
    dryRun: parsed.dryRun ?? true,
    execute: parsed.execute ?? false,
    confirm: parsed.confirm ?? false,
    debug: parsed.debug ?? false,
    rateLimitProfile: parsed.rateLimitProfile ?? 'free',
    ...(parsed.maxPlannerCalls !== undefined ? { maxPlannerCalls: parsed.maxPlannerCalls } : {}),
    force: parsed.force ?? false
  };
}

export async function runGhostAgentPlanCli(argv: string[], deps: GhostAgentCliDeps = {}): Promise<GhostAgentCliResult> {
  const stdout = deps.stdout ?? console;
  const stderr = deps.stderr ?? console;
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const args = parseGhostAgentCliArgs(argv);

  if (!args.task.trim()) {
    stderr.error(`${USAGE}\n\nError: --task is required.`);
    return { exitCode: 1 };
  }

  if (args.provider !== 'gemini') {
    stderr.error('Error: only --provider gemini is supported by this smoke command.');
    return { exitCode: 1 };
  }

  if (args.rateLimitProfile !== 'free') {
    stderr.error('Error: only --rate-limit-profile free is supported by this smoke command.');
    return { exitCode: 1 };
  }

  if (args.maxPlannerCalls !== undefined && (!Number.isInteger(args.maxPlannerCalls) || args.maxPlannerCalls < 1)) {
    stderr.error('Error: --max-planner-calls must be a positive integer.');
    return { exitCode: 1 };
  }

  if (args.execute && !args.confirm) {
    stderr.error(
      'Error: execution is gated. Re-run with --execute and --i-understand-this-will-control-my-computer to run local actions.'
    );
    return { exitCode: 1 };
  }

  let screenshot;
  if (args.screenshotPath) {
    const absolutePath = path.resolve(args.screenshotPath);
    let rawBytes: Buffer;

    try {
      rawBytes = await readFile(absolutePath);
    } catch {
      stderr.error(`Error: could not read screenshot file at ${args.screenshotPath}.`);
      return { exitCode: 1 };
    }

    const mimeType = detectImageMimeType(absolutePath);
    if (!mimeType) {
      stderr.error('Error: screenshot must be a .png, .jpg, .jpeg, or .webp image.');
      return { exitCode: 1 };
    }

    screenshot = compressScreenshotArtifact({
      mimeType,
      data: new Uint8Array(rawBytes)
    });
  }

  const resolvedModel = args.model ?? getDefaultPlannerModel('free');
  const rateLimitStorePath = deps.rateLimitStorePath ?? path.join(os.homedir(), '.ghost-agent', 'planner-usage.json');
  const input: PlannerInput = {
    goal: args.task,
    observation: args.task
  };

  const options: PlannerRequestOptions = {
    attempt: 1
  };

  try {
    const rateLimit = await preparePlannerRateLimit({
      profile: 'free',
      model: resolvedModel,
      storePath: rateLimitStorePath,
      force: args.force,
      now,
      ...(args.maxPlannerCalls !== undefined ? { maxPlannerCalls: args.maxPlannerCalls } : {})
    });

    if (rateLimit.warning) {
      stderr.error(rateLimit.warning);
    }

    if (rateLimit.delayMs > 0) {
      await sleep(rateLimit.delayMs);
    }

    const transportFactory = deps.transportFactory ?? ((config) => new GeminiTransport(config));
    const transportConfig: GeminiTransportConfig = {
      model: resolvedModel,
      fetchImpl: globalThis.fetch.bind(globalThis),
      ...(args.debug
        ? {
            debug: true,
            debugLogger: (message: string) => stderr.error(message)
          }
        : {})
    };
    if (env.GEMINI_API_KEY !== undefined) {
      transportConfig.apiKey = env.GEMINI_API_KEY;
    }

    const transport = transportFactory(transportConfig);

    const response = await transport.send({
      provider: 'gemini',
      model: resolvedModel,
      input,
      ...(screenshot ? { screenshot } : {}),
      options
    });

    const plan = validateActionPlan(response.payload);
    const output = args.json ? JSON.stringify(plan) : JSON.stringify(plan, null, 2);
    stdout.log(output);

    if (args.execute) {
      const executor = deps.executorFactory ?? (() =>
        createLocalExecutor({
          backend: createDesktopExecutionBackend(),
          dryRun: false
        }));
      const verifier = deps.verifierFactory ?? (() => createScreenshotDiffVerifier());
      const execution = await executor().execute(plan);
      const verification = await verifier().verify(plan, execution);

      if (!verification.ok) {
        stderr.error(`Error: execution verification failed. ${verification.reason}`);
        return { exitCode: 1 };
      }

      stderr.error(`Execution complete: ${execution.logs.length} actions processed.`);
      return { exitCode: 0 };
    }

    return { exitCode: 0 };
  } catch (error) {
    if (error instanceof PlannerDailyLimitError) {
      stderr.error(
        `Error: ${error.message} Re-run with --force to override the free-tier daily planner limit temporarily.`
      );
      return { exitCode: 1 };
    }

    if (error instanceof RateLimitError) {
      stderr.error(`Error: Gemini rate limit reached. ${formatRetryHint(error.retryAfterMs)} Try again later.`);
      return { exitCode: 1 };
    }

    if (error instanceof MissingApiKeyError) {
      stderr.error('Error: GEMINI_API_KEY is missing. Set it in your environment before running ghost-agent plan.');
      return { exitCode: 1 };
    }

    if (error instanceof StructuredValidationError) {
      stderr.error(`Error: Gemini returned malformed JSON action plan. ${error.issues.join(' ')}`);
      return { exitCode: 1 };
    }

    if (error instanceof Error) {
      stderr.error(`Error: ${error.message}`);
    } else {
      stderr.error('Error: Gemini planning failed.');
    }

    return { exitCode: 1 };
  }
}

function detectImageMimeType(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return undefined;
  }
}

function formatRetryHint(retryAfterMs: number | undefined): string {
  if (retryAfterMs === undefined) {
    return '';
  }

  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Retry after about ${seconds} seconds.`;
}

export async function runGhostAgentCli(argv: string[], deps: GhostAgentCliDeps = {}): Promise<GhostAgentCliResult> {
  const [command, ...rest] = argv;

  if (command !== 'plan') {
    (deps.stderr ?? console).error(`${USAGE}\n\nError: expected subcommand "plan".`);
    return { exitCode: 1 };
  }

  return runGhostAgentPlanCli(rest, deps);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await runGhostAgentCli(process.argv.slice(2));
  process.exitCode = result.exitCode;
}
