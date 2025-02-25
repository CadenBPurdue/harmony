// src/main/utils/firebaseHelper.js
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import { getDb } from "./firebase.js";

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
  const db = getDb();
  const collection = "playlists";
  if (!validatePlaylist(playlist)) {
    throw new Error("Invalid playlist format");
  }

  try {
    const docRef = doc(db, collection, playlist.id);
    await setDoc(docRef, playlist, { merge: true });
    console.log(`Playlist written to ${collection}/${playlist.id}`);
    return { success: true };
  } catch (error) {
    console.error("Error writing playlist to Firestore:", error);
    throw error;
  }
}

async function getPlaylistsFromFirestore() {
  const db = getDb();
  const collection = "playlists";
  const playlists = [];

  try {
    const querySnapshot = await getDocs(collection(db, collection));
    querySnapshot.forEach((doc) => {
      playlists.push({ id: doc.id, ...doc.data() });
    });
    return playlists;
  } catch (error) {
    console.error("Error fetching playlists from Firestore:", error);
    throw error;
  }
}

async function getPlaylistFromFirestore(playlistId) {
  const db = getDb();
  const collection = "playlists";

  try {
    const docRef = doc(db, collection, playlistId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
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
