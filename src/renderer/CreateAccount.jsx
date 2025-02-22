// src/renderer/CreateAccount.jsx
import {
  Typography,
  Button,
  Stack,
  Paper,
  Box,
  Alert,
  CircularProgress,
  Divider,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import { Music2Icon, AppleIcon, ArrowRightIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { theme, styles } from "./styles/theme";

const CreateAccount = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authStatus, setAuthStatus] = useState({
    isGoogleConnected: false,
    isSpotifyConnected: false,
    isAppleMusicConnected: false,
  });

  const checkAuthStatus = async () => {
    console.log("[CreateAccount] Checking auth status...");
    try {
      const status = await window.electronAPI.getAuthStatus();
      console.log(
        "[CreateAccount] Auth status details:",
        JSON.stringify(status, null, 2),
      );
      setAuthStatus({
        isGoogleConnected: status.isGoogleAuthenticated,
        isSpotifyConnected: status.isSpotifyAuthenticated,
        isAppleMusicConnected: status.isAppleMusicAuthenticated,
      });

      // Log the updated state
      console.log(
        "[CreateAccount] Updated component state:",
        JSON.stringify(
          {
            isGoogleConnected: status.isGoogleAuthenticated,
            isSpotifyConnected: status.isSpotifyAuthenticated,
            isAppleMusicConnected: status.isAppleMusicAuthenticated,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      console.error("[CreateAccount] Failed to check auth status:", err);
      setError("Failed to check authentication status");
    }
  };

  useEffect(() => {
    console.log("[CreateAccount] Component mounted");
    checkAuthStatus();
  }, []);

  const handleGoogleSignIn = async () => {
    console.log("[CreateAccount] Starting Google sign in...");
    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.connectFirebase();
      console.log(
        "[CreateAccount] Google sign in result:",
        JSON.stringify(result, null, 2),
      );
      if (result.success) {
        await checkAuthStatus(); // Refresh auth status
      } else if (result.cancelled) {
        setError("Google sign-in was cancelled");
      }
    } catch (err) {
      console.error("[CreateAccount] Failed to connect to Google:", err);
      setError("Failed to connect with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (authStatus.isGoogleConnected) {
      console.log("[CreateAccount] Google is connected, navigating to /");

      setLoading(true);

      // Update window mode first
      window.electronAPI
        .setWindowMode(false)
        .then(() => {
          console.log("[CreateAccount] Window mode set, now navigating");

          // Use a combination of approaches for maximum compatibility
          try {
            // Try hash-based navigation first
            window.location.hash = "#/";

            // Set a timeout to check if navigation worked
            setTimeout(() => {
              if (
                window.location.hash !== "#/" &&
                window.location.hash !== "#"
              ) {
                console.log(
                  "[CreateAccount] Hash navigation might have failed, trying alternate method",
                );
                window.location.href = "./index.html#/"; // Try with relative path
              }
            }, 300);
          } catch (error) {
            console.error("[CreateAccount] Navigation error:", error);
            // Last resort
            window.location.replace("#/");
          }
        })
        .catch((err) => {
          console.error("[CreateAccount] Error setting window mode:", err);
          // Try to navigate anyway
          window.location.hash = "#/";
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setError("Please connect with Google before continuing");
    }
  };

  const handleSpotifyConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.connectSpotify();
      console.log(
        "[CreateAccount] Spotify connect result:",
        JSON.stringify(result, null, 2),
      );
      if (result.success) {
        await checkAuthStatus(); // Refresh auth status
      }
    } catch (err) {
      console.error("[CreateAccount] Failed to connect to Spotify:", err);
      setError("Failed to connect with Spotify. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleMusicConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.connectAppleMusic();
      console.log(
        "[CreateAccount] Apple Music connect result:",
        JSON.stringify(result, null, 2),
      );
      if (result.success) {
        await checkAuthStatus(); // Refresh auth status
      }
    } catch (err) {
      console.error("[CreateAccount] Failed to connect to Apple Music:", err);
      setError("Failed to connect with Apple Music. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden", // This prevents scrolling
          ...styles.pageContainer,
          padding: 0, // Override any padding from pageContainer
        }}
      >
        <Box
          sx={{
            ...styles.contentContainer,
            overflowY: "auto", // Allow scrolling only within the content if needed
            height: "100%",
            maxHeight: "680px", // Match your window height
            paddingTop: "40px",
          }}
        >
          <Box sx={styles.headerContainer}>
            <Typography variant="h3" sx={{ color: "primary.main", mb: 1 }}>
              Welcome to Harmony
            </Typography>
            <Typography variant="h6" sx={{ color: "text.secondary" }}>
              Sign in to start sharing your music
            </Typography>
          </Box>

          <Paper elevation={3} sx={styles.paper}>
            <Stack spacing={3} sx={{ width: "100%" }}>
              {error && (
                <Alert
                  severity="error"
                  onClose={() => setError(null)}
                  sx={styles.alert}
                >
                  {error}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                onClick={handleGoogleSignIn}
                disabled={loading || authStatus.isGoogleConnected}
                sx={styles.googleButton(authStatus.isGoogleConnected)}
              >
                {authStatus.isGoogleConnected
                  ? "Connected with Google"
                  : "Sign in with Google"}
              </Button>

              {authStatus.isGoogleConnected && (
                <>
                  <Divider sx={styles.divider}>
                    <Typography variant="body2" sx={styles.dividerText}>
                      Connect Your Music Services (Optional)
                    </Typography>
                  </Divider>

                  <Stack sx={styles.serviceButtonsContainer}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleSpotifyConnect}
                      disabled={loading}
                      startIcon={<Music2Icon />}
                      sx={styles.musicServiceButton(
                        authStatus.isSpotifyConnected,
                        "#191414",
                        "spotify",
                      )}
                    >
                      {authStatus.isSpotifyConnected
                        ? "Spotify Connected"
                        : "Connect Spotify"}
                    </Button>

                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleAppleMusicConnect}
                      disabled={loading}
                      startIcon={<AppleIcon />}
                      sx={styles.musicServiceButton(
                        authStatus.isAppleMusicConnected,
                        "#000000",
                        "apple",
                      )}
                    >
                      {authStatus.isAppleMusicConnected
                        ? "Apple Music Connected"
                        : "Connect Apple Music"}
                    </Button>
                  </Stack>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleNext}
                    endIcon={<ArrowRightIcon />}
                    sx={styles.continueButton}
                  >
                    Continue to App
                  </Button>
                </>
              )}

              {loading && (
                <Box sx={styles.loadingContainer}>
                  <CircularProgress sx={{ color: "primary.main" }} />
                </Box>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default CreateAccount;
