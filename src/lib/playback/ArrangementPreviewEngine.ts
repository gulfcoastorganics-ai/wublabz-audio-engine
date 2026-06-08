import type { TimelineEventV2 } from '../producer/types.js';
import type { EventScheduler, ScheduledTimelineEvent } from './EventScheduler.js';
import type { PlaybackTransport } from './PlaybackTransport.js';

export class ArrangementPreviewEngine {
  private lastPreview: ScheduledTimelineEvent[] = [];

  constructor(
    private readonly transport: PlaybackTransport,
    private readonly scheduler: EventScheduler
  ) {}

  async playSection(sectionType: string, events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    const sectionEvents = events.filter((event) => event.payload?.sectionType === sectionType || event.sectionId.includes(sectionType));
    this.lastPreview = this.scheduler.scheduleTimeline(sectionEvents);
    await this.transport.play(this.lastPreview);
    return this.lastPreview;
  }

  async playIntro(events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    return this.playSection('intro', events);
  }

  async playBuild(events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    return this.playSection('build', events);
  }

  async playDrop(events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    return this.playSection('drop', events);
  }

  async playBreakdown(events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    return this.playSection('breakdown', events);
  }

  async playOutro(events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    return this.playSection('outro', events);
  }

  async playRegion(startTime: number, endTime: number, events: TimelineEventV2[]): Promise<ScheduledTimelineEvent[]> {
    const regionEvents = events.filter((event) => event.endTime > startTime && event.startTime < endTime);
    this.lastPreview = this.scheduler.scheduleTimeline(regionEvents);
    await this.transport.play(this.lastPreview);
    return this.lastPreview;
  }

  stopPreview(): void {
    this.transport.stop();
  }

  seekPreview(positionSeconds: number): void {
    this.transport.seek(positionSeconds);
  }

  getLastPreview(): ScheduledTimelineEvent[] {
    return [...this.lastPreview];
  }
}
