import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { ExportPipeline } from '../lib/export/ExportPipeline.js';
import { runAudioPipeline } from '../lib/audio/audio-pipeline.js';
import { validateTimelineEvents } from '../lib/producer/ArrangementReconstructionEngine.js';
import type { WubLabzProjectDocument } from '../lib/persistence/ProjectPersistence.js';

export type WubLabzCliCommand = 'analyze' | 'blueprint' | 'export' | 'project-info' | 'validate';

export interface WubLabzCliArgs {
  command: WubLabzCliCommand;
  inputPath?: string;
  projectPath?: string;
  outputPath?: string;
  projectDir?: string;
  outputDir?: string;
  targetGenre?: string;
  seed?: string;
  json: boolean;
  help: boolean;
}

export interface WubLabzCliResult {
  exitCode: number;
}

const USAGE = [
  'Usage:',
  '  wublabz analyze --input ./track.wav',
  '  wublabz blueprint --input ./track.wav',
  '  wublabz export --input ./track.wav --output-dir ./export',
  '  wublabz project-info --project-path ./export/project.json',
  '  wublabz validate --input ./track.wav',
  '',
  'Flags:',
  '  --input path',
  '  --project-path path',
  '  --output path',
  '  --project-dir path',
  '  --output-dir path',
  '  --target-genre string',
  '  --seed string',
  '  --json',
  '  --help'
].join('\n');

export function parseWubLabzCliArgs(argv: string[]): WubLabzCliArgs {
  const commandCandidate = argv[0];
  const command = isCommand(commandCandidate) ? commandCandidate : 'analyze';
  const flags = isCommand(commandCandidate) ? argv.slice(1) : argv;

  const parsed: Partial<WubLabzCliArgs> = {
    command,
    json: false,
    help: false
  };

  for (let index = 0; index < flags.length; index += 1) {
    const arg = flags[index];
    if (arg === undefined || !arg.startsWith('--')) {
      continue;
    }

    const [flag, inlineValue] = arg.split('=', 2);
    const valueFromNext = () => {
      const next = flags[index + 1];
      if (next === undefined || next.startsWith('--')) {
        return undefined;
      }

      index += 1;
      return next;
    };

    switch (flag) {
      case '--input':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.inputPath = value;
          }
        }
        break;
      case '--project-path':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.projectPath = value;
          }
        }
        break;
      case '--output':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.outputPath = value;
          }
        }
        break;
      case '--project-dir':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.projectDir = value;
          }
        }
        break;
      case '--output-dir':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.outputDir = value;
          }
        }
        break;
      case '--target-genre':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.targetGenre = value;
          }
        }
        break;
      case '--seed':
        {
          const value = inlineValue ?? valueFromNext();
          if (value !== undefined) {
            parsed.seed = value;
          }
        }
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        break;
    }
  }

  return {
    command: parsed.command ?? 'analyze',
    ...(parsed.inputPath !== undefined ? { inputPath: parsed.inputPath } : {}),
    ...(parsed.projectPath !== undefined ? { projectPath: parsed.projectPath } : {}),
    ...(parsed.outputPath !== undefined ? { outputPath: parsed.outputPath } : {}),
    ...(parsed.projectDir !== undefined ? { projectDir: parsed.projectDir } : {}),
    ...(parsed.outputDir !== undefined ? { outputDir: parsed.outputDir } : {}),
    ...(parsed.targetGenre !== undefined ? { targetGenre: parsed.targetGenre } : {}),
    ...(parsed.seed !== undefined ? { seed: parsed.seed } : {}),
    json: parsed.json ?? false,
    help: parsed.help ?? false
  };
}

export async function runWubLabzCli(argv: string[]): Promise<WubLabzCliResult> {
  const args = parseWubLabzCliArgs(argv);

  if (args.help) {
    console.log(USAGE);
    return { exitCode: 0 };
  }

  try {
    switch (args.command) {
      case 'analyze':
        return await runAnalyzeCommand(args);
      case 'blueprint':
        return await runBlueprintCommand(args);
      case 'export':
        return await runExportCommand(args);
      case 'project-info':
        return await runProjectInfoCommand(args);
      case 'validate':
        return await runValidateCommand(args);
      default:
        console.error(`${USAGE}\n\nError: unknown command.`);
        return { exitCode: 1 };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WubLabz CLI failed.';
    console.error(`Error: ${message}`);
    return { exitCode: 1 };
  }
}

async function runAnalyzeCommand(args: WubLabzCliArgs): Promise<WubLabzCliResult> {
  const inputPath = resolveInputPath(args.inputPath);
  const result = await runAudioPipeline(inputPath, {
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    ...(args.targetGenre !== undefined ? { targetGenre: args.targetGenre } : {}),
    ...(args.projectDir !== undefined ? { projectDir: args.projectDir } : {}),
    ...(args.outputDir !== undefined ? { outputDir: args.outputDir } : {})
  });

  if (args.outputPath) {
    await writeFile(args.outputPath, `${JSON.stringify(result.projectDocument, null, 2)}\n`, 'utf8');
  }

  printJson(result.projectDocument, args.json);
  return { exitCode: 0 };
}

async function runBlueprintCommand(args: WubLabzCliArgs): Promise<WubLabzCliResult> {
  const inputPath = resolveInputPath(args.inputPath);
  const result = await runAudioPipeline(inputPath, {
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    ...(args.targetGenre !== undefined ? { targetGenre: args.targetGenre } : {})
  });

  const payload = {
    analysisSnapshot: result.analysisSnapshot,
    songDNA: result.songDNA,
    producerBrain: result.producerBrain,
    remixBlueprint: result.remixBlueprint
  };

  if (args.outputPath) {
    await writeFile(args.outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  printJson(payload, args.json);
  return { exitCode: 0 };
}

async function runExportCommand(args: WubLabzCliArgs): Promise<WubLabzCliResult> {
  const inputPath = resolveInputPath(args.inputPath);
  const result = await runAudioPipeline(inputPath, {
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    ...(args.targetGenre !== undefined ? { targetGenre: args.targetGenre } : {})
  });

  const exportPipeline = new ExportPipeline();
  const exportResult = await exportPipeline.exportProject(args.outputDir, result.projectDocument);
  const payload = {
    projectDocument: result.projectDocument,
    export: exportResult
  };

  if (args.outputPath) {
    await writeFile(args.outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  printJson(payload, args.json);
  return { exitCode: 0 };
}

async function runProjectInfoCommand(args: WubLabzCliArgs): Promise<WubLabzCliResult> {
  const projectPath = resolveProjectPath(args.projectPath, args.outputDir);
  const raw = await readFile(projectPath, 'utf8');
  const project = JSON.parse(raw) as WubLabzProjectDocument;
  const payload = {
    projectPath,
    projectId: project.analysisSnapshot.id,
    sourcePath: project.sourcePath,
    eventCount: project.timelineEvents.length,
    bpm: project.songDNA.bpm,
    key: project.songDNA.key,
    genre: project.songDNA.genre ?? project.analysisSnapshot.genre ?? 'unknown'
  };

  printJson(payload, args.json);
  return { exitCode: 0 };
}

async function runValidateCommand(args: WubLabzCliArgs): Promise<WubLabzCliResult> {
  if (args.projectPath || args.outputDir) {
    const projectPath = resolveProjectPath(args.projectPath, args.outputDir);
    const raw = await readFile(projectPath, 'utf8');
    const project = JSON.parse(raw) as WubLabzProjectDocument;
    validateTimelineEvents(project.timelineEvents);
    printJson(
      {
        status: 'ok',
        projectPath,
        projectId: project.analysisSnapshot.id,
        eventCount: project.timelineEvents.length
      },
      args.json
    );
    return { exitCode: 0 };
  }

  const inputPath = resolveInputPath(args.inputPath);
  const result = await runAudioPipeline(inputPath, {
    ...(args.seed !== undefined ? { seed: args.seed } : {}),
    ...(args.targetGenre !== undefined ? { targetGenre: args.targetGenre } : {})
  });
  validateTimelineEvents(result.timelineEvents);
  printJson(
    {
      status: 'ok',
      inputPath,
      eventCount: result.timelineEvents.length,
      projectId: result.analysisSnapshot.id
    },
    args.json
  );
  return { exitCode: 0 };
}

function resolveInputPath(inputPath: string | undefined): string {
  if (!inputPath || !inputPath.trim()) {
    throw new Error('--input is required.');
  }

  return path.resolve(inputPath);
}

function resolveProjectPath(projectPath: string | undefined, outputDir: string | undefined): string {
  if (projectPath && projectPath.trim()) {
    return path.resolve(projectPath);
  }

  if (outputDir && outputDir.trim()) {
    return path.resolve(outputDir, 'project.json');
  }

  throw new Error('--project-path or --output-dir is required.');
}

function printJson(value: unknown, compact: boolean): void {
  const payload = compact ? JSON.stringify(value) : JSON.stringify(value, null, 2);
  console.log(payload);
}

function isCommand(value: string | undefined): value is WubLabzCliCommand {
  return value === 'analyze' || value === 'blueprint' || value === 'export' || value === 'project-info' || value === 'validate';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await runWubLabzCli(process.argv.slice(2));
  process.exitCode = result.exitCode;
}
