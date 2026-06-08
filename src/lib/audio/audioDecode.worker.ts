import { parentPort } from 'node:worker_threads';
import { decodeAudioInline } from './AnalysisEngine.js';
import type { AudioDecodeResult } from '../producer/types.js';

export interface AudioDecodeWorkerInput {
  bytes: Uint8Array;
  sourcePath: string;
}

export async function handleAudioDecodeWorkerInput(input: AudioDecodeWorkerInput): Promise<AudioDecodeResult> {
  return decodeAudioInline(input.bytes, input.sourcePath);
}

const port = parentPort;

if (port) {
  port.on('message', async (message: { input?: AudioDecodeWorkerInput }) => {
    try {
      if (!message.input) {
        port.postMessage({ error: 'Missing audio decode input.' });
        return;
      }

      const output = await handleAudioDecodeWorkerInput(message.input);
      port.postMessage({ output });
    } catch (error) {
      port.postMessage({
        error: error instanceof Error ? error.message : 'Audio decode worker failed.'
      });
    }
  });
}
