import { describe, expect, it } from 'vitest';
import { parseAndValidateInboundEvent, validateInboundEvent } from '../src/wublabz/protocol.js';

describe('WubLabz protocol validation', () => {
  it('accepts heartbeat payloads with client timestamps', () => {
    const result = validateInboundEvent({
      type: 'HEARTBEAT',
      source: 'wubpad',
      payload: { clientSent: 1234 }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event).toEqual({
      type: 'HEARTBEAT',
      source: 'wubpad',
      payload: { clientSent: 1234 }
    });
  });

  it('rejects malformed JSON deterministically', () => {
    const result = parseAndValidateInboundEvent('{bad json');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected malformed JSON to be rejected');

    expect(result.rejection).toMatchObject({
      originalType: 'UNKNOWN',
      reason: 'Malformed JSON',
      suggestedAction: 'Send a valid WubLabz protocol event'
    });
    expect(result.rejection.timestamp).toEqual(expect.any(Number));
  });

  it('accepts valid STOP transport controls', () => {
    const result = validateInboundEvent({
      type: 'TRANSPORT_CONTROL',
      source: 'wubpad',
      payload: { action: 'STOP' }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event).toEqual({
      type: 'TRANSPORT_CONTROL',
      source: 'wubpad',
      payload: { action: 'STOP' }
    });
  });

  it('rejects invalid transport actions', () => {
    const result = validateInboundEvent({
      type: 'TRANSPORT_CONTROL',
      source: 'wubpad',
      payload: { action: 'SCRUB' }
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid transport action to be rejected');

    expect(result.rejection).toMatchObject({
      originalType: 'TRANSPORT_CONTROL',
      reason: 'TRANSPORT_CONTROL payload.action is invalid'
    });
  });

  it('rejects malformed modulation payloads', () => {
    const result = validateInboundEvent({
      type: 'MODULATION',
      source: 'wubpad',
      payload: { effectId: 'filter', parameter: 'cutoff', value: 'wide-open' }
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected malformed modulation payload to be rejected');

    expect(result.rejection).toMatchObject({
      originalType: 'MODULATION',
      reason: 'MODULATION payload.value must be a number'
    });
  });

  it('rejects malformed scene trigger quantize values', () => {
    const result = validateInboundEvent({
      type: 'SCENE_TRIGGER',
      source: 'wubpad',
      payload: { sceneId: 'DROP_A', quantize: 'whenever' }
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected malformed scene payload to be rejected');

    expect(result.rejection).toMatchObject({
      originalType: 'SCENE_TRIGGER',
      reason: 'SCENE_TRIGGER payload.quantize is invalid'
    });
  });

  it('accepts valid performance macro payloads', () => {
    const result = validateInboundEvent({
      type: 'PERFORMANCE_MACRO',
      source: 'wubpad',
      payload: {
        macroId: 'filter_sweep_up',
        intensity: 0.75,
        quantize: 'nextBar',
        durationBeats: 4,
        durationBars: 1
      }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event).toEqual({
      type: 'PERFORMANCE_MACRO',
      source: 'wubpad',
      payload: {
        macroId: 'filter_sweep_up',
        intensity: 0.75,
        quantize: 'nextBar',
        durationBeats: 4,
        durationBars: 1
      }
    });
  });

  it('accepts emergency stop without a payload', () => {
    const result = validateInboundEvent({
      type: 'EMERGENCY_STOP',
      source: 'wubpad'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event).toEqual({
      type: 'EMERGENCY_STOP',
      source: 'wubpad',
      payload: {}
    });
  });

  it('rejects unknown event types before runtime dispatch', () => {
    const result = validateInboundEvent({
      type: 'MIX_THE_DROP',
      source: 'wubpad',
      payload: {}
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected unknown event type to be rejected');

    expect(result.rejection).toMatchObject({
      originalType: 'MIX_THE_DROP',
      reason: 'Unknown event type',
      suggestedAction: 'Use a supported WubLabz protocol event type'
    });
  });
});
