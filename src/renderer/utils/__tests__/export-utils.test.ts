import {
  exportFlowLogData,
  exportTopologyData,
  validateExportOptions,
  generateFilename,
  getExportRecommendations
} from '../export-utils';
import { FlowLogRecord, NetworkTopology } from '@shared/types';

// Mock Blob for Node.js environment
class MockBlob {
  private content: string;
  public type: string;

  constructor(content: string[], options: { type: string }) {
    this.content = content.join('');
    this.type = options.type;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Simple conversion for testing
    const buffer = Buffer.from(this.content, 'utf8');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async text(): Promise<string> {
    return this.content;
  }
}

// Mock TextDecoder for Node.js environment
class MockTextDecoder {
  decode(buffer: ArrayBuffer): string {
    return Buffer.from(buffer).toString('utf8');
  }
}

// Replace global APIs with mocks
(global as any).Blob = MockBlob;
(global as any).TextDecoder = MockTextDecoder;

// Mock data
const mockFlowLogs: FlowLogRecord[] = [
  {
    timestamp: new Date('2024-01-01T10:00:00Z'),
    sourceIP: '10.0.1.100',
    destinationIP: '10.0.2.200',
    sourcePort: 80,
    destinationPort: 443,
    protocol: 'TCP',
    action: 'ACCEPT',
    bytes: 1024,
    packets: 10,
    accountId: '123456789012',
    vpcId: 'vpc-12345',
    subnetId: 'subnet-12345',
    instanceId: 'i-12345'
  },
  {
    timestamp: new Date('2024-01-01T10:01:00Z'),
    sourceIP: '10.0.2.200',
    destinationIP: '10.0.1.100',
    sourcePort: 443,
    destinationPort: 80,
    protocol: 'TCP',
    action: 'REJECT',
    bytes: 512,
    packets: 5,
    accountId: '123456789012',
    vpcId: 'vpc-12345'
  }
];

const mockTopology: NetworkTopology = {
  nodes: [
    {
      id: 'node-1',
      type: 'vpc',
      label: 'VPC-1',
      properties: { cidrBlock: '10.0.0.0/16' },
      metadata: { isActive: true, trafficVolume: 1000 }
    },
    {
      id: 'node-2',
      type: 'instance',
      label: 'Instance-1',
      properties: { instanceType: 't3.micro' },
      metadata: { isActive: true, trafficVolume: 500 }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      trafficStats: {
        totalBytes: 1536,
        totalPackets: 15,
        acceptedConnections: 1,
        rejectedConnections: 1,
        uniqueSourceIPs: 2,
        uniqueDestinationIPs: 2,
        topPorts: [],
        timeRange: { start: new Date(), end: new Date() },
        sourceToTargetBytes: 1024,
        targetToSourceBytes: 512,
        sourceToTargetPackets: 10,
        targetToSourcePackets: 5
      },
      flowRecords: mockFlowLogs,
      properties: { bidirectional: true },
      metadata: { isActive: true }
    }
  ],
  metadata: {
    lastUpdated: new Date(),
    recordCount: 2,
    timeRange: { start: new Date(), end: new Date() }
  }
};

describe('Export Utils', () => {
  describe('exportFlowLogData', () => {
    it('should export flow logs as CSV', async () => {
      const options = { format: 'csv' as const };
      const mockProgress = jest.fn();

      const blob = await exportFlowLogData(mockFlowLogs, options, mockProgress);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/csv;charset=utf-8;');

      // Check progress calls
      expect(mockProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'preparing' })
      );
      expect(mockProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'complete' })
      );

      // Check CSV content - convert blob to text for testing
      const arrayBuffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      expect(text).toContain('timestamp,sourceIP,destinationIP');
      expect(text).toContain('10.0.1.100');
      expect(text).toContain('10.0.2.200');
    });

    it('should include metadata when requested', async () => {
      const options = { format: 'csv' as const, includeMetadata: true };
      const blob = await exportFlowLogData(mockFlowLogs, options);

      const arrayBuffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      expect(text).toContain('accountId');
      expect(text).toContain('vpcId');
      expect(text).toContain('123456789012');
    });

    it('should handle empty flow logs', async () => {
      const options = { format: 'csv' as const };

      await expect(exportFlowLogData([], options)).rejects.toThrow(
        'No flow log data to export'
      );
    });

    it('should escape CSV values with commas and quotes', async () => {
      const flowLogsWithSpecialChars: FlowLogRecord[] = [
        {
          ...mockFlowLogs[0],
          sourceIP: '10.0.1.100,with,commas',
          destinationIP: '10.0.2.200"with"quotes'
        }
      ];

      const options = { format: 'csv' as const };
      const blob = await exportFlowLogData(flowLogsWithSpecialChars, options);
      const arrayBuffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);

      expect(text).toContain('"10.0.1.100,with,commas"');
      expect(text).toContain('"10.0.2.200""with""quotes"');
    });
  });

  describe('exportTopologyData', () => {
    it('should export topology as JSON', async () => {
      const options = { format: 'json' as const };
      const mockProgress = jest.fn();

      const blob = await exportTopologyData(mockTopology, options, mockProgress);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json;charset=utf-8;');

      // Check progress calls
      expect(mockProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'preparing' })
      );
      expect(mockProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'complete' })
      );

      // Check JSON content
      const arrayBuffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      const parsed = JSON.parse(text);
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.edges).toHaveLength(1);
    });

    it('should exclude metadata when not requested', async () => {
      const options = { format: 'json' as const, includeMetadata: false };
      const blob = await exportTopologyData(mockTopology, options);

      const arrayBuffer = await blob.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      const parsed = JSON.parse(text);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
      expect(parsed.metadata).toBeUndefined();
    });

    it('should handle null topology', async () => {
      const options = { format: 'json' as const };

      await expect(exportTopologyData(null as any, options)).rejects.toThrow(
        'No topology data to export'
      );
    });
  });

  describe('validateExportOptions', () => {
    it('should validate valid options', () => {
      const options = {
        format: 'png' as const,
        width: 1920,
        height: 1080,
        quality: 0.9
      };

      const result = validateExportOptions(options);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid format', () => {
      const options = {
        format: 'invalid' as any
      };

      const result = validateExportOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Invalid export format. Supported formats: png, svg, csv, json'
      );
    });

    it('should reject invalid quality', () => {
      const options = {
        format: 'png' as const,
        quality: 1.5
      };

      const result = validateExportOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quality must be between 0.1 and 1.0');
    });

    it('should reject invalid dimensions', () => {
      const options = {
        format: 'png' as const,
        width: -100,
        height: 0
      };

      const result = validateExportOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Width must be greater than 0');
      expect(result.errors).toContain('Height must be greater than 0');
    });

    it('should require format', () => {
      const options = {} as any;

      const result = validateExportOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Export format is required');
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp', () => {
      const filename = generateFilename('test', 'png');
      
      expect(filename).toMatch(/^test_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
    });

    it('should handle different extensions', () => {
      const filename = generateFilename('network-topology', 'svg');
      
      expect(filename).toMatch(/^network-topology_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.svg$/);
    });
  });

  describe('getExportRecommendations', () => {
    it('should return presentation recommendations', () => {
      const recommendations = getExportRecommendations('presentation');
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].format).toBe('png');
      expect(recommendations[0].width).toBe(1920);
      expect(recommendations[0].height).toBe(1080);
      expect(recommendations[1].format).toBe('svg');
    });

    it('should return analysis recommendations', () => {
      const recommendations = getExportRecommendations('analysis');
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].format).toBe('csv');
      expect(recommendations[0].includeMetadata).toBe(true);
      expect(recommendations[1].format).toBe('json');
      expect(recommendations[1].includeMetadata).toBe(true);
    });

    it('should return documentation recommendations', () => {
      const recommendations = getExportRecommendations('documentation');
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].format).toBe('svg');
      expect(recommendations[1].format).toBe('png');
      expect(recommendations[1].width).toBe(1200);
      expect(recommendations[1].height).toBe(800);
    });

    it('should return sharing recommendations', () => {
      const recommendations = getExportRecommendations('sharing');
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0].format).toBe('png');
      expect(recommendations[0].width).toBe(800);
      expect(recommendations[0].height).toBe(600);
      expect(recommendations[1].format).toBe('csv');
      expect(recommendations[1].includeMetadata).toBe(false);
    });

    it('should return empty array for unknown use case', () => {
      const recommendations = getExportRecommendations('unknown' as any);
      
      expect(recommendations).toHaveLength(0);
    });
  });
});