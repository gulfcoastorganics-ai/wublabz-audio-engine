import { create } from 'zustand';
import {
  answerWubGuidePrompt,
  WUB_GUIDE_TUTORIAL_STEPS,
  WUB_GUIDE_WELCOME_RESPONSE,
} from './wubGuideKnowledge.js';
import type { WubGuideResponse, WubGuideStore, WubGuideTarget } from './wubGuideTypes.js';

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

export const useWubGuide = create<WubGuideStore>((set, get) => ({
  beginnerModeEnabled: false,
  assistantOpen: false,
  activeGuideTarget: null,
  guideFloatingLabel: null,
  tutorialActive: false,
  tutorialStepIndex: 0,
  currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
  lastPrompt: '',

  toggleBeginnerMode() {
    const enabled = !get().beginnerModeEnabled;
    set({
      beginnerModeEnabled: enabled,
      assistantOpen: enabled ? true : false,
      activeGuideTarget: enabled ? 'transport' : null,
      guideFloatingLabel: enabled ? 'Beginner Mode is on.' : null,
      currentResponse: enabled ? WUB_GUIDE_WELCOME_RESPONSE : get().currentResponse,
      tutorialActive: enabled ? get().tutorialActive : false,
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
    set({
      assistantOpen: true,
      currentResponse: response,
      lastPrompt: prompt,
      activeGuideTarget: response.highlightTarget ?? null,
      guideFloatingLabel: responseLabel(response) ?? null,
      tutorialActive: false,
    });
    return response;
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
    });
  },

  skipTutorial() {
    set({
      tutorialActive: false,
      tutorialStepIndex: 0,
      activeGuideTarget: null,
      guideFloatingLabel: null,
      currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
    });
  },

  finishTutorial() {
    set({
      tutorialActive: false,
      tutorialStepIndex: WUB_GUIDE_TUTORIAL_STEPS.length - 1,
      activeGuideTarget: 'export',
      guideFloatingLabel: 'Tutorial complete. Save or export when ready.',
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
