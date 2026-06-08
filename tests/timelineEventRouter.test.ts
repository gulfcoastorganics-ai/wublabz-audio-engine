import { describe, expect, it } from 'vitest';
import { EngineDiagnosticsStore } from '../src/lib/diagnostics/EngineDiagnosticsStore.js';
import { TimelineEventRouter } from '../src/lib/playback/timelineEventRouter.js';
import type { TimelineEventV2 } from '../src/lib/producer/types.js';

function createEvent(overrides: Partial<TimelineEventV2> = {}): TimelineEventV2 {
  return {
    id: 'event-1',
    type: 'bass',
    sourceId: 'source-1',
    stemId: 'bass-stem',
    sectionId: 'drop-1',
    startTime: 1,
    endTime: 3,
    beatStart: 4,
    beatEnd: 12,
    barStart: 1,
    barEnd: 3,
    energyLevel: 0.8,
    enabled: true,
    probability: 1,
    payload: {},
    ...overrides
  };
}

describe('TimelineEventRouter', () => {
  it('routes known stem events to trigger actions and expected buses', () => {
    const result = new TimelineEventRouter().route(createEvent());

    expect(result.success).toBe(true);
    expect(result.action).toMatchObject({
      actionType: 'triggerClip',
      commandType: 'trigger',
      bus: 'bass',
      clipId: 'bass-stem',
      durationSeconds: 2
    });
  });

  it('routes transition events to fade actions', () => {
    const result = new TimelineEventRouter().route(createEvent({
      id: 'riser-1',
      type: 'riser',
      stemId: undefined,
      payload: { transitionType: 'riser' }
    }));

    expect(result.success).toBe(true);
    expect(result.action).toMatchObject({
      actionType: 'fadeTransition',
      commandType: 'fade',
      bus: 'fx',
      transitionType: 'riser'
    });
  });

  it('routes section and scene markers without scheduling sound', () => {
    const sectionMarker = new TimelineEventRouter().route(createEvent({
      type: 'marker',
      stemId: undefined,
      payload: { sectionType: 'drop' }
    }));
    const sceneMarker = new TimelineEventRouter().route(createEvent({
      type: 'marker',
      stemId: undefined,
      payload: { sceneId: 'DROP_A' }
    }));

    expect(sectionMarker.action).toMatchObject({
      actionType: 'marker',
      commandType: 'marker',
      markerType: 'section'
    });
    expect(sceneMarker.action).toMatchObject({
      actionType: 'marker',
      commandType: 'marker',
      markerType: 'scene'
    });
  });

  it('routes macro and modulation marker payloads to explicit marker actions', () => {
    const macro = new TimelineEventRouter().route(createEvent({
      type: 'marker',
      payload: { action: 'macro', macroId: 'filter_sweep_up' }
    }));
    const modulation = new TimelineEventRouter().route(createEvent({
      type: 'marker',
      payload: { action: 'modulation', effectId: 'filter', parameter: 'cutoff', value: 1200, rampTime: 0.5 }
    }));

    expect(macro.action).toMatchObject({
      actionType: 'macro',
      commandType: 'marker',
      macroId: 'filter_sweep_up'
    });
    expect(modulation.action).toMatchObject({
      actionType: 'modulation',
      commandType: 'marker',
      effectId: 'filter',
      parameter: 'cutoff',
      value: 1200,
      rampTime: 0.5
    });
  });

  it('routes stem mute, gain change, and slice payloads without direct audio scheduling', () => {
    const mute = new TimelineEventRouter().route(createEvent({
      payload: { action: 'stemMute', muted: true }
    }));
    const gain = new TimelineEventRouter().route(createEvent({
      payload: { action: 'gainChange', gain: 0.4, rampTime: 0.25 }
    }));
    const slice = new TimelineEventRouter().route(createEvent({
      payload: { action: 'sliceTrigger', sliceId: 'slice-8' }
    }));

    expect(mute.action).toMatchObject({ actionType: 'stemMute', commandType: 'marker', muted: true });
    expect(gain.action).toMatchObject({ actionType: 'gainChange', commandType: 'marker', value: 0.4, rampTime: 0.25 });
    expect(slice.action).toMatchObject({ actionType: 'sliceTrigger', commandType: 'trigger', sliceId: 'slice-8' });
  });

  it('unknown metadata events no-op safely and update route diagnostics', () => {
    const diagnostics = new EngineDiagnosticsStore();
    const result = new TimelineEventRouter({ diagnostics }).route(createEvent({
      type: 'metadata' as TimelineEventV2['type']
    }));

    expect(result.success).toBe(true);
    expect(result.action).toMatchObject({
      actionType: 'noop',
      commandType: 'noop'
    });
    expect(diagnostics.getDiagnostics().lastRouteError).toBe('Unsupported timeline event type: metadata');
  });

  it('route errors return structured failure and diagnostics', () => {
    const diagnostics = new EngineDiagnosticsStore();
    const result = new TimelineEventRouter({ diagnostics }).route(createEvent({
      startTime: 3,
      endTime: 1
    }));

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected route failure');

    expect(result.reason).toBe('Invalid timeline event time range for event-1');
    expect(result.action).toMatchObject({
      actionType: 'noop',
      commandType: 'noop'
    });
    expect(diagnostics.getDiagnostics().lastRouteError).toBe(result.reason);
  });
});
