import React, { useState, useEffect } from "react";

// Function to format duration from milliseconds to MM:SS format
const formatDuration = (milliseconds) => {
  if (!milliseconds) return "--:--";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

function Homepage() {
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [appleMusicOpen, setAppleMusicOpen] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [appleMusicPlaylists, setAppleMusicPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // Track the selected playlist

  // Transfer popup state
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [transferDestination, setTransferDestination] = useState("");
  const [destinationDropdownOpen, setDestinationDropdownOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // User dropdown state
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("main"); // main, userInfo, settings, friends

  // Loading state for both services
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);

  // Toggle user dropdown
  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
  };

  // Navigate to a page
  const navigateTo = (page) => {
    setCurrentPage(page);
    setUserDropdownOpen(false); // Close the dropdown after selection
  };

  // Open transfer popup
  const openTransferPopup = () => {
    // Set destination to the opposite of current playlist source
    const destination =
      selectedPlaylist?.origin === "Spotify" ? "Apple Music" : "Spotify";
    setTransferDestination(destination);

    // Show the popup
    setShowTransferPopup(true);
  };

  // Close transfer popup
  const closeTransferPopup = () => {
    setShowTransferPopup(false);
    setDestinationDropdownOpen(false);
  };

  // Handle transfer function
  const handleTransfer = async () => {
    setIsTransferring(true);

    try {
      var result = null;
      if (transferDestination == "Spotify") {
        result = await window.electronAPI.transferToSpotify(selectedPlaylist);
      } else if (transferDestination == "Apple Music") {
        result =
          await window.electronAPI.transferToAppleMusic(selectedPlaylist);
      }

      if (result && result.success) {
        // reload playlists from destination
        if (transferDestination === "Spotify") {
          setLoadingSpotify(true);
          window.electronAPI
            .getSpotifyLibrary()
            .then((playlists) => {
              setSpotifyPlaylists(playlists);
            })
            .catch((error) => {
              console.error("Error fetching Spotify playlists:", error);
            })
            .finally(() => {
              setLoadingSpotify(false);
            });
        } else if (transferDestination === "Apple Music") {
          setLoadingAppleMusic(true);
          window.electronAPI
            .getAppleMusicLibrary()
            .then((playlists) => {
              setAppleMusicPlaylists(playlists);
            })
            .catch((error) => {
              console.error("Error fetching Apple Music playlists:", error);
            })
            .finally(() => {
              setLoadingAppleMusic(false);
            });
        }
        setShowTransferPopup(false);
        setShowSuccessPopup(true);
        setTimeout(() => {
          setShowSuccessPopup(false);
        }, 1500);
      } else {
        alert("Transfer failed inside: " + (result?.error || "Unknown error"));
      }
    } catch (error) {
      alert("Transfer error outside: " + (error.message || "Unknown error"));
    } finally {
      setIsTransferring(false);
    }
  };

  // Function to fetch Spotify playlists from the backend
  const fetchSpotifyPlaylists = () => {
    setLoadingSpotify(true); // Set loading state to true before fetching

    window.electronAPI
      .getSpotifyLibrary()
      .then((playlists) => {
        setSpotifyPlaylists(playlists);
        playlists.forEach((playlist) => {
          window.electronAPI.transferPlaylistToFirebase(playlist);
        });
      })
      .catch((error) => {
        console.error("Error fetching Spotify playlists:", error);
      })
      .finally(() => {
        setLoadingSpotify(false); // Set loading state to false after fetching
      });
  };

  // Function to fetch Apple Music playlists from the backend
  const fetchAppleMusicPlaylists = () => {
    console.log("Fetching Apple Music playlists..."); // Debug log
    setLoadingAppleMusic(true); // Set loading state to true before fetching

    window.electronAPI
      .getAppleMusicLibrary()
      .then((playlists) => {
        console.log("Received Apple Music playlists:", playlists); // Debug log
        setAppleMusicPlaylists(playlists);
        playlists.forEach((playlist) => {
          window.electronAPI.transferPlaylistToFirebase(playlist);
        });
      })
      .catch((error) => {
        console.error("Error fetching Apple Music playlists:", error);
      })
      .finally(() => {
        setLoadingAppleMusic(false); // Set loading state to false after fetching
      });
  };

  // Check auth status
  useEffect(() => {
    window.electronAPI.getAuthStatus().then((status) => {
      console.log("Auth status:", status); // Debug log
      if (status.isSpotifyAuthenticated) {
        fetchSpotifyPlaylists(); // Fetch Spotify playlists if authenticated
      }
      if (status.isAppleMusicAuthenticated) {
        fetchAppleMusicPlaylists(); // Fetch Apple Music playlists if authenticated
      }
    });
  }, []);

  // Handle playlist click
  const handlePlaylistClick = (playlist) => {
    setSelectedPlaylist(playlist); // Set the selected playlist
    setCurrentPage("main"); // Return to main content when selecting a playlist
  };

  // Get available playlists based on the source
  const getAvailablePlaylists = () => {
    return selectedPlaylist?.origin === "Spotify"
      ? spotifyPlaylists
      : appleMusicPlaylists;
  };

  // Render different pages based on currentPage state
  const renderPage = () => {
    switch (currentPage) {
      case "userInfo":
        return (
          <div style={{ padding: "20px", color: "white" }}>
            <h2>User Information</h2>
            <p>This is the user information page.</p>
            <button
              onClick={() => setCurrentPage("main")}
              style={{
                backgroundColor: "#C391F5",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "20px",
              }}
            >
              Back to Main
            </button>
          </div>
        );
      case "settings":
        return (
          <div style={{ padding: "20px", color: "white" }}>
            <h2>Settings</h2>
            <p>This is the settings page.</p>
            <button
              onClick={() => setCurrentPage("main")}
              style={{
                backgroundColor: "#C391F5",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "20px",
              }}
            >
              Back to Main
            </button>
          </div>
        );
      case "friends":
        return (
          <div style={{ padding: "20px", color: "white" }}>
            <h2>Friends</h2>
            <p>This is the friends page.</p>
            <button
              onClick={() => setCurrentPage("main")}
              style={{
                backgroundColor: "#C391F5",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "20px",
              }}
            >
              Back to Main
            </button>
          </div>
        );
      default:
        return (
          <div
            style={{
              padding: "0 20px 20px 20px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {selectedPlaylist ? (
              <div>
                {/* Header with playlist info and transfer button */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h2 style={{ color: "white", marginBottom: "5px" }}>
                      {selectedPlaylist.name}
                    </h2>
                    <p style={{ color: "white", margin: "0" }}>
                      User: {selectedPlaylist.user}
                    </p>
                  </div>
                  {isTransferring ? (
                    <div
                      style={{
                        color: "white",
                        backgroundColor: "#C391F5",
                        padding: "8px 16px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                      }}
                    >
                      Transferring...
                    </div>
                  ) : (
                    <button
                      onClick={openTransferPopup}
                      style={{
                        backgroundColor: "#C391F5",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 16px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        transition: "background-color 0.3s",
                      }}
                    >
                      Transfer
                    </button>
                  )}
                </div>

                <div style={{ overflowX: "auto", marginTop: "20px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th
                          style={{
                            padding: "8px 16px",
                            color: "white",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#3E3847",
                            textAlign: "left",
                          }}
                        >
                          #
                        </th>
                        <th
                          style={{
                            padding: "8px 16px",
                            color: "white",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#3E3847",
                            textAlign: "left",
                          }}
                        >
                          Song
                        </th>
                        <th
                          style={{
                            padding: "8px 16px",
                            color: "white",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#3E3847",
                            textAlign: "left",
                          }}
                        >
                          Artist
                        </th>
                        <th
                          style={{
                            padding: "8px 16px",
                            color: "white",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#3E3847",
                            textAlign: "left",
                          }}
                        >
                          Album
                        </th>
                        <th
                          style={{
                            padding: "8px 16px",
                            color: "white",
                            position: "sticky",
                            top: 0,
                            backgroundColor: "#3E3847",
                            textAlign: "right",
                          }}
                        >
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(selectedPlaylist.tracks) ? (
                        selectedPlaylist.tracks.map((track, index) => (
                          <tr
                            key={index}
                            style={{
                              backgroundColor:
                                index % 2 === 0 ? "#36323A" : "transparent",
                              transition: "background-color 0.2s",
                            }}
                          >
                            <td
                              style={{
                                padding: "8px 16px",
                                color: "#aaa",
                                textAlign: "left",
                              }}
                            >
                              {index + 1}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                color: "white",
                                textAlign: "left",
                              }}
                            >
                              {track.name}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                color: "#aaa",
                                textAlign: "left",
                              }}
                            >
                              {track.artist}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                color: "#aaa",
                                textAlign: "left",
                              }}
                            >
                              {track.album}
                            </td>
                            <td
                              style={{
                                padding: "8px 16px",
                                color: "#aaa",
                                textAlign: "right",
                              }}
                            >
                              {formatDuration(track.duration)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: "16px",
                              color: "white",
                              textAlign: "center",
                            }}
                          >
                            No tracks available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ color: "white" }}>
                Select a playlist to view its tracks
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          backgroundColor: "#28242E",
          padding: "10px",
          boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
          height: "100%",
          overflowY: "auto",
        }}
      >
        {/* Spotify Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setSpotifyOpen(!spotifyOpen)}
            style={{
              width: "100%",
              fontSize: "16px",
              fontWeight: "bold",
              backgroundColor: "#28242E",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Spotify
          </button>
          {spotifyOpen && (
            <ul style={{ listStyleType: "none", padding: "0", margin: "0" }}>
              {loadingSpotify ? (
                <li
                  style={{
                    padding: "10px",
                    margin: "5px 0",
                    borderRadius: "5px",
                    color: "#666",
                  }}
                >
                  Loading...
                </li>
              ) : (
                spotifyPlaylists.map((playlist, index) => (
                  <li
                    key={index}
                    style={{
                      padding: "10px",
                      color: "#fff",
                      backgroundColor: "#28242E",
                      margin: "5px 0",
                      cursor: "pointer",
                    }}
                    onClick={() => handlePlaylistClick(playlist)} // Handle playlist click
                  >
                    {playlist.name}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        {/* Apple Music Dropdown */}
        <div>
          <button
            onClick={() => setAppleMusicOpen(!appleMusicOpen)}
            style={{
              width: "100%",
              fontSize: "16px",
              fontWeight: "bold",
              backgroundColor: "#28242E",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Apple Music
          </button>
          {appleMusicOpen && (
            <ul style={{ listStyleType: "none", padding: "0", margin: "0" }}>
              {loadingAppleMusic ? (
                <li
                  style={{
                    padding: "10px",
                    margin: "5px 0",
                    borderRadius: "5px",
                    color: "#666",
                  }}
                >
                  Loading...
                </li>
              ) : (
                appleMusicPlaylists.map((playlist, index) => (
                  <li
                    key={index}
                    style={{
                      padding: "10px",
                      color: "#fff",
                      backgroundColor: "#28242E",
                      margin: "5px 0",
                      cursor: "pointer",
                    }}
                    onClick={() => handlePlaylistClick(playlist)} // Handle playlist click
                  >
                    {playlist.name}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content - Made scrollable */}
      <div
        style={{
          flex: 1,
          backgroundColor: "#3E3847",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header with app title and user button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px",
            height: "60px",
          }}
        >
          <h1 style={{ color: "white", margin: "0" }}>Harmony</h1>
          
          {/* User button and dropdown */}
          <div style={{ position: "relative" }}>
            <button
              onClick={toggleUserDropdown}
              style={{
                backgroundColor: "#C391F5",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span>👤</span>
            </button>
            
            {/* User dropdown menu */}
            {userDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "45px",
                  right: "0",
                  backgroundColor: "#28242E",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                  width: "150px",
                  zIndex: 1000,
                }}
              >
                <ul
                  style={{
                    listStyleType: "none",
                    padding: "0",
                    margin: "0",
                  }}
                >
                  <li
                    onClick={() => navigateTo("userInfo")}
                    style={{
                      padding: "10px 15px",
                      color: "white",
                      cursor: "pointer",
                      borderBottom: "1px solid #444",
                      transition: "background-color 0.2s",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#3E3847"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    User Info
                  </li>
                  <li
                    onClick={() => navigateTo("settings")}
                    style={{
                      padding: "10px 15px",
                      color: "white",
                      cursor: "pointer",
                      borderBottom: "1px solid #444",
                      transition: "background-color 0.2s",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#3E3847"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    Settings
                  </li>
                  <li
                    onClick={() => navigateTo("friends")}
                    style={{
                      padding: "10px 15px",
                      color: "white",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#3E3847"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    Friends
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Content area - changes based on currentPage */}
        {renderPage()}
      </div>

      {/* Transfer Popup */}
      {showTransferPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={closeTransferPopup} // Close popup when clicking outside
        >
          <div
            style={{
              backgroundColor: "#28242E",
              borderRadius: "8px",
              padding: "20px",
              width: "400px",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling up
          >
            <h2
              style={{
                color: "white",
                textAlign: "center",
                marginTop: 0,
                marginBottom: "20px",
              }}
            >
              Transfer
            </h2>

            {/* Playlist Field (Auto-filled) */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "white",
                  marginBottom: "8px",
                }}
              >
                Playlist
              </label>
              <div
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#3E3847",
                  color: "white",
                  borderRadius: "4px",
                  opacity: 0.9,
                }}
              >
                {selectedPlaylist?.name || "Unknown"}
              </div>
            </div>

            {/* Source Field (Auto-filled) */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  color: "white",
                  marginBottom: "8px",
                }}
              >
                Source
              </label>
              <div
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#3E3847",
                  color: "white",
                  borderRadius: "4px",
                  opacity: 0.9,
                }}
              >
                {selectedPlaylist?.origin || "Unknown"}
              </div>
            </div>

            {/* Destination Dropdown */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  color: "white",
                  marginBottom: "8px",
                }}
              >
                Destination
              </label>
              <div style={{ position: "relative" }}>
                <div
                  onClick={() =>
                    setDestinationDropdownOpen(!destinationDropdownOpen)
                  }
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#3E3847",
                    color: "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{transferDestination}</span>
                  <span>▼</span>
                </div>

                {destinationDropdownOpen && (
                  <ul
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      backgroundColor: "#3E3847",
                      border: "1px solid #444",
                      borderRadius: "4px",
                      listStyleType: "none",
                      padding: 0,
                      margin: 0,
                      zIndex: 10,
                    }}
                  >
                    <li
                      onClick={() => {
                        setTransferDestination("Spotify");
                        setDestinationDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        color: "white",
                        borderBottom: "1px solid #444",
                        backgroundColor:
                          transferDestination === "Spotify"
                            ? "#4b4456"
                            : "transparent",
                      }}
                    >
                      Spotify
                    </li>
                    <li
                      onClick={() => {
                        setTransferDestination("Apple Music");
                        setDestinationDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        color: "white",
                        backgroundColor:
                          transferDestination === "Apple Music"
                            ? "#4b4456"
                            : "transparent",
                      }}
                    >
                      Apple Music
                    </li>
                  </ul>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={closeTransferPopup}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "transparent",
                  color: "white",
                  border: "1px solid #666",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={isTransferring}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#C391F5",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isTransferring ? "default" : "pointer",
                  opacity: isTransferring ? 0.8 : 1,
                }}
              >
                {isTransferring ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Success Popup */}
      {showSuccessPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#28242E",
              borderRadius: "8px",
              padding: "30px 40px",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                color: "#C391F5",
                margin: 0,
                fontSize: "16px",
              }}
            >
              Success
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}

export default Homepage;