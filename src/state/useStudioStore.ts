import { create } from 'zustand';
import type {
  AudioClip,
  AudioClipEdit,
  MidiClip,
  MidiNote,
  MixerChannelState,
  Track,
  WubLabzProject,
} from '../lib/project/projectSchema.js';
import { createEmptyProject } from '../lib/project/projectTimeline.js';
import { WubLabzStudioController } from '../lib/studio/WubLabzStudioController.js';
import { importAudioFile } from '../lib/audio/audioImportService.js';
import { serializeProjectJson } from '../lib/project/projectExport.js';

const DEFAULT_SNAP_GRID = 0.5; // 1 beat at 120 BPM = 0.5s
const DEFAULT_ZOOM = 80; // pixels per second

// Controller singleton — lives outside Zustand so Tone.js objects aren't proxied
export const studioController = new WubLabzStudioController();

export interface StudioState {
  // Data
  project: WubLabzProject;

  // Playback
  isPlaying: boolean;
  position: number; // seconds

  // UI
  zoom: number;
  scrollLeft: number;
  selectedClipId: string | null;
  pianoRollClipId: string | null;
  snapEnabled: boolean;
  snapGrid: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  status: string;
  showMixer: boolean;
  showBrowser: boolean;

  // Transport
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setBpm: (bpm: number) => void;
  setLoop: (start: number, end: number) => void;
  clearLoop: () => void;
  toggleLoop: () => void;
  emergencyStop: () => void;

  // Engine init + playhead
  initialize: () => Promise<void>;
  tickPlayhead: () => void;

  // Project mutations
  setProject: (project: WubLabzProject) => void;
  addTrack: (type: Track['type']) => string;
  updateTrack: (trackId: string, patch: Partial<Track>) => void;
  deleteTrack: (trackId: string) => void;
  importFile: (file: File) => Promise<void>;
  moveClip: (clipId: string, startTime: number, trackId?: string) => void;
  resizeClip: (clipId: string, endTime: number) => void;
  splitClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  updateClipEdit: (clipId: string, edit: Partial<AudioClipEdit>) => void;
  resetClipEdits: (clipId: string) => void;
  addMidiClip: (trackId: string, startTime: number, endTime: number) => string;
  addMidiNote: (clipId: string, note: MidiNote) => void;
  updateMidiNote: (clipId: string, noteId: string, patch: Partial<MidiNote>) => void;
  deleteMidiNote: (clipId: string, noteId: string) => void;
  updateChannel: (trackId: string, patch: Partial<MixerChannelState>) => void;

  // UI controls
  setZoom: (zoom: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  selectClip: (clipId: string | null) => void;
  openPianoRoll: (clipId: string | null) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapGrid: (grid: number) => void;
  setStatus: (status: string) => void;
  toggleMixer: () => void;
  toggleBrowser: () => void;

  // Persistence
  save: () => Promise<void>;
  load: (id: string) => Promise<void>;
  exportJson: () => string;
  importJson: (json: string) => void;
  exportWav: () => Promise<void>;
  exportStems: () => Promise<void>;
}

export const useStudioStore = create<StudioState>((set, get) => {
  const project = createEmptyProject('wublabz-local', 'WubLabz Studio');

  return {
    project,
    isPlaying: false,
    position: 0,
    zoom: DEFAULT_ZOOM,
    scrollLeft: 0,
    selectedClipId: null,
    pianoRollClipId: null,
    snapEnabled: true,
    snapGrid: DEFAULT_SNAP_GRID,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 4,
    status: 'Ready',
    showMixer: true,
    showBrowser: true,

    // ─── Transport ────────────────────────────────────────────────────

    async play() {
      try {
        await studioController.play();
        set({ isPlaying: true, status: 'Playing' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ status: `Play error: ${msg}` });
      }
    },

    pause() {
      studioController.pause();
      set({ isPlaying: false, status: 'Paused' });
    },

    stop() {
      studioController.stop();
      set({ isPlaying: false, position: 0, status: 'Stopped' });
    },

    seek(seconds) {
      const s = Math.max(0, seconds);
      studioController.seek(s);
      set({ position: s });
    },

    setBpm(bpm) {
      const clamped = Math.max(20, Math.min(999, bpm));
      studioController.setBpm(clamped);
      set((state) => ({
        project: { ...state.project, bpm: clamped, updatedAt: new Date().toISOString() },
      }));
    },

    setLoop(start, end) {
      studioController.setLoop(start, end);
      set({ loopEnabled: true, loopStart: start, loopEnd: end });
    },

    clearLoop() {
      studioController.clearLoop();
      set({ loopEnabled: false });
    },

    toggleLoop() {
      const { loopEnabled, loopStart, loopEnd } = get();
      if (loopEnabled) {
        studioController.clearLoop();
        set({ loopEnabled: false });
      } else {
        studioController.setLoop(loopStart, loopEnd);
        set({ loopEnabled: true });
      }
    },

    emergencyStop() {
      studioController.emergencyStop();
      set({ isPlaying: false, position: 0, status: 'Emergency stop' });
    },

    // ─── Engine ───────────────────────────────────────────────────────

    async initialize() {
      const { project } = get();
      await studioController.initialize(project);
      set({ status: 'Engine ready' });
    },

    tickPlayhead() {
      const pos = studioController.adapter.getPosition();
      set({ position: pos });
    },

    // ─── Project ──────────────────────────────────────────────────────

    setProject(project) {
      studioController.setProject(project);
      set({ project });
    },

    addTrack(type) {
      const trackId = crypto.randomUUID();
      const { project } = get();
      const colors = [
        '#6c63ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
        '#ff9f1c', '#e040fb', '#00bcd4', '#ff5252', '#69f0ae',
      ];
      const color = colors[project.tracks.length % colors.length]!;
      const newTrack: Track = {
        id: trackId,
        name: `${type === 'midi' ? 'MIDI' : 'Audio'} ${project.tracks.length + 1}`,
        type,
        role: 'music',
        order: project.tracks.length,
        gain: 1,
        pan: 0,
        mute: false,
        solo: false,
        arm: false,
        color,
      };
      const newProject: WubLabzProject = {
        ...project,
        tracks: [...project.tracks, newTrack],
        mixerState: {
          ...project.mixerState,
          [trackId]: defaultChannel(trackId),
        },
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
      return trackId;
    },

    updateTrack(trackId, patch) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
        mixerState: {
          ...project.mixerState,
          [trackId]: {
            ...(project.mixerState[trackId] ?? defaultChannel(trackId)),
            ...pick(patch, 'gain', 'pan', 'mute', 'solo'),
            trackId,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    deleteTrack(trackId) {
      const { project, selectedClipId } = get();
      const { [trackId]: _removed, ...rest } = project.mixerState;
      const newProject: WubLabzProject = {
        ...project,
        tracks: project.tracks.filter((t) => t.id !== trackId),
        audioClips: project.audioClips.filter((c) => c.trackId !== trackId),
        midiClips: project.midiClips.filter((c) => c.trackId !== trackId),
        mixerState: rest,
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      const removedClipIds = new Set([
        ...project.audioClips.filter((c) => c.trackId === trackId).map((c) => c.id),
        ...project.midiClips.filter((c) => c.trackId === trackId).map((c) => c.id),
      ]);
      set({
        project: newProject,
        selectedClipId: selectedClipId && removedClipIds.has(selectedClipId) ? null : selectedClipId,
      });
    },

    async importFile(file) {
      set({ status: `Importing ${file.name}…` });
      let { project } = get();

      // Ensure there is at least one audio track
      let trackId = project.tracks.find((t) => t.type === 'audio')?.id;
      if (!trackId) {
        trackId = get().addTrack('audio');
        project = get().project; // re-read after mutation
      }

      const imported = await importAudioFile(file);
      const asset = imported.asset;

      const lastEnd = project.audioClips
        .filter((c) => c.trackId === trackId)
        .reduce((m, c) => Math.max(m, c.endTime), 0);

      const clip: AudioClip = {
        id: crypto.randomUUID(),
        type: 'audio',
        trackId: trackId!,
        name: asset.name,
        startTime: lastEnd,
        endTime: lastEnd + asset.durationSeconds,
        clipGain: 1,
        muted: false,
        selected: false,
        assetId: asset.id,
        sourceOffsetSeconds: 0,
      };

      const newProject: WubLabzProject = {
        ...get().project,
        audioAssets: [...get().project.audioAssets, asset],
        audioClips: [...get().project.audioClips, clip],
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject, status: `Imported ${file.name}` });
    },

    moveClip(clipId, startTime, trackId) {
      const { project, snapEnabled, snapGrid } = get();
      const snapped = snapEnabled ? Math.round(startTime / snapGrid) * snapGrid : startTime;
      const safeStart = Math.max(0, snapped);

      const updateAudio = (clips: AudioClip[]) =>
        clips.map((c) => {
          if (c.id !== clipId) return c;
          const dur = c.endTime - c.startTime;
          return { ...c, startTime: safeStart, endTime: safeStart + dur, trackId: trackId ?? c.trackId };
        });
      const updateMidi = (clips: MidiClip[]) =>
        clips.map((c) => {
          if (c.id !== clipId) return c;
          const dur = c.endTime - c.startTime;
          return { ...c, startTime: safeStart, endTime: safeStart + dur, trackId: trackId ?? c.trackId };
        });

      const newProject: WubLabzProject = {
        ...project,
        audioClips: updateAudio(project.audioClips),
        midiClips: updateMidi(project.midiClips),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    resizeClip(clipId, endTime) {
      const { project, snapEnabled, snapGrid } = get();
      const snapped = snapEnabled ? Math.round(endTime / snapGrid) * snapGrid : endTime;
      const MIN_DUR = 0.1;

      const updateAudio = (clips: AudioClip[]) =>
        clips.map((c) =>
          c.id === clipId ? { ...c, endTime: Math.max(c.startTime + MIN_DUR, snapped) } : c
        );
      const updateMidi = (clips: MidiClip[]) =>
        clips.map((c) =>
          c.id === clipId ? { ...c, endTime: Math.max(c.startTime + MIN_DUR, snapped) } : c
        );

      const newProject: WubLabzProject = {
        ...project,
        audioClips: updateAudio(project.audioClips),
        midiClips: updateMidi(project.midiClips),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    splitClip(clipId) {
      const { project, position } = get();
      const clip = project.audioClips.find((c) => c.id === clipId);
      if (!clip) return;
      const splitAt = (position > clip.startTime && position < clip.endTime)
        ? position
        : (clip.startTime + clip.endTime) / 2;
      const left: AudioClip = { ...clip, id: crypto.randomUUID(), endTime: splitAt };
      const right: AudioClip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: splitAt,
        sourceOffsetSeconds: clip.sourceOffsetSeconds + (splitAt - clip.startTime),
      };
      const newProject: WubLabzProject = {
        ...project,
        audioClips: [...project.audioClips.filter((c) => c.id !== clipId), left, right],
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject, selectedClipId: left.id });
    },

    deleteClip(clipId) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        audioClips: project.audioClips.filter((c) => c.id !== clipId),
        midiClips: project.midiClips.filter((c) => c.id !== clipId),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject, selectedClipId: null, pianoRollClipId: null });
    },

    duplicateClip(clipId) {
      const { project } = get();
      const audio = project.audioClips.find((c) => c.id === clipId);
      if (audio) {
        const dur = audio.endTime - audio.startTime;
        const newClip: AudioClip = {
          ...audio,
          id: crypto.randomUUID(),
          startTime: audio.endTime,
          endTime: audio.endTime + dur,
        };
        const newProject = {
          ...project,
          audioClips: [...project.audioClips, newClip],
          updatedAt: new Date().toISOString(),
        };
        studioController.setProject(newProject);
        set({ project: newProject, selectedClipId: newClip.id });
        return;
      }
      const midi = project.midiClips.find((c) => c.id === clipId);
      if (midi) {
        const dur = midi.endTime - midi.startTime;
        const newClip: MidiClip = {
          ...midi,
          id: crypto.randomUUID(),
          notes: midi.notes.map((n) => ({ ...n, id: crypto.randomUUID() })),
          startTime: midi.endTime,
          endTime: midi.endTime + dur,
        };
        const newProject = {
          ...project,
          midiClips: [...project.midiClips, newClip],
          updatedAt: new Date().toISOString(),
        };
        studioController.setProject(newProject);
        set({ project: newProject, selectedClipId: newClip.id });
      }
    },

    updateClipEdit(clipId, edit) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        audioClips: project.audioClips.map((c) =>
          c.id === clipId ? { ...c, edit: { ...c.edit, ...edit } } : c
        ),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    resetClipEdits(clipId) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        audioClips: project.audioClips.map((c) =>
          c.id === clipId ? { ...c, edit: undefined } : c
        ),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    addMidiClip(trackId, startTime, endTime) {
      const { project } = get();
      const clipId = crypto.randomUUID();
      const clip: MidiClip = {
        id: clipId,
        type: 'midi',
        trackId,
        name: 'MIDI Clip',
        startTime,
        endTime,
        clipGain: 1,
        muted: false,
        selected: false,
        notes: [],
      };
      const newProject: WubLabzProject = {
        ...project,
        midiClips: [...project.midiClips, clip],
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
      return clipId;
    },

    addMidiNote(clipId, note) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        midiClips: project.midiClips.map((c) =>
          c.id === clipId ? { ...c, notes: [...c.notes, note] } : c
        ),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    updateMidiNote(clipId, noteId, patch) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        midiClips: project.midiClips.map((c) =>
          c.id === clipId
            ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)) }
            : c
        ),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    deleteMidiNote(clipId, noteId) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        midiClips: project.midiClips.map((c) =>
          c.id === clipId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c
        ),
        updatedAt: new Date().toISOString(),
      };
      studioController.setProject(newProject);
      set({ project: newProject });
    },

    updateChannel(trackId, patch) {
      const { project } = get();
      const newProject: WubLabzProject = {
        ...project,
        mixerState: {
          ...project.mixerState,
          [trackId]: {
            ...(project.mixerState[trackId] ?? defaultChannel(trackId)),
            ...patch,
            trackId,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      set({ project: newProject });
    },

    // ─── UI ───────────────────────────────────────────────────────────

    setZoom(zoom) {
      set({ zoom: Math.max(10, Math.min(500, zoom)) });
    },
    setScrollLeft(scrollLeft) {
      set({ scrollLeft: Math.max(0, scrollLeft) });
    },
    selectClip(clipId) {
      set({ selectedClipId: clipId });
    },
    openPianoRoll(clipId) {
      set({ pianoRollClipId: clipId });
    },
    setSnapEnabled(enabled) {
      set({ snapEnabled: enabled });
    },
    setSnapGrid(grid) {
      set({ snapGrid: grid });
    },
    setStatus(status) {
      set({ status });
    },
    toggleMixer() {
      set((s) => ({ showMixer: !s.showMixer }));
    },
    toggleBrowser() {
      set((s) => ({ showBrowser: !s.showBrowser }));
    },

    // ─── Persistence ──────────────────────────────────────────────────

    async save() {
      await studioController.save();
      set({ status: 'Saved' });
    },

    async load(id) {
      const loaded = await studioController.load(id);
      if (loaded) {
        set({ project: loaded, status: 'Loaded' });
      } else {
        set({ status: 'Not found' });
      }
    },

    exportJson() {
      return serializeProjectJson(get().project);
    },

    importJson(json) {
      const imported = studioController.importJson(json);
      set({ project: imported, status: 'Imported' });
    },

    async exportWav() {
      set({ status: 'Exporting WAV…' });
      await studioController.exportWav();
      set({ status: 'WAV exported' });
    },

    async exportStems() {
      set({ status: 'Exporting stems…' });
      await studioController.exportStems();
      set({ status: 'Stems exported' });
    },
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultChannel(trackId: string): MixerChannelState {
  return { trackId, gain: 1, pan: 0, mute: false, solo: false, armed: false, sendLevels: {} };
}

function pick<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}
