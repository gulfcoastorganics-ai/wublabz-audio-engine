import React, { useCallback, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';

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
  const tick = Math.floor(((totalBeats % 1) * 960) / 1);
  return `${bar}:${beat}:${String(Math.floor(tick / 96)).padStart(2, '0')}`;
}

/* ─── Style constants ────────────────────────────────────────────────────── */

const S = {
  // Glass transport bar
  bar: {
    background: 'rgba(5, 7, 18, 0.97)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    boxShadow: '0 2px 20px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(139,127,248,0.08)',
  } as React.CSSProperties,

  // Thin divider
  divider: {
    width: 1,
    height: 20,
    background: 'rgba(255,255,255,0.07)',
    flexShrink: 0,
    margin: '0 4px',
  } as React.CSSProperties,

  // Ghost button (inactive)
  btnGhost: {
    height: 26,
    padding: '0 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,

  // Ghost button active/toggled-on
  btnGhostActive: {
    height: 26,
    padding: '0 8px',
    background: 'rgba(139,127,248,0.18)',
    border: '1px solid rgba(139,127,248,0.45)',
    borderRadius: 5,
    color: '#c0b8ff',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    boxShadow: '0 0 8px rgba(139,127,248,0.12)',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,

  // Icon-size ghost (square)
  btnIcon: {
    width: 26,
    height: 26,
    padding: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.12s, color 0.12s',
  } as React.CSSProperties,

  // Accent save button
  btnSave: {
    height: 26,
    padding: '0 10px',
    background: 'rgba(139,127,248,0.14)',
    border: '1px solid rgba(139,127,248,0.3)',
    borderRadius: 5,
    color: '#b2a8ff',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.12s, box-shadow 0.12s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // Export blue button
  btnExport: {
    height: 26,
    padding: '0 10px',
    background: 'rgba(91,156,248,0.12)',
    border: '1px solid rgba(91,156,248,0.28)',
    borderRadius: 5,
    color: '#9ab8ff',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.12s',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // Emergency stop
  btnEmergency: {
    height: 26,
    padding: '0 8px',
    background: 'rgba(255,30,30,0.1)',
    border: '1px solid rgba(255,68,68,0.4)',
    borderRadius: 5,
    color: '#ff7777',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  } as React.CSSProperties,

  // Monospace position display
  posDisplay: {
    fontFamily: "'Courier New', 'Fira Mono', monospace",
    fontSize: 12,
    letterSpacing: '0.08em',
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 5,
    padding: '3px 8px',
    color: '#d8dcff',
    userSelect: 'none' as const,
  } as React.CSSProperties,

  posDisplaySub: {
    fontFamily: "'Courier New', 'Fira Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.06em',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 5,
    padding: '3px 7px',
    color: 'rgba(180,185,220,0.7)',
    userSelect: 'none' as const,
  } as React.CSSProperties,

  // Compact number input
  numInput: {
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    color: '#eeeeff',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'right' as const,
    outline: 'none',
    padding: '2px 5px',
    transition: 'border-color 0.12s, box-shadow 0.12s',
  } as React.CSSProperties,

  // Small label
  label: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.28)',
    userSelect: 'none' as const,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  // Compact select
  select: {
    height: 24,
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    outline: 'none',
    cursor: 'pointer',
    padding: '0 20px 0 7px',
  } as React.CSSProperties,

  // Small loop/snap input
  loopInput: {
    width: 48,
    textAlign: 'center' as const,
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(139,127,248,0.2)',
    borderRadius: 4,
    color: '#c0b8ff',
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
    { label: '1/8', value: 0.125 },
    { label: '1/4', value: 0.25 },
    { label: '1/2', value: 0.5 },
    { label: '1 bar', value: 2 },
  ];

  return (
    <header
      className="flex items-center gap-1.5 px-3 shrink-0 select-none"
      style={{ height: 46, ...S.bar }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: '#a89cff',
          background: 'rgba(139,127,248,0.1)',
          border: '1px solid rgba(139,127,248,0.2)',
          borderRadius: 6,
          padding: '3px 9px',
          marginRight: 4,
          userSelect: 'none',
        }}
      >
        WubLabz
      </div>

      {/* ── Transport ────────────────────────────────────────────────────── */}
      <button onClick={handleRewind} title="Rewind to start" style={S.btnIcon}>
        ⏮
      </button>

      {/* Play / Pause — prominent pill */}
      <button
        onClick={handlePlayPause}
        title={isPlaying ? 'Pause' : 'Play'}
        style={{
          width: 38,
          height: 28,
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          transition: 'box-shadow 0.15s, background 0.15s',
          ...(isPlaying
            ? {
                background: 'linear-gradient(145deg,#f5a623,#d68a0a)',
                color: '#1a0d00',
                boxShadow: '0 2px 12px rgba(245,166,35,0.35)',
              }
            : {
                background: 'linear-gradient(145deg,#22d08a,#15a862)',
                color: '#041408',
                boxShadow: '0 2px 12px rgba(34,208,138,0.3)',
              }),
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        title="Stop"
        style={{
          width: 26,
          height: 26,
          padding: 0,
          background: 'rgba(255,68,68,0.1)',
          border: '1px solid rgba(255,68,68,0.28)',
          borderRadius: 5,
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

      {/* ── BPM ──────────────────────────────────────────────────────────── */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={S.label}>BPM</span>
        <input
          type="number"
          min={20}
          max={999}
          step={1}
          value={project.bpm}
          onChange={handleBpmChange}
          style={{ ...S.numInput, width: 52 }}
        />
      </label>

      {/* Time sig display */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        {project.timeSignature.beatsPerBar}/{project.timeSignature.beatUnit}
      </span>

      <div style={S.divider} />

      {/* ── Loop ─────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleLoop}
        title={loopEnabled ? 'Disable loop' : 'Enable loop'}
        style={loopEnabled ? S.btnGhostActive : S.btnGhost}
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
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
        <span style={{ ...S.label, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
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

      {/* ── Spacer ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Emergency stop ───────────────────────────────────────────────── */}
      <button onClick={emergencyStop} title="Emergency stop all audio" style={S.btnEmergency}>
        ⚡ STOP
      </button>

      <div style={S.divider} />

      {/* ── Save / Export ────────────────────────────────────────────────── */}
      <button onClick={() => void save()} style={S.btnSave}>Save</button>
      <button onClick={() => void exportWav()} style={S.btnExport}>Export WAV</button>

      <div style={S.divider} />

      {/* ── Panel toggles ────────────────────────────────────────────────── */}
      <button
        onClick={toggleBrowser}
        style={showBrowser ? S.btnGhostActive : S.btnGhost}
      >
        Browser
      </button>
      <button
        onClick={toggleMixer}
        style={showMixer ? S.btnGhostActive : S.btnGhost}
      >
        Mixer
      </button>

      {/* ── Status ───────────────────────────────────────────────────────── */}
      {status && (
        <span
          title={status}
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.22)',
            maxWidth: 100,
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
