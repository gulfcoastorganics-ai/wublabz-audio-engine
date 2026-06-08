import { describe, expect, it, vi } from 'vitest';
import { AudioClipManager } from '../src/lib/playback/AudioClipManager.js';
import { ToneJsAdapter } from '../src/lib/playback/ToneAdapter.js';
import type {
  ScheduledTimelineEvent,
} from '../src/lib/playback/EventScheduler.js';
import type {
  ToneAudioBufferLike,
  ToneLikeRuntime,
  TonePlayerLike,
} from '../src/lib/playback/ToneAdapter.js';

vi.mock('tone', () => ({
  start: async () => undefined,
  now: () => 0,
  Transport: {
    bpm: { value: 120 },
    seconds: 0,
    scheduleOnce: () => -1,
    clear: () => undefined,
    cancel: () => undefined,
    start: () => undefined,
    pause: () => undefined,
    stop: () => undefined
  },
  Player: class {},
  ToneAudioBuffer: {
    fromUrl: async () => ({ duration: 1 })
  }
}));

function createScheduledEvent(): ScheduledTimelineEvent {
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
    payload: { sourcePath: 'fixture.wav' },
    scheduledIndex: 0,
    scheduledStartTime: 0,
    scheduledEndTime: 1
  };
}

describe('ToneJsAdapter', () => {
  it('drops renderable events instead of routing to destination when BusGraph is missing', async () => {
    let scheduledCallback: ((time: number) => void) | undefined;
    let startCalls = 0;
    let disposeCalls = 0;

    class TestPlayer implements TonePlayerLike {
      volume = { value: 0 };
      playbackRate = 1;

      constructor(readonly buffer?: unknown) {}

      connect() {
        return this;
      }

      start() {
        startCalls += 1;
        return this;
      }

      stop() {
        return this;
      }

      dispose() {
        disposeCalls += 1;
        return this;
      }
    }

    const runtime: ToneLikeRuntime = {
      start: async () => undefined,
      now: () => 0,
      Transport: {
        bpm: { value: 120 },
        seconds: 0,
        scheduleOnce: (callback) => {
          scheduledCallback = callback;
          return 1;
        },
        clear: () => undefined,
        cancel: () => undefined,
        start: () => undefined,
        pause: () => undefined,
        stop: () => undefined
      },
      Player: TestPlayer,
      ToneAudioBuffer: {
        fromUrl: async () => ({ duration: 1 })
      }
    };

    const clipManager = new AudioClipManager<ToneAudioBufferLike>(async () => ({
      buffer: { duration: 1 },
      duration: 1
    }));
    const adapter = new ToneJsAdapter({ runtime, clipManager });
    const event = createScheduledEvent();

    await adapter.preloadEvents([event]);
    adapter.scheduleEvent(event);
    scheduledCallback?.(0);
    await Promise.resolve();

    expect(startCalls).toBe(0);
    expect(disposeCalls).toBe(1);
    expect(adapter.getMetrics().droppedEvents).toBe(1);
  });
});
