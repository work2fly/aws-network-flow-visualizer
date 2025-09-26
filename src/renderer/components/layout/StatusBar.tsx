import React from 'react';

export interface StatusBarProps {
  connectionStatus: {
    connected: boolean;
    region?: string;
    accountId?: string;
    error?: string;
  };
  operationStatus?: {
    isLoading: boolean;
    operation?: string;
    progress?: number;
    message?: string;
    canCancel?: boolean;
  };
  onToggleControlPanel: () => void;
  controlPanelVisible: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  operationStatus,
  onToggleControlPanel,
  controlPanelVisible,
}) => {
  const formatAccountId = (accountId: string) => {
    if (accountId.length === 12) {
      return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`;
    }
    return accountId;
  };

  return (
    <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-sm">
      {/* Left Section - Connection Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="font-medium">
            {connectionStatus.connected ? 'Connected' : 'Disconnected'}
          </span>
          {connectionStatus.connected && connectionStatus.region && (
            <span className="text-gray-300 ml-2">
              {connectionStatus.region}
            </span>
          )}
          {connectionStatus.connected && connectionStatus.accountId && (
            <span className="text-gray-300 ml-2">
              ({formatAccountId(connectionStatus.accountId)})
            </span>
          )}
        </div>

        {/* Operation Status */}
        {operationStatus?.isLoading && (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            <span className="text-gray-300">
              {operationStatus.operation || 'Loading...'}
            </span>
            {operationStatus.progress !== undefined && (
              <span className="text-gray-300 ml-2">
                ({Math.round(operationStatus.progress)}%)
              </span>
            )}
            {operationStatus.message && (
              <span className="text-gray-400 ml-2 text-xs max-w-xs truncate" title={operationStatus.message}>
                {operationStatus.message}
              </span>
            )}
            {operationStatus.canCancel && (
              <button
                onClick={() => {
                  // This would need to be passed as a prop or handled via context
                  console.log('Cancel operation requested');
                }}
                className="ml-2 text-gray-400 hover:text-white transition-colors"
                title="Cancel operation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Error Status */}
        {!connectionStatus.connected && connectionStatus.error && (
          <div className="flex items-center text-red-300">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="truncate max-w-xs" title={connectionStatus.error}>
              {connectionStatus.error}
            </span>
          </div>
        )}
      </div>

      {/* Center Section - Additional Info */}
      <div className="flex items-center space-x-4 text-gray-300">
        <span>Ready</span>
        <span>•</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>

      {/* Right Section - Controls */}
      <div className="flex items-center space-x-2">
        {/* Memory Usage Indicator */}
        <div className="flex items-center text-gray-300">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span className="text-xs">Memory: 45MB</span>
        </div>

        {/* Zoom Level */}
        <div className="flex items-center text-gray-300">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <span className="text-xs">100%</span>
        </div>

        {/* Control Panel Toggle */}
        <button
          onClick={onToggleControlPanel}
          className={`
            p-1 rounded transition-colors
            ${controlPanelVisible 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }
          `}
          title={controlPanelVisible ? 'Hide control panel' : 'Show control panel'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
          </svg>
        </button>

        {/* Settings */}
        <button
          className="p-1 rounded text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
          title="Application settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
};