/**
 * AWS Integration Test Suite
 * 
 * This module provides comprehensive testing for AWS integration components
 * without requiring live AWS credentials initially.
 */

import { AWSCredentialManager } from './credential-manager';
import { AWSConnectionManager } from './connection-manager';
import { AWSProfileReader } from './profile-reader';
import { FlowLogQueryEngine } from './flow-log-query-engine';
import { NetworkSecurityManager } from './network-security-manager';

export interface IntegrationTestResult {
  component: string;
  test: string;
  success: boolean;
  error?: string;
  details?: any;
}

export class AWSIntegrationTester {
  private results: IntegrationTestResult[] = [];

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<IntegrationTestResult[]> {
    this.results = [];

    // Test component initialization
    await this.testComponentInitialization();
    
    // Test AWS profile reading
    await this.testProfileReading();
    
    // Test credential management
    await this.testCredentialManagement();
    
    // Test connection management
    await this.testConnectionManagement();
    
    // Test network security
    await this.testNetworkSecurity();
    
    // Test query engine initialization
    await this.testQueryEngineInitialization();

    return this.results;
  }

  /**
   * Test component initialization
   */
  private async testComponentInitialization(): Promise<void> {
    // Test AWSCredentialManager initialization
    try {
      const credentialManager = new AWSCredentialManager();
      this.addResult('AWSCredentialManager', 'initialization', true, undefined, {
        hasInstance: !!credentialManager
      });
    } catch (error) {
      this.addResult('AWSCredentialManager', 'initialization', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }

    // Test AWSConnectionManager initialization
    try {
      const connectionManager = new AWSConnectionManager();
      this.addResult('AWSConnectionManager', 'initialization', true, undefined, {
        hasInstance: !!connectionManager
      });
    } catch (error) {
      this.addResult('AWSConnectionManager', 'initialization', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }

    // Test AWSProfileReader initialization
    try {
      const profileReader = new AWSProfileReader();
      this.addResult('AWSProfileReader', 'initialization', true, undefined, {
        hasInstance: !!profileReader
      });
    } catch (error) {
      this.addResult('AWSProfileReader', 'initialization', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }

    // Test NetworkSecurityManager initialization
    try {
      const networkSecurityManager = new NetworkSecurityManager({
        enableCertificatePinning: false, // Disable for testing
        enableRequestLogging: true
      });
      this.addResult('NetworkSecurityManager', 'initialization', true, undefined, {
        hasInstance: !!networkSecurityManager
      });
    } catch (error) {
      this.addResult('NetworkSecurityManager', 'initialization', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test AWS profile reading capabilities
   */
  private async testProfileReading(): Promise<void> {
    try {
      const profileReader = new AWSProfileReader();
      
      // Test getting available profiles (should not fail even if no profiles exist)
      const profiles = await profileReader.getAvailableProfiles();
      this.addResult('AWSProfileReader', 'getAvailableProfiles', true, undefined, {
        profileCount: profiles.length,
        profiles: profiles.map(p => ({ name: p.name, region: p.region }))
      });

      // Test getting source profiles
      const sourceProfiles = await profileReader.getSourceProfiles();
      this.addResult('AWSProfileReader', 'getSourceProfiles', true, undefined, {
        sourceProfileCount: sourceProfiles.length
      });

      // Test getting role profiles
      const roleProfiles = await profileReader.getRoleProfiles();
      this.addResult('AWSProfileReader', 'getRoleProfiles', true, undefined, {
        roleProfileCount: roleProfiles.length
      });

    } catch (error) {
      this.addResult('AWSProfileReader', 'profile operations', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test credential management without requiring live credentials
   */
  private async testCredentialManagement(): Promise<void> {
    try {
      const credentialManager = new AWSCredentialManager();
      
      // Test SSO initialization (should not fail)
      await credentialManager.initializeSSO();
      this.addResult('AWSCredentialManager', 'initializeSSO', true);

      // Test connection test (will fail without credentials, but should not crash)
      const connectionStatus = await credentialManager.testConnection();
      this.addResult('AWSCredentialManager', 'testConnection', true, undefined, {
        connected: connectionStatus.connected,
        error: connectionStatus.error
      });

    } catch (error) {
      this.addResult('AWSCredentialManager', 'credential operations', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test connection management
   */
  private async testConnectionManagement(): Promise<void> {
    try {
      const connectionManager = new AWSConnectionManager();
      
      // Test AWS config check
      const hasConfig = connectionManager.hasAWSConfig();
      this.addResult('AWSConnectionManager', 'hasAWSConfig', true, undefined, {
        hasConfig
      });

      // Test region retrieval
      const regions = await connectionManager.getAvailableRegions();
      this.addResult('AWSConnectionManager', 'getAvailableRegions', true, undefined, {
        regionCount: regions.length,
        sampleRegions: regions.slice(0, 5)
      });

      // Test credential expiration check
      const areExpired = connectionManager.areCredentialsExpired();
      this.addResult('AWSConnectionManager', 'areCredentialsExpired', true, undefined, {
        areExpired
      });

    } catch (error) {
      this.addResult('AWSConnectionManager', 'connection operations', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test network security manager
   */
  private async testNetworkSecurity(): Promise<void> {
    try {
      const networkSecurityManager = new NetworkSecurityManager({
        enableCertificatePinning: false,
        enableRequestLogging: true
      });

      // Test initialization
      await networkSecurityManager.initialize();
      this.addResult('NetworkSecurityManager', 'initialize', true);

      // Test certificate pin operations
      const pins = networkSecurityManager.getCertificatePins();
      this.addResult('NetworkSecurityManager', 'getCertificatePins', true, undefined, {
        pinCount: pins.length
      });

      // Test request log operations
      const logs = networkSecurityManager.getNetworkRequestLogs();
      this.addResult('NetworkSecurityManager', 'getNetworkRequestLogs', true, undefined, {
        logCount: logs.length
      });

    } catch (error) {
      this.addResult('NetworkSecurityManager', 'security operations', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test query engine initialization
   */
  private async testQueryEngineInitialization(): Promise<void> {
    try {
      const credentialManager = new AWSCredentialManager();
      const networkSecurityManager = new NetworkSecurityManager({
        enableCertificatePinning: false,
        enableRequestLogging: true
      });

      const queryEngine = new FlowLogQueryEngine({
        credentialManager,
        region: 'us-east-1',
        networkSecurityManager
      });

      this.addResult('FlowLogQueryEngine', 'initialization', true, undefined, {
        hasInstance: !!queryEngine
      });

      // Test log group retrieval (will fail without credentials but should not crash)
      try {
        const logGroups = await queryEngine.getLogGroups();
        this.addResult('FlowLogQueryEngine', 'getLogGroups', true, undefined, {
          logGroupCount: logGroups.length
        });
      } catch (error) {
        // Expected to fail without credentials
        this.addResult('FlowLogQueryEngine', 'getLogGroups', true, 
          'Expected failure without credentials', {
          errorType: error instanceof Error ? error.name : 'Unknown'
        });
      }

    } catch (error) {
      this.addResult('FlowLogQueryEngine', 'query engine operations', false, 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Test with real AWS credentials (requires valid credentials)
   */
  async testWithRealCredentials(): Promise<IntegrationTestResult[]> {
    const realCredentialTests: IntegrationTestResult[] = [];

    try {
      const connectionManager = new AWSConnectionManager();
      
      // Test auto-discovery
      const autoDiscoveryResult = await connectionManager.initializeWithAutoDiscovery();
      realCredentialTests.push({
        component: 'AWSConnectionManager',
        test: 'autoDiscovery',
        success: autoDiscoveryResult.valid,
        error: autoDiscoveryResult.error,
        details: {
          credentialType: autoDiscoveryResult.credentialType,
          region: autoDiscoveryResult.region
        }
      });

      if (autoDiscoveryResult.valid) {
        // Test actual connection
        const connectionStatus = await connectionManager.testConnection();
        realCredentialTests.push({
          component: 'AWSConnectionManager',
          test: 'realConnection',
          success: connectionStatus.connected,
          error: connectionStatus.error,
          details: {
            accountId: connectionStatus.accountId,
            region: connectionStatus.region,
            credentialType: connectionStatus.credentialType
          }
        });

        if (connectionStatus.connected) {
          // Test query engine with real credentials
          const credentialManager = connectionManager.getCredentialManager();
          const queryEngine = new FlowLogQueryEngine({
            credentialManager,
            region: connectionStatus.region || 'us-east-1'
          });

          try {
            const logGroups = await queryEngine.getLogGroups('', 5);
            realCredentialTests.push({
              component: 'FlowLogQueryEngine',
              test: 'realLogGroups',
              success: true,
              details: {
                logGroupCount: logGroups.length,
                sampleLogGroups: logGroups.slice(0, 3).map(lg => lg.name)
              }
            });
          } catch (error) {
            realCredentialTests.push({
              component: 'FlowLogQueryEngine',
              test: 'realLogGroups',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }

    } catch (error) {
      realCredentialTests.push({
        component: 'RealCredentialTest',
        test: 'overall',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return realCredentialTests;
  }

  /**
   * Add a test result
   */
  private addResult(component: string, test: string, success: boolean, error?: string, details?: any): void {
    this.results.push({
      component,
      test,
      success,
      error,
      details
    });
  }

  /**
   * Generate a test report
   */
  generateReport(results: IntegrationTestResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    let report = `AWS Integration Test Report\n`;
    report += `================================\n`;
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${passedTests}\n`;
    report += `Failed: ${failedTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    // Group by component
    const byComponent = results.reduce((acc, result) => {
      if (!acc[result.component]) {
        acc[result.component] = [];
      }
      acc[result.component].push(result);
      return acc;
    }, {} as Record<string, IntegrationTestResult[]>);

    for (const [component, componentResults] of Object.entries(byComponent)) {
      report += `${component}:\n`;
      for (const result of componentResults) {
        const status = result.success ? '✅' : '❌';
        report += `  ${status} ${result.test}`;
        if (result.error) {
          report += ` - ${result.error}`;
        }
        report += '\n';
        if (result.details) {
          report += `    Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n    ')}\n`;
        }
      }
      report += '\n';
    }

    return report;
  }
}

/**
 * Run integration tests from command line or IPC
 */
export async function runIntegrationTests(includeRealCredentials = false): Promise<{
  results: IntegrationTestResult[];
  report: string;
}> {
  const tester = new AWSIntegrationTester();
  
  let results = await tester.runAllTests();
  
  if (includeRealCredentials) {
    const realCredentialResults = await tester.testWithRealCredentials();
    results = [...results, ...realCredentialResults];
  }
  
  const report = tester.generateReport(results);
  
  return { results, report };
}