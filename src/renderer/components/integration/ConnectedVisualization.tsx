import React, { useEffect, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { 
  setSelectedNodes, 
  setSelectedEdges, 
  setHighlightedNodes, 
  setHighlightedEdges,
  clearSelection,
  clearHighlights
} from '../../store/slices/topologySlice';
import { 
  updateFilters,
  setCurrentSearch,
  addMultipleIPs,
  addMultipleProtocols
} from '../../store/slices/filterSlice';
import { addNotification } from '../../store/slices/uiSlice';
import { NetworkVisualization } from '../visualization/NetworkVisualization';
import { useFilteredTopology } from './FilteredTopologyProvider';
import { NetworkNode, NetworkEdge, SearchQuery } from '@shared/types';

interface ConnectedVisualizationProps {
  className?: string;
  onNodeClick?: (node: NetworkNode) => void;
  onEdgeClick?: (edge: NetworkEdge) => void;
  onNodeDoubleClick?: (node: NetworkNode) => void;
  onEdgeDoubleClick?: (edge: NetworkEdge) => void;
}

export const ConnectedVisualization: React.FC<ConnectedVisualizationProps> = ({
  className,
  onNodeClick,
  onEdgeClick,
  onNodeDoubleClick,
  onEdgeDoubleClick
}) => {
  const dispatch = useAppDispatch();
  
  // Get state from Redux
  const topologyState = useAppSelector(state => state.topology);
  const filterState = useAppSelector(state => state.filter);
  const uiState = useAppSelector(state => state.ui);
  
  // Get filtered data from context
  const { filteredTopology, searchResults } = useFilteredTopology();
  
  // Memoize visualization props to prevent unnecessary re-renders
  const visualizationProps = useMemo(() => ({
    topology: filteredTopology,
    selectedNodes: topologyState.selectedNodes,
    selectedEdges: topologyState.selectedEdges,
    highlightedNodes: topologyState.highlightedNodes,
    highlightedEdges: topologyState.highlightedEdges,
    searchResults: searchResults,
    layoutAlgorithm: topologyState.layoutAlgorithm,
    layoutParameters: topologyState.layoutParameters,
    enableAnimations: topologyState.enableAnimations && uiState.enableAnimations,
    enableClustering: topologyState.enableClustering,
    maxNodes: topologyState.maxNodes,
    maxEdges: topologyState.maxEdges
  }), [
    filteredTopology,
    topologyState.selectedNodes,
    topologyState.selectedEdges,
    topologyState.highlightedNodes,
    topologyState.highlightedEdges,
    searchResults,
    topologyState.layoutAlgorithm,
    topologyState.layoutParameters,
    topologyState.enableAnimations,
    topologyState.enableClustering,
    topologyState.maxNodes,
    topologyState.maxEdges,
    uiState.enableAnimations
  ]);
  
  // Handle node selection
  const handleNodeSelection = (nodeIds: string[]) => {
    dispatch(setSelectedNodes(nodeIds));
    
    // If single node selected, show notification with node details
    if (nodeIds.length === 1 && filteredTopology) {
      const node = filteredTopology.nodes.find(n => n.id === nodeIds[0]);
      if (node) {
        dispatch(addNotification({
          type: 'info',
          title: 'Node Selected',
          message: `Selected ${node.type}: ${node.label}`,
          duration: 2000
        }));
      }
    }
  };
  
  // Handle edge selection
  const handleEdgeSelection = (edgeIds: string[]) => {
    dispatch(setSelectedEdges(edgeIds));
    
    // If single edge selected, show notification with edge details
    if (edgeIds.length === 1 && filteredTopology) {
      const edge = filteredTopology.edges.find(e => e.id === edgeIds[0]);
      if (edge) {
        dispatch(addNotification({
          type: 'info',
          title: 'Connection Selected',
          message: `Selected connection: ${edge.source} → ${edge.target}`,
          duration: 2000
        }));
      }
    }
  };
  
  // Handle node highlighting from search
  const handleSearchHighlight = (nodeIds: string[], edgeIds: string[]) => {
    dispatch(setHighlightedNodes(nodeIds));
    dispatch(setHighlightedEdges(edgeIds));
  };
  
  // Handle context menu actions
  const handleNodeContextMenu = (node: NetworkNode, actions: string[]) => {
    // Add context menu actions based on node type
    const contextActions = [];
    
    if (node.properties.privateIpAddress) {
      contextActions.push({
        label: 'Filter by Source IP',
        action: () => {
          dispatch(updateFilters({ 
            sourceIPs: [node.properties.privateIpAddress!] 
          }));
          dispatch(addNotification({
            type: 'success',
            title: 'Filter Applied',
            message: `Filtering by source IP: ${node.properties.privateIpAddress}`,
            duration: 3000
          }));
        }
      });
      
      contextActions.push({
        label: 'Filter by Destination IP',
        action: () => {
          dispatch(updateFilters({ 
            destinationIPs: [node.properties.privateIpAddress!] 
          }));
          dispatch(addNotification({
            type: 'success',
            title: 'Filter Applied',
            message: `Filtering by destination IP: ${node.properties.privateIpAddress}`,
            duration: 3000
          }));
        }
      });
    }
    
    if (node.properties.vpcId) {
      contextActions.push({
        label: 'Filter by VPC',
        action: () => {
          dispatch(updateFilters({ 
            vpcIds: [node.properties.vpcId as string] 
          }));
          dispatch(addNotification({
            type: 'success',
            title: 'Filter Applied',
            message: `Filtering by VPC: ${node.properties.vpcId}`,
            duration: 3000
          }));
        }
      });
    }
    
    return contextActions;
  };
  
  // Handle edge context menu actions
  const handleEdgeContextMenu = (edge: NetworkEdge) => {
    const contextActions = [];
    
    if (edge.properties.protocols.length > 0) {
      contextActions.push({
        label: 'Filter by Protocols',
        action: () => {
          dispatch(addMultipleProtocols(edge.properties.protocols));
          dispatch(addNotification({
            type: 'success',
            title: 'Filter Applied',
            message: `Added protocols to filter: ${edge.properties.protocols.join(', ')}`,
            duration: 3000
          }));
        }
      });
    }
    
    if (edge.properties.ports.length > 0) {
      contextActions.push({
        label: 'Filter by Ports',
        action: () => {
          const portFilters = edge.properties.ports.map(port => ({
            port,
            include: true,
            label: `Port ${port}`
          }));
          dispatch(updateFilters({ 
            destinationPorts: portFilters 
          }));
          dispatch(addNotification({
            type: 'success',
            title: 'Filter Applied',
            message: `Added ports to filter: ${edge.properties.ports.join(', ')}`,
            duration: 3000
          }));
        }
      });
    }
    
    return contextActions;
  };
  
  // Handle search from visualization
  const handleVisualizationSearch = (query: string, type: 'ip' | 'port' | 'protocol' | 'all' = 'all') => {
    const searchQuery: SearchQuery = {
      query,
      type,
      caseSensitive: false,
      exactMatch: false
    };
    
    dispatch(setCurrentSearch(searchQuery));
  };
  
  // Clear selections when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearSelection());
      dispatch(clearHighlights());
    };
  }, [dispatch]);
  
  // Handle node click events
  const handleNodeClickInternal = (node: NetworkNode) => {
    handleNodeSelection([node.id]);
    onNodeClick?.(node);
  };
  
  // Handle edge click events
  const handleEdgeClickInternal = (edge: NetworkEdge) => {
    handleEdgeSelection([edge.id]);
    onEdgeClick?.(edge);
  };
  
  // Handle node double click events
  const handleNodeDoubleClickInternal = (node: NetworkNode) => {
    // Double click to focus on node and its connections
    if (filteredTopology) {
      const connectedEdges = filteredTopology.edges.filter(
        edge => edge.source === node.id || edge.target === node.id
      );
      const connectedNodeIds = new Set<string>();
      connectedEdges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      
      dispatch(setHighlightedNodes(Array.from(connectedNodeIds)));
      dispatch(setHighlightedEdges(connectedEdges.map(e => e.id)));
      
      dispatch(addNotification({
        type: 'info',
        title: 'Node Focus',
        message: `Highlighting ${node.label} and its ${connectedEdges.length} connections`,
        duration: 3000
      }));
    }
    
    onNodeDoubleClick?.(node);
  };
  
  // Handle edge double click events
  const handleEdgeDoubleClickInternal = (edge: NetworkEdge) => {
    // Double click to highlight source and target nodes
    dispatch(setHighlightedNodes([edge.source, edge.target]));
    dispatch(setHighlightedEdges([edge.id]));
    
    dispatch(addNotification({
      type: 'info',
      title: 'Connection Focus',
      message: `Highlighting connection between ${edge.source} and ${edge.target}`,
      duration: 3000
    }));
    
    onEdgeDoubleClick?.(edge);
  };
  
  return (
    <NetworkVisualization
      className={className}
      topology={filteredTopology}
      onNodeSelect={(nodeId) => {
        if (nodeId) {
          handleNodeSelection([nodeId]);
        }
      }}
      onEdgeSelect={(edgeId) => {
        if (edgeId) {
          handleEdgeSelection([edgeId]);
        }
      }}
    />
  );
};