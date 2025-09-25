import React, { useState, useEffect } from 'react';
import { ConnectionStatus, CredentialType, AWSCredentials } from '../../shared/types';

export interface CredentialStatusProps {
  connectionStatus?: ConnectionStatus;
  onRefreshCredentials?: () => Promise<void>;
  onClearCredentials?: () => void;
}

export const CredentialStatus: React.FC<CredentialStatusProps> = ({
  connectionStatus,
  onRefreshCredentials,
  onClearCredentials
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeUntilExpiration, setTimeUntilExpiration] = useState<string>('');

  // Update expiration countdown
  useEffect(() => {
    if (!connectionStatus?.connected) {
      setTimeUntilExpiration('');
      return;
    }

    const updateCountdown = () => {
      // Get expiration from current credentials
      window.electronAPI.aws.getCurrentCredentials().then((credentials: AWSCredentials | null) => {
        if (credentials?.expiration) {
          const now = new Date();
          const expiration = new Date(credentials.expiration);
          const timeDiff = expiration.getTime() - now.getTime();

          if (timeDiff <= 0) {
            setTimeUntilExpiration('Expired');
          } else {
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            if (hours > 0) {
              setTimeUntilExpiration(`${hours}h ${minutes}m`);
            } else if (minutes > 0) {
              setTimeUntilExpiration(`${minutes}m ${seconds}s`);
            } else {
              setTimeUntilExpiration(`${seconds}s`);
            }
          }
        } else {
          setTimeUntilExpiration('No expiration');
        }
      }).catch(() => {
        setTimeUntilExpiration('');
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  const handleRefresh = async () => {
    if (!onRefreshCredentials) return;
    
    setIsRefreshing(true);
    try {
      await onRefreshCredentials();
    } catch (error) {
      console.error('Failed to refresh credentials:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getCredentialTypeIcon = (credentialType?: CredentialType) => {
    switch (credentialType) {
      case 'sso':
        return (
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.012-3a7.5 7.5 0 01-9.024 9.024A7.5 7.5 0 011.5 12.012 7.5 7.5 0 0112 1.5c2.165 0 4.84.326 6.312 1.488" />
          </svg>
        );
      case 'role':
        return (
          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        );
      case 'profile':
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'environment':
        return (
          <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'instance':
        return (
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getCredentialTypeLabel = (credentialType?: CredentialType) => {
    switch (credentialType) {
      case 'sso': return 'AWS SSO';
      case 'role': return 'IAM Role';
      case 'profile': return 'AWS Profile';
      case 'environment': return 'Environment Variables';
      case 'instance': return 'Instance Metadata';
      default: return 'Unknown';
    }
  };

  const getExpirationStatus = () => {
    if (timeUntilExpiration === 'Expired') {
      return { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    } else if (timeUntilExpiration === 'No expiration') {
      return { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' };
    } else {
      // Check if expiring soon (less than 15 minutes)
      const parts = timeUntilExpiration.split(/[hms]/);
      const hours = parts[0] ? parseInt(parts[0]) : 0;
      const minutes = parts[1] ? parseInt(parts[1]) : 0;
      
      if (hours === 0 && minutes < 15) {
        return { color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' };
      } else {
        return { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
      }
    }
  };

  if (!connectionStatus) {
    return null;
  }

  const expirationStatus = getExpirationStatus();

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`text-sm font-medium ${connectionStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
              {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {connectionStatus.connected && connectionStatus.credentialType && (
            <div className="flex items-center space-x-1">
              {getCredentialTypeIcon(connectionStatus.credentialType)}
              <span className="text-sm text-gray-600">
                {getCredentialTypeLabel(connectionStatus.credentialType)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {connectionStatus.connected && onRefreshCredentials && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none disabled:text-gray-400"
              title="Refresh credentials"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          {connectionStatus.connected && onClearCredentials && (
            <button
              onClick={onClearCredentials}
              className="text-sm text-red-600 hover:text-red-800 focus:outline-none"
              title="Clear credentials"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {connectionStatus.connected && (
        <div className="mt-3 space-y-2">
          {connectionStatus.accountId && (
            <div className="text-sm text-gray-600">
              <strong>Account:</strong> {connectionStatus.accountId}
            </div>
          )}

          {connectionStatus.region && (
            <div className="text-sm text-gray-600">
              <strong>Region:</strong> {connectionStatus.region}
            </div>
          )}

          {timeUntilExpiration && (
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expirationStatus.bgColor} ${expirationStatus.color} ${expirationStatus.borderColor} border`}>
              {timeUntilExpiration === 'Expired' ? (
                <>
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Credentials Expired
                </>
              ) : timeUntilExpiration === 'No expiration' ? (
                <>
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  No Expiration
                </>
              ) : (
                <>
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Expires in {timeUntilExpiration}
                </>
              )}
            </div>
          )}

          {connectionStatus.lastChecked && (
            <div className="text-xs text-gray-500">
              Last checked: {connectionStatus.lastChecked.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {!connectionStatus.connected && connectionStatus.error && (
        <div className="mt-3 text-sm text-red-600">
          <strong>Error:</strong> {connectionStatus.error}
        </div>
      )}
    </div>
  );
};