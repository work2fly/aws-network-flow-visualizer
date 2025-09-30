# AWS Integration Testing Guide

This document provides comprehensive guidance for testing the AWS integration functionality in the AWS Network Flow Visualizer.

## Overview

The application has been restored to use the full main process with complete AWS integration capabilities. This includes:

- AWS credential management (SSO, profiles, roles)
- CloudWatch Insights query engine
- Network topology construction
- Security features and data anonymization
- Full IPC communication between main and renderer processes

## Testing Levels

### 1. Component Integration Tests (No AWS Credentials Required)

These tests validate that all AWS integration components can be initialized and basic functionality works without requiring live AWS credentials.

**How to run:**
1. Start the application: `npm run electron`
2. Click the "Debug IPC" button in the bottom-right corner
3. Click "Integration Tests" button
4. Review the test results in the debug panel

**What it tests:**
- Component initialization (AWSCredentialManager, AWSConnectionManager, etc.)
- AWS profile reading from local configuration
- Network security manager setup
- Query engine initialization
- IPC communication integrity

### 2. Real AWS Credential Tests (Requires AWS Setup)

These tests validate actual AWS connectivity and functionality with real credentials.

**Prerequisites:**
- AWS CLI installed and configured
- Valid AWS credentials (SSO, profile, or environment variables)
- Appropriate IAM permissions for CloudWatch Logs access

**How to run:**
1. Set up AWS credentials (see AWS Setup section below)
2. Start the application: `npm run electron`
3. Click the "Debug IPC" button
4. Click "Real Creds Test" button
5. Review results and check browser console for detailed report

**What it tests:**
- Credential auto-discovery
- AWS connection establishment
- CloudWatch Logs access
- Log group enumeration
- Account and region detection

### 3. Manual AWS Integration Testing

For comprehensive testing of specific AWS features:

#### SSO Authentication Testing
1. Configure AWS SSO in your environment
2. Use the SSO authentication form in the application
3. Test account and role selection
4. Verify token refresh functionality

#### Profile Authentication Testing
1. Set up AWS CLI profiles
2. Use the profile authentication form
3. Test different profile types (credentials, SSO, role assumption)
4. Verify MFA handling if configured

#### CloudWatch Insights Query Testing
1. Ensure VPC Flow Logs are enabled and flowing to CloudWatch Logs
2. Use the query interface to test VPC and TGW flow log queries
3. Test filtering and time range selection
4. Verify query cancellation and error handling

## AWS Setup Requirements

### For Basic Testing (Profile-based)

1. **Install AWS CLI:**
   ```bash
   # On Ubuntu/Debian
   sudo apt install awscli
   
   # On macOS
   brew install awscli
   
   # Or use pip
   pip install awscli
   ```

2. **Configure AWS credentials:**
   ```bash
   aws configure
   ```
   Enter your access key, secret key, region, and output format.

3. **Verify configuration:**
   ```bash
   aws sts get-caller-identity
   ```

### For SSO Testing

1. **Configure AWS SSO:**
   ```bash
   aws configure sso
   ```
   Follow the prompts to set up SSO configuration.

2. **Login to SSO:**
   ```bash
   aws sso login --profile your-sso-profile
   ```

### For Flow Log Testing

1. **Enable VPC Flow Logs:**
   - Go to AWS VPC Console
   - Select your VPC
   - Create Flow Log with CloudWatch Logs destination
   - Note the log group name

2. **Enable Transit Gateway Flow Logs (if using TGW):**
   - Go to AWS Transit Gateway Console
   - Select your Transit Gateway
   - Create Flow Log with CloudWatch Logs destination

3. **Verify IAM permissions:**
   Your credentials need the following permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "logs:DescribeLogGroups",
           "logs:StartQuery",
           "logs:StopQuery",
           "logs:GetQueryResults",
           "logs:DescribeQueries"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "sts:GetCallerIdentity"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

## Testing Scenarios

### Scenario 1: First-time Setup
1. Start application without any AWS configuration
2. Verify graceful handling of missing credentials
3. Configure AWS credentials through the UI
4. Test connection establishment

### Scenario 2: Multiple Account Access
1. Configure multiple AWS profiles
2. Test switching between profiles
3. Verify account isolation
4. Test cross-account query capabilities

### Scenario 3: SSO Workflow
1. Configure SSO authentication
2. Test browser-based login flow
3. Verify token refresh
4. Test logout and re-authentication

### Scenario 4: Query Execution
1. Select appropriate log groups
2. Execute VPC Flow Log queries
3. Test filtering and time ranges
4. Verify query cancellation
5. Test error handling for invalid queries

### Scenario 5: Network Topology Construction
1. Execute flow log queries
2. Build network topology from results
3. Verify node and edge creation
4. Test topology visualization

## Troubleshooting

### Common Issues

1. **"No AWS configuration found"**
   - Ensure AWS CLI is installed and configured
   - Check `~/.aws/config` and `~/.aws/credentials` files exist
   - Verify environment variables if using them

2. **"Access Denied" errors**
   - Check IAM permissions for CloudWatch Logs
   - Verify the correct region is selected
   - Ensure credentials haven't expired

3. **SSO authentication failures**
   - Check SSO configuration in `~/.aws/config`
   - Ensure SSO session is active: `aws sso login`
   - Verify browser can access SSO URLs

4. **Query timeouts or failures**
   - Check log group names are correct
   - Verify time ranges aren't too large
   - Ensure flow logs are actually being generated

### Debug Information

The application provides extensive debug information:

1. **IPC Debug Panel:** Shows real-time IPC communication status
2. **Browser Console:** Contains detailed error messages and API responses
3. **Integration Test Reports:** Comprehensive component testing results
4. **Network Security Logs:** Shows all AWS API calls and responses

### Log Locations

- **Application logs:** Check browser console in development mode
- **AWS CLI logs:** `~/.aws/cli/cache/` and `~/.aws/sso/cache/`
- **System logs:** Platform-specific locations for Electron apps

## Performance Considerations

### Large Dataset Handling
- Queries are limited to 10,000 records by default
- Use time range filtering to reduce dataset size
- Consider pagination for very large result sets

### Memory Usage
- Monitor memory usage with large topologies
- Use data sampling for visualization of large networks
- Clear cached data periodically

### Network Efficiency
- Queries are cached to reduce API calls
- Connection pooling is used for AWS SDK clients
- Certificate pinning ensures secure connections

## Security Validation

The application includes several security features that should be tested:

1. **Credential Security:**
   - Credentials are stored securely using OS keychain
   - No credentials are logged or transmitted to external services
   - Automatic credential cleanup on application exit

2. **Network Security:**
   - All AWS connections use HTTPS with certificate validation
   - No external connections except to AWS APIs
   - Request logging for security auditing

3. **Data Privacy:**
   - All data processing occurs locally
   - Optional data anonymization for exports
   - No telemetry or analytics collection

## Continuous Integration

For automated testing in CI/CD environments:

1. **Mock Testing:** Use the component integration tests
2. **Credential Testing:** Use AWS credentials from environment variables
3. **Performance Testing:** Include memory and query performance benchmarks
4. **Security Testing:** Validate no external connections except AWS APIs

## Conclusion

The AWS integration has been fully restored and tested. The application now provides:

- Complete AWS authentication support (SSO, profiles, roles)
- Full CloudWatch Insights integration
- Comprehensive error handling and user feedback
- Security-focused design with local data processing
- Extensive testing and debugging capabilities

Users can now proceed with real AWS integration testing using their own credentials and flow log data.