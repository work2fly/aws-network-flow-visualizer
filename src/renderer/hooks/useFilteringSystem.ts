import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  FlowFilters, 
  FilterState, 
  SavedFilter, 
  SearchQuery, 
  SearchResult, 
  FilteredStatistics,
  NetworkTopology,
  NetworkNode,
  NetworkEdge,
  FlowLogRecord,
  IPStatistic,
  ProtocolStatistic,
  PortStatistic,
  RegionStatistic,
  VPCStatistic,
  AccountStatistic
} from '@shared/types';

export interface UseFilteringSystemReturn {
  // State
  filterState: FilterState;
  filteredTopology: NetworkTopology | null;
  filteredStatistics: FilteredStatistics | null;
  
  // Filter actions
  updateFilters: (filters: Partial<FlowFilters>) => void;
  resetFilters: () => void;
  saveFilter: (name: string, description?: string) => void;
  loadFilter: (filterId: string) => void;
  deleteFilter: (filterId: string) => void;
  
  // Search actions
  search: (query: SearchQuery) => SearchResult[];
  
  // Export actions
  exportStatistics: (format: 'csv' | 'json') => Promise<Blob>;
  exportFilteredData: (format: 'csv' | 'json') => Promise<Blob>;
}

const defaultFilters: FlowFilters = {
  sourceIPs: [],
  destinationIPs: [],
  ipRanges: [],
  sourcePorts: [],
  destinationPorts: [],
  protocols: [],
  actions: ['ACCEPT', 'REJECT'],
  vpcIds: [],
  subnetIds: [],
  instanceIds: [],
  accountIds: [],
  regions: [],
  hasAnomalies: false,
  isActive: true
};

export function useFilteringSystem(
  topology: NetworkTopology | null,
  flowLogs: FlowLogRecord[] = []
): UseFilteringSystemReturn {
  const [filterState, setFilterState] = useState<FilterState>({
    filters: defaultFilters,
    savedFilters: [],
    activeFilterCount: 0,
    lastApplied: new Date()
  });

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aws-network-visualizer-saved-filters');
    if (saved) {
      try {
        const savedFilters = JSON.parse(saved);
        setFilterState(prev => ({ ...prev, savedFilters }));
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem(
      'aws-network-visualizer-saved-filters',
      JSON.stringify(filterState.savedFilters)
    );
  }, [filterState.savedFilters]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    const { filters } = filterState;
    let count = 0;
    
    if (filters.sourceIPs?.length) count++;
    if (filters.destinationIPs?.length) count++;
    if (filters.ipRanges?.length) count++;
    if (filters.sourcePorts?.length) count++;
    if (filters.destinationPorts?.length) count++;
    if (filters.protocols?.length) count++;
    if (filters.timeRange) count++;
    if (filters.actions?.length && filters.actions.length < 2) count++;
    if (filters.vpcIds?.length) count++;
    if (filters.subnetIds?.length) count++;
    if (filters.instanceIds?.length) count++;
    if (filters.accountIds?.length) count++;
    if (filters.regions?.length) count++;
    if (filters.minBytes !== undefined || filters.maxBytes !== undefined) count++;
    if (filters.minPackets !== undefined || filters.maxPackets !== undefined) count++;
    if (filters.hasAnomalies) count++;
    if (!filters.isActive) count++;
    
    return count;
  }, [filterState.filters]);

  // Update active filter count when it changes
  useEffect(() => {
    setFilterState(prev => ({ ...prev, activeFilterCount }));
  }, [activeFilterCount]);

  // Helper function to check if IP matches filters
  const matchesIPFilters = useCallback((ip: string, ipList?: string[], ipRanges?: any[]): boolean => {
    // Check direct IP matches
    if (ipList?.length && !ipList.includes(ip)) {
      return false;
    }
    
    // Check CIDR ranges
    if (ipRanges?.length) {
      const matchesRange = ipRanges.some(range => {
        if (!range.cidr) return false;
        try {
          // Simple CIDR matching - in production, use a proper CIDR library
          const [network, prefixLength] = range.cidr.split('/');
          if (!prefixLength) return ip === network;
          
          const ipParts = ip.split('.').map(Number);
          const networkParts = network.split('.').map(Number);
          const mask = (0xFFFFFFFF << (32 - parseInt(prefixLength))) >>> 0;
          
          const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
          const networkInt = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
          
          const matches = (ipInt & mask) === (networkInt & mask);
          return range.include ? matches : !matches;
        } catch {
          return false;
        }
      });
      
      if (!matchesRange) return false;
    }
    
    return true;
  }, []);

  // Helper function to check if port matches filters
  const matchesPortFilters = useCallback((port: number, portFilters?: any[]): boolean => {
    if (!portFilters?.length) return true;
    
    return portFilters.some(filter => {
      if (filter.port !== undefined) {
        const matches = port === filter.port;
        return filter.include ? matches : !matches;
      }
      
      if (filter.portRange) {
        const matches = port >= filter.portRange.start && port <= filter.portRange.end;
        return filter.include ? matches : !matches;
      }
      
      return true;
    });
  }, []);

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
      if (!matchesIPFilters(record.sourceIP, filters.sourceIPs, filters.ipRanges)) return false;
      if (!matchesIPFilters(record.destinationIP, filters.destinationIPs, filters.ipRanges)) return false;
      
      // Port filters
      if (!matchesPortFilters(record.sourcePort, filters.sourcePorts)) return false;
      if (!matchesPortFilters(record.destinationPort, filters.destinationPorts)) return false;
      
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
  }, [flowLogs, filterState.filters, matchesIPFilters, matchesPortFilters]);

  // Filter topology based on filtered flow logs
  const filteredTopology = useMemo(() => {
    if (!topology) return null;
    
    // Get unique IPs from filtered flow logs
    const activeIPs = new Set<string>();
    filteredFlowLogs.forEach(record => {
      activeIPs.add(record.sourceIP);
      activeIPs.add(record.destinationIP);
    });
    
    // Filter nodes based on active IPs and other criteria
    const filteredNodes = topology.nodes.filter(node => {
      // Check if node has traffic in filtered data
      const hasTraffic = node.properties.privateIpAddress && activeIPs.has(node.properties.privateIpAddress) ||
                        node.properties.publicIpAddress && activeIPs.has(node.properties.publicIpAddress);
      
      if (filterState.filters.isActive && !hasTraffic) return false;
      
      return true;
    });
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Filter edges to only include those between filtered nodes
    const filteredEdges = topology.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
    
    return {
      ...topology,
      nodes: filteredNodes,
      edges: filteredEdges
    };
  }, [topology, filteredFlowLogs, filterState.filters.isActive]);

  // Helper function to check if IP is private
  const isPrivateIP = useCallback((ip: string): boolean => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    
    return false;
  }, []);

  // Calculate statistics for filtered data
  const filteredStatistics = useMemo((): FilteredStatistics | null => {
    if (!flowLogs.length) return null;
    
    const totalRecords = flowLogs.length;
    const filteredRecords = filteredFlowLogs.length;
    const reductionPercentage = ((totalRecords - filteredRecords) / totalRecords) * 100;
    
    // Calculate basic statistics
    const totalBytes = filteredFlowLogs.reduce((sum, record) => sum + record.bytes, 0);
    const totalPackets = filteredFlowLogs.reduce((sum, record) => sum + record.packets, 0);
    const totalConnections = filteredFlowLogs.length;
    const acceptedConnections = filteredFlowLogs.filter(r => r.action === 'ACCEPT').length;
    const rejectedConnections = filteredFlowLogs.filter(r => r.action === 'REJECT').length;
    const rejectionRate = totalConnections > 0 ? (rejectedConnections / totalConnections) * 100 : 0;
    
    // Calculate top source IPs
    const sourceIPStats = new Map<string, { connections: number; bytes: number; packets: number }>();
    filteredFlowLogs.forEach(record => {
      const existing = sourceIPStats.get(record.sourceIP) || { connections: 0, bytes: 0, packets: 0 };
      sourceIPStats.set(record.sourceIP, {
        connections: existing.connections + 1,
        bytes: existing.bytes + record.bytes,
        packets: existing.packets + record.packets
      });
    });
    
    const topSourceIPs: IPStatistic[] = Array.from(sourceIPStats.entries())
      .map(([ip, stats]) => ({
        ip,
        ...stats,
        percentage: (stats.bytes / totalBytes) * 100,
        isInternal: isPrivateIP(ip)
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Calculate top destination IPs
    const destIPStats = new Map<string, { connections: number; bytes: number; packets: number }>();
    filteredFlowLogs.forEach(record => {
      const existing = destIPStats.get(record.destinationIP) || { connections: 0, bytes: 0, packets: 0 };
      destIPStats.set(record.destinationIP, {
        connections: existing.connections + 1,
        bytes: existing.bytes + record.bytes,
        packets: existing.packets + record.packets
      });
    });
    
    const topDestinationIPs: IPStatistic[] = Array.from(destIPStats.entries())
      .map(([ip, stats]) => ({
        ip,
        ...stats,
        percentage: (stats.bytes / totalBytes) * 100,
        isInternal: isPrivateIP(ip)
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Calculate protocol statistics
    const protocolStats = new Map<string, { connections: number; bytes: number; packets: number }>();
    filteredFlowLogs.forEach(record => {
      const existing = protocolStats.get(record.protocol) || { connections: 0, bytes: 0, packets: 0 };
      protocolStats.set(record.protocol, {
        connections: existing.connections + 1,
        bytes: existing.bytes + record.bytes,
        packets: existing.packets + record.packets
      });
    });
    
    const topProtocols: ProtocolStatistic[] = Array.from(protocolStats.entries())
      .map(([protocol, stats]) => ({
        protocol,
        ...stats,
        percentage: (stats.bytes / totalBytes) * 100,
        averagePacketSize: stats.packets > 0 ? stats.bytes / stats.packets : 0
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Calculate port statistics
    const portStats = new Map<string, { connections: number; bytes: number }>();
    filteredFlowLogs.forEach(record => {
      const key = `${record.destinationPort}-${record.protocol}`;
      const existing = portStats.get(key) || { connections: 0, bytes: 0 };
      portStats.set(key, {
        connections: existing.connections + 1,
        bytes: existing.bytes + record.bytes
      });
    });
    
    const topPorts: PortStatistic[] = Array.from(portStats.entries())
      .map(([key, stats]) => {
        const [port, protocol] = key.split('-');
        return {
          port: parseInt(port),
          protocol,
          ...stats
        };
      })
      .sort((a, b) => b.connections - a.connections);
    
    // Calculate region statistics
    const regionStats = new Map<string, { connections: number; bytes: number; vpcs: Set<string> }>();
    filteredFlowLogs.forEach(record => {
      if (record.region) {
        const existing = regionStats.get(record.region) || { connections: 0, bytes: 0, vpcs: new Set() };
        regionStats.set(record.region, {
          connections: existing.connections + 1,
          bytes: existing.bytes + record.bytes,
          vpcs: record.vpcId ? existing.vpcs.add(record.vpcId) : existing.vpcs
        });
      }
    });
    
    const topRegions: RegionStatistic[] = Array.from(regionStats.entries())
      .map(([region, stats]) => ({
        region,
        connections: stats.connections,
        bytes: stats.bytes,
        vpcs: stats.vpcs.size,
        percentage: (stats.bytes / totalBytes) * 100
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Calculate VPC statistics
    const vpcStats = new Map<string, { connections: number; bytes: number; region?: string; name?: string }>();
    filteredFlowLogs.forEach(record => {
      if (record.vpcId) {
        const existing = vpcStats.get(record.vpcId) || { connections: 0, bytes: 0 };
        vpcStats.set(record.vpcId, {
          connections: existing.connections + 1,
          bytes: existing.bytes + record.bytes,
          region: record.region || existing.region,
          name: existing.name // Would need to be populated from topology data
        });
      }
    });
    
    const topVPCs: VPCStatistic[] = Array.from(vpcStats.entries())
      .map(([vpcId, stats]) => ({
        vpcId,
        connections: stats.connections,
        bytes: stats.bytes,
        region: stats.region || 'unknown',
        percentage: (stats.bytes / totalBytes) * 100,
        name: stats.name
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Calculate account statistics
    const accountStats = new Map<string, { connections: number; bytes: number; vpcs: Set<string> }>();
    filteredFlowLogs.forEach(record => {
      if (record.accountId) {
        const existing = accountStats.get(record.accountId) || { connections: 0, bytes: 0, vpcs: new Set() };
        accountStats.set(record.accountId, {
          connections: existing.connections + 1,
          bytes: existing.bytes + record.bytes,
          vpcs: record.vpcId ? existing.vpcs.add(record.vpcId) : existing.vpcs
        });
      }
    });
    
    const topAccounts: AccountStatistic[] = Array.from(accountStats.entries())
      .map(([accountId, stats]) => ({
        accountId,
        connections: stats.connections,
        bytes: stats.bytes,
        vpcs: stats.vpcs.size,
        percentage: (stats.bytes / totalBytes) * 100
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    // Find peak traffic time
    const timeStats = new Map<string, number>();
    filteredFlowLogs.forEach(record => {
      const hourKey = new Date(record.timestamp).toISOString().slice(0, 13);
      timeStats.set(hourKey, (timeStats.get(hourKey) || 0) + record.bytes);
    });
    
    const peakTrafficEntry = Array.from(timeStats.entries())
      .sort((a, b) => b[1] - a[1])[0];
    const peakTrafficTime = peakTrafficEntry ? new Date(peakTrafficEntry[0] + ':00:00Z') : new Date();
    
    return {
      totalRecords,
      filteredRecords,
      reductionPercentage,
      totalBytes,
      totalPackets,
      totalConnections,
      acceptedConnections,
      rejectedConnections,
      rejectionRate,
      topSourceIPs,
      topDestinationIPs,
      topPorts,
      topProtocols,
      trafficOverTime: [], // Would need time series calculation
      peakTrafficTime,
      topRegions,
      topVPCs,
      topAccounts
    };
  }, [flowLogs, filteredFlowLogs, isPrivateIP]);

  // Filter actions
  const updateFilters = useCallback((newFilters: Partial<FlowFilters>) => {
    setFilterState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      lastApplied: new Date()
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilterState(prev => ({
      ...prev,
      filters: defaultFilters,
      lastApplied: new Date()
    }));
  }, []);

  const saveFilter = useCallback((name: string, description?: string) => {
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name,
      description,
      filters: filterState.filters,
      createdAt: new Date()
    };
    
    setFilterState(prev => ({
      ...prev,
      savedFilters: [...prev.savedFilters, newFilter]
    }));
  }, [filterState.filters]);

  const loadFilter = useCallback((filterId: string) => {
    const filter = filterState.savedFilters.find(f => f.id === filterId);
    if (filter) {
      setFilterState(prev => ({
        ...prev,
        filters: filter.filters,
        lastApplied: new Date(),
        savedFilters: prev.savedFilters.map(f => 
          f.id === filterId ? { ...f, lastUsed: new Date() } : f
        )
      }));
    }
  }, [filterState.savedFilters]);

  const deleteFilter = useCallback((filterId: string) => {
    setFilterState(prev => ({
      ...prev,
      savedFilters: prev.savedFilters.filter(f => f.id !== filterId)
    }));
  }, []);

  // Search functionality
  const search = useCallback((query: SearchQuery): SearchResult[] => {
    if (!topology) return [];
    
    const results: SearchResult[] = [];
    const searchTerm = query.caseSensitive ? query.query : query.query.toLowerCase();
    
    // Search nodes
    if (query.type === 'all' || query.type === 'node' || query.type === 'ip') {
      topology.nodes.forEach(node => {
        const matches: any[] = [];
        let relevance = 0;
        
        // Search in various node fields
        const searchFields = [
          { field: 'id', value: node.id },
          { field: 'label', value: node.label },
          { field: 'type', value: node.type },
          { field: 'privateIP', value: node.properties.privateIpAddress || '' },
          { field: 'publicIP', value: node.properties.publicIpAddress || '' },
          { field: 'cidr', value: node.properties.cidrBlock || '' },
          { field: 'name', value: node.properties.name || '' }
        ];
        
        searchFields.forEach(({ field, value }) => {
          if (!value) return;
          
          const searchValue = query.caseSensitive ? value : value.toLowerCase();
          const index = query.exactMatch 
            ? (searchValue === searchTerm ? 0 : -1)
            : searchValue.indexOf(searchTerm);
          
          if (index >= 0) {
            matches.push({
              field,
              value,
              highlightStart: index,
              highlightEnd: index + searchTerm.length
            });
            relevance += query.exactMatch ? 1 : (1 - index / value.length);
          }
        });
        
        if (matches.length > 0) {
          results.push({
            type: 'node',
            id: node.id,
            label: node.label,
            matches,
            relevance: relevance / matches.length
          });
        }
      });
    }
    
    // Search edges
    if (query.type === 'all' || query.type === 'port' || query.type === 'protocol') {
      topology.edges.forEach(edge => {
        const matches: any[] = [];
        let relevance = 0;
        
        // Search in edge properties
        if (query.type === 'all' || query.type === 'protocol') {
          edge.properties.protocols.forEach(protocol => {
            const searchValue = query.caseSensitive ? protocol : protocol.toLowerCase();
            const index = query.exactMatch 
              ? (searchValue === searchTerm ? 0 : -1)
              : searchValue.indexOf(searchTerm);
            
            if (index >= 0) {
              matches.push({
                field: 'protocol',
                value: protocol,
                highlightStart: index,
                highlightEnd: index + searchTerm.length
              });
              relevance += 0.8;
            }
          });
        }
        
        if (query.type === 'all' || query.type === 'port') {
          edge.properties.ports.forEach(port => {
            const portStr = port.toString();
            const searchValue = query.caseSensitive ? portStr : portStr.toLowerCase();
            const index = query.exactMatch 
              ? (searchValue === searchTerm ? 0 : -1)
              : searchValue.indexOf(searchTerm);
            
            if (index >= 0) {
              matches.push({
                field: 'port',
                value: portStr,
                highlightStart: index,
                highlightEnd: index + searchTerm.length
              });
              relevance += 0.9;
            }
          });
        }
        
        if (matches.length > 0) {
          results.push({
            type: 'edge',
            id: edge.id,
            label: `${edge.source} → ${edge.target}`,
            matches,
            relevance: relevance / matches.length
          });
        }
      });
    }
    
    // Sort by relevance
    return results.sort((a, b) => b.relevance - a.relevance);
  }, [topology]);

  // Export functions
  const exportStatistics = useCallback(async (format: 'csv' | 'json'): Promise<Blob> => {
    if (!filteredStatistics) {
      throw new Error('No statistics available to export');
    }
    
    if (format === 'json') {
      const data = JSON.stringify(filteredStatistics, null, 2);
      return new Blob([data], { type: 'application/json' });
    } else {
      // CSV format
      const csvLines = [
        'Metric,Value',
        `Total Records,${filteredStatistics.totalRecords}`,
        `Filtered Records,${filteredStatistics.filteredRecords}`,
        `Reduction Percentage,${filteredStatistics.reductionPercentage.toFixed(2)}%`,
        `Total Bytes,${filteredStatistics.totalBytes}`,
        `Total Packets,${filteredStatistics.totalPackets}`,
        `Total Connections,${filteredStatistics.totalConnections}`,
        `Accepted Connections,${filteredStatistics.acceptedConnections}`,
        `Rejected Connections,${filteredStatistics.rejectedConnections}`,
        `Rejection Rate,${filteredStatistics.rejectionRate.toFixed(2)}%`
      ];
      
      const csvData = csvLines.join('\n');
      return new Blob([csvData], { type: 'text/csv' });
    }
  }, [filteredStatistics]);

  const exportFilteredData = useCallback(async (format: 'csv' | 'json'): Promise<Blob> => {
    if (format === 'json') {
      const data = JSON.stringify(filteredFlowLogs, null, 2);
      return new Blob([data], { type: 'application/json' });
    } else {
      // CSV format
      if (filteredFlowLogs.length === 0) {
        return new Blob(['No data to export'], { type: 'text/csv' });
      }
      
      const headers = Object.keys(filteredFlowLogs[0]).join(',');
      const rows = filteredFlowLogs.map(record => 
        Object.values(record).map(value => 
          typeof value === 'string' ? `"${value}"` : value
        ).join(',')
      );
      
      const csvData = [headers, ...rows].join('\n');
      return new Blob([csvData], { type: 'text/csv' });
    }
  }, [filteredFlowLogs]);

  return {
    filterState,
    filteredTopology,
    filteredStatistics,
    updateFilters,
    resetFilters,
    saveFilter,
    loadFilter,
    deleteFilter,
    search,
    exportStatistics,
    exportFilteredData
  };
}