import React, { useEffect, useMemo, useState } from 'react';
import { WUB_GUIDE_QUICK_ACTIONS, WUB_GUIDE_TUTORIAL_STEPS } from './wubGuideKnowledge.js';
import { useWubGuide } from './useWubGuide.js';
import { WubGuideAvatar } from './WubGuideAvatar.js';
import { ProducerModePanel } from './ProducerModePanel.js';
import { useStudioStore } from '../../state/useStudioStore.js';
import { createWubGuideContext } from './wubGuideContextEngine.js';
import { WUB_GUIDE_MILESTONES } from './wubGuideProgress.js';
import type { WubGuideAvatarState } from './wubGuideTypes.js';

export function WubGuidePanel() {
  const {
    beginnerModeEnabled,
    assistantOpen,
    guideMode,
    currentResponse,
    actionFeedback,
    userProgress,
    lastPrompt,
    tutorialActive,
    tutorialStepIndex,
    askGuide,
    markProgress,
    startTutorial,
    nextTutorialStep,
    previousTutorialStep,
    skipTutorial,
    finishTutorial,
    closeAssistant,
    setGuideMode,
  } = useWubGuide();
  const project = useStudioStore((state) => state.project);
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
  const context = useMemo(
    () => createWubGuideContext(project, userProgress),
    [project, userProgress]
  );

  useEffect(() => {
    const changed = Object.entries(context.progress).some(
      ([key, value]) => userProgress[key as keyof typeof userProgress] !== value
    );
    if (changed) markProgress(context.progress);
  }, [context.progress, markProgress, userProgress]);

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
          <small>{guideMode === 'producer' ? 'Producer coach' : 'Local beginner guide'}</small>
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

      <div className="wubguide-mode-switch" aria-label="WubGuide mode switch">
        <button
          type="button"
          data-active={guideMode === 'beginner' ? 'true' : 'false'}
          onClick={() => setGuideMode('beginner')}
          aria-label="Switch to Beginner Mode"
        >
          Beginner
        </button>
        <button
          type="button"
          data-active={guideMode === 'producer' ? 'true' : 'false'}
          onClick={() => setGuideMode('producer')}
          aria-label="Switch to Producer Mode"
        >
          Producer
        </button>
      </div>

      {guideMode === 'producer' ? (
        <ProducerModePanel />
      ) : (
        <>

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

      <section className="wubguide-progress-card" aria-label="Beginner Journey">
        <div className="wubguide-progress-card-header">
          <strong>Beginner Journey</strong>
          <span>{context.completedCount}/{context.totalCount}</span>
        </div>
        <ul>
          {WUB_GUIDE_MILESTONES.map((milestone) => (
            <li key={milestone.id} data-complete={context.progress[milestone.id] ? 'true' : 'false'}>
              <span aria-hidden="true">{context.progress[milestone.id] ? '✓' : ' '}</span>
              {milestone.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="wubguide-next-step"
          onClick={() => askGuide(context.nextSuggestion.body)}
          aria-label={`Try next WubGuide step: ${context.nextSuggestion.title}`}
        >
          {context.nextSuggestion.body}
        </button>
      </section>

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
        </>
      )}
    </aside>
  );
}
