import React, { useState, useEffect } from "react";

function Homepage() {
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [appleMusicOpen, setAppleMusicOpen] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [appleMusicPlaylists, setAppleMusicPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // Track the selected playlist

  // Add loading state for both services
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);

  // Fetch Spotify playlists from the backend
  useEffect(() => {
    console.log("Fetching Spotify playlists..."); // Debug log
    setLoadingSpotify(true); // Set loading state to true before fetching

    window.electronAPI
      .getSpotifyLibrary()
      .then((playlists) => {
        console.log("Received Spotify playlists:", playlists); // Debug log
        setSpotifyPlaylists(playlists);
      })
      .catch((error) => {
        console.error("Error fetching Spotify playlists:", error);
      })
      .finally(() => {
        setLoadingSpotify(false); // Set loading state to false after fetching
      });
  }, []);

  // Fetch Apple Music playlists from the backend
  useEffect(() => {
    console.log("Fetching Apple Music playlists..."); // Debug log
    setLoadingAppleMusic(true); // Set loading state to true before fetching

    window.electronAPI
      .getAppleMusicLibrary()
      .then((playlists) => {
        console.log("Received Apple Music playlists:", playlists); // Debug log
        setAppleMusicPlaylists(playlists);
      })
      .catch((error) => {
        console.error("Error fetching Apple Music playlists:", error);
      })
      .finally(() => {
        setLoadingAppleMusic(false); // Set loading state to false after fetching
      });
  }, []);

  // Handle playlist click
  const handlePlaylistClick = (playlist) => {
    setSelectedPlaylist(playlist); // Set the selected playlist
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          backgroundColor: "#28242E",
          padding: "10px",
          boxShadow: "2px 0 5px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Spotify Dropdown */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={() => setSpotifyOpen(!spotifyOpen)}
            style={{
              width: "100%",
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
                    backgroundColor: "#28242E",
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
                      backgroundColor: "#fff",
                      margin: "5px 0",
                      borderRadius: "5px",
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
                    backgroundColor: "#28242E",
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
                      backgroundColor: "#fff",
                      margin: "5px 0",
                      borderRadius: "5px",
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

      {/* Main Content */}
      <div style={{ flex: 1, paddingLeft: "20px", backgroundColor: "#3E3847" }}>
        <h1 style={{ color: "white" }}>Harmony</h1>
        {selectedPlaylist ? (
          <div>
            <h2>{selectedPlaylist.name}</h2>
            <p>User: {selectedPlaylist.user}</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      color: "white",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      color: "white",
                    }}
                  >
                    Song
                  </th>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      color: "white",
                    }}
                  >
                    Album
                  </th>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      color: "white",
                    }}
                  >
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedPlaylist.tracks.map((track, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        color: "white",
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        color: "white",
                      }}
                    >
                      {track.name}
                    </td>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        color: "white",
                      }}
                    >
                      {track.album}
                    </td>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "8px",
                        color: "white",
                      }}
                    >
                      {track.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p></p>
        )}
      </div>
    </div>
  );
}

export default Homepage;
