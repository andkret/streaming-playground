import React, { useState, useEffect } from 'react';
import ReactFlow, { Background, Controls as FlowControls, Handle, Position } from 'react-flow-renderer';

const nodeStyles = {
  padding: 10,
  border: '1px solid #222',
  borderRadius: 5,
  background: '#fff',
  textAlign: 'center',
};

function PipelineNode({ data }) {
  return (
    <div style={nodeStyles}>
      <Handle type="target" position={Position.Left} />
      <div>{data.label}</div>
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
  const [kafkaLag, setKafkaLag] = useState(0);
  const [sparkLag, setSparkLag] = useState(0);
  const [dbLag, setDbLag] = useState(0);
  const [brokerCount, setBrokerCount] = useState(1);
  const [executors, setExecutors] = useState(1);

  const kafkaCapacity = 50000 * brokerCount;
  const sparkCapacity = 40000 * executors;

  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Calculate component overflows
      const kafkaOverflow = Math.max(0, messageRate - kafkaCapacity);
      const sparkOverflow = Math.max(0, messageRate - sparkCapacity);

      // 2. Determine DB write speed and overflow
      let writeSpeed;
      if (dbType === 'mongodb') {
        writeSpeed = messageRate;
      } else if (messageRate <= 25000) {
        writeSpeed = messageRate;
      } else if (messageRate <= 50000) {
        writeSpeed = messageRate / 2;
      } else {
        writeSpeed = 0;
      }
      const dbOverflow = Math.max(0, messageRate - writeSpeed);

      // 3. Propagate backpressure to Spark
      // Spark backlog grows by the larger of its own overflow or the DB overflow
      const newSparkLag = Math.max(sparkOverflow, dbOverflow);

      // 4. Propagate from Spark to DB sink
      const newDbLag = newSparkLag;

      // 5. Propagate from Spark to Kafka
      const newKafkaLag = newSparkLag;

      setSparkLag(newSparkLag);
      setDbLag(newDbLag);
      setKafkaLag(newKafkaLag);
    }, 1000);
    return () => clearInterval(interval);
  }, [messageRate, brokerCount, executors, dbType]);

  // Metrics & UI
  const kafkaThroughput = Math.min(messageRate, kafkaCapacity);
  const sparkThroughput = Math.min(messageRate, sparkCapacity);
  const kafkaUsed = ((kafkaThroughput / kafkaCapacity) * 100).toFixed(0);
  const sparkUsed = ((sparkThroughput / sparkCapacity) * 100).toFixed(0);

  // Batch duration capped at 30s when DB stalls, otherwise base 1s + sparkLag factor
  const fullStall = dbType !== 'mongodb' && messageRate > 50000;
  const batchDuration = fullStall ? 30 : Number((1 + sparkLag * 0.001).toFixed(2));

  const nodes = [
    {
      id: 'producer',
      type: 'pipelineNode',
      data: {
        label: (
          <div>
            <strong>Producer</strong>
            <div>Rate: {messageRate.toLocaleString()} msg/s</div>
          </div>
        ),
      },
      position: { x: 50, y: 100 },
    },
    {
      id: 'kafka',
      type: 'pipelineNode',
      data: {
        label: (
          <div>
            <strong>Kafka Broker</strong>
            <div>Lag: {kafkaLag.toLocaleString()} msg</div>
          </div>
        ),
      },
      position: { x: 300, y: 100 },
    },
    {
      id: 'spark',
      type: 'pipelineNode',
      data: {
        label: (
          <div>
            <strong>Spark Processor</strong>
            <div>Lag: {sparkLag.toLocaleString()} msg</div>
          </div>
        ),
      },
      position: { x: 550, y: 100 },
    },
    {
      id: 'db',
      type: 'pipelineNode',
      data: {
        label: (
          <div>
            <strong>Database Sink</strong>
            <div>Lag: {dbLag.toLocaleString()} msg</div>
          </div>
        ),
      },
      position: { x: 800, y: 100 },
    },
  ];

  const edges = [
    { id: 'e1', source: 'producer', target: 'kafka', animated: true },
    { id: 'e2', source: 'kafka', target: 'spark', animated: true },
    { id: 'e3', source: 'spark', target: 'db', animated: true },
  ];

  return (
    <div>
      <div style={{ width: '100%', height: '400px', border: '1px solid #ddd', borderRadius: 8 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={{ pipelineNode: PipelineNode }}
          fitView
        >
          <Background />
          <FlowControls />
        </ReactFlow>
      </div>
      <div style={{ display: 'flex', marginTop: '1rem', gap: '1rem' }}>
        <div style={{ flex: 1, padding: '1rem', background: '#fafafa', borderRadius: 8 }}>
          <h3>Component States</h3>
          <ul>
            <li><strong>Producer Rate:</strong> {messageRate.toLocaleString()} msg/s</li>
            <li><strong>Kafka Lag:</strong> {kafkaLag.toLocaleString()} msg</li>
            <li><strong>Spark Lag:</strong> {sparkLag.toLocaleString()} msg</li>
            <li><strong>Database Lag:</strong> {dbLag.toLocaleString()} msg</li>
          </ul>
        </div>
        <div style={{ flex: 1, padding: '1rem', background: '#fff', borderRadius: 8 }}>
          <h3>Kafka Cluster</h3>
          <div>
            Brokers: <strong>{brokerCount}</strong>{' '}
            <button onClick={() => setBrokerCount(Math.max(1, brokerCount - 1))}>-</button>{' '}
            <button onClick={() => setBrokerCount(brokerCount + 1)}>+</button>
          </div>
          <div>Throughput: {kafkaThroughput.toLocaleString()} msg/s</div>
          <ResourceBar percent={Number(kafkaUsed)} />
          <div style={{ marginTop: 4 }}>{kafkaUsed}% Used</div>
        </div>
        <div style={{ flex: 1, padding: '1rem', background: '#fff', borderRadius: 8 }}>
          <h3>Spark Cluster</h3>
          <div>
            Executors: <strong>{executors}</strong>{' '}
            <button onClick={() => setExecutors(Math.max(1, executors - 1))}>-</button>{' '}
            <button onClick={() => setExecutors(executors + 1)}>+</button>
          </div>
          <div>Batch Duration: {batchDuration} s</div>
          <ResourceBar percent={Number(sparkUsed)} />
          <div style={{ marginTop: 4 }}>{sparkUsed}% Used</div>
        </div>
        <div style={{ flex: 1, padding: '1rem', background: '#fff', borderRadius: 8 }}>
          <h3>Database Type</h3>
          <label>
            <input type="radio" value="postgres" checked={dbType==='postgres'} onChange={()=>setDbType('postgres')} /> Postgres
          </label>
          <br />
          <label>
            <input type="radio" value="mongodb" checked={dbType==='mongodb'} onChange={()=>setDbType('mongodb')} /> MongoDB
          </label>
        </div>
      </div>
    </div>
  );
}
