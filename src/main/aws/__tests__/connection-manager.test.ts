import { AWSConnectionManager } from '../connection-manager';
import { AWSCredentialManager } from '../credential-manager';
import { AWSProfileReader } from '../profile-reader';
import { SSOConfig } from '../../../shared/types';

// Mock the dependencies
jest.mock('../credential-manager');
jest.mock('../profile-reader');

const MockedCredentialManager = AWSCredentialManager as jest.MockedClass<typeof AWSCredentialManager>;
const MockedProfileReader = AWSProfileReader as jest.MockedClass<typeof AWSProfileReader>;

describe('AWSConnectionManager', () => {
  let connectionManager: AWSConnectionManager;
  let mockCredentialManager: jest.Mocked<AWSCredentialManager>;
  let mockProfileReader: jest.Mocked<AWSProfileReader>;

  beforeEach(() => {
    // Create mocked instances
    mockCredentialManager = {
      authenticateWithSSO: jest.fn(),
      authenticateWithProfile: jest.fn(),
      authenticateWithRole: jest.fn(),
      testConnection: jest.fn(),
      refreshCredentials: jest.fn(),
      getCurrentCredentials: jest.fn(),
      areCredentialsExpired: jest.fn(),
      clearCredentials: jest.fn(),
      getSTSClient: jest.fn(),
      initializeWithCredentialChain: jest.fn(),
    } as any;

    mockProfileReader = {
      getAvailableProfiles: jest.fn(),
      getProfile: jest.fn(),
      validateProfile: jest.fn(),
      hasAWSConfig: jest.fn(),
      getAvailableRegions: jest.fn(),
    } as any;

    // Mock the constructors to return our mocked instances
    MockedCredentialManager.mockImplementation(() => mockCredentialManager);
    MockedProfileReader.mockImplementation(() => mockProfileReader);

    connectionManager = new AWSConnectionManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateWithSSO', () => {
    it('should successfully authenticate with SSO', async () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'https://example.awsapps.com/start',
        region: 'us-east-1',
        accountId: '123456789012',
        roleName: 'TestRole',
      };

      mockCredentialManager.authenticateWithSSO.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
        region: 'us-east-1',
        credentialType: 'sso',
      });

      const result = await connectionManager.authenticateWithSSO(ssoConfig);

      expect(result).toBe(true);
      expect(mockCredentialManager.authenticateWithSSO).toHaveBeenCalledWith(ssoConfig);
    });

    it('should handle SSO authentication failure', async () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'https://example.awsapps.com/start',
        region: 'us-east-1',
      };

      mockCredentialManager.authenticateWithSSO.mockResolvedValue({
        valid: false,
        error: 'SSO authentication failed',
      });

      const result = await connectionManager.authenticateWithSSO(ssoConfig);

      expect(result).toBe(false);
    });

    it('should handle exceptions during SSO authentication', async () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'https://example.awsapps.com/start',
        region: 'us-east-1',
      };

      mockCredentialManager.authenticateWithSSO.mockRejectedValue(new Error('Network error'));

      const result = await connectionManager.authenticateWithSSO(ssoConfig);

      expect(result).toBe(false);
    });
  });

  describe('authenticateWithProfile', () => {
    it('should successfully authenticate with valid profile', async () => {
      const profileName = 'test-profile';

      mockProfileReader.validateProfile.mockResolvedValue({ valid: true });
      mockProfileReader.getProfile.mockResolvedValue({
        name: profileName,
        region: 'us-west-2',
      });
      mockCredentialManager.authenticateWithProfile.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
        region: 'us-west-2',
        credentialType: 'profile',
      });

      const result = await connectionManager.authenticateWithProfile(profileName);

      expect(result).toBe(true);
      expect(mockProfileReader.validateProfile).toHaveBeenCalledWith(profileName);
      expect(mockProfileReader.getProfile).toHaveBeenCalledWith(profileName);
      expect(mockCredentialManager.authenticateWithProfile).toHaveBeenCalledWith({
        profileName,
        region: 'us-west-2',
      });
    });

    it('should fail when profile validation fails', async () => {
      const profileName = 'invalid-profile';

      mockProfileReader.validateProfile.mockResolvedValue({
        valid: false,
        error: 'Profile not found',
      });

      const result = await connectionManager.authenticateWithProfile(profileName);

      expect(result).toBe(false);
      expect(mockCredentialManager.authenticateWithProfile).not.toHaveBeenCalled();
    });

    it('should fail when profile is not found', async () => {
      const profileName = 'missing-profile';

      mockProfileReader.validateProfile.mockResolvedValue({ valid: true });
      mockProfileReader.getProfile.mockResolvedValue(null);

      const result = await connectionManager.authenticateWithProfile(profileName);

      expect(result).toBe(false);
    });

    it('should handle exceptions during profile authentication', async () => {
      const profileName = 'test-profile';

      mockProfileReader.validateProfile.mockRejectedValue(new Error('File system error'));

      const result = await connectionManager.authenticateWithProfile(profileName);

      expect(result).toBe(false);
    });
  });

  describe('authenticateWithRole', () => {
    it('should successfully authenticate with role', async () => {
      const roleArn = 'arn:aws:iam::123456789012:role/TestRole';
      const sessionName = 'test-session';

      mockCredentialManager.authenticateWithRole.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
        credentialType: 'role',
      });

      const result = await connectionManager.authenticateWithRole(roleArn, sessionName);

      expect(result).toBe(true);
      expect(mockCredentialManager.authenticateWithRole).toHaveBeenCalledWith({
        roleArn,
        sessionName,
      });
    });

    it('should use default session name when not provided', async () => {
      const roleArn = 'arn:aws:iam::123456789012:role/TestRole';

      mockCredentialManager.authenticateWithRole.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
        credentialType: 'role',
      });

      const result = await connectionManager.authenticateWithRole(roleArn);

      expect(result).toBe(true);
      expect(mockCredentialManager.authenticateWithRole).toHaveBeenCalledWith({
        roleArn,
        sessionName: 'aws-network-flow-visualizer',
      });
    });

    it('should handle role authentication failure', async () => {
      const roleArn = 'arn:aws:iam::123456789012:role/TestRole';

      mockCredentialManager.authenticateWithRole.mockResolvedValue({
        valid: false,
        error: 'Role assumption failed',
      });

      const result = await connectionManager.authenticateWithRole(roleArn);

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return connection status', async () => {
      const expectedStatus = {
        connected: true,
        accountId: '123456789012',
        region: 'us-east-1',
        lastChecked: new Date(),
      };

      mockCredentialManager.testConnection.mockResolvedValue(expectedStatus);

      const result = await connectionManager.testConnection();

      expect(result).toEqual(expectedStatus);
      expect(mockCredentialManager.testConnection).toHaveBeenCalled();
    });
  });

  describe('getAvailableProfiles', () => {
    it('should return list of profile names', async () => {
      const profiles = [
        { name: 'default', region: 'us-east-1' },
        { name: 'dev', region: 'us-west-2' },
        { name: 'prod', region: 'eu-west-1' },
      ];

      mockProfileReader.getAvailableProfiles.mockResolvedValue(profiles);

      const result = await connectionManager.getAvailableProfiles();

      expect(result).toEqual(['default', 'dev', 'prod']);
      expect(mockProfileReader.getAvailableProfiles).toHaveBeenCalled();
    });

    it('should handle errors and return empty array', async () => {
      mockProfileReader.getAvailableProfiles.mockRejectedValue(new Error('File system error'));

      const result = await connectionManager.getAvailableProfiles();

      expect(result).toEqual([]);
    });
  });

  describe('getProfileDetails', () => {
    it('should return detailed profile information', async () => {
      const profiles = [
        { name: 'default', region: 'us-east-1' },
        { name: 'dev', region: 'us-west-2', ssoStartUrl: 'https://example.awsapps.com/start' },
      ];

      mockProfileReader.getAvailableProfiles.mockResolvedValue(profiles);

      const result = await connectionManager.getProfileDetails();

      expect(result).toEqual(profiles);
    });

    it('should handle errors and return empty array', async () => {
      mockProfileReader.getAvailableProfiles.mockRejectedValue(new Error('File system error'));

      const result = await connectionManager.getProfileDetails();

      expect(result).toEqual([]);
    });
  });

  describe('getAvailableRegions', () => {
    it('should return list of AWS regions', async () => {
      const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];

      mockProfileReader.getAvailableRegions.mockReturnValue(regions);

      const result = await connectionManager.getAvailableRegions();

      expect(result).toEqual(regions);
      expect(mockProfileReader.getAvailableRegions).toHaveBeenCalled();
    });
  });

  describe('refreshCredentials', () => {
    it('should successfully refresh credentials', async () => {
      mockCredentialManager.refreshCredentials.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
      });

      const result = await connectionManager.refreshCredentials();

      expect(result).toBe(true);
      expect(mockCredentialManager.refreshCredentials).toHaveBeenCalled();
    });

    it('should handle refresh failure', async () => {
      mockCredentialManager.refreshCredentials.mockResolvedValue({
        valid: false,
        error: 'Refresh failed',
      });

      const result = await connectionManager.refreshCredentials();

      expect(result).toBe(false);
    });

    it('should handle exceptions during refresh', async () => {
      mockCredentialManager.refreshCredentials.mockRejectedValue(new Error('Network error'));

      const result = await connectionManager.refreshCredentials();

      expect(result).toBe(false);
    });
  });

  describe('initializeWithAutoDiscovery', () => {
    it('should successfully initialize with auto discovery', async () => {
      mockCredentialManager.initializeWithCredentialChain.mockResolvedValue({
        valid: true,
        accountId: '123456789012',
        region: 'us-east-1',
        credentialType: 'environment',
      });

      const result = await connectionManager.initializeWithAutoDiscovery();

      expect(result.valid).toBe(true);
      expect(mockCredentialManager.initializeWithCredentialChain).toHaveBeenCalledWith({
        preferredCredentialTypes: ['sso', 'profile', 'environment', 'instance'],
      });
    });

    it('should handle auto discovery failure', async () => {
      mockCredentialManager.initializeWithCredentialChain.mockResolvedValue({
        valid: false,
        error: 'No credentials found',
      });

      const result = await connectionManager.initializeWithAutoDiscovery();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No credentials found');
    });

    it('should handle exceptions during auto discovery', async () => {
      mockCredentialManager.initializeWithCredentialChain.mockRejectedValue(new Error('Initialization error'));

      const result = await connectionManager.initializeWithAutoDiscovery();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Initialization error');
    });
  });

  describe('utility methods', () => {
    it('should delegate getCurrentCredentials to credential manager', () => {
      const credentials = { region: 'us-east-1' };
      mockCredentialManager.getCurrentCredentials.mockReturnValue(credentials);

      const result = connectionManager.getCurrentCredentials();

      expect(result).toBe(credentials);
      expect(mockCredentialManager.getCurrentCredentials).toHaveBeenCalled();
    });

    it('should delegate areCredentialsExpired to credential manager', () => {
      mockCredentialManager.areCredentialsExpired.mockReturnValue(true);

      const result = connectionManager.areCredentialsExpired();

      expect(result).toBe(true);
      expect(mockCredentialManager.areCredentialsExpired).toHaveBeenCalled();
    });

    it('should delegate clearCredentials to credential manager', () => {
      connectionManager.clearCredentials();

      expect(mockCredentialManager.clearCredentials).toHaveBeenCalled();
    });

    it('should delegate hasAWSConfig to profile reader', () => {
      mockProfileReader.hasAWSConfig.mockReturnValue(true);

      const result = connectionManager.hasAWSConfig();

      expect(result).toBe(true);
      expect(mockProfileReader.hasAWSConfig).toHaveBeenCalled();
    });

    it('should delegate validateProfile to profile reader', async () => {
      const validation = { valid: true };
      mockProfileReader.validateProfile.mockResolvedValue(validation);

      const result = await connectionManager.validateProfile('test-profile');

      expect(result).toBe(validation);
      expect(mockProfileReader.validateProfile).toHaveBeenCalledWith('test-profile');
    });

    it('should delegate getSTSClient to credential manager', () => {
      const stsClient = {} as any;
      mockCredentialManager.getSTSClient.mockReturnValue(stsClient);

      const result = connectionManager.getSTSClient();

      expect(result).toBe(stsClient);
      expect(mockCredentialManager.getSTSClient).toHaveBeenCalled();
    });
  });
});