// src/main/utils/firebaseHelper.js
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { getDbInstance, getAuthInstance } from "./firebase.js";

function validatePlaylist(playlist) {
  const playlistSchema = {
    id: "string",
    name: "string",
    user: "string",
    origin: "string",
    numberOfTracks: "number",
    duration: "number",
    description: "string",
    image: "string",
    tracks: "array",
    sharedWith: "array",
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

function validateUser(user) {
  const userSchema = {
    userId: "string",
    displayName: "string",
    email: "string",
    createdAt: "timestamp",
    lastLoginAt: "timestamp",
  };

  function validateObject(obj, schema) {
    for (const key in schema) {
      if (schema[key] === "array") {
        if (!Array.isArray(obj[key])) {
          throw new Error(
            `Invalid type for ${key}. Expected array, but got ${typeof obj[key]}`,
          );
        }
      } else if (schema[key] === "timestamp" && obj[key] instanceof Timestamp) {
        // Check if the object is a Firestore Timestamp
        continue;
      } else if (typeof obj[key] !== schema[key]) {
        throw new Error(
          `Invalid type for ${key}. Expected ${schema[key]}, but got ${typeof obj[key]}`,
        );
      }
    }
    return true;
  }

  try {
    return validateObject(user, userSchema);
  } catch (error) {
    console.error("User validation error:", error.message);
    return false;
  }
}

async function writePlaylistToFirestore(playlist) {
  if (!getAuthInstance().currentUser) {
    throw new Error("User must be authenticated before writing playlists");
  }
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
    };
    const docRef = doc(db, collection, playlist.id);
    await setDoc(docRef, playlistWithUserId, { merge: true });
    console.log(
      `[Firebase Helper] Playlist written to ${collection}/${playlist.id}`,
    );
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
      where("userId", "==", auth.currentUser.uid),
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

async function getSharedPlaylistsFromFirestore() {
  const db = getDbInstance();
  const auth = getAuthInstance();
  const collectionName = "playlists";
  const sharedPlaylists = [];

  // Check if user is authenticated
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to fetch shared playlists");
  }

  try {
    // Create a query to filter playlists by the current user's ID in the sharedWith array
    const sharedPlaylistsQuery = query(
      collection(db, collectionName),
      where("sharedWith", "array-contains", auth.currentUser.uid),
    );

    const querySnapshot = await getDocs(sharedPlaylistsQuery);
    querySnapshot.forEach((doc) => {
      sharedPlaylists.push(doc.id);
    });
    return sharedPlaylists;
  } catch (error) {
    console.error("Error fetching shared playlists from Firestore:", error);
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

      // Verify the playlist belongs to the current user or is shared with them
      if (
        playlist.userId !== auth.currentUser.uid &&
        !playlist.sharedWith.includes(auth.currentUser.uid)
      ) {
        throw new Error(
          "Access denied: You don't have permission to view this playlist",
        );
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

async function writeUserToFirestore(user) {
  const db = getDbInstance();
  const collectionName = "users";
  if (!validateUser(user)) {
    throw new Error("Invalid user format");
  }

  try {
    const docRef = doc(db, collectionName, user.userId);
    await setDoc(docRef, user, { merge: true });
    console.log(
      `[Firebase Helper] User written to ${collectionName}/${user.userId}`,
    );
    return { success: true };
  } catch (error) {
    console.error("Error writing user to Firestore:", error);
    throw error;
  }
}

async function getUsersFromFirestore() {
  const db = getDbInstance();
  const collectionName = "users";
  const users = [];

  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error("Error fetching users from Firestore:", error);
    throw error;
  }
}

async function getUserFromFirestore(userId) {
  const db = getDbInstance();
  const collectionName = "users";

  try {
    const docRef = doc(db, collectionName, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user from Firestore:", error);
    throw error;
  }
}

export {
  validatePlaylist,
  writePlaylistToFirestore,
  getPlaylistsFromFirestore,
  getSharedPlaylistsFromFirestore,
  getPlaylistFromFirestore,
  writeUserToFirestore,
  getUsersFromFirestore,
  getUserFromFirestore,
};
