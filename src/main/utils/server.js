import cors from "cors";
import express from "express";
import sqlite3 from "sqlite3";

const app = express();
const port = 5001;

// Connect to the SQLite database
const db = new sqlite3.Database("src/main/db/playlists.db", (err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Middleware
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// API Endpoint to fetch playlists
app.get("/api/playlists", (req, res) => {
  const query = "SELECT name, origin, tracks FROM playlists"; // Include the `tracks` field
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
