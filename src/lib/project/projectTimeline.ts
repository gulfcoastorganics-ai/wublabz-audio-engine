import type { TimelineEventV2 } from '../producer/types.js';
import type { AudioClip, WubLabzProject } from './projectSchema.js';

export function projectToTimelineEvents(project: WubLabzProject): TimelineEventV2[] {
  const events: TimelineEventV2[] = [];

  for (const clip of [...project.audioClips].sort((left, right) => left.startTime - right.startTime || left.id.localeCompare(right.id))) {
    events.push({
      id: clip.id,
      type: 'stem_clip',
      sourceId: clip.assetId,
      stemId: clip.assetId,
      sectionId: clip.trackId,
      startTime: clip.startTime,
      endTime: clip.endTime,
      beatStart: secondsToBeats(clip.startTime, project.bpm),
      beatEnd: secondsToBeats(clip.endTime, project.bpm),
      barStart: beatsToBars(secondsToBeats(clip.startTime, project.bpm), project.timeSignature.beatsPerBar),
      barEnd: beatsToBars(secondsToBeats(clip.endTime, project.bpm), project.timeSignature.beatsPerBar),
      energyLevel: clip.clipGain,
      enabled: !clip.muted,
      probability: 1,
      payload: {
        clipId: clip.id,
        assetId: clip.assetId,
        clipGain: clip.clipGain,
        sourceOffsetSeconds: clip.sourceOffsetSeconds,
        trackId: clip.trackId,
        clipEdit: clip.edit,
        normalizedGain: resolveNormalizedGain(clip, project)
      }
    });
  }

  for (const clip of [...project.midiClips].sort((left, right) => left.startTime - right.startTime || left.id.localeCompare(right.id))) {
    events.push({
      id: clip.id,
      type: 'marker',
      sourceId: clip.id,
      stemId: clip.trackId,
      sectionId: clip.trackId,
      startTime: clip.startTime,
      endTime: clip.endTime,
      beatStart: secondsToBeats(clip.startTime, project.bpm),
      beatEnd: secondsToBeats(clip.endTime, project.bpm),
      barStart: beatsToBars(secondsToBeats(clip.startTime, project.bpm), project.timeSignature.beatsPerBar),
      barEnd: beatsToBars(secondsToBeats(clip.endTime, project.bpm), project.timeSignature.beatsPerBar),
      energyLevel: clip.clipGain,
      enabled: !clip.muted,
      probability: 1,
      payload: {
        clipId: clip.id,
        trackId: clip.trackId,
        notes: clip.notes
      }
    });
  }

  for (const lane of project.automationLanes) {
    for (const point of lane.points.slice().sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))) {
      events.push({
        id: point.id,
      type: 'marker',
        sourceId: lane.id,
        sectionId: lane.trackId,
        startTime: point.time,
        endTime: point.time,
        beatStart: secondsToBeats(point.time, project.bpm),
        beatEnd: secondsToBeats(point.time, project.bpm),
        barStart: beatsToBars(secondsToBeats(point.time, project.bpm), project.timeSignature.beatsPerBar),
        barEnd: beatsToBars(secondsToBeats(point.time, project.bpm), project.timeSignature.beatsPerBar),
        energyLevel: point.value,
        enabled: true,
        probability: 1,
        payload: {
          laneId: lane.id,
          target: lane.target,
          targetId: lane.targetId,
          parameter: lane.parameter,
          value: point.value
        }
      });
    }
  }

  return events.sort((left, right) =>
    left.startTime === right.startTime ? left.id.localeCompare(right.id) : left.startTime - right.startTime
  );
}

function resolveNormalizedGain(clip: AudioClip, project: WubLabzProject): number {
  if (!clip.edit?.normalized) return 1;
  const asset = project.audioAssets.find((a) => a.id === clip.assetId);
  const peaks = asset?.waveformPeaks;
  if (!peaks?.length) return 1;
  const maxPeak = Math.max(...peaks);
  return maxPeak > 0 ? 1 / maxPeak : 1;
}

export function createEmptyProject(id: string, name: string): WubLabzProject {
  const createdAt = new Date().toISOString();
  return {
    id,
    name,
    bpm: 120,
    timeSignature: { beatsPerBar: 4, beatUnit: 4 },
    tracks: [],
    audioAssets: [],
    audioClips: [],
    midiClips: [],
    automationLanes: [],
    mixerState: {},
    createdAt,
    updatedAt: createdAt,
    version: '1.0'
  };
}

function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

function beatsToBars(beats: number, beatsPerBar: number): number {
  return beats / beatsPerBar;
}
