import React from 'react';
import { Tab } from './MainLayout';

export interface TabNavigationProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
}) => {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center px-4">
        {/* Application Title */}
        <div className="flex items-center py-3 mr-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">AWS Network Flow Visualizer</h1>
        </div>

        {/* Tab List */}
        <div className="flex flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center px-4 py-2 border-b-2 cursor-pointer transition-colors
                ${activeTabId === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon && (
                <span className="mr-2 text-sm">{tab.icon}</span>
              )}
              <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              
              {/* Close button for closable tabs */}
              {tab.closable && onTabClose && (
                <button
                  className="ml-2 p-1 rounded hover:bg-gray-200 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 ml-4">
          <button 
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => {
              // For now, show a notification that this feature is coming soon
              console.log('Add new tab functionality - coming soon');
            }}
            title="Add new tab (coming soon)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};