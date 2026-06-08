import path from 'node:path';
import { ingestAudioFile, type AudioIngestionSnapshot } from './mp3-analysis.js';
import { ArrangementReconstructionEngine } from '../producer/ArrangementReconstructionEngine.js';
import { EventScheduler, type ScheduledTimelineEvent } from '../playback/EventScheduler.js';
import { ExportPipeline, type ProjectExportArtifacts } from '../export/ExportPipeline.js';
import { ProjectPersistence, type WubLabzProjectDocument } from '../persistence/ProjectPersistence.js';
import { ProducerBrain } from '../producer/ProducerBrain.js';
import { RemixBlueprintGenerator } from '../producer/RemixBlueprintGenerator.js';
import { SongDNAExtractor } from '../producer/SongDNAExtractor.js';
import type {
  ArrangementReconstructionOptions,
  ProducerBrainOptions,
  ProducerDiagnosticsSnapshot,
  StemDescriptor,
  StemManifest,
  TimelineEventV2
} from '../producer/types.js';

export interface AudioPipelineOptions {
  seed?: string | number;
  targetGenre?: string;
  projectDir?: string;
  outputDir?: string;
}

export interface AudioPipelineResult {
  analysisSnapshot: AudioIngestionSnapshot;
  stemManifest: StemManifest;
  songDNA: ReturnType<SongDNAExtractor['extract']>;
  producerBrain: ReturnType<ProducerBrain['createStrategy']>;
  producerDiagnostics: ProducerDiagnosticsSnapshot;
  remixBlueprint: ReturnType<RemixBlueprintGenerator['generate']>;
  timelineEvents: TimelineEventV2[];
  scheduledEvents: ScheduledTimelineEvent[];
  projectDocument: WubLabzProjectDocument;
  exportedPaths?: ProjectExportArtifacts;
}

export async function runAudioPipeline(filePath: string, options: AudioPipelineOptions = {}): Promise<AudioPipelineResult> {
  const analysisSnapshot = await ingestAudioFile(filePath);
  const stemManifest = createStemManifest(analysisSnapshot);
  const songDNA = new SongDNAExtractor().extract(analysisSnapshot, stemManifest);
  const producerBrainOptions: ProducerBrainOptions = {};
  if (options.seed !== undefined) {
    producerBrainOptions.seed = options.seed;
  }
  const targetGenre = options.targetGenre ?? analysisSnapshot.genre;
  if (targetGenre !== undefined) {
    producerBrainOptions.targetGenre = targetGenre;
  }

  const producerBrainEngine = new ProducerBrain();
  const producerBrain = producerBrainEngine.createStrategy(songDNA, producerBrainOptions);
  const producerDiagnostics = producerBrainEngine.getDiagnosticsSnapshot();
  const remixBlueprint = new RemixBlueprintGenerator().generate(producerBrain, songDNA, stemManifest);
  const arrangementOptions: ArrangementReconstructionOptions = {};
  if (options.seed !== undefined) {
    arrangementOptions.seed = options.seed;
  }
  if (options.targetGenre !== undefined) {
    arrangementOptions.targetGenre = options.targetGenre;
  }

  const timelineEvents = new ArrangementReconstructionEngine().reconstruct(
    remixBlueprint,
    songDNA,
    stemManifest,
    arrangementOptions
  );
  const scheduledEvents = new EventScheduler().schedule(timelineEvents);
  const projectDocument = buildProjectDocument(
    filePath,
    analysisSnapshot,
    stemManifest,
    songDNA,
    producerBrain,
    remixBlueprint,
    timelineEvents
  );

  let exportedPaths: AudioPipelineResult['exportedPaths'];
  if (options.projectDir || options.outputDir) {
    const outputDir = options.outputDir ?? options.projectDir ?? path.dirname(filePath);
    const exportPipeline = new ExportPipeline();
    const exportResult = await exportPipeline.exportProject(outputDir, projectDocument);
    exportedPaths = exportResult.artifacts;

    if (options.projectDir && options.outputDir && options.projectDir !== options.outputDir) {
      const persistence = new ProjectPersistence();
      await persistence.save(options.projectDir, projectDocument);
    }
  }

  return {
    analysisSnapshot,
    stemManifest,
    songDNA,
    producerBrain,
    producerDiagnostics,
    remixBlueprint,
    timelineEvents,
    scheduledEvents,
    projectDocument,
    ...(exportedPaths ? { exportedPaths } : {})
  };
}

function createStemManifest(snapshot: AudioIngestionSnapshot): StemManifest {
  const baseRoles: StemDescriptor[] = [
    {
      id: `${snapshot.id}-drums`,
      role: 'drums',
      label: 'Drum stem',
      sourceId: snapshot.id,
      energyWeight: 1,
      enabled: true
    },
    {
      id: `${snapshot.id}-bass`,
      role: 'bass',
      label: 'Bass stem',
      sourceId: snapshot.id,
      energyWeight: 0.94,
      enabled: true
    },
    {
      id: `${snapshot.id}-music`,
      role: 'music',
      label: 'Music stem',
      sourceId: snapshot.id,
      energyWeight: 0.88,
      enabled: true
    },
    {
      id: `${snapshot.id}-fx`,
      role: 'fx',
      label: 'FX stem',
      sourceId: snapshot.id,
      energyWeight: 0.66,
      enabled: true
    },
    {
      id: `${snapshot.id}-texture`,
      role: 'texture',
      label: 'Texture stem',
      sourceId: snapshot.id,
      energyWeight: 0.55,
      enabled: snapshot.confidence !== undefined ? snapshot.confidence > 0.6 : true
    },
    {
      id: `${snapshot.id}-lead`,
      role: 'lead',
      label: 'Lead stem',
      sourceId: snapshot.id,
      energyWeight: 0.5,
      enabled: snapshot.energy > 0.72
    },
    {
      id: `${snapshot.id}-vocal`,
      role: 'vocal',
      label: 'Vocal stem',
      sourceId: snapshot.id,
      energyWeight: 0.42,
      enabled: Boolean(snapshot.genre && snapshot.genre.includes('vocal'))
    }
  ];

  return {
    id: `${snapshot.id}-stem-manifest`,
    sourceId: snapshot.id,
    stems: baseRoles
  };
}

function buildProjectDocument(
  sourcePath: string,
  analysisSnapshot: AudioIngestionSnapshot,
  stemManifest: StemManifest,
  songDNA: ReturnType<SongDNAExtractor['extract']>,
  producerBrain: ReturnType<ProducerBrain['createStrategy']>,
  remixBlueprint: ReturnType<RemixBlueprintGenerator['generate']>,
  timelineEvents: TimelineEventV2[]
): WubLabzProjectDocument {
  return {
    version: '1',
    createdAt: 'deterministic',
    sourcePath,
    analysisSnapshot,
    stemManifest,
    songDNA,
    producerBrain,
    remixBlueprint,
    timelineEvents
  };
}
