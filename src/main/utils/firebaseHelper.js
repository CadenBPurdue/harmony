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
    connectedServices: "object",
    friends: "array",
    incomingFriendRequests: "array",
    primaryService: "string",
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

async function manageFriendRequests() {
  const existingUser = await getCurrentUserFromFirestore();

  if (
    existingUser.incomingFriendRequests &&
    existingUser.incomingFriendRequests.length > 0
  ) {
    const friendRequests = existingUser.incomingFriendRequests;
    var newFriends = existingUser.friends || [];
    var newfriendRequests = existingUser.incomingFriendRequests || [];
    for (const requesterId of friendRequests) {
      const requester = await getUserFromFirestore(requesterId);
      if (requester.friends && requester.friends.includes(existingUser.id)) {
        newFriends.push(requesterId);
        newfriendRequests = newfriendRequests.filter(
          (id) => id !== requesterId,
        );
      }
    }

    const updatedUser = {
      ...existingUser,
      friends: newFriends,
      incomingFriendRequests: newfriendRequests,
    };

    await writeUserToFirestore(updatedUser);
    console.log(
      `[Firebase Helper] Friend requests managed for user ${existingUser.id}`,
    );
    return { success: true };
  }

  return { success: false, message: "No friend requests to manage" };
}

async function getUsersFromFirestore() {
  const db = getDbInstance();
  const collectionName = "users";
  const users = [];

  console.log("Successfully entered the function getUsersFromFirestore");

  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log("Successfully fetched users from Firestore");
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

async function getCurrentUserFromFirestore() {
  const auth = getAuthInstance();
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to fetch current user");
  }

  return await getUserFromFirestore(auth.currentUser.uid);
}

/**
 * Sends a friend request from the current user to another user
 * @param {string} targetUserId - The ID of the user to send the friend request to
 * @returns {Promise<Object>} - Success indicator
 */
async function sendFriendRequest(targetUserId) {
  const auth = getAuthInstance();
  const db = getDbInstance();
  const collectionName = "users";

  // Check if user is authenticated
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to send friend requests");
  }

  try {
    // Don't allow sending friend request to yourself
    if (targetUserId === auth.currentUser.uid) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Get target user and check if they exist
    const targetUserRef = doc(db, collectionName, targetUserId);
    const targetUserSnap = await getDoc(targetUserRef);

    if (!targetUserSnap.exists()) {
      throw new Error("Target user does not exist");
    }

    const targetUser = targetUserSnap.data();

    // Get current user data
    const currentUserSnap = await getDoc(
      doc(db, collectionName, auth.currentUser.uid),
    );
    if (!currentUserSnap.exists()) {
      throw new Error("Current user data not found in Firestore");
    }
    const currentUser = currentUserSnap.data();

    // Check if already friends
    if (
      targetUser.friends &&
      targetUser.friends.includes(auth.currentUser.uid)
    ) {
      throw new Error("You are already friends with this user");
    }

    // Check if friend request already sent
    if (
      targetUser.incomingFriendRequests &&
      targetUser.incomingFriendRequests.includes(auth.currentUser.uid)
    ) {
      throw new Error("Friend request already sent to this user");
    }

    // Check if they've sent you a request (accept it instead)
    if (
      currentUser.incomingFriendRequests &&
      currentUser.incomingFriendRequests.includes(targetUserId)
    ) {
      // Accept their request instead
      return await acceptFriendRequest(targetUserId);
    }

    // Add current user to target user's incomingFriendRequests
    const updatedIncomingRequests = targetUser.incomingFriendRequests || [];
    updatedIncomingRequests.push(auth.currentUser.uid);

    // Update the target user document
    await setDoc(
      targetUserRef,
      { incomingFriendRequests: updatedIncomingRequests },
      { merge: true },
    );

    console.log(
      `[Firebase Helper] Friend request sent to user ${targetUserId}`,
    );
    return { success: true };
  } catch (error) {
    console.error("Error sending friend request:", error);
    throw error;
  }
}

async function denyFriendRequest(requesterId) {
  const auth = getAuthInstance();
  const db = getDbInstance();
  const collectionName = "users";

  if (!auth.currentUser) {
    throw new Error("User must be authenticated to deny friend requests");
  }

  const currentUserRef = doc(db, collectionName, auth.currentUser.uid);
  const currentUserSnap = await getDoc(currentUserRef);

  if (!currentUserSnap.exists()) {
    throw new Error("Current user data not found");
  }

  const currentUser = currentUserSnap.data();
  const updatedRequests = currentUser.incomingFriendRequests.filter(
    (id) => id !== requesterId,
  );

  await setDoc(
    currentUserRef,
    { incomingFriendRequests: updatedRequests },
    { merge: true },
  );

  return { success: true };
}

/**
 * Accepts a friend request from another user
 * @param {string} requesterId - The ID of the user who sent the request
 * @returns {Promise<Object>} - Success indicator
 */
async function acceptFriendRequest(requesterId) {
  const auth = getAuthInstance();
  const db = getDbInstance();
  const collectionName = "users";

  // Check if user is authenticated
  if (!auth.currentUser) {
    throw new Error("User must be authenticated to accept friend requests");
  }

  try {
    // Get current user data
    const currentUserRef = doc(db, collectionName, auth.currentUser.uid);
    const currentUserSnap = await getDoc(currentUserRef);

    if (!currentUserSnap.exists()) {
      throw new Error("Current user data not found in Firestore");
    }

    const currentUser = currentUserSnap.data();

    // Check if the request exists
    if (
      !currentUser.incomingFriendRequests ||
      !currentUser.incomingFriendRequests.includes(requesterId)
    ) {
      throw new Error("No friend request found from this user");
    }

    // Get requester user data
    const requesterRef = doc(db, collectionName, requesterId);
    const requesterSnap = await getDoc(requesterRef);

    if (!requesterSnap.exists()) {
      throw new Error("Requester user does not exist");
    }

    // Update current user: remove from incoming requests and add to friends
    const updatedIncomingRequests = currentUser.incomingFriendRequests.filter(
      (id) => id !== requesterId,
    );

    const currentUserFriends = currentUser.friends || [];
    if (!currentUserFriends.includes(requesterId)) {
      currentUserFriends.push(requesterId);
    }

    await setDoc(
      currentUserRef,
      {
        incomingFriendRequests: updatedIncomingRequests,
        friends: currentUserFriends,
      },
      { merge: true },
    );

    // Instead of directly adding to friends, send a friend request if not already friends
    const requester = requesterSnap.data();

    // Check if the current user is already in requester's friends list
    const requesterFriends = requester.friends || [];
    if (requesterFriends.includes(auth.currentUser.uid)) {
      console.log("Users are already friends");
    } else {
      // Add current user to requester's incoming friend requests if not already there
      const requesterIncomingRequests = requester.incomingFriendRequests || [];

      if (!requesterIncomingRequests.includes(auth.currentUser.uid)) {
        requesterIncomingRequests.push(auth.currentUser.uid);
        await setDoc(
          requesterRef,
          { incomingFriendRequests: requesterIncomingRequests },
          { merge: true },
        );
        console.log(`Friend request sent to user ${requesterId}`);
      }
    }

    console.log(
      `[Firebase Helper] Friend request accepted from user ${requesterId}`,
    );
    return { success: true };
  } catch (error) {
    console.error("Error accepting friend request:", error);
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
  getCurrentUserFromFirestore,
  sendFriendRequest,
  acceptFriendRequest,
  denyFriendRequest,
  manageFriendRequests,
};
