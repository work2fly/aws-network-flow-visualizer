import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// UI state interface
export interface UIState {
  // Application state
  isInitialized: boolean;
  isLoading: boolean;
  
  // Tab management
  activeTabId: string;
  tabs: Tab[];
  
  // Panel visibility
  isSidebarOpen: boolean;
  isControlPanelOpen: boolean;
  isStatusBarVisible: boolean;
  
  // Modal and dialog state
  activeModal?: string;
  modalData?: Record<string, unknown>;
  
  // Notification system
  notifications: Notification[];
  
  // Theme and appearance
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  
  // Layout settings
  sidebarWidth: number;
  controlPanelHeight: number;
  
  // Operation status
  operationStatus: OperationStatus;
  
  // Error handling
  globalError?: string;
  
  // Performance settings
  enableAnimations: boolean;
  enableTooltips: boolean;
  maxNotifications: number;
  
  // Accessibility
  highContrast: boolean;
  reduceMotion: boolean;
  screenReaderMode: boolean;
}

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
  closable?: boolean;
  modified?: boolean;
  data?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: Date;
  duration?: number; // Auto-dismiss after ms, undefined = manual dismiss
  actions?: NotificationAction[];
  persistent?: boolean;
}

export interface NotificationAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

export interface OperationStatus {
  isLoading: boolean;
  operation?: string;
  progress?: number; // 0-100
  message?: string;
  startTime?: Date;
  estimatedCompletion?: Date;
  canCancel?: boolean;
}

const initialState: UIState = {
  isInitialized: false,
  isLoading: false,
  activeTabId: 'topology',
  tabs: [],
  isSidebarOpen: true,
  isControlPanelOpen: true,
  isStatusBarVisible: true,
  notifications: [],
  theme: 'system',
  fontSize: 'medium',
  compactMode: false,
  sidebarWidth: 300,
  controlPanelHeight: 200,
  operationStatus: {
    isLoading: false
  },
  enableAnimations: true,
  enableTooltips: true,
  maxNotifications: 10,
  highContrast: false,
  reduceMotion: false,
  screenReaderMode: false
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Application initialization
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Tab management
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTabId = action.payload;
    },
    
    setTabs: (state, action: PayloadAction<Tab[]>) => {
      state.tabs = action.payload;
    },
    
    addTab: (state, action: PayloadAction<Tab>) => {
      const existingIndex = state.tabs.findIndex(tab => tab.id === action.payload.id);
      if (existingIndex >= 0) {
        // Update existing tab
        state.tabs[existingIndex] = action.payload;
      } else {
        // Add new tab
        state.tabs.push(action.payload);
      }
      state.activeTabId = action.payload.id;
    },
    
    removeTab: (state, action: PayloadAction<string>) => {
      const tabIndex = state.tabs.findIndex(tab => tab.id === action.payload);
      if (tabIndex >= 0) {
        state.tabs.splice(tabIndex, 1);
        
        // If removing active tab, switch to another tab
        if (state.activeTabId === action.payload && state.tabs.length > 0) {
          const newIndex = Math.min(tabIndex, state.tabs.length - 1);
          state.activeTabId = state.tabs[newIndex].id;
        }
      }
    },
    
    updateTab: (state, action: PayloadAction<{ id: string; updates: Partial<Tab> }>) => {
      const { id, updates } = action.payload;
      const tabIndex = state.tabs.findIndex(tab => tab.id === id);
      if (tabIndex >= 0) {
        state.tabs[tabIndex] = { ...state.tabs[tabIndex], ...updates };
      }
    },
    
    // Panel visibility
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarOpen = action.payload;
    },
    
    setControlPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isControlPanelOpen = action.payload;
    },
    
    setStatusBarVisible: (state, action: PayloadAction<boolean>) => {
      state.isStatusBarVisible = action.payload;
    },
    
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    
    toggleControlPanel: (state) => {
      state.isControlPanelOpen = !state.isControlPanelOpen;
    },
    
    // Modal and dialog management
    openModal: (state, action: PayloadAction<{ modal: string; data?: Record<string, unknown> }>) => {
      state.activeModal = action.payload.modal;
      state.modalData = action.payload.data;
    },
    
    closeModal: (state) => {
      state.activeModal = undefined;
      state.modalData = undefined;
    },
    
    // Notification system
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date()
      };
      
      state.notifications.unshift(notification);
      
      // Limit number of notifications
      if (state.notifications.length > state.maxNotifications) {
        state.notifications = state.notifications.slice(0, state.maxNotifications);
      }
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    clearNotificationsByType: (state, action: PayloadAction<Notification['type']>) => {
      state.notifications = state.notifications.filter(n => n.type !== action.payload);
    },
    
    // Theme and appearance
    setTheme: (state, action: PayloadAction<UIState['theme']>) => {
      state.theme = action.payload;
    },
    
    setFontSize: (state, action: PayloadAction<UIState['fontSize']>) => {
      state.fontSize = action.payload;
    },
    
    setCompactMode: (state, action: PayloadAction<boolean>) => {
      state.compactMode = action.payload;
    },
    
    // Layout settings
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(600, action.payload));
    },
    
    setControlPanelHeight: (state, action: PayloadAction<number>) => {
      state.controlPanelHeight = Math.max(100, Math.min(400, action.payload));
    },
    
    // Operation status
    setOperationStatus: (state, action: PayloadAction<Partial<OperationStatus>>) => {
      state.operationStatus = { ...state.operationStatus, ...action.payload };
    },
    
    startOperation: (state, action: PayloadAction<{ operation: string; canCancel?: boolean }>) => {
      state.operationStatus = {
        isLoading: true,
        operation: action.payload.operation,
        progress: 0,
        startTime: new Date(),
        canCancel: action.payload.canCancel || false
      };
    },
    
    updateOperationProgress: (state, action: PayloadAction<{ progress: number; message?: string; estimatedCompletion?: Date }>) => {
      if (state.operationStatus.isLoading) {
        state.operationStatus.progress = action.payload.progress;
        state.operationStatus.message = action.payload.message;
        state.operationStatus.estimatedCompletion = action.payload.estimatedCompletion;
      }
    },
    
    completeOperation: (state, action: PayloadAction<{ success: boolean; message?: string }>) => {
      state.operationStatus = {
        isLoading: false
      };
      
      // Add notification for operation completion
      const notification: Notification = {
        id: Date.now().toString(),
        type: action.payload.success ? 'success' : 'error',
        title: action.payload.success ? 'Operation Completed' : 'Operation Failed',
        message: action.payload.message,
        timestamp: new Date(),
        duration: 5000
      };
      
      state.notifications.unshift(notification);
      
      if (state.notifications.length > state.maxNotifications) {
        state.notifications = state.notifications.slice(0, state.maxNotifications);
      }
    },
    
    cancelOperation: (state) => {
      state.operationStatus = {
        isLoading: false
      };
    },
    
    // Error handling
    setGlobalError: (state, action: PayloadAction<string | undefined>) => {
      state.globalError = action.payload;
    },
    
    // Performance settings
    setEnableAnimations: (state, action: PayloadAction<boolean>) => {
      state.enableAnimations = action.payload;
    },
    
    setEnableTooltips: (state, action: PayloadAction<boolean>) => {
      state.enableTooltips = action.payload;
    },
    
    setMaxNotifications: (state, action: PayloadAction<number>) => {
      state.maxNotifications = Math.max(1, Math.min(50, action.payload));
    },
    
    // Accessibility
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
    },
    
    setReduceMotion: (state, action: PayloadAction<boolean>) => {
      state.reduceMotion = action.payload;
    },
    
    setScreenReaderMode: (state, action: PayloadAction<boolean>) => {
      state.screenReaderMode = action.payload;
    },
    
    // Bulk settings update
    updateSettings: (state, action: PayloadAction<Partial<UIState>>) => {
      Object.assign(state, action.payload);
    },
    
    // Reset to defaults
    resetUISettings: (state) => {
      state.theme = 'system';
      state.fontSize = 'medium';
      state.compactMode = false;
      state.sidebarWidth = 300;
      state.controlPanelHeight = 200;
      state.enableAnimations = true;
      state.enableTooltips = true;
      state.maxNotifications = 10;
      state.highContrast = false;
      state.reduceMotion = false;
      state.screenReaderMode = false;
    }
  }
});

export const {
  setInitialized,
  setLoading,
  setActiveTab,
  setTabs,
  addTab,
  removeTab,
  updateTab,
  setSidebarOpen,
  setControlPanelOpen,
  setStatusBarVisible,
  toggleSidebar,
  toggleControlPanel,
  openModal,
  closeModal,
  addNotification,
  removeNotification,
  clearNotifications,
  clearNotificationsByType,
  setTheme,
  setFontSize,
  setCompactMode,
  setSidebarWidth,
  setControlPanelHeight,
  setOperationStatus,
  startOperation,
  updateOperationProgress,
  completeOperation,
  cancelOperation,
  setGlobalError,
  setEnableAnimations,
  setEnableTooltips,
  setMaxNotifications,
  setHighContrast,
  setReduceMotion,
  setScreenReaderMode,
  updateSettings,
  resetUISettings
} = uiSlice.actions;

export default uiSlice.reducer;