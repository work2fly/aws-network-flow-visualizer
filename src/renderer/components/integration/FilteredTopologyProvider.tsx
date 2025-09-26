import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { 
  NetworkTopology, 
  FlowLogRecord, 
  FilteredStatistics,
  SearchResult,
  SearchQuery 
} from '@shared/types';
import { setSearchResults } from '../../store/slices/filterSlice';
import { useFilteringSystem } from '../../hooks/useFilteringSystem';

interface FilteredTopologyContextValue {
  // Filtered data
  filteredTopology: NetworkTopology | null;
  filteredFlowLogs: FlowLogRecord[];
  filteredStatistics: FilteredStatistics | null;
  
  // Search functionality
  searchResults: SearchResult[];
  performSearch: (query: SearchQuery) => void;
  
  // Export functionality
  exportStatistics: (format: 'csv' | 'json') => Promise<Blob>;
  exportFilteredData: (format: 'csv' | 'json') => Promise<Blob>;
  
  // Filter state
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

const FilteredTopologyContext = createContext<FilteredTopologyContextValue | null>(null);

export const useFilteredTopology = () => {
  const context = useContext(FilteredTopologyContext);
  if (!context) {
    throw new Error('useFilteredTopology must be used within a FilteredTopologyProvider');
  }
  return context;
};

interface FilteredTopologyProviderProps {
  children: React.ReactNode;
}

export const FilteredTopologyProvider: React.FC<FilteredTopologyProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  
  // Get data from Redux store
  const topology = useAppSelector(state => state.topology.topology);
  const flowLogs = useAppSelector(state => state.topology.flowLogs);
  const filterState = useAppSelector(state => state.filter);
  
  // Use the filtering system hook
  const {
    filteredTopology,
    filteredStatistics,
    search,
    exportStatistics,
    exportFilteredData
  } = useFilteringSystem(topology, flowLogs);
  
  // Filter flow logs based on current filters
  const filteredFlowLogs = useMemo(() => {
    if (!flowLogs.length) return [];
    
    const { filters } = filterState;
    
    return flowLogs.filter(record => {
      // Time range filter
      if (filters.timeRange) {
        if (record.timestamp < filters.timeRange.start || record.timestamp > filters.timeRange.end) {
          return false;
        }
      }
      
      // IP filters
      if (filters.sourceIPs?.length && !filters.sourceIPs.includes(record.sourceIP)) return false;
      if (filters.destinationIPs?.length && !filters.destinationIPs.includes(record.destinationIP)) return false;
      
      // Protocol filter
      if (filters.protocols?.length && !filters.protocols.includes(record.protocol)) return false;
      
      // Action filter
      if (filters.actions?.length && !filters.actions.includes(record.action)) return false;
      
      // AWS resource filters
      if (filters.vpcIds?.length && record.vpcId && !filters.vpcIds.includes(record.vpcId)) return false;
      if (filters.subnetIds?.length && record.subnetId && !filters.subnetIds.includes(record.subnetId)) return false;
      if (filters.instanceIds?.length && record.instanceId && !filters.instanceIds.includes(record.instanceId)) return false;
      if (filters.accountIds?.length && record.accountId && !filters.accountIds.includes(record.accountId)) return false;
      if (filters.regions?.length && record.region && !filters.regions.includes(record.region)) return false;
      
      // Traffic volume filters
      if (filters.minBytes !== undefined && record.bytes < filters.minBytes) return false;
      if (filters.maxBytes !== undefined && record.bytes > filters.maxBytes) return false;
      if (filters.minPackets !== undefined && record.packets < filters.minPackets) return false;
      if (filters.maxPackets !== undefined && record.packets > filters.maxPackets) return false;
      
      return true;
    });
  }, [flowLogs, filterState.filters]);
  
  // Perform search and update Redux store
  const performSearch = (query: SearchQuery) => {
    const results = search(query);
    dispatch(setSearchResults(results));
  };
  
  // Update search results in Redux when they change
  useEffect(() => {
    if (filterState.currentSearch) {
      performSearch(filterState.currentSearch);
    }
  }, [filterState.currentSearch, topology, filteredFlowLogs]);
  
  const contextValue: FilteredTopologyContextValue = {
    filteredTopology,
    filteredFlowLogs,
    filteredStatistics,
    searchResults: filterState.searchResults,
    performSearch,
    exportStatistics,
    exportFilteredData,
    activeFilterCount: filterState.activeFilterCount,
    hasActiveFilters: filterState.activeFilterCount > 0
  };
  
  return (
    <FilteredTopologyContext.Provider value={contextValue}>
      {children}
    </FilteredTopologyContext.Provider>
  );
};