import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AudioIngestionSnapshot } from '../audio/mp3-analysis.js';
import type { ProducerBrainOutput, RemixBlueprint, SongDNA, StemManifest, TimelineEventV2 } from '../producer/types.js';
import { StorageManager } from './StorageManager.js';

export interface WubLabzProjectDocument {
  version: '1';
  createdAt: string;
  sourcePath: string;
  analysisSnapshot: AudioIngestionSnapshot;
  stemManifest: StemManifest;
  songDNA: SongDNA;
  producerBrain: ProducerBrainOutput;
  remixBlueprint: RemixBlueprint;
  timelineEvents: TimelineEventV2[];
}

export class ProjectPersistence {
  constructor(private readonly storage = new StorageManager()) {}

  async save(projectDir: string, document: WubLabzProjectDocument): Promise<string> {
    await mkdir(projectDir, { recursive: true });
    const filePath = path.join(projectDir, 'project.json');
    await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return filePath;
  }

  async saveToStorage(projectId: string, document: WubLabzProjectDocument): Promise<string> {
    const filePath = this.storage.getProjectPath(projectId);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return filePath;
  }

  async load(filePath: string): Promise<WubLabzProjectDocument> {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as WubLabzProjectDocument;
  }

  async loadFromStorage(projectId: string): Promise<WubLabzProjectDocument> {
    return this.load(this.storage.getProjectPath(projectId));
  }
}
