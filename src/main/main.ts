import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AWSCredentialManager } from './aws/credential-manager';
import { AWSConnectionManager } from './aws/connection-manager';
import { setupSSOIPCHandlers, removeSSOIPCHandlers } from './ipc/sso-handlers';
import { setupProfileIPCHandlers, removeProfileIPCHandlers } from './ipc/profile-handlers';

// Security: Disable node integration and enable context isolation
const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
};

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// Initialize AWS managers
const credentialManager = new AWSCredentialManager();
const connectionManager = new AWSConnectionManager();

// Setup IPC handlers
setupSSOIPCHandlers(credentialManager);
setupProfileIPCHandlers(connectionManager);

// Basic IPC handlers
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

// Cleanup on app quit
app.on('before-quit', () => {
  removeSSOIPCHandlers();
  removeProfileIPCHandlers();
});
