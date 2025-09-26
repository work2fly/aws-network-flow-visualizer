import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NetworkTopologyRenderer } from '../NetworkTopologyRenderer';
import { NetworkTopology } from '@shared/types';

// Mock Cytoscape
jest.mock('cytoscape', () => {
  const mockCy = {
    on: jest.fn(),
    elements: jest.fn(() => ({
      remove: jest.fn(),
      removeClass: jest.fn(),
      not: jest.fn(() => ({
        addClass: jest.fn()
      }))
    })),
    add: jest.fn(),
    layout: jest.fn(() => ({
      run: jest.fn()
    })),
    fit: jest.fn(),
    center: jest.fn(),
    destroy: jest.fn(),
    getElementById: jest.fn(() => ({
      addClass: jest.fn()
    })),
    edges: jest.fn(() => ({
      forEach: jest.fn()
    })),
    nodes: jest.fn(() => ({
      forEach: jest.fn()
    }))
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
      id: 'instance-456',
      type: 'instance',
      label: 'Test Instance',
      properties: {
        name: 'test-instance',
        instanceType: 't3.micro',
        privateIpAddress: '10.0.1.100'
      },
      metadata: {
        trafficVolume: 500000,
        connectionCount: 25,
        isActive: false
      }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'vpc-123',
      target: 'instance-456',
      trafficStats: {
        totalBytes: 2000000,
        totalPackets: 10000,
        acceptedConnections: 100,
        rejectedConnections: 5,
        uniqueSourceIPs: 10,
        uniqueDestinationIPs: 15,
        topPorts: [],
        timeRange: { start: new Date(), end: new Date() },
        sourceToTargetBytes: 1200000,
        targetToSourceBytes: 800000,
        sourceToTargetPackets: 6000,
        targetToSourcePackets: 4000,
        protocolDistribution: []
      },
      flowRecords: [],
      properties: {
        connectionType: 'direct',
        protocols: ['TCP', 'UDP'],
        ports: [80, 443, 22],
        bidirectional: true,
        hasRejectedConnections: true
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

describe('NetworkTopologyRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<NetworkTopologyRenderer topology={null} />);
    expect(screen.getByText('No topology data')).toBeInTheDocument();
  });

  it('displays empty state when no topology provided', () => {
    render(<NetworkTopologyRenderer topology={null} />);
    
    expect(screen.getByText('No topology data')).toBeInTheDocument();
    expect(screen.getByText('Load flow log data to visualize network topology')).toBeInTheDocument();
  });

  it('renders enhanced control buttons', () => {
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    expect(screen.getByTitle('Fit to viewport')).toBeInTheDocument();
    expect(screen.getByTitle('Center view')).toBeInTheDocument();
    expect(screen.getByTitle('Clear highlights')).toBeInTheDocument();
  });

  it('renders layout selector', () => {
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    const layoutSelector = screen.getByTitle('Layout algorithm');
    expect(layoutSelector).toBeInTheDocument();
    expect(layoutSelector).toHaveValue('cose');
  });

  it('renders legend', () => {
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('VPC')).toBeInTheDocument();
    expect(screen.getByText('Subnet')).toBeInTheDocument();
    expect(screen.getByText('Instance')).toBeInTheDocument();
    expect(screen.getByText('Transit Gateway')).toBeInTheDocument();
    expect(screen.getByText('VPN')).toBeInTheDocument();
  });

  it('handles layout algorithm change', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    const layoutSelector = screen.getByTitle('Layout algorithm');
    fireEvent.change(layoutSelector, { target: { value: 'dagre' } });
    
    // Should call layout with new algorithm
    expect(mockCy.layout).toHaveBeenCalled();
  });

  it('handles fit button click', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    const fitButton = screen.getByTitle('Fit to viewport');
    fireEvent.click(fitButton);
    
    expect(mockCy.fit).toHaveBeenCalledWith(undefined, 50);
  });

  it('handles center button click', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    const centerButton = screen.getByTitle('Center view');
    fireEvent.click(centerButton);
    
    expect(mockCy.center).toHaveBeenCalled();
  });

  it('handles clear highlights button click', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    const clearButton = screen.getByTitle('Clear highlights');
    fireEvent.click(clearButton);
    
    expect(mockCy.elements).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = render(
      <NetworkTopologyRenderer 
        topology={mockTopology} 
        className="custom-class"
      />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('respects showAnimations prop', () => {
    render(
      <NetworkTopologyRenderer 
        topology={mockTopology} 
        showAnimations={false}
      />
    );
    
    // Component should render without animations
    expect(screen.getByTitle('Fit to viewport')).toBeInTheDocument();
  });

  it('respects layoutAlgorithm prop', () => {
    render(
      <NetworkTopologyRenderer 
        topology={mockTopology} 
        layoutAlgorithm="dagre"
      />
    );
    
    const layoutSelector = screen.getByTitle('Layout algorithm');
    expect(layoutSelector).toHaveValue('dagre');
  });

  it('calls onNodeSelect when provided', () => {
    const mockOnNodeSelect = jest.fn();
    render(
      <NetworkTopologyRenderer 
        topology={mockTopology} 
        onNodeSelect={mockOnNodeSelect}
      />
    );
    
    // The actual node selection would be handled by Cytoscape events
    expect(mockOnNodeSelect).not.toHaveBeenCalled();
  });

  it('calls onEdgeSelect when provided', () => {
    const mockOnEdgeSelect = jest.fn();
    render(
      <NetworkTopologyRenderer 
        topology={mockTopology} 
        onEdgeSelect={mockOnEdgeSelect}
      />
    );
    
    // The actual edge selection would be handled by Cytoscape events
    expect(mockOnEdgeSelect).not.toHaveBeenCalled();
  });
});

describe('Enhanced Cytoscape Integration', () => {
  it('initializes Cytoscape with advanced configuration', () => {
    const cytoscape = require('cytoscape');
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    expect(cytoscape).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.any(Array),
        layout: expect.any(Object),
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: true,
        selectionType: 'single',
        autoungrabify: false,
        autounselectify: false,
        textureOnViewport: true,
        motionBlur: true,
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 5.0
      })
    );
  });

  it('adds enhanced nodes and edges to Cytoscape', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    expect(mockCy.add).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'vpc-123',
            type: 'vpc',
            label: 'Test VPC',
            nodeSize: expect.any(Number),
            nodeColor: expect.any(String)
          }),
          classes: expect.any(String)
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'instance-456',
            type: 'instance',
            label: 'Test Instance'
          })
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'edge-1',
            source: 'vpc-123',
            target: 'instance-456',
            edgeWidth: expect.any(Number),
            edgeColor: expect.any(String)
          }),
          classes: expect.any(String)
        })
      ])
    );
  });

  it('cleans up animations and Cytoscape instance on unmount', () => {
    const cytoscape = require('cytoscape');
    const mockCy = cytoscape();
    
    const { unmount } = render(<NetworkTopologyRenderer topology={mockTopology} />);
    
    unmount();
    
    expect(mockCy.destroy).toHaveBeenCalled();
  });
});