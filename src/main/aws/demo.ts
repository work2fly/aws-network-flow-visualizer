/**
 * Demo script to test AWS credential management functionality
 * This file demonstrates the usage of the credential management system
 */

import { AWSConnectionManager } from './connection-manager';

async function demonstrateCredentialManagement() {
  console.log('🚀 AWS Credential Management Demo');
  console.log('================================');

  const connectionManager = new AWSConnectionManager();

  // Test 1: Check if AWS config exists
  console.log('\n1. Checking for AWS configuration...');
  const hasConfig = connectionManager.hasAWSConfig();
  console.log(`   AWS config exists: ${hasConfig}`);

  // Test 2: Get available profiles
  console.log('\n2. Getting available AWS profiles...');
  try {
    const profiles = await connectionManager.getAvailableProfiles();
    console.log(`   Found ${profiles.length} profiles:`, profiles);
  } catch (error) {
    console.log('   Error getting profiles:', error);
  }

  // Test 3: Get available regions
  console.log('\n3. Getting available AWS regions...');
  const regions = await connectionManager.getAvailableRegions();
  console.log(`   Available regions (first 5): ${regions.slice(0, 5).join(', ')}...`);

  // Test 4: Test auto-discovery
  console.log('\n4. Testing credential auto-discovery...');
  try {
    const result = await connectionManager.initializeWithAutoDiscovery();
    if (result.valid) {
      console.log('   ✅ Auto-discovery successful!');
      console.log(`   Account ID: ${result.accountId}`);
      console.log(`   Region: ${result.region}`);
      console.log(`   Credential Type: ${result.credentialType}`);

      // Test connection
      const connectionStatus = await connectionManager.testConnection();
      console.log(`   Connection status: ${connectionStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
    } else {
      console.log('   ❌ Auto-discovery failed:', result.error);
    }
  } catch (error) {
    console.log('   ❌ Auto-discovery error:', error);
  }

  // Test 5: Test credential expiration check
  console.log('\n5. Checking credential expiration...');
  const isExpired = connectionManager.areCredentialsExpired();
  console.log(`   Credentials expired: ${isExpired}`);

  // Test 6: Get current credentials info
  console.log('\n6. Current credentials info...');
  const currentCreds = connectionManager.getCurrentCredentials();
  if (currentCreds) {
    console.log('   ✅ Credentials loaded');
    console.log(`   Region: ${currentCreds.region}`);
    console.log(`   Profile: ${currentCreds.profile || 'N/A'}`);
    console.log(`   Expiration: ${currentCreds.expiration || 'N/A'}`);
  } else {
    console.log('   ❌ No credentials loaded');
  }

  console.log('\n🎉 Demo completed!');
}

// Export for potential use in tests or other modules
export { demonstrateCredentialManagement };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateCredentialManagement().catch(console.error);
}