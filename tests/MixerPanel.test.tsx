// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MixerPanel } from '../src/ui/mixer/MixerPanel.js';
import { meterRegistry } from '../src/audio/metering/MeterRegistry.js';
import { createEmptyProject } from '../src/lib/project/projectTimeline.js';
import { useStudioStore } from '../src/state/useStudioStore.js';

describe('MixerPanel', () => {
  beforeEach(() => {
    meterRegistry.reset();
    const trackId = 'track-1';
    const project = {
      ...createEmptyProject('mixer-test', 'Mixer Test'),
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
    useStudioStore.setState({
      project,
      isPlaying: false,
      position: 0,
      showMixer: true,
      showBrowser: true,
      selectedClipId: null,
      pianoRollClipId: null,
    } as any);
  });

  afterEach(() => {
    cleanup();
    meterRegistry.reset();
  });

  it('renders meter wells and a master meter', () => {
    render(<MixerPanel />);

    expect(screen.getByLabelText('Audio 1 level meter')).toBeInTheDocument();
    expect(screen.getByLabelText('Master level meter')).toBeInTheDocument();
  });

  it('shows clipping state when a channel clips', async () => {
    render(<MixerPanel />);
    meterRegistry.updateLevel({
      channelId: 'track-1',
      peak: 1,
      rms: 0.82,
      clipping: true,
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Audio 1 level meter')).toHaveAttribute('data-clipping', 'true');
      expect(screen.getByLabelText('Audio 1 level meter').querySelector('.mixer-meter-clip')).toBeInTheDocument();
    });
  });
});
