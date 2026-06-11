import React, { Component, type ErrorInfo, type ReactNode, useEffect, useRef } from 'react';
import { useStudioStore } from './state/useStudioStore.js';
import { TransportBar } from './ui/transport/TransportBar.js';
import { ArrangementView } from './ui/playlist/ArrangementView.js';
import { PianoRoll } from './ui/pianoRoll/PianoRoll.js';
import { MixerPanel } from './ui/mixer/MixerPanel.js';
import { AssetBrowser } from './ui/browser/AssetBrowser.js';
import { WubPad } from './wubpad-integration/WubPad.js';
import { EngineMonitor } from './wubpad-integration/EngineMonitor.js';

type AppView = 'studio' | 'pad' | 'engine';

// ─── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<
  { children: ReactNode; boundaryKey: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prevProps: { boundaryKey: string }) {
    if (prevProps.boundaryKey !== this.props.boundaryKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WubLabz] Uncaught error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          className="p-4 font-mono text-xs"
          style={{ color: 'var(--color-daw-red)', background: '#1a0000' }}
        >
          <div className="font-bold mb-1">Error</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function App() {
  const { initialize, isPlaying, tickPlayhead, pianoRollClipId, openPianoRoll, showMixer, showBrowser } =
    useStudioStore();

  const viewRef = useRef<AppView>('studio');
  const [view, setViewState] = React.useState<AppView>('studio');
  const rafRef = useRef<number>(0);

  function setView(v: AppView) {
    viewRef.current = v;
    setViewState(v);
  }

  // Initialize engine once on mount
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // RAF loop for playhead — only runs while playing
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    function tick() {
      tickPlayhead();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tickPlayhead]);

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
    >
      {/* Top nav: app view switcher */}
      <div
        className="flex items-center gap-1 px-2 h-7 shrink-0"
        style={{
          background: 'var(--color-daw-bg)',
          borderBottom: '1px solid var(--color-daw-border)',
        }}
      >
        {(['studio', 'pad', 'engine'] as AppView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 h-5 rounded text-xs capitalize hover:opacity-80"
            style={{
              background: view === v ? 'var(--color-daw-accent-dim)' : 'transparent',
              color: view === v ? '#fff' : 'var(--color-daw-text-dim)',
            }}
          >
            {v === 'studio' ? 'WubLabz Studio' : v === 'pad' ? 'WubPad' : 'Engine'}
          </button>
        ))}
      </div>

      {view === 'studio' ? (
        <StudioLayout
          pianoRollClipId={pianoRollClipId}
          showMixer={showMixer}
          showBrowser={showBrowser}
          onClosePianoRoll={() => openPianoRoll(null)}
        />
      ) : (
        <ErrorBoundary boundaryKey={view}>
          <div className="flex-1 overflow-auto">
            {view === 'pad' ? <WubPad /> : <EngineMonitor />}
          </div>
        </ErrorBoundary>
      )}
    </div>
  );
}

// ─── Studio layout ────────────────────────────────────────────────────────────

function StudioLayout({
  pianoRollClipId,
  showMixer,
  showBrowser,
  onClosePianoRoll,
}: {
  pianoRollClipId: string | null;
  showMixer: boolean;
  showBrowser: boolean;
  onClosePianoRoll: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Transport */}
      <TransportBar />

      {/* Body: browser + arrangement */}
      <div className="flex flex-1 overflow-hidden">
        {showBrowser && (
          <ErrorBoundary boundaryKey="browser">
            <AssetBrowser />
          </ErrorBoundary>
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Arrangement view */}
          <ErrorBoundary boundaryKey="arrangement">
            <ArrangementView />
          </ErrorBoundary>

          {/* Piano Roll (docked below arrangement when open) */}
          {pianoRollClipId && (
            <ErrorBoundary boundaryKey={`piano-${pianoRollClipId}`}>
              <PianoRoll onClose={onClosePianoRoll} />
            </ErrorBoundary>
          )}

          {/* Mixer (docked at bottom) */}
          {showMixer && (
            <ErrorBoundary boundaryKey="mixer">
              <MixerPanel />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
