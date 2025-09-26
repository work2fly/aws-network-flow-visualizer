import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Convenience selectors
export const useAuth = () => useAppSelector(state => state.auth);
export const useTopology = () => useAppSelector(state => state.topology);
export const useFilter = () => useAppSelector(state => state.filter);
export const useUI = () => useAppSelector(state => state.ui);

// Specific selectors for common use cases
export const useConnectionStatus = () => useAppSelector(state => state.auth.connectionStatus);
export const useIsAuthenticated = () => useAppSelector(state => state.auth.isAuthenticated);
export const useCurrentTopology = () => useAppSelector(state => state.topology.topology);
export const useFlowLogs = () => useAppSelector(state => state.topology.flowLogs);
export const useActiveFilters = () => useAppSelector(state => state.filter.filters);
export const useFilteredTopology = () => {
  const topology = useAppSelector(state => state.topology.topology);
  const filters = useAppSelector(state => state.filter.filters);
  const flowLogs = useAppSelector(state => state.topology.flowLogs);
  
  // This would be computed in a selector or memoized hook
  // For now, return the raw topology
  return topology;
};
export const useActiveTab = () => useAppSelector(state => state.ui.activeTabId);
export const useOperationStatus = () => useAppSelector(state => state.ui.operationStatus);
export const useNotifications = () => useAppSelector(state => state.ui.notifications);

// Loading state selectors
export const useIsLoading = () => {
  const auth = useAppSelector(state => state.auth);
  const topology = useAppSelector(state => state.topology);
  const ui = useAppSelector(state => state.ui);
  
  return (
    auth.isAuthenticating ||
    auth.isTestingConnection ||
    topology.isQueryingVPCLogs ||
    topology.isQueryingTGWLogs ||
    topology.isBuildingTopology ||
    topology.isAnalyzingTraffic ||
    ui.isLoading ||
    ui.operationStatus.isLoading
  );
};

// Error state selectors
export const useErrors = () => {
  const auth = useAppSelector(state => state.auth);
  const topology = useAppSelector(state => state.topology);
  const ui = useAppSelector(state => state.ui);
  
  const errors: string[] = [];
  
  if (auth.authError) errors.push(auth.authError);
  if (auth.profileError) errors.push(auth.profileError);
  if (auth.ssoError) errors.push(auth.ssoError);
  if (auth.connectionError) errors.push(auth.connectionError);
  if (topology.queryError) errors.push(topology.queryError);
  if (topology.buildError) errors.push(topology.buildError);
  if (topology.analysisError) errors.push(topology.analysisError);
  if (ui.globalError) errors.push(ui.globalError);
  
  return errors;
};