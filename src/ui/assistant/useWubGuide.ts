import { create } from 'zustand';
import {
  answerWubGuidePrompt,
  WUB_GUIDE_TUTORIAL_STEPS,
  WUB_GUIDE_WELCOME_RESPONSE,
} from './wubGuideKnowledge.js';
import { executeWubGuideActions } from './wubGuideWorkflowEngine.js';
import {
  loadWubGuideProgress,
  mergeUserProgress,
  saveWubGuideProgress,
  type UserProgress,
} from './wubGuideProgress.js';
import type { WubGuideResponse, WubGuideStore, WubGuideTarget } from './wubGuideTypes.js';
import type { WubGuideAction } from './wubGuideActions.js';

function responseLabel(response: WubGuideResponse): string | undefined {
  return response.highlightTarget ? response.title : undefined;
}

function tutorialResponse(stepIndex: number): WubGuideResponse {
  const step = WUB_GUIDE_TUTORIAL_STEPS[stepIndex] ?? WUB_GUIDE_TUTORIAL_STEPS[0]!;
  return {
    id: `tutorial-${step.id}`,
    title: step.title,
    body: step.body,
    steps: [`Tutorial step ${stepIndex + 1} of ${WUB_GUIDE_TUTORIAL_STEPS.length}`],
    highlightTarget: step.highlightTarget,
  };
}

function progressPatchFromActions(actions: WubGuideAction[] | undefined): Partial<UserProgress> {
  const patch: Partial<UserProgress> = {};
  for (const action of actions ?? []) {
    if (action.type === 'openMixer') patch.openedMixer = true;
    if (action.type === 'openPianoRoll') patch.openedPianoRoll = true;
    if (action.type === 'createTrack') patch.createdTrack = true;
    if (action.type === 'createClipPlaceholder') {
      patch.createdTrack = true;
      patch.createdClip = true;
    }
  }
  return patch;
}

export const useWubGuide = create<WubGuideStore>((set, get) => ({
  beginnerModeEnabled: false,
  assistantOpen: false,
  activeGuideTarget: null,
  guideFloatingLabel: null,
  tutorialActive: false,
  tutorialStepIndex: 0,
  currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
  lastPrompt: '',
  actionFeedback: null,
  userProgress: loadWubGuideProgress(),

  toggleBeginnerMode() {
    const enabled = !get().beginnerModeEnabled;
    set({
      beginnerModeEnabled: enabled,
      assistantOpen: enabled ? true : false,
      activeGuideTarget: enabled ? 'transport' : null,
      guideFloatingLabel: enabled ? 'Beginner Mode is on.' : null,
      currentResponse: enabled ? WUB_GUIDE_WELCOME_RESPONSE : get().currentResponse,
      tutorialActive: enabled ? get().tutorialActive : false,
      actionFeedback: null,
    });
  },

  setBeginnerMode(enabled) {
    set({
      beginnerModeEnabled: enabled,
      assistantOpen: enabled ? true : false,
      activeGuideTarget: enabled ? 'transport' : null,
      guideFloatingLabel: enabled ? 'Beginner Mode is on.' : null,
      currentResponse: enabled ? WUB_GUIDE_WELCOME_RESPONSE : get().currentResponse,
      tutorialActive: enabled ? get().tutorialActive : false,
      actionFeedback: null,
    });
  },

  openAssistant() {
    set({ assistantOpen: true });
  },

  closeAssistant() {
    set({ assistantOpen: false });
  },

  setActiveGuideTarget(target: WubGuideTarget | null, label?: string) {
    set({ activeGuideTarget: target, guideFloatingLabel: target ? label ?? null : null });
  },

  askGuide(prompt) {
    const response = answerWubGuidePrompt(prompt);
    if (response.actions?.some((action) => action.type === 'startTutorial')) {
      get().startTutorial();
      return response;
    }

    const actionResult = executeWubGuideActions(response.actions);
    const activeGuideTarget = actionResult.highlightTarget ?? response.highlightTarget ?? null;
    const nextProgress = mergeUserProgress(get().userProgress, progressPatchFromActions(response.actions));
    saveWubGuideProgress(nextProgress);
    set({
      beginnerModeEnabled: true,
      assistantOpen: true,
      currentResponse: response,
      lastPrompt: prompt,
      activeGuideTarget,
      guideFloatingLabel: actionResult.label ?? responseLabel(response) ?? null,
      actionFeedback: actionResult.didAct ? 'I highlighted it for you.' : null,
      userProgress: nextProgress,
      tutorialActive: false,
    });
    return response;
  },

  markProgress(patch) {
    const next = mergeUserProgress(get().userProgress, patch);
    saveWubGuideProgress(next);
    set({ userProgress: next });
  },

  startTutorial() {
    const response = tutorialResponse(0);
    set({
      beginnerModeEnabled: true,
      assistantOpen: true,
      tutorialActive: true,
      tutorialStepIndex: 0,
      currentResponse: response,
      activeGuideTarget: response.highlightTarget ?? null,
      guideFloatingLabel: WUB_GUIDE_TUTORIAL_STEPS[0]!.label,
      lastPrompt: 'Start tutorial',
      actionFeedback: 'I highlighted it for you.',
    });
  },

  nextTutorialStep() {
    const nextIndex = Math.min(get().tutorialStepIndex + 1, WUB_GUIDE_TUTORIAL_STEPS.length - 1);
    const response = tutorialResponse(nextIndex);
    set({
      tutorialActive: true,
      tutorialStepIndex: nextIndex,
      currentResponse: response,
      activeGuideTarget: response.highlightTarget ?? null,
      guideFloatingLabel: WUB_GUIDE_TUTORIAL_STEPS[nextIndex]!.label,
      actionFeedback: 'I highlighted it for you.',
    });
  },

  previousTutorialStep() {
    const previousIndex = Math.max(get().tutorialStepIndex - 1, 0);
    const response = tutorialResponse(previousIndex);
    set({
      tutorialActive: true,
      tutorialStepIndex: previousIndex,
      currentResponse: response,
      activeGuideTarget: response.highlightTarget ?? null,
      guideFloatingLabel: WUB_GUIDE_TUTORIAL_STEPS[previousIndex]!.label,
      actionFeedback: 'I highlighted it for you.',
    });
  },

  skipTutorial() {
    set({
      tutorialActive: false,
      tutorialStepIndex: 0,
      activeGuideTarget: null,
      guideFloatingLabel: null,
      currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
      actionFeedback: null,
    });
  },

  finishTutorial() {
    set({
      tutorialActive: false,
      tutorialStepIndex: WUB_GUIDE_TUTORIAL_STEPS.length - 1,
      activeGuideTarget: 'export',
      guideFloatingLabel: 'Tutorial complete. Save or export when ready.',
      actionFeedback: 'I highlighted it for you.',
      currentResponse: {
        id: 'tutorial-complete',
        title: 'Tutorial Complete',
        body: 'You now know the main WubLabz Studio areas. Keep Beginner Mode on for labels and guided highlights.',
        steps: ['Import or arrange a clip.', 'Balance levels in the Mixer.', 'Save or Export WAV when done.'],
        highlightTarget: 'export',
      },
    });
  },
}));
