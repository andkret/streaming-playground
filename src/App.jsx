import React, { useState } from 'react';
import PipelineVisualization from './components/PipelineVisualization';
import ControlsPanel from './components/ControlsPanel';

function App() {
  const [messageRate, setMessageRate] = useState(20);
  const [mode, setMode] = useState('didactic');
  const [dbType, setDbType] = useState('postgres');

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Streaming Demo App</h1>
      <ControlsPanel
        messageRate={messageRate}
        setMessageRate={setMessageRate}
        mode={mode}
        setMode={setMode}
      />
      <PipelineVisualization
        messageRate={messageRate}
        mode={mode}
        dbType={dbType}
        setDbType={setDbType}
      />
    </div>
  );
}

export default App;
