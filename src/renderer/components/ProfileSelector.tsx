import React, { useState, useEffect } from 'react';
import { AWSProfile, ProfileConfig, RoleConfig, CredentialValidationResult } from '../../shared/types';

export interface ProfileSelectorProps {
  onProfileSelect?: (profileName: string, region?: string) => void;
  onRoleSelect?: (roleConfig: RoleConfig) => void;
  onAuthenticationComplete?: (result: CredentialValidationResult) => void;
  onAuthenticationError?: (error: string) => void;
  isAuthenticating?: boolean;
  authError?: string;
  currentProfile?: string;
}

interface ProfileWithStatus extends AWSProfile {
  isValid?: boolean;
  profileType?: 'sso' | 'role' | 'credentials';
  requiresMFA?: boolean;
  credentialExpiration?: Date;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  onProfileSelect,
  onRoleSelect,
  onAuthenticationComplete,
  onAuthenticationError,
  isAuthenticating = false,
  authError,
  currentProfile
}) => {
  const [profiles, setProfiles] = useState<ProfileWithStatus[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>(currentProfile || '');
  const [selectedRegion, setSelectedRegion] = useState<string>('us-east-1');
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [sessionDuration, setSessionDuration] = useState(3600);

  // AWS regions
  const awsRegions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-west-2', label: 'Europe (London)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' }
  ];

  // Load available profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  // Update region when profile changes
  useEffect(() => {
    const profile = profiles.find(p => p.name === selectedProfile);
    if (profile?.region) {
      setSelectedRegion(profile.region);
    }
  }, [selectedProfile, profiles]);

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      // Call main process to get profiles
      const profileList = await window.electronAPI.aws.getProfiles();
      
      // Validate each profile and get additional info
      const profilesWithStatus = await Promise.all(
        profileList.map(async (profile: AWSProfile) => {
          try {
            const validation = await window.electronAPI.aws.validateProfile(profile.name);
            const requiresMFA = await window.electronAPI.aws.profileRequiresMFA(profile.name);
            
            return {
              ...profile,
              isValid: validation.valid,
              profileType: validation.profileType,
              requiresMFA
            } as ProfileWithStatus;
          } catch (error) {
            return {
              ...profile,
              isValid: false
            } as ProfileWithStatus;
          }
        })
      );

      setProfiles(profilesWithStatus);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      onAuthenticationError?.('Failed to load AWS profiles');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProfile) {
      return;
    }

    const profile = profiles.find(p => p.name === selectedProfile);
    if (!profile) {
      onAuthenticationError?.('Selected profile not found');
      return;
    }

    try {
      if (profile.profileType === 'role' && profile.roleArn) {
        // Handle role assumption
        const roleConfig: RoleConfig = {
          roleArn: profile.roleArn,
          sessionName: `${selectedProfile}-session`,
          region: selectedRegion,
          durationSeconds: sessionDuration,
          mfaToken: mfaToken || undefined
        };

        onRoleSelect?.(roleConfig);
      } else {
        // Handle regular profile authentication
        onProfileSelect?.(selectedProfile, selectedRegion);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile authentication failed';
      onAuthenticationError?.(errorMessage);
    }
  };

  const getProfileIcon = (profileType?: string) => {
    switch (profileType) {
      case 'sso':
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.012-3a7.5 7.5 0 01-9.024 9.024A7.5 7.5 0 011.5 12.012 7.5 7.5 0 0112 1.5c2.165 0 4.84.326 6.312 1.488" />
          </svg>
        );
      case 'role':
        return (
          <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
      case 'credentials':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getProfileTypeLabel = (profileType?: string) => {
    switch (profileType) {
      case 'sso': return 'SSO Profile';
      case 'role': return 'Role Profile';
      case 'credentials': return 'Credential Profile';
      default: return 'Unknown';
    }
  };

  if (isLoadingProfiles) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Loading AWS profiles...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">AWS Profile Authentication</h2>
        <button
          onClick={loadProfiles}
          className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
          disabled={isLoadingProfiles}
        >
          Refresh Profiles
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No AWS Profiles Found</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>No AWS CLI profiles were found. Please configure AWS CLI profiles or use SSO authentication.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label htmlFor="profile" className="block text-sm font-medium text-gray-700 mb-1">
              AWS Profile *
            </label>
            <select
              id="profile"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isAuthenticating}
            >
              <option value="">Select a profile...</option>
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name} disabled={!profile.isValid}>
                  {profile.name} ({getProfileTypeLabel(profile.profileType)})
                  {!profile.isValid && ' - Invalid'}
                </option>
              ))}
            </select>
          </div>

          {selectedProfile && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              {(() => {
                const profile = profiles.find(p => p.name === selectedProfile);
                if (!profile) return null;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getProfileIcon(profile.profileType)}
                      <span className="text-sm font-medium text-gray-900">
                        {getProfileTypeLabel(profile.profileType)}
                      </span>
                      {profile.requiresMFA && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          MFA Required
                        </span>
                      )}
                    </div>
                    
                    {profile.region && (
                      <p className="text-sm text-gray-600">
                        <strong>Default Region:</strong> {profile.region}
                      </p>
                    )}
                    
                    {profile.roleArn && (
                      <p className="text-sm text-gray-600">
                        <strong>Role ARN:</strong> {profile.roleArn}
                      </p>
                    )}
                    
                    {profile.sourceProfile && (
                      <p className="text-sm text-gray-600">
                        <strong>Source Profile:</strong> {profile.sourceProfile}
                      </p>
                    )}

                    {profile.ssoStartUrl && (
                      <p className="text-sm text-gray-600">
                        <strong>SSO Start URL:</strong> {profile.ssoStartUrl}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
              AWS Region *
            </label>
            <select
              id="region"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isAuthenticating}
            >
              {awsRegions.map((region) => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          {/* MFA Token for profiles that require it */}
          {selectedProfile && profiles.find(p => p.name === selectedProfile)?.requiresMFA && (
            <div>
              <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-700 mb-1">
                MFA Token
              </label>
              <input
                type="text"
                id="mfaToken"
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value)}
                placeholder="123456"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isAuthenticating}
                maxLength={6}
                pattern="[0-9]{6}"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the 6-digit code from your MFA device
              </p>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>
          </div>

          {showAdvanced && (
            <div className="border-t pt-4 space-y-4">
              <div>
                <label htmlFor="sessionDuration" className="block text-sm font-medium text-gray-700 mb-1">
                  Session Duration (seconds)
                </label>
                <select
                  id="sessionDuration"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isAuthenticating}
                >
                  <option value={900}>15 minutes</option>
                  <option value={1800}>30 minutes</option>
                  <option value={3600}>1 hour</option>
                  <option value={7200}>2 hours</option>
                  <option value={14400}>4 hours</option>
                  <option value={28800}>8 hours</option>
                  <option value={43200}>12 hours</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  How long the session should remain valid (for role assumption)
                </p>
              </div>
            </div>
          )}

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{authError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isAuthenticating || !selectedProfile}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAuthenticating ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </div>
            ) : (
              'Authenticate with Profile'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <p className="mb-2">
          <strong>Note:</strong> Profiles are read from your AWS CLI configuration (~/.aws/config and ~/.aws/credentials).
        </p>
        <p>
          Your credentials are handled securely and never transmitted to external servers.
        </p>
      </div>
    </div>
  );
};