import type { TimelineEventV2 } from '../producer/types.js';
import { validateTimelineEvents } from '../producer/ArrangementReconstructionEngine.js';
import type { ToneJsAdapter } from './ToneAdapter.js';
import { PlaybackValidator } from './PlaybackValidator.js';

export interface ScheduledTimelineEvent extends TimelineEventV2 {
  scheduledIndex: number;
  scheduledStartTime: number;
  scheduledEndTime: number;
}

export type SchedulerTransportState = 'stopped' | 'loading' | 'playing' | 'paused' | 'seeking';

export interface EventSchedulerOptions {
  adapter?: ToneJsAdapter;
  validator?: PlaybackValidator;
}

export class EventScheduler {
  private readonly adapter: ToneJsAdapter | undefined;
  private readonly validator: PlaybackValidator;
  private scheduledEvents: ScheduledTimelineEvent[] = [];
  private transportState: SchedulerTransportState = 'stopped';

  constructor(options: EventSchedulerOptions = {}) {
    this.adapter = options.adapter;
    this.validator = options.validator ?? new PlaybackValidator();
  }

  schedule(events: TimelineEventV2[]): ScheduledTimelineEvent[] {
    return this.scheduleTimeline(events);
  }

  scheduleTimeline(events: TimelineEventV2[]): ScheduledTimelineEvent[] {
    const validated = validateTimelineEvents([...events]);
    const deduped = dedupeTimelineEvents(validated)
      .sort((left, right) =>
        left.startTime === right.startTime ? left.id.localeCompare(right.id) : left.startTime - right.startTime
      )
    const playbackValidated = this.validator.validate(deduped);
    const scheduled = playbackValidated
      .map<ScheduledTimelineEvent>((event, index) => ({
        ...event,
        scheduledIndex: index,
        scheduledStartTime: event.startTime,
        scheduledEndTime: event.endTime
      }));

    this.scheduledEvents = scheduled;
    if (this.adapter) {
      this.adapter.clearSchedule();
      this.adapter.scheduleEvents(scheduled);
    }

    return scheduled;
  }

  reschedule(events: TimelineEventV2[]): ScheduledTimelineEvent[] {
    this.clear();
    return this.scheduleTimeline(events);
  }

  cancel(eventIds: string[]): void {
    this.scheduledEvents = this.scheduledEvents.filter((event) => !eventIds.includes(event.id));
    this.adapter?.clearSchedule(eventIds);
  }

  clear(): void {
    this.scheduledEvents = [];
    this.adapter?.clearSchedule();
  }

  seekRecovery(positionSeconds: number): ScheduledTimelineEvent[] {
    const recovered = this.scheduledEvents.filter((event) => event.endTime > positionSeconds);
    this.scheduledEvents = recovered;
    if (this.adapter) {
      this.adapter.clearSchedule();
      this.adapter.scheduleEvents(recovered);
    }
    return recovered;
  }

  async play(startAtSeconds?: number): Promise<SchedulerTransportState> {
    if (typeof startAtSeconds === 'number' && Number.isFinite(startAtSeconds) && startAtSeconds > 0) {
      this.seekRecovery(startAtSeconds);
    }

    this.transportState = 'loading';
    await this.adapter?.play();
    this.transportState = 'playing';
    return this.transportState;
  }

  pause(): SchedulerTransportState {
    this.adapter?.pause();
    this.transportState = 'paused';
    return this.transportState;
  }

  stop(): SchedulerTransportState {
    this.adapter?.clearSchedule();
    this.adapter?.stop();
    this.scheduledEvents = [];
    this.transportState = 'stopped';
    return this.transportState;
  }

  seek(positionSeconds: number): ScheduledTimelineEvent[] {
    const safePosition = Number.isFinite(positionSeconds) ? Math.max(0, positionSeconds) : 0;
    this.transportState = 'seeking';
    this.adapter?.seek(safePosition);
    const recovered = this.seekRecovery(safePosition);
    this.transportState = 'paused';
    return recovered;
  }

  dispose(): void | Promise<void> {
    this.clear();
    this.transportState = 'stopped';
    return this.adapter?.dispose();
  }

  emergencyStop(): SchedulerTransportState {
    this.adapter?.clearSchedule();
    this.adapter?.stop();
    this.scheduledEvents = [];
    this.transportState = 'stopped';
    return this.transportState;
  }

  getScheduledEventCount(): number {
    return this.scheduledEvents.length;
  }

  getTransportState(): SchedulerTransportState {
    return this.transportState;
  }

  getScheduledEvents(): ScheduledTimelineEvent[] {
    return [...this.scheduledEvents];
  }
}

function dedupeTimelineEvents(events: TimelineEventV2[]): TimelineEventV2[] {
  const seen = new Set<string>();
  const output: TimelineEventV2[] = [];

  for (const event of events) {
    const key = `${event.id}:${event.startTime}:${event.endTime}:${event.type}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(event);
  }

  return output;
}
