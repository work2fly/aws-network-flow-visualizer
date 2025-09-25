import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AWSProfile } from '../../shared/types';

export class AWSProfileReader {
  private configPath: string;
  private credentialsPath: string;

  constructor() {
    const awsDir = path.join(os.homedir(), '.aws');
    this.configPath = path.join(awsDir, 'config');
    this.credentialsPath = path.join(awsDir, 'credentials');
  }

  /**
   * Get all available AWS profiles from config and credentials files
   */
  async getAvailableProfiles(): Promise<AWSProfile[]> {
    const profiles = new Map<string, AWSProfile>();

    // Read config file
    try {
      const configProfiles = await this.parseConfigFile(this.configPath);
      configProfiles.forEach((profile, name) => {
        profiles.set(name, profile);
      });
    } catch (error) {
      console.warn('Could not read AWS config file:', error);
    }

    // Read credentials file
    try {
      const credentialProfiles = await this.parseCredentialsFile(this.credentialsPath);
      credentialProfiles.forEach((profile, name) => {
        const existingProfile = profiles.get(name) || { name };
        profiles.set(name, { ...existingProfile, ...profile });
      });
    } catch (error) {
      console.warn('Could not read AWS credentials file:', error);
    }

    return Array.from(profiles.values());
  }

  /**
   * Get a specific profile by name
   */
  async getProfile(profileName: string): Promise<AWSProfile | null> {
    const profiles = await this.getAvailableProfiles();
    return profiles.find(profile => profile.name === profileName) || null;
  }

  /**
   * Check if AWS CLI configuration exists
   */
  hasAWSConfig(): boolean {
    return fs.existsSync(this.configPath) || fs.existsSync(this.credentialsPath);
  }

  /**
   * Parse AWS config file
   */
  private async parseConfigFile(filePath: string): Promise<Map<string, AWSProfile>> {
    const profiles = new Map<string, AWSProfile>();

    if (!fs.existsSync(filePath)) {
      return profiles;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let currentProfile: string | null = null;
    let currentProfileData: Partial<AWSProfile> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Check for profile section
      const profileMatch = trimmedLine.match(/^\[(?:profile\s+)?([^\]]+)\]$/);
      if (profileMatch) {
        // Save previous profile if exists
        if (currentProfile && Object.keys(currentProfileData).length > 0) {
          profiles.set(currentProfile, {
            name: currentProfile,
            ...currentProfileData,
          });
        }

        // Start new profile
        currentProfile = profileMatch[1];
        currentProfileData = {};
        continue;
      }

      // Parse key-value pairs
      const keyValueMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (keyValueMatch && currentProfile) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();

        switch (key) {
          case 'region':
            currentProfileData.region = value;
            break;
          case 'output':
            currentProfileData.output = value;
            break;
          case 'sso_start_url':
            currentProfileData.ssoStartUrl = value;
            break;
          case 'sso_region':
            currentProfileData.ssoRegion = value;
            break;
          case 'sso_account_id':
            currentProfileData.ssoAccountId = value;
            break;
          case 'sso_role_name':
            currentProfileData.ssoRoleName = value;
            break;
          case 'role_arn':
            currentProfileData.roleArn = value;
            break;
          case 'source_profile':
            currentProfileData.sourceProfile = value;
            break;
        }
      }
    }

    // Save last profile
    if (currentProfile && Object.keys(currentProfileData).length > 0) {
      profiles.set(currentProfile, {
        name: currentProfile,
        ...currentProfileData,
      });
    }

    return profiles;
  }

  /**
   * Parse AWS credentials file
   */
  private async parseCredentialsFile(filePath: string): Promise<Map<string, AWSProfile>> {
    const profiles = new Map<string, AWSProfile>();

    if (!fs.existsSync(filePath)) {
      return profiles;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let currentProfile: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Check for profile section
      const profileMatch = trimmedLine.match(/^\[([^\]]+)\]$/);
      if (profileMatch) {
        currentProfile = profileMatch[1];
        
        // Initialize profile if not exists
        if (!profiles.has(currentProfile)) {
          profiles.set(currentProfile, { name: currentProfile });
        }
        continue;
      }

      // For credentials file, we mainly care about the existence of profiles
      // The actual credential values will be handled by the AWS SDK
      if (currentProfile && !profiles.has(currentProfile)) {
        profiles.set(currentProfile, { name: currentProfile });
      }
    }

    return profiles;
  }

  /**
   * Get available AWS regions
   */
  getAvailableRegions(): string[] {
    return [
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-central-1',
      'eu-north-1',
      'ap-northeast-1',
      'ap-northeast-2',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-south-1',
      'ca-central-1',
      'sa-east-1',
      'af-south-1',
      'ap-east-1',
      'ap-northeast-3',
      'eu-south-1',
      'me-south-1',
    ];
  }

  /**
   * Validate profile configuration
   */
  async validateProfile(profileName: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const profile = await this.getProfile(profileName);
      
      if (!profile) {
        return {
          valid: false,
          error: `Profile '${profileName}' not found`,
        };
      }

      // Check for SSO configuration
      if (profile.ssoStartUrl && profile.ssoRegion && profile.ssoAccountId && profile.ssoRoleName) {
        return { valid: true };
      }

      // Check for role configuration
      if (profile.roleArn && profile.sourceProfile) {
        return { valid: true };
      }

      // Check if credentials file has this profile (basic validation)
      if (fs.existsSync(this.credentialsPath)) {
        const content = fs.readFileSync(this.credentialsPath, 'utf-8');
        if (content.includes(`[${profileName}]`)) {
          return { valid: true };
        }
      }

      return {
        valid: false,
        error: `Profile '${profileName}' exists but appears to be incomplete`,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Error validating profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}