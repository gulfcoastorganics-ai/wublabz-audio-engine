import type { WubGuideTarget } from './wubGuideTypes.js';

export type WubGuideAction = {
  type:
    | 'openBrowser'
    | 'openMixer'
    | 'openPianoRoll'
    | 'focusTransport'
    | 'focusArrangement'
    | 'focusExport'
    | 'focusSave'
    | 'startTutorial'
    | 'createTrack'
    | 'createClipPlaceholder';
};

export type WubGuideActionResult = {
  highlightTarget: WubGuideTarget | null;
  label: string | null;
  didAct: boolean;
};

export const WUB_GUIDE_ACTION_TARGETS: Record<WubGuideAction['type'], WubGuideActionResult> = {
  openBrowser: {
    highlightTarget: 'import-zone',
    label: 'I opened the Browser and highlighted the import area.',
    didAct: true,
  },
  openMixer: {
    highlightTarget: 'mixer',
    label: 'I opened the Mixer for you.',
    didAct: true,
  },
  openPianoRoll: {
    highlightTarget: 'piano-roll',
    label: 'I opened the Piano Roll for you.',
    didAct: true,
  },
  focusTransport: {
    highlightTarget: 'transport',
    label: 'I highlighted the Transport for you.',
    didAct: true,
  },
  focusArrangement: {
    highlightTarget: 'arrangement',
    label: 'I highlighted the Arrangement for you.',
    didAct: true,
  },
  focusExport: {
    highlightTarget: 'export',
    label: 'I highlighted Export WAV for you.',
    didAct: true,
  },
  focusSave: {
    highlightTarget: 'save',
    label: 'I highlighted Save for you.',
    didAct: true,
  },
  startTutorial: {
    highlightTarget: 'transport',
    label: 'I started the guided tutorial.',
    didAct: true,
  },
  createTrack: {
    highlightTarget: 'track-header',
    label: 'I made sure you have a track to start with.',
    didAct: true,
  },
  createClipPlaceholder: {
    highlightTarget: 'clip',
    label: 'I created a starter MIDI clip placeholder.',
    didAct: true,
  },
};
