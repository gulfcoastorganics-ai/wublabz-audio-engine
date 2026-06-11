import React, { useCallback, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { MixerChannelState, Track } from '../../lib/project/projectSchema.js';

const CHANNEL_WIDTH = 66;
const FADER_HEIGHT = 118;

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
  const { project, updateChannel } = useStudioStore();
  const channels: ChannelViewItem[] = project.tracks.map((track) => ({
    track,
    state: project.mixerState[track.id] ?? {
      trackId: track.id,
      gain: 1,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      sendLevels: {},
    },
  }));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        height: 258,
        background: 'rgba(5,7,18,0.98)',
        borderTop: '2px solid rgba(139,127,248,0.5)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          height: 30,
          flexShrink: 0,
          background: 'rgba(4,6,16,0.98)',
          borderBottom: '1px solid rgba(255,255,255,0.045)',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#c0b8ff', letterSpacing: '0.02em' }}>
          Mixer
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>
          {channels.length} ch
        </span>
      </div>

      {/* Channel strips */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '5px 4px 4px',
          gap: 2,
        }}
      >
        {channels.map(({ track, state }) => (
          <ChannelStrip
            key={track.id}
            track={track}
            channel={state}
            onChange={(patch) => updateChannel(track.id, patch)}
          />
        ))}

        {channels.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.15)', fontSize: 11,
          }}>
            No tracks · Add a track in the arrangement view
          </div>
        )}

        {/* Master bus */}
        <div
          style={{
            width: CHANNEL_WIDTH,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 6,
            marginLeft: 6,
            paddingLeft: 6,
            borderLeft: '1px solid rgba(139,127,248,0.15)',
          }}
        >
          <div style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
            color: 'rgba(139,127,248,0.6)',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
            marginBottom: 5,
            textTransform: 'uppercase',
          }}>
            Master
          </div>
          <MasterFader />
        </div>
      </div>
    </div>
  );
}

// ─── Channel strip ────────────────────────────────────────────────────────────

function ChannelStrip({
  track, channel, onChange,
}: {
  track: Track;
  channel: MixerChannelState;
  onChange: (patch: Partial<MixerChannelState>) => void;
}) {
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
  const trackColor = track.color ?? '#8b7ff8';

  return (
    <div
      style={{
        width: CHANNEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '2px 3px 4px',
        borderRadius: 6,
        background: channel.mute ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        opacity: channel.mute ? 0.45 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Color bar */}
      <div style={{
        width: '100%', height: 2.5, borderRadius: 2,
        background: trackColor,
        boxShadow: `0 0 6px ${trackColor}80`,
        marginBottom: 1,
      }} />

      {/* Name */}
      <div style={{
        width: '100%', textAlign: 'center',
        fontSize: 9, fontWeight: 600, color: '#d4d6f0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        lineHeight: 1,
      }} title={track.name}>
        {track.name}
      </div>

      {/* M / S buttons */}
      <div style={{ display: 'flex', gap: 3 }}>
        <MixerBtn label="M" active={channel.mute}
          activeColor="rgba(245,166,35,0.95)" activeBg="rgba(245,166,35,0.18)"
          title="Mute" onClick={() => onChange({ mute: !channel.mute })} />
        <MixerBtn label="S" active={channel.solo}
          activeColor="rgba(32,201,126,0.95)" activeBg="rgba(32,201,126,0.15)"
          title="Solo" onClick={() => onChange({ solo: !channel.solo })} />
      </div>

      {/* Pan strip */}
      <div style={{ width: '100%' }}
        title={`Pan: ${channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}` : `L${Math.round(-channel.pan * 100)}`}`}
      >
        <div
          style={{
            width: '100%', height: 7, borderRadius: 4, position: 'relative',
            background: 'rgba(255,255,255,0.06)', cursor: 'ew-resize',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
          onPointerDown={handlePanPointerDown}
          onDoubleClick={() => onChange({ pan: 0 })}
        >
          {/* Center mark */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1,
            background: 'rgba(255,255,255,0.12)',
          }} />
          {/* Pan fill */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
            left: channel.pan <= 0 ? `${panPercent}%` : '50%',
            width: `${Math.abs(channel.pan) * 50}%`,
            background: 'rgba(139,127,248,0.7)',
          }} />
          {/* Pan thumb */}
          <div style={{
            position: 'absolute', top: -1, bottom: -1,
            left: `calc(${panPercent}% - 3px)`,
            width: 6, borderRadius: 2,
            background: '#a89cff',
            boxShadow: '0 0 4px rgba(139,127,248,0.6)',
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.22)', marginTop: 1, lineHeight: 1 }}>
          {channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}` : `L${Math.round(-channel.pan * 100)}`}
        </div>
      </div>

      {/* Fader */}
      <div
        style={{
          position: 'relative', width: 22, borderRadius: 4, cursor: 'ns-resize',
          height: FADER_HEIGHT,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onPointerDown={handleFaderPointerDown}
        onDoubleClick={() => onChange({ gain: 1 })}
      >
        {/* Level tick marks */}
        {[0, 0.33, 0.67, 1].map((v, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: FADER_HEIGHT * (1 - v / 1.5),
            height: 1,
            background: 'rgba(255,255,255,0.1)',
          }} />
        ))}

        {/* Unity (0dB) tick — slightly brighter */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: FADER_HEIGHT * (1 - 1 / 1.5),
          height: 1,
          background: 'rgba(139,127,248,0.35)',
        }} />

        {/* Fader fill */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '0 0 4px 4px',
          top: faderY,
          background: channel.solo
            ? `linear-gradient(180deg, rgba(32,201,126,0.5) 0%, rgba(20,150,80,0.3) 100%)`
            : `linear-gradient(180deg, rgba(139,127,248,${0.35 + faderPos * 0.35}) 0%, rgba(91,100,200,0.2) 100%)`,
        }} />

        {/* Fader cap — glassy handle */}
        <div style={{
          position: 'absolute', left: -2, right: -2,
          top: faderY - 7, height: 14, borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.1) 100%)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4), 0 0 8px rgba(139,127,248,0.2)',
        }}>
          {/* Grip lines */}
          {[-2, 0, 2].map((dy, i) => (
            <div key={i} style={{
              position: 'absolute', left: 4, right: 4,
              top: `calc(50% + ${dy}px)`, height: 1,
              background: 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>
      </div>

      {/* dB readout */}
      <div style={{
        fontSize: 8, fontFamily: 'monospace', fontWeight: 500,
        color: faderPos > 0.8 ? '#f5a623' : 'rgba(255,255,255,0.28)',
        lineHeight: 1,
      }}>
        {gainToDb(channel.gain)}
      </div>
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
      width: 20, height: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 3, fontSize: 8, fontWeight: 700, cursor: 'pointer',
      border: active ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.07)',
      background: active ? activeBg : 'rgba(255,255,255,0.04)',
      color: active ? activeColor : 'rgba(255,255,255,0.25)',
      boxShadow: active ? `0 0 6px ${activeColor}` : 'none',
      transition: 'background 0.1s, color 0.1s, box-shadow 0.1s',
    }}>
      {label}
    </button>
  );
}

// ─── Master fader ─────────────────────────────────────────────────────────────

function MasterFader() {
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
      <div
        style={{
          position: 'relative', width: 22, borderRadius: 4, cursor: 'ns-resize',
          height: FADER_HEIGHT,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(139,127,248,0.15)',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => setVol(1)}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: '0 0 4px 4px',
          top: faderY,
          background: `linear-gradient(180deg, rgba(139,127,248,${0.4 + faderPos * 0.4}) 0%, rgba(91,100,200,0.25) 100%)`,
        }} />
        <div style={{
          position: 'absolute', left: -2, right: -2,
          top: faderY - 7, height: 14, borderRadius: 4,
          background: 'linear-gradient(180deg, rgba(200,195,255,0.3) 0%, rgba(139,127,248,0.15) 100%)',
          border: '1px solid rgba(139,127,248,0.4)',
          boxShadow: '0 0 10px rgba(139,127,248,0.3)',
        }}>
          {[-2, 0, 2].map((dy, i) => (
            <div key={i} style={{
              position: 'absolute', left: 4, right: 4,
              top: `calc(50% + ${dy}px)`, height: 1,
              background: 'rgba(255,255,255,0.4)',
            }} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(139,127,248,0.55)', lineHeight: 1 }}>
        {gainToDb(vol)}
      </div>
    </div>
  );
}
