import { createHash } from 'crypto';

export interface AnonymizationOptions {
  preserveStructure?: boolean;
  hashSalt?: string;
  anonymizeIPs?: boolean;
  anonymizeAccountIds?: boolean;
  anonymizeInstanceIds?: boolean;
  anonymizeVpcIds?: boolean;
  anonymizeSubnetIds?: boolean;
  anonymizeSecurityGroupIds?: boolean;
  anonymizeTransitGatewayIds?: boolean;
  anonymizeUsernames?: boolean;
  anonymizeRoleNames?: boolean;
  customPatterns?: Array<{
    pattern: RegExp;
    replacement: string | ((match: string) => string);
  }>;
}

export interface AnonymizedData {
  originalData: any;
  anonymizedData: any;
  mappings: Record<string, string>;
}

/**
 * Data anonymization utility for protecting sensitive information
 * in exports, screenshots, and logs
 */
export class DataAnonymizer {
  private readonly options: Required<Omit<AnonymizationOptions, 'customPatterns'>> & {
    customPatterns: AnonymizationOptions['customPatterns'];
  };
  private readonly mappings: Map<string, string> = new Map();
  private readonly hashSalt: string;

  // Common AWS patterns
  private readonly AWS_PATTERNS = {
    // IP addresses (IPv4 and IPv6)
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    
    // AWS Account IDs (12 digits)
    accountId: /\b\d{12}\b/g,
    
    // AWS Resource IDs
    instanceId: /\bi-[0-9a-f]{8,17}\b/g,
    vpcId: /\bvpc-[0-9a-f]{8,17}\b/g,
    subnetId: /\bsubnet-[0-9a-f]{8,17}\b/g,
    securityGroupId: /\bsg-[0-9a-f]{8,17}\b/g,
    routeTableId: /\brtb-[0-9a-f]{8,17}\b/g,
    internetGatewayId: /\bigw-[0-9a-f]{8,17}\b/g,
    natGatewayId: /\bnat-[0-9a-f]{8,17}\b/g,
    transitGatewayId: /\btgw-[0-9a-f]{8,17}\b/g,
    vpnConnectionId: /\bvpn-[0-9a-f]{8,17}\b/g,
    vpnGatewayId: /\bvgw-[0-9a-f]{8,17}\b/g,
    
    // IAM resources (more specific patterns - only match the role/user name part)
    roleName: /(?<=arn:aws:iam::\d{12}:role\/)([a-zA-Z0-9+=,.@_-]+)\b/g,
    userName: /(?<=arn:aws:iam::\d{12}:user\/)([a-zA-Z0-9+=,.@_-]+)\b/g,
    
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // Domain names
    domain: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g
  };

  constructor(options: AnonymizationOptions = {}) {
    this.hashSalt = options.hashSalt || 'aws-network-flow-visualizer-salt';
    this.options = {
      preserveStructure: options.preserveStructure ?? true,
      hashSalt: this.hashSalt,
      anonymizeIPs: options.anonymizeIPs ?? true,
      anonymizeAccountIds: options.anonymizeAccountIds ?? true,
      anonymizeInstanceIds: options.anonymizeInstanceIds ?? true,
      anonymizeVpcIds: options.anonymizeVpcIds ?? true,
      anonymizeSubnetIds: options.anonymizeSubnetIds ?? true,
      anonymizeSecurityGroupIds: options.anonymizeSecurityGroupIds ?? true,
      anonymizeTransitGatewayIds: options.anonymizeTransitGatewayIds ?? true,
      anonymizeUsernames: options.anonymizeUsernames ?? false,
      anonymizeRoleNames: options.anonymizeRoleNames ?? false,
      customPatterns: options.customPatterns || []
    };
  }

  /**
   * Anonymize data while preserving structure
   */
  anonymizeData(data: any): AnonymizedData {
    this.mappings.clear();
    
    const anonymizedData = this.processValue(data, new WeakSet());
    
    return {
      originalData: data,
      anonymizedData,
      mappings: Object.fromEntries(this.mappings)
    };
  }

  /**
   * Anonymize text content
   */
  anonymizeText(text: string): string {
    let anonymizedText = text;

    // Apply AWS pattern anonymization
    if (this.options.anonymizeIPs) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.ipv4, 'ip');
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.ipv6, 'ipv6');
    }

    if (this.options.anonymizeAccountIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.accountId, 'account');
    }

    if (this.options.anonymizeInstanceIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.instanceId, 'instance');
    }

    if (this.options.anonymizeVpcIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.vpcId, 'vpc');
    }

    if (this.options.anonymizeSubnetIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.subnetId, 'subnet');
    }

    if (this.options.anonymizeSecurityGroupIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.securityGroupId, 'sg');
    }

    if (this.options.anonymizeTransitGatewayIds) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.transitGatewayId, 'tgw');
    }

    if (this.options.anonymizeUsernames) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.userName, 'user');
    }

    if (this.options.anonymizeRoleNames) {
      anonymizedText = this.anonymizePattern(anonymizedText, this.AWS_PATTERNS.roleName, 'role');
    }

    // Apply custom patterns
    if (this.options.customPatterns) {
      for (const customPattern of this.options.customPatterns) {
        if (typeof customPattern.replacement === 'string') {
          anonymizedText = anonymizedText.replace(customPattern.pattern, customPattern.replacement);
        } else {
          anonymizedText = anonymizedText.replace(customPattern.pattern, customPattern.replacement);
        }
      }
    }

    return anonymizedText;
  }

  /**
   * Anonymize network topology data
   */
  anonymizeNetworkTopology(topology: any): any {
    return this.processValue(topology);
  }

  /**
   * Anonymize flow log records
   */
  anonymizeFlowLogs(flowLogs: any[]): any[] {
    return flowLogs.map(log => this.processValue(log));
  }

  /**
   * Create anonymization mapping for consistent replacement
   */
  createMapping(original: string, prefix: string): string {
    if (this.mappings.has(original)) {
      return this.mappings.get(original)!;
    }

    let anonymized: string;
    
    if (this.options.preserveStructure) {
      // Generate consistent hash-based replacement
      const hash = this.generateHash(original);
      anonymized = this.generateStructuredReplacement(original, prefix, hash);
    } else {
      // Simple sequential replacement
      const count = Array.from(this.mappings.values()).filter(v => v.startsWith(prefix)).length + 1;
      anonymized = `${prefix}-${count.toString().padStart(3, '0')}`;
    }

    this.mappings.set(original, anonymized);
    return anonymized;
  }

  /**
   * Get anonymization mappings
   */
  getMappings(): Record<string, string> {
    return Object.fromEntries(this.mappings);
  }

  /**
   * Clear anonymization mappings
   */
  clearMappings(): void {
    this.mappings.clear();
  }

  /**
   * Export anonymization mappings
   */
  exportMappings(): string {
    const mappings = Object.fromEntries(this.mappings);
    return JSON.stringify(mappings, null, 2);
  }

  /**
   * Import anonymization mappings
   */
  importMappings(mappingsJson: string): void {
    try {
      const mappings = JSON.parse(mappingsJson);
      this.mappings.clear();
      for (const [key, value] of Object.entries(mappings)) {
        this.mappings.set(key, value as string);
      }
    } catch (error) {
      throw new Error(`Failed to import mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process any value recursively with circular reference detection
   */
  private processValue(value: any, visited: WeakSet<object> = new WeakSet()): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.anonymizeText(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      if (visited.has(value)) {
        return '[Circular Reference]';
      }
      visited.add(value);
      const result = value.map(item => this.processValue(item, visited));
      visited.delete(value);
      return result;
    }

    if (typeof value === 'object') {
      if (visited.has(value)) {
        return '[Circular Reference]';
      }
      visited.add(value);
      
      const result: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Only anonymize keys if they look like sensitive data
        const anonymizedKey = this.shouldAnonymizeKey(key) ? this.anonymizeText(key) : key;
        result[anonymizedKey] = this.processValue(val, visited);
      }
      
      visited.delete(value);
      return result;
    }

    return value;
  }

  /**
   * Check if a key should be anonymized
   */
  private shouldAnonymizeKey(key: string): boolean {
    // Only anonymize keys that look like sensitive data
    const sensitiveKeyPatterns = [
      /.*id$/i,
      /.*key$/i,
      /.*token$/i,
      /.*secret$/i,
      /.*password$/i,
      /.*credential$/i
    ];
    
    return sensitiveKeyPatterns.some(pattern => pattern.test(key)) &&
           (this.AWS_PATTERNS.instanceId.test(key) ||
            this.AWS_PATTERNS.vpcId.test(key) ||
            this.AWS_PATTERNS.subnetId.test(key) ||
            this.AWS_PATTERNS.securityGroupId.test(key) ||
            this.AWS_PATTERNS.accountId.test(key));
  }

  /**
   * Anonymize text using a specific pattern
   */
  private anonymizePattern(text: string, pattern: RegExp, prefix: string): string {
    return text.replace(pattern, (match) => {
      return this.createMapping(match, prefix);
    });
  }

  /**
   * Generate hash for consistent anonymization
   */
  private generateHash(input: string): string {
    return createHash('sha256')
      .update(input + this.hashSalt)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Generate structured replacement that preserves format
   */
  private generateStructuredReplacement(original: string, prefix: string, hash: string): string {
    // For AWS resource IDs, preserve the format
    if (original.match(/^i-[0-9a-f]+$/)) {
      return `i-${hash}`;
    }
    if (original.match(/^vpc-[0-9a-f]+$/)) {
      return `vpc-${hash}`;
    }
    if (original.match(/^subnet-[0-9a-f]+$/)) {
      return `subnet-${hash}`;
    }
    if (original.match(/^sg-[0-9a-f]+$/)) {
      return `sg-${hash}`;
    }
    if (original.match(/^tgw-[0-9a-f]+$/)) {
      return `tgw-${hash}`;
    }

    // For IP addresses, preserve the format
    if (original.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const hashNum = parseInt(hash.substring(0, 6), 16);
      const octet1 = 10; // Use private IP range
      const octet2 = (hashNum >> 16) & 0xFF;
      const octet3 = (hashNum >> 8) & 0xFF;
      const octet4 = hashNum & 0xFF;
      return `${octet1}.${octet2}.${octet3}.${octet4}`;
    }

    // For account IDs, preserve 12-digit format
    if (original.match(/^\d{12}$/)) {
      const hashNum = parseInt(hash, 16);
      return hashNum.toString().padStart(12, '0').substring(0, 12);
    }

    // Default format
    return `${prefix}-${hash}`;
  }
}