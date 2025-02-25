// src/renderer/App.jsx
import {
  Button,
  Container,
  Typography,
  Stack,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
} from "@mui/material";
import React, { useState, useEffect } from "react";

// Main App component with optimized load time
function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [isAppleMusicConnected, setIsAppleMusicConnected] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  console.log("[App] Component rendered");

  useEffect(() => {
    console.log("[App] Running useEffect");
    const checkAuth = async () => {
      try {
        console.log("[App] Checking auth status");
        const status = await window.electronAPI.getAuthStatus();
        console.log("[App] Auth status received:", status);

        setIsSpotifyConnected(status.isSpotifyAuthenticated);
        setIsAppleMusicConnected(status.isAppleMusicAuthenticated);
        setIsGoogleConnected(status.isGoogleAuthenticated);

        if (!status.isGoogleAuthenticated) {
          console.warn(
            "[App] User not authenticated with Google, should not be here",
          );
        }

        setIsLoading(false);
        window.electronAPI.connectFirebase();
      } catch (err) {
        console.error("[App] Failed to check auth status:", err);
        setError("Failed to initialize application");
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleSpotifyLogin = async () => {
    try {
      const result = await window.electronAPI.connectSpotify();
      if (result.success) {
        setIsSpotifyConnected(true);
        // Show success message
        setError({
          severity: "success",
          message: "Successfully connected to Spotify!",
        });
      }
    } catch (err) {
      console.error("Failed to connect to Spotify:", err);
      setError({
        severity: "error",
        message: "Failed to connect to Spotify. Please try again.",
      });
      setIsSpotifyConnected(false);
    }
  };

  const handleAppleMusicLogin = async () => {
    try {
      const result = await window.electronAPI.connectAppleMusic();
      if (result.success) {
        setIsAppleMusicConnected(true);
        setError({
          severity: "success",
          message: "Successfully connected to Apple Music!",
        });
      }
    } catch (err) {
      console.error("Failed to connect to Apple Music:", err);
      setError({
        severity: "error",
        message: `Failed to connect to Apple Music: ${err.message}`,
      });
      setIsAppleMusicConnected(false);
    }
  };

  const testFirebaseStorage = async () => {
    try {
      const playlist = {
        id: "7dNySe6is1ETaEBmDD5TPp",
        name: "app-test1",
        user: "ebtuhr",
        origin: "Spotfiy",
        numberOfTracks: 4,
        duration: 12000,
        description: "",
        sharedWith: ["demo_user_id"],
        image:
          "https://i.scdn.co/image/ab67616d00001e02124e9249fada4ff3c3a0739c",
        tracks: [
          {
            name: "St. Chroma (feat. Daniel Caesar)",
            artist: "Tyler, The Creator",
            album: "CHROMAKOPIA",
            duration: 197019,
            image:
              "https://i.scdn.co/image/ab67616d0000b273124e9249fada4ff3c3a0739c",
          },
          {
            name: "squabble up",
            artist: "Kendrick Lamar",
            album: "GNX",
            duration: 157992,
            image:
              "https://i.scdn.co/image/ab67616d0000b273d9985092cd88bffd97653b58",
          },
          {
            name: "BIRDS OF A FEATHER",
            artist: "Billie Eilish",
            album: "HIT ME HARD AND SOFT",
            duration: 210373,
            image:
              "https://i.scdn.co/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62",
          },
          {
            name: "New Track",
            artist: "New Artist",
            album: "New Album",
            duration: 200000,
            image: "https://i.scdn.co/image/ab67616d0000b273newtrackimage",
          },
        ],
      };
      const result =
        await window.electronAPI.writePlaylistToFirestore(playlist);
      console.log(result);
    } catch (err) {
      console.error("Failed to test Firebase Storage:", err);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Loading Harmony...
        </Typography>
        <CircularProgress />
      </Container>
    );
  }

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
          label={
            isSpotifyConnected
              ? "Connected to Spotify"
              : "Not Connected to Spotify"
          }
          color={isSpotifyConnected ? "success" : "default"}
        />
        <Chip
          label={
            isAppleMusicConnected
              ? "Connected to Apple Music"
              : "Not Connected to Apple Music"
          }
          color={isAppleMusicConnected ? "success" : "default"}
        />
        <Chip
          label={
            isGoogleConnected
              ? "Connected to Google"
              : "Not Connected to Google"
          }
          color={isGoogleConnected ? "success" : "default"}
        />
      </Stack>

      {/* Action Buttons */}
      <Stack spacing={2} direction="row">
        <Button
          variant="contained"
          onClick={handleSpotifyLogin}
          color={isSpotifyConnected ? "success" : "primary"}
        >
          {isSpotifyConnected ? "Reconnect Spotify" : "Connect Spotify"}
        </Button>
        <Button
          variant="contained"
          onClick={handleAppleMusicLogin}
          color={isAppleMusicConnected ? "success" : "primary"}
        >
          {isAppleMusicConnected
            ? "Reconnect Apple Music"
            : "Connect Apple Music"}
        </Button>
        <Button variant="contained" onClick={testFirebaseStorage}>
          Test Firebase Storage
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
