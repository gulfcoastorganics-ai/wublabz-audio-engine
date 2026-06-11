import type { WubLabzProject } from '../../lib/project/projectSchema.js';
import type { UserProgress } from './wubGuideProgress.js';
import type { ProducerAnalysis, ProducerProjectSummary, ProducerSuggestion } from './producerModeTypes.js';
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
