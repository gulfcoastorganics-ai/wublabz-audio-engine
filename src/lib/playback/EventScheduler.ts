import type { TimelineEventV2 } from '../producer/types.js';
import { validateTimelineEvents } from '../producer/ArrangementReconstructionEngine.js';
import type { ToneJsAdapter } from './ToneAdapter.js';
import { PlaybackValidator } from './PlaybackValidator.js';

export interface ScheduledTimelineEvent extends TimelineEventV2 {
  scheduledIndex: number;
  scheduledStartTime: number;
  scheduledEndTime: number;
}

export interface EventSchedulerOptions {
  adapter?: ToneJsAdapter;
  validator?: PlaybackValidator;
}

export class EventScheduler {
  private readonly adapter: ToneJsAdapter | undefined;
  private readonly validator: PlaybackValidator;
  private scheduledEvents: ScheduledTimelineEvent[] = [];

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
    if (this.adapter) {
      this.adapter.clearSchedule();
      this.adapter.scheduleEvents(recovered);
    }
    return recovered;
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
