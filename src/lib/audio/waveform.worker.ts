import { parentPort } from 'node:worker_threads';
import { computeWaveformPeaks, mixToMono } from './AnalysisEngine.js';
import type { WaveformPeak } from '../producer/types.js';

export interface WaveformWorkerInput {
  channelData: Float32Array[];
  sampleRate: number;
}

export async function handleWaveformWorkerInput(input: WaveformWorkerInput): Promise<WaveformPeak[]> {
  return computeWaveformPeaks(mixToMono(input.channelData), input.sampleRate, 1024);
}

const port = parentPort;

if (port) {
  port.on('message', async (message: { input?: WaveformWorkerInput }) => {
    try {
      if (!message.input) {
        port.postMessage({ error: 'Missing waveform input.' });
        return;
      }

      const output = await handleWaveformWorkerInput(message.input);
      port.postMessage({ output });
    } catch (error) {
      port.postMessage({
        error: error instanceof Error ? error.message : 'Waveform worker failed.'
      });
    }
  });
}
