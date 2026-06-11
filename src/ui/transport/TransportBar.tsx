import React, { useCallback, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import { useWubGuide } from '../assistant/useWubGuide.js';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatBars(seconds: number, bpm: number, beatsPerBar: number): string {
  const totalBeats = (seconds * bpm) / 60;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const tick = Math.floor((totalBeats % 1) * 960);
  return `${bar}:${beat}:${String(Math.floor(tick / 96)).padStart(2, '0')}`;
}

/* ─── Style constants ────────────────────────────────────────────────────── */

const S = {
  bar: (isPlaying: boolean): React.CSSProperties => ({
    background: 'linear-gradient(180deg, rgba(18,22,44,0.82), rgba(7,10,22,0.78))',
    backdropFilter: 'blur(22px) saturate(1.35)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
    borderBottom: isPlaying
      ? '1px solid rgba(139, 127, 248, 0.34)'
      : '1px solid var(--color-border-soft)',
    boxShadow: isPlaying
      ? '0 10px 34px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.07), 0 1px 20px rgba(139,127,248,0.18)'
      : '0 10px 34px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.055)',
    transition: 'border-color 0.3s, box-shadow 0.3s',
  }),

  divider: {
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.07)',
    flexShrink: 0,
    margin: '0 4px',
  } as React.CSSProperties,

  btnGhost: {
    height: 26,
    padding: '0 10px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))',
    border: '1px solid var(--color-border-soft)',
    borderRadius: 8,
    color: 'rgba(206,208,234,0.58)',
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,

  btnGhostActive: {
    height: 26,
    padding: '0 10px',
    background: 'linear-gradient(135deg, rgba(139,127,248,0.24), rgba(91,156,248,0.12))',
    border: '1px solid rgba(139,127,248,0.52)',
    borderRadius: 8,
    color: 'var(--color-text-bright)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    boxShadow: '0 0 0 1px rgba(139,127,248,0.18), 0 0 18px rgba(139,127,248,0.22)',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,

  btnIcon: {
    width: 28,
    height: 28,
    padding: 0,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
    border: '1px solid var(--color-border-soft)',
    borderRadius: 8,
    color: 'rgba(206,208,234,0.62)',
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, color 0.12s',
  } as React.CSSProperties,

  btnSave: {
    height: 26,
    padding: '0 12px',
    background: 'linear-gradient(135deg, rgba(139,127,248,0.22), rgba(91,156,248,0.12))',
    border: '1px solid rgba(139,127,248,0.42)',
    borderRadius: 8,
    color: 'var(--color-text-bright)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.12s, box-shadow 0.12s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  btnExport: {
    height: 26,
    padding: '0 12px',
    background: 'linear-gradient(135deg, rgba(91,156,248,0.18), rgba(139,127,248,0.1))',
    border: '1px solid rgba(91,156,248,0.34)',
    borderRadius: 8,
    color: '#b7d2ff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.12s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  btnEmergency: {
    height: 26,
    padding: '0 10px',
    background: 'rgba(255,30,30,0.1)',
    border: '1px solid rgba(255,68,68,0.4)',
    borderRadius: 8,
    color: '#ff7777',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  } as React.CSSProperties,

  posDisplay: {
    fontFamily: "'Courier New', 'Fira Mono', monospace",
    fontSize: 13,
    letterSpacing: '0.09em',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.62), rgba(8,12,26,0.72))',
    border: '1px solid rgba(255,255,255,0.085)',
    borderRadius: 8,
    padding: '3px 9px',
    color: '#e0e4ff',
    userSelect: 'none' as const,
  } as React.CSSProperties,

  posDisplaySub: {
    fontFamily: "'Courier New', 'Fira Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.06em',
    background: 'rgba(0,0,0,0.36)',
    border: '1px solid rgba(255,255,255,0.055)',
    borderRadius: 8,
    padding: '3px 8px',
    color: 'rgba(180,188,228,0.65)',
    userSelect: 'none' as const,
  } as React.CSSProperties,

  numInput: (isPlaying: boolean): React.CSSProperties => ({
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    color: '#eeeeff',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'right' as const,
    outline: 'none',
    padding: '2px 6px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: isPlaying ? '0 0 12px rgba(139,127,248,0.32)' : 'none',
  }),

  label: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.06em',
    color: 'rgba(206,208,234,0.42)',
    userSelect: 'none' as const,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  select: {
    height: 26,
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: 'rgba(206,208,234,0.72)',
    fontSize: 11,
    outline: 'none',
    cursor: 'pointer',
    padding: '0 20px 0 8px',
  } as React.CSSProperties,

  loopInput: {
    width: 50,
    textAlign: 'center' as const,
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(139,127,248,0.28)',
    borderRadius: 7,
    color: '#c8c3ff',
    fontSize: 11,
    padding: '2px 4px',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties,
} as const;

export function TransportBar() {
  const {
    project,
    isPlaying,
    position,
    loopEnabled,
    loopStart,
    loopEnd,
    snapEnabled,
    snapGrid,
    showMixer,
    showBrowser,
    status,
    play,
    pause,
    stop,
    seek,
    setBpm,
    setLoop,
    toggleLoop,
    emergencyStop,
    setSnapEnabled,
    setSnapGrid,
    toggleMixer,
    toggleBrowser,
    save,
    exportWav,
  } = useStudioStore();
  const { beginnerModeEnabled, askGuide } = useWubGuide();

  const loopStartRef = useRef(String(loopStart));
  const loopEndRef = useRef(String(loopEnd));

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else void play();
  }, [isPlaying, play, pause]);

  const handleStop = useCallback(() => stop(), [stop]);
  const handleRewind = useCallback(() => seek(0), [seek]);

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (v > 0) setBpm(v);
    },
    [setBpm]
  );

  const applyLoop = useCallback(() => {
    const start = parseFloat(loopStartRef.current) || 0;
    const end = parseFloat(loopEndRef.current) || 4;
    setLoop(start, end);
  }, [setLoop]);

  const SNAP_OPTIONS: { label: string; value: number }[] = [
    { label: '1/8',   value: 0.125 },
    { label: '1/4',   value: 0.25 },
    { label: '1/2',   value: 0.5 },
    { label: '1 bar', value: 2 },
  ];

  return (
    <header
      className="flex items-center gap-1.5 px-3 shrink-0 select-none"
      data-wubguide-target="transport"
      aria-label="Transport controls"
      style={{ height: 50, ...S.bar(isPlaying) }}
    >
      {beginnerModeEnabled && (
        <button
          type="button"
          className="wubguide-helper-label"
          onClick={() => askGuide('What is the transport?')}
          aria-label="Get help with the transport"
          title="Ask WubGuide about the transport"
        >
          ? Transport
        </button>
      )}

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--color-text-bright)',
          background: 'linear-gradient(135deg, rgba(139,127,248,0.24), rgba(91,156,248,0.14))',
          border: '1px solid rgba(139,127,248,0.34)',
          borderRadius: 10,
          padding: '5px 11px',
          marginRight: 4,
          userSelect: 'none',
          boxShadow: '0 0 18px rgba(139,127,248,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        WubLabz
      </div>

      {/* ── Transport ────────────────────────────────────────────────────── */}
      <button onClick={handleRewind} title="Rewind to start" style={S.btnIcon}>
        ⏮
      </button>

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
        data-wubguide-target="play-button"
        style={{
          width: 42,
          height: 30,
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700,
          transition: 'box-shadow 0.18s, background 0.18s',
          ...(isPlaying
            ? {
                background: 'linear-gradient(145deg, #f5a623, #d68a0a)',
                color: '#1a0d00',
                boxShadow: '0 2px 18px rgba(245,166,35,0.46), inset 0 1px 0 rgba(255,255,255,0.28)',
              }
            : {
                background: 'linear-gradient(145deg, #22d08a, #15a862)',
                color: '#041408',
                boxShadow: '0 2px 18px rgba(34,208,138,0.38), inset 0 1px 0 rgba(255,255,255,0.25)',
              }),
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        title="Stop"
        aria-label="Stop playback"
        style={{
          width: 28,
          height: 28,
          padding: 0,
          background: 'rgba(255,68,68,0.1)',
          border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: 6,
          color: '#ff8888',
          fontSize: 11,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.12s',
        }}
      >
        ■
      </button>

      {/* ── Position ─────────────────────────────────────────────────────── */}
      <div style={S.posDisplay}>{formatTime(position)}</div>
      <div style={S.posDisplaySub}>
        {formatBars(position, project.bpm, project.timeSignature.beatsPerBar)}
      </div>

      <div style={S.divider} />

      {/* ── BPM — glows while playing ─────────────────────────────────────── */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={S.label}>BPM</span>
        <input
          type="number"
          min={20}
          max={999}
          step={1}
          value={project.bpm}
          onChange={handleBpmChange}
          style={{ ...S.numInput(isPlaying), width: 54 }}
          data-wubguide-target="bpm"
          aria-label="BPM"
          title={beginnerModeEnabled ? 'Tempo in beats per minute' : 'BPM'}
        />
      </label>

      {/* Time sig */}
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: 'rgba(255,255,255,0.22)',
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}>
        {project.timeSignature.beatsPerBar}/{project.timeSignature.beatUnit}
      </span>

      <div style={S.divider} />

      {/* ── Loop ─────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleLoop}
        title={loopEnabled ? 'Disable loop' : 'Enable loop'}
        style={loopEnabled ? S.btnGhostActive : S.btnGhost}
        data-wubguide-target="loop"
        aria-label="Loop"
      >
        ↺ Loop
      </button>

      {loopEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            min={0}
            step={0.5}
            defaultValue={loopStart}
            onChange={(e) => { loopStartRef.current = e.target.value; }}
            onBlur={applyLoop}
            style={S.loopInput}
            title="Loop start (seconds)"
          />
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>—</span>
          <input
            type="number"
            min={0}
            step={0.5}
            defaultValue={loopEnd}
            onChange={(e) => { loopEndRef.current = e.target.value; }}
            onBlur={applyLoop}
            style={S.loopInput}
            title="Loop end (seconds)"
          />
        </div>
      )}

      <div style={S.divider} />

      {/* ── Snap ─────────────────────────────────────────────────────────── */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }} data-wubguide-target="snap">
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
          aria-label="Enable snap"
          title={beginnerModeEnabled ? 'Snap edits to the timing grid' : 'Snap'}
        />
        <span style={{
          fontSize: 12,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.38)',
          userSelect: 'none',
        }}>
          Snap
        </span>
      </label>
      <select
        value={snapGrid}
        onChange={(e) => setSnapGrid(Number(e.target.value))}
        style={S.select}
      >
        {SNAP_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div style={{ flex: 1 }} />

      {/* ── Emergency stop ───────────────────────────────────────────────── */}
      <button onClick={emergencyStop} title="Emergency stop all audio" style={S.btnEmergency}>
        ⚡ STOP
      </button>

      <div style={S.divider} />

      {/* ── Save / Export ────────────────────────────────────────────────── */}
      <button
        onClick={() => void save()}
        style={S.btnSave}
        data-wubguide-target="save"
        aria-label="Save"
        title={beginnerModeEnabled ? 'Save the project locally' : 'Save'}
      >
        Save
      </button>
      <button
        onClick={() => void exportWav()}
        style={S.btnExport}
        data-wubguide-target="export"
        aria-label="Export WAV"
        title={beginnerModeEnabled ? 'Render the project to a WAV file' : 'Export WAV'}
      >
        Export WAV
      </button>

      <div style={S.divider} />

      {/* ── Panel toggles ────────────────────────────────────────────────── */}
      <button onClick={toggleBrowser} style={showBrowser ? S.btnGhostActive : S.btnGhost}>
        Browser
      </button>
      <button onClick={toggleMixer} style={showMixer ? S.btnGhostActive : S.btnGhost}>
        Mixer
      </button>

      {/* ── Status ───────────────────────────────────────────────────────── */}
      {status && (
        <span
          title={status}
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.2)',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
            paddingLeft: 4,
          }}
        >
          {status}
        </span>
      )}
    </header>
  );
}
