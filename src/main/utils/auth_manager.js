// src/main/utils/auth_manager.js
const { BrowserWindow, session } = require('electron');
const { getAuthConstants } = require('./constants');

class AuthManager {
  constructor() {
    this.authWindow = null;
    this.isSpotifyAuthenticated = false;
    this.spotifyAuthData = null;
    this.authPromiseResolve = null;
    this.authPromiseReject = null;
  }

  getAuthStatus() {
    return {
      isSpotifyAuthenticated: this.isSpotifyAuthenticated,
      spotifyAuthData: this.spotifyAuthData
    };
  }

  async initiateSpotifyAuth() {
    try {
      const { SPOTIFY } = getAuthConstants();
      const redirectUri = 'harmony://oauth/callback';
      
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      const params = new URLSearchParams({
        client_id: SPOTIFY.CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SPOTIFY.SCOPES.join(' '),
        show_dialog: 'true'
      });
      authUrl.search = params.toString();

      console.log('Starting Spotify auth with:');
      console.log('Client ID:', SPOTIFY.CLIENT_ID);
      console.log('Redirect URI:', redirectUri);
      console.log('Full Auth URL:', authUrl.toString());

      return await this.createAuthWindow(authUrl.toString());
    } catch (error) {
      console.error('Spotify auth error:', error);
      this.isSpotifyAuthenticated = false;
      this.spotifyAuthData = null;
      throw error;
    }
  }

  createAuthWindow(authUrl) {
    return new Promise((resolve, reject) => {
      // Create a new session for the auth window
      const authSession = session.fromPartition('spotify-auth');
      
      // Set content security policy for the auth session
      authSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.spotify.com"]
          }
        });
      });

      this.authWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          session: authSession,
          webSecurity: true
        },
        show: false // Don't show until ready
      });

      this.authWindow.once('ready-to-show', () => {
        this.authWindow.show();
      });

      // Set up URL handling
      const handleUrl = (url) => {
        if (url.startsWith('harmony://oauth/callback')) {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (code) {
            console.log('Received auth code from Spotify');
            this.isSpotifyAuthenticated = true;
            this.spotifyAuthData = { code, timestamp: Date.now() };
            resolve({ success: true, code });
          } else if (error) {
            console.error('Received error from Spotify:', error);
            reject(new Error(`Authentication failed: ${error}`));
          }

          // Close the window after handling the callback
          if (this.authWindow) {
            this.authWindow.close();
            this.authWindow = null;
          }
        }
      };

      // Listen for URL changes
      this.authWindow.webContents.on('will-navigate', (event, url) => {
        console.log('Will navigate to:', url);
        handleUrl(url);
      });

      this.authWindow.webContents.on('will-redirect', (event, url) => {
        console.log('Will redirect to:', url);
        handleUrl(url);
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        if (!this.isSpotifyAuthenticated) {
          reject(new Error('Authentication window was closed'));
        }
      });

      console.log('Loading auth URL:', authUrl);
      this.authWindow.loadURL(authUrl).catch(err => {
        console.error('Failed to load auth URL:', err);
        reject(err);
      });
    });
  }
}

const authManager = new AuthManager();
module.exports = { authManager };