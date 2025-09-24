import { configureStore } from '@reduxjs/toolkit';

// Slices will be imported here as they are created
// import awsSlice from './slices/awsSlice';
// import topologySlice from './slices/topologySlice';

export const store = configureStore({
  reducer: {
    // Placeholder reducer to prevent Redux warnings
    app: (state = { initialized: true }) => state,
    // aws: awsSlice,
    // topology: topologySlice,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
