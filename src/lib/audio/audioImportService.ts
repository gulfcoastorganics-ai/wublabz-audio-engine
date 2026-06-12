import type { AudioAsset } from '../project/projectSchema.js';

export interface ImportedAudioFile {
  asset: AudioAsset;
  buffer: DecodedAudioBuffer;
}

export async function importAudioFile(file: File): Promise<ImportedAudioFile> {
  const bytes = await file.arrayBuffer();
  const context = createAudioContext();

  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    return {
      asset: {
        id: crypto.randomUUID(),
        name: stripExtension(file.name) || 'Imported Audio',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        durationSeconds: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
        waveformPeaks: createWaveformPeaks(decoded),
        byteLength: file.size,
        createdAt: new Date().toISOString(),
        sourceUrl: URL.createObjectURL(file),
      },
      buffer: decoded,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

interface DecodedAudioBuffer {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

interface AudioContextLike {
  decodeAudioData(bytes: ArrayBuffer): Promise<DecodedAudioBuffer>;
  close(): Promise<void>;
}

interface AudioContextConstructor {
  new (): AudioContextLike;
}

type AudioGlobal = typeof globalThis & {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
};

function createAudioContext(): AudioContextLike {
  const audioGlobal = globalThis as AudioGlobal;
  const AudioContextCtor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Audio import requires Web Audio API support.');
  }
  return new AudioContextCtor();
}

function createWaveformPeaks(buffer: DecodedAudioBuffer, bucketCount = 512): number[] {
  const peaks: number[] = [];
  const frameCount = buffer.length;
  const bucketSize = Math.max(1, Math.floor(frameCount / bucketCount));

  for (let start = 0; start < frameCount; start += bucketSize) {
    let peak = 0;
    const end = Math.min(frameCount, start + bucketSize);
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      for (let frame = start; frame < end; frame += 1) {
        peak = Math.max(peak, Math.abs(channel[frame] ?? 0));
      }
    }
    peaks.push(Number(peak.toFixed(4)));
  }

  return peaks.length ? peaks : [0];
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}
