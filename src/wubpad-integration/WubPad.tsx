import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getWubLabzHttpUrl, getWubLabzWsUrl, isMockMode } from './env.js';
import { WubWebSocketClient, type WubConnectionStatus } from './WebSocketClient.js';

// --- Constants & Defaults ---
const STORAGE_KEYS = {
  WS_URL: 'wubpad_ws_url',
  URL_HISTORY: 'wubpad_url_history',
  MIDI_MAPPINGS: 'wubpad_midi_mappings',
  CONFIRMATIONS: 'wubpad_confirmations_enabled'
};

const DEFAULT_STEMS = [
    { id: 'kick', label: 'Kick', bus: 'drum' },
    { id: 'snare', label: 'Snare', bus: 'drum' },
    { id: 'drums', label: 'Drums', bus: 'drum' },
    { id: 'bass', label: 'Bass', bus: 'bass' },
    { id: 'lead', label: 'Lead', bus: 'melody' },
    { id: 'vocal', label: 'Vocal', bus: 'vocal' },
    { id: 'fx', label: 'FX', bus: 'fx' },
    { id: 'atmos', label: 'Atmos', bus: 'fx' }
];

const DEFAULT_MACROS = [
  { id: 'tension', label: 'Build Tension' },
  { id: 'fakeout', label: 'Fakeout' },
  { id: 'dropnow', label: 'Drop Now' },
  { id: 'evolve', label: 'Bass Evolve' },
  { id: 'sweep', label: 'Filter Sweep' },
  { id: 'reverb', label: 'Reverb Throw' },
  { id: 'glitch', label: 'Glitch Fill' },
  { id: 'reset', label: 'Reset FX' }
];

const DEFAULT_SCENES = ['Intro', 'Build', 'Pre-drop', 'Drop', 'Breakdown', 'Final Drop', 'Outro'];

// --- Styles ---
const COLORS = {
  bg: '#0a0a0a',
  surface: '#1a1a1a',
  primary: '#00ffcc',
  secondary: '#ff00ff',
  danger: '#ff3333',
  text: '#ffffff',
  textMuted: '#888888',
  border: '#333333',
  meter: '#00ffcc'
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
    maxWidth: '600px',
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  header: {
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surface
  },
  section: {
    padding: '1rem',
    borderBottom: `1px solid ${COLORS.border}`
  },
  sectionTitle: {
    fontSize: '0.75rem',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between'
  },
  grid: {
    display: 'grid',
    gap: '0.5rem'
  },
  button: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '4px',
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    touchAction: 'manipulation',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px'
  },
  primaryButton: { borderColor: COLORS.primary, color: COLORS.primary },
  dangerButton: { backgroundColor: COLORS.danger, borderColor: COLORS.danger, color: '#fff' },
  activeButton: { backgroundColor: COLORS.primary, color: COLORS.bg },
  slider: { width: '100%', accentColor: COLORS.primary, margin: '0.5rem 0' },
  statusIndicator: { width: '8px', height: '8px', borderRadius: '50%', marginRight: '0.5rem', display: 'inline-block' },
  meter: { height: '4px', backgroundColor: '#222', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' },
  meterFill: { height: '100%', backgroundColor: COLORS.meter, transition: 'width 0.05s ease-out' },
  input: {
    backgroundColor: '#000',
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    padding: '0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    width: '100%',
    boxSizing: 'border-box'
  }
};

// --- Components ---

const Meter: React.FC<{ value: number }> = ({ value }) => {
  // value is expected to be normalized 0-1 or dB (if dB, we convert)
  const normalized = Math.max(0, Math.min(1, value)); // Simplistic
  return (
    <div style={styles.meter}>
      <div style={{ ...styles.meterFill, width: `${normalized * 100}%` }} />
    </div>
  );
};

export const WubPad: React.FC = () => {
  // --- Connection State ---
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.WS_URL) || getWubLabzWsUrl());
  const [urlHistory, setUrlHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.URL_HISTORY) || '[]'));
  const [status, setStatus] = useState<WubConnectionStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [engineDiagnostics, setEngineDiagnostics] = useState<any>(null);

  // --- MIDI State ---
  const [midiDevices, setMidiDevices] = useState<string[]>([]);
  const [lastMidiEvent, setLastMidiEvent] = useState<{ status: number, data1: number, data2: number } | null>(null);
  const [midiMappings, setMidiMappings] = useState<Record<string, { type: string, payload: any }>>(() => 
    JSON.parse(localStorage.getItem(STORAGE_KEYS.MIDI_MAPPINGS) || '{}')
  );
  const [learningTarget, setLearningTarget] = useState<{ id: string, label: string } | null>(null);

  // --- Settings State ---
  const [confirmationsEnabled, setConfirmationsEnabled] = useState(() => localStorage.getItem(STORAGE_KEYS.CONFIRMATIONS) === 'true');
  const [showSettings, setShowSettings] = useState(false);

  const clientRef = useRef<WubWebSocketClient | null>(null);

  // --- Handlers ---
  const connect = useCallback((targetUrl?: string) => {
    const url = targetUrl || wsUrl;
    if (clientRef.current) {
        clientRef.current.disconnect();
    }
    
    clientRef.current = new WubWebSocketClient({ url });
    
    clientRef.current.onStatusChange((s, err) => {
      setStatus(s);
      if (err) setLastError(err);
      if (s === 'connected') {
        localStorage.setItem(STORAGE_KEYS.WS_URL, url);
        setUrlHistory(prev => {
            const next = [url, ...prev.filter(u => u !== url)].slice(0, 5);
            localStorage.setItem(STORAGE_KEYS.URL_HISTORY, JSON.stringify(next));
            return next;
        });
      }
    });

    clientRef.current.onEvent((event) => {
      if (event.type === 'ENGINE_STATUS') {
        setEngineDiagnostics(event.payload);
      }
      if (event.type === 'HEARTBEAT') {
        setLatency(clientRef.current?.getLatency() ?? 0);
      }
    });

    clientRef.current.connect();
  }, [wsUrl]);

  const handleIntent = useCallback((type: string, payload: any = {}, force: boolean = false) => {
    if (confirmationsEnabled && !force) {
        const needsConfirm = ['EMERGENCY_STOP', 'SCENE_TRIGGER', 'TRANSPORT_STOP'].includes(type) || 
                           (type === 'MACRO_TRIGGER' && payload.macroId === 'reset');
        
        if (needsConfirm && type !== 'EMERGENCY_STOP') {
            if (!window.confirm(`Trigger ${type}?`)) return;
        }
    }
    clientRef.current?.send(type as any, payload);
  }, [confirmationsEnabled]);

  const resetMidiMappings = () => {
    if (window.confirm('Reset all MIDI mappings?')) {
        setMidiMappings({});
        localStorage.removeItem(STORAGE_KEYS.MIDI_MAPPINGS);
    }
  };

  // --- Effects ---
  useEffect(() => {
    connect();
    
    let midiAccess: any = null;

    if (typeof navigator !== 'undefined' && (navigator as any).requestMIDIAccess) {
      (navigator as any).requestMIDIAccess().then((access: any) => {
        midiAccess = access;
        const updateDevices = () => {
          const devices: string[] = [];
          access.inputs.forEach((input: any) => devices.push(input.name));
          setMidiDevices(devices);
        };
        updateDevices();
        access.onstatechange = updateDevices;
        
        access.inputs.forEach((input: any) => {
          input.onmidimessage = (message: any) => {
            const [s, d1, d2] = message.data;
            setLastMidiEvent({ status: s, data1: d1, data2: d2 });
            
            // Learning mode
            if (learningTarget) {
                if (s === 144 && d2 > 0) { // Note on
                    const key = `note-${d1}`;
                    setMidiMappings(prev => {
                        const next = { ...prev, [key]: { type: learningTarget.id.startsWith('SCENE') ? 'SCENE_TRIGGER' : 'MACRO_TRIGGER', payload: { macroId: learningTarget.id, sceneId: learningTarget.label } } };
                        localStorage.setItem(STORAGE_KEYS.MIDI_MAPPINGS, JSON.stringify(next));
                        return next;
                    });
                    setLearningTarget(null);
                }
                return;
            }

            // Normal MIDI trigger
            if (s === 144 && d2 > 0) {
                const mapping = midiMappings[`note-${d1}`];
                if (mapping) {
                    handleIntent(mapping.type, mapping.payload);
                }
            }
          };
        });
      });
    }

    return () => {
      clientRef.current?.disconnect();
      if (midiAccess) {
          midiAccess.onstatechange = null;
          midiAccess.inputs.forEach((input: any) => {
              input.onmidimessage = null;
          });
      }
    };
  }, [connect, learningTarget, midiMappings, handleIntent]);

  // --- Rendering Helpers ---
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#00ff00';
      case 'connecting':
      case 'reconnecting': return 'orange';
      case 'error': return 'red';
      default: return '#555';
    }
  };

  const getLevel = (bus: string) => {
      const raw = engineDiagnostics?.busLevels?.[bus];
      if (raw === undefined || raw === -Infinity) return 0;
      // Convert linear to normalized for display
      return raw; 
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }} onClick={() => setShowSettings(!showSettings)}>
          <div style={{ ...styles.statusIndicator, backgroundColor: getStatusColor() }} />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>WubPad</div>
            <div style={{ fontSize: '0.65rem', color: COLORS.textMuted }}>
              {status.toUpperCase()} {latency > 0 && `(${latency}ms)`}
              {isMockMode() && ' [MOCK]'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={{ ...styles.button, padding: '0.5rem' }} onClick={() => setShowSettings(!showSettings)}>SETTINGS</button>
          <button 
            style={{ ...styles.button, ...styles.dangerButton, padding: '0.5rem' }} 
            onClick={() => handleIntent('EMERGENCY_STOP', {}, true)}
          >
            E-STOP
          </button>
        </div>
      </header>

      {showSettings && (
        <section style={{ ...styles.section, backgroundColor: COLORS.surface }}>
            <div style={styles.sectionTitle}>Pairing & URLs</div>
            <div style={{ marginBottom: '1rem' }}>
                <input 
                    style={styles.input} 
                    value={wsUrl} 
                    onChange={(e) => setWsUrl(e.target.value)}
                    placeholder="ws://ip:port"
                />
                <button style={{ ...styles.button, width: '100%', marginTop: '0.5rem' }} onClick={() => connect()}>CONNECT</button>
            </div>
            {urlHistory.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.6rem', color: COLORS.textMuted, marginBottom: '0.25rem' }}>RECENT</div>
                    {urlHistory.map(url => (
                        <div key={url} style={{ fontSize: '0.8rem', padding: '0.25rem 0', color: COLORS.primary, cursor: 'pointer' }} onClick={() => { setWsUrl(url); connect(url); }}>
                            {url}
                        </div>
                    ))}
                </div>
            )}
            <div style={styles.sectionTitle}>Safety</div>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', gap: '0.5rem' }}>
                <input 
                    type="checkbox" 
                    checked={confirmationsEnabled} 
                    onChange={(e) => {
                        setConfirmationsEnabled(e.target.checked);
                        localStorage.setItem(STORAGE_KEYS.CONFIRMATIONS, e.target.checked.toString());
                    }} 
                />
                Enable Confirmations
            </label>
            <div style={{ ...styles.sectionTitle, marginTop: '1rem' }}>MIDI Mapping</div>
            <button style={{ ...styles.button, width: '100%', fontSize: '0.75rem' }} onClick={resetMidiMappings}>RESET MAPPINGS</button>
        </section>
      )}

      {/* Transport */}
      <section style={styles.section}>
        <div style={styles.sectionTitle}>
            Transport 
            <span>{engineDiagnostics?.transportState?.toUpperCase() || 'STOPPED'}</span>
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <button style={styles.button} onClick={() => handleIntent('TRANSPORT_PLAY')}>PLAY</button>
          <button style={styles.button} onClick={() => handleIntent('TRANSPORT_PAUSE')}>PAUSE</button>
          <button style={styles.button} onClick={() => handleIntent('TRANSPORT_STOP')}>STOP</button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.65rem', color: COLORS.textMuted, marginBottom: '0.25rem' }}>SEEK / SCRUB</div>
          <input 
            type="range" 
            style={styles.slider} 
            min="0" max="600" step="1" 
            value={engineDiagnostics?.currentBar * 2 || 0} // Dummy progress
            onChange={(e) => handleIntent('TRANSPORT_SEEK', { positionSeconds: parseFloat(e.target.value) })}
          />
        </div>
      </section>

      {/* Stems */}
      <section style={styles.section}>
        <div style={styles.sectionTitle}>Stem Matrix</div>
        <div style={{ ...styles.grid, gap: '1rem' }}>
          {DEFAULT_STEMS.map(stem => (
            <div key={stem.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 50px 50px', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem' }}>
                {stem.label}
                <Meter value={getLevel(stem.bus)} />
              </div>
              <input 
                type="range" 
                style={styles.slider} 
                min="0" max="1" step="0.01" 
                value={engineDiagnostics?.busLevels?.[`${stem.bus}_gain`] ?? 0.85} // Assuming gain feedback exists
                onChange={(e) => handleIntent('STEM_GAIN', { stemId: stem.bus, value: parseFloat(e.target.value) })}
              />
              <button 
                style={{ ...styles.button, fontSize: '0.7rem', padding: '0.25rem' }} 
                onClick={() => handleIntent('STEM_MUTE', { stemId: stem.bus })}
              >
                MUTE
              </button>
              <button 
                style={{ ...styles.button, fontSize: '0.7rem', padding: '0.25rem' }} 
                onClick={() => handleIntent('STEM_SOLO', { stemId: stem.bus })}
              >
                SOLO
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Macros */}
      <section style={styles.section}>
        <div style={styles.sectionTitle}>
            Performance Macros
            {learningTarget && <span style={{ color: COLORS.secondary }}>LEARNING: {learningTarget.label}...</span>}
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {DEFAULT_MACROS.map(macro => (
            <button 
              key={macro.id} 
              style={{ ...styles.button, ...styles.primaryButton, height: '60px', position: 'relative' }}
              onClick={() => handleIntent('MACRO_TRIGGER', { macroId: macro.id })}
              onContextMenu={(e) => { e.preventDefault(); setLearningTarget(macro); }}
            >
              {macro.label}
              {Object.keys(midiMappings).find(k => midiMappings[k].payload.macroId === macro.id) && (
                  <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.5rem', color: COLORS.textMuted }}>MIDI</div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Scenes */}
      <section style={styles.section}>
        <div style={styles.sectionTitle}>
            Scene Trigger
            <span style={{ color: COLORS.primary }}>{engineDiagnostics?.currentScene || '---'}</span>
        </div>
        <div style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem' }}>
          {DEFAULT_SCENES.map(scene => (
            <button 
                key={scene} 
                style={{ 
                    ...styles.button, 
                    minWidth: '100px',
                    borderColor: engineDiagnostics?.currentScene === scene ? COLORS.primary : COLORS.border
                }}
                onClick={() => handleIntent('SCENE_TRIGGER', { sceneId: scene })}
                onContextMenu={(e) => { e.preventDefault(); setLearningTarget({ id: `SCENE_${scene}`, label: scene }); }}
            >
                {scene}
            </button>
          ))}
        </div>
      </section>

      {/* MIDI & Info */}
      <section style={{ ...styles.section, borderBottom: 'none', flex: 1 }}>
        <div style={styles.sectionTitle}>MIDI & Diagnostics</div>
        <div style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>
          <div>MIDI Devices: {midiDevices.length > 0 ? midiDevices.join(', ') : 'None detected'}</div>
          {lastMidiEvent && <div style={{ marginTop: '0.25rem', color: COLORS.primary }}>
            LAST MIDI: {lastMidiEvent.status}, {lastMidiEvent.data1}, {lastMidiEvent.data2}
          </div>}
          <div style={{ marginTop: '0.5rem' }}>
            BPM: {engineDiagnostics?.bpm?.toFixed(1) || '---'} | 
            Pos: {engineDiagnostics?.currentBar || 1}.{engineDiagnostics?.currentBeat || 1} |
            Phrase: {engineDiagnostics?.currentPhrase || 1}
          </div>
          {lastError && <div style={{ color: COLORS.danger, marginTop: '0.5rem' }}>Error: {lastError}</div>}
        </div>
      </section>
    </div>
  );
};
