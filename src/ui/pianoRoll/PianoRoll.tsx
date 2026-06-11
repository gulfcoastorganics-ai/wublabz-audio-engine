import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { MidiClip, MidiNote } from '../../lib/project/projectSchema.js';
import { useWubGuide } from '../assistant/useWubGuide.js';

const KEY_WIDTH = 38;
const NOTE_HEIGHT = 14;
const TOTAL_NOTES = 128;
const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[midi % 12]}${octave}`;
}

function isBlack(midi: number): boolean {
  return BLACK_KEYS.has(midi % 12);
}

function beatsToPixels(beats: number, pxPerBeat: number): number {
  return beats * pxPerBeat;
}

interface DragNote {
  noteId: string;
  type: 'move' | 'resize';
  startBeat: number;
  durationBeats: number;
  startClientX: number;
  startClientY: number;
  startNote: number;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const S = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'linear-gradient(180deg, rgba(10,14,30,0.96), rgba(4,6,14,0.98))',
    borderTop: '1px solid rgba(139,127,248,0.55)',
    borderRadius: 16,
    overflow: 'hidden',
    height: '36vh',
    minHeight: 200,
    maxHeight: 420,
    boxShadow: 'var(--shadow-glass), 0 -4px 24px rgba(139,127,248,0.08)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 38,
    flexShrink: 0,
    background: 'linear-gradient(180deg, rgba(15,19,40,0.94), rgba(7,10,22,0.96))',
    borderBottom: '1px solid rgba(139,127,248,0.12)',
    boxShadow: '0 1px 10px rgba(0,0,0,0.45)',
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-bright)',
    letterSpacing: '0.04em',
    marginRight: 4,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: 18,
    background: 'rgba(255,255,255,0.075)',
    margin: '0 3px',
    flexShrink: 0,
  },
  select: {
    height: 22,
    padding: '0 18px 0 7px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.52), rgba(8,12,26,0.58))',
    border: '1px solid rgba(255,255,255,0.075)',
    borderRadius: 7,
    color: 'var(--color-text-main)',
    fontSize: 11,
    outline: 'none',
  },
  velInput: {
    width: 38,
    height: 22,
    textAlign: 'center' as const,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.52), rgba(8,12,26,0.58))',
    border: '1px solid rgba(255,255,255,0.075)',
    borderRadius: 7,
    color: 'var(--color-text-main)',
    fontSize: 11,
    outline: 'none',
  },
  labelText: {
    fontSize: 10,
    color: 'rgba(206,208,234,0.42)',
    flexShrink: 0,
  },
  closeBtn: {
    height: 22,
    padding: '0 8px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.022))',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7,
    color: 'rgba(206,208,234,0.58)',
    fontSize: 10,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.1s, color 0.1s',
  },
  pianoColumn: {
    width: KEY_WIDTH,
    flexShrink: 0,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    background: 'linear-gradient(180deg, #101426, #080b17)',
    borderRight: '1px solid rgba(255,255,255,0.065)',
  },
  gridArea: {
    flex: 1,
    overflow: 'auto' as const,
    position: 'relative' as const,
  },
  velocityLane: {
    flexShrink: 0,
    overflowX: 'auto' as const,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'linear-gradient(180deg, rgba(5,8,18,0.97), rgba(3,5,12,0.98))',
    paddingLeft: KEY_WIDTH,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 192,
    background: 'linear-gradient(180deg, rgba(8,11,24,0.96), rgba(4,6,14,0.98))',
    color: 'rgba(206,208,234,0.4)',
    fontSize: 12,
    flexDirection: 'column' as const,
    gap: 6,
  },
} as const;

// ─── Tool button ──────────────────────────────────────────────────────────────

function ToolBtn({
  label, active, onClick, title,
}: {
  label: string; active: boolean; onClick: () => void; title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        height: 22,
        padding: '0 9px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
        border: active ? '1px solid rgba(139,127,248,0.52)' : '1px solid rgba(255,255,255,0.075)',
        background: active ? 'linear-gradient(135deg, rgba(139,127,248,0.24), rgba(91,156,248,0.1))' : 'rgba(255,255,255,0.035)',
        color: active ? 'var(--color-text-bright)' : 'rgba(206,208,234,0.42)',
        boxShadow: active ? '0 0 12px rgba(139,127,248,0.22)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PianoRoll({ onClose }: { onClose: () => void }) {
  const { project, pianoRollClipId, addMidiNote, updateMidiNote, deleteMidiNote } = useStudioStore();
  const { beginnerModeEnabled, askGuide, markProgress } = useWubGuide();
  const clip = project.midiClips.find((c) => c.id === pianoRollClipId) as MidiClip | undefined;

  const [pxPerBeat, setPxPerBeat] = useState(40);
  const [tool, setTool] = useState<'pencil' | 'select' | 'erase'>('pencil');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [defaultDuration, setDefaultDuration] = useState(0.5);
  const [defaultVelocity, setDefaultVelocity] = useState(100);
  const noteAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragNote | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    markProgress({ openedPianoRoll: true });
  }, [markProgress]);

  const clipDuration = clip ? clip.endTime - clip.startTime : 8;
  const bpm = project.bpm;
  const totalBeats = Math.max(8, (clipDuration * bpm) / 60 + 8);
  const gridWidth = beatsToPixels(totalBeats, pxPerBeat);
  const gridHeight = TOTAL_NOTES * NOTE_HEIGHT;

  const snapBeat = useCallback(
    (beat: number): number => {
      const grid = defaultDuration;
      return Math.max(0, Math.round(beat / grid) * grid);
    },
    [defaultDuration]
  );

  // ─── Wheel zoom ────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = noteAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setPxPerBeat((p) => Math.max(8, Math.min(200, p * (e.deltaY > 0 ? 0.85 : 1.18))));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ─── Grid interaction ──────────────────────────────────────────────────────

  function handleNoteAreaPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!clip) return;
    const rect = noteAreaRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + noteAreaRef.current!.scrollLeft;
    const y = e.clientY - rect.top + noteAreaRef.current!.scrollTop;
    const beat = snapBeat(x / pxPerBeat);
    const noteNum = TOTAL_NOTES - 1 - Math.floor(y / NOTE_HEIGHT);
    if (tool === 'pencil') {
      addMidiNote(clip.id, {
        id: crypto.randomUUID(),
        note: noteNum,
        velocity: defaultVelocity,
        startBeat: beat,
        durationBeats: defaultDuration,
        channel: 1,
      });
      forceUpdate((n) => n + 1);
    }
  }

  function handleNotePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    note: MidiNote,
    type: 'move' | 'resize'
  ) {
    e.stopPropagation();
    if (tool === 'erase') {
      deleteMidiNote(clip!.id, note.id);
      forceUpdate((n) => n + 1);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      noteId: note.id, type,
      startBeat: note.startBeat, durationBeats: note.durationBeats,
      startClientX: e.clientX, startClientY: e.clientY, startNote: note.note,
    };
    setSelectedNoteId(note.id);
  }

  function handleNoteAreaPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !clip) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const dBeats = dx / pxPerBeat;
    const dNotes = -Math.round(dy / NOTE_HEIGHT);
    if (drag.type === 'move') {
      updateMidiNote(clip.id, drag.noteId, {
        startBeat: snapBeat(Math.max(0, drag.startBeat + dBeats)),
        note: Math.max(0, Math.min(127, drag.startNote + dNotes)),
      });
    } else {
      updateMidiNote(clip.id, drag.noteId, {
        durationBeats: Math.max(0.0625, snapBeat(drag.durationBeats + dBeats) || defaultDuration),
      });
    }
  }

  function handleNoteAreaPointerUp() {
    dragRef.current = null;
  }

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId && clip) {
        deleteMidiNote(clip.id, selectedNoteId);
        setSelectedNoteId(null);
        forceUpdate((n) => n + 1);
      }
      if (e.key === 'p') setTool('pencil');
      if (e.key === 's') setTool('select');
      if (e.key === 'e') setTool('erase');
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, selectedNoteId, clip, deleteMidiNote]);

  // ─── Empty ─────────────────────────────────────────────────────────────────

  if (!clip) {
    return (
      <div style={S.emptyState}>
        <span style={{ fontSize: 22, opacity: 0.2 }}>♩</span>
        No clip selected
      </div>
    );
  }

  // ─── Beat lines ────────────────────────────────────────────────────────────

  const bpb = project.timeSignature.beatsPerBar;
  const beatLines: { x: number; isMajor: boolean }[] = [];
  for (let b = 0; b <= Math.ceil(totalBeats); b++) {
    beatLines.push({ x: b * pxPerBeat, isMajor: b % bpb === 0 });
  }

  return (
    <div style={S.container} data-wubguide-target="piano-roll" aria-label="Piano roll editor">
      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={S.title}>Piano Roll — {clip.name}</span>
        {beginnerModeEnabled && (
          <button
            type="button"
            className="wubguide-section-help"
            onClick={() => askGuide('How do I open the piano roll?')}
            aria-label="Get help with the piano roll"
            title="Ask WubGuide about the piano roll"
          >
            ?
          </button>
        )}

        <ToolBtn label="✏ Pencil" active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Draw notes (P)" />
        <ToolBtn label="↖ Select" active={tool === 'select'} onClick={() => setTool('select')} title="Select notes (S)" />
        <ToolBtn label="✕ Erase"  active={tool === 'erase'}  onClick={() => setTool('erase')}  title="Erase notes (E)" />

        <div style={S.divider} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={S.labelText}>Grid</span>
          <select
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
            style={S.select}
          >
            <option value={0.0625}>1/16</option>
            <option value={0.125}>1/8</option>
            <option value={0.25}>1/4</option>
            <option value={0.5}>1/2</option>
            <option value={1}>1 bar</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={S.labelText}>Vel</span>
          <input
            type="number"
            min={1} max={127}
            value={defaultVelocity}
            onChange={(e) => setDefaultVelocity(Number(e.target.value))}
            style={S.velInput}
          />
        </label>

        <div style={{ flex: 1 }} />

        <button onClick={onClose} style={S.closeBtn} title="Close (Esc)">✕ Close</button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Piano keyboard */}
        <div style={S.pianoColumn}>
          <div style={{ height: gridHeight }}>
            {Array.from({ length: TOTAL_NOTES }, (_, i) => {
              const midi = TOTAL_NOTES - 1 - i;
              const black = isBlack(midi);
              const isC = midi % 12 === 0;
              return (
                <div
                  key={midi}
                  style={{
                    height: NOTE_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 4,
                    background: black
                      ? 'linear-gradient(180deg, #171a2a, #0e111f)'
                      : 'linear-gradient(180deg, #eceefe, #bfc4dd)',
                    borderBottom: `1px solid ${black ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.18)'}`,
                    position: 'relative',
                    boxShadow: isC && !black ? 'inset 0 -1px 0 rgba(139,127,248,0.25)' : undefined,
                  }}
                  title={noteName(midi)}
                >
                  {isC && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: black ? 'rgba(206,208,255,0.46)' : 'rgba(38,42,78,0.68)',
                      letterSpacing: '0.03em',
                    }}>
                      {noteName(midi)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Note grid */}
        <div
          ref={noteAreaRef}
          style={{
            ...S.gridArea,
            cursor: tool === 'pencil' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default',
          }}
          onPointerDown={handleNoteAreaPointerDown}
          onPointerMove={handleNoteAreaPointerMove}
          onPointerUp={handleNoteAreaPointerUp}
        >
          <div style={{ width: gridWidth, height: gridHeight, position: 'relative' }}>
            {/* Horizontal pitch rows */}
            {Array.from({ length: TOTAL_NOTES }, (_, i) => {
              const midi = TOTAL_NOTES - 1 - i;
              const black = isBlack(midi);
              const isC = midi % 12 === 0;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute', left: 0, right: 0,
                    top: i * NOTE_HEIGHT,
                    height: NOTE_HEIGHT,
                    background: black ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.006)',
                    borderBottom: `1px solid ${isC ? 'rgba(139,127,248,0.15)' : 'rgba(255,255,255,0.032)'}`,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}

            {/* Vertical beat / bar lines */}
            {beatLines.map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: line.x, width: 1,
                  background: line.isMajor
                    ? 'rgba(139,127,248,0.24)'
                    : 'rgba(255,255,255,0.045)',
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* Beat number labels */}
            {beatLines.filter((l) => l.isMajor).map((line, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', top: 2, left: line.x + 3,
                  fontSize: 8, fontWeight: 600,
                  color: 'rgba(139,127,248,0.48)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {Math.round(line.x / pxPerBeat / bpb) + 1}
              </div>
            ))}

            {/* MIDI notes */}
            {clip.notes.map((note) => {
              const x = beatsToPixels(note.startBeat, pxPerBeat);
              const y = (TOTAL_NOTES - 1 - note.note) * NOTE_HEIGHT;
              const w = Math.max(4, beatsToPixels(note.durationBeats, pxPerBeat) - 1);
              const isSelected = selectedNoteId === note.id;
              const velAlpha = 0.55 + (note.velocity / 127) * 0.45;

              return (
                <div
                  key={note.id}
                  style={{
                    position: 'absolute',
                    left: x, top: y + 2, width: w, height: NOTE_HEIGHT - 3,
                    borderRadius: 3,
                    background: isSelected
                      ? `linear-gradient(90deg, rgba(139,127,248,${velAlpha}) 0%, rgba(91,156,248,${velAlpha}) 100%)`
                      : `linear-gradient(90deg, rgba(34,201,126,${velAlpha}) 0%, rgba(91,156,248,${velAlpha * 0.72}) 100%)`,
                    border: isSelected
                      ? '1px solid rgba(255,255,255,0.7)'
                      : '1px solid rgba(255,255,255,0.18)',
                    boxShadow: isSelected
                      ? '0 0 12px rgba(139,127,248,0.52), inset 0 1px 0 rgba(255,255,255,0.16)'
                      : '0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                    cursor: tool === 'erase' ? 'cell' : 'grab',
                    zIndex: 2,
                    boxSizing: 'border-box',
                  }}
                  onPointerDown={(e) => handleNotePointerDown(e, note, 'move')}
                >
                  <div
                    style={{
                      position: 'absolute', top: 0, bottom: 0, right: 0,
                      width: 6, cursor: 'ew-resize', zIndex: 3,
                      borderRadius: '0 3px 3px 0',
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleNotePointerDown(e, note, 'resize');
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '50%', right: 1,
                      transform: 'translateY(-50%)',
                      width: 1.5, height: 8, borderRadius: 1,
                      background: 'rgba(255,255,255,0.52)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Velocity lane */}
      <VelocityLane
        clip={clip}
        pxPerBeat={pxPerBeat}
        totalBeats={totalBeats}
        selectedNoteId={selectedNoteId}
        onVelocityChange={(noteId, vel) => updateMidiNote(clip.id, noteId, { velocity: vel })}
      />
    </div>
  );
}

// ─── Velocity Lane ────────────────────────────────────────────────────────────

function VelocityLane({
  clip, pxPerBeat, totalBeats, selectedNoteId, onVelocityChange,
}: {
  clip: MidiClip;
  pxPerBeat: number;
  totalBeats: number;
  selectedNoteId: string | null;
  onVelocityChange: (noteId: string, velocity: number) => void;
}) {
  const laneHeight = 48;
  const gridWidth = totalBeats * pxPerBeat;

  function handleVelPointerDown(e: React.PointerEvent<SVGElement>, note: MidiNote) {
    e.stopPropagation();
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    const rect = svg.getBoundingClientRect();
    function move(ev: PointerEvent) {
      const y = ev.clientY - rect.top;
      onVelocityChange(note.id, Math.max(1, Math.min(127, Math.round(127 * (1 - y / laneHeight)))));
    }
    function up() {
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    move(e.nativeEvent);
  }

  return (
    <div style={{ ...S.velocityLane, height: laneHeight }}>
      <svg width={gridWidth} height={laneHeight} style={{ display: 'block', cursor: 'ns-resize' }}>
        {/* Background grid lines */}
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <line key={i}
            x1={0} y1={laneHeight * frac} x2={gridWidth} y2={laneHeight * frac}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"
          />
        ))}

        {clip.notes.map((note) => {
          const x = note.startBeat * pxPerBeat;
          const barH = Math.max(2, (note.velocity / 127) * (laneHeight - 6));
          const isSelected = selectedNoteId === note.id;
          const barW = Math.max(2, note.durationBeats * pxPerBeat - 2);
          return (
            <g key={note.id} onPointerDown={(e) => handleVelPointerDown(e, note)}>
              <rect
                x={x + 1} y={laneHeight - barH}
                width={barW} height={barH}
                fill={isSelected ? 'rgba(139,127,248,0.88)' : 'rgba(91,156,248,0.66)'}
                rx="1.5"
              />
              {/* Tip highlight */}
              <rect
                x={x + 1} y={laneHeight - barH}
                width={barW} height={2}
                fill={isSelected ? 'rgba(238,238,255,0.9)' : 'rgba(160,210,255,0.82)'}
                rx="1"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
