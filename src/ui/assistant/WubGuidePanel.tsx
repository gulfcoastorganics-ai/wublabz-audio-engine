import React, { useEffect, useMemo, useState } from 'react';
import { WUB_GUIDE_QUICK_ACTIONS, WUB_GUIDE_TUTORIAL_STEPS } from './wubGuideKnowledge.js';
import { useWubGuide } from './useWubGuide.js';
import { WubGuideAvatar } from './WubGuideAvatar.js';
import type { WubGuideAvatarState } from './wubGuideTypes.js';

export function WubGuidePanel() {
  const {
    beginnerModeEnabled,
    assistantOpen,
    currentResponse,
    actionFeedback,
    lastPrompt,
    tutorialActive,
    tutorialStepIndex,
    askGuide,
    startTutorial,
    nextTutorialStep,
    previousTutorialStep,
    skipTutorial,
    finishTutorial,
    closeAssistant,
  } = useWubGuide();
  const [prompt, setPrompt] = useState('');
  const [avatarState, setAvatarState] = useState<WubGuideAvatarState>('idle');

  useEffect(() => {
    if (!assistantOpen) return;
    setAvatarState(actionFeedback || tutorialActive ? 'pointing' : 'speaking');
    const timeout = window.setTimeout(() => setAvatarState('idle'), 850);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback, assistantOpen, currentResponse.id, tutorialActive, tutorialStepIndex]);

  const canGoBack = tutorialActive && tutorialStepIndex > 0;
  const canGoNext = tutorialActive && tutorialStepIndex < WUB_GUIDE_TUTORIAL_STEPS.length - 1;
  const tutorialProgress = useMemo(
    () => `${tutorialStepIndex + 1} / ${WUB_GUIDE_TUTORIAL_STEPS.length}`,
    [tutorialStepIndex]
  );

  if (!assistantOpen) return null;

  function submitPrompt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = prompt.trim();
    if (!value) return;
    setAvatarState('thinking');
    window.setTimeout(() => {
      askGuide(value);
      setPrompt('');
    }, 120);
  }

  function runQuickPrompt(actionPrompt: string) {
    if (actionPrompt.toLowerCase().includes('start tutorial')) {
      startTutorial();
      return;
    }
    setAvatarState('thinking');
    window.setTimeout(() => askGuide(actionPrompt), 120);
  }

  return (
    <aside
      className="wubguide-panel"
      aria-label="WubGuide AI assistant"
      data-beginner-mode={beginnerModeEnabled ? 'on' : 'off'}
    >
      <div className="wubguide-panel-header">
        <WubGuideAvatar state={avatarState} />
        <div className="wubguide-panel-title">
          <span>WubGuide AI</span>
          <small>Local beginner guide</small>
        </div>
        <button
          type="button"
          className="wubguide-icon-btn"
          onClick={closeAssistant}
          aria-label="Close WubGuide AI"
          title="Close WubGuide AI"
        >
          x
        </button>
      </div>

      <div className="wubguide-message-stack" aria-live="polite">
        {lastPrompt && (
          <div className="wubguide-message wubguide-message-user">
            <strong>You</strong>
            <p>{lastPrompt}</p>
          </div>
        )}
        <div className="wubguide-message wubguide-message-guide">
          <strong>{currentResponse.title}</strong>
          <p>{currentResponse.body}</p>
          {actionFeedback && (
            <div className="wubguide-action-feedback" role="status">
              {actionFeedback}
            </div>
          )}
          {currentResponse.steps && currentResponse.steps.length > 0 && (
            <ol>
              {currentResponse.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <form className="wubguide-prompt-row" onSubmit={submitPrompt}>
        <label className="sr-only" htmlFor="wubguide-question">
          Ask WubGuide a beginner question
        </label>
        <input
          id="wubguide-question"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask: How do I import audio?"
          aria-label="Ask WubGuide a beginner question"
        />
        <button type="submit" aria-label="Ask WubGuide">
          Ask
        </button>
      </form>

      <div className="wubguide-quick-actions" aria-label="WubGuide quick prompts">
        {WUB_GUIDE_QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => runQuickPrompt(action.prompt)}
            aria-label={action.label}
          >
            {action.label}
          </button>
        ))}
      </div>

      {tutorialActive && (
        <div className="wubguide-tutorial-footer" aria-label="Tutorial controls">
          <span>Step {tutorialProgress}</span>
          <div>
            <button type="button" onClick={previousTutorialStep} disabled={!canGoBack}>
              Back
            </button>
            {canGoNext ? (
              <button type="button" onClick={nextTutorialStep}>
                Next
              </button>
            ) : (
              <button type="button" onClick={finishTutorial}>
                Finish
              </button>
            )}
            <button type="button" onClick={skipTutorial}>
              Skip
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
