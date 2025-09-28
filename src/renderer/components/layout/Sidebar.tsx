import React from 'react';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  connectionStatus: {
    connected: boolean;
    region?: string;
    accountId?: string;
    error?: string;
  };
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  connectionStatus,
  activeTabId,
  onTabChange,
}) => {
  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  // Map sidebar navigation to actual tab IDs
  const navigationItems = [
    {
      id: 'authentication',
      label: 'Authentication',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      id: 'topology',
      label: 'Network Topology',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'flow-analysis',
      label: 'Flow Analysis',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`${sidebarWidth} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-sm font-semibold text-gray-900">Navigation</h2>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={`
                  w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${activeTabId === item.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="ml-3 truncate">{item.label}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Connection Status */}
      <div className="p-4 border-t border-gray-200">
        <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
          <div className={`flex items-center ${connectionStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'} mr-2`} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                </p>
                {connectionStatus.connected && connectionStatus.region && (
                  <p className="text-xs text-gray-500 truncate">
                    {connectionStatus.region}
                  </p>
                )}
                {!connectionStatus.connected && connectionStatus.error && (
                  <p className="text-xs text-red-500 truncate" title={connectionStatus.error}>
                    {connectionStatus.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};