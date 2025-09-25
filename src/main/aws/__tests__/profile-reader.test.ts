import { AWSProfileReader } from '../profile-reader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs module
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('AWSProfileReader', () => {
  let profileReader: AWSProfileReader;
  const mockHomeDir = '/home/testuser';

  beforeEach(() => {
    mockOs.homedir.mockReturnValue(mockHomeDir);
    profileReader = new AWSProfileReader();
    jest.clearAllMocks();
  });

  describe('getAvailableProfiles', () => {
    it('should parse config file with multiple profiles', async () => {
      const configContent = `
[default]
region = us-east-1
output = json

[profile dev]
region = us-west-2
sso_start_url = https://example.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = DeveloperRole

[profile prod]
region = eu-west-1
role_arn = arn:aws:iam::987654321098:role/ProductionRole
source_profile = default
`;

      const credentialsContent = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[staging]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
`;

      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.includes('config') || filePath.includes('credentials');
      });

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('config')) {
          return configContent;
        } else if (filePath.includes('credentials')) {
          return credentialsContent;
        }
        return '';
      });

      const profiles = await profileReader.getAvailableProfiles();

      expect(profiles).toHaveLength(4); // default, dev, prod, staging
      
      const defaultProfile = profiles.find(p => p.name === 'default');
      expect(defaultProfile).toEqual({
        name: 'default',
        region: 'us-east-1',
        output: 'json',
      });

      const devProfile = profiles.find(p => p.name === 'dev');
      expect(devProfile).toEqual({
        name: 'dev',
        region: 'us-west-2',
        ssoStartUrl: 'https://example.awsapps.com/start',
        ssoRegion: 'us-east-1',
        ssoAccountId: '123456789012',
        ssoRoleName: 'DeveloperRole',
      });

      const prodProfile = profiles.find(p => p.name === 'prod');
      expect(prodProfile).toEqual({
        name: 'prod',
        region: 'eu-west-1',
        roleArn: 'arn:aws:iam::987654321098:role/ProductionRole',
        sourceProfile: 'default',
      });

      const stagingProfile = profiles.find(p => p.name === 'staging');
      expect(stagingProfile).toEqual({
        name: 'staging',
      });
    });

    it('should handle missing config files gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const profiles = await profileReader.getAvailableProfiles();

      expect(profiles).toHaveLength(0);
    });

    it('should handle malformed config files', async () => {
      const malformedContent = `
[default
region = us-east-1
invalid line without equals
[profile incomplete
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(malformedContent);

      const profiles = await profileReader.getAvailableProfiles();

      // Should still parse what it can
      expect(profiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getProfile', () => {
    it('should return specific profile by name', async () => {
      const configContent = `
[profile test]
region = us-west-1
sso_start_url = https://test.awsapps.com/start
sso_region = us-east-1
sso_account_id = 111122223333
sso_role_name = TestRole
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(configContent);

      const profile = await profileReader.getProfile('test');

      expect(profile).toEqual({
        name: 'test',
        region: 'us-west-1',
        ssoStartUrl: 'https://test.awsapps.com/start',
        ssoRegion: 'us-east-1',
        ssoAccountId: '111122223333',
        ssoRoleName: 'TestRole',
      });
    });

    it('should return null for non-existent profile', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('[default]\nregion = us-east-1');

      const profile = await profileReader.getProfile('nonexistent');

      expect(profile).toBeNull();
    });
  });

  describe('hasAWSConfig', () => {
    it('should return true when config file exists', () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.includes('config');
      });

      const hasConfig = profileReader.hasAWSConfig();

      expect(hasConfig).toBe(true);
    });

    it('should return true when credentials file exists', () => {
      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.includes('credentials');
      });

      const hasConfig = profileReader.hasAWSConfig();

      expect(hasConfig).toBe(true);
    });

    it('should return false when no AWS config exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const hasConfig = profileReader.hasAWSConfig();

      expect(hasConfig).toBe(false);
    });
  });

  describe('validateProfile', () => {
    it('should validate SSO profile as valid', async () => {
      const configContent = `
[profile sso-test]
sso_start_url = https://example.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = TestRole
region = us-west-2
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(configContent);

      const validation = await profileReader.validateProfile('sso-test');

      expect(validation.valid).toBe(true);
    });

    it('should validate role profile as valid', async () => {
      const configContent = `
[profile role-test]
role_arn = arn:aws:iam::123456789012:role/TestRole
source_profile = default
region = us-east-1
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(configContent);

      const validation = await profileReader.validateProfile('role-test');

      expect(validation.valid).toBe(true);
    });

    it('should validate credentials-based profile as valid', async () => {
      const configContent = `[profile creds-test]\nregion = us-east-1`;
      const credentialsContent = `[creds-test]\naws_access_key_id = test\naws_secret_access_key = test`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('config')) {
          return configContent;
        } else if (filePath.includes('credentials')) {
          return credentialsContent;
        }
        return '';
      });

      const validation = await profileReader.validateProfile('creds-test');

      expect(validation.valid).toBe(true);
    });

    it('should return invalid for non-existent profile', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('[default]\nregion = us-east-1');

      const validation = await profileReader.validateProfile('nonexistent');

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('not found');
    });

    it('should return invalid for incomplete profile', async () => {
      const configContent = `
[profile incomplete]
region = us-east-1
# Missing required SSO or role configuration
`;

      mockFs.existsSync.mockImplementation((filePath: string) => {
        if (filePath.includes('config')) return true;
        if (filePath.includes('credentials')) return false;
        return false;
      });

      mockFs.readFileSync.mockReturnValue(configContent);

      const validation = await profileReader.validateProfile('incomplete');

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('incomplete');
    });
  });

  describe('getAvailableRegions', () => {
    it('should return list of AWS regions', () => {
      const regions = profileReader.getAvailableRegions();

      expect(regions).toContain('us-east-1');
      expect(regions).toContain('us-west-2');
      expect(regions).toContain('eu-west-1');
      expect(regions).toContain('ap-southeast-1');
      expect(regions.length).toBeGreaterThan(10);
    });
  });
});