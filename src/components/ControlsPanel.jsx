import React from 'react';

function ControlsPanel({ messageRate, setMessageRate, mode, setMode }) {
  const handleRateChange = (e) => setMessageRate(Number(e.target.value));
  const handleModeChange = (e) => setMode(e.target.value);

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
      <h2>Controls Panel</h2>
      <div>
        <label>
          Message Rate: <strong>{messageRate.toLocaleString()} msg/s</strong>
          <input
            type="range"
            min="0"
            max="100000"
            step="1000"
            value={messageRate}
            onChange={handleRateChange}
            style={{ width: '100%' }}
          />
        </label>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <label>
          Mode:&nbsp;
          <select value={mode} onChange={handleModeChange}>
            <option value="didactic">Didactic</option>
            <option value="realistic">Realistic</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export default ControlsPanel;
