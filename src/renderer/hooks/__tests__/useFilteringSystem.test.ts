import { renderHook, act } from '@testing-library/react';
import { useFilteringSystem } from '../useFilteringSystem';
import { NetworkTopology, FlowLogRecord } from '@shared/types';

describe('useFilteringSystem', () => {
  const mockTopology: NetworkTopology = {
    nodes: [
      {
        id: 'node-1',
        type: 'instance',
        label: 'Test Instance',
        properties: {
          privateIpAddress: '192.168.1.10',
          name: 'test-instance'
        },
        metadata: {
          isActive: true,
          trafficVolume: 1000
        }
      },
      {
        id: 'node-2',
        type: 'vpc',
        label: 'Test VPC',
        properties: {
          cidrBlock: '192.168.0.0/16',
          name: 'test-vpc'
        },
        metadata: {
          isActive: true,
          trafficVolume: 5000
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        trafficStats: {
          totalBytes: 1024,
          totalPackets: 10,
          acceptedConnections: 8,
          rejectedConnections: 2,
          uniqueSourceIPs: 1,
          uniqueDestinationIPs: 1,
          topPorts: [],
          timeRange: { start: new Date(), end: new Date() },
          sourceToTargetBytes: 512,
          targetToSourceBytes: 512,
          sourceToTargetPackets: 5,
          targetToSourcePackets: 5
        },
        flowRecords: [],
        properties: {
          protocols: ['TCP'],
          ports: [80, 443],
          hasRejectedConnections: false
        },
        metadata: {
          isActive: true
        }
      }
    ],
    metadata: {
      lastUpdated: new Date(),
      recordCount: 100,
      timeRange: { start: new Date(), end: new Date() }
    }
  };

  const mockFlowLogs: FlowLogRecord[] = [
    {
      timestamp: new Date('2024-01-01T12:00:00Z'),
      sourceIP: '192.168.1.10',
      destinationIP: '192.168.1.20',
      sourcePort: 12345,
      destinationPort: 80,
      protocol: 'TCP',
      action: 'ACCEPT',
      bytes: 1024,
      packets: 10,
      vpcId: 'vpc-12345',
      region: 'us-east-1'
    },
    {
      timestamp: new Date('2024-01-01T12:01:00Z'),
      sourceIP: '10.0.0.10',
      destinationIP: '10.0.0.20',
      sourcePort: 54321,
      destinationPort: 443,
      protocol: 'TCP',
      action: 'REJECT',
      bytes: 512,
      packets: 5,
      vpcId: 'vpc-67890',
      region: 'us-west-2'
    }
  ];

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('initializes with default filters', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    expect(result.current.filterState.filters.actions).toEqual(['ACCEPT', 'REJECT']);
    expect(result.current.filterState.filters.sourceIPs).toEqual([]);
    expect(result.current.filterState.activeFilterCount).toBe(0);
  });

  it('updates filters correctly', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        sourceIPs: ['192.168.1.10'],
        protocols: ['TCP']
      });
    });

    expect(result.current.filterState.filters.sourceIPs).toEqual(['192.168.1.10']);
    expect(result.current.filterState.filters.protocols).toEqual(['TCP']);
    expect(result.current.filterState.activeFilterCount).toBe(2);
  });

  it('resets filters correctly', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        sourceIPs: ['192.168.1.10'],
        protocols: ['TCP']
      });
    });

    expect(result.current.filterState.activeFilterCount).toBe(2);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filterState.filters.sourceIPs).toEqual([]);
    expect(result.current.filterState.filters.protocols).toEqual([]);
    expect(result.current.filterState.activeFilterCount).toBe(0);
  });

  it('filters topology based on active nodes', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    // Initially should include all nodes
    expect(result.current.filteredTopology?.nodes).toHaveLength(2);

    act(() => {
      result.current.updateFilters({
        isActive: true
      });
    });

    // Should still include all nodes since they have traffic
    expect(result.current.filteredTopology?.nodes).toHaveLength(2);
  });

  it('calculates statistics correctly', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const stats = result.current.filteredStatistics;
    expect(stats).toBeTruthy();
    expect(stats?.totalRecords).toBe(2);
    expect(stats?.filteredRecords).toBe(2);
    expect(stats?.totalBytes).toBe(1536); // 1024 + 512
    expect(stats?.acceptedConnections).toBe(1);
    expect(stats?.rejectedConnections).toBe(1);
  });

  it('filters flow logs by IP address', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        sourceIPs: ['192.168.1.10']
      });
    });

    const stats = result.current.filteredStatistics;
    expect(stats?.filteredRecords).toBe(1);
    expect(stats?.totalBytes).toBe(1024);
  });

  it('filters flow logs by protocol', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        protocols: ['TCP']
      });
    });

    const stats = result.current.filteredStatistics;
    expect(stats?.filteredRecords).toBe(2); // Both records are TCP
  });

  it('filters flow logs by action', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        actions: ['ACCEPT']
      });
    });

    const stats = result.current.filteredStatistics;
    expect(stats?.filteredRecords).toBe(1);
    expect(stats?.acceptedConnections).toBe(1);
    expect(stats?.rejectedConnections).toBe(0);
  });

  it('performs search correctly', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const searchResults = result.current.search({
      query: 'test',
      type: 'all',
      caseSensitive: false,
      exactMatch: false
    });

    expect(searchResults).toHaveLength(2); // Should find both nodes with "test" in their labels
    expect(searchResults[0].type).toBe('node');
    expect(searchResults[0].matches).toHaveLength(1);
  });

  it('performs IP-specific search', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const searchResults = result.current.search({
      query: '192.168',
      type: 'ip',
      caseSensitive: false,
      exactMatch: false
    });

    expect(searchResults).toHaveLength(1); // Should find the instance with 192.168.1.10
    expect(searchResults[0].id).toBe('node-1');
  });

  it('saves and loads filters', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.updateFilters({
        sourceIPs: ['192.168.1.10'],
        protocols: ['TCP']
      });
    });

    act(() => {
      result.current.saveFilter('Test Filter', 'A test filter');
    });

    expect(result.current.filterState.savedFilters).toHaveLength(1);
    expect(result.current.filterState.savedFilters[0].name).toBe('Test Filter');

    // Reset filters
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filterState.filters.sourceIPs).toEqual([]);

    // Load saved filter
    const filterId = result.current.filterState.savedFilters[0].id;
    act(() => {
      result.current.loadFilter(filterId);
    });

    expect(result.current.filterState.filters.sourceIPs).toEqual(['192.168.1.10']);
    expect(result.current.filterState.filters.protocols).toEqual(['TCP']);
  });

  it('deletes saved filters', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    act(() => {
      result.current.saveFilter('Test Filter');
    });

    expect(result.current.filterState.savedFilters).toHaveLength(1);

    const filterId = result.current.filterState.savedFilters[0].id;
    act(() => {
      result.current.deleteFilter(filterId);
    });

    expect(result.current.filterState.savedFilters).toHaveLength(0);
  });

  it('exports statistics as CSV', async () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const blob = await result.current.exportStatistics('csv');
    expect(blob.type).toBe('text/csv');

    const text = await blob.text();
    expect(text).toContain('Metric,Value');
    expect(text).toContain('Total Records,2');
  });

  it('exports statistics as JSON', async () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const blob = await result.current.exportStatistics('json');
    expect(blob.type).toBe('application/json');

    const text = await blob.text();
    const data = JSON.parse(text);
    expect(data.totalRecords).toBe(2);
    expect(data.filteredRecords).toBe(2);
  });

  it('exports filtered data as CSV', async () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const blob = await result.current.exportFilteredData('csv');
    expect(blob.type).toBe('text/csv');

    const text = await blob.text();
    expect(text).toContain('timestamp,sourceIP,destinationIP');
    expect(text).toContain('192.168.1.10');
  });

  it('handles time range filtering', () => {
    const { result } = renderHook(() => useFilteringSystem(mockTopology, mockFlowLogs));

    const startTime = new Date('2024-01-01T11:59:00Z');
    const endTime = new Date('2024-01-01T12:00:30Z');

    act(() => {
      result.current.updateFilters({
        timeRange: {
          start: startTime,
          end: endTime,
          preset: 'custom'
        }
      });
    });

    const stats = result.current.filteredStatistics;
    expect(stats?.filteredRecords).toBe(1); // Only the first record should match
  });
});