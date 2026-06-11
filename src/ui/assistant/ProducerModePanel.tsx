import React, { useMemo } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import { analyzeProducerProject } from './producerModeEngine.js';
import { useWubGuide } from './useWubGuide.js';
import type { ProducerSuggestion } from './producerModeTypes.js';

function formatBars(bars: number): string {
  if (bars === 0) return '0 bars';
  return `${bars.toFixed(bars >= 10 ? 0 : 1)} bars`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function ProducerModePanel() {
  const project = useStudioStore((state) => state.project);
  const { userProgress, setActiveGuideTarget, setActionFeedback } = useWubGuide();
  const analysis = useMemo(
    () => analyzeProducerProject(project, userProgress),
    [project, userProgress]
  );

  function focusSuggestion(suggestion: ProducerSuggestion) {
    if (!suggestion.guideTarget) return;
    setActiveGuideTarget(suggestion.guideTarget, suggestion.title);
    setActionFeedback('I highlighted it for you.');
  }

  return (
    <div className="producer-mode-panel" aria-label="Producer Mode">
      <div className="producer-mode-hero">
        <div>
          <strong>Producer Mode</strong>
          <p>Project-aware coaching. No raw audio analysis yet.</p>
        </div>
        <button type="button" onClick={() => focusSuggestion(analysis.nextBestMove)}>
          Analyze Project
        </button>
      </div>

      <section className="producer-summary-card" aria-label="Project summary">
        <div><span>BPM</span><strong>{analysis.summary.bpm}</strong></div>
        <div><span>Time</span><strong>{analysis.summary.timeSignature}</strong></div>
        <div><span>Tracks</span><strong>{analysis.summary.trackCount}</strong></div>
        <div><span>Audio</span><strong>{analysis.summary.audioClipCount}</strong></div>
        <div><span>MIDI</span><strong>{analysis.summary.midiClipCount}</strong></div>
        <div>
          <span>Length</span>
          <strong>{formatBars(analysis.summary.arrangementBars)} · {formatDuration(analysis.summary.arrangementDurationSeconds)}</strong>
        </div>
      </section>

      <section className="producer-next-card" aria-label="Next Best Move">
        <span>Next Best Move</span>
        <button type="button" onClick={() => focusSuggestion(analysis.nextBestMove)}>
          {analysis.nextBestMove.title}
        </button>
        <p>{analysis.nextBestMove.body}</p>
      </section>

      <section className="producer-suggestion-list" aria-label="Producer suggestions">
        {analysis.suggestions.map((suggestion) => (
          <button
            type="button"
            key={suggestion.id}
            className="producer-suggestion-card"
            data-priority={suggestion.priority}
            onClick={() => focusSuggestion(suggestion)}
          >
            <span>{suggestion.category} · {suggestion.priority}</span>
            <strong>{suggestion.title}</strong>
            <p>{suggestion.body}</p>
            {suggestion.actionLabel && <em>{suggestion.actionLabel}</em>}
          </button>
        ))}
      </section>
    </div>
  );
}
