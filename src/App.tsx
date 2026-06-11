import React, { Component, type ErrorInfo, type ReactNode, useEffect, useRef } from 'react';
import { useStudioStore } from './state/useStudioStore.js';
import { TransportBar } from './ui/transport/TransportBar.js';
import { ArrangementView } from './ui/playlist/ArrangementView.js';
import { PianoRoll } from './ui/pianoRoll/PianoRoll.js';
import { MixerPanel } from './ui/mixer/MixerPanel.js';
import { AssetBrowser } from './ui/browser/AssetBrowser.js';
import { WubPad } from './wubpad-integration/WubPad.js';
import { EngineMonitor } from './wubpad-integration/EngineMonitor.js';
import { WubGuidePanel } from './ui/assistant/WubGuidePanel.js';
import { useWubGuide } from './ui/assistant/useWubGuide.js';

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
  const { beginnerModeEnabled, toggleBeginnerMode, openAssistant } = useWubGuide();

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
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 12% 0%, rgba(91,156,248,0.14), transparent 32%), radial-gradient(circle at 88% 8%, rgba(139,127,248,0.12), transparent 34%), var(--color-bg-main)',
      }}
    >
      {/* Top nav: app view switcher */}
      <div
        className="flex items-center gap-0.5 px-2 shrink-0"
        style={{
          height: 30,
          background: 'linear-gradient(180deg, rgba(12,16,34,0.96), rgba(5,7,16,0.94))',
          borderBottom: '1px solid var(--color-border-soft)',
          boxShadow: '0 1px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {(['studio', 'pad', 'engine'] as AppView[]).map((v) => {
          const active = view === v;
          return (
          <button
              key={v}
              onClick={() => setView(v)}
              style={{
                height: 22,
                padding: '0 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.045em',
                border: active ? '1px solid rgba(139,127,248,0.45)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s, box-shadow 0.12s',
                background: active
                  ? 'linear-gradient(135deg, rgba(139,127,248,0.24), rgba(91,156,248,0.12))'
                  : 'rgba(255,255,255,0.018)',
                color: active ? 'var(--color-text-bright)' : 'rgba(206,208,234,0.42)',
                boxShadow: active ? '0 0 18px rgba(139,127,248,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
              }}
            >
              {v === 'studio' ? 'WubLabz Studio' : v === 'pad' ? 'WubPad' : 'Engine'}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={toggleBeginnerMode}
          aria-label={`Beginner Mode ${beginnerModeEnabled ? 'On' : 'Off'}`}
          title="Toggle Beginner Mode"
          style={{
            height: 22,
            padding: '0 12px',
            borderRadius: 999,
            border: beginnerModeEnabled
              ? '1px solid rgba(139,127,248,0.58)'
              : '1px solid rgba(255,255,255,0.08)',
            background: beginnerModeEnabled
              ? 'linear-gradient(135deg, rgba(139,127,248,0.28), rgba(91,156,248,0.14))'
              : 'rgba(255,255,255,0.025)',
            color: beginnerModeEnabled ? 'var(--color-text-bright)' : 'rgba(206,208,234,0.54)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            boxShadow: beginnerModeEnabled ? '0 0 18px rgba(139,127,248,0.2)' : 'none',
          }}
        >
          Beginner Mode: {beginnerModeEnabled ? 'On' : 'Off'}
        </button>

        <button
          type="button"
          onClick={openAssistant}
          aria-label="Open WubGuide AI"
          title="Open WubGuide AI"
          style={{
            height: 22,
            padding: '0 10px',
            borderRadius: 999,
            border: '1px solid rgba(91,156,248,0.28)',
            background: 'rgba(91,156,248,0.075)',
            color: '#b7d2ff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          WubGuide AI
        </button>
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

      <WubGuideHighlighter />
      <WubGuidePanel />
    </div>
  );
}

function WubGuideHighlighter() {
  const { beginnerModeEnabled, activeGuideTarget, guideFloatingLabel } = useWubGuide();
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  useEffect(() => {
    const highlighted = Array.from(document.querySelectorAll('.wubguide-highlight'));
    highlighted.forEach((el) => el.classList.remove('wubguide-highlight'));

    if (!beginnerModeEnabled || !activeGuideTarget) {
      setRect(null);
      return;
    }

    const selector = `[data-wubguide-target="${activeGuideTarget}"]`;
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      setRect(null);
      return;
    }

    const guideTarget = target;
    guideTarget.classList.add('wubguide-highlight');
    guideTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });

    function syncRect() {
      setRect(guideTarget.getBoundingClientRect());
    }

    syncRect();
    window.addEventListener('resize', syncRect);
    window.addEventListener('scroll', syncRect, true);
    return () => {
      guideTarget.classList.remove('wubguide-highlight');
      window.removeEventListener('resize', syncRect);
      window.removeEventListener('scroll', syncRect, true);
    };
  }, [activeGuideTarget, beginnerModeEnabled]);

  if (!beginnerModeEnabled || !rect || !guideFloatingLabel) return null;

  return (
    <div
      className="wubguide-floating-label"
      role="status"
      style={{
        left: Math.min(window.innerWidth - 260, Math.max(12, rect.left + 8)),
        top: Math.min(window.innerHeight - 72, Math.max(42, rect.top - 36)),
      }}
    >
      {guideFloatingLabel}
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
    <div className="flex flex-col flex-1 overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
      {/* Transport */}
      <TransportBar />

      {/* Body: floating panels with gaps */}
      <div className="flex flex-1 overflow-hidden" style={{ gap: 8, padding: '8px', minHeight: 0 }}>
        {showBrowser && (
          <ErrorBoundary boundaryKey="browser">
            <AssetBrowser />
          </ErrorBoundary>
        )}

        <div className="flex flex-col flex-1 overflow-hidden" style={{ gap: 8 }}>
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
