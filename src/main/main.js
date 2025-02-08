// src/main/main.js
import { app, BrowserWindow, ipcMain, protocol, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { authManager } from './utils/auth_manager.js';
import { configManager } from './utils/config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  // Set CSP headers for main window
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' https://accounts.spotify.com https://*.scdn.co;",
          // Add Google domains for reCAPTCHA
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com;",
          "style-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co;",
          "font-src 'self' data: https://*.scdn.co;",
          // Add Google domains for reCAPTCHA
          "img-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com data:;",
          // Add Google domains for reCAPTCHA
          "connect-src 'self' https://*.spotify.com https://*.scdn.co https://*.ingest.sentry.io https://api.spotify.com https://www.google.com;",
          // Add Google domains for reCAPTCHA
          "frame-src 'self' https://accounts.spotify.com https://www.google.com https://recaptcha.google.com;",
          "media-src 'self' https://*.scdn.co;"
        ].join(' ')
      }
    });
  });

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });
  
  // IPC Handlers
  ipcMain.handle('auth:spotify', async () => {
    try {
      console.log('Received auth:spotify IPC call');
      
      // Check environment variables first
      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.error('Missing Spotify environment variables:', {
          hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
          hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET
        });
        throw new Error('Spotify credentials not found in environment variables');
      }
      
      if (!configManager.hasCredentials('spotify')) {
        // Instead of throwing error, let's set the credentials from env
        configManager.setCredentials('spotify', {
          clientId: process.env.SPOTIFY_CLIENT_ID,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });
        console.log('Configured Spotify credentials from environment variables');
      }
      
      console.log('Initiating Spotify auth...');
      const result = await authManager.initiateSpotifyAuth();
      console.log('Spotify auth result:', result);
      return result;
    } catch (error) {
      console.error('Spotify auth error in IPC handler:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:status', () => {
    return authManager.getAuthStatus();
  });

  ipcMain.handle('config:setSpotifyCredentials', async (event, credentials) => {
    try {
      configManager.setCredentials('spotify', credentials);
      return { success: true };
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  });

  ipcMain.handle('config:hasSpotifyCredentials', () => {
    return configManager.hasCredentials('spotify');
  });

  ipcMain.handle('config:clearSpotifyCredentials', () => {
    try {
      configManager.setCredentials('spotify', null);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      throw error;
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded');
  });
  
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('Renderer Console:', message);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return mainWindow;
}

let mainWindow = null;

app.whenReady().then(() => {
  // Register protocol
  if (!app.isDefaultProtocolClient('harmony')) {
    const success = app.setAsDefaultProtocolClient('harmony');
    console.log('Registered harmony:// protocol:', success);
  }

  protocol.handle('harmony', (request) => {
    console.log('Harmony protocol request:', request.url);
    return new Response('', { status: 200 });
  });

  mainWindow = createWindow();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('Received URL on macOS:', url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});