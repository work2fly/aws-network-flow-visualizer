import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular, EventObject } from 'cytoscape';
import { NetworkTopology, NetworkNode, NetworkEdge } from '@shared/types';

interface NetworkVisualizationProps {
  topology: NetworkTopology | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
  className?: string;
}

export const NetworkVisualization: React.FC<NetworkVisualizationProps> = ({
  topology,
  onNodeSelect,
  onEdgeSelect,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: getCytoscapeStyles(),
      layout: getDefaultLayout(),
      // Interaction settings
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      selectionType: 'single',
      // Performance settings
      textureOnViewport: true,
      motionBlur: true,
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3.0
    });

    // Event handlers
    cy.on('tap', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      onNodeSelect?.(node.id());
    });

    cy.on('tap', 'edge', (event: EventObject) => {
      const edge = event.target as EdgeSingular;
      onEdgeSelect?.(edge.id());
    });

    cy.on('tap', (event: EventObject) => {
      if (event.target === cy) {
        // Clicked on background - clear selection
        onNodeSelect?.(null);
        onEdgeSelect?.(null);
      }
    });

    cyRef.current = cy;
    setIsInitialized(true);

    return () => {
      cy.destroy();
      cyRef.current = null;
      setIsInitialized(false);
    };
  }, []); // Remove dependencies to prevent infinite loop

  // Update topology data
  useEffect(() => {
    if (!cyRef.current || !topology) return;

    const cy = cyRef.current;
    
    // Clear existing elements
    cy.elements().remove();

    // Add nodes
    const cytoscapeNodes = topology.nodes.map(node => ({
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        ...node.properties,
        trafficVolume: node.metadata.trafficVolume || 0,
        connectionCount: node.metadata.connectionCount || 0,
        isActive: node.metadata.isActive || false
      },
      position: node.position
    }));

    // Add edges
    const cytoscapeEdges = topology.edges.map(edge => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        totalBytes: edge.trafficStats.totalBytes,
        totalPackets: edge.trafficStats.totalPackets,
        acceptedConnections: edge.trafficStats.acceptedConnections,
        rejectedConnections: edge.trafficStats.rejectedConnections,
        hasRejectedConnections: edge.properties.hasRejectedConnections || false,
        bidirectional: edge.properties.bidirectional || false,
        animated: edge.style?.animated || false
      }
    }));

    // Add elements to cytoscape
    cy.add([...cytoscapeNodes, ...cytoscapeEdges]);

    // Apply layout
    const layout = cy.layout(getLayoutForTopology(topology));
    layout.run();

  }, [topology]);

  // Fit to viewport when topology changes
  const fitToViewport = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50); // 50px padding
    }
  }, []);

  useEffect(() => {
    if (topology && cyRef.current) {
      // Small delay to ensure layout is complete
      setTimeout(fitToViewport, 100);
    }
  }, [topology, fitToViewport]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-gray-50 border border-gray-200 rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={fitToViewport}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          title="Fit to viewport"
        >
          Fit
        </button>
        <button
          onClick={() => cyRef.current?.center()}
          className="px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          title="Center view"
        >
          Center
        </button>
      </div>

      {!topology && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
          <div className="text-center">
            <div className="text-gray-500 text-lg font-medium">No topology data</div>
            <div className="text-gray-400 text-sm mt-1">Load flow log data to visualize network topology</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Cytoscape styles configuration
function getCytoscapeStyles() {
  return [
    // Node styles
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'border-color': '#333',
        'border-width': 1,
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'font-weight': 'bold',
        'color': '#333',
        'text-outline-color': '#fff',
        'text-outline-width': 1,
        'width': 'mapData(trafficVolume, 0, 1000000, 30, 80)',
        'height': 'mapData(trafficVolume, 0, 1000000, 30, 80)',
        'shape': 'data(shape)'
      }
    },
    // Node type specific styles
    {
      selector: 'node[type = "vpc"]',
      style: {
        'background-color': '#3B82F6',
        'shape': 'round-rectangle'
      }
    },
    {
      selector: 'node[type = "subnet"]',
      style: {
        'background-color': '#10B981',
        'shape': 'rectangle'
      }
    },
    {
      selector: 'node[type = "instance"]',
      style: {
        'background-color': '#F59E0B',
        'shape': 'ellipse'
      }
    },
    {
      selector: 'node[type = "tgw"]',
      style: {
        'background-color': '#8B5CF6',
        'shape': 'diamond'
      }
    },
    {
      selector: 'node[type = "vpn"]',
      style: {
        'background-color': '#EF4444',
        'shape': 'triangle'
      }
    },
    {
      selector: 'node[type = "internet-gateway"]',
      style: {
        'background-color': '#06B6D4',
        'shape': 'hexagon'
      }
    },
    // Active node highlighting
    {
      selector: 'node[isActive = true]',
      style: {
        'border-width': 3,
        'border-color': '#22C55E'
      }
    },
    // Selected node
    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#DC2626',
        'overlay-color': '#DC2626',
        'overlay-opacity': 0.2
      }
    },
    // Edge styles
    {
      selector: 'edge',
      style: {
        'width': 'mapData(totalBytes, 0, 10000000, 2, 12)',
        'line-color': '#64748B',
        'target-arrow-color': '#64748B',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.8
      }
    },
    // Bidirectional edges
    {
      selector: 'edge[bidirectional = true]',
      style: {
        'source-arrow-shape': 'triangle',
        'source-arrow-color': '#64748B'
      }
    },
    // Rejected connections
    {
      selector: 'edge[hasRejectedConnections = true]',
      style: {
        'line-color': '#EF4444',
        'target-arrow-color': '#EF4444',
        'source-arrow-color': '#EF4444',
        'line-style': 'dashed'
      }
    },
    // High traffic edges
    {
      selector: 'edge[totalBytes > 1000000]',
      style: {
        'line-color': '#F59E0B',
        'target-arrow-color': '#F59E0B',
        'source-arrow-color': '#F59E0B'
      }
    },
    // Selected edge
    {
      selector: 'edge:selected',
      style: {
        'line-color': '#DC2626',
        'target-arrow-color': '#DC2626',
        'source-arrow-color': '#DC2626',
        'width': 6,
        'overlay-color': '#DC2626',
        'overlay-opacity': 0.2
      }
    },
    // Animated edges
    {
      selector: 'edge[animated = true]',
      style: {
        'line-dash-pattern': [6, 3],
        'line-dash-offset': 24
      }
    }
  ];
}

// Default layout configuration
function getDefaultLayout() {
  return {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    animationEasing: 'ease-out',
    nodeRepulsion: 400000,
    nodeOverlap: 10,
    idealEdgeLength: 100,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  };
}

// Layout selection based on topology characteristics
function getLayoutForTopology(topology: NetworkTopology) {
  const nodeCount = topology.nodes.length;
  const edgeCount = topology.edges.length;
  
  // For small topologies, use hierarchical layout
  if (nodeCount < 20) {
    return {
      name: 'dagre',
      animate: true,
      animationDuration: 1000,
      rankDir: 'TB',
      nodeSep: 50,
      edgeSep: 10,
      rankSep: 100
    };
  }
  
  // For medium topologies, use force-directed layout
  if (nodeCount < 100) {
    return getDefaultLayout();
  }
  
  // For large topologies, use grid layout for performance
  return {
    name: 'grid',
    animate: true,
    animationDuration: 500,
    rows: Math.ceil(Math.sqrt(nodeCount)),
    cols: Math.ceil(Math.sqrt(nodeCount))
  };
}