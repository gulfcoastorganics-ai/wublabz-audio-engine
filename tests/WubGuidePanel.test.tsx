// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WubGuidePanel } from '../src/ui/assistant/WubGuidePanel.js';
import { answerWubGuidePrompt, WUB_GUIDE_WELCOME_RESPONSE } from '../src/ui/assistant/wubGuideKnowledge.js';
import { useWubGuide } from '../src/ui/assistant/useWubGuide.js';

function resetGuideStore() {
  useWubGuide.setState({
    beginnerModeEnabled: false,
    assistantOpen: false,
    activeGuideTarget: null,
    guideFloatingLabel: null,
    tutorialActive: false,
    tutorialStepIndex: 0,
    currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
    lastPrompt: '',
  });
}

beforeEach(() => {
  resetGuideStore();
});

afterEach(() => {
  cleanup();
  resetGuideStore();
});

describe('WubGuidePanel', () => {
  it('opens and closes the assistant panel', async () => {
    useWubGuide.getState().openAssistant();
    render(<WubGuidePanel />);

    expect(screen.getByLabelText('WubGuide AI assistant')).toBeInTheDocument();

    const user = (userEvent as any).setup();
    await user.click(screen.getByRole('button', { name: /Close WubGuide AI/i }));

    expect(useWubGuide.getState().assistantOpen).toBe(false);
  });

  it('quick prompts produce deterministic responses', async () => {
    useWubGuide.getState().openAssistant();
    render(<WubGuidePanel />);

    const user = (userEvent as any).setup();
    await user.click(screen.getByRole('button', { name: /Import Audio Help/i }));

    await waitFor(() => {
      expect(screen.getByText('Import Audio')).toBeInTheDocument();
    });
    expect(useWubGuide.getState().activeGuideTarget).toBe('browser');
  });

  it('tutorial next, back, and finish update tutorial state', async () => {
    useWubGuide.getState().startTutorial();
    render(<WubGuidePanel />);

    const user = (userEvent as any).setup();
    expect(screen.getByText(/Step 1 \/ 7/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(useWubGuide.getState().tutorialStepIndex).toBe(1);
    expect(screen.getByText(/Step 2 \/ 7/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Back$/i }));
    expect(useWubGuide.getState().tutorialStepIndex).toBe(0);

    for (let i = 0; i < 6; i += 1) {
      await user.click(screen.getByRole('button', { name: /^Next$/i }));
    }
    await user.click(screen.getByRole('button', { name: /^Finish$/i }));

    expect(useWubGuide.getState().tutorialActive).toBe(false);
    expect(useWubGuide.getState().currentResponse.title).toBe('Tutorial Complete');
  });

  it('sets highlight targets for transport, browser, mixer, and export questions', () => {
    expect(answerWubGuidePrompt('How do I press play?').highlightTarget).toBe('play-button');
    expect(answerWubGuidePrompt('How do I import audio?').highlightTarget).toBe('browser');
    expect(answerWubGuidePrompt('What is the mixer?').highlightTarget).toBe('mixer');
    expect(answerWubGuidePrompt('How do I export WAV?').highlightTarget).toBe('export');
  });
});
