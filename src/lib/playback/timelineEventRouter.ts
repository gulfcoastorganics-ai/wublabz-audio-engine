import type { AudioBusName } from './AudioGraph.js';
import type { TimelineEventV2 } from '../producer/types.js';

export type TimelinePlaybackCommandType = 'trigger' | 'fade' | 'marker' | 'noop';

export type TimelineRouteAction =
  | {
      actionType: 'triggerClip';
      commandType: 'trigger';
      bus: AudioBusName;
      clipId: string;
      sourcePath?: string;
      offsetSeconds?: number;
      durationSeconds: number;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'sliceTrigger';
      commandType: 'trigger';
      bus: AudioBusName;
      sliceId: string;
      clipId: string;
      durationSeconds: number;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'fadeTransition';
      commandType: 'fade';
      bus: AudioBusName;
      transitionType: 'riser' | 'impact' | 'fill' | 'transition';
      durationSeconds: number;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'marker';
      commandType: 'marker';
      markerType: 'section' | 'scene' | 'transition' | 'generic';
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'stemMute';
      commandType: 'marker';
      bus: AudioBusName;
      stemId: string;
      muted: boolean;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'gainChange';
      commandType: 'marker';
      bus: AudioBusName;
      value: number;
      rampTime: number;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'macro';
      commandType: 'marker';
      macroId: string;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'modulation';
      commandType: 'marker';
      effectId: string;
      parameter: string;
      value: number;
      rampTime?: number;
      payload: Record<string, unknown>;
    }
  | {
      actionType: 'noop';
      commandType: 'noop';
      reason: string;
      payload: Record<string, unknown>;
    };

export type TimelineRouteResult =
  | {
      success: true;
      eventId: string;
      action: TimelineRouteAction;
    }
  | {
      success: false;
      eventId: string;
      reason: string;
      action: Extract<TimelineRouteAction, { actionType: 'noop' }>;
    };

export interface TimelineRouteDiagnosticsSink {
  update(partial: { lastRouteError?: string | null }): void;
}

export interface TimelineEventRouterOptions {
  diagnostics?: TimelineRouteDiagnosticsSink;
}

const STEM_EVENT_TYPES = ['stem_clip', 'drum', 'bass', 'lead', 'synth', 'vocal', 'fx'] as const;
const TRANSITION_EVENT_TYPES = ['riser', 'impact', 'fill', 'transition'] as const;

export class TimelineEventRouter {
  constructor(private readonly options: TimelineEventRouterOptions = {}) {}

  route(event: TimelineEventV2): TimelineRouteResult {
    if (!hasValidTimeRange(event)) {
      return this.fail(event, `Invalid timeline event time range for ${event.id}`);
    }

    if (!event.enabled) {
      return this.ok(event, noopAction(event, 'disabled'));
    }

    const payloadRoute = routePayloadAction(event);
    if (payloadRoute) {
      return this.ok(event, payloadRoute);
    }

    if (event.type === 'marker') {
      return this.ok(event, {
        actionType: 'marker',
        commandType: 'marker',
        markerType: resolveMarkerType(event),
        payload: createBasePayload(event)
      });
    }

    if (event.type === 'silence') {
      return this.ok(event, noopAction(event, 'silence'));
    }

    if (isTransitionEventType(event.type)) {
      return this.ok(event, {
        actionType: 'fadeTransition',
        commandType: 'fade',
        bus: 'fx',
        transitionType: event.type,
        durationSeconds: getDurationSeconds(event),
        payload: createBasePayload(event)
      });
    }

    if (isStemEventType(event.type)) {
      return this.ok(event, {
        actionType: 'triggerClip',
        commandType: 'trigger',
        bus: resolveBus(event),
        clipId: resolveClipId(event),
        ...resolveOptionalSourcePath(event),
        ...resolveOptionalOffset(event),
        durationSeconds: getDurationSeconds(event),
        payload: createBasePayload(event)
      });
    }

    const reason = `Unsupported timeline event type: ${String(event.type)}`;
    this.options.diagnostics?.update({ lastRouteError: reason });
    return this.ok(event, noopAction(event, reason));
  }

  routeMany(events: TimelineEventV2[]): TimelineRouteResult[] {
    return events.map((event) => this.route(event));
  }

  private ok(event: TimelineEventV2, action: TimelineRouteAction): TimelineRouteResult {
    return {
      success: true,
      eventId: event.id,
      action
    };
  }

  private fail(event: TimelineEventV2, reason: string): TimelineRouteResult {
    this.options.diagnostics?.update({ lastRouteError: reason });
    return {
      success: false,
      eventId: event.id,
      reason,
      action: noopAction(event, reason)
    };
  }
}

export function routeTimelineEvent(event: TimelineEventV2, options: TimelineEventRouterOptions = {}): TimelineRouteResult {
  return new TimelineEventRouter(options).route(event);
}

export function resolveTimelineEventBus(event: TimelineEventV2): AudioBusName {
  return resolveBus(event);
}

function routePayloadAction(event: TimelineEventV2): TimelineRouteAction | undefined {
  const payload = event.payload;
  const action = readString(payload.action) ?? readString(payload.route);

  if (action === 'stemMute' || typeof payload.muted === 'boolean') {
    return {
      actionType: 'stemMute',
      commandType: 'marker',
      bus: resolveBus(event),
      stemId: readString(payload.stemId) ?? event.stemId ?? resolveClipId(event),
      muted: typeof payload.muted === 'boolean' ? payload.muted : true,
      payload: createBasePayload(event)
    };
  }

  if (action === 'gainChange' || typeof payload.gain === 'number') {
    return {
      actionType: 'gainChange',
      commandType: 'marker',
      bus: resolveBus(event),
      value: readFiniteNumber(payload.gain) ?? readFiniteNumber(payload.value) ?? event.energyLevel,
      rampTime: readFiniteNumber(payload.rampTime) ?? 0,
      payload: createBasePayload(event)
    };
  }

  const sliceId = readString(payload.sliceId) ?? readString(payload.chopId);
  if (action === 'sliceTrigger' || action === 'chopTrigger' || sliceId) {
    return {
      actionType: 'sliceTrigger',
      commandType: 'trigger',
      bus: resolveBus(event),
      sliceId: sliceId ?? `${event.id}:slice`,
      clipId: resolveClipId(event),
      durationSeconds: getDurationSeconds(event),
      payload: createBasePayload(event)
    };
  }

  const macroId = readString(payload.macroId);
  if (action === 'macro' && macroId) {
    return {
      actionType: 'macro',
      commandType: 'marker',
      macroId,
      payload: createBasePayload(event)
    };
  }

  const effectId = readString(payload.effectId);
  const parameter = readString(payload.parameter);
  const value = readFiniteNumber(payload.value);
  if (action === 'modulation' && effectId && parameter && value !== undefined) {
    return {
      actionType: 'modulation',
      commandType: 'marker',
      effectId,
      parameter,
      value,
      ...resolveOptionalRampTime(payload),
      payload: createBasePayload(event)
    };
  }

  return undefined;
}

function createBasePayload(event: TimelineEventV2): Record<string, unknown> {
  return {
    ...event.payload,
    type: event.type,
    sectionId: event.sectionId,
    stemId: event.stemId,
    clipId: resolveClipId(event),
    sourcePath: event.payload.sourcePath ?? event.payload.clipPath,
    energyLevel: event.energyLevel,
    probability: event.probability
  };
}

function noopAction(event: TimelineEventV2, reason: string): Extract<TimelineRouteAction, { actionType: 'noop' }> {
  return {
    actionType: 'noop',
    commandType: 'noop',
    reason,
    payload: createBasePayload(event)
  };
}

function resolveMarkerType(event: TimelineEventV2): Extract<TimelineRouteAction, { actionType: 'marker' }>['markerType'] {
  if (typeof event.payload.sceneId === 'string') {
    return 'scene';
  }
  if (typeof event.payload.transitionType === 'string') {
    return 'transition';
  }
  if (typeof event.payload.sectionType === 'string') {
    return 'section';
  }
  return 'generic';
}

function resolveBus(event: TimelineEventV2): AudioBusName {
  if (event.type === 'drum') return 'drum';
  if (event.type === 'bass') return 'bass';
  if (event.type === 'vocal') return 'vocal';
  if (event.type === 'fx' || isTransitionEventType(event.type)) return 'fx';

  const role = readString(event.payload.role);
  if (role === 'drums' || role === 'perc') return 'drum';
  if (role === 'bass') return 'bass';
  if (role === 'vocal') return 'vocal';
  if (role === 'fx' || role === 'noise') return 'fx';
  if (event.type === 'lead' || event.type === 'synth' || event.type === 'stem_clip') return 'melody';

  return 'preview';
}

function resolveClipId(event: TimelineEventV2): string {
  return readString(event.payload.clipId) ?? event.stemId ?? event.sourceId;
}

function resolveOptionalSourcePath(event: TimelineEventV2): { sourcePath?: string } {
  const sourcePath = readString(event.payload.sourcePath) ?? readString(event.payload.clipPath);
  return sourcePath ? { sourcePath } : {};
}

function resolveOptionalOffset(event: TimelineEventV2): { offsetSeconds?: number } {
  const offsetSeconds = readFiniteNumber(event.payload.clipOffsetSeconds);
  return offsetSeconds !== undefined ? { offsetSeconds } : {};
}

function resolveOptionalRampTime(payload: Record<string, unknown>): { rampTime?: number } {
  const rampTime = readFiniteNumber(payload.rampTime);
  return rampTime !== undefined ? { rampTime } : {};
}

function getDurationSeconds(event: TimelineEventV2): number {
  return Math.max(0, event.endTime - event.startTime);
}

function hasValidTimeRange(event: TimelineEventV2): boolean {
  return Number.isFinite(event.startTime) && Number.isFinite(event.endTime) && event.endTime > event.startTime;
}

function isStemEventType(value: TimelineEventV2['type']): boolean {
  return (STEM_EVENT_TYPES as readonly string[]).includes(value);
}

function isTransitionEventType(value: string): value is 'riser' | 'impact' | 'fill' | 'transition' {
  return (TRANSITION_EVENT_TYPES as readonly string[]).includes(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
