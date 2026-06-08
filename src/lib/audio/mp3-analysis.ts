import { AnalysisEngine, type AnalysisEngineOptions, type AudioIngestionSnapshot } from './AnalysisEngine.js';

export type { AudioIngestionSnapshot } from './AnalysisEngine.js';

export async function ingestAudioFile(
  filePath: string,
  options: AnalysisEngineOptions = {}
): Promise<AudioIngestionSnapshot> {
  return new AnalysisEngine(options).analyzeFile(filePath);
}

export async function ingestAudioBytes(
  bytes: Uint8Array,
  sourcePath: string,
  options: AnalysisEngineOptions = {}
): Promise<AudioIngestionSnapshot> {
  return new AnalysisEngine(options).analyzeBytes(bytes, sourcePath);
}
