import { useState, useCallback, useMemo } from 'react';
import { NetworkTopology, NetworkNode, NetworkEdge, FlowLogRecord } from '@shared/types';

export interface VisualizationFilters {
  nodeTypes: string[];
  minTrafficVolume: number;
  maxTrafficVolume: number;
  showRejectedConnections: boolean;
  showOnlyActiveNodes: boolean;
  timeRange?: { start: Date; end: Date };
}

export interface VisualizationState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  filters: VisualizationFilters;
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;
}

export interface UseNetworkVisualizationReturn {
  state: VisualizationState;
  filteredTopology: NetworkTopology | null;
  actions: {
    selectNode: (nodeId: string | null) => void;
    selectEdge: (edgeId: string | null) => void;
    updateFilters: (filters: Partial<VisualizationFilters>) => void;
    highlightNodes: (nodeIds: string[]) => void;
    highlightEdges: (edgeIds: string[]) => void;
    clearHighlights: () => void;
    resetFilters: () => void;
    searchNodes: (query: string) => NetworkNode[];
    getNodeDetails: (nodeId: string) => NetworkNode | null;
    getEdgeDetails: (edgeId: string) => NetworkEdge | null;
  };
}

const defaultFilters: VisualizationFilters = {
  nodeTypes: ['vpc', 'subnet', 'instance', 'tgw', 'vpn', 'internet-gateway', 'nat-gateway'],
  minTrafficVolume: 0,
  maxTrafficVolume: Number.MAX_SAFE_INTEGER,
  showRejectedConnections: true,
  showOnlyActiveNodes: false
};

export function useNetworkVisualization(
  topology: NetworkTopology | null
): UseNetworkVisualizationReturn {
  const [state, setState] = useState<VisualizationState>({
    selectedNodeId: null,
    selectedEdgeId: null,
    filters: defaultFilters,
    highlightedNodes: new Set(),
    highlightedEdges: new Set()
  });

  // Filter topology based on current filters
  const filteredTopology = useMemo(() => {
    if (!topology) return null;

    const { filters } = state;
    
    // Filter nodes
    const filteredNodes = topology.nodes.filter(node => {
      // Node type filter
      if (!filters.nodeTypes.includes(node.type)) return false;
      
      // Traffic volume filter
      const trafficVolume = node.metadata.trafficVolume || 0;
      if (trafficVolume < filters.minTrafficVolume || trafficVolume > filters.maxTrafficVolume) {
        return false;
      }
      
      // Active nodes filter
      if (filters.showOnlyActiveNodes && !node.metadata.isActive) return false;
      
      // Time range filter
      if (filters.timeRange) {
        const lastSeen = node.metadata.lastSeen;
        if (!lastSeen || lastSeen < filters.timeRange.start || lastSeen > filters.timeRange.end) {
          return false;
        }
      }
      
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Filter edges - only include edges between filtered nodes
    const filteredEdges = topology.edges.filter(edge => {
      // Both source and target must be in filtered nodes
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
      
      // Rejected connections filter
      if (!filters.showRejectedConnections && edge.properties.hasRejectedConnections) {
        return false;
      }
      
      // Traffic volume filter for edges
      const trafficVolume = edge.trafficStats.totalBytes;
      if (trafficVolume < filters.minTrafficVolume || trafficVolume > filters.maxTrafficVolume) {
        return false;
      }
      
      return true;
    });

    return {
      ...topology,
      nodes: filteredNodes,
      edges: filteredEdges
    };
  }, [topology, state.filters]);

  // Actions
  const selectNode = useCallback((nodeId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedNodeId: nodeId,
      selectedEdgeId: null // Clear edge selection when selecting node
    }));
  }, []);

  const selectEdge = useCallback((edgeId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedEdgeId: edgeId,
      selectedNodeId: null // Clear node selection when selecting edge
    }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<VisualizationFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters }
    }));
  }, []);

  const highlightNodes = useCallback((nodeIds: string[]) => {
    setState(prev => ({
      ...prev,
      highlightedNodes: new Set(nodeIds)
    }));
  }, []);

  const highlightEdges = useCallback((edgeIds: string[]) => {
    setState(prev => ({
      ...prev,
      highlightedEdges: new Set(edgeIds)
    }));
  }, []);

  const clearHighlights = useCallback(() => {
    setState(prev => ({
      ...prev,
      highlightedNodes: new Set(),
      highlightedEdges: new Set()
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: defaultFilters
    }));
  }, []);

  const searchNodes = useCallback((query: string): NetworkNode[] => {
    if (!topology || !query.trim()) return [];
    
    const searchTerm = query.toLowerCase().trim();
    
    return topology.nodes.filter(node => {
      // Search in node label
      if (node.label.toLowerCase().includes(searchTerm)) return true;
      
      // Search in node ID
      if (node.id.toLowerCase().includes(searchTerm)) return true;
      
      // Search in node properties
      if (node.properties.name?.toLowerCase().includes(searchTerm)) return true;
      if (node.properties.privateIpAddress?.includes(searchTerm)) return true;
      if (node.properties.publicIpAddress?.includes(searchTerm)) return true;
      if (node.properties.cidrBlock?.includes(searchTerm)) return true;
      
      // Search in tags
      if (node.properties.tags) {
        const tagValues = Object.values(node.properties.tags).join(' ').toLowerCase();
        if (tagValues.includes(searchTerm)) return true;
      }
      
      return false;
    });
  }, [topology]);

  const getNodeDetails = useCallback((nodeId: string): NetworkNode | null => {
    if (!topology) return null;
    return topology.nodes.find(node => node.id === nodeId) || null;
  }, [topology]);

  const getEdgeDetails = useCallback((edgeId: string): NetworkEdge | null => {
    if (!topology) return null;
    return topology.edges.find(edge => edge.id === edgeId) || null;
  }, [topology]);

  return {
    state,
    filteredTopology,
    actions: {
      selectNode,
      selectEdge,
      updateFilters,
      highlightNodes,
      highlightEdges,
      clearHighlights,
      resetFilters,
      searchNodes,
      getNodeDetails,
      getEdgeDetails
    }
  };
}

// Utility functions for visualization
export function calculateNodeSize(trafficVolume: number, maxTraffic: number): number {
  const minSize = 30;
  const maxSize = 80;
  const ratio = Math.min(trafficVolume / maxTraffic, 1);
  return minSize + (maxSize - minSize) * ratio;
}

export function calculateEdgeWidth(trafficVolume: number, maxTraffic: number): number {
  const minWidth = 2;
  const maxWidth = 12;
  const ratio = Math.min(trafficVolume / maxTraffic, 1);
  return minWidth + (maxWidth - minWidth) * ratio;
}

export function getNodeColor(nodeType: string, isActive: boolean = false): string {
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
  
  // Dim inactive nodes
  if (!isActive) {
    color = color + '80'; // Add transparency
  }
  
  return color;
}

export function getEdgeColor(
  hasRejectedConnections: boolean,
  trafficVolume: number,
  maxTraffic: number
): string {
  if (hasRejectedConnections) {
    return '#EF4444'; // Red for rejected connections
  }
  
  const ratio = Math.min(trafficVolume / maxTraffic, 1);
  
  if (ratio > 0.7) {
    return '#F59E0B'; // Orange for high traffic
  } else if (ratio > 0.3) {
    return '#10B981'; // Green for medium traffic
  } else {
    return '#64748B'; // Gray for low traffic
  }
}