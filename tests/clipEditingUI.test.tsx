// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useStudioStore, studioController } from '../src/state/useStudioStore.js';
import { createEmptyProject } from '../src/lib/project/projectTimeline.js';
import type { AudioClip, Track, WubLabzProject } from '../src/lib/project/projectSchema.js';

// Prevent Tone.js scheduling from running during UI tests
vi.spyOn(studioController, 'setProject').mockImplementation(() => {});

function makeTrack(id = 'track-1'): Track {
  return {
    id, name: 'Audio 1', type: 'audio', role: 'music',
    order: 0, gain: 1, pan: 0, mute: false, solo: false, arm: false, color: '#6c63ff',
  };
}

function makeAudioClip(id = 'clip-1', overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id, type: 'audio', trackId: 'track-1', name: 'Test Clip',
    startTime: 0, endTime: 4, clipGain: 1, muted: false, selected: false,
    assetId: 'asset-1', sourceOffsetSeconds: 0, ...overrides,
  };
}

function makeProjectWithClip(clipOverrides: Partial<AudioClip> = {}): WubLabzProject {
  const base = createEmptyProject('test', 'Test');
  return {
    ...base,
    tracks: [makeTrack()],
    audioClips: [makeAudioClip('clip-1', clipOverrides)],
  };
}

beforeEach(() => {
  useStudioStore.setState({
    project: makeProjectWithClip(),
    selectedClipId: null,
    zoom: 80,
    scrollLeft: 0,
    snapEnabled: false,
    position: 2,
  });
});

afterEach(() => {
  cleanup();
  useStudioStore.setState({
    project: createEmptyProject('reset', 'Reset'),
    selectedClipId: null,
  });
});

// ─── Context menu ─────────────────────────────────────────────────────────────

describe('ClipContextMenu clip editing actions', () => {
  it('renders Normalize, Reverse, Fade In, Fade Out, Reset Edits for audio clips', async () => {
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const clip = screen.getByLabelText('audio clip Test Clip');
    fireEvent.contextMenu(clip);

    expect(screen.getByText('Normalize Clip')).toBeInTheDocument();
    expect(screen.getByText('Reverse Clip')).toBeInTheDocument();
    expect(screen.getByText('Add Fade In')).toBeInTheDocument();
    expect(screen.getByText('Add Fade Out')).toBeInTheDocument();
    expect(screen.getByText('Reset Edits')).toBeInTheDocument();
  });

  it('applies normalize via context menu', async () => {
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const clip = screen.getByLabelText('audio clip Test Clip');
    fireEvent.contextMenu(clip);
    fireEvent.click(screen.getByText('Normalize Clip'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.normalized).toBe(true);
  });

  it('applies fade in via context menu', async () => {
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const clip = screen.getByLabelText('audio clip Test Clip');
    fireEvent.contextMenu(clip);
    fireEvent.click(screen.getByText('Add Fade In'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.fadeInSeconds).toBeGreaterThan(0);
  });

  it('applies fade out via context menu', async () => {
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const clip = screen.getByLabelText('audio clip Test Clip');
    fireEvent.contextMenu(clip);
    fireEvent.click(screen.getByText('Add Fade Out'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.fadeOutSeconds).toBeGreaterThan(0);
  });

  it('resets edits via context menu', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { gain: 2, reverse: true, fadeInSeconds: 0.1 } }),
    });

    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const clip = screen.getByLabelText('audio clip Test Clip');
    fireEvent.contextMenu(clip);
    fireEvent.click(screen.getByText('Reset Edits'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit).toBeUndefined();
  });
});

// ─── Clip Inspector ───────────────────────────────────────────────────────────

describe('ClipInspector', () => {
  it('shows inspector when an audio clip is selected', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ selected: true }),
      selectedClipId: 'clip-1',
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    const inspector = screen.getByLabelText('Clip inspector');
    expect(inspector).toBeInTheDocument();
    // Inspector shows clip name — use within to scope to the inspector element
    const { within: withinEl } = await import('@testing-library/react');
    expect(withinEl(inspector).getByText('Test Clip')).toBeInTheDocument();
  });

  it('does not show inspector when no clip is selected', async () => {
    useStudioStore.setState({ selectedClipId: null });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.queryByLabelText('Clip inspector')).not.toBeInTheDocument();
  });

  it('updates gain via inspector input', async () => {
    useStudioStore.setState({ selectedClipId: 'clip-1' });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    const { fireEvent } = await import('@testing-library/react');
    render(<ArrangementView />);

    const gainInput = screen.getByLabelText('Gain');
    fireEvent.change(gainInput, { target: { value: '1.5' } });

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.gain).toBeCloseTo(1.5, 1);
  });

  it('toggles reverse via inspector toggle', async () => {
    useStudioStore.setState({ selectedClipId: 'clip-1' });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    const user = (userEvent as any).setup();
    await user.click(screen.getByLabelText('Reverse'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.reverse).toBe(true);
  });

  it('toggles normalize via inspector toggle', async () => {
    useStudioStore.setState({ selectedClipId: 'clip-1' });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    const user = (userEvent as any).setup();
    await user.click(screen.getByLabelText('Normalize'));

    const updated = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(updated?.edit?.normalized).toBe(true);
  });
});

// ─── Visual badges ────────────────────────────────────────────────────────────

describe('ClipBlock visual badges', () => {
  it('renders REV badge when reverse is active', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { reverse: true } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.getByText('REV')).toBeInTheDocument();
  });

  it('renders NRM badge when normalized is active', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { normalized: true } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.getByText('NRM')).toBeInTheDocument();
  });

  it('renders gain badge when gain differs from 1.0', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { gain: 1.5 } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.getByText('G1.50')).toBeInTheDocument();
  });

  it('does not render gain badge when gain is 1.0', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { gain: 1.0 } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.queryByText(/^G\d/)).not.toBeInTheDocument();
  });

  it('renders fade-in overlay when fadeInSeconds is set', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { fadeInSeconds: 0.5 } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.getByTestId('fade-in-overlay')).toBeInTheDocument();
  });

  it('renders fade-out overlay when fadeOutSeconds is set', async () => {
    useStudioStore.setState({
      project: makeProjectWithClip({ edit: { fadeOutSeconds: 0.5 } }),
    });
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.getByTestId('fade-out-overlay')).toBeInTheDocument();
  });

  it('does not render fade overlays when no fades are set', async () => {
    const { ArrangementView } = await import('../src/ui/playlist/ArrangementView.js');
    render(<ArrangementView />);

    expect(screen.queryByTestId('fade-in-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fade-out-overlay')).not.toBeInTheDocument();
  });
});
