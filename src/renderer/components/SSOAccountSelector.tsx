import React, { useState, useEffect } from 'react';

export interface SSOAccount {
  accountId: string;
  accountName: string;
  emailAddress: string;
}

export interface SSORole {
  roleName: string;
  accountId: string;
}

export interface SSOAccountSelectorProps {
  accounts: SSOAccount[];
  roles: SSORole[];
  selectedAccount?: string;
  selectedRole?: string;
  onAccountSelect: (accountId: string) => Promise<void>;
  onRoleSelect: (accountId: string, roleName: string) => Promise<void>;
  isLoadingRoles: boolean;
  isSelectingRole: boolean;
  error?: string;
}

export const SSOAccountSelector: React.FC<SSOAccountSelectorProps> = ({
  accounts,
  roles,
  selectedAccount,
  selectedRole,
  onAccountSelect,
  onRoleSelect,
  isLoadingRoles,
  isSelectingRole,
  error
}) => {
  const [localSelectedAccount, setLocalSelectedAccount] = useState(selectedAccount || '');
  const [localSelectedRole, setLocalSelectedRole] = useState(selectedRole || '');

  useEffect(() => {
    setLocalSelectedAccount(selectedAccount || '');
  }, [selectedAccount]);

  useEffect(() => {
    setLocalSelectedRole(selectedRole || '');
  }, [selectedRole]);

  const handleAccountChange = async (accountId: string) => {
    setLocalSelectedAccount(accountId);
    setLocalSelectedRole(''); // Reset role selection when account changes
    if (accountId) {
      await onAccountSelect(accountId);
    }
  };

  const handleRoleChange = async (roleName: string) => {
    setLocalSelectedRole(roleName);
    if (localSelectedAccount && roleName) {
      await onRoleSelect(localSelectedAccount, roleName);
    }
  };

  const selectedAccountData = accounts.find(acc => acc.accountId === localSelectedAccount);
  const availableRoles = roles.filter(role => role.accountId === localSelectedAccount);

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Selection</h3>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts available</h3>
          <p className="mt-1 text-sm text-gray-500">
            No AWS accounts were found for your SSO session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Account & Role Selection</h3>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Account Selection */}
        <div>
          <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-1">
            AWS Account *
          </label>
          <select
            id="account"
            value={localSelectedAccount}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoadingRoles || isSelectingRole}
          >
            <option value="">Select an account...</option>
            {accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountName} ({account.accountId})
              </option>
            ))}
          </select>
          {selectedAccountData && (
            <p className="mt-1 text-xs text-gray-500">
              {selectedAccountData.emailAddress}
            </p>
          )}
        </div>

        {/* Role Selection */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            IAM Role *
          </label>
          <div className="relative">
            <select
              id="role"
              value={localSelectedRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              disabled={!localSelectedAccount || isLoadingRoles || isSelectingRole || availableRoles.length === 0}
            >
              <option value="">
                {!localSelectedAccount 
                  ? 'Select an account first...' 
                  : isLoadingRoles 
                    ? 'Loading roles...' 
                    : availableRoles.length === 0 
                      ? 'No roles available'
                      : 'Select a role...'
                }
              </option>
              {availableRoles.map((role) => (
                <option key={`${role.accountId}-${role.roleName}`} value={role.roleName}>
                  {role.roleName}
                </option>
              ))}
            </select>
            {isLoadingRoles && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Selection Summary */}
        {localSelectedAccount && localSelectedRole && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  {isSelectingRole ? 'Configuring credentials...' : 'Ready to connect'}
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p><strong>Account:</strong> {selectedAccountData?.accountName} ({localSelectedAccount})</p>
                  <p><strong>Role:</strong> {localSelectedRole}</p>
                </div>
                {isSelectingRole && (
                  <div className="mt-2 flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-blue-600">Setting up credentials...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <p>
          Select the AWS account and IAM role you want to use for accessing CloudWatch Insights and other AWS services.
        </p>
      </div>
    </div>
  );
};