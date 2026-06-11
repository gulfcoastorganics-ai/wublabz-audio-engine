import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { MidiClip, MidiNote } from '../../lib/project/projectSchema.js';

const KEY_WIDTH = 36;
const NOTE_HEIGHT = 14;
const NOTES_PER_OCTAVE = 12;
const TOTAL_NOTES = 128;
const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // semitone offsets

function noteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${MIDI_NOTE_NAMES[midi % 12]}${octave}`;
}

function isBlack(midi: number): boolean {
  return BLACK_KEYS.has(midi % 12);
}

// Pixels per beat at current zoom
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

export function PianoRoll({ onClose }: { onClose: () => void }) {
  const { project, pianoRollClipId, addMidiNote, updateMidiNote, deleteMidiNote } = useStudioStore();

  const clip = project.midiClips.find((c) => c.id === pianoRollClipId) as MidiClip | undefined;

  const [pxPerBeat, setPxPerBeat] = useState(40);
  const [tool, setTool] = useState<'pencil' | 'select' | 'erase'>('pencil');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [defaultDuration, setDefaultDuration] = useState(0.5); // beats
  const [defaultVelocity, setDefaultVelocity] = useState(100);
  const noteAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragNote | null>(null);
  const [, forceUpdate] = useState(0);

  const clipDuration = clip ? clip.endTime - clip.startTime : 8;
  // Duration in beats: approximate via bpm
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

  // ─── Wheel zoom ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = noteAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.18;
        setPxPerBeat((p) => Math.max(8, Math.min(200, p * delta)));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // ─── Note grid click ─────────────────────────────────────────────────────────
  function handleNoteAreaPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!clip) return;
    const rect = noteAreaRef.current!.getBoundingClientRect();
    const scrollLeft = noteAreaRef.current!.scrollLeft;
    const scrollTop = noteAreaRef.current!.scrollTop;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

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
      noteId: note.id,
      type,
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNote: note.note,
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
      const newBeat = snapBeat(Math.max(0, drag.startBeat + dBeats));
      const newNote = Math.max(0, Math.min(127, drag.startNote + dNotes));
      updateMidiNote(clip.id, drag.noteId, { startBeat: newBeat, note: newNote });
    } else {
      const newDuration = Math.max(0.0625, snapBeat(drag.durationBeats + dBeats) || defaultDuration);
      updateMidiNote(clip.id, drag.noteId, { durationBeats: newDuration });
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

  if (!clip) {
    return (
      <div
        className="flex items-center justify-center h-48"
        style={{ background: 'var(--color-daw-surface)', color: 'var(--color-daw-text-dim)' }}
      >
        No clip selected
      </div>
    );
  }

  // ─── Beat lines ─────────────────────────────────────────────────────────────
  const beatLines: { x: number; isMajor: boolean }[] = [];
  const bpb = project.timeSignature.beatsPerBar;
  for (let b = 0; b <= Math.ceil(totalBeats); b++) {
    beatLines.push({ x: b * pxPerBeat, isMajor: b % bpb === 0 });
  }

  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--color-daw-surface)',
        borderTop: '2px solid var(--color-daw-accent)',
        height: '40vh',
        minHeight: 200,
        maxHeight: 480,
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 h-10 shrink-0 select-none"
        style={{
          background: 'var(--color-daw-panel)',
          borderBottom: '1px solid var(--color-daw-border)',
        }}
      >
        <span
          className="font-medium text-xs mr-2"
          style={{ color: 'var(--color-daw-text-bright)' }}
        >
          Piano Roll — {clip.name}
        </span>

        {(['pencil', 'select', 'erase'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className="px-2 h-6 rounded text-xs capitalize hover:opacity-80"
            style={{
              background:
                tool === t ? 'var(--color-daw-accent)' : 'var(--color-daw-border-bright)',
              color: tool === t ? '#fff' : 'var(--color-daw-text-dim)',
            }}
            title={`${t} (${t[0]})`}
          >
            {t === 'pencil' ? '✏ Pencil' : t === 'select' ? '↖ Select' : '✕ Erase'}
          </button>
        ))}

        <div className="w-px h-5 mx-1" style={{ background: 'var(--color-daw-border-bright)' }} />

        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-daw-text-dim)' }}>
          Grid
          <select
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(Number(e.target.value))}
            className="h-6 rounded text-xs px-1"
            style={{
              background: 'var(--color-daw-bg)',
              color: 'var(--color-daw-text)',
              border: '1px solid var(--color-daw-border-bright)',
            }}
          >
            <option value={0.0625}>1/16</option>
            <option value={0.125}>1/8</option>
            <option value={0.25}>1/4</option>
            <option value={0.5}>1/2</option>
            <option value={1}>1</option>
          </select>
        </label>

        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-daw-text-dim)' }}>
          Vel
          <input
            type="number"
            min={1}
            max={127}
            value={defaultVelocity}
            onChange={(e) => setDefaultVelocity(Number(e.target.value))}
            className="w-10 text-center rounded text-xs px-1"
            style={{
              background: 'var(--color-daw-bg)',
              color: 'var(--color-daw-text)',
              border: '1px solid var(--color-daw-border-bright)',
            }}
          />
        </label>

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="px-2 h-6 rounded text-xs hover:opacity-80"
          style={{ background: 'var(--color-daw-border-bright)', color: 'var(--color-daw-text-dim)' }}
          title="Close Piano Roll (Esc)"
        >
          ✕ Close
        </button>
      </div>

      {/* Body: piano keys + note grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Piano keyboard */}
        <div
          className="shrink-0 overflow-y-auto overflow-x-hidden"
          style={{
            width: KEY_WIDTH,
            background: '#1a1a1a',
            borderRight: '1px solid var(--color-daw-border)',
          }}
        >
          <div style={{ height: gridHeight }}>
            {Array.from({ length: TOTAL_NOTES }, (_, i) => {
              const midi = TOTAL_NOTES - 1 - i;
              const black = isBlack(midi);
              const isC = midi % 12 === 0;
              return (
                <div
                  key={midi}
                  className="flex items-center justify-end pr-1 relative"
                  style={{
                    height: NOTE_HEIGHT,
                    background: black ? '#222' : '#eee',
                    borderBottom: '1px solid #444',
                    color: black ? '#aaa' : '#333',
                    fontSize: 9,
                    zIndex: black ? 1 : 0,
                    fontWeight: isC ? 'bold' : undefined,
                  }}
                  title={noteName(midi)}
                >
                  {isC && (
                    <span style={{ color: black ? '#aaa' : '#555', fontSize: 8 }}>
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
          className="flex-1 overflow-auto relative"
          style={{ cursor: tool === 'pencil' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default' }}
          onPointerDown={handleNoteAreaPointerDown}
          onPointerMove={handleNoteAreaPointerMove}
          onPointerUp={handleNoteAreaPointerUp}
        >
          <div style={{ width: gridWidth, height: gridHeight, position: 'relative' }}>
            {/* Horizontal pitch lines */}
            {Array.from({ length: TOTAL_NOTES }, (_, i) => {
              const midi = TOTAL_NOTES - 1 - i;
              const black = isBlack(midi);
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0"
                  style={{
                    top: i * NOTE_HEIGHT,
                    height: NOTE_HEIGHT,
                    background: black ? 'rgba(0,0,0,0.25)' : 'transparent',
                    borderBottom: `1px solid ${midi % 12 === 0 ? 'var(--color-daw-border-bright)' : 'var(--color-daw-border)'}`,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}

            {/* Vertical beat lines */}
            {beatLines.map((line, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: line.x,
                  width: 1,
                  background: line.isMajor
                    ? 'var(--color-daw-border-bright)'
                    : 'var(--color-daw-border)',
                  pointerEvents: 'none',
                  opacity: line.isMajor ? 0.8 : 0.4,
                }}
              />
            ))}

            {/* MIDI Notes */}
            {clip.notes.map((note) => {
              const x = beatsToPixels(note.startBeat, pxPerBeat);
              const y = (TOTAL_NOTES - 1 - note.note) * NOTE_HEIGHT;
              const w = Math.max(4, beatsToPixels(note.durationBeats, pxPerBeat) - 1);
              const isSelected = selectedNoteId === note.id;
              const velAlpha = 0.5 + (note.velocity / 127) * 0.5;

              return (
                <div
                  key={note.id}
                  className="absolute rounded-sm"
                  style={{
                    left: x,
                    top: y + 1,
                    width: w,
                    height: NOTE_HEIGHT - 2,
                    background: `rgba(58,194,104,${velAlpha})`,
                    border: isSelected
                      ? '1px solid rgba(255,255,255,0.8)'
                      : '1px solid rgba(255,255,255,0.2)',
                    cursor: tool === 'erase' ? 'cell' : 'grab',
                    zIndex: 2,
                    boxSizing: 'border-box',
                  }}
                  onPointerDown={(e) => handleNotePointerDown(e, note, 'move')}
                >
                  {/* Resize handle */}
                  <div
                    className="absolute top-0 bottom-0 right-0"
                    style={{ width: 6, cursor: 'ew-resize', zIndex: 3 }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleNotePointerDown(e, note, 'resize');
                    }}
                  />
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
        onVelocityChange={(noteId, vel) => {
          updateMidiNote(clip.id, noteId, { velocity: vel });
        }}
      />
    </div>
  );
}

// ─── Velocity Lane ─────────────────────────────────────────────────────────────

function VelocityLane({
  clip,
  pxPerBeat,
  totalBeats,
  selectedNoteId,
  onVelocityChange,
}: {
  clip: MidiClip;
  pxPerBeat: number;
  totalBeats: number;
  selectedNoteId: string | null;
  onVelocityChange: (noteId: string, velocity: number) => void;
}) {
  const laneHeight = 48;
  const gridWidth = totalBeats * pxPerBeat;

  function handleVelPointerDown(
    e: React.PointerEvent<SVGElement>,
    note: MidiNote
  ) {
    e.stopPropagation();
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    const rect = svg.getBoundingClientRect();

    function move(ev: PointerEvent) {
      const y = ev.clientY - rect.top;
      const vel = Math.max(1, Math.min(127, Math.round(127 * (1 - y / laneHeight))));
      onVelocityChange(note.id, vel);
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
    <div
      className="shrink-0 overflow-x-auto"
      style={{
        height: laneHeight,
        borderTop: '1px solid var(--color-daw-border)',
        background: 'var(--color-daw-bg)',
        paddingLeft: KEY_WIDTH,
      }}
    >
      <svg
        width={gridWidth}
        height={laneHeight}
        style={{ display: 'block', cursor: 'ns-resize' }}
      >
        {clip.notes.map((note) => {
          const x = note.startBeat * pxPerBeat;
          const barH = Math.max(2, (note.velocity / 127) * (laneHeight - 4));
          const isSelected = selectedNoteId === note.id;
          return (
            <g key={note.id} onPointerDown={(e) => handleVelPointerDown(e, note)}>
              <rect
                x={x + 1}
                y={laneHeight - barH}
                width={Math.max(2, note.durationBeats * pxPerBeat - 2)}
                height={barH}
                fill={isSelected ? 'var(--color-daw-accent)' : 'var(--color-daw-green)'}
                fillOpacity={0.8}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
