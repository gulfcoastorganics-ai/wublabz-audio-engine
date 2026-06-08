import React, { useState } from 'react';
import { WubPad } from './wubpad-integration/WubPad';
import { EngineMonitor } from './wubpad-integration/EngineMonitor';

function App() {
  const [view, setView] = useState<'pad' | 'engine'>('pad');

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <nav style={{ 
        display: 'flex', 
        gap: '1rem', 
        padding: '1rem', 
        borderBottom: '1px solid #333',
        backgroundColor: '#1a1a1a',
        justifyContent: 'center'
      }}>
        <button 
          onClick={() => setView('pad')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: view === 'pad' ? '#00ffcc' : '#888',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          WUBPAD
        </button>
        <button 
          onClick={() => setView('engine')}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: view === 'engine' ? '#00ffcc' : '#888',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ENGINE STATUS
        </button>
      </nav>

      <main>
        {view === 'pad' ? <WubPad /> : <div style={{ padding: '1rem' }}><EngineMonitor /></div>}
      </main>
    </div>
  );
}

export default App;
