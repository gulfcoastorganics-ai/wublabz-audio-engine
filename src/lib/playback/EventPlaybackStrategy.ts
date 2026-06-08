import type { TimelineEventV2 } from '../producer/types.js';
import type { ScheduledTimelineEvent } from './EventScheduler.js';

export interface PlaybackInstruction {
  eventId: string;
  commandType: 'trigger' | 'fade' | 'marker' | 'noop';
  startTime: number;
  endTime: number;
  payload: Record<string, unknown>;
}

export interface PlaybackStrategyContext {
  sectionId: string;
  event: ScheduledTimelineEvent;
}

export interface EventPlaybackStrategy {
  supports(event: TimelineEventV2): boolean;
  createInstructions(event: ScheduledTimelineEvent, context: PlaybackStrategyContext): PlaybackInstruction[];
}

function basePayload(event: ScheduledTimelineEvent): Record<string, unknown> {
  return {
    type: event.type,
    sectionId: event.sectionId,
    stemId: event.stemId,
    clipId: event.payload?.clipId ?? event.stemId ?? event.sourceId,
    energyLevel: event.energyLevel,
    probability: event.probability,
    sourcePath: event.payload?.sourcePath ?? event.payload?.clipPath
  };
}

export class StemPlaybackStrategy implements EventPlaybackStrategy {
  supports(event: TimelineEventV2): boolean {
    return ['stem_clip', 'drum', 'bass', 'lead', 'synth', 'vocal', 'fx'].includes(event.type);
  }

  createInstructions(event: ScheduledTimelineEvent, context: PlaybackStrategyContext): PlaybackInstruction[] {
    return [
      {
        eventId: event.id,
        commandType: 'trigger',
        startTime: event.startTime,
        endTime: event.endTime,
        payload: {
          ...basePayload(event),
          role: context.event.payload?.role ?? event.type,
          clipId: event.payload?.clipId ?? event.stemId ?? context.event.payload?.clipId ?? event.sourceId
        }
      }
    ];
  }
}

export class TransitionPlaybackStrategy implements EventPlaybackStrategy {
  supports(event: TimelineEventV2): boolean {
    return ['transition', 'impact', 'riser', 'fill'].includes(event.type);
  }

  createInstructions(event: ScheduledTimelineEvent): PlaybackInstruction[] {
    return [
      {
        eventId: event.id,
        commandType: 'fade',
        startTime: event.startTime,
        endTime: event.endTime,
        payload: {
          ...basePayload(event),
          transitionType: event.payload?.transitionType ?? event.type
        }
      }
    ];
  }
}

export class MarkerPlaybackStrategy implements EventPlaybackStrategy {
  supports(event: TimelineEventV2): boolean {
    return event.type === 'marker';
  }

  createInstructions(event: ScheduledTimelineEvent): PlaybackInstruction[] {
    return [
      {
        eventId: event.id,
        commandType: 'marker',
        startTime: event.startTime,
        endTime: event.endTime,
        payload: basePayload(event)
      }
    ];
  }
}

export class SilencePlaybackStrategy implements EventPlaybackStrategy {
  supports(event: TimelineEventV2): boolean {
    return event.type === 'silence';
  }

  createInstructions(event: ScheduledTimelineEvent): PlaybackInstruction[] {
    return [
      {
        eventId: event.id,
        commandType: 'noop',
        startTime: event.startTime,
        endTime: event.endTime,
        payload: basePayload(event)
      }
    ];
  }
}

export function createDefaultPlaybackStrategies(): EventPlaybackStrategy[] {
  return [
    new MarkerPlaybackStrategy(),
    new SilencePlaybackStrategy(),
    new TransitionPlaybackStrategy(),
    new StemPlaybackStrategy()
  ];
}

export function resolvePlaybackInstructions(
  event: ScheduledTimelineEvent,
  context: PlaybackStrategyContext,
  strategies = createDefaultPlaybackStrategies()
): PlaybackInstruction[] {
  const strategy = strategies.find((candidate) => candidate.supports(event));
  return strategy ? strategy.createInstructions(event, context) : [];
}
