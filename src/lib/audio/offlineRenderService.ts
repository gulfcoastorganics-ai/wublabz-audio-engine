import type { AudioClip, WubLabzProject } from '../project/projectSchema.js';
import { projectToTimelineEvents } from '../project/projectTimeline.js';
import { encodePcm16Wav } from './wavEncoder.js';
import { renderClipEdits } from '../../audio/rendering/clipEditRenderer.js';

export type OfflineRenderResult = {
  master: Blob;
  stems: Array<{ trackId: string; trackName: string; blob: Blob }>;
  manifest: string;
};

export class OfflineRenderService {
  readonly sampleRate = 44100;

  renderProject(project: WubLabzProject, options: { loopStart?: number; loopEnd?: number } = {}): OfflineRenderResult {
    const events = projectToTimelineEvents(project);
    const duration = this.resolveDuration(project, options, events);
    const frameCount = Math.max(1, Math.ceil(duration * this.sampleRate));
    const soloTrackIds = project.tracks.filter((track) => track.solo).map((track) => track.id);
    const master = this.renderMix(project, frameCount, soloTrackIds, options.loopStart, options.loopEnd);
    const stems = project.tracks
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((track): { trackId: string; trackName: string; blob: Blob } => ({
        trackId: track.id,
        trackName: track.name,
        blob: this.toWavBlob(this.renderTrackStem(project, track.id, frameCount, options.loopStart, options.loopEnd))
      }))
      .filter(({ blob }) => blob.size > 44);

    return {
      master: this.toWavBlob(master),
      stems,
      manifest: JSON.stringify(stems.map((stem) => ({ trackId: stem.trackId, trackName: stem.trackName, fileName: `${stem.trackName}.wav` })), null, 2)
    };
  }

  renderTrackStem(project: WubLabzProject, trackId: string, frameCount: number, loopStart?: number, loopEnd?: number): Uint8Array {
    const track = project.tracks.find((entry) => entry.id === trackId);
    if (!track) return encodePcm16Wav({ sampleRate: this.sampleRate, channels: [new Float32Array(1), new Float32Array(1)] });
    const soloTrackIds = project.tracks.filter((entry) => entry.solo).map((entry) => entry.id);
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    for (const clip of project.audioClips.filter((entry) => entry.trackId === trackId)) {
      this.mixClipInto(project, clip, left, right, track, soloTrackIds, loopStart, loopEnd);
    }
    return encodePcm16Wav({ sampleRate: this.sampleRate, channels: [left, right] });
  }

  private renderMix(project: WubLabzProject, frameCount: number, soloTrackIds: string[], loopStart?: number, loopEnd?: number): Uint8Array {
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    for (const clip of project.audioClips) {
      const track = project.tracks.find((entry) => entry.id === clip.trackId);
      if (!track) continue;
      this.mixClipInto(project, clip, left, right, track, soloTrackIds, loopStart, loopEnd);
    }
    return encodePcm16Wav({ sampleRate: this.sampleRate, channels: [left, right] });
  }

  private mixClipInto(
    project: WubLabzProject,
    clip: AudioClip,
    left: Float32Array,
    right: Float32Array,
    track: WubLabzProject['tracks'][number],
    soloTrackIds: string[],
    loopStart?: number,
    loopEnd?: number
  ): void {
    const mixer = project.mixerState[track.id];
    const muted = track.mute || mixer?.mute || clip.muted || (soloTrackIds.length > 0 && !soloTrackIds.includes(track.id));
    if (muted) return;
    const asset = project.audioAssets.find((entry) => entry.id === clip.assetId);
    const rawPeaks: readonly number[] = asset?.waveformPeaks?.length ? asset.waveformPeaks : [0];
    const clipDuration = Math.max(0.001, clip.endTime - clip.startTime);
    const peaks = clip.edit
      ? renderClipEdits(rawPeaks, clip.edit, clipDuration)
      : rawPeaks;
    const gain = clip.clipGain * (mixer?.gain ?? track.gain ?? 1);
    const pan = clamp((mixer?.pan ?? track.pan ?? 0) + 0, -1, 1);
    const leftGain = pan <= 0 ? 1 : 1 - pan;
    const rightGain = pan >= 0 ? 1 : 1 + pan;
    const clipStart = Math.max(0, clip.startTime, loopStart ?? 0);
    const clipEnd = Math.min(clip.endTime, loopEnd ?? clip.endTime);
    const startFrame = Math.max(0, Math.floor(clipStart * this.sampleRate));
    const endFrame = Math.min(left.length, Math.ceil(clipEnd * this.sampleRate));
    const clipDurationFrames = Math.max(1, endFrame - startFrame);

    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const progress = (frame - startFrame) / clipDurationFrames;
      const peakIndex = Math.min(peaks.length - 1, Math.floor(progress * peaks.length));
      const source = peaks[peakIndex] ?? 0;
      const sample = source * gain;
      left[frame] += sample * leftGain;
      right[frame] += sample * rightGain;
    }
  }

  private resolveDuration(project: WubLabzProject, options: { loopStart?: number; loopEnd?: number }, events: ReturnType<typeof projectToTimelineEvents>): number {
    const fromEvents = events.reduce((max, event) => Math.max(max, event.endTime), 0);
    const fromProject = project.audioClips.reduce((max, clip) => Math.max(max, clip.endTime), 0);
    const loopEnd = options.loopEnd ?? fromEvents ?? fromProject;
    return Math.max(loopEnd, fromProject, 0.01);
  }

  private toWavBlob(data: Uint8Array): Blob {
    const arrayBuffer = Uint8Array.from(data).buffer;
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
