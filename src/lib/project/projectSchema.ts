export type ProjectVersion = '1.0';

export type TimeSignature = {
  beatsPerBar: number;
  beatUnit: number;
};

export type TrackType = 'audio' | 'midi' | 'automation' | 'group' | 'master';

export type TrackRole = 'drums' | 'bass' | 'music' | 'lead' | 'vocal' | 'fx' | 'utility';

export type ClipBase = {
  id: string;
  trackId: string;
  name: string;
  startTime: number;
  endTime: number;
  clipGain: number;
  muted: boolean;
  selected: boolean;
};

export type AudioAsset = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  waveformPeaks: number[];
  byteLength: number;
  createdAt: string;
  sourceUrl?: string;
};

export type AudioClipEdit = {
  gain?: number;
  reverse?: boolean;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  normalized?: boolean;
};

export type AudioClip = ClipBase & {
  type: 'audio';
  assetId: string;
  sourceOffsetSeconds: number;
  edit?: AudioClipEdit;
};

export type MidiNote = {
  id: string;
  note: number;
  velocity: number;
  startBeat: number;
  durationBeats: number;
  channel: number;
};

export type MidiClip = ClipBase & {
  type: 'midi';
  notes: MidiNote[];
};

export type AutomationPoint = {
  id: string;
  time: number;
  value: number;
  laneId: string;
};

export type AutomationLane = {
  id: string;
  trackId: string;
  target: 'gain' | 'pan' | 'effect';
  targetId: string;
  parameter?: string;
  points: AutomationPoint[];
};

export type MixerChannelState = {
  trackId: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  sendLevels: Record<string, number>;
};

export type Track = {
  id: string;
  name: string;
  type: TrackType;
  role: TrackRole;
  color?: string;
  order: number;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  arm: boolean;
};

export type WubLabzProject = {
  id: string;
  name: string;
  bpm: number;
  timeSignature: TimeSignature;
  tracks: Track[];
  audioAssets: AudioAsset[];
  audioClips: AudioClip[];
  midiClips: MidiClip[];
  automationLanes: AutomationLane[];
  mixerState: Record<string, MixerChannelState>;
  createdAt: string;
  updatedAt: string;
  version: ProjectVersion;
};

export type TimelineEventKind =
  | 'project_audio_clip'
  | 'project_midi_clip'
  | 'automation_point'
  | 'transport_marker'
  | 'metronome';

export type ProjectTimelineEvent = {
  id: string;
  type: TimelineEventKind;
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
};

