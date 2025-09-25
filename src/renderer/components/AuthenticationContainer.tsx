import React, { useState, useEffect } from 'react';
import { SSOAuthContainer } from './SSOAuthContainer';
import { ProfileSelector } from './ProfileSelector';
import { CredentialStatus } from './CredentialStatus';
import { useProfile } from '../hooks/useProfile';
import { SSOConfig, RoleConfig, CredentialValidationResult } from '../../shared/types';

export interface AuthenticationContainerProps {
  onAuthenticationComplete?: (result: CredentialValidationResult) => void;
  onAuthenticationError?: (error: string) => void;
}

type AuthMethod = 'sso' | 'profile' | 'auto';

export const AuthenticationContainer: React.FC<AuthenticationContainerProps> = ({
  onAuthenticationComplete,
  onAuthenticationError
}) => {
  const [profileState, profileActions] = useProfile();
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthMethod>('auto');
  const [hasAWSConfig, setHasAWSConfig] = useState<boolean>(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(true);

  // Check for AWS configuration on mount
  useEffect(() => {
    checkAWSConfiguration();
  }, []);

  // Auto-discover credentials if no method is selected
  useEffect(() => {
    if (selectedAuthMethod === 'auto' && !isCheckingConfig && !profileState.connectionStatus?.connected) {
      attemptAutoDiscovery();
    }
  }, [selectedAuthMethod, isCheckingConfig, profileState.connectionStatus?.connected]);

  const checkAWSConfiguration = async () => {
    try {
      const hasConfig = await window.electronAPI.aws.hasConfig();
      setHasAWSConfig(hasConfig);
      
      if (hasConfig) {
        setSelectedAuthMethod('profile');
      } else {
        setSelectedAuthMethod('sso');
      }
    } catch (error) {
      console.error('Failed to check AWS configuration:', error);
      setSelectedAuthMethod('sso');
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const attemptAutoDiscovery = async () => {
    try {
      const result = await window.electronAPI.aws.autoDiscover();
      if (result.success) {
        const connectionStatus = await profileActions.testConnection();
        if (connectionStatus.connected) {
          onAuthenticationComplete?.({
            valid: true,
            credentialType: connectionStatus.credentialType
          });
        }
      }
    } catch (error) {
      console.error('Auto-discovery failed:', error);
    }
  };

  const handleSSOAuthComplete = (config: SSOConfig) => {
    onAuthenticationComplete?.({
      valid: true,
      credentialType: 'sso'
    });
  };

  const handleSSOAuthError = (error: string) => {
    onAuthenticationError?.(error);
  };

  const handleProfileSelect = async (profileName: string, region?: string) => {
    try {
      const result = await profileActions.authenticateWithProfile(profileName, region);
      if (result.valid) {
        onAuthenticationComplete?.(result);
      } else {
        onAuthenticationError?.(result.error || 'Profile authentication failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile authentication failed';
      onAuthenticationError?.(errorMessage);
    }
  };

  const handleRoleSelect = async (roleConfig: RoleConfig) => {
    try {
      const result = await profileActions.authenticateWithRole(roleConfig);
      if (result.valid) {
        onAuthenticationComplete?.(result);
      } else {
        onAuthenticationError?.(result.error || 'Role authentication failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Role authentication failed';
      onAuthenticationError?.(errorMessage);
    }
  };

  const handleRefreshCredentials = async () => {
    await profileActions.refreshCredentials();
  };

  const handleClearCredentials = async () => {
    await profileActions.clearCredentials();
  };

  if (isCheckingConfig) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-600">Checking AWS configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {profileState.connectionStatus && (
        <CredentialStatus
          connectionStatus={profileState.connectionStatus}
          onRefreshCredentials={handleRefreshCredentials}
          onClearCredentials={handleClearCredentials}
        />
      )}

      {/* Authentication Method Selection */}
      {!profileState.connectionStatus?.connected && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AWS Authentication</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Authentication Method
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setSelectedAuthMethod('sso')}
                  className={`relative rounded-lg border p-4 flex focus:outline-none ${
                    selectedAuthMethod === 'sso'
                      ? 'border-blue-500 ring-2 ring-blue-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.012-3a7.5 7.5 0 01-9.024 9.024A7.5 7.5 0 011.5 12.012 7.5 7.5 0 0112 1.5c2.165 0 4.84.326 6.312 1.488" />
                      </svg>
                    </div>
                    <div className="ml-3 text-left">
                      <div className="text-sm font-medium text-gray-900">AWS SSO</div>
                      <div className="text-sm text-gray-500">Browser-based authentication</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedAuthMethod('profile')}
                  disabled={!hasAWSConfig}
                  className={`relative rounded-lg border p-4 flex focus:outline-none ${
                    selectedAuthMethod === 'profile'
                      ? 'border-blue-500 ring-2 ring-blue-500'
                      : hasAWSConfig
                      ? 'border-gray-300 hover:border-gray-400'
                      : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className={`h-6 w-6 ${hasAWSConfig ? 'text-green-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="ml-3 text-left">
                      <div className={`text-sm font-medium ${hasAWSConfig ? 'text-gray-900' : 'text-gray-500'}`}>
                        AWS Profiles
                      </div>
                      <div className="text-sm text-gray-500">
                        {hasAWSConfig ? 'Use AWS CLI profiles' : 'No profiles found'}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {!hasAWSConfig && selectedAuthMethod === 'profile' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">No AWS Configuration Found</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        No AWS CLI configuration was found. Please configure AWS CLI profiles using{' '}
                        <code className="bg-yellow-100 px-1 rounded">aws configure</code> or use SSO authentication.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication Forms */}
      {!profileState.connectionStatus?.connected && selectedAuthMethod === 'sso' && (
        <SSOAuthContainer
          onAuthenticationComplete={handleSSOAuthComplete}
          onAuthenticationError={handleSSOAuthError}
        />
      )}

      {!profileState.connectionStatus?.connected && selectedAuthMethod === 'profile' && hasAWSConfig && (
        <ProfileSelector
          onProfileSelect={handleProfileSelect}
          onRoleSelect={handleRoleSelect}
          onAuthenticationError={onAuthenticationError}
          isAuthenticating={profileState.isAuthenticating}
          authError={profileState.error || undefined}
        />
      )}

      {/* Error Display */}
      {profileState.error && (
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
                <p>{profileState.error}</p>
              </div>
              <div className="mt-3">
                <button
                  onClick={profileActions.clearError}
                  className="text-sm text-red-600 hover:text-red-800 focus:outline-none"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};