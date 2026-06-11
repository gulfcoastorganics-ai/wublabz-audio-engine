import React, { useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { AudioAsset } from '../../lib/project/projectSchema.js';
import { useWubGuide } from '../assistant/useWubGuide.js';

type BrowserTab = 'samples' | 'projects';

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: 208,
    flexShrink: 0,
    background: 'linear-gradient(180deg, rgba(11,15,32,0.92), rgba(5,7,18,0.92))',
    border: '1px solid var(--color-border-soft)',
    borderRadius: 16,
    boxShadow: 'var(--shadow-glass)',
    overflow: 'hidden',
    height: '100%',
  },
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    height: 30,
    flexShrink: 0,
    background: 'linear-gradient(180deg, rgba(15,19,40,0.92), rgba(7,10,22,0.94))',
    borderBottom: '1px solid rgba(139,127,248,0.12)',
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-bright)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  tabBar: {
    display: 'flex',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.045)',
  },
  searchWrap: {
    padding: '6px 8px 4px',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    height: 26,
    padding: '0 8px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(8,12,26,0.48))',
    border: '1px solid rgba(255,255,255,0.075)',
    borderRadius: 8,
    color: 'var(--color-text-main)',
    fontSize: 11,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  dropZone: (importing: boolean) => ({
    margin: '0 8px 6px',
    height: 38,
    flexShrink: 0 as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: importing
      ? '1px solid rgba(139,127,248,0.58)'
      : '1px dashed rgba(255,255,255,0.13)',
    background: importing
      ? 'linear-gradient(135deg, rgba(139,127,248,0.16), rgba(91,156,248,0.08))'
      : 'rgba(255,255,255,0.022)',
    color: importing ? 'var(--color-text-bright)' : 'rgba(206,208,234,0.44)',
    fontSize: 10,
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
  }),
  list: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  empty: {
    padding: '20px 12px',
    textAlign: 'center' as const,
    color: 'rgba(206,208,234,0.38)',
    fontSize: 11,
    lineHeight: 1.6,
  },
} as const;

// ─── AssetBrowser ─────────────────────────────────────────────────────────────

export function AssetBrowser() {
  const { project, importFile, setStatus } = useStudioStore();
  const { beginnerModeEnabled, askGuide } = useWubGuide();
  const [tab, setTab] = useState<BrowserTab>('samples');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assets = project.audioAssets.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleFileImport(files: FileList | null) {
    if (!files) return;
    setImporting(true);
    for (const file of Array.from(files)) {
      if (file.type.startsWith('audio/')) {
        try {
          await importFile(file);
        } catch (err) {
          setStatus(`Import failed: ${(err as Error).message}`);
        }
      }
    }
    setImporting(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    void handleFileImport(e.dataTransfer.files);
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
  }

  return (
    <div style={S.panel} data-wubguide-target="browser" aria-label="Asset browser panel">
      {/* Title */}
      <div style={S.titleBar}>
        <span style={S.title}>Browser</span>
        {beginnerModeEnabled && (
          <button
            type="button"
            className="wubguide-section-help"
            onClick={() => askGuide('How do I import audio?')}
            aria-label="Get help with importing audio"
            title="Ask WubGuide about importing audio"
          >
            ?
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {(['samples', 'projects'] as BrowserTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '5px 0',
                fontSize: 10,
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.04em',
                textTransform: 'capitalize',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderBottom: active
                  ? '2px solid rgba(139,127,248,0.78)'
                  : '2px solid transparent',
                color: active ? 'var(--color-text-bright)' : 'rgba(206,208,234,0.38)',
                transition: 'color 0.1s, border-color 0.1s',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <input
          type="text"
        placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={S.searchInput}
          aria-label="Search imported samples"
          title={beginnerModeEnabled ? 'Search audio already imported into this project' : 'Search samples'}
        />
      </div>

      {/* Drop zone */}
      <div
        style={S.dropZone(importing)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-wubguide-target="import-zone"
        aria-label="Drop or click to import audio"
        title={beginnerModeEnabled ? 'Drop local audio here or click to choose an audio file' : 'Import audio'}
      >
        {importing ? '⏳ Importing…' : '+ Drop or click to import'}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => void handleFileImport(e.target.files)}
        />
      </div>

      {/* List */}
      <div style={S.list}>
        {tab === 'samples' && (
          assets.length === 0 ? (
            <div style={S.empty}>
              {search ? (
                <>No results for<br /><em>"{search}"</em></>
              ) : (
                <>No samples yet.<br />Drop audio files to import.</>
              )}
            </div>
          ) : (
            assets.map((asset) => (
              <AssetItem key={asset.id} asset={asset} formatDuration={formatDuration} />
            ))
          )
        )}

        {tab === 'projects' && <ProjectsList />}
      </div>
    </div>
  );
}

// ─── AssetItem ────────────────────────────────────────────────────────────────

function AssetItem({
  asset, formatDuration,
}: {
  asset: AudioAsset;
  formatDuration: (s: number) => string;
}) {
  const [hovered, setHovered] = useState(false);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${asset.name}\n${formatDuration(asset.durationSeconds)} · ${asset.sampleRate}Hz`}
      style={{
        margin: '0 6px 4px',
        padding: '7px 8px',
        cursor: 'grab',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
        background: hovered
          ? 'linear-gradient(135deg, rgba(139,127,248,0.12), rgba(91,156,248,0.055))'
          : 'rgba(255,255,255,0.018)',
        transition: 'background 0.1s, border-color 0.1s, box-shadow 0.1s',
        boxShadow: hovered ? '0 0 16px rgba(139,127,248,0.12)' : 'none',
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: 'var(--color-accent-2)', fontSize: 11, flexShrink: 0 }}>♪</span>
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 11, fontWeight: 600, color: 'var(--color-text-bright)',
        }}>
          {asset.name}
        </span>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, marginTop: 2 }}>
        <span style={{ fontSize: 9, color: 'rgba(206,208,234,0.42)', fontFamily: 'monospace' }}>
          {formatDuration(asset.durationSeconds)}
        </span>
        {asset.channels === 2 && (
          <span style={{
            fontSize: 8, fontWeight: 600,
            color: 'rgba(139,127,248,0.78)',
            letterSpacing: '0.06em',
          }}>ST</span>
        )}
        <span style={{ fontSize: 9, color: 'rgba(206,208,234,0.28)', fontFamily: 'monospace' }}>
          {Math.round(asset.sampleRate / 1000)}k
        </span>
      </div>

      {/* Mini waveform */}
      {asset.waveformPeaks.length > 0 && (
        <svg
          width="100%"
          height="10"
          viewBox={`0 0 ${asset.waveformPeaks.length} 10`}
          preserveAspectRatio="none"
          style={{ display: 'block', paddingLeft: 16, marginTop: 2, opacity: hovered ? 0.85 : 0.45, transition: 'opacity 0.1s' }}
        >
          {asset.waveformPeaks.map((p, i) => (
            <line key={i}
              x1={i} y1={5 - p * 4.5} x2={i} y2={5 + p * 4.5}
              stroke="#5b9cf8" strokeWidth="1"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

// ─── ProjectsList ─────────────────────────────────────────────────────────────

function ProjectsList() {
  const { project, load, setStatus } = useStudioStore();

  async function handleLoad() {
    try {
      await load(project.id);
      setStatus('Project loaded');
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
      <button
        onClick={() => void handleLoad()}
        style={{
          width: '100%', height: 30,
          background: 'linear-gradient(135deg, rgba(139,127,248,0.2), rgba(91,156,248,0.1))',
          border: '1px solid rgba(139,127,248,0.36)',
          borderRadius: 9,
          color: 'var(--color-text-bright)',
          fontSize: 11, fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
      >
        Load Project…
      </button>
      <div style={{
        fontSize: 10, textAlign: 'center', color: 'rgba(206,208,234,0.34)', lineHeight: 1.6,
      }}>
        Projects auto-save<br />to IndexedDB
      </div>
    </div>
  );
}
