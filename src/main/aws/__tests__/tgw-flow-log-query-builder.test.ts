import { TGWFlowLogQueryBuilder } from '../tgw-flow-log-query-builder';
import { CloudWatchInsightsClient } from '../cloudwatch-insights-client';
import { TGWFlowLogFilters } from '../../../shared/types';

// Mock CloudWatch Insights client
const mockClient = {
  executeQuery: jest.fn(),
} as unknown as CloudWatchInsightsClient;

describe('TGWFlowLogQueryBuilder', () => {
  let queryBuilder: TGWFlowLogQueryBuilder;

  beforeEach(() => {
    queryBuilder = new TGWFlowLogQueryBuilder(mockClient);
    jest.clearAllMocks();
  });

  describe('buildQuery', () => {
    it('should build basic query without filters', () => {
      const query = queryBuilder.buildQuery();
      
      expect(query).toContain('fields @timestamp, srcaddr, dstaddr, srcport, dstport, protocol, action, bytes, packets');
      expect(query).toContain('`tgw-id`, `tgw-attachment-id`, `tgw-src-vpc-account-id`, `tgw-dst-vpc-account-id`');
      expect(query).toContain('`tgw-pair-attachment-id`, `sublocation-type`, `sublocation-id`');
      expect(query).toContain('sort @timestamp desc');
      expect(query).not.toContain('filter');
    });

    it('should build query with Transit Gateway ID filter', () => {
      const filters: TGWFlowLogFilters = {
        transitGatewayIds: ['tgw-12345678', 'tgw-87654321']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('filter');
      expect(query).toContain('`tgw-id` = "tgw-12345678"');
      expect(query).toContain('`tgw-id` = "tgw-87654321"');
    });

    it('should build query with attachment ID filter', () => {
      const filters: TGWFlowLogFilters = {
        attachmentIds: ['tgw-attach-12345678']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('`tgw-attachment-id` = "tgw-attach-12345678"');
      expect(query).toContain('`tgw-pair-attachment-id` = "tgw-attach-12345678"');
    });

    it('should build query with resource type filter', () => {
      const filters: TGWFlowLogFilters = {
        resourceTypes: ['VPC', 'VPN']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('`sublocation-type` = "VPC"');
      expect(query).toContain('`sublocation-type` = "VPN"');
    });

    it('should build query with cross-account filters', () => {
      const filters: TGWFlowLogFilters = {
        accountIds: ['123456789012', '210987654321']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('`account-id` = "123456789012"');
      expect(query).toContain('`tgw-src-vpc-account-id` = "123456789012"');
      expect(query).toContain('`tgw-dst-vpc-account-id` = "123456789012"');
    });

    it('should build query with VPC-level filters', () => {
      const filters: TGWFlowLogFilters = {
        sourceIPs: ['192.168.1.1'],
        protocols: ['tcp'],
        actions: ['ACCEPT']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('srcaddr = "192.168.1.1"');
      expect(query).toContain('protocol = "6"'); // TCP
      expect(query).toContain('action = "ACCEPT"');
    });

    it('should combine TGW and VPC filters with AND', () => {
      const filters: TGWFlowLogFilters = {
        transitGatewayIds: ['tgw-12345678'],
        sourceIPs: ['192.168.1.1'],
        protocols: ['tcp']
      };

      const query = queryBuilder.buildQuery(filters);
      
      expect(query).toContain('filter');
      expect(query).toContain('and');
      expect(query).toContain('`tgw-id` = "tgw-12345678"');
      expect(query).toContain('srcaddr = "192.168.1.1"');
      expect(query).toContain('protocol = "6"');
    });
  });

  describe('validateFilters', () => {
    it('should validate valid Transit Gateway IDs', () => {
      const filters: TGWFlowLogFilters = {
        transitGatewayIds: ['tgw-12345678', 'tgw-abcdef123456789']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid Transit Gateway IDs', () => {
      const filters: TGWFlowLogFilters = {
        transitGatewayIds: ['invalid-tgw-id', 'tgw-', 'tgw-xyz']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid Transit Gateway ID'))).toBe(true);
    });

    it('should validate valid attachment IDs', () => {
      const filters: TGWFlowLogFilters = {
        attachmentIds: ['tgw-attach-12345678', 'tgw-attach-abcdef123456789']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid attachment IDs', () => {
      const filters: TGWFlowLogFilters = {
        attachmentIds: ['invalid-attachment', 'tgw-attach-', 'attach-12345678']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid attachment ID'))).toBe(true);
    });

    it('should validate valid resource types', () => {
      const filters: TGWFlowLogFilters = {
        resourceTypes: ['VPC', 'VPN', 'DirectConnect', 'PeeringConnection', 'TGW']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid resource types', () => {
      const filters: TGWFlowLogFilters = {
        resourceTypes: ['InvalidType', 'UnknownResource']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Invalid resource type'))).toBe(true);
    });

    it('should validate inherited VPC filters', () => {
      const filters: TGWFlowLogFilters = {
        sourceIPs: ['192.168.1.1', '10.0.0.0/16'],
        sourcePorts: [80, '443', '8000-8080'],
        protocols: ['tcp', 'udp'],
        actions: ['ACCEPT', 'REJECT']
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid inherited VPC filters', () => {
      const filters: TGWFlowLogFilters = {
        sourceIPs: ['invalid-ip'],
        sourcePorts: [-1, '70000'],
        protocols: ['invalid-protocol'],
        actions: ['INVALID_ACTION' as any]
      };

      const result = queryBuilder.validateFilters(filters);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
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
        logGroupNames: ['/aws/transitgateway/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
        filters: {
          transitGatewayIds: ['tgw-12345678']
        }
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(true);
      expect(mockClient.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          logGroupNames: params.logGroupNames,
          startTime: params.startTime,
          endTime: params.endTime,
          queryString: expect.stringContaining('`tgw-id` = "tgw-12345678"'),
        }),
        undefined
      );
    });

    it('should reject query with invalid parameters', async () => {
      const params = {
        logGroupNames: [], // Invalid: empty array
        startTime: new Date('2023-01-01T01:00:00Z'),
        endTime: new Date('2023-01-01T00:00:00Z'), // Invalid: end before start
        filters: {
          transitGatewayIds: ['invalid-tgw-id'] // Invalid TGW ID
        }
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid query parameters');
      expect(mockClient.executeQuery).not.toHaveBeenCalled();
    });

    it('should handle client errors gracefully', async () => {
      (mockClient.executeQuery as jest.Mock).mockRejectedValue(new Error('Network error'));

      const params = {
        logGroupNames: ['/aws/transitgateway/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
      };

      const result = await queryBuilder.executeQuery(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('executeCrossAccountQuery', () => {
    it('should execute single-account query when no cross-account roles provided', async () => {
      const mockResult = {
        success: true,
        queryId: 'test-query-id',
        results: [],
      };

      (mockClient.executeQuery as jest.Mock).mockResolvedValue(mockResult);

      const params = {
        logGroupNames: ['/aws/transitgateway/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
      };

      const results = await queryBuilder.executeCrossAccountQuery(params);
      
      expect(results).toHaveLength(1);
      expect(results[0].accountId).toBe('current');
      expect(results[0].result.success).toBe(true);
    });

    it('should handle cross-account query execution (not yet implemented)', async () => {
      const params = {
        logGroupNames: ['/aws/transitgateway/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
        crossAccountRoleArns: ['arn:aws:iam::123456789012:role/CrossAccountRole']
      };

      const results = await queryBuilder.executeCrossAccountQuery(params);
      
      expect(results).toHaveLength(1);
      expect(results[0].accountId).toBe('123456789012');
      expect(results[0].result.success).toBe(false);
      expect(results[0].result.error).toContain('Cross-account client creation not yet implemented');
    });
  });

  describe('validation helpers', () => {
    it('should validate role ARN format', () => {
      const validRoleArns = [
        'arn:aws:iam::123456789012:role/MyRole',
        'arn:aws:iam::123456789012:role/path/to/MyRole'
      ];

      const invalidRoleArns = [
        'invalid-arn',
        'arn:aws:iam::invalid:role/MyRole',
        'arn:aws:iam::123456789012:user/MyUser'
      ];

      // Test through query parameter validation
      for (const roleArn of validRoleArns) {
        const params = {
          logGroupNames: ['/aws/transitgateway/flowlogs'],
          startTime: new Date('2023-01-01T00:00:00Z'),
          endTime: new Date('2023-01-01T01:00:00Z'),
          crossAccountRoleArns: [roleArn]
        };

        const validation = (queryBuilder as any).validateQueryParams(params);
        expect(validation.valid).toBe(true);
      }

      for (const roleArn of invalidRoleArns) {
        const params = {
          logGroupNames: ['/aws/transitgateway/flowlogs'],
          startTime: new Date('2023-01-01T00:00:00Z'),
          endTime: new Date('2023-01-01T01:00:00Z'),
          crossAccountRoleArns: [roleArn]
        };

        const validation = (queryBuilder as any).validateQueryParams(params);
        expect(validation.valid).toBe(false);
      }
    });
  });
});