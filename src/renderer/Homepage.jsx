// src/renderer/Homepage.jsx
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  CircularProgress,
  Collapse,
  Snackbar,
  Alert,
  ListItemButton,
  Drawer,
  IconButton,
  Stack,
  ThemeProvider,
  CssBaseline,
  Tooltip,
} from "@mui/material";
import { useMediaQuery } from "@mui/material";
import {
  ChevronDown,
  ChevronUp,
  Menu as MenuIcon,
  RefreshCw,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { theme, styles, colors } from "./styles/theme";

// Function to format duration from milliseconds to MM:SS format
const formatDuration = (milliseconds) => {
  if (!milliseconds) return "--:--";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const normalizeTrackData = (trackItem, isArrayFormat) => {
  // If the tracks are in array format (like Spotify)
  if (isArrayFormat) {
    return trackItem;
  }

  // If the tracks are in object format (like Apple Music)
  // trackItem will be [id, trackData]
  return trackItem[1];
};

function Homepage() {
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [spotifyOpen, setSpotifyOpen] = useState(true);
  const [appleMusicOpen, setAppleMusicOpen] = useState(true);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [appleMusicPlaylists, setAppleMusicPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Track loading status
  const [appleMusicStatus, setAppleMusicStatus] = useState({
    loaded: 0,
    total: 0,
    isComplete: false,
  });

  // Transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferDestination, setTransferDestination] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  // Loading state for both services
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);

  // Poll Apple Music playlist loading status
  const pollAppleMusicStatus = useCallback(() => {
    // Only poll if we have Apple Music playlists that may still be loading
    if (appleMusicPlaylists.length === 0 || appleMusicStatus.isComplete) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        // Check the loading status
        const status = await window.electronAPI.getAppleMusicStatus();
        setAppleMusicStatus(status);

        if (status.isComplete) {
          console.log(
            "[Homepage] Apple Music loading complete, refreshing playlists",
          );
          clearInterval(pollInterval);

          // Refresh the playlists to get final data
          const updatedPlaylists =
            await window.electronAPI.getAppleMusicLibrary(true);
          setAppleMusicPlaylists(updatedPlaylists);

          // If we have a selected Apple Music playlist, update it
          if (selectedPlaylist && selectedPlaylist.origin === "Apple Music") {
            const updatedSelected = updatedPlaylists.find(
              (p) => p.playlist_id === selectedPlaylist.playlist_id,
            );

            if (updatedSelected) {
              setSelectedPlaylist(updatedSelected);
            }
          }
        }
      } catch (error) {
        console.error("Error polling Apple Music status:", error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(pollInterval);
  }, [appleMusicPlaylists, appleMusicStatus.isComplete, selectedPlaylist]);

  // Set up polling when Apple Music playlists change
  useEffect(() => {
    const cleanup = pollAppleMusicStatus();
    return cleanup;
  }, [pollAppleMusicStatus]);

  // Set up listener for when individual playlists finish loading
  useEffect(() => {
    const handlePlaylistLoaded = (playlistInfo) => {
      console.log("Playlist loaded:", playlistInfo);

      if (playlistInfo.origin === "Apple Music") {
        setAppleMusicPlaylists((prevPlaylists) =>
          prevPlaylists.map((playlist) =>
            playlist.playlist_id === playlistInfo.id
              ? { ...playlist, isLoading: false }
              : playlist,
          ),
        );

        // Also update selected playlist if it's the one that just loaded
        if (
          selectedPlaylist &&
          selectedPlaylist.playlist_id === playlistInfo.id
        ) {
          setSelectedPlaylist((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    // Check if onPlaylistLoaded is available in the API
    if (window.electronAPI.onPlaylistLoaded) {
      window.electronAPI.onPlaylistLoaded(handlePlaylistLoaded);
    }

    // Clean up on unmount
    return () => {
      // Ideally, unregister the listener here if your preload script supports it
    };
  }, [selectedPlaylist]);

  // Open transfer dialog
  const openTransferDialog = () => {
    // Set destination to the opposite of current playlist source
    const destination =
      selectedPlaylist?.origin === "Spotify" ? "Apple Music" : "Spotify";
    setTransferDestination(destination);
    setShowTransferDialog(true);
  };

  // Close transfer dialog
  const closeTransferDialog = () => {
    setShowTransferDialog(false);
  };

  // Handle transfer function
  const handleTransfer = async () => {
    setIsTransferring(true);

    try {
      let result = null;
      if (transferDestination === "Spotify") {
        result = await window.electronAPI.transferToSpotify(selectedPlaylist);
      } else if (transferDestination === "Apple Music") {
        result =
          await window.electronAPI.transferToAppleMusic(selectedPlaylist);
      }

      if (result && result.success) {
        // reload playlists from destination
        if (transferDestination === "Spotify") {
          refreshSpotifyPlaylists();
        } else if (transferDestination === "Apple Music") {
          refreshAppleMusicPlaylists();
        }

        setShowTransferDialog(false);
        setShowSuccessAlert(true);
        setTimeout(() => {
          setShowSuccessAlert(false);
        }, 3000);
      } else {
        alert("Transfer failed: " + (result?.error || "Unknown error"));
      }
    } catch (error) {
      alert("Transfer error: " + (error.message || "Unknown error"));
    } finally {
      setIsTransferring(false);
    }
  };

  const refreshSpotifyPlaylists = () => {
    setLoadingSpotify(true);
    window.electronAPI
      .getSpotifyLibrary()
      .then((playlists) => {
        setSpotifyPlaylists(playlists);

        // Added from main version: Send playlists to Firebase if needed
        if (window.electronAPI.transferPlaylistToFirebase) {
          playlists.forEach((playlist) => {
            window.electronAPI.transferPlaylistToFirebase(playlist);
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching Spotify playlists:", error);
      })
      .finally(() => {
        setLoadingSpotify(false);
      });
  };

  const refreshAppleMusicPlaylists = () => {
    setLoadingAppleMusic(true);
    window.electronAPI
      .getAppleMusicLibrary()
      .then((playlists) => {
        setAppleMusicPlaylists(playlists);

        // Added from main version: Send playlists to Firebase if needed
        if (window.electronAPI.transferPlaylistToFirebase) {
          playlists.forEach((playlist) => {
            window.electronAPI.transferPlaylistToFirebase(playlist);
          });
        }

        // Check if any playlists are still loading
        const hasLoadingPlaylists = playlists.some((p) => p.isLoading);
        if (hasLoadingPlaylists) {
          // Get initial status
          if (window.electronAPI.getAppleMusicStatus) {
            window.electronAPI
              .getAppleMusicStatus()
              .then((status) => {
                setAppleMusicStatus(status);
              })
              .catch((error) => {
                console.error("Error getting Apple Music status:", error);
              });
          }
        } else {
          setAppleMusicStatus({
            loaded: playlists.length,
            total: playlists.length,
            isComplete: true,
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching Apple Music playlists:", error);
      })
      .finally(() => {
        setLoadingAppleMusic(false);
      });
  };

  // Check auth status
  useEffect(() => {
    window.electronAPI.getAuthStatus().then((status) => {
      console.log("Auth status:", status);
      if (status.isSpotifyAuthenticated) {
        refreshSpotifyPlaylists();
      }
      if (status.isAppleMusicAuthenticated) {
        refreshAppleMusicPlaylists();
      }
    });
  }, []);

  // Helper function to check if playlist is selected
  const isPlaylistSelected = (playlist) => {
    if (!selectedPlaylist) return false;

    // Check if this is an Apple Music playlist (has different structure)
    if (
      playlist.origin === "Apple Music" &&
      selectedPlaylist.origin === "Apple Music"
    ) {
      return selectedPlaylist.playlist_id === playlist.playlist_id;
    }

    // For other cases, use the existing comparison logic
    if (selectedPlaylist.playlist_id && playlist.playlist_id) {
      return selectedPlaylist.playlist_id === playlist.playlist_id;
    }

    return (
      selectedPlaylist.name === playlist.name &&
      selectedPlaylist.origin === playlist.origin
    );
  };

  // Handle playlist click
  const handlePlaylistClick = (playlist) => {
    // If the playlist is still loading and is from Apple Music, we can try to get the latest version
    if (
      playlist.isLoading &&
      playlist.origin === "Apple Music" &&
      window.electronAPI.getAppleMusicPlaylist
    ) {
      window.electronAPI
        .getAppleMusicPlaylist(playlist.playlist_id)
        .then((updatedPlaylist) => {
          if (updatedPlaylist && !updatedPlaylist.isLoading) {
            // Update the selected playlist
            setSelectedPlaylist(updatedPlaylist);

            // Also update it in the playlist list
            setAppleMusicPlaylists((prevPlaylists) =>
              prevPlaylists.map((p) =>
                p.playlist_id === updatedPlaylist.playlist_id
                  ? updatedPlaylist
                  : p,
              ),
            );
          } else {
            // If still loading, just set what we have
            setSelectedPlaylist(playlist);
          }
        })
        .catch((error) => {
          console.error("Error fetching playlist details:", error);
          setSelectedPlaylist(playlist);
        });
    } else {
      setSelectedPlaylist(playlist);
    }

    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const toggleDrawer = (open) => (event) => {
    if (
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }
    setMobileDrawerOpen(open);
  };

  // Updated playlist item style with darker background colors
  const playlistItemStyle = (isSelected) => ({
    pl: 2,
    borderRadius: 1,
    mb: 0.5,
    "&:hover": {
      bgcolor: "rgba(134, 97, 193, 0.15)", // amethyst color with 15% opacity for hover
    },
    bgcolor: isSelected
      ? "rgba(134, 97, 193, 0.3)" // amethyst color with 30% opacity for selected
      : "rgba(134, 97, 193, 0.05)", // light amethyst background for all playlist items
    transition: "background-color 0.2s ease",
  });

  const renderPlaylistItem = (playlist, index) => (
    <ListItemButton
      key={index}
      onClick={() => handlePlaylistClick(playlist)}
      sx={playlistItemStyle(isPlaylistSelected(playlist))}
    >
      <ListItemText
        primary={playlist.name}
        primaryTypographyProps={{
          color: "text.primary",
          noWrap: true,
          fontSize: 14,
          fontWeight: isPlaylistSelected(playlist) ? "medium" : "regular",
        }}
      />
      {playlist.isLoading && (
        <Tooltip title="Loading tracks...">
          <CircularProgress size={16} sx={{ ml: 1, color: "primary.light" }} />
        </Tooltip>
      )}
    </ListItemButton>
  );

  // Updated dropdown header style to match the new design
  const dropdownHeaderStyle = {
    borderRadius: 1,
    mb: 1,
    bgcolor: colors.amethyst,
    color: "white",
    "&:hover": {
      bgcolor: "#8a67c2", // slightly lighter than amethyst for hover
    },
  };

  const sidebarContent = (
    <Box
      sx={{
        width: 250,
        bgcolor: theme.palette.background.paper,
        height: "100%",
      }}
    >
      <List component="nav" sx={{ p: 2 }}>
        {/* Spotify Dropdown */}
        <ListItem
          button
          onClick={() => setSpotifyOpen(!spotifyOpen)}
          sx={dropdownHeaderStyle}
        >
          <ListItemText
            primary="Spotify"
            primaryTypographyProps={{
              fontWeight: "bold",
              color: "white",
            }}
          />
          {spotifyOpen ? (
            <ChevronUp color="white" size={18} />
          ) : (
            <ChevronDown color="white" size={18} />
          )}
        </ListItem>

        <Collapse in={spotifyOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {loadingSpotify ? (
              <ListItem sx={{ pl: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                    py: 1,
                  }}
                >
                  <CircularProgress size={24} sx={{ color: "primary.main" }} />
                </Box>
              </ListItem>
            ) : (
              spotifyPlaylists.map((playlist, index) =>
                renderPlaylistItem(playlist, index),
              )
            )}

            {spotifyPlaylists.length === 0 && !loadingSpotify && (
              <ListItem sx={{ pl: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  No playlists found
                </Typography>
              </ListItem>
            )}
          </List>
        </Collapse>

        {/* Apple Music Dropdown */}
        <ListItem
          button
          onClick={() => setAppleMusicOpen(!appleMusicOpen)}
          sx={dropdownHeaderStyle}
        >
          <ListItemText
            primary="Apple Music"
            primaryTypographyProps={{
              fontWeight: "bold",
              color: "white",
            }}
          />
          {!appleMusicStatus.isComplete && appleMusicStatus.total > 0 ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mr: 1,
                position: "relative",
              }}
            >
              {/* Background track (lighter color) */}
              <CircularProgress
                size={20}
                variant="determinate"
                value={100}
                sx={{
                  color: "rgba(255, 255, 255, 0.3)",
                  position: "absolute",
                }}
              />
              {/* Foreground progress (filled portion) */}
              <CircularProgress
                size={20}
                variant="determinate"
                value={(appleMusicStatus.loaded / appleMusicStatus.total) * 100}
                sx={{ color: "white" }}
              />
              <Typography variant="caption" sx={{ ml: 1.5, color: "white" }}>
                {Math.round(
                  (appleMusicStatus.loaded / appleMusicStatus.total) * 100,
                )}
                %
              </Typography>
            </Box>
          ) : null}
          {appleMusicOpen ? (
            <ChevronUp color="white" size={18} />
          ) : (
            <ChevronDown color="white" size={18} />
          )}
        </ListItem>

        <Collapse in={appleMusicOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {appleMusicPlaylists.map((playlist, index) =>
              renderPlaylistItem(playlist, index),
            )}

            {appleMusicPlaylists.length === 0 && !loadingAppleMusic && (
              <ListItem sx={{ pl: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  No playlists found
                </Typography>
              </ListItem>
            )}
          </List>
        </Collapse>
      </List>
    </Box>
  );

  const renderPlaylistDetails = () => {
    if (!selectedPlaylist) {
      return (
        <Paper sx={{ ...styles.paper, textAlign: "center", py: 6 }}>
          <Typography variant="h6" color="text.primary" sx={{ mb: 1 }}>
            Select a playlist to view its tracks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose from your Spotify or Apple Music playlists in the sidebar
          </Typography>
        </Paper>
      );
    }

    // If the playlist is still loading
    if (selectedPlaylist.isLoading) {
      return (
        <Paper sx={{ ...styles.paper, textAlign: "center", py: 6 }}>
          <CircularProgress size={40} sx={{ mb: 3, color: "primary.main" }} />
          <Typography variant="h6" color="text.primary" sx={{ mb: 1 }}>
            Loading playlist tracks...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This may take a moment for large playlists
          </Typography>
        </Paper>
      );
    }

    // Determine if we're dealing with array or object tracks
    const isArrayTracks = Array.isArray(selectedPlaylist.tracks);
    const trackItems = isArrayTracks
      ? selectedPlaylist.tracks
      : Object.entries(selectedPlaylist.tracks);

    return (
      <Box>
        {/* Header with playlist info and transfer button */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            mb: 3,
            gap: 2,
            width: "100%", // Ensure this takes full width
          }}
        >
          <Box sx={{ maxWidth: "70%" }}>
            {" "}
            {/* Limit width to prevent overflow */}
            <Typography variant="h5" color="text.primary" sx={{ mb: 0.5 }}>
              {selectedPlaylist.name}
            </Typography>
            {/* Only show user info if it's not empty */}
            {selectedPlaylist.user && (
              <Typography variant="body2" color="text.secondary">
                User: {selectedPlaylist.user}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              Tracks: {selectedPlaylist.number_of_tracks} • Duration:{" "}
              {formatDuration(selectedPlaylist.duration)}
            </Typography>
          </Box>
          {isTransferring ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} sx={{ color: "secondary.main" }} />
              <Typography variant="button" sx={{ color: "secondary.main" }}>
                Transferring...
              </Typography>
            </Box>
          ) : (
            <Button
              variant="contained"
              onClick={openTransferDialog}
              sx={styles.continueButton}
            >
              Transfer
            </Button>
          )}
        </Box>

        {/* Tracks Table */}
        <Paper
          sx={{
            ...styles.paper,
            p: 0,
            overflow: "auto",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <TableContainer sx={{ maxWidth: "100%" }}>
            <Table stickyHeader aria-label="playlist tracks table">
              <TableHead>
                <TableRow>
                  <TableCell
                    width="5%"
                    sx={{ bgcolor: "rgba(134, 97, 193, 0.05)" }}
                  >
                    #
                  </TableCell>
                  <TableCell
                    width="35%"
                    sx={{ bgcolor: "rgba(134, 97, 193, 0.05)" }}
                  >
                    Song
                  </TableCell>
                  <TableCell
                    width="25%"
                    sx={{ bgcolor: "rgba(134, 97, 193, 0.05)" }}
                  >
                    Artist
                  </TableCell>
                  <TableCell
                    width="25%"
                    sx={{
                      display: { xs: "none", md: "table-cell" },
                      bgcolor: "rgba(134, 97, 193, 0.05)",
                    }}
                  >
                    Album
                  </TableCell>
                  <TableCell
                    width="10%"
                    align="right"
                    sx={{ bgcolor: "rgba(134, 97, 193, 0.05)" }}
                  >
                    Duration
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trackItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No tracks available
                    </TableCell>
                  </TableRow>
                ) : (
                  trackItems.map((item, index) => {
                    // Get the track data based on the format
                    const track = isArrayTracks ? item : item[1];

                    return (
                      <TableRow
                        key={index}
                        sx={{
                          "&:nth-of-type(odd)": {
                            bgcolor: "rgba(134, 97, 193, 0.03)",
                          },
                          "&:hover": { bgcolor: "rgba(134, 97, 193, 0.08)" },
                        }}
                      >
                        <TableCell component="th" scope="row" sx={{ py: 1.5 }}>
                          {index + 1}
                        </TableCell>
                        <TableCell
                          sx={{
                            py: 1.5,
                            maxWidth: 0, // Force truncation
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {track.name}
                        </TableCell>
                        <TableCell
                          sx={{
                            py: 1.5,
                            maxWidth: 0, // Force truncation
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {track.artist}
                        </TableCell>
                        <TableCell
                          sx={{
                            display: { xs: "none", md: "table-cell" },
                            py: 1.5,
                            maxWidth: 0, // Force truncation
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {track.album}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          {formatDuration(track.duration)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          ...styles.pageContainer,
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          padding: 0,
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          {/* Sidebar - Hidden on mobile */}
          {!isMobile && (
            <Box
              sx={{
                width: 250,
                bgcolor: theme.palette.background.paper,
                borderRight: `1px solid ${theme.palette.divider}`,
                height: "100%",
                overflowY: "auto",
                // Make sure this has a minimum width and flex-shrink: 0 to prevent it from collapsing
                minWidth: 250,
                flexShrink: 0,
              }}
            >
              {sidebarContent}
            </Box>
          )}

          {/* Mobile drawer */}
          <Drawer
            anchor="left"
            open={mobileDrawerOpen}
            onClose={toggleDrawer(false)}
            sx={{ display: { xs: "block", sm: "none" } }}
            PaperProps={{
              sx: {
                bgcolor: theme.palette.background.paper,
              },
            }}
          >
            {sidebarContent}
          </Drawer>

          {/* Main Content */}
          <Box
            sx={{
              flex: 1,
              bgcolor: theme.palette.background.default,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.background.paper,
              }}
            >
              {isMobile && (
                <IconButton
                  onClick={toggleDrawer(true)}
                  sx={{ mr: 2, color: theme.palette.text.primary }}
                  aria-label="open menu"
                >
                  <MenuIcon />
                </IconButton>
              )}
              <Typography
                variant="h4"
                color="primary.main"
                sx={{ fontWeight: "bold", mr: "auto" }}
              >
                Harmony
              </Typography>

              {/* Refresh button for Apple Music */}
              {!appleMusicStatus.isComplete &&
                appleMusicStatus.total > 0 &&
                window.electronAPI.getAppleMusicStatus && (
                  <Tooltip title="Check for loaded playlists">
                    <IconButton
                      onClick={() =>
                        window.electronAPI
                          .getAppleMusicStatus()
                          .then(setAppleMusicStatus)
                      }
                      sx={{ ml: 1, color: theme.palette.primary.main }}
                    >
                      <RefreshCw size={20} />
                    </IconButton>
                  </Tooltip>
                )}
            </Box>

            {/* Scrollable content area */}
            <Box
              sx={{
                p: 2,
                overflowY: "auto",
                flex: 1,
              }}
            >
              {renderPlaylistDetails()}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Transfer Dialog */}
      <Dialog
        open={showTransferDialog}
        onClose={closeTransferDialog}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 8px 24px rgba(134, 97, 193, 0.12)",
          },
        }}
      >
        <DialogTitle sx={{ color: "text.primary", textAlign: "center", pt: 3 }}>
          Transfer Playlist
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Playlist
              </Typography>
              <TextField
                fullWidth
                value={selectedPlaylist?.name || ""}
                disabled
                variant="outlined"
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: theme.palette.text.secondary,
                  },
                }}
              />
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Source
              </Typography>
              <TextField
                fullWidth
                value={selectedPlaylist?.origin || ""}
                disabled
                variant="outlined"
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: theme.palette.text.secondary,
                  },
                }}
              />
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Destination
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={transferDestination}
                  onChange={(e) => setTransferDestination(e.target.value)}
                >
                  <MenuItem value="Spotify">Spotify</MenuItem>
                  <MenuItem value="Apple Music">Apple Music</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={closeTransferDialog}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isTransferring}
            variant="contained"
            sx={styles.continueButton}
          >
            {isTransferring ? "Transferring..." : "Transfer"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Alert */}
      <Snackbar
        open={showSuccessAlert}
        autoHideDuration={3000}
        onClose={() => setShowSuccessAlert(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowSuccessAlert(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          Playlist transferred successfully!
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default Homepage;
