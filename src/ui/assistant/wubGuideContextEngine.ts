import type { WubLabzProject } from '../../lib/project/projectSchema.js';
import type { WubGuideResponse } from './wubGuideTypes.js';
import type { UserProgress } from './wubGuideProgress.js';
import { WUB_GUIDE_MILESTONES } from './wubGuideProgress.js';

export type WubGuideContext = {
  progress: UserProgress;
  completedCount: number;
  totalCount: number;
  nextSuggestion: WubGuideResponse;
};

export function deriveUserProgress(project: WubLabzProject, stored: UserProgress): UserProgress {
  const hasAudio = project.audioAssets.length > 0;
  const hasTrack = project.tracks.length > 0;
  const hasClip = project.audioClips.length > 0 || project.midiClips.length > 0;

  return {
    ...stored,
    importedAudio: stored.importedAudio || hasAudio,
    createdTrack: stored.createdTrack || hasTrack,
    createdClip: stored.createdClip || hasClip,
  };
}

export function createWubGuideContext(project: WubLabzProject, stored: UserProgress): WubGuideContext {
  const progress = deriveUserProgress(project, stored);
  const completedCount = WUB_GUIDE_MILESTONES.filter((milestone) => progress[milestone.id]).length;

  return {
    progress,
    completedCount,
    totalCount: WUB_GUIDE_MILESTONES.length,
    nextSuggestion: getNextOnboardingSuggestion(progress),
  };
}

export function getNextOnboardingSuggestion(progress: UserProgress): WubGuideResponse {
  if (!progress.importedAudio) {
    return {
      id: 'next-import-audio',
      title: 'Next: Import Audio',
      body: 'Wanna import your first sample?',
      steps: ['Open the Browser.', 'Drop a local audio file on the import area.', 'WubLabz will keep the audio local.'],
      highlightTarget: 'import-zone',
      actions: [{ type: 'openBrowser' }],
    };
  }

  if (!progress.createdTrack) {
    return {
      id: 'next-create-track',
      title: 'Next: Create Track',
      body: 'Let’s create a track so your ideas have a lane to live in.',
      steps: ['Create an audio track for samples, or a MIDI track for notes.', 'I can create a starter track for you.'],
      highlightTarget: 'track-header',
      actions: [{ type: 'createTrack' }],
    };
  }

  if (!progress.createdClip) {
    return {
      id: 'next-create-clip',
      title: 'Next: Create Clip',
      body: "Let's place that sample on the timeline.",
      steps: ['Drag imported audio into the Arrangement.', 'Or create a starter MIDI clip if you want to sketch notes.'],
      highlightTarget: 'arrangement',
      actions: [{ type: 'focusArrangement' }],
    };
  }

  if (!progress.openedPianoRoll) {
    return {
      id: 'next-piano-roll',
      title: 'Next: Piano Roll',
      body: "Nice. Want to learn editing? Let's create your first melody.",
      steps: ['Open a MIDI clip in the Piano Roll.', 'Use the Pencil tool to draw notes.'],
      highlightTarget: 'piano-roll',
      actions: [{ type: 'openPianoRoll' }],
    };
  }

  if (!progress.openedMixer) {
    return {
      id: 'next-mixer',
      title: 'Next: Mixer',
      body: 'Now balance the sound. Try adjusting volume, pan, mute, or solo.',
      steps: ['Open the Mixer.', 'Move one fader or try mute/solo on a channel.'],
      highlightTarget: 'mixer',
      actions: [{ type: 'openMixer' }],
    };
  }

  if (!progress.savedProject) {
    return {
      id: 'next-save',
      title: 'Next: Save',
      body: "Don't forget to save your project.",
      steps: ['Click Save in the Transport.', 'Keep saving after important edits.'],
      highlightTarget: 'save',
      actions: [{ type: 'focusSave' }],
    };
  }

  if (!progress.exportedAudio) {
    return {
      id: 'next-export',
      title: 'Next: Export WAV',
      body: 'Ready to share or listen outside WubLabz? Export a WAV.',
      steps: ['Check levels in the Mixer.', 'Click Export WAV in the Transport.'],
      highlightTarget: 'export',
      actions: [{ type: 'focusExport' }],
    };
  }

  return {
    id: 'journey-complete',
    title: 'Beginner Journey Complete',
    body: 'You have completed the core WubLabz onboarding loop.',
    steps: ['Keep arranging clips.', 'Refine the mix.', 'Export new versions as your idea evolves.'],
    highlightTarget: 'arrangement',
    actions: [{ type: 'focusArrangement' }],
  };
}
