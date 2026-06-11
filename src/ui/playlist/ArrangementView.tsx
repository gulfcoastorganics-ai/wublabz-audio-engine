import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { AudioClip, MidiClip, Track } from '../../lib/project/projectSchema.js';

const TRACK_HEADER_WIDTH = 180;
const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 28;
const MIN_CLIP_WIDTH = 4; // pixels

// ─── Drag state (mutable ref — never triggers re-render during drag) ─────────

interface DragState {
  active: boolean;
  type: 'move' | 'resize';
  clipId: string;
  clipType: 'audio' | 'midi';
  startClientX: number;
  startClientY: number;
  originalStart: number;
  originalEnd: number;
  originalTrackId: string;
  trackIndex: number;
  containerLeft: number;
  containerTop: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

function formatRulerLabel(seconds: number, bpm: number, bpb: number): string {
  const totalBeats = (seconds * bpm) / 60;
  const bar = Math.floor(totalBeats / bpb) + 1;
  return `${bar}`;
}

function clipColor(clip: AudioClip | MidiClip, track: Track | undefined): string {
  if (track?.color) return track.color;
  return clip.type === 'audio' ? 'var(--color-daw-clip-audio)' : 'var(--color-daw-clip-midi)';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArrangementView() {
  const {
    project,
    zoom,
    scrollLeft,
    selectedClipId,
    pianoRollClipId,
    position,
    isPlaying,
    snapEnabled,
    snapGrid,
    setZoom,
    setScrollLeft,
    selectClip,
    openPianoRoll,
    moveClip,
    resizeClip,
    splitClip,
    deleteClip,
    duplicateClip,
    addTrack,
    addMidiClip,
    importFile,
    setStatus,
  } = useStudioStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const laneAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    type: 'move',
    clipId: '',
    clipType: 'audio',
    startClientX: 0,
    startClientY: 0,
    originalStart: 0,
    originalEnd: 0,
    originalTrackId: '',
    trackIndex: 0,
    containerLeft: 0,
    containerTop: 0,
  });
  const dragOverlayRef = useRef<HTMLDivElement | null>(null);
  const [dragTick, setDragTick] = useState(0); // force re-render on drag commit

  const pxPerSec = zoom;
  const tracks = [...project.tracks].sort((a, b) => a.order - b.order);
  const allClips: Array<AudioClip | MidiClip> = [
    ...project.audioClips,
    ...project.midiClips,
  ];

  const totalDuration = allClips.reduce((m, c) => Math.max(m, c.endTime), 32);
  const timelineWidth = Math.max(totalDuration * pxPerSec + 400, 1200);

  const secToPx = useCallback((s: number) => s * pxPerSec, [pxPerSec]);
  const pxToSec = useCallback((px: number) => px / pxPerSec, [pxPerSec]);

  function snap(t: number): number {
    if (!snapEnabled) return t;
    return Math.round(t / snapGrid) * snapGrid;
  }

  // ─── Ruler ticks ──────────────────────────────────────────────────────────

  const bpb = project.timeSignature.beatsPerBar;
  const bpm = project.bpm;
  const barDurationSec = beatsToSeconds(bpb, bpm);
  const barWidthPx = secToPx(barDurationSec);

  const rulerTicks: { x: number; label: string; isBar: boolean }[] = [];
  if (barWidthPx > 0) {
    const visibleStart = scrollLeft / pxPerSec;
    const visibleEnd = visibleStart + (containerRef.current?.clientWidth ?? 1200) / pxPerSec;
    const startBar = Math.max(0, Math.floor(visibleStart / barDurationSec) - 1);
    const endBar = Math.ceil(visibleEnd / barDurationSec) + 2;

    for (let b = startBar; b <= endBar; b++) {
      const t = b * barDurationSec;
      const x = secToPx(t) - scrollLeft;
      rulerTicks.push({
        x,
        label: String(b + 1),
        isBar: true,
      });
      // Beat subdivisions
      if (barWidthPx > 60) {
        for (let beat = 1; beat < bpb; beat++) {
          const beatT = t + beatsToSeconds(beat, bpm);
          rulerTicks.push({
            x: secToPx(beatT) - scrollLeft,
            label: '',
            isBar: false,
          });
        }
      }
    }
  }

  // ─── Playhead position ────────────────────────────────────────────────────

  const playheadX = secToPx(position) - scrollLeft;

  // ─── Scroll handler ───────────────────────────────────────────────────────

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollLeft(e.currentTarget.scrollLeft);
    },
    [setScrollLeft]
  );

  // ─── Zoom (Ctrl+Wheel) ────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.85 : 1.18;
        setZoom(zoom * delta);
      }
    },
    [zoom, setZoom]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ─── Drag: pointer down on clip ───────────────────────────────────────────

  function startClipDrag(
    e: React.PointerEvent<HTMLDivElement>,
    clip: AudioClip | MidiClip,
    type: 'move' | 'resize',
    trackIndex: number
  ) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const container = laneAreaRef.current!.getBoundingClientRect();
    dragRef.current = {
      active: true,
      type,
      clipId: clip.id,
      clipType: clip.type,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originalStart: clip.startTime,
      originalEnd: clip.endTime,
      originalTrackId: clip.trackId,
      trackIndex,
      containerLeft: container.left,
      containerTop: container.top,
    };
    document.body.classList.add('drag-active');
    selectClip(clip.id);
  }

  // ─── Drag: pointer move ───────────────────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const dtSec = pxToSec(dx);

      // Find the overlay element for this clip and move it visually
      const overlay = dragOverlayRef.current;
      if (!overlay) return;

      if (drag.type === 'move') {
        overlay.style.transform = `translate(${dx}px, ${Math.round(dy / TRACK_HEIGHT) * TRACK_HEIGHT}px)`;
      } else {
        // Resize: just change width
        const newEnd = Math.max(drag.originalStart + 0.1, drag.originalEnd + dtSec);
        const newWidth = secToPx(newEnd - drag.originalStart);
        overlay.style.width = `${Math.max(MIN_CLIP_WIDTH, newWidth)}px`;
      }
    },
    [pxToSec, secToPx]
  );

  // ─── Drag: pointer up ─────────────────────────────────────────────────────

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.active = false;
      document.body.classList.remove('drag-active');
      dragOverlayRef.current = null;

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const dtSec = pxToSec(dx);
      const trackDelta = Math.round(dy / TRACK_HEIGHT);

      if (drag.type === 'move') {
        const newStart = snap(Math.max(0, drag.originalStart + dtSec));
        // Resolve target track
        const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, drag.trackIndex + trackDelta));
        const newTrack = tracks[newTrackIndex];
        const newTrackId = newTrack?.id ?? drag.originalTrackId;
        moveClip(drag.clipId, newStart, newTrackId !== drag.originalTrackId ? newTrackId : undefined);
      } else {
        const newEnd = snap(Math.max(drag.originalStart + 0.1, drag.originalEnd + dtSec));
        resizeClip(drag.clipId, newEnd);
      }
      setDragTick((t) => t + 1);
    },
    [pxToSec, snap, tracks, moveClip, resizeClip]
  );

  // ─── Timeline click: seek ─────────────────────────────────────────────────

  function handleRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + scrollLeft;
    useStudioStore.getState().seek(pxToSec(px));
  }

  // ─── Drop audio files ─────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('audio/')) {
        void importFile(file);
      }
    }
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useStudioStore.getState().selectedClipId;
        if (id) deleteClip(id);
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const id = useStudioStore.getState().selectedClipId;
        if (id) duplicateClip(id);
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void useStudioStore.getState().save();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteClip, duplicateClip]);

  // ─── Context menu state ───────────────────────────────────────────────────

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
    clipType: 'audio' | 'midi';
  } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [ctxMenu]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: 'var(--color-daw-bg)' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Arrangement body: track headers + scrollable lane area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track header column */}
        <div
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{
            width: TRACK_HEADER_WIDTH,
            background: 'var(--color-daw-track-header)',
            borderRight: '1px solid var(--color-daw-border)',
          }}
        >
          {/* Ruler spacer */}
          <div
            className="shrink-0 flex items-center px-2"
            style={{
              height: RULER_HEIGHT,
              borderBottom: '1px solid var(--color-daw-border)',
              background: 'var(--color-daw-ruler)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--color-daw-text-dim)' }}>
              Bars
            </span>
          </div>

          {/* Track headers */}
          {tracks.map((track, idx) => (
            <TrackHeader
              key={track.id}
              track={track}
              index={idx}
              onAddMidi={() => {
                const id = addMidiClip(track.id, 0, barDurationSec * 4);
                openPianoRoll(id);
              }}
            />
          ))}

          {/* Add track buttons */}
          <div className="flex gap-1 p-2 mt-1">
            <button
              onClick={() => addTrack('audio')}
              className="flex-1 py-1 rounded text-xs hover:opacity-80"
              style={{ background: 'var(--color-daw-border-bright)', color: 'var(--color-daw-text-dim)' }}
            >
              + Audio
            </button>
            <button
              onClick={() => addTrack('midi')}
              className="flex-1 py-1 rounded text-xs hover:opacity-80"
              style={{ background: 'var(--color-daw-border-bright)', color: 'var(--color-daw-text-dim)' }}
            >
              + MIDI
            </button>
          </div>
        </div>

        {/* Scrollable lane area */}
        <div
          ref={laneAreaRef}
          className="flex-1 overflow-auto relative"
          onScroll={handleScroll}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div style={{ width: timelineWidth, position: 'relative' }}>
            {/* Ruler */}
            <div
              className="sticky top-0 z-20 cursor-pointer"
              style={{
                height: RULER_HEIGHT,
                background: 'var(--color-daw-ruler)',
                borderBottom: '1px solid var(--color-daw-border)',
              }}
              onClick={handleRulerClick}
            >
              {rulerTicks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 flex flex-col justify-start"
                  style={{ left: tick.x }}
                >
                  <div
                    style={{
                      width: 1,
                      height: tick.isBar ? 12 : 6,
                      background: tick.isBar
                        ? 'var(--color-daw-border-bright)'
                        : 'var(--color-daw-border)',
                      marginTop: tick.isBar ? 0 : 6,
                    }}
                  />
                  {tick.isBar && tick.label && (
                    <span
                      className="text-xs pl-1"
                      style={{
                        color: 'var(--color-daw-text-dim)',
                        fontSize: 10,
                        lineHeight: '14px',
                        marginTop: 2,
                        userSelect: 'none',
                      }}
                    >
                      {tick.label}
                    </span>
                  )}
                </div>
              ))}

              {/* Loop region on ruler */}
              {useStudioStore.getState().loopEnabled && (
                <div
                  className="absolute top-0 bottom-0 opacity-20"
                  style={{
                    left: secToPx(useStudioStore.getState().loopStart) - scrollLeft,
                    width: secToPx(
                      useStudioStore.getState().loopEnd - useStudioStore.getState().loopStart
                    ),
                    background: 'var(--color-daw-accent)',
                  }}
                />
              )}
            </div>

            {/* Track lanes */}
            {tracks.map((track, trackIndex) => {
              const trackClips = allClips.filter((c) => c.trackId === track.id);
              return (
                <div
                  key={track.id}
                  className="relative"
                  style={{
                    height: TRACK_HEIGHT,
                    borderBottom: '1px solid var(--color-daw-border)',
                    background: trackIndex % 2 === 0
                      ? 'var(--color-daw-track-lane)'
                      : 'var(--color-daw-grid)',
                  }}
                  onDoubleClick={(e) => {
                    // Double-click on empty lane area: create MIDI clip
                    if ((e.target as HTMLElement).classList.contains('lane-bg')) {
                      const rect = laneAreaRef.current!.getBoundingClientRect();
                      const px = e.clientX - rect.left + (laneAreaRef.current?.scrollLeft ?? 0);
                      const startTime = snap(pxToSec(px));
                      if (track.type === 'midi') {
                        const id = addMidiClip(track.id, startTime, startTime + barDurationSec * 4);
                        openPianoRoll(id);
                      }
                    }
                  }}
                >
                  {/* Grid lines (bar lines) */}
                  <div className="absolute inset-0 pointer-events-none lane-bg">
                    {rulerTicks
                      .filter((t) => t.isBar)
                      .map((tick, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0"
                          style={{
                            left: tick.x,
                            width: 1,
                            background: 'var(--color-daw-grid-bar)',
                          }}
                        />
                      ))}
                  </div>

                  {/* Clips */}
                  {trackClips.map((clip) => {
                    const left = secToPx(clip.startTime) - scrollLeft;
                    const width = Math.max(MIN_CLIP_WIDTH, secToPx(clip.endTime - clip.startTime));
                    const isDragging =
                      dragRef.current.active && dragRef.current.clipId === clip.id;
                    const isSelected = selectedClipId === clip.id;
                    const asset =
                      clip.type === 'audio'
                        ? project.audioAssets.find((a) => a.id === (clip as AudioClip).assetId)
                        : null;

                    return (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        asset={asset ?? null}
                        track={track}
                        left={left}
                        width={width}
                        isSelected={isSelected}
                        isDragging={isDragging}
                        dragOverlayRef={isDragging ? dragOverlayRef : undefined}
                        onMoveStart={(e) => startClipDrag(e, clip, 'move', trackIndex)}
                        onResizeStart={(e) => startClipDrag(e, clip, 'resize', trackIndex)}
                        onSelect={() => selectClip(clip.id)}
                        onDoubleClick={() => {
                          if (clip.type === 'midi') openPianoRoll(clip.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ x: e.clientX, y: e.clientY, clipId: clip.id, clipType: clip.type });
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          {playheadX >= 0 && (
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{
                left: playheadX,
                width: 2,
                background: 'var(--color-daw-playhead)',
                boxShadow: '0 0 4px var(--color-daw-playhead)',
              }}
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ClipContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          clipId={ctxMenu.clipId}
          clipType={ctxMenu.clipType}
          onClose={() => setCtxMenu(null)}
          onDelete={() => { deleteClip(ctxMenu.clipId); setCtxMenu(null); }}
          onDuplicate={() => { duplicateClip(ctxMenu.clipId); setCtxMenu(null); }}
          onSplit={() => { splitClip(ctxMenu.clipId); setCtxMenu(null); }}
          onOpenPianoRoll={
            ctxMenu.clipType === 'midi'
              ? () => { openPianoRoll(ctxMenu.clipId); setCtxMenu(null); }
              : undefined
          }
        />
      )}

      {/* Drop hint */}
      <div
        className="text-center py-1 text-xs shrink-0"
        style={{
          color: 'var(--color-daw-text-dim)',
          background: 'var(--color-daw-panel)',
          borderTop: '1px solid var(--color-daw-border)',
        }}
      >
        Drop audio files · Ctrl+Scroll to zoom · Double-click ruler to seek · Delete to remove clip
      </div>
    </div>
  );
}

// ─── TrackHeader ──────────────────────────────────────────────────────────────

function TrackHeader({
  track,
  index,
  onAddMidi,
}: {
  track: Track;
  index: number;
  onAddMidi: () => void;
}) {
  const { updateTrack } = useStudioStore();

  return (
    <div
      className="flex items-center gap-1 px-2 shrink-0"
      style={{
        height: TRACK_HEIGHT,
        borderBottom: '1px solid var(--color-daw-border)',
        background: 'var(--color-daw-track-header)',
      }}
    >
      {/* Color bar */}
      <div
        className="w-1 rounded-full self-stretch my-2"
        style={{ background: track.color ?? 'var(--color-daw-accent)', minWidth: 3 }}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-medium truncate"
          style={{ color: 'var(--color-daw-text-bright)' }}
        >
          {track.name}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-daw-text-dim)', fontSize: 10 }}>
          {track.type.toUpperCase()}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-0.5">
        <div className="flex gap-0.5">
          <TrackButton
            label="M"
            active={track.mute}
            activeColor="var(--color-daw-amber)"
            title="Mute"
            onClick={() => updateTrack(track.id, { mute: !track.mute })}
          />
          <TrackButton
            label="S"
            active={track.solo}
            activeColor="var(--color-daw-green)"
            title="Solo"
            onClick={() => updateTrack(track.id, { solo: !track.solo })}
          />
        </div>
        {track.type === 'midi' && (
          <button
            onClick={onAddMidi}
            className="text-xs px-1 rounded hover:opacity-80"
            style={{
              background: 'var(--color-daw-clip-midi)',
              color: '#fff',
              fontSize: 9,
              lineHeight: '14px',
            }}
            title="Add MIDI clip"
          >
            +MIDI
          </button>
        )}
      </div>
    </div>
  );
}

function TrackButton({
  label,
  active,
  activeColor,
  title,
  onClick,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold hover:opacity-80"
      style={{
        background: active ? activeColor : 'var(--color-daw-border-bright)',
        color: active ? '#000' : 'var(--color-daw-text-dim)',
        fontSize: 9,
      }}
    >
      {label}
    </button>
  );
}

// ─── ClipBlock ────────────────────────────────────────────────────────────────

import type { AudioAsset } from '../../lib/project/projectSchema.js';

function ClipBlock({
  clip,
  asset,
  track,
  left,
  width,
  isSelected,
  isDragging,
  dragOverlayRef,
  onMoveStart,
  onResizeStart,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: {
  clip: AudioClip | MidiClip;
  asset: AudioAsset | null;
  track: Track;
  left: number;
  width: number;
  isSelected: boolean;
  isDragging: boolean;
  dragOverlayRef?: React.MutableRefObject<HTMLDivElement | null>;
  onMoveStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const refCb = useCallback(
    (el: HTMLDivElement | null) => {
      if (dragOverlayRef) dragOverlayRef.current = el;
    },
    [dragOverlayRef]
  );

  const baseColor = track.color ?? (clip.type === 'audio' ? '#2a5fa0' : '#2a8060');

  return (
    <div
      ref={refCb}
      className="absolute top-1 bottom-1 rounded overflow-hidden flex flex-col"
      style={{
        left,
        width,
        background: `${baseColor}dd`,
        border: isSelected
          ? '1px solid rgba(255,255,255,0.6)'
          : '1px solid rgba(255,255,255,0.12)',
        cursor: 'grab',
        zIndex: isDragging ? 50 : 1,
        boxShadow: isSelected ? '0 0 0 1px rgba(255,255,255,0.3)' : undefined,
        transition: isDragging ? 'none' : undefined,
        willChange: isDragging ? 'transform' : undefined,
      }}
      onPointerDown={onMoveStart}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onContextMenu={onContextMenu}
    >
      {/* Clip header */}
      <div
        className="flex items-center px-1 gap-1 shrink-0"
        style={{
          height: 16,
          background: `${baseColor}`,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <span className="text-xs font-medium truncate" style={{ color: '#fff', fontSize: 10 }}>
          {clip.name}
        </span>
        {clip.muted && (
          <span style={{ color: 'rgba(255,200,0,0.8)', fontSize: 9 }}>M</span>
        )}
      </div>

      {/* Waveform (audio) or note preview (midi) */}
      <div className="flex-1 px-0.5 overflow-hidden">
        {clip.type === 'audio' && asset && (
          <WaveformMiniature peaks={asset.waveformPeaks} color="#fff" />
        )}
        {clip.type === 'midi' && (
          <MidiMiniature notes={(clip as MidiClip).notes} duration={clip.endTime - clip.startTime} />
        )}
      </div>

      {/* Resize handle (right edge) */}
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{ width: 8, cursor: 'ew-resize', zIndex: 2 }}
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizeStart(e);
        }}
      />
    </div>
  );
}

function WaveformMiniature({ peaks, color }: { peaks: number[]; color: string }) {
  if (!peaks.length) return null;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${peaks.length} 32`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <polyline
        points={peaks
          .map((p, i) => `${i},${16 - p * 14} ${i},${16 + p * 14}`)
          .join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      {peaks.map((p, i) => (
        <line
          key={i}
          x1={i}
          y1={16 - p * 14}
          x2={i}
          y2={16 + p * 14}
          stroke={color}
          strokeOpacity="0.4"
        />
      ))}
    </svg>
  );
}

function MidiMiniature({ notes, duration }: { notes: MidiClip['notes']; duration: number }) {
  if (!notes.length) {
    return (
      <div
        className="h-full flex items-center justify-center text-xs opacity-50"
        style={{ color: '#fff' }}
      >
        empty
      </div>
    );
  }
  const minNote = Math.min(...notes.map((n) => n.note));
  const maxNote = Math.max(...notes.map((n) => n.note));
  const noteRange = Math.max(1, maxNote - minNote);
  const totalBeats = duration * 2; // approx

  return (
    <svg width="100%" height="100%" style={{ display: 'block' }}>
      {notes.map((n) => {
        const x = `${(n.startBeat / totalBeats) * 100}%`;
        const w = `${Math.max(1, (n.durationBeats / totalBeats) * 100)}%`;
        const y = `${((maxNote - n.note) / noteRange) * 80 + 10}%`;
        return (
          <rect
            key={n.id}
            x={x}
            y={y}
            width={w}
            height="10%"
            fill="#fff"
            fillOpacity="0.7"
          />
        );
      })}
    </svg>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function ClipContextMenu({
  x,
  y,
  clipId,
  clipType,
  onClose,
  onDelete,
  onDuplicate,
  onSplit,
  onOpenPianoRoll,
}: {
  x: number;
  y: number;
  clipId: string;
  clipType: 'audio' | 'midi';
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onOpenPianoRoll?: () => void;
}) {
  return (
    <div
      className="fixed z-50 rounded shadow-xl py-1"
      style={{
        left: x,
        top: y,
        background: 'var(--color-daw-panel)',
        border: '1px solid var(--color-daw-border-bright)',
        minWidth: 140,
      }}
    >
      {onOpenPianoRoll && (
        <CtxItem label="Open Piano Roll" onClick={onOpenPianoRoll} />
      )}
      <CtxItem label="Duplicate  Ctrl+D" onClick={onDuplicate} />
      {clipType === 'audio' && <CtxItem label="Split" onClick={onSplit} />}
      <div style={{ height: 1, background: 'var(--color-daw-border)', margin: '2px 0' }} />
      <CtxItem label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function CtxItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
      style={{
        background: 'transparent',
        color: danger ? 'var(--color-daw-red)' : 'var(--color-daw-text)',
        display: 'block',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
