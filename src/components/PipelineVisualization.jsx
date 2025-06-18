import React, { useState, useEffect } from 'react';
import ReactFlow, { Background, Controls as FlowControls, Handle, Position } from 'react-flow-renderer';

const nodeStyles = {
  padding: 10,
  border: '1px solid #222',
  borderRadius: 8,
  background: '#fff',
  textAlign: 'center',
};

function PipelineNode({ data }) {
  return (
    <div style={nodeStyles}>
      <Handle type="target" position={Position.Left} />
      {data.label}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function ResourceBar({ percent }) {
  return (
    <div style={{ width: '100%', background: '#eee', borderRadius: 4, overflow: 'hidden', height: 12, marginTop: 4 }}>
      <div style={{ width: `${percent}%`, background: '#4caf50', height: '100%' }} />
    </div>
  );
}

export default function PipelineVisualization({ messageRate, dbType, setDbType }) {
  const [brokerCount, setBrokerCount] = useState(1);
  const [executors, setExecutors] = useState(1);

  const kafkaCapacity = 50000 * brokerCount;
  const sparkCapacity = 40000 * executors;

  // 1. Compute overflows
  const kafkaOverflow = Math.max(0, messageRate - kafkaCapacity);
  const sparkOverflow = Math.max(0, messageRate - sparkCapacity);
  const writeSpeed = dbType === 'mongodb'
    ? messageRate
    : messageRate <= 25000
      ? messageRate
      : messageRate <= 50000
        ? messageRate / 2
        : 0;
  const dbOverflow = Math.max(0, messageRate - writeSpeed);

  // 2. Unified lag: Spark overflow takes precedence
  const lag = sparkOverflow > 0 ? sparkOverflow : Math.max(kafkaOverflow, dbOverflow);

  // 3. Producer rates
  const targetRate = messageRate;
  const actualSent = Math.max(0, targetRate - kafkaOverflow);

  // 4. Processed messages: zero if DB fully stalled, else cap by spark capacity
  const fullDbStall = dbOverflow > 0 && writeSpeed === 0;
  const processed = fullDbStall
    ? 0
    : sparkOverflow > 0
      ? sparkCapacity
      : Math.min(Math.max(0, actualSent - lag), sparkCapacity);

  // 5. Utilizations
  const kafkaUtil = ((Math.min(actualSent, kafkaCapacity) / kafkaCapacity) * 100).toFixed(0);
  const sparkUtil = ((processed / sparkCapacity) * 100).toFixed(0);

  // 6. Batch duration
  let batchDuration;
  if (fullDbStall) batchDuration = 30;
  else if (dbOverflow > 0) batchDuration = Math.min(30, 1 + dbOverflow * 0.0005);
  else if (sparkOverflow > 0) batchDuration = Math.min(60, 1 + sparkOverflow * 0.0005);
  else batchDuration = 1;

  // 7. ReactFlow nodes and edges
  const nodes = [
    { id: 'producer', type: 'pipelineNode', data: { label: (<><strong>Producer</strong><div>Target Rate: {targetRate.toLocaleString()} msg/s</div><div>Actual Sent: {actualSent.toLocaleString()} msg/s</div></>) }, position: { x: 50, y: 100 } },
    { id: 'kafka',   type: 'pipelineNode', data: { label: (<><strong>Kafka Broker</strong><div>Lag: {lag.toLocaleString()} msg</div></>) }, position: { x: 300, y: 100 } },
    { id: 'spark',   type: 'pipelineNode', data: { label: (<><strong>Spark Processor</strong><div>Processed: {processed.toLocaleString()} msg/s</div></>) }, position: { x: 550, y: 100 } },
    { id: 'db',      type: 'pipelineNode', data: { label: (<><strong>Database Sink</strong><div>Missing Messages: {lag.toLocaleString()} msg</div></>) }, position: { x: 800, y: 100 } },
  ];

  const edges = [
    { id: 'e1', source: 'producer', target: 'kafka', animated: true },
    { id: 'e2', source: 'kafka',   target: 'spark', animated: true },
    { id: 'e3', source: 'spark',   target: 'db',    animated: true }
  ];

  return (
    <div>
      <div style={{ width: '100%', height: 400, border: '1px solid #ddd', borderRadius: 8 }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={{ pipelineNode: PipelineNode }} fitView>
          <Background />
          <FlowControls />
        </ReactFlow>
      </div>
      <div style={{ display: 'flex', marginTop: 16, gap: 16 }}>
        <div style={{ flex: 1, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <h3>Component States</h3>
          <ul>
            <li><strong>Target Rate:</strong> {targetRate.toLocaleString()} msg/s</li>
            <li><strong>Actual Sent:</strong> {actualSent.toLocaleString()} msg/s</li>
            <li><strong>Kafka Lag:</strong> {lag.toLocaleString()} msg</li>
            <li><strong>Processed Messages:</strong> {processed.toLocaleString()} msg/s</li>
            <li><strong>Missing Messages:</strong> {lag.toLocaleString()} msg</li>
          </ul>
        </div>
        <div style={{ flex: 1, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h3>Kafka Cluster</h3>
          <div>Brokers: <strong>{brokerCount}</strong> <button onClick={() => setBrokerCount(Math.max(1, brokerCount - 1))}>-</button> <button onClick={() => setBrokerCount(brokerCount + 1)}>+</button></div>
          <div>Throughput: {Math.min(actualSent, kafkaCapacity).toLocaleString()} msg/s</div>
          <ResourceBar percent={Number(kafkaUtil)} />
          <div style={{ marginTop: 4 }}>{kafkaUtil}% Used</div>
        </div>
        <div style={{ flex: 1, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h3>Spark Cluster</h3>
          <div>Executors: <strong>{executors}</strong> <button onClick={() => setExecutors(Math.max(1, executors - 1))}>-</button> <button onClick={() => setExecutors(executors + 1)}>+</button></div>
          <div>Batch Duration: {batchDuration} s</div>
          <ResourceBar percent={Number(sparkUtil)} />
          <div style={{ marginTop: 4 }}>{sparkUtil}% Used</div>
        </div>
        <div style={{ flex: 1, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h3>Database Type</h3>
          <label><input type="radio" value="postgres" checked={dbType==='postgres'} onChange={() => setDbType('postgres')} /> Postgres</label><br />
          <label><input type="radio" value="mongodb" checked={dbType==='mongodb'} onChange={() => setDbType('mongodb')} /> MongoDB</label>
        </div>
      </div>
    </div>
  );
}
