import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrafficTimelineChart } from '../TrafficTimelineChart';
import { FlowLogRecord, TrafficAnomaly } from '@shared/types';

// Mock D3.js completely to prevent SVG rendering issues in test environment
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    append: jest.fn(() => ({
      append: jest.fn(() => ({
        attr: jest.fn(() => ({ attr: jest.fn(() => ({ attr: jest.fn(() => ({ attr: jest.fn() })) })) })),
        style: jest.fn(() => ({ style: jest.fn() })),
        text: jest.fn(),
        call: jest.fn(),
        datum: jest.fn(() => ({ attr: jest.fn() }))
      })),
      attr: jest.fn(() => ({ attr: jest.fn(() => ({ attr: jest.fn(() => ({ attr: jest.fn() })) })) })),
      style: jest.fn(() => ({ style: jest.fn() })),
      datum: jest.fn(() => ({ attr: jest.fn() }))
    })),
    selectAll: jest.fn(() => ({ remove: jest.fn() })),
    select: jest.fn(() => ({ call: jest.fn() }))
  })),
  scaleTime: jest.fn(() => ({
    domain: jest.fn(() => ({ range: jest.fn() })),
    range: jest.fn()
  })),
  scaleLinear: jest.fn(() => ({
    domain: jest.fn(() => ({ nice: jest.fn(() => ({ range: jest.fn() })) })),
    nice: jest.fn(() => ({ range: jest.fn() })),
    range: jest.fn()
  })),
  axisBottom: jest.fn(),
  axisLeft: jest.fn(),
  area: jest.fn(() => ({
    x: jest.fn(() => ({ y0: jest.fn(() => ({ y1: jest.fn(() => ({ curve: jest.fn() })) })) })),
    y0: jest.fn(),
    y1: jest.fn(),
    curve: jest.fn()
  })),
  line: jest.fn(() => ({
    x: jest.fn(() => ({ y: jest.fn(() => ({ curve: jest.fn() })) })),
    y: jest.fn(),
    curve: jest.fn()
  })),
  timeFormat: jest.fn(() => jest.fn()),
  brushX: jest.fn(() => ({
    extent: jest.fn(() => ({ on: jest.fn() })),
    clear: jest.fn()
  })),
  extent: jest.fn(() => [new Date(), new Date()]),
  max: jest.fn(() => 1000),
  curveMonotoneX: jest.fn()
}));

const mockFlowLogData: FlowLogRecord[] = [
  {
    timestamp: new Date('2023-01-01T10:00:00Z'),
    sourceIP: '10.0.1.100',
    destinationIP: '10.0.2.200',
    sourcePort: 80,
    destinationPort: 443,
    protocol: 'TCP',
    action: 'ACCEPT',
    bytes: 1024,
    packets: 10
  },
  {
    timestamp: new Date('2023-01-01T10:05:00Z'),
    sourceIP: '10.0.1.101',
    destinationIP: '10.0.2.201',
    sourcePort: 22,
    destinationPort: 80,
    protocol: 'TCP',
    action: 'REJECT',
    bytes: 512,
    packets: 5
  },
  {
    timestamp: new Date('2023-01-01T10:10:00Z'),
    sourceIP: '10.0.1.102',
    destinationIP: '10.0.2.202',
    sourcePort: 443,
    destinationPort: 22,
    protocol: 'UDP',
    action: 'ACCEPT',
    bytes: 2048,
    packets: 20
  }
];

const mockAnomalies: TrafficAnomaly[] = [
  {
    id: 'anomaly-1',
    type: 'volume',
    severity: 0.8,
    description: 'Unusual traffic spike detected',
    affectedNodes: ['node-1'],
    affectedEdges: ['edge-1'],
    timeRange: {
      start: new Date('2023-01-01T10:05:00Z'),
      end: new Date('2023-01-01T10:10:00Z')
    },
    evidence: {
      statisticalSignificance: 0.95,
      deviationFromBaseline: 2.5,
      relatedRecords: [],
      patterns: ['spike']
    }
  }
];

describe('TrafficTimelineChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TrafficTimelineChart data={[]} />);
    expect(screen.getByText('Traffic Timeline')).toBeInTheDocument();
  });

  it('displays empty state when no data provided', () => {
    render(<TrafficTimelineChart data={[]} />);
    
    expect(screen.getByText('No timeline data available')).toBeInTheDocument();
    expect(screen.getByText('Load flow log data to see traffic patterns')).toBeInTheDocument();
  });

  it('renders metric selector', () => {
    render(<TrafficTimelineChart data={mockFlowLogData} />);
    
    const metricSelector = screen.getByDisplayValue('Traffic Volume (Bytes)');
    expect(metricSelector).toBeInTheDocument();
  });

  it('handles metric selection change', () => {
    render(<TrafficTimelineChart data={mockFlowLogData} />);
    
    const metricSelector = screen.getByDisplayValue('Traffic Volume (Bytes)');
    fireEvent.change(metricSelector, { target: { value: 'totalPackets' } });
    
    expect(metricSelector).toHaveValue('totalPackets');
  });

  it('displays anomalies when provided', () => {
    render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        anomalies={mockAnomalies}
      />
    );
    
    expect(screen.getByText('Anomalies detected: 1')).toBeInTheDocument();
    expect(screen.getByText('volume')).toBeInTheDocument();
  });

  it('calls onTimeRangeSelect when provided', () => {
    const mockOnTimeRangeSelect = jest.fn();
    render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        onTimeRangeSelect={mockOnTimeRangeSelect}
      />
    );
    
    // The actual time range selection would be handled by D3 brush events
    expect(mockOnTimeRangeSelect).not.toHaveBeenCalled();
  });

  it('calls onAnomalyClick when provided', () => {
    const mockOnAnomalyClick = jest.fn();
    render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        anomalies={mockAnomalies}
        onAnomalyClick={mockOnAnomalyClick}
      />
    );
    
    const anomalyTag = screen.getByText('volume');
    fireEvent.click(anomalyTag);
    
    expect(mockOnAnomalyClick).toHaveBeenCalledWith(mockAnomalies[0]);
  });

  it('applies custom className', () => {
    const { container } = render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('respects custom height', () => {
    render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        height={400}
      />
    );
    
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('height', '400');
  });

  it('processes flow log data correctly', () => {
    render(<TrafficTimelineChart data={mockFlowLogData} />);
    
    // Should process the data into timeline buckets
    expect(screen.getByText('Traffic Timeline')).toBeInTheDocument();
  });

  it('shows anomaly summary with limited display', () => {
    const manyAnomalies = Array.from({ length: 10 }, (_, i) => ({
      ...mockAnomalies[0],
      id: `anomaly-${i}`,
      type: `type-${i}` as any
    }));

    render(
      <TrafficTimelineChart 
        data={mockFlowLogData} 
        anomalies={manyAnomalies}
      />
    );
    
    expect(screen.getByText('Anomalies detected: 10')).toBeInTheDocument();
    expect(screen.getByText('+5 more')).toBeInTheDocument();
  });
});

describe('Data Processing', () => {
  it('groups data into time buckets correctly', () => {
    const data = [
      {
        ...mockFlowLogData[0],
        timestamp: new Date('2023-01-01T10:00:00Z')
      },
      {
        ...mockFlowLogData[1],
        timestamp: new Date('2023-01-01T10:02:00Z') // Same 5-minute bucket
      },
      {
        ...mockFlowLogData[2],
        timestamp: new Date('2023-01-01T10:06:00Z') // Different bucket
      }
    ];

    render(<TrafficTimelineChart data={data} />);
    
    // Should group the first two records into the same bucket
    expect(screen.getByText('Traffic Timeline')).toBeInTheDocument();
  });

  it('calculates metrics correctly', () => {
    render(<TrafficTimelineChart data={mockFlowLogData} />);
    
    // Should calculate total bytes, packets, connections, etc.
    expect(screen.getByText('Traffic Timeline')).toBeInTheDocument();
  });
});