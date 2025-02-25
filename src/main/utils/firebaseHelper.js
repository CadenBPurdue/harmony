// src/main/utils/firebaseHelper.js
import { doc, setDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { getDbInstance, getAuthInstance } from "./firebase.js";

function validatePlaylist(playlist) {
  const playlistSchema = {
    id: "string",
    name: "string",
    user: "string",
    origin: "string",
    number_of_tracks: "number",
    duration: "number",
    description: "string",
    image: "string",
    tracks: "array",
  };

  const trackSchema = {
    name: "string",
    artist: "string",
    album: "string",
    duration: "number",
    image: "string",
  };

  function validateObject(obj, schema) {
    for (const key in schema) {
      if (schema[key] === "array") {
        if (!Array.isArray(obj[key])) {
          throw new Error(
            `Invalid type for ${key}. Expected array, but got ${typeof obj[key]}`,
          );
        }
      } else if (typeof obj[key] !== schema[key]) {
        throw new Error(
          `Invalid type for ${key}. Expected ${schema[key]}, but got ${typeof obj[key]}`,
        );
      }
    }
    return true;
  }

  try {
    validateObject(playlist, playlistSchema);
  } catch (error) {
    console.error("Playlist validation error:", error.message);
    return false;
  }

  for (const track of playlist.tracks) {
    try {
      validateObject(track, trackSchema);
    } catch (error) {
      console.error("Track validation error:", error.message);
      return false;
    }
  }

  return true;
}

async function writePlaylistToFirestore(playlist) {
  const db = getDbInstance();
  const collection = "playlists";
  if (!validatePlaylist(playlist)) {
    throw new Error("Invalid playlist format");
  }

  try {
    // Make sure the playlist has a user ID
    const playlistWithUserId = {
      ...playlist,
      userId: getAuthInstance().currentUser.uid,
    }
    const docRef = doc(db, collection, playlist.id);
    await setDoc(docRef, playlistWithUserId, { merge: true });
    console.log(`Playlist written to ${collection}/${playlist.id}`);
    return { success: true };
  } catch (error) {
    console.error("Error writing playlist to Firestore:", error);
    throw error;
  }
}

async function getPlaylistsFromFirestore() {
  const db = getDbInstance();
  const auth = getAuthInstance();
  const collectionName = "playlists";
  const playlistIds = [];
  
  // Check if user is authenticated
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to fetch playlists");
  }
  
  try {
    // Create a query to filter playlists by the current user's ID
    const playlistsQuery = query(
      collection(db, collectionName),
      where("userId", "==", auth.currentUser.uid)
    );
    
    const querySnapshot = await getDocs(playlistsQuery);
    querySnapshot.forEach((doc) => {
      playlistIds.push(doc.id);
    });
    return playlistIds;
  } catch (error) {
    console.error("Error fetching playlists from Firestore:", error);
    throw error;
  }
}

async function getPlaylistFromFirestore(playlistId) {
  const db = getDbInstance();
  const auth = getAuthInstance();
  const collectionName = "playlists";

  // Check if user is authenticated
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to fetch playlists");
  }

  try {
    const docRef = doc(db, collectionName, playlistId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const playlist = { id: docSnap.id, ...docSnap.data() };
      
      // Verify the playlist belongs to the current user
      if (playlist.userId !== auth.currentUser.uid) {
        throw new Error("Access denied: You don't have permission to view this playlist");
      }
      
      return playlist;
    } else {
      throw new Error("No such playlist!");
    }
  } catch (error) {
    console.error("Error getting playlist from Firestore:", error);
    throw error;
  }
}

export {
  validatePlaylist,
  writePlaylistToFirestore,
  getPlaylistsFromFirestore,
  getPlaylistFromFirestore,
};
