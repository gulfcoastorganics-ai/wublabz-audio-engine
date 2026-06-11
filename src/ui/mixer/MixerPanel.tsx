import React, { useCallback } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { MixerChannelState, Track } from '../../lib/project/projectSchema.js';

const CHANNEL_WIDTH = 64;
const FADER_HEIGHT = 120;

// 0.0–1.5 fader range maps to dB
function gainToDb(v: number): string {
  if (v <= 0) return '-∞';
  const db = 20 * Math.log10(v);
  return db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1);
}

type ChannelViewItem = {
  track: Track;
  state: MixerChannelState;
};

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
      className="flex flex-col shrink-0 select-none"
      style={{
        height: 260,
        background: 'var(--color-daw-panel)',
        borderTop: '2px solid var(--color-daw-accent)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center px-3 h-8 shrink-0"
        style={{
          borderBottom: '1px solid var(--color-daw-border)',
          background: 'var(--color-daw-bg)',
        }}
      >
        <span
          className="font-medium text-xs"
          style={{ color: 'var(--color-daw-text-bright)' }}
        >
          Mixer
        </span>
        <span
          className="text-xs ml-2"
          style={{ color: 'var(--color-daw-text-dim)' }}
        >
          {channels.length} ch
        </span>
      </div>

      {/* Channel strips */}
      <div
        className="flex flex-1 overflow-x-auto overflow-y-hidden"
        style={{ padding: '4px 4px 0' }}
      >
        {channels.map(({ track, state }) => (
          <ChannelStrip
            key={track.id}
            track={track}
            channel={state}
            onChange={(patch) => updateChannel(track.id, patch)}
          />
        ))}

        {/* Master bus label */}
        <div
          className="flex flex-col items-center justify-end pb-2 ml-2"
          style={{
            width: CHANNEL_WIDTH,
            borderLeft: '1px solid var(--color-daw-border-bright)',
            paddingLeft: 8,
          }}
        >
          <div
            className="text-xs font-bold"
            style={{ color: 'var(--color-daw-accent)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', marginBottom: 4 }}
          >
            MASTER
          </div>
          <MasterFader />
        </div>
      </div>
    </div>
  );
}

function ChannelStrip({
  track,
  channel,
  onChange,
}: {
  track: Track;
  channel: MixerChannelState;
  onChange: (patch: Partial<MixerChannelState>) => void;
}) {
  // Pan drag
  const handlePanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startPan = channel.pan;

      function move(ev: PointerEvent) {
        const dx = ev.clientX - startX;
        const newPan = Math.max(-1, Math.min(1, startPan + dx / 60));
        onChange({ pan: Math.round(newPan * 100) / 100 });
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
        const newVol = Math.max(0, Math.min(1.5, startVol - dy / FADER_HEIGHT));
        onChange({ gain: Math.round(newVol * 1000) / 1000 });
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

  return (
    <div
      className="flex flex-col items-center gap-1 px-1 pb-2 relative"
      style={{
        width: CHANNEL_WIDTH,
        borderRight: '1px solid var(--color-daw-border)',
        opacity: channel.mute ? 0.4 : 1,
        minWidth: CHANNEL_WIDTH,
      }}
    >
      {/* Channel name */}
      <div
        className="text-xs w-full text-center truncate mt-1"
        style={{
          color: 'var(--color-daw-text-bright)',
          fontSize: 10,
          fontWeight: 500,
        }}
        title={track.name}
      >
        {track.name}
      </div>

      {/* Color indicator */}
      <div
        className="w-full h-1 rounded-full"
        style={{ background: track.color ?? 'var(--color-daw-border-bright)' }}
      />

      {/* Mute / Solo */}
      <div className="flex gap-1">
        <ChannelButton
          label="M"
          active={channel.mute}
          activeColor="var(--color-daw-amber)"
          onClick={() => onChange({ mute: !channel.mute })}
          title="Mute"
        />
        <ChannelButton
          label="S"
          active={channel.solo}
          activeColor="var(--color-daw-green)"
          onClick={() => onChange({ solo: !channel.solo })}
          title="Solo"
        />
      </div>

      {/* Pan knob (drag horizontal) */}
      <div
        className="relative w-full flex flex-col items-center gap-0.5"
        title={`Pan: ${channel.pan >= 0 ? 'R' : 'L'}${Math.abs(Math.round(channel.pan * 100))}`}
      >
        <div
          className="w-full h-2 rounded-full relative cursor-ew-resize"
          style={{ background: 'var(--color-daw-border-bright)' }}
          onPointerDown={handlePanPointerDown}
          onDoubleClick={() => onChange({ pan: 0 })}
        >
          {/* Center mark */}
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: '50%',
              width: 1,
              background: 'var(--color-daw-border-bright)',
              opacity: 0.5,
            }}
          />
          {/* Pan indicator */}
          <div
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: channel.pan <= 0 ? `${panPercent}%` : '50%',
              width: Math.abs(channel.pan) * 50 + '%',
              background: 'var(--color-daw-accent)',
            }}
          />
        </div>
        <span
          className="text-xs"
          style={{ color: 'var(--color-daw-text-dim)', fontSize: 8 }}
        >
          {channel.pan === 0 ? 'C' : channel.pan > 0 ? `R${Math.round(channel.pan * 100)}` : `L${Math.round(-channel.pan * 100)}`}
        </span>
      </div>

      {/* Fader track */}
      <div
        className="relative flex-1 w-6 rounded cursor-ns-resize"
        style={{
          height: FADER_HEIGHT,
          background: 'var(--color-daw-bg)',
          border: '1px solid var(--color-daw-border)',
        }}
        onPointerDown={handleFaderPointerDown}
        onDoubleClick={() => onChange({ gain: 1 })}
      >
        {/* Level marks */}
        {[0, 0.33, 0.67, 1].map((v) => (
          <div
            key={v}
            className="absolute left-0 right-0 opacity-20"
            style={{
              top: FADER_HEIGHT * (1 - v * (1 / 1.5)),
              height: 1,
              background: 'var(--color-daw-text-dim)',
            }}
          />
        ))}

        {/* Fader fill */}
        <div
          className="absolute left-0 right-0 rounded-b"
          style={{
            top: faderY,
            bottom: 0,
            background: channel.solo
              ? 'var(--color-daw-green)'
              : `rgba(124,111,224,${0.4 + faderPos * 0.4})`,
          }}
        />

        {/* Fader cap */}
        <div
          className="absolute left-0 right-0 h-3 rounded"
          style={{
            top: faderY - 6,
            background: 'var(--color-daw-border-bright)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
      </div>

      {/* dB readout */}
      <div
        className="text-xs font-mono"
        style={{ color: 'var(--color-daw-text-dim)', fontSize: 9 }}
      >
        {gainToDb(channel.gain)} dB
      </div>
    </div>
  );
}

function ChannelButton({
  label,
  active,
  activeColor,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-5 h-4 flex items-center justify-center rounded text-xs font-bold hover:opacity-80"
      style={{
        background: active ? activeColor : 'var(--color-daw-border-bright)',
        color: active ? '#000' : 'var(--color-daw-text-dim)',
        fontSize: 8,
      }}
    >
      {label}
    </button>
  );
}

function MasterFader() {
  // Master fader just shows a visual; Tone.js master vol is handled by BusGraph
  const [vol, setVol] = useState(1);
  const faderPos = Math.max(0, Math.min(1, vol / 1.5));
  const faderY = FADER_HEIGHT * (1 - faderPos);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startVol = vol;
    function move(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      setVol(Math.max(0, Math.min(1.5, startVol - dy / FADER_HEIGHT)));
    }
    function up() {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    }
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative w-6 rounded cursor-ns-resize"
        style={{
          height: FADER_HEIGHT,
          background: 'var(--color-daw-bg)',
          border: '1px solid var(--color-daw-border)',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => setVol(1)}
      >
        <div
          className="absolute left-0 right-0 rounded-b"
          style={{
            top: faderY,
            bottom: 0,
            background: 'rgba(124,111,224,0.6)',
          }}
        />
        <div
          className="absolute left-0 right-0 h-3 rounded"
          style={{
            top: faderY - 6,
            background: 'var(--color-daw-border-bright)',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        />
      </div>
      <div
        className="text-xs font-mono"
        style={{ color: 'var(--color-daw-text-dim)', fontSize: 9 }}
      >
        {gainToDb(vol)} dB
      </div>
    </div>
  );
}

// useState import needed for MasterFader
import { useState } from 'react';
