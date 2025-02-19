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
      console.log(
        "[CreateAccount] Next button clicked, current auth status:",
        JSON.stringify(authStatus, null, 2),
      );
      if (authStatus.isGoogleConnected) {
        console.log("[CreateAccount] Google is connected, navigating to /");
        // Use window.location for a full page refresh to avoid potential state issues
        window.location.href = "/";
      } else {
        console.error(
          "[CreateAccount] Attempted to navigate without Google connection",
        );
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
        <Box sx={styles.pageContainer}>
          <Box sx={styles.contentContainer}>
            <Box sx={styles.headerContainer}>
              <Typography 
                variant="h3" 
                sx={{ color: 'primary.main', mb: 1 }}
              >
                Welcome to Harmony
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ color: 'text.secondary' }}
              >
                Sign in to start sharing your music
              </Typography>
            </Box>
  
            <Paper 
              elevation={3} 
              sx={styles.paper}
            >
              <Stack spacing={3} sx={{ width: '100%' }}>
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
                      <Typography 
                        variant="body2" 
                        sx={styles.dividerText}
                      >
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
                          '#191414',
                          'spotify'
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
                          '#000000',
                          'apple'
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
                    <CircularProgress sx={{ color: 'primary.main' }} />
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