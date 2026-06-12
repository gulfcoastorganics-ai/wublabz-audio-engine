import { useStudioStore } from '../../state/useStudioStore.js';
import type { WubGuideAction, WubGuideActionResult } from './wubGuideActions.js';
import { WUB_GUIDE_ACTION_TARGETS } from './wubGuideActions.js';

function ensureTrack(type: 'audio' | 'midi'): string {
  const state = useStudioStore.getState();
  return state.project.tracks.find((track) => track.type === type)?.id ?? state.addTrack(type);
}

function ensureMidiClip(): string {
  const state = useStudioStore.getState();
  const existing = state.project.midiClips[0];
  if (existing) return existing.id;

  const trackId = ensureTrack('midi');
  return useStudioStore.getState().addMidiClip(trackId, 0, 4);
}

function executeAction(action: WubGuideAction): WubGuideActionResult {
  const studio = useStudioStore.getState();

  switch (action.type) {
    case 'openBrowser':
      if (!studio.showBrowser) studio.toggleBrowser();
      return WUB_GUIDE_ACTION_TARGETS.openBrowser;

    case 'openMixer':
      if (!studio.showMixer) studio.toggleMixer();
      return WUB_GUIDE_ACTION_TARGETS.openMixer;

    case 'openPianoRoll': {
      const clipId = ensureMidiClip();
      useStudioStore.getState().openPianoRoll(clipId);
      return WUB_GUIDE_ACTION_TARGETS.openPianoRoll;
    }

    case 'focusTransport':
    case 'focusArrangement':
    case 'focusExport':
    case 'focusSave':
      return WUB_GUIDE_ACTION_TARGETS[action.type];

    case 'startTutorial':
      return WUB_GUIDE_ACTION_TARGETS.startTutorial;

    case 'createTrack':
      ensureTrack('audio');
      return WUB_GUIDE_ACTION_TARGETS.createTrack;

    case 'createClipPlaceholder': {
      const clipId = ensureMidiClip();
      useStudioStore.getState().selectClip(clipId);
      return WUB_GUIDE_ACTION_TARGETS.createClipPlaceholder;
    }
  }
}

export function executeWubGuideActions(actions: WubGuideAction[] | undefined): WubGuideActionResult {
  if (!actions?.length) {
    return { highlightTarget: null, label: null, didAct: false };
  }

  return actions.reduce<WubGuideActionResult>(
    (_result: WubGuideActionResult, action: WubGuideAction) => executeAction(action),
    { highlightTarget: null, label: null, didAct: false }
  );
}
