import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { MidiClip, MidiNote } from '../../lib/project/projectSchema.js';

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
    background: 'rgba(4,6,14,0.98)',
    borderTop: '2px solid rgba(139,127,248,0.6)',
    height: '40vh',
    minHeight: 200,
    maxHeight: 480,
    boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 38,
    flexShrink: 0,
    background: 'rgba(6,8,22,0.97)',
    borderBottom: '1px solid rgba(255,255,255,0.055)',
    boxShadow: '0 1px 8px rgba(0,0,0,0.4)',
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: '#c0b8ff',
    letterSpacing: '0.02em',
    marginRight: 4,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: 18,
    background: 'rgba(255,255,255,0.07)',
    margin: '0 3px',
    flexShrink: 0,
  },
  select: {
    height: 22,
    padding: '0 18px 0 7px',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 4,
    color: '#ced0ea',
    fontSize: 11,
    outline: 'none',
  },
  velInput: {
    width: 38,
    height: 22,
    textAlign: 'center' as const,
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 4,
    color: '#ced0ea',
    fontSize: 11,
    outline: 'none',
  },
  labelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  closeBtn: {
    height: 22,
    padding: '0 8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: 'rgba(255,255,255,0.35)',
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
    background: '#0e0f18',
    borderRight: '1px solid rgba(255,255,255,0.06)',
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
    background: 'rgba(4,5,14,0.97)',
    paddingLeft: KEY_WIDTH,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 192,
    background: 'rgba(4,6,14,0.98)',
    color: 'rgba(255,255,255,0.18)',
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
        border: active ? '1px solid rgba(139,127,248,0.5)' : '1px solid rgba(255,255,255,0.07)',
        background: active ? 'rgba(139,127,248,0.2)' : 'rgba(255,255,255,0.04)',
        color: active ? '#c0b8ff' : 'rgba(255,255,255,0.3)',
        boxShadow: active ? '0 0 8px rgba(139,127,248,0.2)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PianoRoll({ onClose }: { onClose: () => void }) {
  const { project, pianoRollClipId, addMidiNote, updateMidiNote, deleteMidiNote } = useStudioStore();
  const clip = project.midiClips.find((c) => c.id === pianoRollClipId) as MidiClip | undefined;

  const [pxPerBeat, setPxPerBeat] = useState(40);
  const [tool, setTool] = useState<'pencil' | 'select' | 'erase'>('pencil');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [defaultDuration, setDefaultDuration] = useState(0.5);
  const [defaultVelocity, setDefaultVelocity] = useState(100);
  const noteAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragNote | null>(null);
  const [, forceUpdate] = useState(0);

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
    <div style={S.container}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={S.title}>Piano Roll — {clip.name}</span>

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
                    background: black ? '#141420' : '#d8d9e8',
                    borderBottom: `1px solid ${black ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)'}`,
                    position: 'relative',
                    boxShadow: isC && !black ? 'inset 0 -1px 0 rgba(139,127,248,0.25)' : undefined,
                  }}
                  title={noteName(midi)}
                >
                  {isC && (
                    <span style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: black ? 'rgba(180,172,255,0.4)' : 'rgba(60,60,100,0.6)',
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
                    background: black ? 'rgba(0,0,0,0.2)' : 'transparent',
                    borderBottom: `1px solid ${isC ? 'rgba(139,127,248,0.12)' : 'rgba(255,255,255,0.03)'}`,
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
                    ? 'rgba(139,127,248,0.2)'
                    : 'rgba(255,255,255,0.04)',
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
                  color: 'rgba(139,127,248,0.35)',
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
                      : `linear-gradient(90deg, rgba(32,201,126,${velAlpha}) 0%, rgba(22,160,100,${velAlpha}) 100%)`,
                    border: isSelected
                      ? '1px solid rgba(255,255,255,0.7)'
                      : '1px solid rgba(255,255,255,0.18)',
                    boxShadow: isSelected
                      ? '0 0 8px rgba(139,127,248,0.5)'
                      : '0 1px 3px rgba(0,0,0,0.3)',
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
                      background: 'rgba(255,255,255,0.35)',
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
                fill={isSelected ? 'rgba(139,127,248,0.85)' : 'rgba(32,201,126,0.65)'}
                rx="1.5"
              />
              {/* Tip highlight */}
              <rect
                x={x + 1} y={laneHeight - barH}
                width={barW} height={2}
                fill={isSelected ? 'rgba(200,192,255,0.9)' : 'rgba(100,240,180,0.8)'}
                rx="1"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
