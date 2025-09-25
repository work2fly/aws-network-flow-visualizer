import React from 'react';
import { SSOAuth } from './SSOAuth';
import { SSOAccountSelector } from './SSOAccountSelector';
import { useSSO } from '../hooks/useSSO';
import { SSOConfig } from '../../shared/types';

export interface SSOAuthContainerProps {
  onAuthenticationComplete?: (config: SSOConfig) => void;
  onAuthenticationError?: (error: string) => void;
}

export const SSOAuthContainer: React.FC<SSOAuthContainerProps> = ({
  onAuthenticationComplete,
  onAuthenticationError
}) => {
  const [ssoState, ssoActions] = useSSO();

  const handleAuthenticate = async (config: SSOConfig) => {
    try {
      await ssoActions.authenticate(config);
      
      if (ssoState.authError) {
        onAuthenticationError?.(ssoState.authError);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      onAuthenticationError?.(errorMessage);
    }
  };

  const handleLogout = async () => {
    await ssoActions.logout();
  };

  const handleAccountSelect = async (accountId: string) => {
    if (ssoState.currentConfig) {
      await ssoActions.loadRoles(accountId);
    }
  };

  const handleRoleSelect = async (accountId: string, roleName: string) => {
    if (ssoState.currentConfig) {
      await ssoActions.selectAccountAndRole(accountId, roleName, ssoState.currentConfig);
      
      // Notify parent component of successful authentication
      if (!ssoState.roleError) {
        const completeConfig: SSOConfig = {
          ...ssoState.currentConfig,
          accountId,
          roleName
        };
        onAuthenticationComplete?.(completeConfig);
      }
    }
  };

  // Show account/role selector if authenticated but no role selected
  const showAccountSelector = ssoState.isAuthenticated && 
    ssoState.accounts.length > 0 && 
    (!ssoState.selectedRole || !ssoState.currentConfig?.accountId);

  return (
    <div className="space-y-6">
      {/* SSO Authentication Form */}
      <SSOAuth
        onAuthenticate={handleAuthenticate}
        onLogout={handleLogout}
        isAuthenticated={ssoState.isAuthenticated}
        isAuthenticating={ssoState.isAuthenticating}
        authError={ssoState.authError}
        currentConfig={ssoState.currentConfig}
      />

      {/* Account and Role Selection */}
      {showAccountSelector && (
        <SSOAccountSelector
          accounts={ssoState.accounts}
          roles={ssoState.roles}
          selectedAccount={ssoState.selectedAccount}
          selectedRole={ssoState.selectedRole}
          onAccountSelect={handleAccountSelect}
          onRoleSelect={handleRoleSelect}
          isLoadingRoles={ssoState.isLoadingRoles}
          isSelectingRole={ssoState.isSelectingRole}
          error={ssoState.accountError || ssoState.roleError}
        />
      )}

      {/* Loading States */}
      {ssoState.isLoadingAccounts && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-3">
              <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-600">Loading AWS accounts...</span>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {ssoState.isAuthenticated && 
       ssoState.selectedRole && 
       ssoState.currentConfig?.accountId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-green-800">
                AWS SSO Authentication Complete
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>Successfully authenticated and configured AWS credentials.</p>
                <p className="mt-1">
                  <strong>Account:</strong> {ssoState.currentConfig.accountId}<br/>
                  <strong>Role:</strong> {ssoState.selectedRole}<br/>
                  <strong>Region:</strong> {ssoState.currentConfig.region}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};