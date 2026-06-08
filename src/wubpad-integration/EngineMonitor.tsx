import React, { useEffect, useState } from 'react';
import { getWubLabzHttpUrl, getWubLabzWsUrl, isMockMode } from './env.js';
import { WubWebSocketClient } from './WebSocketClient.js';

export const EngineMonitor: React.FC = () => {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed');
  const [latency, setLatency] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [emergencyStopped, setEmergencyStopped] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const client = new WubWebSocketClient();
    
    const unbindStatus = client.onStatusChange((s) => {
      setStatus(s);
      if (s === 'open') setLastError(null);
    });

    const unbindEvent = client.onEvent((event) => {
      if (event.type === 'ENGINE_STATUS') {
        setEngineReady(event.payload.engineReady);
        setEmergencyStopped(event.payload.emergencyStopped);
      }
      if (event.type === 'HEARTBEAT') {
        setLatency(client.getLatency());
      }
    });

    client.connect();

    // Check health endpoint
    const checkHealth = async () => {
      try {
        const resp = await fetch(`${getWubLabzHttpUrl()}/health`);
        const data = await resp.json();
        setHealth(data);
        if (data.ok) setLastError(null);
      } catch (err: any) {
        setHealth({ ok: false, error: err.message });
        setLastError(`HTTP Connection Failed: ${err.message}`);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    return () => {
      unbindStatus();
      unbindEvent();
      client.close();
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      padding: '1rem',
      border: '1px solid #ccc',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      fontFamily: 'monospace',
      fontSize: '0.85rem'
    }}>
      <h3 style={{ margin: '0 0 1rem 0' }}>Engine Monitor {isMockMode() && <span style={{ color: 'orange' }}>(MOCK MODE)</span>}</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.5rem' }}>
        <strong>Frontend URL:</strong> <span>{typeof window !== 'undefined' ? window.location.href : 'N/A'}</span>
        <strong>HTTP URL:</strong> <span>{getWubLabzHttpUrl()}</span>
        <strong>WS URL:</strong> <span>{getWubLabzWsUrl()}</span>
        
        <strong>Socket Status:</strong> 
        <span style={{ color: status === 'open' ? 'green' : 'red', fontWeight: 'bold' }}>
          {status.toUpperCase()}
        </span>

        <strong>Health Check:</strong>
        <span style={{ color: health?.ok ? 'green' : 'red' }}>
          {health?.ok ? 'OK' : 'FAILED'}
        </span>

        <strong>Latency:</strong> <span>{latency}ms</span>
        <strong>Engine Ready:</strong> <span>{engineReady ? 'YES' : 'NO'}</span>
        <strong>E-Stop:</strong> <span style={{ color: emergencyStopped ? 'red' : 'inherit' }}>{emergencyStopped ? 'STOPPED' : 'CLEAR'}</span>
      </div>

      {lastError && (
        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fee', border: '1px solid #f88', color: '#900' }}>
          <strong>Error:</strong> {lastError}
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Ensure WubLabz backend is running: <code>npm run server</code>
          </div>
        </div>
      )}
    </div>
  );
};
