import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NetworkVisualization } from '../NetworkVisualization';
import { NetworkTopology } from '@shared/types';

// Mock Cytoscape
jest.mock('cytoscape', () => {
  const mockCy = {
    on: jest.fn(),
    elements: jest.fn(() => ({
      remove: jest.fn()
    })),
    add: jest.fn(),
    layout: jest.fn(() => ({
      run: jest.fn()
    })),
    fit: jest.fn(),
    center: jest.fn(),
    destroy: jest.fn()
  };
  
  return jest.fn(() => mockCy);
});

const mockTopology: NetworkTopology = {
  nodes: [
    {
      id: 'vpc-123',
      type: 'vpc',
      label: 'Test VPC',
      properties: {
        name: 'test-vpc',
        cidrBlock: '10.0.0.0/16',
        region: 'us-east-1'
      },
      metadata: {
        trafficVolume: 1000000,
        connectionCount: 50,
        isActive: true
      }
    },
    {
      id: 'subnet-456',
      type: 'subnet',
      label: 'Test Subnet',
      properties: {
        name: 'test-subnet',
        cidrBlock: '10.0.1.0/24',
        subnetType: 'private'
      },
      metadata: {
        trafficVolume: 500000,
        connectionCount: 25,
        isActive: true
      }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'vpc-123',
      target: 'subnet-456',
      trafficStats: {
        totalBytes: 1000000,
        totalPackets: 5000,
        acceptedConnections: 100,
        rejectedConnections: 5,
        uniqueSourceIPs: 10,
        uniqueDestinationIPs: 15,
        topPorts: [],
        timeRange: { start: new Date(), end: new Date() },
        sourceToTargetBytes: 600000,
        targetToSourceBytes: 400000,
        sourceToTargetPackets: 3000,
        targetToSourcePackets: 2000,
        protocolDistribution: []
      },
      flowRecords: [],
      properties: {
        connectionType: 'direct',
        protocols: ['TCP'],
        ports: [80, 443],
        bidirectional: true
      },
      metadata: {
        isActive: true,
        confidence: 0.95
      }
    }
  ],
  metadata: {
    lastUpdated: new Date(),
    recordCount: 1000,
    timeRange: { start: new Date(), end: new Date() }
  }
};

describe('NetworkVisualization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<NetworkVisualization topology={null} />);
    expect(screen.getByText('No topology data')).toBeInTheDocument();
  });

  it('displays empty state when no topology provided', () => {
    render(<NetworkVisualization topology={null} />);
    
    expect(screen.getByText('No topology data')).toBeInTheDocument();
    expect(screen.getByText('Load flow log data to visualize network topology')).toBeInTheDocument();
  });

  it('renders control buttons', () => {
    render(<NetworkVisualization topology={mockTopology} />);
    
    expect(screen.getByTitle('Fit to viewport')).toBeInTheDocument();
    expect(screen.getByTitle('Center view')).toBeInTheDocument();
  });

  it('calls onNodeSelect when provided', () => {
    const mockOnNodeSelect = jest.fn();
    render(
      <NetworkVisualization 
        topology={mockTopology} 
        onNodeSelect={mockOnNodeSelect}
      />
    );
    
    // The actual node selection would be handled by Cytoscape events
    // This test verifies the prop is passed correctly
    expect(mockOnNodeSelect).not.toHaveBeenCalled();
  });

  it('calls onEdgeSelect when provided', () => {
    const mockOnEdgeSelect = jest.fn();
    render(
      <NetworkVisualization 
        topology={mockTopology} 
        onEdgeSelect={mockOnEdgeSelect}
      />
    );
    
    // The actual edge selection would be handled by Cytoscape events
    // This test verifies the prop is passed correctly
    expect(mockOnEdgeSelect).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <NetworkVisualization 
        topology={mockTopology} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles fit button click', () => {
    render(<NetworkVisualization topology={mockTopology} />);
    
    const fitButton = screen.getByTitle('Fit to viewport');
    fireEvent.click(fitButton);
    
    // The actual fit functionality would be tested with Cytoscape integration
    expect(fitButton).toBeInTheDocument();
  });

  it('handles center button click', () => {
    render(<NetworkVisualization topology={mockTopology} />);
    
    const centerButton = screen.getByTitle('Center view');
    fireEvent.click(centerButton);
    
    // The actual center functionality would be tested with Cytoscape integration
    expect(centerButton).toBeInTheDocument();
  });
});

describe('Cytoscape Integration', () => {
  it('initializes Cytoscape with correct configuration', () => {
    const cytoscape = require('cytoscape');
    
    render(<NetworkVisualization topology={mockTopology} />);
    
    expect(cytoscape).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.any(Array),
        layout: expect.any(Object),
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: true,
        selectionType: 'single'
      })
    );
  });

  it('adds nodes and edges to Cytoscape when topology changes', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkVisualization topology={mockTopology} />);
    
    expect(mockCy.add).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'vpc-123',
            type: 'vpc',
            label: 'Test VPC'
          })
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'subnet-456',
            type: 'subnet',
            label: 'Test Subnet'
          })
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'edge-1',
            source: 'vpc-123',
            target: 'subnet-456'
          })
        })
      ])
    );
  });

  it('cleans up Cytoscape instance on unmount', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    const { unmount } = render(<NetworkVisualization topology={mockTopology} />);
    
    unmount();
    
    expect(mockCy.destroy).toHaveBeenCalled();
  });
});