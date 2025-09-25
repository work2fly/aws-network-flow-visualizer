import { VPCFlowLogQueryBuilder } from '../vpc-flow-log-query-builder';
import { CloudWatchInsightsClient } from '../cloudwatch-insights-client';
import { VPCFlowLogFilters } from '../../../shared/types';

// Mock CloudWatch Insights client
const mockClient = {
  executeQuery: jest.fn(),
} as unknown as CloudWatchInsightsClient;

describe('VPCFlowLogQueryBuilder', () => {
  let queryBuilder: VPCFlowLogQueryBuilder;

  beforeEach(() => {
    queryBuilder = new VPCFlowLogQueryBuilder(mockClient);
    jest.clearAllMocks();
  });

  describe('buildQuery', () => {
    it('should build basic query without filters', () => {
      const query = queryBuilder.buildQuery();
      
      expect(query).toContain('fields @timestamp, srcaddr, dstaddr, srcport, dstport, protocol, action, bytes, packets');
      expect(query).toContain('sort @timestamp desc');
      expect(query).not.toContain('filter');
    });

    it('should build query with source IP filter', () => {
      const filters: VPCFlowLogFilters = {
        sourceIPs: ['192.168.1.1', '10.0.0.0/16']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('filter');
      expect(query).toContain('srcaddr = "192.168.1.1"');
      expect(query).toContain('cidr("10.0.0.0/16") = srcaddr');
    });

    it('should build query with destination IP filter', () => {
      const filters: VPCFlowLogFilters = {
        destinationIPs: ['172.16.0.1']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('dstaddr = "172.16.0.1"');
    });

    it('should build query with port filters', () => {
      const filters: VPCFlowLogFilters = {
        sourcePorts: [80, '443', '8000-8080'],
        destinationPorts: [22, '3000-3010']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('srcport = 80');
      expect(query).toContain('srcport = 443');
      expect(query).toContain('(srcport >= 8000 and srcport <= 8080)');
      expect(query).toContain('dstport = 22');
      expect(query).toContain('(dstport >= 3000 and dstport <= 3010)');
    });

    it('should build query with protocol filters', () => {
      const filters: VPCFlowLogFilters = {
        protocols: ['tcp', 'udp', '1']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('protocol = "6"'); // TCP
      expect(query).toContain('protocol = "17"'); // UDP
      expect(query).toContain('protocol = "1"'); // ICMP
    });

    it('should build query with action filters', () => {
      const filters: VPCFlowLogFilters = {
        actions: ['ACCEPT', 'REJECT']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('action = "ACCEPT"');
      expect(query).toContain('action = "REJECT"');
    });

    it('should build query with VPC ID filters', () => {
      const filters: VPCFlowLogFilters = {
        vpcIds: ['vpc-12345678', 'vpc-87654321']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('`vpc-id` = "vpc-12345678"');
      expect(query).toContain('`vpc-id` = "vpc-87654321"');
    });

    it('should build query with account ID filters', () => {
      const filters: VPCFlowLogFilters = {
        accountIds: ['123456789012', '210987654321']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('`account-id` = "123456789012"');
      expect(query).toContain('`account-id` = "210987654321"');
    });

    it('should build query with byte range filters', () => {
      const filters: VPCFlowLogFilters = {
        minBytes: 1000,
        maxBytes: 50000
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('bytes >= 1000');
      expect(query).toContain('bytes <= 50000');
    });

    it('should build query with packet range filters', () => {
      const filters: VPCFlowLogFilters = {
        minPackets: 10,
        maxPackets: 1000
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('packets >= 10');
      expect(query).toContain('packets <= 1000');
    });

    it('should combine multiple filters with AND', () => {
      const filters: VPCFlowLogFilters = {
        sourceIPs: ['192.168.1.1'],
        protocols: ['tcp'],
        actions: ['ACCEPT']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('filter');
      expect(query).toContain('and');
      expect(query).toContain('srcaddr = "192.168.1.1"');
      expect(query).toContain('protocol = "6"');
      expect(query).toContain('action = "ACCEPT"');
    });
  });

  describe('validateFilters', () => {
    it('should validate valid IP addresses', () => {
      const filters: VPCFlowLogFilters = {
        sourceIPs: ['192.168.1.1', '10.0.0.0/16'],
        destinationIPs: ['172.16.0.1']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid IP addresses', () => {
      const filters: VPCFlowLogFilters = {
        sourceIPs: ['invalid-ip', '999.999.999.999']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid source IP or range: invalid-ip');
      expect(result.errors).toContain('Invalid source IP or range: 999.999.999.999');
    });

    it('should validate valid port numbers and ranges', () => {
      const filters: VPCFlowLogFilters = {
        sourcePorts: [80, '443', '8000-8080'],
        destinationPorts: [22, '3000-3010']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid port numbers and ranges', () => {
      const filters: VPCFlowLogFilters = {
        sourcePorts: [-1, '70000', '8080-8000'], // Invalid: negative, too high, invalid range
        destinationPorts: ['invalid-port']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate valid protocols', () => {
      const filters: VPCFlowLogFilters = {
        protocols: ['tcp', 'udp', 'icmp', '6', '17', '1']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid protocols', () => {
      const filters: VPCFlowLogFilters = {
        protocols: ['invalid-protocol', '256'] // Invalid: unknown protocol, number too high
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate valid actions', () => {
      const filters: VPCFlowLogFilters = {
        actions: ['ACCEPT', 'REJECT']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid actions', () => {
      const filters: VPCFlowLogFilters = {
        actions: ['INVALID_ACTION' as any]
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid action: INVALID_ACTION');
    });

    it('should validate byte range consistency', () => {
      const filters: VPCFlowLogFilters = {
        minBytes: 1000,
        maxBytes: 500 // Invalid: min > max
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum bytes cannot be greater than maximum bytes');
    });

    it('should validate packet range consistency', () => {
      const filters: VPCFlowLogFilters = {
        minPackets: 100,
        maxPackets: 50 // Invalid: min > max
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum packets cannot be greater than maximum packets');
    });
  });

  describe('executeQuery', () => {
    it('should execute query with valid parameters', async () => {
      const mockResult = {
        success: true,
        queryId: 'test-query-id',
        results: [],
      };

      (mockClient.executeQuery as jest.Mock).mockResolvedValue(mockResult);

      const params = {
        logGroupNames: ['/aws/vpc/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
        filters: {
          sourceIPs: ['192.168.1.1']
        }
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(true);
      expect(mockClient.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          logGroupNames: params.logGroupNames,
          startTime: params.startTime,
          endTime: params.endTime,
          queryString: expect.stringContaining('srcaddr = "192.168.1.1"'),
        }),
        undefined
      );
    });

    it('should reject query with invalid parameters', async () => {
      const params = {
        logGroupNames: [], // Invalid: empty array
        startTime: new Date('2023-01-01T01:00:00Z'),
        endTime: new Date('2023-01-01T00:00:00Z'), // Invalid: end before start
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid query parameters');
      expect(mockClient.executeQuery).not.toHaveBeenCalled();
    });

    it('should handle client errors gracefully', async () => {
      (mockClient.executeQuery as jest.Mock).mockRejectedValue(new Error('Network error'));

      const params = {
        logGroupNames: ['/aws/vpc/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});