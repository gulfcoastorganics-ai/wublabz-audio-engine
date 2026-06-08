import type { SceneQuantize } from '../lib/playback/transportSnapshot.js';

export const WUBLABZ_EVENT_TYPES = [
  'HEARTBEAT',
  'TRANSPORT_CONTROL',
  'SCENE_TRIGGER',
  'MODULATION',
  'PERFORMANCE_MACRO',
  'EMERGENCY_STOP'
] as const;

export const TRANSPORT_ACTIONS = ['PLAY', 'PAUSE', 'STOP', 'SEEK', 'RESET'] as const;
export const SCENE_QUANTIZE_VALUES = ['immediate', 'nextBeat', 'nextBar', 'nextPhrase'] as const;

export type WubLabzEventType = typeof WUBLABZ_EVENT_TYPES[number];
export type TransportAction = typeof TRANSPORT_ACTIONS[number];

export interface EventRejectedPayload {
  originalType: string;
  reason: string;
  suggestedAction: string;
  timestamp: number;
}

export interface HeartbeatPayload extends Record<string, unknown> {
  clientSent?: number;
}

export interface TransportControlPayload {
  action: TransportAction;
  positionSeconds?: number;
}

export interface SceneTriggerPayload {
  sceneId: string;
  quantize?: SceneQuantize;
}

export interface ModulationPayload {
  effectId: string;
  parameter: string;
  value: number;
  rampTime?: number;
}

export interface PerformanceMacroPayload {
  macroId: string;
  intensity?: number;
  quantize?: SceneQuantize;
  durationBeats?: number;
  durationBars?: number;
}

export type EmergencyStopPayload = Record<string, unknown>;

export type ValidatedWubLabzEvent =
  | { type: 'HEARTBEAT'; source: string; timestamp?: number; payload: HeartbeatPayload }
  | { type: 'TRANSPORT_CONTROL'; source: string; timestamp?: number; payload: TransportControlPayload }
  | { type: 'SCENE_TRIGGER'; source: string; timestamp?: number; payload: SceneTriggerPayload }
  | { type: 'MODULATION'; source: string; timestamp?: number; payload: ModulationPayload }
  | { type: 'PERFORMANCE_MACRO'; source: string; timestamp?: number; payload: PerformanceMacroPayload }
  | { type: 'EMERGENCY_STOP'; source: string; timestamp?: number; payload: EmergencyStopPayload };

export type ProtocolValidationResult =
  | { success: true; event: ValidatedWubLabzEvent }
  | { success: false; rejection: EventRejectedPayload };

type PayloadValidationResult<T> =
  | { success: true; payload: T }
  | { success: false; reason: string; suggestedAction?: string };

const DEFAULT_PROTOCOL_ACTION = 'Send a valid WubLabz protocol event';

export function createProtocolRejection(
  originalType: string,
  reason: string,
  suggestedAction: string = DEFAULT_PROTOCOL_ACTION
): EventRejectedPayload {
  return {
    originalType,
    reason,
    suggestedAction,
    timestamp: Date.now()
  };
}

export function parseAndValidateInboundEvent(rawMessage: string): ProtocolValidationResult {
  try {
    return validateInboundEvent(JSON.parse(rawMessage));
  } catch {
    return {
      success: false,
      rejection: createProtocolRejection('UNKNOWN', 'Malformed JSON')
    };
  }
}

export function validateInboundEvent(candidate: unknown): ProtocolValidationResult {
  if (!isRecord(candidate)) {
    return {
      success: false,
      rejection: createProtocolRejection('UNKNOWN', 'Event must be a JSON object')
    };
  }

  const originalType = getOriginalType(candidate);

  if (typeof candidate.type !== 'string' || typeof candidate.source !== 'string') {
    return {
      success: false,
      rejection: createProtocolRejection(originalType, 'Missing event type or source')
    };
  }

  if (!isWubLabzEventType(candidate.type)) {
    return {
      success: false,
      rejection: createProtocolRejection(candidate.type, 'Unknown event type', 'Use a supported WubLabz protocol event type')
    };
  }

  if (candidate.timestamp !== undefined && !isFiniteNumber(candidate.timestamp)) {
    return {
      success: false,
      rejection: createProtocolRejection(candidate.type, 'Event timestamp must be a number')
    };
  }

  const base = {
    source: candidate.source,
    ...(candidate.timestamp !== undefined ? { timestamp: candidate.timestamp } : {})
  };

  switch (candidate.type) {
    case 'HEARTBEAT': {
      const result = validateHeartbeatPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
    case 'TRANSPORT_CONTROL': {
      const result = validateTransportControlPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
    case 'SCENE_TRIGGER': {
      const result = validateSceneTriggerPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
    case 'MODULATION': {
      const result = validateModulationPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
    case 'PERFORMANCE_MACRO': {
      const result = validatePerformanceMacroPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
    case 'EMERGENCY_STOP': {
      const result = validateEmergencyStopPayload(candidate.payload);
      return result.success
        ? { success: true, event: { ...base, type: candidate.type, payload: result.payload } }
        : rejectPayload(candidate.type, result);
    }
  }
}

function validateHeartbeatPayload(payload: unknown): PayloadValidationResult<HeartbeatPayload> {
  if (!isRecord(payload)) {
    return { success: false, reason: 'HEARTBEAT payload must be an object' };
  }
  if (payload.clientSent !== undefined && !isFiniteNumber(payload.clientSent)) {
    return { success: false, reason: 'HEARTBEAT payload.clientSent must be a number' };
  }
  return { success: true, payload: payload as HeartbeatPayload };
}

function validateTransportControlPayload(payload: unknown): PayloadValidationResult<TransportControlPayload> {
  if (!isRecord(payload)) {
    return { success: false, reason: 'TRANSPORT_CONTROL payload must be an object' };
  }
  if (!isTransportAction(payload.action)) {
    return { success: false, reason: 'TRANSPORT_CONTROL payload.action is invalid' };
  }
  if (payload.positionSeconds !== undefined && !isFiniteNumber(payload.positionSeconds)) {
    return { success: false, reason: 'TRANSPORT_CONTROL payload.positionSeconds must be a number' };
  }
  return {
    success: true,
    payload: {
      action: payload.action,
      ...(payload.positionSeconds !== undefined ? { positionSeconds: payload.positionSeconds } : {})
    }
  };
}

function validateSceneTriggerPayload(payload: unknown): PayloadValidationResult<SceneTriggerPayload> {
  if (!isRecord(payload)) {
    return { success: false, reason: 'SCENE_TRIGGER payload must be an object' };
  }
  if (typeof payload.sceneId !== 'string') {
    return { success: false, reason: 'SCENE_TRIGGER payload.sceneId must be a string' };
  }
  if (payload.quantize !== undefined && !isSceneQuantize(payload.quantize)) {
    return { success: false, reason: 'SCENE_TRIGGER payload.quantize is invalid' };
  }
  return {
    success: true,
    payload: {
      sceneId: payload.sceneId,
      ...(payload.quantize !== undefined ? { quantize: payload.quantize } : {})
    }
  };
}

function validateModulationPayload(payload: unknown): PayloadValidationResult<ModulationPayload> {
  if (!isRecord(payload)) {
    return { success: false, reason: 'MODULATION payload must be an object' };
  }
  if (typeof payload.effectId !== 'string') {
    return { success: false, reason: 'MODULATION payload.effectId must be a string' };
  }
  if (typeof payload.parameter !== 'string') {
    return { success: false, reason: 'MODULATION payload.parameter must be a string' };
  }
  if (!isFiniteNumber(payload.value)) {
    return { success: false, reason: 'MODULATION payload.value must be a number' };
  }
  if (payload.rampTime !== undefined && !isFiniteNumber(payload.rampTime)) {
    return { success: false, reason: 'MODULATION payload.rampTime must be a number' };
  }
  return {
    success: true,
    payload: {
      effectId: payload.effectId,
      parameter: payload.parameter,
      value: payload.value,
      ...(payload.rampTime !== undefined ? { rampTime: payload.rampTime } : {})
    }
  };
}

function validatePerformanceMacroPayload(payload: unknown): PayloadValidationResult<PerformanceMacroPayload> {
  if (!isRecord(payload)) {
    return { success: false, reason: 'PERFORMANCE_MACRO payload must be an object' };
  }
  if (typeof payload.macroId !== 'string') {
    return { success: false, reason: 'PERFORMANCE_MACRO payload.macroId must be a string' };
  }
  if (payload.intensity !== undefined && !isFiniteNumber(payload.intensity)) {
    return { success: false, reason: 'PERFORMANCE_MACRO payload.intensity must be a number' };
  }
  if (payload.quantize !== undefined && !isSceneQuantize(payload.quantize)) {
    return { success: false, reason: 'PERFORMANCE_MACRO payload.quantize is invalid' };
  }
  if (payload.durationBeats !== undefined && !isFiniteNumber(payload.durationBeats)) {
    return { success: false, reason: 'PERFORMANCE_MACRO payload.durationBeats must be a number' };
  }
  if (payload.durationBars !== undefined && !isFiniteNumber(payload.durationBars)) {
    return { success: false, reason: 'PERFORMANCE_MACRO payload.durationBars must be a number' };
  }
  return {
    success: true,
    payload: {
      macroId: payload.macroId,
      ...(payload.intensity !== undefined ? { intensity: payload.intensity } : {}),
      ...(payload.quantize !== undefined ? { quantize: payload.quantize } : {}),
      ...(payload.durationBeats !== undefined ? { durationBeats: payload.durationBeats } : {}),
      ...(payload.durationBars !== undefined ? { durationBars: payload.durationBars } : {})
    }
  };
}

function validateEmergencyStopPayload(payload: unknown): PayloadValidationResult<EmergencyStopPayload> {
  if (payload === undefined) {
    return { success: true, payload: {} };
  }
  if (!isRecord(payload)) {
    return { success: false, reason: 'EMERGENCY_STOP payload must be an object' };
  }
  return { success: true, payload };
}

function rejectPayload<T extends PayloadValidationResult<unknown> & { success: false }>(
  originalType: string,
  result: T
): ProtocolValidationResult {
  return {
    success: false,
    rejection: createProtocolRejection(originalType, result.reason, result.suggestedAction)
  };
}

function getOriginalType(candidate: Record<string, unknown>): string {
  return typeof candidate.type === 'string' ? candidate.type : 'UNKNOWN';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWubLabzEventType(value: string): value is WubLabzEventType {
  return (WUBLABZ_EVENT_TYPES as readonly string[]).includes(value);
}

function isTransportAction(value: unknown): value is TransportAction {
  return typeof value === 'string' && (TRANSPORT_ACTIONS as readonly string[]).includes(value);
}

function isSceneQuantize(value: unknown): value is SceneQuantize {
  return typeof value === 'string' && (SCENE_QUANTIZE_VALUES as readonly string[]).includes(value);
}
