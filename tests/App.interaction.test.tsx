// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Controller mock ──────────────────────────────────────────────────────────

const controller = {
  initialize: vi.fn(async () => undefined),
  setProject: vi.fn(),
  play: vi.fn(async () => undefined),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setLoop: vi.fn(),
  clearLoop: vi.fn(),
  setBpm: vi.fn(),
  toggleTrackMute: vi.fn(),
  save: vi.fn(async () => undefined),
  load: vi.fn(async () => undefined),
  exportJson: vi.fn(() => '{"id":"wublabz-local"}'),
  importJson: vi.fn((json: string) => JSON.parse(json)),
  exportWav: vi.fn(async () => undefined),
  exportStems: vi.fn(async () => undefined),
  emergencyStop: vi.fn(),
  mapMidi: vi.fn(),
  learnMidi: vi.fn(),
  adapter: { getPosition: vi.fn(() => 0) },
};

let WubLabzStudioControllerMock: any;

vi.mock('../src/lib/studio/WubLabzStudioController.js', () => ({
  WubLabzStudioController: class {
    initialize = controller.initialize;
    setProject = controller.setProject;
    play = controller.play;
    pause = controller.pause;
    stop = controller.stop;
    seek = controller.seek;
    setLoop = controller.setLoop;
    clearLoop = controller.clearLoop;
    setBpm = controller.setBpm;
    toggleTrackMute = controller.toggleTrackMute;
    save = controller.save;
    load = controller.load;
    exportJson = controller.exportJson;
    importJson = controller.importJson;
    exportWav = controller.exportWav;
    exportStems = controller.exportStems;
    emergencyStop = controller.emergencyStop;
    mapMidi = controller.mapMidi;
    learnMidi = controller.learnMidi;
    adapter = controller.adapter;
    constructor() {
      WubLabzStudioControllerMock = this;
    }
  }
}));

vi.mock('../src/wubpad-integration/WubPad.js', () => ({
  WubPad: () => React.createElement('div', { role: 'region', 'aria-label': 'WubPad surface' }, 'WubPad mock')
}));

vi.mock('../src/wubpad-integration/EngineMonitor.js', () => ({
  EngineMonitor: () => React.createElement('div', { role: 'region', 'aria-label': 'Engine monitor' }, 'Engine mock')
}));

vi.mock('../src/lib/audio/audioImportService.js', () => ({
  importAudioFile: vi.fn(async () => ({
    asset: {
      id: 'asset-1',
      name: 'Imported',
      fileName: 'imported.wav',
      mimeType: 'audio/wav',
      durationSeconds: 1,
      sampleRate: 44100,
      channels: 1,
      waveformPeaks: [0, 1],
      byteLength: 4,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    buffer: null
  }))
}));

vi.mock('../src/lib/midi/webMidiBridge.js', () => ({
  probeMidiDevices: vi.fn(async () => ({ available: true, inputs: ['Pad 1'], outputs: ['Out 1'] }))
}));

vi.mock('../src/lib/project/projectTimeline.js', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/project/projectTimeline.js')>(
    '../src/lib/project/projectTimeline.js'
  );
  return {
    ...actual,
    projectToTimelineEvents: vi.fn((project: { audioClips: unknown[]; midiClips: unknown[]; automationLanes: unknown[] }) => [
      ...project.audioClips.map((_, i) => ({ id: `audio-${i}`, type: 'stem_clip', startTime: i, endTime: i + 1 })),
    ])
  };
});

vi.mock('tone', () => ({
  start: async () => undefined,
  now: () => 0,
  Transport: {
    bpm: { value: 120 },
    seconds: 0,
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    cancel: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn()
  },
  Player: class {},
  ToneAudioBuffer: { fromUrl: async () => ({ duration: 1 }) }
}));

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('AudioContext', class {
    async decodeAudioData() {
      return {
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 1,
        getChannelData: () => Float32Array.from([0, 1, 0])
      };
    }
  } as any);
  vi.stubGlobal('FileReader', class {
    result: ArrayBuffer | string | null = null;
    onload: ((event: any) => void) | null = null;
    readAsArrayBuffer() {
      this.result = new ArrayBuffer(0);
      this.onload?.({ target: this });
    }
  } as any);
  vi.stubGlobal('indexedDB', {
    open: () => ({
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      result: {
        createObjectStore: vi.fn(),
        transaction: () => ({
          objectStore: () => ({
            put: () => ({ onsuccess: null, onerror: null }),
            get: () => ({ onsuccess: null, onerror: null, result: undefined }),
            getAll: () => ({ onsuccess: null, onerror: null, result: [] }),
            delete: () => ({ onsuccess: null, onerror: null })
          })
        })
      }
    })
  } as any);
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  const { useWubGuide } = await import('../src/ui/assistant/useWubGuide.js');
  useWubGuide.setState({
    beginnerModeEnabled: false,
    assistantOpen: false,
    activeGuideTarget: null,
    guideFloatingLabel: null,
    tutorialActive: false,
    tutorialStepIndex: 0,
    actionFeedback: null,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function renderApp() {
  const { default: App } = await import('../src/App.js');
  return render(<App />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('App interaction', () => {

  it('renders the studio surface and key panels without crashing', async () => {
    await renderApp();

    // TransportBar logo and nav tab button are rendered
    expect(await screen.findByText('WubLabz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WubLabz Studio/ })).toBeInTheDocument();

    // Transport controls are present
    expect(screen.getByTitle(/Play/)).toBeInTheDocument();
    expect(screen.getByTitle(/Stop/)).toBeInTheDocument();
    expect(screen.getByTitle(/Emergency stop all audio/)).toBeInTheDocument();

    // Mixer panel heading is present (may appear in button + panel)
    expect(screen.getAllByText('Mixer').length).toBeGreaterThan(0);

    // Browser panel heading is present
    expect(screen.getAllByText('Browser').length).toBeGreaterThan(0);
  }, 20000);

  it('renders transport controls and routes through the controller mock', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    // Play button exists and triggers controller.play
    const playBtn = screen.getByTitle(/^Play$/);
    await user.click(playBtn);
    expect(controller.play).toHaveBeenCalledTimes(1);

    // After play, button becomes Pause
    const pauseBtn = screen.getByTitle(/^Pause$/);
    await user.click(pauseBtn);
    expect(controller.pause).toHaveBeenCalledTimes(1);

    // Stop
    const stopBtn = screen.getByTitle(/^Stop$/);
    await user.click(stopBtn);
    expect(controller.stop).toHaveBeenCalledTimes(1);

    // Emergency stop
    const emergencyBtn = screen.getByTitle(/Emergency stop all audio/);
    await user.click(emergencyBtn);
    expect(controller.emergencyStop).toHaveBeenCalledTimes(1);
  }, 10000);

  it('renders Beginner Mode toggle and opens WubGuide assistant', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    const beginnerToggle = screen.getByRole('button', { name: /Beginner Mode Off/i });
    expect(beginnerToggle).toBeInTheDocument();

    await user.click(beginnerToggle);

    expect(screen.getByRole('button', { name: /Beginner Mode On/i })).toBeInTheDocument();
    expect(screen.getByLabelText('WubGuide AI assistant')).toBeInTheDocument();
    expect(screen.getByText(/Local beginner guide/i)).toBeInTheDocument();
  }, 10000);

  it('switches views without throwing and renders mocked surfaces', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    await user.click(screen.getByRole('button', { name: /^WubPad$/ }));
    expect(await screen.findByRole('region', { name: 'WubPad surface' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Engine$/ }));
    expect(await screen.findByRole('region', { name: 'Engine monitor' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /WubLabz Studio/ }));
    // Back to studio: transport bar is visible
    expect(await screen.findByTitle(/^Play$/)).toBeInTheDocument();
  }, 10000);

  it('initializes controller on mount', async () => {
    await renderApp();
    expect(WubLabzStudioControllerMock).toBeDefined();
    await vi.waitFor(() => {
      expect(controller.initialize).toHaveBeenCalledTimes(1);
    });
  });

  it('BPM input routes through controller.setBpm', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    const bpmInput = screen.getByRole('spinbutton', { name: /BPM/i });
    await user.clear(bpmInput);
    await user.type(bpmInput, '140');
    // Change triggers setBpm via store's setBpm action
    expect(controller.setBpm).toHaveBeenCalled();
  }, 10000);

  it('save and exportWav buttons route through controller', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(controller.save).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Export WAV/ }));
    expect(controller.exportWav).toHaveBeenCalledTimes(1);
  }, 10000);

  it('snap controls are present and functional', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    const snapCheckbox = screen.getByRole('checkbox');
    expect(snapCheckbox).toBeChecked();

    // Uncheck snap
    await user.click(snapCheckbox);
    expect(snapCheckbox).not.toBeChecked();

    // Snap grid select exists
    const snapSelect = screen.getByRole('combobox');
    expect(snapSelect).toBeInTheDocument();
  }, 10000);

  it('loop toggle shows and hides loop region inputs', async () => {
    await renderApp();
    const user = (userEvent as any).setup();

    // Loop inputs should not be visible initially
    expect(screen.queryByTitle(/Loop start/)).not.toBeInTheDocument();

    // Enable loop
    const loopBtn = screen.getByRole('button', { name: /Loop/ });
    await user.click(loopBtn);
    expect(controller.setLoop).toHaveBeenCalled();

    // Loop inputs appear
    expect(screen.getByTitle(/Loop start/)).toBeInTheDocument();
    expect(screen.getByTitle(/Loop end/)).toBeInTheDocument();

    // Disable loop
    await user.click(loopBtn);
    expect(controller.clearLoop).toHaveBeenCalled();
  }, 10000);
});
