// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WubGuidePanel } from '../src/ui/assistant/WubGuidePanel.js';
import { answerWubGuidePrompt, WUB_GUIDE_WELCOME_RESPONSE } from '../src/ui/assistant/wubGuideKnowledge.js';
import { useWubGuide } from '../src/ui/assistant/useWubGuide.js';
import {
  EMPTY_USER_PROGRESS,
  WUB_GUIDE_PROGRESS_STORAGE_KEY,
  loadWubGuideProgress,
  saveWubGuideProgress,
} from '../src/ui/assistant/wubGuideProgress.js';
import { createWubGuideContext } from '../src/ui/assistant/wubGuideContextEngine.js';
import { createEmptyProject } from '../src/lib/project/projectTimeline.js';
import { analyzeProducerProject, analyzeProducerProjectWithMeters } from '../src/ui/assistant/producerModeEngine.js';
import { useStudioStore } from '../src/state/useStudioStore.js';
import type { WubLabzProject } from '../src/lib/project/projectSchema.js';

function resetGuideStore() {
  useWubGuide.setState({
    beginnerModeEnabled: false,
    assistantOpen: false,
    guideMode: 'beginner',
    activeGuideTarget: null,
    guideFloatingLabel: null,
    tutorialActive: false,
    tutorialStepIndex: 0,
    currentResponse: WUB_GUIDE_WELCOME_RESPONSE,
    lastPrompt: '',
    actionFeedback: null,
    userProgress: { ...EMPTY_USER_PROGRESS },
  });
}

function resetStudioProject(project: WubLabzProject = createEmptyProject('wubguide-test', 'WubGuide Test')) {
  useStudioStore.setState({
    project,
    showBrowser: true,
    showMixer: true,
    pianoRollClipId: null,
    selectedClipId: null,
  });
}

beforeEach(() => {
  localStorage.clear();
  resetGuideStore();
  resetStudioProject();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetGuideStore();
  resetStudioProject();
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
      expect(screen.getByText('I highlighted it for you.')).toBeInTheDocument();
      expect(useWubGuide.getState().activeGuideTarget).toBe('import-zone');
    });
  });

  it('tutorial next, back, and finish update tutorial state', async () => {
    useWubGuide.getState().startTutorial();
    render(<WubGuidePanel />);

    const user = (userEvent as any).setup();
    expect(screen.getByText(/Step 1 \/ 7/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(useWubGuide.getState().tutorialStepIndex).toBe(1);
      expect(screen.getByText(/Step 2 \/ 7/)).toBeInTheDocument();
    });

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
    expect(answerWubGuidePrompt('How do I import audio?').highlightTarget).toBe('import-zone');
    expect(answerWubGuidePrompt('What is the mixer?').highlightTarget).toBe('mixer');
    expect(answerWubGuidePrompt('How do I export WAV?').highlightTarget).toBe('export');
  });

  it('first beat workflow declares deterministic setup actions', () => {
    const response = answerWubGuidePrompt('Help me make my first beat');

    expect(response.title).toBe('First Beat Coach');
    expect(response.actions?.map((action) => action.type)).toEqual([
      'openBrowser',
      'createTrack',
      'focusArrangement',
    ]);
  });

  it('persists beginner progress in local storage', () => {
    saveWubGuideProgress({ ...EMPTY_USER_PROGRESS, savedProject: true });

    expect(loadWubGuideProgress().savedProject).toBe(true);
    expect(localStorage.getItem(WUB_GUIDE_PROGRESS_STORAGE_KEY)).toContain('savedProject');
  });

  it('derives context-aware next step from project and progress', () => {
    const empty = createEmptyProject('test-project', 'Test Project');
    expect(createWubGuideContext(empty, EMPTY_USER_PROGRESS).nextSuggestion.body).toBe(
      'Wanna import your first sample?'
    );

    const withAudio = {
      ...empty,
      audioAssets: [
        {
          id: 'asset-1',
          name: 'Kick',
          fileName: 'kick.wav',
          mimeType: 'audio/wav',
          durationSeconds: 1,
          sampleRate: 44100,
          channels: 1,
          waveformPeaks: [],
          byteLength: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    expect(createWubGuideContext(withAudio, EMPTY_USER_PROGRESS).nextSuggestion.title).toBe(
      'Next: Create Track'
    );
  });

  it('renders Producer Mode after switching modes', async () => {
    useWubGuide.getState().openAssistant();
    render(<WubGuidePanel />);

    const user = (userEvent as any).setup();
    await user.click(screen.getByRole('button', { name: /Switch to Producer Mode/i }));

    expect(screen.getByLabelText('Producer Mode')).toBeInTheDocument();
    expect(screen.getByText('Project-aware coaching. No raw audio analysis yet.')).toBeInTheDocument();
  });

  it('shows project summary in Producer Mode', async () => {
    useWubGuide.getState().openAssistant();
    useWubGuide.getState().setGuideMode('producer');
    render(<WubGuidePanel />);

    expect(screen.getByLabelText('Project summary')).toBeInTheDocument();
    expect(screen.getByText('BPM')).toBeInTheDocument();
    expect(screen.getByText('Tracks')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('MIDI')).toBeInTheDocument();
  });

  it('produces deterministic suggestions for an empty project', () => {
    const project = createEmptyProject('empty', 'Empty');
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);

    expect(analysis.suggestions.map((suggestion) => suggestion.id)).toContain('start-with-loop');
    expect(analysis.suggestions.map((suggestion) => suggestion.id)).toContain('save-before-experimenting');
  });

  it('updates producer suggestions for MIDI and audio clip combinations', () => {
    const base = createEmptyProject('clips', 'Clips');
    const midiOnly: WubLabzProject = {
      ...base,
      midiClips: [{
        id: 'midi-1',
        type: 'midi',
        trackId: 'track-1',
        name: 'MIDI Clip',
        startTime: 0,
        endTime: 4,
        clipGain: 1,
        muted: false,
        selected: false,
        notes: [],
      }],
    };
    const audioOnly: WubLabzProject = {
      ...base,
      audioClips: [{
        id: 'audio-1',
        type: 'audio',
        trackId: 'track-1',
        name: 'Audio Clip',
        startTime: 0,
        endTime: 4,
        clipGain: 1,
        muted: false,
        selected: false,
        assetId: 'asset-1',
        sourceOffsetSeconds: 0,
      }],
    };

    expect(analyzeProducerProject(midiOnly, EMPTY_USER_PROGRESS).suggestions.map((s) => s.id)).toContain('layer-audio');
    expect(analyzeProducerProject(audioOnly, EMPTY_USER_PROGRESS).suggestions.map((s) => s.id)).toContain('add-midi');
  });

  it('includes meter-aware clipping guidance in Producer Mode', () => {
    const project = createEmptyProject('clipping', 'Clipping Test');
    const trackId = 'track-1';
    const clippingProject: WubLabzProject = {
      ...project,
      tracks: [{
        id: trackId,
        name: 'Audio 1',
        type: 'audio',
        role: 'music',
        order: 0,
        gain: 1,
        pan: 0,
        mute: false,
        solo: false,
        arm: false,
      }],
      audioClips: [{
        id: 'audio-1',
        type: 'audio',
        trackId,
        name: 'Audio Clip',
        startTime: 0,
        endTime: 4,
        clipGain: 1,
        muted: false,
        selected: false,
        assetId: 'asset-1',
        sourceOffsetSeconds: 0,
      }],
      mixerState: {
        [trackId]: {
          trackId,
          gain: 1,
          pan: 0,
          mute: false,
          solo: false,
          armed: false,
          sendLevels: {},
        },
      },
    };

    const analysis = analyzeProducerProjectWithMeters(
      clippingProject,
      EMPTY_USER_PROGRESS,
      {
        snapshot: {
          timestamp: 0,
          channelIds: [trackId, 'master'],
          levels: {
            [trackId]: { channelId: trackId, peak: 1, rms: 0.8, clipping: true, updatedAt: 0 },
            master: { channelId: 'master', peak: 0.92, rms: 0.76, clipping: false, updatedAt: 0 },
          },
          peakHolds: {
            [trackId]: 1,
            master: 0.92,
          },
        },
        isPlaying: true,
      }
    );

    expect(analysis.suggestions.map((suggestion) => suggestion.id)).toContain('lower-clipping-channels');
  });

  it('answers meter and clipping questions', () => {
    expect(answerWubGuidePrompt('What are meters?').title).toBe('What Are Meters?');
    expect(answerWubGuidePrompt('Why is it red?').title).toBe('What Is Clipping?');
    expect(answerWubGuidePrompt('How loud should it be?').highlightTarget).toBe('mixer');
  });

  it('clicking a Producer Mode suggestion highlights its target', async () => {
    useWubGuide.getState().openAssistant();
    useWubGuide.getState().setGuideMode('producer');
    render(<WubGuidePanel />);

    const user = (userEvent as any).setup();
    const suggestionList = screen.getByLabelText('Producer suggestions');
    await user.click(within(suggestionList).getByRole('button', { name: /Start With a Core Loop/i }));

    expect(useWubGuide.getState().activeGuideTarget).toBe('arrangement');
    expect(useWubGuide.getState().actionFeedback).toBe('I highlighted it for you.');
  });
});
