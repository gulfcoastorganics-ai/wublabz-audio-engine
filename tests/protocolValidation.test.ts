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

  it('accepts valid TRANSPORT_PLAY', () => {
    const result = validateInboundEvent({
      type: 'TRANSPORT_PLAY',
      source: 'wubpad'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('TRANSPORT_PLAY');
  });

  it('accepts valid TRANSPORT_SEEK', () => {
    const result = validateInboundEvent({
      type: 'TRANSPORT_SEEK',
      source: 'wubpad',
      payload: { positionSeconds: 15.5 }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('TRANSPORT_SEEK');
    // @ts-ignore
    expect(result.event.payload.positionSeconds).toBe(15.5);
  });

  it('rejects TRANSPORT_SEEK without position', () => {
    const result = validateInboundEvent({
      type: 'TRANSPORT_SEEK',
      source: 'wubpad',
      payload: {}
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid TRANSPORT_SEEK to be rejected');
  });

  it('accepts valid STEM_MUTE', () => {
    const result = validateInboundEvent({
      type: 'STEM_MUTE',
      source: 'wubpad',
      payload: { stemId: 'drum' }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('STEM_MUTE');
    // @ts-ignore
    expect(result.event.payload.stemId).toBe('drum');
  });

  it('accepts valid STEM_GAIN', () => {
    const result = validateInboundEvent({
      type: 'STEM_GAIN',
      source: 'wubpad',
      payload: { stemId: 'drum', value: 0.5 }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('STEM_GAIN');
    // @ts-ignore
    expect(result.event.payload.value).toBe(0.5);
  });

  it('accepts valid EFFECT_TOGGLE', () => {
    const result = validateInboundEvent({
      type: 'EFFECT_TOGGLE',
      source: 'wubpad',
      payload: { effectId: 'reverb', active: true }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('EFFECT_TOGGLE');
    // @ts-ignore
    expect(result.event.payload.effectId).toBe('reverb');
  });

  it('accepts valid MACRO_TRIGGER', () => {
    const result = validateInboundEvent({
      type: 'MACRO_TRIGGER',
      source: 'wubpad',
      payload: { macroId: 'fakeout', intensity: 0.8 }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('MACRO_TRIGGER');
    // @ts-ignore
    expect(result.event.payload.macroId).toBe('fakeout');
  });

  it('accepts valid SCENE_TRIGGER', () => {
    const result = validateInboundEvent({
      type: 'SCENE_TRIGGER',
      source: 'wubpad',
      payload: { sceneId: 'Drop', quantize: 'nextBar' }
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('SCENE_TRIGGER');
    // @ts-ignore
    expect(result.event.payload.sceneId).toBe('Drop');
  });

  it('accepts valid EMERGENCY_STOP', () => {
    const result = validateInboundEvent({
      type: 'EMERGENCY_STOP',
      source: 'wubpad'
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.rejection.reason);

    expect(result.event.type).toBe('EMERGENCY_STOP');
  });

  it('rejects unknown intents', () => {
    const result = validateInboundEvent({
      type: 'INVALID_INTENT',
      source: 'wubpad'
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid intent to be rejected');
  });
});
