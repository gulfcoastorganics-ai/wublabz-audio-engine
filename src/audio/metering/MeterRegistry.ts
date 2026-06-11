import type {
  MeterChannelRegistration,
  MeterLevel,
  MeterSample,
  MeterSnapshot,
} from './meterTypes.js';
import { clampMeterValue, createSilentMeterLevel } from './meterTypes.js';

type MeterListener = () => void;
type AnimationFrameCallback = (time: number) => void;

export type MeterRegistryOptions = {
  now?: () => number;
  requestFrame?: (callback: AnimationFrameCallback) => number;
  cancelFrame?: (handle: number) => void;
  peakDecayPerSecond?: number;
  rmsDecayPerSecond?: number;
  holdDecayPerSecond?: number;
  settleThreshold?: number;
};

type InternalChannelState = MeterChannelRegistration & {
  peak: number;
  rms: number;
  clipping: boolean;
  updatedAt: number;
  peakHold: number;
};

const EMPTY_SNAPSHOT: MeterSnapshot = {
  timestamp: 0,
  channelIds: [],
  levels: {},
  peakHolds: {},
};

const DEFAULT_OPTIONS = {
  peakDecayPerSecond: 1.55,
  rmsDecayPerSecond: 1.1,
  holdDecayPerSecond: 0.32,
  settleThreshold: 0.004,
};

export class MeterRegistry {
  private readonly nowFn: () => number;
  private readonly requestFrame: (callback: AnimationFrameCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly peakDecayPerSecond: number;
  private readonly rmsDecayPerSecond: number;
  private readonly holdDecayPerSecond: number;
  private readonly settleThreshold: number;
  private readonly listeners = new Set<MeterListener>();
  private readonly channels = new Map<string, InternalChannelState>();
  private channelOrder: string[] = [];
  private frameHandle: number | null = null;
  private cachedSnapshot: MeterSnapshot = EMPTY_SNAPSHOT;

  constructor(options: MeterRegistryOptions = {}) {
    this.nowFn = options.now ?? (() => Date.now());
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
    this.peakDecayPerSecond = options.peakDecayPerSecond ?? DEFAULT_OPTIONS.peakDecayPerSecond;
    this.rmsDecayPerSecond = options.rmsDecayPerSecond ?? DEFAULT_OPTIONS.rmsDecayPerSecond;
    this.holdDecayPerSecond = options.holdDecayPerSecond ?? DEFAULT_OPTIONS.holdDecayPerSecond;
    this.settleThreshold = options.settleThreshold ?? DEFAULT_OPTIONS.settleThreshold;
  }

  registerChannel(channelId: string, registration: Omit<MeterChannelRegistration, 'channelId'> = {}): void {
    const existing = this.channels.get(channelId);
    if (!existing) {
      this.channelOrder = [...this.channelOrder, channelId];
      this.channels.set(channelId, {
        channelId,
        label: registration.label,
        kind: registration.kind,
        peak: 0,
        rms: 0,
        clipping: false,
        updatedAt: this.nowFn(),
        peakHold: 0,
      });
      this.cachedSnapshot = this.computeSnapshot(this.nowFn());
      return;
    }

    this.channels.set(channelId, {
      ...existing,
      ...registration,
    });
  }

  unregisterChannel(channelId: string): void {
    if (!this.channels.has(channelId)) return;

    this.channels.delete(channelId);
    this.channelOrder = this.channelOrder.filter((entry) => entry !== channelId);
    this.cachedSnapshot = this.computeSnapshot(this.nowFn());

    if (!this.hasActiveLevels(this.cachedSnapshot)) {
      this.cancelPendingFrame();
    }
  }

  updateLevel(sample: MeterSample): void {
    this.registerChannel(sample.channelId);

    const now = sample.updatedAt ?? this.nowFn();
    const peak = clampMeterValue(sample.peak);
    const rms = clampMeterValue(sample.rms);
    const channel = this.channels.get(sample.channelId);

    if (!channel) return;

    this.channels.set(sample.channelId, {
      ...channel,
      peak,
      rms,
      clipping: Boolean(sample.clipping && peak > this.settleThreshold),
      updatedAt: now,
      peakHold: Math.max(channel.peakHold, peak),
    });

    this.cachedSnapshot = this.computeSnapshot(now);
    this.scheduleFrame();
  }

  updateLevels(samples: MeterSample[], now = this.nowFn()): void {
    if (samples.length === 0) return;

    for (const sample of samples) {
      this.registerChannel(sample.channelId);
      const channel = this.channels.get(sample.channelId);
      if (!channel) continue;
      const peak = clampMeterValue(sample.peak);
      const rms = clampMeterValue(sample.rms);
      this.channels.set(sample.channelId, {
        ...channel,
        peak,
        rms,
        clipping: Boolean(sample.clipping && peak > this.settleThreshold),
        updatedAt: sample.updatedAt ?? now,
        peakHold: Math.max(channel.peakHold, peak),
      });
    }

    this.cachedSnapshot = this.computeSnapshot(now);
    this.scheduleFrame();
  }

  getSnapshot(now = this.nowFn()): MeterSnapshot {
    if (arguments.length === 0) {
      return this.cachedSnapshot;
    }

    return this.computeSnapshot(now);
  }

  hasActiveLevels(snapshot: MeterSnapshot = this.cachedSnapshot): boolean {
    return snapshot.channelIds.some((channelId) => {
      const level = snapshot.levels[channelId];
      const hold = snapshot.peakHolds[channelId] ?? 0;
      return Boolean(level && (level.peak > this.settleThreshold || level.rms > this.settleThreshold || hold > this.settleThreshold));
    });
  }

  subscribe(listener: MeterListener): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1 && this.hasActiveLevels()) {
      this.scheduleFrame();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.cancelPendingFrame();
      }
    };
  }

  reset(): void {
    this.cancelPendingFrame();
    this.channels.clear();
    this.channelOrder = [];
    this.cachedSnapshot = EMPTY_SNAPSHOT;
  }

  private scheduleFrame(): void {
    if (this.frameHandle !== null || this.listeners.size === 0) return;
    this.frameHandle = this.requestFrame(this.flushFrame);
  }

  private cancelPendingFrame(): void {
    if (this.frameHandle === null) return;
    this.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private flushFrame = (time: number) => {
    this.frameHandle = null;
    const snapshot = this.computeSnapshot(time);
    this.cachedSnapshot = snapshot;

    for (const listener of this.listeners) {
      listener();
    }

    if (this.hasActiveLevels(snapshot)) {
      this.scheduleFrame();
    }
  };

  private computeSnapshot(now: number): MeterSnapshot {
    const levels: Record<string, MeterLevel> = {};
    const peakHolds: Record<string, number> = {};

    for (const channelId of this.channelOrder) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;
      const elapsedSeconds = Math.max(0, (now - channel.updatedAt) / 1000);
      const peak = Math.max(0, channel.peak - (elapsedSeconds * this.peakDecayPerSecond));
      const rms = Math.max(0, channel.rms - (elapsedSeconds * this.rmsDecayPerSecond));
      const peakHold = Math.max(0, channel.peakHold - (elapsedSeconds * this.holdDecayPerSecond));

      levels[channelId] = {
        channelId,
        peak,
        rms,
        clipping: channel.clipping && peak > this.settleThreshold,
        updatedAt: channel.updatedAt,
      };
      peakHolds[channelId] = Math.max(peak, peakHold);

      if (!levels[channelId].clipping && peak < this.settleThreshold && rms < this.settleThreshold && peakHold < this.settleThreshold) {
        levels[channelId] = createSilentMeterLevel(channelId, channel.updatedAt);
        peakHolds[channelId] = 0;
      }
    }

    return {
      timestamp: now,
      channelIds: [...this.channelOrder],
      levels,
      peakHolds,
    };
  }
}

function defaultRequestFrame(callback: AnimationFrameCallback): number {
  const requestAnimationFrame = (globalThis as any).requestAnimationFrame as
    | ((cb: AnimationFrameCallback) => number)
    | undefined;

  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
}

function defaultCancelFrame(handle: number): void {
  const cancelAnimationFrame = (globalThis as any).cancelAnimationFrame as
    | ((value: number) => void)
    | undefined;

  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

export const meterRegistry = new MeterRegistry();
