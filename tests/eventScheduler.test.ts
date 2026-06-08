import { describe, expect, it } from 'vitest';
import { EventScheduler } from '../src/lib/playback/EventScheduler.js';
import type { ScheduledTimelineEvent } from '../src/lib/playback/EventScheduler.js';
import type { ToneJsAdapter } from '../src/lib/playback/ToneAdapter.js';
import type { TimelineEventV2 } from '../src/lib/producer/types.js';

function createEvent(overrides: Partial<TimelineEventV2> = {}): TimelineEventV2 {
  return {
    id: 'event-1',
    type: 'bass',
    sourceId: 'source-1',
    stemId: 'bass-stem',
    sectionId: 'drop-1',
    startTime: 0,
    endTime: 1,
    beatStart: 0,
    beatEnd: 4,
    barStart: 0,
    barEnd: 1,
    energyLevel: 0.8,
    enabled: true,
    probability: 1,
    payload: {},
    ...overrides
  };
}

function createAdapterHarness() {
  const calls = {
    clearSchedule: 0,
    scheduleEvents: [] as string[][],
    play: 0,
    pause: 0,
    stop: 0,
    seek: [] as number[],
    dispose: 0
  };

  const adapter = {
    clearSchedule: () => {
      calls.clearSchedule += 1;
    },
    scheduleEvents: (events: ScheduledTimelineEvent[]) => {
      calls.scheduleEvents.push(events.map((event) => event.id));
      return [];
    },
    play: async () => {
      calls.play += 1;
      return 'playing';
    },
    pause: () => {
      calls.pause += 1;
      return 'paused';
    },
    stop: () => {
      calls.stop += 1;
      return 'stopped';
    },
    seek: (positionSeconds: number) => {
      calls.seek.push(positionSeconds);
      return 'paused';
    },
    dispose: async () => {
      calls.dispose += 1;
    }
  } as unknown as ToneJsAdapter;

  return { adapter, calls };
}

describe('EventScheduler', () => {
  it('orders events deterministically and deduplicates identical events', () => {
    const scheduler = new EventScheduler();
    const events = [
      createEvent({ id: 'b', startTime: 2, endTime: 3, beatStart: 8, beatEnd: 12, barStart: 2, barEnd: 3 }),
      createEvent({ id: 'a', startTime: 1, endTime: 2, beatStart: 4, beatEnd: 8, barStart: 1, barEnd: 2 }),
      createEvent({ id: 'a', startTime: 1, endTime: 2, beatStart: 4, beatEnd: 8, barStart: 1, barEnd: 2 })
    ];

    const scheduled = scheduler.schedule(events);

    expect(scheduled.map((event) => event.id)).toEqual(['a', 'b']);
    expect(scheduler.getScheduledEventCount()).toBe(2);
  });

  it('stop clears scheduled events and pending adapter schedule', () => {
    const { adapter, calls } = createAdapterHarness();
    const scheduler = new EventScheduler({ adapter });

    scheduler.schedule([
      createEvent({ id: 'a' }),
      createEvent({ id: 'b', startTime: 1, endTime: 2, beatStart: 4, beatEnd: 8, barStart: 1, barEnd: 2 })
    ]);
    const state = scheduler.stop();

    expect(state).toBe('stopped');
    expect(scheduler.getScheduledEventCount()).toBe(0);
    expect(calls.clearSchedule).toBeGreaterThanOrEqual(2);
    expect(calls.stop).toBe(1);
  });

  it('seek reschedules only future events and updates transport state', () => {
    const { adapter, calls } = createAdapterHarness();
    const scheduler = new EventScheduler({ adapter });

    scheduler.schedule([
      createEvent({ id: 'past', startTime: 0, endTime: 1 }),
      createEvent({ id: 'future', startTime: 2, endTime: 3, beatStart: 8, beatEnd: 12, barStart: 2, barEnd: 3 })
    ]);
    const recovered = scheduler.seek(1.5);

    expect(recovered.map((event) => event.id)).toEqual(['future']);
    expect(scheduler.getScheduledEvents().map((event) => event.id)).toEqual(['future']);
    expect(scheduler.getScheduledEventCount()).toBe(1);
    expect(scheduler.getTransportState()).toBe('paused');
    expect(calls.seek).toEqual([1.5]);
    expect(calls.scheduleEvents.at(-1)).toEqual(['future']);
  });

  it('emergencyStop preempts schedule and clears adapter callbacks', () => {
    const { adapter, calls } = createAdapterHarness();
    const scheduler = new EventScheduler({ adapter });

    scheduler.schedule([createEvent()]);
    const state = scheduler.emergencyStop();

    expect(state).toBe('stopped');
    expect(scheduler.getScheduledEventCount()).toBe(0);
    expect(calls.clearSchedule).toBeGreaterThanOrEqual(2);
    expect(calls.stop).toBe(1);
  });

  it('play, pause, clear, and dispose update state and schedule counts', async () => {
    const { adapter, calls } = createAdapterHarness();
    const scheduler = new EventScheduler({ adapter });

    scheduler.schedule([createEvent()]);
    await expect(scheduler.play()).resolves.toBe('playing');
    expect(scheduler.getTransportState()).toBe('playing');

    expect(scheduler.pause()).toBe('paused');
    expect(scheduler.getTransportState()).toBe('paused');

    scheduler.clear();
    expect(scheduler.getScheduledEventCount()).toBe(0);

    await scheduler.dispose();
    expect(calls.dispose).toBe(1);
    expect(scheduler.getTransportState()).toBe('stopped');
  });
});
