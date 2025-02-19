import axios from "axios";
import React, { useState, useEffect } from "react";

function Homepage() {
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [appleMusicOpen, setAppleMusicOpen] = useState(false);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [appleMusicPlaylists, setAppleMusicPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // Track the selected playlist

  // Fetch playlists from the backend
  useEffect(() => {
    console.log("Fetching playlists..."); // Debug log
    axios
      .get("http://localhost:5001/api/playlists")
      .then((response) => {
        console.log("Playlists fetched:", response.data); // Debug log

        // Categorize playlists based on the `origin` field
        const spotify = response.data
          .filter((playlist) => playlist.origin === "Spotify")
          .map((playlist) => ({
            ...playlist,
            tracks: JSON.parse(playlist.tracks), // Parse the tracks JSON string
          }));

        const appleMusic = response.data
          .filter((playlist) => playlist.origin === "Apple Music")
          .map((playlist) => ({
            ...playlist,
            tracks: JSON.parse(playlist.tracks), // Parse the tracks JSON string
          }));

        setSpotifyPlaylists(spotify);
        setAppleMusicPlaylists(appleMusic);
      })
      .catch((error) => {
        console.error("Error fetching playlists:", error.message); // Log the error message
        console.error("Error details:", error.response || error); // Log the full error object
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
          backgroundColor: "#f4f4f4",
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
              padding: "10px",
              backgroundColor: "#1DB954",
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
              {spotifyPlaylists.map((playlist, index) => (
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
              ))}
            </ul>
          )}
        </div>

        {/* Apple Music Dropdown */}
        <div>
          <button
            onClick={() => setAppleMusicOpen(!appleMusicOpen)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#FC3C44",
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
              {appleMusicPlaylists.map((playlist, index) => (
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
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "20px" }}>
        <h1>Welcome to the Music Playlist App</h1>
        {selectedPlaylist ? (
          <div>
            <h2>{selectedPlaylist.name}</h2>
            <p>User: {selectedPlaylist.user}</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                    #
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                    Song
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                    Album
                  </th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedPlaylist.tracks.map((track, index) => (
                  <tr key={index}>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                      {index + 1}
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                      {track.name}
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                      {track.album}
                    </td>
                    <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                      {track.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Select a playlist from the sidebar to get started.</p>
        )}
      </div>
    </div>
  );
}

export default Homepage;
