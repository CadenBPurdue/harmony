// src/renderer/App.jsx
import {
  Button,
  Container,
  Typography,
  Stack,
  Alert,
  Snackbar,
  Chip,
} from "@mui/material";
import React, { useState, useEffect } from "react";

console.log("Initial window.electronAPI check:", window.electronAPI);

function App() {
  const [error, setError] = useState(null);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [isAppleMusicConnected, setIsAppleMusicConnected] = useState(false);

  useEffect(() => {
    console.log("Window API state:", {
      hasWindow: typeof window !== "undefined",
      hasElectronAPI: typeof window.electronAPI !== "undefined",
      apis: window.electronAPI,
    });
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await window.electronAPI.getAuthStatus();
      setIsSpotifyConnected(status.isSpotifyAuthenticated);
      setIsAppleMusicConnected(status.isAppleMusicAuthenticated);
    } catch (err) {
      console.error("Failed to check auth status:", err);
    }
  };

  const handleSpotifyLogin = async () => {
    try {
      console.log("Starting Spotify login process...");
      const result = await window.electronAPI.connectSpotify();
      console.log("Spotify login result:", result);

      if (result.success) {
        setIsSpotifyConnected(true);
        setError({
          severity: "success",
          message: "Successfully connected to Spotify!",
        });
      }
    } catch (err) {
      console.error("Detailed login error:", err);
      setError({
        severity: "error",
        message: `Failed to connect to Spotify: ${err.message}`,
      });
      setIsSpotifyConnected(false);
    }
  };

  const handleAppleMusicLogin = async () => {
    try {
      console.log("Starting Apple Music login process...");
      const result = await window.electronAPI.connectAppleMusic();
      console.log("Apple Music login result:", result);

      if (result.success) {
        setIsAppleMusicConnected(true);
        setError({
          severity: "success",
          message: "Successfully connected to Apple Music!",
        });
      }
    } catch (err) {
      console.error("Apple Music login error:", err);
      setError({
        severity: "error",
        message: `Failed to connect to Apple Music: ${err.message}`,
      });
      setIsAppleMusicConnected(false);
    }
  };

  return (
    <Container>
      <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>
        Welcome to Harmony!
      </Typography>

      {/* Connection Status */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="subtitle2">Status:</Typography>
        <Chip
          label={
            isSpotifyConnected
              ? "Connected to Spotify"
              : "Spotify Not Connected"
          }
          color={isSpotifyConnected ? "success" : "default"}
        />
        <Chip
          label={
            isAppleMusicConnected
              ? "Connected to Apple Music"
              : "Apple Music Not Connected"
          }
          color={isAppleMusicConnected ? "success" : "default"}
        />
      </Stack>

      {/* Action Buttons */}
      <Stack spacing={2} direction="row" sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleSpotifyLogin}
          color={isSpotifyConnected ? "success" : "primary"}
        >
          {isSpotifyConnected ? "Reconnect Spotify" : "Connect to Spotify"}
        </Button>
        <Button
          variant="contained"
          onClick={handleAppleMusicLogin}
          color={isAppleMusicConnected ? "success" : "primary"}
        >
          {isAppleMusicConnected
            ? "Reconnect Apple Music"
            : "Connect to Apple Music"}
        </Button>
      </Stack>

      {/* Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert
          severity={error?.severity || "error"}
          onClose={() => setError(null)}
        >
          {error?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
