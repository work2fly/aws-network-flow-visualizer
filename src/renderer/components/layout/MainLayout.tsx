import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MainCanvas } from './MainCanvas';
import { StatusBar } from './StatusBar';
import { TabNavigation } from './TabNavigation';
import { ControlPanel } from './ControlPanel';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType;
  closable?: boolean;
}

export interface MainLayoutProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
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
  };
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  connectionStatus,
  operationStatus,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [controlPanelVisible, setControlPanelVisible] = useState(true);

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onTabClose={onTabClose}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          connectionStatus={connectionStatus}
        />

        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col">
          <MainCanvas>
            {activeTab && <activeTab.component />}
          </MainCanvas>
        </div>

        {/* Control Panel */}
        {controlPanelVisible && (
          <ControlPanel
            onClose={() => setControlPanelVisible(false)}
            activeTabId={activeTabId}
          />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        connectionStatus={connectionStatus}
        operationStatus={operationStatus}
        onToggleControlPanel={() => setControlPanelVisible(!controlPanelVisible)}
        controlPanelVisible={controlPanelVisible}
      />
    </div>
  );
};