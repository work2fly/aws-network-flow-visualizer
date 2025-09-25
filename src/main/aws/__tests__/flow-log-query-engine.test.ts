import { FlowLogQueryEngine } from '../flow-log-query-engine';
import { AWSCredentialManager } from '../credential-manager';
import { VPCQueryParams } from '../vpc-flow-log-query-builder';
import { TGWQueryParams } from '../tgw-flow-log-query-builder';
import { QueryExecutionResult } from '../../../shared/types';

// Mock dependencies
jest.mock('../cloudwatch-insights-client');
jest.mock('../vpc-flow-log-query-builder');
jest.mock('../tgw-flow-log-query-builder');

const mockCredentialManager = {
  getCurrentCredentials: jest.fn(),
  getSTSClient: jest.fn(),
} as unknown as AWSCredentialManager;

const mockStsClient = {
  config: {
    credentials: jest.fn(),
  },
};

const mockVPCQueryBuilder = {
  executeQuery: jest.fn(),
};

const mockTGWQueryBuilder = {
  executeQuery: jest.fn(),
  executeCrossAccountQuery: jest.fn(),
};

const mockClient = {
  getFlowLogGroups: jest.fn(),
  cancelQuery: jest.fn(),
};

// Mock the constructors
jest.mock('../cloudwatch-insights-client', () => ({
  CloudWatchInsightsClient: jest.fn(() => mockClient),
}));

jest.mock('../vpc-flow-log-query-builder', () => ({
  VPCFlowLogQueryBuilder: jest.fn(() => mockVPCQueryBuilder),
}));

jest.mock('../tgw-flow-log-query-builder', () => ({
  TGWFlowLogQueryBuilder: jest.fn(() => mockTGWQueryBuilder),
}));

describe('FlowLogQueryEngine', () => {
  let queryEngine: FlowLogQueryEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (mockCredentialManager.getCurrentCredentials as jest.Mock).mockReturnValue({
      region: 'us-east-1',
    });
    
    (mockCredentialManager.getSTSClient as jest.Mock).mockReturnValue(mockStsClient);

    queryEngine = new FlowLogQueryEngine({
      credentialManager: mockCredentialManager,
      region: 'us-east-1',
      cacheEnabled: true,
      cacheTTLMs: 300000,
    });
  });

  describe('initialization', () => {
    it('should initialize with valid credentials', () => {
      expect(mockCredentialManager.getCurrentCredentials).toHaveBeenCalled();
      expect(mockCredentialManager.getSTSClient).toHaveBeenCalled();
    });

    it('should throw error if no credentials available', () => {
      (mockCredentialManager.getCurrentCredentials as jest.Mock).mockReturnValue(null);
      
      expect(() => {
        new FlowLogQueryEngine({
          credentialManager: mockCredentialManager,
          region: 'us-east-1',
        });
      }).toThrow('No AWS credentials available');
    });

    it('should throw error if no STS client available', () => {
      (mockCredentialManager.getSTSClient as jest.Mock).mockReturnValue(null);
      
      expect(() => {
        new FlowLogQueryEngine({
          credentialManager: mockCredentialManager,
          region: 'us-east-1',
        });
      }).toThrow('No STS client available');
    });
  });

  describe('executeVPCQuery', () => {
    const mockVPCParams: VPCQueryParams = {
      logGroupNames: ['/aws/vpc/flowlogs'],
      startTime: new Date('2023-01-01T00:00:00Z'),
      endTime: new Date('2023-01-01T01:00:00Z'),
    };

    const mockSuccessResult: QueryExecutionResult = {
      success: true,
      queryId: 'test-query-id',
      results: [],
      statistics: {
        recordsMatched: 100,
        recordsScanned: 1000,
        bytesScanned: 50000,
      },
    };

    it('should execute VPC query successfully', async () => {
      (mockVPCQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockSuccessResult);

      const { result, metrics } = await queryEngine.executeVPCQuery(mockVPCParams);

      expect(result.success).toBe(true);
      expect(metrics.cacheHit).toBe(false);
      expect(metrics.recordsReturned).toBe(0);
      expect(metrics.bytesScanned).toBe(50000);
      expect(mockVPCQueryBuilder.executeQuery).toHaveBeenCalledWith(
        mockVPCParams,
        expect.any(Function)
      );
    });

    it('should return cached result on subsequent identical queries', async () => {
      (mockVPCQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockSuccessResult);

      // First query
      await queryEngine.executeVPCQuery(mockVPCParams);
      
      // Second identical query should use cache
      const { result, metrics } = await queryEngine.executeVPCQuery(mockVPCParams);

      expect(result.success).toBe(true);
      expect(metrics.cacheHit).toBe(true);
      expect(mockVPCQueryBuilder.executeQuery).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle query execution errors', async () => {
      const mockErrorResult: QueryExecutionResult = {
        success: false,
        error: 'Query execution failed',
      };

      (mockVPCQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockErrorResult);

      const { result, metrics } = await queryEngine.executeVPCQuery(mockVPCParams, {
        retryAttempts: 1, // Reduce retries for faster test
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query execution failed');
      expect(metrics.cacheHit).toBe(false);
    });

    it('should emit events during query execution', async () => {
      (mockVPCQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockSuccessResult);

      const queryStartedSpy = jest.fn();
      const queryCompleteSpy = jest.fn();
      
      queryEngine.on('queryStarted', queryStartedSpy);
      queryEngine.on('queryComplete', queryCompleteSpy);

      await queryEngine.executeVPCQuery(mockVPCParams);

      expect(queryStartedSpy).toHaveBeenCalledWith({
        type: 'vpc',
        attempt: 1,
        params: mockVPCParams,
      });

      expect(queryCompleteSpy).toHaveBeenCalledWith({
        type: 'vpc',
        cached: false,
        result: mockSuccessResult,
      });
    });

    it('should retry failed queries', async () => {
      (mockVPCQueryBuilder.executeQuery as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSuccessResult);

      const { result } = await queryEngine.executeVPCQuery(mockVPCParams, {
        retryAttempts: 2,
        retryDelayMs: 10, // Short delay for testing
      });

      expect(result.success).toBe(true);
      expect(mockVPCQueryBuilder.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retry attempts', async () => {
      (mockVPCQueryBuilder.executeQuery as jest.Mock)
        .mockRejectedValue(new Error('Persistent error'));

      const { result } = await queryEngine.executeVPCQuery(mockVPCParams, {
        retryAttempts: 2,
        retryDelayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query failed after 2 attempts');
      expect(mockVPCQueryBuilder.executeQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeTGWQuery', () => {
    const mockTGWParams: TGWQueryParams = {
      logGroupNames: ['/aws/transitgateway/flowlogs'],
      startTime: new Date('2023-01-01T00:00:00Z'),
      endTime: new Date('2023-01-01T01:00:00Z'),
    };

    const mockSuccessResult: QueryExecutionResult = {
      success: true,
      queryId: 'test-tgw-query-id',
      results: [],
      statistics: {
        recordsMatched: 50,
        recordsScanned: 500,
        bytesScanned: 25000,
      },
    };

    it('should execute TGW query successfully', async () => {
      (mockTGWQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockSuccessResult);

      const { result, metrics } = await queryEngine.executeTGWQuery(mockTGWParams);

      expect(result.success).toBe(true);
      expect(metrics.cacheHit).toBe(false);
      expect(metrics.bytesScanned).toBe(25000);
      expect(mockTGWQueryBuilder.executeQuery).toHaveBeenCalledWith(
        mockTGWParams,
        expect.any(Function)
      );
    });

    it('should execute cross-account TGW query', async () => {
      const crossAccountParams: TGWQueryParams = {
        ...mockTGWParams,
        crossAccountRoleArns: ['arn:aws:iam::123456789012:role/CrossAccountRole'],
      };

      const mockCrossAccountResults = [
        {
          accountId: '123456789012',
          result: mockSuccessResult,
        },
      ];

      (mockTGWQueryBuilder.executeCrossAccountQuery as jest.Mock).mockResolvedValue(mockCrossAccountResults);

      const { result, crossAccountResults, metrics } = await queryEngine.executeTGWQuery(crossAccountParams);

      expect(result.success).toBe(true);
      expect(crossAccountResults).toEqual(mockCrossAccountResults);
      expect(mockTGWQueryBuilder.executeCrossAccountQuery).toHaveBeenCalledWith(
        crossAccountParams,
        expect.any(Function)
      );
    });

    it('should handle cross-account query with mixed results', async () => {
      const crossAccountParams: TGWQueryParams = {
        ...mockTGWParams,
        crossAccountRoleArns: [
          'arn:aws:iam::123456789012:role/CrossAccountRole',
          'arn:aws:iam::210987654321:role/CrossAccountRole',
        ],
      };

      const mockCrossAccountResults = [
        {
          accountId: '123456789012',
          result: {
            success: true,
            results: [{ sourceIP: '10.0.0.1' } as any],
            statistics: { recordsMatched: 1, recordsScanned: 10, bytesScanned: 1000 },
          },
        },
        {
          accountId: '210987654321',
          result: {
            success: false,
            error: 'Access denied',
          },
        },
      ];

      (mockTGWQueryBuilder.executeCrossAccountQuery as jest.Mock).mockResolvedValue(mockCrossAccountResults);

      const { result, crossAccountResults } = await queryEngine.executeTGWQuery(crossAccountParams);

      expect(result.success).toBe(true); // Should succeed if at least one account returns data
      expect(result.results).toHaveLength(1);
      expect(result.error).toContain('Account 210987654321: Access denied');
      expect(crossAccountResults).toEqual(mockCrossAccountResults);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      const cacheCleared = jest.fn();
      queryEngine.on('cacheCleared', cacheCleared);

      queryEngine.clearCache();

      expect(cacheCleared).toHaveBeenCalled();
    });

    it('should provide cache statistics', () => {
      const stats = queryEngine.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('entries');
      expect(Array.isArray(stats.entries)).toBe(true);
    });

    it('should not cache failed queries', async () => {
      const mockErrorResult: QueryExecutionResult = {
        success: false,
        error: 'Query failed',
      };

      (mockVPCQueryBuilder.executeQuery as jest.Mock).mockResolvedValue(mockErrorResult);

      const mockVPCParams: VPCQueryParams = {
        logGroupNames: ['/aws/vpc/flowlogs'],
        startTime: new Date('2023-01-01T00:00:00Z'),
        endTime: new Date('2023-01-01T01:00:00Z'),
      };

      // Execute query twice with reduced retry attempts for faster test
      await queryEngine.executeVPCQuery(mockVPCParams, { retryAttempts: 1 });
      await queryEngine.executeVPCQuery(mockVPCParams, { retryAttempts: 1 });

      // Should execute twice (not cached)
      expect(mockVPCQueryBuilder.executeQuery).toHaveBeenCalledTimes(2);
    }, 10000); // Increase timeout
  });

  describe('utility methods', () => {
    it('should get available log groups', async () => {
      const mockLogGroups = ['/aws/vpc/flowlogs', '/aws/transitgateway/flowlogs'];
      (mockClient.getFlowLogGroups as jest.Mock).mockResolvedValue(mockLogGroups);

      const logGroups = await queryEngine.getAvailableLogGroups();

      expect(logGroups).toEqual(mockLogGroups);
      expect(mockClient.getFlowLogGroups).toHaveBeenCalledWith(undefined);
    });

    it('should cancel query', async () => {
      const queryId = 'test-query-id';
      const queryCancelled = jest.fn();
      
      queryEngine.on('queryCancelled', queryCancelled);

      await queryEngine.cancelQuery(queryId);

      expect(mockClient.cancelQuery).toHaveBeenCalledWith(queryId);
      expect(queryCancelled).toHaveBeenCalledWith({ queryId });
    });

    it('should update credentials', () => {
      const credentialsUpdated = jest.fn();
      queryEngine.on('credentialsUpdated', credentialsUpdated);

      queryEngine.updateCredentials('us-west-2');

      expect(credentialsUpdated).toHaveBeenCalledWith({ region: 'us-west-2' });
    });

    it('should handle errors in log group discovery', async () => {
      const error = new Error('Access denied');
      (mockClient.getFlowLogGroups as jest.Mock).mockRejectedValue(error);

      const errorSpy = jest.fn();
      queryEngine.on('error', errorSpy);

      await expect(queryEngine.getAvailableLogGroups()).rejects.toThrow('Access denied');
      
      expect(errorSpy).toHaveBeenCalledWith({
        type: 'logGroupDiscovery',
        error: 'Access denied',
      });
    });
  });
});