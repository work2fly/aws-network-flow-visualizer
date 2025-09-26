import React, { useState, useEffect } from 'react';
import { SSOConfig } from '../../shared/types';
import { LoadingButton, HelpIcon, Tooltip } from './common';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useOperationStatus } from '../hooks/useOperationStatus';

export interface SSOAuthProps {
  onAuthenticate: (config: SSOConfig) => Promise<void>;
  onLogout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError?: string;
  currentConfig?: SSOConfig;
}

export const SSOAuth: React.FC<SSOAuthProps> = ({
  onAuthenticate,
  onLogout,
  isAuthenticated,
  isAuthenticating,
  authError,
  currentConfig
}) => {
  const [startUrl, setStartUrl] = useState(currentConfig?.startUrl || '');
  const [region, setRegion] = useState(currentConfig?.region || 'us-east-1');
  const [sessionName, setSessionName] = useState(currentConfig?.sessionName || 'aws-network-flow-visualizer');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const { handleError, handleWarning } = useErrorHandler();
  const { runOperation } = useOperationStatus();

  // Common AWS regions
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

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!startUrl.trim()) {
      errors.startUrl = 'SSO Start URL is required';
    } else {
      try {
        const url = new URL(startUrl.trim());
        if (!url.hostname.includes('awsapps.com')) {
          errors.startUrl = 'Start URL should be an AWS SSO portal URL (*.awsapps.com)';
        }
      } catch {
        errors.startUrl = 'Please enter a valid URL';
      }
    }
    
    if (!region) {
      errors.region = 'AWS Region is required';
    }
    
    if (sessionName.trim().length > 64) {
      errors.sessionName = 'Session name must be 64 characters or less';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      handleWarning('Please correct the form errors before proceeding', {
        component: 'SSOAuth',
        operation: 'Form Validation'
      });
      return;
    }

    const config: SSOConfig = {
      startUrl: startUrl.trim(),
      region,
      sessionName: sessionName.trim() || 'aws-network-flow-visualizer'
    };

    try {
      await runOperation(
        {
          name: 'AWS SSO Authentication',
          canCancel: false,
          estimatedDuration: 30000 // 30 seconds
        },
        async (updateProgress) => {
          updateProgress({ progress: 10, message: 'Initiating SSO authentication...' });
          
          // Simulate progress updates
          setTimeout(() => updateProgress({ progress: 30, message: 'Opening browser for authentication...' }), 1000);
          setTimeout(() => updateProgress({ progress: 60, message: 'Waiting for user authentication...' }), 3000);
          setTimeout(() => updateProgress({ progress: 90, message: 'Finalizing authentication...' }), 5000);
          
          await onAuthenticate(config);
        }
      );
    } catch (error) {
      handleError(error, {
        component: 'SSOAuth',
        operation: 'AWS SSO Authentication'
      }, {
        customMessage: 'Failed to authenticate with AWS SSO. Please check your configuration and try again.',
        retryAction: () => handleSubmit(e)
      });
    }
  };

  const handleLogout = async () => {
    try {
      await runOperation(
        {
          name: 'AWS SSO Logout',
          canCancel: false,
          estimatedDuration: 5000 // 5 seconds
        },
        async (updateProgress) => {
          updateProgress({ progress: 50, message: 'Signing out...' });
          await onLogout();
          updateProgress({ progress: 100, message: 'Signed out successfully' });
        }
      );
      
      // Clear form on logout
      setStartUrl('');
      setRegion('us-east-1');
      setSessionName('aws-network-flow-visualizer');
      setValidationErrors({});
    } catch (error) {
      handleError(error, {
        component: 'SSOAuth',
        operation: 'AWS SSO Logout'
      }, {
        customMessage: 'Failed to sign out. You may need to clear your browser cookies manually.'
      });
    }
  };

  if (isAuthenticated) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">AWS SSO Authentication</h2>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-600 font-medium">Connected</span>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Successfully authenticated</h3>
              <div className="mt-2 text-sm text-green-700">
                <p><strong>Start URL:</strong> {currentConfig?.startUrl}</p>
                <p><strong>Region:</strong> {currentConfig?.region}</p>
                {currentConfig?.sessionName && (
                  <p><strong>Session:</strong> {currentConfig.sessionName}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <LoadingButton
          onClick={handleLogout}
          variant="danger"
          className="w-full"
        >
          Sign Out
        </LoadingButton>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">AWS SSO Authentication</h2>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-sm text-gray-600">Not connected</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="startUrl" className="flex items-center text-sm font-medium text-gray-700 mb-1">
            SSO Start URL *
            <HelpIcon
              content={
                <div className="space-y-2">
                  <p>Your AWS SSO start URL can be found in:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>AWS SSO Console → Settings</li>
                    <li>Look for "User portal URL"</li>
                    <li>Should end with "/start"</li>
                  </ol>
                  <p className="text-xs">Example: https://my-company.awsapps.com/start</p>
                </div>
              }
              className="ml-1"
            />
          </label>
          <input
            type="url"
            id="startUrl"
            value={startUrl}
            onChange={(e) => {
              setStartUrl(e.target.value);
              if (validationErrors.startUrl) {
                setValidationErrors(prev => ({ ...prev, startUrl: '' }));
              }
            }}
            placeholder="https://your-sso-portal.awsapps.com/start"
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.startUrl ? 'border-red-300' : 'border-gray-300'
            }`}
            required
            disabled={isAuthenticating}
          />
          {validationErrors.startUrl && (
            <p className="mt-1 text-xs text-red-600">{validationErrors.startUrl}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Your AWS SSO start URL (found in AWS SSO console)
          </p>
        </div>

        <div>
          <label htmlFor="region" className="flex items-center text-sm font-medium text-gray-700 mb-1">
            AWS Region *
            <HelpIcon
              content="Select the AWS region where your SSO is configured. This should match the region shown in your AWS SSO console."
              className="ml-1"
            />
          </label>
          <select
            id="region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              if (validationErrors.region) {
                setValidationErrors(prev => ({ ...prev, region: '' }));
              }
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.region ? 'border-red-300' : 'border-gray-300'
            }`}
            required
            disabled={isAuthenticating}
          >
            {awsRegions.map((region) => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
          {validationErrors.region && (
            <p className="mt-1 text-xs text-red-600">{validationErrors.region}</p>
          )}
        </div>

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
          <div className="border-t pt-4">
            <div>
              <label htmlFor="sessionName" className="flex items-center text-sm font-medium text-gray-700 mb-1">
                Session Name
                <HelpIcon
                  content="Optional session name used for tracking and auditing purposes in AWS CloudTrail logs."
                  className="ml-1"
                />
              </label>
              <input
                type="text"
                id="sessionName"
                value={sessionName}
                onChange={(e) => {
                  setSessionName(e.target.value);
                  if (validationErrors.sessionName) {
                    setValidationErrors(prev => ({ ...prev, sessionName: '' }));
                  }
                }}
                placeholder="aws-network-flow-visualizer"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.sessionName ? 'border-red-300' : 'border-gray-300'
                }`}
                disabled={isAuthenticating}
                maxLength={64}
              />
              {validationErrors.sessionName && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.sessionName}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Optional session name for tracking purposes (max 64 characters)
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

        <LoadingButton
          type="submit"
          isLoading={isAuthenticating}
          loadingText="Authenticating..."
          disabled={!startUrl.trim()}
          variant="primary"
          className="w-full"
        >
          Sign In with AWS SSO
        </LoadingButton>
      </form>

      <div className="mt-6 text-xs text-gray-500">
        <p className="mb-2">
          <strong>Note:</strong> This will open a browser window for AWS SSO authentication.
        </p>
        <p>
          Your credentials are stored securely and encrypted locally. No data is sent to external servers.
        </p>
      </div>
    </div>
  );
};