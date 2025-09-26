import { DataAnonymizer, AnonymizationOptions } from '../data-anonymizer';

describe('DataAnonymizer', () => {
  let anonymizer: DataAnonymizer;

  beforeEach(() => {
    anonymizer = new DataAnonymizer({
      preserveStructure: true,
      hashSalt: 'test-salt'
    });
  });

  describe('IP address anonymization', () => {
    it('should anonymize IPv4 addresses', () => {
      const text = 'Server at 192.168.1.100 is responding';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('192.168.1.100');
      expect(result).toMatch(/Server at 10\.\d+\.\d+\.\d+ is responding/);
    });

    it('should anonymize multiple IP addresses consistently', () => {
      const text1 = 'Connection from 192.168.1.100';
      const text2 = 'Response to 192.168.1.100';
      
      const result1 = anonymizer.anonymizeText(text1);
      const result2 = anonymizer.anonymizeText(text2);
      
      // Extract the anonymized IP from both results
      const ip1Match = result1.match(/10\.\d+\.\d+\.\d+/);
      const ip2Match = result2.match(/10\.\d+\.\d+\.\d+/);
      
      expect(ip1Match).toBeTruthy();
      expect(ip2Match).toBeTruthy();
      expect(ip1Match![0]).toBe(ip2Match![0]);
    });

    it('should handle IPv6 addresses', () => {
      const text = 'IPv6 address: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(result).toContain('IPv6 address: ip');
    });
  });

  describe('AWS resource ID anonymization', () => {
    it('should anonymize instance IDs', () => {
      const text = 'Instance i-1234567890abcdef0 is running';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('i-1234567890abcdef0');
      expect(result).toMatch(/Instance i-[0-9a-f]{8} is running/);
    });

    it('should anonymize VPC IDs', () => {
      const text = 'VPC vpc-12345678 configuration';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('vpc-12345678');
      expect(result).toMatch(/VPC vpc-[0-9a-f]{8} configuration/);
    });

    it('should anonymize subnet IDs', () => {
      const text = 'Subnet subnet-abcdef12 details';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('subnet-abcdef12');
      expect(result).toMatch(/Subnet subnet-[0-9a-f]{8} details/);
    });

    it('should anonymize security group IDs', () => {
      const text = 'Security group sg-1a2b3c4d rules';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('sg-1a2b3c4d');
      expect(result).toMatch(/Security group sg-[0-9a-f]{8} rules/);
    });

    it('should anonymize Transit Gateway IDs', () => {
      const text = 'Transit Gateway tgw-0123456789abcdef0';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('tgw-0123456789abcdef0');
      expect(result).toMatch(/Transit Gateway tgw-[0-9a-f]{8}/);
    });
  });

  describe('AWS account ID anonymization', () => {
    it('should anonymize 12-digit account IDs', () => {
      const text = 'Account 123456789012 resources';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('123456789012');
      expect(result).toMatch(/Account \d{12} resources/);
    });

    it('should preserve account ID format', () => {
      const text = 'arn:aws:iam::123456789012:role/MyRole';
      const result = anonymizer.anonymizeText(text);
      
      expect(result).not.toContain('123456789012');
      expect(result).toMatch(/arn:aws:iam::\d{12}:role\/role-[0-9a-f]{8}/);
    });
  });

  describe('structured data anonymization', () => {
    it('should anonymize nested objects', () => {
      const data = {
        vpc: {
          id: 'vpc-12345678',
          cidr: '10.0.0.0/16',
          instances: [
            {
              id: 'i-1234567890abcdef0',
              privateIp: '10.0.1.100',
              publicIp: '203.0.113.1'
            }
          ]
        },
        account: '123456789012'
      };

      const result = anonymizer.anonymizeData(data);
      
      expect(result.anonymizedData.vpc.id).not.toBe('vpc-12345678');
      expect(result.anonymizedData.vpc.instances[0].id).not.toBe('i-1234567890abcdef0');
      expect(result.anonymizedData.vpc.instances[0].privateIp).not.toBe('10.0.1.100');
      expect(result.anonymizedData.account).not.toBe('123456789012');
      
      // Check that structure is preserved
      expect(result.anonymizedData.vpc.cidr).toBe('10.0.0.0/16');
      expect(Array.isArray(result.anonymizedData.vpc.instances)).toBe(true);
    });

    it('should handle arrays', () => {
      const data = [
        { instanceId: 'i-1234567890abcdef0' },
        { instanceId: 'i-abcdef1234567890' }
      ];

      const result = anonymizer.anonymizeData(data);
      
      expect(Array.isArray(result.anonymizedData)).toBe(true);
      expect(result.anonymizedData[0].instanceId).not.toBe('i-1234567890abcdef0');
      expect(result.anonymizedData[1].instanceId).not.toBe('i-abcdef1234567890');
    });

    it('should preserve non-sensitive data', () => {
      const data = {
        timestamp: new Date('2023-01-01T12:00:00Z'),
        count: 42,
        enabled: true,
        description: 'Test description',
        tags: {
          Environment: 'production',
          Team: 'networking'
        }
      };

      const result = anonymizer.anonymizeData(data);
      
      expect(result.anonymizedData.timestamp).toEqual(data.timestamp);
      expect(result.anonymizedData.count).toBe(42);
      expect(result.anonymizedData.enabled).toBe(true);
      expect(result.anonymizedData.description).toBe('Test description');
      expect(result.anonymizedData.tags.Environment).toBe('production');
    });
  });

  describe('flow log anonymization', () => {
    it('should anonymize flow log records', () => {
      const flowLogs = [
        {
          timestamp: new Date(),
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          sourcePort: 80,
          destinationPort: 443,
          protocol: 'tcp',
          action: 'ACCEPT',
          accountId: '123456789012',
          vpcId: 'vpc-12345678',
          instanceId: 'i-1234567890abcdef0'
        }
      ];

      const result = anonymizer.anonymizeFlowLogs(flowLogs);
      
      expect(result[0].sourceIP).not.toBe('10.0.1.100');
      expect(result[0].destinationIP).not.toBe('10.0.2.200');
      expect(result[0].accountId).not.toBe('123456789012');
      expect(result[0].vpcId).not.toBe('vpc-12345678');
      expect(result[0].instanceId).not.toBe('i-1234567890abcdef0');
      
      // Preserve non-sensitive fields
      expect(result[0].sourcePort).toBe(80);
      expect(result[0].destinationPort).toBe(443);
      expect(result[0].protocol).toBe('tcp');
      expect(result[0].action).toBe('ACCEPT');
    });
  });

  describe('custom patterns', () => {
    it('should apply custom anonymization patterns', () => {
      const customAnonymizer = new DataAnonymizer({
        customPatterns: [
          {
            pattern: /SECRET-\w+/g,
            replacement: 'SECRET-REDACTED'
          },
          {
            pattern: /API-KEY-(\w+)/g,
            replacement: (match) => `API-KEY-${match.split('-')[2].substring(0, 4)}****`
          }
        ]
      });

      const text = 'Using SECRET-abc123 and API-KEY-xyz789def for authentication';
      const result = customAnonymizer.anonymizeText(text);
      
      expect(result).toContain('SECRET-REDACTED');
      expect(result).toContain('API-KEY-xyz7****');
    });
  });

  describe('mapping management', () => {
    it('should provide consistent mappings', () => {
      const text1 = 'Instance i-1234567890abcdef0';
      const text2 = 'Same instance i-1234567890abcdef0';
      
      anonymizer.anonymizeText(text1);
      anonymizer.anonymizeText(text2);
      
      const mappings = anonymizer.getMappings();
      expect(mappings['i-1234567890abcdef0']).toBeDefined();
    });

    it('should export and import mappings', () => {
      const text = 'VPC vpc-12345678 and instance i-1234567890abcdef0';
      anonymizer.anonymizeText(text);
      
      const exported = anonymizer.exportMappings();
      const mappings = JSON.parse(exported);
      
      expect(mappings['vpc-12345678']).toBeDefined();
      expect(mappings['i-1234567890abcdef0']).toBeDefined();
      
      // Test import
      const newAnonymizer = new DataAnonymizer();
      newAnonymizer.importMappings(exported);
      
      const newMappings = newAnonymizer.getMappings();
      expect(newMappings['vpc-12345678']).toBe(mappings['vpc-12345678']);
    });

    it('should clear mappings', () => {
      anonymizer.anonymizeText('Instance i-1234567890abcdef0');
      expect(Object.keys(anonymizer.getMappings())).toHaveLength(1);
      
      anonymizer.clearMappings();
      expect(Object.keys(anonymizer.getMappings())).toHaveLength(0);
    });
  });

  describe('configuration options', () => {
    it('should respect anonymization flags', () => {
      const selectiveAnonymizer = new DataAnonymizer({
        anonymizeIPs: false,
        anonymizeAccountIds: true,
        anonymizeInstanceIds: false
      });

      const text = 'IP 192.168.1.1, account 123456789012, instance i-1234567890abcdef0';
      const result = selectiveAnonymizer.anonymizeText(text);
      
      expect(result).toContain('192.168.1.1'); // IP not anonymized
      expect(result).not.toContain('123456789012'); // Account anonymized
      expect(result).toContain('i-1234567890abcdef0'); // Instance not anonymized
    });

    it('should handle structure preservation setting', () => {
      const nonStructuralAnonymizer = new DataAnonymizer({
        preserveStructure: false
      });

      const text1 = 'Instance i-1234567890abcdef0';
      const text2 = 'Instance i-abcdef1234567890';
      
      const result1 = nonStructuralAnonymizer.anonymizeText(text1);
      const result2 = nonStructuralAnonymizer.anonymizeText(text2);
      
      // Should use sequential numbering instead of hash-based
      expect(result1).toMatch(/Instance instance-\d{3}/);
      expect(result2).toMatch(/Instance instance-\d{3}/);
    });
  });

  describe('error handling', () => {
    it('should handle invalid mapping JSON', () => {
      expect(() => {
        anonymizer.importMappings('invalid json');
      }).toThrow('Failed to import mappings');
    });

    it('should handle null and undefined values', () => {
      const data = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroNumber: 0
      };

      const result = anonymizer.anonymizeData(data);
      
      expect(result.anonymizedData.nullValue).toBeNull();
      expect(result.anonymizedData.undefinedValue).toBeUndefined();
      expect(result.anonymizedData.emptyString).toBe('');
      expect(result.anonymizedData.zeroNumber).toBe(0);
    });

    it('should handle circular references gracefully', () => {
      const data: any = { name: 'test' };
      data.circular = data;

      // Should not throw error, but may not preserve circular structure
      expect(() => {
        anonymizer.anonymizeData(data);
      }).not.toThrow();
    });
  });
});