import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { AudioClip, AudioAsset, MidiClip, Track } from '../../lib/project/projectSchema.js';

const TRACK_HEADER_WIDTH = 176;
const TRACK_HEIGHT = 58;
const RULER_HEIGHT = 26;
const MIN_CLIP_WIDTH = 4;

// ─── Drag state ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArrangementView() {
  const {
    project,
    zoom,
    scrollLeft,
    selectedClipId,
    position,
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
  const [, setDragTick] = useState(0);

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

  // ─── Ruler ticks ─────────────────────────────────────────────────────────

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
      rulerTicks.push({ x, label: String(b + 1), isBar: true });
      if (barWidthPx > 56) {
        for (let beat = 1; beat < bpb; beat++) {
          rulerTicks.push({
            x: secToPx(t + beatsToSeconds(beat, bpm)) - scrollLeft,
            label: '',
            isBar: false,
          });
        }
      }
    }
  }

  const playheadX = secToPx(position) - scrollLeft;

  // ─── Scroll ───────────────────────────────────────────────────────────────

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => setScrollLeft(e.currentTarget.scrollLeft),
    [setScrollLeft]
  );

  // ─── Zoom (Ctrl+Wheel) ────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(zoom * (e.deltaY > 0 ? 0.85 : 1.18));
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

  // ─── Drag: pointer down ───────────────────────────────────────────────────

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

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const overlay = dragOverlayRef.current;
      if (!overlay) return;
      if (drag.type === 'move') {
        overlay.style.transform = `translate(${dx}px, ${Math.round(dy / TRACK_HEIGHT) * TRACK_HEIGHT}px)`;
      } else {
        const newEnd = Math.max(drag.originalStart + 0.1, drag.originalEnd + pxToSec(dx));
        overlay.style.width = `${Math.max(MIN_CLIP_WIDTH, secToPx(newEnd - drag.originalStart))}px`;
      }
    },
    [pxToSec, secToPx]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.active = false;
      document.body.classList.remove('drag-active');
      dragOverlayRef.current = null;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const trackDelta = Math.round(dy / TRACK_HEIGHT);
      if (drag.type === 'move') {
        const newStart = snap(Math.max(0, drag.originalStart + pxToSec(dx)));
        const newTrackIndex = Math.max(0, Math.min(tracks.length - 1, drag.trackIndex + trackDelta));
        const newTrack = tracks[newTrackIndex];
        const newTrackId = newTrack?.id ?? drag.originalTrackId;
        moveClip(drag.clipId, newStart, newTrackId !== drag.originalTrackId ? newTrackId : undefined);
      } else {
        resizeClip(drag.clipId, snap(Math.max(drag.originalStart + 0.1, drag.originalEnd + pxToSec(dx))));
      }
      setDragTick((t) => t + 1);
    },
    [pxToSec, snap, tracks, moveClip, resizeClip]
  );

  // ─── Ruler click: seek ────────────────────────────────────────────────────

  function handleRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + scrollLeft;
    useStudioStore.getState().seek(pxToSec(px));
  }

  // ─── Drop audio ───────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('audio/')) void importFile(file);
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

  // ─── Context menu ─────────────────────────────────────────────────────────

  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number;
    clipId: string; clipType: 'audio' | 'midi';
  } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [ctxMenu]);

  const loopState = useStudioStore.getState();

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: '#04060e' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* ── Track header column ──────────────────────────────────────── */}
        <div
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{
            width: TRACK_HEADER_WIDTH,
            background: 'rgba(6, 8, 20, 0.95)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* Ruler spacer */}
          <div
            className="shrink-0 flex items-center px-3"
            style={{
              height: RULER_HEIGHT,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(3,5,16,0.98)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase' }}>
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

          {/* Empty state */}
          {tracks.length === 0 && (
            <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.18)', fontSize: 11, lineHeight: 1.6, textAlign: 'center' }}>
              No tracks yet.<br />Add one below.
            </div>
          )}

          {/* Add track buttons */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 8px 10px' }}>
            <button
              onClick={() => addTrack('audio')}
              style={{
                flex: 1, height: 24,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 4, color: 'rgba(255,255,255,0.35)',
                fontSize: 10, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              + Audio
            </button>
            <button
              onClick={() => addTrack('midi')}
              style={{
                flex: 1, height: 24,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 4, color: 'rgba(255,255,255,0.35)',
                fontSize: 10, fontWeight: 500, cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              + MIDI
            </button>
          </div>
        </div>

        {/* ── Scrollable lane area ─────────────────────────────────────── */}
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
                background: 'linear-gradient(180deg, rgba(3,5,16,0.99) 0%, rgba(5,7,20,0.97) 100%)',
                borderBottom: '1px solid rgba(139,127,248,0.12)',
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
                      height: tick.isBar ? 14 : 6,
                      background: tick.isBar
                        ? 'rgba(139,127,248,0.4)'
                        : 'rgba(255,255,255,0.1)',
                      marginTop: tick.isBar ? 0 : 8,
                    }}
                  />
                  {tick.isBar && tick.label && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: 'rgba(180,172,255,0.55)',
                        paddingLeft: 4,
                        marginTop: 1,
                        userSelect: 'none',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {tick.label}
                    </span>
                  )}
                </div>
              ))}

              {/* Loop region tint */}
              {loopState.loopEnabled && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: secToPx(loopState.loopStart) - scrollLeft,
                    width: secToPx(loopState.loopEnd - loopState.loopStart),
                    background: 'rgba(139,127,248,0.15)',
                    borderLeft: '1px solid rgba(139,127,248,0.5)',
                    borderRight: '1px solid rgba(139,127,248,0.5)',
                  }}
                />
              )}
            </div>

            {/* Track lanes */}
            {tracks.map((track, trackIndex) => {
              const trackClips = allClips.filter((c) => c.trackId === track.id);
              const isAlt = trackIndex % 2 === 1;
              return (
                <div
                  key={track.id}
                  className="relative"
                  style={{
                    height: TRACK_HEIGHT,
                    borderBottom: '1px solid rgba(255,255,255,0.035)',
                    background: isAlt ? 'rgba(8,10,22,0.9)' : 'rgba(5,7,16,0.95)',
                  }}
                  onDoubleClick={(e) => {
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
                  {/* Bar grid lines */}
                  <div className="absolute inset-0 pointer-events-none lane-bg">
                    {rulerTicks.filter((t) => t.isBar).map((tick, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: tick.x,
                          width: 1,
                          background: 'rgba(139,127,248,0.06)',
                        }}
                      />
                    ))}
                  </div>

                  {/* Clips */}
                  {trackClips.map((clip) => {
                    const left = secToPx(clip.startTime) - scrollLeft;
                    const width = Math.max(MIN_CLIP_WIDTH, secToPx(clip.endTime - clip.startTime));
                    const isDragging = dragRef.current.active && dragRef.current.clipId === clip.id;
                    const isSelected = selectedClipId === clip.id;
                    const asset = clip.type === 'audio'
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
                        onDoubleClick={() => { if (clip.type === 'midi') openPianoRoll(clip.id); }}
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

            {/* Empty arrangement hint */}
            {tracks.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, pointerEvents: 'none',
                color: 'rgba(255,255,255,0.1)', fontSize: 13,
              }}>
                <span style={{ fontSize: 28, opacity: 0.3 }}>◈</span>
                <span>Add a track to get started</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>Drop audio files anywhere</span>
              </div>
            )}
          </div>

          {/* Playhead */}
          {playheadX >= 0 && (
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{
                left: playheadX,
                width: 2,
                background: '#ff4444',
                boxShadow: '0 0 8px 2px rgba(255,68,68,0.5), 0 0 2px rgba(255,68,68,0.8)',
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

      {/* Hint bar */}
      <div
        style={{
          padding: '4px 12px',
          background: 'rgba(4,6,14,0.96)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.18)',
          fontSize: 10,
          letterSpacing: '0.02em',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        Drop audio · Ctrl+Scroll zoom · Click ruler to seek · Del to remove · Double-click MIDI lane to create clip
      </div>
    </div>
  );
}

// ─── TrackHeader ──────────────────────────────────────────────────────────────

function TrackHeader({ track, index, onAddMidi }: {
  track: Track; index: number; onAddMidi: () => void;
}) {
  const { updateTrack } = useStudioStore();

  return (
    <div
      className="flex items-center gap-1.5 px-2 shrink-0"
      style={{
        height: TRACK_HEIGHT,
        borderBottom: '1px solid rgba(255,255,255,0.035)',
        background: 'rgba(6,8,20,0.92)',
        transition: 'background 0.1s',
      }}
    >
      {/* Color accent bar */}
      <div
        style={{
          width: 3,
          alignSelf: 'stretch',
          margin: '8px 0',
          borderRadius: 2,
          background: track.color ?? 'var(--color-accent)',
          boxShadow: `0 0 6px ${track.color ?? 'rgba(139,127,248,0.5)'}`,
          flexShrink: 0,
        }}
      />

      {/* Name + type */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#d4d6f0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track.name}
        </div>
        <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>
          {track.type.toUpperCase()}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <TrackBtn
            label="M"
            active={track.mute}
            activeColor="rgba(245,166,35,0.9)"
            activeBg="rgba(245,166,35,0.18)"
            title="Mute"
            onClick={() => updateTrack(track.id, { mute: !track.mute })}
          />
          <TrackBtn
            label="S"
            active={track.solo}
            activeColor="rgba(32,201,126,0.9)"
            activeBg="rgba(32,201,126,0.15)"
            title="Solo"
            onClick={() => updateTrack(track.id, { solo: !track.solo })}
          />
        </div>
        {track.type === 'midi' && (
          <button
            onClick={onAddMidi}
            title="Add MIDI clip"
            style={{
              height: 14,
              padding: '0 5px',
              background: 'rgba(22, 110, 76, 0.45)',
              border: '1px solid rgba(32,201,126,0.3)',
              borderRadius: 3,
              color: 'rgba(32,201,126,0.9)',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            +MIDI
          </button>
        )}
      </div>
    </div>
  );
}

function TrackBtn({ label, active, activeColor, activeBg, title, onClick }: {
  label: string; active: boolean;
  activeColor: string; activeBg: string;
  title: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 18, height: 18,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 3,
        fontSize: 9, fontWeight: 700,
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
        border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.08)',
        background: active ? activeBg : 'rgba(255,255,255,0.04)',
        color: active ? activeColor : 'rgba(255,255,255,0.25)',
        boxShadow: active ? `0 0 6px ${activeColor}` : 'none',
      }}
    >
      {label}
    </button>
  );
}

// ─── ClipBlock ────────────────────────────────────────────────────────────────

function ClipBlock({
  clip, asset, track, left, width, isSelected, isDragging, dragOverlayRef,
  onMoveStart, onResizeStart, onSelect, onDoubleClick, onContextMenu,
}: {
  clip: AudioClip | MidiClip;
  asset: AudioAsset | null;
  track: Track;
  left: number; width: number;
  isSelected: boolean; isDragging: boolean;
  dragOverlayRef?: React.MutableRefObject<HTMLDivElement | null>;
  onMoveStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const refCb = useCallback(
    (el: HTMLDivElement | null) => { if (dragOverlayRef) dragOverlayRef.current = el; },
    [dragOverlayRef]
  );

  const base = track.color ?? (clip.type === 'audio' ? '#2852b8' : '#166e4c');
  // Convert hex to rgba for gradient
  const headerBg = base;

  return (
    <div
      ref={refCb}
      className="absolute overflow-hidden flex flex-col"
      style={{
        top: 4, bottom: 4, left, width,
        borderRadius: 5,
        border: isSelected
          ? '1px solid rgba(255,255,255,0.5)'
          : '1px solid rgba(255,255,255,0.1)',
        cursor: 'grab',
        zIndex: isDragging ? 50 : 1,
        background: `linear-gradient(160deg, ${base}cc 0%, ${base}99 100%)`,
        boxShadow: isSelected
          ? `0 0 0 1px rgba(255,255,255,0.25), 0 0 12px rgba(139,127,248,0.25)`
          : '0 1px 4px rgba(0,0,0,0.4)',
        transition: isDragging ? 'none' : 'box-shadow 0.12s',
        willChange: isDragging ? 'transform' : undefined,
      }}
      onPointerDown={onMoveStart}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onContextMenu={onContextMenu}
    >
      {/* Header stripe */}
      <div
        style={{
          height: 15, flexShrink: 0,
          background: `${headerBg}`,
          display: 'flex', alignItems: 'center',
          padding: '0 5px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clip.name}
        </span>
        {clip.muted && (
          <span style={{ color: 'rgba(245,166,35,0.9)', fontSize: 8, marginLeft: 3, fontWeight: 700 }}>M</span>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '1px 2px' }}>
        {clip.type === 'audio' && asset && (
          <WaveformMiniature peaks={asset.waveformPeaks} />
        )}
        {clip.type === 'midi' && (
          <MidiMiniature notes={(clip as MidiClip).notes} duration={clip.endTime - clip.startTime} />
        )}
      </div>

      {/* Resize grip */}
      <div
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 8, cursor: 'ew-resize', zIndex: 2 }}
        onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
      >
        <div style={{
          position: 'absolute', top: '50%', right: 2,
          transform: 'translateY(-50%)',
          width: 2, height: 12, borderRadius: 1,
          background: 'rgba(255,255,255,0.25)',
        }} />
      </div>
    </div>
  );
}

function WaveformMiniature({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${peaks.length} 32`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {peaks.map((p, i) => (
        <line key={i} x1={i} y1={16 - p * 13} x2={i} y2={16 + p * 13}
          stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      ))}
    </svg>
  );
}

function MidiMiniature({ notes, duration }: { notes: MidiClip['notes']; duration: number }) {
  if (!notes.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
        empty
      </div>
    );
  }
  const minNote = Math.min(...notes.map((n) => n.note));
  const maxNote = Math.max(...notes.map((n) => n.note));
  const noteRange = Math.max(1, maxNote - minNote);
  const totalBeats = Math.max(1, duration * 2);
  return (
    <svg width="100%" height="100%" style={{ display: 'block' }}>
      {notes.map((n) => (
        <rect key={n.id}
          x={`${(n.startBeat / totalBeats) * 100}%`}
          y={`${((maxNote - n.note) / noteRange) * 78 + 11}%`}
          width={`${Math.max(1.5, (n.durationBeats / totalBeats) * 100)}%`}
          height="9%"
          fill="rgba(255,255,255,0.75)" rx="0.5"
        />
      ))}
    </svg>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function ClipContextMenu({ x, y, clipId, clipType, onClose, onDelete, onDuplicate, onSplit, onOpenPianoRoll }: {
  x: number; y: number; clipId: string; clipType: 'audio' | 'midi';
  onClose: () => void; onDelete: () => void; onDuplicate: () => void;
  onSplit: () => void; onOpenPianoRoll?: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', left: x, top: y,
        background: 'rgba(10,13,28,0.96)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        minWidth: 148,
        padding: '4px 0',
        zIndex: 50,
      }}
    >
      {onOpenPianoRoll && <CtxItem label="Open Piano Roll" onClick={onOpenPianoRoll} icon="⊞" />}
      <CtxItem label="Duplicate  Ctrl+D" onClick={onDuplicate} icon="⧉" />
      {clipType === 'audio' && <CtxItem label="Split at Playhead" onClick={onSplit} icon="⊘" />}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '3px 0' }} />
      <CtxItem label="Delete" onClick={onDelete} danger icon="✕" />
    </div>
  );
}

function CtxItem({ label, onClick, danger, icon }: {
  label: string; onClick: () => void; danger?: boolean; icon?: string;
}) {
  return (
    <button
      style={{
        display: 'flex', width: '100%', textAlign: 'left',
        padding: '6px 12px', gap: 8,
        background: 'transparent',
        border: 'none', cursor: 'pointer',
        color: danger ? '#ff7777' : 'rgba(210,213,240,0.85)',
        fontSize: 11, fontWeight: 400,
        transition: 'background 0.08s, color 0.08s',
        alignItems: 'center',
      }}
      onClick={onClick}
    >
      {icon && <span style={{ fontSize: 10, opacity: 0.7, width: 12, flexShrink: 0 }}>{icon}</span>}
      {label}
    </button>
  );
}
