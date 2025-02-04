// src/renderer/App.jsx
import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Container, 
  Typography, 
  Stack,
  Alert,
  Snackbar,
  Chip
} from '@mui/material';

function App() {
  const [error, setError] = useState(null);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);

  // Check auth status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await window.electronAPI.getAuthStatus();
      setIsSpotifyConnected(status.isSpotifyAuthenticated);
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  const handleSpotifyLogin = async () => {
    try {
      const result = await window.electronAPI.connectSpotify();
      if (result.success) {
        setIsSpotifyConnected(true);
        // Show success message
        setError({ severity: 'success', message: 'Successfully connected to Spotify!' });
      }
    } catch (err) {
      console.error('Failed to connect to Spotify:', err);
      setError({ severity: 'error', message: 'Failed to connect to Spotify. Please try again.' });
      setIsSpotifyConnected(false);
    }
  };

  return (
    <Container>
      <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>
        Welcome to Harmony!
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 4 }}>
        Authors: Adam Kahl, Caden Brennan, Ethan Burmane
      </Typography>
      
      {/* Connection Status */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="subtitle2">Status:</Typography>
        <Chip 
          label={isSpotifyConnected ? "Connected to Spotify" : "Not Connected"}
          color={isSpotifyConnected ? "success" : "default"}
        />
      </Stack>

      {/* Action Buttons */}
      <Stack spacing={2} direction="row">
        <Button 
          variant="contained" 
          onClick={handleSpotifyLogin}
          color={isSpotifyConnected ? "success" : "primary"}
        >
          {isSpotifyConnected ? 'Reconnect Spotify' : 'Connect Spotify'}
        </Button>
        <Button variant="contained" onClick={() => {}}>
          Connect Apple Music
        </Button>
      </Stack>

      {/* Notifications */}
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
      >
        <Alert 
          severity={error?.severity || 'error'} 
          onClose={() => setError(null)}
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;