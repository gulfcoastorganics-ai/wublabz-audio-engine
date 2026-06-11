import React, { useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore.js';
import type { AudioAsset } from '../../lib/project/projectSchema.js';

type BrowserTab = 'samples' | 'projects';

export function AssetBrowser() {
  const { project, importFile, setStatus } = useStudioStore();
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

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <div
      className="flex flex-col"
      style={{
        width: 200,
        background: 'var(--color-daw-panel)',
        borderRight: '1px solid var(--color-daw-border)',
        height: '100%',
      }}
    >
      {/* Title */}
      <div
        className="flex items-center px-2 h-8 shrink-0"
        style={{
          borderBottom: '1px solid var(--color-daw-border)',
          background: 'var(--color-daw-bg)',
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--color-daw-text-bright)' }}>
          Browser
        </span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--color-daw-border)' }}>
        {(['samples', 'projects'] as BrowserTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-1 text-xs capitalize"
            style={{
              background: tab === t ? 'var(--color-daw-surface)' : 'transparent',
              color: tab === t ? 'var(--color-daw-text-bright)' : 'var(--color-daw-text-dim)',
              borderBottom: tab === t ? '2px solid var(--color-daw-accent)' : '2px solid transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 py-1 shrink-0">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-0.5 rounded text-xs"
          style={{
            background: 'var(--color-daw-bg)',
            color: 'var(--color-daw-text)',
            border: '1px solid var(--color-daw-border-bright)',
            outline: 'none',
          }}
        />
      </div>

      {/* Drop zone / import */}
      <div
        className="mx-2 mb-1 shrink-0 flex items-center justify-center rounded border-dashed border text-xs cursor-pointer hover:opacity-80"
        style={{
          height: 32,
          borderColor: 'var(--color-daw-border-bright)',
          color: importing ? 'var(--color-daw-accent)' : 'var(--color-daw-text-dim)',
          background: 'var(--color-daw-bg)',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {importing ? 'Importing…' : '+ Drop or click to import'}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFileImport(e.target.files)}
        />
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'samples' && (
          <div>
            {assets.length === 0 ? (
              <div
                className="text-xs text-center py-4"
                style={{ color: 'var(--color-daw-text-dim)' }}
              >
                {search ? 'No results' : 'No samples yet'}
              </div>
            ) : (
              assets.map((asset) => (
                <AssetItem
                  key={asset.id}
                  asset={asset}
                  formatDuration={formatDuration}
                />
              ))
            )}
          </div>
        )}

        {tab === 'projects' && (
          <ProjectsList />
        )}
      </div>
    </div>
  );
}

// ─── AssetItem ────────────────────────────────────────────────────────────────

function AssetItem({
  asset,
  formatDuration,
}: {
  asset: AudioAsset;
  formatDuration: (s: number) => string;
}) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div
      className="flex flex-col px-2 py-1 cursor-grab hover:opacity-80 border-b"
      style={{
        borderColor: 'var(--color-daw-border)',
        background: 'transparent',
      }}
      draggable
      onDragStart={handleDragStart}
      title={`${asset.name}\n${formatDuration(asset.durationSeconds)} · ${asset.sampleRate}Hz`}
    >
      <div className="flex items-center gap-1">
        {/* Waveform icon */}
        <span style={{ color: 'var(--color-daw-clip-audio)', fontSize: 12 }}>♪</span>
        <span
          className="flex-1 truncate text-xs"
          style={{ color: 'var(--color-daw-text)', fontSize: 11 }}
        >
          {asset.name}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-5">
        <span style={{ color: 'var(--color-daw-text-dim)', fontSize: 9 }}>
          {formatDuration(asset.durationSeconds)}
        </span>
        {asset.channels === 2 && (
          <span style={{ color: 'var(--color-daw-text-dim)', fontSize: 9 }}>ST</span>
        )}
      </div>

      {/* Mini waveform */}
      {asset.waveformPeaks.length > 0 && (
        <svg
          width="100%"
          height="12"
          viewBox={`0 0 ${asset.waveformPeaks.length} 12`}
          preserveAspectRatio="none"
          className="pl-5 mt-0.5"
          style={{ display: 'block' }}
        >
          {asset.waveformPeaks.map((p, i) => (
            <line
              key={i}
              x1={i}
              y1={6 - p * 5}
              x2={i}
              y2={6 + p * 5}
              stroke="var(--color-daw-clip-audio)"
              strokeOpacity="0.6"
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
    <div className="flex flex-col gap-2 p-2">
      <button
        onClick={() => void handleLoad()}
        className="w-full py-1.5 rounded text-xs hover:opacity-80"
        style={{
          background: 'var(--color-daw-accent-dim)',
          color: '#fff',
        }}
      >
        Load Project…
      </button>
      <div
        className="text-xs text-center py-2"
        style={{ color: 'var(--color-daw-text-dim)' }}
      >
        Projects are auto-saved to IndexedDB
      </div>
    </div>
  );
}
