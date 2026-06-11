import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { meterRegistry } from '../../audio/metering/MeterRegistry.js';
import { createSilentMeterLevel, type MeterLevel, type MeterSample } from '../../audio/metering/meterTypes.js';
import { useMeterLevels } from '../../audio/metering/useMeterLevels.js';
import { useStudioStore, studioController } from '../../state/useStudioStore.js';
import type { MixerChannelState, Track } from '../../lib/project/projectSchema.js';
import { useWubGuide } from '../assistant/useWubGuide.js';

const CHANNEL_WIDTH = 100;
const FADER_HEIGHT = 116;
const METER_SEGMENTS = 18;

function gainToDb(v: number): string {
  if (v <= 0) return '-∞';
  const db = 20 * Math.log10(v);
  return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
}

type ChannelViewItem = {
  track: Track;
  state: MixerChannelState;
};

// ─── Panel ────────────────────────────────────────────────────────────────────

export function MixerPanel() {
  const project = useStudioStore((state) => state.project);
  const isPlaying = useStudioStore((state) => state.isPlaying);
  const position = useStudioStore((state) => state.position);
  const updateChannel = useStudioStore((state) => state.updateChannel);
  const { beginnerModeEnabled, askGuide, markProgress } = useWubGuide();
  const meterSnapshot = useMeterLevels();
  const channels: ChannelViewItem[] = project.tracks.map((track) => ({
    track,
    state: project.mixerState[track.id] ?? {
      trackId: track.id,
      gain: 1, pan: 0,
      mute: false, solo: false, armed: false,
      sendLevels: {},
    },
  }));
  const trackIdsKey = useMemo(() => channels.map(({ track }) => track.id).join('|'), [channels]);
  const latestStateRef = useRef({ project, isPlaying, position, channels });

  useEffect(() => {
    latestStateRef.current = { project, isPlaying, position, channels };
  }, [project, isPlaying, position, channels]);

  useEffect(() => {
    meterRegistry.registerChannel('master', { kind: 'master', label: 'Master' });
    for (const { track } of channels) {
      meterRegistry.registerChannel(track.id, { kind: 'track', label: track.name });
    }

    return () => {
      for (const { track } of channels) {
        meterRegistry.unregisterChannel(track.id);
      }
      meterRegistry.unregisterChannel('master');
    };
  }, [trackIdsKey]);

  useEffect(() => {
    if (!isPlaying) return;

    let frame = 0;
    const tick = () => {
      const { project: currentProject, isPlaying: playing, position: currentPosition, channels: currentChannels } = latestStateRef.current;
      const busLevels = studioController.busGraph.getBusLevels();
    meterRegistry.updateLevels(buildMeterSamples({
        project: currentProject,
        channels: currentChannels,
        position: currentPosition,
        isPlaying: playing,
        busLevels,
      }));

      if (playing || meterRegistry.hasActiveLevels()) {
        frame = requestFrame(tick);
      }
    };

    frame = requestFrame(tick);
    return () => cancelFrame(frame);
  }, [isPlaying, trackIdsKey]);

  return (
    <div
      className="panel-float"
      data-wubguide-target="mixer"
      aria-label="Mixer panel"
      style={{
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, userSelect: 'none',
        height: 260,
      }}
    >
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 12px', height: 32, flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(14,18,38,0.96), rgba(6,8,20,0.95))',
        borderBottom: '1px solid rgba(139,127,248,0.12)',
        gap: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-bright)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Mixer
        </span>
        <span style={{ fontSize: 11, color: 'rgba(206,208,234,0.36)' }}>
          {channels.length} ch
        </span>
        {beginnerModeEnabled && (
          <button
            type="button"
            className="wubguide-section-help"
            onClick={() => askGuide('What is the mixer?')}
            aria-label="Get help with the mixer"
            title="Ask WubGuide about the mixer"
          >
            ?
          </button>
        )}
      </div>

      {/* Channel strips */}
      <div style={{
        display: 'flex', flex: 1,
        overflowX: 'auto', overflowY: 'hidden',
        padding: '8px',
        gap: 6,
        alignItems: 'flex-start',
      }}>
        {channels.map(({ track, state }) => (
          <ChannelStrip
            key={track.id}
            track={track}
            channel={state}
            level={meterSnapshot.levels[track.id] ?? createSilentMeterLevel(track.id, meterSnapshot.timestamp)}
            peakHold={meterSnapshot.peakHolds[track.id] ?? 0}
            onChange={(patch) => {
              markProgress({ openedMixer: true });
              updateChannel(track.id, patch);
            }}
          />
        ))}

        {channels.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(206,208,234,0.38)', fontSize: 12,
          }}>
            No tracks · Add a track in the arrangement view
          </div>
        )}

        {/* Master */}
        <div style={{
          width: CHANNEL_WIDTH, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'flex-end', paddingBottom: 6,
          marginLeft: 8, paddingLeft: 8,
          borderLeft: '1px solid rgba(139,127,248,0.18)',
        }}>
          <div style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(139,127,248,0.68)',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            marginBottom: 6, textTransform: 'uppercase',
          }}>
            Master
          </div>
          <MasterFader
            level={meterSnapshot.levels.master ?? createSilentMeterLevel('master', meterSnapshot.timestamp)}
            peakHold={meterSnapshot.peakHolds.master ?? 0}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Channel strip ────────────────────────────────────────────────────────────

function ChannelStrip({
  track, channel, onChange,
  level, peakHold,
}: {
  track: Track;
  channel: MixerChannelState;
  onChange: (patch: Partial<MixerChannelState>) => void;
  level: MeterLevel;
  peakHold: number;
}) {
  const [hovered, setHovered] = useState(false);

  const handlePanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startPan = channel.pan;
      function move(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        onChange({ pan: Math.max(-1, Math.min(1, Math.round((startPan + dx / 60) * 100) / 100)) });
      }
      function up() {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
      }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    },
    [channel.pan, onChange]
  );

  const handleFaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startVol = channel.gain;
      function move(ev: PointerEvent) {
        const dy = ev.clientY - startY;
        onChange({ gain: Math.max(0, Math.min(1.5, Math.round((startVol - dy / FADER_HEIGHT) * 1000) / 1000)) });
      }
      function up() {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
      }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    },
    [channel.gain, onChange]
  );

  const faderPos = Math.max(0, Math.min(1, channel.gain / 1.5));
  const faderY = FADER_HEIGHT * (1 - faderPos);
  const panPercent = ((channel.pan + 1) / 2) * 100;
  const trackColor = track.color ?? '#8B5CF6';

  const isHighlighted = channel.solo || hovered;
  const meterSegments: Array<{ index: number; threshold: number; zone: 'green' | 'yellow' | 'red'; active: boolean; rmsActive: boolean }> = Array.from({ length: METER_SEGMENTS }, (_, index) => {
    const threshold = (index + 1) / METER_SEGMENTS;
    return {
      index,
      threshold,
      zone: threshold > 0.86 ? 'red' : threshold > 0.62 ? 'yellow' : 'green',
      active: level.peak >= threshold,
      rmsActive: level.rms >= threshold,
    };
  });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: CHANNEL_WIDTH, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '6px 4px 6px',
        borderRadius: 14,
        background: channel.mute
          ? 'linear-gradient(180deg, rgba(15,17,30,0.44), rgba(8,10,20,0.38))'
          : 'linear-gradient(180deg, rgba(27,32,58,0.72), rgba(9,12,28,0.82))',
        border: isHighlighted
          ? '1px solid rgba(139,127,248,0.42)'
          : '1px solid rgba(255,255,255,0.065)',
        opacity: channel.mute ? 0.45 : 1,
        transition: 'opacity 0.15s, border-color 0.15s, box-shadow 0.15s',
        boxShadow: channel.solo
          ? '0 0 24px rgba(139,127,248,0.28), inset 0 1px 0 rgba(255,255,255,0.08)'
          : hovered
            ? '0 0 16px rgba(91,156,248,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
            : 'inset 0 1px 0 rgba(255,255,255,0.035)',
      }}
    >
      {/* Color bar */}
      <div style={{
        width: '75%', height: 3, borderRadius: 2,
        background: trackColor,
        boxShadow: `0 0 8px ${trackColor}88`,
      }} />

      {/* Name */}
      <div style={{
        width: '100%', textAlign: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--color-text-bright)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1, padding: '0 4px',
      }} title={track.name}>
        {track.name}
      </div>

      {/* Meter + fader row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: '100%', justifyContent: 'center' }}>
        <LevelMeter
          label={track.name}
          level={level}
          peakHold={peakHold}
          segments={meterSegments}
        />

        <div
          style={{
            position: 'relative', width: 24, borderRadius: 6, cursor: 'ns-resize',
            height: FADER_HEIGHT,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.64), rgba(8,12,26,0.78))',
            border: '1px solid rgba(255,255,255,0.075)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
          }}
          onPointerDown={handleFaderPointerDown}
          onDoubleClick={() => onChange({ gain: 1 })}
        >
          {/* Level ticks */}
          {[0, 0.33, 0.67, 1].map((v, i) => (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: FADER_HEIGHT * (1 - v / 1.5), height: 1,
              background: 'rgba(255,255,255,0.08)',
            }} />
          ))}
          {/* Unity (0dB) tick */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: FADER_HEIGHT * (1 - 1 / 1.5), height: 1,
            background: 'rgba(139,127,248,0.48)',
          }} />

          {/* Gradient fill — purple to indigo */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '0 0 6px 6px',
            top: faderY,
            background: channel.solo
              ? 'linear-gradient(to top, rgba(34,201,126,0.6), rgba(22,160,100,0.35))'
              : `linear-gradient(to top, #8b7ff8, #5b9cf8)`,
            opacity: 0.55 + faderPos * 0.3,
          }} />

          {/* Fader cap */}
          <div style={{
            position: 'absolute', left: -3, right: -3,
            top: faderY - 8, height: 16, borderRadius: 6,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
            border: '1px solid rgba(255,255,255,0.28)',
            boxShadow: '0 2px 9px rgba(0,0,0,0.48), 0 0 12px rgba(139,127,248,0.26), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}>
            {[-2.5, 0, 2.5].map((dy, i) => (
              <div key={i} style={{
                position: 'absolute', left: 5, right: 5,
                top: `calc(50% + ${dy}px)`, height: 1,
                background: 'rgba(255,255,255,0.4)',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* M / S */}
      <div style={{ display: 'flex', gap: 4 }}>
        <MixerBtn label="M" active={channel.mute}
          activeColor="rgba(245,166,35,0.95)" activeBg="rgba(245,166,35,0.18)"
          title="Mute" onClick={() => onChange({ mute: !channel.mute })} />
        <MixerBtn label="S" active={channel.solo}
          activeColor="rgba(34,201,126,0.95)" activeBg="rgba(34,201,126,0.15)"
          title="Solo" onClick={() => onChange({ solo: !channel.solo })} />
      </div>

      {/* Pan strip */}
      <div style={{ width: '100%' }}
        title={`Pan: ${channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}` : `L${Math.round(-channel.pan * 100)}`}`}
      >
        <div
          style={{
            width: '100%', height: 7, borderRadius: 4, position: 'relative',
            background: 'linear-gradient(90deg, rgba(91,156,248,0.08), rgba(255,255,255,0.065), rgba(139,127,248,0.08))',
            cursor: 'ew-resize',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
          onPointerDown={handlePanPointerDown}
          onDoubleClick={() => onChange({ pan: 0 })}
        >
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1,
            background: 'rgba(255,255,255,0.14)',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
            left: channel.pan <= 0 ? `${panPercent}%` : '50%',
            width: `${Math.abs(channel.pan) * 50}%`,
            background: 'linear-gradient(90deg, rgba(139,127,248,0.78), rgba(91,156,248,0.7))',
          }} />
          <div style={{
            position: 'absolute', top: -2, bottom: -2,
            left: `calc(${panPercent}% - 4px)`,
            width: 7, borderRadius: 3,
            background: '#c8c3ff',
            boxShadow: '0 0 7px rgba(139,127,248,0.72)',
          }} />
        </div>
        <div style={{
          textAlign: 'center', fontSize: 10, color: 'rgba(206,208,234,0.36)',
          marginTop: 2, lineHeight: 1,
        }}>
          {channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}` : `L${Math.round(-channel.pan * 100)}`}
        </div>
      </div>

      {/* dB readout */}
      <div style={{
        fontSize: 10, fontFamily: 'monospace', fontWeight: 500, lineHeight: 1,
        color: faderPos > 0.78 ? '#f5a623' : 'rgba(206,208,234,0.42)',
      }}>
        {gainToDb(channel.gain)}
      </div>
    </div>
  );
}

function LevelMeter({
  label,
  level,
  peakHold,
  segments,
}: {
  label: string;
  level: MeterLevel;
  peakHold: number;
  segments: Array<{ index: number; threshold: number; zone: 'green' | 'yellow' | 'red'; active: boolean; rmsActive: boolean }>;
}) {
  return (
    <div
      className="mixer-meter-well"
      aria-label={`${label} level meter`}
      data-clipping={level.clipping ? 'true' : 'false'}
    >
      <div className="mixer-meter-glass" aria-hidden="true" />
      <div className="mixer-meter-segment-stack" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment.index}
            className="mixer-meter-segment"
            data-zone={segment.zone}
            data-active={segment.active ? 'true' : 'false'}
            data-rms={segment.rmsActive ? 'true' : 'false'}
          />
        ))}
      </div>
      <span
        className="mixer-meter-peak"
        aria-hidden="true"
        style={{ bottom: `${Math.max(0, Math.min(1, peakHold)) * 100}%` }}
      />
      {level.clipping && <span className="mixer-meter-clip" aria-hidden="true" />}
    </div>
  );
}

// ─── Mixer button ─────────────────────────────────────────────────────────────

function MixerBtn({
  label, active, activeColor, activeBg, title, onClick,
}: {
  label: string; active: boolean;
  activeColor: string; activeBg: string;
  title: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 22, height: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
      border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.08)',
      background: active ? activeBg : 'rgba(255,255,255,0.04)',
      color: active ? activeColor : 'rgba(206,208,234,0.36)',
      boxShadow: active ? `0 0 7px ${activeColor}` : 'none',
      transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
    }}>
      {label}
    </button>
  );
}

// ─── Master fader ─────────────────────────────────────────────────────────────

function MasterFader({
  level,
  peakHold,
}: {
  level: MeterLevel;
  peakHold: number;
}) {
  const [vol, setVol] = useState(1);
  const faderPos = Math.max(0, Math.min(1, vol / 1.5));
  const faderY = FADER_HEIGHT * (1 - faderPos);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startVol = vol;
    function move(ev: PointerEvent) {
      setVol(Math.max(0, Math.min(1.5, startVol - (ev.clientY - startY) / FADER_HEIGHT)));
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <LevelMeter
          label="Master"
          level={level}
          peakHold={peakHold}
          segments={Array.from({ length: METER_SEGMENTS }, (_, index) => {
            const threshold = (index + 1) / METER_SEGMENTS;
            return {
              index,
              threshold,
              zone: threshold > 0.86 ? 'red' : threshold > 0.62 ? 'yellow' : 'green',
              active: level.peak >= threshold,
              rmsActive: level.rms >= threshold,
            };
          })}
        />
        <div
          style={{
            position: 'relative', width: 24, borderRadius: 6, cursor: 'ns-resize',
            height: FADER_HEIGHT,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.66), rgba(8,12,26,0.8))',
            border: '1px solid rgba(139,127,248,0.24)',
          }}
          onPointerDown={handlePointerDown}
          onDoubleClick={() => setVol(1)}
        >
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '0 0 6px 6px',
            top: faderY,
            background: 'linear-gradient(to top, #8b7ff8, #5b9cf8)',
            opacity: 0.6 + faderPos * 0.3,
          }} />
          <div style={{
            position: 'absolute', left: -3, right: -3,
            top: faderY - 8, height: 16, borderRadius: 6,
            background: 'linear-gradient(180deg, rgba(238,238,255,0.35) 0%, rgba(139,127,248,0.2) 100%)',
            border: '1px solid rgba(139,127,248,0.48)',
            boxShadow: '0 0 14px rgba(139,127,248,0.38), inset 0 1px 0 rgba(255,255,255,0.16)',
          }}>
            {[-2.5, 0, 2.5].map((dy, i) => (
              <div key={i} style={{
                position: 'absolute', left: 5, right: 5,
                top: `calc(50% + ${dy}px)`, height: 1,
                background: 'rgba(255,255,255,0.45)',
              }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(139,127,248,0.72)', lineHeight: 1 }}>
        {gainToDb(vol)}
      </div>
    </div>
  );
}

function buildMeterSamples({
  project,
  channels,
  position,
  isPlaying,
  busLevels,
}: {
  project: {
    bpm: number;
    tracks: Track[];
    audioClips: Array<{ trackId: string; startTime: number; endTime: number; clipGain: number; type: 'audio' | 'midi' }>;
    midiClips: Array<{ trackId: string; startTime: number; endTime: number; clipGain: number; type: 'audio' | 'midi' }>;
    mixerState: Record<string, MixerChannelState>;
  };
  channels: ChannelViewItem[];
  position: number;
  isPlaying: boolean;
  busLevels: Record<string, number>;
}): MeterSample[] {
  const samples: MeterSample[] = [];
  const hasSolo = channels.some(({ state }) => state.solo || project.mixerState[state.trackId]?.solo);
  const channelLevels = channels.map(({ track }) =>
    buildTrackMeterLevel({
      track,
      channel: project.mixerState[track.id] ?? defaultChannelState(track.id),
      project,
      position,
      isPlaying,
      hasSolo,
    })
  );

  samples.push(...channelLevels);
  samples.push(buildMasterMeterLevel(channelLevels, busLevels, position, isPlaying));
  return samples;
}

function buildTrackMeterLevel({
  track,
  channel,
  project,
  position,
  isPlaying,
  hasSolo,
}: {
  track: Track;
  channel: MixerChannelState;
  project: {
    bpm: number;
    audioClips: Array<{ trackId: string; startTime: number; endTime: number; clipGain: number; type: 'audio' | 'midi' }>;
    midiClips: Array<{ trackId: string; startTime: number; endTime: number; clipGain: number; type: 'audio' | 'midi' }>;
  };
  position: number;
  isPlaying: boolean;
  hasSolo: boolean;
}): MeterSample {
  const channelGain = clamp01((channel.gain ?? track.gain ?? 1) / 1.5);
  const muted = Boolean(channel.mute || track.mute);
  const soloed = Boolean(channel.solo || track.solo);
  const clips = [
    ...project.audioClips.filter((clip) => clip.trackId === track.id),
    ...project.midiClips.filter((clip) => clip.trackId === track.id),
  ];

  if (!isPlaying || clips.length === 0 || (hasSolo && !soloed) || (muted && !soloed)) {
    return { channelId: track.id, peak: 0, rms: 0, clipping: false };
  }

  const activeClip = clips.find((clip) => position >= clip.startTime && position <= clip.endTime);
  if (!activeClip) {
    return { channelId: track.id, peak: 0, rms: 0, clipping: false };
  }

  const clipSpan = Math.max(activeClip.endTime - activeClip.startTime, 0.1);
  const progress = Math.max(0, Math.min(1, (position - activeClip.startTime) / clipSpan));
  const motion = 0.34 + (0.66 * Math.abs(Math.sin((position * 7.35) + (track.order * 0.77) + (progress * Math.PI))));
  const clipEnergy = activeClip.clipGain * (activeClip.type === 'audio' ? 0.94 : 0.82);
  const panBias = 1 - Math.min(0.1, Math.abs(channel.pan) * 0.05);
  const peak = clamp01(clipEnergy * channelGain * panBias * motion);
  const rms = clamp01(peak * 0.72 + (activeClip.type === 'audio' ? 0.03 : 0.015));

  return {
    channelId: track.id,
    peak,
    rms,
    clipping: peak >= 0.98 || (peak >= 0.94 && activeClip.type === 'audio' && channelGain > 0.9),
  };
}

function buildMasterMeterLevel(
  channelLevels: MeterSample[],
  busLevels: Record<string, number>,
  position: number,
  isPlaying: boolean
): MeterSample {
  const busMaster = dbToLinear(busLevels.master);
  const channelPeak = channelLevels.reduce((max, level) => Math.max(max, level.peak), 0);
  const motion = isPlaying ? 0.92 + (0.08 * Math.abs(Math.sin(position * 2.1))) : 0;
  const peak = clamp01(Math.max(busMaster, channelPeak * motion));
  const rms = clamp01(Math.max(dbToLinear(busLevels.master) * 0.78, channelLevels.reduce((sum, level) => sum + level.rms, 0) / Math.max(1, channelLevels.length)));

  return {
    channelId: 'master',
    peak,
    rms,
    clipping: peak >= 0.98 || dbToLinear(busLevels.master) >= 0.98,
  };
}

function dbToLinear(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  if (value <= -60) return 0;
  return clamp01(Math.pow(10, value / 20));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

type AnimationFrameCallback = (time: number) => void;

function requestFrame(callback: AnimationFrameCallback): number {
  const requestAnimationFrame = (globalThis as any).requestAnimationFrame as
    | ((cb: AnimationFrameCallback) => number)
    | undefined;

  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
}

function cancelFrame(handle: number): void {
  const cancelAnimationFrame = (globalThis as any).cancelAnimationFrame as
    | ((value: number) => void)
    | undefined;

  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}

function defaultChannelState(trackId: string): MixerChannelState {
  return {
    trackId,
    gain: 1,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    sendLevels: {},
  };
}
