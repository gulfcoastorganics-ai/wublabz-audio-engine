export type SectionType =
  | 'intro'
  | 'build'
  | 'fakeout'
  | 'drop'
  | 'breakdown'
  | 'build_2'
  | 'second_drop'
  | 'outro';

export type StemRole =
  | 'drums'
  | 'bass'
  | 'music'
  | 'lead'
  | 'vocal'
  | 'fx'
  | 'texture'
  | 'perc'
  | 'noise'
  | string;

export type TimelineEventType =
  | 'stem_clip'
  | 'drum'
  | 'bass'
  | 'lead'
  | 'synth'
  | 'vocal'
  | 'fx'
  | 'transition'
  | 'silence'
  | 'marker'
  | 'riser'
  | 'impact'
  | 'fill';

export interface AnalysisSnapshot {
  id: string;
  sourceName: string;
  durationSeconds: number;
  sampleRate?: number;
  channels?: number;
  bpm: number;
  bpmConfidence?: number;
  beatsPerBar: number;
  key: string;
  keyEstimate?: KeyEstimate;
  camelot?: string;
  waveformPeaks?: WaveformPeak[];
  rmsCurve?: number[];
  energyCurve?: number[];
  silenceRegions?: SilenceRegion[];
  dynamicRangeDb?: number;
  transientDensity?: number;
  beatGrid?: BeatGrid;
  sectionBoundaries?: SectionBoundary[];
  analysisConfidence?: number;
  energy: number;
  genre?: string;
  confidence?: number;
  stemHints?: StemRole[];
}

export interface BeatBar {
  barIndex: number;
  startBeat: number;
  endBeat: number;
  startTime: number;
  endTime: number;
}

export interface WaveformPeak {
  time: number;
  min: number;
  max: number;
  rms: number;
}

export interface SilenceRegion {
  startTime: number;
  endTime: number;
  startSample: number;
  endSample: number;
}

export interface KeyEstimate {
  tonic: string;
  scale: 'major' | 'minor';
  camelot: string;
  confidence: number;
  profile: number[];
}

export interface SectionBoundary {
  id: string;
  type: SectionType;
  startTime: number;
  endTime: number;
  startBeat: number;
  endBeat: number;
  startBar: number;
  endBar: number;
  energy: number;
  transientDelta: number;
}

export interface BeatGrid {
  bpm: number;
  beatsPerBar: number;
  bars: BeatBar[];
  downbeats: number[];
  confidence?: number;
}

export interface PhraseRange {
  id: string;
  startBar: number;
  endBar: number;
  label?: string;
}

export interface PhraseGrid {
  phrases: PhraseRange[];
}

export interface SectionRange {
  id: string;
  type: SectionType;
  startBar: number;
  endBar: number;
  energyLevel: number;
  label?: string;
}

export interface SectionGrid {
  sections: SectionRange[];
}

export interface StemDescriptor {
  id: string;
  role: StemRole;
  label: string;
  sourceId: string;
  energyWeight: number;
  enabled: boolean;
  placeholder?: boolean;
}

export interface StemManifest {
  id: string;
  sourceId: string;
  stems: StemDescriptor[];
}

export interface SongDNA {
  id: string;
  sourceId: string;
  sourceName: string;
  durationSeconds: number;
  bpm: number;
  beatsPerBar: number;
  key: string;
  genre?: string;
  energy: number;
  beatGrid: BeatGrid;
  phraseGrid: PhraseGrid;
  sectionGrid: SectionGrid;
  stemRoles: StemRole[];
  motifSeeds: string[];
}

export interface ProducerSectionStrategy {
  id: string;
  type: SectionType;
  startBar: number;
  endBar: number;
  energyLevel: number;
  primaryMotif: string;
  activeStemRoles: StemRole[];
  placeholderStemRoles: StemRole[];
  transitionTypes: Array<'riser' | 'impact' | 'fill' | 'transition' | 'silence'>;
}

export interface ProducerBrainOutput {
  id: string;
  sourceSongId: string;
  goal: string;
  targetGenre?: string;
  sections: ProducerSectionStrategy[];
  energyCurve: number[];
  motifPlan: string[];
  notes: string[];
}

export type ProducerState = 'idle' | 'generating' | 'complete';

export interface ProducerDiagnosticsSnapshot {
  producerState: ProducerState;
  fatigueScore: number;
  currentDropLevel: number;
  motifCount: number;
  recallCount: number;
}

export interface StemInstruction {
  role: StemRole;
  intensity: number;
  enabled: boolean;
  sourceStemId?: string;
  placeholderLabel?: string;
}

export interface TransitionInstruction {
  type: 'riser' | 'impact' | 'fill' | 'transition' | 'silence';
  barOffset: number;
  durationBars: number;
  probability: number;
  intensity: number;
  label: string;
}

export interface RemixBlueprintSection {
  id: string;
  type: SectionType;
  startBar: number;
  endBar: number;
  energyLevel: number;
  motifId: string;
  stemInstructions: StemInstruction[];
  transitionInstructions: TransitionInstruction[];
  markerLabels: string[];
}

export interface RemixBlueprint {
  id: string;
  sourceSongId: string;
  targetGenre?: string;
  seed: string;
  sections: RemixBlueprintSection[];
  motifPlan: string[];
  metadata: {
    sourceBpm: number;
    energy: number;
    generatedAt: string;
  };
}

export interface TimelineEventV2 {
  id: string;
  type: TimelineEventType;
  sourceId: string;
  stemId?: string;
  sectionId: string;
  startTime: number;
  endTime: number;
  beatStart: number;
  beatEnd: number;
  barStart: number;
  barEnd: number;
  energyLevel: number;
  enabled: boolean;
  probability: number;
  payload: Record<string, unknown>;
}

export interface ArrangementReconstructionOptions {
  seed?: string | number;
  targetGenre?: string;
}

export interface ProducerBrainOptions {
  targetGenre?: string;
  seed?: string | number;
}

export interface AudioDecodeResult {
  format: 'mp3' | 'wav';
  sampleRate: number;
  channelData: Float32Array[];
  samplesDecoded: number;
}
