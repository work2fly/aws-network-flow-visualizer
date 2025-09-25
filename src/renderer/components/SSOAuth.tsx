import React, { useState, useEffect } from 'react';
import { SSOConfig } from '../../shared/types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startUrl.trim()) {
      return;
    }

    const config: SSOConfig = {
      startUrl: startUrl.trim(),
      region,
      sessionName: sessionName.trim() || 'aws-network-flow-visualizer'
    };

    await onAuthenticate(config);
  };

  const handleLogout = async () => {
    await onLogout();
    // Clear form on logout
    setStartUrl('');
    setRegion('us-east-1');
    setSessionName('aws-network-flow-visualizer');
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

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
        >
          Sign Out
        </button>
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
          <label htmlFor="startUrl" className="block text-sm font-medium text-gray-700 mb-1">
            SSO Start URL *
          </label>
          <input
            type="url"
            id="startUrl"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder="https://your-sso-portal.awsapps.com/start"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isAuthenticating}
          />
          <p className="mt-1 text-xs text-gray-500">
            Your AWS SSO start URL (found in AWS SSO console)
          </p>
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            AWS Region *
          </label>
          <select
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
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
              <label htmlFor="sessionName" className="block text-sm font-medium text-gray-700 mb-1">
                Session Name
              </label>
              <input
                type="text"
                id="sessionName"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="aws-network-flow-visualizer"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isAuthenticating}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional session name for tracking purposes
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
          disabled={isAuthenticating || !startUrl.trim()}
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
            'Sign In with AWS SSO'
          )}
        </button>
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