import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import cytoscape, { Core, NodeSingular, EdgeSingular, AnimationOptions } from 'cytoscape';
import { NetworkTopology, NetworkNode, NetworkEdge } from '@shared/types';

interface NetworkTopologyRendererProps {
  topology: NetworkTopology | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
  showAnimations?: boolean;
  layoutAlgorithm?: 'cose' | 'dagre' | 'grid' | 'circle' | 'breadthfirst';
  className?: string;
}

export interface NetworkTopologyRendererRef {
  getCytoscapeInstance: () => Core | null;
  exportImage: (format: 'png' | 'svg', options?: any) => Promise<Blob>;
}

export const NetworkTopologyRenderer = forwardRef<NetworkTopologyRendererRef, NetworkTopologyRendererProps>(({
  topology,
  onNodeSelect,
  onEdgeSelect,
  showAnimations = true,
  layoutAlgorithm = 'cose',
  className = ''
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Cytoscape instance
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: getAdvancedCytoscapeStyles(),
      layout: getLayoutConfig(layoutAlgorithm),
      // Enhanced interaction settings
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      selectionType: 'single',
      autoungrabify: false,
      autounselectify: false,
      // Performance settings
      textureOnViewport: true,
      motionBlur: true,
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 5.0,
      pixelRatio: 'auto'
    });

    // Enhanced event handlers
    setupEventHandlers(cy, onNodeSelect, onEdgeSelect);

    cyRef.current = cy;
    setIsInitialized(true);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
      cy.destroy();
      cyRef.current = null;
      setIsInitialized(false);
    };
  }, []);

  // Update topology data with enhanced rendering
  useEffect(() => {
    if (!cyRef.current || !topology) return;

    const cy = cyRef.current;
    
    // Clear existing elements
    cy.elements().remove();

    // Calculate traffic statistics for visual scaling
    const maxTrafficVolume = Math.max(
      ...topology.edges.map(edge => edge.trafficStats.totalBytes),
      1
    );
    const maxNodeTraffic = Math.max(
      ...topology.nodes.map(node => node.metadata.trafficVolume || 0),
      1
    );

    // Add nodes with enhanced visual properties
    const cytoscapeNodes = topology.nodes.map(node => ({
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        ...node.properties,
        trafficVolume: node.metadata.trafficVolume || 0,
        connectionCount: node.metadata.connectionCount || 0,
        isActive: node.metadata.isActive || false,
        maxNodeTraffic,
        // Visual scaling
        nodeSize: calculateNodeSize(node.metadata.trafficVolume || 0, maxNodeTraffic),
        nodeColor: getNodeColor(node.type, node.metadata.isActive || false),
        borderWidth: node.metadata.isActive ? 3 : 1
      },
      position: node.position,
      classes: getNodeClasses(node)
    }));

    // Add edges with enhanced visual properties
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
        maxTrafficVolume,
        // Visual scaling
        edgeWidth: calculateEdgeWidth(edge.trafficStats.totalBytes, maxTrafficVolume),
        edgeColor: getEdgeColor(edge),
        animated: showAnimations && edge.trafficStats.totalBytes > maxTrafficVolume * 0.1,
        // Traffic direction indicators
        sourceToTargetRatio: edge.trafficStats.sourceToTargetBytes / (edge.trafficStats.totalBytes || 1),
        targetToSourceRatio: edge.trafficStats.targetToSourceBytes / (edge.trafficStats.totalBytes || 1)
      },
      classes: getEdgeClasses(edge)
    }));

    // Add elements to cytoscape
    cy.add([...cytoscapeNodes, ...cytoscapeEdges]);

    // Apply layout with animation
    const layout = cy.layout(getLayoutConfig(layoutAlgorithm, topology));
    layout.run();

    // Start traffic flow animations if enabled
    if (showAnimations) {
      startTrafficAnimations(cy);
    }

  }, [topology, layoutAlgorithm, showAnimations]);

  // Traffic flow animation system
  const startTrafficAnimations = useCallback((cy: Core) => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    animationRef.current = setInterval(() => {
      // Animate high-traffic edges
      cy.edges('.high-traffic').forEach((edge: EdgeSingular) => {
        const edgeData = edge.data();
        if (edgeData.animated) {
          // Create flowing animation effect
          edge.animate({
            style: {
              'line-dash-offset': edgeData.lineDashOffset ? 0 : 24
            }
          }, {
            duration: 2000,
            easing: 'linear'
          });
          edge.data('lineDashOffset', !edgeData.lineDashOffset);
        }
      });

      // Pulse active nodes
      cy.nodes('.active').forEach((node: NodeSingular) => {
        node.animate({
          style: {
            'border-width': node.style('border-width') === '3px' ? '5px' : '3px'
          }
        }, {
          duration: 1500,
          easing: 'ease-in-out'
        });
      });
    }, 2000);
  }, []);

  // Layout management
  const applyLayout = useCallback((algorithm: string) => {
    if (!cyRef.current) return;
    
    const layout = cyRef.current.layout(getLayoutConfig(algorithm as any, topology));
    layout.run();
  }, [topology]);

  // Fit and center controls
  const fitToViewport = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 50);
    }
  }, []);

  const centerView = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.center();
    }
  }, []);

  // Highlight management
  const highlightPath = useCallback((nodeIds: string[], edgeIds: string[]) => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    
    // Reset all highlights
    cy.elements().removeClass('highlighted dimmed');
    
    // Highlight specified elements
    nodeIds.forEach(nodeId => {
      cy.getElementById(nodeId).addClass('highlighted');
    });
    
    edgeIds.forEach(edgeId => {
      cy.getElementById(edgeId).addClass('highlighted');
    });
    
    // Dim non-highlighted elements
    cy.elements().not('.highlighted').addClass('dimmed');
  }, []);

  const clearHighlights = useCallback(() => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('highlighted dimmed');
  }, []);

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    getCytoscapeInstance: () => cyRef.current,
    exportImage: async (format: 'png' | 'svg', options = {}): Promise<Blob> => {
      if (!cyRef.current) {
        throw new Error('Cytoscape instance not available');
      }

      const exportOptions = {
        output: 'blob',
        bg: options.backgroundColor || '#ffffff',
        full: true,
        scale: options.scale || 2,
        quality: options.quality || 1.0,
        maxWidth: options.maxWidth || 1920,
        maxHeight: options.maxHeight || 1080,
        ...options
      };

      if (format === 'png') {
        const result = cyRef.current.png(exportOptions);
        return result as unknown as Blob;
      } else if (format === 'svg') {
        // SVG export for Cytoscape.js - use type assertion for svg method
        const svgString = (cyRef.current as any).svg(exportOptions);
        return new Blob([svgString], { type: 'image/svg+xml' });
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
    }
  }), []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg"
        style={{ minHeight: '400px' }}
      />
      
      {/* Enhanced controls overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <div className="flex flex-col gap-2">
            <button
              onClick={fitToViewport}
              className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 text-sm font-medium text-blue-700 transition-colors"
              title="Fit to viewport"
            >
              Fit
            </button>
            <button
              onClick={centerView}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
              title="Center view"
            >
              Center
            </button>
            <button
              onClick={clearHighlights}
              className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md hover:bg-yellow-100 text-sm font-medium text-yellow-700 transition-colors"
              title="Clear highlights"
            >
              Clear
            </button>
          </div>
        </div>
        
        {/* Layout selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <select
            value={layoutAlgorithm}
            onChange={(e) => applyLayout(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
            title="Layout algorithm"
          >
            <option value="cose">Force-directed</option>
            <option value="dagre">Hierarchical</option>
            <option value="grid">Grid</option>
            <option value="circle">Circular</option>
            <option value="breadthfirst">Tree</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <h4 className="text-xs font-medium text-gray-900 mb-2">Legend</h4>
        <div className="space-y-1">
          <LegendItem color="#3B82F6" shape="rectangle" label="VPC" />
          <LegendItem color="#10B981" shape="rectangle" label="Subnet" />
          <LegendItem color="#F59E0B" shape="circle" label="Instance" />
          <LegendItem color="#8B5CF6" shape="diamond" label="Transit Gateway" />
          <LegendItem color="#EF4444" shape="triangle" label="VPN" />
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-600">
            <div className="w-4 h-0.5 bg-gray-400 mr-2"></div>
            <span>Normal traffic</span>
          </div>
          <div className="flex items-center text-xs text-gray-600 mt-1">
            <div className="w-4 h-0.5 bg-red-400 mr-2" style={{ borderStyle: 'dashed' }}></div>
            <span>Rejected connections</span>
          </div>
        </div>
      </div>

      {!topology && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded-lg">
          <div className="text-center">
            <div className="text-gray-500 text-lg font-medium">No topology data</div>
            <div className="text-gray-400 text-sm mt-1">Load flow log data to visualize network topology</div>
          </div>
        </div>
      )}
    </div>
  );
});

// Enhanced Cytoscape styles with animations and visual indicators
function getAdvancedCytoscapeStyles(): cytoscape.StylesheetStyle[] {
  return [
    // Base node styles
    {
      selector: 'node',
      style: {
        'background-color': 'data(nodeColor)',
        'border-color': '#333',
        'border-width': 'data(borderWidth)',
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '11px',
        'font-weight': 'bold',
        'color': '#333',
        'text-outline-color': '#fff',
        'text-outline-width': 1,
        'width': 'data(nodeSize)',
        'height': 'data(nodeSize)',
        'shape': 'ellipse' as any,
        'transition-property': 'background-color, border-width, width, height' as any,
        'transition-duration': 300 as any
      }
    },
    // Node type specific shapes
    {
      selector: 'node[type = "vpc"]',
      style: {
        'shape': 'round-rectangle'
      }
    },
    {
      selector: 'node[type = "subnet"]',
      style: {
        'shape': 'rectangle'
      }
    },
    {
      selector: 'node[type = "instance"]',
      style: {
        'shape': 'ellipse'
      }
    },
    {
      selector: 'node[type = "tgw"]',
      style: {
        'shape': 'diamond'
      }
    },
    {
      selector: 'node[type = "vpn"]',
      style: {
        'shape': 'triangle'
      }
    },
    {
      selector: 'node[type = "internet-gateway"]',
      style: {
        'shape': 'hexagon'
      }
    },
    // Active node highlighting
    {
      selector: 'node.active',
      style: {
        'border-color': '#22C55E',
        'border-width': 3
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
    // Highlighted nodes
    {
      selector: 'node.highlighted',
      style: {
        'border-color': '#F59E0B',
        'border-width': 4
      }
    },
    // Dimmed nodes
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.3
      }
    },
    // Base edge styles
    {
      selector: 'edge',
      style: {
        'width': 'data(edgeWidth)',
        'line-color': 'data(edgeColor)',
        'target-arrow-color': 'data(edgeColor)',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'opacity': 0.8,
        'transition-property': 'line-color, width, opacity' as any,
        'transition-duration': 300 as any
      }
    },
    // Bidirectional edges
    {
      selector: 'edge[bidirectional = true]',
      style: {
        'source-arrow-shape': 'triangle',
        'source-arrow-color': 'data(edgeColor)'
      }
    },
    // High traffic edges with animation
    {
      selector: 'edge.high-traffic',
      style: {
        'line-dash-pattern': [6, 3],
        'line-dash-offset': 0
      }
    },
    // Rejected connections
    {
      selector: 'edge.rejected',
      style: {
        'line-style': 'dashed',
        'opacity': 0.6
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
    // Highlighted edges
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#F59E0B',
        'target-arrow-color': '#F59E0B',
        'source-arrow-color': '#F59E0B',
        'width': 8,
        'opacity': 1
      }
    },
    // Dimmed edges
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.2
      }
    }
  ];
}

// Enhanced layout configurations
function getLayoutConfig(algorithm: string, topology?: NetworkTopology | null) {
  const nodeCount = topology?.nodes.length || 0;
  
  const configs = {
    cose: {
      name: 'cose',
      animate: true,
      animationDuration: 1000,
      animationEasing: 'ease-out',
      nodeRepulsion: function(node: any) {
        return node.data('nodeSize') * 1000;
      },
      nodeOverlap: 20,
      idealEdgeLength: function(edge: any) {
        return edge.data('edgeWidth') * 20 + 80;
      },
      edgeElasticity: function(edge: any) {
        return edge.data('edgeWidth') * 10 + 100;
      },
      nestingFactor: 5,
      gravity: 80,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    },
    dagre: {
      name: 'dagre',
      animate: true,
      animationDuration: 1000,
      rankDir: 'TB',
      nodeSep: 80,
      edgeSep: 20,
      rankSep: 120,
      spacingFactor: 1.2
    },
    grid: {
      name: 'grid',
      animate: true,
      animationDuration: 500,
      rows: Math.ceil(Math.sqrt(nodeCount)),
      cols: Math.ceil(Math.sqrt(nodeCount)),
      spacingFactor: 1.5
    },
    circle: {
      name: 'circle',
      animate: true,
      animationDuration: 1000,
      radius: Math.max(nodeCount * 20, 200),
      spacingFactor: 1.2
    },
    breadthfirst: {
      name: 'breadthfirst',
      animate: true,
      animationDuration: 1000,
      directed: true,
      spacingFactor: 1.5,
      maximal: false
    }
  };
  
  return configs[algorithm as keyof typeof configs] || configs.cose;
}

// Enhanced event handlers
function setupEventHandlers(
  cy: Core, 
  onNodeSelect?: (nodeId: string | null) => void,
  onEdgeSelect?: (edgeId: string | null) => void
) {
  // Node selection with enhanced feedback
  cy.on('tap', 'node', (event) => {
    const node = event.target as NodeSingular;
    
    // Clear previous selections
    cy.elements().removeClass('selected');
    node.addClass('selected');
    
    onNodeSelect?.(node.id());
  });

  // Edge selection with enhanced feedback
  cy.on('tap', 'edge', (event) => {
    const edge = event.target as EdgeSingular;
    
    // Clear previous selections
    cy.elements().removeClass('selected');
    edge.addClass('selected');
    
    onEdgeSelect?.(edge.id());
  });

  // Background tap to clear selection
  cy.on('tap', (event) => {
    if (event.target === cy) {
      cy.elements().removeClass('selected');
      onNodeSelect?.(null);
      onEdgeSelect?.(null);
    }
  });

  // Hover effects
  cy.on('mouseover', 'node', (event) => {
    const node = event.target as NodeSingular;
    node.style('cursor', 'pointer');
  });

  cy.on('mouseout', 'node', (event) => {
    const node = event.target as NodeSingular;
    node.style('cursor', 'default');
  });
}

// Utility functions
function calculateNodeSize(trafficVolume: number, maxTraffic: number): number {
  const minSize = 30;
  const maxSize = 80;
  const ratio = Math.min(trafficVolume / maxTraffic, 1);
  return minSize + (maxSize - minSize) * Math.sqrt(ratio);
}

function calculateEdgeWidth(trafficVolume: number, maxTraffic: number): number {
  const minWidth = 2;
  const maxWidth = 12;
  const ratio = Math.min(trafficVolume / maxTraffic, 1);
  return minWidth + (maxWidth - minWidth) * Math.sqrt(ratio);
}

function getNodeColor(nodeType: string, isActive: boolean): string {
  const colors = {
    vpc: '#3B82F6',
    subnet: '#10B981',
    instance: '#F59E0B',
    tgw: '#8B5CF6',
    vpn: '#EF4444',
    'internet-gateway': '#06B6D4',
    'nat-gateway': '#84CC16',
    'load-balancer': '#F97316',
    unknown: '#6B7280'
  };
  
  let color = colors[nodeType as keyof typeof colors] || colors.unknown;
  
  if (!isActive) {
    color = color + '80'; // Add transparency for inactive nodes
  }
  
  return color;
}

function getEdgeColor(edge: NetworkEdge): string {
  if (edge.properties.hasRejectedConnections) {
    return '#EF4444'; // Red for rejected connections
  }
  
  const totalTraffic = edge.trafficStats.totalBytes;
  
  if (totalTraffic > 10000000) { // > 10MB
    return '#F59E0B'; // Orange for high traffic
  } else if (totalTraffic > 1000000) { // > 1MB
    return '#10B981'; // Green for medium traffic
  } else {
    return '#64748B'; // Gray for low traffic
  }
}

function getNodeClasses(node: NetworkNode): string {
  const classes = [];
  
  if (node.metadata.isActive) {
    classes.push('active');
  }
  
  if (node.metadata.trafficVolume && node.metadata.trafficVolume > 1000000) {
    classes.push('high-traffic');
  }
  
  return classes.join(' ');
}

function getEdgeClasses(edge: NetworkEdge): string {
  const classes = [];
  
  if (edge.trafficStats.totalBytes > 1000000) {
    classes.push('high-traffic');
  }
  
  if (edge.properties.hasRejectedConnections) {
    classes.push('rejected');
  }
  
  return classes.join(' ');
}

// Legend component
interface LegendItemProps {
  color: string;
  shape: string;
  label: string;
}

const LegendItem: React.FC<LegendItemProps> = ({ color, shape, label }) => {
  const getShapeElement = () => {
    const baseClasses = "w-3 h-3 mr-2 flex-shrink-0";
    const style = { backgroundColor: color };
    
    switch (shape) {
      case 'rectangle':
        return <div className={`${baseClasses} rounded-sm`} style={style} />;
      case 'circle':
        return <div className={`${baseClasses} rounded-full`} style={style} />;
      case 'diamond':
        return <div className={`${baseClasses} transform rotate-45`} style={style} />;
      case 'triangle':
        return (
          <div 
            className={baseClasses}
            style={{
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `12px solid ${color}`,
              backgroundColor: 'transparent'
            }}
          />
        );
      default:
        return <div className={`${baseClasses} rounded-sm`} style={style} />;
    }
  };
  
  return (
    <div className="flex items-center text-xs text-gray-600">
      {getShapeElement()}
      <span>{label}</span>
    </div>
  );
};