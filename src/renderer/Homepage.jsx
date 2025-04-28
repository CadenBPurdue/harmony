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
  Chip,
  Badge,
} from "@mui/material";
import { useMediaQuery } from "@mui/material";
import {
  ChevronDown,
  ChevronUp,
  Menu as MenuIcon,
  RefreshCw,
  Bell,
  Clock,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useNotifications } from "./NotificationContext";
import { theme, styles, colors } from "./styles/theme";

const fetchSharedPlaylists = async () => {
  window.electronAPI.debug("Fetching shared playlists...");

  const sharedPlaylistIds = await window.electronAPI.getSharedPlaylists();

  if (!sharedPlaylistIds || sharedPlaylistIds.length === 0) {
    return;
  }
  const currentUser = await window.electronAPI.getCurrentUserFromFirebase();

  sharedPlaylistIds.forEach(async (playlistId) => {
    const playlist =
      await window.electronAPI.getPlaylistFromFirebase(playlistId);
    const sharedPlaylistName = playlist.name;
    const storedPlaylistIds =
      await window.electronAPI.getPlaylistsFromFirebase();
    if (!storedPlaylistIds || storedPlaylistIds.length === 0) {
      return;
    }

    var storedPlaylistNames = [];
    storedPlaylistIds.forEach(async (storedPlaylistId) => {
      const storedPlaylist =
        await window.electronAPI.getPlaylistFromFirebase(storedPlaylistId);
      storedPlaylistNames.push(storedPlaylist.name);
    });

    const playlistExists = storedPlaylistNames.some(
      (name) => name === sharedPlaylistName,
    );

    if (!playlistExists) {
      if (currentUser.primaryService === "appleMusic") {
        await window.electronAPI.transferToAppleMusic(playlist);
      } else {
        await window.electronAPI.transferToSpotify(playlist);
      }
    }
  });
};

// Function to format duration from milliseconds to MM:SS format
const formatDuration = (milliseconds) => {
  if (!milliseconds) return "--:--";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

function formatTimestamp(timestamp) {
  if (!timestamp || typeof timestamp.seconds !== "number") {
    return "Invalid timestamp";
  }

  const date = new Date(timestamp.seconds * 1000);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

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

  const [spotifyStatus, setSpotifyStatus] = useState({
    loaded: 0,
    total: 0,
    isComplete: false,
  });

  // Transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferDestination, setTransferDestination] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [shareAsCopy, setShareAsCopy] = useState(false);

  // Loading state for both services
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);

  // User dropdown state
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("main");

  // User information state
  const [userInfo, setUserInfo] = useState(null);

  // Friends page state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [unfollowDialogOpen, setUnfollowDialogOpen] = useState(false);
  const [userToUnfollow, setUserToUnfollow] = useState(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    formatNotificationTime,
  } = useNotifications();

  // Function to fetch user information
  const fetchUserInfo = () => {
    window.electronAPI
      .getCurrentUserFromFirebase()
      .then((info) => {
        setUserInfo(info);
      })
      .catch((error) => {
        console.error("Error fetching user information:", error);
      });
  };

  // Navigate to a page
  const navigateTo = (page) => {
    setCurrentPage(page);
    setUserDropdownOpen(false); // Close the dropdown after selection
    fetchUserInfo();
  };

  // Function to handle friend search
  const handleSearch = async () => {
    if (!searchQuery) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(searchQuery)) {
      setSearchError("Invalid email format.");
      return;
    }

    setSearchLoading(true);
    setSearchResult(null);
    setSearchError("");

    try {
      // Make this an await call to properly handle the promise
      const users = await window.electronAPI.getUsersFromFirebase();

      if (!users || users.length === 0) {
        setSearchError("No users found.");
        setSearchLoading(false);
        return;
      }

      let foundUser = null;
      users.forEach((user) => {
        if (user.email === searchQuery) {
          foundUser = user;
        }
      });

      if (foundUser) {
        setSearchResult(foundUser);
      } else {
        setSearchError("No user found with that email or username.");
      }
    } catch (error) {
      console.error("Error searching for user:", error);
      setSearchError("An error occurred while searching. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAcceptRequest = async (notification) => {
    const fromUserId = notification.details.fromUserId;
    try {
      const result = await window.electronAPI.acceptFriendRequest(fromUserId);
      if (result.success) {
        // Show success notification
        addNotification({
          type: "info",
          message: `${notification.details.displayName || "A user"} is now your friend!`,
          read: false,
        });

        // Mark current notification as read (this will hide buttons)
        markAsRead(notification.id);

        // Optional: refresh friends list
        fetchFriends();
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  const handleDenyRequest = async (notification) => {
    const fromUserId = notification.details.fromUserId;
    try {
      const result = await window.electronAPI.denyFriendRequest(fromUserId);
      if (result.success) {
        addNotification({
          type: "info",
          message: `You declined a friend request from ${notification.details.displayName || "a user"}.`,
          read: false,
        });

        markAsRead(notification.id);
      }
    } catch (error) {
      console.error("Failed to deny request:", error);
    }
  };

  const handleConnectFriend = (userId) => {
    setConnectingId(userId);
    window.electronAPI
      .sendFriendRequest(userId)
      .then((result) => {
        if (result.success) {
          // Add notification
          addNotification({
            type: "friend_request_sent",
            message: `Friend request sent to ${searchQuery}.`,
            details: {
              userId: userId,
            },
          });

          // Clear search result and query after successful connection
          setSearchResult(null);
          setSearchQuery("");

          // Reload the friends list to reflect the new connection
          fetchFriends();
        } else {
          console.error("Error sending friend request:", result.error);
          addNotification({
            type: "error",
            message: `Failed to send friend request: ${result.error || "Unknown error"}`,
          });
        }
      })
      .catch((error) => {
        console.error("Exception sending friend request:", error);
        addNotification({
          type: "error",
          message: "Failed to send friend request due to an error",
        });
      })
      .finally(() => {
        setConnectingId(null);
      });
  };

  const handleRemoveFriend = (userId) => {
    if (!userId) {
      console.error("Cannot remove friend: Invalid user ID");
      return;
    }

    setRemovingId(userId);

    window.electronAPI
      .removeFriendFromUser(userId)
      .then((result) => {
        if (result.success) {
          addNotification({
            type: "friend_request_removed",
            message: `Friend removed successfully.`,
            details: {
              userId: userId,
            },
          });

          // Reload the complete friends list instead of just filtering the local state
          // This ensures our UI is in sync with the backend
          fetchFriends();
        } else {
          console.error("Error removing friend:", result.error);
          addNotification({
            type: "error",
            message: `Failed to remove friend: ${result.error || "Unknown error"}`,
          });
        }
      })
      .catch((error) => {
        console.error("Exception removing friend:", error);
        addNotification({
          type: "error",
          message: "Failed to remove friend due to an error",
        });
      })
      .finally(() => {
        setRemovingId(null);
      });
  };

  const openUnfollowDialog = (friend) => {
    setUserToUnfollow(friend);
    setUnfollowDialogOpen(true);
  };

  const confirmUnfollow = () => {
    if (userToUnfollow) {
      handleRemoveFriend(userToUnfollow.id);
      setUnfollowDialogOpen(false);
      setUserToUnfollow(null);
    }
  };

  // Function to fetch friends list
  const fetchFriends = () => {
    setFriendsLoading(true);
    setFriendsList([]);

    window.electronAPI
      .getFriendsFromFirebase()
      .then((response) => {
        if (response.length > 0) {
          const processedFriends = response.map((friend) => ({
            id: friend.id || friend.userId,
            displayName: friend.displayName || "Unknown User",
            email: friend.email || "No email provided",
          }));
          console.log("Processed friends:", processedFriends);
          setFriendsList(processedFriends);
        } else {
          console.log("No friends found or invalid response format");
          setFriendsList([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching friends list:", error);
        setFriendsList([]);
      })
      .finally(() => {
        setFriendsLoading(false);
      });
  };

  // Fetch friends when navigating to the friends page
  useEffect(() => {
    if (currentPage === "friends") {
      fetchFriends();
    }
  }, [currentPage]);

  // Fetch user info when the component mounts
  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchIncomingFriendRequests = async () => {
      try {
        const preUpdate = await window.electronAPI.getCurrentUserFromFirebase();
        await window.electronAPI.manageFriendRequests();
        const user = await window.electronAPI.getCurrentUserFromFirebase();

        user.friends.forEach(async (friend) => {
          if (!preUpdate.friends.includes(friend)) {
            const friendInfo =
              await window.electronAPI.getUserInfoFromFirebase(friend);
            await window.electronAPI.debug("Friend info:");
            await window.electronAPI.debug(friendInfo);
            await window.electronAPI.debug(friend);
            await window.electronAPI.debug(user);
            addNotification({
              type: "friend_request_accepted",
              message: `${friendInfo.email} accepted your friend request.`,
              details: {
                userId: friend.userId,
                displayName: friend.displayName,
                email: friend.email,
              },
            });
          }
        });

        const users = await window.electronAPI.getUsersFromFirebase();

        const requests = user.incomingFriendRequests || [];

        requests.forEach((fromId) => {
          const sender = users.find((u) => u.userId === fromId);
          if (sender) {
            addNotification({
              type: "friend_request_received",
              message: `${sender.displayName || "Someone"} sent you a friend request.`,
              details: {
                fromUserId: sender.userId,
                displayName: sender.displayName,
                email: sender.email,
              },
            });
          }
        });
      } catch (err) {
        console.error("Failed to fetch friend requests:", err);
      }
    };

    fetchIncomingFriendRequests();
  }, []);

  useEffect(() => {
    fetchSharedPlaylists();
  }, []);

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

  const pollSpotifyStatus = useCallback(() => {
    // Only poll if we have Spotify playlists that may still be loading
    if (spotifyPlaylists.length === 0 || spotifyStatus.isComplete) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        // Check the loading status
        const status = await window.electronAPI.getSpotifyStatus();
        setSpotifyStatus(status);

        if (status.isComplete) {
          console.log(
            "[Homepage] Spotify loading complete, refreshing playlists",
          );
          clearInterval(pollInterval);

          // Refresh the playlists to get final data
          const updatedPlaylists = await window.electronAPI.getSpotifyLibrary();
          setSpotifyPlaylists(updatedPlaylists);

          // If we have a selected Spotify playlist, update it
          if (selectedPlaylist && selectedPlaylist.origin === "Spotify") {
            const updatedSelected = updatedPlaylists.find(
              (p) => p.playlist_id === selectedPlaylist.playlist_id,
            );

            if (updatedSelected) {
              setSelectedPlaylist(updatedSelected);
            }
          }
        }
      } catch (error) {
        console.error("Error polling Spotify status:", error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(pollInterval);
  }, [spotifyPlaylists, spotifyStatus.isComplete, selectedPlaylist]);

  useEffect(() => {
    const cleanup = pollSpotifyStatus();
    return cleanup;
  }, [pollSpotifyStatus]);

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
      } else if (playlistInfo.origin === "Spotify") {
        setSpotifyPlaylists((prevPlaylists) =>
          prevPlaylists.map((playlist) =>
            playlist.playlist_id === playlistInfo.id
              ? { ...playlist, isLoading: false }
              : playlist,
          ),
        );
      }

      // Also update selected playlist if it's the one that just loaded
      if (
        selectedPlaylist &&
        selectedPlaylist.playlist_id === playlistInfo.id
      ) {
        setSelectedPlaylist((prev) => ({ ...prev, isLoading: false }));
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
    setTransferDestination("");
    setShareAsCopy(false); // Reset to default value
    fetchFriends();
    setShowTransferDialog(true);
  };

  // Close transfer dialog
  const closeTransferDialog = () => {
    setShowTransferDialog(false);
  };

  useEffect(() => {
    if (showTransferDialog && friendsList.length > 0 && !transferDestination) {
      setTransferDestination("Select a friend");
    }
  }, [showTransferDialog, friendsList]);

  const refreshSpotifyPlaylists = () => {
    setLoadingSpotify(true);
    window.electronAPI
      .getSpotifyLibrary()
      .then((playlists) => {
        setSpotifyPlaylists(playlists);

        // Check if any playlists are still loading
        const hasLoadingPlaylists = playlists.some((p) => p.isLoading);
        if (hasLoadingPlaylists) {
          // Get initial status
          window.electronAPI
            .getSpotifyStatus()
            .then((status) => {
              setSpotifyStatus(status);
            })
            .catch((error) => {
              console.error("Error getting Spotify status:", error);
            });
        } else {
          setSpotifyStatus({
            loaded: playlists.length,
            total: playlists.length,
            isComplete: true,
          });
        }

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

  // Handle transfer function
  const handleTransfer = async () => {
    setIsTransferring(true);

    try {
      // Find the selected friend
      const selectedFriend = friendsList.find(
        (f) => f.id === transferDestination,
      );

      if (!selectedFriend) {
        throw new Error("Selected friend not found");
      }

      // Get the selected playlist from Firebase
      const playlist = await window.electronAPI.getPlaylistFromFirebase(
        selectedPlaylist.id,
      );
      if (!playlist.sharedWith.includes(selectedFriend.id)) {
        playlist.sharedWith.push(selectedFriend.id);
      }

      // Update the playlist in Firebase
      const result =
        await window.electronAPI.transferPlaylistToFirebase(playlist);
      console.log("Transfer result:", result);

      if (result && result.success) {
        // Create appropriate notification
        addNotification({
          type: "playlist_transfer_success",
          message: `Playlist "${selectedPlaylist.name}" sent to ${selectedFriend.displayName}.`,
          details: {
            playlistName: selectedPlaylist.name,
            destination: selectedFriend.displayName,
            friendId: selectedFriend.id,
          },
        });

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

  const handleNotificationClick = () => {
    setNotificationsOpen(!notificationsOpen);
    setUserDropdownOpen(false); // Close user dropdown if open
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

    // Always return to main page when selecting a playlist
    setCurrentPage("main");

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
          {!spotifyStatus.isComplete && spotifyStatus.total > 0 ? (
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
                value={(spotifyStatus.loaded / spotifyStatus.total) * 100}
                sx={{ color: "white" }}
              />
              <Typography variant="caption" sx={{ ml: 1.5, color: "white" }}>
                {Math.round((spotifyStatus.loaded / spotifyStatus.total) * 100)}
                %
              </Typography>
            </Box>
          ) : null}
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

  // Render different pages based on currentPage state
  const renderCurrentPage = () => {
    switch (currentPage) {
      case "userInfo":
        return (
          <Paper sx={{ ...styles.paper, p: 3 }}>
            <Typography variant="h5" color="text.primary" sx={{ mb: 3 }}>
              User Information
            </Typography>

            {userInfo ? (
              <Stack spacing={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "rgba(134, 97, 193, 0.05)",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Profile
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex" }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: "medium", width: 120 }}
                      >
                        Name:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {userInfo.displayName || "Not provided"}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: "medium", width: 120 }}
                      >
                        Email:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {userInfo.email || "Not provided"}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: "medium", width: 120 }}
                      >
                        Member since:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(userInfo.createdAt) || "Unknown"}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={40} sx={{ color: "primary.main" }} />
              </Box>
            )}

            <Button
              variant="contained"
              onClick={() => setCurrentPage("main")}
              sx={{ ...styles.continueButton, mt: 3 }}
            >
              Back to Main
            </Button>
          </Paper>
        );
      case "settings":
        return (
          <Paper sx={{ ...styles.paper, p: 3 }}>
            <Typography variant="h5" color="text.primary" sx={{ mb: 3 }}>
              Settings
            </Typography>
            {userInfo ? (
              <Stack spacing={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "rgba(134, 97, 193, 0.05)",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Connected Services
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <Chip
                      label="Spotify"
                      icon={
                        userInfo.connectedServices.spotify ? (
                          <ChevronDown size={16} style={{ opacity: 0 }} />
                        ) : null
                      }
                      deleteIcon={
                        userInfo.connectedServices.spotify ? (
                          <ChevronDown size={16} style={{ opacity: 0 }} />
                        ) : null
                      }
                      onDelete={
                        userInfo.connectedServices.spotify ? () => {} : undefined
                      }
                      sx={{
                        bgcolor: userInfo.connectedServices.spotify
                          ? "#1DB954"
                          : "rgba(134, 97, 193, 0.1)",
                        color: userInfo.connectedServices.spotify
                          ? "white"
                          : "text.primary",
                        "& .MuiChip-icon": { color: "inherit" },
                        "& .MuiChip-deleteIcon": { color: "inherit" },
                      }}
                    />
                    <Chip
                      label="Apple Music"
                      icon={
                        userInfo.connectedServices.appleMusic ? (
                          <ChevronDown size={16} style={{ opacity: 0 }} />
                        ) : null
                      }
                      deleteIcon={
                        userInfo.connectedServices.appleMusic ? (
                          <ChevronDown size={16} style={{ opacity: 0 }} />
                        ) : null
                      }
                      onDelete={
                        userInfo.connectedServices.appleMusic ? () => {} : undefined
                      }
                      sx={{
                        bgcolor: userInfo.connectedServices.appleMusic
                          ? "#FC3C44"
                          : "rgba(134, 97, 193, 0.1)",
                        color: userInfo.connectedServices.appleMusic
                          ? "white"
                          : "text.primary",
                        "& .MuiChip-icon": { color: "inherit" },
                        "& .MuiChip-deleteIcon": { color: "inherit" },
                      }}
                    />
                  </Box>

                  <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                    {!userInfo.connectedServices.spotify && (
                      <Button
                        variant="contained"
                        onClick={() =>
                          window.electronAPI?.connectSpotify().then(() => {
                            refreshSpotifyPlaylists();
                          })
                        }
                        sx={{
                          bgcolor: "#1DB954",
                          "&:hover": {
                            bgcolor: "#19a34a",
                          },
                        }}
                      >
                        Connect Spotify
                      </Button>
                    )}
                    {!userInfo.connectedServices.appleMusic && (
                      <Button
                        variant="contained"
                        onClick={() =>
                          window.electronAPI.connectAppleMusic().then(() => {
                            refreshAppleMusicPlaylists();
                          })
                        }
                        sx={{
                          bgcolor: "#FC3C44",
                          "&:hover": {
                            bgcolor: "#e02e38",
                          },
                        }}
                      >
                        Connect Apple Music
                      </Button>
                    )}
                  </Box>
                </Paper>

                {/* Other settings options could be added here */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "rgba(134, 97, 193, 0.05)",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Application Settings
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Additional settings options can be placed here.
                  </Typography>
                </Paper>
              </Stack>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={40} sx={{ color: "primary.main" }} />
              </Box>
            )}

            <Button
              variant="contained"
              onClick={() => setCurrentPage("main")}
              sx={{ ...styles.continueButton, mt: 3 }}
            >
              Back to Main
            </Button>
          </Paper>
        );
      case "friends":
        return (
          <Paper sx={{ ...styles.paper, p: 3 }}>
            <Typography variant="h5" color="text.primary" sx={{ mb: 3 }}>
              Friends
            </Typography>

            {/* Search Bar */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 3,
                bgcolor: "rgba(134, 97, 193, 0.05)",
                borderRadius: 2,
              }}
            >
              <Typography variant="h6" sx={{ mb: 2 }}>
                Find Friends
              </Typography>
              <Box sx={{ display: "flex", mb: 2 }}>
                <TextField
                  fullWidth
                  placeholder="Search by email or username"
                  variant="outlined"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ mr: 1 }}
                  InputProps={{
                    endAdornment: searchQuery && (
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery("")}
                        sx={{ color: "text.secondary" }}
                      >
                        <Typography>×</Typography>
                      </IconButton>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  sx={styles.continueButton}
                  disabled={!searchQuery || searchLoading}
                >
                  {searchLoading ? <CircularProgress size={24} /> : "Search"}
                </Button>
              </Box>

              {/* Search Results */}
              {searchResult && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "white",
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                      {searchResult.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchResult.email}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleConnectFriend(searchResult.id)}
                    disabled={connectingId === searchResult.id}
                    sx={{
                      bgcolor: colors.amethyst,
                      "&:hover": {
                        bgcolor: "#8a67c2",
                      },
                    }}
                  >
                    {connectingId === searchResult.id ? (
                      <CircularProgress size={20} sx={{ color: "white" }} />
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </Paper>
              )}

              {searchError && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {searchError}
                </Alert>
              )}
            </Paper>

            {/* Friends List */}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: "rgba(134, 97, 193, 0.05)",
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">My Friends</Typography>
                {friendsLoading ? (
                  <CircularProgress size={20} sx={{ color: colors.amethyst }} />
                ) : (
                  <IconButton
                    size="small"
                    onClick={fetchFriends}
                    sx={{ color: colors.amethyst }}
                  >
                    <RefreshCw size={16} />
                  </IconButton>
                )}
              </Box>

              {friendsList.length > 0 ? (
                <Stack spacing={1}>
                  {friendsList.map((friend) => (
                    <Paper
                      key={friend.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        bgcolor: "white",
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: "medium" }}
                        >
                          {friend.displayName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {friend.email}
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openUnfollowDialog(friend)}
                        disabled={removingId === friend.id}
                        sx={{
                          borderColor: colors.amethyst,
                          color: colors.amethyst,
                          "&:hover": {
                            borderColor: colors.amethyst,
                            bgcolor: "rgba(134, 97, 193, 0.1)",
                          },
                        }}
                      >
                        {removingId === friend.id ? (
                          <CircularProgress
                            size={16}
                            sx={{ color: colors.amethyst }}
                          />
                        ) : (
                          "Unfollow"
                        )}
                      </Button>
                    </Paper>
                  ))}
                </Stack>
              ) : friendsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={30} sx={{ color: colors.amethyst }} />
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: "center", py: 4 }}
                >
                  You haven't connected with any friends yet. Use the search
                  above to find friends.
                </Typography>
              )}
            </Paper>

            <Button
              variant="contained"
              onClick={() => setCurrentPage("main")}
              sx={{ ...styles.continueButton, mt: 3 }}
            >
              Back to Main
            </Button>
          </Paper>
        );
        {
          /* Notification Logs */
        }
      case "notificationLogs":
        return (
          <Paper sx={{ ...styles.paper, p: 3 }}>
            <Typography variant="h5" color="text.primary" sx={{ mb: 3 }}>
              Notification History
            </Typography>

            {notifications.length > 0 ? (
              <Stack spacing={2}>
                {notifications.map((notification) => (
                  <Paper
                    key={notification.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: notification.read
                        ? "rgba(134, 97, 193, 0.05)"
                        : "rgba(134, 97, 193, 0.15)",
                      borderRadius: 2,
                      borderLeft: notification.read
                        ? "none"
                        : `4px solid ${colors.amethyst}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: notification.read ? "regular" : "medium",
                        }}
                      >
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatNotificationTime(notification.timestamp)}
                      </Typography>
                    </Box>

                    {/* For partial transfers with failed songs */}
                    {notification.type === "playlist_transfer_partial" &&
                      notification.details && (
                        <Box sx={{ mt: 2 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: "medium", mb: 1 }}
                          >
                            Transfer Details:
                          </Typography>

                          <Box
                            sx={{
                              pl: 2,
                              borderLeft: `2px solid ${colors.amethyst}`,
                              mb: 2,
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              Total tracks: {notification.details.totalTracks}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Successfully transferred:{" "}
                              {notification.details.tracksAdded}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Failed: {notification.details.failedCount}
                            </Typography>
                          </Box>

                          {notification.details.failedSongs &&
                            notification.details.failedSongs.length > 0 && (
                              <>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: "medium", mb: 1 }}
                                >
                                  Failed Songs:
                                </Typography>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    maxHeight: 150,
                                    overflowY: "auto",
                                    p: 1,
                                    bgcolor: "background.default",
                                  }}
                                >
                                  <List dense disablePadding>
                                    {notification.details.failedSongs.map(
                                      (song, index) => (
                                        <ListItem key={index} sx={{ py: 0.5 }}>
                                          <ListItemText
                                            primary={
                                              song.name || "Unknown Song"
                                            }
                                            secondary={`${song.artist || "Unknown Artist"} • ${song.album || "Unknown Album"}`}
                                            secondaryTypographyProps={{
                                              variant: "caption",
                                            }}
                                          />
                                        </ListItem>
                                      ),
                                    )}
                                  </List>
                                </Paper>
                              </>
                            )}

                          {(!notification.details.failedSongs ||
                            notification.details.failedSongs.length === 0) &&
                            notification.details.failedCount > 0 && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 1, fontStyle: "italic" }}
                              >
                                Details of failed songs are not available.
                              </Typography>
                            )}
                        </Box>
                      )}

                    {/* For successful transfers, show summary */}
                    {notification.type === "playlist_transfer_success" &&
                      notification.details && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          Successfully transferred all{" "}
                          {notification.details.totalTracks} songs.
                        </Typography>
                      )}

                    {notification.type === "friend_request_received" &&
                      notification.details &&
                      !notification.read && (
                        <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleAcceptRequest(notification)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleDenyRequest(notification)}
                          >
                            Deny
                          </Button>
                        </Box>
                      )}
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No notifications to display
              </Typography>
            )}

            <Box
              sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}
            >
              <Button
                variant="outlined"
                onClick={markAllAsRead}
                disabled={
                  notifications.length === 0 ||
                  notifications.every((n) => n.read)
                }
              >
                Mark All as Read
              </Button>

              <Button
                variant="contained"
                onClick={() => setCurrentPage("main")}
                sx={styles.continueButton}
              >
                Back to Main
              </Button>
            </Box>
          </Paper>
        );
      default:
        return renderPlaylistDetails();
    }
  };

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
            <Typography variant="body2" color="text.secondary">
              Tracks: {selectedPlaylist.numberOfTracks} • Duration:{" "}
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

              {/* Notification Bell Button */}
              <Box sx={{ position: "relative", mr: 2 }}>
                <IconButton
                  onClick={handleNotificationClick}
                  sx={{
                    color: "primary.main",
                    width: 40,
                    height: 40,
                  }}
                >
                  <Badge badgeContent={unreadCount} color="error">
                    <Bell size={24} />
                  </Badge>
                </IconButton>

                {/* Notification dropdown menu */}
                {notificationsOpen && (
                  <Paper
                    sx={{
                      position: "absolute",
                      top: 48,
                      right: 0,
                      width: 300,
                      maxHeight: 400,
                      overflowY: "auto",
                      boxShadow: 3,
                      borderRadius: 1,
                      zIndex: 1000,
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography variant="h6" sx={{ fontSize: 16 }}>
                        Notifications
                      </Typography>
                      {unreadCount > 0 && (
                        <Button
                          size="small"
                          sx={{ color: "primary.main" }}
                          onClick={markAllAsRead}
                        >
                          Mark all as read
                        </Button>
                      )}
                    </Box>

                    {/* Add "Show All" button at the top */}
                    <Box
                      onClick={() => {
                        setNotificationsOpen(false);
                        setCurrentPage("notificationLogs");
                      }}
                      sx={{
                        p: 1.5,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        display: "flex",
                        justifyContent: "center",
                        bgcolor: "rgba(134, 97, 193, 0.05)",
                        cursor: "pointer",
                        "&:hover": {
                          bgcolor: "rgba(134, 97, 193, 0.1)",
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ color: "primary.main", fontWeight: "medium" }}
                      >
                        Show All Notifications
                      </Typography>
                    </Box>

                    <List sx={{ p: 0 }}>
                      {notifications.length > 0 ? (
                        <>
                          {notifications.slice(0, 5).map((notification) => (
                            <ListItem
                              key={notification.id}
                              onClick={() => markAsRead(notification.id)}
                              sx={{
                                p: 2,
                                borderLeft: notification.read
                                  ? "none"
                                  : `4px solid ${colors.amethyst}`,
                                bgcolor: notification.read
                                  ? "transparent"
                                  : "rgba(134, 97, 193, 0.08)",
                                cursor: "pointer",
                                "&:hover": {
                                  bgcolor: "rgba(134, 97, 193, 0.05)",
                                },
                              }}
                              divider
                            >
                              <Box sx={{ width: "100%" }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    width: "100%",
                                  }}
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: notification.read
                                        ? "regular"
                                        : "medium",
                                      pr: 1,
                                    }}
                                  >
                                    {notification.message}
                                  </Typography>
                                </Box>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mt: 0.5,
                                  }}
                                >
                                  <Clock size={12} style={{ marginRight: 4 }} />
                                  {formatNotificationTime(
                                    notification.timestamp,
                                  )}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </>
                      ) : (
                        <ListItem sx={{ py: 4 }}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ width: "100%", textAlign: "center" }}
                          >
                            No notifications yet
                          </Typography>
                        </ListItem>
                      )}
                    </List>
                  </Paper>
                )}
              </Box>

              {/* User Button */}
              <Box sx={{ position: "relative", ml: 2 }}>
                <IconButton
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    width: 40,
                    height: 40,
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <Typography>?</Typography>
                </IconButton>

                {/* User dropdown menu */}
                {userDropdownOpen && (
                  <Paper
                    sx={{
                      position: "absolute",
                      top: 48,
                      right: 0,
                      width: 150,
                      boxShadow: 3,
                      borderRadius: 1,
                      overflow: "hidden",
                      zIndex: 1000,
                    }}
                  >
                    <List sx={{ p: 0 }}>
                      <ListItemButton
                        onClick={() => {
                          setCurrentPage("userInfo");
                          setUserDropdownOpen(false);
                          fetchUserInfo();
                        }}
                      >
                        <ListItemText primary="User Info" />
                      </ListItemButton>
                      <ListItemButton
                        onClick={() => {
                          setCurrentPage("settings");
                          setUserDropdownOpen(false);
                        }}
                      >
                        <ListItemText primary="Settings" />
                      </ListItemButton>
                      <ListItemButton
                        onClick={() => {
                          setCurrentPage("friends");
                          setUserDropdownOpen(false);
                        }}
                      >
                        <ListItemText primary="Friends" />
                      </ListItemButton>
                    </List>
                  </Paper>
                )}
              </Box>
            </Box>

            {/* Scrollable content area */}
            <Box
              sx={{
                p: 2,
                overflowY: "auto",
                flex: 1,
              }}
            >
              {renderCurrentPage()}
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
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: "rgba(134, 97, 193, 0.05)",
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Typography variant="body1">
                  {selectedPlaylist?.name || "No playlist selected"}
                  {selectedPlaylist?.origin
                    ? ` (${selectedPlaylist.origin})`
                    : ""}
                </Typography>
              </Paper>
            </Box>

            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                Send To
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={transferDestination}
                  onChange={(e) => setTransferDestination(e.target.value)}
                  displayEmpty
                  renderValue={(selected) => {
                    const friend = friendsList.find((f) => f.id === selected);
                    return friend ? friend.displayName : "Select a friend";
                  }}
                >
                  {friendsLoading ? (
                    <MenuItem disabled>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Loading friends...
                      </Box>
                    </MenuItem>
                  ) : friendsList.length === 0 ? (
                    <MenuItem disabled>No friends available</MenuItem>
                  ) : (
                    friendsList.map((friend) => (
                      <MenuItem key={friend.id} value={friend.id}>
                        {friend.displayName} ({friend.email})
                      </MenuItem>
                    ))
                  )}
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
            disabled={
              isTransferring || !transferDestination || friendsList.length === 0
            }
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
      {/* Unfollow Confirmation Dialog */}
      <Dialog
        open={unfollowDialogOpen}
        onClose={() => setUnfollowDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.background.paper,
            borderRadius: 3,
            width: "100%",
            maxWidth: "400px",
          },
        }}
      >
        <DialogTitle>Unfollow Friend</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to unfollow {userToUnfollow?.displayName}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setUnfollowDialogOpen(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmUnfollow}
            variant="contained"
            sx={{
              bgcolor: colors.amethyst,
              "&:hover": {
                bgcolor: "#8a67c2",
              },
            }}
          >
            Unfollow
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default Homepage;
