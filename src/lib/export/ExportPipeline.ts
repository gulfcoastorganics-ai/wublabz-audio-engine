import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WubLabzProjectDocument } from '../persistence/ProjectPersistence.js';
import { BlueprintCache } from '../persistence/BlueprintCache.js';
import { StorageManager } from '../persistence/StorageManager.js';

export interface RenderPlan {
  id: string;
  createdAt: string;
  sourcePath: string;
  outputs: Array<{
    format: 'wav' | 'mp3';
    status: 'pending' | 'rendered';
    fileName: string;
  }>;
  timelineEventCount: number;
  durationSeconds: number;
}

export interface ExportManifest {
  version: '1';
  createdAt: string;
  projectId: string;
  sourcePath: string;
  files: {
    project: string;
    summary: string;
    manifest: string;
    renderPlan: string;
    songDNA: string;
    blueprint: string;
    timeline: string;
  };
}

export interface ProjectExportArtifacts {
  projectPath: string;
  summaryPath: string;
  manifestPath: string;
  renderPlanPath: string;
  songDNAPath: string;
  blueprintPath: string;
  timelinePath: string;
}

export interface ProjectExport {
  manifest: ExportManifest;
  renderPlan: RenderPlan;
  artifacts: ProjectExportArtifacts;
}

export class ExportPipeline {
  constructor(
    private readonly storage = new StorageManager(),
    private readonly blueprintCache = new BlueprintCache()
  ) {}

  async exportProject(outputDir: string | undefined, project: WubLabzProjectDocument): Promise<ProjectExport> {
    const rootDir = outputDir ?? this.storage.getExportDirectory(project.analysisSnapshot.id);
    await mkdir(rootDir, { recursive: true });

    const projectPath = path.join(rootDir, 'project.json');
    const summaryPath = path.join(rootDir, 'timeline-summary.json');
    const manifestPath = path.join(rootDir, 'export-manifest.json');
    const renderPlanPath = path.join(rootDir, 'render-plan.json');
    const songDNAPath = path.join(rootDir, 'song-dna.json');
    const blueprintPath = path.join(rootDir, 'blueprint.json');
    const timelinePath = path.join(rootDir, 'timeline.json');

    const renderPlan: RenderPlan = {
      id: `${project.analysisSnapshot.id}-render-plan`,
      createdAt: 'deterministic',
      sourcePath: project.sourcePath,
      outputs: [
        { format: 'wav', status: 'pending', fileName: 'render.wav' },
        { format: 'mp3', status: 'pending', fileName: 'render.mp3' }
      ],
      timelineEventCount: project.timelineEvents.length,
      durationSeconds: project.songDNA.durationSeconds
    };

    const manifest: ExportManifest = {
      version: '1',
      createdAt: 'deterministic',
      projectId: project.analysisSnapshot.id,
      sourcePath: project.sourcePath,
      files: {
        project: projectPath,
        summary: summaryPath,
        manifest: manifestPath,
        renderPlan: renderPlanPath,
        songDNA: songDNAPath,
        blueprint: blueprintPath,
        timeline: timelinePath
      }
    };

    await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
    await writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          sourcePath: project.sourcePath,
          eventCount: project.timelineEvents.length,
          bpm: project.songDNA.bpm,
          energy: project.songDNA.energy
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(renderPlanPath, `${JSON.stringify(renderPlan, null, 2)}\n`, 'utf8');
    await writeFile(songDNAPath, `${JSON.stringify(project.songDNA, null, 2)}\n`, 'utf8');
    await writeFile(blueprintPath, `${JSON.stringify(project.remixBlueprint, null, 2)}\n`, 'utf8');
    await writeFile(timelinePath, `${JSON.stringify(project.timelineEvents, null, 2)}\n`, 'utf8');
    await this.blueprintCache.write(project.remixBlueprint.id, project.remixBlueprint);

    return {
      manifest,
      renderPlan,
      artifacts: {
        projectPath,
        summaryPath,
        manifestPath,
        renderPlanPath,
        songDNAPath,
        blueprintPath,
        timelinePath
      }
    };
  }
}
