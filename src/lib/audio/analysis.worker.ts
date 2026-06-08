import { parentPort } from 'node:worker_threads';
import { AnalysisEngine } from './AnalysisEngine.js';
import type { AudioIngestionSnapshot } from './AnalysisEngine.js';

export interface AnalysisWorkerInput {
  bytes: Uint8Array;
  sourcePath: string;
  cacheRoot?: string;
}

export async function handleAnalysisWorkerInput(input: AnalysisWorkerInput): Promise<AudioIngestionSnapshot> {
  return new AnalysisEngine({
    useWorkers: false,
    ...(input.cacheRoot !== undefined ? { cacheRoot: input.cacheRoot } : {})
  }).analyzeBytes(input.bytes, input.sourcePath);
}

const port = parentPort;

if (port) {
  port.on('message', async (message: { input?: AnalysisWorkerInput }) => {
    try {
      if (!message.input) {
        port.postMessage({ error: 'Missing analysis input.' });
        return;
      }

      const output = await handleAnalysisWorkerInput(message.input);
      port.postMessage({ output });
    } catch (error) {
      port.postMessage({
        error: error instanceof Error ? error.message : 'Analysis worker failed.'
      });
    }
  });
}
