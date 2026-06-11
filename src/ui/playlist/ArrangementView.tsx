import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { AudioClip, AudioAsset, MidiClip, Track } from '../../lib/project/projectSchema.js';
import { useWubGuide } from '../assistant/useWubGuide.js';

const TRACK_HEADER_WIDTH = 176;
const TRACK_HEIGHT = 58;
const RULER_HEIGHT = 28;
const MIN_CLIP_WIDTH = 4;

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

function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

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
  const { beginnerModeEnabled, askGuide } = useWubGuide();

  const containerRef = useRef<HTMLDivElement>(null);
  const laneAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false, type: 'move', clipId: '', clipType: 'audio',
    startClientX: 0, startClientY: 0, originalStart: 0, originalEnd: 0,
    originalTrackId: '', trackIndex: 0, containerLeft: 0, containerTop: 0,
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
            label: '', isBar: false,
          });
        }
      }
    }
  }

  const playheadX = secToPx(position) - scrollLeft;

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => setScrollLeft(e.currentTarget.scrollLeft),
    [setScrollLeft]
  );

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
      active: true, type, clipId: clip.id,
      clipType: clip.type, startClientX: e.clientX, startClientY: e.clientY,
      originalStart: clip.startTime, originalEnd: clip.endTime,
      originalTrackId: clip.trackId, trackIndex,
      containerLeft: container.left, containerTop: container.top,
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

  function handleRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + scrollLeft;
    useStudioStore.getState().seek(pxToSec(px));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('audio/')) void importFile(file);
    }
  }

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

  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; clipId: string; clipType: 'audio' | 'midi';
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
      className="flex flex-col flex-1 overflow-hidden panel-float relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      data-wubguide-target="arrangement"
      aria-label="Arrangement view"
    >
      {beginnerModeEnabled && (
        <button
          type="button"
          className="wubguide-panel-help wubguide-panel-help-arrangement"
          onClick={() => askGuide('What is the arrangement view?')}
          aria-label="Get help with the arrangement view"
          title="Ask WubGuide about the arrangement"
        >
          ? Arrangement
        </button>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Track header column ──────────────────────────────────────── */}
        <div
          className="flex flex-col shrink-0 overflow-y-auto"
          style={{
            width: TRACK_HEADER_WIDTH,
            background: 'linear-gradient(180deg, rgba(10,14,30,0.96), rgba(5,7,18,0.95))',
            borderRight: '1px solid var(--color-border-soft)',
          }}
        >
          {/* Ruler spacer */}
          <div className="shrink-0 flex items-center px-3" style={{
            height: RULER_HEIGHT,
            borderBottom: '1px solid rgba(139,127,248,0.14)',
            background: 'linear-gradient(180deg, rgba(8,11,24,0.98), rgba(4,6,14,0.98))',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: 'rgba(206,208,234,0.42)', textTransform: 'uppercase',
            }}>Bars</span>
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

          {tracks.length === 0 && (
            <div style={{
              padding: '18px 12px', color: 'rgba(206,208,234,0.38)',
              fontSize: 12, lineHeight: 1.6, textAlign: 'center',
            }}>
              No tracks yet.<br />Add one below.
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, padding: '8px 8px 10px' }}>
            <AddTrackBtn label="+ Audio" onClick={() => addTrack('audio')} />
            <AddTrackBtn label="+ MIDI"  onClick={() => addTrack('midi')} />
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
                background: 'linear-gradient(180deg, rgba(9,13,28,0.99) 0%, rgba(5,8,19,0.97) 100%)',
                borderBottom: '1px solid rgba(139,127,248,0.2)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
              }}
              onClick={handleRulerClick}
            >
              {rulerTicks.map((tick, i) => (
                <div key={i} className="absolute top-0 bottom-0 flex flex-col justify-start"
                  style={{ left: tick.x }}>
                  <div style={{
                    width: 1,
                    height: tick.isBar ? 16 : 7,
                    background: tick.isBar ? 'rgba(139,127,248,0.58)' : 'rgba(206,208,234,0.14)',
                    marginTop: tick.isBar ? 0 : 9,
                  }} />
                  {tick.isBar && tick.label && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: 'rgba(206,208,255,0.72)',
                      paddingLeft: 4, marginTop: 1,
                      userSelect: 'none', letterSpacing: '0.03em',
                    }}>
                      {tick.label}
                    </span>
                  )}
                </div>
              ))}

              {loopState.loopEnabled && (
                <div className="absolute top-0 bottom-0" style={{
                  left: secToPx(loopState.loopStart) - scrollLeft,
                  width: secToPx(loopState.loopEnd - loopState.loopStart),
                  background: 'linear-gradient(90deg, rgba(139,127,248,0.18), rgba(91,156,248,0.12))',
                  borderLeft: '1px solid rgba(139,127,248,0.58)',
                  borderRight: '1px solid rgba(139,127,248,0.58)',
                  boxShadow: 'inset 0 0 18px rgba(139,127,248,0.08)',
                }} />
              )}
            </div>

            {/* Track lanes */}
            {tracks.map((track, trackIndex) => {
              const trackClips = allClips.filter((c) => c.trackId === track.id);
              const isAlt = trackIndex % 2 === 1;
              return (
                <div
                  key={track.id}
                  className="relative track-lane"
                  style={{
                    height: TRACK_HEIGHT,
                    borderBottom: '1px solid rgba(255,255,255,0.035)',
                    background: isAlt
                      ? 'linear-gradient(180deg, rgba(11,14,30,0.84), rgba(8,10,22,0.9))'
                      : 'linear-gradient(180deg, rgba(8,11,24,0.92), rgba(6,8,18,0.95))',
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
                  <div className="absolute inset-0 pointer-events-none lane-bg">
                    {rulerTicks.filter((t) => t.isBar).map((tick, i) => (
                      <div key={i} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: tick.x, width: 1,
                        background: 'linear-gradient(180deg, rgba(139,127,248,0.12), rgba(91,156,248,0.045))',
                      }} />
                    ))}
                  </div>

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

            {/* Empty hint */}
            {tracks.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 36, opacity: 0.18, color: 'var(--color-accent)' }}>◈</span>
                <span style={{ color: 'rgba(238,238,255,0.58)', fontSize: 13, fontWeight: 600 }}>Add a track to start arranging</span>
                <span style={{ color: 'rgba(206,208,234,0.32)', fontSize: 11 }}>Drop audio files anywhere or create MIDI from a lane</span>
              </div>
            )}
          </div>

          {/* Playhead — gradient with glow */}
          {playheadX >= 0 && (
            <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{
              left: playheadX,
              width: 2,
              background: 'linear-gradient(to bottom, #ff8b8b, #ff3f6f)',
              boxShadow: '0 0 20px rgba(255,70,110,0.72), 0 0 6px rgba(255,255,255,0.5)',
            }} />
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

      <div style={{
        padding: '3px 12px',
        background: 'linear-gradient(180deg, rgba(8,11,24,0.94), rgba(4,6,14,0.96))',
        borderTop: '1px solid rgba(255,255,255,0.045)',
        color: 'rgba(206,208,234,0.32)',
        fontSize: 10, letterSpacing: '0.02em',
        userSelect: 'none', flexShrink: 0,
      }}>
        Drop audio · Ctrl+Scroll zoom · Click ruler to seek · Del to remove · Double-click MIDI lane to create clip
      </div>
    </div>
  );
}

// ─── AddTrackBtn ──────────────────────────────────────────────────────────────

function AddTrackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 24,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
      border: '1px solid var(--color-border-soft)',
      borderRadius: 7, color: 'rgba(206,208,234,0.62)',
      fontSize: 10, fontWeight: 500, cursor: 'pointer',
      transition: 'background 0.12s, color 0.12s',
    }}>
      {label}
    </button>
  );
}

// ─── TrackHeader ──────────────────────────────────────────────────────────────

function TrackHeader({ track, onAddMidi }: {
  track: Track; index: number; onAddMidi: () => void;
}) {
  const { updateTrack } = useStudioStore();
  const { beginnerModeEnabled, askGuide } = useWubGuide();
  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0" style={{
      height: TRACK_HEIGHT,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      background: 'linear-gradient(180deg, rgba(13,16,34,0.86), rgba(7,9,22,0.92))',
    }} data-wubguide-target="track-header">
      <div style={{
        width: 3, alignSelf: 'stretch', margin: '8px 0', borderRadius: 2, flexShrink: 0,
        background: track.color ?? '#8B5CF6',
        boxShadow: `0 0 10px ${track.color ?? 'rgba(139,127,248,0.6)'}`,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 650, color: 'var(--color-text-bright)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track.name}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.07em',
          color: 'rgba(206,208,234,0.34)', marginTop: 1,
        }}>
          {track.type.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <TrackBtn label="M" active={track.mute}
            activeColor="rgba(245,166,35,0.9)" activeBg="rgba(245,166,35,0.18)"
            title="Mute" onClick={() => updateTrack(track.id, { mute: !track.mute })} />
          <TrackBtn label="S" active={track.solo}
            activeColor="rgba(34,201,126,0.9)" activeBg="rgba(34,201,126,0.15)"
            title="Solo" onClick={() => updateTrack(track.id, { solo: !track.solo })} />
        </div>
        {track.type === 'midi' && (
          <button onClick={onAddMidi} title="Add MIDI clip" style={{
            height: 14, padding: '0 5px',
            background: 'rgba(22,110,76,0.45)',
            border: '1px solid rgba(34,201,126,0.3)',
            borderRadius: 3, color: 'rgba(34,201,126,0.9)',
            fontSize: 9, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
          }}>
            +MIDI
          </button>
        )}
        {beginnerModeEnabled && (
          <button
            type="button"
            className="wubguide-mini-help"
            onClick={() => askGuide(track.type === 'midi' ? 'How do I make a MIDI clip?' : 'How do I mute a track?')}
            aria-label={`Get help with ${track.name}`}
            title="Ask WubGuide about this track"
          >
            ?
          </button>
        )}
      </div>
    </div>
  );
}

function TrackBtn({ label, active, activeColor, activeBg, title, onClick }: {
  label: string; active: boolean; activeColor: string; activeBg: string; title: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: 'pointer',
      transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
      border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.08)',
      background: active ? activeBg : 'rgba(255,255,255,0.04)',
      color: active ? activeColor : 'rgba(255,255,255,0.25)',
      boxShadow: active ? `0 0 6px ${activeColor}` : 'none',
    }}>
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

  const base = track.color ?? (clip.type === 'audio' ? '#3b5bdb' : '#166e4c');

  return (
    <div
      ref={refCb}
      className="absolute overflow-hidden flex flex-col"
      data-wubguide-target="clip"
      aria-label={`${clip.type} clip ${clip.name}`}
      style={{
        top: 4, bottom: 4, left, width,
        borderRadius: 9,
        border: isSelected ? '1px solid rgba(238,238,255,0.72)' : '1px solid rgba(255,255,255,0.13)',
        cursor: 'grab', zIndex: isDragging ? 50 : 1,
        background: `linear-gradient(160deg, ${base}f0 0%, ${base}ad 58%, rgba(7,10,22,0.48) 100%)`,
        boxShadow: isSelected
          ? '0 0 0 1px rgba(139,127,248,0.42), 0 0 22px rgba(139,127,248,0.28), 0 8px 20px rgba(0,0,0,0.32)'
          : '0 3px 10px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)',
        transition: isDragging ? 'none' : 'box-shadow 0.12s',
        willChange: isDragging ? 'transform' : undefined,
      }}
      onPointerDown={onMoveStart}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      onContextMenu={onContextMenu}
    >
      <div style={{
        height: 16, flexShrink: 0,
        background: `linear-gradient(90deg, ${base}, rgba(255,255,255,0.08))`,
        display: 'flex', alignItems: 'center',
        padding: '0 7px',
        borderBottom: '1px solid rgba(255,255,255,0.13)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.94)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {clip.name}
        </span>
        {clip.muted && (
          <span style={{ color: 'rgba(245,166,35,0.9)', fontSize: 8, marginLeft: 3, fontWeight: 700 }}>M</span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '1px 2px' }}>
        {clip.type === 'audio' && asset && (
          <WaveformMiniature peaks={asset.waveformPeaks} />
        )}
        {clip.type === 'midi' && (
          <MidiMiniature notes={(clip as MidiClip).notes} duration={clip.endTime - clip.startTime} />
        )}
      </div>

      <div
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 8, cursor: 'ew-resize', zIndex: 2 }}
        onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
      >
        <div style={{
          position: 'absolute', top: '50%', right: 2,
          transform: 'translateY(-50%)',
          width: 2, height: 14, borderRadius: 1,
          background: 'rgba(255,255,255,0.5)',
        }} />
      </div>
    </div>
  );
}

function WaveformMiniature({ peaks }: { peaks: number[] }) {
  if (!peaks.length) return null;
  return (
    <svg width="100%" height="100%"
      viewBox={`0 0 ${peaks.length} 32`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}>
      {peaks.map((p, i) => (
        <line key={i} x1={i} y1={16 - p * 13} x2={i} y2={16 + p * 13}
          stroke="rgba(238,238,255,0.68)" strokeWidth="1" />
      ))}
    </svg>
  );
}

function MidiMiniature({ notes, duration }: { notes: MidiClip['notes']; duration: number }) {
  if (!notes.length) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(238,238,255,0.45)', fontSize: 10,
      }}>empty</div>
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
          height="9%" fill="rgba(238,238,255,0.82)" rx="1"
        />
      ))}
    </svg>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function ClipContextMenu({ x, y, clipType, onClose, onDelete, onDuplicate, onSplit, onOpenPianoRoll }: {
  x: number; y: number; clipId: string; clipType: 'audio' | 'midi';
  onClose: () => void; onDelete: () => void; onDuplicate: () => void;
  onSplit: () => void; onOpenPianoRoll?: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', left: x, top: y,
      background: 'linear-gradient(180deg, rgba(17,20,39,0.96), rgba(8,10,24,0.96))',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      boxShadow: '0 12px 38px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.04), 0 0 24px rgba(139,127,248,0.12)',
      minWidth: 152, padding: '4px 0', zIndex: 50,
    }}>
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
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: danger ? '#ff7777' : 'rgba(210,213,240,0.85)',
        fontSize: 12, fontWeight: 400, alignItems: 'center',
        transition: 'background 0.08s',
      }}
      onClick={onClick}
    >
      {icon && <span style={{ fontSize: 10, opacity: 0.7, width: 12, flexShrink: 0 }}>{icon}</span>}
      {label}
    </button>
  );
}
