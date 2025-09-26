import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import topologyReducer from './slices/topologySlice';
import filterReducer from './slices/filterSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    topology: topologyReducer,
    filter: filterReducer,
    ui: uiReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          // Ignore Date objects in actions
          'auth/authenticateWithSSO/fulfilled',
          'auth/authenticateWithProfile/fulfilled',
          'auth/testConnection/fulfilled',
          'topology/queryVPCFlowLogs/fulfilled',
          'topology/queryTGWFlowLogs/fulfilled',
          'topology/buildTopology/fulfilled',
          'ui/addNotification',
          'ui/startOperation',
          'ui/updateOperationProgress',
          'ui/completeOperation',
        ],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp', 'payload.createdAt', 'payload.lastUsed'],
        // Ignore these paths in the state
        ignoredPaths: [
          'auth.lastAuthenticated',
          'auth.lastConnectionTest',
          'auth.credentialExpiration',
          'topology.lastUpdated',
          'topology.processingProgress.timestamp',
          'filter.lastApplied',
          'filter.savedFilters',
          'ui.notifications',
          'ui.operationStatus.startTime',
          'ui.operationStatus.estimatedCompletion',
        ],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
