import type { WubGuideAction } from './wubGuideActions.js';

export type WubGuideTarget =
  | 'transport'
  | 'play-button'
  | 'bpm'
  | 'browser'
  | 'arrangement'
  | 'mixer'
  | 'piano-roll'
  | 'save'
  | 'export'
  | 'snap'
  | 'loop'
  | 'track-header'
  | 'clip'
  | 'import-zone';

export type WubGuideQuickAction = {
  id: string;
  label: string;
  prompt: string;
};

export type WubGuideResponse = {
  id: string;
  title: string;
  body: string;
  steps?: string[];
  highlightTarget?: WubGuideTarget;
  quickActions?: WubGuideQuickAction[];
  actions?: WubGuideAction[];
};

export type WubGuideAvatarState =
  | 'idle'
  | 'speaking'
  | 'thinking'
  | 'celebrating'
  | 'pointing';

export type WubGuideTutorialStep = {
  id: string;
  title: string;
  body: string;
  highlightTarget: WubGuideTarget;
  label: string;
};

export type BeginnerModeState = {
  beginnerModeEnabled: boolean;
  assistantOpen: boolean;
  activeGuideTarget: WubGuideTarget | null;
  guideFloatingLabel: string | null;
  tutorialActive: boolean;
  tutorialStepIndex: number;
  currentResponse: WubGuideResponse;
  lastPrompt: string;
  actionFeedback: string | null;
};

export type BeginnerModeActions = {
  toggleBeginnerMode: () => void;
  setBeginnerMode: (enabled: boolean) => void;
  openAssistant: () => void;
  closeAssistant: () => void;
  setActiveGuideTarget: (target: WubGuideTarget | null, label?: string) => void;
  askGuide: (prompt: string) => WubGuideResponse;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  previousTutorialStep: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
};

export type WubGuideStore = BeginnerModeState & BeginnerModeActions;
