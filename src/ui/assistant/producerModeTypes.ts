import type { WubGuideTarget } from './wubGuideTypes.js';
import type { MeterSnapshot } from '../../audio/metering/meterTypes.js';

export type ProducerSuggestionCategory =
  | 'arrangement'
  | 'rhythm'
  | 'melody'
  | 'bass'
  | 'mix'
  | 'workflow'
  | 'export';

export type ProducerSuggestion = {
  id: string;
  category: ProducerSuggestionCategory;
  priority: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  actionLabel?: string;
  guideTarget?: WubGuideTarget;
};

export type ProducerProjectSummary = {
  bpm: number;
  timeSignature: string;
  trackCount: number;
  audioClipCount: number;
  midiClipCount: number;
  arrangementDurationSeconds: number;
  arrangementBars: number;
  hasMutedOrSoloedTracks: boolean;
  savedProject: boolean;
  exportedAudio: boolean;
};

export type ProducerAnalysis = {
  summary: ProducerProjectSummary;
  suggestions: ProducerSuggestion[];
  nextBestMove: ProducerSuggestion;
};

export type ProducerMeterContext = {
  snapshot: MeterSnapshot;
  isPlaying: boolean;
};
