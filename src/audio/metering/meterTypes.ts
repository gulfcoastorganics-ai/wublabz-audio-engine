export type MeterChannelKind = 'track' | 'master';

export type MeterLevel = {
  channelId: string;
  peak: number;
  rms: number;
  clipping: boolean;
  updatedAt: number;
};

export type MeterSnapshot = {
  timestamp: number;
  channelIds: string[];
  levels: Record<string, MeterLevel>;
  peakHolds: Record<string, number>;
};

export type MeterSample = {
  channelId: string;
  peak: number;
  rms: number;
  clipping: boolean;
  updatedAt?: number;
};

export type MeterChannelRegistration = {
  channelId: string;
  kind?: MeterChannelKind;
  label?: string;
};

export function clampMeterValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function createSilentMeterLevel(channelId: string, updatedAt = 0): MeterLevel {
  return {
    channelId,
    peak: 0,
    rms: 0,
    clipping: false,
    updatedAt,
  };
}
