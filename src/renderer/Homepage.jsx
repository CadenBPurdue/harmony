import React, { useState, useEffect } from "react";

// Function to format duration from milliseconds to MM:SS format
const formatDuration = (milliseconds) => {
  if (!milliseconds) return "--:--";
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

function Homepage() {
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [appleMusicOpen, setAppleMusicOpen] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [appleMusicPlaylists, setAppleMusicPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // Track the selected playlist
  
  // Loading state for both services
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingAppleMusic, setLoadingAppleMusic] = useState(false);

  // Fetch Spotify playlists from the backend
  useEffect(() => {
    console.log("Fetching Spotify playlists..."); // Debug log
    setLoadingSpotify(true); // Set loading state to true before fetching
    
    window.electronAPI.getSpotifyLibrary()
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
    
    window.electronAPI.getAppleMusicLibrary()
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
                    backgroundColor: "#fff",
                    margin: "5px 0",
                    borderRadius: "5px",
                    textAlign: "center",
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
                    backgroundColor: "#fff",
                    margin: "5px 0",
                    borderRadius: "5px",
                    textAlign: "center",
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

      {/* Main Content - Made scrollable */}
      <div style={{ 
        flex: 1, 
        backgroundColor: "#3E3847",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column"
      }}>
        <h1 style={{ color: "white", padding: "0 20px", margin: "20px 0" }}>Harmony</h1>
        
        {/* Scrollable content area */}
        <div style={{ 
          padding: "0 20px 20px 20px", 
          overflowY: "auto",
          flex: 1
        }}>
          {selectedPlaylist ? (
            <div>
              <h2 style={{ color: "white" }}>{selectedPlaylist.name}</h2>
              <p style={{ color: "white" }}>User: {selectedPlaylist.user}</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 16px", color: "white", position: "sticky", top: 0, backgroundColor: "#3E3847", textAlign: "left" }}>
                        #
                      </th>
                      <th style={{ padding: "8px 16px", color: "white", position: "sticky", top: 0, backgroundColor: "#3E3847", textAlign: "left" }}>
                        Song
                      </th>
                      <th style={{ padding: "8px 16px", color: "white", position: "sticky", top: 0, backgroundColor: "#3E3847", textAlign: "left" }}>
                        Artist
                      </th>
                      <th style={{ padding: "8px 16px", color: "white", position: "sticky", top: 0, backgroundColor: "#3E3847", textAlign: "left" }}>
                        Album
                      </th>
                      <th style={{ padding: "8px 16px", color: "white", position: "sticky", top: 0, backgroundColor: "#3E3847", textAlign: "right" }}>
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(selectedPlaylist.tracks) ? (
                      selectedPlaylist.tracks.map((track, index) => (
                        <tr key={index} style={{ 
                          backgroundColor: index % 2 === 0 ? "#36323A" : "transparent",
                          transition: "background-color 0.2s"
                        }}>
                          <td style={{ padding: "8px 16px", color: "#aaa", textAlign: "left" }}>
                            {index + 1}
                          </td>
                          <td style={{ padding: "8px 16px", color: "white", textAlign: "left" }}>
                            {track.name}
                          </td>
                          <td style={{ padding: "8px 16px", color: "#aaa", textAlign: "left" }}>
                            {track.artist}
                          </td>
                          <td style={{ padding: "8px 16px", color: "#aaa", textAlign: "left" }}>
                            {track.album}
                          </td>
                          <td style={{ padding: "8px 16px", color: "#aaa", textAlign: "right" }}>
                            {formatDuration(track.duration)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "16px", color: "white", textAlign: "center" }}>
                          No tracks available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p style={{ color: "white" }}>Select a playlist to view its tracks</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Homepage;
