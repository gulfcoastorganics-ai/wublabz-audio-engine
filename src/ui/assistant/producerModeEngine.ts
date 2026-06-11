import type { WubLabzProject } from '../../lib/project/projectSchema.js';
import type { UserProgress } from './wubGuideProgress.js';
import type {
  ProducerAnalysis,
  ProducerMeterContext,
  ProducerProjectSummary,
  ProducerSuggestion,
} from './producerModeTypes.js';
import { PRODUCER_MODE_EMPTY_PROJECT, PRODUCER_MODE_SUGGESTIONS } from './producerModeKnowledge.js';

const PRIORITY_SCORE: Record<ProducerSuggestion['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function summarizeProducerProject(
  project: WubLabzProject,
  progress: UserProgress
): ProducerProjectSummary {
  const allClips = [...project.audioClips, ...project.midiClips];
  const arrangementDurationSeconds = allClips.reduce((max, clip) => Math.max(max, clip.endTime), 0);
  const beats = arrangementDurationSeconds > 0 ? (arrangementDurationSeconds * project.bpm) / 60 : 0;
  const arrangementBars = project.timeSignature.beatsPerBar > 0
    ? beats / project.timeSignature.beatsPerBar
    : 0;

  return {
    bpm: project.bpm,
    timeSignature: `${project.timeSignature.beatsPerBar}/${project.timeSignature.beatUnit}`,
    trackCount: project.tracks.length,
    audioClipCount: project.audioClips.length,
    midiClipCount: project.midiClips.length,
    arrangementDurationSeconds,
    arrangementBars,
    hasMutedOrSoloedTracks: project.tracks.some((track) => track.mute || track.solo),
    savedProject: progress.savedProject,
    exportedAudio: progress.exportedAudio,
  };
}

export function analyzeProducerProject(project: WubLabzProject, progress: UserProgress): ProducerAnalysis {
  return analyzeProducerProjectWithMeters(project, progress);
}

export function analyzeProducerProjectWithMeters(
  project: WubLabzProject,
  progress: UserProgress,
  meterContext?: ProducerMeterContext
): ProducerAnalysis {
  const summary = summarizeProducerProject(project, progress);
  const suggestions: ProducerSuggestion[] = [];
  const clipCount = summary.audioClipCount + summary.midiClipCount;

  if (clipCount === 0) suggestions.push(PRODUCER_MODE_EMPTY_PROJECT);
  if (clipCount > 0 && summary.arrangementBars < 16) suggestions.push(PRODUCER_MODE_SUGGESTIONS.shortArrangement);
  if (summary.midiClipCount > 0 && summary.audioClipCount === 0) suggestions.push(PRODUCER_MODE_SUGGESTIONS.midiOnly);
  if (summary.audioClipCount > 0 && summary.midiClipCount === 0) suggestions.push(PRODUCER_MODE_SUGGESTIONS.audioOnly);

  if (summary.bpm < 90) suggestions.push(PRODUCER_MODE_SUGGESTIONS.downtempo);
  if (summary.bpm >= 120 && summary.bpm <= 130) suggestions.push(PRODUCER_MODE_SUGGESTIONS.dance);
  if (summary.bpm >= 140 && summary.bpm <= 150) suggestions.push(PRODUCER_MODE_SUGGESTIONS.bassMusic);

  if (!summary.hasMutedOrSoloedTracks) suggestions.push(PRODUCER_MODE_SUGGESTIONS.muteSolo);
  if (!summary.savedProject) suggestions.push(PRODUCER_MODE_SUGGESTIONS.save);
  if (!summary.exportedAudio) suggestions.push(PRODUCER_MODE_SUGGESTIONS.export);
  // Clip editing suggestions
  if (project.audioClips.length > 0) {
    const clipsWithoutFades = project.audioClips.filter(
      (c) => !c.edit?.fadeInSeconds && !c.edit?.fadeOutSeconds
    );
    if (clipsWithoutFades.length > 0) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.addFades);
    }

    const highGainClips = project.audioClips.filter(
      (c) => (c.edit?.gain ?? 1) > 1.5
    );
    if (highGainClips.length > 0) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.highClipGain);
    }

    const assetIdCounts = project.audioClips.reduce<Record<string, number>>((acc, c) => {
      acc[c.assetId] = (acc[c.assetId] ?? 0) + 1;
      return acc;
    }, {});
    if (Object.values(assetIdCounts).some((count) => count > 1)) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.repeatedClip);
    }

    const hasSelectedClip =
      project.audioClips.some((c) => c.selected) ||
      project.midiClips.some((c) => c.selected);
    if (!hasSelectedClip) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.selectClipToEdit);
    }

    const normalizeGainClips = project.audioClips.filter(
      (c) => c.edit?.normalized && (c.edit?.gain ?? 1) > 1.5
    );
    if (normalizeGainClips.length > 0) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.normalizeGainHeadroom);
    }

    const fadesExceedClips = project.audioClips.filter((c) => {
      if (!c.edit?.fadeInSeconds && !c.edit?.fadeOutSeconds) return false;
      const clipDuration = c.endTime - c.startTime;
      return (c.edit?.fadeInSeconds ?? 0) + (c.edit?.fadeOutSeconds ?? 0) > clipDuration;
    });
    if (fadesExceedClips.length > 0) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.fadesExceedDuration);
    }
  }

  if (meterContext) {
    const meterLevels = Object.values(meterContext.snapshot.levels);
    const clippingChannels = meterLevels.filter((level) => level.channelId !== 'master' && level.clipping);
    const activeChannels = meterLevels.filter((level) => level.channelId !== 'master' && (level.peak > 0.04 || level.rms > 0.02));
    const masterLevel = meterContext.snapshot.levels.master;
    const masterPeak = masterLevel?.peak ?? 0;
    const anyAudibleSignal = activeChannels.length > 0 || masterPeak > 0.04;

    if (clippingChannels.length > 0) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.clipping);
    }

    if (meterContext.isPlaying && !anyAudibleSignal) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.silentPlayback);
    }

    if (masterPeak >= 0.88 || (masterLevel?.rms ?? 0) >= 0.72) {
      suggestions.push(PRODUCER_MODE_SUGGESTIONS.headroom);
    }
  }

  const sorted = suggestions.sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority]);

  return {
    summary,
    suggestions: sorted,
    nextBestMove: sorted[0] ?? {
      id: 'keep-refining',
      category: 'workflow',
      priority: 'low',
      title: 'Keep Refining',
      body: 'Your foundation is in place. Refine the groove, automate transitions, and export another test bounce.',
      guideTarget: 'arrangement',
    },
  };
}
