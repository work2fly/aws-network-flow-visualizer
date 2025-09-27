import React, { useEffect } from 'react';
import { MainLayout, Tab } from './components/layout';
import { 
  TopologyView, 
  FlowAnalysisView, 
  TimelineView, 
  AuthenticationView 
} from './components/views';
import { AuthenticationContainer } from './components/AuthenticationContainer';
import { 
  AuthenticationProvider,
  FilteredTopologyProvider,
  QueryEngineProvider
} from './components/integration';
import { 
  useAppSelector, 
  useAppDispatch,
  useConnectionStatus,
  useOperationStatus,
  useActiveTab
} from './store/hooks';
import { 
  setTabs, 
  setActiveTab, 
  setInitialized,
  addNotification
} from './store/slices/uiSlice';
import { loadSavedFiltersFromStorage } from './store/slices/filterSlice';
import { ErrorBoundary, ToastContainer } from './components/common';
import { useErrorHandler } from './hooks/useErrorHandler';
import { DebugPanel } from './components/DebugPanel';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeTabId = useActiveTab();
  const connectionStatus = useConnectionStatus();
  const operationStatus = useOperationStatus();
  const isInitialized = useAppSelector(state => state.ui.isInitialized);
  const { handleError } = useErrorHandler();

  // Initialize the application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load saved filters from localStorage
        const savedFilters = localStorage.getItem('aws-network-visualizer-saved-filters');
        if (savedFilters) {
          try {
            const filters = JSON.parse(savedFilters);
            dispatch(loadSavedFiltersFromStorage(filters));
          } catch (error) {
            handleError(error, {
              component: 'App',
              operation: 'Load Saved Filters'
            }, {
              showToast: false, // Don't show toast for non-critical errors
              logToConsole: true
            });
          }
        }

        // Set up default tabs
        const defaultTabs: Tab[] = [
          {
            id: 'auth',
            label: 'Authentication',
            icon: '🔐',
            component: AuthenticationContainer,
          },
          {
            id: 'topology',
            label: 'Network Topology',
            icon: '🌐',
            component: TopologyView,
          },
          {
            id: 'flows',
            label: 'Flow Analysis',
            icon: '📊',
            component: FlowAnalysisView,
          },
          {
            id: 'timeline',
            label: 'Timeline',
            icon: '⏱️',
            component: TimelineView,
          },
        ];

        dispatch(setTabs(defaultTabs));
        
        // Set initial active tab based on authentication status
        const initialTab = connectionStatus.connected ? 'topology' : 'auth';
        dispatch(setActiveTab(initialTab));

        // Mark app as initialized
        dispatch(setInitialized(true));

        // Show welcome notification
        dispatch(addNotification({
          type: 'info',
          title: 'AWS Network Flow Visualizer',
          message: 'Application initialized successfully',
          duration: 3000
        }));

      } catch (error) {
        handleError(error, {
          component: 'App',
          operation: 'Application Initialization'
        }, {
          customMessage: 'Failed to initialize application. Please restart the application.',
          persistent: true,
          showGlobalError: true
        });
      }
    };

    if (!isInitialized) {
      initializeApp();
    }
  }, [dispatch, isInitialized, connectionStatus.connected, handleError]);

  const tabs: Tab[] = useAppSelector(state => state.ui.tabs);

  const handleTabChange = (tabId: string) => {
    dispatch(setActiveTab(tabId));
  };

  const handleTabClose = (tabId: string) => {
    // For now, we don't allow closing default tabs
    // This could be extended for user-created tabs
    console.log('Close tab:', tabId);
    dispatch(addNotification({
      type: 'info',
      title: 'Tab Close',
      message: `Cannot close default tab: ${tabId}`,
      duration: 2000
    }));
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing AWS Network Flow Visualizer...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        handleError(error, {
          component: 'App',
          operation: 'React Error Boundary',
          additionalData: { componentStack: errorInfo.componentStack }
        }, {
          showGlobalError: true,
          persistent: true
        });
      }}
    >
      <AuthenticationProvider>
        <QueryEngineProvider>
          <FilteredTopologyProvider>
            <MainLayout
              tabs={tabs}
              activeTabId={activeTabId}
              onTabChange={handleTabChange}
              onTabClose={handleTabClose}
              connectionStatus={connectionStatus}
              operationStatus={operationStatus}
            />
            <ToastContainer />
            <DebugPanel />
          </FilteredTopologyProvider>
        </QueryEngineProvider>
      </AuthenticationProvider>
    </ErrorBoundary>
  );
};

export default App;
