import { BusGraph } from '../audio/BusGraph.js';
import { OfflineRenderService } from '../audio/offlineRenderService.js';
import { EventScheduler } from '../playback/EventScheduler.js';
import { ToneJsAdapter } from '../playback/ToneAdapter.js';
import { projectToTimelineEvents } from '../project/projectTimeline.js';
import { parseProjectJson, serializeProjectJson } from '../project/projectExport.js';
import type { WubLabzProject } from '../project/projectSchema.js';

const STORAGE_PREFIX = 'wublabz:project:';

export class WubLabzStudioController {
  readonly adapter: ToneJsAdapter;
  readonly busGraph: BusGraph;

  private readonly scheduler: EventScheduler;
  private readonly renderer: OfflineRenderService;
  private project: WubLabzProject | null = null;
  private loopRange: { start: number; end: number } | null = null;

  constructor() {
    this.adapter = new ToneJsAdapter();
    this.busGraph = new BusGraph();
    this.adapter.setBusGraph(this.busGraph);
    this.scheduler = new EventScheduler({ adapter: this.adapter });
    this.renderer = new OfflineRenderService();
  }

  async initialize(project?: WubLabzProject): Promise<void> {
    if (project) {
      this.setProject(project);
    }
    await this.adapter.initialize();
  }

  setProject(project: WubLabzProject): void {
    this.project = project;
    this.scheduler.reschedule(projectToTimelineEvents(project));
  }

  async play(): Promise<void> {
    if (this.project) {
      this.scheduler.reschedule(projectToTimelineEvents(this.project));
    }
    await this.adapter.play();
  }

  pause(): void {
    this.adapter.pause();
  }

  stop(): void {
    this.adapter.stop();
  }

  seek(seconds: number): void {
    this.adapter.seek(seconds);
  }

  setBpm(bpm: number): void {
    this.adapter.setBpm(bpm);
  }

  setLoop(start: number, end: number): void {
    this.loopRange = { start, end };
  }

  clearLoop(): void {
    this.loopRange = null;
  }

  emergencyStop(): void {
    this.scheduler.emergencyStop();
  }

  async save(project = this.requireProject()): Promise<void> {
    localStorage.setItem(`${STORAGE_PREFIX}${project.id}`, serializeProjectJson(project));
    localStorage.setItem(`${STORAGE_PREFIX}last`, project.id);
  }

  async load(id: string): Promise<WubLabzProject | null> {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (!raw) return null;
    const project = parseProjectJson(raw);
    this.setProject(project);
    return project;
  }

  importJson(json: string): WubLabzProject {
    const project = parseProjectJson(json);
    this.setProject(project);
    return project;
  }

  async exportWav(project = this.requireProject()): Promise<void> {
    const result = this.renderer.renderProject(project, this.renderOptions());
    downloadBlob(result.master, `${safeFileName(project.name)}.wav`);
  }

  async exportStems(project = this.requireProject()): Promise<void> {
    const result = this.renderer.renderProject(project, this.renderOptions());
    for (const stem of result.stems) {
      downloadBlob(stem.blob, `${safeFileName(stem.trackName)}.wav`);
    }
  }

  private renderOptions(): { loopStart?: number; loopEnd?: number } {
    return this.loopRange
      ? { loopStart: this.loopRange.start, loopEnd: this.loopRange.end }
      : {};
  }

  private requireProject(): WubLabzProject {
    if (!this.project) {
      throw new Error('No project is loaded.');
    }
    return this.project;
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const documentRef = (globalThis as unknown as BrowserDownloadGlobal).document;
  if (!documentRef) {
    throw new Error('File export requires a browser document.');
  }

  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface BrowserDownloadGlobal {
  document?: {
    body: {
      append: (element: DownloadAnchor) => void;
    };
    createElement: (tagName: 'a') => DownloadAnchor;
  };
}

interface DownloadAnchor {
  href: string;
  download: string;
  style: { display: string };
  click: () => void;
  remove: () => void;
}

function safeFileName(value: string): string {
  const cleaned = value.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'wublabz-export';
}
